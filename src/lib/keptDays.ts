/**
 * Kept days — the journal pages of the Kept shelf (incentives build,
 * Nov 16, 2026).
 *
 * When a day is closed with the Tailor PM twin, the one line the close
 * asks the user to carry into sleep is kept here, on this device only,
 * as that day's page. The rails are Erik's, as everywhere in the
 * incentives build:
 *
 * - Keeping only ever gives back. A kept day cannot be lost, un-kept,
 *   or expire; re-recording a day changes nothing (first write wins).
 * - Only the days that WERE closed exist here. The days that were not
 *   are nowhere — no gap is computed, stored, or shown.
 * - State lives under a `sanctum_` key, so the panic wipe clears it
 *   with everything else. Nothing here ever leaves the device.
 */

import { contentDate } from './dayBoundary';

export const KEPT_DAYS_KEY = 'sanctum_kept_days';
export const MONTH_EXAMEN_SEEN_KEY = 'sanctum_month_examen_seen';

export interface KeptDay {
  /** The content day the close belongs to, YYYY-MM-DD. */
  dateKey: string;
  /** The PM package's carry line — the one line to carry into sleep. */
  line: string;
}

function readKeptDays(): KeptDay[] {
  try {
    const raw = localStorage.getItem(KEPT_DAYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const entries = parsed.filter(
      (e): e is KeptDay =>
        Boolean(e) &&
        typeof e === 'object' &&
        typeof (e as KeptDay).dateKey === 'string' &&
        typeof (e as KeptDay).line === 'string' &&
        (e as KeptDay).line.trim().length > 0,
    );
    // One page per day; the first page written for a day is the day's page.
    const seen = new Set<string>();
    return entries
      .filter((e) => {
        if (seen.has(e.dateKey)) return false;
        seen.add(e.dateKey);
        return true;
      })
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
  } catch {
    return [];
  }
}

function writeKeptDays(entries: KeptDay[]): void {
  try {
    localStorage.setItem(KEPT_DAYS_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/blocked: the close still reads for the night.
  }
}

/**
 * Keep one day's carry line. Idempotent per dateKey: the first line
 * written for a day is the day's page, and re-recording changes nothing.
 */
export function recordKeptDay(dateKey: string, line: string): void {
  if (!dateKey || !line || !line.trim()) return;
  const entries = readKeptDays();
  if (entries.some((e) => e.dateKey === dateKey)) return;
  entries.push({ dateKey, line });
  entries.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
  writeKeptDays(entries);
}

/** Every kept day on the device, sorted ascending by date. */
export function loadKeptDays(): KeptDay[] {
  return readKeptDays();
}

/** The kept days whose dateKey falls in one calendar month (monthIndex is 0-based). */
export function keptDaysInMonth(year: number, monthIndex: number): KeptDay[] {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  return readKeptDays().filter((e) => e.dateKey.startsWith(prefix));
}

/** The kept days between two date keys, inclusive, in date order. */
export function keptDaysBetween(entries: KeptDay[], startKey: string, endKey: string): KeptDay[] {
  return entries.filter((e) => e.dateKey >= startKey && e.dateKey <= endKey);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** A month with enough kept pages to sit with: the examen threshold. */
export const MONTH_EXAMEN_MIN_KEPT_DAYS = 5;

export interface MonthExamenCandidate {
  monthKey: string;
  label: string;
  lines: string[];
}

/**
 * The month examen offer: when the month just ended (relative to the
 * content day live at `now`) holds at least five kept days, those pages
 * are offered back as the material of a month examen. Otherwise null —
 * a thinner month is simply not mentioned.
 */
export function monthExamenCandidate(now: Date = new Date()): MonthExamenCandidate | null {
  const cd = contentDate(now);
  // The last day of the month just ended.
  const prev = new Date(cd.getFullYear(), cd.getMonth(), 0);
  const year = prev.getFullYear();
  const monthIndex = prev.getMonth();
  const entries = keptDaysInMonth(year, monthIndex);
  if (entries.length < MONTH_EXAMEN_MIN_KEPT_DAYS) return null;
  return {
    monthKey: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    label: MONTH_NAMES[monthIndex],
    lines: entries.map((e) => e.line),
  };
}

/** The monthKey of the last month examen the user has seen, or null. */
export function loadMonthExamenSeen(): string | null {
  try {
    return localStorage.getItem(MONTH_EXAMEN_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Mark one month's examen as seen, so its offer is not made twice. */
export function markMonthExamenSeen(monthKey: string): void {
  try {
    localStorage.setItem(MONTH_EXAMEN_SEEN_KEY, monthKey);
  } catch {
    // storage unavailable — the offer may return; nothing is lost
  }
}
