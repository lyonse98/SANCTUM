import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PASSAGES_BY_FOCUS,
  PASSAGES_BY_STATE,
  MEDIA_BY_FOCUS,
  TAILOR_FOCUSES,
  TAILOR_STATES,
  mediaSearchUrl,
  pickMedia,
  pickPassage,
} from '@/data/tailorBank';
import {
  buildCorpusQuoteQuery,
  buildMediaSearchQuery,
  buildTailorSystemPrompt,
  buildTailorUserPrompt,
  composeTailored,
  mediaWhyLine,
  parseTailorResult,
  pickGroundedMedia,
  pickTraditionQuote,
  validateIntake,
  validateProfile,
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

describe('the media bank is real works behind search URLs only', () => {
  it('every focus carries at least one pick, and the bank spans all four types', () => {
    const types = new Set<string>();
    for (const focus of TAILOR_FOCUSES) {
      const bank = MEDIA_BY_FOCUS[focus.id];
      expect(bank.length).toBeGreaterThanOrEqual(1);
      for (const m of bank) {
        types.add(m.type);
        expect(m.title.length).toBeGreaterThan(0);
        expect(m.creator.length).toBeGreaterThan(0);
      }
    }
    expect(types).toEqual(new Set(['song', 'film', 'podcast', 'talk']));
  });

  it('every pick URL is a search URL — no watch page, no video id, no embed', () => {
    for (const focus of TAILOR_FOCUSES) {
      for (const date of DATES) {
        const url = mediaSearchUrl(pickMedia(focus.id, date));
        expect(url).not.toContain('watch?v=');
        expect(url).not.toContain('/embed/');
        expect(url).not.toMatch(/[?&]v=[A-Za-z0-9_-]{11}/);
        expect(
          url.startsWith('https://www.youtube.com/results?search_query=') ||
            url.startsWith('https://open.spotify.com/search/') ||
            url.startsWith('https://www.google.com/search?q='),
        ).toBe(true);
      }
    }
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
    // The media pick rides along with a search URL.
    expect(composed.media.url.length).toBeGreaterThan(0);
    expect(composed.media.url).not.toContain('watch?v=');
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
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain('SENTINEL');
    expect(queries[0]).not.toContain('review');
    expect(queries[0]).not.toContain('patient');
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
            text: '{"title": "Be Not Afraid", "creator": "Bob Dufford", "kind": "song", "url": "https://www.youtube.com/watch?v=abc123XYZ"}',
          },
        ],
      },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://www.youtube.com/watch?v=abc123XYZ', title: 'Be Not Afraid — YouTube' } },
          { web: { uri: 'https://en.wikipedia.org/wiki/Be_Not_Afraid', title: 'Be Not Afraid — Wikipedia' } },
        ],
      },
    },
  ],
};

describe('v2 — grounded media: the address must come from the search’s own sources', () => {
  it('accepts a pick whose URL is verbatim among the grounding sources', () => {
    const pick = pickGroundedMedia(GROUNDED_OK, ['song', 'video', 'talk', 'podcast', 'article', 'book']);
    expect(pick).toEqual({
      kind: 'song',
      title: 'Be Not Afraid',
      creator: 'Bob Dufford',
      url: 'https://www.youtube.com/watch?v=abc123XYZ',
    });
  });

  it('rejects a URL the model composed — not among the grounding sources', () => {
    const forged = structuredClone(GROUNDED_OK);
    forged.candidates[0].content.parts[0].text =
      '{"title": "Be Not Afraid", "creator": "Bob Dufford", "kind": "song", "url": "https://www.youtube.com/watch?v=INVENTED1"}';
    expect(pickGroundedMedia(forged, ['song'])).toBeNull();
  });

  it('rejects a search page even when it is among the sources', () => {
    const searchy = structuredClone(GROUNDED_OK);
    searchy.candidates[0].groundingMetadata.groundingChunks.push({
      web: { uri: 'https://www.youtube.com/results?search_query=be+not+afraid', title: 'Search' },
    });
    searchy.candidates[0].content.parts[0].text =
      '{"title": "Results", "creator": "YouTube", "kind": "video", "url": "https://www.youtube.com/results?search_query=be+not+afraid"}';
    expect(pickGroundedMedia(searchy, ['video'])).toBeNull();
  });

  it('rejects a kind the morning did not allow, and non-https addresses', () => {
    expect(pickGroundedMedia(GROUNDED_OK, ['article', 'book'])).toBeNull();
    const http = structuredClone(GROUNDED_OK);
    http.candidates[0].groundingMetadata.groundingChunks[0].web.uri = 'http://www.youtube.com/watch?v=abc123XYZ';
    http.candidates[0].content.parts[0].text =
      '{"title": "Be Not Afraid", "creator": "Bob Dufford", "kind": "song", "url": "http://www.youtube.com/watch?v=abc123XYZ"}';
    expect(pickGroundedMedia(http, ['song'])).toBeNull();
  });

  it('rejects empty answers and missing grounding entirely', () => {
    expect(pickGroundedMedia(null, ['song'])).toBeNull();
    expect(pickGroundedMedia({}, ['song'])).toBeNull();
    expect(pickGroundedMedia({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }, ['song'])).toBeNull();
  });

  it('a build with a grounded answer uses it; the why-line is categories only', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored: async () => ({ reflect: 'A tailored reflection here.', challenge: 'One act.' }),
      findMedia: async () => GROUNDED_OK,
      hour: 7,
    });
    expect(composed.media.kind).toBe('song');
    expect(composed.media.url).toBe('https://www.youtube.com/watch?v=abc123XYZ');
    expect(composed.media.why).toBe(mediaWhyLine('work', 'courage'));
    expect(composed.media.why).not.toContain('review');
  });

  it('any search failure falls back to the curated bank, search URL and all', async () => {
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
      expect(composed.media.url).toMatch(
        /^https:\/\/(www\.youtube\.com\/results\?search_query=|open\.spotify\.com\/search\/|www\.google\.com\/search\?q=)/,
      );
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
    expect(composed.media.url).not.toBe('https://www.youtube.com/watch?v=abc123XYZ');
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
    expect(names).toEqual(
      new Set(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'GEMINI_API_KEY']),
    );
  });
});
