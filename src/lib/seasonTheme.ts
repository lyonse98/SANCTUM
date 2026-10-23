import { type LiturgicalSeason } from '@/data/liturgicalCalendar';
import { makeLightTheme } from '@/lib/theme';
import { getDailyVisual, type DailyVisual } from '@/lib/liturgicalVisuals';
import type { PersonaTheme } from '@/types';

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

/** A full theme following the day's liturgical visual — richer and rotated daily. */
export function getSeasonTheme(date: Date = new Date()): PersonaTheme {
  const visual = getDailyVisual(date);
  return makeLightTheme({
    accent: visual.accent,
    accentBright: visual.accentBright,
    accentDark: visual.accentDark,
    tint: visual.tint,
  });
}

export function getSeasonAccentColor(date: Date = new Date()): string {
  return getDailyVisual(date).accent;
}

export { getDailyVisual };
export type { DailyVisual };
