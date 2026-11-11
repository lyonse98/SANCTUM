import { getFeastForDate, type FeastDay, type LiturgicalColor } from '@/data/feastDays';
import type { LiturgicalSeason } from '@/data/liturgicalCalendar';

/**
 * The rank ladder (Erik's final theme system, Nov 10, 2026): how loudly a day
 * may speak in the theme. The calendar underneath (data/feastDays) is the one
 * both tracks keep; this module only grades the day against it.
 *
 * - ferial: the season leads, exactly as on any ordinary day.
 * - memorial: the season leads and the saint is honoured with a small colour
 *   marker on the Saint of the Day card (below) — with ONE exception, ruled
 *   by Erik on Nov 11, 2026 after living with the ladder for a day: in
 *   Ordinary Time the saint's colour takes the lead accent set and the green
 *   steps back to the ground wash and the season chip. Ordinary Time is the
 *   Church's unprivileged season — as at Mass, where a memorial's vestments
 *   are the saint's colour, not green. In the privileged seasons (Advent,
 *   Lent, Christmas, Easter) a memorial keeps the season's lead, as before.
 * - feast: the day's own liturgical colour takes the lead accent, and the
 *   tint wash in the ground deepens modestly.
 * - solemnity (and the great days — Easter, Christmas, Pentecost): the
 *   ground takes the day's tint at ~3x the ferial strength — deeper tinted
 *   light, still the light family, both tracks converging on one tint.
 *
 * Since Erik's calendar-supremacy ruling (Nov 11, 2026) the ladder's accent
 * is the only accent in the app — the tracks keep no secondary accent
 * colours, so there is no accent budget and nothing retires; the colour
 * this module chooses is simply the colour everything wears.
 */
export type DayRank = 'ferial' | 'memorial' | 'feast' | 'solemnity';

export interface DayRankInfo {
  rank: DayRank;
  /** The day's observance from the shared calendar, or null on a ferial. */
  feast: FeastDay | null;
}

export function getDayRank(date: Date): DayRankInfo {
  const feast = getFeastForDate(date);
  if (!feast) return { rank: 'ferial', feast: null };
  return { rank: feast.rank, feast };
}

/** Ground-tint strength per rank — 1 is the ferial wash every day has always had. */
export const TINT_STRENGTH_BY_RANK: Record<DayRank, number> = {
  ferial: 1,
  memorial: 1,
  feast: 1.75,
  solemnity: 3,
};

/**
 * True when a memorial's saint takes the lead accent set: the day is a
 * memorial AND the season is Ordinary Time (either half). In the privileged
 * seasons a memorial never takes the lead — the season rides primary there.
 */
export function memorialTakesLeadInOrdinaryTime(rank: DayRank, season: LiturgicalSeason): boolean {
  return rank === 'memorial' && (season === 'ordinary-1' || season === 'ordinary-2');
}

export interface MemorialMarker {
  /** The saint's liturgical colour, as the calendar names it. */
  colorName: LiturgicalColor;
  /** The dot's fill. */
  fill: string;
  /** A ring colour for fills too light to read on the ground (white), else null. */
  ring: string | null;
}

/**
 * How each liturgical colour is drawn as the Saint of the Day marker dot.
 * Red is a martyr; white is a virgin or confessor — drawn as an ivory dot
 * with a gold ring so it reads on the app's light grounds. The remaining
 * colours draw in the deep renderings the feast palettes already use.
 */
export const MEMORIAL_MARKERS: Record<LiturgicalColor, MemorialMarker> = {
  white: { colorName: 'white', fill: '#FDFAF2', ring: '#B08A2E' },
  gold: { colorName: 'gold', fill: '#A67C1A', ring: null },
  red: { colorName: 'red', fill: '#A31F1F', ring: null },
  green: { colorName: 'green', fill: '#1E6B3A', ring: null },
  violet: { colorName: 'violet', fill: '#5E2A6B', ring: null },
  rose: { colorName: 'rose', fill: '#B0526B', ring: null },
  black: { colorName: 'black', fill: '#3A3A42', ring: null },
  blue: { colorName: 'blue', fill: '#2A4E8C', ring: null },
};

/**
 * The marker for a day, or null when the day earns none: only memorials are
 * marked. Feasts and solemnities speak through the whole theme instead.
 */
export function getMemorialMarker(date: Date): MemorialMarker | null {
  const { rank, feast } = getDayRank(date);
  if (rank !== 'memorial' || !feast) return null;
  return MEMORIAL_MARKERS[feast.color];
}
