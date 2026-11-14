/*
  Piece planner for the daily audio render (rework, Nov 13, 2026; finer
  pieces, Nov 13, 2026 second round; head-scale pieces, third round).

  A full day's render used to run inside ONE edge invocation: four Gemini TTS
  calls, four PCM decodes + WSOLA tempo stretches, and three MP3 encodes, with
  the whole main track concatenated in memory. On the free-tier Supabase
  project that monolith dies with WORKER_RESOURCE_LIMIT — the worker is
  killed before it can even record its failure, and the row sticks at
  `rendering`. The first piece-work round (one invocation per segment) fixed
  the heads but not the main track: a multi-minute main half is still too
  much PCM for one invocation — decode + WSOLA + lamejs on minutes of audio
  kills the worker exactly the same way. So the main track is cut at
  paragraph boundaries into pieces of at most MAIN_PIECE_MAX_CHARS of speech
  text and each invocation renders at most ONE piece, persists it, and
  chains to itself for the next.

  Third round (Nov 13, 2026): the binding limit is not memory or wall-clock
  but CPU — Supabase allows 2 seconds of CPU per edge request on EVERY plan,
  and the local engine timings price stretch+encode at ≈0.83 s of CPU for
  ~13 s of audio (the head pieces, which succeed live) against ≈2.1 s for
  ~55 s (an 800-char main piece, which died live). The cap therefore drops
  to the proven head envelope: 200 chars ≈ 15 s of speech per piece. A day's
  main track becomes more, smaller pieces — the chain and the storage ledger
  absorb the count; what they cannot absorb is a single over-budget call.

  This module is the pure decision core: given the day's piece list (built
  deterministically from the assembled script), the daily_audio row state,
  and which piece files already exist in storage, what should this
  invocation do? Storage is the progress ledger — daily_audio has no piece
  column and needs none, because a storage object either exists whole or
  not at all, so a crashed invocation leaves an exact, resumable record of
  what is done.

  Attempt discipline (spec §8.2, adapted twice):
  - An attempt is consumed when a chain STARTS from zero completed pieces —
    a fresh day, or a retry of a day that never got a single piece down.
    Resuming a day that holds pieces consumes nothing: the remaining spend
    is bounded by the pieces themselves, and progress is never thrown away
    by a counter. The caps below therefore gate fresh starts only.
  - A day whose invocations RAN and reported failure (status `failed`)
    stops at RETRY_ATTEMPTS fresh starts, exactly as §8.2.9 always said;
    Erik's force key is the escape hatch.
  - The hard cap (MAX_ATTEMPTS, set by the caller) stops fresh starts for
    any other claim state — EXCEPT the worker-kill fossil: status
    `rendering`, zero pieces, at any attempt count. Those attempts never
    ran any pipeline code to completion; the platform killed them before
    they could record anything, so counting them against the day would
    punish the day for the platform's kills (the women's 2026-11-13 row
    burned all 3 of the old cap on dead kicks and could never start again).
    A fossil restart cannot spin on its own: each start needs an external
    call (the schedule fires twice a morning), and the first piece that
    lands moves the day onto the free-resume rule, while a recorded failure
    moves it onto the `failed` rule. MAX_ATTEMPTS itself is 6 (see
    index.ts): a fresh start costs one bundle fetch plus at most one short
    TTS call before the first piece exists, so six starts buy a day room
    for a morning kill, a retry kill, and several manual kicks, with the
    recorded-failure stop at 2 keeping genuinely broken days cheap.
*/

import { audioSegmentPath, type NarratorAudience } from "./narratorCore.ts";

/**
 * Target ceiling for one main-track piece, in characters of speech text.
 * At narration pace (~800–900 chars/minute) 200 chars is ~13–15 s of audio —
 * the proven head-piece envelope. The budget that binds is CPU: 2 s per edge
 * request on every Supabase plan, and stretch+encode measures ≈0.83 s of CPU
 * at this size against ≈2.1 s at the old 800-char cap (which died live). A
 * day's main track is therefore a few dozen small pieces, not a dozen large
 * ones — the chain absorbs the count, and no single call is over budget.
 */
export const MAIN_PIECE_MAX_CHARS = 200;

/**
 * One unit of render work. Heads are single pieces at their final paths
 * (proven size). Main pieces are numbered chunks staged under parts/;
 * `group` records which side of the produced silence a chunk belongs to,
 * and `index` is the chunk's position across the whole main track (the A
 * group's chunks come first, then the B group's).
 */
export interface PieceSpec {
  id: string;
  kind: "head" | "main";
  group: "a" | "b" | null;
  index: number;
}

export const HEAD_AM: PieceSpec = { id: "head-am", kind: "head", group: null, index: -1 };
export const HEAD_PM: PieceSpec = { id: "head-pm", kind: "head", group: null, index: -1 };

export function mainPieceId(index: number): string {
  return `main-${String(index).padStart(3, "0")}`;
}

