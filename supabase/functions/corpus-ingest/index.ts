/*
  corpus-ingest — the server-side loader for Sanctum's citation shelf.

  WHY THIS EXISTS: the corpus was designed (Nov 8, 2026) to load from local
  scripts holding SUPABASE_SERVICE_ROLE_KEY in a .env.local. That key is
  Bolt-provisioned — it lives in Bolt's organisation, Erik never held it, and
  no copy exists on the machine the scripts run on. So the load moved to where
  both credentials already live: inside Supabase. This function runs with the
  project's own GEMINI_API_KEY secret and native service-role database access,
  and fetches the validated chunk artifacts from the public GitHub repo
  (corpus-artifacts/, built by scripts/corpus/make-artifacts.mjs). The local
  scripts remain the chunking/validation toolchain and a fallback path.

  Called ONLY by the operator (the parent agent driving the go-live), never by
  the client and never by another function. verify_jwt is false; the door is
  the CORPUS_RETRIEVE_KEY secret, checked against the x-corpus-key header —
  the same pattern as corpus-retrieve and audio-render. An unset secret keeps
  the door shut (503), like corpus-retrieve.

  Request shapes:
  - { "action": "status" }            per-work ingest state + corpus_version.
                                      No writes.
  - { "action": "load", "work"? }     load ONE work — the named one, or the
                                      next unfinished one in manifest order:
                                      fetch its part artifacts, embed every
                                      chunk (gemini-embedding-001, 768 dims,
                                      batches of 100), upsert rows, flip the
                                      document to 'live' when its full chunk
                                      count is present. When the last work
                                      lands, stamp corpus_version in
                                      corpus_meta.

  Idempotent + resumable: chunk upserts key on (document_id, ordinal); parts
  already fully present are skipped by an ordinal-range count, so a repeated
  call — after a timeout, a Gemini error, anything — resumes where the last
  one stopped. A soft time budget stops starting new parts well inside the
  platform wall-clock limit; one call always finishes at least one part.

  Embedding integrity (spec §3.3, carried over from the local loader): a chunk
  is NEVER written without a real embedding — toDbChunkRow refuses anything
  but 768 finite numbers, a part is embedded whole before any of its rows are
  upserted, and on a Gemini error the document stays NOT live and the failure
  is reported in the response.

  Logs are counts and stage codes only — never chunk text, never payloads.
*/

import {
  allLive,
  authorize,
  corpusVersionFor,
  parseChunksJsonl,
  parseIngestRequest,
  parseManifest,
  partsToLoad,
  resolveTargetWork,
  toDbChunkRow,
  type CorpusManifest,
  type ManifestWork,
} from "./plan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Corpus-Key",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const ARTIFACT_BASE = "https://raw.githubusercontent.com/lyonse98/SANCTUM/main/corpus-artifacts";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_BATCH = 100; // batchEmbedContents request cap (as in scripts/corpus/lib.mjs)
const UPSERT_PAGE = 200; // rows per PostgREST upsert (as in scripts/corpus/ingest.mjs)
const SOFT_BUDGET_MS = 100_000; // stop starting parts well inside the wall-clock limit

type Stage = "manifest" | "artifact" | "embed" | "load";

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

// ── Service-role REST helpers (house pattern, as in audio-render) ────────────

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

