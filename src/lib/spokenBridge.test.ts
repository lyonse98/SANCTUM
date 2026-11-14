import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SPOKEN_BRIDGE_MAX_CHARS,
  SPOKEN_CARRY_MAX_CHARS,
  assembleScript,
  validateSpokenBridge,
  validateSpokenCarry,
  type AssembleInputs,
} from './narratorCore';
import {
  buildResponseBody,
  buildSpokenBridgePrompt,
  composeTailored,
  type TailorBundle,
} from '../../supabase/functions/tailor-devotional/tailorCore';
import { buildPieceTexts } from '../../supabase/functions/tailor-devotional/audioPlan';

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * The spoken bridge (Erik, Nov 14, 2026) — the conversational tie-in the
 * narrator speaks between the Gospel and the reflection, and the carry line
 * he speaks after the challenge. Generated material AROUND the verbatim
 * zones, never inside them. These pins hold the four promises of the build:
 * the order (Gospel → bridge → reflection → challenge → carry), the
 * verbatim invariance of the reflection and challenge, the byte-identical
 * fallback when a day carries no bridge (every pre-bridge row), and the
 * fence + length gates at generation.
 */

const BRIDGE =
  'BRIDGE OPENS HERE. You heard what he did at that table, in front of everyone watching. ' +
  'Where do you most want to look away from the person standing in front of you? ' +
  'What would it cost you to stay? Hold those questions while the reflection speaks, ' +
  'and let them aim you at the one person the challenge names.';
const CARRY = 'CARRY OPENS HERE. One name, one act of help, before anything else claims the day.';

const BASE: AssembleInputs = {
  dateISO: '2026-10-30', // a Friday — Tom reads
  celebration: 'Friday of the 30th week of Ordinary Time',
  gospelCitation: 'Luke 14:1-6',
  gospelText:
    'GOSPEL OPENS HERE. When he went into the house of one of the rulers of the Pharisees ' +
    'on a Sabbath to eat bread, they were watching him. Behold, a certain man who had ' +
    'dropsy was in front of him. Jesus, answering, spoke to the lawyers and Pharisees, ' +
    'saying, "Is it lawful to heal on the Sabbath?" But they were silent. He took him, ' +
    'and healed him, and let him go.',
  reflect:
    'REFLECT OPENS HERE. Where are you hiding behind the rules or playing it safe instead ' +
    "of stepping into someone else's mess to help them?",
  challenge:
    'CHALLENGE OPENS HERE. Step toward the person you usually avoid at work or at home ' +
    'today, look them in the eye, and offer them real help with whatever burden they ' +
    'are carrying.',
  facet: 'As a man',
  scene: null,
  tomorrowCelebration: 'Saturday of the 30th week of Ordinary Time',
  tomorrowGospelCitation: 'Luke 14:1, 7-11',
};

