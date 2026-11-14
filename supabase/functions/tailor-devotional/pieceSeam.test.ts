import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PIECE_PAD_LEAD_SECONDS,
  PIECE_PAD_TAIL_SECONDS,
  SAMPLE_RATE,
  finishPiecePcm,
  stretchPcm,
} from './audioEngine.ts';

/**
 * The Tailor piece seam (Nov 13, 2026, following audio round 4 in
 * audio-render): the device byte-concatenates the pieces this function's
 * piece mode returns into one stream — the identical join the daily
 * finalize performs — so a spoken piece must reach its encoder wearing
 * the same silence guards (finishPiecePcm: 120 ms lead-in, 220 ms
 * lead-out) or the encoder's padding and a cold TTS call's clipped edges
 * eat syllables at every seam. The produced-silence piece is silence
 * already and stays unpadded.
 */

const LEAD = Math.round(PIECE_PAD_LEAD_SECONDS * SAMPLE_RATE);
const TAIL = Math.round(PIECE_PAD_TAIL_SECONDS * SAMPLE_RATE);

describe('finishPiecePcm on the tailor engine copy', () => {
  it('the pads are the daily render’s own sizes: 120 ms in, 220 ms out', () => {
    expect(PIECE_PAD_LEAD_SECONDS).toBe(0.12);
    expect(PIECE_PAD_TAIL_SECONDS).toBe(0.22);
    expect(LEAD).toBe(2880);
    expect(TAIL).toBe(5280);
  });

  it('wraps the stretched speech in exact silence — nothing reaches an encoder unpadded', () => {
    // One second of full-scale "speech" at tempo 1 (stretch is a copy there).
    const decoded = new Int16Array(SAMPLE_RATE).fill(12000);
    const finished = finishPiecePcm(decoded, 1);
    expect(finished.length).toBe(decoded.length + LEAD + TAIL);
    expect(finished.subarray(0, LEAD).every((s) => s === 0)).toBe(true);
    expect(finished.subarray(LEAD, LEAD + decoded.length)).toEqual(decoded);
    expect(finished.subarray(LEAD + decoded.length).every((s) => s === 0)).toBe(true);
    expect(finished.length - decoded.length).toBe(8160);
  });

  it('at a working tempo the middle is exactly the stretch, pads unchanged', () => {
    const decoded = new Int16Array(SAMPLE_RATE).fill(9000);
    const stretched = stretchPcm(decoded, 0.9);
    const finished = finishPiecePcm(decoded, 0.9);
    expect(finished.length).toBe(stretched.length + LEAD + TAIL);
    expect(finished.subarray(LEAD, LEAD + stretched.length)).toEqual(stretched);
  });
});

describe('the piece endpoint routes every spoken piece through the seam', () => {
  const index = readFileSync(join(__dirname, 'index.ts'), 'utf8');
  const start = index.indexOf('async function handlePieceRequest');
  const body = index.slice(start, index.indexOf('Deno.serve', start));

  it('decode → finishPiecePcm → encode, in that order, with the narrator’s tempo', () => {
    expect(body).toContain('finishPiecePcm(decodeSpeechAudio(bytes), narratorProfile.tempo)');
    const seamAt = body.indexOf('finishPiecePcm(decodeSpeechAudio(bytes)');
    const encodeAt = body.indexOf('encodeMp3(pcm)', seamAt);
    expect(seamAt).toBeGreaterThanOrEqual(0);
    expect(encodeAt).toBeGreaterThan(seamAt);
    // The reported duration is the padded piece’s — the file the client seeks through.
    expect(body).toContain('seconds = secondsOf(pcm)');
  });

  it('the unpadded route is gone from the piece path', () => {
    expect(body).not.toContain('stretchPcm(decodeSpeechAudio');
    expect(body).not.toMatch(/encodeMp3\(stretchPcm/);
  });

  it('the produced-silence piece stays as it was — silence needs no guard', () => {
    expect(body).toContain('encodeMp3(silenceSamples(AUDIO_SILENCE_SECONDS))');
  });
});
