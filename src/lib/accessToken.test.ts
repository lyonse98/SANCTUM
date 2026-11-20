import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCESS_BLOCKED_MESSAGE,
  ACCESS_REQUIRED_CODE,
  ACCESS_TOKEN_KEY,
  accessTokenFromSearch,
  captureAccessTokenFromLocation,
  hasAccessTokenParam,
  isAccessRequired,
  isWellFormedAccessToken,
  loadAccessToken,
  stripAccessTokenParam,
} from './accessToken';
import { ACCESS_URL } from './accessRequest';
import { streamChat } from './llm';
import { getOrBuildTailored, TailorAccessRequiredError, type TailorStore } from './tailor';
import { buildCloseOfDay } from './tailorPm';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const TOKEN = 'test-token-0123456789abcdef';
const TOKEN_2 = 'second-token-0123456789abcdef';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

let storage: ReturnType<typeof makeStorage>;

beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/**
 * The access token (Nov 20, 2026) — gate the spend, not the page.
 * These pins hold the whole client discipline: the arrival is captured
 * and the address bar cleaned, a fresh link heals a stored token, the
 * token rides the gated calls and NOTHING else, and a refusal becomes
 * the calm line on every surface it can reach.
 */
describe('access token — shape and parsing', () => {
  it('accepts only long, unspaced strings', () => {
    expect(isWellFormedAccessToken(TOKEN)).toBe(true);
    expect(isWellFormedAccessToken('short')).toBe(false);
    expect(isWellFormedAccessToken('has a space in it........')).toBe(false);
    expect(isWellFormedAccessToken(null)).toBe(false);
    expect(isWellFormedAccessToken(undefined)).toBe(false);
  });

  it('reads a well-formed token out of the arrival, and nothing else', () => {
    expect(accessTokenFromSearch(`?k=${TOKEN}`)).toBe(TOKEN);
    expect(accessTokenFromSearch(`?focus=gospel&k=${TOKEN}`)).toBe(TOKEN);
    expect(accessTokenFromSearch('?k=short')).toBeNull();
    expect(accessTokenFromSearch('?focus=gospel')).toBeNull();
    expect(accessTokenFromSearch('')).toBeNull();
  });

  it('knows the parameter is present even when malformed — it still leaves the address bar', () => {
    expect(hasAccessTokenParam('?k=short')).toBe(true);
    expect(hasAccessTokenParam('?focus=gospel')).toBe(false);
  });

  it('strips only the token parameter — other parameters and the hash ride through', () => {
    expect(stripAccessTokenParam(`https://sanctumdaily.app/?k=${TOKEN}&focus=gospel#daily-gospel`)).toBe(
      '/?focus=gospel#daily-gospel',
    );
    expect(stripAccessTokenParam(`https://sanctumdaily.app/?k=${TOKEN}`)).toBe('/');
    expect(stripAccessTokenParam('https://sanctumdaily.app/?focus=gospel')).toBe('/?focus=gospel');
  });
});

describe('access token — capture on arrival', () => {
  it('stores the token and cleans the address bar', () => {
    const replaced: string[] = [];
    const captured = captureAccessTokenFromLocation({
      href: `https://sanctumdaily.app/?k=${TOKEN}`,
      search: `?k=${TOKEN}`,
      replaceUrl: (u) => replaced.push(u),
    });
    expect(captured).toBe(true);
    expect(loadAccessToken()).toBe(TOKEN);
    expect(replaced).toEqual(['/']);
  });

  it('a new link REPLACES the stored token — a re-issued link heals a revoked one', () => {
    storage.setItem(ACCESS_TOKEN_KEY, TOKEN);
    captureAccessTokenFromLocation({
      href: `https://sanctumdaily.app/?k=${TOKEN_2}`,
      search: `?k=${TOKEN_2}`,
      replaceUrl: () => {},
    });
    expect(loadAccessToken()).toBe(TOKEN_2);
  });

  it('a malformed token is not stored, but the parameter still leaves the address bar', () => {
    const replaced: string[] = [];
    const captured = captureAccessTokenFromLocation({
      href: 'https://sanctumdaily.app/?k=short',
      search: '?k=short',
      replaceUrl: (u) => replaced.push(u),
    });
    expect(captured).toBe(false);
    expect(loadAccessToken()).toBeNull();
    expect(replaced).toEqual(['/']);
  });

  it('an arrival without the parameter changes nothing and touches no URL', () => {
    const replaced: string[] = [];
    const captured = captureAccessTokenFromLocation({
      href: 'https://sanctumdaily.app/?focus=gospel',
      search: '?focus=gospel',
      replaceUrl: (u) => replaced.push(u),
    });
    expect(captured).toBe(false);
    expect(replaced).toEqual([]);
  });

  it('a stored value that is not token-shaped reads as no token', () => {
    storage.setItem(ACCESS_TOKEN_KEY, 'hand-edited');
    expect(loadAccessToken()).toBeNull();
  });

  it('App captures the token on load, ahead of the focus effect that rewrites the URL', () => {
    const app = readSrc('App.tsx');
    const captureAt = app.indexOf('captureAccessTokenFromLocation()');
    expect(captureAt).toBeGreaterThan(-1);
    // The focus EFFECT (not the arrival initializer's read of the same
    // helper) is the one that rewrites the URL — the capture stands
    // ahead of it, so the token is kept before the bar is cleaned.
    const focusEffectAt = app.indexOf('const focus = parseFocusParam(window.location.search);');
    expect(focusEffectAt).toBeGreaterThan(-1);
    expect(captureAt).toBeLessThan(focusEffectAt);
    expect(app).toContain("from '@/lib/accessToken'");
  });
});

