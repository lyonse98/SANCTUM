import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONAS, personaForAudience, personasForAudience } from '@/personas';
import { fetchReflection, reflectionCacheKey, reflectionRequestBody } from './reflection';
import { getBeatitudes } from './beatitudes';
import { getCommandments, getDutiesOfState } from './confession';
import { getHelpSections } from './realHelp';
import { getPractices } from './ruleOfLife';
import { buildUpsertBody, buildUpsertBodyWithAudience } from './push';

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
  vi.restoreAllMocks();
});

describe('the companion registry', () => {
  it('holds exactly eight companions per audience, sixteen in all', () => {
    expect(PERSONAS).toHaveLength(16);
    expect(personasForAudience('men')).toHaveLength(8);
    expect(personasForAudience('women')).toHaveLength(8);
  });

  it('every id is unique across both casts', () => {
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the two Therese seats are distinct people-facing ids sharing one portrait', () => {
    const mens = personaForAudience('therese', 'men');
    const womens = personaForAudience('therese-women', 'women');
    expect(mens).not.toBeNull();
    expect(womens).not.toBeNull();
    expect(mens?.portrait).toBe('/therese.webp');
    expect(womens?.portrait).toBe('/therese.webp');
  });

  it('a companion can never resolve into the other track', () => {
    expect(personaForAudience('mary', 'men')).toBeNull();
    expect(personaForAudience('joseph', 'women')).toBeNull();
    expect(personaForAudience('joan', 'women')?.name).toContain('Joan');
  });

  it('every companion is complete: portrait on disk, four presets, a substantive prompt', () => {
    for (const p of PERSONAS) {
      expect(existsSync(join(process.cwd(), 'public', p.portrait)), `${p.id} portrait`).toBe(true);
      expect(p.presets, `${p.id} presets`).toHaveLength(4);
      expect(p.struggles.length, `${p.id} struggles`).toBeGreaterThanOrEqual(3);
      expect(p.description.length, `${p.id} description`).toBeGreaterThan(80);
      // The men's prompts run ~3,000+ characters; a women's seat held to the same bar.
      expect(p.systemPrompt.length, `${p.id} prompt`).toBeGreaterThan(1800);
    }
  });

  it('the accuracy guardrails are written into the prompts themselves', () => {
    const magdalene = personaForAudience('magdalene', 'women');
    // The prompt corrects the conflation explicitly — and never repeats it as fact.
    expect(magdalene?.systemPrompt).toContain('you are not the unnamed sinful woman of Luke 7');
    expect(magdalene?.systemPrompt).toContain('Scripture never calls you a prostitute');
    expect(magdalene?.systemPrompt).not.toMatch(/she was a prostitute/i);

    const joan = personaForAudience('joan', 'women');
    expect(joan?.systemPrompt).toContain('Poitiers');
    expect(joan?.systemPrompt).toMatch(/discernment/);
    expect(joan?.systemPrompt).toMatch(/never[\s\S]{0,120}validate/);

    const mary = personaForAudience('mary', 'women');
    expect(mary?.systemPrompt).toContain('Do whatever he tells you');
    expect(mary?.systemPrompt).toContain('you never claim to bring her a new message, sign, or revelation');
    expect(mary?.systemPrompt).toContain('you never invent words he did not say');
  });
});

describe('daily reflection plumbing', () => {
  it("keeps the men's cache key in its legacy shape and namespaces the women's apart", () => {
    expect(reflectionCacheKey('2026-11-09', 'men')).toBe('sanctum_reflection_2026-11-09');
    expect(reflectionCacheKey('2026-11-09', 'women')).toBe('sanctum_reflection_women_2026-11-09');
  });

  it('sends the audience with the fetch and falls back to the track facet', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { audience: string };
      return {
        ok: true,
        json: async () => ({
          reflect: `For ${body.audience}.`,
          challenge: 'Do the concrete thing.',
          // No facet in the payload — the client must supply the track's own.
        }),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const men = await fetchReflection('2026-11-09', 'men');
    const women = await fetchReflection('2026-11-09', 'women');
    expect(men?.facet).toBe('As a man');
    expect(women?.facet).toBe('As a woman');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Cached per audience: asking again for either track fires no third call,
    // and neither track can be served the other's row.
    const menAgain = await fetchReflection('2026-11-09', 'men');
    const womenAgain = await fetchReflection('2026-11-09', 'women');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(menAgain?.reflect).toBe('For men.');
    expect(womenAgain?.reflect).toBe('For women.');

    expect(reflectionRequestBody('2026-11-09', 'women')).toEqual({ date: '2026-11-09', audience: 'women' });
  });
});

