import { loadPushReminder, type PushReminderState } from '@/lib/push';
import { focusLabel } from '@/lib/reminderFocus';

/**
 * The reminder's flywheel face on Today (Erik, Nov 13, 2026): Share and
 * Reminders are how Sanctum returns and spreads, so they stay prominent —
 * but not pushy. The card under the Gospel card has exactly three states:
 *
 * - `set` — a reminder exists: the card collapses to one quiet line naming
 *   it, with an Edit affordance. Nothing to sell; it simply confirms.
 * - `prompt` — none exists: a slim invitation with a Set button, and a
 *   dismiss (×) that puts it away for fourteen days, not forever and not
 *   for good — a man who said "not now" is asked again gently, later.
 * - `hidden` — none exists and the invitation was dismissed inside the
 *   window: the card renders nothing at all.
 *
 * All state is the app's existing reminder state plus two small local keys,
 * both under the sanctum_ prefix and so inside the panic wipe's sweep.
 */

export const REMINDER_PROMPT_DISMISSED_KEY = 'sanctum_reminder_prompt_dismissed_at';
export const REMINDER_DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type ReminderCardState = 'set' | 'prompt' | 'hidden';

export function reminderCardState(
  reminder: PushReminderState,
  dismissedAt: number | null,
  now: number,
): ReminderCardState {
  if (reminder.enabled) return 'set';
  if (dismissedAt !== null && now - dismissedAt < REMINDER_DISMISS_WINDOW_MS) return 'hidden';
  return 'prompt';
}

export function readReminderDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(REMINDER_PROMPT_DISMISSED_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function dismissReminderPrompt(now: number = Date.now()): void {
  try {
    localStorage.setItem(REMINDER_PROMPT_DISMISSED_KEY, String(now));
  } catch {
    // ignore — the worst case is the invitation shows again tomorrow
  }
}

/** '07:00' → '7:00 AM'; '19:30' → '7:30 PM'. Falls back to the raw string. */
export function formatReminderTime(localTime: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(localTime);
  if (!match) return localTime;
  const hour = Number(match[1]);
  if (hour > 23) return localTime;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

/** The one quiet line the set state collapses to. */
export function reminderSummaryLine(reminder: PushReminderState): string {
  return `Morning reminder · ${formatReminderTime(reminder.localTime)} · ${focusLabel(reminder.focus)}`;
}

/**
 * The post-listen invitation: after the FIRST completed Listen playback, one
 * small line under the player asks whether tomorrow morning should be
 * waiting. It is shown once ever — the flag is set the moment it renders —
 * and it never shows to a man who already has a reminder: there would be
 * nothing to ask.
 */
export const LISTEN_REMINDER_PROMPTED_KEY = 'sanctum_listen_reminder_prompted';

export function readListenReminderPrompted(): boolean {
  try {
    return localStorage.getItem(LISTEN_REMINDER_PROMPTED_KEY) === '1';
  } catch {
    return true; // if the flag cannot be read, do not risk repeating the ask
  }
}

export function markListenReminderPrompted(): void {
  try {
    localStorage.setItem(LISTEN_REMINDER_PROMPTED_KEY, '1');
  } catch {
    // ignore
  }
}

export function listenReminderLineDue(reminder: PushReminderState, alreadyPrompted: boolean): boolean {
  return !reminder.enabled && !alreadyPrompted;
}

export { loadPushReminder };
