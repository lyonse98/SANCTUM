import { beforeEach, describe, expect, it } from 'vitest';
import { LAST_SURFACE_KEY, loadLastSurface, saveLastSurface, shouldRestoreSurface } from './lastSurface';
import { wipeAllSanctumData } from './storage';

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

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), configurable: true });
});

describe('lastSurface — the remembered place (Play 6)', () => {
  it('lives under a sanctum_ key so the panic wipe clears it', () => {
    expect(LAST_SURFACE_KEY.startsWith('sanctum_')).toBe(true);
    saveLastSurface({ surface: 'church' });
    wipeAllSanctumData();
    expect(loadLastSurface()).toBeNull();
  });

  it('round-trips a shell surface', () => {
    saveLastSurface({ surface: 'help' });
    expect(loadLastSurface()).toEqual({ surface: 'help' });
  });

  it('round-trips an open companion, with its id', () => {
    saveLastSurface({ surface: 'chat', companionId: 'joseph' });
    expect(loadLastSurface()).toEqual({ surface: 'chat', companionId: 'joseph' });
  });

  it('a companion id saved for a shell surface is dropped, never carried', () => {
    saveLastSurface({ surface: 'today', companionId: 'joseph' });
    expect(loadLastSurface()).toEqual({ surface: 'today' });
  });

  it('starts empty, and corrupt or unknown state reads as no memory', () => {
    expect(loadLastSurface()).toBeNull();
    localStorage.setItem(LAST_SURFACE_KEY, '{not json');
    expect(loadLastSurface()).toBeNull();
    localStorage.setItem(LAST_SURFACE_KEY, JSON.stringify({ surface: 'nowhere' }));
    expect(loadLastSurface()).toBeNull();
    localStorage.setItem(LAST_SURFACE_KEY, JSON.stringify({ surface: 'chat' }));
    expect(loadLastSurface()).toBeNull();
  });
});

describe('shouldRestoreSurface — the restore decision', () => {
  it('restores only past the gate, with no explicit destination present', () => {
    expect(shouldRestoreSurface({ hasFocusParam: false, hasDeepLinkHash: false, gatePassed: true })).toBe(true);
  });

  it('the gate is mandatory: no restore before it is passed', () => {
    expect(shouldRestoreSurface({ hasFocusParam: false, hasDeepLinkHash: false, gatePassed: false })).toBe(false);
  });

  it('a reminder tap always wins: a focus param suppresses restore', () => {
    expect(shouldRestoreSurface({ hasFocusParam: true, hasDeepLinkHash: false, gatePassed: true })).toBe(false);
  });

  it('a deep-link fragment always wins: #daily-gospel suppresses restore', () => {
    expect(shouldRestoreSurface({ hasFocusParam: false, hasDeepLinkHash: true, gatePassed: true })).toBe(false);
    expect(shouldRestoreSurface({ hasFocusParam: true, hasDeepLinkHash: true, gatePassed: true })).toBe(false);
  });
});
