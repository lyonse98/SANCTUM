import { describe, expect, it } from 'vitest';
import {
  PIECE_PAD_LEAD_SECONDS,
  PIECE_PAD_TAIL_SECONDS,
  SAMPLE_RATE,
  concatPcm,
  decodeSpeechAudio,
  finishPiecePcm,
  padSpokenPiece,
  secondsOf,
  silenceSamples,
  stretchPcm,
} from './audioEngine.ts';

// §10.2 tempo gate: the WSOLA stretch must land within 1% of the requested length at
// the bank's extreme rates, with no NaN and no clipping beyond the source's own peak.
describe('stretchPcm tempo (§10.2)', () => {
  // Five seconds of a 150 Hz tone with a slow amplitude wobble — a stand-in for voice:
  // periodic, with period (160 samples) inside the aligner's search tolerance.
  function voiceLike(seconds: number): Int16Array {
    const n = Math.round(seconds * SAMPLE_RATE);
    const out = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const env = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.7 * t);
      out[i] = Math.round(12000 * env * (Math.sin(2 * Math.PI * 150 * t) + 0.4 * Math.sin(2 * Math.PI * 300 * t)));
    }
    return out;
  }

  it.each([0.88, 0.94, 1.0, 1.02, 1.08])('rate %s lands within 1% of target length', (rate) => {
    const input = voiceLike(5);
    const out = stretchPcm(input, rate);
    const target = input.length / rate;
    expect(Math.abs(out.length - target) / target).toBeLessThan(0.01);
  });

  it('produces no NaN or out-of-range samples at the extreme rates', () => {
    const input = voiceLike(5);
    for (const rate of [0.88, 1.08]) {
      const out = stretchPcm(input, rate);
      let peak = 0;
      for (const s of out) {
        expect(Number.isFinite(s)).toBe(true);
        peak = Math.max(peak, Math.abs(s));
      }
      // The source peaks at ~16,800; window normalization must not amplify past it.
      expect(peak).toBeLessThanOrEqual(17000);
    }
  });

  it('rate 1 returns an equal copy; short inputs pass through untouched', () => {
    const input = voiceLike(1);
    const out = stretchPcm(input, 1);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    const tiny = new Int16Array([1, -2, 3]);
    expect(stretchPcm(tiny, 0.88)).toEqual(tiny);
  });

  it('rejects a nonsense rate', () => {
    expect(() => stretchPcm(voiceLike(1), 0)).toThrow();
    expect(() => stretchPcm(voiceLike(1), Number.NaN)).toThrow();
  });
});

describe('decodeSpeechAudio', () => {
  function rawPcm(samples: number[]): Uint8Array {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    samples.forEach((s, i) => view.setInt16(i * 2, s, true));
    return bytes;
  }

  function wavWrap(pcm: Uint8Array, channels = 1): Uint8Array {
    const header = new DataView(new ArrayBuffer(44));
    const tag = (off: number, s: string) => {
      for (let i = 0; i < 4; i++) header.setUint8(off + i, s.charCodeAt(i));
    };
    tag(0, 'RIFF');
    header.setUint32(4, 36 + pcm.length, true);
    tag(8, 'WAVE');
    tag(12, 'fmt ');
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, channels, true);
    header.setUint32(24, SAMPLE_RATE, true);
    header.setUint32(28, SAMPLE_RATE * channels * 2, true);
    header.setUint16(32, channels * 2, true);
    header.setUint16(34, 16, true);
    tag(36, 'data');
    header.setUint32(40, pcm.length, true);
    const out = new Uint8Array(44 + pcm.length);
    out.set(new Uint8Array(header.buffer), 0);
    out.set(pcm, 44);
    return out;
  }

  it('passes raw PCM through sample-for-sample', () => {
    const samples = [0, 1000, -1000, 32767, -32768, 42];
    expect(Array.from(decodeSpeechAudio(rawPcm(samples)))).toEqual(samples);
  });

  it('unwraps a WAV response to the same samples', () => {
    const samples = [5, -5, 12345, -12345];
    expect(Array.from(decodeSpeechAudio(wavWrap(rawPcm(samples))))).toEqual(samples);
  });

  it('downmixes a stereo WAV by averaging', () => {
    const stereo = rawPcm([1000, 3000, -2000, 2000]); // frames (1000,3000), (-2000,2000)
    expect(Array.from(decodeSpeechAudio(wavWrap(stereo, 2)))).toEqual([2000, 0]);
  });
});

