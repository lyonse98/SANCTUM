import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tailorProgressLines } from './tailor';
import {
  EMPTY_TAILOR_PROFILE,
  SEASONS_OF_LIFE,
  battlesForAudience,
  eraseTailorProfile,
  hasTailorProfile,
  loadTailorProfile,
  profileDefaults,
  profileForRequest,
  profileSignature,
  saveTailorProfile,
  tailorProfileKey,
  type TailorProfile,
} from './tailorProfile';
import { personasForAudience } from '@/personas';
import { wipeAllSanctumData } from './storage';

/**
 * The standing Tailor profile (Nov 13, 2026): on-device only, per track,
 * edited and erased by its owner, covered by the panic wipe. Its battles are
 * the companions' own words; its defaults lean a morning's intake without
 * ever writing back to it.
 */

const PROFILE: TailorProfile = {
  seasonOfLife: 'father-young',
  // Both from the men's cast's own cards (Joseph's and Moses') — the loader
  // keeps only words the track's companions actually carry.
  ongoingBattles: ['Work pressure', 'Burnout'],
  standingGoal: 'Be a patient father.',
  mediaPrefs: ['song', 'video'],
  defaultTone: 'courage',
};

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

describe('the standing profile — storage', () => {
  const originalStorage = globalThis.localStorage;
  const originalSession = globalThis.sessionStorage;
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: originalStorage, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: originalSession, configurable: true });
    vi.restoreAllMocks();
  });

  it('round-trips per track — his profile and hers never cross', () => {
    saveTailorProfile('men', PROFILE);
    expect(loadTailorProfile('men')).toEqual(PROFILE);
    expect(loadTailorProfile('women')).toEqual(EMPTY_TAILOR_PROFILE);
    expect(tailorProfileKey('men')).toBe('sanctum_tailor_profile_men');
    expect(tailorProfileKey('women')).toBe('sanctum_tailor_profile_women');
  });

  it('has/erase: the profile counts only when it carries something, and erase removes it', () => {
    expect(hasTailorProfile('men')).toBe(false);
    saveTailorProfile('men', PROFILE);
    expect(hasTailorProfile('men')).toBe(true);
    eraseTailorProfile('men');
    expect(hasTailorProfile('men')).toBe(false);
    expect(loadTailorProfile('men')).toEqual(EMPTY_TAILOR_PROFILE);
  });

  it('the panic wipe takes the profile keys with everything else', () => {
    saveTailorProfile('men', PROFILE);
    saveTailorProfile('women', { ...PROFILE, seasonOfLife: 'expecting' });
    wipeAllSanctumData();
    expect(localStorage.getItem(tailorProfileKey('men'))).toBeNull();
    expect(localStorage.getItem(tailorProfileKey('women'))).toBeNull();
  });

  it('a damaged profile reads as no profile — wrong season, foreign battle, long goal all clipped', () => {
    localStorage.setItem(
      tailorProfileKey('men'),
      JSON.stringify({
        seasonOfLife: 'expecting', // a women's-track season — not his vocabulary
        ongoingBattles: ['Work pressure', 'Not a real battle'],
        standingGoal: 'x'.repeat(300),
        mediaPrefs: ['song', 'hologram'],
        defaultTone: 'wired',
      }),
    );
    const loaded = loadTailorProfile('men');
    expect(loaded.seasonOfLife).toBeNull();
    expect(loaded.ongoingBattles).toEqual(['Work pressure']);
    expect(loaded.standingGoal).toHaveLength(120);
    expect(loaded.mediaPrefs).toEqual(['song']);
    expect(loaded.defaultTone).toBeNull();
  });

  it('the request shape carries labels, not ids — and is null for an empty profile', () => {
    expect(profileForRequest('men', EMPTY_TAILOR_PROFILE)).toBeNull();
    const req = profileForRequest('men', PROFILE);
    expect(req?.seasonOfLife).toBe('Father of young children');
    expect(req?.ongoingBattles).toEqual(['Work pressure', 'Burnout']);
    expect(req?.standingGoal).toBe('Be a patient father.');
    expect(req?.mediaPrefs).toEqual(['song', 'video']);
    expect(profileSignature(req)).not.toBe(profileSignature(null));
  });
});

describe('the vocabularies are the app’s own', () => {
  it('every battle label is a word one of the track’s companions carries', () => {
    for (const audience of ['men', 'women'] as const) {
      const vocab = new Set(
        personasForAudience(audience).flatMap((p) =>
          audience === 'women' ? (p.issues ?? p.struggles) : p.struggles,
        ),
      );
      const battles = battlesForAudience(audience);
      expect(battles.length).toBeGreaterThan(15);
      for (const battle of battles) expect(vocab.has(battle)).toBe(true);
      // Deduped.
      expect(new Set(battles).size).toBe(battles.length);
    }
  });

  it('the seasons are track-worded: his list has no Expecting, hers does', () => {
    expect(SEASONS_OF_LIFE.men.map((s) => s.id)).not.toContain('expecting');
    expect(SEASONS_OF_LIFE.women.map((s) => s.id)).toContain('expecting');
    expect(SEASONS_OF_LIFE.women.map((s) => s.label)).toContain('Mother of young children');
    expect(SEASONS_OF_LIFE.men.map((s) => s.label)).toContain('Father of young children');
  });
});

describe('the surfaces — editor in the panel, erase in Settings, honest progress', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('the Tailor panel carries the tone question and the standing-profile editor', () => {
    const panel = read('components/TailorToday.tsx');
    expect(panel).toContain('What do you want from God today?');
    expect(panel).toContain('Your standing profile');
    expect(panel).toContain('Erase profile');
    expect(panel).toContain('Tap again to erase');
    expect(panel).toContain('Kept on this device only');
  });

  it('the progress lines are the build’s real stages, focus named, narrator last', () => {
    const lines = tailorProgressLines('grief');
    expect(lines[0]).toBe('Reading today’s readings…');
    expect(lines[1]).toContain('grief');
    expect(lines[2]).toBe('Choosing something to lift you…');
    expect(lines[3]).toContain('recording your morning');
  });

  it('Settings offers the erase only behind the has-profile guard', () => {
    const settings = read('components/SettingsModal.tsx');
    expect(settings).toContain('Erase Tailor profile');
    expect(settings).toContain('hasTailorProfile(audience)');
    expect(settings).toContain('tailorProfileExists &&');
  });
});

describe('prefill — the standing season leans the morning, and never writes back', () => {
  it('focus comes from the first priority focus a standing battle names', () => {
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Work pressure'] }).focus).toBe('work');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Work pressure', 'Grief'] }).focus).toBe('grief');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Lust'] }).focus).toBe('temptation');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Motherhood'] }).focus).toBe('family');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Perseverance'] }).focus).toBeUndefined();
  });

  it('state comes from the weather of the first battle that carries one', () => {
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Anger'] }).state).toBe('angry');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Perseverance', 'Restlessness'] }).state).toBe('scattered');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: ['Dryness'] }).state).toBe('numb');
    expect(profileDefaults({ ...EMPTY_TAILOR_PROFILE, ongoingBattles: [] }).state).toBeUndefined();
  });

  it('computing defaults does not mutate the profile', () => {
    const profile = { ...PROFILE };
    const before = JSON.stringify(profile);
    profileDefaults(profile);
    expect(JSON.stringify(profile)).toBe(before);
  });
});
