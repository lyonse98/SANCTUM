import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BANK,
  BANK_WOMEN,
  BANNED_BANK_PATTERNS,
  BELL_PATH,
  LECTOR_BANK,
  LECTOR_BANK_WOMEN,
  PERSONA_DISPLAY,
  PILGRIM_VOICES,
  TIME_NEUTRAL_LINT,
  assembleScript,
  audioSegmentPath,
  personaHasBell,
  weekdayPersona,
  type AssembleInputs,
  type PersonaId,
  type WomenPersonaId,
} from './narratorCore';
import { audioCacheKey, fetchDailyAudio, parseAudioRow } from './dailyAudio';
import { NARRATOR_DISCLOSURE_LINE_WOMEN, narratorDisclosureLine } from './privacyCopy';

/**
 * The women's company (Charter addendum, Nov 11, 2026) — parity with the men's,
 * pinned the way narratorCore.test.ts pins the brothers: same rotation shape, same
 * bank discipline, same lints, with the tracks provably unable to cross (voice,
 * bank, facet, files, rows).
 */

const MEN: PersonaId[] = ['henry', 'coach', 'frank', 'ben', 'martin', 'tom', 'ed'];
const WOMEN: WomenPersonaId[] = ['ruth', 'dana', 'grace', 'claire', 'marta', 'june', 'rose'];

// The samples' own week: Sun Oct 25 – Sat Oct 31, 2026 (all ferias).
const WEEK: [string, string][] = [
  ['2026-10-25', 'Sunday of the 30th week of Ordinary Time'],
  ['2026-10-26', 'Monday of the 30th week of Ordinary Time'],
  ['2026-10-27', 'Tuesday of the 30th week of Ordinary Time'],
  ['2026-10-28', 'Wednesday of the 30th week of Ordinary Time'],
  ['2026-10-29', 'Thursday of the 30th week of Ordinary Time'],
  ['2026-10-30', 'Friday of the 30th week of Ordinary Time'],
  ['2026-10-31', 'Saturday of the 30th week of Ordinary Time'],
];

function fixture(dateISO: string, celebration: string, audience: 'men' | 'women'): AssembleInputs {
  return {
    dateISO,
    audience,
    celebration,
    gospelCitation: 'Luke 14:1-6',
    gospelText: 'When he went into the house of one of the rulers of the Pharisees on a Sabbath to eat bread, they were watching him.',
    reflect: 'Where are you hiding behind the rules instead of stepping into someone else\u2019s mess to help them?',
    challenge: 'Step toward the person you usually avoid today and offer them real help.',
    facet: audience === 'women' ? 'As a woman' : 'As a man',
    scene: null,
    tomorrowCelebration: 'Saturday of the 30th week of Ordinary Time',
    tomorrowGospelCitation: 'Luke 14:1, 7-11',
  };
}

describe('rotation parity — both companies resolve all seven weekdays', () => {
  it('the weekday map names the full cast per track', () => {
    expect(WEEK.map((_, i) => weekdayPersona('men', i))).toEqual(MEN);
    expect(WEEK.map((_, i) => weekdayPersona('women', i))).toEqual(WOMEN);
  });

  it('assembly resolves each track\u2019s own narrator on her/his weekday', () => {
    WEEK.forEach(([dateISO, celebration], i) => {
      expect(assembleScript(fixture(dateISO, celebration, 'men')).persona).toBe(MEN[i]);
      expect(assembleScript(fixture(dateISO, celebration, 'women')).persona).toBe(WOMEN[i]);
    });
  });

  it('the Lector takes a solemnity on both tracks, with the track\u2019s own Lector bank', () => {
    for (const audience of ['men', 'women'] as const) {
      const s = assembleScript({
        ...fixture('2026-11-01', 'All Saints', audience),
        gospelCitation: 'Matthew 5:1-12',
      });
      expect(s.lector).toBe(true);
      expect(s.persona).toBe('lector');
      expect(s.headAM).toBe('Sunday — and today the Church keeps the Solemnity of All Saints.');
    }
    expect(LECTOR_BANK.voice).toBe('Charon');
    expect(LECTOR_BANK_WOMEN.voice).toBe('Autonoe');
    expect(LECTOR_BANK_WOMEN.frameSolemnity).toBe(LECTOR_BANK.frameSolemnity);
    expect(LECTOR_BANK_WOMEN.challengeHandoff).toBe(LECTOR_BANK.challengeHandoff);
  });

  it('Good Friday: her Night Watch keeps sober gear, teaser suppressed, like his', () => {
    const hers = assembleScript({
      ...fixture('2026-04-03', "Good Friday of the Lord's Passion", 'women'),
      gospelCitation: 'John 18:1—19:42',
    });
    expect(hers.persona).toBe('june');
    expect(hers.sober).toBe(true);
    expect(hers.teaserIncluded).toBe(false);
  });

  it('All Souls: the weekday sister reads the commemoration frame', () => {
    const s = assembleScript({ ...fixture('2026-11-02', 'All Souls', 'women'), gospelCitation: 'John 6:37-40' });
    expect(s.lector).toBe(false);
    expect(s.persona).toBe('dana');
    expect(s.headAM).toContain('Monday — today is All Souls, the Commemoration of All the Faithful Departed.');
  });

  it('the Pilgrims are cast on both tracks — named, displayed, voiced', () => {
    expect(PERSONA_DISPLAY.will.displayName).toBe('Will, the Pilgrim');
    expect(PERSONA_DISPLAY.willa.displayName).toBe('Willa, the Pilgrim');
    expect(PILGRIM_VOICES).toEqual({ men: 'Umbriel', women: 'Leda' });
  });
});

