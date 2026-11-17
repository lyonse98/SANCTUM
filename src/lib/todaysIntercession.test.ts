import { beforeEach, describe, expect, it } from 'vitest';
import type { NovenaState } from '../data/novenas';
import { novenaStateKey } from './novenaProgress';
import {
  activeIntentions,
  collectActiveIntentions,
  dayOrdinal,
  pickIntercession,
  todaysIntercession,
  type ActiveIntention,
} from './todaysIntercession';

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

const dates = (n: number, from = '2026-11-10') =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + i);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  });

const state = (n: number): NovenaState => ({ startedISO: '2026-11-10', prayedDates: dates(n) });

const actives: ActiveIntention[] = [
  { novenaId: 'st-joseph', name: 'Novena to St. Joseph', intention: 'For my father.' },
  { novenaId: 'mary-undoer-of-knots', name: 'Novena to Mary, Undoer of Knots', intention: 'For Anna.' },
  { novenaId: 'st-jude', name: 'Novena to St. Jude', intention: 'For Leo.' },
];

describe('pickIntercession — the pure rotation', () => {
  it('is null when nothing is active', () => {
    expect(pickIntercession([], '2026-11-16')).toBeNull();
  });

  it('a single active intention is always the pick', () => {
    expect(pickIntercession([actives[1]], '2026-11-16')).toEqual(actives[1]);
    expect(pickIntercession([actives[1]], '2026-12-25')).toEqual(actives[1]);
  });

  it('is deterministic: the same intention all day, every call', () => {
    const first = pickIntercession(actives, '2026-11-16');
    for (let i = 0; i < 5; i++) {
      expect(pickIntercession(actives, '2026-11-16')).toEqual(first);
    }
  });

  it('picks by dayOrdinal(contentKey) % count, rotating across days', () => {
    expect(dayOrdinal('2026-11-16')).toBe(
      '2026-11-16'.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
    );
    for (const key of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']) {
      expect(pickIntercession(actives, key)).toEqual(actives[dayOrdinal(key) % actives.length]);
    }
    // Consecutive days do not all land on the same intention.
    const picks = new Set(
      ['2026-11-16', '2026-11-17', '2026-11-18'].map((k) => pickIntercession(actives, k)?.novenaId),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('dayOrdinal is a stable hash of the key alone', () => {
    expect(dayOrdinal('2026-11-16')).toBe(dayOrdinal('2026-11-16'));
    expect(dayOrdinal('')).toBe(0);
  });
});

describe('collectActiveIntentions — the pure filter over NovenaState objects', () => {
  it('keeps only in-progress novenas with a non-empty intention, trimmed, in given order', () => {
    expect(
      collectActiveIntentions([
        { id: 'st-joseph', title: 'Novena to St. Joseph', state: state(3), intention: '  For my father.  ' },
        { id: 'st-jude', title: 'Novena to St. Jude', state: state(1), intention: 'For Leo.' },
      ]),
    ).toEqual([
      { novenaId: 'st-joseph', name: 'Novena to St. Joseph', intention: 'For my father.' },
      { novenaId: 'st-jude', name: 'Novena to St. Jude', intention: 'For Leo.' },
    ]);
  });

  it('excludes completed (9 days) and unbegun (0 days) novenas', () => {
    expect(
      collectActiveIntentions([
        { id: 'st-joseph', title: 'Novena to St. Joseph', state: state(9), intention: 'Done.' },
        { id: 'st-jude', title: 'Novena to St. Jude', state: state(0), intention: 'Not begun.' },
        { id: 'mary-undoer-of-knots', title: 'Novena to Mary, Undoer of Knots', state: null, intention: 'No record.' },
      ]),
    ).toEqual([]);
    // The boundary days are in: 1 and 8 prayed dates are in progress.
    expect(
      collectActiveIntentions([
        { id: 'st-joseph', title: 'Novena to St. Joseph', state: state(1), intention: 'One.' },
        { id: 'st-jude', title: 'Novena to St. Jude', state: state(8), intention: 'Eight.' },
      ]),
    ).toHaveLength(2);
  });

  it('trims blank intentions away — whitespace alone is no intention', () => {
    expect(
      collectActiveIntentions([
        { id: 'st-joseph', title: 'Novena to St. Joseph', state: state(2), intention: '   ' },
        { id: 'st-jude', title: 'Novena to St. Jude', state: state(2), intention: '' },
        { id: 'mary-undoer-of-knots', title: 'Novena to Mary, Undoer of Knots', state: state(2), intention: null },
      ]),
    ).toEqual([]);
  });
});

describe('activeIntentions / todaysIntercession — the device-reading wrapper', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  const seed = (id: 'st-joseph' | 'mary-undoer-of-knots' | 'st-jude', daysPrayed: number, intention?: string) => {
    localStorage.setItem(
      novenaStateKey(id),
      JSON.stringify({ startedISO: '2026-11-10', prayedDates: dates(daysPrayed) }),
    );
    if (intention !== undefined) {
      localStorage.setItem(`sanctum_novena_${id}_intention`, intention);
    }
  };

  it('nothing on the device, no intercession', () => {
    expect(activeIntentions()).toEqual([]);
    expect(todaysIntercession('2026-11-16')).toBeNull();
  });

  it('reads state and intention under the same sanctum_novena_ keys the Pray door writes', () => {
    seed('st-jude', 4, 'For Leo.');
    expect(activeIntentions()).toEqual([
      { novenaId: 'st-jude', name: 'Novena to St. Jude', intention: 'For Leo.' },
    ]);
    expect(todaysIntercession('2026-11-16')).toEqual({
      novenaId: 'st-jude',
      name: 'Novena to St. Jude',
      intention: 'For Leo.',
    });
  });

  it('returns actives in NOVENAS order, whatever order they were seeded in', () => {
    seed('st-jude', 2, 'For Leo.');
    seed('st-joseph', 5, 'For my father.');
    expect(activeIntentions().map((a) => a.novenaId)).toEqual(['st-joseph', 'st-jude']);
  });

  it('excludes a completed novena and an unbegun one, and trims blank intentions', () => {
    seed('st-joseph', 9, 'Already finished.');
    seed('mary-undoer-of-knots', 0, 'Not begun.');
    seed('st-jude', 3, '   ');
    expect(activeIntentions()).toEqual([]);
    expect(todaysIntercession('2026-11-16')).toBeNull();
  });

  it('the wrapper pick matches the pure rotation over the same actives', () => {
    seed('st-joseph', 2, 'For my father.');
    seed('st-jude', 6, 'For Leo.');
    const key = '2026-11-18';
    expect(todaysIntercession(key)).toEqual(pickIntercession(activeIntentions(), key));
    expect(todaysIntercession(key)).toEqual(todaysIntercession(key));
  });

  it('corrupt records are skipped, never thrown on', () => {
    localStorage.setItem(novenaStateKey('st-jude'), '{not json');
    localStorage.setItem('sanctum_novena_st-jude_intention', 'For Leo.');
    expect(activeIntentions()).toEqual([]);
    expect(todaysIntercession('2026-11-16')).toBeNull();
  });
});
