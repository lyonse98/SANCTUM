/*
  Audio render for Sanctum's daily Gospel narration.

  Called by pg_cron twice a morning (08:20 UTC, retry 10:00 UTC) and on Sundays in
  retention mode — never by the client. It assembles the day's script with
  ./narratorCore.ts (GENERATED from src/lib/narratorCore.ts by scripts/sync-narrator-core.mjs
  — do not edit the copy), renders the speech with Gemini TTS, assembles the audio in
  the sample domain (./audioEngine.ts — WSOLA tempo, the exact 2.0 s produced silence),
  encodes MP3, uploads the three segment files, and writes the `daily_audio` row the
  Gospel card reads.

  Piece-work (Nov 13, 2026): the render used to do all of that in ONE invocation,
  and the free-tier worker killed it mid-flight (WORKER_RESOURCE_LIMIT) before it
  could record anything. Now each invocation renders at most one piece — one
  TTS call, one decode/stretch, one encode — persists it, and chains to itself
  (an authenticated `step` call, see ./renderPlan.ts) for the next piece. The
  heads are single pieces (proven size); the main track is cut at paragraph
  boundaries into ≤200-character chunks (parts/main-000.mp3, main-001.mp3, …)
  — the third round (Nov 13, 2026) sized the chunks to the platform's real
  budget, 2 s of CPU per request on every plan: ~15 s of speech per piece is
  the proven head envelope, where the second round's ~55 s pieces died — and
  finalize joins the chunks as encoded bytes with the produced
  silence between the A and B groups, exactly where it always sat. Storage
  is the progress ledger: a crashed or killed invocation leaves its finished
  pieces behind, and any later call resumes from exactly there. The schedule's
  plain { date, audience } call still drives the whole chain; the row, the file
  paths, and the client-visible lifecycle are unchanged.

  Seam round (Nov 13, 2026, fourth): the byte joins between independently
  encoded pieces were corrupting speech — each encode's delay/padding lands
  mid-stream at a join, and a cold TTS call can clip its edge phonemes, so
  pieces now carry produced-silence pads into their encodes (see
  audioEngine.ts, finishPiecePcm), and finalize restores the pause-map
  beats a chunk boundary consumed as produced silence at that seam (see
  renderPlan.ts, mainJoinPlan) — the monolith's beats rode inside its
  single TTS calls and the cut had been dropping them at boundaries.

  There is NO fallback voice (Erik, Nov 2, 2026): if rendering fails, the row ends
  `failed` and the card shows one plain line that audio is unavailable today. A day
  with no row shows nothing.

  Request shapes (spec §8.1):
  - { "date": "YYYY-MM-DD" }                       the schedule's call (date optional)
  - { "date": …, "dryRun": true }                  assemble + return the script JSON;
                                                   no speech, no uploads, no row writes
  - { "date": …, "force": true } + x-render-key    re-render a day; the header must match
                                                   the AUDIO_RENDER_KEY secret, else
                                                   `force` is ignored
  - { "date": …, "step": true } + x-render-key     the render's own chained continuation
                                                   (piece-work, Nov 13, 2026): renders the
                                                   next unfinished piece and chains onward.
                                                   Without the key it is just a normal call.
  - { "audition": true, "text", "voiceName",       hear one short passage in a candidate
      "model", "tempo" } + x-render-key            voice recipe (./audition.ts, Nov 13,
                                                   2026): a pure render returned as base64 —
                                                   no uploads, no row writes. Without the
                                                   key the flag is inert, like `step`.
  - { "retention": true }                          delete segment files older than 90
                                                   days; rows are kept, marked expired

  Every shape also accepts "audience": "men" | "women" (Nov 11, 2026 — the women's
  company). Absent means "men", exactly the pre-parity behavior, so the original
  schedules keep their meaning; the women's schedules pass "women" explicitly.
  Rows are keyed (date, audience), files live under <date>/<audience>/, and a
  track's render reads only its own reflection row — the tracks never cross.

  verify_jwt is false, like the other no-auth functions: the schedule calls with the
  public anon key, and every table/bucket write here goes through the service role.

  Logs are counts and stage codes only — never script text, never payloads.
*/

