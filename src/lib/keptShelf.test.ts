import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { KeptShelf } from '../components/KeptShelf';
import { getSeasonTheme } from './seasonTheme';
import { DAYS_PRAYED_KEY } from './daysPrayed';
import { KEPT_DAYS_KEY } from './keptDays';
import type { Audience } from '@/types';

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

function render(dateKey: string, audience: Audience = 'men') {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part));
  return renderToString(
    createElement(KeptShelf, {
      t: getSeasonTheme(new Date(y, (m || 1) - 1, d || 1), audience),
      audience,
      dateKey,
    }),
  );
}

function seedKeptDays(entries: { dateKey: string; line: string }[]) {
  localStorage.setItem(KEPT_DAYS_KEY, JSON.stringify(entries));
}

function seedPrayedDays(days: string[]) {
  localStorage.setItem(DAYS_PRAYED_KEY, JSON.stringify({ days }));
}

describe('KeptShelf — the foot of Tonight', () => {
  it('renders nothing at all when there is nothing kept — no heading over a void', () => {
    expect(render('2026-11-16')).toBe('');
  });

  it('kept days read as journal pages, most recent first', () => {
    seedKeptDays([
      { dateKey: '2026-11-10', line: 'Begin again, smaller.' },
      { dateKey: '2026-11-12', line: 'Carry the quiet.' },
    ]);
    const html = render('2026-11-16'); // a Monday: no harvest, no weeks, no examen
    expect(html).toContain('Kept days');
    expect(html).toContain('Carry the quiet.');
    expect(html).toContain('Begin again, smaller.');
    expect(html.indexOf('Carry the quiet.')).toBeLessThan(html.indexOf('Begin again, smaller.'));
    expect(html).toContain('Thursday, Nov 12');
    expect(html).not.toContain('This week, kept');
    expect(html).not.toContain('Kept weeks');
  });

  it('on a Sunday, this week’s kept pages are the harvest', () => {
    seedKeptDays([
      { dateKey: '2026-11-10', line: 'Begin again, smaller.' },
      { dateKey: '2026-11-12', line: 'Carry the quiet.' },
      { dateKey: '2026-11-03', line: 'Last week’s page, not this week’s.' },
    ]);
    const html = render('2026-11-15'); // Sunday, ending the week of Nov 9–15
    expect(html).toContain('This week, kept');
    const harvestAt = html.indexOf('This week, kept');
    const journalAt = html.indexOf('Kept days');
    const harvestBlock = html.slice(harvestAt, journalAt);
    expect(harvestBlock).toContain('Begin again, smaller.');
    expect(harvestBlock).toContain('Carry the quiet.');
    expect(harvestBlock).not.toContain('Last week’s page');
    // Three prayed days is not a kept week: the harvest says no more than the pages.
    expect(html).not.toContain('A kept week.');
  });

  it('a Sunday harvest over a kept week adds exactly one line: “A kept week.”', () => {
    seedKeptDays([{ dateKey: '2026-11-12', line: 'Carry the quiet.' }]);
    seedPrayedDays(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    const html = render('2026-11-15');
    expect(html).toContain('This week, kept');
    expect(html).toContain('A kept week.');
    // The week is still in progress on its Sunday, so the kept-weeks cards stay absent.
    expect(html).not.toContain('Kept weeks');
  });

  it('a completed kept week stands as a card once its Sunday has passed', () => {
    seedPrayedDays(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    const html = render('2026-11-16');
    expect(html).toContain('Kept weeks');
    expect(html).toContain('Nov 9 – Nov 15');
  });

  it('five kept days last month raise the examen offer, unexpanded', () => {
    seedKeptDays(
      [2, 8, 15, 21, 29].map((d) => ({
        dateKey: `2026-10-${String(d).padStart(2, '0')}`,
        line: `October line ${d}`,
      })),
    );
    const html = render('2026-11-16');
    expect(html).toContain('Last month, kept');
    expect(html).toContain('October’s pages are here.');
    // The guided examen stays folded until it is opened.
    expect(html).not.toContain('Gratitude');
    expect(html).not.toContain('Resolve');
  });

  it('four kept days last month raise no offer', () => {
    seedKeptDays(
      [2, 8, 15, 21].map((d) => ({
        dateKey: `2026-10-${String(d).padStart(2, '0')}`,
        line: `October line ${d}`,
      })),
    );
    const html = render('2026-11-16');
    expect(html).not.toContain('Last month, kept');
  });
});
