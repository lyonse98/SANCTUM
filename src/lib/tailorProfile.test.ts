import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tailorProgressLines } from './tailor';
import {
  EMPTY_TAILOR_PROFILE,
  NORTH_STARS,
  SEASONS_OF_LIFE,
  battlesForAudience,
  eraseTailorProfile,
  hasTailorProfile,
  loadTailorProfile,
  northStarById,
  northStarLabel,
  northStarsForAudience,
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
  northStar: 'be-still',
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
        northStar: 'not-a-star',
      }),
    );
    const loaded = loadTailorProfile('men');
    expect(loaded.seasonOfLife).toBeNull();
    expect(loaded.ongoingBattles).toEqual(['Work pressure']);
    expect(loaded.standingGoal).toHaveLength(120);
    expect(loaded.mediaPrefs).toEqual(['song']);
    expect(loaded.defaultTone).toBeNull();
    expect(loaded.northStar).toBeNull();
  });

  it('the request shape carries labels, not ids — and is null for an empty profile', () => {
    expect(profileForRequest('men', EMPTY_TAILOR_PROFILE)).toBeNull();
    const req = profileForRequest('men', PROFILE);
    expect(req?.seasonOfLife).toBe('Father of young children');
    expect(req?.ongoingBattles).toEqual(['Work pressure', 'Burnout']);
    expect(req?.standingGoal).toBe('Be a patient father.');
    expect(req?.mediaPrefs).toEqual(['song', 'video']);
    // The North Star rides as its resolved phrasing — never the raw id.
    expect(req?.northStar).toBe('"Be still, and know that I am God." — Psalm 46:10');
    expect(req?.northStar).not.toContain('be-still');
    expect(profileSignature(req)).not.toBe(profileSignature(null));
  });

  it('a North Star change busts the day-cache signature like any other profile edit', () => {
    const base = profileForRequest('men', PROFILE);
    const starred = profileForRequest('men', { ...PROFILE, northStar: 'micah' });
    const unstarred = profileForRequest('men', { ...PROFILE, northStar: null });
    expect(profileSignature(starred)).not.toBe(profileSignature(base));
    expect(profileSignature(unstarred)).not.toBe(profileSignature(base));
  });
});

