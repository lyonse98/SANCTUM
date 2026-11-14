/*
  Tailor Today — the personalized daily devotional (Erik's approval, Nov 12, 2026).

  Called ONLY by the client, when a user asks to tailor today. It composes one
  person's devotional for one morning: the day's READINGS ENTIRE, verbatim
  from the day's own bundle (never regenerated), one need-matched passage
  selected from the curated bank and offered after them as a supplement, the
  day's reflection and challenge re-aimed at the user's stated morning by the
  narrator-side pipeline (one Gemini call, under the Scripture-grounding
  blocks — NO companion lens: companions are text-only and live in their
  chats, Erik Nov 12, 2026), and one curated media pick — the whole of it
  read aloud by the day's NARRATOR, as the narrator companies read the free
  devotional.

  V2 (Nov 13, 2026): the request may also carry the tone of the ask and the
  user's standing profile (season of life, ongoing battles, a standing goal,
  media preferences) — phrased for the track, transient like the morning's
  own words. The composition adds a word from the tradition (the corpus shelf
  first when configured — corpus.ts — the app's daily-quotes dataset behind
  it) woven after the tailored reflection, and one media item found by live,
  search-grounded lookup whose query is built from enum categories only and
  whose address must come from the search's own grounding sources (the
  curated bank still stands behind every failure).

  PRIVACY — THE HARD RULE OF THIS FUNCTION:
  The intake (a state, a focus, a tone, at most one line in the user's own
  words) and everything built from it are NEVER stored server-side. There are
  no database writes and no storage uploads anywhere in this file: the day's
  bundle is READ, the devotional is composed in memory, and the response
  carries the text and the audio bytes back to the device, which caches them
  on-device only. Logs are stage codes and counts — never intake text, never
  output text. A vitest source pin asserts the absence of write paths.

  Quota: the companions' shared limiter discipline (hashed IP, durable RPC),
  namespaced to this function, with its own tighter ceilings — 5 builds a
  minute, 3 builds a day per caller. One tailored build a day is the product
  shape; three leaves room for a rebuild and a mistake.

  Entitlement: tailorAccess() (mirrored from src/lib/tailorAccess.ts) is the
  premium seam. Today it allows everyone — Tailor Today is free for the
  current circle. When premium ships, that one function changes, here and in
  the client, and nothing else in this file needs to.

  verify_jwt is false, like its siblings: the client calls with the public
  anon key, and the only privileged access here is READING the day's bundle
  through the service role.
*/

import { Mp3Encoder } from "npm:@breezystack/lamejs@1.2.7";
import {
  AUDIO_SILENCE_SECONDS,
  BANK,
  BANK_WOMEN,
  LECTOR_BANK,
  LECTOR_BANK_WOMEN,
  addDaysISO,
  applyLexicon,
  type NarratorAudience,
} from "./narratorCore.ts";
import {
  SAMPLE_RATE,
  decodeSpeechAudio,
  secondsOf,
  silenceSamples,
  stretchPcm,
} from "./audioEngine.ts";
import { tailorAccess } from "./tailorAccess.ts";
import {
  buildCorpusQuoteQuery,
  buildResponseBody,
  composeTailored,
  parseTailorResult,
  validateIntake,
  validateProfile,
  type TailorBundle,
  type TailoredParts,
} from "./tailorCore.ts";
import { corpusEnabled, retrieveTraditionQuote } from "./corpus.ts";
import { splitReadingsParagraphs } from "./renderPieces.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const TEXT_MODEL = "gemini-3.8-flash";
const TTS_MODEL = "gemini-3.8-flash-tts";

// This function's own tighter ceilings (see the header): the shared limiter RPC
// is reused, but the client key is namespaced so Tailor builds never draw on
// the companions' quota, nor they on this one.
const RATE_WINDOW_SECONDS = 60;
const RATE_WINDOW_LIMIT = 5;
const RATE_DAY_LIMIT = 3;
const FALLBACK_WINDOW_LIMIT = 2;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function losAngelesToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function losAngelesHour(): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const parsed = parseInt(hour, 10);
  return Number.isFinite(parsed) ? parsed % 24 : 12;
}

