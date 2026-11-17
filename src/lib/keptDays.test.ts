import { beforeEach, describe, expect, it } from 'vitest';
import {
  KEPT_DAYS_KEY,
  MONTH_EXAMEN_SEEN_KEY,
  keptDaysBetween,
  keptDaysInMonth,
  loadKeptDays,
  loadMonthExamenSeen,
  markMonthExamenSeen,
  monthExamenCandidate,
  recordKeptDay,
} from './keptDays';

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

describe('keptDays — the journal pages', () => {
  it('lives under sanctum_ keys so the panic wipe clears it', () => {
    expect(KEPT_DAYS_KEY).toBe('sanctum_kept_days');
    expect(MONTH_EXAMEN_SEEN_KEY).toBe('sanctum_month_examen_seen');
  });

  it('starts empty', () => {
    expect(loadKeptDays()).toEqual([]);
  });

  it('records a day and reads it back, sorted ascending by date', () => {
    recordKeptDay('2026-11-12', 'Carry the quiet.');
    recordKeptDay('2026-11-10', 'Begin again, smaller.');
    expect(loadKeptDays()).toEqual([
      { dateKey: '2026-11-10', line: 'Begin again, smaller.' },
      { dateKey: '2026-11-12', line: 'Carry the quiet.' },
    ]);
  });

  it('is idempotent per day: the first line written is the day’s page', () => {
    recordKeptDay('2026-11-12', 'The first line.');
    recordKeptDay('2026-11-12', 'A later line changes nothing.');
    expect(loadKeptDays()).toEqual([{ dateKey: '2026-11-12', line: 'The first line.' }]);
  });

  it('an empty line keeps nothing', () => {
    recordKeptDay('2026-11-12', '   ');
    expect(loadKeptDays()).toEqual([]);
  });

  it('keptDaysInMonth returns only that month’s pages, in order', () => {
    recordKeptDay('2026-10-31', 'October’s last.');
    recordKeptDay('2026-11-01', 'November’s first.');
    recordKeptDay('2026-11-30', 'November’s last.');
    recordKeptDay('2026-12-01', 'December’s first.');
    expect(keptDaysInMonth(2026, 10).map((e) => e.dateKey)).toEqual(['2026-11-01', '2026-11-30']);
  });

  it('keptDaysBetween is inclusive at both ends', () => {
    recordKeptDay('2026-11-09', 'a');
    recordKeptDay('2026-11-12', 'b');
    recordKeptDay('2026-11-16', 'c');
    expect(keptDaysBetween(loadKeptDays(), '2026-11-09', '2026-11-15').map((e) => e.line)).toEqual(['a', 'b']);
  });

  it('survives corrupt stored state by starting clean, never throwing', () => {
    localStorage.setItem(KEPT_DAYS_KEY, '{not json');
    expect(loadKeptDays()).toEqual([]);
    recordKeptDay('2026-11-12', 'Still kept.');
    expect(loadKeptDays()).toEqual([{ dateKey: '2026-11-12', line: 'Still kept.' }]);
  });
});

describe('monthExamenCandidate — the month just ended, at five kept days', () => {
  const inDecember = new Date(2026, 11, 5, 10); // Dec 5, 2026: November just ended

  const keepNovember = (days: number[]) => {
    days.forEach((d, i) => recordKeptDay(`2026-11-${String(d).padStart(2, '0')}`, `Line ${i + 1}`));
  };

  it('is null when the month just ended holds no kept days', () => {
    expect(monthExamenCandidate(inDecember)).toBeNull();
  });

  it('is null at four kept days — just under the threshold', () => {
    keepNovember([3, 9, 17, 24]);
    expect(monthExamenCandidate(inDecember)).toBeNull();
  });

  it('offers the examen at exactly five kept days, lines in chronological order', () => {
    keepNovember([24, 3, 17, 9, 12]);
    const candidate = monthExamenCandidate(inDecember);
    expect(candidate).not.toBeNull();
    expect(candidate?.monthKey).toBe('2026-11');
    expect(candidate?.label).toBe('November');
    // Recorded out of order; the examen reads them in the month's own order.
    expect(candidate?.lines).toEqual(['Line 2', 'Line 4', 'Line 5', 'Line 3', 'Line 1']);
  });

  it('kept days in the current month do not count toward the offer', () => {
    keepNovember([3, 9, 17, 24]);
    recordKeptDay('2026-12-02', 'This month, not last.');
    expect(monthExamenCandidate(inDecember)).toBeNull();
  });

  it('before the 04:00 flip on the 1st, the month just ended is the one before', () => {
    // 02:00 on Dec 1 is still Nov 30's content day: October just ended.
    [2, 8, 15, 21, 29].forEach((d, i) =>
      recordKeptDay(`2026-10-${String(d).padStart(2, '0')}`, `October line ${i + 1}`),
    );
    const candidate = monthExamenCandidate(new Date(2026, 11, 1, 2));
    expect(candidate?.monthKey).toBe('2026-10');
    expect(candidate?.label).toBe('October');
  });
});

describe('month examen seen-state', () => {
  it('starts unseen, and a marked month reads back', () => {
    expect(loadMonthExamenSeen()).toBeNull();
    markMonthExamenSeen('2026-11');
    expect(loadMonthExamenSeen()).toBe('2026-11');
  });

  it('marking a later month replaces the mark', () => {
    markMonthExamenSeen('2026-11');
    markMonthExamenSeen('2026-12');
    expect(loadMonthExamenSeen()).toBe('2026-12');
  });
});
