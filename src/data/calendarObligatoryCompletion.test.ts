import { describe, it, expect } from 'vitest';
import { COLOR_PALETTES, FIXED_FEASTS, getFeastForDate } from '@/data/feastDays';
import { SAINTS } from '@/data/saints';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import {
  getDayRank,
  getMemorialMarker,
  memorialTakesLeadInOrdinaryTime,
  TINT_STRENGTH_BY_RANK,
} from '@/lib/dayTheme';
import { getDailyVisual } from '@/lib/liturgicalVisuals';
import { getSeasonTheme } from '@/lib/seasonTheme';
import { resolveFeastDay, saintLineFor } from '@/lib/narratorCore';

/**
 * The obligatory-calendar completion (Nov 15, 2026 — Erik approved after
 * the full-year optional audit found ~50 obligatory celebrations missing
 * a face or absent entirely). Every date below is an obligatory memorial
 * or a feast of the General Roman Calendar (plus the US proper calendar's
 * memorials: Seton, Neumann, Kateri), completed end-to-end: feastDays
 * face, saints-list entry, narrator feast table, and — where the date's
 * spoken slot was free — a saint line drawn from the bio's first
 * sentence. These ranks use the standing theme machinery, the mirror
 * image of the optional rule: an obligatory memorial's colour DOES take
 * the accent set in Ordinary Time (Nov 11, 2026), and a feast speaks at
 * feast intensity.
 */
const FACES: { mmdd: string; name: string; rank: 'memorial' | 'feast'; color: 'red' | 'white' }[] = [
  { mmdd: '01-02', name: 'Sts. Basil the Great and Gregory Nazianzen', rank: 'memorial', color: 'white' },
  { mmdd: '01-04', name: 'St. Elizabeth Ann Seton', rank: 'memorial', color: 'white' },
  { mmdd: '01-05', name: 'St. John Neumann', rank: 'memorial', color: 'white' },
  { mmdd: '01-21', name: 'St. Agnes', rank: 'memorial', color: 'red' },
  { mmdd: '01-25', name: 'The Conversion of St. Paul', rank: 'feast', color: 'white' },
  { mmdd: '01-26', name: 'Sts. Timothy and Titus', rank: 'memorial', color: 'white' },
  { mmdd: '01-31', name: 'St. John Bosco', rank: 'memorial', color: 'white' },
  { mmdd: '02-05', name: 'St. Agatha', rank: 'memorial', color: 'red' },
  { mmdd: '02-06', name: 'St. Paul Miki and Companions', rank: 'memorial', color: 'red' },
  { mmdd: '02-10', name: 'St. Scholastica', rank: 'memorial', color: 'white' },
  { mmdd: '02-14', name: 'Sts. Cyril and Methodius', rank: 'memorial', color: 'white' },
  { mmdd: '02-22', name: 'The Chair of St. Peter', rank: 'feast', color: 'white' },
  { mmdd: '02-23', name: 'St. Polycarp', rank: 'memorial', color: 'red' },
  { mmdd: '03-07', name: 'Sts. Perpetua and Felicity', rank: 'memorial', color: 'red' },
  { mmdd: '04-07', name: 'St. John Baptist de la Salle', rank: 'memorial', color: 'white' },
  { mmdd: '04-11', name: 'St. Stanislaus', rank: 'memorial', color: 'red' },
  { mmdd: '05-02', name: 'St. Athanasius', rank: 'memorial', color: 'white' },
  { mmdd: '05-03', name: 'Sts. Philip and James', rank: 'feast', color: 'red' },
  { mmdd: '05-14', name: 'St. Matthias', rank: 'feast', color: 'red' },
  { mmdd: '05-31', name: 'The Visitation', rank: 'feast', color: 'white' },
  { mmdd: '06-01', name: 'St. Justin', rank: 'memorial', color: 'red' },
  { mmdd: '06-05', name: 'St. Boniface', rank: 'memorial', color: 'red' },
  { mmdd: '06-11', name: 'St. Barnabas', rank: 'memorial', color: 'red' },
  { mmdd: '06-21', name: 'St. Aloysius Gonzaga', rank: 'memorial', color: 'white' },
  { mmdd: '06-28', name: 'St. Irenaeus', rank: 'memorial', color: 'red' },
  { mmdd: '07-03', name: 'St. Thomas', rank: 'feast', color: 'red' },
  { mmdd: '07-15', name: 'St. Bonaventure', rank: 'memorial', color: 'white' },
  { mmdd: '07-26', name: 'Sts. Joachim and Anne', rank: 'memorial', color: 'white' },
  { mmdd: '07-29', name: 'Sts. Martha, Mary and Lazarus', rank: 'memorial', color: 'white' },
  { mmdd: '08-01', name: 'St. Alphonsus Liguori', rank: 'memorial', color: 'white' },
  { mmdd: '08-06', name: 'The Transfiguration', rank: 'feast', color: 'white' },
  { mmdd: '08-21', name: 'St. Pius X', rank: 'memorial', color: 'white' },
  { mmdd: '08-22', name: 'Queenship of the Blessed Virgin Mary', rank: 'memorial', color: 'white' },
  { mmdd: '08-24', name: 'St. Bartholomew', rank: 'feast', color: 'red' },
  { mmdd: '08-27', name: 'St. Monica', rank: 'memorial', color: 'white' },
  { mmdd: '08-29', name: 'The Passion of St. John the Baptist', rank: 'memorial', color: 'red' },
  { mmdd: '09-08', name: 'Nativity of the Blessed Virgin Mary', rank: 'feast', color: 'white' },
  { mmdd: '09-13', name: 'St. John Chrysostom', rank: 'memorial', color: 'white' },
  { mmdd: '09-16', name: 'Sts. Cornelius and Cyprian', rank: 'memorial', color: 'red' },
  { mmdd: '09-20', name: 'Sts. Andrew Kim Tae-gŏn, Paul Chŏng Ha-sang and Companions', rank: 'memorial', color: 'red' },
  { mmdd: '09-27', name: 'St. Vincent de Paul', rank: 'memorial', color: 'white' },
  { mmdd: '09-30', name: 'St. Jerome', rank: 'memorial', color: 'white' },
  { mmdd: '10-17', name: 'St. Ignatius of Antioch', rank: 'memorial', color: 'red' },
  { mmdd: '11-04', name: 'St. Charles Borromeo', rank: 'memorial', color: 'white' },
  { mmdd: '11-09', name: 'Dedication of the Lateran Basilica', rank: 'feast', color: 'white' },
  { mmdd: '11-10', name: 'St. Leo the Great', rank: 'memorial', color: 'white' },
];

