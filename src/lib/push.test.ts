import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  VAPID_PUBLIC_KEY,
  arrayBufferToBase64Url,
  buildDeactivateBody,
  buildUpsertBody,
  loadPushReminder,
  resolvePushState,
  resyncPushTimezoneIfNeeded,
  shouldResyncTimezone,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from './push';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('push state machine', () => {
  const base: PushEnvironment = {
    hasPushApi: true,
    isIOS: false,
    isStandalone: true,
    permission: 'default',
    hasLocalSubscription: false,
  };

  it('an iPhone in a browser tab is told to install first — before anything else', () => {
    expect(resolvePushState({ ...base, isIOS: true, isStandalone: false })).toBe('not-installed');
    // Even when the raw API looks absent (it does, in an iOS tab), install is the message.
    expect(resolvePushState({ ...base, isIOS: true, isStandalone: false, hasPushApi: false })).toBe('not-installed');
  });

  it('no Push API at all is unsupported', () => {
    expect(resolvePushState({ ...base, hasPushApi: false })).toBe('unsupported');
    expect(resolvePushState({ ...base, permission: 'unsupported' })).toBe('unsupported');
    expect(resolvePushState({ ...base, isIOS: true, isStandalone: true, hasPushApi: false })).toBe('unsupported');
  });

  it('a refused ask is denied, even over a stale local record', () => {
    expect(resolvePushState({ ...base, permission: 'denied' })).toBe('denied');
    expect(resolvePushState({ ...base, permission: 'denied', hasLocalSubscription: true })).toBe('denied');
  });

  it('granted + a remembered subscription is subscribed; granted alone can be recovered', () => {
    expect(resolvePushState({ ...base, permission: 'granted', hasLocalSubscription: true })).toBe('subscribed');
    expect(resolvePushState({ ...base, permission: 'granted', hasLocalSubscription: false })).toBe('granted');
  });

  it('nothing asked yet is default', () => {
    expect(resolvePushState(base)).toBe('default');
  });

  it('an Android tab needs no install to be asked', () => {
    expect(resolvePushState({ ...base, isStandalone: false })).toBe('default');
  });
});

