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

/**
 * The full-year completion (Nov 15, 2026 — Erik's "do the rest of the
 * year"): every optional memorial of the General Roman Calendar plus the
 * US proper calendar's optional additions, under the same rule — named,
 * ranked 'optional-memorial', the season keeps the accent set. The set
 * below is the audit's: the five above + 76 more dates, MINUS one —
 * St. Peter Claver (09-09) was raised to 'memorial' by the obligatory
 * completion later the same day, because the US calendar ranks him an
 * obligatory memorial; the set is now 80 dates. Two GRC optionals
 * are deliberately absent: Gregory of Narek (02-27) and Stephen of
 * Hungary (08-16) — those dates' narrator lines already belong to
 * non-calendar saints of the bank (Gabriel Possenti, Roch), and existing
 * entries win; they are skipped-by-collision, not oversights.
 */
const FULL_YEAR: string[] = [
  '01-03', '01-07', '01-13', '01-22', '01-23', '01-27',
  '02-08', '02-17', '02-21',
  '03-03', '03-04', '03-08', '03-09', '03-18', '03-23',
  '04-02', '04-04', '04-05', '04-13', '04-24', '04-28', '04-30',
  '05-01', '05-10', '05-12', '05-18', '05-20', '05-21', '05-25', '05-27', '05-29',
  '06-02', '06-06', '06-09', '06-19', '06-22', '06-27',
  '07-01', '07-04', '07-05', '07-06', '07-09', '07-13', '07-20', '07-21', '07-23', '07-24', '07-30',
  '08-02', '08-05', '08-07', '08-09', '08-12', '08-13', '08-19', '08-23',
  '09-12', '09-17', '09-19', '09-26', '09-28',
  '10-06', '10-09', '10-11', '10-14', '10-16', '10-23',
  '11-15', '11-16', '11-18', '11-23', '11-25',
  '12-04', '12-09', '12-10', '12-11', '12-21', '12-23', '12-29', '12-31',
];

describe('the full-year optional memorials', () => {
  it('the optional-memorial set is exactly the audited full-year set', () => {
    const actual = Object.entries(FIXED_FEASTS)
      .filter(([, f]) => f.rank === 'optional-memorial')
      .map(([mmdd]) => mmdd)
      .sort();
    expect(actual).toEqual([...FULL_YEAR].sort());
    expect(FIXED_FEASTS['02-27']).toBeUndefined();
    expect(FIXED_FEASTS['08-16']).toBeUndefined();
  });

  it('every optional date resolves via getFeastForDate with the season palette', () => {
    for (const mmdd of FULL_YEAR) {
      const [mm, dd] = mmdd.split('-').map(Number);
      // The app's plain MM-DD semantics can shadow a fixed date behind a
      // movable feast in a given year (Holy Week, Easter): take the first
      // year in 2024–2031 where the fixed entry is the day's face.
      let checked = false;
      for (let year = 2024; year <= 2031 && !checked; year++) {
        const date = new Date(year, mm - 1, dd, 12);
        const resolved = getFeastForDate(date);
        if (resolved?.rank !== 'optional-memorial' || resolved?.name !== FIXED_FEASTS[mmdd].name) continue;
        const visual = getDailyVisual(date);
        expect(visual.feastName, mmdd).toBe(FIXED_FEASTS[mmdd].name);
        expect(visual.feastRank, mmdd).toBe('optional-memorial');
        expect(getDayRank(date).rank, mmdd).toBe('optional-memorial');
        // The season keeps the accent set — in every season.
        expect(visual.accent, mmdd).toBe(getSeasonTheme(date).accent);
        expect(visual.accent, mmdd).toBe(getSeasonAccentColor(date));
        expect(visual.intensity, mmdd).toBe(0);
        expect(getMemorialMarker(date), mmdd).toBeNull();
        checked = true;
      }
      expect(checked, `${mmdd} never resolves as the day's face in 2024–2031`).toBe(true);
    }
  });

  it('spot checks across seasons — the saint colour never surfaces', () => {
    // Januarius is a red martyr in Ordinary Time: the day wears green.
    const jan = getDailyVisual(at(9, 19));
    expect(jan.feastName).toBe('St. Januarius');
    expect(jan.accent).toBe('#1E6B3A');
    // Drexel falls in Lent: violet, not white's gold.
    const drexel = getDailyVisual(at(3, 3));
    expect(drexel.feastName).toBe('St. Katharine Drexel');
    expect(drexel.accent).toBe('#5E2A6B');
    // John of Kanty in late Advent: violet.
    const kanty = getDailyVisual(at(12, 23));
    expect(kanty.feastName).toBe('St. John of Kanty');
    expect(kanty.accent).toBe('#5E2A6B');
    // Goretti is a red martyr in Ordinary Time: green, never her red.
    const goretti = getDailyVisual(at(7, 6));
    expect(goretti.feastName).toBe('St. Maria Goretti');
    expect(goretti.accent).toBe('#1E6B3A');
    // Serra (a US-proper addition) in Ordinary Time: green.
    const serra = getDailyVisual(at(7, 1));
    expect(serra.feastName).toBe('St. Junípero Serra');
    expect(serra.accent).toBe('#1E6B3A');
    // The Holy Name of Jesus in the Christmas season (Jan 3, 2027):
    // Christmas gold.
    const holyName = getDailyVisual(new Date(2027, 0, 3, 12));
    expect(holyName.feastName).toBe('The Most Holy Name of Jesus');
    expect(holyName.accent).toBe('#A67C1A');
  });

  it('every optional date has at least one saints-list entry', () => {
    for (const mmdd of FULL_YEAR) {
      expect(SAINTS.some((x) => x.feastDate === mmdd), mmdd).toBe(true);
    }
  });
});
