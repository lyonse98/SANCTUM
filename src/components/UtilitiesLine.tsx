import { PRINT_SERIF } from '@/lib/print';
import type { PersonaTheme, UtilityActions } from '@/types';

interface UtilitiesLineProps {
  t: PersonaTheme;
  utilities: UtilityActions;
  className?: string;
}

const ENTRIES: { key: string; label: string; action: (u: UtilityActions) => () => void }[] = [
  { key: 'settings', label: 'Settings', action: (u) => u.onOpenSettings },
  { key: 'reminders', label: 'Reminders', action: (u) => u.onOpenReminder },
  { key: 'feedback', label: 'Feedback', action: (u) => u.onOpenFeedback },
  { key: 'about', label: 'About', action: (u) => u.onOpenAbout },
  { key: 'share', label: 'Share', action: (u) => u.onShareInvite },
];

/**
 * The utilities line (Erik, Nov 13, 2026 — "Foot of Today"): the five
 * housekeeping actions as one quiet line of footer text — Settings ·
 * Reminders · Feedback · About · Share — each firing the existing
 * UtilityActions flow (Share opens the app-invite modal). It closes Today,
 * below the More of Sanctum block, and sits at the foot of the Companions,
 * Pocket Church, and Real Help pages too, so the housekeeping is reachable
 * from every main view without a bar or a sheet. Deliberately lighter than
 * the retired UtilitiesRow card: footer typography, no boxes, no icons.
 * Stage 1 of the printed-page re-skin (Nov 14, 2026) sets the line in the
 * page's serif voice; the entries, their order, and their actions are
 * untouched, and it still closes the page, dead last.
 */
export function UtilitiesLine({ t, utilities, className = '' }: UtilitiesLineProps) {
  return (
    <nav
      aria-label="Sanctum utilities"
      data-utilities-line
      className={`w-full flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${className}`}
    >
      {ENTRIES.map((entry, i) => (
        <span key={entry.key} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-[11px]" style={{ color: t.textDim }}>
              ·
            </span>
          )}
          <button
            data-utilities-entry={entry.key}
            onClick={entry.action(utilities)}
            className="text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ fontFamily: PRINT_SERIF, letterSpacing: '0.06em', color: t.textMuted }}
          >
            {entry.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
