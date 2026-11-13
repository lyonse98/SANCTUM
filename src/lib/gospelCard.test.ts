import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { orderedReadingRows } from '../components/DailyQuote';
import { getFeastForDate } from '@/data/feastDays';
import type { DailyReadings } from './readings';
import type { ReadingTexts } from './bible';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The Gospel card rebuilt (core diet step 1, Erik, Nov 13, 2026): the readings
 * are the card's body again — full text, in lectionary order, no expander;
 * the key verse and the "From the tradition" quote are off the card; the
 * saint's standalone card is demoted to the header's celebration line; and
 * Listen / Tailor Today / Reflect stand as three equal Way-1 tiles.
 */

const SUNDAY: DailyReadings = {
  date: '2026-11-15',
  season: 'Ordinary Time',
  celebration: null,
  firstReading: 'Malachi 3:19-20a',
  psalm: 'Psalm 98',
  secondReading: '2 Thessalonians 3:7-12',
  gospel: 'Luke 21:5-19',
  usccbLink: 'https://bible.usccb.org/bible/readings/111526.cfm',
};

const WEEKDAY: DailyReadings = {
  ...SUNDAY,
  date: '2026-11-13',
  celebration: 'St. Frances Xavier Cabrini',
  secondReading: null,
};

const passage = (citation: string) => ({ citation, text: `Text of ${citation}.`, translation: 'web' });

const TEXTS: ReadingTexts = {
  first: passage('Malachi 3:19-20a'),
  psalm: passage('Psalm 98'),
  second: passage('2 Thessalonians 3:7-12'),
  gospel: passage('Luke 21:5-19'),
};

describe('the readings, in lectionary order', () => {
  it('a day with a Second Reading renders First, Psalm, Second, Gospel', () => {
    const rows = orderedReadingRows(SUNDAY, TEXTS);
    expect(rows.map((r) => r.label)).toEqual([
      'First Reading',
      'Responsorial Psalm',
      'Second Reading',
      'Gospel',
    ]);
    expect(rows.map((r) => r.passage?.citation)).toEqual([
      'Malachi 3:19-20a',
      'Psalm 98',
      '2 Thessalonians 3:7-12',
      'Luke 21:5-19',
    ]);
  });

  it('a day without one renders First, Psalm, Gospel — no empty row', () => {
    const rows = orderedReadingRows(WEEKDAY, TEXTS);
    expect(rows.map((r) => r.label)).toEqual(['First Reading', 'Responsorial Psalm', 'Gospel']);
  });

  it('rows exist from citations alone while texts are still loading', () => {
    const rows = orderedReadingRows(SUNDAY, null);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => !r.passage)).toBe(true);
    expect(rows[3].citation).toBe('Luke 21:5-19');
  });
});

describe('the card diet — what left the card', () => {
  const card = read('components/DailyQuote.tsx');

  it('no expander, no collapsible reading blocks', () => {
    expect(card).not.toContain('Read the full readings');
    expect(card).not.toContain('toggleExpanded');
    expect(card).not.toContain('ReadingBlock');
  });

  it('no "From the tradition" quote block (it moves to Tailor in step 2)', () => {
    expect(card).not.toContain('From the tradition');
  });

  it('no key-verse block on the card — the verse survives only for the share card', () => {
    expect(card).not.toContain('The Gospel &middot; {keyVerse.citation}');
    expect(card).toContain('keyVerse={keyVerse}');
  });

  it('the readings are visible in the body, with the official-text link at their foot', () => {
    expect(card).toContain('orderedReadingRows(readings, allTexts)');
    expect(card).toContain('Official reading text');
    // The full-text fetch fires on citations, not on an expansion.
    expect(card).toContain('void loadAllTexts()');
  });

  it('share is a full-width secondary button under the tiles (Nov 13 step 2), opening the same modal', () => {
    // The header icon is gone; the button lives in the card flow, below the tile panels.
    expect(card).not.toContain('aria-label="Share today\'s Gospel"');
    expect(card).toContain('data-share-gospel');
    expect(card).toContain('Share today&rsquo;s Gospel');
    expect(card).toContain('<DailyGospelShareModal');
    expect(card.indexOf('data-share-gospel')).toBeGreaterThan(card.indexOf('data-tile="reflect"'));
  });

  it('the share button is card-styled, never a call to action', () => {
    const start = card.indexOf('data-share-gospel');
    const buttonSource = card.slice(card.lastIndexOf('<button', start), card.indexOf('</button>', start));
    expect(buttonSource).toContain('rounded-lg border');
    expect(buttonSource).not.toContain('animate-cta-glow');
    expect(buttonSource).not.toContain('border-2');
    expect(buttonSource).not.toContain('t.accent');
  });
});

