/**
 * What the daily email can point a man at. The list is deliberately short and made only of
 * things Sanctum actually contains, so a reminder can always open the door it promises. The
 * `key` values are the same strings the database accepts — one vocabulary across the app.
 */
export interface ReminderFocus {
  key: string;
  label: string;
  detail: string;
}

export const DEFAULT_FOCUS = 'gospel';

export const REMINDER_FOCUS_OPTIONS: ReminderFocus[] = [
  { key: 'gospel', label: 'The day’s Gospel', detail: 'The readings for today, with a word to sit with' },
  { key: 'examen', label: 'The Evening Examen', detail: 'A nudge to review the day before bed' },
  { key: 'rosary', label: 'The Rosary', detail: 'A reminder to pray it, with the guide to hand' },
  { key: 'rule', label: 'My Rule of Life', detail: 'A reminder to keep the things you decided to do daily' },
];

const VALID_KEYS = REMINDER_FOCUS_OPTIONS.map((o) => o.key);

export function isReminderFocus(value: string): boolean {
  return VALID_KEYS.includes(value);
}

export function focusLabel(key: string): string {
  return REMINDER_FOCUS_OPTIONS.find((o) => o.key === key)?.label ?? 'The day’s Gospel';
}
