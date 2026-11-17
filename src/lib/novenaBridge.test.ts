import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bridgeSeenKey,
  clearBridgeSeen,
  loadBridgeSeen,
  markBridgeSeen,
  novenaBridgeState,
} from './novenaBridge';
import { emptyNovenaState, type NovenaState } from '../data/novenas';

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

const nineDays: NovenaState = {
  startedISO: '2026-11-08',
  prayedDates: [
    '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13',
    '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17',
  ],
};

describe('the Day-10 bridge decision (Play 5(a))', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('an unfinished novena is in progress, bridge or not', () => {
    expect(novenaBridgeState(emptyNovenaState(), null)).toBe('in-progress');
    expect(novenaBridgeState({ startedISO: '2026-11-08', prayedDates: nineDays.prayedDates.slice(0, 8) }, null)).toBe('in-progress');
  });

  it('completion is counted from prayed dates, gaps and all — a missed day never resets it', () => {
    // nineDays skips Nov 11 entirely; the run is complete all the same.
    expect(novenaBridgeState(nineDays, null)).toBe('bridge');
  });

  it('the bridge shows on the completion visit, then the novena stands complete quietly', () => {
    expect(novenaBridgeState(nineDays, null)).toBe('bridge');
    expect(novenaBridgeState(nineDays, '2026-11-08')).toBe('completed-quiet');
  });

  it('the seen marker is per run: a new run begun on a new date meets its own bridge', () => {
    const nextRun: NovenaState = { startedISO: '2026-12-01', prayedDates: nineDays.prayedDates };
    expect(novenaBridgeState(nextRun, '2026-11-08')).toBe('bridge');
  });

  it('the marker round-trips under a sanctum_ key, inside the panic wipe’s sweep', () => {
    expect(bridgeSeenKey('st-jude')).toBe('sanctum_novena_st-jude_bridge_seen');
    expect(loadBridgeSeen('st-jude')).toBeNull();
    markBridgeSeen('st-jude', '2026-11-08');
    expect(loadBridgeSeen('st-jude')).toBe('2026-11-08');
    clearBridgeSeen('st-jude');
    expect(loadBridgeSeen('st-jude')).toBeNull();
  });

  it('the Novenas surface carries the bridge’s three choices and no dead end', () => {
    const surface = readFileSync(join(__dirname, '..', 'components', 'Novenas.tsx'), 'utf8');
    expect(surface).toContain('Begin another novena');
    expect(surface).toContain('Pray this one again — for someone else');
    expect(surface).toContain('Rest — just Today for now');
    expect(surface.toLowerCase()).not.toContain('streak');
  });
});
