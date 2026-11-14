import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  concatBase64Mp3,
  fetchTailorAudio,
  getOrBuildTailored,
  intakeHash,
  loadTodaysTailored,
  mediaActionLabel,
  parseAudioPlan,
  parseTailorResponse,
  tailorAudioUrl,
  tailorCreditLine,
  tailorMetaKey,
  type TailorStore,
  type TailoredDevotional,
} from './tailor';
import { tailorAccess, tailorOffered } from './tailorAccess';
import { TAILOR_FOCUSES, TAILOR_STATES } from '@/data/tailorBank';

/**
 * Tailor Today, client side (Nov 12, 2026): the entitlement stub, the strict
 * response parse, and the on-device cache contract — build once through the
 * function, replay forever from the device with NO second server call. The
 * intake carries no lens: companions are text-only and live in their chats,
 * and the credit line names the day's narrator only.
 */

const INTAKE = { state: 'anxious' as const, focus: 'work' as const, tone: 'courage' as const, freeText: 'Big review at 2.' };

const RESPONSE = {
  ok: true,
  date: '2026-11-12',
  narratorId: 'martin',
  narratorName: 'Martin',
  passage: { citation: 'Psalm 90:17', text: 'And let the brightness of the Lord our God be upon us.', translation: 'Douay-Rheims' },
  reflect: 'A tailored reflection.',
  challenge: 'One tailored act.',
  traditionQuote: { text: 'Pray, hope, and don’t worry.', author: 'St. Padre Pio' },
  media: {
    kind: 'song',
    type: 'song',
    title: "They'll Know We Are Christians",
    creator: 'Peter Scholtes',
    url: 'https://www.youtube.com/results?search_query=x',
    searchUrl: 'https://www.youtube.com/results?search_query=x',
    why: 'Chosen for work & career — a little courage for today.',
  },
  audioBase64: 'QUJD',
  audioSeconds: 240,
};

/** A build's audio plan as the function issues it (three pieces, one silent). */
const PLAN = [
  { index: 0, text: 'The head of the program.', token: 'tok-0' },
  { index: 1, text: '', token: 'tok-1' },
  { index: 2, text: 'The second movement.', token: 'tok-2' },
];

/** The pieces' audio, by index — 'ABC' + 'DEF' + 'GHI' when stitched. */
const PIECE_AUDIO: Record<number, string> = { 0: 'QUJD', 1: 'REVG', 2: 'R0hJ' };