async function getStatuses(): Promise<Map<string, string>> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/corpus_documents?select=id,ingest_status`, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new StageError("load", `corpus_documents read failed: ${res.status}`);
  const rows = (await res.json()) as { id: string; ingest_status: string }[];
  return new Map(rows.map((r) => [r.id, r.ingest_status]));
}

async function countChunks(docId: string, fromOrdinal?: number, toOrdinal?: number): Promise<number> {
  let q = `corpus_chunks?document_id=eq.${encodeURIComponent(docId)}&select=id&limit=1`;
  if (fromOrdinal !== undefined) q += `&ordinal=gte.${fromOrdinal}`;
  if (toOrdinal !== undefined) q += `&ordinal=lt.${toOrdinal}`;
  const res = await fetch(`${supabaseUrl()}/rest/v1/${q}`, {
    headers: serviceHeaders({ Prefer: "count=exact" }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new StageError("load", `chunk count failed for ${docId}: ${res.status}`);
  const total = Number((res.headers.get("content-range") ?? "").split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

async function getCorpusVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/corpus_meta?key=eq.corpus_version&select=value`, {
      headers: serviceHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { value?: string }[];
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function upsertDocument(work: ManifestWork, status: string): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/corpus_documents?on_conflict=id`, {
    method: "POST",
    headers: serviceHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ ...work.document, ingest_status: status, ingested_at: new Date().toISOString() }]),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new StageError("load", `document upsert failed for ${work.id}: ${res.status}`);
}

async function patchDocument(docId: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/corpus_documents?id=eq.${encodeURIComponent(docId)}`, {
    method: "PATCH",
    headers: serviceHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new StageError("load", `document patch failed for ${docId}: ${res.status}`);
}

async function pruneOldVersions(docId: string, version: number): Promise<void> {
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/corpus_chunks?document_id=eq.${encodeURIComponent(docId)}&doc_version=lt.${version}`,
    { method: "DELETE", headers: serviceHeaders(), signal: AbortSignal.timeout(30000) },
  );
  if (!res.ok) throw new StageError("load", `prune failed for ${docId}: ${res.status}`);
}

async function upsertChunkRows(rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_PAGE) {
    const res = await fetch(`${supabaseUrl()}/rest/v1/corpus_chunks?on_conflict=document_id,ordinal`, {
      method: "POST",
      headers: serviceHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows.slice(i, i + UPSERT_PAGE)),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new StageError("load", `chunk upsert failed at row ${i}: ${res.status}`);
  }
}

async function stampVersion(version: string): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/corpus_meta?on_conflict=key`, {
    method: "POST",
    headers: serviceHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ key: "corpus_version", value: version, updated_at: new Date().toISOString() }]),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new StageError("load", `corpus_version stamp failed: ${res.status}`);
}

// ── Artifacts + embedding ─────────────────────────────────────────────────────

