/**
 * One-tap return (Play 6, Nov 16, 2026): where the user last stood in
 * Sanctum, remembered on-device so a cold start can put them back there
 * instead of always landing on Today.
 *
 * - State lives under a `sanctum_` key, so the panic wipe in
 *   `src/lib/storage.ts` — which removes EVERY localStorage/sessionStorage
 *   key starting with `sanctum_` (verified: `wipeAllSanctumData` filters on
 *   that prefix) — clears it with everything else. Nothing here ever
 *   leaves the device.
 * - Only the surface (and, for a companion chat, which companion) is
 *   stored. No content, no words, no timestamps.
 * - A push deep link or an explicit focus param ALWAYS wins over the
 *   remembered surface: `shouldRestoreSurface` is the one decision point,
 *   and App's focus routing stays authoritative.
 */

import type { PersonaId, TabId } from '@/types';

export const LAST_SURFACE_KEY = 'sanctum_last_surface';

/** The shell's four views, plus 'chat' for an open companion conversation. */
export type LastSurfaceName = TabId | 'chat';

export interface LastSurface {
  surface: LastSurfaceName;
  /** Set only when `surface` is 'chat'. */
  companionId?: PersonaId;
}

const SURFACES: readonly string[] = ['today', 'companions', 'church', 'help', 'chat'];

export function saveLastSurface(saved: LastSurface): void {
  try {
    const record: LastSurface =
      saved.surface === 'chat' && saved.companionId
        ? { surface: 'chat', companionId: saved.companionId }
        : { surface: saved.surface };
    localStorage.setItem(LAST_SURFACE_KEY, JSON.stringify(record));
  } catch {
    // Storage full/blocked: returning is a courtesy, never a blocker.
  }
}

export function loadLastSurface(): LastSurface | null {
  try {
    const raw = localStorage.getItem(LAST_SURFACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastSurface>;
    if (typeof parsed.surface !== 'string' || !SURFACES.includes(parsed.surface)) return null;
    if (parsed.surface === 'chat') {
      if (typeof parsed.companionId !== 'string' || parsed.companionId.length === 0) return null;
      return { surface: 'chat', companionId: parsed.companionId as PersonaId };
    }
    return { surface: parsed.surface as LastSurfaceName };
  } catch {
    return null;
  }
}

export interface RestoreDecisionInput {
  /** An explicit `?focus=…` was present in the URL (a reminder tap). */
  hasFocusParam: boolean;
  /** A deep-link fragment (e.g. `#daily-gospel`) was present in the URL. */
  hasDeepLinkHash: boolean;
  /** The welcome gate has been passed (terms accepted / track chosen). */
  gatePassed: boolean;
}

/**
 * The pure restore decision: put the user back where they stood ONLY when
 * they have passed the gate and arrived with no explicit destination of
 * their own. A reminder tap (`/?focus=gospel#daily-gospel`) or any other
 * deep link names its own landing, and that landing always wins.
 */
export function shouldRestoreSurface({ hasFocusParam, hasDeepLinkHash, gatePassed }: RestoreDecisionInput): boolean {
  if (!gatePassed) return false;
  if (hasFocusParam) return false;
  if (hasDeepLinkHash) return false;
  return true;
}
