/**
 * The Sanctum content day (Play 7, retention build Nov 16, 2026).
 *
 * The day's Gospel, reflection, Tonight closing and Tailor package belong to
 * a *content day* that flips at 04:00 local time, not at midnight. A user up
 * at 01:30 is still inside yesterday evening: yesterday's Tonight closing is
 * the one that should greet them, and anything they pray before 04:00 counts
 * toward the day they are finishing, not the one that has not yet begun in
 * any lived sense. The server already serves content by explicit date, so
 * this stays a client-only derivation — every surface that asks "what day is
 * it?" for content purposes should ask here.
 */

export const DAY_START_HOUR = 4;

/** Format a Date as a local YYYY-MM-DD key (the house date-key shape). */
export function dateKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The calendar date whose content is live at `now`: before DAY_START_HOUR,
 * that is still yesterday. Returns a fresh Date at local midnight of the
 * content day.
 */
export function contentDate(now: Date = new Date()): Date {
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < DAY_START_HOUR) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return shifted;
}

/** The YYYY-MM-DD key of the content day live at `now`. */
export function contentDateKey(now: Date = new Date()): string {
  return dateKeyOf(contentDate(now));
}

/**
 * `now` re-dated to the content day, keeping the wall-clock time of day.
 * For callers whose hour still matters (the Tonight resolve's midday
 * cutoff, the morning showing) but whose DATE is the content day: at
 * 01:30 the moment is still last night, at 08:00 it is this morning.
 */
export function contentNow(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime());
  if (now.getHours() < DAY_START_HOUR) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return shifted;
}

/** Shift a YYYY-MM-DD key by whole days (month/year safe). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part));
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return dateKeyOf(date);
}