describe('voice parity — the cast table, unique within and across tracks', () => {
  const DESCRIPTORS: Record<WomenPersonaId, string> = {
    ruth: 'Mature',
    dana: 'Firm',
    grace: 'Forward',
    claire: 'Clear',
    marta: 'Smooth',
    june: 'Warm',
    rose: 'Easy-going',
  };

  it('the women\u2019s voices are Erik\u2019s cast, in weekday order', () => {
    expect(WOMEN.map((id) => BANK_WOMEN[id].voice)).toEqual([
      'Gacrux', 'Kore', 'Pulcherrima', 'Erinome', 'Despina', 'Sulafat', 'Callirrhoe',
    ]);
  });

  it('no voice repeats within the women\u2019s week, and no adjacent days are near-twins', () => {
    const voices = WOMEN.map((id) => BANK_WOMEN[id].voice);
    expect(new Set(voices).size).toBe(7);
    const descriptors = WOMEN.map((id) => DESCRIPTORS[id]);
    expect(new Set(descriptors).size).toBe(7);
    for (let i = 0; i < 7; i++) {
      // Adjacent in the rotation, including the Saturday → Sunday wrap.
      expect(descriptors[i]).not.toBe(descriptors[(i + 1) % 7]);
      expect(voices[i]).not.toBe(voices[(i + 1) % 7]);
    }
  });

  it('no voice is shared across the two companies, and Puck is nowhere', () => {
    const mensVoices = [...MEN.map((id) => BANK[id].voice), LECTOR_BANK.voice, PILGRIM_VOICES.men];
    const womensVoices = [...WOMEN.map((id) => BANK_WOMEN[id].voice), LECTOR_BANK_WOMEN.voice, PILGRIM_VOICES.women];
    for (const v of womensVoices) expect(mensVoices).not.toContain(v);
    expect([...mensVoices, ...womensVoices]).not.toContain('Puck');
  });

  it('render profiles mirror the counterparts: her Elder slowest, her Coach brisk, her Sister the default', () => {
    expect(BANK_WOMEN.ruth.tempo).toBe(BANK.henry.tempo); // Guide profile
    expect(BANK_WOMEN.dana.tempo).toBe(BANK.coach.tempo); // Brief profile
    expect(BANK_WOMEN.claire.tempo).toBe(BANK.ben.tempo); // the default register
    expect(BANK_WOMEN.marta.tempo).toBe(BANK.martin.tempo);
    expect(BANK_WOMEN.june.tempo).toBe(BANK.tom.tempo);
    expect(BANK_WOMEN.rose.tempo).toBe(BANK.ed.tempo);
  });
});

