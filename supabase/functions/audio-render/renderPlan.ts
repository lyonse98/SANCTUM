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

  Fourth round (Nov 13, 2026): the joins themselves. Each piece is padded
  with produced silence before its encode (audioEngine.ts — encoder delay
  and TTS edge clips were eating syllables at every byte join), and the
  pause-map beats a chunk boundary consumes are accounted here
  (splitSpeechTextDetailed) and restored at the join as produced silence
  (mainJoinPlan) — in the monolith they rode inside the single TTS call
  and always reached the engine; the cut had been dropping them silently
  whenever a beat joint landed on a boundary.

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

import {
  AUDIO_SILENCE_SECONDS,
  audioSegmentPath,
  type NarratorAudience,
} from "./narratorCore.ts";

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
 * One beat of the persona pause map (narratorCore's `pauseBeats`, spec §5.2)
 * as produced silence, in seconds.
 *
 * The monolith never gave a beat a sample-domain size: a beat was one extra
 * blank line inside the day's single TTS call, and the engine's prosody made
 * of it whatever it made (see the fourth-round note at splitSpeechText).
 * Restoring a boundary-eaten beat as produced silence therefore needs a
 * chosen unit, and 0.6 s is the spoken breath: clearly longer than the
 * 340 ms a padded seam already carries (so a beat still reads as the
 * persona's deliberate pause, never as join noise), and well short of the
 * 2.0 s A/B group silence (so that pause keeps its unique rank). Every
 * bank's beats are 0 or 1 today, so in practice a restored joint is 0.6 s.
 */
export const BEAT_SILENCE_SECONDS = 0.6;

/**
 * Beats carried by a paragraph separator. joinParagraphs builds a joint as
 * '\n\n' plus one extra '\n' per beat, so the beat count is the newline run
 * past the plain paragraph break. (Any separator the assembler produced is
 * a pure newline run; the count is taken over newlines only.)
 */
function beatsOfSeparator(sep: string): number {
  let newlines = 0;
  for (const c of sep) if (c === "\n") newlines++;
  return Math.max(0, newlines - 2);
}

export interface SplitResult {
  chunks: string[];
  /**
   * Aligned with `chunks`: the pause-map beats consumed by the boundary
   * that STARTS each chunk — the separator that was dropped to open it.
   * A joint packed inside a chunk keeps its separator verbatim in the
   * chunk's text (the TTS realizes the beat, as it did for the monolith),
   * so only boundary joints appear here. chunks[0] always starts a text,
   * never a consumed joint: its entry is 0.
   */
  boundaryBeats: number[];
}

/**
 * Split speech text into chunks of at most maxChars, preferring paragraph
 * boundaries — and account for the pause-map beats the cut consumes.
 *
 * Beats, fourth round (Nov 13, 2026): the assembler encodes each persona's
 * pause map as extra blank lines at named joints of main-A/main-B (after
 * the scene, after the Gospel, before/after the challenge). The monolith
 * passed each half to the TTS whole, so every beat always reached the
 * engine. The piece cut changed that: a joint packed inside a chunk keeps
 * its separator verbatim (still realized), but a joint the cut turns into
 * a chunk boundary loses its separator entirely — the beat silently
 * became a bare MP3 join. The packing itself is unchanged (the same
 * chunks as always); what is new is the bookkeeping: the beats a boundary
 * consumed are recorded in `boundaryBeats`, and mainJoinPlan restores
 * them at finalize as produced silence, so a beat survives the cut in
 * one form or the other — never neither.
 *
 * Packing: paragraphs are packed greedily in order (with their original
 * separators, so in-chunk pauses survive verbatim); a paragraph that alone
 * exceeds the cap is split at sentence boundaries — its first sentence
 * joins by the paragraph's own separator, exactly like a whole paragraph,
 * and the rest by a space; a single sentence that still exceeds the cap
 * is hard-wrapped at word boundaries into standalone chunks (a lone
 * over-long word is sliced — pathological, but the cap is the cap).
 * Deterministic: the same text always yields the same chunks, which is
 * what lets every chained invocation rebuild the identical piece list.
 */
export function splitSpeechTextDetailed(
  text: string,
  maxChars: number = MAIN_PIECE_MAX_CHARS,
): SplitResult {
  // Tokenize into paragraphs, remembering the separator before each one.
  const tokens = text.split(/(\n{2,})/);
  const paragraphs: { sep: string; body: string }[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const body = (tokens[i] ?? "").trim();
    if (!body) continue;
    paragraphs.push({ sep: i === 0 ? "" : (tokens[i - 1] ?? "\n\n"), body });
  }

  // The packable items, in order: a paragraph that fits is one item; an
  // over-cap paragraph becomes its sentences (the first keeps the
  // paragraph's separator, the rest a space); an over-cap sentence becomes
  // standalone hard-wrapped chunks, which never pack with anything.
  const items: { text: string; sep: string; standalone: boolean }[] = [];
  for (const { sep, body } of paragraphs) {
    if (body.length <= maxChars) {
      items.push({ text: body, sep, standalone: false });
      continue;
    }
    splitSentences(body).forEach((sentence, j) => {
      const itemSep = j === 0 ? sep : " ";
      if (sentence.length <= maxChars) {
        items.push({ text: sentence, sep: itemSep, standalone: false });
        return;
      }
      hardWrap(sentence, maxChars).forEach((piece, k) => {
        items.push({ text: piece, sep: k === 0 ? itemSep : "", standalone: true });
      });
    });
  }

  const chunks: string[] = [];
  const boundaryBeats: number[] = [];
  let cur = "";
  let curBeats = 0; // beats of the boundary that started `cur`
  const flush = () => {
    if (cur) {
      chunks.push(cur);
      boundaryBeats.push(curBeats);
      cur = "";
      curBeats = 0;
    }
  };
  for (const item of items) {
    if (item.standalone) {
      // A hard-wrapped chunk stands alone: whatever the current chunk
      // holds is finished, and the piece takes the boundary that preceded
      // its sentence.
      flush();
      chunks.push(item.text);
      boundaryBeats.push(beatsOfSeparator(item.sep));
      continue;
    }
    if (!cur) {
      cur = item.text;
      curBeats = beatsOfSeparator(item.sep);
      continue;
    }
    if ((cur + item.sep + item.text).length <= maxChars) {
      cur += item.sep + item.text;
      continue;
    }
    flush();
    cur = item.text;
    curBeats = beatsOfSeparator(item.sep);
  }
  flush();
  return { chunks, boundaryBeats };
}

/**
 * Split speech text into chunks of at most maxChars. The chunk list alone;
 * splitSpeechTextDetailed additionally reports the pause-map beats each
 * chunk boundary consumed.
 */
export function splitSpeechText(text: string, maxChars: number = MAIN_PIECE_MAX_CHARS): string[] {
  return splitSpeechTextDetailed(text, maxChars).chunks;
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
  /**
   * Pause-map beats consumed by chunk boundaries, aligned with the
   * flattened main chunk list (A's chunks, then B's — the same indexing
   * as the chunk numbers in the piece ids). The first chunk of each group
   * is always 0: a group opens a text, and the joint between the groups
   * is the produced A/B silence, not a text joint.
   */
  boundaryBeats: number[];
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
  const a = splitSpeechTextDetailed(mainA, maxChars);
  const b = splitSpeechTextDetailed(mainB, maxChars);
  const aChunks = a.chunks;
  const bChunks = b.chunks;
  const specs: PieceSpec[] = [HEAD_AM, HEAD_PM];
  aChunks.forEach((_, i) => {
    specs.push({ id: mainPieceId(i), kind: "main", group: "a", index: i });
  });
  bChunks.forEach((_, j) => {
    const index = aChunks.length + j;
    specs.push({ id: mainPieceId(index), kind: "main", group: "b", index });
  });
  return { aChunks, bChunks, specs, boundaryBeats: [...a.boundaryBeats, ...b.boundaryBeats] };
}

export type MainJoinPart =
  | { kind: "piece"; id: string }
  | { kind: "silence"; seconds: number };

/**
 * The finalize join, as data: every main piece in order, the beats the cut
 * consumed restored as produced silence at their seams, and the produced
 * A/B silence exactly where it has always sat — between the A group and
 * the B group. A group with no pieces contributes nothing (and earns no
 * group silence). `boundaryBeats` is splitMainScript's accounting, aligned
 * with the flattened chunk list; omitting it yields the pre-restoration
 * join (the group silence only).
 */
export function mainJoinPlan(
  specs: readonly PieceSpec[],
  boundaryBeats: readonly number[] = [],
): MainJoinPart[] {
  const parts: MainJoinPart[] = [];
  const a = specs.filter((s) => s.kind === "main" && s.group === "a");
  const b = specs.filter((s) => s.kind === "main" && s.group === "b");
  const beatsBefore = (piece: PieceSpec, firstInGroup: boolean) => {
    if (firstInGroup) return;
    const beats = boundaryBeats[piece.index] ?? 0;
    if (beats > 0) parts.push({ kind: "silence", seconds: beats * BEAT_SILENCE_SECONDS });
  };
  a.forEach((s, i) => {
    beatsBefore(s, i === 0);
    parts.push({ kind: "piece", id: s.id });
  });
  if (a.length > 0 && b.length > 0) parts.push({ kind: "silence", seconds: AUDIO_SILENCE_SECONDS });
  b.forEach((s, i) => {
    beatsBefore(s, i === 0);
    parts.push({ kind: "piece", id: s.id });
  });
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
