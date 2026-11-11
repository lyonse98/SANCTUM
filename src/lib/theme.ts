import type { Audience, PersonaTheme } from '@/types';

interface ThemeSeed {
  accent: string;
  accentBright: string;
  accentDark: string;
  tint: string;
}

export interface ThemeOptions {
  /**
   * How deeply the day's tint washes the ground. 1 is the ferial wash every
   * theme has always had; feasts deepen it, solemnities deepen it ~3x — the
   * ground itself stays in the light family on every day of the year.
   */
  tintStrength?: number;
  /**
   * The accent budget: on feasts and solemnities the day's own colour leads,
   * and the track's secondary accents retire to their desaturated neutral
   * cousins (her clay to sand, her sage to stone-sage, his slate to grey).
   * Persona themes never retire — a companion's colours are their identity,
   * not the day's.
   */
  retireAccents?: boolean;
  /**
   * The tint that washes the GROUND, when it differs from the accent's own
   * tint. Ordinary-Time memorials are the one case: the saint's colour drives
   * the accent set (accent, accentRgba, glow) while the season's tint still
   * washes the ground — the saint leads, the season stays in the room.
   * Everywhere else the two are the same tint, as they have always been.
   */
  washTint?: string;
}

interface NeutralGround {
  bg: string;
  card: string;
  cardHover: string;
  border: string;
  borderLight: string;
  text: string;
  textBright: string;
  textMuted: string;
  textDim: string;
  gradientTop: string;
  gradientBottom: string;
  secondaryAccent?: string;
  tertiaryAccent?: string;
  secondaryAccentRetired?: string;
  tertiaryAccentRetired?: string;
}

/**
 * The neutral ground every theme stands on, per track — "One Truth, Two
 * Seasonings" (Erik's final system, Nov 10, 2026). The accent always comes
 * from the caller — the day's liturgical colour or the companion's own — and
 * stays the primary accent in BOTH modes; only the surfaces around it differ.
 *
 * Men's: cool stone-beige and ink, slate carried as a quiet secondary.
 * Women's: warm ivory-sand and plum-brown, terracotta (clay) and sage carried
 * as secondaries.
 */
const NEUTRALS: Record<Audience, NeutralGround> = {
  men: {
    bg: '#E9E6DC',
    card: '#F7F4EC',
    cardHover: '#FFFFFF',
    border: '#CFC9BB',
    borderLight: '#B0A996',
    text: '#35302A',
    textBright: '#191613',
    textMuted: '#5D5649',
    textDim: '#6E665A',
    gradientTop: '#EFEBE2',
    gradientBottom: '#E1DDD0',
    secondaryAccent: '#5A6B7C',
    secondaryAccentRetired: '#94908A',
  },
  women: {
    bg: '#F5EDDE',
    card: '#FCF8EF',
    cardHover: '#FFFFFF',
    border: '#DFC8AF',
    borderLight: '#C9AB87',
    text: '#3E2B31',
    textBright: '#251820',
    textMuted: '#6D525B',
    textDim: '#86707A',
    gradientTop: '#FAF3E6',
    gradientBottom: '#EFE1C9',
    secondaryAccent: '#B85C38',
    tertiaryAccent: '#7C8A6A',
    secondaryAccentRetired: '#C8A184',
    tertiaryAccentRetired: '#9AA08E',
  },
};

export function makeLightTheme(
  { accent, accentBright, accentDark, tint }: ThemeSeed,
  audience: Audience = 'men',
  options: ThemeOptions = {},
): PersonaTheme {
  const n = NEUTRALS[audience];
  const strength = options.tintStrength ?? 1;
  // Two decimals keeps the ferial wash (strength 1) byte-identical to the
  // gradient every theme has always rendered: 0.20 and 0.12.
  const wash = (base: number) => (base * strength).toFixed(2);
  const groundTint = options.washTint ?? tint;
  const theme: PersonaTheme = {
    bg: n.bg,
    bgGradient: `radial-gradient(ellipse at 18% 0%, rgba(${groundTint},${wash(0.2)}) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(${groundTint},${wash(0.12)}) 0%, transparent 55%), linear-gradient(180deg, ${n.gradientTop} 0%, ${n.gradientBottom} 100%)`,
    card: n.card,
    cardHover: n.cardHover,
    border: n.border,
    borderLight: n.borderLight,
    accent,
    accentBright,
    accentDark,
    accentRgba: (a: number) => `rgba(${tint},${a})`,
    text: n.text,
    textBright: n.textBright,
    textMuted: n.textMuted,
    textDim: n.textDim,
    glow: `rgba(${tint},0.20)`,
  };
  const retire = options.retireAccents === true;
  const secondary = retire && n.secondaryAccentRetired ? n.secondaryAccentRetired : n.secondaryAccent;
  const tertiary = retire && n.tertiaryAccentRetired ? n.tertiaryAccentRetired : n.tertiaryAccent;
  if (secondary) theme.secondaryAccent = secondary;
  if (tertiary) theme.tertiaryAccent = tertiary;
  return theme;
}