// ── Quota (chat-proxy's discipline, this function's namespace) ───────────────

async function hashClientKey(identifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tailor:${identifier}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Same rule as chat-proxy: trusted edge headers first, else the LAST forwarded hop. */
function clientIdentifier(req: Request): string {
  const trusted = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
  if (trusted.trim()) return trusted.trim();
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops[hops.length - 1] || "unknown";
}

const fallbackBuckets = new Map<string, { count: number; resetAt: number }>();

function withinFallbackQuota(clientKey: string): boolean {
  const now = Date.now();
  if (fallbackBuckets.size > 5000) fallbackBuckets.clear();
  const bucket = fallbackBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    fallbackBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_SECONDS * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= FALLBACK_WINDOW_LIMIT;
}

async function withinQuota(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientKey = await hashClientKey(clientIdentifier(req));
  if (!supabaseUrl || !serviceKey) {
    console.error("tailor-devotional: rate limiter misconfigured");
    return withinFallbackQuota(clientKey);
  }
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
    if (!res.ok) {
      console.error("tailor-devotional: rate limiter RPC failed with status", res.status);
      return withinFallbackQuota(clientKey);
    }
    const allowed = await res.json();
    return allowed !== false;
  } catch {
    return withinFallbackQuota(clientKey);
  }
}

// ── The day's bundle (READ-ONLY — the only database contact in this file) ────

function serviceHeaders(): Record<string, string> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

async function restSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL") ?? ""}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function callFunction(path: string, init: RequestInit): Promise<boolean> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/${path}`, {
      ...init,
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(60000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reads the day's bundle for ONE track — the readings row (Gospel verbatim) and
 * the track's own reflection row. If the reflection has not been generated yet
 * (a user earlier than the morning pipeline), the reflection function is asked
 * to generate the day's, exactly as the audio renderer does; the readings path
 * is the same. Nothing is written by this function either way.
 */
async function readBundle(
  dateISO: string,
  audience: NarratorAudience,
): Promise<TailorBundle | null> {
  const readReflection = async () => {
    const rows = await restSelect(
      "daily_reflections",
      `date=eq.${dateISO}&audience=eq.${audience}&select=reflect,challenge,facet`,
    );
    const row = rows[0];
    if (!row || typeof row.reflect !== "string" || typeof row.challenge !== "string") return null;
    return {
      reflect: row.reflect,
      challenge: row.challenge,
      facet: typeof row.facet === "string" ? row.facet : audience === "women" ? "As a woman" : "As a man",
    };
  };
  const readReadings = async () => {
    const rows = await restSelect("daily_readings", `date=eq.${dateISO}&select=payload`);
    const payload = rows[0]?.payload as
      | {
          citations?: { celebration?: unknown; gospel?: unknown };
          texts?: Partial<
            Record<"first" | "psalm" | "second" | "gospel", { citation?: unknown; text?: unknown } | null>
          >;
        }
      | undefined;
    // The day's readings ENTIRE, in lectionary order, verbatim from the
    // payload — the same texts the free devotional carries. The Gospel part
    // is required; the others ride when the day's bundle has them.
    const readings: TailorBundle["readings"] = [];
    for (const kind of ["first", "psalm", "second", "gospel"] as const) {
      const part = payload?.texts?.[kind];
      if (part && typeof part.text === "string" && part.text.trim()) {
        readings.push({
          kind,
          citation: typeof part.citation === "string" ? part.citation : "",
          text: part.text,
        });
      }
    }
    const gospel = readings.find((p) => p.kind === "gospel");
    if (!gospel) return null;
    const gospelCitation =
      typeof payload?.citations?.gospel === "string" && payload.citations.gospel.trim()
        ? payload.citations.gospel
        : gospel.citation;
    if (!gospelCitation.trim()) return null;
    return {
      celebration: typeof payload?.citations?.celebration === "string" ? payload.citations.celebration : null,
      gospelCitation,
      gospelText: gospel.text,
      readings,
    };
  };

  let reflection = await readReflection();
  if (!reflection) {
    await callFunction("daily-reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateISO, audience }),
    });
    reflection = await readReflection();
  }
  let readings = await readReadings();
  if (!readings) {
    await callFunction(`daily-readings?date=${addDaysISO(dateISO, 0)}`, { method: "GET" });
    readings = await readReadings();
  }
  if (!reflection || !readings) return null;
  return { ...readings, ...reflection };
}