function memoryStore(): TailorStore & { map: Map<string, TailoredDevotional> } {
  const map = new Map<string, TailoredDevotional>();
  return {
    map,
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

describe('the entitlement seam — free for everyone today', () => {
  it('tailorAccess allows everyone and is not premium', () => {
    expect(tailorAccess()).toEqual({ allowed: true, premium: false });
    expect(tailorOffered()).toBe(true);
  });
});

describe('the intake shape', () => {
  it('the state and focus lists are exactly the approved ones', () => {
    expect(TAILOR_STATES.map((s) => s.id)).toEqual(['steady', 'anxious', 'down', 'angry', 'grateful', 'numb', 'scattered']);
    expect(TAILOR_FOCUSES.map((f) => f.id)).toEqual(['work', 'marriage', 'family', 'conversation', 'grief', 'temptation', 'decision', 'today']);
    // Neutral labels only — no parenthood or role assumed on either track.
    expect(TAILOR_FOCUSES.map((f) => f.label)).toContain('Family & children');
  });

  it('the intake hash is stable per intake and differs across intakes', () => {
    expect(intakeHash(INTAKE)).toBe(intakeHash({ ...INTAKE }));
    expect(intakeHash(INTAKE)).not.toBe(intakeHash({ ...INTAKE, state: 'down' }));
    expect(intakeHash(INTAKE)).not.toBe(intakeHash({ ...INTAKE, freeText: 'Different words.' }));
  });

  it('the hash covers the tone and the standing profile — either change is a new build', () => {
    expect(intakeHash(INTAKE)).not.toBe(intakeHash({ ...INTAKE, tone: 'comfort' }));
    const withProfile = {
      ...INTAKE,
      profile: { seasonOfLife: 'Married', ongoingBattles: ['Work pressure'], standingGoal: '', mediaPrefs: [] as never[] },
    };
    expect(intakeHash(withProfile)).not.toBe(intakeHash(INTAKE));
    expect(intakeHash(withProfile)).not.toBe(
      intakeHash({ ...withProfile, profile: { ...withProfile.profile, standingGoal: 'Be patient.' } }),
    );
  });
});

describe('the response parse', () => {
  it('accepts the function shape, media card and tradition quote included', () => {
    const parsed = parseTailorResponse(RESPONSE);
    expect(parsed?.media.kind).toBe('song');
    expect(parsed?.media.url).toBe('https://www.youtube.com/results?search_query=x');
    expect(parsed?.media.why).toContain('courage');
    expect(parsed?.traditionQuote).toEqual({ text: 'Pray, hope, and don’t worry.', author: 'St. Padre Pio' });
    expect(parsed?.narratorName).toBe('Martin');
    expect(parsed && 'lensId' in parsed).toBe(false);
  });

  it('a v1-shaped response (type/searchUrl, no quote) still parses, quote null', () => {
    const v1 = {
      ...RESPONSE,
      traditionQuote: undefined,
      media: { type: 'song', title: 'x', creator: 'y', searchUrl: 'https://www.youtube.com/results?search_query=x' },
    };
    const parsed = parseTailorResponse(v1);
    expect(parsed?.media.kind).toBe('song');
    expect(parsed?.media.url).toBe('https://www.youtube.com/results?search_query=x');
    expect(parsed?.traditionQuote).toBeNull();
  });

  it('found kinds beyond the bank four parse too — video, article, book', () => {
    for (const kind of ['video', 'article', 'book'] as const) {
      const parsed = parseTailorResponse({
        ...RESPONSE,
        media: { kind, title: 'x', creator: 'y', url: 'https://example.com/work', why: 'w' },
      });
      expect(parsed?.media.kind).toBe(kind);
    }
  });

  it('rejects a failed or malformed response', () => {
    expect(parseTailorResponse({ ...RESPONSE, ok: false })).toBeNull();
    expect(parseTailorResponse({ ...RESPONSE, media: { type: 'hologram', title: 'x', creator: 'y', searchUrl: 'z' } })).toBeNull();
    expect(parseTailorResponse(null)).toBeNull();
  });

  it('a text-only build (interim function shape — audio null or absent) parses whole, audio absent', () => {
    // Round 3: the function returns the complete text package with
    // audioBase64 null while its in-render is disabled. The package must
    // NOT be rejected for lacking narration — only the Listen bar goes away.
    for (const audio of [null, '', undefined]) {
      const parsed = parseTailorResponse({ ...RESPONSE, audioBase64: audio, audioSeconds: 0 });
      expect(parsed).not.toBeNull();
      expect(parsed?.reflect).toBe('A tailored reflection.');
      expect(parsed?.challenge).toBe('One tailored act.');
      expect(parsed?.audioBase64).toBeNull();
      expect(parsed?.audioSeconds).toBe(0);
      expect(parsed && tailorAudioUrl(parsed)).toBeNull();
    }
    // A build WITH audio keeps it, exactly as before.
    const withAudio = parseTailorResponse(RESPONSE);
    expect(withAudio?.audioBase64).toBe('QUJD');
    expect(withAudio?.audioSeconds).toBe(240);
  });

  it('the credit line names the narrator only — no eyes, no lens', () => {
    const parsed = parseTailorResponse(RESPONSE);
    expect(parsed && tailorCreditLine(parsed)).toBe('Tailored for today · read by Martin');
  });

  it('a planned build parses its audio plan; no plan parses as none', () => {
    const planned = parseTailorResponse({ ...RESPONSE, audioBase64: null, audioSeconds: 0, audioPlan: PLAN });
    expect(planned?.audioBase64).toBeNull();
    expect(planned?.audioPlan).toEqual(PLAN);
    expect(parseTailorResponse(RESPONSE)?.audioPlan).toBeNull();
    expect(parseTailorResponse({ ...RESPONSE, audioPlan: null })?.audioPlan).toBeNull();
  });

  it('the plan parse sorts by index and refuses malformed plans without refusing the package', () => {
    const shuffled = [PLAN[2], PLAN[0], PLAN[1]];
    expect(parseAudioPlan(shuffled)?.map((e) => e.index)).toEqual([0, 1, 2]);
    for (const bad of [
      [{ index: 0, text: 'x' }], // no token
      [{ index: -1, text: 'x', token: 't' }],
      [{ index: 0.5, text: 'x', token: 't' }],
      [{ index: 0, text: 4, token: 't' }],
      'not-an-array',
      [],
    ]) {
      expect(parseAudioPlan(bad)).toBeNull();
      // The package itself still parses whole — the plan is additive.
      expect(parseTailorResponse({ ...RESPONSE, audioBase64: null, audioPlan: bad })).not.toBeNull();
    }
  });

  it('the media action label follows the link', () => {
    const media = (url: string) => ({ kind: 'song' as const, title: 'x', creator: 'y', url, why: '' });
    expect(mediaActionLabel(media('https://www.youtube.com/results?search_query=x'))).toBe('Watch on YouTube');
    expect(mediaActionLabel(media('https://open.spotify.com/search/x'))).toBe('Find it on Spotify');
    expect(mediaActionLabel(media('https://www.google.com/search?q=x'))).toBe('Look it up');
    expect(mediaActionLabel(media('https://www.youtube.com/watch?v=abc'))).toBe('Watch it');
    expect(mediaActionLabel(media('https://example.com/some-article'))).toBe('Open it');
  });
});

describe('the on-device cache — build once, replay without the server', () => {
  const originalStorage = globalThis.localStorage;
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = String(v); },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      } as Storage,
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis, 'localStorage', { value: originalStorage, configurable: true });
  });

  it('first call builds once; the identical second call is served from the device', async () => {
    const store = memoryStore();
    let fetches = 0;
    const fetchImpl = vi.fn(async () => {
      fetches += 1;
      return { ok: true, status: 200, json: async () => RESPONSE } as Response;
    }) as unknown as typeof fetch;

    const first = await getOrBuildTailored('2026-11-12', 'men', INTAKE, { fetchImpl, store });
    expect(first.fromCache).toBe(false);
    expect(fetches).toBe(1);
    expect(first.devotional.narratorName).toBe('Martin');

    const second = await getOrBuildTailored('2026-11-12', 'men', INTAKE, { fetchImpl, store });
    expect(second.fromCache).toBe(true);
    expect(fetches).toBe(1); // the replay never touches the server
    expect(second.devotional).toEqual(first.devotional);
  });

  it("loadTodaysTailored returns the day's build from meta + store, per track", async () => {
    const store = memoryStore();
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => RESPONSE }) as Response) as unknown as typeof fetch;
    await getOrBuildTailored('2026-11-12', 'women', INTAKE, { fetchImpl, store });

    const loaded = await loadTodaysTailored('2026-11-12', 'women', { store });
    expect(loaded?.narratorName).toBe('Martin');
    // The other track has no build — its meta key is its own.
    expect(localStorage.getItem(tailorMetaKey('2026-11-12', 'women'))).not.toBeNull();
    expect(localStorage.getItem(tailorMetaKey('2026-11-12', 'men'))).toBeNull();
    expect(await loadTodaysTailored('2026-11-12', 'men', { store })).toBeNull();
    // A different day has nothing.
    expect(await loadTodaysTailored('2026-11-13', 'women', { store })).toBeNull();
  });

  it('a failed build stores nothing and throws for the card to catch', async () => {
    const store = memoryStore();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response) as unknown as typeof fetch;
    await expect(getOrBuildTailored('2026-11-12', 'men', INTAKE, { fetchImpl, store })).rejects.toThrow();
    expect(store.map.size).toBe(0);
    expect(localStorage.getItem(tailorMetaKey('2026-11-12', 'men'))).toBeNull();
  });
});

