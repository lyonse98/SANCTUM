/*
  Push dispatch for Sanctum's daily reminder.

  Called every quarter hour by pg_cron (see the schedule migration) with an empty body:
  it reads every active row of `push_subscriptions` with the service role, works out who is
  due from each subscription's own timezone and chosen local time, and sends the ones that
  are. All the rules — the copy, the deep links, the due window, the daylight-saving
  behaviour — live in ./pushCore.ts, which is GENERATED from src/lib/pushCore.ts by
  scripts/sync-push-core.mjs so the server and the app can never drift apart. Do not edit
  the logic here into a second copy.

  The payload is deliberately discreet: a lock screen is a public place. It says the day's
  Gospel and reflection are ready, and nothing else, ever.

  Also accepts { "test": true, "endpoint": "…" } to poke one subscription immediately —
  used once at deploy time to prove the loop on the owner's phone. The endpoint must
  already be an active subscriber (the endpoint is the capability), the payload is the
  same fixed copy, and a test send never marks the day as sent.

  verify_jwt is false, like the other no-auth functions: the cron calls with the public
  anon key, and the table is unreachable except through the service role used here.

  Logs are counts only. Endpoints are capability URLs and are never written to a log.
*/

import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
} from "jsr:@negrel/webpush@0.5.0";
import { buildPushPayload, evaluateDue } from "./pushCore.ts";

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

const SELECT = "endpoint,p256dh,auth,focus,local_time,tz,last_sent_on";

async function listActiveSubscriptions(): Promise<SubscriptionRow[]> {
  const res = await rest(`push_subscriptions?active=eq.true&select=${SELECT}`, { method: "GET" });
  if (!res.ok) throw new Error(`subscription read failed with status ${res.status}`);
  return (await res.json()) as SubscriptionRow[];
}

async function findSubscription(endpoint: string): Promise<SubscriptionRow | null> {
  const res = await rest(
    `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&active=eq.true&select=${SELECT}`,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(`subscription lookup failed with status ${res.status}`);
  const rows = (await res.json()) as SubscriptionRow[];
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

async function sendPoke(server: ApplicationServer, sub: SubscriptionRow): Promise<SendOutcome> {
  try {
    const subscriber = server.subscribe({
      endpoint: sub.endpoint,
      keys: { auth: sub.auth, p256dh: sub.p256dh },
    });
    await subscriber.pushTextMessage(JSON.stringify(buildPushPayload(sub.focus)), {
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
      const outcome = await sendPoke(server, sub);
      if (outcome === "gone") {
        await patchSubscription(sub.endpoint, { active: false });
        return jsonResponse({ ok: false, mode: "test", outcome });
      }
      return jsonResponse({ ok: outcome === "sent", mode: "test", outcome }, outcome === "sent" ? 200 : 502);
    }

    const now = new Date();
    const subscriptions = await listActiveSubscriptions();
    const counts = { checked: subscriptions.length, due: 0, sent: 0, gone: 0, failed: 0 };

    for (const sub of subscriptions) {
      const evaluation = evaluateDue(
        { tz: sub.tz, localTime: sub.local_time.slice(0, 5), lastSentOn: sub.last_sent_on },
        now,
      );
      if (!evaluation.due) continue;
      counts.due += 1;

      const outcome = await sendPoke(server, sub);
      if (outcome === "sent") {
        counts.sent += 1;
        await patchSubscription(sub.endpoint, { last_sent_on: evaluation.localDateKey });
      } else if (outcome === "gone") {
        counts.gone += 1;
        await patchSubscription(sub.endpoint, { active: false });
      } else {
        counts.failed += 1;
      }
    }

    console.log(`push-dispatch ${JSON.stringify(counts)}`);
    return jsonResponse({ ok: true, mode: "dispatch", ...counts });
  } catch (err) {
    console.error("push-dispatch failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: GENERIC_ERROR }, 500);
  }
});
