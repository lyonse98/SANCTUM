import { Menu } from 'lucide-react';
import type { PersonaTheme } from '@/types';

interface TopHeaderProps {
  t: PersonaTheme;
  /** The wordmark is the way home — a tap returns to Today from anywhere. */
  onHome: () => void;
  onOpenMenu: () => void;
}

/**
 * The slim top header of the tab-less shell (Erik, Nov 13, 2026 — the "core
 * diet"): the app is one home, Today, and everything else lives behind the
 * Menu sheet. The header carries only the wordmark (tap = Today) and the Menu
 * button — no ribbon, no destinations competing with the day's content.
 */
export function TopHeader({ t, onHome, onOpenMenu }: TopHeaderProps) {
  return (
    <header
      className="relative z-30 flex-shrink-0 border-b backdrop-blur-md"
      style={{ backgroundColor: `${t.bg}F2`, borderColor: `${t.border}99` }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 max-w-2xl mx-auto">
        <button
          onClick={onHome}
          aria-label="Sanctum — back to Today"
          className="font-display text-base font-bold uppercase tracking-[0.18em] transition-opacity hover:opacity-70 active:scale-[0.98]"
          style={{ color: t.textBright }}
        >
          Sanctum
        </button>
        <button
          onClick={onOpenMenu}
          aria-label="Open the menu"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all active:scale-95"
          style={{ backgroundColor: t.card, borderColor: `${t.border}99`, color: t.textMuted }}
        >
          <Menu className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Menu</span>
        </button>
      </div>
    </header>
  );
}