describe('Way 1 — three equal tiles', () => {
  const card = read('components/DailyQuote.tsx');

  it('the tiles are Listen, Tailor Today, Reflect, in one grid-cols-3 row', () => {
    expect(card).toContain('grid grid-cols-3');
    const tiles = [...card.matchAll(/data-tile="([a-z]+)"/g)].map((m) => m[1]);
    expect(tiles).toEqual(['listen', 'tailor', 'reflect']);
    expect(card).toMatch(/>\s*Listen\s*<\/span>/);
    expect(card).toMatch(/>\s*Tailor Today\s*<\/span>/);
    expect(card).toMatch(/>\s*Reflect\s*<\/span>/);
    expect(card).toContain('Read aloud');
    expect(card).toContain('For your day');
    expect(card).toContain('With a companion');
  });

  it('all three tiles share one class string — equals by construction', () => {
    expect(card.match(/className=\{TILE_CLASS\}/g)).toHaveLength(3);
  });

  it('Reflect carries no glow and no dominance classes', () => {
    expect(card).not.toContain('animate-cta-glow');
    expect(card).not.toContain('border-2 transition-all active:scale-[0.98] disabled:opacity-60');
    // Its full name survives as the accessible label — the door is the same door.
    expect(card).toContain('aria-label="Reflect with a Companion"');
  });

  it('Listen and Tailor open as panels under the tiles; Reflect keeps its flow', () => {
    expect(card).toContain("panel === 'listen'");
    expect(card).toContain("panel === 'tailor'");
    expect(card).toContain('<ListenBar');
    expect(card).toContain('<TailorToday');
    expect(card).toContain('startOpen');
    expect(card).toContain('onClick={handleReflectWithCompanion}');
    // Reflect's loading state lives on the tile now.
    expect(card).toContain('disabled={preparing}');
  });
});

describe('the saint, demoted to the header line', () => {
  it('HomeScreen no longer mounts the standalone saint card; the component stays in the repo', () => {
    const home = read('components/HomeScreen.tsx');
    expect(home).not.toContain('SaintOfDayCard');
    expect(existsSync(join(SRC, 'components', 'SaintOfDayCard.tsx'))).toBe(true);
  });

  it('the header line is the readings celebration beside the feast rank label', () => {
    const card = read('components/DailyQuote.tsx');
    expect(card).toContain('readings.celebration');
    expect(card).toContain('feastRankLabel(feast.rank)');
    expect(card).toContain("memorial: 'Memorial'");
  });

  it('today (2026-11-13) the feast data names Cabrini, a memorial — so the header reads Cabrini · Memorial', () => {
    const feast = getFeastForDate(new Date(2026, 10, 13, 12));
    expect(feast?.name).toBe('St. Frances Xavier Cabrini');
    expect(feast?.rank).toBe('memorial');
    // And the lectionary celebration for the day (the bundle's own field, the
    // other half of the header line) is the same name.
    expect(WEEKDAY.celebration).toBe('St. Frances Xavier Cabrini');
  });

  it('the Tonight closing keeps its saint line (the saint’s other surviving home)', () => {
    expect(read('components/HomeScreen.tsx')).toContain('<TonightClosing');
    expect(read('lib/tonight.ts')).toContain('You walked today with');
  });
});

describe('Real Help stays visible at the foot of Today', () => {
  it('one quiet line links to the Real Help view', () => {
    const home = read('components/HomeScreen.tsx');
    expect(home).toContain('Need real help? A priest, a counselor, or a crisis line —');
    expect(home).toContain('onClick={onOpenHelp}');
  });
});