describe('the daily assembly — order and placement', () => {
  it('orders Gospel < bridge < reflection < challenge < carry in the full script', () => {
    const s = assembleScript({ ...BASE, spokenBridge: BRIDGE, spokenCarry: CARRY });
    expect(s.bridgeIncluded).toBe(true);
    expect(s.carryIncluded).toBe(true);
    const at = (t: string) => s.script.indexOf(t);
    expect(at(BASE.gospelText)).toBeGreaterThanOrEqual(0);
    expect(at(BASE.gospelText)).toBeLessThan(at(BRIDGE));
    expect(at(BRIDGE)).toBeLessThan(at(BASE.reflect));
    expect(at(BASE.reflect)).toBeLessThan(at(BASE.challenge));
    expect(at(BASE.challenge)).toBeLessThan(at(CARRY));
  });

  it('the bridge opens the second movement and the carry answers the challenge directly', () => {
    const s = assembleScript({ ...BASE, spokenBridge: BRIDGE, spokenCarry: CARRY });
    expect(s.mainB.startsWith(BRIDGE)).toBe(true);
    // The challenge → carry joint carries no pause-map beat: a plain break.
    expect(s.mainB).toContain(`${BASE.challenge}\n\n${CARRY}`);
  });

  it('the same order holds on the women’s track', () => {
    const s = assembleScript({
      ...BASE,
      audience: 'women',
      facet: 'As a woman',
      spokenBridge: BRIDGE,
      spokenCarry: CARRY,
    });
    const at = (t: string) => s.script.indexOf(t);
    expect(at(BRIDGE)).toBeLessThan(at(BASE.reflect));
    expect(at(BASE.challenge)).toBeLessThan(at(CARRY));
    expect(s.mainB.startsWith(BRIDGE)).toBe(true);
  });

  it('the same order holds when the Lector reads (a solemnity)', () => {
    const s = assembleScript({
      ...BASE,
      dateISO: '2026-12-25',
      celebration: 'Christmas Day',
      spokenBridge: BRIDGE,
      spokenCarry: CARRY,
    });
    expect(s.lector).toBe(true);
    const at = (t: string) => s.mainB.indexOf(t);
    expect(at(BRIDGE)).toBe(0);
    expect(at(BRIDGE)).toBeLessThan(at(BASE.reflect));
    expect(at(BASE.reflect)).toBeLessThan(at(BASE.challenge));
    expect(at(BASE.challenge)).toBeLessThan(at(CARRY));
  });
});

describe('the daily assembly — verbatim invariance and the fallback', () => {
  it('the reflection and challenge ride byte-identical, with and without a bridge', () => {
    const withBridge = assembleScript({ ...BASE, spokenBridge: BRIDGE, spokenCarry: CARRY });
    const without = assembleScript({ ...BASE });
    expect(withBridge.mainB).toContain(BASE.reflect);
    expect(withBridge.mainB).toContain(BASE.challenge);
    expect(without.mainB).toContain(BASE.reflect);
    expect(without.mainB).toContain(BASE.challenge);
    // Removing exactly the two added paragraphs restores the pre-bridge
    // second movement — nothing else moved, no beat changed.
    const stripped = withBridge.mainB
      .replace(`${BRIDGE}\n\n`, '')
      .replace(`\n\n${CARRY}`, '');
    expect(stripped).toBe(without.mainB);
    // The first movement and both heads are untouched by the bridge.
    expect(withBridge.mainA).toBe(without.mainA);
    expect(withBridge.headAM).toBe(without.headAM);
    expect(withBridge.headPM).toBe(without.headPM);
  });

  it('NULL, absent, and blank bridges assemble byte-identically to the pre-bridge script', () => {
    const omitted = assembleScript({ ...BASE });
    const nulled = assembleScript({ ...BASE, spokenBridge: null, spokenCarry: null });
    const blank = assembleScript({ ...BASE, spokenBridge: '   ', spokenCarry: '' });
    expect(nulled.script).toBe(omitted.script);
    expect(blank.script).toBe(omitted.script);
    expect(omitted.bridgeIncluded).toBe(false);
    expect(omitted.carryIncluded).toBe(false);
    expect(omitted.mainB).not.toContain('BRIDGE OPENS HERE');
    expect(omitted.mainB).not.toContain('CARRY OPENS HERE');
  });
});

describe('the length gates — an over-long bridge is an absent bridge', () => {
  it('validateSpokenBridge trims, and rejects empty, non-string, and over-length words', () => {
    expect(validateSpokenBridge('  a bridge worth speaking  ')).toBe('a bridge worth speaking');
    expect(validateSpokenBridge('x'.repeat(SPOKEN_BRIDGE_MAX_CHARS))).toHaveLength(1200);
    expect(validateSpokenBridge('x'.repeat(SPOKEN_BRIDGE_MAX_CHARS + 1))).toBeNull();
    expect(validateSpokenBridge('')).toBeNull();
    expect(validateSpokenBridge('   ')).toBeNull();
    expect(validateSpokenBridge(null)).toBeNull();
    expect(validateSpokenBridge(undefined)).toBeNull();
    expect(validateSpokenBridge(42)).toBeNull();
  });

  it('validateSpokenCarry applies the stricter ceiling', () => {
    expect(validateSpokenCarry('  one thing to carry  ')).toBe('one thing to carry');
    expect(validateSpokenCarry('x'.repeat(SPOKEN_CARRY_MAX_CHARS))).toHaveLength(300);
    expect(validateSpokenCarry('x'.repeat(SPOKEN_CARRY_MAX_CHARS + 1))).toBeNull();
    expect(validateSpokenCarry('')).toBeNull();
    expect(validateSpokenCarry(null)).toBeNull();
  });
});

