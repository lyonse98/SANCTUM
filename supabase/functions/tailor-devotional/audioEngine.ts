// COPY of supabase/functions/audio-render/audioEngine.ts — the speech-sample engine
// (decode, WSOLA tempo, concatenation, produced silence) shared with Tailor Today so a
// tailored devotional is produced to the identical standard as the daily render.
// A vitest pin (tailorCore.test.ts) asserts this copy matches the original below this
// header; if the engine changes there, it changes here in the same commit.
/*
  Sample-domain audio work for the audio renderer (spec §8.4) — no ffmpeg on the server,
  so everything the samples did with ffmpeg happens here over raw PCM samples:

  - decodeSpeechAudio: the TTS response lands as raw PCM (signed 16-bit, 24 kHz, mono)
    or, on some days, wrapped in a WAV container; both become one Int16Array.
  - stretchPcm: the persona's tempo (0.88x–1.08x) as a pitch-preserving WSOLA stretch —
    the same algorithm family as ffmpeg's `atempo`, which the samples used.
  - silence: the produced 2.0 s pause between main-A and main-B is exact by construction
    (a run of zero samples), better than the samples' file concat.
  - concatPcm: plain sample-domain joins.

  This file imports NOTHING on purpose: vitest exercises it directly
  (audioEngine.test.ts), and the edge function bundles it as-is. The MP3 encode lives in
  index.ts, the only place the lamejs npm import appears.
*/

export const SAMPLE_RATE = 24000;

// ── Decode ────────────────────────────────────────────────────────────────────

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/**
 * TTS audio bytes → mono 24 kHz Int16 samples. WAV-wrapped responses are unwrapped
 * (PCM16 only; channels are downmixed by averaging); anything else is treated as raw
 * signed-16-bit little-endian PCM, which is what the samples received.
 */
export function decodeSpeechAudio(bytes: Uint8Array): Int16Array {
  if (bytes.length >= 12 && readTag(bytes, 0) === "RIFF" && readTag(bytes, 8) === "WAVE") {
    return decodeWav(bytes);
  }
  return pcm16leToSamples(bytes, 0, bytes.length);
}

function pcm16leToSamples(bytes: Uint8Array, start: number, end: number): Int16Array {
  const count = Math.floor((end - start) / 2);
  const out = new Int16Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(start + i * 2, true);
  }
  return out;
}

function decodeWav(bytes: Uint8Array): Int16Array {
  let channels = 1;
  let bitsPerSample = 16;
  let audioFormat = 1;
  let dataStart = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const tag = readTag(bytes, offset);
    const size = u32le(bytes, offset + 4);
    const body = offset + 8;
    if (tag === "fmt ") {
      audioFormat = u16le(bytes, body);
      channels = Math.max(1, u16le(bytes, body + 2));
      bitsPerSample = u16le(bytes, body + 14);
    } else if (tag === "data") {
      dataStart = body;
      dataLength = Math.min(size, bytes.length - body);
      break;
    }
    offset = body + size + (size % 2);
  }

  if (dataStart < 0) throw new Error("wav: no data chunk");
  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(`wav: unsupported format ${audioFormat}/${bitsPerSample}-bit`);
  }
  if (channels === 1) return pcm16leToSamples(bytes, dataStart, dataStart + dataLength);

  const frames = Math.floor(dataLength / 2 / channels);
  const out = new Int16Array(frames);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += view.getInt16(dataStart + (f * channels + c) * 2, true);
    }
    out[f] = Math.round(sum / channels);
  }
  return out;
}

// ── WSOLA time-stretch ────────────────────────────────────────────────────────

const WINDOW = 512; // ~21 ms at 24 kHz
const SYNTH_HOP = 128; // output samples between successive frame starts
const TOLERANCE = 256; // ± search around the nominal input position (spans a low voice's period)
const OVERLAP = WINDOW - SYNTH_HOP;

/** Cross-correlation of `a` (at aOff) with `b` (at bOff), every `step`-th sample. */
function correlate(a: Int16Array, aOff: number, b: Int16Array, bOff: number, length: number, step: number): number {
  let sum = 0;
  for (let i = 0; i < length; i += step) {
    sum += a[aOff + i] * b[bOff + i];
  }
  return sum;
}

/**
 * Pitch-preserving stretch. rate > 1 → faster (shorter); rate < 1 → slower (longer).
 * Output length is round(input / rate). Frames are Hann-windowed and overlap-added,
 * each aligned by a two-stage correlation search (coarse on decimated samples, then a
 * full-resolution refine) against the previous frame's tail — classic WSOLA.
 */
export function stretchPcm(input: Int16Array, rate: number): Int16Array {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("stretch: bad rate");
  if (Math.abs(rate - 1) < 1e-9 || input.length < WINDOW * 2) return new Int16Array(input);

  const targetLength = Math.round(input.length / rate);
  const out = new Float32Array(targetLength + WINDOW);
  const weight = new Float32Array(targetLength + WINDOW);
  const window = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (WINDOW - 1)));
  }

  // The previous frame, kept so the next frame can align to its tail.
  const prev = new Int16Array(WINDOW);
  let havePrev = false;

  const advance = SYNTH_HOP * rate; // input samples consumed per output hop
  let nominal = 0; // nominal input position (float) for the current frame

  for (let outPos = 0; outPos < targetLength; outPos += SYNTH_HOP) {
    const center = Math.round(nominal);
    let chosen = Math.min(Math.max(center, 0), Math.max(0, input.length - WINDOW));

    if (havePrev && input.length >= WINDOW) {
      const lo = Math.max(0, center - TOLERANCE);
      const hi = Math.min(input.length - WINDOW, center + TOLERANCE);
      if (hi > lo) {
        // Stage 1: coarse search, correlation decimated by 4.
        let best = -Infinity;
        let bestPos = chosen;
        for (let cand = lo; cand <= hi; cand += 4) {
          const score = correlate(input, cand, prev, SYNTH_HOP, OVERLAP, 4);
          if (score > best) {
            best = score;
            bestPos = cand;
          }
        }
        // Stage 2: refine ±4 at full resolution.
        const rLo = Math.max(lo, bestPos - 4);
        const rHi = Math.min(hi, bestPos + 4);
        best = -Infinity;
        for (let cand = rLo; cand <= rHi; cand++) {
          const score = correlate(input, cand, prev, SYNTH_HOP, OVERLAP, 1);
          if (score > best) {
            best = score;
            chosen = cand;
          }
        }
      }
    }

    for (let i = 0; i < WINDOW; i++) {
      const sample = chosen + i < input.length ? input[chosen + i] : 0;
      out[outPos + i] += sample * window[i];
      weight[outPos + i] += window[i];
      prev[i] = chosen + i < input.length ? input[chosen + i] : 0;
    }
    havePrev = true;
    nominal += advance;
  }

  const result = new Int16Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const w = weight[i];
    // Where frames fully overlap the window sum is ~1; at the edges, trust the raw sum.
    const value = w > 0.25 ? out[i] / w : out[i];
    result[i] = Math.max(-32768, Math.min(32767, Math.round(value)));
  }
  return result;
}

// ── Joins and silence ─────────────────────────────────────────────────────────

/** Exactly `seconds` of zero samples — the produced pause (spec §8.4). */
export function silenceSamples(seconds: number): Int16Array {
  return new Int16Array(Math.round(seconds * SAMPLE_RATE));
}

export function concatPcm(...parts: Int16Array[]): Int16Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Int16Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Duration in seconds of a sample run, for the daily_audio row (§8.2 step 8). */
export function secondsOf(samples: Int16Array): number {
  return samples.length / SAMPLE_RATE;
}