/** The first year in 2024–2031 where the fixed entry is the day's face
 *  (a movable solemnity can shadow a fixed date in a given year — the
 *  Ascension takes May 14 in 2026, Trinity Sunday takes May 31). */
function resolvingDate(mmdd: string, name: string): Date {
  const [mm, dd] = mmdd.split('-').map(Number);
  for (let year = 2024; year <= 2031; year++) {
    const date = new Date(year, mm - 1, dd, 12);
    const resolved = getFeastForDate(date);
    if (resolved?.name === name) return date;
  }
  throw new Error(`${mmdd} (${name}) never resolves as the day's face in 2024–2031`);
}

describe('the obligatory completion — every restored face', () => {
  it('the feast table carries each date at its rank and colour', () => {
    for (const f of FACES) {
      const entry = FIXED_FEASTS[f.mmdd];
      expect(entry, f.mmdd).toBeDefined();
      expect(entry.name, f.mmdd).toBe(f.name);
      expect(entry.rank, f.mmdd).toBe(f.rank);
      expect(entry.color, f.mmdd).toBe(f.color);
    }
  });

  it('every date resolves via getFeastForDate and the narrator resolver, at feast/memorial strength', () => {
    for (const f of FACES) {
      const date = resolvingDate(f.mmdd, f.name);
      expect(getDayRank(date).rank, f.mmdd).toBe(f.rank);
      const visual = getDailyVisual(date);
      expect(visual.feastName, f.mmdd).toBe(f.name);
      expect(visual.feastRank, f.mmdd).toBe(f.rank);
      // Unlike an optional memorial, an obligatory day wears its OWN colour.
      expect(visual.colorName, f.mmdd).toBe(f.color);
      expect(visual.intensity, f.mmdd).toBe(f.rank === 'feast' ? 2 : 1);
      const iso = `${date.getFullYear()}-${f.mmdd}`;
      expect(resolveFeastDay(iso), f.mmdd).toEqual({ name: f.name, rank: f.rank });
      if (f.rank === 'memorial') {
        expect(getMemorialMarker(date)?.colorName, f.mmdd).toBe(f.color);
        expect(TINT_STRENGTH_BY_RANK.memorial, f.mmdd).toBe(1);
      } else {
        expect(TINT_STRENGTH_BY_RANK.feast, f.mmdd).toBe(1.75);
      }
    }
  });

  it('every face date carries a saints-list entry — except the two feast-table-only days', () => {
    // The Transfiguration and the Chair of St. Peter are feasts of the
    // Lord / of the apostolic see: like the Presentation of the Lord and
    // the Epiphany, they live in the feast tables only, with no
    // saints-list entry and no saint line.
    for (const f of FACES) {
      if (f.mmdd === '08-06' || f.mmdd === '02-22') continue;
      expect(SAINTS.some((x) => x.feastDate === f.mmdd), f.mmdd).toBe(true);
    }
    expect(SAINTS.some((x) => x.feastDate === '08-06')).toBe(false);
    expect(SAINTS.some((x) => x.feastDate === '02-22')).toBe(false);
    expect(saintLineFor('2026-08-06')).toBeNull();
    expect(saintLineFor('2027-02-22')).toBeNull();
  });
});