describe('silence and concat (§8.4)', () => {
  it('the produced silence is exactly 2.0 s of zeros', () => {
    const s = silenceSamples(2.0);
    expect(s.length).toBe(48000);
    expect(s.every((v) => v === 0)).toBe(true);
    expect(secondsOf(s)).toBe(2.0);
  });

  it('concat joins in order at exact lengths', () => {
    const joined = concatPcm(new Int16Array([1, 2]), silenceSamples(0.5), new Int16Array([3]));
    expect(joined.length).toBe(2 + 12000 + 1);
    expect(joined[0]).toBe(1);
    expect(joined[joined.length - 1]).toBe(3);
  });
});

describe('piece seam guards (fourth round — pads before the encode)', () => {
  const LEAD = Math.round(PIECE_PAD_LEAD_SECONDS * SAMPLE_RATE);
  const TAIL = Math.round(PIECE_PAD_TAIL_SECONDS * SAMPLE_RATE);

  it('the pads price out to exact sample counts at 24 kHz', () => {
    expect(PIECE_PAD_LEAD_SECONDS).toBe(0.12);
    expect(PIECE_PAD_TAIL_SECONDS).toBe(0.22);
    expect(LEAD).toBe(2880);
    expect(TAIL).toBe(5280);
    // A padded seam (one piece's tail + the next piece's lead) is 340 ms —
    // a micro-pause, strictly under the 0.6 s restored beat.
    expect(LEAD + TAIL).toBe(8160);
  });

  it('padSpokenPiece wraps the speech in exact silence, speech untouched', () => {
    const speech = new Int16Array([100, -200, 300, -400]);
    const padded = padSpokenPiece(speech);
    expect(padded.length).toBe(LEAD + speech.length + TAIL);
    expect(padded.subarray(0, LEAD).every((v) => v === 0)).toBe(true);
    expect(Array.from(padded.subarray(LEAD, LEAD + speech.length))).toEqual([100, -200, 300, -400]);
    expect(padded.subarray(LEAD + speech.length).every((v) => v === 0)).toBe(true);
  });

  it('finishPiecePcm is stretch-then-pad: the encoder never sees unpadded samples', () => {
    // Tempo 1.0 with a short input passes the stretch through, isolating the pad.
    const speech = new Int16Array(500).fill(700);
    const finished = finishPiecePcm(speech, 1.0);
    expect(finished.length).toBe(500 + LEAD + TAIL);
    expect(finished.subarray(0, LEAD).every((v) => v === 0)).toBe(true);
    expect(finished.subarray(LEAD, LEAD + 500).every((v) => v === 700)).toBe(true);
    expect(finished.subarray(LEAD + 500).every((v) => v === 0)).toBe(true);
  });

  it('finishPiecePcm pads at production tempos too, and durations price the pads in', () => {
    const speech = new Int16Array(SAMPLE_RATE * 2).fill(500); // 2 s of stand-in voice
    const finished = finishPiecePcm(speech, 0.9);
    const stretched = Math.round(speech.length / 0.9);
    expect(Math.abs(finished.length - (stretched + LEAD + TAIL))).toBeLessThanOrEqual(1);
    expect(finished.subarray(0, LEAD).every((v) => v === 0)).toBe(true);
    expect(finished.subarray(finished.length - TAIL).every((v) => v === 0)).toBe(true);
    // Head durations are recorded from exactly these samples: speech + 0.34 s.
    expect(secondsOf(finished)).toBeCloseTo(2 / 0.9 + 0.34, 2);
  });
});