describe('confession data by audience', () => {
  it('keeps ten commandments on both tracks with the same numbers in the same order', () => {
    const men = getCommandments('men');
    const women = getCommandments('women');
    expect(men).toHaveLength(10);
    expect(women).toHaveLength(10);
    expect(women.map((c) => c.num)).toEqual(men.map((c) => c.num));
  });

  it("addresses the ninth commandment to the user's actual life", () => {
    expect(getCommandments('men').find((c) => c.num === 'IX')?.title).toContain("neighbor's wife");
    expect(getCommandments('women').find((c) => c.num === 'IX')?.title).toContain("neighbor's husband");
  });

  it('gives women Wife / Mother / Worker duties and leaves the men\u2019s untouched', () => {
    expect(getDutiesOfState('women').map((d) => d.label)).toEqual(['As a Wife', 'As a Mother', 'As a Worker']);
    expect(getDutiesOfState('men').map((d) => d.label)).toEqual(['As a Husband', 'As a Father', 'As a Worker']);
    for (const duty of [...getDutiesOfState('women'), ...getDutiesOfState('men')]) {
      expect(duty.questions).toHaveLength(3);
    }
  });

  it('runs the same eight Beatitudes in the same order on both tracks', () => {
    const men = getBeatitudes('men');
    const women = getBeatitudes('women');
    expect(women).toHaveLength(8);
    expect(women.map((b) => b.ref)).toEqual(men.map((b) => b.ref));
    expect(women.map((b) => b.verse)).toEqual(men.map((b) => b.verse));
  });
});

describe('real help by audience', () => {
  it("swaps the men's group for a women's group and keeps the universal doors", () => {
    const menIds = getHelpSections('men').map((s) => s.id);
    const womenIds = getHelpSections('women').map((s) => s.id);
    expect(menIds).toContain('mens-group');
    expect(womenIds).not.toContain('mens-group');
    expect(womenIds).toContain('womens-group');
    for (const id of ['mass', 'director', 'therapist', 'marriage', 'addiction']) {
      expect(womenIds).toContain(id);
    }
    // Mass (and Confession, beside it) is the same object on both tracks —
    // universal by construction. (The two doors stood lumped as one
    // "Mass & Confession" entry until Erik's Real Help split, Nov 14, 2026.)
    expect(getHelpSections('women')[0]).toBe(getHelpSections('men')[0]);
    expect(getHelpSections('women')[1]).toBe(getHelpSections('men')[1]);
  });

  it('every outbound link on both tracks is an https URL', () => {
    for (const audience of ['men', 'women'] as const) {
      for (const section of getHelpSections(audience)) {
        for (const link of section.links) {
          expect(link.href, `${audience}/${section.id}`).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("the women's marriage script is addressed to a wife speaking to her husband", () => {
    const marriage = getHelpSections('women').find((s) => s.id === 'marriage');
    expect(marriage?.scriptLabel).toContain('your husband');
  });
});

describe('rule of life by audience', () => {
  it('keeps the same practice keys on both tracks, so a stored rule survives a switch', () => {
    expect(getPractices('women').map((p) => p.key)).toEqual(getPractices('men').map((p) => p.key));
    const wifePractice = getPractices('women').find((p) => p.key === 'wife');
    expect(wifePractice?.label).toBe('Love Your Husband');
    const brotherPractice = getPractices('women').find((p) => p.key === 'brother');
    expect(brotherPractice?.label).toBe('Check On a Sister');
  });
});

describe('push upsert bodies', () => {
  const base = {
    endpoint: 'https://push.example.com/sub/123',
    p256dh: 'B'.repeat(87),
    auth: 'a'.repeat(22),
    focus: 'gospel',
    localTime: '07:00',
    tz: 'America/Los_Angeles',
  };

  it('the legacy body keeps exactly its six fields (the deployed RPC shape)', () => {
    expect(Object.keys(buildUpsertBody(base)).sort()).toEqual(
      ['p_auth', 'p_endpoint', 'p_focus', 'p_local_time', 'p_p256dh', 'p_tz'].sort(),
    );
  });

  it('the audience body is the legacy body plus one validated field', () => {
    const withAudience = buildUpsertBodyWithAudience({ ...base, audience: 'women' });
    expect(withAudience.p_audience).toBe('women');
    const { p_audience: _dropped, ...rest } = withAudience;
    expect(rest).toEqual(buildUpsertBody(base));
  });
});