describe('VAPID key handling', () => {
  it('the configured public key is a raw P-256 point (65 bytes, 0x04 first)', () => {
    const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it('base64url conversion round-trips', () => {
    const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const copy = new Uint8Array(bytes);
    expect(arrayBufferToBase64Url(copy.buffer as ArrayBuffer)).toBe(VAPID_PUBLIC_KEY);
  });
});

describe('local reminder state', () => {
  it('defaults sensibly when nothing is stored', () => {
    const state = loadPushReminder();
    expect(state.enabled).toBe(false);
    expect(state.focus).toBe('gospel');
    expect(state.localTime).toBe('07:00');
  });
});

describe('RPC contract — the client bodies', () => {
  it('upsert sends exactly the six named parameters the SQL function declares', () => {
    const body = buildUpsertBody({
      endpoint: 'https://push.example/abc',
      p256dh: 'B'.repeat(87),
      auth: 'a'.repeat(22),
      focus: 'examen',
      localTime: '21:30',
      tz: 'America/Los_Angeles',
    });
    expect(Object.keys(body).sort()).toEqual(
      ['p_auth', 'p_endpoint', 'p_focus', 'p_local_time', 'p_p256dh', 'p_tz'].sort(),
    );
    // A legacy focus in the input normalizes to the Gospel on the way out — since
    // Nov 16, 2026 it is the only focus a write can store.
    expect(body.p_focus).toBe('gospel');
    expect(body.p_local_time).toBe('21:30');
  });

  it('upsert sanitises an unknown focus and a malformed time to the defaults', () => {
    const body = buildUpsertBody({
      endpoint: 'https://push.example/abc',
      p256dh: 'x',
      auth: 'y',
      focus: 'weather',
      localTime: '9am',
      tz: 'UTC',
    });
    expect(body.p_focus).toBe('gospel');
    expect(body.p_local_time).toBe('07:00');
  });

  it('deactivate sends only the endpoint', () => {
    expect(buildDeactivateBody('https://push.example/abc')).toEqual({ p_endpoint: 'https://push.example/abc' });
  });
});

describe('RPC contract — the migration the bodies are sent to', () => {
  const sql = readFileSync(
    join(repoRoot, 'supabase/migrations/20261031120000_create_push_subscriptions.sql'),
    'utf8',
  );

  it('declares both functions with the parameter names the client sends', () => {
    expect(sql).toContain('FUNCTION public.upsert_push_subscription(');
    for (const param of ['p_endpoint text', 'p_p256dh text', 'p_auth text', 'p_focus text', 'p_local_time text', 'p_tz text']) {
      expect(sql).toContain(param);
    }
    expect(sql).toContain('FUNCTION public.deactivate_push_subscription(p_endpoint text)');
  });

  it('keeps the table unreachable from the browser, like the email list', () => {
    expect(sql).toContain('REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('USING (false)');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text) TO anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.deactivate_push_subscription(text) TO anon, authenticated');
  });

  it('constrains the focus column to the four reminder focuses', () => {
    expect(sql).toContain("CHECK (focus IN ('gospel', 'examen', 'rosary', 'rule'))");
  });
});

describe('timezone re-sync (Play 3 — the phone travelled)', () => {
  it('the pure decision: differing zones resync, matching zones do not', () => {
    expect(shouldResyncTimezone('America/Los_Angeles', 'America/New_York')).toBe(true);
    expect(shouldResyncTimezone('America/New_York', 'America/New_York')).toBe(false);
    // A legacy row with no zone recorded still earns the correction.
    expect(shouldResyncTimezone('', 'America/New_York')).toBe(true);
    // An unreadable current zone never triggers a rewrite.
    expect(shouldResyncTimezone('America/Los_Angeles', '')).toBe(false);
  });

  it('App wires the re-sync on mount', () => {
    const app = readFileSync(join(repoRoot, 'src/App.tsx'), 'utf8');
    expect(app).toContain('void resyncPushTimezoneIfNeeded();');
  });
});

describe('resyncPushTimezoneIfNeeded — silent, best-effort, upsert machinery only', () => {
  const ENDPOINT = 'https://push.example/abc';
  const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const otherTz = currentTz === 'Pacific/Kiritimati' ? 'America/New_York' : 'Pacific/Kiritimati';

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

  const fakeSubscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({ keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }),
  };

  let fetchCalls: { url: string; body: Record<string, unknown> }[];

  function stubBrowser(getSubscription: () => Promise<unknown>) {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ pushManager: { getSubscription } }),
        },
      },
      configurable: true,
    });
    fetchCalls = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      return { ok: true, json: async () => true };
    });
  }

  function seedReminder(tz: string) {
    localStorage.setItem(
      'sanctum_push_reminder',
      JSON.stringify({ enabled: true, endpoint: ENDPOINT, focus: 'gospel', localTime: '07:00', tz, audience: 'men' }),
    );
  }

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('re-upserts with the current zone when the stored zone differs — focus and time untouched', async () => {
    seedReminder(otherTz);
    stubBrowser(async () => fakeSubscription);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(true);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain('upsert_push_subscription');
    expect(fetchCalls[0].body.p_tz).toBe(currentTz);
    expect(fetchCalls[0].body.p_local_time).toBe('07:00');
    expect(fetchCalls[0].body.p_focus).toBe('gospel');
    expect(fetchCalls[0].body.p_endpoint).toBe(ENDPOINT);
    // The local record now carries the zone the server was just given.
    expect(loadPushReminder().tz).toBe(currentTz);
  });

  it('no-ops when the zones already agree', async () => {
    seedReminder(currentTz);
    stubBrowser(async () => fakeSubscription);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });

  it('no-ops without an active subscription on the device', async () => {
    stubBrowser(async () => fakeSubscription);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });

  it('no-ops when the browser holds no live subscription to re-upsert', async () => {
    seedReminder(otherTz);
    stubBrowser(async () => null);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });

  it('never throws: a failing subscription lookup resolves to false', async () => {
    seedReminder(otherTz);
    stubBrowser(async () => {
      throw new Error('service worker unavailable');
    });
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(false);
  });
});

describe('iOS install smoothing (Play 3) — the steps stand earlier in the reminder flow', () => {
  const card = readFileSync(join(repoRoot, 'src/components/ReminderCard.tsx'), 'utf8');
  const form = readFileSync(join(repoRoot, 'src/components/ReminderForm.tsx'), 'utf8');

  it('the reminder card itself carries the shared install steps when iOS needs them', () => {
    expect(card).toContain("getPushState() === 'not-installed'");
    expect(card).toContain('<InstallInstructions');
    expect(card).toContain('data-reminder-install-steps');
    // The card's gating is untouched — it still reads the same state machine.
    expect(card).toContain('reminderCardState(reminder, dismissedAt, Date.now(), readFirstValue())');
  });

  it('the form leads with the steps, in plain words, before the why', () => {
    expect(form).toContain('First, put Sanctum on your Home Screen');
    expect(form.indexOf('First, put Sanctum on your Home Screen')).toBeLessThan(
      form.indexOf('tab cannot receive notifications'),
    );
    expect(form.indexOf('<InstallInstructions')).toBeLessThan(
      form.indexOf('tab cannot receive notifications'),
    );
  });
});
