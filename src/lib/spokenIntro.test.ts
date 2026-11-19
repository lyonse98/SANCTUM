import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SPOKEN_INTRO_MAX_WORDS,
  SPOKEN_INTRO_MIN_WORDS,
  assembleScript,
  validateSpokenIntro,
  type AssembleInputs,
} from './narratorCore';
import {
  buildResponseBody,
  buildSpokenIntroPrompt,
  composeTailored,
  type TailorBundle,
} from '../../supabase/functions/tailor-devotional/tailorCore';

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * The spoken intro (Erik, Nov 19, 2026) — the short context the narrator
 * speaks before the day's Gospel: yesterday's Gospel in one clause, then
 * today's preview and one listening cue. Generated material AROUND the
 * verbatim zones, never inside them. These pins hold the promises of the
 * build: the order (head → intro → Gospel), the byte-identical fallback
 * when a day carries no intro (every pre-intro row, every failed fetch of
 * yesterday), the fence + word gate at generation, and — on the tailor
 * side — that the intro is spoken only and never enters the text package.
 */

const INTRO =
  'INTRO OPENS HERE. Yesterday we heard Jesus on the road, teaching the crowds what ' +
  'it costs to follow him and who is invited to the table. Today the scene is a ' +
  "Pharisee's house on the Sabbath, a man with dropsy standing before him, and the " +
  'lawyers and Pharisees watching in silence. Listen for the question Jesus puts ' +
  'to them, and for whether anyone dares to answer it.';
const BRIDGE =
  'BRIDGE OPENS HERE. You heard what he did at that table, in front of everyone watching. ' +
  'Where do you most want to look away from the person standing in front of you?';
const CARRY = 'CARRY OPENS HERE. One name, one act of help, before anything else claims the day.';

const BASE: AssembleInputs = {
  dateISO: '2026-10-30', // a Friday — Tom reads
  celebration: 'Friday of the 30th week of Ordinary Time',
  gospelCitation: 'Luke 14:1-6',
  gospelText:
    'GOSPEL OPENS HERE. When he went into the house of one of the rulers of the Pharisees ' +
    'on a Sabbath to eat bread, they were watching him. Behold, a certain man who had ' +
    'dropsy was in front of him.',
  reflect: 'REFLECT OPENS HERE. Where are you hiding behind the rules?',
  challenge: 'CHALLENGE OPENS HERE. Step toward the person you usually avoid today.',
  facet: 'As a man',
  scene: null,
  tomorrowCelebration: 'Saturday of the 30th week of Ordinary Time',
  tomorrowGospelCitation: 'Luke 14:1, 7-11',
};

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

describe('the word gate — an off-length intro is an absent intro', () => {
  it('validateSpokenIntro trims, and admits only the 30–80 word band', () => {
    expect(validateSpokenIntro(`  ${words(45)}  `)).toBe(words(45));
    expect(validateSpokenIntro(words(SPOKEN_INTRO_MIN_WORDS))).toBe(words(SPOKEN_INTRO_MIN_WORDS));
    expect(validateSpokenIntro(words(SPOKEN_INTRO_MAX_WORDS))).toBe(words(SPOKEN_INTRO_MAX_WORDS));
    expect(validateSpokenIntro(words(SPOKEN_INTRO_MIN_WORDS - 1))).toBeNull();
    expect(validateSpokenIntro(words(SPOKEN_INTRO_MAX_WORDS + 1))).toBeNull();
    expect(validateSpokenIntro('')).toBeNull();
    expect(validateSpokenIntro('   ')).toBeNull();
    expect(validateSpokenIntro(null)).toBeNull();
    expect(validateSpokenIntro(undefined)).toBeNull();
    expect(validateSpokenIntro(42)).toBeNull();
  });
});

describe('the daily assembly — order and placement', () => {
  it('orders head → intro → Gospel intro → Gospel → bridge in the full script', () => {
    const s = assembleScript({ ...BASE, spokenIntro: INTRO, spokenBridge: BRIDGE, spokenCarry: CARRY });
    expect(s.introIncluded).toBe(true);
    const at = (t: string) => s.script.indexOf(t);
    expect(at(INTRO)).toBeGreaterThanOrEqual(0);
    expect(at(INTRO)).toBeLessThan(at('A reading from the holy Gospel according to Luke.'));
    expect(at('A reading from the holy Gospel according to Luke.')).toBeLessThan(at(BASE.gospelText));
    expect(at(BASE.gospelText)).toBeLessThan(at(BRIDGE));
    // The intro opens the first movement itself.
    expect(s.mainA.startsWith(INTRO)).toBe(true);
  });

  it('the intro stands ahead of the scene, and the scene still points at the reading', () => {
    const scene = 'SCENE OPENS HERE. A Sabbath meal, a house full of watchers.';
    const s = assembleScript({ ...BASE, scene, spokenIntro: INTRO });
    const at = (t: string) => s.mainA.indexOf(t);
    expect(at(INTRO)).toBe(0);
    expect(at(INTRO)).toBeLessThan(at(scene));
    expect(at(scene)).toBeLessThan(at('A reading from the holy Gospel according to Luke.'));
  });

  it('the same order holds on the women’s track and when the Lector reads', () => {
    const women = assembleScript({ ...BASE, audience: 'women', facet: 'As a woman', spokenIntro: INTRO });
    expect(women.introIncluded).toBe(true);
    expect(women.mainA.startsWith(INTRO)).toBe(true);

    const lector = assembleScript({
      ...BASE,
      dateISO: '2026-12-25',
      celebration: 'Christmas Day',
      spokenIntro: INTRO,
    });
    expect(lector.lector).toBe(true);
    expect(lector.introIncluded).toBe(true);
    expect(lector.mainA.startsWith(INTRO)).toBe(true);
    expect(lector.mainA.indexOf(INTRO)).toBeLessThan(
      lector.mainA.indexOf('A reading from the holy Gospel according to Luke.'),
    );
  });
});

