import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { CONFESSION_EVENING_BEFORE_LEAD } from './usualMass';
import {
  DEFAULT_EVENING_TIME,
  VAPID_PUBLIC_KEY,
  arrayBufferToBase64Url,
  buildDeactivateBody,
  buildParishSyncBody,
  buildUpsertBody,
  buildUpsertBodyWithAudience,
  buildUpsertBodyWithEvening,
  loadPushReminder,
  loadTailorReadyPing,
  resolvePushState,
  resyncPushTimezoneIfNeeded,
  saveTailorReadyPing,
  shouldPingTailorReady,
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
    expect(state.eveningTime).toBeNull();
  });

  it('the form’s offered evening default is a real time', () => {
    expect(DEFAULT_EVENING_TIME).toBe('20:00');
  });
});

describe('local reminder state — the evening hour (Nov 17, 2026)', () => {
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
  });

  function seed(patch: Record<string, unknown>) {
    localStorage.setItem(
      'sanctum_push_reminder',
      JSON.stringify({
        enabled: true,
        endpoint: 'https://push.example/abc',
        focus: 'gospel',
        localTime: '07:00',
        tz: 'America/Los_Angeles',
        audience: 'men',
        ...patch,
      }),
    );
  }

  it('a stored valid evening hour is read back', () => {
    seed({ eveningTime: '20:30' });
    expect(loadPushReminder().eveningTime).toBe('20:30');
  });

  it('a malformed or absent evening hour reads back as none set', () => {
    seed({ eveningTime: '8pm' });
    expect(loadPushReminder().eveningTime).toBeNull();
    seed({ eveningTime: '24:00' });
    expect(loadPushReminder().eveningTime).toBeNull();
    seed({});
    expect(loadPushReminder().eveningTime).toBeNull();
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

  it('the audience body is the six named parameters plus p_audience', () => {
    const body = buildUpsertBodyWithAudience({
      endpoint: 'https://push.example/abc',
      p256dh: 'B'.repeat(87),
      auth: 'a'.repeat(22),
      focus: 'gospel',
      localTime: '07:00',
      tz: 'America/Los_Angeles',
      audience: 'women',
    });
    expect(Object.keys(body).sort()).toEqual(
      ['p_audience', 'p_auth', 'p_endpoint', 'p_focus', 'p_local_time', 'p_p256dh', 'p_tz'].sort(),
    );
    expect(body.p_audience).toBe('women');
  });

  it('the evening body is the audience body plus p_evening_time — a valid hour goes as-is', () => {
    const body = buildUpsertBodyWithEvening({
      endpoint: 'https://push.example/abc',
      p256dh: 'B'.repeat(87),
      auth: 'a'.repeat(22),
      focus: 'gospel',
      localTime: '07:00',
      tz: 'America/Los_Angeles',
      audience: 'men',
      eveningTime: '20:00',
    });
    expect(Object.keys(body).sort()).toEqual(
      ['p_audience', 'p_auth', 'p_endpoint', 'p_evening_time', 'p_focus', 'p_local_time', 'p_p256dh', 'p_tz'].sort(),
    );
    expect(body.p_evening_time).toBe('20:00');
  });

  it('no evening reminder sends p_evening_time as null — never as some other hour', () => {
    const base = {
      endpoint: 'https://push.example/abc',
      p256dh: 'B'.repeat(87),
      auth: 'a'.repeat(22),
      focus: 'gospel',
      localTime: '07:00',
      tz: 'America/Los_Angeles',
      audience: 'men' as const,
    };
    expect(buildUpsertBodyWithEvening({ ...base, eveningTime: null }).p_evening_time).toBeNull();
    expect(buildUpsertBodyWithEvening({ ...base, eveningTime: '8pm' }).p_evening_time).toBeNull();
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

describe('RPC contract — the evening migration (Nov 17, 2026)', () => {
  const sql = readFileSync(
    join(repoRoot, 'supabase/migrations/20261117120000_push_evening_reminder.sql'),
    'utf8',
  );

  it('adds the evening hour and its own sent marker, both nullable', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS evening_time time NULL');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS last_evening_sent_on date NULL');
  });

  it('adds an eight-argument overload and leaves the older overloads alone', () => {
    expect(sql).toContain('p_audience text');
    expect(sql).toContain('p_evening_time text');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text, text, text) TO anon, authenticated',
    );
    // The six- and seven-argument functions are never redefined here.
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.upsert_push_subscription\(\s*p_endpoint text,\s*p_p256dh text,\s*p_auth text,\s*p_focus text,\s*p_local_time text,\s*p_tz text\s*\)/);
  });

  it('validates the evening hour only when one is given, and refuses a malformed one', () => {
    expect(sql).toContain("IF v_evening_text <> '' THEN");
    expect(sql).toContain("RAISE EXCEPTION 'invalid_evening_time' USING ERRCODE = '22023'");
  });

  it('the conflict update writes the evening hour and never touches its sent marker', () => {
    expect(sql).toContain('evening_time = EXCLUDED.evening_time');
    expect(sql).not.toContain('last_evening_sent_on = EXCLUDED');
    expect(sql).not.toContain('last_evening_sent_on = now');
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

  function seedReminder(tz: string, eveningTime: string | null = null) {
    localStorage.setItem(
      'sanctum_push_reminder',
      JSON.stringify({
        enabled: true,
        endpoint: ENDPOINT,
        focus: 'gospel',
        localTime: '07:00',
        eveningTime,
        tz,
        audience: 'men',
      }),
    );
  }

  /** Like stubBrowser, but the first `failures` RPC calls answer not-ok — a migration not yet pasted. */
  function stubBrowserFlaky(getSubscription: () => Promise<unknown>, failures: number) {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          ready: Promise.resolve({ pushManager: { getSubscription } }),
        },
      },
      configurable: true,
    });
    fetchCalls = [];
    let calls = 0;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      calls += 1;
      if (calls <= failures) return { ok: false, status: 404, json: async () => null };
      return { ok: true, json: async () => true };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('the re-sync carries the stored evening hour in the eight-argument body', async () => {
    seedReminder(otherTz, '20:00');
    stubBrowser(async () => fakeSubscription);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(true);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].body.p_evening_time).toBe('20:00');
    expect(loadPushReminder().eveningTime).toBe('20:00');
  });

  it('fallback chain order: eight arguments, then seven, then six — the save lands at the tier that answers', async () => {
    seedReminder(otherTz, '20:00');
    stubBrowserFlaky(async () => fakeSubscription, 1);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(true);
    expect(fetchCalls).toHaveLength(2);
    // First attempt carries the evening hour; the fallback drops exactly that field.
    expect(fetchCalls[0].body.p_evening_time).toBe('20:00');
    expect(fetchCalls[1].body).not.toHaveProperty('p_evening_time');
    expect(fetchCalls[1].body.p_audience).toBe('men');
    // The evening hour was not stored server-side, so local state keeps its
    // previous value rather than claiming a fresh save.
    expect(loadPushReminder().eveningTime).toBe('20:00');
  });

  it('fallback chain reaches the legacy six-argument body when both newer tiers refuse', async () => {
    seedReminder(otherTz, '20:00');
    stubBrowserFlaky(async () => fakeSubscription, 2);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(true);
    expect(fetchCalls).toHaveLength(3);
    expect(Object.keys(fetchCalls[2].body).sort()).toEqual(
      ['p_auth', 'p_endpoint', 'p_focus', 'p_local_time', 'p_p256dh', 'p_tz'].sort(),
    );
  });

  it('when every tier refuses, nothing is saved and the re-sync reports false', async () => {
    seedReminder(otherTz, '20:00');
    stubBrowserFlaky(async () => fakeSubscription, 3);
    await expect(resyncPushTimezoneIfNeeded()).resolves.toBe(false);
    expect(fetchCalls).toHaveLength(3);
    // The stored zone is untouched — the server was never given a new one.
    expect(loadPushReminder().tz).toBe(otherTz);
  });
});

