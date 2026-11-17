import { getAdventStart } from '@/data/liturgicalCalendar';

/**
 * Season arcs for Today (Play 5c, retention build Nov 16, 2026).
 *
 * Some seasons are themselves a finite arc, and Today may say where in
 * it the day stands — one quiet line, counted from content the day
 * already carries. Advent is the first of them: it begins on the fourth
 * Sunday before Christmas (the Sunday nearest Nov 30 — in 2026, Sunday
 * Nov 29) and its arc on Today runs through Dec 24. Christmas Day itself
 * is outside the arc: the waiting is over.
 */

export interface AdventProgress {
  /** The day's place in the arc: Advent Sunday is day 1. */
  day: number;
  /** The arc's whole length in calendar days, Advent Sunday through Dec 24. */
  totalDays: number;
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((atMidnight(to).getTime() - atMidnight(from).getTime()) / 86400000);
}

/** The arc's bounds for a year: Advent Sunday through Dec 24, inclusive. */
export function adventRange(year: number): { start: Date; end: Date } {
  return { start: getAdventStart(year), end: new Date(year, 11, 24) };
}

/**
 * Where `date` stands in Advent, or null outside it. Days are calendar
 * days counted from Advent Sunday (day 1) through Dec 24.
 */
export function adventProgress(date: Date): AdventProgress | null {
  const { start, end } = adventRange(date.getFullYear());
  const day = atMidnight(date);
  if (day < start || day > end) return null;
  return { day: daysBetween(start, day) + 1, totalDays: daysBetween(start, end) + 1 };
}
