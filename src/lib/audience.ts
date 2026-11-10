import type { Audience } from '@/types';

/**
 * The audience track — Men's Sanctum or Women's Sanctum — lives on the device only,
 * under the `sanctum_` prefix like everything else, so the panic wipe clears it with
 * the rest. There is no server record of it (the daily-reflection and chat calls carry
 * it per-request, the way they carry a date or a persona id, and retain nothing).
 *
 * Default: a device that has accepted the terms but never stored an audience is a
 * pre-Women's-Mode install — it defaults to 'men' so nothing about an existing user's
 * Sanctum changes under him. A brand-new user has no stored audience either, but the
 * welcome gate asks before he or she enters, so the stored value is written there.
 */
export const AUDIENCE_KEY = 'sanctum_audience';

export const DEFAULT_AUDIENCE: Audience = 'men';

export function isAudience(value: unknown): value is Audience {
  return value === 'men' || value === 'women';
}

/** The stored audience, or null when this device has never chosen (new user). */
export function loadStoredAudience(): Audience | null {
  try {
    const raw = localStorage.getItem(AUDIENCE_KEY);
    return isAudience(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** The effective audience: the stored choice, defaulting to 'men' when absent. */
export function loadAudience(): Audience {
  return loadStoredAudience() ?? DEFAULT_AUDIENCE;
}

export function saveAudience(audience: Audience): void {
  try {
    localStorage.setItem(AUDIENCE_KEY, audience);
  } catch {
    // ignore — the in-memory state still carries the choice for this session
  }
}

/** How the app addresses this audience at the door and in its copy. */
export function audienceNoun(audience: Audience): 'Brother' | 'Sister' {
  return audience === 'women' ? 'Sister' : 'Brother';
}

/** The stored reflection facet label for this audience. */
export function audienceFacet(audience: Audience): 'As a man' | 'As a woman' {
  return audience === 'women' ? 'As a woman' : 'As a man';
}