describe('the daily-reflection fence — the prompt carries the no-opinions rule', () => {
  const source = readRoot('supabase/functions/daily-reflection/index.ts');

  it('both track prompts carry the bridge section and its fence', () => {
    // One bridge section per track prompt — men's and women's alike.
    expect(source.split('THE SPOKEN BRIDGE AND CARRY').length - 1).toBe(2);
    for (const phrase of [
      '110-170 words',
      '15-30 words',
      "no opinions — not yours, not anyone's",
      'No theological claims beyond what the Gospel, the reflection, and the challenge themselves say',
      'No new facts',
      'No quotations except words taken verbatim from the Gospel, the reflection, or the challenge',
      "No moralizing beyond the challenge's own words",
      'a fellow listener tying the pieces together — never a priest, never a teacher, never a preacher',
      '"bridge":"<the spoken bridge, or empty string>"',
      '"carry":"<the spoken carry, or empty string>"',
    ]) {
      expect(source).toContain(phrase);
    }
  });

  it('the function validates through the ported gates before storing', () => {
    expect(source).toContain('SPOKEN_BRIDGE_MAX_CHARS = 1200');
    expect(source).toContain('SPOKEN_CARRY_MAX_CHARS = 300');
    expect(source).toContain('validateSpokenBridge(parsed.bridge)');
    expect(source).toContain('validateSpokenCarry(parsed.carry)');
    expect(source).toContain('spoken_bridge: bridge');
    expect(source).toContain('spoken_carry: carry');
  });
});

// ── Tailor ───────────────────────────────────────────────────────────────────

const TAILOR_BRIDGE =
  'TAILOR BRIDGE OPENS HERE. You have just heard him speak to the crowds, and then ' +
  'the passage chosen for this morning. Where does his word find you still holding ' +
  'back? What is the one conversation you keep postponing? Let the reflection aim ' +
  'that question, and afterward sit with "Three Little Birds" by Bob Marley — a ' +
  'song to stay with a while.';

const BUNDLE: TailorBundle = {
  celebration: null,
  gospelCitation: 'John 6:37-40',
  gospelText: 'GOSPEL TEXT VERBATIM — All that the Father giveth to me shall come to me.',
  readings: [
    { kind: 'first', citation: '1 Kings 19:11-13', text: 'FIRST READING VERBATIM TEXT.' },
    { kind: 'psalm', citation: 'Psalm 27', text: 'PSALM VERBATIM TEXT.' },
    {
      kind: 'gospel',
      citation: 'John 6:37-40',
      text: 'GOSPEL TEXT VERBATIM — All that the Father giveth to me shall come to me.',
    },
  ],
  reflect: 'The canonical reflection, for everyone.',
  challenge: 'The canonical challenge.',
  facet: 'As a man',
};

const INTAKE = {
  state: 'anxious' as const,
  focus: 'work' as const,
  tone: 'courage' as const,
  freeText: 'Big review at 2.',
};

const generateTailored = async () => ({
  reflect: 'TAILORED REFLECTION — aimed at the review at two.',
  challenge: 'TAILORED CHALLENGE — one concrete act.',
});

