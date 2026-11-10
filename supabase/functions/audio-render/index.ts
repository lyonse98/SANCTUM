/*
  Audio render for Sanctum's daily Gospel narration.

  Called by pg_cron twice a morning (08:20 UTC, retry 10:00 UTC) and on Sundays in
  retention mode — never by the client. It assembles the day's script with
  ./narratorCore.ts (GENERATED from src/lib/narratorCore.ts by scripts/sync-narrator-core.mjs
  — do not edit the copy), renders the speech with Gemini TTS, assembles the audio in
  the sample domain (./audioEngine.ts — WSOLA tempo, the exact 2.0 s produced silence),
  encodes MP3, uploads the three segment files, and writes the `daily_audio` row the
  Gospel card reads.

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
  - { "retention": true }                          delete segment files older than 90
                                                   days; rows are kept, marked expired

  verify_jwt is false, like the other no-auth functions: the schedule calls with the
  public anon key, and every table/bucket write here goes through the service role.

  Logs are counts and stage codes only — never script text, never payloads.
*/

import { Mp3Encoder } from "npm:@breezystack/lamejs@1.2.7";
import {
  AUDIO_SILENCE_SECONDS,
  BANK,
  LECTOR_BANK,
  addDaysISO,
  applyLexicon,
  assembleScript,
  resolveFeastDay,
  weekdayOfISO,
  type NarratorId,
} from "./narratorCore.ts";
import {
  SAMPLE_RATE,
  concatPcm,
  decodeSpeechAudio,
  secondsOf,
  silenceSamples,
  stretchPcm,
} from "./audioEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Render-Key",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const TTS_MODEL = "gemini-3.8-flash-tts";
const BUCKET = "daily-audio";
const MAX_ATTEMPTS = 3; // hard cap on renders per date (spec §8.2)
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