describe('women\u2019s bank integrity — the same discipline as the men\u2019s (§10.1)', () => {
  it('every sister carries the full slot set, with her own canonical sign-on and sign-off first', () => {
    // Her canonical lines are HER OWN (Nov 13, 2026): the sheets as first built
    // carried the brothers' canonical lines verbatim — Ruth spoke Henry's, Dana
    // Coach's, Marta Martin's, June Tom's, Rose Ed's — and the borrowed lines
    // were replaced throughout the bank. The one line both companies still
    // share is deliberate: the brand sign-off the charter assigns to the peer
    // of each company (Ben and Claire alike).
    const canonical: Record<WomenPersonaId, [string, string]> = {
      ruth: ["Well. Sixty years I've been hearing these words, and they still find me. Listen.", "Same time tomorrow. I'll be here — and so will He."],
      dana: ["Gospel first. Then we take on the week. Let's go.", 'Now get out there and live it.'],
      grace: ['Alright. First things first.', 'Now go do the next right thing.'],
      claire: ["Morning, sister. Let's start where we always start.", 'Pray first. Then fight.'],
      marta: ["The hour is here, and it's His. Let's keep it.", 'Keep the rhythm — He keeps you.'],
      june: ["Still up? You're not the only one awake.", 'He keeps the watch with you. Rest when you can.'],
      rose: ["Morning. Coffee's on — come sit a minute.", "I'll be right here tomorrow."],
    };
    for (const id of WOMEN) {
      const bank = BANK_WOMEN[id];
      expect(bank.signOnsAM.length, `${id} signOnsAM`).toBeGreaterThanOrEqual(3);
      expect(bank.signOnsPM.length, `${id} signOnsPM`).toBeGreaterThanOrEqual(2);
      expect(bank.signOffs.length, `${id} signOffs`).toBeGreaterThanOrEqual(2);
      expect(bank.sceneLeadIns.length, `${id} sceneLeadIns`).toBeGreaterThanOrEqual(2);
      expect(bank.teaserTemplates.length, `${id} teaserTemplates`).toBeGreaterThanOrEqual(2);
      expect(bank.soberSignOnsAM.length, `${id} soberAM`).toBeGreaterThanOrEqual(1);
      expect(bank.soberSignOnsPM.length, `${id} soberPM`).toBeGreaterThanOrEqual(1);
      // The facet is never spoken: the hand-off names no "as a woman" (Nov 13, 2026).
      expect(bank.challengeHandoff).not.toContain('{facetLower}');
      expect(bank.challengeHandoff).not.toMatch(/as a (man|woman)/i);
      // Her sheet's canonical sign-on is in the day's sets (AM or PM — June's is a
      // PM line by sheet, Grace's an AM one, exactly as Tom's and Frank's split).
      const [signOn, signOff] = canonical[id];
      expect([...bank.signOnsAM, ...bank.signOnsPM], `${id} canonical sign-on`).toContain(signOn);
      expect(bank.signOffs[0]).toBe(signOff);
    }
  });

  it('AM and PM sign-on sets differ for every sister', () => {
    for (const id of WOMEN) {
      const am = new Set(BANK_WOMEN[id].signOnsAM);
      const pm = new Set(BANK_WOMEN[id].signOnsPM);
      const same = am.size === pm.size && [...am].every((l) => pm.has(l));
      expect(same, id).toBe(false);
    }
  });

  it('no women\u2019s bank line carries a Charter banned shape', () => {
    const everyLine: string[] = [];
    for (const id of WOMEN) {
      const b = BANK_WOMEN[id];
      everyLine.push(
        ...b.signOnsAM, ...b.signOnsPM, ...b.signOffs, ...b.sceneLeadIns,
        ...b.teaserTemplates, ...b.soberSignOnsAM, ...b.soberSignOnsPM,
        b.frameFeriaAM, b.frameFeriaPM, b.frameMemorialAM, b.frameMemorialPM,
        b.soberFrame, b.reflectionHandoff, b.challengeHandoff,
      );
    }
    everyLine.push(LECTOR_BANK_WOMEN.frameSolemnity, LECTOR_BANK_WOMEN.reflectionHandoff, LECTOR_BANK_WOMEN.challengeHandoff);
    for (const line of everyLine) {
      for (const pattern of BANNED_BANK_PATTERNS) {
        expect(pattern.test(line), `"${line}" vs ${pattern}`).toBe(false);
      }
    }
  });

  it('her main segments are time-neutral with NO exceptions (June gets no Tom-style carve-out)', () => {
    for (const id of WOMEN) {
      const b = BANK_WOMEN[id];
      const mainSlotLines = [...b.signOffs, ...b.teaserTemplates, ...b.sceneLeadIns, b.reflectionHandoff, b.challengeHandoff];
      for (const line of mainSlotLines) {
        const lower = line.toLowerCase();
        for (const word of TIME_NEUTRAL_LINT) {
          expect(lower.includes(word), `${id}: "${line}" vs "${word}"`).toBe(false);
        }
      }
    }
  });

  it('her heads carry no raw digits', () => {
    WEEK.forEach(([dateISO, celebration], i) => {
      const s = assembleScript(fixture(dateISO, celebration, 'women'));
      expect(s.persona).toBe(WOMEN[i]);
      expect(/\d/.test(s.headAM), WOMEN[i]).toBe(false);
      expect(/\d/.test(s.headPM), WOMEN[i]).toBe(false);
    });
  });
});