import { Mp3Encoder } from "npm:@breezystack/lamejs@1.2.7";
import {
  BANK,
  BANK_WOMEN,
  LECTOR_BANK,
  LECTOR_BANK_WOMEN,
  addDaysISO,
  applyLexicon,
  assembleScript,
  audioSegmentPath,
  resolveFeastDay,
  weekdayPersona,
  weekdayOfISO,
  type NarratorAudience,
  type NarratorId,
} from "./narratorCore.ts";
import {
  SAMPLE_RATE,
  decodeSpeechAudio,
  finishPiecePcm,
  secondsOf,
  silenceSamples,
} from "./audioEngine.ts";
import {
  bytesToBase64,
  isAuditionRequest,
  parseAuditionRequest,
  renderAudition,
} from "./audition.ts";
import {
  finalFilePaths,
  isMainPiece,
  mainJoinPlan,
  mainPieceId,
  mp3SecondsFromBytes,
  pieceStoragePath,
  planNext,
  splitMainScript,
  type PieceSpec,
} from "./renderPlan.ts";

// The edge runtime's background-task hook: a chained step call is dispatched
// with fetch and registered here so the isolate stays alive until the request
// has actually been handed to the next invocation.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Render-Key",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const TTS_MODEL = "gemini-3.8-flash-tts";
const BUCKET = "daily-audio";
// Hard cap on fresh starts per date (spec §8.2, adapted): a fresh start
// costs one bundle fetch plus at most one short TTS call before the first
// piece exists, so 6 buys a day room for a morning worker kill, a retry
// kill, and several manual kicks — the old 3 let dead kicks alone exhaust a
// day (women's 2026-11-13). Recorded failures still stop earlier, at
// RETRY_ATTEMPTS, and a zero-piece `rendering` fossil is never capped at
// all (see renderPlan.ts).
const MAX_ATTEMPTS = 6;
const RETRY_ATTEMPTS = 2; // a failed day at this many attempts is done (spec §8.2.9)
const RENDERING_STALE_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 90;

type Stage = "bundle" | "tts" | "assemble" | "encode" | "upload";

class StageError extends Error {
  constructor(
    readonly stage: Stage,
    message: string,
  ) {
    super(message);
  }
}

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

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Service-role REST helpers ─────────────────────────────────────────────────

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function supabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") ?? "";
}

