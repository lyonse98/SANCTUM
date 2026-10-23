import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PersonaTheme } from '@/types';
import { FeedbackModal } from '@/components/FeedbackModal';

interface FeedbackContextValue {
  /** Opens the feedback form, remembering which screen it was opened from. */
  openFeedback: (page?: string) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

/**
 * Makes "send feedback" reachable from every screen without threading a prop through each one.
 * The fallback theme is the neutral stone palette, used by screens that sit outside any
 * companion's theme (the welcome screen and the offline workshop).
 */
export const FALLBACK_THEME: PersonaTheme = {
  bg: '#FBF8F3',
  bgGradient: 'linear-gradient(180deg, #FBF8F3 0%, #F3EEE7 100%)',
  card: '#FFFFFF',
  cardHover: '#F3EEE7',
  border: '#DCD3C5',
  borderLight: '#E8E1D6',
  accent: '#C2410C',
  accentBright: '#EA580C',
  accentDark: '#9A3412',
  accentRgba: (alpha: number) => `rgba(194, 65, 12, ${alpha})`,
  text: '#3A352E',
  textBright: '#1B1815',
  textMuted: '#635C51',
  textDim: '#756D61',
  glow: 'rgba(194, 65, 12, 0.2)',
};

export function FeedbackProvider({ theme, children }: { theme?: PersonaTheme; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<string | undefined>(undefined);

  const openFeedback = (from?: string) => {
    setPage(from);
    setOpen(true);
  };

  return (
    <FeedbackContext.Provider value={{ openFeedback }}>
      {children}
      <FeedbackModal
        open={open}
        onClose={() => setOpen(false)}
        t={theme ?? FALLBACK_THEME}
        page={page}
      />
    </FeedbackContext.Provider>
  );
}

/** Returns the feedback opener, or null when no provider is mounted. */
export function useFeedback(): FeedbackContextValue | null {
  return useContext(FeedbackContext);
}
