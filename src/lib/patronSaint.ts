import { SAINTS, type SaintOfDay } from '@/data/saints';

/**
 * The patron saint for the year (Erik, Nov 18, 2026): the old custom of
 * choosing — or drawing — a patron for the year ahead, kept on this
 * device only under the sanctum_ prefix (the panic wipe takes it with
 * everything else). One pick, not per-track: the year has one patron
 * whichever door of the app is open. The pick is stored as the saint's
 * name and feast day together, because the saints shelf carries a few
 * names twice; the saint it names is always resolved back out of
 * src/data/saints.ts, so the app shows the shelf's own words for them.
 */

export const PATRON_SAINT_KEY = 'sanctum_patron_saint';

interface StoredPatron {
  name: string;
  feastDate: string;
}

/** The chosen patron, resolved against the saints shelf, or null when none is chosen. */
export function loadPatronSaint(): SaintOfDay | null {
  try {
    const raw = localStorage.getItem(PATRON_SAINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPatron;
    if (typeof parsed?.name !== 'string' || typeof parsed?.feastDate !== 'string') return null;
    return SAINTS.find((s) => s.name === parsed.name && s.feastDate === parsed.feastDate) ?? null;
  } catch {
    return null;
  }
}

/** Keeps the year's patron on this device; null clears the choice. */
export function savePatronSaint(saint: SaintOfDay | null): void {
  try {
    if (!saint) localStorage.removeItem(PATRON_SAINT_KEY);
    else {
      const stored: StoredPatron = { name: saint.name, feastDate: saint.feastDate };
      localStorage.setItem(PATRON_SAINT_KEY, JSON.stringify(stored));
    }
  } catch {
    // storage unavailable — the year simply goes without a named patron
  }
}

/** A date's MM-DD key, the saints shelf's own feast-day format. */
export function feastDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

/** The chosen patron when the given day is their feast, otherwise null. */
export function patronFeastOn(date: Date, patron: SaintOfDay | null = loadPatronSaint()): SaintOfDay | null {
  if (!patron) return null;
  return patron.feastDate === feastDayKey(date) ? patron : null;
}

/** The feast day in the reader's own format: "October 1". */
export function patronFeastLabel(saint: SaintOfDay): string {
  const [m, d] = saint.feastDate.split('-').map((part) => Number(part));
  const at = new Date(2026, (m || 1) - 1, d || 1);
  return at.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

/** The saint's bio line — the first sentence of the shelf's short bio. */
export function patronBioLine(saint: SaintOfDay): string {
  const first = saint.shortBio.trim().split(/(?<=[.!?])\s+/)[0] ?? saint.shortBio.trim();
  return first;
}
