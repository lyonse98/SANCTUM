// Receives a single anonymous analytics event from the browser and writes it via the
// SECURITY DEFINER `track_event` function. The allowlists are enforced inside that
// function, so even a hand-crafted request cannot store unapproved event names or
// free-text properties. No message text, no PII, no typed input is ever accepted.
//
// A second mode rides the same door: the counts-only profile tally
// (see tally.ts). A body carrying `tally` is validated field by field
// against the Tailor profile's own vocabularies and upserted — one row
// per hashed token — into `profile_tallies` through the service role.
// Ids only: no free text exists in the payload's shape, so none can be
// stored by any caller, crafted or not.
//
// verify_jwt is false: no-auth app. The event is metadata only and rate-limited per IP.

import { hashTallyToken, validateTallyPayload } from "./tally.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Soft per-IP cap so a runaway client cannot flood the table. The real value is the
// SECURITY DEFINER allowlist — this just bounds volume.
const RATE_WINDOW_SECONDS = 60;
const RATE_WINDOW_LIMIT = 30;

const fallbackBuckets = new Map<string, { count: number; resetAt: number }>();

async function hashClientKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientIdentifier(req: Request): string {
  const trusted = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
  if (trusted.trim()) return trusted.trim();
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops[hops.length - 1] || "unknown";
}

function withinFallbackQuota(clientKey: string): boolean {
  const now = Date.now();
  if (fallbackBuckets.size > 5000) fallbackBuckets.clear();
  const bucket = fallbackBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    fallbackBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_SECONDS * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_WINDOW_LIMIT;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ipKey = await hashClientKey(clientIdentifier(req));
    if (!withinFallbackQuota(ipKey)) {
      return new Response(JSON.stringify({ ok: false }), { status: 429, headers: jsonHeaders });
    }

    const body = await req.json() as Record<string, unknown>;

    // ── Tally mode: a body carrying `tally` is a profile snapshot, not
    // an event. Validate whole-or-nothing, hash the token, and upsert
    // the one row that token owns — a new snapshot replaces the old, so
    // the counts in profile_tally_counts are people, not submissions.
    if (body && typeof body === "object" && "tally" in body) {
      const tally = validateTallyPayload(body.tally);
      if (!tally) {
        return new Response(JSON.stringify({ ok: false }), { status: 400, headers: jsonHeaders });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceKey) {
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: jsonHeaders });
      }
      const tokenHash = await hashTallyToken(tally.tallyToken);
      const res = await fetch(`${supabaseUrl}/rest/v1/profile_tallies?on_conflict=token_hash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          token_hash: tokenHash,
          audience: tally.audience,
          voices: tally.voices,
          season_of_life: tally.seasonOfLife,
          ongoing_battles: tally.ongoingBattles,
          north_star: tally.northStar,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        // Best-effort, like the event path: a failed tally write is
        // swallowed so the user never sees an analytics error.
        return new Response(JSON.stringify({ ok: false }), { status: 200, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
    }

    const payload = body as { session?: unknown; name?: unknown; property?: unknown };
    const session = typeof payload.session === "string" ? payload.session.trim() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const property = typeof payload.property === "string" ? payload.property.trim() : "";
    if (session.length < 8 || session.length > 64 || !name) {
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ ok: false }), { status: 500, headers: jsonHeaders });
    }

    // The allowlist + length checks live inside track_event (SECURITY DEFINER), so
    // even if a caller sends a disallowed name/property, the insert is rejected.
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/track_event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        p_session: session,
        p_name: name,
        p_property: property || null,
      }),
    });

    if (!res.ok) {
      // 400 from the RPC means a disallowed event/property — swallow silently so the
      // user never sees an analytics error. Analytics must never break the app.
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch {
    // Analytics is best-effort: never surface a failure to the user.
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: jsonHeaders });
  }
});
