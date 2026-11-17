import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DaysPrayedMark } from '../components/DaysPrayedMark';
import { getSeasonTheme } from './seasonTheme';
import { recordCoreAct } from './daysPrayed';

/**
 * Play 1b — the days-prayed mark on Today. The pins guard the doctrine,
 * not just the rendering: the number is the tally lib's cumulative
 * count, the flame answers for today only, the copy is a plain label,
 * and the guilt grammar the feature exists to refuse appears nowhere
 * in the component.
 */

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const mark = read('components/DaysPrayedMark.tsx');
const home = read('components/HomeScreen.tsx');

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

function render() {
  return renderToString(createElement(DaysPrayedMark, { t: getSeasonTheme(new Date(), 'men') }));
}

describe('Play 1b — the mark’s doctrine, pinned in source', () => {
  it('the banned grammar appears nowhere in the component', () => {
    const lower = mark.toLowerCase();
    expect(lower).not.toContain('streak');
    expect(lower).not.toContain("don't break");
    expect(lower).not.toContain('don’t break');
    expect(lower).not.toContain('keep it going');
    expect(lower).not.toContain('consecutive');
    expect(lower).not.toContain('missed');
  });

  it('the number and the flame both derive from the tally lib', () => {
    expect(mark).toContain("from '@/lib/daysPrayed'");
    expect(mark).toContain('loadDaysPrayed()');
    expect(mark).toContain('totalDays');
    expect(mark).toContain('prayedToday');
    // Lit: filled in the day's accent. Unlit: a muted outline, no fill.
    expect(mark).toContain("fill={prayedToday ? t.accent : 'none'}");
    expect(mark).toContain('stroke={prayedToday ? t.accent : t.textDim}');
  });

  it('the label is the plain one, and the colours are theme tokens only', () => {
    expect(mark).toContain('days prayed');
    expect(mark).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  });

  it('Today mounts the mark', () => {
    expect(home).toContain("import { DaysPrayedMark } from '@/components/DaysPrayedMark'");
    expect(home).toContain('<DaysPrayedMark t={seasonTheme} />');
  });
});

describe('Play 1b — the mark as rendered', () => {
  it('before any act today: the cumulative count, the flame unlit', () => {
    // Two long-past days: the count carries them, and neither is today.
    recordCoreAct('listen', new Date(2020, 0, 5, 9));
    recordCoreAct('pray', new Date(2020, 0, 7, 9));
    const html = render();
    expect(html).toContain('data-days-prayed-mark');
    expect(html).toContain('data-flame-lit="false"');
    expect(html).toContain('2 days prayed');
  });

  it('an act today lights the flame and the count is the tally’s own', () => {
    recordCoreAct('listen');
    const html = render();
    expect(html).toContain('data-flame-lit="true"');
    expect(html).toContain('1 day prayed');
  });

  it('with nothing prayed at all, the flame stands unlit at zero', () => {
    const html = render();
    expect(html).toContain('data-flame-lit="false"');
    expect(html).toContain('0 days prayed');
  });
});
