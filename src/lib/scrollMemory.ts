/**
 * The in-memory scroll map (Play 6c, Nov 16, 2026): where each surface's
 * scroll stood when the user left it, kept in a module-level Map — memory
 * only, never persisted, gone with the page. Returning to Today restores
 * Today's saved position instead of forcing a full re-scroll from the top.
 *
 * Today's scroll lives in its own container (HomeScreen's overflow
 * element), not on `window`, so positions are the container's `scrollTop`
 * values, keyed by surface name.
 */

const positions = new Map<string, number>();

export function saveScrollPosition(surface: string, top: number): void {
  if (!Number.isFinite(top) || top < 0) return;
  positions.set(surface, top);
}

export function loadScrollPosition(surface: string): number {
  return positions.get(surface) ?? 0;
}

export function clearScrollPositions(): void {
  positions.clear();
}
