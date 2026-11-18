import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PARISH_PATRON_KEY,
  loadParishPatron,
  parishPatronFeastOn,
  saveParishPatron,
} from './parishPatron';
import { getDailyVisual } from './liturgicalVisuals';
import { SAINTS } from '@/data/saints';
import { COME_HOME_DAYS } from '@/data/comeHome';
import {
  COME_HOME_KEY,
  COME_HOME_URL,
  comeHomeDayIndex,
  isComeHomeArrival,
} from './comeHome';
import { seasonHelpSectionIds, seasonHelpSections } from './seasonHelp';
import { SEASONS_OF_LIFE } from './tailorProfile';
import { massNudgeFor } from './massNudge';
import type { UsualMass } from './usualMass';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

/** Minimal Storage whose keys are own enumerable properties, like the browser's. */
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
});

/**
 * The pre-parish batch (Erik, Nov 18, 2026): four features in their
 * personal, pre-parish forms — the parish's patron in the calendar, the
 * come-home door, season-of-life → Real Help, and the pre-Mass nudge.
 * All client-only; every key under the sanctum_ prefix (the wipe suite's
 * KNOWN_KEYS carries both new ones).
 */
describe('feature 1 — my parish’s patron', () => {
  const therese = SAINTS.find((s) => s.name === 'St. Thérèse of Lisieux')!;

  it('the key stands under the sanctum_ prefix and the pick round-trips', () => {
    expect(PARISH_PATRON_KEY).toBe('sanctum_parish_patron');
    expect(loadParishPatron()).toBeNull();
    saveParishPatron(therese);
    expect(loadParishPatron()?.name).toBe('St. Thérèse of Lisieux');
    saveParishPatron(null);
    expect(loadParishPatron()).toBeNull();
  });

  it('a stored name the shelf does not carry resolves to no patron', () => {
    localStorage.setItem('sanctum_parish_patron', JSON.stringify({ name: 'St. Nobody', feastDate: '01-01' }));
    expect(loadParishPatron()).toBeNull();
  });

  it('the feast check is the saint’s own MM-DD — and distinct from the year’s patron key', () => {
    expect(parishPatronFeastOn(new Date(2026, 9, 1), therese)?.name).toBe(therese.name);
    expect(parishPatronFeastOn(new Date(2026, 9, 2), therese)).toBeNull();
    expect(parishPatronFeastOn(new Date(2026, 9, 1), null)).toBeNull();
    saveParishPatron(therese);
    expect(localStorage.getItem('sanctum_patron_saint')).toBeNull();
  });

  it('calendar supremacy: the pick never moves the day’s visual', () => {
    const feastDay = new Date(2026, 9, 1); // October 1 — Thérèse's feast
    const unset = getDailyVisual(feastDay);
    saveParishPatron(therese);
    expect(getDailyVisual(feastDay)).toEqual(unset);
    const store = readSrc('lib/parishPatron.ts');
    expect(store).not.toContain('liturgicalVisuals');
    expect(store).not.toContain('getDailyVisual');
  });

  it('the marker, the plate, and the Settings card stand where the feature puts them', () => {
    const hero = readSrc('components/TodayHero.tsx');
    expect(hero).toContain('data-parish-patron-feast');
    expect(hero).toContain('Your parish&rsquo;s patron');
    expect(hero).toContain('parishPatronFeastOn(contentDate())');
    const home = readSrc('components/HomeScreen.tsx');
    expect(home).toContain('data-parish-patron-plate');
    expect(home).toContain('eyebrow="Your parish\'s patron"');
    const settings = readSrc('components/SettingsModal.tsx');
    expect(settings).toContain('Your Parish&rsquo;s Patron');
    expect(settings).toContain('saveParishPatron');
    // The parish name is context only — read from My usual Mass, never duplicated into this store.
    expect(settings).toContain('Your parish, from My Usual Mass below');
    expect(readSrc('lib/parishPatron.ts')).not.toContain('usualMass');
  });
});