describe('the tailor bridge — composition', () => {
  it('a generated bridge rides the response and opens the second movement', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      generateBridge: async () => TAILOR_BRIDGE,
      hour: 7,
    });
    expect(composed.bridge).toBe(TAILOR_BRIDGE);
    const body = buildResponseBody('2026-11-12', composed, null, 0, null);
    expect(body.bridge).toBe(TAILOR_BRIDGE);
    // Passage → bridge → reflection, in the spoken text.
    const st = composed.script.spokenText;
    expect(st.indexOf(composed.script.passage)).toBeLessThan(st.indexOf(TAILOR_BRIDGE));
    expect(st.indexOf(TAILOR_BRIDGE)).toBeLessThan(st.indexOf('TAILORED REFLECTION'));
    expect(composed.script.mainB.startsWith(TAILOR_BRIDGE)).toBe(true);
  });

  it('the audio plan speaks the bridge after the silence, before the reflection', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      generateBridge: async () => TAILOR_BRIDGE,
      hour: 7,
    });
    const pieces = buildPieceTexts(composed.script);
    const texts = pieces.map((p) => p.text);
    const passageAt = texts.findIndex((t) => t.includes("for what you're carrying today"));
    const silenceAt = pieces.findIndex((p) => p.kind === 'silence');
    const bridgeAt = texts.findIndex((t) => t.includes('TAILOR BRIDGE OPENS HERE'));
    const reflectAt = texts.findIndex((t) => t.includes('TAILORED REFLECTION'));
    expect(passageAt).toBeGreaterThanOrEqual(0);
    expect(passageAt).toBeLessThan(silenceAt);
    expect(silenceAt).toBeLessThan(bridgeAt);
    expect(bridgeAt).toBeLessThan(reflectAt);
  });

  it('absent, failed, and over-long bridges all leave the program exactly as before', async () => {
    const base = {
      dateISO: '2026-11-12',
      audience: 'men' as const,
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      hour: 7,
    };
    const noDep = await composeTailored({ ...base });
    const nullDep = await composeTailored({ ...base, generateBridge: async () => null });
    const failedDep = await composeTailored({
      ...base,
      generateBridge: async () => {
        throw new Error('model down');
      },
    });
    const overLong = await composeTailored({
      ...base,
      generateBridge: async () => 'x'.repeat(SPOKEN_BRIDGE_MAX_CHARS + 1),
    });
    for (const composed of [noDep, nullDep, failedDep, overLong]) {
      expect(composed.bridge).toBeNull();
      expect(composed.script.spokenText).toBe(noDep.script.spokenText);
      expect(buildResponseBody('2026-11-12', composed, null, 0, null).bridge).toBeNull();
    }
  });
});

describe('the tailor bridge fence — the prompt carries the same rule', () => {
  it('buildSpokenBridgePrompt fences the words and names the media by title and creator', () => {
    const prompt = buildSpokenBridgePrompt({
      audience: 'men',
      gospelCitation: 'John 6:37-40',
      gospelText: BUNDLE.gospelText,
      passageCitation: 'Psalm 27:1',
      passageText: 'The Lord is my light and my salvation.',
      reflect: 'TAILORED REFLECTION',
      challenge: 'TAILORED CHALLENGE',
      media: { kind: 'song', title: 'Three Little Birds', creator: 'Bob Marley' },
    });
    for (const phrase of [
      '110-170 words',
      "no opinions — not yours, not anyone's",
      'No theological claims beyond what the Gospel, the passage, the reflection, and the challenge themselves say',
      'No new facts',
      'No quotations except words taken verbatim from the Gospel, the passage, the reflection, or the challenge',
      "No moralizing beyond the challenge's own words",
      'a fellow listener tying the pieces together — never a priest, never a teacher, never a preacher',
      '"Three Little Birds" by Bob Marley',
      'No review of it, no opinion of it',
    ]) {
      expect(prompt).toContain(phrase);
    }
    // The package's own texts are the bridge's only materials.
    expect(prompt).toContain(BUNDLE.gospelText);
    expect(prompt).toContain('TAILORED REFLECTION');
    expect(prompt).toContain('TAILORED CHALLENGE');
  });
});
