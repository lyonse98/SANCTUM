import type { PersonaTheme } from '@/types';

interface ThemeSeed {
  accent: string;
  accentBright: string;
  accentDark: string;
  tint: string;
}

export function makeLightTheme({ accent, accentBright, accentDark, tint }: ThemeSeed): PersonaTheme {
  return {
    bg: '#EDE7DB',
    bgGradient: `radial-gradient(ellipse at 18% 0%, rgba(${tint},0.20) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(${tint},0.12) 0%, transparent 55%), linear-gradient(180deg, #F1EBE1 0%, #E5DDCF 100%)`,
    card: '#FAF6EE',
    cardHover: '#FFFFFF',
    border: '#D4C8B4',
    borderLight: '#B9AA91',
    accent,
    accentBright,
    accentDark,
    accentRgba: (a: number) => `rgba(${tint},${a})`,
    text: '#35302A',
    textBright: '#191613',
    textMuted: '#5D5649',
    textDim: '#6E665A',
    glow: `rgba(${tint},0.20)`,
  };
}