describe('her script — Zone 1 verbatim, her brand line, no spoken facet', () => {
  it('Claire\u2019s Wednesday carries the Gospel byte-for-byte and hands off without speaking her facet', () => {
    const input = fixture('2026-10-28', 'Wednesday of the 30th week of Ordinary Time', 'women');
    const s = assembleScript(input);
    expect(s.persona).toBe('claire');
    expect(s.script).toContain(input.gospelText);
    expect(s.script).toContain(input.reflect);
    expect(s.script).toContain(input.challenge);
    // The hand-off is spoken plainly; the facet lives in the reflection text
    // and the UI, never in the narrator's mouth (Nov 13, 2026).
    expect(s.mainB).toContain("And today's challenge.");
    expect(s.mainB).not.toContain('as a woman');
    expect(s.mainB).not.toContain('as a man');
    expect(BANK_WOMEN.claire.signOffs).toContain('Pray first. Then fight.');
  });

  it('the same day in the men\u2019s track likewise speaks no facet', () => {
    const his = assembleScript(fixture('2026-10-28', 'Wednesday of the 30th week of Ordinary Time', 'men'));
    expect(his.mainB).toContain("And today's challenge.");
    expect(his.mainB).not.toContain('as a man');
    expect(his.mainB).not.toContain('as a woman');
  });
});

describe('the Nov 13, 2026 borrow purge — her lines are hers, pinned', () => {
  // The ONE string the two companies share on purpose: the brand sign-off the
  // charter assigns to the peer of each company. It is exempt from the purge
  // by design; every other sign-on/sign-off must be track-original.
  const BRAND_SIGN_OFF = 'Pray first. Then fight.';

  it('no women’s sign-on or sign-off string-equals any men’s entry', () => {
    const mensLines = new Set<string>();
    for (const id of MEN) {
      const b = BANK[id];
      for (const line of [...b.signOnsAM, ...b.signOnsPM, ...b.signOffs, ...b.soberSignOnsAM, ...b.soberSignOnsPM]) {
        mensLines.add(line);
      }
    }
    mensLines.delete(BRAND_SIGN_OFF);
    for (const id of WOMEN) {
      const b = BANK_WOMEN[id];
      const hers = [...b.signOnsAM, ...b.signOnsPM, ...b.signOffs, ...b.soberSignOnsAM, ...b.soberSignOnsPM];
      for (const line of hers) {
        if (line === BRAND_SIGN_OFF) continue;
        expect(mensLines.has(line), `${id}: "${line}"`).toBe(false);
      }
    }
    // And the brand line itself really is carried by both Wednesday peers.
    expect(BANK.ben.signOffs).toContain(BRAND_SIGN_OFF);
    expect(BANK_WOMEN.claire.signOffs).toContain(BRAND_SIGN_OFF);
  });

  it('the whole sample week, both tracks: no assembled script speaks a facet in the hand-off', () => {
    WEEK.forEach(([dateISO, celebration]) => {
      for (const audience of ['men', 'women'] as const) {
        const s = assembleScript(fixture(dateISO, celebration, audience));
        expect(s.mainB, `${dateISO}/${audience}`).not.toContain('as a man');
        expect(s.mainB, `${dateISO}/${audience}`).not.toContain('as a woman');
        const bank = audience === 'women' ? BANK_WOMEN[s.persona as WomenPersonaId] : BANK[s.persona as PersonaId];
        expect(s.mainB, `${dateISO}/${audience}`).toContain(bank.challengeHandoff);
      }
    });
  });
});

describe('the bell — one sound, two Keepers', () => {
  it('only Martin and Marta carry it', () => {
    expect(personaHasBell('martin')).toBe(true);
    expect(personaHasBell('marta')).toBe(true);
    for (const id of [...MEN, ...WOMEN, 'lector']) {
      if (id === 'martin' || id === 'marta') continue;
      expect(personaHasBell(id), id).toBe(false);
    }
  });

  it('both point at the one shared bell object — there is no second bell file', () => {
    expect(BELL_PATH).toBe('static/martin-bell.mp3');
  });
});