describe('the standing accent rule, now exercised by the restored days', () => {
  it('an Ordinary Time memorial takes the lead accent set — Justin in red, Monica in white-gold', () => {
    const justin = new Date(2026, 5, 1, 12);
    expect(getCurrentSeason(justin).season).toBe('ordinary-2');
    expect(memorialTakesLeadInOrdinaryTime('memorial', 'ordinary-2')).toBe(true);
    expect(getDailyVisual(justin).accent).toBe('#A31F1F');
    expect(getSeasonTheme(justin).accent).toBe('#A31F1F');

    const monica = new Date(2026, 7, 27, 12);
    expect(getCurrentSeason(monica).season).toBe('ordinary-2');
    expect(getDailyVisual(monica).accent).toBe('#8C6A1F');
    expect(getSeasonTheme(monica).accent).toBe('#8C6A1F');
  });

  it('a Lent memorial is named in its own colour but the season keeps the theme lead (Polycarp)', () => {
    const polycarp = new Date(2026, 1, 23, 12);
    expect(getCurrentSeason(polycarp).season).toBe('lent');
    expect(memorialTakesLeadInOrdinaryTime('memorial', 'lent')).toBe(false);
    expect(getDailyVisual(polycarp).feastName).toBe('St. Polycarp');
    expect(getDailyVisual(polycarp).colorName).toBe('red');
    expect(getSeasonTheme(polycarp).accent).toBe('#5E2A6B'); // Lent violet leads the theme
    expect(getMemorialMarker(polycarp)?.colorName).toBe('red');
  });

  it('feasts speak at feast intensity in any season — Transfiguration, Lateran, Chair of Peter', () => {
    expect(getDailyVisual(new Date(2026, 7, 6, 12)).intensity).toBe(2);
    expect(getDailyVisual(new Date(2026, 10, 9, 12)).intensity).toBe(2);
    expect(getDailyVisual(new Date(2027, 1, 22, 12)).intensity).toBe(2);
    expect(COLOR_PALETTES.white.accent).toBe('#8C6A1F');
  });
});

describe('Peter Claver, raised to his US rank (Sep 9)', () => {
  it('is an obligatory memorial in both tables, and no longer in the optional set', () => {
    expect(FIXED_FEASTS['09-09'].rank).toBe('memorial');
    expect(resolveFeastDay('2026-09-09')).toEqual({ name: 'St. Peter Claver', rank: 'memorial' });
    const date = new Date(2026, 8, 9, 12);
    expect(getDayRank(date).rank).toBe('memorial');
    expect(getMemorialMarker(date)?.colorName).toBe('white');
    // His line and bio predate the raise and are untouched.
    expect(saintLineFor('2026-09-09')).toContain('slave ships');
  });
});

