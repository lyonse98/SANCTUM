import { getCurrentSeason, type LiturgicalSeason } from '@/data/liturgicalCalendar';
import { COLOR_PALETTES, getFeastForDate, type FeastRank, type LiturgicalColor } from '@/data/feastDays';

export interface DailyVisual {
  season: LiturgicalSeason;
  seasonName: string;
  /** Feast or solemnity name — null on an ordinary day. */
  feastName: string | null;
  feastRank: FeastRank | null;
  /** One-line description of what the day celebrates. */
  feastNote: string | null;
  /** The day's liturgical colour, named as the Church names it. */
  colorName: LiturgicalColor;
  accent: string;
  accentBright: string;
  accentDark: string;
  tint: string;
  glyph: string;
  motif: string;
  /**
   * How loudly the day should announce itself: 0 = ordinary day, 1 = memorial,
   * 2 = feast, 3 = solemnity. Drives backdrop strength and ornamentation.
   */
  intensity: 0 | 1 | 2 | 3;
}

/** The liturgical colour the Church wears during each season. */
const SEASON_COLOR: Record<LiturgicalSeason, LiturgicalColor> = {
  advent: 'violet',
  christmas: 'gold',
  lent: 'violet',
  easter: 'gold',
  'ordinary-1': 'green',
  'ordinary-2': 'green',
};

/** Rotating glyphs so ordinary days still feel fresh within their colour. */
const SEASON_GLYPHS: Record<LiturgicalColor, string[]> = {
  white: ['✦', '❦'],
  gold: ['☀', '✦'],
  red: ['✝', '❦'],
  green: ['❧', '✿'],
  violet: ['✧', '✝'],
  rose: ['❦', '✦'],
  black: ['✝', '☾'],
  blue: ['✦', '❄'],
};

/** Rotating motifs so ordinary days change face without contradicting the colour. */
const SEASON_MOTIFS: Record<LiturgicalColor, string[]> = {
  white: ['cloister light', 'altar linen'],
  gold: ['gilded altar', 'crown of light'],
  red: ['martyr\'s palm', 'tongues of flame'],
  green: ['cloister garden', 'vine and branch', 'living water'],
  violet: ['penitential purple', 'watchtower', 'deep night sky'],
  rose: ['rose candle', 'rose of Jerusalem'],
  black: ['candles and remembrance', 'sealed tomb'],
  blue: ['starry vault', 'tilma of roses'],
};

const RANK_INTENSITY: Record<FeastRank, 1 | 2 | 3> = {
  memorial: 1,
  feast: 2,
  solemnity: 3,
};

function dayOfYear(date: Date): number {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
}

/**
 * The day's full visual identity. Special days — solemnities, feasts, and memorials —
 * override the season with their own liturgical colour; ordinary days wear the season's colour,
 * with the shade and ornament rotating daily so the app still feels new each morning.
 */
export function getDailyVisual(date: Date = new Date()): DailyVisual {
  const season = getCurrentSeason(date);
  const feast = getFeastForDate(date);
  const doy = dayOfYear(date);

  if (feast) {
    const palette = COLOR_PALETTES[feast.color];
    return {
      season: season.season,
      seasonName: season.name,
      feastName: feast.name,
      feastRank: feast.rank,
      feastNote: feast.note,
      colorName: feast.color,
      ...palette,
      glyph: feast.glyph,
      motif: feast.motif,
      intensity: RANK_INTENSITY[feast.rank],
    };
  }

  const color = SEASON_COLOR[season.season];
  const palette = COLOR_PALETTES[color];
  const glyphs = SEASON_GLYPHS[color];
  const motifs = SEASON_MOTIFS[color];

  return {
    season: season.season,
    seasonName: season.name,
    feastName: null,
    feastRank: null,
    feastNote: null,
    colorName: color,
    ...palette,
    glyph: glyphs[doy % glyphs.length],
    motif: motifs[doy % motifs.length],
    intensity: 0,
  };
}