describe('the evening reminder in the form (Nov 17, 2026) — source pins', () => {
  const form = readFileSync(join(repoRoot, 'src/components/ReminderForm.tsx'), 'utf8');

  it('offers the evening slot as an opt-in toggle with its own time field', () => {
    expect(form).toContain('Add an evening reminder');
    expect(form).toContain('Evening time');
    expect(form).toContain('DEFAULT_EVENING_TIME');
    expect(form).toContain('type="checkbox"');
  });

  it('both saves carry the evening draft — enabling and editing alike', () => {
    expect(form).toContain('subscribeToPush(DEFAULT_FOCUS, draftTime, draftEvening)');
    expect(form).toContain('updatePushPreferences(saved.focus, draftTime, draftEvening)');
  });

  it('the subscribed face names the evening hour when one is set', () => {
    expect(form).toContain('· Evening ${formatTime(saved.eveningTime)}');
  });

  it('one save button covers either time, and says times when both changed', () => {
    expect(form).toContain('draftTime !== saved.localTime || draftEvening !== saved.eveningTime');
    expect(form).toContain("'Save the new times'");
    expect(form).toContain("'Save the new time'");
  });

  it('the privacy note covers one time or two', () => {
    expect(form).toContain('the reminder time, or times, you chose');
    expect(form).not.toContain('and the time you chose');
  });

  it('the canonical server list speaks of the reminder time or times', () => {
    const copy = readFileSync(join(repoRoot, 'src/lib/privacyCopy.ts'), 'utf8');
    expect(copy).toContain('the reminder time or times you chose');
    expect(copy).not.toContain('a time of day');
  });
});

