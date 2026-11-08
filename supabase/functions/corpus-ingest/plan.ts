/*
  Pure planning logic for corpus-ingest — no Deno globals, no fetch, so vitest
  can pin every rule the live function follows (house pattern: rerank.ts in
  corpus-retrieve). index.ts is wiring only: gate, fetch, embed, upsert.

  The artifacts this plans over are committed at corpus-artifacts/ in the repo
  (built by scripts/corpus/make-artifacts.mjs from the validated chunk output):
  a manifest naming each work, its full registry record, and its part files
  (PART_SIZE chunks each, ordinal order).
*/

export const EMBED_DIMS = 768;

export interface CorpusDocumentRecord {
  id: string;
  title: string;
  author: string;
  year: number | null;
  source_name: string;
  source_url: string;
  license_tier: string;
  authority_tier: number;
  language: string;
  shelf_tags: string[];
  companion_shelves: string[];
  version: number;
  ingest_status: string;
  chunk_count: number;
  content_hash: string;
}

export interface ArtifactPart {
  file: string;
  chunks: number;
  first_ordinal: number;
  bytes: number;
}

export interface ManifestWork {
  id: string;
  phase: number;
  document: CorpusDocumentRecord;
  chunk_count: number;
  parts: ArtifactPart[];
}

export interface CorpusManifest {
  version: number;
  part_size: number;
  total_chunks: number;
  works: ManifestWork[];
}

export interface CorpusChunk {
  document_id: string;
  ordinal: number;
  locator: string;
  citation_label: string;
  text: string;
  char_count: number;
  content_hash: string;
  authority_tier: number;
  shelf_tags: string[];
  companion_shelves: string[];
}

// ── The key gate (mirrors corpus-retrieve: x-corpus-key vs CORPUS_RETRIEVE_KEY)

export type GateResult = "ok" | "unconfigured" | "unauthorized";

export function authorize(headerValue: string | null, expectedKey: string | undefined): GateResult {
  if (!expectedKey) return "unconfigured";
  return headerValue === expectedKey ? "ok" : "unauthorized";
}

// ── Request validation ────────────────────────────────────────────────────────

export type IngestRequest =
  | { ok: true; action: "status" }
  | { ok: true; action: "load"; work?: string }
  | { ok: false; error: string };

export function parseIngestRequest(body: unknown): IngestRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const action = (body as Record<string, unknown>).action;
  if (action === "status") return { ok: true, action: "status" };
  if (action === "load") {
    const work = (body as Record<string, unknown>).work;
    if (work === undefined) return { ok: true, action: "load" };
    if (typeof work !== "string" || work.trim() === "") {
      return { ok: false, error: "`work` must be a non-empty string when given." };
    }
    return { ok: true, action: "load", work: work.trim() };
  }
  return { ok: false, error: "`action` must be \"status\" or \"load\"." };
}

// ── Artifact parsing ──────────────────────────────────────────────────────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

function parseDocumentRecord(v: unknown, workId: string): CorpusDocumentRecord {
  if (typeof v !== "object" || v === null) throw new Error(`manifest: work ${workId} has no document record`);
  const d = v as Record<string, unknown>;
  for (const field of ["id", "title", "source_name", "source_url", "license_tier", "content_hash"]) {
    if (typeof d[field] !== "string" || (d[field] as string) === "") {
      throw new Error(`manifest: work ${workId} document.${field} must be a non-empty string`);
    }
  }
  if (d.id !== workId) throw new Error(`manifest: work ${workId} document.id is ${String(d.id)}`);
  if (typeof d.authority_tier !== "number" || typeof d.version !== "number" || typeof d.chunk_count !== "number") {
    throw new Error(`manifest: work ${workId} document tiers/version/chunk_count must be numbers`);
  }
  if (!isStringArray(d.shelf_tags) || !isStringArray(d.companion_shelves)) {
    throw new Error(`manifest: work ${workId} document shelves must be string arrays`);
  }
  return {
    id: d.id as string,
    title: d.title as string,
    author: typeof d.author === "string" ? d.author : "",
    year: typeof d.year === "number" ? d.year : null,
    source_name: d.source_name as string,
    source_url: d.source_url as string,
    license_tier: d.license_tier as string,
    authority_tier: d.authority_tier as number,
    language: typeof d.language === "string" ? d.language : "en",
    shelf_tags: d.shelf_tags,
    companion_shelves: d.companion_shelves,
    version: d.version as number,
    ingest_status: typeof d.ingest_status === "string" ? d.ingest_status : "staged",
    chunk_count: d.chunk_count as number,
    content_hash: d.content_hash as string,
  };
}