describe('Feb 14 — the face changes, the voice does not', () => {
  it('the calendar face is Cyril & Methodius; the spoken slot stays Valentine', () => {
    // Erik's ruling for Feb 14 (Nov 15, 2026): the obligatory memorial
    // owns the day's face — St. Valentine left the General Roman Calendar
    // in 1969 — but his data and his saint line are NOT deleted or moved.
    // The result is the Nov 23 pattern (Miguel Pro): the visual face and
    // the spoken identity diverge, deliberately.
    const date = new Date(2026, 1, 14, 12);
    expect(getFeastForDate(date)?.name).toBe('Sts. Cyril and Methodius');
    expect(getFeastForDate(date)?.rank).toBe('memorial');
    expect(getFeastForDate(date)?.color).toBe('white');
    expect(resolveFeastDay('2026-02-14')).toEqual({ name: 'Sts. Cyril and Methodius', rank: 'memorial' });
    // Valentine keeps the saints list's first-found place for the date…
    expect(SAINTS.find((x) => x.feastDate === '02-14')?.name).toBe('St. Valentine');
    // …and his line still speaks for the date, word for word as before.
    const valentine = SAINTS.find((x) => x.feastDate === '02-14')!;
    const firstSentence = valentine.shortBio.split(/(?<=[.!?])\s/)[0].trim();
    expect(saintLineFor('2026-02-14')).toBe(firstSentence);
    // Cyril and Methodius are present as their own entries.
    const names = SAINTS.filter((x) => x.feastDate === '02-14').map((x) => x.name);
    expect(names).toContain('St. Cyril');
    expect(names).toContain('St. Methodius');
  });
});

describe('held slots and the held face', () => {
  it('Jan 21: Agnes takes the face; Meinrad keeps the spoken slot', () => {
    // St. Meinrad — a non-calendar bank saint — has held Jan 21's saint
    // line all along. Agnes gains face, bio, and feast-table entry; the
    // slot does not change hands (the Anselm / Miguel Pro pattern).
    expect(FIXED_FEASTS['01-21'].name).toBe('St. Agnes');
    expect(SAINTS.some((x) => x.feastDate === '01-21' && x.name === 'St. Agnes')).toBe(true);
    expect(saintLineFor('2027-01-21')).toContain('hermit');
  });

  it('Sep 20: Andrew Kim & Companions take the face; Eustace keeps the spoken slot', () => {
    // St. Eustace, a non-calendar bank saint, holds Sep 20's line. The
    // Korean martyrs gain face, bios, and feast-table entry only.
    expect(FIXED_FEASTS['09-20'].name).toBe('Sts. Andrew Kim Tae-gŏn, Paul Chŏng Ha-sang and Companions');
    expect(SAINTS.some((x) => x.feastDate === '09-20' && x.name === 'St. Andrew Kim Tae-gŏn')).toBe(true);
    expect(SAINTS.some((x) => x.feastDate === '09-20' && x.name === 'St. Paul Chŏng Ha-sang')).toBe(true);
    expect(saintLineFor('2026-09-20')).toContain('Roman general');
  });

  it('Jul 14: the face stays Camillus — Kateri gains a bio only', () => {
    // In the US calendar Kateri Tekakwitha (memorial) holds Jul 14 and
    // Camillus de Lellis moves to Jul 18 — but US transfer dates for
    // existing entries are out of scope for this build, and Camillus's
    // face is an obligatory memorial, not an optional one the completion
    // may displace. So the face and the line stay Camillus's; Kateri is
    // present in the saints list, awaiting a transfer ruling.
    const date = new Date(2026, 6, 14, 12);
    expect(getFeastForDate(date)?.name).toBe('St. Camillus de Lellis');
    expect(resolveFeastDay('2026-07-14')).toEqual({ name: 'St. Camillus de Lellis', rank: 'memorial' });
    expect(SAINTS.some((x) => x.feastDate === '07-14' && x.name === 'St. Kateri Tekakwitha')).toBe(true);
    expect(saintLineFor('2026-07-14')).toContain('gambling addict');
  });
});
