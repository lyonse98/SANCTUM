import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PASSAGES_BY_FOCUS,
  PASSAGES_BY_STATE,
  MEDIA_CATALOG,
  MEDIA_VALUES_FLOOR,
  TAILOR_FOCUSES,
  TAILOR_STATES,
  TAILOR_TONES,
  bestCatalogMedia,
  mediaAxisTotal,
  pickMedia,
  pickPassage,
  scoreCatalogMedia,
  type TailorMedia,
} from '@/data/tailorBank';
import {
  buildCorpusQuoteQuery,
  buildMediaScorePrompt,
  buildMediaSearchQuery,
  buildMediaStateQuery,
  buildMediaThemeQuery,
  buildTailorSystemPrompt,
  buildTailorUserPrompt,
  composeTailored,
  isChurchMedia,
  mediaWhyLine,
  parseMediaScores,
  parseTailorResult,
  pickGroundedMedia,
  pickTraditionQuote,
  reflectionThemeKeywords,
  selectScoredMedia,
  validateIntake,
  validateProfile,
  type MediaCandidate,
  type TailorBundle,
} from '../../supabase/functions/tailor-devotional/tailorCore';
import { DAILY_QUOTES, DAILY_QUOTES_WOMEN } from '@/data/quotes';
import {
  DAILY_QUOTES as FN_DAILY_QUOTES,
  DAILY_QUOTES_WOMEN as FN_DAILY_QUOTES_WOMEN,
} from '../../supabase/functions/tailor-devotional/quotes';
import { PERSONA_DISPLAY, resolveFeastDay, weekdayPersona } from './narratorCore';

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Tailor Today (Nov 12, 2026) — the composition pins. The bank is curated and
 * total: every focus/state combination resolves a passage with a citation,
 * and every media pick is a real work behind a SEARCH URL (never a media
 * id). The composition, with the model layer mocked, carries the day's
 * readings ENTIRE verbatim into the script, the passage after them as a
 * supplement, and exactly one tailored challenge into the response. There is
 * no companion lens anywhere in it (Erik): no lens field validates, no
 * persona sheet enters a prompt, and the credit names the narrator only.
 */

const DATES = ['2026-11-12', '2026-11-13', '2026-12-25', '2027-01-01', '2027-06-15'];