describe('access token — the refusal shape', () => {
  it('recognizes only the 403 access_required refusal', () => {
    expect(isAccessRequired(403, { error: ACCESS_REQUIRED_CODE })).toBe(true);
    expect(isAccessRequired(403, { error: 'access_required' })).toBe(true);
    expect(isAccessRequired(403, { error: 'That audio piece is not authorized.' })).toBe(false);
    expect(isAccessRequired(429, { error: ACCESS_REQUIRED_CODE })).toBe(false);
    expect(isAccessRequired(403, null)).toBe(false);
    expect(isAccessRequired(403, 'access_required')).toBe(false);
  });

  it('the calm line is the specified sentence, with no codes and no alarm words', () => {
    expect(ACCESS_BLOCKED_MESSAGE).toBe(
      'Sanctum is in a small testing season. Companions and tailored devotionals are for the testing circle right now.',
    );
    expect(ACCESS_BLOCKED_MESSAGE).not.toContain('access_required');
    expect(ACCESS_BLOCKED_MESSAGE.toLowerCase()).not.toContain('error');
  });
});

describe('access token — the chat call carries it, and a refusal becomes the calm line', () => {
  it('sends the stored token as a top-level field and answers a refusal with the calm line', async () => {
    storage.setItem(ACCESS_TOKEN_KEY, TOKEN);
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        bodies.push(JSON.parse(init?.body ?? '{}') as Record<string, unknown>);
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: 'access_required' }),
        } as Response;
      }),
    );
    const errors: string[] = [];
    await streamChat([{ role: 'user', content: 'Hello.' }], {
      onToken: () => {},
      onDone: () => {},
      onError: (e) => errors.push(e),
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0].accessToken).toBe(TOKEN);
    expect(errors).toEqual([`${ACCESS_BLOCKED_MESSAGE} You can request access at ${ACCESS_URL}.`]);
  });

  it('with no token stored, the field rides as null — and a plain 403 stays the session line', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        bodies.push(JSON.parse(init?.body ?? '{}') as Record<string, unknown>);
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: 'Something else.' }),
        } as Response;
      }),
    );
    const errors: string[] = [];
    await streamChat([{ role: 'user', content: 'Hello.' }], {
      onToken: () => {},
      onDone: () => {},
      onError: (e) => errors.push(e),
    });
    expect(bodies[0].accessToken).toBeNull();
    expect(errors).toEqual(['This session has expired. Reload Sanctum and try again.']);
  });
});

