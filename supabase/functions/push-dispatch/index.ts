/*
  Push dispatch for Sanctum's daily reminder.

  Called every quarter hour by pg_cron (see the schedule migration) with an empty body:
  it reads every active row of `push_subscriptions` with the service role, works out who is
  due from each subscription's own timezone and chosen local time, and sends the ones that
  are. A subscription may also carry an optional evening hour (Nov 17, 2026): it is
  evaluated independently, with its own sent marker, and sends the very same poke. All the rules — the copy, the deep links, the due window, the daylight-saving
  behaviour — live in ./pushCore.ts, which is GENERATED from src/lib/pushCore.ts by
  scripts/sync-push-core.mjs so the server and the app can never drift apart. Do not edit
  the logic here into a second copy.

  The payload is deliberately discreet: a lock screen is a public place. It says the day's
  Gospel and reflection are ready, and nothing else, ever.

  Also accepts { "test": true, "endpoint": "…" } to poke one subscription immediately —
  used once at deploy time to prove the loop on the owner's phone. The endpoint must
  already be an active subscriber (the endpoint is the capability), the payload is the
  same fixed copy, and a test send never marks the day as sent.

  The notifications batch (Nov 18, 2026) adds three more slots per subscription,
  each with its own hour and sent marker, evaluated independently like the evening
  slot: a weekly poke before the reader's usual Mass and before his parish's
  Confession time (the server holds only a day, a time, and a lead — never a
  parish name), and a daily drive-home poke. The Confession lead may also be the
  evening-before sentinel (Nov 20, 2026): one poke at 19:00 local on the day
  before the Confession day. The drive-home poke was repurposed the same day:
  it no longer opens Tonight — it sends the man to tailor his devotional for
  the drive home, and its tap opens the Tailor build. It also accepts
  { "action": "tailor-ready", "endpoint": "…" } from the app when a Tailor
  build's audio finishes rendering in the background: one fixed poke ("Your
  tailored devotional is ready to listen to."), rate-limited to three a day
  per endpoint through the chat quota table under a hashed, prefixed key,
  and writing nothing — no marker, no row, no record of the build.

  verify_jwt is false, like the other no-auth functions: the cron calls with the public
  anon key, and the table is unreachable except through the service role used here.

  Logs are counts only. Endpoints are capability URLs and are never written to a log.
*/

import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
} from "jsr:@negrel/webpush@0.5.0";
import {
  buildPushPayload,
  CONFESSION_EVENING_BEFORE_LEAD,
  evaluateConfessionEveDue,
  evaluateDriveDue,
  evaluateDue,
  evaluateEveningDue,
  evaluateWeeklyDue,
  type PushPayload,
} from "./pushCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GENERIC_ERROR = "Push dispatch could not run. Please try again.";
const DEFAULT_SUBJECT = "https://sanctum.bolt.host";
const POKE_TTL_SECONDS = 12 * 60 * 60;

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  focus: string;
  local_time: string;
  tz: string;
  last_sent_on: string | null;
  /** The optional second poke (Nov 17, 2026); null on rows written before the evening migration. */
  evening_time: string | null;
  last_evening_sent_on: string | null;
  /** The parish slots (Nov 18, 2026); null on rows written before the parish migration. */
  mass_day: number | null;
  mass_time: string | null;
  mass_lead_min: number | null;
  mass_last_sent_on: string | null;
  conf_day: number | null;
  conf_time: string | null;
  conf_lead_min: number | null;
  conf_last_sent_on: string | null;
  /** The drive-home slot (Nov 18, 2026); null on rows written before the parish migration. */
  drive_time: string | null;
  drive_last_sent_on: string | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * The VAPID secrets hold the standard raw form — the public key as a base64url
 * uncompressed P-256 point, the private key as a base64url scalar — which is what
 * browsers and other push tooling use. @negrel/webpush imports JWKs, so the raw public
 * point is split into its x/y coordinates and the pair is rebuilt as JWKs here.
 */
let serverPromise: Promise<ApplicationServer> | null = null;

