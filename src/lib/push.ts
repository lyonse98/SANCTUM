import { DEFAULT_FOCUS, isReminderFocus } from '@/lib/reminderFocus';
import { isAudience, loadAudience } from '@/lib/audience';
import type { Audience } from '@/types';
import { isValidLocalTime } from '@/lib/pushCore';
import { detectPlatform, isStandaloneDisplay } from '@/lib/install';
import {
  isConfessionLead,
  isReminderLead,
  loadParishReminders,
  loadUsualMass,
  massDayOfWeek,
  type ParishReminders,
  type UsualMass,
} from '@/lib/usualMass';

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
/** The hour the form offers when a man first adds the evening reminder. */
export const DEFAULT_EVENING_TIME = '20:00';

export interface PushReminderState {
  enabled: boolean;
  /** This device's push endpoint — the capability that receives the pokes. Kept on the device, like the email token. */
  endpoint: string;
  focus: string;
  /** 'HH:MM', the chosen local time of day. */
  localTime: string;
  /** 'HH:MM' for the optional evening reminder (Nov 17, 2026), or null when none is set. */
  eveningTime: string | null;
  /** IANA timezone captured from the device when the reminder was set. */
  tz: string;
  /** The track active when the reminder was set — recorded with the subscription. */
  audience: Audience;
}

const DEFAULT_STATE: PushReminderState = {
  enabled: false,
  endpoint: '',
  focus: DEFAULT_FOCUS,
  localTime: DEFAULT_LOCAL_TIME,
  eveningTime: null,
  tz: '',
  audience: 'men',
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
      eveningTime: isValidLocalTime(parsed.eveningTime) ? parsed.eveningTime : null,
      tz: typeof parsed.tz === 'string' ? parsed.tz : '',
      audience: isAudience(parsed.audience) ? parsed.audience : 'men',
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

/**
 * The upsert body that also carries the track — sent to the seven-argument
 * overload of `upsert_push_subscription` added by the Women's Mode migration.
 * Kept separate from `buildUpsertBody` on purpose: the legacy six-argument
 * shape is the fallback and must stay byte-for-byte what the deployed RPC
 * (and its tests) already know.
 */
export function buildUpsertBodyWithAudience(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  focus: string;
  localTime: string;
  tz: string;
  audience: Audience;
}): Record<string, unknown> {
  return {
    ...buildUpsertBody(input),
    p_audience: isAudience(input.audience) ? input.audience : 'men',
  };
}

/**
 * The upsert body that also carries the evening hour — sent to the
 * eight-argument overload of `upsert_push_subscription` added by the evening
 * reminder migration (Nov 17, 2026). A valid 'HH:MM' goes as-is; anything
 * else (including null) goes as null, which the SQL reads as "no evening
 * reminder" — never as some other hour. Kept separate from the older
 * builders on purpose: their shapes are the fallbacks and must stay
 * byte-for-byte what the deployed RPCs (and their tests) already know.
 */
export function buildUpsertBodyWithEvening(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  focus: string;
  localTime: string;
  tz: string;
  audience: Audience;
  eveningTime: string | null;
}): Record<string, unknown> {
  return {
    ...buildUpsertBodyWithAudience(input),
    p_evening_time: isValidLocalTime(input.eveningTime) ? input.eveningTime : null,
  };
}

export function buildDeactivateBody(endpoint: string): Record<string, unknown> {
  return { p_endpoint: endpoint };
}

/**
 * The exact body sent to `upsert_parish_reminders` (Nov 18, 2026) — one
 * shape, pinned by tests against the SQL. It carries days, times, and
 * leads ONLY: the parish's name is never in it, because the server has
 * never been told the name and never will be. Pieces that are unset or
 * malformed go as null, which the SQL reads as "no such slot" — never as
 * some other day or hour.
 */
