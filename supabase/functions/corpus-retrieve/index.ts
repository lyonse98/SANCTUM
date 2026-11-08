/*
  corpus-retrieve — the ONE door to Sanctum's citation shelf (spec §8).

  Called server-to-server by other edge functions (chat-proxy first), never by a
  phone. verify_jwt is false; the door is the CORPUS_RETRIEVE_KEY secret, checked
  against the x-corpus-key header — the same pattern as audio-render's
  AUDIO_RENDER_KEY. The public anon key cannot call this function, so the shelf
  never becomes a free public API for other people's apps.

  Job, in order: embed the query (one Gemini embedding call, Sanctum's own key) →
  search corpus_chunks by vector similarity under the caller's filters (the
  public.corpus_search SQL door) → tier-weighted rerank (./rerank.ts) → return
  chunks with their precomputed citation labels. It composes nothing and
  generates nothing; it is a librarian, not an author.

  Logs are counts only — purpose, result count, milliseconds. Query text and
  chunk content are never logged (spec §11).
*/

import { rerankChunks, type RawChunk } from "./rerank.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Corpus-Key",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;
const MAX_K = 20;
const DEFAULT_K = 8;
const MAX_QUERY_CHARS = 2000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: query }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBED_DIMS,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error("corpus-retrieve: embedding failed with status", res.status);
    throw new Error("embedding failed");
  }
  const json = await res.json();
  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    console.error("corpus-retrieve: embedding had unexpected shape");
    throw new Error("embedding shape");
  }
  return values as number[];
}

interface SearchParams {
  tiers: number[] | null;
  shelves: string[] | null;
  companion: string | null;
  onShelfOnly: boolean;
  language: string;
  limit: number;
}

async function corpusSearch(embedding: number[], p: SearchParams): Promise<RawChunk[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/corpus_search`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      q_embedding: `[${embedding.join(",")}]`,
      p_tiers: p.tiers,
      p_shelves: p.shelves,
      p_companion: p.companion,
      p_on_shelf_only: p.onShelfOnly,
      p_language: p.language,
      p_limit: p.limit,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error("corpus-retrieve: corpus_search failed with status", res.status);
    throw new Error("search failed");
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    chunk_id: Number(r.chunk_id),
    document_id: String(r.document_id),
    locator: String(r.locator),
    citation_label: String(r.citation_label),
    text: String(r.chunk_text),
    authority_tier: Number(r.authority_tier),
    license_tier: String(r.license_tier),
    shelf_tags: (r.shelf_tags as string[]) ?? [],
    companion_shelves: (r.companion_shelves as string[]) ?? [],
    similarity: Number(r.similarity),
  }));
}

async function corpusVersion(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const res = await fetch(
      `${supabaseUrl}/rest/v1/corpus_meta?key=eq.corpus_version&select=value`,
      { headers: serviceHeaders(), signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return "unknown";
    const rows = (await res.json()) as { value?: string }[];
    return rows[0]?.value ?? "unknown";
  } catch {
    return "unknown";
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
  const doorKey = Deno.env.get("CORPUS_RETRIEVE_KEY");
  if (!doorKey) {
    console.error("corpus-retrieve: CORPUS_RETRIEVE_KEY is not set");
    return jsonResponse({ error: "Corpus door is not configured." }, 503);
  }
  if (req.headers.get("x-corpus-key") !== doorKey) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const started = Date.now();
  try {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    if (payload.v !== undefined && payload.v !== 1) {
      return jsonResponse({ error: "Unsupported contract version." }, 400);
    }

    const query = typeof payload.query === "string" ? payload.query.trim().slice(0, MAX_QUERY_CHARS) : "";
    if (!query) {
      return jsonResponse({ error: "Missing query." }, 400);
    }

    const kRaw = typeof payload.k === "number" && Number.isFinite(payload.k) ? Math.floor(payload.k) : DEFAULT_K;
    const k = Math.min(MAX_K, Math.max(1, kRaw));

    const filters = (payload.filters ?? {}) as Record<string, unknown>;
    const tiersRaw = Array.isArray(filters.authority_tiers)
      ? filters.authority_tiers.filter((t): t is number => typeof t === "number" && t >= 1 && t <= 8)
      : [];
    const tiers = tiersRaw.length > 0 ? [...new Set(tiersRaw)] : null;
    const shelvesRaw = Array.isArray(filters.shelves)
      ? filters.shelves.filter((s): s is string => typeof s === "string" && s.length > 0)
      : [];
    const shelves = shelvesRaw.length > 0 ? shelvesRaw : null;
    const companion = typeof filters.companion === "string" && filters.companion ? filters.companion : null;
    const language = typeof filters.language === "string" && filters.language ? filters.language : "en";
    const purpose = typeof payload.purpose === "string" ? payload.purpose.slice(0, 40) : "unspecified";

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "Server API key not configured." }, 500);
    }

    const embedding = await embedQuery(query, apiKey);

    // Candidate pool: 4×k (§8.3). With a companion filter, the companion's own
    // shelf gets its own pool so his books are never crowded out by the general
    // shelf before the rerank can rank them (§9.2).
    const candidateLimit = 4 * k;
    let candidates: RawChunk[];
    if (companion) {
      const [onShelf, general] = await Promise.all([
        corpusSearch(embedding, { tiers, shelves, companion, onShelfOnly: true, language, limit: candidateLimit }),
        corpusSearch(embedding, { tiers, shelves, companion, onShelfOnly: false, language, limit: candidateLimit }),
      ]);
      const seen = new Set<number>();
      candidates = [];
      for (const c of [...onShelf, ...general]) {
        if (seen.has(c.chunk_id)) continue;
        seen.add(c.chunk_id);
        candidates.push(c);
      }
    } else {
      candidates = await corpusSearch(embedding, {
        tiers, shelves, companion, onShelfOnly: false, language, limit: candidateLimit,
      });
    }

    const results = rerankChunks(candidates, { k, companion });
    const version = await corpusVersion();
    const tookMs = Date.now() - started;

    // Counts-only telemetry (spec §11): no query text, no chunk content.
    console.info("corpus-retrieve", { purpose, results: results.length, took_ms: tookMs });

    return jsonResponse({
      v: 1,
      corpus_version: version,
      results: results.map((r) => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        citation_label: r.citation_label,
        locator: r.locator,
        authority_tier: r.authority_tier,
        // Extension to the §8.2 shape: the license tier rides along so a
        // consumer can honour the §9.1 display contract (A in full, B as the
        // short quoted excerpt only) without a second lookup.
        license_tier: r.license_tier,
        text: r.text,
        score: Math.round(r.score * 10000) / 10000,
        on_companion_shelf: r.on_companion_shelf,
      })),
      took_ms: tookMs,
    });
  } catch (err) {
    console.error("corpus-retrieve failed:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: "Corpus retrieval failed." }, 502);
  }
});