describe('RPC contract — the parish sync body (Nov 18, 2026)', () => {
  const mass = { parish: 'St. Brigid', time: '09:30', day: 'sunday' as const };
  const reminders = {
    confessionDay: 6,
    confessionTime: '15:30',
    massReminderLead: 60 as const,
    confessionReminderLead: 30 as const,
    driveTime: '17:30',
  };

  it('sends exactly the eight named parameters the SQL function declares', () => {
    const body = buildParishSyncBody({ endpoint: 'https://push.example/abc', mass, reminders });
    expect(Object.keys(body).sort()).toEqual(
      ['p_conf_day', 'p_conf_lead', 'p_conf_time', 'p_drive_time', 'p_endpoint', 'p_mass_day', 'p_mass_lead', 'p_mass_time'].sort(),
    );
    expect(body).toEqual({
      p_endpoint: 'https://push.example/abc',
      p_mass_day: 0, // Sunday, in the server's numbering
      p_mass_time: '09:30',
      p_mass_lead: 60,
      p_conf_day: 6,
      p_conf_time: '15:30',
      p_conf_lead: 30,
      p_drive_time: '17:30',
    });
  });

  it('the parish name is never in the body — not as a key, not as a value', () => {
    const body = buildParishSyncBody({ endpoint: 'https://push.example/abc', mass, reminders });
    expect(JSON.stringify(body)).not.toContain('Brigid');
    expect(Object.keys(body).join(' ')).not.toMatch(/parish_name|p_parish/);
  });

  it('a Saturday vigil maps to day 6; an unset Mass sends nulls', () => {
    const vigil = buildParishSyncBody({
      endpoint: 'https://push.example/abc',
      mass: { parish: 'St. Brigid', time: '17:30', day: 'saturday' },
      reminders,
    });
    expect(vigil.p_mass_day).toBe(6);
    expect(vigil.p_mass_time).toBe('17:30');
    const none = buildParishSyncBody({ endpoint: 'https://push.example/abc', mass: null, reminders });
    expect(none.p_mass_day).toBeNull();
    expect(none.p_mass_time).toBeNull();
  });

  it('malformed pieces go as null — never as some other day, hour, or lead', () => {
    const body = buildParishSyncBody({
      endpoint: 'https://push.example/abc',
      mass,
      reminders: {
        confessionDay: 7,
        confessionTime: '3:30pm',
        massReminderLead: 45 as never,
        confessionReminderLead: null,
        driveTime: '25:00',
      },
    });
    expect(body.p_conf_day).toBeNull();
    expect(body.p_conf_time).toBeNull();
    expect(body.p_mass_lead).toBeNull();
    expect(body.p_conf_lead).toBeNull();
    expect(body.p_drive_time).toBeNull();
  });

  it('the evening-before sentinel rides the Confession lead — and only the Confession lead (Nov 20, 2026)', () => {
    const body = buildParishSyncBody({
      endpoint: 'https://push.example/abc',
      mass,
      reminders: { ...reminders, confessionReminderLead: -1 as never },
    });
    expect(body.p_conf_lead).toBe(-1);
    expect(body.p_conf_lead).toBe(CONFESSION_EVENING_BEFORE_LEAD);
    // Found in the Mass lead, the same value is not a lead at all: null.
    const massSentinel = buildParishSyncBody({
      endpoint: 'https://push.example/abc',
      mass,
      reminders: { ...reminders, massReminderLead: -1 as never },
    });
    expect(massSentinel.p_mass_lead).toBeNull();
  });
});

