import { NOVENAS, type NovenaId, type NovenaState } from '@/data/novenas';

/**
 * Novena progress for Today (Play 5b, retention build Nov 16, 2026).
 *
 * Today may name a novena already under way — one quiet line, nothing
 * more. This module only READS the on-device novena records the Pray
 * door keeps (keys `sanctum_novena_<id>`, shape { startedISO,
 * prayedDates } from data/novenas); it writes nothing, and it exposes
 * no day that was missed: an arc is simply the count of days prayed so
 * far, and a finished or unbegun novena is not an arc at all.
 */

export interface NovenaArc {
  novenaId: NovenaId;
  /** The novena's title, as the shelf names it (e.g. "Novena to St. Jude"). */
  name: string;
  /** Days prayed so far in this arc — 1 through 8 while it is in progress. */
  dayCount: number;
}

/** The on-device key the Pray door keeps one novena's record under. */
export function novenaStateKey(id: NovenaId): string {
  return `sanctum_novena_${id}`;
}

/** An arc is in progress while 1–8 days are prayed: begun, not yet complete. */
export function isNovenaInProgress(state: NovenaState): boolean {
  return state.prayedDates.length >= 1 && state.prayedDates.length <= 8;
}

function readNovenaState(id: NovenaId): NovenaState | null {
  try {
    const raw = localStorage.getItem(novenaStateKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NovenaState>;
    const prayedDates = Array.isArray(parsed.prayedDates)
      ? parsed.prayedDates.filter((d): d is string => typeof d === 'string')
      : [];
    return {
      startedISO: typeof parsed.startedISO === 'string' ? parsed.startedISO : '',
      prayedDates,
    };
  } catch {
    return null;
  }
}

/** The day an arc began, for ordering: its stamp, else its first prayed day. */
function arcStart(state: NovenaState): string {
  return state.startedISO || state.prayedDates[0] || '';
}

/**
 * Picks the arc Today names from candidate states: among the novenas in
 * progress, the most recently started one. Pure, so the choice can be
 * tested without a device store.
 */
export function pickNovenaArc(
  candidates: { id: NovenaId; title: string; state: NovenaState | null }[],
): NovenaArc | null {
  let best: (NovenaArc & { start: string }) | null = null;
  for (const candidate of candidates) {
    if (!candidate.state || !isNovenaInProgress(candidate.state)) continue;
    const arc: NovenaArc & { start: string } = {
      novenaId: candidate.id,
      name: candidate.title,
      dayCount: candidate.state.prayedDates.length,
      start: arcStart(candidate.state),
    };
    if (!best || arc.start > best.start || (arc.start === best.start && arc.dayCount > best.dayCount)) {
      best = arc;
    }
  }
  return best ? { novenaId: best.novenaId, name: best.name, dayCount: best.dayCount } : null;
}

/** The in-progress novena arc Today should name, read from this device — or null. */
export function currentNovenaArc(): NovenaArc | null {
  return pickNovenaArc(
    NOVENAS.map((novena) => ({
      id: novena.id,
      title: novena.title,
      state: readNovenaState(novena.id),
    })),
  );
}
