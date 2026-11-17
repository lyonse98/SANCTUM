import { useState } from 'react';
import { Bell, Pencil, X } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { PRINT_SERIF } from '@/lib/print';
import { getPushState, loadPushReminder } from '@/lib/push';
import { InstallInstructions } from '@/components/InstallInstructions';
import {
  dismissReminderPrompt,
  readFirstValue,
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
 *
 * Nov 16, 2026 (audit W-7 + Erik's ruling): the invitation speaks plainly
 * now — "reminder" and "notification" are its words — and it waits for a
 * first moment of value (a first Listen, a first prayer) before it
 * appears at all. The snooze and the set-line are untouched.
 */
export function ReminderCard({ t, onOpenReminder }: ReminderCardProps) {
  const reminder = loadPushReminder();
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => readReminderDismissedAt());
  // Read fresh on every render, like the reminder itself: the flag can be
  // set by a Listen or a prayer on this same page, and the next render of
  // the card should honour it.
  const state = reminderCardState(reminder, dismissedAt, Date.now(), readFirstValue());

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
        <span className="text-[12px] font-medium" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          {reminderSummaryLine(reminder)}
        </span>
        <button
          onClick={onOpenReminder}
          className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide transition-opacity hover:opacity-70"
          style={{ color: t.accent }}
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    );
  }

  // On an iPhone in a browser tab, the reminder cannot be set at all until
  // Sanctum is on the Home Screen — so the install steps stand here, in the
  // flow itself, instead of waiting behind the Set tap (Play 3). The card's
  // gating is untouched: this shows only in the prompt state the card
  // already earned, and the steps are the shared InstallInstructions.
  const iosNeedsInstall = getPushState() === 'not-installed';

  return (
    <div className="w-full px-1 py-3 animate-fade-in" style={ruleStyle} data-reminder-card="prompt">
      <div className="flex items-center gap-3">
        <Bell className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
        <span
          className="flex-1 text-[12px] font-medium leading-snug"
          style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
        >
          Get a morning reminder — a notification with today&rsquo;s Gospel
        </span>
        <button
          onClick={onOpenReminder}
          className="px-3 py-1.5 rounded-md border text-[12px] font-bold uppercase tracking-wide transition-all active:scale-95 flex-shrink-0"
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
      {iosNeedsInstall && (
        <div className="mt-3" data-reminder-install-steps>
          <p
            className="text-[12px] font-medium leading-snug mb-3"
            style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
          >
            On an iPhone, a reminder can only reach an app that lives on the Home
            Screen — so put Sanctum there first:
          </p>
          <InstallInstructions
            tokens={{
              accent: t.accent,
              accentSoft: t.accentRgba(0.15),
              border: t.border,
              textBright: t.textBright,
              text: t.text,
              textMuted: t.textMuted,
              textDim: t.textDim,
            }}
          />
        </div>
      )}
    </div>
  );
}