describe('the passage bank is total and cited', () => {
  it('every focus carries passages with citation and text', () => {
    for (const focus of TAILOR_FOCUSES) {
      const bank = PASSAGES_BY_FOCUS[focus.id];
      expect(bank.length).toBeGreaterThanOrEqual(1);
      for (const p of bank) {
        expect(p.citation.length).toBeGreaterThan(0);
        expect(p.text.length).toBeGreaterThanOrEqual(10);
        expect(p.translation).toBe('Douay-Rheims');
      }
    }
  });

  it('every state carries passages with citation and text', () => {
    for (const state of TAILOR_STATES) {
      const bank = PASSAGES_BY_STATE[state.id];
      expect(bank.length).toBeGreaterThanOrEqual(1);
      for (const p of bank) {
        expect(p.citation.length).toBeGreaterThan(0);
        expect(p.text.length).toBeGreaterThan(20);
      }
    }
  });

  it('every focus/state combination resolves a passage on any date', () => {
    for (const focus of TAILOR_FOCUSES) {
      for (const state of TAILOR_STATES) {
        for (const date of DATES) {
          const picked = pickPassage(focus.id, state.id, date);
          expect(picked.citation.length).toBeGreaterThan(0);
          expect(picked.text.length).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });
});

describe('the media seed — evergreen anchor behind a search-primary slot (Nov 13, 2026)', () => {
  it('is a seed, not a library: the 16 originals plus verified additions, capped small', () => {
    // Erik's redirect: live search is the primary source; the seed is the
    // fallback/anchor and stays evergreen-sized on purpose.
    expect(MEDIA_CATALOG.length).toBe(48);
    const urls = new Set<string>();
    const kinds = new Set<string>();
    for (const m of MEDIA_CATALOG) {
      kinds.add(m.kind);
      // The work's OWN YouTube page, verified live at curation through
      // oEmbed — never a search page, an embed, or an address from memory.
      expect(m.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
      expect(m.url).not.toContain('results?search_query=');
      expect(m.url).not.toContain('/embed/');
      expect(urls.has(m.url), m.title).toBe(false);
      urls.add(m.url);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.creator.length).toBeGreaterThan(0);
      expect(m.blurb.length).toBeGreaterThan(10);
      expect(m.valuesNote.length).toBeGreaterThan(0);
    }
    expect(kinds).toEqual(new Set(['song', 'talk', 'speech', 'interview', 'clip']));
  });

  it('scores every entry in range on the popularity and values axes', () => {
    for (const m of MEDIA_CATALOG) {
      for (const score of [m.popularity, m.values]) {
        expect(Number.isInteger(score), m.title).toBe(true);
        expect(score, m.title).toBeGreaterThanOrEqual(0);
        expect(score, m.title).toBeLessThanOrEqual(100);
      }
    }
  });

  it('tags every entry with valid focuses, states, and tones only', () => {
    const focusIds = TAILOR_FOCUSES.map((x) => x.id);
    const stateIds = TAILOR_STATES.map((x) => x.id);
    const toneIds = TAILOR_TONES.map((x) => x.id);
    for (const m of MEDIA_CATALOG) {
      expect(m.focuses.length, m.title).toBeGreaterThan(0);
      for (const f of m.focuses) expect(focusIds, m.title).toContain(f);
      for (const s of m.states) expect(stateIds, m.title).toContain(s);
      for (const t of m.tones) expect(toneIds, m.title).toContain(t);
    }
  });

  it('every focus carries a real bench above the floor, so the fallback never comes up empty', () => {
    for (const focus of TAILOR_FOCUSES) {
      const depth = MEDIA_CATALOG.filter(
        (m) => m.focuses.includes(focus.id) && m.values >= MEDIA_VALUES_FLOOR,
      ).length;
      expect(depth, focus.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the 16 seeds of the first bank, at their verified addresses', () => {
    const seeds: [string, string][] = [
      ['Joe Rogan Experience, Episode 1080 — David Goggins', '5tSTk1083VY'],
      ['Hall of Fame', 'mk48xRzuNvA'],
      ['All of Me', '450p7goxZqg'],
      ['Thinking Out Loud', 'lp-EO5I60KA'],
      ['Count on Me', '6k8cpUkKK4c'],
      ['Counting Stars', 'hT_nvWreIhg'],
      ['The Power of Vulnerability', 'iCvmsMzlF7o'],
      ['10 Ways to Have a Better Conversation', 'R1vskiVDwl4'],
      ['Fix You', 'k4V3Mo61fJM'],
      ['See You Again', 'RgKAFK5djSk'],
      ['Demons', 'mWRsgZuwf_8'],
      ['Numb', 'kXYiU_JCYtU'],
      ['Make Your Bed — UT Austin Commencement Address', 'pxBQLFLei70'],
      ['Unwritten', 'b7k0a5hYnSI'],
      ['Here Comes the Sun', 'KQetemT1sWc'],
      ['Three Little Birds', 'HNBCVM4KbUM'],
    ];
    expect(seeds.length).toBe(16);
    for (const [title, vid] of seeds) {
      const entry = MEDIA_CATALOG.find((m) => m.title === title);
      expect(entry, title).toBeDefined();
      expect(entry!.url, title).toBe(`https://www.youtube.com/watch?v=${vid}`);
    }
  });

  it('no catalog entry is church content — the exclusion filter passes the whole catalog', () => {
    for (const m of MEDIA_CATALOG) {
      expect(isChurchMedia({ title: m.title, creator: m.creator, url: m.url }), m.title).toBe(false);
    }
  });

  it('never picks a below-floor work — not even a famous, perfectly-fitting one', () => {
    const floored = MEDIA_CATALOG.filter((m) => m.values < MEDIA_VALUES_FLOOR);
    // The anchors exist and carry honest low scores (Imagine, Take Me to
    // Church) — the floor has real works to bite on.
    expect(floored.length).toBeGreaterThan(0);
    for (const focus of TAILOR_FOCUSES) {
      for (const state of TAILOR_STATES) {
        for (const tone of [...TAILOR_TONES.map((x) => x.id), null]) {
          const pick = pickMedia(focus.id, state.id, tone, '2026-11-13');
          expect(pick.values, pick.title).toBeGreaterThanOrEqual(MEDIA_VALUES_FLOOR);
          expect(floored).not.toContain(pick);
        }
      }
    }
  });

  it('picks are deterministic and vary by the morning', () => {
    for (const focus of TAILOR_FOCUSES) {
      for (const date of DATES) {
        const a = pickMedia(focus.id, 'anxious', 'courage', date);
        const b = pickMedia(focus.id, 'anxious', 'courage', date);
        expect(a).toBe(b);
        expect(MEDIA_CATALOG).toContain(a);
      }
    }
    const picks = new Set<string>();
    for (const focus of TAILOR_FOCUSES) {
      for (const state of TAILOR_STATES) {
        picks.add(pickMedia(focus.id, state.id, 'courage', '2026-11-13').url);
      }
    }
    expect(picks.size).toBeGreaterThan(8);
  });
});

describe('three-axis scoring — fit 40, alignment 35, popularity 25, one floor (Nov 13, 2026)', () => {
  const axes = (fit: number, alignment: number, popularity: number) => ({
    fit,
    alignment,
    popularity,
    total: mediaAxisTotal(fit, alignment, popularity),
  });
  const entry = (over: Partial<TailorMedia>): TailorMedia => ({
    kind: 'song',
    title: 'Test Work',
    creator: 'Tester',
    url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA',
    blurb: 'A test work.',
    focuses: ['work'],
    states: ['anxious'],
    tones: ['courage'],
    popularity: 50,
    values: 80,
    valuesNote: 'A test virtue.',
    ...over,
  });

  it('weights the axes and sums one total', () => {
    const scored = scoreCatalogMedia(entry({}), 'work', 'anxious', 'courage')!;
    expect(scored.fit).toBe(40); // focus 18 + state 12 + tone 10
    expect(scored.alignment).toBe(28); // 80 × 0.35
    expect(scored.popularity).toBe(12.5); // 50 × 0.25
    expect(scored.total).toBe(80.5);
    expect(mediaAxisTotal(40, 35, 25)).toBe(100);
  });

  it('the floor is absolute: a popular, perfectly-fitting, low-values work scores null', () => {
    const viral = entry({ popularity: 100, values: MEDIA_VALUES_FLOOR - 1 });
    expect(scoreCatalogMedia(viral, 'work', 'anxious', 'courage')).toBeNull();
    const atFloor = entry({ values: MEDIA_VALUES_FLOOR });
    expect(scoreCatalogMedia(atFloor, 'work', 'anxious', 'courage')).not.toBeNull();
  });

  it('popularity breaks a fit tie: equal fit and values, the better-known work wins', () => {
    const known = scoreCatalogMedia(entry({ popularity: 90 }), 'work', 'anxious', 'courage')!;
    const obscure = scoreCatalogMedia(entry({ popularity: 30 }), 'work', 'anxious', 'courage')!;
    expect(known.fit).toBe(obscure.fit);
    expect(known.alignment).toBe(obscure.alignment);
    expect(known.total).toBeGreaterThan(obscure.total);
  });

  it('alignment outweighs a popularity gap of the same raw size, per the weights', () => {
    // A 40-point values gap is 14 axis points; a 40-point popularity gap
    // is 10. The aligned work wins despite being the less famous one.
    const aligned = scoreCatalogMedia(entry({ values: 90, popularity: 50 }), 'work', 'anxious', 'courage')!;
    const famous = scoreCatalogMedia(entry({ values: 50, popularity: 90 }), 'work', 'anxious', 'courage')!;
    expect(aligned.total).toBeGreaterThan(famous.total);
  });

  it('the floor bites in live selection: a below-floor estimate never wins, however scored', () => {
    const viral: MediaCandidate = {
      kind: 'song',
      title: 'Viral and Empty',
      creator: 'Some Band',
      url: 'https://www.youtube.com/watch?v=mWRsgZuwf_8',
    };
    const modest: MediaCandidate = {
      kind: 'song',
      title: 'Hall of Fame',
      creator: 'The Script feat. will.i.am',
      url: 'https://www.youtube.com/watch?v=mk48xRzuNvA',
    };
    // The viral work: perfect fit (40), top popularity (25), but its
    // estimated alignment (13/35 ≈ values 37) sits below the floor.
    expect(selectScoredMedia([viral, modest], [axes(40, 13, 25), axes(20, 28, 10)])?.candidate).toBe(modest);
    expect(selectScoredMedia([viral], [axes(40, 13, 25)])).toBeNull();
    // Exactly on the floor (alignment 14 = values 40) survives, as a
    // catalog entry at values 40 does.
    expect(selectScoredMedia([viral], [axes(40, 14, 25)])?.candidate).toBe(viral);
    // No scores at all: no live total exists, so no live winner.
    expect(selectScoredMedia([modest], null)).toBeNull();
  });

  it('parseMediaScores clamps each axis to its weight and totals the three', () => {
    const raw = JSON.stringify({ scores: [{ fit: 99, alignment: 40, popularity: 30 }] });
    expect(parseMediaScores(raw, 1)).toEqual([{ fit: 40, alignment: 35, popularity: 25, total: 100 }]);
    expect(parseMediaScores(JSON.stringify({ scores: [{ fit: 1 }] }), 1)).toBeNull();
    expect(parseMediaScores(JSON.stringify({ scores: [] }), 1)).toBeNull();
    expect(parseMediaScores(JSON.stringify({ scores: [42] }), 1)).toBeNull();
    expect(parseMediaScores('no json here', 1)).toBeNull();
  });

  it('the scorer prompt carries the three axes and the floor’s terms', () => {
    const prompt = buildMediaScorePrompt(
      [{ kind: 'song', title: 'X', creator: 'Y', url: 'https://www.youtube.com/watch?v=mk48xRzuNvA' }],
      { focus: 'work', state: 'anxious', tone: 'courage', audience: 'men', reflect: 'Press on.' },
    );
    expect(prompt).toContain('fit: 0-40');
    expect(prompt).toContain('alignment: 0-35');
    expect(prompt).toContain('popularity: 0-25');
    expect(prompt).toContain('Church values');
    expect(prompt).toContain('"fit"');
  });
});

describe('intake validation — allowlisted, lens-free', () => {
  it('accepts a plain intake and normalizes the free text', () => {
    const intake = validateIntake({ state: 'anxious', focus: 'work', freeText: '  Big   review at 2. ' });
    expect(intake).toEqual({ state: 'anxious', focus: 'work', tone: null, freeText: 'Big review at 2.' });
  });

  it('accepts a real tone, and an invented one reads as no tone rather than a rejection', () => {
    expect(validateIntake({ state: 'anxious', focus: 'work', tone: 'courage' })?.tone).toBe('courage');
    expect(validateIntake({ state: 'anxious', focus: 'work', tone: 'wired' })?.tone).toBeNull();
  });

  it('rejects unknown states and focuses', () => {
    expect(validateIntake({ state: 'wired', focus: 'work' })).toBeNull();
    expect(validateIntake({ state: 'steady', focus: 'money' })).toBeNull();
    expect(validateIntake({})).toBeNull();
  });

  it('a lens field in the payload is ignored, not honoured — there is no lens', () => {
    const intake = validateIntake({ state: 'steady', focus: 'today', lensId: 'augustine' });
    expect(intake).not.toBeNull();
    expect(intake && 'lensId' in intake).toBe(false);
  });
});

const BUNDLE: TailorBundle = {
  celebration: null,
  gospelCitation: 'John 6:37-40',
  gospelText: 'GOSPEL TEXT VERBATIM — All that the Father giveth to me shall come to me.',
  readings: [
    { kind: 'first', citation: '1 Kings 19:11-13', text: 'FIRST READING VERBATIM TEXT.' },
    { kind: 'psalm', citation: 'Psalm 27', text: 'PSALM VERBATIM TEXT.' },
    { kind: 'gospel', citation: 'John 6:37-40', text: 'GOSPEL TEXT VERBATIM — All that the Father giveth to me shall come to me.' },
  ],
  reflect: 'The canonical reflection, for everyone.',
  challenge: 'The canonical challenge.',
  facet: 'As a man',
};

const INTAKE = { state: 'anxious' as const, focus: 'work' as const, tone: 'courage' as const, freeText: 'Big review at 2.' };

describe('composition with the model layer mocked', () => {
  const generateTailored = async () => ({
    reflect: 'TAILORED REFLECTION — aimed at the review at two.',
    challenge: 'TAILORED CHALLENGE — one concrete act.',
  });

  it('carries every reading byte-for-byte, the passage as supplement, one challenge', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      hour: 7,
    });
    // Every reading part appears in the spoken script exactly as the bundle held it.
    for (const part of BUNDLE.readings) {
      expect(composed.script.spokenText).toContain(part.text);
    }
    // The passage is introduced as a supplement, after the readings.
    expect(composed.script.passage).toContain("And for what you're carrying today —");
    expect(composed.script.spokenText.indexOf(composed.script.passage)).toBeGreaterThan(
      composed.script.spokenText.indexOf(BUNDLE.gospelText),
    );
    // The tailored parts are the ones used; exactly one challenge exists.
    expect(composed.tailored.reflect).toBe('TAILORED REFLECTION — aimed at the review at two.');
    expect(composed.tailored.challenge).toBe('TAILORED CHALLENGE — one concrete act.');
    expect(composed.script.spokenText).toContain('TAILORED REFLECTION');
    expect(composed.script.spokenText).toContain('TAILORED CHALLENGE');
    expect(composed.script.spokenText).not.toContain('The canonical reflection');
    // No scene, no tomorrow teaser in a tailored script.
    expect(composed.script.spokenText).not.toContain('Tomorrow');
    // The media pick rides along with its own page address.
    expect(composed.media.url.length).toBeGreaterThan(0);
    expect(composed.media.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
  });

  it('the narrator is the weekday narrator for the track — Thursday: Martin / Marta', async () => {
    // 2026-11-12 is a Thursday.
    const men = await composeTailored({ dateISO: '2026-11-12', audience: 'men', intake: INTAKE, bundle: BUNDLE, generateTailored, hour: 7 });
    expect(men.script.persona).toBe(weekdayPersona('men', 4));
    expect(men.narratorName).toBe(PERSONA_DISPLAY.martin.name);
    const women = await composeTailored({ dateISO: '2026-11-12', audience: 'women', intake: INTAKE, bundle: BUNDLE, generateTailored, hour: 7 });
    expect(women.script.persona).toBe(weekdayPersona('women', 4));
    expect(women.narratorName).toBe('Marta');
  });

  it('the Lector reads on a solemnity, on both tracks', async () => {
    const christmas = resolveFeastDay('2026-12-25');
    expect(christmas?.rank).toBe('solemnity');
    for (const audience of ['men', 'women'] as const) {
      const composed = await composeTailored({ dateISO: '2026-12-25', audience, intake: INTAKE, bundle: BUNDLE, generateTailored, hour: 7 });
      expect(composed.script.lector).toBe(true);
      expect(composed.script.persona).toBe('lector');
    }
  });

  it('the system prompt carries grounding and the tailor task — and no persona sheet', () => {
    for (const audience of ['men', 'women'] as const) {
      const system = buildTailorSystemPrompt(audience);
      expect(system).toContain('THE TAILOR TASK');
      expect(system).not.toContain('PERSONA SHEET');
      expect(system).not.toContain('You are St.');
      expect(system).not.toContain('lens');
    }
    const user = buildTailorUserPrompt(BUNDLE, INTAKE, pickPassage('work', 'anxious', '2026-11-12'));
    expect(user).toContain('The canonical reflection');
    expect(user).toContain('Big review at 2.');
  });

  it('parseTailorResult is strict about shape', () => {
    expect(parseTailorResult('{"reflect":"A real reflection here.","challenge":"Do the one act."}'))
      .toEqual({ reflect: 'A real reflection here.', challenge: 'Do the one act.' });
    expect(parseTailorResult('{"reflect":"short"}')).toBeNull();
    expect(parseTailorResult('not json')).toBeNull();
  });
});

describe('privacy pins — the function cannot store what it is told', () => {
  const fnIndex = readRoot('supabase/functions/tailor-devotional/index.ts');
  const fnCore = readRoot('supabase/functions/tailor-devotional/tailorCore.ts');

  it('no persistence writes: no upsert, no insert, no storage upload, no write methods on REST', () => {
    for (const src of [fnIndex, fnCore]) {
      expect(src).not.toMatch(/\.upsert\(/);
      expect(src).not.toMatch(/\.insert\(/);
      expect(src).not.toContain('/storage/v1/object');
      expect(src).not.toMatch(/method:\s*"(PUT|PATCH|DELETE)"/);
    }
    // The only literal REST endpoint named in the file is the quota RPC; the
    // bundle reads go through one read-only select helper — pinned here so a
    // new endpoint fails loudly.
    const restEndpoints = fnIndex.match(/rest\/v1\/[a-z_/]+/g) ?? [];
    expect(new Set(restEndpoints)).toEqual(new Set(['rest/v1/rpc/consume_chat_quota']));
    expect(fnIndex).toContain('async function restSelect');
  });

  it('logs carry stage codes and counts only — never the intake', () => {
    const logLines = fnIndex.split('\n').filter((l) => l.includes('console.'));
    expect(logLines.length).toBeGreaterThan(0);
    for (const line of logLines) {
      expect(line).not.toContain('intake');
      expect(line).not.toContain('freeText');
      expect(line).not.toContain('reflect');
    }
  });

  it('the mirrored grounding blocks match chat-proxy verbatim', () => {
    const chatProxy = readRoot('supabase/functions/chat-proxy/index.ts');
    const prompts = readRoot('supabase/functions/tailor-devotional/prompts.ts');
    for (const name of ['SCRIPTURE_GROUNDING', 'SCRIPTURE_GROUNDING_WOMEN']) {
      const grab = (src: string) => {
        const m = src.match(new RegExp(`const ${name} = \\\`([\\s\\S]*?)\\\`;`));
        return m?.[1];
      };
      expect(grab(prompts)).toBeDefined();
      expect(grab(prompts)).toBe(grab(chatProxy));
    }
    // And the tailor task holds no companion framing.
    expect(prompts).not.toContain('tool:rule');
    expect(prompts).not.toContain('PERSONA');
  });

  it('the audio engine copy matches audio-render below its header', () => {
    const original = readRoot('supabase/functions/audio-render/audioEngine.ts');
    const copy = readRoot('supabase/functions/tailor-devotional/audioEngine.ts');
    // The copy is the original verbatim under a five-line // header.
    const copyBody = copy.split('\n').slice(5).join('\n');
    expect(copyBody.trim()).toBe(original.trim());
  });
});

// ── V2 (Nov 13, 2026): profile, tradition quote, live media ──────────────────

const PROFILE = {
  seasonOfLife: 'Father of young children',
  ongoingBattles: ['Work pressure', 'Grief'],
  standingGoal: 'SENTINEL-GOAL-be-a-patient-father',
  mediaPrefs: ['song', 'video'] as const,
};

describe('v2 — the standing profile validates to labels and caps', () => {
  it('accepts a well-formed profile and drops invented media kinds', () => {
    const profile = validateProfile({
      profile: { ...PROFILE, mediaPrefs: ['song', 'hologram', 'video', 'song'] },
    });
    expect(profile?.seasonOfLife).toBe('Father of young children');
    expect(profile?.ongoingBattles).toEqual(['Work pressure', 'Grief']);
    expect(profile?.mediaPrefs).toEqual(['song', 'video']);
  });

  it('an absent or empty profile validates to null', () => {
    expect(validateProfile({})).toBeNull();
    expect(validateProfile({ profile: null })).toBeNull();
    expect(validateProfile({ profile: { seasonOfLife: '  ', ongoingBattles: [], standingGoal: '', mediaPrefs: [] } })).toBeNull();
  });

  it('the user prompt carries the profile phrased for the track — his facet and hers', () => {
    const menPrompt = buildTailorUserPrompt(BUNDLE, INTAKE, pickPassage('work', 'anxious', '2026-11-12'), { ...PROFILE, mediaPrefs: [...PROFILE.mediaPrefs] }, 'men');
    expect(menPrompt).toContain('The season of his life: Father of young children.');
    expect(menPrompt).toContain('Battles he carries in this season: Work pressure, Grief.');
    expect(menPrompt).toContain('His standing goal');
    expect(menPrompt).toContain('What he is asking of God today: Courage.');

    const womenBundle = { ...BUNDLE, facet: 'As a woman' };
    const womenPrompt = buildTailorUserPrompt(womenBundle, INTAKE, pickPassage('work', 'anxious', '2026-11-12'), { ...PROFILE, mediaPrefs: [...PROFILE.mediaPrefs] }, 'women');
    expect(womenPrompt).toContain('The season of her life: Father of young children.');
    expect(womenPrompt).toContain('Battles she carries in this season');
    expect(womenPrompt).toContain('Her standing goal');
    expect(womenPrompt).toContain('What she is asking of God today: Courage.');
  });

  it('the system prompts carry each track’s facet (grounding blocks differ by track)', () => {
    expect(buildTailorSystemPrompt('men')).toContain('like a man who has lived in these texts');
    expect(buildTailorSystemPrompt('women')).toContain('like a woman who has lived in these texts');
  });
});

describe('v2 — the search query is built from enum categories only', () => {
  it('the query names only categories: kinds, focus, tone, audience', () => {
    const query = buildMediaSearchQuery({ focus: 'grief', tone: 'consolation', audience: 'women', kinds: ['song', 'video'] });
    expect(query).toContain('songs, videos');
    expect(query).toContain('for a Catholic woman');
    expect(query).toContain('grief');
    expect(query).toContain('consolation');
  });

  it('sentinel text in every user-written field never reaches the query (driven through a build)', async () => {
    const queries: string[] = [];
    const findMedia = async (query: string) => {
      queries.push(query);
      return null;
    };
    await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: { state: 'anxious', focus: 'work', tone: 'courage', freeText: 'SENTINEL-FREETEXT-my-review-is-at-two' },
      bundle: BUNDLE,
      profile: { ...PROFILE, mediaPrefs: [...PROFILE.mediaPrefs] },
      generateTailored: async () => ({ reflect: 'A reflection of decent length.', challenge: 'One act.' }),
      findMedia,
      hour: 7,
    });
    // Three angle searches now (focus, state, reflection themes) — and the
    // rule is unchanged for every one of them: categories and composed
    // themes only, never a word the user wrote.
    expect(queries).toHaveLength(3);
    for (const q of queries) {
      expect(q).not.toContain('SENTINEL');
      expect(q).not.toContain('review');
      expect(q).not.toContain('patient');
    }
    // And the corpus query is categories only too.
    const corpusQuery = buildCorpusQuoteQuery({ state: 'anxious', focus: 'work', tone: 'courage', freeText: 'SENTINEL-FREETEXT' });
    expect(corpusQuery).not.toContain('SENTINEL');
  });
});

const GROUNDED_OK = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{"title": "Hall of Fame", "creator": "The Script feat. will.i.am", "kind": "song", "url": "https://www.youtube.com/watch?v=mk48xRzuNvA"}',
          },
        ],
      },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://www.youtube.com/watch?v=mk48xRzuNvA', title: 'The Script - Hall of Fame (Official Video) ft. will.i.am' } },
          { web: { uri: 'https://en.wikipedia.org/wiki/Hall_of_Fame_(song)', title: 'Hall of Fame — Wikipedia' } },
        ],
      },
    },
  ],
};