// ── The one generation ───────────────────────────────────────────────────────

async function generateTailored(systemPrompt: string, userPrompt: string): Promise<TailoredParts> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) throw new Error(`tailor model HTTP ${res.status}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("tailor model returned no text");
  const parsed = parseTailorResult(text);
  if (!parsed) throw new Error("tailor model returned an unusable shape");
  return parsed;
}

// ── The live media search (Gemini, Google-Search-grounded) ───────────────────

// The screening lives in the instruction; the query itself is built in the
// core from enum categories only (see buildMediaSearchQuery there). The raw
// grounded response goes back to the core, which accepts a pick only when
// its address appears verbatim among the response's own grounding sources.
const MEDIA_SEARCH_INSTRUCTION = `You are Sanctum's media finder. Search the web for the one work the request describes and answer with ONLY a JSON object: {"title": "...", "creator": "...", "kind": "...", "url": "..."}. The url must be copied exactly from a page your search actually found — the work's own page, never a search-results page, never an address you composed or shortened. The title and creator must be the work's real ones. If nothing genuinely fits, answer {"title": "", "creator": "", "kind": "", "url": ""}.`;

async function searchMediaLive(query: string): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: MEDIA_SEARCH_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            maxOutputTokens: 512,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Speech (audio-render's exact path and production) ────────────────────────

async function renderSpeech(text: string, voice: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  const part = Array.isArray(parts) ? parts.find((p) => p?.inlineData || p?.inline_data) : null;
  const data = part?.inlineData ?? part?.inline_data;
  if (!data?.data || typeof data.data !== "string") throw new Error("TTS response carried no audio");
  return Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
}

/** MP3, 24 kHz mono CBR 64 kbps — the daily render's encoding, unchanged. */
function encodeMp3(samples: Int16Array): Uint8Array<ArrayBuffer> {
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, 64);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const data = encoder.encodeBuffer(samples.subarray(i, i + 1152));
    if (data.length > 0) chunks.push(Uint8Array.from(data));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Uint8Array.from(tail));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Join MP3 pieces encoded at identical settings (24 kHz mono CBR 64 kbps,
 * bare lamejs frames) into one stream — the byte concatenation audio-render's
 * finalize relies on across invocations, applied here across pieces.
 */
function concatMp3(pieces: Uint8Array[]): Uint8Array {
  const total = pieces.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const piece of pieces) {
    out.set(piece, at);
    at += piece.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ── The request ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only." }, 405);
  }

  // The premium seam: today this allows everyone (see tailorAccess.ts).
  if (!tailorAccess().allowed) {
    return jsonResponse({ ok: false, error: "Tailor Today is not available." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const audience: NarratorAudience = payload.audience === "women" ? "women" : "men";
  const intake = validateIntake(payload);
  if (!intake) {
    return jsonResponse({ ok: false, error: "That tailoring could not be read. Try again." }, 400);
  }
  // The standing profile, when the device sent one — validated to labels and
  // caps in the core, used for phrasing only, and stored nowhere, exactly
  // like the morning's own words.
  const profile = validateProfile(payload);

  const dateISO =
    typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : losAngelesToday();

  if (!(await withinQuota(req))) {
    return jsonResponse(
      { ok: false, error: "Today's tailored devotional is already built — or the day's builds are used up." },
      429,
    );
  }

  try {
    const bundle = await readBundle(dateISO, audience);
    if (!bundle) {
      console.error(`tailor-devotional failed: date=${dateISO} stage=bundle`);
      return jsonResponse(
        { ok: false, error: "Today's readings are not ready yet. The free devotional above is unaffected." },
        200,
      );
    }

    // The tradition quote's first shelf: the corpus, when it is configured
    // for this function — one short passage for the day's stated categories.
    // Fail-open by design: no shelf, no quote from it, and the composition
    // answers from the dataset shelf instead (see the core).
    let corpusQuote = null;
    if (corpusEnabled()) {
      corpusQuote = await retrieveTraditionQuote(buildCorpusQuoteQuery(intake)).catch(() => null);
    }

    const composed = await composeTailored({
      dateISO,
      audience,
      intake,
      bundle,
      profile,
      generateTailored,
      findMedia: searchMediaLive,
      corpusQuote,
      hour: losAngelesHour(),
    });

    // Render the script with the day narrator's voice and production — the
    // same profile lookup, lexicon, tempo, and encoding as the daily render.
    // (Named narratorProfile, NOT profile: this block already passes the
    // standing `profile` to composeTailored above, and a same-named const
    // here shadows it for the whole block — the compose call then hits the
    // temporal dead zone and throws before any generation happens.)
    const script = composed.script;
    const narratorProfile =
      script.persona === "lector"
        ? audience === "women"
          ? LECTOR_BANK_WOMEN
          : LECTOR_BANK
        : audience === "women"
          ? BANK_WOMEN[script.persona as keyof typeof BANK_WOMEN]
          : BANK[script.persona as keyof typeof BANK];

    // Piece-work render (Nov 13, 2026 — the free-plan fix): the whole
    // program used to be held in the sample domain at once — every part
    // decoded and stretched, concatenated into one multi-minute PCM block,
    // then encoded in a single pass — and that peak is what the free-plan
    // worker limit kills. Now each spoken piece goes TTS → decode → stretch
    // → encode on its own and its PCM is released before the next piece
    // starts; the encoded pieces are joined as bytes at the end (identical
    // encoder settings throughout — the frame concatenation audio-render's
    // finalize relies on). The readings, the one long piece, are split on
    // their paragraph boundaries (renderPieces.ts), so no single PCM block
    // exceeds one reading part. Order and production are unchanged — head,
    // readings, passage, the produced silence, mainB — and nothing is
    // stored: the joined bytes leave as base64 in the response, as before.
    const toMp3 = async (text: string): Promise<{ mp3: Uint8Array; seconds: number }> => {
      const bytes = await renderSpeech(applyLexicon(text), narratorProfile.voice);
      const pcm = stretchPcm(decodeSpeechAudio(bytes), narratorProfile.tempo);
      return { mp3: encodeMp3(pcm), seconds: secondsOf(pcm) };
    };

    const pieces: Uint8Array[] = [];
    let totalSeconds = 0;
    const addPiece = async (text: string): Promise<void> => {
      const piece = await toMp3(text);
      pieces.push(piece.mp3);
      totalSeconds += piece.seconds;
    };

    await addPiece(script.head);
    for (const paragraph of splitReadingsParagraphs(script.readings)) {
      await addPiece(paragraph);
    }
    await addPiece(script.passage);
    pieces.push(encodeMp3(silenceSamples(AUDIO_SILENCE_SECONDS)));
    totalSeconds += AUDIO_SILENCE_SECONDS;
    await addPiece(script.mainB);

    const mp3 = concatMp3(pieces);
    const seconds = Math.round(totalSeconds * 10) / 10;

    console.log(
      `tailor-devotional: date=${dateISO} audience=${audience} persona=${script.persona} seconds=${seconds}`,
    );
    return jsonResponse(buildResponseBody(dateISO, composed, bytesToBase64(mp3), seconds));
  } catch (err) {
    // The error MESSAGE is logged — and it is safe to log: every error this
    // function raises is a stage code by construction (a fixed phrase or an
    // HTTP status from generateTailored / renderSpeech / the audio engine),
    // never intake text, never output text. That keeps the privacy rule
    // (logs are stage codes and counts) while making a failed build
    // diagnosable instead of a silent catch-all.
    console.error(
      `tailor-devotional failed: date=${dateISO} audience=${audience} error=${
        err instanceof Error ? err.message : "error"
      }`,
    );
    return jsonResponse(
      { ok: false, error: "The tailored devotional could not be built just now. The free devotional above is unaffected." },
      200,
    );
  }
});
