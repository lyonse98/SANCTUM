import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TALLY_TOKEN_KEY,
  buildTallyPayload,
  getTallyToken,
  hasTalliedPicks,
  maybeSendDailyProfileTally,
  sendEmptyProfileTally,
  sendProfileTally,
} from './profileTally';
import {
  EMPTY_TAILOR_PROFILE,
  SEASONS_OF_LIFE,
  VOICES,
  battlesForAudience,
  northStarsForAudience,
  saveTailorProfile,
  type TailorProfile,
} from './tailorProfile';
import { ANALYTICS_COPY, ANALYTICS_COPY_WOMEN, PRIVACY_SERVER_LIST } from './privacyCopy';
import {
  TALLY_BATTLES,
  TALLY_NORTH_STARS,
  TALLY_SEASONS,
  TALLY_VOICES,
} from '../../supabase/functions/analytics-track/tally';

/**
 * The counts-only tally (Erik's design, Nov 18–20, 2026). The pins guard
 * the whole promise at once: ids only, picked by name; nothing sent
 * while counts are off; one snapshot per device so counts are people;
 * the server's vocabularies never drifting from the client's; and the
 * privacy copy naming the tally wherever the promise is written down.
 */

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

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

let fetchCalls: { url: string; body: Record<string, unknown> }[];

function stubFetch() {
  fetchCalls = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    return { ok: true, json: async () => ({ ok: true }) };
  });
}

function optIn() {
  localStorage.setItem('sanctum_analytics_opt_in', 'true');
}

const FULL_PROFILE: TailorProfile = {
  ...EMPTY_TAILOR_PROFILE,
  seasonOfLife: 'father-young',
  ongoingBattles: ['Fatherhood', 'Work pressure'],
  standingGoal: 'be present at dinner',
  northStar: 'be-still',
  voices: ['fr-mike', 'huberman'],
  voicesOther: 'A Friend Nobody Listed',
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the payload — ids only, picked by name', () => {
  it('carries exactly the allowlisted keys', () => {
    const payload = buildTallyPayload('men', FULL_PROFILE, 'token-abc');
    expect(Object.keys(payload).sort()).toEqual(
      ['audience', 'northStar', 'ongoingBattles', 'seasonOfLife', 'tallyToken', 'voices'].sort(),
    );
    expect(payload).toEqual({
      tallyToken: 'token-abc',
      audience: 'men',
      voices: ['fr-mike', 'huberman'],
      seasonOfLife: 'father-young',
      ongoingBattles: ['Fatherhood', 'Work pressure'],
      northStar: 'be-still',
    });
  });

  it('no written word of the reader appears anywhere in the payload', () => {
    const wire = JSON.stringify(buildTallyPayload('men', FULL_PROFILE, 'token-abc'));
    expect(wire).not.toContain('be present at dinner');
    expect(wire).not.toContain('A Friend Nobody Listed');
  });

  it('the module never names the free-text profile fields — the fence is structural', () => {
    const source = readRoot('src/lib/profileTally.ts');
    expect(source).not.toContain('voicesOther');
    expect(source).not.toContain('standingGoal');
    // No object-spread of the profile itself ({...profile} / {...profile, …}):
    // the payload is picked field by field. Array copies of the tallied
    // lists ([...profile.voices]) are the picking, not a spread of the
    // object — the lookahead keeps them legal on purpose.
    expect(source).not.toMatch(/\.\.\.profile(?![.\w])/);
  });

  it('hasTalliedPicks reads only the tallied fields', () => {
    expect(hasTalliedPicks(FULL_PROFILE)).toBe(true);
    expect(hasTalliedPicks({ ...EMPTY_TAILOR_PROFILE, standingGoal: 'a goal, in words' })).toBe(false);
    expect(hasTalliedPicks(EMPTY_TAILOR_PROFILE)).toBe(false);
  });
});

describe('consent — nothing rides while counts are off', () => {
  it('sendProfileTally is silent when the opt-in is off', async () => {
    await sendProfileTally('men', FULL_PROFILE);
    expect(fetchCalls).toHaveLength(0);
  });

  it('sendProfileTally posts one tally body to analytics-track when on', async () => {
    optIn();
    await sendProfileTally('men', FULL_PROFILE);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain('/functions/v1/analytics-track');
    const tally = fetchCalls[0].body.tally as Record<string, unknown>;
    expect(tally.audience).toBe('men');
    expect(tally.voices).toEqual(['fr-mike', 'huberman']);
  });

  it('the erase snapshot clears every pick and keeps the same token', async () => {
    optIn();
    const token = getTallyToken();
    await sendEmptyProfileTally('women');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].body.tally).toEqual({
      tallyToken: token,
      audience: 'women',
      voices: [],
      seasonOfLife: null,
      ongoingBattles: [],
      northStar: null,
    });
  });
});

describe('the token — one per device, under the wipe prefix', () => {
  it('is a UUID, persisted under its key, and stable across calls', () => {
    const a = getTallyToken();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(localStorage.getItem(TALLY_TOKEN_KEY)).toBe(a);
    expect(getTallyToken()).toBe(a);
    expect(TALLY_TOKEN_KEY).toBe('sanctum_profile_tally_token');
  });
});