const GROUNDED_DEMONS = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{"title": "Demons", "creator": "Imagine Dragons", "kind": "song", "url": "https://www.youtube.com/watch?v=mWRsgZuwf_8"}',
          },
        ],
      },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://www.youtube.com/watch?v=mWRsgZuwf_8', title: 'Imagine Dragons - Demons (Official Music Video)' } },
        ],
      },
    },
  ],
};

const GROUNDED_CHURCH = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{"title": "On Eagle\'s Wings", "creator": "Michael Joncas", "kind": "song", "url": "https://www.youtube.com/watch?v=church12345"}',
          },
        ],
      },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://www.youtube.com/watch?v=church12345', title: "On Eagle's Wings — Catholic hymn" } },
        ],
      },
    },
  ],
};

/** A Gemini-shaped scorer reply carrying the given three-axis scores. */
function scorerReply(scores: { fit: number; alignment: number; popularity: number }[]) {
  return {
    candidates: [
      { content: { parts: [{ text: JSON.stringify({ scores }) }] } },
    ],
  };
}

describe('v2 — grounded media: the address must come from the search’s own sources', () => {
  it('accepts a pick whose URL is verbatim among the grounding sources', () => {
    const pick = pickGroundedMedia(GROUNDED_OK, ['song', 'video', 'talk', 'podcast', 'article', 'book']);
    expect(pick).toEqual({
      kind: 'song',
      title: 'Hall of Fame',
      creator: 'The Script feat. will.i.am',
      url: 'https://www.youtube.com/watch?v=mk48xRzuNvA',
      source: 'The Script - Hall of Fame (Official Video) ft. will.i.am',
    });
  });

  it('rejects a URL the model composed — not among the grounding sources', () => {
    const forged = structuredClone(GROUNDED_OK);
    forged.candidates[0].content.parts[0].text =
      '{"title": "Hall of Fame", "creator": "The Script", "kind": "song", "url": "https://www.youtube.com/watch?v=INVENTED1"}';
    expect(pickGroundedMedia(forged, ['song'])).toBeNull();
  });

  it('rejects a search page even when it is among the sources', () => {
    const searchy = structuredClone(GROUNDED_OK);
    searchy.candidates[0].groundingMetadata.groundingChunks.push({
      web: { uri: 'https://www.youtube.com/results?search_query=hall+of+fame', title: 'Search' },
    });
    searchy.candidates[0].content.parts[0].text =
      '{"title": "Results", "creator": "YouTube", "kind": "video", "url": "https://www.youtube.com/results?search_query=hall+of+fame"}';
    expect(pickGroundedMedia(searchy, ['video'])).toBeNull();
  });

  it('rejects a kind the morning did not allow, and non-https addresses', () => {
    expect(pickGroundedMedia(GROUNDED_OK, ['article', 'book'])).toBeNull();
    const http = structuredClone(GROUNDED_OK);
    http.candidates[0].groundingMetadata.groundingChunks[0].web.uri = 'http://www.youtube.com/watch?v=mk48xRzuNvA';
    http.candidates[0].content.parts[0].text =
      '{"title": "Hall of Fame", "creator": "The Script", "kind": "song", "url": "http://www.youtube.com/watch?v=mk48xRzuNvA"}';
    expect(pickGroundedMedia(http, ['song'])).toBeNull();
  });

  it('rejects empty answers and missing grounding entirely', () => {
    expect(pickGroundedMedia(null, ['song'])).toBeNull();
    expect(pickGroundedMedia({}, ['song'])).toBeNull();
    expect(pickGroundedMedia({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }, ['song'])).toBeNull();
  });

  it('a grounded answer with no scorer cannot compete — the catalog answers; the why-line is categories only', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      findMedia: async () => GROUNDED_OK,
      hour: 7,
    });
    // No scores → no live total → the unified comparison never runs and
    // the catalog's best for the morning takes the card.
    const best = bestCatalogMedia('work', 'anxious', 'courage', '2026-11-12')!;
    expect(composed.media.url).toBe(best.media.url);
    expect(composed.media.why).toBe(mediaWhyLine('work', 'courage'));
    expect(composed.media.why).not.toContain('review');
    expect(composed.mediaStats.pool).toBe(1);
  });

  it('any search failure falls back to the catalog and its verified address', async () => {
    for (const findMedia of [undefined, async () => null, async () => { throw new Error('down'); }, async () => ({ junk: true })]) {
      const composed = await composeTailored({
        dateISO: '2026-11-12',
        audience: 'men',
        intake: INTAKE,
        bundle: BUNDLE,
        generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
        findMedia,
        hour: 7,
      });
      expect(MEDIA_CATALOG.some((m) => m.url === composed.media.url)).toBe(true);
      expect(composed.media.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
      expect(composed.media.title.length).toBeGreaterThan(0);
    }
  });

  it('the standing profile narrows the hunted kinds — the query and the acceptance agree', async () => {
    const queries: string[] = [];
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'women',
      intake: { ...INTAKE, focus: 'grief' },
      bundle: { ...BUNDLE, facet: 'As a woman' },
      profile: { seasonOfLife: null, ongoingBattles: [], standingGoal: '', mediaPrefs: ['article'] },
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      findMedia: async (query: string) => {
        queries.push(query);
        return GROUNDED_OK; // a song — not among her allowed kinds
      },
      hour: 7,
    });
    expect(queries[0]).toContain('articles');
    expect(queries[0]).toContain('for a Catholic woman');
    // The song was refused (kind not allowed) and the bank answered instead.
    expect(composed.media.url).not.toBe('https://www.youtube.com/watch?v=mk48xRzuNvA');
  });
});