async function restSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function upsertRow(
  table: string,
  row: Record<string, unknown>,
  onConflict = "date,audience",
): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: serviceHeaders({ Prefer: "return=minimal,resolution=merge-duplicates" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`upsert ${table} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

async function patchRows(table: string, query: string, patch: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: serviceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

// ── The day's inputs (spec §8.2 step 4) ───────────────────────────────────────

interface ReflectionRow {
  reflect: string;
  challenge: string;
  facet: string;
  scene: string | null;
  /** The spoken bridge + carry (Nov 14, 2026) — null on every pre-bridge row. */
  spokenBridge: string | null;
  spokenCarry: string | null;
}

interface Bundle {
  reflection: ReflectionRow;
  celebration: string | null;
  gospelCitation: string;
  gospelText: string;
  tomorrowCelebration: string | null;
  tomorrowGospelCitation: string | null;
}

async function callFunction(path: string, init: RequestInit): Promise<boolean> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  try {
    const res = await fetch(`${supabaseUrl()}/functions/v1/${path}`, {
      ...init,
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(60000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function readReflection(dateISO: string, audience: NarratorAudience): Promise<ReflectionRow | null> {
  // The audience filter pins the track's own row: the table holds one row per
  // (date, audience), and each company reads only its own track's reflection.
  // An absent row returns null and the caller skips the render gracefully —
  // no row, no play bar, and never the other track's words.
  const filter = `date=eq.${dateISO}&audience=eq.${audience}`;
  let rows = await restSelect(
    "daily_reflections",
    `${filter}&select=reflect,challenge,facet,scene,spoken_bridge,spoken_carry`,
  );
  if (rows.length === 0) {
    // Deploy-order guard (Nov 14, 2026): if the spoken-bridge migration has
    // not landed yet, the select above errors on the unknown columns and
    // reads as an absent row — which would silence the day entirely. Fall
    // back to the pre-bridge select; the day renders without a bridge,
    // exactly as it did before the bridge existed.
    rows = await restSelect("daily_reflections", `${filter}&select=reflect,challenge,facet,scene`);
  }
  const row = rows[0];
  if (!row || typeof row.reflect !== "string" || typeof row.challenge !== "string") return null;
  return {
    reflect: row.reflect,
    challenge: row.challenge,
    facet: typeof row.facet === "string" ? row.facet : audience === "women" ? "As a woman" : "As a man",
    scene: typeof row.scene === "string" && row.scene.trim() ? row.scene : null,
    spokenBridge: typeof row.spoken_bridge === "string" && row.spoken_bridge.trim() ? row.spoken_bridge : null,
    spokenCarry: typeof row.spoken_carry === "string" && row.spoken_carry.trim() ? row.spoken_carry : null,
  };
}

async function readReadings(dateISO: string): Promise<{ celebration: string | null; gospelCitation: string; gospelText: string } | null> {
  const rows = await restSelect("daily_readings", `date=eq.${dateISO}&select=payload`);
  const payload = rows[0]?.payload as
    | { citations?: { celebration?: unknown; gospel?: unknown }; texts?: { gospel?: { text?: unknown } } }
    | undefined;
  const gospelText = payload?.texts?.gospel?.text;
  const gospelCitation = payload?.citations?.gospel;
  if (typeof gospelText !== "string" || !gospelText.trim()) return null;
  if (typeof gospelCitation !== "string" || !gospelCitation.trim()) return null;
  return {
    celebration: typeof payload?.citations?.celebration === "string" ? payload.citations.celebration : null,
    gospelCitation,
    gospelText,
  };
}

/** Tomorrow's celebration + Gospel citation from the lectionary API, for the teaser. */
async function fetchTomorrowCitations(dateISO: string): Promise<{ celebration: string | null; gospel: string | null }> {
  const tomorrow = addDaysISO(dateISO, 1);
  const year = tomorrow.slice(0, 4);
  const md = tomorrow.slice(5);
  const base = "https://cpbjr.github.io/catholic-readings-api";
  try {
    const [readingsRes, calendarRes] = await Promise.all([
      fetch(`${base}/readings/${year}/${md}.json`, { signal: AbortSignal.timeout(12000) }),
      fetch(`${base}/liturgical-calendar/${year}/${md}.json`, { signal: AbortSignal.timeout(12000) }),
    ]);
    const readings = readingsRes.ok ? await readingsRes.json() : null;
    const calendar = calendarRes.ok ? await calendarRes.json() : null;
    return {
      celebration: typeof calendar?.celebration?.name === "string" ? calendar.celebration.name : null,
      gospel: typeof readings?.readings?.gospel === "string" ? readings.readings.gospel : null,
    };
  } catch {
    return { celebration: null, gospel: null };
  }
}

async function ensureBundle(dateISO: string, audience: NarratorAudience): Promise<Bundle> {
  let reflection = await readReflection(dateISO, audience);
  if (!reflection) {
    // The reflection function is a cache-first generator: calling it creates the
    // row — for the requested audience, so her bundle is generated as hers.
    await callFunction("daily-reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateISO, audience }),
    });
    reflection = await readReflection(dateISO, audience);
  }

  let readings = await readReadings(dateISO);
  if (!readings) {
    await callFunction(`daily-readings?date=${dateISO}`, { method: "GET" });
    readings = await readReadings(dateISO);
  }

  if (!reflection || !readings) {
    throw new StageError("bundle", `bundle incomplete for ${dateISO}`);
  }

  const tomorrow = await fetchTomorrowCitations(dateISO);
  return {
    reflection,
    celebration: readings.celebration,
    gospelCitation: readings.gospelCitation,
    gospelText: readings.gospelText,
    tomorrowCelebration: tomorrow.celebration,
    tomorrowGospelCitation: tomorrow.gospel,
  };
}

// ── Speech (spec §8.3) ────────────────────────────────────────────────────────

async function renderSpeech(text: string, voice: string, model: string = TTS_MODEL): Promise<Uint8Array> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new StageError("tts", "GEMINI_API_KEY not configured");
  // Exactly the samples' request shape. No Referer header (production uses Sanctum's
  // own key — §12.1), and no style prompt: a spoken instruction risks being read aloud.
  // `model` defaults to the production TTS_MODEL; only the audition path names
  // another (from its closed allow-list, see ./audition.ts).
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
  if (!res.ok) throw new StageError("tts", `TTS HTTP ${res.status}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  const part = Array.isArray(parts) ? parts.find((p) => p?.inlineData || p?.inline_data) : null;
  const data = part?.inlineData ?? part?.inline_data;
  if (!data?.data || typeof data.data !== "string") {
    throw new StageError("tts", "TTS response carried no audio");
  }
  return base64ToBytes(data.data);
}

// ── Encode + upload ───────────────────────────────────────────────────────────

/** MP3, 24 kHz mono CBR 64 kbps (spec §3.3), via the pure-JS encoder (§12.3 spike). */
function encodeMp3(samples: Int16Array): Uint8Array<ArrayBuffer> {
  try {
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
  } catch (err) {
    throw new StageError("encode", err instanceof Error ? err.message : "encode failed");
  }
}

async function uploadMp3(path: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "audio/mpeg",
      "cache-control": "3600",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) throw new StageError("upload", `upload ${path} HTTP ${res.status}`);
}

