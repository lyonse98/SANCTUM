import type { Audience } from '@/types';

/**
 * The favorite companion (Erik, Nov 18, 2026): one pinned companion per
 * track, kept on this device only under the sanctum_ prefix — the panic
 * wipe takes it with everything else. The pin is a persona id and nothing
 * more; it steers no prompt, no letter, and no tally. It exists so the
 * companion a reader returns to stands at the head of the index, one tap
 * from the conversation.
 */

export function favoriteCompanionKey(audience: Audience): string {
  return `sanctum_favorite_companion_${audience}`;
}

/** The pinned companion's persona id for this track, or null when none is pinned. */
export function loadFavoriteCompanion(audience: Audience): string | null {
  try {
    const raw = localStorage.getItem(favoriteCompanionKey(audience));
    const id = raw?.trim();
    return id ? id : null;
  } catch {
    return null;
  }
}

/** Pins a companion for this track; null (or an empty id) clears the pin. */
export function saveFavoriteCompanion(audience: Audience, personaId: string | null): void {
  try {
    const id = personaId?.trim();
    if (!id) localStorage.removeItem(favoriteCompanionKey(audience));
    else localStorage.setItem(favoriteCompanionKey(audience), id);
  } catch {
    // storage unavailable — the index simply renders without a pin
  }
}