describe('v3 — media rework: pop culture only, gathered, verified, scored', () => {
  const POP_A: MediaCandidate = {
    kind: 'song', title: 'Hall of Fame', creator: 'The Script feat. will.i.am',
    url: 'https://www.youtube.com/watch?v=mk48xRzuNvA', source: 'The Script - Hall of Fame (Official Video)',
  };
  const POP_B: MediaCandidate = {
    kind: 'song', title: 'Demons', creator: 'Imagine Dragons',
    url: 'https://www.youtube.com/watch?v=mWRsgZuwf_8', source: 'Imagine Dragons - Demons (Official Music Video)',
  };
  const CHURCH: MediaCandidate = {
    kind: 'song', title: "On Eagle's Wings", creator: 'Michael Joncas',
    url: 'https://www.youtube.com/watch?v=church12345', source: "On Eagle's Wings — Catholic hymn",
  };

  it('the exclusion filter catches church content in any field', () => {
    expect(isChurchMedia(CHURCH)).toBe(true);
    expect(isChurchMedia({ title: 'Sunday Worship Set', creator: 'City Band', url: 'https://www.youtube.com/watch?v=x' })).toBe(true);
    expect(isChurchMedia({ title: 'The Bible in a Year', creator: 'Fr. Mike Schmitz', url: 'https://www.youtube.com/watch?v=x' })).toBe(true);
    expect(isChurchMedia({ title: 'Live at Red Rocks', creator: 'Elevation Worship', url: 'https://www.youtube.com/watch?v=x' })).toBe(true);
    expect(isChurchMedia({ title: 'Morning Sermon', creator: 'Grace Community', url: 'https://www.youtube.com/watch?v=x' })).toBe(true);
  });

  it('the exclusion filter leaves pop culture alone — even a song with “church” in its name', () => {
    expect(isChurchMedia({ title: 'Take Me to Church', creator: 'Hozier', url: 'https://www.youtube.com/watch?v=PVjiKRfKpPI' })).toBe(false);
    expect(isChurchMedia(POP_A)).toBe(false);
    expect(isChurchMedia(POP_B)).toBe(false);
    expect(isChurchMedia({ title: 'Numb', creator: 'Linkin Park', url: 'https://www.youtube.com/watch?v=kXYiU_JCYtU' })).toBe(false);
  });

  it('selection rejects a church candidate even when the scorer ranked it first', () => {
    const top = { fit: 40, alignment: 35, popularity: 25, total: 100 };
    const low = { fit: 5, alignment: 15, popularity: 2, total: 22 };
    expect(selectScoredMedia([CHURCH, POP_A], [top, low])?.candidate.title).toBe('Hall of Fame');
    expect(selectScoredMedia([CHURCH], [top])).toBeNull();
    expect(selectScoredMedia([CHURCH, POP_A], null)).toBeNull();
  });

  it('selection picks the unified-total winner; ties keep pool order; null scores yield no winner', () => {
    const a = { fit: 20, alignment: 15, popularity: 5, total: 40 };
    const b = { fit: 35, alignment: 30, popularity: 20, total: 85 };
    expect(selectScoredMedia([POP_A, POP_B], [a, b])?.candidate.title).toBe('Demons');
    expect(selectScoredMedia([POP_A, POP_B], [b, b])?.candidate.title).toBe('Hall of Fame');
    expect(selectScoredMedia([POP_A, POP_B], null)).toBeNull();
  });

  it('parseMediaScores accepts the exact three-axis shape and refuses everything else', () => {
    expect(parseMediaScores(scorerReply([
      { fit: 10, alignment: 0, popularity: 0 },
      { fit: 40, alignment: 35, popularity: 15 },
    ]), 2)).toEqual([
      { fit: 10, alignment: 0, popularity: 0, total: 10 },
      { fit: 40, alignment: 35, popularity: 15, total: 90 },
    ]);
    expect(parseMediaScores('{"scores": [{"fit": 35, "alignment": 10, "popularity": 10}, {"fit": 40, "alignment": 15, "popularity": 10}]}', 2)).toEqual([
      { fit: 35, alignment: 10, popularity: 10, total: 55 },
      { fit: 40, alignment: 15, popularity: 10, total: 65 },
    ]);
    expect(parseMediaScores(scorerReply([{ fit: 10, alignment: 0, popularity: 0 }]), 2)).toBeNull();
    expect(parseMediaScores('no json here', 2)).toBeNull();
    expect(parseMediaScores(null, 2)).toBeNull();
    expect(parseMediaScores({ scores: ['high', 10] }, 2)).toBeNull();
  });

  it('the score prompt carries the three axes, the day’s categories, and every candidate', () => {
    const prompt = buildMediaScorePrompt([POP_A, POP_B], {
      focus: 'work', state: 'anxious', tone: 'courage', audience: 'men',
      reflect: 'TAILORED REFLECTION about perseverance under pressure.',
    });
    expect(prompt).toContain('fit: 0-40');
    expect(prompt).toContain('alignment: 0-35');
    expect(prompt).toContain('popularity: 0-25');
    expect(prompt).toContain('Church values');
    expect(prompt).toContain('Church content');
    expect(prompt).toContain('work & career');
    expect(prompt).toContain('anxious');
    expect(prompt).toContain('TAILORED REFLECTION about perseverance');
    expect(prompt).toContain('Hall of Fame');
    expect(prompt).toContain('Demons');
    expect(prompt).not.toContain('SENTINEL');
  });

  it('theme keywords come from the composed reflection — and user words are struck even at one remove', () => {
    const keywords = reflectionThemeKeywords(
      'Perseverance perseverance: the widow keeps knocking, and her persistence is answered.',
      ['Tell me about persistence at my review'],
    );
    expect(keywords).toContain('perseverance');
    expect(keywords).not.toContain('persistence');
    expect(keywords).not.toContain('review');
    const query = buildMediaThemeQuery(keywords, ['song']);
    expect(query).toContain('perseverance');
    expect(query).not.toContain('review');
  });

  it('the state angle query leads with the feeling and keeps the same pop rules', () => {
    const query = buildMediaStateQuery({ focus: 'grief', state: 'down', tone: 'consolation', audience: 'women', kinds: ['song'] });
    expect(query).toContain('feeling down');
    expect(query).toContain('grief');
    expect(query).toContain('NOT be church content');
    expect(query).toContain('Linkin Park');
  });

  it('a build gathers a pool across angles and the scorer’s winner is the card', async () => {
    const prompts: string[] = [];
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'A tailored reflection about perseverance and pressure.', challenge: 'One act.' }),
      findMedia: async (query: string) => {
        if (query.includes('feeling anxious')) return GROUNDED_DEMONS;
        return GROUNDED_OK;
      },
      scoreMedia: async (prompt: string) => {
        prompts.push(prompt);
        // Pool order is angle order: Hall of Fame (focus), Demons (state).
        // Demons takes the maximum on every axis — the only stub total
        // that certainly beats the catalog's best for this morning.
        return scorerReply([
          { fit: 14, alignment: 13, popularity: 8 },
          { fit: 40, alignment: 35, popularity: 25 },
        ]);
      },
      hour: 7,
    });
    expect(composed.media.title).toBe('Demons');
    expect(composed.media.url).toBe('https://www.youtube.com/watch?v=mWRsgZuwf_8');
    expect(composed.mediaStats.pool).toBe(2);
    expect(composed.mediaStats.verified).toBe(2);
    expect(composed.mediaStats.spread).toBe(65); // 100 − 35, across the live pool's totals
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toContain('Big review');
  });

  it('the unified comparison: a live find takes the card only by beating the catalog outright', async () => {
    const best = bestCatalogMedia('work', 'anxious', 'courage', '2026-11-12')!;
    const axesForTotal = (t: number) => {
      const fit = Math.min(40, t);
      const alignment = Math.min(35, t - fit);
      return { fit, alignment, popularity: t - fit - alignment };
    };
    const build = (total: number) => composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      findMedia: async () => GROUNDED_OK,
      scoreMedia: async () => scorerReply([axesForTotal(total)]),
      hour: 7,
    });
    // One point under the catalog's total: the catalog keeps the card.
    const under = await build(Math.floor(best.axes.total));
    expect(under.media.url).toBe(best.media.url);
    // One point over: the found work takes it.
    const over = await build(Math.floor(best.axes.total) + 1);
    expect(over.media.url).toBe('https://www.youtube.com/watch?v=mk48xRzuNvA');
    expect(over.media.title).toBe('Hall of Fame');
  });

  it('a scoring failure degrades to the catalog, never to an unscored guess', async () => {
    const best = bestCatalogMedia('work', 'anxious', 'courage', '2026-11-12')!;
    for (const scoreMedia of [
      async () => { throw new Error('down'); },
      async () => null,
      async () => ({ junk: true }),
      async () => scorerReply([{ fit: 1, alignment: 1, popularity: 1 }]),
    ]) {
      const composed = await composeTailored({
        dateISO: '2026-11-12',
        audience: 'men',
        intake: INTAKE,
        bundle: BUNDLE,
        generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
        findMedia: async (query: string) => (query.includes('feeling anxious') ? GROUNDED_DEMONS : GROUNDED_OK),
        scoreMedia,
        hour: 7,
      });
      expect(composed.media.url).toBe(best.media.url);
      expect(composed.mediaStats.spread).toBeNull();
    }
  });

  it('a pool of nothing but church content falls back to the catalog — church never reaches the card', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      findMedia: async () => GROUNDED_CHURCH,
      scoreMedia: async () => scorerReply([{ fit: 40, alignment: 35, popularity: 25 }]),
      hour: 7,
    });
    expect(composed.media.title).not.toContain("Eagle's Wings");
    expect(MEDIA_CATALOG.some((m) => m.url === composed.media.url)).toBe(true);
    expect(composed.mediaStats.verified).toBe(0);
  });
});

