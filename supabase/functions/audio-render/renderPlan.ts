/*
  Piece planner for the daily audio render (rework, Nov 13, 2026).

  A full day's render used to run inside ONE edge invocation: four Gemini TTS
  calls, four PCM decodes + WSOLA tempo stretches, and three MP3 encodes, with
  the whole main track concatenated in memory. On the free-tier Supabase
  project that monolith dies with WORKER_RESOURCE_LIMIT — the worker is
  killed before it can even record its failure, and the row sticks at
  `rendering`. The render is piece-work now: each invocation renders at most
  ONE segment, persists it, and chains to itself for the next.

  This module is the pure decision core: given the daily_audio row state and
  which piece files already exist in storage, what should this invocation do?
  Storage is the progress ledger — daily_audio has no piece column and needs
  none, because a storage object either exists whole or not at all, so a
  crashed invocation leaves an exact, resumable record of what is done.

  Attempt discipline (spec §8.2, adapted): an attempt is consumed when a
  chain STARTS from zero completed pieces — a fresh day, or a retry of a day
  that never got a single piece down. Resuming a half-rendered day consumes
  nothing: the remaining spend is bounded by the pieces themselves, and the
  day's progress is never thrown away by a counter. The §8.2 caps therefore
  gate fresh starts exactly as before (a failed day at RETRY_ATTEMPTS fresh
  starts is done; MAX_ATTEMPTS is the hard cap), while a day with pieces on
  disk can always be finished by a later call. That is what lets the two
  2026-11-13 rows — stuck at attempts=2, status `rendering`, zero pieces —
  complete on the next ordinary schedule call after this ships: the call
  starts attempt 3, and from the first uploaded piece onward the chain is
  resumable for free.
*/

import { audioSegmentPath, type NarratorAudience } from "./narratorCore.ts";

export type RenderPiece = "head-am" | "head-pm" | "main-a" | "main-b";

/** Render order. The heads are independent; main's halves render separately
 *  and are joined as encoded bytes at finalize. */
export const RENDER_PIECES: readonly RenderPiece[] = ["head-am", "head-pm", "main-a", "main-b"];

export function isMainPiece(piece: RenderPiece): boolean {
  return piece === "main-a" || piece === "main-b";
}

/**
 * Where a piece lives in the daily-audio bucket.
 *
 * Heads go straight to their FINAL path (audioSegmentPath): the client only
 * ever reads paths off a `ready` row, so a finished head sitting at its final
 * address is invisible until finalize flips the row. Main's halves stage
 * under parts/ instead — neither half alone is the main track, and the final
 * main.mp3 must never exist in a half-written form.
 */
export function pieceStoragePath(
  dateISO: string,
  audience: NarratorAudience,
  piece: RenderPiece,
): string {
  if (piece === "main-a" || piece === "main-b") {
    return `${dateISO}/${audience}/parts/${piece}.mp3`;
  }
  return audioSegmentPath(dateISO, audience, piece);
}

/** Every storage path a force re-render must wipe so no stale piece can be
 *  mistaken for fresh progress (a leftover head-pm from the old render would
 *  otherwise be glued to the new head-am at finalize). */
export function allPiecePaths(dateISO: string, audience: NarratorAudience): string[] {
  return [
    ...RENDER_PIECES.map((p) => pieceStoragePath(dateISO, audience, p)),
    audioSegmentPath(dateISO, audience, "main"),
  ];
}

/** The first piece not yet in storage, or null when the day is fully rendered. */
export function nextPiece(piecesDone: ReadonlySet<RenderPiece>): RenderPiece | null {
  for (const piece of RENDER_PIECES) {
    if (!piecesDone.has(piece)) return piece;
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
  piecesDone: ReadonlySet<RenderPiece>;
  maxAttempts: number;
  retryAttempts: number;
}

export type PlanAction =
  | { kind: "skip"; reason: "ready" | "in-flight" | "attempts" }
  | { kind: "render"; piece: RenderPiece; mode: "tts" | "copy"; claimAttempt: boolean }
  | { kind: "finalize" };

export function planNext(input: PlanInput): PlanAction {
  const { status, attempts, force, viaStep, piecesDone } = input;

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

  const piece = nextPiece(piecesDone);
  if (piece === null) return { kind: "finalize" };

  // Fresh starts are what the attempt caps govern (§8.2.9). A day holding
  // pieces is resumed without touching the counter.
  const freshStart = piecesDone.size === 0;
  if (freshStart && !force) {
    if (status === "failed" && attempts >= input.retryAttempts) {
      return { kind: "skip", reason: "attempts" };
    }
    if (attempts >= input.maxAttempts) {
      return { kind: "skip", reason: "attempts" };
    }
  }

  return {
    kind: "render",
    piece,
    mode: piece === "head-pm" && input.lector ? "copy" : "tts",
    claimAttempt: freshStart,
  };
}
