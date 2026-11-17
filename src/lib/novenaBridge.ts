/**
 * The Day-10 bridge decision (Play 5(a), Nov 16, 2026).
 *
 * When a novena reaches its ninth prayed day, the completion is met once —
 * on that visit — with a thanksgiving bridge (see Novenas.tsx). After the
 * pray-er has met it, or chosen to rest, the novena simply stands complete,
 * quietly: the bridge never nags on later visits.
 *
 * "Met" is remembered per run, not per novena: the marker stored on-device
 * is the startedISO of the run whose bridge was seen. A new run begins on
 * a new date, so its completion will be met with its own bridge; the old
 * run's marker can never suppress it. The marker lives under a `sanctum_`
 * key, so the panic wipe clears it with everything else.
 *
 * Counting stays exactly as it was: gap-tolerant, prayedDates-based. A
 * missed day changes nothing here either — there is nothing to reset.
 */

import { novenaComplete, type NovenaId, type NovenaState } from '../data/novenas';

export const bridgeSeenKey = (id: NovenaId) => `sanctum_novena_${id}_bridge_seen`;

/**
 * Where a novena stands for the surface:
 * - 'in-progress' — fewer than nine days prayed;
 * - 'bridge' — complete, and this run's bridge has not been met yet;
 * - 'completed-quiet' — complete, and the bridge has already been met.
 */
export type NovenaBridgeState = 'in-progress' | 'bridge' | 'completed-quiet';

export function novenaBridgeState(state: NovenaState, bridgeSeenStartedISO: string | null): NovenaBridgeState {
  if (!novenaComplete(state)) return 'in-progress';
  return bridgeSeenStartedISO === state.startedISO ? 'completed-quiet' : 'bridge';
}

/** The startedISO of the run whose bridge was seen, or null. Corrupt state reads as unseen. */
export function loadBridgeSeen(id: NovenaId): string | null {
  try {
    return localStorage.getItem(bridgeSeenKey(id));
  } catch {
    return null;
  }
}

/** Remember that the bridge for the run begun on `startedISO` has been met. */
export function markBridgeSeen(id: NovenaId, startedISO: string): void {
  try {
    localStorage.setItem(bridgeSeenKey(id), startedISO);
  } catch {
    // ignore
  }
}

/** Forget the marker (a fresh run for someone else starts entirely clean). */
export function clearBridgeSeen(id: NovenaId): void {
  try {
    localStorage.removeItem(bridgeSeenKey(id));
  } catch {
    // ignore
  }
}
