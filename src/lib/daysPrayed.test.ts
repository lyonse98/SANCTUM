import { beforeEach, describe, expect, it } from 'vitest';
import { DAYS_PRAYED_KEY, loadDaysPrayed, recordCoreAct } from './daysPrayed';

const day = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h);

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

describe('daysPrayed — the cumulative, guilt-free tally (Play 1 revised)', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('lives under a sanctum_ key so the panic wipe clears it', () => {
    expect(DAYS_PRAYED_KEY.startsWith('sanctum_')).toBe(true);
  });

  it('starts empty and unlit', () => {
    expect(loadDaysPrayed(day(2026, 11, 16))).toEqual({ totalDays: 0, prayedToday: false });
  });

  it('the first core act of a day counts the day', () => {
    const after = recordCoreAct('listen', day(2026, 11, 16));
    expect(after).toEqual({ totalDays: 1, prayedToday: true, isNewDay: true });
  });

  it('further acts the same day change nothing (one day, one count)', () => {
    recordCoreAct('listen', day(2026, 11, 16, 7));
    const after = recordCoreAct('pray', day(2026, 11, 16, 21));
    expect(after).toEqual({ totalDays: 1, prayedToday: true, isNewDay: false });
  });

  it('a gap of days changes nothing: the count only ever grows, never resets', () => {
    recordCoreAct('listen', day(2026, 11, 16));
    // Nine silent days. Nothing is recorded for them, nothing is owed.
    const after = recordCoreAct('tonight', day(2026, 11, 26));
    expect(after).toEqual({ totalDays: 2, prayedToday: true, isNewDay: true });
    expect(loadDaysPrayed(day(2026, 11, 26)).totalDays).toBe(2);
  });

  it('an act before 04:00 counts toward the content day being finished', () => {
    recordCoreAct('tonight', day(2026, 11, 17, 1)); // 01:00 on the 17th = the 16th's evening
    expect(loadDaysPrayed(day(2026, 11, 16, 23)).totalDays).toBe(1);
    expect(loadDaysPrayed(day(2026, 11, 17, 9)).prayedToday).toBe(false);
  });

  it('any core act counts — listen, pray, companion, tonight, tailor', () => {
    const kinds = ['listen', 'pray', 'companion', 'tonight', 'tailor'] as const;
    kinds.forEach((kind, i) => recordCoreAct(kind, day(2026, 11, 10 + i)));
    expect(loadDaysPrayed(day(2026, 11, 20)).totalDays).toBe(5);
  });

  it('survives corrupt stored state by starting clean, never throwing', () => {
    localStorage.setItem(DAYS_PRAYED_KEY, '{not json');
    expect(loadDaysPrayed(day(2026, 11, 16))).toEqual({ totalDays: 0, prayedToday: false });
    expect(recordCoreAct('pray', day(2026, 11, 16)).totalDays).toBe(1);
  });
});
