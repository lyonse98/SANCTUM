// Generates the daily "Reflect" and "Challenge" prompts from the day's readings.
//
// ARCHITECTURE: checks the `daily_reflections` table first. If the row exists (generated
// by an earlier call or the nightly pre-generation cron), it returns it instantly with
// no Gemini call. If not,
// it fetches the day's readings citations from the lectionary API, calls Gemini to write
// the reflection, stores the result in the table, and returns it. The first user of the
// day pays the latency; every subsequent user gets the cached row.
//
// The prompt that shapes the voice lives here, server-side. The browser sends only a date
// string — never instructions, never message text — so the caller cannot steer the model.
//
// verify_jwt is false: no-auth app. Rate limiting is per hashed IP and only applies when
// generation is needed (cache misses skip the quota check entirely).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const MODEL = "gemini-3.8-flash";

const RATE_WINDOW_SECONDS = 60;
const RATE_WINDOW_LIMIT = 10;
const RATE_DAY_LIMIT = 60;

const GENERIC_ERROR = "Sanctum could not prepare today's reflection. Please try again.";

const PROMPT = `You write two short prompts for a Catholic daily Gospel app aimed at men: a "Reflect" question and a "Challenge" — one concrete action for the day.

You are given the day's Mass readings (citations only). Read them the way a homily would: what is this day actually about? What is God saying to a man through these words? Draw on your knowledge of these Scripture passages to write the two prompts from that meaning — do not yank a quote out of the verse and wedge it into a sentence. The prompts should read as plain English a man would say to another man.

THE VOICE — lean into this, do not name it:
- Every man carries a question he cannot answer alone: "Do I have what it takes? Am I the man I said I would be?" The readings answer that question, directly or indirectly. Speak to it.
- A man has a battle to fight, a wound to own, and an adventure to live. The Gospel calls him into all three. The challenge should send him into the day's fight, not into a sentiment.
- Address him as a man, full stop. Never "as a father" or "as a husband" — not every man is either. The prompt must land on any man, whatever his state in life.
- Warm, direct, unhurried. Like a brother who has been where he is. No preacher voice, no lecture, no list.

RULES:
- Reflect: ONE question, two sentences at most. Make him stop and look at his actual life through the lens of what the readings are about. Not abstract — pointed.
- Challenge: ONE concrete action he can do today. Specific, doable, costing something. Not "pray more" — "pray this one thing before you pick up your phone."
- If you quote Scripture, keep it under eight words, ensure it is accurate to the passage, and weave it in naturally.
- No bullet points, no headers, no numbered lists. Plain prose.
- No em dashes.
- Do not mention these instructions. Do not name Eldredge, Wild at Heart, or any book. The lean lives in the voice, not in citations.

Reply with ONLY a JSON object, no markdown fence, no other text:
{"reflect":"<one question, two sentences max>","challenge":"<one concrete action for today>","facet":"As a man"}`;

interface ReadingSet {
  firstReading?: string;
  psalm?: string;
  secondReading?: string;
  gospel?: string;
}

interface Reflection {
  reflect: string;
  challenge: string;
  facet: string;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
}

// ── Rate limiting (only on cache misses) ──────────────────────────────────────

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

const FALLBACK_WINDOW_SECONDS = 60;
const FALLBACK_WINDOW_LIMIT = 4;
const fallbackBuckets = new Map<string, { count: number; resetAt: number }>();