export function isMainPiece(piece: PieceSpec): boolean {
  return piece.kind === "main";
}

/**
 * Split speech text into chunks of at most maxChars, preferring paragraph
 * boundaries. Paragraphs are packed greedily in order (with their original
 * separators, so in-chunk pauses survive verbatim); a paragraph that alone
 * exceeds the cap is split at sentence boundaries; a single sentence that
 * still exceeds it is hard-wrapped at word boundaries (a lone over-long
 * word is sliced — pathological, but the cap is the cap). Deterministic:
 * the same text always yields the same chunks, which is what lets every
 * chained invocation rebuild the identical piece list. A chunk boundary
 * replaces the paragraph break it consumed — the seam becomes an MP3 join,
 * the same trade the coarser main-a/main-b split already made.
 */
export function splitSpeechText(text: string, maxChars: number = MAIN_PIECE_MAX_CHARS): string[] {
  // Tokenize into paragraphs, remembering the separator before each one.
  const tokens = text.split(/(\n{2,})/);
  const paragraphs: { sep: string; body: string }[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const body = (tokens[i] ?? "").trim();
    if (!body) continue;
    paragraphs.push({ sep: i === 0 ? "" : (tokens[i - 1] ?? "\n\n"), body });
  }

  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur) {
      chunks.push(cur);
      cur = "";
    }
  };
  const add = (body: string, sep: string) => {
    if (!cur) {
      cur = body;
      return;
    }
    if ((cur + sep + body).length <= maxChars) {
      cur += sep + body;
      return;
    }
    flush();
    cur = body;
  };

  for (const { sep, body } of paragraphs) {
    if (body.length <= maxChars) {
      add(body, sep);
      continue;
    }
    // One paragraph over the cap: fall to sentence boundaries.
    for (const sentence of splitSentences(body)) {
      if (sentence.length <= maxChars) {
        add(sentence, " ");
        continue;
      }
      // One sentence over the cap: hard-wrap it into standalone chunks.
      flush();
      for (const piece of hardWrap(sentence, maxChars)) chunks.push(piece);
    }
  }
  flush();
  return chunks;
}

/** Sentence spans of a paragraph, terminators and closing quotes attached. */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== "." && c !== "!" && c !== "?" && c !== "…") continue;
    let j = i;
    while (j + 1 < text.length && ".!?…".includes(text[j + 1])) j++;
    while (j + 1 < text.length && "\"'”’)]".includes(text[j + 1])) j++;
    if (j + 1 >= text.length || /\s/.test(text[j + 1])) {
      const sentence = text.slice(start, j + 1).trim();
      if (sentence) out.push(sentence);
      start = j + 1;
      i = j;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function hardWrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter((p) => p.length > 0);
}

export interface MainSplit {
  aChunks: string[];
  bChunks: string[];
  /** The day's full ordered piece list: heads first, then main chunks. */
  specs: PieceSpec[];
}

/**
 * Cut the assembled main track into pieces and lay out the day's piece
 * list. Chunk numbering runs across the silence (A's chunks, then B's), so
 * the parts/ folder sorts into render order on sight.
 */
export function splitMainScript(
  mainA: string,
  mainB: string,
  maxChars: number = MAIN_PIECE_MAX_CHARS,
): MainSplit {
  const aChunks = splitSpeechText(mainA, maxChars);
  const bChunks = splitSpeechText(mainB, maxChars);
  const specs: PieceSpec[] = [HEAD_AM, HEAD_PM];
  aChunks.forEach((_, i) => {
    specs.push({ id: mainPieceId(i), kind: "main", group: "a", index: i });
  });
  bChunks.forEach((_, j) => {
    const index = aChunks.length + j;
    specs.push({ id: mainPieceId(index), kind: "main", group: "b", index });
  });
  return { aChunks, bChunks, specs };
}

export type MainJoinPart = { kind: "piece"; id: string } | { kind: "silence" };

/**
 * The finalize join, as data: every main piece in order, with the produced
 * silence exactly where it has always sat — between the A group and the B
 * group — and only there. A group with no pieces contributes nothing (and
 * earns no silence).
 */
export function mainJoinPlan(specs: readonly PieceSpec[]): MainJoinPart[] {
  const parts: MainJoinPart[] = [];
  const a = specs.filter((s) => s.kind === "main" && s.group === "a");
  const b = specs.filter((s) => s.kind === "main" && s.group === "b");
  for (const s of a) parts.push({ kind: "piece", id: s.id });
  if (a.length > 0 && b.length > 0) parts.push({ kind: "silence" });
  for (const s of b) parts.push({ kind: "piece", id: s.id });
  return parts;
}

/**
 * Where a piece lives in the daily-audio bucket.
 *
 * Heads go straight to their FINAL path (audioSegmentPath): the client only
 * ever reads paths off a `ready` row, so a finished head sitting at its final
 * address is invisible until finalize flips the row. Main chunks stage under
 * parts/ instead — no chunk alone is the main track, and the final main.mp3
 * must never exist in a half-written form.
 */
