import { beforeEach, describe, expect, it } from 'vitest';
import { NOVENAS } from '../data/novenas';
import {
  currentNovenaArc,
  isNovenaInProgress,
  novenaStateKey,
  pickNovenaArc,
} from './novenaProgress';

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

describe('novenaProgress — the arc Today may name (Play 5b)', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('reads the same sanctum_ keys the Pray door writes', () => {
    for (const novena of NOVENAS) {
      expect(novenaStateKey(novena.id)).toBe(`sanctum_novena_${novena.id}`);
    }
  });

  it('an arc is in progress at 1–8 days prayed — not before, not once complete', () => {
    expect(isNovenaInProgress({ startedISO: '', prayedDates: [] })).toBe(false);
    expect(isNovenaInProgress({ startedISO: '2026-11-10', prayedDates: dates(1) })).toBe(true);
    expect(isNovenaInProgress({ startedISO: '2026-11-10', prayedDates: dates(8) })).toBe(true);
    expect(isNovenaInProgress({ startedISO: '2026-11-10', prayedDates: dates(9) })).toBe(false);
  });

  it('no novena begun, no arc', () => {
    expect(currentNovenaArc()).toBeNull();
  });

  it('one novena under way is the arc, with its title and days prayed', () => {
    localStorage.setItem(
      novenaStateKey('st-jude'),
      JSON.stringify({ startedISO: '2026-11-10', prayedDates: dates(4) }),
    );
    expect(currentNovenaArc()).toEqual({ novenaId: 'st-jude', name: 'Novena to St. Jude', dayCount: 4 });
  });

  it('a completed novena is not an arc, and does not hide one still under way', () => {
    localStorage.setItem(
      novenaStateKey('st-joseph'),
      JSON.stringify({ startedISO: '2026-11-01', prayedDates: dates(9, '2026-11-01') }),
    );
    localStorage.setItem(
      novenaStateKey('st-jude'),
      JSON.stringify({ startedISO: '2026-11-12', prayedDates: dates(2, '2026-11-12') }),
    );
    expect(currentNovenaArc()?.novenaId).toBe('st-jude');
  });

  it('with two under way, the most recently started is named', () => {
    localStorage.setItem(
      novenaStateKey('st-joseph'),
      JSON.stringify({ startedISO: '2026-11-08', prayedDates: dates(5, '2026-11-08') }),
    );
    localStorage.setItem(
      novenaStateKey('mary-undoer-of-knots'),
      JSON.stringify({ startedISO: '2026-11-13', prayedDates: dates(2, '2026-11-13') }),
    );
    expect(currentNovenaArc()).toEqual({
      novenaId: 'mary-undoer-of-knots',
      name: 'Novena to Mary, Undoer of Knots',
      dayCount: 2,
    });
  });

  it('corrupt or partial records are skipped, never thrown on', () => {
    localStorage.setItem(novenaStateKey('st-jude'), '{not json');
    localStorage.setItem(novenaStateKey('st-joseph'), JSON.stringify({ prayedDates: 'nope' }));
    expect(currentNovenaArc()).toBeNull();
    localStorage.setItem(
      novenaStateKey('st-joseph'),
      JSON.stringify({ startedISO: '2026-11-10', prayedDates: dates(3) }),
    );
    expect(currentNovenaArc()?.novenaId).toBe('st-joseph');
  });

  it('pickNovenaArc is pure over the same rule', () => {
    expect(
      pickNovenaArc([
        { id: 'st-jude', title: 'Novena to St. Jude', state: { startedISO: '2026-11-10', prayedDates: dates(9) } },
        { id: 'st-joseph', title: 'Novena to St. Joseph', state: null },
      ]),
    ).toBeNull();
  });
});