describe('feature 2 — the come-home door', () => {
  it('the link is one bare URL, identical for everyone', () => {
    expect(COME_HOME_URL).toBe('https://sanctumdaily.app/?comehome=1');
    expect(isComeHomeArrival('?comehome=1')).toBe(true);
    expect(isComeHomeArrival('?comehome=1&focus=gospel')).toBe(true);
    expect(isComeHomeArrival('?focus=gospel')).toBe(false);
    expect(isComeHomeArrival('')).toBe(false);
  });

  it('seven days of welcome — each short, Scripture-anchored, and ending toward Sunday', () => {
    expect(COME_HOME_DAYS).toHaveLength(7);
    for (const day of COME_HOME_DAYS) {
      const words = day.body.split(/\s+/).length;
      expect(words, day.title).toBeGreaterThanOrEqual(60);
      expect(words, day.title).toBeLessThanOrEqual(110);
      expect(day.scripture.length).toBeGreaterThan(0);
      expect(day.citation.length).toBeGreaterThan(0);
      expect(day.body).toMatch(/Sunday|Mass/);
      // No guilt, no pressure, no absence language.
      const lower = day.body.toLowerCase();
      for (const banned of ['your absence', 'while you were gone', 'where have you been', 'you left', 'ashamed', 'streak', 'guilt']) {
        expect(lower, `${day.title} / ${banned}`).not.toContain(banned);
      }
    }
  });

  it('the arc keys to days since first open, on this device only, and rests at day seven', () => {
    expect(COME_HOME_KEY.startsWith('sanctum_')).toBe(true);
    const open = new Date(2026, 10, 18, 12, 0); // Wed Nov 18, 2026, midday
    expect(comeHomeDayIndex(open)).toBe(0);
    expect(JSON.parse(localStorage.getItem(COME_HOME_KEY)!).firstOpen).toBe('2026-11-18');
    expect(comeHomeDayIndex(new Date(2026, 10, 19, 9, 0))).toBe(1);
    expect(comeHomeDayIndex(new Date(2026, 10, 24, 9, 0))).toBe(6);
    expect(comeHomeDayIndex(new Date(2026, 11, 25, 9, 0))).toBe(6);
  });

  it('privacy pins: no analytics, no tally, no network, no sender state', () => {
    const page = readSrc('components/ComeHomePage.tsx');
    expect(page).not.toContain("from '@/lib/analytics'");
    expect(page).not.toContain('track(');
    expect(page).not.toContain('trackNow');
    expect(page).not.toContain('recordCoreAct');
    expect(page).toContain('<CrisisLine');
    expect(page).toContain('data-come-home-gospel');
    expect(page).toContain('fetchReadingsBundle');
    const lib = readSrc('lib/comeHome.ts');
    expect(lib).not.toContain('fetch(');
    // The sender side holds no state either: the sheet only ever offers the bare URL.
    const sheet = readSrc('components/BringSomeoneHome.tsx');
    expect(sheet).toContain('COME_HOME_URL');
    expect(sheet).toContain('never learns who you sent it to');
    expect(sheet).not.toContain('localStorage');
  });

  it('the surface stands before the gate, and the sender entry stands in More of Sanctum', () => {
    const app = readSrc('App.tsx');
    expect(app).toContain('isComeHomeArrival(window.location.search)');
    expect(app.indexOf('if (comeHomeActive)')).toBeLessThan(app.indexOf('if (!termsAccepted)'));
    const more = readSrc('components/MoreOfSanctum.tsx');
    expect(more).toContain('data-bring-someone-home');
    expect(more).toContain('Bring someone home');
    const home = readSrc('components/HomeScreen.tsx');
    expect(home).toContain('<BringSomeoneHome');
    expect(home).toContain('onBringSomeoneHome={() => setComeHomeSheetOpen(true)}');
  });
});