describe('the daily send — once per content day, only with picks', () => {
  const DAY_ONE = new Date(2026, 10, 20, 12, 0);
  const DAY_TWO = new Date(2026, 10, 21, 12, 0);

  it('sends on the first open of a day, not the second, and again the next day', async () => {
    optIn();
    saveTailorProfile('men', FULL_PROFILE);
    await maybeSendDailyProfileTally('men', DAY_ONE);
    await maybeSendDailyProfileTally('men', DAY_ONE);
    expect(fetchCalls).toHaveLength(1);
    await maybeSendDailyProfileTally('men', DAY_TWO);
    expect(fetchCalls).toHaveLength(2);
  });

  it('stays silent when the profile holds no tallied pick', async () => {
    optIn();
    saveTailorProfile('men', { ...EMPTY_TAILOR_PROFILE, standingGoal: 'words only' });
    await maybeSendDailyProfileTally('men', DAY_ONE);
    expect(fetchCalls).toHaveLength(0);
  });

  it('stays silent while counts are off, even with a full profile', async () => {
    saveTailorProfile('men', FULL_PROFILE);
    await maybeSendDailyProfileTally('men', DAY_ONE);
    expect(fetchCalls).toHaveLength(0);
  });
});

describe('the mirrored vocabularies — the two sides cannot drift', () => {
  it('voices match the client registry, per track, in order', () => {
    for (const a of ['men', 'women'] as const) {
      expect(TALLY_VOICES[a]).toEqual(VOICES[a].map((v) => v.id));
    }
  });

  it('seasons and North Star menus match the client lists, per track', () => {
    for (const a of ['men', 'women'] as const) {
      expect(TALLY_SEASONS[a]).toEqual(SEASONS_OF_LIFE[a].map((s) => s.id));
      expect(TALLY_NORTH_STARS[a]).toEqual(northStarsForAudience(a).map((s) => s.id));
    }
  });

  it('battles match the words the client derives from the cast, per track', () => {
    for (const a of ['men', 'women'] as const) {
      expect(TALLY_BATTLES[a]).toEqual(battlesForAudience(a));
    }
  });
});

describe('the store — one row per person, replaced whole, aged out at 90 days', () => {
  const migration = readRoot('supabase/migrations/20261120120000_profile_tallies.sql');
  const fnIndex = readRoot('supabase/functions/analytics-track/index.ts');

  it('the table keys on the token hash and denies anon and authenticated everything', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.profile_tallies');
    expect(migration).toContain('token_hash text PRIMARY KEY');
    expect(migration).toContain('ALTER TABLE public.profile_tallies ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.profile_tallies FROM anon, authenticated');
    for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(migration).toContain(`FOR ${verb} TO anon, authenticated`);
    }
  });

  it('the function upserts on the token hash — a new snapshot replaces the old', () => {
    expect(fnIndex).toContain('profile_tallies?on_conflict=token_hash');
    expect(fnIndex).toContain('resolution=merge-duplicates');
    expect(fnIndex).toContain('hashTallyToken');
  });

  it('the counts view unions the four fields over live snapshots, and is owner-read only', () => {
    expect(migration).toContain('CREATE OR REPLACE VIEW public.profile_tally_counts AS');
    expect(migration).toContain("SELECT 'voices' AS field");
    expect(migration).toContain("SELECT 'season_of_life'");
    expect(migration).toContain("SELECT 'ongoing_battles'");
    expect(migration).toContain("SELECT 'north_star'");
    expect(migration).toContain('jsonb_array_elements_text');
    expect(migration).toContain('REVOKE ALL ON public.profile_tally_counts FROM anon, authenticated');
  });

  it('the reading query is documented in the migration header', () => {
    expect(migration).toContain('from public.profile_tally_counts');
  });

  it('retention purges snapshots unrefreshed for 90 days, on the hardening pattern', () => {
    expect(migration).toContain("'profile-tallies-retention'");
    expect(migration).toContain("delete from public.profile_tallies where updated_at < now() - interval '90 days'");
  });
});

describe('the copy — the promise names the tally wherever it stands', () => {
  it('the Terms server list names the counted boxes, inside the analytics item (still five things)', () => {
    expect(PRIVACY_SERVER_LIST).toHaveLength(5);
    const row = PRIVACY_SERVER_LIST.find((item) => item.includes('usage events'));
    expect(row).toContain('a count of the boxes checked in it');
    expect(row).toContain('never as your words');
  });

  it('the Settings analytics explainer names the tally on both tracks', () => {
    expect(ANALYTICS_COPY).toContain('counts the boxes checked in your Tailor profile');
    expect(ANALYTICS_COPY).toContain('never your words');
    expect(ANALYTICS_COPY_WOMEN).toContain('counts the boxes checked in your Tailor profile');
    expect(ANALYTICS_COPY_WOMEN).toContain('never your words');
  });

  it('About names the counted boxes on both tracks', () => {
    const about = readRoot('src/components/AboutSanctumPage.tsx');
    expect(about).toContain('the boxes checked in her Tailor profile, held only as totals counted across all readers and never as words');
    expect(about).toContain('the boxes checked in his Tailor profile, held only as totals counted across all readers and never as words');
  });
});