describe('v2 — the tradition quote: corpus first, the dataset shelf behind it', () => {
  it('the function’s quotes mirror IS the app’s dataset — the transform edits nothing', () => {
    expect(FN_DAILY_QUOTES).toEqual(DAILY_QUOTES);
    expect(FN_DAILY_QUOTES_WOMEN).toEqual(DAILY_QUOTES_WOMEN);
  });

  it('every dataset pick is a member of the track’s own shelf, attributed', () => {
    for (const audience of ['men', 'women'] as const) {
      const shelf = audience === 'women' ? DAILY_QUOTES_WOMEN : DAILY_QUOTES;
      for (const focus of ['work', 'grief', 'temptation', 'today'] as const) {
        const quote = pickTraditionQuote(audience, focus, 'comfort', '2026-11-12');
        expect(quote).not.toBeNull();
        const member = shelf.find(
          (q) => q.text.trim() === quote!.text && quote!.author.startsWith(q.author),
        );
        expect(member, `${audience}/${focus}`).toBeDefined();
        // Spoken-safety: short, and free of the main segment’s excluded words.
        expect(quote!.text.length).toBeLessThanOrEqual(240);
        expect(quote!.text.toLowerCase()).not.toContain('tomorrow');
      }
    }
  });

  it('corpus first: a retrieved quote wins over the dataset pick and is woven after the reflection', async () => {
    const corpusQuote = { text: 'CORPUS WORD — a retrieved passage from the shelf.', author: 'St. Augustine, Confessions' };
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'TAILORED REFLECTION — aimed at the review.', challenge: 'One act.' }),
      corpusQuote,
      hour: 7,
    });
    expect(composed.traditionQuote).toEqual(corpusQuote);
    const spoken = composed.script.spokenText;
    expect(spoken).toContain('A word from the tradition — St. Augustine, Confessions: CORPUS WORD');
    expect(spoken.indexOf('CORPUS WORD')).toBeGreaterThan(spoken.indexOf('TAILORED REFLECTION'));
    expect(spoken.indexOf('CORPUS WORD')).toBeLessThan(spoken.indexOf('One act.'));
  });

  it('dataset fallback: no corpus word, and the build still carries a quote from the shelf', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'women',
      intake: { ...INTAKE, focus: 'grief' },
      bundle: { ...BUNDLE, facet: 'As a woman' },
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      corpusQuote: null,
      hour: 7,
    });
    expect(composed.traditionQuote).not.toBeNull();
    const member = DAILY_QUOTES_WOMEN.find((q) => q.text.trim() === composed.traditionQuote!.text);
    expect(member).toBeDefined();
    expect(composed.script.spokenText).toContain('A word from the tradition —');
  });

  it('absent is fine: no quote anywhere, and the devotional still composes whole', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      corpusQuote: null,
      datasetQuote: null,
      hour: 7,
    });
    expect(composed.traditionQuote).toBeNull();
    expect(composed.script.spokenText).not.toContain('A word from the tradition');
    expect(composed.script.spokenText).toContain(BUNDLE.gospelText);
  });
});