export function parseManifest(json: unknown): CorpusManifest {
  if (typeof json !== "object" || json === null) throw new Error("manifest is not an object");
  const m = json as Record<string, unknown>;
  if (!Array.isArray(m.works) || m.works.length === 0) throw new Error("manifest has no works");
  const works: ManifestWork[] = m.works.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) throw new Error(`manifest works[${i}] is not an object`);
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== "string" || w.id === "") throw new Error(`manifest works[${i}] has no id`);
    const document = parseDocumentRecord(w.document, w.id);
    if (document.chunk_count !== w.chunk_count) {
      throw new Error(`manifest: work ${w.id} chunk_count disagrees with its document record`);
    }
    if (!Array.isArray(w.parts) || w.parts.length === 0) throw new Error(`manifest: work ${w.id} has no parts`);
    let ordinal = 0;
    const parts: ArtifactPart[] = w.parts.map((praw, j) => {
      if (typeof praw !== "object" || praw === null) throw new Error(`manifest: work ${w.id} parts[${j}] is not an object`);
      const p = praw as Record<string, unknown>;
      if (typeof p.file !== "string" || typeof p.chunks !== "number" || typeof p.first_ordinal !== "number" || typeof p.bytes !== "number") {
        throw new Error(`manifest: work ${w.id} parts[${j}] is malformed`);
      }
      if (p.first_ordinal !== ordinal) {
        throw new Error(`manifest: work ${w.id} parts[${j}] starts at ordinal ${p.first_ordinal}, expected ${ordinal}`);
      }
      ordinal += p.chunks;
      return { file: p.file, chunks: p.chunks, first_ordinal: p.first_ordinal, bytes: p.bytes };
    });
    if (ordinal !== w.chunk_count) {
      throw new Error(`manifest: work ${w.id} parts cover ${ordinal} chunks, expected ${w.chunk_count}`);
    }
    return {
      id: w.id,
      phase: typeof w.phase === "number" ? w.phase : 0,
      document,
      chunk_count: w.chunk_count as number,
      parts,
    };
  });
  return {
    version: typeof m.version === "number" ? m.version : 0,
    part_size: typeof m.part_size === "number" ? m.part_size : 0,
    total_chunks: typeof m.total_chunks === "number" ? m.total_chunks : works.reduce((n, w) => n + w.chunk_count, 0),
    works,
  };
}

/**
 * Parse one part file. Every line must be a chunk of the expected document,
 * and ordinals must run contiguously from the part's first ordinal — the
 * loader's resume math (per-part ordinal ranges in the database) is only
 * sound if both hold, so a corrupt artifact fails loudly here, before any
 * embedding spend.
 */
