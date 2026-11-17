/**
 * Kept weeks — computed from the prayed days (incentives build,
 * Nov 16, 2026).
 *
 * A calendar week (Monday–Sunday) in which the user prayed on at least
 * five distinct days is a kept week. This module is a pure function of
 * the prayed-day keys: it stores nothing of its own.
 *
 * The rails are the feature:
 *
 * - Only kept weeks are ever returned. There is no progress toward a
 *   week, no unkept week, and nothing here can be read as a shortfall.
 * - A week still in progress is never returned: a week counts only
 *   once its Sunday is past. Nothing counts down to it.
 */

import { shiftDateKey } from './dayBoundary';

/** Distinct prayed days in one week at which the week is kept. */
export const KEPT_WEEK_MIN_DAYS = 5;

export interface KeptWeek {
  /** The week's Monday, YYYY-MM-DD. */
  weekStartKey: string;
  /** The week's Sunday, YYYY-MM-DD. */
  weekEndKey: string;
  /** The week's Sunday — the same day as weekEndKey, named for the shelf. */
  sundayKey: string;
}

function dateOfKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** The Monday of the calendar week (Monday–Sunday) containing a date key. */
export function mondayOfWeek(dateKey: string): string {
  const dow = dateOfKey(dateKey).getDay(); // 0 = Sunday … 6 = Saturday
  const offset = (dow + 6) % 7; // days since Monday
  return shiftDateKey(dateKey, -offset);
}

/** The Monday–Sunday span of the week containing a date key. */
export function weekRangeOf(dateKey: string): { weekStartKey: string; weekEndKey: string } {
  const weekStartKey = mondayOfWeek(dateKey);
  return { weekStartKey, weekEndKey: shiftDateKey(weekStartKey, 6) };
}

/** Distinct prayed days inside one Monday–Sunday span. */
function distinctDaysInWeek(dates: string[], weekStartKey: string, weekEndKey: string): number {
  const inWeek = new Set(dates.filter((d) => d >= weekStartKey && d <= weekEndKey));
  return inWeek.size;
}

/**
 * Whether the week containing `dateKey` is a kept week by its prayed
 * days — including a week still in progress. The Sunday harvest uses
 * this for the current week; the kept-weeks shelf itself only ever
 * lists completed weeks (see keptWeeks).
 */
export function weekIsKept(dates: string[], dateKey: string): boolean {
  const { weekStartKey, weekEndKey } = weekRangeOf(dateKey);
  return distinctDaysInWeek(dates, weekStartKey, weekEndKey) >= KEPT_WEEK_MIN_DAYS;
}

/**
 * The kept weeks among the prayed-day keys, sorted ascending. A week is
 * returned only when it is complete — its Sunday strictly before
 * `todayKey` (the current content day) — and holds at least five
 * distinct prayed days. Weeks in progress and weeks below the threshold
 * are absent, not reported.
 */
export function keptWeeks(dates: string[], todayKey: string): KeptWeek[] {
  const mondays = new Map<string, Set<string>>();
  for (const dateKey of dates) {
    const monday = mondayOfWeek(dateKey);
    const set = mondays.get(monday) ?? new Set<string>();
    set.add(dateKey);
    mondays.set(monday, set);
  }
  const result: KeptWeek[] = [];
  for (const [weekStartKey, days] of mondays) {
    const weekEndKey = shiftDateKey(weekStartKey, 6);
    if (weekEndKey >= todayKey) continue; // the week is still being lived
    if (days.size < KEPT_WEEK_MIN_DAYS) continue;
    result.push({ weekStartKey, weekEndKey, sundayKey: weekEndKey });
  }
  return result.sort((a, b) => (a.weekStartKey < b.weekStartKey ? -1 : a.weekStartKey > b.weekStartKey ? 1 : 0));
}
