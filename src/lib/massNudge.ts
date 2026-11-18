import { contentDate } from '@/lib/dayBoundary';
import { loadUsualMass, type UsualMass } from '@/lib/usualMass';

/**
 * The pre-Mass nudge, in-app form (Erik, Nov 18, 2026 — the deepened
 * MassMode): when My usual Mass is set, Today carries one slim plate on
 * the Mass day itself, while the hour is still ahead of the Mass —
 * "Mass today — {time} at {parish}" — and its tap lands on the day's
 * Gospel card, the readings ready below. After the time passes, and on
 * every other day, it never renders. It is a standing-preference
 * surface, computed fresh from the reader's own usual-Mass record and
 * the clock; it records nothing — no attendance, no tap, no trace
 * (a push slot for it is future work, deliberately out of scope here).
 */

export interface MassNudge {
  parish: string;
  /** The Mass time, "HH:MM" as stored. */
  time: string;
}

/** "HH:MM" for a wall-clock moment, the stored usual-Mass shape. */
function wallClockKey(now: Date): string {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * The nudge for this moment, or null. The day is the content day (the
 * app's own day, Play 7): a Sunday Mass nudges on the content Sunday, a
 * Saturday vigil on the content Saturday. The hour is the reader's own
 * clock — the plate stands only while the Mass is still ahead today.
 */
export function massNudgeFor(now: Date, mass: UsualMass | null = loadUsualMass()): MassNudge | null {
  if (!mass) return null;
  const day = contentDate(now).getDay();
  const massDay = mass.day === 'saturday' ? 6 : 0;
  if (day !== massDay) return null;
  if (wallClockKey(now) >= mass.time) return null;
  return { parish: mass.parish, time: mass.time };
}
