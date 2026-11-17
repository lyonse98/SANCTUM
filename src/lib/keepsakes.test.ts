import { beforeEach, describe, expect, it } from 'vitest';
import {
  KEEPSAKES_KEY,
  formatKeepsakeDate,
  formatKeepsakeRange,
  listKeepsakes,
  recordKeepsake,
  type Keepsake,
} from './keepsakes';

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

const judeRun: Keepsake = {
  arcId: 'st-jude',
  arcName: 'Novena to St. Jude',
  intention: 'For my brother’s work',
  startedISO: '2026-11-08',
  completedISO: '2026-11-16',
};

const josephRun: Keepsake = {
  arcId: 'st-joseph',
  arcName: 'Novena to St. Joseph',
  intention: '',
  startedISO: '2026-11-17',
  completedISO: '2026-11-25',
};

describe('keepsakes — the record of completed arcs (Play 5(a))', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('lives under a sanctum_ key so the panic wipe clears it', () => {
    expect(KEEPSAKES_KEY).toBe('sanctum_keepsakes');
  });

  it('starts empty', () => {
    expect(listKeepsakes()).toEqual([]);
  });

  it('records a completed run with its intention in the user’s own words', () => {
    recordKeepsake(judeRun);
    expect(listKeepsakes()).toEqual([judeRun]);
  });

  it('an intention may be empty — a general run is still kept', () => {
    recordKeepsake(josephRun);
    expect(listKeepsakes()).toEqual([josephRun]);
  });

  it('is idempotent per run: the same arc begun the same day never duplicates', () => {
    recordKeepsake(judeRun);
    recordKeepsake(judeRun);
    recordKeepsake({ ...judeRun, intention: 'changed words' });
    expect(listKeepsakes()).toEqual([judeRun]);
  });

  it('a later run of the same arc is a new keepsake', () => {
    recordKeepsake(judeRun);
    const again: Keepsake = { ...judeRun, startedISO: '2026-12-01', completedISO: '2026-12-09', intention: 'For Anna' };
    recordKeepsake(again);
    expect(listKeepsakes()).toEqual([again, judeRun]);
  });

  it('lists most recently completed first', () => {
    recordKeepsake(judeRun);
    recordKeepsake(josephRun);
    expect(listKeepsakes().map((k) => k.arcId)).toEqual(['st-joseph', 'st-jude']);
  });

  it('survives corrupt stored state by reading as empty, never throwing', () => {
    localStorage.setItem(KEEPSAKES_KEY, '{not json');
    expect(listKeepsakes()).toEqual([]);
    localStorage.setItem(KEEPSAKES_KEY, '{"not":"an array"}');
    expect(listKeepsakes()).toEqual([]);
    localStorage.setItem(KEEPSAKES_KEY, JSON.stringify([{ arcId: 7 }, judeRun, null]));
    expect(listKeepsakes()).toEqual([judeRun]);
    expect(recordKeepsake(josephRun)).toEqual([josephRun, judeRun]);
  });

  it('formats the shelf dates from the ISO days, without timezone drift', () => {
    expect(formatKeepsakeDate('2026-11-08')).toBe('Nov 8');
    expect(formatKeepsakeDate('2026-01-31')).toBe('Jan 31');
    expect(formatKeepsakeDate('not a date')).toBe('');
    expect(formatKeepsakeRange('2026-11-08', '2026-11-16')).toBe('Nov 8 – Nov 16');
    expect(formatKeepsakeRange('2026-11-16', '2026-11-16')).toBe('Nov 16');
    expect(formatKeepsakeRange('', '2026-11-16')).toBe('Nov 16');
  });
});
