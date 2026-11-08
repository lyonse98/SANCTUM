import { describe, expect, it } from "vitest";
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
  type ArtifactPart,
  type CorpusChunk,
  type CorpusManifest,
} from "./plan";

const doc = (id: string, chunk_count: number) => ({
  id,
  title: `Title ${id}`,
  author: "Author",
  year: 1900,
  source_name: "Source",
  source_url: "https://example.org/",
  license_tier: "A",
  authority_tier: 4,
  language: "en",
  shelf_tags: [],
  companion_shelves: [],
  version: 1,
  ingest_status: "staged",
  chunk_count,
  content_hash: `hash-${id}`,
});

const manifestJson = () => ({
  version: 1,
  part_size: 2,
  total_chunks: 5,
  works: [
    {
      id: "alpha",
      phase: 0,
      document: doc("alpha", 3),
      chunk_count: 3,
      parts: [
        { file: "alpha.part-001.jsonl", chunks: 2, first_ordinal: 0, bytes: 100 },
        { file: "alpha.part-002.jsonl", chunks: 1, first_ordinal: 2, bytes: 50 },
      ],
    },
    {
      id: "beta",
      phase: 1,
      document: doc("beta", 2),
      chunk_count: 2,
      parts: [{ file: "beta.part-001.jsonl", chunks: 2, first_ordinal: 0, bytes: 80 }],
    },
  ],
});

const manifest = (): CorpusManifest => parseManifest(manifestJson());

const chunkLine = (documentId: string, ordinal: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    document_id: documentId,
    ordinal,
    locator: `loc ${ordinal}`,
    citation_label: `LBL ${ordinal}`,
    text: `text ${ordinal}`,
    char_count: 8,
    content_hash: `h-${documentId}-${ordinal}`,
    authority_tier: 4,
    shelf_tags: [],
    companion_shelves: [],
    ...extra,
  });

describe("authorize (the key gate)", () => {
  it("is unconfigured when the secret is unset — the door stays shut", () => {
    expect(authorize("anything", undefined)).toBe("unconfigured");
    expect(authorize("anything", "")).toBe("unconfigured");
  });
  it("rejects a missing or wrong header", () => {
    expect(authorize(null, "sekret")).toBe("unauthorized");
    expect(authorize("wrong", "sekret")).toBe("unauthorized");
  });
  it("accepts the exact key", () => {
    expect(authorize("sekret", "sekret")).toBe("ok");
  });
});

describe("parseIngestRequest", () => {
  it("accepts status", () => {
    expect(parseIngestRequest({ action: "status" })).toEqual({ ok: true, action: "status" });
  });
  it("accepts load with and without a work", () => {
    expect(parseIngestRequest({ action: "load" })).toEqual({ ok: true, action: "load" });
    expect(parseIngestRequest({ action: "load", work: "ccc" })).toEqual({ ok: true, action: "load", work: "ccc" });
    expect(parseIngestRequest({ action: "load", work: " ccc " })).toEqual({ ok: true, action: "load", work: "ccc" });
  });
  it("rejects non-objects, unknown actions, and malformed work", () => {
    expect(parseIngestRequest(null).ok).toBe(false);
    expect(parseIngestRequest("load").ok).toBe(false);
    expect(parseIngestRequest([{ action: "load" }]).ok).toBe(false);
    expect(parseIngestRequest({}).ok).toBe(false);
    expect(parseIngestRequest({ action: "load-all" }).ok).toBe(false);
    expect(parseIngestRequest({ action: "load", work: 7 }).ok).toBe(false);
    expect(parseIngestRequest({ action: "load", work: "  " }).ok).toBe(false);
  });
});

describe("parseManifest", () => {
  it("parses a valid manifest", () => {
    const m = manifest();
    expect(m.works.map((w) => w.id)).toEqual(["alpha", "beta"]);
    expect(m.total_chunks).toBe(5);
    expect(m.works[0].parts).toHaveLength(2);
    expect(m.works[0].document.title).toBe("Title alpha");
  });
  it("rejects a manifest whose parts do not cover the work", () => {
    const bad = manifestJson();
    bad.works[0].parts[1].chunks = 5;
    expect(() => parseManifest(bad)).toThrow(/cover/);
  });
  it("rejects a part that does not start where the previous ended", () => {
    const bad = manifestJson();
    bad.works[0].parts[1].first_ordinal = 7;
    expect(() => parseManifest(bad)).toThrow(/starts at ordinal/);
  });
  it("rejects a document record whose id disagrees with the work", () => {
    const bad = manifestJson();
    (bad.works[0].document as Record<string, unknown>).id = "gamma";
    expect(() => parseManifest(bad)).toThrow(/document\.id/);
  });
  it("rejects empty works and missing provenance", () => {
    expect(() => parseManifest({ works: [] })).toThrow(/no works/);
    const bad = manifestJson();
    (bad.works[0].document as Record<string, unknown>).source_url = "";
    expect(() => parseManifest(bad)).toThrow(/source_url/);
  });
});