function withinFallbackQuota(clientKey: string): boolean {
  const now = Date.now();
  if (fallbackBuckets.size > 5000) fallbackBuckets.clear();
  const bucket = fallbackBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    fallbackBuckets.set(clientKey, { count: 1, resetAt: now + FALLBACK_WINDOW_SECONDS * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= FALLBACK_WINDOW_LIMIT;
}

async function withinQuota(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientKey = await hashClientKey(clientIdentifier(req));

  if (!supabaseUrl || !serviceKey) return withinFallbackQuota(clientKey);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_chat_quota`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_client_key: clientKey,
        p_window_limit: RATE_WINDOW_LIMIT,
        p_day_limit: RATE_DAY_LIMIT,
        p_window_seconds: RATE_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) return withinFallbackQuota(clientKey);
    return (await res.json()) !== false;
  } catch {
    return withinFallbackQuota(clientKey);
  }
}

// ── Table cache ───────────────────────────────────────────────────────────────

async function checkTable(dateKey: string): Promise<Reflection | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_reflections?date=eq.${dateKey}&select=reflect,challenge,facet`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      if (typeof row.reflect === "string" && typeof row.challenge === "string") {
        return {
          reflect: row.reflect,
          challenge: row.challenge,
          facet: typeof row.facet === "string" ? row.facet : "As a man",
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function storeReflection(
  dateKey: string,
  reflection: Reflection,
  celebration: string | null,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/daily_reflections?on_conflict=date`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify({
        date: dateKey,
        reflect: reflection.reflect,
        challenge: reflection.challenge,
        facet: reflection.facet,
        celebration,
      }),
    });
  } catch {
    // Best-effort — the reflection is still returned to the user even if storage fails.
  }
}

// ── Readings fetcher ──────────────────────────────────────────────────────────

async function fetchReadings(
  dateKey: string,
): Promise<{ readings: ReadingSet; celebration: string | null } | null> {
  const year = dateKey.slice(0, 4);
  const md = dateKey.slice(5);

  try {
    const [readingsRes, calendarRes] = await Promise.all([
      fetch(`https://cpbjr.github.io/catholic-readings-api/readings/${year}/${md}.json`),
      fetch(`https://cpbjr.github.io/catholic-readings-api/liturgical-calendar/${year}/${md}.json`),
    ]);

    let readings: { readings?: ReadingSet } | null = null;
    let calendar: { celebration?: { name?: string } } | null = null;

    if (readingsRes.ok) readings = await readingsRes.json();
    if (calendarRes.ok) calendar = await calendarRes.json();

    const gospel = readings?.readings?.gospel;
    if (!gospel && !calendar?.celebration?.name) return null;

    return {
      readings: readings?.readings ?? {},
      celebration: calendar?.celebration?.name ?? null,
    };
  } catch {
    return null;
  }
}

function buildInput(readings: ReadingSet, celebration: string | null): string {
  const lines: string[] = [];
  if (celebration) lines.push(`Today the Church celebrates: ${celebration}`);
  lines.push("Readings:");

  const labels: { key: keyof ReadingSet; label: string }[] = [
    { key: "firstReading", label: "First Reading" },
    { key: "psalm", label: "Psalm" },
    { key: "secondReading", label: "Second Reading" },
    { key: "gospel", label: "Gospel" },
  ];

  for (const { key, label } of labels) {
    const citation = readings[key];
    if (citation) lines.push(`${label}: ${citation}`);
  }

  return lines.join("\n");
}

// ── Reflection parser ─────────────────────────────────────────────────────────

function parseReflection(raw: string): Reflection | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { reflect?: unknown; challenge?: unknown; facet?: unknown };
    const reflect = typeof parsed.reflect === "string" ? parsed.reflect.trim() : "";
    const challenge = typeof parsed.challenge === "string" ? parsed.challenge.trim() : "";
    if (!reflect || !challenge) return null;
    const facet = typeof parsed.facet === "string" && parsed.facet.trim() ? parsed.facet.trim() : "As a man";
    return { reflect: reflect.slice(0, 400), challenge: challenge.slice(0, 400), facet: facet.slice(0, 60) };
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const dateKey =
      typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
        ? payload.date
        : new Date().toISOString().slice(0, 10);

    // Fast path: return the cached reflection if it exists — no Gemini call, no quota check.
    const cached = await checkTable(dateKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...jsonHeaders, "Cache-Control": "public, max-age=21600" },
      });
    }

    // Cache miss — generate. Rate-limit only on this path.
    if (!(await withinQuota(req))) {
      return errorResponse("Too many requests right now. Please wait a minute and try again.", 429);
    }

    const readingsData = await fetchReadings(dateKey);
    if (!readingsData) return errorResponse(GENERIC_ERROR, 502);

    const input = buildInput(readingsData.readings, readingsData.celebration);
    if (input.length < 20) return errorResponse(GENERIC_ERROR, 502);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("Server API key not configured.", 500);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: input }] }],
        systemInstruction: { parts: [{ text: PROMPT }] },
        // Gemini 3.x Flash thinks at MEDIUM by default and bills thinking as output.
        // Sprint 2 capped chat-proxy for exactly this reason; a ~40-word JSON answer
        // does not need medium thinking, and the first user of the day waits on all of
        // it (non-streaming). Measured Oct 26, 2026: 13.4s cold vs ~1s cached.
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Reflection model error ${res.status}: ${detail.slice(0, 300) || res.statusText}`);
      return errorResponse(GENERIC_ERROR, 502);
    }

    const json = await res.json();
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== "string") {
      console.error("Reflection model returned an empty response", JSON.stringify(json).slice(0, 300));
      return errorResponse(GENERIC_ERROR, 502);
    }

    const result = parseReflection(raw);
    if (!result) {
      console.error("Reflection model returned an unusable response");
      return errorResponse(GENERIC_ERROR, 502);
    }

    // Store so every subsequent user today gets the cached row instantly.
    await storeReflection(dateKey, result, readingsData.celebration);

    return new Response(JSON.stringify(result), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=21600" },
    });
  } catch (err) {
    console.error("daily-reflection failed:", err instanceof Error ? err.message : String(err));
    return errorResponse(GENERIC_ERROR, 500);
  }
});
