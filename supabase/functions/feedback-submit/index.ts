/*
  Feedback intake for Sanctum.

  The browser cannot reach the `feedback_submissions` table directly — RLS denies everything and
  the table has no grants for anon/authenticated. This function is the only way in, and it writes
  with the service role.

  CORS: this endpoint is called from the web app, so every response (preflight included) carries
  the standard header set.
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_CATEGORIES = ["idea", "bug", "other"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deliberately generic: callers are untrusted, and the real cause belongs in the server log.
const GENERIC_ERROR = "Could not save that just now. Please try again.";
const RATE_LIMITED = "That is a lot of feedback at once. Please wait a moment and try again.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashClientKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Caller identity for rate limiting. Mirrors the chat proxy: the leftmost X-Forwarded-For entry is
 * client-supplied and forgeable, so we trust only gateway-set headers and otherwise take the LAST
 * hop, which is appended closest to our own infrastructure.
 */
function clientIdentifier(req: Request): string {
  const trusted = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
  if (trusted.trim()) return trusted.trim();

  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops[hops.length - 1] || "unknown";
}

/**
 * Consumes one unit of the caller's feedback quota from the shared limiter, using a `feedback:`
 * prefix so this endpoint cannot drain anyone's chat allowance. If the limiter is unreachable we
 * allow the submission rather than losing it — the message length cap still bounds the damage.
 */
async function withinQuota(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return true;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_chat_quota`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_client_key: `feedback:${await hashClientKey(clientIdentifier(req))}`,
        p_window_limit: 3,
        p_day_limit: 20,
        p_window_seconds: 300,
      }),
    });

    if (!res.ok) return true;
    return (await res.json()) !== false;
  } catch {
    return true;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const rawCategory = typeof payload.category === "string" ? payload.category : "";
    const category = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : "";
    if (!category) {
      return jsonResponse({ error: "Pick what kind of feedback this is." }, 400);
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) {
      return jsonResponse({ error: "Please write something first." }, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: `Please keep it under ${MAX_MESSAGE_LENGTH} characters.` }, 400);
    }

    // Optional reply address. A malformed one is dropped rather than rejected — the feedback
    // itself is the valuable part and should not be lost over a typo in an optional field.
    const rawEmail = typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
    const contactEmail =
      rawEmail && rawEmail.length <= 254 && EMAIL_PATTERN.test(rawEmail) ? rawEmail.toLowerCase() : null;

    const rawPage = typeof payload.page === "string" ? payload.page.trim() : "";
    const page = rawPage ? rawPage.slice(0, 64) : null;

    if (!(await withinQuota(req))) {
      return jsonResponse({ error: RATE_LIMITED }, 429);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("feedback-submit misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ error: GENERIC_ERROR }, 500);
    }

    const insert = await fetch(`${supabaseUrl}/rest/v1/feedback_submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        category,
        message,
        contact_email: contactEmail,
        page,
      }),
    });

    if (!insert.ok) {
      const detail = await insert.text().catch(() => "");
      console.error(`feedback insert failed ${insert.status}: ${detail.slice(0, 300)}`);
      return jsonResponse({ error: GENERIC_ERROR }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("feedback-submit failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: GENERIC_ERROR }, 500);
  }
});
