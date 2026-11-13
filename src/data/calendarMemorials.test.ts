import { describe, it, expect } from 'vitest';
import { FIXED_FEASTS, getFeastForDate, COLOR_PALETTES } from '@/data/feastDays';
import { SAINTS } from '@/data/saints';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import { getDayRank, getMemorialMarker, memorialTakesLeadInOrdinaryTime } from '@/lib/dayTheme';
import { resolveFeastDay, saintLineFor } from '@/lib/narratorCore';
import { tonightSaintName } from '@/lib/tonight';

/**
 * The six obligatory memorials added Nov 13, 2026 (Erik approved) — they were
 * missing from BOTH calendar layers, so Nov 13 rendered as a green ferial day
 * named for St. Homobonus instead of St. Frances Xavier Cabrini. These tests
 * pin the feast calendar, the saint-of-the-day data, the narrator's ported
 * tables, and the theme resolver into agreement for each of the six dates.
 */
const SIX: { mmdd: string; month: number; day: number; name: string; color: 'red' | 'white' }[] = [
  { mmdd: '11-12', month: 11, day: 12, name: 'St. Josaphat', color: 'red' },
  { mmdd: '11-13', month: 11, day: 13, name: 'St. Frances Xavier Cabrini', color: 'white' },
  { mmdd: '11-17', month: 11, day: 17, name: 'St. Elizabeth of Hungary', color: 'white' },
  { mmdd: '11-21', month: 11, day: 21, name: 'Presentation of the Blessed Virgin Mary', color: 'white' },
  { mmdd: '11-24', month: 11, day: 24, name: 'Sts. Andrew Dung-Lac and Companions', color: 'red' },
  { mmdd: '12-07', month: 12, day: 7, name: 'St. Ambrose', color: 'white' },
];

const at = (month: number, day: number) => new Date(2026, month - 1, day, 12);
const iso = (month: number, day: number) =>
  `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

describe('the six restored obligatory memorials', () => {
  for (const s of SIX) {
    describe(s.mmdd, () => {
      it('feastDays carries the memorial with its rank and colour', () => {
        const entry = FIXED_FEASTS[s.mmdd];
        expect(entry, s.mmdd).toBeDefined();
        expect(entry.rank).toBe('memorial');
        expect(entry.color).toBe(s.color);
        expect(entry.name).toBe(s.name);
        expect(getFeastForDate(at(s.month, s.day))?.name).toBe(s.name);
      });

      it('saint-of-the-day resolution returns the right saint everywhere', () => {
        const listed = SAINTS.find((x) => x.feastDate === s.mmdd);
        expect(listed?.name, s.mmdd).toBe(s.name);
        // The Tonight closing resolves exactly as the Saint of the Day card does.
        expect(tonightSaintName(at(s.month, s.day))).toBe(s.name);
      });

      it('the narrator tables agree — feast name, and the saint line is the bio\'s first sentence', () => {
        expect(resolveFeastDay(iso(s.month, s.day))?.name).toBe(s.name);
        expect(resolveFeastDay(iso(s.month, s.day))?.rank).toBe('memorial');
        const listed = SAINTS.find((x) => x.feastDate === s.mmdd)!;
        const firstSentence = listed.shortBio.split(/(?<=[.!?])\s/)[0].trim();
        expect(saintLineFor(iso(s.month, s.day))).toBe(firstSentence);
      });

      it('the theme resolves a memorial carrying the right accent colour', () => {
        const { rank, feast } = getDayRank(at(s.month, s.day));
        expect(rank).toBe('memorial');
        expect(feast?.color).toBe(s.color);
        expect(getMemorialMarker(at(s.month, s.day))?.colorName).toBe(s.color);
        // Red speaks in the red palette; white memorials speak in the gold family.
        const expectedAccent = s.color === 'red' ? '#A31F1F' : '#8C6A1F';
        expect(COLOR_PALETTES[s.color].accent).toBe(expectedAccent);
      });
    });
  }

  it('Cabrini, not Homobonus, holds Nov 13', () => {
    const listed = SAINTS.find((x) => x.feastDate === '11-13');
    expect(listed?.name).toBe('St. Frances Xavier Cabrini');
    expect(tonightSaintName(at(11, 13))).toBe('St. Frances Xavier Cabrini');
    expect(saintLineFor('2026-11-13')).toContain('Italian nun');
    expect(saintLineFor('2026-11-13')).not.toContain('Homobonus');
  });

  it('in Ordinary Time the five November memorials take the lead accent set', () => {
    for (const s of SIX.filter((x) => x.month === 11)) {
      const season = getCurrentSeason(at(s.month, s.day)).season;
      expect(season, s.mmdd).toBe('ordinary-2');
      expect(memorialTakesLeadInOrdinaryTime('memorial', season), s.mmdd).toBe(true);
    }
  });

  it('Dec 7 falls in Advent, where the season keeps the lead — the memorial is still ranked and marked', () => {
    const season = getCurrentSeason(at(12, 7)).season;
    expect(season).toBe('advent');
    expect(memorialTakesLeadInOrdinaryTime('memorial', season)).toBe(false);
    expect(getDayRank(at(12, 7)).rank).toBe('memorial');
    expect(getMemorialMarker(at(12, 7))?.colorName).toBe('white');
  });
});
