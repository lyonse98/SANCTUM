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
  buildTailorSystemPrompt,
  buildTailorUserPrompt,
  composeTailored,
  parseTailorResult,
  validateIntake,
  type TailorBundle,
} from '../../supabase/functions/tailor-devotional/tailorCore';
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
    expect(intake).toEqual({ state: 'anxious', focus: 'work', freeText: 'Big review at 2.' });
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

const INTAKE = { state: 'anxious' as const, focus: 'work' as const, freeText: 'Big review at 2.' };

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
    expect(composed.media.searchUrl.length).toBeGreaterThan(0);
    expect(composed.media.searchUrl).not.toContain('watch?v=');
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
