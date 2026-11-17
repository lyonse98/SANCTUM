/**
 * Keepsakes — the on-device record of completed arcs (Play 5(a), Nov 16, 2026).
 *
 * When a finite arc of prayer — a novena, in this first build — is prayed
 * through to its end, what remains is not a tally. A keepsake is simply a
 * record: which arc, the intention it was prayed for in the pray-er's own
 * words, and the dates it ran. It is kept the way a holy card is kept in a
 * missal — as a remembrance, not a reward.
 *
 * The design rails are the feature:
 *
 * - There are NO points, levels, badges, or scores anywhere in this module,
 *   and nothing here can be lost, expire, or be taken away.
 * - State lives on-device under a `sanctum_` key, so the panic wipe clears
 *   it with everything else. Nothing here ever leaves the device.
 * - Recording is idempotent per run: the same arc begun on the same date
 *   is recorded once, however many times completion is observed.
 */

export const KEEPSAKES_KEY = 'sanctum_keepsakes';

export interface Keepsake {
  /** The arc's id (e.g. a novena id). */
  arcId: string;
  /** The arc's name as the user knows it (e.g. "Novena to St. Jude"). */
  arcName: string;
  /** The intention in the user's own words; '' when none was set. */
  intention: string;
  /** The local date (YYYY-MM-DD) the run was begun. */
  startedISO: string;
  /** The local date (YYYY-MM-DD) the run was completed. */
  completedISO: string;
}

function isKeepsake(value: unknown): value is Keepsake {
  if (typeof value !== 'object' || value === null) return false;
  const k = value as Partial<Keepsake>;
  return (
    typeof k.arcId === 'string' &&
    typeof k.arcName === 'string' &&
    typeof k.intention === 'string' &&
    typeof k.startedISO === 'string' &&
    typeof k.completedISO === 'string'
  );
}

function readKeepsakes(): Keepsake[] {
  try {
    const raw = localStorage.getItem(KEEPSAKES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isKeepsake);
  } catch {
    return [];
  }
}

function writeKeepsakes(keepsakes: Keepsake[]): void {
  try {
    localStorage.setItem(KEEPSAKES_KEY, JSON.stringify(keepsakes));
  } catch {
    // Storage full/blocked: a keepsake is a courtesy, never a blocker.
  }
}

/** All keepsakes, most recently completed first. Corrupt state reads as empty. */
export function listKeepsakes(): Keepsake[] {
  return [...readKeepsakes()].sort((a, b) => b.completedISO.localeCompare(a.completedISO));
}

/**
 * Record one completed run. Idempotent per run: an entry with the same
 * arcId and startedISO is already that run's keepsake, and recording
 * again changes nothing. Returns the shelf after recording.
 */
export function recordKeepsake(entry: Keepsake): Keepsake[] {
  const existing = readKeepsakes();
  if (existing.some((k) => k.arcId === entry.arcId && k.startedISO === entry.startedISO)) {
    return listKeepsakes();
  }
  writeKeepsakes([entry, ...existing]);
  return listKeepsakes();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 8" for a YYYY-MM-DD date; '' for anything unparseable. */
export function formatKeepsakeDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(match[3])}`;
}

/** The run's span for the shelf: "Nov 8 – Nov 16" (one date when it began and ended the same day, or when the start is unknown). */
export function formatKeepsakeRange(startedISO: string, completedISO: string): string {
  const start = formatKeepsakeDate(startedISO);
  const end = formatKeepsakeDate(completedISO);
  if (!start) return end;
  if (!end || start === end) return start;
  return `${start} – ${end}`;
}