describe('the daily assembly — the byte-identical fallback', () => {
  it('NULL, absent, and blank intros assemble byte-identically to the pre-intro script', () => {
    const omitted = assembleScript({ ...BASE });
    const nulled = assembleScript({ ...BASE, spokenIntro: null });
    const blank = assembleScript({ ...BASE, spokenIntro: '   ' });
    expect(nulled.script).toBe(omitted.script);
    expect(blank.script).toBe(omitted.script);
    expect(omitted.introIncluded).toBe(false);
    expect(omitted.mainA).not.toContain('INTRO OPENS HERE');
  });

  it('removing exactly the intro paragraph restores the pre-intro first movement', () => {
    const withIntro = assembleScript({ ...BASE, spokenIntro: INTRO, spokenBridge: BRIDGE });
    const without = assembleScript({ ...BASE, spokenBridge: BRIDGE });
    expect(withIntro.mainA.replace(`${INTRO}\n\n`, '')).toBe(without.mainA);
    // The heads and the second movement are untouched by the intro.
    expect(withIntro.headAM).toBe(without.headAM);
    expect(withIntro.headPM).toBe(without.headPM);
    expect(withIntro.mainB).toBe(without.mainB);

    const lectorWith = assembleScript({
      ...BASE,
      dateISO: '2026-12-25',
      celebration: 'Christmas Day',
      spokenIntro: INTRO,
    });
    const lectorWithout = assembleScript({ ...BASE, dateISO: '2026-12-25', celebration: 'Christmas Day' });
    expect(lectorWith.mainA.replace(`${INTRO}\n\n`, '')).toBe(lectorWithout.mainA);
  });
});

describe('the daily-reflection fence — the prompt carries the description-only rule', () => {
  const source = readRoot('supabase/functions/daily-reflection/index.ts');

  it('both track prompts carry the intro section and its fence', () => {
    expect(source.split('THE SPOKEN INTRO').length - 1).toBe(2);
    expect(source.split('"intro":"<the spoken intro, or empty string>"').length - 1).toBe(2);
    for (const phrase of [
      '40-70 words',
      'Yesterday in one clause',
      'description only. Name scenes, people, and the question the text itself raises',
      "No lessons, no application, no opinions — not yours, not anyone's",
      "No new facts: if it is not in yesterday's Gospel text or today's, it does not belong",
      'No quotations except words taken verbatim from the two Gospels',
      'a fellow listener setting the table — never a priest, never a teacher, never a preacher',
      'If yesterday\'s Gospel text is not provided below, or no Gospel text is provided below, return the intro as an empty string',
    ]) {
      expect(source).toContain(phrase);
    }
  });

  it('the function fetches yesterday, gates through the ported validator, and stores the column', () => {
    expect(source).toContain('fetchYesterdayGospel');
    expect(source).toContain("Yesterday's Gospel text:");
    expect(source).toContain('SPOKEN_INTRO_MIN_WORDS = 30');
    expect(source).toContain('SPOKEN_INTRO_MAX_WORDS = 80');
    expect(source).toContain('validateSpokenIntro(parsed.intro)');
    expect(source).toContain('introGrounded');
    expect(source).toContain('spoken_intro: intro');
  });
});

describe('the audio renderer — the intro rides from the row into the assembly', () => {
  const source = readRoot('supabase/functions/audio-render/index.ts');

  it('selects the column with a pre-intro fallback and passes it to assembleScript', () => {
    expect(source).toContain('spoken_bridge,spoken_carry,spoken_intro');
    expect(source).toContain('spokenIntro: typeof row.spoken_intro');
    expect(source).toContain('spokenIntro: bundle.reflection.spokenIntro');
    expect(source).toContain('introIncluded: assembled.introIncluded');
  });
});

// ── Tailor ───────────────────────────────────────────────────────────────────

