import { describe, expect, it } from 'vitest';
import {
  assembleTailoredScript,
  type TailoredScript,
} from './narratorCore.ts';
import {
  parseProofreadReply,
  proofreadTailoredScript,
  proofreadUnits,
  type ProofreadModel,
  type ProofreadUnit,
} from './proofread.ts';

// The proofread gate (Nov 19, 2026): a whole-script mechanics read after
// the tailored spoken text is assembled and before the audio plan is
// issued. These pins hold the fence (the readings, the supplement
// passage, and the tradition quote are never sent and never altered),
// the fixes (mechanics only, via a fake model), and the fail-open shape
// (any doubt → the original script, untouched).

const GOSPEL_TEXT = 'GOSPEL TEXT — Zacchaeus, come down quickly.';
const FIRST_TEXT = 'FIRST READING TEXT — if God is for us, who is against us?';
const PASSAGE_TEXT = 'SUPPLEMENT TEXT — do not fear, for I am with you.';
const QUOTE_TEXT =
  'A word from the tradition — Saint Augustine of Hippo: You made us for yourself, O Lord.';

function fixtureScript(): TailoredScript {
  return assembleTailoredScript({
    dateISO: '2026-10-29',
    celebration: 'Thursday of the 30th week in Ordinary Time',
    head: 'am',
    gospelCitation: 'Luke 19:1-10',
    readings: [
      { kind: 'first', citation: 'Romans 8:31-39', text: FIRST_TEXT },
      { kind: 'gospel', citation: 'Luke 19:1-10', text: GOSPEL_TEXT },
    ],
    reflect: 'The the reflection carries a doubled word.',
    challenge: 'A sound challenge.',
    facet: 'As a man',
    passageCitation: 'Isaiah 41:10',
    passageText: PASSAGE_TEXT,
    traditionQuote: { author: 'Saint Augustine of Hippo', text: 'You made us for yourself, O Lord.' },
  });
}

/** A fake Gemini that applies a transform to whatever it is sent, and records it. */
function fakeModel(transform: (p: string) => string, seen: string[][]): ProofreadModel {
  return async (paragraphs) => {
    seen.push([...paragraphs]);
    return JSON.stringify(paragraphs.map(transform));
  };
}

describe('parseProofreadReply', () => {
  it('accepts a clean JSON array of the expected count', () => {
    expect(parseProofreadReply('["a","b"]', 2)).toEqual(['a', 'b']);
  });

  it('rejects a count mismatch, non-strings, and empty paragraphs', () => {
    expect(parseProofreadReply('["a"]', 2)).toBeNull();
    expect(parseProofreadReply('["a", 3]', 2)).toBeNull();
    expect(parseProofreadReply('["a", " "]', 2)).toBeNull();
    expect(parseProofreadReply('no array', 1)).toBeNull();
  });
});

describe('proofreadUnits', () => {
  const units: ProofreadUnit[] = [
    { text: 'The the doubled word.', eligible: true },
    { text: 'SCRIPTURE — never sent.', eligible: false },
    { text: '[pause] A stage direction.', eligible: true },
  ];

  it('fixes mechanics in eligible paragraphs only; protected text is never sent', async () => {
    const seen: string[][] = [];
    const model = fakeModel((p) => p.replace('The the', 'The').replace('[pause] ', ''), seen);
    const { units: out, changed } = await proofreadUnits(units, model);
    expect(seen).toEqual([['The the doubled word.', '[pause] A stage direction.']]);
    expect(out[0].text).toBe('The doubled word.');
    expect(out[1].text).toBe('SCRIPTURE — never sent.');
    expect(out[2].text).toBe('A stage direction.');
    expect(changed).toBe(2);
  });

  it('falls back to the original on a count mismatch and on model failure', async () => {
    const mismatch: ProofreadModel = async () => JSON.stringify(['only one']);
    const throwing: ProofreadModel = async () => {
      throw new Error('model down');
    };
    const nullModel: ProofreadModel = async () => null;
    for (const model of [mismatch, throwing, nullModel]) {
      const { units: out, changed } = await proofreadUnits(units, model);
      expect(out).toEqual(units);
      expect(changed).toBe(0);
    }
  });
});

describe('proofreadTailoredScript — the tailored flow', () => {
  it('fixes the reflection; readings, passage, and quote stay byte-identical and unsent', async () => {
    const script = fixtureScript();
    const seen: string[][] = [];
    const model = fakeModel((p) => p.replace('The the', 'The'), seen);
    const { script: out, changed } = await proofreadTailoredScript(script, model);
    expect(changed).toBe(1);
    expect(out.mainB).toContain('The reflection carries a doubled word.');
    expect(out.readings).toBe(script.readings);
    expect(out.passage).toBe(script.passage);
    expect(out.mainB).toContain(QUOTE_TEXT);
    const sent = seen.flat();
    expect(sent.some((p) => p.includes(FIRST_TEXT))).toBe(false);
    expect(sent.some((p) => p.includes(GOSPEL_TEXT))).toBe(false);
    expect(sent.some((p) => p.includes(PASSAGE_TEXT))).toBe(false);
    expect(sent.some((p) => p.startsWith('A word from the tradition'))).toBe(false);
    // The rebuilt spoken text carries the fix and the untouched Scripture.
    expect(out.spokenText).toContain('The reflection carries a doubled word.');
    expect(out.spokenText).toContain(GOSPEL_TEXT);
    expect(out.script).toContain('The reflection carries a doubled word.');
  });

  it('the program intro and the readings hand-off are eligible for the gate', async () => {
    const script = fixtureScript();
    const seen: string[][] = [];
    const model = fakeModel((p) => p, seen);
    await proofreadTailoredScript(script, model);
    const sent = seen.flat();
    expect(sent.some((p) => p.startsWith("Today's readings —"))).toBe(true);
    expect(sent).toContain('The hour turns to the Gospel.');
  });

  it('a model that answers garbage leaves the tailored script untouched', async () => {
    const script = fixtureScript();
    const model: ProofreadModel = async () => 'no array here';
    const { script: out, changed } = await proofreadTailoredScript(script, model);
    expect(changed).toBe(0);
    expect(out).toEqual(script);
  });
});
