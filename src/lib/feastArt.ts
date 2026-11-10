import { getFeastForDate, type FeastDay } from '@/data/feastDays';
import { getCurrentSeason, type LiturgicalSeason } from '@/data/liturgicalCalendar';
import type { Audience } from '@/types';

/**
 * The Illuminated Garden: on the Church's great days, the women's Today screen opens
 * with the day itself — sacred art full-bleed, the feast's name set large over it.
 * The calendar underneath is the same one both tracks keep (data/feastDays); this
 * layer only decides when a day is big enough to wear art, and which of the app's
 * existing images it wears. No new images: Our Lady's portrait for her days, the
 * season backdrops the app already ships for the other solemnities.
 *
 * The men's track never enters here — getFeastArt returns null for it on every day
 * of the year, and the men's hero renders exactly as it always has.
 */

/**
 * The days that are hers — keyed by the exact names the calendar gives them.
 * A Marian memorial or feast earns the art treatment even below solemnity rank;
 * every other day must be a solemnity to earn it.
 */
export const MARIAN_FEAST_NAMES: ReadonlySet<string> = new Set([
  'Mary, Mother of God',
  'Our Lady of Lourdes',
  'The Annunciation',
  'Our Lady of Fatima',
  'Our Lady of Mount Carmel',
  'The Assumption',
  'Our Lady of Sorrows',
  'Our Lady of the Rosary',
  'The Immaculate Conception',
  'Our Lady of Guadalupe',
]);

/** The season photographs already in the app (SeasonBackdrop's set), for solemnities that are not hers. */
const SEASON_ART: Record<LiturgicalSeason, string> = {
  advent: '/backdrops/advent.webp',
  christmas: '/backdrops/christmas.webp',
  lent: '/backdrops/lent.webp',
  easter: '/backdrops/easter.webp',
  'ordinary-1': '/backdrops/ordinary.webp',
  'ordinary-2': '/backdrops/ordinary.webp',
};

export interface FeastArt {
  feast: FeastDay;
  /** True when the day is Our Lady's own — the art is her portrait. */
  marian: boolean;
  /** An image the app already ships. */
  image: string;
}

/**
 * The feast art for a day, or null when the day wears the ordinary layout:
 * every day on the men's track, every ordinary day on the women's, and every
 * non-Marian feast or memorial on the women's.
 */
export function getFeastArt(date: Date, audience: Audience): FeastArt | null {
  if (audience !== 'women') return null;
  const feast = getFeastForDate(date);
  if (!feast) return null;
  const marian = MARIAN_FEAST_NAMES.has(feast.name);
  if (!marian && feast.rank !== 'solemnity') return null;
  return {
    feast,
    marian,
    image: marian ? '/mary.webp' : SEASON_ART[getCurrentSeason(date).season],
  };
}
