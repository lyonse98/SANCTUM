import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUDIENCE_KEY,
  audienceFacet,
  audienceNoun,
  isAudience,
  loadAudience,
  loadStoredAudience,
  saveAudience,
} from './audience';
import { wipeAllSanctumData } from './storage';

/** Minimal Storage whose keys are own enumerable properties, like the browser's. */
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

describe('audience storage', () => {
  it('validates only the two track values', () => {
    expect(isAudience('men')).toBe(true);
    expect(isAudience('women')).toBe(true);
    expect(isAudience('both')).toBe(false);
    expect(isAudience('')).toBe(false);
    expect(isAudience(null)).toBe(false);
    expect(isAudience(undefined)).toBe(false);
  });

  it('an install that never chose has no stored audience — and loads as men', () => {
    // The existing-user rule: terms accepted long ago, no audience key, no disruption.
    expect(loadStoredAudience()).toBeNull();
    expect(loadAudience()).toBe('men');
  });

  it('round-trips a choice under the sanctum_ prefix', () => {
    saveAudience('women');
    expect(localStorage.getItem(AUDIENCE_KEY)).toBe('women');
    expect(loadStoredAudience()).toBe('women');
    expect(loadAudience()).toBe('women');
    saveAudience('men');
    expect(loadAudience()).toBe('men');
  });

  it('a corrupt stored value is treated as never chosen', () => {
    localStorage.setItem(AUDIENCE_KEY, 'everyone');
    expect(loadStoredAudience()).toBeNull();
    expect(loadAudience()).toBe('men');
  });

  it('the panic wipe clears the choice with everything else', () => {
    saveAudience('women');
    wipeAllSanctumData();
    expect(loadStoredAudience()).toBeNull();
    expect(loadAudience()).toBe('men');
  });
});

describe('audience address helpers', () => {
  it('names the user and the reflection facet per track', () => {
    expect(audienceNoun('men')).toBe('Brother');
    expect(audienceNoun('women')).toBe('Sister');
    expect(audienceFacet('men')).toBe('As a man');
    expect(audienceFacet('women')).toBe('As a woman');
  });
});
