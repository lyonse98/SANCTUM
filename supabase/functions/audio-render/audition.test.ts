import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_RATE } from './audioEngine.ts';
import {
  AUDITION_MAX_TEXT_CHARS,
  AUDITION_MODELS,
  applyAuditionTempo,
  bytesToBase64,
  isAuditionRequest,
  parseAuditionRequest,
  renderAudition,
  type AuditionSpeech,
} from './audition.ts';

// Audition mode (Nov 13, 2026): a key-guarded, side-effect-free render of one
// short passage in a candidate voice recipe, so Erik can judge model tier and
// the WSOLA stretch by ear before production changes. These tests pin the
// guard, the validation, and the one controlled difference from production —
// tempo 1.0 bypasses the stretch entirely; any other tempo uses it verbatim.

const PROD_MODEL = 'gemini-3.8-flash-tts';

describe('isAuditionRequest (the render-key guard)', () => {
  it('honors the flag only with a matching key', () => {
    expect(isAuditionRequest({ audition: true }, true)).toBe(true);
    expect(isAuditionRequest({ audition: true }, false)).toBe(false);
  });

  it('is inert without the flag, key or not — the normal paths take the call', () => {
    expect(isAuditionRequest({}, true)).toBe(false);
    expect(isAuditionRequest({ step: true }, true)).toBe(false);
    expect(isAuditionRequest({ audition: false }, true)).toBe(false);
    expect(isAuditionRequest(null, true)).toBe(false);
    expect(isAuditionRequest(undefined, true)).toBe(false);
  });
});

describe('parseAuditionRequest', () => {
  const good = { audition: true, text: 'In the beginning was the Word.', voiceName: 'Charon' };

  it('accepts a minimal body: model defaults to production, tempo to 1.0', () => {
    const parsed = parseAuditionRequest(good, PROD_MODEL);
    expect(parsed).toEqual({
      ok: true,
      request: { text: good.text, voiceName: 'Charon', model: PROD_MODEL, tempo: 1.0 },
    });
  });

  it('trims the text and accepts every allow-listed model', () => {
    for (const model of AUDITION_MODELS) {
      const parsed = parseAuditionRequest({ ...good, text: '  padded  ', model }, PROD_MODEL);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.request.text).toBe('padded');
        expect(parsed.request.model).toBe(model);
      }
    }
  });

  it('rejects missing, blank, and over-long text', () => {
    expect(parseAuditionRequest({ voiceName: 'Charon' }, PROD_MODEL).ok).toBe(false);
    expect(parseAuditionRequest({ ...good, text: '   ' }, PROD_MODEL).ok).toBe(false);
    expect(
      parseAuditionRequest({ ...good, text: 'x'.repeat(AUDITION_MAX_TEXT_CHARS) }, PROD_MODEL).ok,
    ).toBe(true);
    expect(
      parseAuditionRequest({ ...good, text: 'x'.repeat(AUDITION_MAX_TEXT_CHARS + 1) }, PROD_MODEL),
    ).toEqual({ ok: false, error: `text exceeds ${AUDITION_MAX_TEXT_CHARS} characters` });
  });

  it('rejects a missing or blank voiceName', () => {
    expect(parseAuditionRequest({ text: 'hi' }, PROD_MODEL).ok).toBe(false);
    expect(parseAuditionRequest({ ...good, voiceName: ' ' }, PROD_MODEL).ok).toBe(false);
  });

  it('rejects an unknown model', () => {
    expect(parseAuditionRequest({ ...good, model: 'gemini-9-ultra-tts' }, PROD_MODEL)).toEqual({
      ok: false,
      error: 'unknown model',
    });
    expect(parseAuditionRequest({ ...good, model: 42 }, PROD_MODEL).ok).toBe(false);
  });

  it('rejects a bad tempo and accepts the range edges', () => {
    for (const tempo of [0.79, 1.11, Number.NaN, Number.POSITIVE_INFINITY, '0.9', true]) {
      expect(parseAuditionRequest({ ...good, tempo }, PROD_MODEL).ok).toBe(false);
    }
    for (const tempo of [0.8, 0.9, 1.0, 1.1]) {
      expect(parseAuditionRequest({ ...good, tempo }, PROD_MODEL).ok).toBe(true);
    }
  });
});

// A second of raw PCM16LE speech stand-in: a 150 Hz tone, encoded as the TTS
// response carries it.
function pcmBytes(seconds = 1): Uint8Array {
  const n = Math.round(seconds * SAMPLE_RATE);
  const bytes = new Uint8Array(n * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < n; i++) {
    view.setInt16(i * 2, Math.round(12000 * Math.sin((2 * Math.PI * 150 * i) / SAMPLE_RATE)), true);
  }
  return bytes;
}

describe('applyAuditionTempo (the stretch seam)', () => {
  it('tempo 1.0 is a true bypass: the very same samples come back', () => {
    const samples = new Int16Array(pcmBytes().length / 2);
    expect(applyAuditionTempo(samples, 1.0)).toBe(samples);
  });

  it('tempo 0.9 routes through the production stretch (≈ input / 0.9 long)', () => {
    const bytes = pcmBytes(2);
    const decoded = new Int16Array(bytes.length / 2);
    const out = applyAuditionTempo(decoded, 0.9);
    expect(out).not.toBe(decoded);
    const target = decoded.length / 0.9;
    expect(Math.abs(out.length - target) / target).toBeLessThan(0.01);
  });
});

describe('renderAudition (pipeline over stubbed speech/encode)', () => {
  function stubSpeech() {
    const encoded: Int16Array[] = [];
    const speech: AuditionSpeech = {
      speak: vi.fn(async () => pcmBytes(1)),
      encode: vi.fn((samples: Int16Array) => {
        encoded.push(samples);
        return new Uint8Array([0x49, 0x44, 0x33]);
      }),
    };
    return { speech, encoded };
  }

  it('speaks the lexicon-applied text with the requested model and voice', async () => {
    const { speech } = stubSpeech();
    const { mp3, seconds } = await renderAudition(
      { text: 'the sonor of man', voiceName: 'Charon', model: 'gemini-2.5-pro-preview-tts', tempo: 1.0 },
      speech,
    );
    // The lexicon's one entry (narratorCore LEXICON) respells before speech.
    expect(speech.speak).toHaveBeenCalledWith(
      'the son or of man',
      'Charon',
      'gemini-2.5-pro-preview-tts',
    );
    expect(Array.from(mp3)).toEqual([0x49, 0x44, 0x33]);
    expect(seconds).toBe(1.0);
  });

  it('at tempo 1.0 the encoder receives the decoded samples untouched', async () => {
    const { speech, encoded } = stubSpeech();
    await renderAudition(
      { text: 'plain words', voiceName: 'Kore', model: PROD_MODEL, tempo: 1.0 },
      speech,
    );
    expect(encoded).toHaveLength(1);
    expect(encoded[0].length).toBe(SAMPLE_RATE); // one second in, one second out
  });

  it('at tempo 0.9 the encoder receives the stretched samples', async () => {
    const { speech, encoded } = stubSpeech();
    const { seconds } = await renderAudition(
      { text: 'plain words', voiceName: 'Kore', model: PROD_MODEL, tempo: 0.9 },
      speech,
    );
    expect(encoded[0].length).toBeGreaterThan(SAMPLE_RATE * 1.05);
    expect(seconds).toBe(1.1);
  });
});

describe('bytesToBase64', () => {
  it('matches the platform encoding, including non-ASCII bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
  });
});
