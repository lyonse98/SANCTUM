import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOrBuildTailored,
  intakeHash,
  loadTodaysTailored,
  mediaActionLabel,
  parseTailorResponse,
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
    expect(parseTailorResponse({ ...RESPONSE, audioBase64: '' })).toBeNull();
    expect(parseTailorResponse(null)).toBeNull();
  });

  it('the credit line names the narrator only — no eyes, no lens', () => {
    const parsed = parseTailorResponse(RESPONSE);
    expect(parsed && tailorCreditLine(parsed)).toBe('Tailored for today · read by Martin');
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
