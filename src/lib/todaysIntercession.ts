import { NOVENAS, type NovenaId, type NovenaState } from '@/data/novenas';
import { isNovenaInProgress, novenaStateKey } from '@/lib/novenaProgress';

/**
 * Today's intercession — one intention, lifted up on Today.
 *
 * A novena under way on this device may carry an intention in the
 * pray-er's own words (kept by the Pray door under
 * `sanctum_novena_<id>_intention`, beside its state record under
 * `sanctum_novena_<id>`). When more than one such intention is active,
 * Today names one of them — the same one all day, rotating across days
 * by a stable hash of the content day's key, so the choice is calm and
 * predictable rather than random. This module only READS the records
 * the Pray door keeps; it writes nothing, fetches nothing, and exposes
 * no day that was missed.
 */

export interface ActiveIntention {
  novenaId: NovenaId;
  /** The novena's title, as the shelf names it (e.g. "Novena to St. Jude"). */
  name: string;
  /** The intention in the pray-er's own words, trimmed. */
  intention: string;
}

/** One novena's raw on-device record, for the pure filtering below. */
export interface IntercessionCandidate {
  id: NovenaId;
  title: string;
  state: NovenaState | null;
  intention: string | null;
}

/**
 * The active intentions among candidate records, in the order the
 * candidates were given: a novena in progress (1–8 prayed dates) whose
 * intention is non-empty after trimming. Pure, so the rule can be
 * tested with NovenaState objects constructed directly.
 */
export function collectActiveIntentions(candidates: IntercessionCandidate[]): ActiveIntention[] {
  const actives: ActiveIntention[] = [];
  for (const candidate of candidates) {
    if (!candidate.state || !isNovenaInProgress(candidate.state)) continue;
    const intention = (candidate.intention ?? '').trim();
    if (!intention) continue;
    actives.push({ novenaId: candidate.id, name: candidate.title, intention });
  }
  return actives;
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

function readIntention(id: NovenaId): string | null {
  try {
    return localStorage.getItem(`sanctum_novena_${id}_intention`);
  } catch {
    return null;
  }
}

/**
 * The intentions active on this device right now, in NOVENAS order:
 * each novena in progress that carries a non-empty intention.
 */
export function activeIntentions(): ActiveIntention[] {
  return collectActiveIntentions(
    NOVENAS.map((novena) => ({
      id: novena.id,
      title: novena.title,
      state: readNovenaState(novena.id),
      intention: readIntention(novena.id),
    })),
  );
}

/**
 * A stable numeric ordinal for a date key: the sum of its char codes.
 * Deliberately simple — the same key always yields the same number, on
 * every device and every run, which is all the rotation needs.
 */
export function dayOrdinal(contentKey: string): number {
  let sum = 0;
  for (let i = 0; i < contentKey.length; i++) {
    sum += contentKey.charCodeAt(i);
  }
  return sum;
}

/**
 * The one intention Today names from the active set: null when the set
 * is empty, otherwise `dayOrdinal(contentKey) % count` — the same
 * intention all day, rotating across days. Pure.
 */
export function pickIntercession(
  actives: ActiveIntention[],
  contentKey: string,
): ActiveIntention | null {
  if (actives.length === 0) return null;
  return actives[dayOrdinal(contentKey) % actives.length];
}

/** The intention Today lifts up for the content day `contentKey`, read from this device — or null. */
export function todaysIntercession(contentKey: string): ActiveIntention | null {
  return pickIntercession(activeIntentions(), contentKey);
}
