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
  curated bank still stands behind every failure). MEDIA REWORK (Nov 13,
  2026): the card is pop culture (Erik) — several angle searches gather a
  candidate pool, church content is hard-excluded in the core, and one
  rubric scoring call (scoreMediaLive) picks the best verified candidate;
  the bank was re-curated to pop works with live-verified addresses.

  PRIVACY — THE HARD RULE OF THIS FUNCTION:
  The intake (a state, a focus, a tone, at most one line in the user's own
  words) is NEVER stored server-side — not in a table, not in a log, not
  anywhere. Nothing the user says, chooses, or writes is ever written.
  What a build RETURNS is a different matter (Erik, Nov 13, 2026): the
  composed devotional itself — Sanctum's own words, unattributed, with no
  identifier of any kind — is recorded for quality review (outputs.ts,
  deleted by the database at 90 days), and a winning live media find,
  being a public link, is captured with its scores so the media library
  grows. Those are the function's only writes, they live entirely in
  outputs.ts (the write path here accepts the composed package and
  nothing upstream of it), and they are fail-open: the response is
  byte-identical whether they land or not. In THIS file nothing is
  written: the day's bundle is READ, the devotional is composed in
  memory, and the response carries the text and the audio bytes back to
  the device, which caches them on-device only. Logs are stage codes
  and counts — never intake text, never output text. Vitest source pins
  hold both halves of the rule.

  Quota: the companions' shared limiter discipline (hashed IP, durable RPC),
  namespaced to this function, with its own tighter ceilings — 5 builds a
  minute, 3 builds a day per caller. One tailored build a day is the product
  shape; three leaves room for a rebuild and a mistake.

  AUDIO — CLIENT-ORCHESTRATED (Nov 13, 2026): the in-function audio render
  stays disabled (TAILOR_AUDIO_ENABLED below). Supabase's binding limit is
  2 s of CPU per edge request on every plan, and a full tailored program
  prices at ~6 s of cumulative stretch+encode CPU — the worker kill is
  uncatchable, so an in-invocation render loses even the finished TEXT.
  The live route is the audio plan (TAILOR_AUDIO_PLAN, audioPlan.ts): the
  build returns the complete text package at once, plus the assembled
  script cut into ≤200-char pieces, each signed with an HMAC token. The
  device then fetches each piece through this function's piece mode — one
  TTS + decode + stretch + encode per call, the daily render's proven
  envelope — and concatenates the MP3 bytes on-device. The token is the
  only authorization a piece fetch needs (no build quota is consumed);
  a bad token is a 403. If AUDIO_RENDER_KEY is unset, the build omits the
  plan and returns the text-only package, exactly as the interim builds
  did. The in-function render code below stays in place behind its flag;
  nothing about composition, quota, or privacy changes.

  Entitlement: tailorAccess() (mirrored from src/lib/tailorAccess.ts) is the
  premium seam. Today it allows everyone — Tailor Today is free for the
  current circle. When premium ships, that one function changes, here and in
  the client, and nothing else in this file needs to.

  verify_jwt is false, like its siblings: the client calls with the public
  anon key, and privileged access through the service role is the day's
  bundle reads plus the output record in outputs.ts — nothing else.
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
  lectorTakes,
  resolveFeastDay,
  weekdayOfISO,
  weekdayPersona,
  type NarratorAudience,
} from "./narratorCore.ts";
import {
  SAMPLE_RATE,
  decodeSpeechAudio,
  finishPiecePcm,
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
import {
  buildAudioPlan,
  verifyPieceToken,
  type TailorAudioPlanEntry,
} from "./audioPlan.ts";
import { loadMediaWinners, recordComposedOutput } from "./outputs.ts";

// The edge runtime's background-task hook: the output record is dispatched
// with the response already shaped and registered here, so the isolate
// stays alive until the record has landed (or failed open).
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

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

// The in-function render (see the header): false, and it stays false — as a
// single in-invocation render it exceeds the platform's 2 s CPU ceiling and
// the uncatchable kill takes the text package with it. The render block is
// kept whole below as the reference production the piece mode reuses.
const TAILOR_AUDIO_ENABLED = false;

// TAILOR AUDIO PLAN (the live route, see the header + audioPlan.ts): true =
// a build also returns the signed piece plan, and this function's piece mode
// renders those pieces one call at a time for the device to stitch. The plan
// is issued only when AUDIO_RENDER_KEY is configured; without the key there
// is nothing to sign with, and the build is the text-only package.
const TAILOR_AUDIO_PLAN_ENABLED = true;

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
// grounded response goes back to the core, which accepts a candidate only
// when its address appears verbatim among the response's own grounding
// sources. Several angle searches gather the pool; the core excludes church
// content and scores the survivors (see scoreMediaLive below).
const MEDIA_SEARCH_INSTRUCTION = `You are Sanctum's media finder. Search the web for the one work the request describes and answer with ONLY a JSON object: {"title": "...", "creator": "...", "kind": "...", "url": "..."}. The work must be mainstream pop culture — a famous song, talk, interview, speech, or clip in the register of a David Goggins interview or a Linkin Park song. NEVER return church content: no worship music or hymns, no sermons or homilies, no church or ministry podcasts or channels, nothing devotional. The url must be copied exactly from a page your search actually found — the work's own page, never a search-results page, never an address you composed or shortened. The title and creator must be the work's real ones. If nothing genuinely fits, answer {"title": "", "creator": "", "kind": "", "url": ""}.`;

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

// ── The media scorer (one rubric call over the verified pool) ────────────────

// The rubric itself is built in the core (buildMediaScorePrompt there); this
// is only the transport — a plain generation, no search tool. The raw reply
// goes back to the core, which accepts it only in the exact scores shape.
const MEDIA_SCORE_INSTRUCTION = `You are Sanctum's media scorer. Follow the rubric in the request exactly and answer with ONLY the JSON object it asks for — no prose, no explanation.`;

async function scoreMediaLive(prompt: string): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: MEDIA_SCORE_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
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

// ── The spoken bridge generation (Nov 14, 2026) ──────────────────────────────

// The rubric lives in the core (buildSpokenBridgePrompt there); this is only
// the transport — a plain generation, no search tool, returning the reply
// text itself (the bridge is prose, not JSON). Any failure returns null and
// the composition builds without a bridge, fail-open like every other hunt.
const BRIDGE_INSTRUCTION = `You are Sanctum's devotional writer. Follow the writing task in the request exactly and answer with ONLY the bridge prose it asks for — no preamble, no commentary, nothing else.`;

async function generateBridgeText(prompt: string): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: BRIDGE_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 512,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? text : null;
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

// ── The piece mode (the audio plan's other half) ─────────────────────────────

/**
 * The narrator profile for (date, audience), derived exactly as the build
 * derives it: assembleScript's own rule — the Lector takes a solemnity (the
 * calendar's exceptions aside), otherwise the weekday reader of the track —
 * and the same bank lookup the render block performs. Voice and tempo are
 * the whole of what a piece render needs from the profile.
 */
function narratorProfileFor(dateISO: string, audience: NarratorAudience) {
  const feast = resolveFeastDay(dateISO);
  const persona =
    feast && lectorTakes(dateISO, feast)
      ? "lector"
      : weekdayPersona(audience, weekdayOfISO(dateISO));
  return persona === "lector"
    ? audience === "women"
      ? LECTOR_BANK_WOMEN
      : LECTOR_BANK
    : audience === "women"
      ? BANK_WOMEN[persona as keyof typeof BANK_WOMEN]
      : BANK[persona as keyof typeof BANK];
}

interface PieceRequest {
  dateISO: string;
  audience: NarratorAudience;
  index: number;
  text: string;
  token: string;
}

/**
 * A piece fetch must be one of the plan's own entries coming home: a real
 * date, one of the two tracks, a sane index, text under a hard cap (plan
 * pieces are ≤200 chars by construction; the cap here only refuses abuse),
 * and the token the entry carried. Anything else is not a piece fetch.
 */
function validatePieceRequest(raw: unknown): PieceRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return null;
  if (p.audience !== "men" && p.audience !== "women") return null;
  if (typeof p.index !== "number" || !Number.isInteger(p.index) || p.index < 0 || p.index >= 500) {
    return null;
  }
  if (typeof p.text !== "string" || p.text.length > 1000) return null;
  if (typeof p.token !== "string") return null;
  return { dateISO: p.date, audience: p.audience, index: p.index, text: p.text, token: p.token };
}