describe('storage keys — the tracks can never collide', () => {
  it('the same date and segment give different paths per audience', () => {
    for (const segment of ['head-am', 'head-pm', 'main'] as const) {
      const his = audioSegmentPath('2026-11-05', 'men', segment);
      const hers = audioSegmentPath('2026-11-05', 'women', segment);
      expect(his).not.toBe(hers);
    }
    expect(audioSegmentPath('2026-11-05', 'men', 'main')).toBe('2026-11-05/men/main.mp3');
    expect(audioSegmentPath('2026-11-05', 'women', 'main')).toBe('2026-11-05/women/main.mp3');
    expect(audioSegmentPath('2026-11-05', 'women', 'head-am')).toBe('2026-11-05/women/head-am.mp3');
  });
});

describe('her row, her bar — the client fetch is audience-keyed end to end', () => {
  const URL_BASE = 'https://example.supabase.co';
  const WOMENS_ROW = {
    date: '2026-11-05',
    audience: 'women',
    persona: 'marta',
    status: 'ready',
    head_am_path: '2026-11-05/women/head-am.mp3',
    head_pm_path: '2026-11-05/women/head-pm.mp3',
    main_path: '2026-11-05/women/main.mp3',
    head_am_seconds: 13.5,
    head_pm_seconds: 14.0,
    main_seconds: 121.2,
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('a women\u2019s row parses as hers — Marta valid, audience carried through', () => {
    const audio = parseAudioRow(WOMENS_ROW, URL_BASE);
    expect(audio?.audience).toBe('women');
    expect(audio?.persona).toBe('marta');
    expect(audio?.mainUrl).toBe(`${URL_BASE}/storage/v1/object/public/daily-audio/2026-11-05/women/main.mp3`);
    expect(audio?.bellUrl).toBe(`${URL_BASE}/storage/v1/object/public/daily-audio/${BELL_PATH}`);
  });

  it('cache keys split by track; men\u2019s keeps the original key', () => {
    expect(audioCacheKey('2026-11-05', 'men')).toBe('sanctum_audio_2026-11-05');
    expect(audioCacheKey('2026-11-05', 'women')).toBe('sanctum_audio_women_2026-11-05');
  });

  it('fetchDailyAudio asks the server for her row only, and serves it', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', URL_BASE);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => [WOMENS_ROW] };
    });
    const audio = await fetchDailyAudio('2026-11-05', 'women');
    expect(urls[0]).toContain('audience=eq.women');
    expect(audio?.persona).toBe('marta');
    expect(audio?.audience).toBe('women');
  });

  it('her missing row never falls back to his: a men\u2019s row served to a women\u2019s query is refused', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', URL_BASE);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    const mensRow = { ...WOMENS_ROW, audience: 'men', persona: 'martin', main_path: '2026-11-05/men/main.mp3' };
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => [mensRow] }));
    const audio = await fetchDailyAudio('2026-11-05', 'women');
    expect(audio).toBeNull();
  });
});

describe('the surfaces — her card, her disclosure, no written-only note', () => {
  const SRC = join(__dirname, '..');
  const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

  it('the Gospel card renders the ListenBar for both tracks, keyed by audience', () => {
    const card = read('components/DailyQuote.tsx');
    expect(card).toContain('audience={audience}');
    expect(card).not.toContain("audience === 'women' ? (");
  });

  it('the written-only note is gone from every surface', () => {
    for (const rel of ['components/DailyQuote.tsx', 'components/AboutSanctumPage.tsx', 'components/TermsPage.tsx', 'lib/privacyCopy.ts']) {
      expect(read(rel), rel).not.toContain('WOMENS_AUDIO_NOTE');
      expect(read(rel), rel).not.toContain('not yet available in Women');
    }
  });

  it('her disclosure line is the sisters line, selected per track', () => {
    expect(NARRATOR_DISCLOSURE_LINE_WOMEN).toContain('the sisters reading next to you');
    expect(NARRATOR_DISCLOSURE_LINE_WOMEN).toContain('least of all religious sisters or priests');
    expect(narratorDisclosureLine('women')).toBe(NARRATOR_DISCLOSURE_LINE_WOMEN);
    expect(narratorDisclosureLine('men')).toContain('the brothers reading next to you');
    expect(read('components/ListenBar.tsx')).toContain('narratorDisclosureLine(audience)');
  });
});