describe("parseChunksJsonl (artifact parsing)", () => {
  const part: ArtifactPart = { file: "alpha.part-002.jsonl", chunks: 2, first_ordinal: 2, bytes: 10 };

  it("parses a contiguous part", () => {
    const chunks = parseChunksJsonl([chunkLine("alpha", 2), chunkLine("alpha", 3)].join("\n") + "\n", part, "alpha");
    expect(chunks).toHaveLength(2);
    expect(chunks[0].ordinal).toBe(2);
    expect(chunks[1].citation_label).toBe("LBL 3");
  });
  it("rejects the wrong line count", () => {
    expect(() => parseChunksJsonl(chunkLine("alpha", 2), part, "alpha")).toThrow(/lines, expected 2/);
  });
  it("rejects another document's chunks", () => {
    const text = [chunkLine("beta", 2), chunkLine("beta", 3)].join("\n");
    expect(() => parseChunksJsonl(text, part, "alpha")).toThrow(/belongs to beta/);
  });
  it("rejects an ordinal gap", () => {
    const text = [chunkLine("alpha", 2), chunkLine("alpha", 4)].join("\n");
    expect(() => parseChunksJsonl(text, part, "alpha")).toThrow(/ordinal 4, expected 3/);
  });
  it("rejects invalid JSON and empty text", () => {
    const text = [chunkLine("alpha", 2), "{nope"].join("\n");
    expect(() => parseChunksJsonl(text, part, "alpha")).toThrow(/not valid JSON/);
    const blank = [chunkLine("alpha", 2), chunkLine("alpha", 3, { text: "" })].join("\n");
    expect(() => parseChunksJsonl(blank, part, "alpha")).toThrow(/field text/);
  });
});

describe("resolveTargetWork (per-work planning)", () => {
  it("starts at the first work when nothing is loaded", () => {
    const r = resolveTargetWork(manifest(), new Map());
    expect(r.kind).toBe("work");
    if (r.kind === "work") expect(r.work.id).toBe("alpha");
  });
  it("skips live works and takes the next unfinished one", () => {
    const r = resolveTargetWork(manifest(), new Map([["alpha", "live"]]));
    expect(r.kind).toBe("work");
    if (r.kind === "work") expect(r.work.id).toBe("beta");
  });
  it("treats staged/embedded as unfinished", () => {
    const r = resolveTargetWork(manifest(), new Map([["alpha", "staged"], ["beta", "embedded"]]));
    expect(r.kind).toBe("work");
    if (r.kind === "work") expect(r.work.id).toBe("alpha");
  });
  it("is done when every work is live", () => {
    const statuses = new Map([["alpha", "live"], ["beta", "live"]]);
    expect(resolveTargetWork(manifest(), statuses)).toEqual({ kind: "done" });
    expect(allLive(manifest(), statuses)).toBe(true);
    expect(allLive(manifest(), new Map([["alpha", "live"]]))).toBe(false);
  });
  it("honours an explicit work, even a live one (the refresh path)", () => {
    const r = resolveTargetWork(manifest(), new Map([["alpha", "live"], ["beta", "live"]]), "alpha");
    expect(r.kind).toBe("work");
    if (r.kind === "work") expect(r.work.id).toBe("alpha");
  });
  it("rejects an unknown work name", () => {
    const r = resolveTargetWork(manifest(), new Map(), "nope");
    expect(r.kind).toBe("error");
  });
});

describe("partsToLoad (resume planning)", () => {
  it("loads everything when nothing is present", () => {
    expect(partsToLoad(manifest().works[0], [0, 0])).toEqual([0, 1]);
  });
  it("skips parts already fully present", () => {
    expect(partsToLoad(manifest().works[0], [2, 0])).toEqual([1]);
    expect(partsToLoad(manifest().works[0], [2, 1])).toEqual([]);
  });
  it("reloads a partially present part (its upserts are idempotent)", () => {
    expect(partsToLoad(manifest().works[0], [1, 1])).toEqual([0]);
  });
  it("treats missing counts as zero", () => {
    expect(partsToLoad(manifest().works[0], [])).toEqual([0, 1]);
  });
});

describe("corpusVersionFor", () => {
  it("matches the local loader's stamp format", () => {
    expect(corpusVersionFor(21901, "2026-11-17")).toBe("ingest-2026-11-17-21901chunks");
  });
});

describe("toDbChunkRow (embedding integrity)", () => {
  const chunk: CorpusChunk = {
    document_id: "alpha",
    ordinal: 0,
    locator: "loc",
    citation_label: "LBL",
    text: "text",
    char_count: 4,
    content_hash: "h",
    authority_tier: 4,
    shelf_tags: [],
    companion_shelves: [],
  };
  it("builds a row with the pgvector literal", () => {
    const vec = Array.from({ length: 768 }, (_, i) => i / 768);
    const row = toDbChunkRow(chunk, vec, 1);
    expect(row.doc_version).toBe(1);
    expect(row.embedding).toMatch(/^\[0(,|\])/);
    expect((row.embedding as string).split(",")).toHaveLength(768);
  });
  it("refuses a missing, short, or non-finite embedding — no chunk is ever written without a real one", () => {
    expect(() => toDbChunkRow(chunk, [], 1)).toThrow(/768 finite numbers/);
    expect(() => toDbChunkRow(chunk, Array.from({ length: 767 }, () => 0.1), 1)).toThrow(/768 finite numbers/);
    const withNaN = Array.from({ length: 768 }, () => 0.1);
    withNaN[10] = Number.NaN;
    expect(() => toDbChunkRow(chunk, withNaN, 1)).toThrow(/768 finite numbers/);
  });
});