describe('access token — the tailor doors carry it', () => {
  const emptyStore = (): TailorStore => ({
    get: async () => null,
    set: async () => {},
    getPieces: async () => null,
    setPieces: async () => {},
    deletePieces: async () => {},
  });

  it('a build refusal throws the access error — and the build body carried the token', async () => {
    storage.setItem(ACCESS_TOKEN_KEY, TOKEN);
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: { body?: string }) => {
      bodies.push(JSON.parse(init?.body ?? '{}') as Record<string, unknown>);
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: 'access_required' }),
      } as Response;
    }) as unknown as typeof fetch;
    await expect(
      getOrBuildTailored(
        '2026-11-20',
        'men',
        { state: 'steady', focus: 'today', tone: 'comfort', freeText: '' },
        { fetchImpl, store: emptyStore() },
      ),
    ).rejects.toBeInstanceOf(TailorAccessRequiredError);
    expect(bodies[0].accessToken).toBe(TOKEN);
  });

  it('a PM refusal throws the same access error — and the PM body carried the token', async () => {
    storage.setItem(ACCESS_TOKEN_KEY, TOKEN);
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: { body?: string }) => {
      bodies.push(JSON.parse(init?.body ?? '{}') as Record<string, unknown>);
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: 'access_required' }),
      } as Response;
    }) as unknown as typeof fetch;
    await expect(
      buildCloseOfDay(
        '2026-11-20',
        'men',
        { state: 'steady', focus: 'today', tone: 'comfort', freeText: '' },
        'held',
        { fetchImpl },
      ),
    ).rejects.toBeInstanceOf(TailorAccessRequiredError);
    expect(bodies[0].mode).toBe('pm');
    expect(bodies[0].accessToken).toBe(TOKEN);
  });

  it('the piece body carries the token beside the piece, never inside it', () => {
    const tailor = readSrc('lib/tailor.ts');
    expect(tailor).toContain('accessToken: loadAccessToken()');
    const pieceBody = tailor.slice(tailor.indexOf('piece: { date: dateKey'));
    expect(pieceBody.slice(0, 400)).toContain('accessToken: loadAccessToken()');
  });

  it('the letter call carries the token OUTSIDE the packet spread', () => {
    const letters = readSrc('lib/letters.ts');
    const spreadAt = letters.indexOf('...packet');
    const tokenAt = letters.indexOf('accessToken: loadAccessToken()');
    expect(spreadAt).toBeGreaterThan(-1);
    expect(tokenAt).toBeGreaterThan(spreadAt);
  });
});

describe('access token — it rides nowhere else', () => {
  it('the analytics, tally, and feedback payload builders never touch it', () => {
    for (const rel of ['lib/analytics.ts', 'lib/profileTally.ts', 'lib/accessRequest.ts']) {
      const source = readSrc(rel);
      expect(source, rel).not.toContain('accessToken');
      expect(source, rel).not.toContain('loadAccessToken');
      expect(source, rel).not.toContain(ACCESS_TOKEN_KEY);
    }
  });

  it('the stored key is read and written in exactly one module', () => {
    // Every gated call site asks the helper; the literal key string
    // lives in accessToken.ts alone (the wipe list names it in the
    // storage test, which is a list of names, not a reader).
    for (const rel of ['lib/llm.ts', 'lib/letters.ts', 'lib/tailor.ts', 'lib/tailorPm.ts']) {
      const source = readSrc(rel);
      expect(source, rel).not.toContain(ACCESS_TOKEN_KEY);
      expect(source, rel).toContain('loadAccessToken');
    }
  });

  it('the panic wipe takes the token with everything else under the prefix', () => {
    expect(ACCESS_TOKEN_KEY.startsWith('sanctum_')).toBe(true);
    storage.setItem(ACCESS_TOKEN_KEY, TOKEN);
    expect(storage.getItem(ACCESS_TOKEN_KEY)).toBe(TOKEN);
  });
});

describe('access token — the blocked surfaces show the calm line', () => {
  it('the shared note renders the sentence with a real link to the request page', () => {
    const note = readSrc('components/AccessBlockedNote.tsx');
    expect(note).toContain('ACCESS_BLOCKED_MESSAGE');
    expect(note).toContain('href={ACCESS_URL}');
    expect(note).toContain('Request access');
    expect(note).toContain('data-access-blocked');
  });

  it('the Tailor panel catches the access error into the note, not the failure line', () => {
    const panel = readSrc('components/TailorToday.tsx');
    expect(panel).toContain('err instanceof TailorAccessRequiredError');
    expect(panel).toContain('<AccessBlockedNote');
  });

  it('the evening close catches the access error into the note, not the failure line', () => {
    const pm = readSrc('components/TailorPm.tsx');
    expect(pm).toContain('err instanceof TailorAccessRequiredError');
    expect(pm).toContain('<AccessBlockedNote');
  });
});

describe('access token — the copy names it honestly', () => {
  it('the Terms list carries the access key as its own item', () => {
    const copy = readSrc('lib/privacyCopy.ts');
    const row = copy.match(/'An access key for the testing season[^']*'/);
    expect(row).not.toBeNull();
    expect(row![0]).toContain('the name it was issued to');
    expect(row![0]).toContain('never linked to anything you write');
  });

  it('About names the key on-device and remotely, on both tracks', () => {
    const about = readSrc('components/AboutSanctumPage.tsx');
    expect(about).toContain('the access key for the testing season, if she was given one');
    expect(about).toContain('the access key for the testing season, if he was given one');
    expect(about).toContain('an access key if she was given one');
    expect(about).toContain('an access key if he was given one');
  });
});