describe('feature 3 — season of life → Real Help', () => {
  it('every season in both vocabularies maps somewhere', () => {
    for (const audience of ['men', 'women'] as const) {
      for (const season of SEASONS_OF_LIFE[audience]) {
        expect(seasonHelpSectionIds(audience, season.id).length, `${audience}/${season.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('the map reads sensibly, and the group door is the track’s own', () => {
    expect(seasonHelpSectionIds('men', 'widowed')).toEqual(['therapist', 'director']);
    expect(seasonHelpSectionIds('men', 'father-young')).toEqual(['mens-group', 'marriage']);
    expect(seasonHelpSectionIds('women', 'mother-young')).toEqual(['therapist', 'womens-group']);
    expect(seasonHelpSectionIds('women', 'expecting')).toEqual(['therapist', 'womens-group']);
    expect(seasonHelpSectionIds('men', 'divorced-separated')).toEqual(['marriage', 'therapist', 'confession']);
    expect(seasonHelpSectionIds('men', null)).toEqual([]);
    expect(seasonHelpSectionIds('men', 'not-a-season')).toEqual([]);
  });

  it('resolves against the stored profile; no season, no plate', () => {
    expect(seasonHelpSections('men')).toEqual([]);
    localStorage.setItem('sanctum_tailor_profile_men', JSON.stringify({ seasonOfLife: 'widowed' }));
    expect(seasonHelpSections('men').map((s) => s.id)).toEqual(['therapist', 'director']);
    localStorage.setItem('sanctum_tailor_profile_women', JSON.stringify({ seasonOfLife: 'expecting' }));
    expect(seasonHelpSections('women').map((s) => s.id)).toEqual(['therapist', 'womens-group']);
  });

  it('the plate stands on Real Help, after the crisis card, the full list untouched below', () => {
    const help = readSrc('components/FindHelpPage.tsx');
    expect(help).toContain('data-season-help');
    expect(help).toContain('For this season');
    expect(help).toContain('seasonHelpSections(audience)');
    expect(help.indexOf('<CrisisCard')).toBeLessThan(help.indexOf('data-season-help'));
    expect(help.indexOf('data-season-help')).toBeLessThan(help.indexOf('sections.map'));
  });
});

describe('feature 4 — the pre-Mass nudge', () => {
  const sundayMass: UsualMass = { parish: 'St. Brigid', time: '09:30', day: 'sunday' };
  const vigilMass: UsualMass = { parish: 'St. Brigid', time: '17:30', day: 'saturday' };
  // Sun Nov 22, 2026 / Sat Nov 21, 2026 / Fri Nov 20, 2026.
  const sun = (h: number, m = 0) => new Date(2026, 10, 22, h, m);
  const sat = (h: number, m = 0) => new Date(2026, 10, 21, h, m);
  const fri = (h: number, m = 0) => new Date(2026, 10, 20, h, m);

  it('stands on the Mass day while the hour is ahead — and only then', () => {
    expect(massNudgeFor(sun(8), sundayMass)).toEqual({ parish: 'St. Brigid', time: '09:30' });
    expect(massNudgeFor(sun(9, 29), sundayMass)).not.toBeNull();
    expect(massNudgeFor(sun(9, 30), sundayMass)).toBeNull();
    expect(massNudgeFor(sun(11), sundayMass)).toBeNull();
    expect(massNudgeFor(sat(8), sundayMass)).toBeNull();
    expect(massNudgeFor(fri(8), sundayMass)).toBeNull();
  });

  it('the vigil reader is nudged on Saturday, not Sunday', () => {
    expect(massNudgeFor(sat(16), vigilMass)).toEqual({ parish: 'St. Brigid', time: '17:30' });
    expect(massNudgeFor(sat(18), vigilMass)).toBeNull();
    expect(massNudgeFor(sun(8), vigilMass)).toBeNull();
  });

  it('the day is the content day: the small hours still belong to yesterday', () => {
    // Sunday 02:00 is still Saturday's content day — no Sunday nudge yet.
    expect(massNudgeFor(sun(2), sundayMass)).toBeNull();
    // Saturday 02:00 is still Friday's content day — no vigil nudge yet.
    expect(massNudgeFor(sat(2), vigilMass)).toBeNull();
  });

  it('unset is silent, and the nudge keeps no record of anything', () => {
    expect(massNudgeFor(sun(8), null)).toBeNull();
    const lib = readSrc('lib/massNudge.ts');
    expect(lib).not.toContain('localStorage.setItem');
    expect(lib).not.toContain('track(');
    const home = readSrc('components/HomeScreen.tsx');
    expect(home).toContain('data-mass-nudge');
    expect(home).toContain('massNudgeFor(new Date())');
    expect(home).toContain('Mass today &mdash; {formatMassTime(massNudge.time)} at {massNudge.parish}');
    expect(home.indexOf('data-mass-nudge')).toBeLessThan(home.indexOf('<DailyQuote'));
  });
});