async function downloadMp3(path: string): Promise<Uint8Array> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new StageError("upload", `download ${path} HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ── Retention (spec §4.3) ─────────────────────────────────────────────────────

async function storageList(prefix: string): Promise<{ name: string; id: string | null }[]> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) return [];
  const entries = await res.json();
  return Array.isArray(entries) ? entries : [];
}

async function storageDelete(paths: string[]): Promise<void> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });
}

/**
 * Every file under a storage prefix, recursively. Folder entries carry no id;
 * file entries do. Files live at <date>/<audience>/<segment>.mp3, with the
 * piece-work staging halves one level deeper again under parts/ — the walk
 * follows folders as far as they go so no layout strands files past the sweep.
 */
async function collectFiles(prefix: string, depth = 4): Promise<string[]> {
  const entries = await storageList(prefix);
  const paths: string[] = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      paths.push(path);
    } else if (depth > 0) {
      paths.push(...(await collectFiles(path, depth - 1)));
    }
  }
  return paths;
}

async function runRetention(): Promise<{ deleted: number; expired: number }> {
  const cutoff = addDaysISO(losAngelesToday(), -RETENTION_DAYS);
  const root = await storageList("");
  const oldFolders = root
    .map((e) => e.name)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < cutoff);

  let deleted = 0;
  for (const folder of oldFolders) {
    const paths = await collectFiles(folder);
    if (paths.length > 0) {
      await storageDelete(paths);
      deleted += paths.length;
    }
  }

  const expired = await patchRows(
    "daily_audio",
    `date=lt.${cutoff}&status=eq.ready`,
    {
      status: "expired",
      head_am_path: null,
      head_pm_path: null,
      main_path: null,
      updated_at: new Date().toISOString(),
    },
  );
  console.log(`audio-render retention: deleted=${deleted} expired=${expired}`);
  return { deleted, expired };
}

// ── The render run (spec §8.2) ────────────────────────────────────────────────

/**
 * Persona for a failure record written before assembly could run (bundle stage).
 * Mirrors §6.1 — weekday narrator, Lector on a solemnity. The true persona is set
 * by assembly before any audio exists; this only labels a day that never rendered.
 */
function fallbackPersona(dateISO: string, audience: NarratorAudience): NarratorId {
  const feast = resolveFeastDay(dateISO);
  if (feast?.rank === "solemnity") return "lector";
  return weekdayPersona(audience, weekdayOfISO(dateISO));
}

interface AudioRow {
  status?: string;
  attempts?: number;
  persona?: string;
  updated_at?: string;
  head_am_seconds?: number | string | null;
  head_pm_seconds?: number | string | null;
}

/** Which pieces already exist in storage — the render's progress ledger. */
async function listPieceInventory(
  dateISO: string,
  audience: NarratorAudience,
): Promise<Set<string>> {
  const done = new Set<string>();
  const finals = await storageList(`${dateISO}/${audience}`);
  for (const entry of finals) {
    if (!entry.id) continue;
    if (entry.name === "head-am.mp3") done.add("head-am");
    if (entry.name === "head-pm.mp3") done.add("head-pm");
  }
  const parts = await storageList(`${dateISO}/${audience}/parts`);
  for (const entry of parts) {
    if (!entry.id) continue;
    const m = entry.name.match(/^(main-\d{3})\.mp3$/);
    if (m) done.add(m[1]);
  }
  return done;
}

/** Byte size of a stored object, via its parent listing's metadata (0 if absent). */
async function storageObjectBytes(path: string): Promise<number> {
  const slash = path.lastIndexOf("/");
  const entries = (await storageList(path.slice(0, slash))) as {
    name: string;
    id: string | null;
    metadata?: { size?: number } | null;
  }[];
  const entry = entries.find((e) => e.name === path.slice(slash + 1));
  return typeof entry?.metadata?.size === "number" ? entry.metadata.size : 0;
}

/**
 * Hand the day to the next invocation: a step call back into this function,
 * carrying the render key so the planner knows it is the render's own
 * continuation (external callers still meet the in-flight gate). Dispatched
 * with fetch and held open by the runtime's waitUntil — this isolate has
 * already sent its response; the promise only proves the handoff landed.
 */
function chainNextStep(dateISO: string, audience: NarratorAudience): void {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const renderKey = Deno.env.get("AUDIO_RENDER_KEY") ?? "";
  const handedOff = fetch(`${supabaseUrl()}/functions/v1/audio-render`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(renderKey ? { "x-render-key": renderKey } : {}),
    },
    body: JSON.stringify({ date: dateISO, audience, step: true }),
  })
    .then((res) => res.text())
    .catch(() => {
      // A lost handoff is not a lost day: the finished pieces are in storage
      // and the next schedule call (or the retry) resumes from them.
      console.error(`audio-render chain: handoff unconfirmed date=${dateISO} audience=${audience}`);
    });
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(handedOff);
  }
}

function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function numericOrNull(value: number | string | null | undefined): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

async function runRender(
  dateISO: string,
  audience: NarratorAudience,
  force: boolean,
  dryRun: boolean,
  viaStep: boolean,
): Promise<Response> {
  const rows = await restSelect(
    "daily_audio",
    `date=eq.${dateISO}&audience=eq.${audience}&select=status,attempts,persona,updated_at,head_am_seconds,head_pm_seconds`,
  );
  const row = (rows[0] ?? null) as AudioRow | null;
  const attempts = typeof row?.attempts === "number" ? row.attempts : 0;
  const updatedAtMs =
    typeof row?.updated_at === "string" ? Date.parse(row.updated_at) : null;

  // The two gates that need nothing but the row run before any bundle work,
  // exactly as the monolith had them: a ready day must never be failed over
  // by an upstream hiccup, and a live render is left alone. The planner
  // re-checks both below — these early returns only keep the failure writer
  // honest.
  if (!dryRun) {
    if (row?.status === "ready" && !force) {
      return jsonResponse({ ok: true, skipped: "ready" });
    }
    if (
      !viaStep &&
      row?.status === "rendering" &&
      updatedAtMs !== null &&
      Date.now() - updatedAtMs < RENDERING_STALE_MS
    ) {
      return jsonResponse({ ok: true, skipped: "in-flight" });
    }
  }

  let persona: NarratorId = row?.persona && typeof row.persona === "string"
    ? (row.persona as NarratorId)
    : fallbackPersona(dateISO, audience);
  // What the failure record should carry if this invocation dies. A failure
  // before the plan (bundle/assembly) consumes an attempt, as the monolith's
  // did (§8.2.9 counts runs); once the plan is known, only a fresh-start
  // claim consumes one — resumes are free (see renderPlan.ts).
  let failureAttempts = attempts + 1;

  try {
    const bundle = await ensureBundle(dateISO, audience);

    const sceneOff = Deno.env.get("AUDIO_SCENE") === "off";
    let assembled: ReturnType<typeof assembleScript>;
    try {
      assembled = assembleScript({
        dateISO,
        audience,
        celebration: bundle.celebration,
        gospelCitation: bundle.gospelCitation,
        gospelText: bundle.gospelText,
        reflect: bundle.reflection.reflect,
        challenge: bundle.reflection.challenge,
        facet: bundle.reflection.facet,
        scene: sceneOff ? null : bundle.reflection.scene,
        spokenBridge: bundle.reflection.spokenBridge,
        spokenCarry: bundle.reflection.spokenCarry,
        tomorrowCelebration: bundle.tomorrowCelebration,
        tomorrowGospelCitation: bundle.tomorrowGospelCitation,
      });
    } catch (err) {
      throw new StageError("assemble", err instanceof Error ? err.message : "assembly failed");
    }
    persona = assembled.persona;

    if (dryRun) {
      // The piece report is additive diagnostics: the day's cut, on the
      // canonical texts (the render itself cuts the lexicon-applied texts,
      // whose lengths differ only by the lexicon's respellings).
      const report = splitMainScript(assembled.mainA, assembled.mainB);
      const reportChars = new Map<string, number>([
        ["head-am", assembled.headAM.length],
        ["head-pm", assembled.headPM.length],
      ]);
      report.aChunks.forEach((t, i) => reportChars.set(mainPieceId(i), t.length));
      report.bChunks.forEach((t, j) =>
        reportChars.set(mainPieceId(report.aChunks.length + j), t.length),
      );
      return jsonResponse({
        ok: true,
        dryRun: true,
        date: dateISO,
        audience,
        persona: assembled.persona,
        lector: assembled.lector,
        sober: assembled.sober,
        teaserIncluded: assembled.teaserIncluded,
        sceneIncluded: assembled.sceneIncluded,
        bridgeIncluded: assembled.bridgeIncluded,
        carryIncluded: assembled.carryIncluded,
        selections: assembled.selections,
        headAM: assembled.headAM,
        headPM: assembled.headPM,
        mainA: assembled.mainA,
        mainB: assembled.mainB,
        script: assembled.script,
        pieceCount: report.specs.length,
        pieces: report.specs.map((s) => ({
          id: s.id,
          kind: s.kind,
          group: s.group,
          chars: reportChars.get(s.id) ?? 0,
        })),
      });
    }

    // A force re-render starts from a clean slate: wipe every piece file so
    // no fragment of the previous render can be mistaken for fresh progress.
    // The staged chunks are wiped by listing parts/ — their count is the
    // script's, not a constant.
    if (force) {
      const partEntries = await storageList(`${dateISO}/${audience}/parts`);
      const partPaths = partEntries
        .filter((e) => e.id)
        .map((e) => `${dateISO}/${audience}/parts/${e.name}`);
      await storageDelete([...finalFilePaths(dateISO, audience), ...partPaths]);
    }

    // The day's cut, on the speech payloads themselves: the lexicon
    // transforms the payloads only (the stored script stays canonical, and
    // the hash at finalize is of the canonical text, §8.2 step 6), so the
    // split — and with it the piece list every chained invocation rebuilds —
    // is taken over exactly the texts that will be spoken.
    const split = splitMainScript(
      applyLexicon(assembled.mainA),
      applyLexicon(assembled.mainB),
    );
    const specById = new Map<string, PieceSpec>(split.specs.map((s) => [s.id, s]));
    const textById = new Map<string, string>([
      ["head-am", applyLexicon(assembled.headAM)],
      ["head-pm", applyLexicon(assembled.headPM)],
    ]);
    split.aChunks.forEach((t, i) => textById.set(mainPieceId(i), t));
    split.bChunks.forEach((t, j) => textById.set(mainPieceId(split.aChunks.length + j), t));

    const piecesDone = await listPieceInventory(dateISO, audience);
    const action = planNext({
      status: row?.status ?? null,
      attempts,
      updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : null,
      nowMs: Date.now(),
      staleMs: RENDERING_STALE_MS,
      force,
      viaStep,
      lector: assembled.lector,
      pieces: split.specs,
      piecesDone,
      maxAttempts: MAX_ATTEMPTS,
      retryAttempts: RETRY_ATTEMPTS,
    });

    if (action.kind === "skip") {
      return jsonResponse({ ok: true, skipped: action.reason });
    }

    failureAttempts = attempts + (action.kind === "render" && action.claimAttempt ? 1 : 0);
    const attempt = failureAttempts;

    // Claim / heartbeat before any speech spend (§8.2 step 3): the row shows
    // `rendering` with the true persona and a fresh timestamp from the first
    // piece onward, so a concurrent external call stands down and a killed
    // invocation leaves a stale — resumable — claim rather than a mystery.
    await upsertRow("daily_audio", {
      date: dateISO,
      audience,
      persona,
      status: "rendering",
      attempts: attempt,
      updated_at: new Date().toISOString(),
    });

    const headAmPath = audioSegmentPath(dateISO, audience, "head-am");
    const headPmPath = audioSegmentPath(dateISO, audience, "head-pm");
    const mainPath = audioSegmentPath(dateISO, audience, "main");

    if (action.kind === "finalize") {
      // Join main from its encoded chunks. Every chunk comes out of the
      // same encoder at the same settings (24 kHz mono CBR 64 kbps, spec
      // §3.3), and lamejs writes bare frames — no Xing/ID3 header to strand
      // mid-file — so the joined bytes are one ordinary MP3 stream to any
      // player: the A group's chunks, then the produced silence encoded on
      // its own, then the B group's. The order and the 2.0 s A/B gap are
      // the monolith's; two deliberate additions ride along (fourth round):
      // every chunk's samples already wear their seam-guard pads (applied
      // at render, see finishPiecePcm), and the join restores each
      // pause-map beat the cut consumed as produced silence at its seam
      // (mainJoinPlan over split.boundaryBeats). Only the peak memory moved
      // — from a whole track of PCM to one file of MP3 bytes.
      const byteParts: Uint8Array[] = [];
      for (const part of mainJoinPlan(split.specs, split.boundaryBeats)) {
        if (part.kind === "silence") {
          byteParts.push(encodeMp3(silenceSamples(part.seconds)));
        } else {
          const spec = specById.get(part.id);
          if (!spec) throw new StageError("assemble", `join references unknown piece ${part.id}`);
          byteParts.push(await downloadMp3(pieceStoragePath(dateISO, audience, spec)));
        }
      }
      const mainMp3 = concatBytes(...byteParts);
      await uploadMp3(mainPath, mainMp3);
      await storageDelete(
        split.specs
          .filter((s) => isMainPiece(s))
          .map((s) => pieceStoragePath(dateISO, audience, s)),
      );

      // Durations: the heads' were recorded from their PCM as each rendered;
      // fall back to the CBR byte count if a value never landed. The main
      // track's PCM exists nowhere anymore, so its duration is the joined
      // file's byte-derived length — within a frame of the true value.
      const headAmSeconds =
        numericOrNull(row?.head_am_seconds) ??
        mp3SecondsFromBytes(await storageObjectBytes(headAmPath));
      const headPmSeconds =
        numericOrNull(row?.head_pm_seconds) ??
        mp3SecondsFromBytes(await storageObjectBytes(headPmPath));
      const mainSeconds = mp3SecondsFromBytes(mainMp3.length);

      const scriptHash = await sha256Hex(assembled.script);
      await upsertRow("daily_audio", {
        date: dateISO,
        audience,
        persona,
        status: "ready",
        head_am_path: headAmPath,
        head_pm_path: headPmPath,
        main_path: mainPath,
        head_am_seconds: headAmSeconds,
        head_pm_seconds: headPmSeconds,
        main_seconds: mainSeconds,
        script: assembled.script,
        script_hash: scriptHash,
        scene: assembled.sceneIncluded ? bundle.reflection.scene : null,
        sober: assembled.sober,
        teaser_included: assembled.teaserIncluded,
        attempts: attempt,
        last_error: null,
        rendered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const seconds = Math.round((headAmSeconds + headPmSeconds + mainSeconds) * 10) / 10;
      console.log(`audio-render: date=${dateISO} audience=${audience} persona=${persona} seconds=${seconds} attempts=${attempt}`);
      return jsonResponse({ ok: true, audience, persona, seconds });
    }

    // ── One piece per invocation ──────────────────────────────────────────
    if (action.mode === "copy") {
      // Lector days speak one head for both dayparts: head-pm is head-am's
      // bytes at the PM address, and carries its duration.
      const bytes = await downloadMp3(headAmPath);
      await uploadMp3(headPmPath, bytes);
      await patchRows("daily_audio", `date=eq.${dateISO}&audience=eq.${audience}`, {
        head_pm_seconds: numericOrNull(row?.head_am_seconds) ?? mp3SecondsFromBytes(bytes.length),
        updated_at: new Date().toISOString(),
      });
    } else {
      const profile =
        persona === "lector"
          ? audience === "women"
            ? LECTOR_BANK_WOMEN
            : LECTOR_BANK
          : audience === "women"
            ? BANK_WOMEN[persona as keyof typeof BANK_WOMEN]
            : BANK[persona as keyof typeof BANK];

      // The piece's speech payload, from the lexicon-applied cut built
      // before the plan (the stored script stays canonical; the hash at
      // finalize is of the canonical text, §8.2 step 6).
      const payload = textById.get(action.piece.id);
      if (payload === undefined) {
        throw new StageError("assemble", `no speech payload for piece ${action.piece.id}`);
      }

      // Speech → samples → tempo → seam guards (§8.4; pads, fourth round).
      // renderSpeech's StageError (tts) propagates; decode/stretch failures
      // are assembly-stage. Each stage is timed (round 3): the platform's
      // binding limit is 2 s of CPU per request, so a future failure should
      // arrive with its measurements attached instead of another round of
      // guessing. The `pcm` that flows on from here — to the encoder and,
      // for a head, to the row's duration — is the PADDED samples: the pads
      // are real samples in the file, and the client's seek offsets are
      // computed from these durations.
      let pcm: Int16Array;
      let ttsMs = 0;
      let stretchMs = 0;
      try {
        const ttsStart = performance.now();
        const bytes = await renderSpeech(payload, profile.voice);
        ttsMs = Math.round(performance.now() - ttsStart);
        const stretchStart = performance.now();
        pcm = finishPiecePcm(decodeSpeechAudio(bytes), profile.tempo);
        stretchMs = Math.round(performance.now() - stretchStart);
      } catch (err) {
        if (err instanceof StageError) throw err;
        throw new StageError("assemble", err instanceof Error ? err.message : "assembly failed");
      }

      const encodeStart = performance.now();
      const mp3 = encodeMp3(pcm);
      const encodeMs = Math.round(performance.now() - encodeStart);
      const uploadStart = performance.now();
      await uploadMp3(pieceStoragePath(dateISO, audience, action.piece), mp3);
      const uploadMs = Math.round(performance.now() - uploadStart);
      console.log(
        `audio-render timing: date=${dateISO} audience=${audience} piece=${action.piece.id} chars=${payload.length} tts=${ttsMs}ms stretch=${stretchMs}ms encode=${encodeMs}ms upload=${uploadMs}ms`,
      );

      // A head's duration is recorded from its PCM — the padded samples, so
      // the row prices exactly the file the client will seek through;
      // main's chunks are priced at finalize from their bytes.
      if (!isMainPiece(action.piece)) {
        await patchRows("daily_audio", `date=eq.${dateISO}&audience=eq.${audience}`, {
          [`${action.piece.id.replace("-", "_")}_seconds`]: Math.round(secondsOf(pcm) * 10) / 10,
          updated_at: new Date().toISOString(),
        });
      }
    }

    console.log(`audio-render piece: date=${dateISO} audience=${audience} persona=${persona} piece=${action.piece.id} attempts=${attempt}`);
    chainNextStep(dateISO, audience);
    return jsonResponse({ ok: true, piece: action.piece.id, chained: true });
  } catch (err) {
    const stage: Stage | "error" = err instanceof StageError ? err.stage : "error";
    console.error(`audio-render failed: date=${dateISO} audience=${audience} stage=${stage}`);
    if (!dryRun) {
      try {
        await upsertRow("daily_audio", {
          date: dateISO,
          audience,
          persona,
          status: "failed",
          attempts: failureAttempts,
          last_error: stage,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // The failure record is best-effort; the response below still reports the stage.
      }
    }
    // HTTP 200 by design (§8.2.9): the schedule must not hammer a failed day.
    return jsonResponse({ ok: false, stage });
  }
}

// ── Audition (Nov 13, 2026) ───────────────────────────────────────────────────

/**
 * One short passage rendered one way, for Erik's ear (see ./audition.ts): the
 * production engine — lexicon, TTS, decode, MP3 at production settings — with
 * the caller's model, voice, and tempo, where tempo 1.0 bypasses the stretch
 * entirely so the current recipe and its challengers differ in exactly the
 * knobs under test. Nothing is uploaded and no daily_audio row moves.
 * Validation failures answer 400; a stage failure answers 200 with the stage
 * code, as every shape in this function does (§8.2.9). Metadata only in logs.
 */
async function runAudition(payload: Record<string, unknown>): Promise<Response> {
  const parsed = parseAuditionRequest(payload, TTS_MODEL);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, 400);
  }
  const { model, voiceName, tempo } = parsed.request;
  try {
    const { mp3, seconds } = await renderAudition(parsed.request, {
      speak: (text, voice, namedModel) => renderSpeech(text, voice, namedModel),
      encode: encodeMp3,
    });
    console.log(`audio-render audition: model=${model} voice=${voiceName} tempo=${tempo} seconds=${seconds}`);
    return jsonResponse({ ok: true, audioBase64: bytesToBase64(mp3), seconds });
  } catch (err) {
    const stage: Stage | "error" = err instanceof StageError ? err.stage : "error";
    console.error(`audio-render audition failed: model=${model} voice=${voiceName} tempo=${tempo} stage=${stage}`);
    return jsonResponse({ ok: false, stage });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (payload.retention === true) {
      const { deleted, expired } = await runRetention();
      return jsonResponse({ ok: true, deleted, expired });
    }

    const dateISO =
      typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
        ? payload.date
        : losAngelesToday();

    // Absent audience = the men's track, exactly the pre-parity meaning of every
    // existing schedule and force call. The women's schedules pass "women".
    const audience: NarratorAudience = payload.audience === "women" ? "women" : "men";

    const renderKey = Deno.env.get("AUDIO_RENDER_KEY");
    const keyMatches =
      typeof renderKey === "string" &&
      renderKey.length > 0 &&
      req.headers.get("x-render-key") === renderKey;
    const force = payload.force === true && keyMatches;

    // A step call is the render chaining to itself for the next piece; it is
    // honored as a continuation only with the render key. Without the key the
    // flag is inert — the call is simply a normal (gate-respecting) call.
    const viaStep = payload.step === true && keyMatches;

    // Audition mode (Nov 13, 2026): hear one passage in a candidate voice
    // recipe before it ships. Key-guarded exactly like force/step — without
    // the key the flag is inert and the call follows the normal paths below.
    if (isAuditionRequest(payload, keyMatches)) {
      return await runAudition(payload);
    }

    return await runRender(dateISO, audience, force, payload.dryRun === true, viaStep);
  } catch (err) {
    console.error("audio-render failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ ok: false, stage: "error" });
  }
});
