import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXED_FEASTS, getFeastForDate } from '@/data/feastDays';
import { SAINTS } from '@/data/saints';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import {
  getDayRank,
  getMemorialMarker,
  memorialTakesLeadInOrdinaryTime,
  TINT_STRENGTH_BY_RANK,
} from '@/lib/dayTheme';
import { getDailyVisual } from '@/lib/liturgicalVisuals';
import { getSeasonAccentColor, getSeasonTheme } from '@/lib/seasonTheme';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The five optional memorials added Nov 15, 2026 (Erik's ruling): they are
 * INCLUDED — named like any saint's day — but the season overrides the
 * theme. An optional memorial's colour never takes the accent set in any
 * season, and the day speaks at ferial tint strength. These tests pin the
 * data, the rank, and that accent behaviour against the contrasting
 * obligatory-memorial rule (Nov 11, 2026: in Ordinary Time an obligatory
 * memorial's saint DOES take the lead accent set).
 */
const FIVE: { mmdd: string; month: number; day: number; name: string; color: 'red' | 'white' }[] = [
  { mmdd: '11-18', month: 11, day: 18, name: 'Dedication of the Basilicas of Sts. Peter and Paul', color: 'white' },
  { mmdd: '11-23', month: 11, day: 23, name: 'Sts. Clement I and Columban', color: 'red' },
  { mmdd: '12-09', month: 12, day: 9, name: 'St. Juan Diego', color: 'white' },
  { mmdd: '12-29', month: 12, day: 29, name: 'St. Thomas Becket', color: 'red' },
  { mmdd: '12-31', month: 12, day: 31, name: 'St. Sylvester I', color: 'white' },
];

const at = (month: number, day: number) => new Date(2026, month - 1, day, 12);

describe('the five optional memorials', () => {
  for (const s of FIVE) {
    describe(s.mmdd, () => {
      it('feastDays carries the day with the optional-memorial rank and its colour', () => {
        const entry = FIXED_FEASTS[s.mmdd];
        expect(entry, s.mmdd).toBeDefined();
        expect(entry.rank).toBe('optional-memorial');
        expect(entry.color).toBe(s.color);
        expect(entry.name).toBe(s.name);
        const resolved = getFeastForDate(at(s.month, s.day));
        expect(resolved?.name).toBe(s.name);
        expect(resolved?.rank).toBe('optional-memorial');
        expect(getDayRank(at(s.month, s.day)).rank).toBe('optional-memorial');
      });

      it('the theme names the day but keeps the season accent and ferial strength', () => {
        const visual = getDailyVisual(at(s.month, s.day));
        // Named like any saint's day…
        expect(visual.feastName).toBe(s.name);
        expect(visual.feastRank).toBe('optional-memorial');
        expect(visual.feastNote).toBe(FIXED_FEASTS[s.mmdd].note);
        // …but the visual's colour is the season's, never the saint's (for
        // each of the five, the season's colour differs from the saint's).
        expect(visual.colorName).not.toBe(s.color);
        expect(visual.intensity).toBe(0);
        expect(TINT_STRENGTH_BY_RANK['optional-memorial']).toBe(TINT_STRENGTH_BY_RANK.ferial);
        // No marker dot — markers stay obligatory-memorial only.
        expect(getMemorialMarker(at(s.month, s.day))).toBeNull();
      });
    });
  }

  it('the saints list carries each of the five days', () => {
    expect(SAINTS.find((x) => x.feastDate === '11-18')?.name).toBe(
      'Dedication of the Basilicas of Sts. Peter and Paul',
    );
    expect(SAINTS.find((x) => x.feastDate === '12-09')?.name).toBe('St. Juan Diego');
    expect(SAINTS.find((x) => x.feastDate === '12-29')?.name).toBe('St. Thomas Becket');
    expect(SAINTS.find((x) => x.feastDate === '12-31')?.name).toBe('St. Sylvester I');
    // Nov 23 carries both of its saints as their own entries (the list's
    // shared-day shape — cf. Peter and Paul on 06-29).
    const nov23 = SAINTS.filter((x) => x.feastDate === '11-23').map((x) => x.name);
    expect(nov23).toContain('St. Clement I');
    expect(nov23).toContain('St. Columban');
    // St. Miguel Pro keeps the date's first-found place: the narrator tables
    // (frozen for this build) speak his line for Nov 23, so the list's
    // date-keyed face stays his, exactly as before this build.
    expect(SAINTS.find((x) => x.feastDate === '11-23')?.name).toBe('St. Miguel Pro');
  });

  it('in Ordinary Time the season keeps the lead — Nov 18 wears green, not the dedication white', () => {
    const season = getCurrentSeason(at(11, 18)).season;
    expect(season).toBe('ordinary-2');
    expect(memorialTakesLeadInOrdinaryTime('optional-memorial', season)).toBe(false);
    const visual = getDailyVisual(at(11, 18));
    expect(visual.colorName).toBe('green');
    expect(visual.accent).toBe('#1E6B3A'); // the Ordinary Time green, not white's gold #8C6A1F
    expect(getSeasonAccentColor(at(11, 18))).toBe('#1E6B3A');
    expect(getSeasonTheme(at(11, 18)).accent).toBe('#1E6B3A');
    expect(getSeasonTheme(at(11, 18), 'women').accent).toBe('#1E6B3A');
  });

  it('contrast: an obligatory memorial in Ordinary Time DOES take the lead (Josaphat, Nov 12)', () => {
    const season = getCurrentSeason(at(11, 12)).season;
    expect(season).toBe('ordinary-2');
    expect(memorialTakesLeadInOrdinaryTime('memorial', season)).toBe(true);
    expect(getDailyVisual(at(11, 12)).accent).toBe('#A31F1F'); // the martyr's red leads
    expect(getSeasonTheme(at(11, 12)).accent).toBe('#A31F1F');
  });

  it('in the privileged seasons the season also keeps the lead — Juan Diego in Advent violet, Becket in Christmas gold', () => {
    expect(getCurrentSeason(at(12, 9)).season).toBe('advent');
    const juan = getDailyVisual(at(12, 9));
    expect(juan.feastName).toBe('St. Juan Diego');
    expect(juan.colorName).toBe('violet');
    expect(juan.accent).toBe('#5E2A6B'); // Advent violet, not white's gold

    expect(getCurrentSeason(at(12, 29)).season).toBe('christmas');
    const becket = getDailyVisual(at(12, 29));
    expect(becket.feastName).toBe('St. Thomas Becket');
    expect(becket.colorName).toBe('gold');
    expect(becket.accent).toBe('#A67C1A'); // Christmas gold, not the martyr's red #A31F1F
    expect(getSeasonTheme(at(12, 29)).accent).toBe('#A67C1A');
  });

  it('both rank-label tables render the new rank as "Optional Memorial"', () => {
    expect(read('components/SeasonBadge.tsx')).toContain("'optional-memorial': 'Optional Memorial'");
    expect(read('components/DailyQuote.tsx')).toContain("'optional-memorial': 'Optional Memorial'");
  });
});