export function buildParishSyncBody(input: {
  endpoint: string;
  mass: UsualMass | null;
  reminders: ParishReminders;
}): Record<string, unknown> {
  const day = (value: number | null): number | null =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
  const time = (value: string | null): string | null => (isValidLocalTime(value) ? value : null);
  const lead = (value: number | null): number | null => (isReminderLead(value) ? value : null);
  // The Confession lead has one more lawful value than the Mass lead: the
  // evening-before sentinel (-1), which the SQL accepts for p_conf_lead
  // alone. A sentinel found in the Mass lead still goes as null.
  const confLead = (value: number | null): number | null => (isConfessionLead(value) ? value : null);
  return {
    p_endpoint: input.endpoint,
    p_mass_day: input.mass ? massDayOfWeek(input.mass) : null,
    p_mass_time: input.mass ? time(input.mass.time) : null,
    p_mass_lead: lead(input.reminders.massReminderLead),
    p_conf_day: day(input.reminders.confessionDay),
    p_conf_time: time(input.reminders.confessionTime),
    p_conf_lead: confLead(input.reminders.confessionReminderLead),
    p_drive_time: time(input.reminders.driveTime),
  };
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

/**
 * Hands the server this device's parish reminder times (Nov 18, 2026):
 * the usual Mass's day and hour, the Confession day and hour, the leads,
 * and the drive-home hour — read fresh from the on-device stores, so
 * whichever surface changed them last is the one that counts. Silent by
 * design: before the parish migration is pasted (or the new dispatcher
 * deployed) the call simply fails, the settings stay on the phone, and
 * the reminders have not started yet. Returns whether the server took
 * them.
 */
export async function syncParishReminders(): Promise<boolean> {
  try {
    const local = loadPushReminder();
    if (!local.enabled || !local.endpoint) return false;
    return await callRpc(
      'upsert_parish_reminders',
      buildParishSyncBody({
        endpoint: local.endpoint,
        mass: loadUsualMass(),
        reminders: loadParishReminders(),
      }),
    );
  } catch {
    return false;
  }
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

export interface SaveSubscriptionResult {
  /** The subscription itself saved, at whichever tier answered. */
  saved: boolean;
  /**
   * The evening slot was stored server-side too — or there was no evening
   * slot to store. False only when an evening hour was asked for and every
   * tier that could carry it refused: the morning save still stands, but the
   * evening poke cannot start until the evening migration is pasted.
   */
  eveningSaved: boolean;
}

async function saveSubscriptionToServer(
  subscription: PushSubscription,
  focus: string,
  localTime: string,
  eveningTime: string | null = null,
): Promise<SaveSubscriptionResult> {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh ?? '';
  const auth = json.keys?.auth ?? '';
  if (!p256dh || !auth) return { saved: false, eveningSaved: false };
  const tz = deviceTimeZone();
  const audience = loadAudience();
  const base = { endpoint: subscription.endpoint, p256dh, auth, focus, localTime, tz };
  const wantedEvening = isValidLocalTime(eveningTime) ? eveningTime : null;
  // Prefer the evening-carrying overload; if that migration has not been
  // pasted yet, PostgREST answers 404 for the eight-argument shape and we
  // fall back to the audience overload, then to the legacy body — the
  // subscription must save either way. Push never breaks because a column
  // is missing.
  let eveningStored = await callRpc(
    'upsert_push_subscription',
    buildUpsertBodyWithEvening({ ...base, audience, eveningTime: wantedEvening }),
  );
  let ok = eveningStored;
  if (!ok) {
    ok = await callRpc('upsert_push_subscription', buildUpsertBodyWithAudience({ ...base, audience }));
  }
  if (!ok) {
    ok = await callRpc('upsert_push_subscription', buildUpsertBody(base));
  }
  if (!ok) return { saved: false, eveningSaved: false };

  // Local state may only claim an evening hour the server actually holds.
  // When the fallback tiers saved the morning subscription, an asked-for
  // evening hour keeps its previous local value rather than pretending it
  // was stored. Turning the evening reminder OFF (eveningTime = null) is
  // truthful at every tier — the older tiers never had an evening slot —
  // with one pre-migration edge, accepted and documented: if the
  // eight-argument call failed, the fallback tiers cannot clear an evening
  // hour the server already holds, so a stored evening poke may still come
  // until the migration lands and the off is saved again. The dispatcher's
  // guard is the database value; this window exists only before the paste.
  const localEvening = eveningStored
    ? wantedEvening
    : wantedEvening === null
      ? null
      : loadPushReminder().eveningTime;
  savePushReminder({
    enabled: true,
    endpoint: subscription.endpoint,
    focus: isReminderFocus(focus) ? focus : DEFAULT_FOCUS,
    localTime: isValidLocalTime(localTime) ? localTime : DEFAULT_LOCAL_TIME,
    eveningTime: localEvening,
    tz,
    audience,
  });
  return { saved: true, eveningSaved: eveningStored || wantedEvening === null };
}

/**
 * Turn the reminder on. This runs from the Allow tap: the permission request is the first
 * thing that happens, inside the tap, because iOS only honours requests made in response
 * to a gesture — and because there is exactly one ask, it must not be spent on a man who
 * has not yet chosen his focus and time.
 */
export async function subscribeToPush(
  focus: string,
  localTime: string,
  eveningTime: string | null = null,
): Promise<PushActionResult> {
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
    const { saved, eveningSaved } = await saveSubscriptionToServer(subscription, focus, localTime, eveningTime);
    if (!saved) return result(false, "We couldn't save that just now. Try again in a moment.");
    // The parish times ride along on the save (Nov 18, 2026): the server's
    // copy of the reader's days and hours refreshes from the phone's stores.
    void syncParishReminders();
    if (!eveningSaved) {
      return result(
        true,
        'Saved — your morning reminder is set. The evening reminder needs a server update before it can start; the morning one will come as usual.',
      );
    }
    return result(true, 'Saved. The reminder will come at the time you chose.');
  } catch (err) {
    console.error('subscribeToPush failed:', err);
    return result(false, 'No connection, or the browser refused. Try again when you are back online.');
  }
}

/**
 * The timezone decision, pure: a stored timezone that differs from the
 * device's current one means the phone has travelled (or its zone was
 * corrected) since the reminder was set, and the server row — which the
 * dispatcher reads in the stored zone — would fire at the wrong hour.
 * An unreadable current zone never triggers a rewrite.
 */
export function shouldResyncTimezone(storedTz: string, currentTz: string): boolean {
  return currentTz.length > 0 && storedTz !== currentTz;
}

/**
 * Timezone re-sync (Play 3, retention build Nov 16, 2026). On app open, if
 * this device has a live reminder whose stored timezone no longer matches
 * the device's, silently re-upsert the subscription with the current zone
 * through the same machinery a preference save uses — the focus and local
 * time are carried over untouched, so only the zone changes. Best-effort
 * by design: it never throws, never prompts (it only reads the existing
 * browser subscription), and no-ops without a subscription or when the
 * zones already agree. Returns whether a re-sync was saved.
 */
export async function resyncPushTimezoneIfNeeded(): Promise<boolean> {
  try {
    const local = loadPushReminder();
    if (!local.enabled || !local.endpoint) return false;
    if (!shouldResyncTimezone(local.tz, deviceTimeZone())) return false;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;
    // The stored evening hour rides along untouched, so a timezone re-sync
    // can never silently drop the evening slot it was not asked about.
    const { saved } = await saveSubscriptionToServer(
      subscription,
      local.focus,
      local.localTime,
      local.eveningTime,
    );
    return saved;
  } catch {
    return false;
  }
}

/** Change what the reminder points at, or when it comes. Saves straight away, like the email form. */
export async function updatePushPreferences(
  focus: string,
  localTime: string,
  eveningTime: string | null = null,
): Promise<PushActionResult> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return subscribeToPush(focus, localTime, eveningTime);
    const { saved, eveningSaved } = await saveSubscriptionToServer(subscription, focus, localTime, eveningTime);
    if (!saved) return result(false, "We couldn't save that just now. Try again in a moment.");
    void syncParishReminders();
    if (!eveningSaved) {
      return result(
        true,
        'Saved — your morning reminder is set. The evening reminder needs a server update before it can start; the morning one will come as usual.',
      );
    }
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

/**
 * The panic wipe's server half (audit W-8, Nov 16, 2026). The wipe clears this
 * device, but a push subscription lives in the browser and on the server — a
 * "wiped" phone would keep receiving the daily pokes while its screen says it
 * is safe. This is the deactivation half of `unsubscribeFromPush`, split out
 * for the panic path: it captures the endpoint from local state BEFORE the
 * wipe clears it, drops the browser subscription, and deactivates the server
 * row. Fire-and-forget by design — the wipe must never wait on, or be failed
 * by, the network — so it starts synchronously, finishes silently, and every
 * step is best-effort.
 */
export function deactivatePushOnPanic(): void {
  const endpoint = loadPushReminder().endpoint;
  void (async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe().catch(() => {});
    } catch {
      // No live subscription to drop — the server row is still deactivated below.
    }
    if (endpoint) {
      await callRpc('deactivate_push_subscription', buildDeactivateBody(endpoint)).catch(() => false);
    }
  })();
}

