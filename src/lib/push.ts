import { DEFAULT_FOCUS, isReminderFocus } from '@/lib/reminderFocus';
import { isValidLocalTime } from '@/lib/pushCore';
import { detectPlatform, isStandaloneDisplay } from '@/lib/install';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * The VAPID public key identifies Sanctum to the push services. A public key is not a
 * secret — every browser that subscribes receives it — so the generated key is committed
 * here as the fallback and `VITE_VAPID_PUBLIC_KEY` (set in the host's env) wins when
 * present. The matching private key exists only as a server secret and in the deploy
 * packet; it must never appear in this repo.
 */
const FALLBACK_VAPID_PUBLIC_KEY = 'BP-SUPWjo1P-23GrMOQl-JlAyRA_9oE1mxwWAQjpDnRYmhw8cyGRK_FwgT9f7P9m8Xcx1fpjs4aGwOq_3N78aBQ';
export const VAPID_PUBLIC_KEY: string =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || FALLBACK_VAPID_PUBLIC_KEY;

const PUSH_KEY = 'sanctum_push_reminder';
export const DEFAULT_LOCAL_TIME = '07:00';

export interface PushReminderState {
  enabled: boolean;
  /** This device's push endpoint — the capability that receives the pokes. Kept on the device, like the email token. */
  endpoint: string;
  focus: string;
  /** 'HH:MM', the chosen local time of day. */
  localTime: string;
  /** IANA timezone captured from the device when the reminder was set. */
  tz: string;
}

const DEFAULT_STATE: PushReminderState = {
  enabled: false,
  endpoint: '',
  focus: DEFAULT_FOCUS,
  localTime: DEFAULT_LOCAL_TIME,
  tz: '',
};

export function loadPushReminder(): PushReminderState {
  try {
    const raw = localStorage.getItem(PUSH_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PushReminderState>;
    return {
      enabled: Boolean(parsed.enabled),
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : '',
      focus: typeof parsed.focus === 'string' && isReminderFocus(parsed.focus) ? parsed.focus : DEFAULT_FOCUS,
      localTime: isValidLocalTime(parsed.localTime) ? parsed.localTime : DEFAULT_LOCAL_TIME,
      tz: typeof parsed.tz === 'string' ? parsed.tz : '',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function savePushReminder(state: PushReminderState): void {
  try {
    localStorage.setItem(PUSH_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — the server still holds the subscription.
  }
}

/**
 * Where this device stands with notifications. The sheet renders a different face for
 * each state, so the resolution order matters and is pinned by tests:
 *
 * - `not-installed` first on iOS: an iPhone only accepts push for a home-screen app, so
 *   "install first" is the truthful message even though the raw API also looks absent.
 * - then `unsupported` (no Push API at all), `denied` (the one-shot iOS ask was refused),
 *   `subscribed` (permission + a live subscription this device remembers), `granted`
 *   (permission given but the subscription is missing — recoverable), and `default`
 *   (nothing asked yet).
 */
export type PushState = 'unsupported' | 'not-installed' | 'default' | 'granted' | 'denied' | 'subscribed';

export interface PushEnvironment {
  hasPushApi: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | 'unsupported';
  hasLocalSubscription: boolean;
}

export function resolvePushState(env: PushEnvironment): PushState {
  if (env.isIOS && !env.isStandalone) return 'not-installed';
  if (!env.hasPushApi || env.permission === 'unsupported') return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  if (env.hasLocalSubscription) return 'subscribed';
  if (env.permission === 'granted') return 'granted';
  return 'default';
}

export function currentPushEnvironment(): PushEnvironment {
  const hasPushApi =
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator;
  const local = loadPushReminder();
  return {
    hasPushApi,
    isIOS: detectPlatform() === 'ios',
    isStandalone: isStandaloneDisplay(),
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    hasLocalSubscription: local.enabled && local.endpoint.length > 0,
  };
}

export function getPushState(): PushState {
  return resolvePushState(currentPushEnvironment());
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The exact body sent to `upsert_push_subscription` — one shape, pinned by tests against the SQL. */
export function buildUpsertBody(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  focus: string;
  localTime: string;
  tz: string;
}): Record<string, unknown> {
  return {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_focus: isReminderFocus(input.focus) ? input.focus : DEFAULT_FOCUS,
    p_local_time: isValidLocalTime(input.localTime) ? input.localTime : DEFAULT_LOCAL_TIME,
    p_tz: input.tz,
  };
}

export function buildDeactivateBody(endpoint: string): Record<string, unknown> {
  return { p_endpoint: endpoint };
}

function rpcHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function callRpc(fn: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`rpc ${fn} failed with status ${res.status}`);
    return false;
  }
  const data: unknown = await res.json().catch(() => null);
  return data === true;
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

export interface PushActionResult {
  ok: boolean;
  message: string;
  state: PushState;
}

function result(ok: boolean, message: string): PushActionResult {
  return { ok, message, state: getPushState() };
}

/**
 * The live browser subscription for this device, re-created with the current key if the
 * stored one was made under a different VAPID key (a rotated key would otherwise make
 * every send fail in silence).
 */
async function currentBrowserSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const existingKey = subscription.options?.applicationServerKey
      ? arrayBufferToBase64Url(subscription.options.applicationServerKey)
      : '';
    if (existingKey && existingKey !== VAPID_PUBLIC_KEY) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }
  return subscription;
}

async function saveSubscriptionToServer(
  subscription: PushSubscription,
  focus: string,
  localTime: string,
): Promise<boolean> {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh ?? '';
  const auth = json.keys?.auth ?? '';
  if (!p256dh || !auth) return false;
  const tz = deviceTimeZone();
  const ok = await callRpc(
    'upsert_push_subscription',
    buildUpsertBody({ endpoint: subscription.endpoint, p256dh, auth, focus, localTime, tz }),
  );
  if (ok) {
    savePushReminder({
      enabled: true,
      endpoint: subscription.endpoint,
      focus: isReminderFocus(focus) ? focus : DEFAULT_FOCUS,
      localTime: isValidLocalTime(localTime) ? localTime : DEFAULT_LOCAL_TIME,
      tz,
    });
  }
  return ok;
}

/**
 * Turn the reminder on. This runs from the Allow tap: the permission request is the first
 * thing that happens, inside the tap, because iOS only honours requests made in response
 * to a gesture — and because there is exactly one ask, it must not be spent on a man who
 * has not yet chosen his focus and time.
 */
export async function subscribeToPush(focus: string, localTime: string): Promise<PushActionResult> {
  if (typeof Notification === 'undefined') {
    return result(false, 'This browser cannot receive notifications.');
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return result(false, 'Notifications could not be requested just now. Try again in a moment.');
  }
  if (permission === 'denied') {
    return result(false, 'Notifications are turned off for Sanctum. You can allow them in Settings, then come back here.');
  }
  if (permission !== 'granted') {
    return result(false, 'Notifications were not allowed. Nothing has been set up.');
  }

  try {
    const subscription = await currentBrowserSubscription();
    if (!subscription) return result(false, "We couldn't set that up just now. Try again in a moment.");
    const saved = await saveSubscriptionToServer(subscription, focus, localTime);
    if (!saved) return result(false, "We couldn't save that just now. Try again in a moment.");
    return result(true, 'Saved. The reminder will come at the time you chose.');
  } catch (err) {
    console.error('subscribeToPush failed:', err);
    return result(false, 'No connection, or the browser refused. Try again when you are back online.');
  }
}

/** Change what the reminder points at, or when it comes. Saves straight away, like the email form. */
export async function updatePushPreferences(focus: string, localTime: string): Promise<PushActionResult> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return subscribeToPush(focus, localTime);
    const saved = await saveSubscriptionToServer(subscription, focus, localTime);
    if (!saved) return result(false, "We couldn't save that just now. Try again in a moment.");
    return result(true, 'Saved. That is when, and what, we will remind you about.');
  } catch (err) {
    console.error('updatePushPreferences failed:', err);
    return result(false, 'No connection. Try again when you are back online.');
  }
}

/**
 * Stop the pokes. The browser subscription is dropped first and the local state cleared
 * regardless of the server call: a man pressing "turn off" must never be told he failed
 * while the phone keeps buzzing. If the server row somehow stays active, the push service
 * will refuse the dead endpoint and the dispatcher deactivates the row itself.
 */
export async function unsubscribeFromPush(): Promise<PushActionResult> {
  const local = loadPushReminder();
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe().catch(() => {});
  } catch {
    // No live subscription to drop — turning off is still honoured locally.
  }
  if (local.endpoint) {
    await callRpc('deactivate_push_subscription', buildDeactivateBody(local.endpoint)).catch(() => false);
  }
  savePushReminder({ ...loadPushReminder(), enabled: false });
  return result(true, 'Reminder off. Nothing will be sent to this device.');
}

/** Poke this device once, now — the deploy-day proof, and a way to feel what subscribers feel. */
export async function sendTestPoke(): Promise<PushActionResult> {
  const local = loadPushReminder();
  if (!local.endpoint) return result(false, 'No subscription on this device yet.');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`, {
      method: 'POST',
      headers: rpcHeaders(),
      body: JSON.stringify({ test: true, endpoint: local.endpoint }),
    });
    if (!res.ok) return result(false, "The test couldn't be sent just now. Try again in a moment.");
    return result(true, 'Test sent — it should land on this device within a few seconds.');
  } catch (err) {
    console.error('sendTestPoke failed:', err);
    return result(false, 'No connection. Try again when you are back online.');
  }
}