describe('v2 — privacy pins for the new payload paths', () => {
  const fnIndex = readRoot('supabase/functions/tailor-devotional/index.ts');
  const fnCorpus = readRoot('supabase/functions/tailor-devotional/corpus.ts');

  it('the profile is validated, never persisted — the write-path pins still hold over the new code', () => {
    expect(fnIndex).toContain('validateProfile(payload)');
    for (const src of [fnIndex, fnCorpus]) {
      expect(src).not.toMatch(/\.upsert\(/);
      expect(src).not.toMatch(/\.insert\(/);
      expect(src).not.toContain('/storage/v1/object');
    }
  });

  it('the corpus door is the configured one: flag, key, and the retrieve function', () => {
    expect(fnCorpus).toContain('CORPUS_ENABLED');
    expect(fnCorpus).toContain('CORPUS_RETRIEVE_KEY');
    expect(fnCorpus).toContain('functions/v1/corpus-retrieve');
    expect(fnIndex).toContain('corpusEnabled()');
    expect(fnIndex).toContain('buildCorpusQuoteQuery(intake)');
  });

  it('the live search rides the function’s existing Gemini key — no new secret appears', () => {
    expect(fnIndex).toContain('google_search');
    const envReads = fnIndex.match(/Deno\.env\.get\("([A-Z_]+)"\)/g) ?? [];
    const names = new Set(envReads.map((s) => s.replace(/.*\("([A-Z_]+)"\).*/, '$1')));
    // AUDIO_RENDER_KEY joined the set with the audio plan (Nov 13, 2026):
    // the project's existing render secret, reused as the plan's signing
    // key — a configured project secret, not a new one minted for Tailor.
    expect(names).toEqual(
      new Set([
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY',
        'GEMINI_API_KEY',
        'AUDIO_RENDER_KEY',
      ]),
    );
  });
});
