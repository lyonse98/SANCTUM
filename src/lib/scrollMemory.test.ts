import { beforeEach, describe, expect, it } from 'vitest';
import { clearScrollPositions, loadScrollPosition, saveScrollPosition } from './scrollMemory';

describe('scrollMemory — the in-memory scroll map (Play 6c)', () => {
  beforeEach(() => clearScrollPositions());

  it('an unvisited surface starts at the top', () => {
    expect(loadScrollPosition('today')).toBe(0);
  });

  it('saves and returns a surface’s position, per surface', () => {
    saveScrollPosition('today', 640);
    saveScrollPosition('church', 120);
    expect(loadScrollPosition('today')).toBe(640);
    expect(loadScrollPosition('church')).toBe(120);
  });

  it('ignores negative and non-finite positions', () => {
    saveScrollPosition('today', -5);
    saveScrollPosition('today', Number.NaN);
    expect(loadScrollPosition('today')).toBe(0);
  });
});