describe('the MP3 byte concatenation', () => {
  it('joins pieces in the order given — frame concatenation, byte for byte', () => {
    expect(concatBase64Mp3(['QUJD', 'REVG', 'R0hJ'])).toBe('QUJDREVGR0hJ'); // ABCDEFGHI
    expect(concatBase64Mp3(['R0hJ', 'QUJD'])).toBe('R0hJQUJD'); // GHIABC — order is the caller's
  });

  it('a single piece round-trips; no pieces is no audio', () => {
    expect(concatBase64Mp3(['QUJD'])).toBe('QUJD');
    expect(concatBase64Mp3([])).toBeNull();
  });
});

describe('the audio plan, fetched and stitched on-device', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      data: new Map<string, string>(),
      getItem(k: string) { return this.data.get(k) ?? null; },
      setItem(k: string, v: string) { this.data.set(k, v); },
      removeItem(k: string) { this.data.delete(k); },
    });
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  type FetchCall = { url: string; body: Record<string, unknown> };

  /** Fetch that answers piece posts from PIECE_AUDIO and records the calls. */
  function pieceFetch(calls: FetchCall[], failIndex?: number, failOnce = false) {
    let failedAlready = false;
    return vi.fn(async (url: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? '{}') as Record<string, unknown>;
      calls.push({ url, body });
      const piece = body.piece as { index: number };
      const shouldFail = piece.index === failIndex && (!failOnce || !failedAlready);
      if (shouldFail) {
        failedAlready = true;
        return { ok: false, status: 403, json: async () => ({ ok: false }) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, audioBase64: PIECE_AUDIO[piece.index], seconds: 10 }),
      } as Response;
    }) as unknown as typeof fetch;
  }

  async function plannedBuild(calls: FetchCall[]) {
    const store = memoryStore();
    const buildFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ...RESPONSE, audioBase64: null, audioSeconds: 0, audioPlan: PLAN }),
    }) as Response) as unknown as typeof fetch;
    void calls;
    const built = await getOrBuildTailored('2026-11-12', 'men', INTAKE, { fetchImpl: buildFetch, store });
    return { store, devotional: built.devotional };
  }

  it('fetches every piece with its token, stitches in plan order, and caches the joined audio', async () => {
    const calls: FetchCall[] = [];
    const { store, devotional } = await plannedBuild(calls);
    expect(devotional.audioBase64).toBeNull();

    const merged = await fetchTailorAudio('2026-11-12', 'men', devotional, {
      fetchImpl: pieceFetch(calls),
      store,
    });
    expect(merged?.audioBase64).toBe('QUJDREVGR0hJ'); // the plan's pieces, in order
    expect(merged?.audioSeconds).toBe(30); // the pieces' own seconds, summed

    // Every call carried exactly its plan entry — date, track, index, text, token.
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.url).toBe('https://example.supabase.co/functions/v1/tailor-devotional');
      const piece = call.body.piece as { date: string; audience: string; index: number; text: string; token: string };
      expect(piece.date).toBe('2026-11-12');
      expect(piece.audience).toBe('men');
      expect(piece.text).toBe(PLAN[piece.index].text);
      expect(piece.token).toBe(PLAN[piece.index].token);
    }

    // The cache now holds the stitched package: replay needs no second fetch.
    const replay = await loadTodaysTailored('2026-11-12', 'men', { store });
    expect(replay?.audioBase64).toBe('QUJDREVGR0hJ');
  });

  it('a piece that fails its one retry leaves the package text-only, plan intact', async () => {
    const calls: FetchCall[] = [];
    const { store, devotional } = await plannedBuild(calls);
    const merged = await fetchTailorAudio('2026-11-12', 'men', devotional, {
      fetchImpl: pieceFetch(calls, 1),
      store,
    });
    expect(merged).toBeNull();
    // The failing piece was called twice (first try + the one retry).
    const pieceOneCalls = calls.filter(
      (c) => (c.body.piece as { index: number }).index === 1,
    );
    expect(pieceOneCalls).toHaveLength(2);
    // Nothing was written over the cached package — a later open may retry.
    const cached = await loadTodaysTailored('2026-11-12', 'men', { store });
    expect(cached?.audioBase64).toBeNull();
    expect(cached?.audioPlan).toEqual(PLAN);
  });

  it('a piece that fails once and then answers completes the stitch', async () => {
    const calls: FetchCall[] = [];
    const { store, devotional } = await plannedBuild(calls);
    const merged = await fetchTailorAudio('2026-11-12', 'men', devotional, {
      fetchImpl: pieceFetch(calls, 2, true),
      store,
    });
    expect(merged?.audioBase64).toBe('QUJDREVGR0hJ');
  });

  it('no plan — or audio already present — means no piece calls at all', async () => {
    const calls: FetchCall[] = [];
    const fetchImpl = pieceFetch(calls);
    const textOnly = parseTailorResponse({ ...RESPONSE, audioBase64: null, audioSeconds: 0 });
    expect(await fetchTailorAudio('2026-11-12', 'men', textOnly!, { fetchImpl })).toBeNull();
    const baked = parseTailorResponse(RESPONSE);
    expect(await fetchTailorAudio('2026-11-12', 'men', baked!, { fetchImpl })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