async function upsertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${table}?on_conflict=date`, {
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

async function readReflection(dateISO: string): Promise<ReflectionRow | null> {
  const rows = await restSelect(
    "daily_reflections",
    // audience=eq.men pins the men's row: since the Women's Mode re-key the table
    // holds one row per (date, audience), and the narrator reads the men's reflection.
    `date=eq.${dateISO}&audience=eq.men&select=reflect,challenge,facet,scene`,
  );
  const row = rows[0];
  if (!row || typeof row.reflect !== "string" || typeof row.challenge !== "string") return null;
  return {
    reflect: row.reflect,
    challenge: row.challenge,
    facet: typeof row.facet === "string" ? row.facet : "As a man",
    scene: typeof row.scene === "string" && row.scene.trim() ? row.scene : null,
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

async function ensureBundle(dateISO: string): Promise<Bundle> {
  let reflection = await readReflection(dateISO);
  if (!reflection) {
    // The reflection function is a cache-first generator: calling it creates the row.
    await callFunction("daily-reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateISO }),
    });
    reflection = await readReflection(dateISO);
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

async function renderSpeech(text: string, voice: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new StageError("tts", "GEMINI_API_KEY not configured");
  // Exactly the samples' request shape. No Referer header (production uses Sanctum's
  // own key — §12.1), and no style prompt: a spoken instruction risks being read aloud.
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

async function runRetention(): Promise<{ deleted: number; expired: number }> {
  const cutoff = addDaysISO(losAngelesToday(), -RETENTION_DAYS);
  const root = await storageList("");
  const oldFolders = root
    .map((e) => e.name)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < cutoff);

  let deleted = 0;
  for (const folder of oldFolders) {
    const objects = await storageList(folder);
    const paths = objects.filter((o) => o.id).map((o) => `${folder}/${o.name}`);
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
 * Mirrors §6.1 — weekday brother, Lector on a solemnity. The true persona is set by
 * assembly before any audio exists; this only labels a day that never rendered.
 */
function fallbackPersona(dateISO: string): NarratorId {
  const feast = resolveFeastDay(dateISO);
  if (feast?.rank === "solemnity") return "lector";
  const byWeekday: NarratorId[] = ["henry", "coach", "frank", "ben", "martin", "tom", "ed"];
  return byWeekday[weekdayOfISO(dateISO)];
}

interface AudioRow {
  status?: string;
  attempts?: number;
  persona?: string;
  updated_at?: string;
}

async function runRender(dateISO: string, force: boolean, dryRun: boolean): Promise<Response> {
  const rows = await restSelect("daily_audio", `date=eq.${dateISO}&select=status,attempts,persona,updated_at`);
  const row = (rows[0] ?? null) as AudioRow | null;
  const attempts = typeof row?.attempts === "number" ? row.attempts : 0;

  if (!dryRun) {
    if (row?.status === "ready" && !force) {
      return jsonResponse({ ok: true, skipped: "ready" });
    }
    if (
      row?.status === "rendering" &&
      typeof row.updated_at === "string" &&
      Date.now() - Date.parse(row.updated_at) < RENDERING_STALE_MS
    ) {
      return jsonResponse({ ok: true, skipped: "in-flight" });
    }
    if (!force && row?.status === "failed" && attempts >= RETRY_ATTEMPTS) {
      return jsonResponse({ ok: true, skipped: "attempts" });
    }
    if (!force && attempts >= MAX_ATTEMPTS) {
      return jsonResponse({ ok: true, skipped: "attempts" });
    }
  }

  let persona: NarratorId = row?.persona && typeof row.persona === "string"
    ? (row.persona as NarratorId)
    : fallbackPersona(dateISO);
  let attempt = attempts;
  let claimed = false;

  try {
    const bundle = await ensureBundle(dateISO);

    const sceneOff = Deno.env.get("AUDIO_SCENE") === "off";
    let assembled: ReturnType<typeof assembleScript>;
    try {
      assembled = assembleScript({
        dateISO,
        celebration: bundle.celebration,
        gospelCitation: bundle.gospelCitation,
        gospelText: bundle.gospelText,
        reflect: bundle.reflection.reflect,
        challenge: bundle.reflection.challenge,
        facet: bundle.reflection.facet,
        scene: sceneOff ? null : bundle.reflection.scene,
        tomorrowCelebration: bundle.tomorrowCelebration,
        tomorrowGospelCitation: bundle.tomorrowGospelCitation,
      });
    } catch (err) {
      throw new StageError("assemble", err instanceof Error ? err.message : "assembly failed");
    }
    persona = assembled.persona;

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dryRun: true,
        date: dateISO,
        persona: assembled.persona,
        lector: assembled.lector,
        sober: assembled.sober,
        teaserIncluded: assembled.teaserIncluded,
        sceneIncluded: assembled.sceneIncluded,
        selections: assembled.selections,
        headAM: assembled.headAM,
        headPM: assembled.headPM,
        mainA: assembled.mainA,
        mainB: assembled.mainB,
        script: assembled.script,
      });
    }

    // Claim the run before any speech spend (§8.2 step 3). Assembly above is pure and
    // cheap, so the claim already carries the true persona.
    attempt = attempts + 1;
    await upsertRow("daily_audio", {
      date: dateISO,
      persona,
      status: "rendering",
      attempts: attempt,
      updated_at: new Date().toISOString(),
    });
    claimed = true;

    const profile = persona === "lector" ? LECTOR_BANK : BANK[persona as keyof typeof BANK];

    // The lexicon transforms the speech payloads only — the stored script stays
    // canonical, and the hash below is of the canonical text (§8.2 step 6).
    const payloadHeadAM = applyLexicon(assembled.headAM);
    const payloadHeadPM = applyLexicon(assembled.headPM);
    const payloadMainA = applyLexicon(assembled.mainA);
    const payloadMainB = applyLexicon(assembled.mainB);

    // Speech → samples → tempo (§8.4). renderSpeech's StageError (tts) propagates;
    // decode/stretch failures are assembly-stage.
    const toPcm = async (text: string): Promise<Int16Array> => {
      const bytes = await renderSpeech(text, profile.voice);
      try {
        return stretchPcm(decodeSpeechAudio(bytes), profile.tempo);
      } catch (err) {
        if (err instanceof StageError) throw err;
        throw new StageError("assemble", err instanceof Error ? err.message : "assembly failed");
      }
    };

    // Sequential on purpose: a failed call is never retried inside a run —
    // the retry schedule is the retry (§8.3). Lector days render one head for both.
    const headAmPcm = await toPcm(payloadHeadAM);
    const headPmPcm = assembled.lector ? headAmPcm : await toPcm(payloadHeadPM);
    const mainAPcm = await toPcm(payloadMainA);
    const mainBPcm = await toPcm(payloadMainB);
    const mainPcm = concatPcm(mainAPcm, silenceSamples(AUDIO_SILENCE_SECONDS), mainBPcm);

    const headAmMp3 = encodeMp3(headAmPcm);
    const headPmMp3 = assembled.lector ? headAmMp3 : encodeMp3(headPmPcm);
    const mainMp3 = encodeMp3(mainPcm);

    const headAmPath = `${dateISO}/head-am.mp3`;
    const headPmPath = `${dateISO}/head-pm.mp3`;
    const mainPath = `${dateISO}/main.mp3`;
    await uploadMp3(headAmPath, headAmMp3);
    await uploadMp3(headPmPath, headPmMp3);
    await uploadMp3(mainPath, mainMp3);

    const scriptHash = await sha256Hex(assembled.script);
    await upsertRow("daily_audio", {
      date: dateISO,
      persona,
      status: "ready",
      head_am_path: headAmPath,
      head_pm_path: headPmPath,
      main_path: mainPath,
      head_am_seconds: Math.round(secondsOf(headAmPcm) * 10) / 10,
      head_pm_seconds: Math.round(secondsOf(headPmPcm) * 10) / 10,
      main_seconds: Math.round(secondsOf(mainPcm) * 10) / 10,
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

    const seconds = Math.round((secondsOf(headAmPcm) + secondsOf(headPmPcm) + secondsOf(mainPcm)) * 10) / 10;
    console.log(`audio-render: date=${dateISO} persona=${persona} seconds=${seconds} attempts=${attempt}`);
    return jsonResponse({ ok: true, persona, seconds });
  } catch (err) {
    const stage: Stage | "error" = err instanceof StageError ? err.stage : "error";
    console.error(`audio-render failed: date=${dateISO} stage=${stage}`);
    if (!dryRun) {
      try {
        await upsertRow("daily_audio", {
          date: dateISO,
          persona,
          status: "failed",
          // A run that failed before the claim still consumed its attempt — the
          // retry window's discipline (§8.2.9) counts runs, not claims.
          attempts: claimed ? attempt : attempts + 1,
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

    const renderKey = Deno.env.get("AUDIO_RENDER_KEY");
    const force =
      payload.force === true &&
      typeof renderKey === "string" &&
      renderKey.length > 0 &&
      req.headers.get("x-render-key") === renderKey;

    return await runRender(dateISO, force, payload.dryRun === true);
  } catch (err) {
    console.error("audio-render failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ ok: false, stage: "error" });
  }
});
