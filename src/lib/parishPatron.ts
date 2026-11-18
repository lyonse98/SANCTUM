import { SAINTS, type SaintOfDay } from '@/data/saints';
import { feastDayKey } from '@/lib/patronSaint';

/**
 * My parish's patron (Erik, Nov 18, 2026 — the pre-parish form of "your
 * parish in the calendar itself"): the reader names the patron saint of
 * their own parish, and Sanctum keeps that feast on their Today — a
 * marker in the masthead and the saint's plate for the day. It is a
 * personal observance only: it lives on this device under the sanctum_
 * prefix (the panic wipe takes it with everything else), and it never
 * touches the calendar or the theme engine — the day's rank, colours,
 * and celebration remain exactly what the calendar says they are
 * (calendar supremacy untouched). The pick is stored as the saint's name
 * and feast day together, resolved back out of src/data/saints.ts, the
 * same pattern as the patron for the year (src/lib/patronSaint.ts) —
 * a second, distinct pick: the year's patron is the reader's own; this
 * one is their parish's.
 */

export const PARISH_PATRON_KEY = 'sanctum_parish_patron';

interface StoredParishPatron {
  name: string;
  feastDate: string;
}

/** The chosen parish patron, resolved against the saints shelf, or null when none is chosen. */
export function loadParishPatron(): SaintOfDay | null {
  try {
    const raw = localStorage.getItem(PARISH_PATRON_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredParishPatron;
    if (typeof parsed?.name !== 'string' || typeof parsed?.feastDate !== 'string') return null;
    return SAINTS.find((s) => s.name === parsed.name && s.feastDate === parsed.feastDate) ?? null;
  } catch {
    return null;
  }
}

/** Keeps the parish's patron on this device; null clears the choice. */
export function saveParishPatron(saint: SaintOfDay | null): void {
  try {
    if (!saint) localStorage.removeItem(PARISH_PATRON_KEY);
    else {
      const stored: StoredParishPatron = { name: saint.name, feastDate: saint.feastDate };
      localStorage.setItem(PARISH_PATRON_KEY, JSON.stringify(stored));
    }
  } catch {
    // storage unavailable — the parish simply goes without a named patron here
  }
}

/** The chosen parish patron when the given day is their feast, otherwise null. */
export function parishPatronFeastOn(date: Date, patron: SaintOfDay | null = loadParishPatron()): SaintOfDay | null {
  if (!patron) return null;
  return patron.feastDate === feastDayKey(date) ? patron : null;
}