const TAILOR_READY_PING_KEY = 'sanctum_tailor_ready_ping';

/** The tailor-ready ping's opt-in (Nov 18, 2026): off unless the reader asked for it. */
export function loadTailorReadyPing(): boolean {
  try {
    return localStorage.getItem(TAILOR_READY_PING_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTailorReadyPing(on: boolean): void {
  try {
    if (on) localStorage.setItem(TAILOR_READY_PING_KEY, '1');
    else localStorage.removeItem(TAILOR_READY_PING_KEY);
  } catch {
    // Storage unavailable — the ping simply stays as it was.
  }
}

/**
 * The ping's whole decision, pure: it goes out only when the reader opted
 * in, a live subscription exists to receive it, and the app is in the
 * background — a man still looking at the screen can see the play bar
 * fill in himself, and a poke about it would be noise.
 */
export function shouldPingTailorReady(input: { optedIn: boolean; endpoint: string; hidden: boolean }): boolean {
  return input.optedIn && input.endpoint.length > 0 && input.hidden;
}

/**
 * Asks the dispatcher for the one fixed tailor-ready poke. Fire-and-
 * forget in spirit: it resolves to whether the dispatcher accepted, and
 * every failure — no opt-in, no subscription, the app in front, no
 * connection — is a quiet false. The server stores nothing for this; the
 * endpoint it already holds is the whole request.
 */
export async function requestTailorReadyPing(): Promise<boolean> {
  try {
    const local = loadPushReminder();
    const hidden =
      typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
    if (
      !shouldPingTailorReady({
        optedIn: loadTailorReadyPing(),
        endpoint: local.enabled ? local.endpoint : '',
        hidden,
      })
    ) {
      return false;
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`, {
      method: 'POST',
      headers: rpcHeaders(),
      body: JSON.stringify({ action: 'tailor-ready', endpoint: local.endpoint }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