export function parseChunksJsonl(text: string, part: ArtifactPart, documentId: string): CorpusChunk[] {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length !== part.chunks) {
    throw new Error(`artifact ${part.file}: ${lines.length} lines, expected ${part.chunks}`);
  }
  return lines.map((line, i) => {
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      throw new Error(`artifact ${part.file}: line ${i + 1} is not valid JSON`);
    }
    if (row.document_id !== documentId) {
      throw new Error(`artifact ${part.file}: line ${i + 1} belongs to ${String(row.document_id)}, expected ${documentId}`);
    }
    if (row.ordinal !== part.first_ordinal + i) {
      throw new Error(`artifact ${part.file}: line ${i + 1} has ordinal ${String(row.ordinal)}, expected ${part.first_ordinal + i}`);
    }
    for (const field of ["locator", "citation_label", "text", "content_hash"]) {
      if (typeof row[field] !== "string" || (row[field] as string) === "") {
        throw new Error(`artifact ${part.file}: line ${i + 1} field ${field} must be a non-empty string`);
      }
    }
    if (typeof row.char_count !== "number" || typeof row.authority_tier !== "number") {
      throw new Error(`artifact ${part.file}: line ${i + 1} char_count/authority_tier must be numbers`);
    }
    if (!isStringArray(row.shelf_tags) || !isStringArray(row.companion_shelves)) {
      throw new Error(`artifact ${part.file}: line ${i + 1} shelves must be string arrays`);
    }
    return {
      document_id: documentId,
      ordinal: row.ordinal as number,
      locator: row.locator as string,
      citation_label: row.citation_label as string,
      text: row.text as string,
      char_count: row.char_count as number,
      content_hash: row.content_hash as string,
      authority_tier: row.authority_tier as number,
      shelf_tags: row.shelf_tags,
      companion_shelves: row.companion_shelves,
    };
  });
}

// ── Planning ──────────────────────────────────────────────────────────────────

/** ingest_status by document id, as read from corpus_documents (absent = not present). */
export type StatusById = ReadonlyMap<string, string>;

export type TargetResolution =
  | { kind: "work"; work: ManifestWork }
  | { kind: "done" }
  | { kind: "error"; error: string };

/**
 * Which work a load invocation takes: an explicitly named work always (a
 * re-load is the refresh path), otherwise the first work in manifest order
 * that is not yet live. When every work is live, the load is done.
 */
export function resolveTargetWork(manifest: CorpusManifest, statusById: StatusById, requested?: string): TargetResolution {
  if (requested !== undefined) {
    const work = manifest.works.find((w) => w.id === requested);
    if (!work) return { kind: "error", error: `Unknown work: ${requested}` };
    return { kind: "work", work };
  }
  const next = manifest.works.find((w) => statusById.get(w.id) !== "live");
  return next ? { kind: "work", work: next } : { kind: "done" };
}

/** Indexes of parts whose database count is short of the artifact count. */
export function partsToLoad(work: ManifestWork, presentByPart: readonly number[]): number[] {
  const out: number[] = [];
  work.parts.forEach((part, i) => {
    if ((presentByPart[i] ?? 0) < part.chunks) out.push(i);
  });
  return out;
}

export function allLive(manifest: CorpusManifest, statusById: StatusById): boolean {
  return manifest.works.every((w) => statusById.get(w.id) === "live");
}

/** The corpus_version stamp — the local loader's format (ingest.mjs), kept so
 *  both load paths name a shelf state the same way. */
export function corpusVersionFor(totalChunks: number, dateISO: string): string {
  return `ingest-${dateISO}-${totalChunks}chunks`;
}

// ── Database rows ─────────────────────────────────────────────────────────────

/**
 * A chunk row for corpus_chunks. The embedding integrity rule lives here: a
 * row cannot be built without a real vector of exactly EMBED_DIMS numbers —
 * there is no code path that writes a chunk with a missing or placeholder
 * embedding (the local loader's stub-refusal rule, carried over).
 */
export function toDbChunkRow(chunk: CorpusChunk, embedding: readonly number[], docVersion: number): Record<string, unknown> {
  if (!Array.isArray(embedding) || embedding.length !== EMBED_DIMS || embedding.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error(`chunk ${chunk.document_id}#${chunk.ordinal}: embedding must be ${EMBED_DIMS} finite numbers`);
  }
  return {
    document_id: chunk.document_id,
    ordinal: chunk.ordinal,
    doc_version: docVersion,
    locator: chunk.locator,
    citation_label: chunk.citation_label,
    text: chunk.text,
    char_count: chunk.char_count,
    content_hash: chunk.content_hash,
    authority_tier: chunk.authority_tier,
    shelf_tags: chunk.shelf_tags,
    companion_shelves: chunk.companion_shelves,
    embedding: `[${embedding.join(",")}]`,
  };
}
