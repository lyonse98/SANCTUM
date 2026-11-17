/**
 * Challenges lived — the on-device journal of challenges taken up.
 *
 * When the day's challenge (the Gospel card's, or a Tailor devotional's)
 * is lived, the user may say so with one quiet tap, and the challenge's
 * own words are kept here, on this device, as a remembrance. The Kept
 * shelf reads this journal back; nothing here is a tally or a ledger:
 *
 * - There are NO counts, scores, or rates anywhere in this module, and
 *   nothing here can expire, reset, or be compared against anything.
 * - Unmarking is a first-class operation, not an error path: setting a
 *   mark aside simply removes that entry, the way a page is turned.
 *   (It never un-records the day in the days-prayed tally — days only
 *   grow; see lib/daysPrayed.)
 * - State lives on-device under a `sanctum_` key, so the panic wipe
 *   clears it with everything else. Nothing here ever leaves the device.
 */

export const CHALLENGES_LIVED_KEY = 'sanctum_challenges_lived';

export type ChallengeSource = 'daily' | 'tailor';

export interface ChallengeLivedEntry {
  /** The content day the challenge belonged to (YYYY-MM-DD). */
  dateKey: string;
  /** Which surface offered the challenge: the day's, or a Tailor build's. */
  source: ChallengeSource;
  /** The challenge's own words, kept as they were given. */
  text: string;
}

function isEntry(value: unknown): value is ChallengeLivedEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Partial<ChallengeLivedEntry>;
  return (
    typeof e.dateKey === 'string' &&
    (e.source === 'daily' || e.source === 'tailor') &&
    typeof e.text === 'string'
  );
}

function readEntries(): ChallengeLivedEntry[] {
  try {
    const raw = localStorage.getItem(CHALLENGES_LIVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

function writeEntries(entries: ChallengeLivedEntry[]): void {
  try {
    localStorage.setItem(CHALLENGES_LIVED_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/blocked: the journal is a courtesy, never a blocker.
  }
}

/**
 * All lived challenges, most recent first — by content day, and within a
 * day the most recently marked first (marking prepends, and the sort is
 * stable, so the stored order carries the within-day order). Corrupt
 * state reads as empty.
 */
export function listChallengesLived(): ChallengeLivedEntry[] {
  return [...readEntries()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/** Whether the challenge of `dateKey` from `source` stands marked as lived. */
export function isChallengeLived(dateKey: string, source: ChallengeSource): boolean {
  return readEntries().some((e) => e.dateKey === dateKey && e.source === source);
}

/**
 * Mark one challenge as lived. Idempotent per (dateKey, source): marking
 * the same challenge again changes nothing — the first kept words stand.
 * Returns the journal after marking.
 */
export function markChallengeLived(entry: ChallengeLivedEntry): ChallengeLivedEntry[] {
  if (!isChallengeLived(entry.dateKey, entry.source)) {
    writeEntries([entry, ...readEntries()]);
  }
  return listChallengesLived();
}

/**
 * Set one day's mark aside: removes that (dateKey, source) entry, if any.
 * A journal operation, not a penalty — nothing else is touched. Returns
 * the journal after unmarking.
 */
export function unmarkChallengeLived(dateKey: string, source: ChallengeSource): ChallengeLivedEntry[] {
  writeEntries(readEntries().filter((e) => !(e.dateKey === dateKey && e.source === source)));
  return listChallengesLived();
}