const TAILOR_INTRO =
  'TAILOR INTRO OPENS HERE. Yesterday we heard Jesus pass through Jericho and call ' +
  "Zacchaeus down from the tree, mercy arriving at a tax collector's table while " +
  'the crowd grumbled. Today a man is brought low by fear, and the Gospel asks ' +
  'what he will do with the gifts placed in his hands. Listen for what the master ' +
  'says to the servant who buried his gift.';

const YESTERDAY = {
  citation: 'Luke 19:1-10',
  text: 'YESTERDAY GOSPEL TEXT — Jesus entered Jericho and was passing through.',
};

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

describe('the tailor intro — composition', () => {
  it('a generated intro opens the readings movement, ahead of the program line', async () => {
    let seenPrompt = '';
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      yesterdayGospel: YESTERDAY,
      generateIntro: async (prompt) => {
        seenPrompt = prompt;
        return TAILOR_INTRO;
      },
      hour: 7,
    });
    expect(composed.intro).toBe(TAILOR_INTRO);
    expect(composed.script.introIncluded).toBe(true);
    const at = (t: string) => composed.script.spokenText.indexOf(t);
    expect(at(TAILOR_INTRO)).toBeGreaterThan(composed.script.head.length);
    expect(at(TAILOR_INTRO)).toBeLessThan(at("Today's readings —"));
    expect(at("Today's readings —")).toBeLessThan(at('FIRST READING VERBATIM TEXT.'));
    // The prompt was built over the fetched yesterday and today's Gospel.
    expect(seenPrompt).toContain(YESTERDAY.citation);
    expect(seenPrompt).toContain(YESTERDAY.text);
    expect(seenPrompt).toContain(BUNDLE.gospelText);
  });

  it('the intro is spoken only — it never enters the text package', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      yesterdayGospel: YESTERDAY,
      generateIntro: async () => TAILOR_INTRO,
      hour: 7,
    });
    const body = buildResponseBody('2026-11-12', composed, null, 0, null);
    expect('intro' in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain(TAILOR_INTRO);
  });

  it('no yesterday, no dep, a failed call, and off-length words all leave the program exactly as before', async () => {
    const base = {
      dateISO: '2026-11-12',
      audience: 'men' as const,
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      hour: 7,
    };
    const plain = await composeTailored({ ...base });

    let calls = 0;
    const counting = async () => {
      calls += 1;
      return TAILOR_INTRO;
    };
    const noYesterday = await composeTailored({ ...base, generateIntro: counting });
    expect(calls).toBe(0); // yesterday unfetched → the generation is never attempted

    const noDep = await composeTailored({ ...base, yesterdayGospel: YESTERDAY });
    const failed = await composeTailored({
      ...base,
      yesterdayGospel: YESTERDAY,
      generateIntro: async () => {
        throw new Error('model down');
      },
    });
    const nullReply = await composeTailored({
      ...base,
      yesterdayGospel: YESTERDAY,
      generateIntro: async () => null,
    });
    const tooShort = await composeTailored({
      ...base,
      yesterdayGospel: YESTERDAY,
      generateIntro: async () => words(10),
    });
    const tooLong = await composeTailored({
      ...base,
      yesterdayGospel: YESTERDAY,
      generateIntro: async () => words(SPOKEN_INTRO_MAX_WORDS + 1),
    });
    for (const composed of [noYesterday, noDep, failed, nullReply, tooShort, tooLong]) {
      expect(composed.intro).toBeNull();
      expect(composed.script.introIncluded).toBe(false);
      expect(composed.script.spokenText).toBe(plain.script.spokenText);
      expect(composed.script.readings.startsWith("Today's readings —")).toBe(true);
    }
  });
});

describe('the tailor intro fence — the prompt carries the same rule', () => {
  it('buildSpokenIntroPrompt fences the words and carries both Gospels', () => {
    const prompt = buildSpokenIntroPrompt({
      audience: 'women',
      yesterdayCitation: YESTERDAY.citation,
      yesterdayText: YESTERDAY.text,
      gospelCitation: BUNDLE.gospelCitation,
      gospelText: BUNDLE.gospelText,
      celebration: 'Thursday of the 30th week in Ordinary Time',
    });
    for (const phrase of [
      '40-70 words',
      'description only. Name scenes, people, and the question the text itself raises',
      "No lessons, no application, no opinions — not yours, not anyone's",
      "No new facts: if it is not in yesterday's Gospel text or today's, it does not belong",
      'No quotations except words taken verbatim from the two Gospels',
      'a fellow listener setting the table — never a priest, never a teacher, never a preacher',
      'Today the Church celebrates: Thursday of the 30th week in Ordinary Time',
    ]) {
      expect(prompt).toContain(phrase);
    }
    expect(prompt).toContain(YESTERDAY.citation);
    expect(prompt).toContain(YESTERDAY.text);
    expect(prompt).toContain(BUNDLE.gospelCitation);
    expect(prompt).toContain(BUNDLE.gospelText);
  });
});
