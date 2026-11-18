import { dateKeyOf } from '@/lib/dayBoundary';

/**
 * The come-home door (Erik, Nov 18, 2026): a bare, identical-for-everyone
 * link — https://sanctumdaily.app/?comehome=1 — that a user hands to
 * someone away from the Church. There is NO sender-side state at all:
 * nothing records who shared it, who opened it, or what they did; the
 * recipient's only trace is one key on their own device, under the
 * sanctum_ prefix, holding the day they first opened the door (the
 * panic wipe takes it with everything else). The arc keys to days
 * since that first open, on the recipient's own calendar.
 */

export const COME_HOME_PARAM = 'comehome';

/** The link, exactly as shared — the same for every sender and every recipient. */
export const COME_HOME_URL = 'https://sanctumdaily.app/?comehome=1';

export const COME_HOME_KEY = 'sanctum_come_home';

/** True when this arrival came through the come-home link. */
export function isComeHomeArrival(search: string): boolean {
  try {
    return new URLSearchParams(search).get(COME_HOME_PARAM) === '1';
  } catch {
    return false;
  }
}

/** Whole days between two local date keys (YYYY-MM-DD), never negative. */
function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T12:00:00`);
  const to = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * The recipient's day in the arc: 0 on the day the door first opened,
 * one more each day after, resting at 6 (the seventh day) once the week
 * has run. The first open is recorded on this device at first sight —
 * that single date is all the door ever keeps.
 */
export function comeHomeDayIndex(now: Date = new Date()): number {
  const todayKey = dateKeyOf(now);
  try {
    const raw = localStorage.getItem(COME_HOME_KEY);
    const parsed = raw ? (JSON.parse(raw) as { firstOpen?: unknown }) : null;
    if (typeof parsed?.firstOpen !== 'string') {
      localStorage.setItem(COME_HOME_KEY, JSON.stringify({ firstOpen: todayKey }));
      return 0;
    }
    return Math.min(6, daysBetween(parsed.firstOpen, todayKey));
  } catch {
    return 0;
  }
}
