import { describe, expect, it } from 'vitest';
import { assembleScript, type AssembledScript } from './narratorCore.ts';
import {
  parseProofreadReply,
  proofreadAssembledScript,
  proofreadUnits,
  type ProofreadModel,
  type ProofreadUnit,
} from './proofread.ts';

// The proofread gate (Nov 19, 2026): a whole-script mechanics read before
// anything is voiced. These pins hold the fence (Scripture is never sent
// and never altered), the fixes (mechanics only, via a fake model), and
// the fail-open shape (any doubt → the original script, untouched).

const GOSPEL_TEXT =
  'When he went into the house of one of the rulers, they were watching him. ' +
  'Behold, a certain man who had dropsy was in front of him.';

function fixtureAssembled(): AssembledScript {
  return assembleScript({
    dateISO: '2026-10-30',
    celebration: 'Friday of the 30th week of Ordinary Time',
    gospelCitation: 'Luke 14:1-6',
    gospelText: GOSPEL_TEXT,
    reflect: 'The the reflection carries a doubled word.',
    challenge: 'A sound challenge.',
    facet: 'As a man',
    scene: null,
    tomorrowCelebration: null,
    tomorrowGospelCitation: null,
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

  it('tolerates prose outside the brackets and rejects everything else', () => {
    expect(parseProofreadReply('Here you are:\n["a"]', 1)).toEqual(['a']);
    expect(parseProofreadReply('["a"]', 2)).toBeNull(); // count mismatch
    expect(parseProofreadReply('not json', 1)).toBeNull();
    expect(parseProofreadReply('["a", 3]', 2)).toBeNull(); // non-string
    expect(parseProofreadReply('["a", " "]', 2)).toBeNull(); // empty paragraph
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
    const model = fakeModel(
      (p) => p.replace('The the', 'The').replace('[pause] ', ''),
      seen,
    );
    const { units: out, changed } = await proofreadUnits(units, model);
    expect(seen).toEqual([['The the doubled word.', '[pause] A stage direction.']]);
    expect(out[0].text).toBe('The doubled word.');
    expect(out[1].text).toBe('SCRIPTURE — never sent.');
    expect(out[2].text).toBe('A stage direction.');
    expect(changed).toBe(2);
  });

  it('falls back to the original on a count mismatch', async () => {
    const model: ProofreadModel = async () => JSON.stringify(['only one']);
    const { units: out, changed } = await proofreadUnits(units, model);
    expect(out).toEqual(units);
    expect(changed).toBe(0);
  });

  it('falls back to the original when the model fails or returns nothing', async () => {
    const throwing: ProofreadModel = async () => {
      throw new Error('model down');
    };
    const nullModel: ProofreadModel = async () => null;
    for (const model of [throwing, nullModel]) {
      const { units: out, changed } = await proofreadUnits(units, model);
      expect(out).toEqual(units);
      expect(changed).toBe(0);
    }
  });

  it('makes no call when nothing is eligible', async () => {
    let calls = 0;
    const model: ProofreadModel = async () => {
      calls += 1;
      return null;
    };
    const { changed } = await proofreadUnits([{ text: 'x', eligible: false }], model);
    expect(calls).toBe(0);
    expect(changed).toBe(0);
  });
});

describe('proofreadAssembledScript — the daily flow', () => {
  it('fixes the reflection and leaves the Gospel byte-identical, unsent', async () => {
    const assembled = fixtureAssembled();
    const seen: string[][] = [];
    // The fake model "fixes" the doubled word and tries to vandalize
    // everything it is given — the Gospel must not be among the given.
    const model = fakeModel((p) => p.replace('The the', 'The'), seen);
    const { assembled: out, changed } = await proofreadAssembledScript(assembled, GOSPEL_TEXT, model);
    expect(changed).toBe(1);
    expect(out.mainB).toContain('The reflection carries a doubled word.');
    expect(out.mainA).toContain(GOSPEL_TEXT);
    const sent = seen.flat();
    expect(sent).not.toContain(GOSPEL_TEXT);
    expect(sent.some((p) => p.includes('dropsy'))).toBe(false);
    expect(sent.some((p) => p.startsWith('A reading from the holy Gospel'))).toBe(false);
    expect(out.script).toContain(GOSPEL_TEXT);
    expect(out.script).toContain('The reflection carries a doubled word.');
  });

  it('a model that answers garbage leaves the assembled script untouched', async () => {
    const assembled = fixtureAssembled();
    const model: ProofreadModel = async () => 'no array here';
    const { assembled: out, changed } = await proofreadAssembledScript(assembled, GOSPEL_TEXT, model);
    expect(changed).toBe(0);
    expect(out).toEqual(assembled);
  });

  it('the spoken intro is eligible for the gate; the Gospel stays protected', async () => {
    const INTRO = 'The the intro carries a doubled word.';
    const assembled = assembleScript({
      dateISO: '2026-10-30',
      celebration: 'Friday of the 30th week of Ordinary Time',
      gospelCitation: 'Luke 14:1-6',
      gospelText: GOSPEL_TEXT,
      reflect: 'A sound reflection.',
      challenge: 'A sound challenge.',
      facet: 'As a man',
      scene: null,
      spokenIntro: INTRO,
      tomorrowCelebration: null,
      tomorrowGospelCitation: null,
    });
    expect(assembled.introIncluded).toBe(true);
    const seen: string[][] = [];
    const model = fakeModel((p) => p.replace('The the', 'The'), seen);
    const { assembled: out, changed } = await proofreadAssembledScript(assembled, GOSPEL_TEXT, model);
    // The intro was sent (eligible) and its mechanics were fixed in place.
    expect(seen.flat()).toContain(INTRO);
    expect(changed).toBe(1);
    expect(out.mainA).toContain('The intro carries a doubled word.');
    expect(out.mainA).toContain(GOSPEL_TEXT);
    expect(seen.flat()).not.toContain(GOSPEL_TEXT);
  });
});