function applicationServer(): Promise<ApplicationServer> {
  if (!serverPromise) {
    serverPromise = (async () => {
      const publicRaw = base64UrlToBytes(Deno.env.get("VAPID_PUBLIC_KEY") ?? "");
      if (publicRaw.length !== 65 || publicRaw[0] !== 0x04) {
        throw new Error("VAPID_PUBLIC_KEY is not a raw P-256 public key");
      }
      const x = bytesToBase64Url(publicRaw.slice(1, 33));
      const y = bytesToBase64Url(publicRaw.slice(33, 65));
      const vapidKeys = await importVapidKeys(
        {
          publicKey: { kty: "EC", crv: "P-256", x, y },
          privateKey: {
            kty: "EC",
            crv: "P-256",
            x,
            y,
            d: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
          },
        },
        {},
      );
      return ApplicationServer.new({
        contactInformation: Deno.env.get("VAPID_SUBJECT") ?? DEFAULT_SUBJECT,
        vapidKeys,
      });
    })();
  }
  return serverPromise;
}

function serviceHeaders(): Record<string, string> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
}

function rest(path: string, init: RequestInit): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...(init.headers ?? {}) },
  });
}

const FULL_SELECT =
  "endpoint,p256dh,auth,focus,local_time,tz,last_sent_on,evening_time,last_evening_sent_on," +
  "mass_day,mass_time,mass_lead_min,mass_last_sent_on,conf_day,conf_time,conf_lead_min,conf_last_sent_on," +
  "drive_time,drive_last_sent_on";
const SELECT = "endpoint,p256dh,auth,focus,local_time,tz,last_sent_on,evening_time,last_evening_sent_on";
const LEGACY_SELECT = "endpoint,p256dh,auth,focus,local_time,tz,last_sent_on";

/** Every slot field a narrower select could not read, at its unset value. */
const UNSET_SLOTS = {
  evening_time: null,
  last_evening_sent_on: null,
  mass_day: null,
  mass_time: null,
  mass_lead_min: null,
  mass_last_sent_on: null,
  conf_day: null,
  conf_time: null,
  conf_lead_min: null,
  conf_last_sent_on: null,
  drive_time: null,
  drive_last_sent_on: null,
} as const;

/**
 * Reads subscription rows with as many slot columns as the database has.
 * Until a migration is pasted, PostgREST refuses the wider select — so the
 * read falls back through the narrower selects and every unread column
 * reads as unset. Push never breaks because a column is missing: the
 * morning dispatch runs exactly as before, and the newer slots simply
 * wait for their migration.
 */
async function querySubscriptions(endpoint: string | null): Promise<SubscriptionRow[]> {
  const filter = endpoint === null
    ? "active=eq.true"
    : `endpoint=eq.${encodeURIComponent(endpoint)}&active=eq.true`;
  for (const select of [FULL_SELECT, SELECT, LEGACY_SELECT]) {
    const res = await rest(`push_subscriptions?${filter}&select=${select}`, { method: "GET" });
    if (res.ok) {
      const rows = (await res.json()) as Partial<SubscriptionRow>[];
      return rows.map((row) => ({ ...UNSET_SLOTS, ...row }) as SubscriptionRow);
    }
  }
  throw new Error("subscription read failed at every select width");
}

async function listActiveSubscriptions(): Promise<SubscriptionRow[]> {
  return querySubscriptions(null);
}

async function findSubscription(endpoint: string): Promise<SubscriptionRow | null> {
  const rows = await querySubscriptions(endpoint);
  return rows[0] ?? null;
}

async function patchSubscription(endpoint: string, patch: Record<string, unknown>): Promise<void> {
  const res = await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) console.error(`subscription update failed with status ${res.status}`);
}

type SendOutcome = "sent" | "gone" | "failed";

async function sendPoke(server: ApplicationServer, sub: SubscriptionRow, payload: PushPayload): Promise<SendOutcome> {
  try {
    const subscriber = server.subscribe({
      endpoint: sub.endpoint,
      keys: { auth: sub.auth, p256dh: sub.p256dh },
    });
    await subscriber.pushTextMessage(JSON.stringify(payload), {
      ttl: POKE_TTL_SECONDS,
    });
    return "sent";
  } catch (err) {
    if (err instanceof PushMessageError) {
      const status = err.response.status;
      // 404/410: the push service has forgotten this subscription. It will never
      // recover, so the row is deactivated rather than retried every quarter hour.
      if (err.isGone() || status === 404 || status === 410) return "gone";
      console.error(`push send refused with status ${status}`);
      return "failed";
    }
    console.error("push send failed:", err instanceof Error ? err.message : String(err));
    return "failed";
  }
}

/** SHA-256 of a value, as lowercase hex — the shape the quota table's keys take. */
async function hashToHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The tailor-ready ping's ceiling: three a day per endpoint, and no more. */
const TAILOR_READY_DAILY_CAP = 3;

