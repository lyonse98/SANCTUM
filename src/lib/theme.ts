import type { Audience, PersonaTheme } from '@/types';

interface ThemeSeed {
  accent: string;
  accentBright: string;
  accentDark: string;
  tint: string;
}

/**
 * The neutral ground every theme stands on, per track. The accent always comes from
 * the caller — the day's liturgical colour or the companion's own — and stays the
 * primary accent in BOTH modes; only the surfaces around it differ.
 *
 * Men's: the parchment-and-ink ground Sanctum has always had.
 * Women's ("Sisterhood in Daylight"): the same parchment family warmed toward cream,
 * text deepened into plum-brown, with terracotta and sage carried as secondary
 * accents for the women's surfaces that ask for them.
 */
const NEUTRALS: Record<Audience, Omit<PersonaTheme, 'accent' | 'accentBright' | 'accentDark' | 'accentRgba' | 'glow' | 'bgGradient'> & { gradientTop: string; gradientBottom: string }> = {
  men: {
    bg: '#EDE7DB',
    card: '#FAF6EE',
    cardHover: '#FFFFFF',
    border: '#D4C8B4',
    borderLight: '#B9AA91',
    text: '#35302A',
    textBright: '#191613',
    textMuted: '#5D5649',
    textDim: '#6E665A',
    gradientTop: '#F1EBE1',
    gradientBottom: '#E5DDCF',
  },
  women: {
    bg: '#F6EFE2',
    card: '#FDFAF2',
    cardHover: '#FFFFFF',
    border: '#DEC7B4',
    borderLight: '#C7A88D',
    text: '#3E2B31',
    textBright: '#251820',
    textMuted: '#6D525B',
    textDim: '#86707A',
    gradientTop: '#FAF4E9',
    gradientBottom: '#F0E4D2',
    secondaryAccent: '#B85C38',
    tertiaryAccent: '#7C8A6A',
  },
};

export function makeLightTheme({ accent, accentBright, accentDark, tint }: ThemeSeed, audience: Audience = 'men'): PersonaTheme {
  const n = NEUTRALS[audience];
  const theme: PersonaTheme = {
    bg: n.bg,
    bgGradient: `radial-gradient(ellipse at 18% 0%, rgba(${tint},0.20) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(${tint},0.12) 0%, transparent 55%), linear-gradient(180deg, ${n.gradientTop} 0%, ${n.gradientBottom} 100%)`,
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
  // The women's secondary accents exist only on women's themes — a men's theme
  // object is byte-for-byte the shape it has always been.
  if (n.secondaryAccent) theme.secondaryAccent = n.secondaryAccent;
  if (n.tertiaryAccent) theme.tertiaryAccent = n.tertiaryAccent;
  return theme;
}
