import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  VAPID_PUBLIC_KEY,
  arrayBufferToBase64Url,
  buildDeactivateBody,
  buildUpsertBody,
  loadPushReminder,
  resolvePushState,
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
    expect(body.p_focus).toBe('examen');
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