describe('RPC contract — the parish reminders migration (Nov 18, 2026)', () => {
  const sql = readFileSync(
    join(repoRoot, 'supabase/migrations/20261118140000_parish_reminders.sql'),
    'utf8',
  );

  it('adds the ten slot columns, all nullable', () => {
    for (const column of [
      'mass_day smallint', 'mass_time time', 'mass_lead_min int', 'mass_last_sent_on date',
      'conf_day smallint', 'conf_time time', 'conf_lead_min int', 'conf_last_sent_on date',
      'drive_time time', 'drive_last_sent_on date',
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column} NULL`);
    }
  });

  it('declares the sync function with the parameter names the client sends', () => {
    expect(sql).toContain('FUNCTION public.upsert_parish_reminders(');
    for (const param of [
      'p_endpoint text', 'p_mass_day int', 'p_mass_time text', 'p_mass_lead int',
      'p_conf_day int', 'p_conf_time text', 'p_conf_lead int', 'p_drive_time text',
    ]) {
      expect(sql).toContain(param);
    }
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_parish_reminders(text, int, text, int, int, text, int, text) TO anon, authenticated',
    );
  });

  it('validates days, leads, and times with stable error strings', () => {
    for (const error of [
      'invalid_endpoint', 'invalid_mass_day', 'invalid_conf_day', 'invalid_mass_lead',
      'invalid_conf_lead', 'invalid_mass_time', 'invalid_conf_time', 'invalid_drive_time',
    ]) {
      expect(sql).toContain(`RAISE EXCEPTION '${error}' USING ERRCODE = '22023'`);
    }
    expect(sql).toContain('p_mass_lead NOT IN (30, 60, 120)');
    expect(sql).toContain('p_conf_lead NOT IN (30, 60, 120)');
  });

  it('the sync update writes the slots and never a sent marker', () => {
    const updateAt = sql.indexOf('UPDATE public.push_subscriptions');
    const update = sql.slice(updateAt, sql.indexOf('WHERE endpoint', updateAt));
    expect(update).toContain('mass_day = p_mass_day');
    expect(update).toContain('drive_time = v_drive_time');
    expect(update).not.toContain('last_sent_on');
  });

  it('leaves the existing upsert overloads alone', () => {
    expect(sql).not.toContain('FUNCTION public.upsert_push_subscription(');
  });
});

describe('RPC contract — the Confession evening-before migration (Nov 20, 2026)', () => {
  const sql = readFileSync(
    join(repoRoot, 'supabase/migrations/20261120160000_confession_evening_before_lead.sql'),
    'utf8',
  );
  const original = readFileSync(
    join(repoRoot, 'supabase/migrations/20261118140000_parish_reminders.sql'),
    'utf8',
  );

  it('replaces the sync function — the applied parish migration itself is never edited', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_parish_reminders(');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_parish_reminders(text, int, text, int, int, text, int, text) TO anon, authenticated',
    );
    // The Nov 18 file still validates exactly as it did when it was applied.
    expect(original).toContain('p_conf_lead NOT IN (30, 60, 120)');
    expect(original).not.toContain('120, -1');
  });

  it('accepts the sentinel for the Confession lead alone; the Mass lead is unchanged', () => {
    expect(sql).toContain('p_conf_lead NOT IN (30, 60, 120, -1)');
    expect(sql).toContain('p_mass_lead NOT IN (30, 60, 120)');
    expect(sql).not.toContain('p_mass_lead NOT IN (30, 60, 120, -1)');
    expect(sql).toContain(`'invalid_conf_lead'`);
  });

  it('the sync update still writes the slots and never a sent marker', () => {
    const updateAt = sql.indexOf('UPDATE public.push_subscriptions');
    const update = sql.slice(updateAt, sql.indexOf('WHERE endpoint', updateAt));
    expect(update).toContain('conf_lead_min = p_conf_lead');
    expect(update).not.toContain('last_sent_on');
  });

  it('the dispatcher special-cases the sentinel before the weekly question', () => {
    const fn = readFileSync(join(repoRoot, 'supabase/functions/push-dispatch/index.ts'), 'utf8');
    expect(fn).toContain('CONFESSION_EVENING_BEFORE_LEAD');
    expect(fn).toContain('evaluateConfessionEveDue(now, sub.tz, sub.conf_day, sub.conf_last_sent_on)');
    expect(fn.indexOf('evaluateConfessionEveDue')).toBeLessThan(fn.indexOf('evaluateWeeklyDue(now, sub.tz, sub.conf_day'));
  });
});

describe('the parish reminders stand in both places (Nov 20, 2026)', () => {
  const form = readFileSync(join(repoRoot, 'src/components/ReminderForm.tsx'), 'utf8');
  const settings = readFileSync(join(repoRoot, 'src/components/SettingsModal.tsx'), 'utf8');

  it('the reminder form carries the whole parish section — Mass, Confession, both leads', () => {
    expect(form).toContain('Your parish');
    expect(form).toContain('Parish Confession');
    expect(form).toContain('Mass reminder');
    expect(form).toContain('Confession reminder');
    expect(form).toContain('Keep these parish reminders');
  });

  it('both surfaces write the same stores and sync the same way — one source of truth, two doors', () => {
    for (const surface of [form, settings]) {
      expect(surface).toContain('loadParishReminders');
      expect(surface).toContain('saveParishReminders');
      expect(surface).toContain('loadUsualMass');
      expect(surface).toContain('saveUsualMass');
      expect(surface).toContain('syncParishReminders');
      expect(surface).toContain('the parish name never leaves this phone');
    }
  });

  it('the evening-before lead is offered in both places, from the one shared option list', () => {
    for (const surface of [form, settings]) {
      expect(surface).toContain('CONFESSION_LEAD_OPTIONS');
      expect(surface).toContain('CONFESSION_EVENING_BEFORE_LEAD');
      expect(surface).toContain('One poke at 7:00 PM the evening before Confession day.');
    }
    const store = readFileSync(join(repoRoot, 'src/lib/usualMass.ts'), 'utf8');
    expect(store).toContain("label: 'The evening before'");
  });
});

describe('the tailor-ready ping (Nov 18, 2026)', () => {
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
  });

  it('the opt-in is off by default and round-trips', () => {
    expect(loadTailorReadyPing()).toBe(false);
    saveTailorReadyPing(true);
    expect(loadTailorReadyPing()).toBe(true);
    saveTailorReadyPing(false);
    expect(loadTailorReadyPing()).toBe(false);
  });

  it('the decision needs all three: opt-in, a subscription, and a backgrounded app', () => {
    expect(shouldPingTailorReady({ optedIn: true, endpoint: 'https://push.example/abc', hidden: true })).toBe(true);
    expect(shouldPingTailorReady({ optedIn: false, endpoint: 'https://push.example/abc', hidden: true })).toBe(false);
    expect(shouldPingTailorReady({ optedIn: true, endpoint: '', hidden: true })).toBe(false);
    expect(shouldPingTailorReady({ optedIn: true, endpoint: 'https://push.example/abc', hidden: false })).toBe(false);
  });

  it('the dispatcher answers the action with one fixed poke and stores nothing', () => {
    const fn = readFileSync(join(repoRoot, 'supabase/functions/push-dispatch/index.ts'), 'utf8');
    expect(fn).toContain('body.action === "tailor-ready"');
    expect(fn).toContain('buildPushPayload("tailor")');
    expect(fn).toContain('consume_chat_quota');
    expect(fn).toContain('TAILOR_READY_DAILY_CAP = 3');
    // The tailor-ready branch itself writes no marker and no row: between
    // the action check and the cron dispatch below it, no sent-marker
    // column is ever named.
    const branch = fn.slice(fn.indexOf('body.action === "tailor-ready"'), fn.indexOf('const now = new Date();'));
    expect(branch).not.toContain('last_sent_on');
    expect(branch).not.toContain('INSERT');
  });

  it('the opt-in stands in the Tailor section, beside the narration — no longer in the form', () => {
    // Moved (Erik, Nov 19, 2026): the toggle's one home is the Tailor
    // section, where the narration prepares and plays; the reminder
    // form no longer carries it. Same store, same default.
    const form = readFileSync(join(repoRoot, 'src/components/ReminderForm.tsx'), 'utf8');
    expect(form).not.toContain('Tell me when my tailored audio is ready');
    expect(form).not.toContain('saveTailorReadyPing');
    const tailor = readFileSync(join(repoRoot, 'src/components/TailorToday.tsx'), 'utf8');
    expect(tailor).toContain('Tell me when my tailored audio is ready');
    expect(tailor).toContain('saveTailorReadyPing');
    expect(tailor).toContain('loadTailorReadyPing');
  });

  it('the form offers the drive-home slot with its own copy', () => {
    const form = readFileSync(join(repoRoot, 'src/components/ReminderForm.tsx'), 'utf8');
    expect(form).toContain('Drive-home reminder');
    // Repurposed (Nov 20, 2026): the poke sends the man to tailor his
    // devotional for the drive — the form says so, in those words.
    expect(form).toContain('For the ride home — a poke to tailor your devotional for the road.');
    expect(form).not.toContain('opens Tonight, to close the day');
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