/**
 * Renders ONE plan piece: the token is verified first (it is the whole
 * authorization — no build quota is consumed, no bundle is read), then the
 * piece goes through the identical production the in-function render used:
 * lexicon, the day narrator's voice, decode, tempo stretch, the same MP3
 * encoding — with the engine's seam guards around the speech (see the
 * finishPiecePcm call below), because the client byte-concatenates these
 * pieces into one stream. The silence piece (empty text) is the produced silence itself,
 * encoded the same way. Logs are stage codes and timings only, as everywhere
 * in this function — the piece's words never reach a log.
 */
async function handlePieceRequest(raw: unknown): Promise<Response> {
  const piece = validatePieceRequest(raw);
  if (!piece) {
    return jsonResponse({ ok: false, error: "That audio piece could not be read." }, 400);
  }
  const secret = Deno.env.get("AUDIO_RENDER_KEY") ?? "";
  const authorized =
    secret.length > 0 &&
    (await verifyPieceToken(secret, piece.dateISO, piece.audience, piece.index, piece.text, piece.token));
  if (!authorized) {
    return jsonResponse({ ok: false, error: "That audio piece is not authorized." }, 403);
  }

  const started = Date.now();
  let ttsMs = 0;
  let stretchMs = 0;
  try {
    let mp3: Uint8Array;
    let seconds: number;
    if (piece.text === "") {
      mp3 = encodeMp3(silenceSamples(AUDIO_SILENCE_SECONDS));
      seconds = AUDIO_SILENCE_SECONDS;
    } else {
      const narratorProfile = narratorProfileFor(piece.dateISO, piece.audience);
      const speechStart = Date.now();
      const bytes = await renderSpeech(applyLexicon(piece.text), narratorProfile.voice);
      ttsMs = Date.now() - speechStart;
      const stretchStart = Date.now();
      // Decode → tempo stretch → the seam guards, as one seam: the
      // client's byte concatenation joins these pieces exactly as the
      // daily finalize joins its own, so a spoken piece here wears the
      // same silence pads (finishPiecePcm, audioEngine.ts) — the
      // encoder's padding and a cold call's clipped edges land in
      // silence, never in a syllable. The reported seconds are the
      // padded piece's, which is the file the client seeks through.
      // The produced-silence piece above needs no guard: it is silence.
      const pcm = finishPiecePcm(decodeSpeechAudio(bytes), narratorProfile.tempo);
      stretchMs = Date.now() - stretchStart;
      seconds = secondsOf(pcm);
      mp3 = encodeMp3(pcm);
    }
    console.log(
      `tailor-devotional piece: date=${piece.dateISO} audience=${piece.audience} piece=${piece.index} chars=${piece.text.length} tts=${ttsMs}ms stretch=${stretchMs}ms total=${Date.now() - started}ms`,
    );
    return jsonResponse({
      ok: true,
      audioBase64: bytesToBase64(mp3),
      seconds: Math.round(seconds * 10) / 10,
    });
  } catch (err) {
    // Stage codes only, as in the build path: TTS and engine errors are
    // fixed phrases or HTTP statuses by construction, never piece text.
    console.error(
      `tailor-devotional piece failed: date=${piece.dateISO} audience=${piece.audience} piece=${piece.index} error=${
        err instanceof Error ? err.message : "error"
      }`,
    );
    return jsonResponse({ ok: false, error: "That audio piece could not be read just now." }, 200);
  }
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

  // The piece mode: a device fetching one signed plan piece. The token is
  // the authorization — the build quota below is for builds, and a piece
  // fetch is not one — so this branch stands ahead of the intake and quota.
  if (payload.piece !== undefined) {
    return handlePieceRequest(payload.piece);
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
      scoreMedia: scoreMediaLive,
      generateBridge: generateBridgeText,
      corpusQuote,
      // The grown media library rides into the pool (outputs.ts reads it;
      // the core merges it beside the seed). Read failure is a seed-only
      // morning — the loader and the core both degrade silently.
      loadWinners: () => loadMediaWinners(),
      hour: losAngelesHour(),
    });

    // With TAILOR_AUDIO_ENABLED false, the render block below is out of the
    // execution path (kept whole as the reference production) and the build
    // returns the text package with audioBase64 null, plus the audio PLAN
    // further down — the client-orchestrated route that replaced it. The
    // client's audio field is optional; a null renders the package whole.
    let audioBase64: string | null = null;
    let audioSeconds = 0;
    if (TAILOR_AUDIO_ENABLED) {
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
      // NOTE (round 3): piece-work lowered the PEAK but not the SUM — the
      // pieces still render inside this one invocation, ~6 s of CPU against
      // the platform's 2 s ceiling. That is why the flag above is off.
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

      audioBase64 = bytesToBase64(concatMp3(pieces));
      audioSeconds = Math.round(totalSeconds * 10) / 10;
    }

    // TAILOR AUDIO PLAN (the live route): sign the assembled script's pieces
    // for the device to fetch one call at a time through the piece mode. No
    // render key configured → no plan, and the package is the text-only one.
    // A plan failure must never cost the finished text: it is caught, logged
    // as a stage, and the build answers without a plan.
    let audioPlan: TailorAudioPlanEntry[] | null = null;
    if (!TAILOR_AUDIO_ENABLED && TAILOR_AUDIO_PLAN_ENABLED) {
      const renderKey = Deno.env.get("AUDIO_RENDER_KEY") ?? "";
      if (renderKey) {
        audioPlan = await buildAudioPlan(renderKey, dateISO, audience, composed.script).catch(
          (err) => {
            console.error(
              `tailor-devotional plan failed: date=${dateISO} audience=${audience} error=${
                err instanceof Error ? err.message : "error"
              }`,
            );
            return null;
          },
        );
      }
    }

    console.log(
      `tailor-devotional: date=${dateISO} audience=${audience} persona=${composed.script.persona} seconds=${audioSeconds} audio=${
        audioBase64 ? "present" : audioPlan ? `plan-${audioPlan.length}` : "absent"
      } media-pool=${composed.mediaStats.pool} media-verified=${composed.mediaStats.verified} media-spread=${
        composed.mediaStats.spread ?? "none"
      }`,
    );
    const responseBody = buildResponseBody(dateISO, composed, audioBase64, audioSeconds, audioPlan);
    // THE OUTPUT RECORD (Nov 13, 2026): with the response shaped, the
    // finished package is recorded by outputs.ts — the devotional for
    // quality review, and the winner too when the live hunt took the
    // card. Fired under the runtime's background hook and fully
    // fail-open: recordComposedOutput never rejects, and the response
    // above is byte-identical whether the record lands, fails, or hangs.
    const recording = recordComposedOutput(dateISO, audience, composed);
    if (typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(recording);
    } else {
      void recording;
    }
    return jsonResponse(responseBody);
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
