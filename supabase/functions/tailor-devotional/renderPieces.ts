/*
  Piece splitting for the tailored render (Nov 13, 2026 — the free-plan fix).

  The tailored devotional is rendered in ONE invocation (the privacy rule:
  nothing is stored server-side, so there is no bucket brigade as in
  audio-render — the audio exists only in memory and leaves as base64 in the
  response). The old shape held the whole program in the sample domain at
  once: every part decoded, stretched, concatenated into a single multi-
  minute PCM block, then encoded. On the new project's free-plan worker
  limits that peak is what dies (WORKER_RESOURCE_LIMIT).

  The fix keeps the invocation whole but cuts its peak: each spoken piece is
  carried through TTS → decode → stretch → MP3 encode one at a time and its
  PCM released before the next piece starts, and the encoded pieces are then
  joined as bytes — the same frame concatenation audio-render's finalize
  relies on (identical encoder settings: 24 kHz mono CBR 64 kbps, lamejs
  bare frames). The one long piece, the day's readings entire, is split on
  its paragraph boundaries (narratorCore joins the reading paragraphs with
  blank lines when it assembles the script), so no single PCM block exceeds
  one reading part — the Gospel, a few minutes at most.

  This file imports NOTHING on purpose: vitest exercises it directly
  (renderPieces.test.ts), and the edge function bundles it as-is.
*/

/**
 * The readings script's paragraphs, in order. narratorCore assembles
 * `script.readings` by joining the reading paragraphs with "\n\n", so the
 * split is exact: joining the result with "\n\n" reproduces the input.
 * Empty paragraphs (a stray blank run) are dropped rather than spoken.
 */
export function splitReadingsParagraphs(readings: string): string[] {
  return readings.split("\n\n").filter((paragraph) => paragraph.trim().length > 0);
}
