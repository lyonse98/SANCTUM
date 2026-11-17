/**
 * Days prayed — Erik's guilt-free tally (Play 1 revised, Nov 16, 2026).
 *
 * A quiet cumulative count of the distinct content days on which the user
 * did any one core act: listened, prayed, spoke with a companion, closed the
 * day with Tonight, or built a Tailor devotional. The design rails are the
 * feature:
 *
 * - The count is CUMULATIVE and NEVER resets. A gap changes nothing; there
 *   is nothing to lose and nothing to repair.
 * - No consecutive-day requirement exists anywhere in this module — the
 *   words "streak" and its grammar are deliberately absent.
 * - Absence duration is never computed, stored, or exposed: the stored set
 *   holds only the days that WERE prayed, never the ones that were not.
 * - State lives on-device under a `sanctum_` key, so the panic wipe clears
 *   it with everything else. Nothing here ever leaves the device, and no
 *   notification may reference it.
 */

import { contentDateKey } from './dayBoundary';

export const DAYS_PRAYED_KEY = 'sanctum_days_prayed';

export type CoreAct = 'listen' | 'pray' | 'companion' | 'tonight' | 'tailor';

interface DaysPrayedState {
  days: string[];
}

function readState(): DaysPrayedState {
  try {
    const raw = localStorage.getItem(DAYS_PRAYED_KEY);
    if (!raw) return { days: [] };
    const parsed = JSON.parse(raw) as Partial<DaysPrayedState>;
    if (!Array.isArray(parsed.days)) return { days: [] };
    const days = parsed.days.filter((d): d is string => typeof d === 'string');
    return { days: Array.from(new Set(days)).sort() };
  } catch {
    return { days: [] };
  }
}

function writeState(state: DaysPrayedState): void {
  try {
    localStorage.setItem(DAYS_PRAYED_KEY, JSON.stringify(state));
  } catch {
    // Storage full/blocked: the tally is a courtesy, never a blocker.
  }
}

export interface DaysPrayed {
  /** Distinct content days prayed, all time. Only ever grows. */
  totalDays: number;
  /** Whether the content day live at `now` already counts. */
  prayedToday: boolean;
}

/** Read the tally without recording anything. */
export function loadDaysPrayed(now: Date = new Date()): DaysPrayed {
  const { days } = readState();
  return { totalDays: days.length, prayedToday: days.includes(contentDateKey(now)) };
}

/**
 * Record one core act. Idempotent within a content day: the second act of a
 * day changes nothing. Returns the tally after recording and whether this
 * act made the day count for the first time.
 */
export function recordCoreAct(_kind: CoreAct, now: Date = new Date()): DaysPrayed & { isNewDay: boolean } {
  const key = contentDateKey(now);
  const state = readState();
  if (state.days.includes(key)) {
    return { totalDays: state.days.length, prayedToday: true, isNewDay: false };
  }
  state.days.push(key);
  state.days.sort();
  writeState(state);
  return { totalDays: state.days.length, prayedToday: true, isNewDay: true };
}