async function fetchManifest(): Promise<CorpusManifest> {
  let res: Response;
  try {
    res = await fetch(`${ARTIFACT_BASE}/manifest.json`, {
      headers: { "User-Agent": "SanctumCorpusIngest/1.0" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new StageError("manifest", `manifest fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new StageError("manifest", `manifest fetch failed: HTTP ${res.status}`);
  try {
    return parseManifest(await res.json());
  } catch (err) {
    throw new StageError("manifest", err instanceof Error ? err.message : "manifest parse failed");
  }
}

async function fetchArtifactText(file: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${ARTIFACT_BASE}/${file}`, {
      headers: { "User-Agent": "SanctumCorpusIngest/1.0" },
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw new StageError("artifact", `fetch ${file} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new StageError("artifact", `fetch ${file} failed: HTTP ${res.status}`);
  return await res.text();
}

/** Embed a whole part (batches of ≤100) before any of it is written. */
async function embedPart(apiKey: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${EMBED_MODEL}`,
              content: { parts: [{ text }] },
              taskType: "RETRIEVAL_DOCUMENT",
              outputDimensionality: 768,
            })),
          }),
          signal: AbortSignal.timeout(90000),
        },
      );
    } catch (err) {
      throw new StageError("embed", `batchEmbedContents request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) throw new StageError("embed", `batchEmbedContents failed with status ${res.status}`);
    const json = await res.json();
    const embeddings = json.embeddings as { values?: unknown }[] | undefined;
    if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
      throw new StageError("embed", "embedding count mismatch");
    }
    for (const e of embeddings) {
      if (!Array.isArray(e.values)) throw new StageError("embed", "embedding carried no values");
      out.push(e.values as number[]);
    }
  }
  return out;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function runStatus(): Promise<Response> {
  const statuses = await getStatuses();
  let manifest: CorpusManifest | null = null;
  let manifestError = false;
  try {
    manifest = await fetchManifest();
  } catch {
    manifestError = true;
  }
  const version = await getCorpusVersion();

  const works: Record<string, unknown>[] = [];
  let totalInDb = 0;
  if (manifest) {
    for (const work of manifest.works) {
      const inDb = await countChunks(work.id);
      totalInDb += inDb;
      works.push({
        id: work.id,
        present: statuses.has(work.id),
        ingest_status: statuses.get(work.id) ?? null,
        chunks_in_db: inDb,
        chunks_total: work.chunk_count,
      });
    }
  } else {
    for (const [id, status] of statuses) {
      const inDb = await countChunks(id);
      totalInDb += inDb;
      works.push({ id, present: true, ingest_status: status, chunks_in_db: inDb, chunks_total: null });
    }
  }

  return jsonResponse({
    ok: true,
    corpus_version: version,
    manifest_error: manifestError,
    works,
    total_chunks_in_db: totalInDb,
    total_chunks: manifest?.total_chunks ?? null,
  });
}

async function runLoad(requested: string | undefined, started: number): Promise<Response> {
  const manifest = await fetchManifest();
  const statuses = await getStatuses();
  const target = resolveTargetWork(manifest, statuses, requested);
  if (target.kind === "error") return jsonResponse({ ok: false, error: target.error }, 400);
  if (target.kind === "done") {
    return jsonResponse({
      ok: true,
      done: true,
      corpus_version: await getCorpusVersion(),
      ms: Date.now() - started,
    });
  }

  const work = target.work;
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new StageError("embed", "GEMINI_API_KEY not configured");

  try {
    // A refresh of a live work keeps it live throughout; a new work stays
    // 'staged' — invisible to corpus_search — until its full count is present.
    await upsertDocument(work, statuses.get(work.id) === "live" ? "live" : "staged");
    await pruneOldVersions(work.id, work.document.version);

    const present: number[] = [];
    for (const part of work.parts) {
      present.push(await countChunks(work.id, part.first_ordinal, part.first_ordinal + part.chunks));
    }

    let partsDone = 0;
    for (const idx of partsToLoad(work, present)) {
      if (partsDone > 0 && Date.now() - started > SOFT_BUDGET_MS) break;
      const part = work.parts[idx];
      const text = await fetchArtifactText(part.file);
      let chunks;
      try {
        chunks = parseChunksJsonl(text, part, work.id);
      } catch (err) {
        throw new StageError("artifact", err instanceof Error ? err.message : "artifact parse failed");
      }
      const embeddings = await embedPart(apiKey, chunks.map((c) => c.text));
      const rows = chunks.map((c, i) => toDbChunkRow(c, embeddings[i], work.document.version));
      await upsertChunkRows(rows);
      partsDone++;
    }

    const inDb = await countChunks(work.id);
    const complete = inDb === work.chunk_count;
    let version: string | null = null;
    let allComplete = false;
    if (complete) {
      await patchDocument(work.id, { ingest_status: "live", chunk_count: inDb });
      const fresh = await getStatuses();
      allComplete = allLive(manifest, fresh);
      if (allComplete) {
        const total = manifest.works.reduce((n, w) => n + w.chunk_count, 0);
        version = corpusVersionFor(total, new Date().toISOString().slice(0, 10));
        await stampVersion(version);
      }
    }

    console.info("corpus-ingest load", { work: work.id, chunks_loaded: inDb, chunks_total: work.chunk_count, complete });
    return jsonResponse({
      ok: true,
      work: work.id,
      chunks_loaded: inDb,
      chunks_total: work.chunk_count,
      complete,
      all_complete: allComplete,
      corpus_version: version ?? (await getCorpusVersion()),
      ms: Date.now() - started,
    });
  } catch (err) {
    if (err instanceof StageError) {
      // The document is left NOT live (a refresh keeps its previous liveness,
      // a new load stays staged) and the failure is reported, per the brief:
      // partial rows are safe because the next call resumes by ordinal range.
      console.error("corpus-ingest load failed:", { work: work.id, stage: err.stage });
      return jsonResponse({
        ok: false,
        work: work.id,
        stage: err.stage,
        error: err.message,
        chunks_total: work.chunk_count,
        ms: Date.now() - started,
      });
    }
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  // The key gate is the lock. An unset secret means the door stays shut.
  const gate = authorize(req.headers.get("x-corpus-key"), Deno.env.get("CORPUS_RETRIEVE_KEY"));
  if (gate === "unconfigured") {
    console.error("corpus-ingest: CORPUS_RETRIEVE_KEY is not set");
    return jsonResponse({ error: "Corpus door is not configured." }, 503);
  }
  if (gate === "unauthorized") {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const started = Date.now();
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
    }
    const request = parseIngestRequest(body);
    if (!request.ok) return jsonResponse({ ok: false, error: request.error }, 400);

    return request.action === "status" ? await runStatus() : await runLoad(request.work, started);
  } catch (err) {
    if (err instanceof StageError) {
      console.error("corpus-ingest failed:", { stage: err.stage });
      return jsonResponse({ ok: false, stage: err.stage, error: err.message, ms: Date.now() - started });
    }
    console.error("corpus-ingest failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ ok: false, stage: "error", ms: Date.now() - started }, 500);
  }
});
