/**
 * What the daily reminder points a man at. Since Erik's ruling of Nov 16, 2026 the list
 * holds exactly one option, because the reminder has exactly one landing: the day's
 * Gospel — the thing the notification itself promises. The wider stored vocabulary
 * (examen, rosary, rule) lives on in pushCore, where subscriptions created before the
 * ruling still parse; they land here too, and this module's validator now reads any of
 * them back as the Gospel.
 */
export interface ReminderFocus {
  key: string;
  label: string;
  detail: string;
}

export const DEFAULT_FOCUS = 'gospel';

export const REMINDER_FOCUS_OPTIONS: ReminderFocus[] = [
  { key: 'gospel', label: 'The day’s Gospel', detail: 'The readings for today, with a word to sit with' },
];

const VALID_KEYS = REMINDER_FOCUS_OPTIONS.map((o) => o.key);

export function isReminderFocus(value: string): boolean {
  return VALID_KEYS.includes(value);
}

export function focusLabel(key: string): string {
  return REMINDER_FOCUS_OPTIONS.find((o) => o.key === key)?.label ?? 'The day’s Gospel';
}
