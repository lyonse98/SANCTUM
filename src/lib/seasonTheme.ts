import { type LiturgicalSeason } from '@/data/liturgicalCalendar';
import { makeLightTheme } from '@/lib/theme';
import { getDayRank, memorialTakesLeadInOrdinaryTime, TINT_STRENGTH_BY_RANK } from '@/lib/dayTheme';
import { getDailyVisual, getSeasonPalette, type DailyVisual } from '@/lib/liturgicalVisuals';
import type { Audience, PersonaTheme } from '@/types';

interface SeasonAccent {
  accent: string;
  accentBright: string;
  accentDark: string;
  tint: string;
}

/** Legacy per-season accents, kept for callers that only need a colour string. */
const SEASON_ACCENTS: Record<LiturgicalSeason, SeasonAccent> = {
  advent: { accent: '#3B4A8C', accentBright: '#5566B8', accentDark: '#2A3668', tint: '59,74,140' },
  christmas: { accent: '#A31F1F', accentBright: '#C72E2E', accentDark: '#7E1616', tint: '163,31,31' },
  'ordinary-1': { accent: '#1E6B3A', accentBright: '#2A8A4E', accentDark: '#15502B', tint: '30,107,58' },
  'ordinary-2': { accent: '#1E6B3A', accentBright: '#2A8A4E', accentDark: '#15502B', tint: '30,107,58' },
  lent: { accent: '#5E2A6B', accentBright: '#7A3F8A', accentDark: '#451E52', tint: '94,42,107' },
  easter: { accent: '#B8860B', accentBright: '#DAA520', accentDark: '#94690A', tint: '184,134,11' },
};

export function getSeasonAccent(season: LiturgicalSeason): SeasonAccent {
  return SEASON_ACCENTS[season];
}

/**
 * A full theme following the day, graded by the rank ladder (lib/dayTheme).
 * The season is the default voice; a feast lets the day's own colour lead and
 * deepens the ground's tint wash; a solemnity deepens the wash ~3x so the
 * whole ground takes the day's tint — still light, on both tracks.
 *
 * Memorials: in the privileged seasons the season palette leads exactly as
 * on a ferial, and the saint is honoured by a colour marker on their card
 * instead. In Ordinary Time (Erik, Nov 11, 2026) the saint's colour takes
 * the lead accent set — the visual already carries the saint's palette, so
 * the seed stands — while the season's tint still washes the ground at
 * ferial strength (the washTint seam in lib/theme). Under calendar
 * supremacy (Erik, Nov 11, 2026) whichever colour this ladder chooses is
 * the app's only accent; the tracks add none of their own.
 *
 * The audience only chooses the neutral ground the day stands on (see
 * lib/theme). Default is the men's ground, so every existing caller is
 * unchanged in signature.
 */
export function getSeasonTheme(date: Date = new Date(), audience: Audience = 'men'): PersonaTheme {
  const visual = getDailyVisual(date);
  const { rank } = getDayRank(date);

  let seed: SeasonAccent = {
    accent: visual.accent,
    accentBright: visual.accentBright,
    accentDark: visual.accentDark,
    tint: visual.tint,
  };
  let washTint: string | undefined;
  if (rank === 'memorial') {
    if (memorialTakesLeadInOrdinaryTime(rank, visual.season)) {
      // The saint leads the accent set; the season keeps the ground.
      washTint = getSeasonPalette(visual.season).tint;
    } else {
      seed = { ...getSeasonPalette(visual.season) };
    }
  }

  return makeLightTheme(seed, audience, {
    tintStrength: TINT_STRENGTH_BY_RANK[rank],
    washTint,
  });
}

export function getSeasonAccentColor(date: Date = new Date()): string {
  return getDailyVisual(date).accent;
}

export { getDailyVisual };
export type { DailyVisual };