describe('the North Star — one chosen compass, optional by design (Nov 18, 2026)', () => {
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

  it('the registry is whole: unique ids, every entry carrying a label and its words', () => {
    expect(NORTH_STARS).toHaveLength(18);
    expect(new Set(NORTH_STARS.map((s) => s.id)).size).toBe(NORTH_STARS.length);
    for (const star of NORTH_STARS) {
      expect(star.label.length).toBeGreaterThan(0);
      expect(star.text.length).toBeGreaterThan(0);
      expect(star.citation.length).toBeGreaterThan(0);
    }
  });

  it("each track sees its own final list, in Erik's order — and no other stars", () => {
    expect(northStarsForAudience('men').map((s) => s.id)).toEqual([
      'be-still',
      'thy-will',
      'press-on',
      'stand-firm',
      'talents',
      'narrow-gate',
      'micah',
      'radical-love',
      'small-things',
      'breastplate',
    ]);
    expect(northStarsForAudience('women').map((s) => s.id)).toEqual([
      'fiat',
      'be-still',
      'little-way',
      'catherine-fire',
      'come-and-rest',
      'god-is-within-her',
      'love-is-patient',
      'totus-tuus',
      'bahala-na',
    ]);
    // Every menu entry resolves through the registry — no orphan ids.
    for (const audience of ['men', 'women'] as const) {
      for (const star of northStarsForAudience(audience)) {
        expect(northStarById(star.id)).toEqual(star);
      }
    }
  });

  it('the one shared star is the same star on both tracks', () => {
    const his = northStarsForAudience('men').find((s) => s.id === 'be-still');
    const hers = northStarsForAudience('women').find((s) => s.id === 'be-still');
    expect(his).toBeDefined();
    expect(hers).toEqual(his);
    // And Be still is the ONLY overlap between the two menus.
    const menIds = new Set(northStarsForAudience('men').map((s) => s.id));
    const shared = northStarsForAudience('women')
      .filter((s) => menIds.has(s.id))
      .map((s) => s.id);
    expect(shared).toEqual(['be-still']);
  });

  it("the final wordings are Erik's, exactly as ruled", () => {
    expect(northStarById('thy-will')).toMatchObject({
      label: 'Not my will',
      text: 'Not my will, but yours, be done.',
      citation: 'Luke 22:42',
    });
    expect(northStarById('press-on')).toMatchObject({
      label: 'Press on',
      text: 'Forgetting what lies behind, I press on toward the goal.',
      citation: 'Philippians 3:13–14',
    });
    expect(northStarById('micah')).toMatchObject({
      label: 'Act justly',
      text: 'Act justly, love mercy, walk humbly with your God.',
      citation: 'Micah 6:8',
    });
    expect(northStarById('radical-love')).toMatchObject({
      label: 'Radical love',
      text: 'Father, forgive them.',
      citation: 'Luke 23:34',
    });
    expect(northStarById('stand-firm')?.text).toBe(
      'Be watchful, stand firm in the faith, act like men, be strong.',
    );
    expect(northStarById('fiat')).toMatchObject({
      label: 'The Fiat',
      text: 'Let it be to me according to your word.',
      citation: 'Luke 1:38',
    });
    expect(northStarById('breastplate')?.text).toBe(
      'Christ beside me, Christ before me, Christ behind me, Christ within me.',
    );
    expect(northStarById('bahala-na')?.citation).toBe('the Filipino trust');
  });

  it('the draft menu is gone: retired ids no longer resolve', () => {
    for (const id of [
      'fear-not',
      'help-unbelief',
      'seek-first',
      'grace-sufficient',
      'nothing-separates',
      'lamp',
      'love-one-another',
      'not-anxious',
      'well-done',
      'golden-rule',
      'become-a-saint',
      'memento-mori',
    ]) {
      expect(northStarById(id), id).toBeNull();
      expect(northStarLabel(id), id).toBeNull();
    }
  });

  it('the label is the words plus their source', () => {
    expect(northStarLabel('be-still')).toBe('"Be still, and know that I am God." — Psalm 46:10');
    expect(northStarLabel('little-way')).toBe(
      '"The little way — small things done with great love." — after St. Thérèse of Lisieux',
    );
    expect(northStarLabel('radical-love')).toBe('"Father, forgive them." — Luke 23:34');
    expect(northStarLabel(null)).toBeNull();
    expect(northStarLabel('not-a-star')).toBeNull();
    expect(northStarById(null)).toBeNull();
  });

  it("a stored star validates against its own track's list on load — the other track's stars do not cross", () => {
    // Her Fiat written under his key reads as no star at all.
    localStorage.setItem(tailorProfileKey('men'), JSON.stringify({ northStar: 'fiat' }));
    expect(loadTailorProfile('men').northStar).toBeNull();
    // His Stand firm written under her key, likewise.
    localStorage.setItem(tailorProfileKey('women'), JSON.stringify({ northStar: 'stand-firm' }));
    expect(loadTailorProfile('women').northStar).toBeNull();
    // A retired draft id is dead on load too, on either track.
    localStorage.setItem(tailorProfileKey('men'), JSON.stringify({ northStar: 'golden-rule' }));
    expect(loadTailorProfile('men').northStar).toBeNull();
    // The shared star loads on both tracks; each track's own stars load at home.
    saveTailorProfile('men', { ...EMPTY_TAILOR_PROFILE, northStar: 'be-still' });
    expect(loadTailorProfile('men').northStar).toBe('be-still');
    saveTailorProfile('women', { ...EMPTY_TAILOR_PROFILE, northStar: 'be-still' });
    expect(loadTailorProfile('women').northStar).toBe('be-still');
    saveTailorProfile('women', { ...EMPTY_TAILOR_PROFILE, northStar: 'fiat' });
    expect(loadTailorProfile('women').northStar).toBe('fiat');
    saveTailorProfile('men', { ...EMPTY_TAILOR_PROFILE, northStar: 'breastplate' });
    expect(loadTailorProfile('men').northStar).toBe('breastplate');
  });

  it('unset is the ordinary state: a profile with no star behaves exactly as before', () => {
    // A stored profile written before the field existed loads with no star.
    localStorage.setItem(
      tailorProfileKey('men'),
      JSON.stringify({
        seasonOfLife: 'father-young',
        ongoingBattles: ['Work pressure'],
        standingGoal: 'Be a patient father.',
        mediaPrefs: ['song'],
        defaultTone: 'courage',
      }),
    );
    const loaded = loadTailorProfile('men');
    expect(loaded.northStar).toBeNull();
    const req = profileForRequest('men', loaded);
    expect(req?.northStar).toBeNull();
    // And the empty profile is still simply empty — no request profile at all.
    expect(profileForRequest('men', EMPTY_TAILOR_PROFILE)).toBeNull();
    expect(hasTailorProfile('women')).toBe(false);
  });

  it('a star alone makes a profile — and the whole-profile erase takes it too', () => {
    saveTailorProfile('men', { ...EMPTY_TAILOR_PROFILE, northStar: 'thy-will' });
    expect(hasTailorProfile('men')).toBe(true);
    expect(loadTailorProfile('men').northStar).toBe('thy-will');
    eraseTailorProfile('men');
    expect(loadTailorProfile('men')).toEqual(EMPTY_TAILOR_PROFILE);
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

  it('the North Star sits at the bottom of the editor, optional and disclosed', () => {
    const panel = read('components/TailorToday.tsx');
    // After the last standing selection (the tone row), before the save row.
    const toneAt = panel.indexOf('Usually, from God you want');
    const starAt = panel.indexOf('Your North Star — only if you want one');
    const saveAt = panel.indexOf('Save profile');
    expect(toneAt).toBeGreaterThanOrEqual(0);
    expect(starAt).toBeGreaterThan(toneAt);
    expect(saveAt).toBeGreaterThan(starAt);
    // A swipe-through pager (scroll-snap), one star at a time, None included —
    // and it pages through the reader's OWN track's list, never the registry.
    expect(panel).toContain('snap-x snap-mandatory');
    expect(panel).toContain('northStarsForAudience(audience)');
    expect(panel).toContain('Swipe to look through them; tap one to choose it.');
    // Optional, plainly — and the disclosure names all three things it guides.
    expect(panel).toContain('A North Star is optional.');
    expect(panel).toContain('quietly guides Tailor, the');
    expect(panel).toContain('kept only on this phone');
  });

  it('the progress lines are the build’s real stages, focus named, assembly last', () => {
    const lines = tailorProgressLines('grief');
    expect(lines[0]).toBe('Reading today’s readings…');
    expect(lines[1]).toContain('grief');
    expect(lines[2]).toBe('Choosing something to lift you…');
    expect(lines[3]).toContain('Putting your morning together');
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
