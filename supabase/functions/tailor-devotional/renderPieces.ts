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

  The same splitters now also cut the CLIENT-ORCHESTRATED audio plan
  (audioPlan.ts): the build hands the device a signed list of ≤200-char
  pieces, each rendered afterwards by its own call — because the SUM of a
  whole program's stretch+encode (~6 s CPU) still exceeds the platform's
  2 s per-request ceiling no matter how the peak is cut. The readings keep
  their paragraph split as the outer cut; every segment then goes through
  splitSpokenText so no single piece — Gospel paragraph included — exceeds
  the proven ~15 s envelope.

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

/**
 * The per-piece character ceiling for the client-orchestrated audio plan
 * (audioPlan.ts): at narration pace (~800–900 chars/minute) 200 chars is
 * ~13–15 s of audio — the proven head-piece envelope from the daily render,
 * the size whose stretch+encode CPU (≈0.83 s) fits the platform's 2 s
 * per-request ceiling with room to spare. No spoken piece may exceed it:
 * a piece that does would risk the same worker kill the plan exists to avoid.
 */
export const TAILOR_PIECE_MAX_CHARS = 200;

/**
 * Split speech text into chunks of at most maxChars, preferring paragraph
 * boundaries. Paragraphs are packed greedily in order (with their original
 * separators, so in-chunk pauses survive verbatim); a paragraph that alone
 * exceeds the cap is split at sentence boundaries; a single sentence that
 * still exceeds it is hard-wrapped at word boundaries (a lone over-long word
 * is sliced — pathological, but the cap is the cap). Deterministic: the same
 * text always yields the same chunks, so a build's plan and the pieces the
 * client fetches for it can never drift apart. Mirrors the daily render's
 * splitSpeechText (audio-render/renderPlan.ts) by design — the two renders
 * cut speech by the same rules. A chunk boundary replaces the paragraph
 * break it consumed — the seam becomes an MP3 join.
 */
export function splitSpokenText(text: string, maxChars: number = TAILOR_PIECE_MAX_CHARS): string[] {
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
