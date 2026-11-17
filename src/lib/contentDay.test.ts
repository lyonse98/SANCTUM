import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentNow } from './dayBoundary';
import { loadTonightResolve, morningResolve, saveTonightResolve } from './tonight';

/**
 * Play 7 (retention build, Nov 16, 2026): the Today / Tonight / Tailor
 * experience derives "today" from the content day — the day that flips at
 * 04:00, not at midnight. These pins guard the adoption sites, so a later
 * edit cannot quietly hand a surface back to the calendar day: at 01:30
 * the Gospel, reflection, audio, Tailor package, Tonight closing and theme
 * on screen are still yesterday's, and Tonight stays reachable — that is
 * the carry-over. Source pins follow the house style of wednesdayFixes.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const home = readSrc('components/HomeScreen.tsx');
const tonightClosing = readSrc('components/TonightClosing.tsx');
const app = readSrc('App.tsx');
const dailyQuote = readSrc('components/DailyQuote.tsx');
const listenBar = readSrc('components/ListenBar.tsx');
const todayHero = readSrc('components/TodayHero.tsx');
const seasonBadge = readSrc('components/SeasonBadge.tsx');

describe('Play 7 — the content day is the day on Today', () => {
  it('the readings bundle and its direct fallback are fetched for the content day', () => {
    expect(dailyQuote).toContain('fetchReadingsBundle(contentDate())');
    expect(dailyQuote).toContain('fetchDailyReadings(contentDate())');
  });

  it('the reflection fetch keys off the content day', () => {
    expect(dailyQuote).toContain('useState(() => contentDateKey())');
  });

  it('the fallback quote and the feast are the content day\u2019s', () => {
    expect(dailyQuote).toContain('quoteForDay(contentDate(), audience)');
    expect(dailyQuote).toContain('getFeastForDate(contentDate())');
  });

  it('the daily audio head is chosen on the content day\u2019s clock', () => {
    expect(listenBar).toContain('contentHeadHour(new Date())');
    expect(listenBar).toContain('hour < DAY_START_HOUR ? hour + 24 : hour');
  });

  it('the masthead names the content day — season, visual, feast, Sunday', () => {
    expect(todayHero).toContain('getCurrentSeason(contentDate())');
    expect(todayHero).toContain('getDailyVisual(contentDate())');
    expect(todayHero).toContain('getFeastArt(contentDate(), audience)');
    expect(todayHero).toContain('contentDate().getDay() === 0');
    expect(seasonBadge).toContain('getCurrentSeason(contentDate())');
    expect(seasonBadge).toContain('getDailyVisual(contentDate())');
  });

  it('the App season theme flips with the content day', () => {
    expect(app).toContain('getSeasonTheme(contentDate(), audience)');
    expect(app).toContain('getCurrentSeason(contentDate())');
    expect(app).toContain('getSeasonAccentColor(contentDate())');
    expect(home).toContain('getSeasonTheme(contentDate(), audience)');
  });
});

describe('Play 7 — Tonight carry-over in the small hours', () => {
  it('HomeScreen keeps Tonight up before 04:00 and keys the morning resolve to the content day', () => {
    expect(home).toContain('nowHour >= AUDIO_PM_START_HOUR || nowHour < DAY_START_HOUR');
    expect(home).toContain('morningResolve(contentNow())');
  });

  it('TonightClosing derives its whole day — reflection, Tailor meta, resolve — from the content day', () => {
    expect(tonightClosing).toContain('contentDateKey(now)');
    expect(tonightClosing).toContain('saveTonightResolve(value, contentNow(now))');
    expect(tonightClosing).not.toContain('isoDate(now)');
  });

  it('the server-synced push copy stays on its own clock (out of scope, by design)', () => {
    const pushCore = readSrc('lib/pushCore.ts');
    expect(pushCore).not.toContain('dayBoundary');
  });
});

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

describe('Play 7 — the resolve carries over the 04:00 flip', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('a resolve written at 01:30 is dated to the night it belongs to', () => {
    // 01:30 on Tue Nov 17 is still Monday night in the content day.
    saveTonightResolve('Speak gently at breakfast.', contentNow(new Date(2026, 10, 17, 1, 30)));
    expect(loadTonightResolve()).toEqual({ date: '2026-11-16', text: 'Speak gently at breakfast.' });
  });

  it('that resolve surfaces on the morning that follows it — not during the night itself', () => {
    saveTonightResolve('Speak gently at breakfast.', contentNow(new Date(2026, 10, 17, 1, 30)));
    expect(morningResolve(contentNow(new Date(2026, 10, 17, 1, 45)))).toBeNull();
    expect(morningResolve(contentNow(new Date(2026, 10, 17, 8, 0)))).toBe('Speak gently at breakfast.');
    // The midday cutoff still reads the wall clock: gone by afternoon.
    expect(morningResolve(contentNow(new Date(2026, 10, 17, 12, 30)))).toBeNull();
  });

  it('an evening resolve is not shown again in the small hours of its own night', () => {
    saveTonightResolve('Kept small.', contentNow(new Date(2026, 10, 16, 21, 30)));
    expect(morningResolve(contentNow(new Date(2026, 10, 17, 2, 0)))).toBeNull();
    expect(morningResolve(contentNow(new Date(2026, 10, 17, 7, 15)))).toBe('Kept small.');
  });
});