/**
 * Consumes one unit of an endpoint's tailor-ready quota. The durable
 * limiter is the chat quota table — a generic hashed-key counter — read
 * under a prefixed key hashed from the endpoint, so an endpoint is never
 * stored in the clear and the ping's bucket can never collide with a chat
 * caller's. Fails closed: if the limiter cannot be reached, the ping does
 * not go out. A best-effort convenience does not get to become an
 * unguarded send endpoint.
 */
async function consumeTailorReadyQuota(endpoint: string): Promise<boolean> {
  try {
    const clientKey = `tailor-ready:${await hashToHex(endpoint)}`;
    const res = await rest("rpc/consume_chat_quota", {
      method: "POST",
      body: JSON.stringify({
        p_client_key: clientKey,
        p_window_limit: TAILOR_READY_DAILY_CAP,
        p_day_limit: TAILOR_READY_DAILY_CAP,
        p_window_seconds: 86_400,
      }),
    });
    if (!res.ok) {
      console.error(`tailor-ready quota check failed with status ${res.status}`);
      return false;
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error("tailor-ready quota check failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    if (
      !Deno.env.get("SUPABASE_URL") ||
      !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      !Deno.env.get("VAPID_PUBLIC_KEY") ||
      !Deno.env.get("VAPID_PRIVATE_KEY")
    ) {
      console.error("push-dispatch misconfigured: missing SUPABASE_URL, service role, or VAPID secrets");
      return jsonResponse({ error: GENERIC_ERROR }, 500);
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {}; // an empty body is the cron's ordinary call
    }

    const server = await applicationServer();

    if (body.test === true && typeof body.endpoint === "string") {
      const sub = await findSubscription(body.endpoint);
      if (!sub) return jsonResponse({ error: "No active subscription for that endpoint." }, 404);
      const outcome = await sendPoke(server, sub, buildPushPayload(sub.focus));
      if (outcome === "gone") {
        await patchSubscription(sub.endpoint, { active: false });
        return jsonResponse({ ok: false, mode: "test", outcome });
      }
      return jsonResponse({ ok: outcome === "sent", mode: "test", outcome }, outcome === "sent" ? 200 : 502);
    }

    // The tailor-ready ping (Nov 18, 2026): the app asks for one fixed poke
    // when a Tailor build's audio finishes rendering in the background.
    // The endpoint must already be an active subscriber (it is the
    // capability), the quota is consumed before the send, and nothing is
    // written back — no marker, no row, no record of the build.
    if (body.action === "tailor-ready" && typeof body.endpoint === "string") {
      const sub = await findSubscription(body.endpoint);
      if (!sub) return jsonResponse({ error: "No active subscription for that endpoint." }, 404);
      if (!(await consumeTailorReadyQuota(sub.endpoint))) {
        return jsonResponse({ ok: false, mode: "tailor-ready", outcome: "rate-limited" }, 429);
      }
      const outcome = await sendPoke(server, sub, buildPushPayload("tailor"));
      if (outcome === "gone") {
        await patchSubscription(sub.endpoint, { active: false });
        return jsonResponse({ ok: false, mode: "tailor-ready", outcome });
      }
      return jsonResponse(
        { ok: outcome === "sent", mode: "tailor-ready", outcome },
        outcome === "sent" ? 200 : 502,
      );
    }

    const now = new Date();
    const subscriptions = await listActiveSubscriptions();
    const counts = { checked: subscriptions.length, due: 0, sent: 0, gone: 0, failed: 0 };

    for (const sub of subscriptions) {
      // The morning slot and the evening slot are evaluated independently:
      // each has its own hour and its own sent marker, and either can be due
      // without the other. The poke itself is identical — the same payload,
      // the same Gospel landing; only the marker written back differs.
      let deactivated = false;

      const evaluation = evaluateDue(
        { tz: sub.tz, localTime: sub.local_time.slice(0, 5), lastSentOn: sub.last_sent_on },
        now,
      );
      if (evaluation.due) {
        counts.due += 1;
        const outcome = await sendPoke(server, sub, buildPushPayload(sub.focus));
        if (outcome === "sent") {
          counts.sent += 1;
          await patchSubscription(sub.endpoint, { last_sent_on: evaluation.localDateKey });
        } else if (outcome === "gone") {
          counts.gone += 1;
          deactivated = true;
          await patchSubscription(sub.endpoint, { active: false });
        } else {
          counts.failed += 1;
        }
      }

      // A row the push service has forgotten is gone for every slot at once.
      if (deactivated) continue;

      const eveningEvaluation = evaluateEveningDue(
        {
          tz: sub.tz,
          localTime: sub.local_time.slice(0, 5),
          lastSentOn: sub.last_sent_on,
          eveningTime: sub.evening_time ? sub.evening_time.slice(0, 5) : null,
          eveningLastSentOn: sub.last_evening_sent_on,
        },
        now,
      );
      if (eveningEvaluation.due) {
        counts.due += 1;
        const outcome = await sendPoke(server, sub, buildPushPayload(sub.focus));
        if (outcome === "sent") {
          counts.sent += 1;
          await patchSubscription(sub.endpoint, { last_evening_sent_on: eveningEvaluation.localDateKey });
        } else if (outcome === "gone") {
          counts.gone += 1;
          deactivated = true;
          await patchSubscription(sub.endpoint, { active: false });
        } else {
          counts.failed += 1;
        }
      }

      if (deactivated) continue;

      // The newer slots (Nov 18, 2026) share one shape: an evaluation, a
      // fixed payload of their own, and a marker written only on delivery.
      // Each is independent — any subset of them may be due on one tick.
      const deliverSlot = async (
        slotDue: boolean,
        focus: string,
        marker: Record<string, unknown>,
      ): Promise<void> => {
        if (!slotDue || deactivated) return;
        counts.due += 1;
        const outcome = await sendPoke(server, sub, buildPushPayload(focus));
        if (outcome === "sent") {
          counts.sent += 1;
          await patchSubscription(sub.endpoint, marker);
        } else if (outcome === "gone") {
          counts.gone += 1;
          deactivated = true;
          await patchSubscription(sub.endpoint, { active: false });
        } else {
          counts.failed += 1;
        }
      };

      // The weekly parish pokes: a day, an hour, and a lead the reader
      // chose, with the event's own date as the marker. Any piece unset
      // (or unreadable, pre-migration) means the slot simply never fires.
      const massEvaluation = sub.mass_day !== null && sub.mass_time && sub.mass_lead_min !== null
        ? evaluateWeeklyDue(now, sub.tz, sub.mass_day, sub.mass_time.slice(0, 5), sub.mass_lead_min, sub.mass_last_sent_on)
        : null;
      await deliverSlot(massEvaluation?.due ?? false, "mass", {
        mass_last_sent_on: massEvaluation?.localDateKey,
      });

      // The Confession slot has two shapes (Nov 20, 2026): the minutes
      // leads ask the weekly question of the Confession hour, while the
      // evening-before sentinel (conf_lead_min = -1) asks the eve
      // question of the Confession DAY alone — one poke at 19:00 local
      // the day before, the Confession hour playing no part. Both write
      // the same marker: the Confession day's date.
      const confEvaluation = sub.conf_day === null || sub.conf_lead_min === null
        ? null
        : sub.conf_lead_min === CONFESSION_EVENING_BEFORE_LEAD
          ? evaluateConfessionEveDue(now, sub.tz, sub.conf_day, sub.conf_last_sent_on)
          : sub.conf_time
            ? evaluateWeeklyDue(now, sub.tz, sub.conf_day, sub.conf_time.slice(0, 5), sub.conf_lead_min, sub.conf_last_sent_on)
            : null;
      await deliverSlot(confEvaluation?.due ?? false, "confession", {
        conf_last_sent_on: confEvaluation?.localDateKey,
      });

      // The drive-home poke: a daily slot with its own marker, and no
      // same-time guard against the other slots — its purpose differs.
      // Since Nov 20, 2026 its payload sends the man to the Tailor build
      // (see pushCore); only the words and the landing changed, not the
      // hour, the marker, or the due question.
      const driveEvaluation = evaluateDriveDue(
        {
          tz: sub.tz,
          localTime: sub.local_time.slice(0, 5),
          lastSentOn: sub.last_sent_on,
          driveTime: sub.drive_time ? sub.drive_time.slice(0, 5) : null,
          driveLastSentOn: sub.drive_last_sent_on,
        },
        now,
      );
      await deliverSlot(driveEvaluation.due, "drivehome", {
        drive_last_sent_on: driveEvaluation.localDateKey,
      });
    }

    console.log(`push-dispatch ${JSON.stringify(counts)}`);
    return jsonResponse({ ok: true, mode: "dispatch", ...counts });
  } catch (err) {
    console.error("push-dispatch failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: GENERIC_ERROR }, 500);
  }
});
