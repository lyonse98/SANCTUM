import { useState } from 'react';
import { Bell, Pencil, X } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { PRINT_SERIF } from '@/lib/print';
import { loadPushReminder } from '@/lib/push';
import {
  dismissReminderPrompt,
  readReminderDismissedAt,
  reminderCardState,
  reminderSummaryLine,
} from '@/lib/reminderCard';

interface ReminderCardProps {
  t: PersonaTheme;
  onOpenReminder: () => void;
}

/**
 * The reminder card on Today, directly under the Gospel card (Nov 13, 2026).
 * It reads the reminder state fresh on every render — the reminder modal
 * lives in the shell above, so a change made there is reflected the moment
 * the shell re-renders this card. Prominent, not pushy: an invitation with
 * a fourteen-day dismiss when nothing is set; one quiet confirming line
 * when something is. Stage 1 of the printed-page re-skin (Nov 14, 2026)
 * re-sets it as a colophon entry — the same states between hairline rules,
 * in the serif voice; the invitation, the snooze, and the set-line are
 * exactly as they were.
 */
export function ReminderCard({ t, onOpenReminder }: ReminderCardProps) {
  const reminder = loadPushReminder();
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => readReminderDismissedAt());
  const state = reminderCardState(reminder, dismissedAt, Date.now());

  if (state === 'hidden') return null;

  const ruleStyle = {
    borderTop: `1px solid ${t.border}66`,
    borderBottom: `1px solid ${t.border}66`,
  } as const;

  if (state === 'set') {
    return (
      <div
        className="w-full flex items-center justify-center gap-2 px-1 py-3 animate-fade-in"
        style={ruleStyle}
        data-reminder-card="set"
      >
        <Bell className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
        <span className="text-[11px] font-medium" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          {reminderSummaryLine(reminder)}
        </span>
        <button
          onClick={onOpenReminder}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide transition-opacity hover:opacity-70"
          style={{ color: t.accent }}
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center gap-3 px-1 py-3 animate-fade-in"
      style={ruleStyle}
      data-reminder-card="prompt"
    >
      <Bell className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
      <span
        className="flex-1 text-[11px] font-medium leading-snug"
        style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
      >
        Have Sanctum meet you in the morning
      </span>
      <button
        onClick={onOpenReminder}
        className="px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 flex-shrink-0"
        style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accent, color: t.accent }}
      >
        Set
      </button>
      <button
        onClick={() => {
          dismissReminderPrompt();
          setDismissedAt(Date.now());
        }}
        aria-label="Not now — ask again in two weeks"
        className="flex-shrink-0 transition-opacity hover:opacity-70"
        style={{ color: t.textDim }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