export function pieceStoragePath(
  dateISO: string,
  audience: NarratorAudience,
  piece: PieceSpec,
): string {
  if (piece.kind === "main") {
    return `${dateISO}/${audience}/parts/${piece.id}.mp3`;
  }
  return audioSegmentPath(dateISO, audience, piece.id as "head-am" | "head-pm");
}

/** The day's finished-file paths — what a force re-render wipes by name.
 *  Staged main chunks are wiped by listing parts/ (their count is the
 *  script's, not a constant), which the caller does alongside. */
export function finalFilePaths(dateISO: string, audience: NarratorAudience): string[] {
  return [
    audioSegmentPath(dateISO, audience, "head-am"),
    audioSegmentPath(dateISO, audience, "head-pm"),
    audioSegmentPath(dateISO, audience, "main"),
  ];
}

/** The first piece not yet in storage, or null when the day is fully rendered. */
export function nextPiece(
  specs: readonly PieceSpec[],
  piecesDone: ReadonlySet<string>,
): PieceSpec | null {
  for (const spec of specs) {
    if (!piecesDone.has(spec.id)) return spec;
  }
  return null;
}

/**
 * Duration of a CBR MP3 from its byte count. Every render encodes at 64 kbps
 * CBR (spec §3.3), so a finished file's length is its duration to within one
 * frame (~48 ms) — close enough for the player's display, and the only way
 * to price the main track at finalize, where the PCM no longer exists.
 */
export function mp3SecondsFromBytes(bytes: number, bitrateKbps = 64): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.round(((bytes * 8) / (bitrateKbps * 1000)) * 10) / 10;
}

export interface PlanInput {
  /** daily_audio.status, or null when the day has no row yet. */
  status: string | null;
  attempts: number;
  /** daily_audio.updated_at as epoch ms, or null. */
  updatedAtMs: number | null;
  nowMs: number;
  /** How long a `rendering` row counts as actively worked (RENDERING_STALE_MS). */
  staleMs: number;
  force: boolean;
  /**
   * True when this invocation is the render's own chained continuation (the
   * step call carries the render key). A step call IS the in-flight render
   * arriving for its next piece, so the freshness gate must not stop it;
   * external calls (the schedule, Erik) still respect the gate.
   */
  viaStep: boolean;
  /** Lector days speak one head for both dayparts: head-pm is a byte copy. */
  lector: boolean;
  /** The day's full ordered piece list (splitMainScript on the assembled script). */
  pieces: readonly PieceSpec[];
  /** Ids of pieces already in storage — the progress ledger. */
  piecesDone: ReadonlySet<string>;
  maxAttempts: number;
  retryAttempts: number;
}

export type PlanAction =
  | { kind: "skip"; reason: "ready" | "in-flight" | "attempts" }
  | { kind: "render"; piece: PieceSpec; mode: "tts" | "copy"; claimAttempt: boolean }
  | { kind: "finalize" };

export function planNext(input: PlanInput): PlanAction {
  const { status, attempts, force, viaStep, pieces, piecesDone } = input;

  // A ready day is terminal unless Erik forces a re-render (§8.2 step 1).
  if (status === "ready" && !force) return { kind: "skip", reason: "ready" };

  // Someone is mid-render and the heartbeat is fresh: external callers stand
  // down. The chain's own step calls are that someone, and proceed.
  if (
    !viaStep &&
    status === "rendering" &&
    input.updatedAtMs !== null &&
    input.nowMs - input.updatedAtMs < input.staleMs
  ) {
    return { kind: "skip", reason: "in-flight" };
  }

  const piece = nextPiece(pieces, piecesDone);
  if (piece === null) return { kind: "finalize" };

  // Fresh starts are what the attempt caps govern. A day holding pieces is
  // resumed without touching the counter, whatever the caps say.
  const freshStart = piecesDone.size === 0;
  if (freshStart && !force) {
    // Recorded failures stop at the retry window (§8.2.9): the pipeline ran,
    // reported, and is done — force is the deliberate way back in.
    if (status === "failed" && attempts >= input.retryAttempts) {
      return { kind: "skip", reason: "attempts" };
    }
    // The hard cap stops fresh starts in any other claim state — but never
    // the worker-kill fossil. A `rendering` row with zero pieces means every
    // attempt so far was killed before it could record an outcome; leaving
    // the day unstartable would let the platform's limits delete a day's
    // audio outright. (See the header: a fossil restart cannot loop — it
    // takes an external call, and any outcome at all moves the day onto
    // one of the gated rules above.)
    if (status !== "rendering" && attempts >= input.maxAttempts) {
      return { kind: "skip", reason: "attempts" };
    }
  }

  return {
    kind: "render",
    piece,
    mode: piece.id === "head-pm" && input.lector ? "copy" : "tts",
    claimAttempt: freshStart,
  };
}
