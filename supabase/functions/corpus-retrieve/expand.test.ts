import { describe, expect, it } from "vitest";
import {
  expandCccNeighbors,
  isCccAnchor,
  MAX_EXPANDED_ANCHORS,
  type ExpandableChunk,
  type NeighborRow,
  type NeighborSource,
} from "./expand.ts";

/**
 * Neighbor expansion pins (fidelity polish, Nov 14, 2026). The eval misses
 * were neighbor paragraphs — 2539 beside 2540, 1030/1031 beside the landed
 * chunk — so the behavior pinned here is exact: a bare CCC anchor pulls its
 * ±1 paragraphs in directly behind it, nothing else moves, and anything
 * that is not a bare CCC paragraph label never triggers a read.
 */

function chunk(partial: Partial<ExpandableChunk> & { chunk_id: number }): ExpandableChunk {
  return {
    document_id: "ccc",
    locator: `para ${partial.chunk_id}`,
    citation_label: `CCC ${partial.chunk_id}`,
    text: `text of ${partial.chunk_id}`,
    authority_tier: 2,
    license_tier: "B",
    shelf_tags: [],
    companion_shelves: [],
    similarity: 0.7,
    score: 0.65,
    on_companion_shelf: null,
    ...partial,
  };
}

function row(partial: Partial<NeighborRow> & { chunk_id: number; ordinal: number }): NeighborRow {
  return {
    locator: `para ${partial.chunk_id}`,
    citation_label: `CCC ${partial.chunk_id}`,
    text: `text of ${partial.chunk_id}`,
    companion_shelves: [],
    ...partial,
  };
}

/** A fake document: chunk ids double as ordinals for readability. */
function fakeSource(ordinals: Map<number, number>, rows: NeighborRow[]): NeighborSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async ordinalFor(chunkId: number) {
      calls.push(`ordinal:${chunkId}`);
      return ordinals.get(chunkId) ?? null;
    },
    async rowsAt(documentId: string, wanted: number[]) {
      calls.push(`rows:${documentId}:${wanted.join(",")}`);
      return rows.filter((r) => wanted.includes(r.ordinal));
    },
  };
}

describe("isCccAnchor", () => {
  it("matches bare Catechism paragraph labels only", () => {
    expect(isCccAnchor("CCC 2277")).toBe(true);
    expect(isCccAnchor("CCC 1030")).toBe(true);
    expect(isCccAnchor("CCC 2277-2279")).toBe(false);
    expect(isCccAnchor("CCC 2277 ")).toBe(false);
    expect(isCccAnchor("Confessions I.1")).toBe(false);
    expect(isCccAnchor("ST I, q. 1, a. 8")).toBe(false);
  });
});

describe("expandCccNeighbors", () => {
  it("splices the ±1 neighbors in behind the anchor, in ordinal order", async () => {
    const anchor = chunk({ chunk_id: 2540, citation_label: "CCC 2540" });
    const other = chunk({ chunk_id: 900, citation_label: "ST I, q. 1, a. 8", document_id: "summa" });
    const source = fakeSource(new Map([[2540, 2540]]), [
      row({ chunk_id: 2541, ordinal: 2541 }),
      row({ chunk_id: 2539, ordinal: 2539 }),
    ]);
    const out = await expandCccNeighbors([anchor, other], source);
    expect(out.map((c) => c.chunk_id)).toEqual([2540, 2539, 2541, 900]);
    // The required paragraph itself is now in the set, labeled as itself.
    expect(out[1].citation_label).toBe("CCC 2539");
  });

  it("a neighbor carries the anchor's score and tier, and its own shelf truth", async () => {
    const anchor = chunk({ chunk_id: 1031, citation_label: "CCC 1031", score: 0.42, authority_tier: 2 });
    const source = fakeSource(new Map([[1031, 1031]]), [
      row({ chunk_id: 1030, ordinal: 1030, companion_shelves: ["augustine"] }),
      row({ chunk_id: 1032, ordinal: 1032 }),
    ]);
    const out = await expandCccNeighbors([anchor], source, "augustine");
    const n1030 = out.find((c) => c.chunk_id === 1030)!;
    expect(n1030.score).toBe(0.42);
    expect(n1030.authority_tier).toBe(2);
    expect(n1030.license_tier).toBe("B");
    expect(n1030.on_companion_shelf).toBe(true);
    expect(out.find((c) => c.chunk_id === 1032)!.on_companion_shelf).toBe(false);
    // Without a companion filter the flag stays null, as rerank leaves it.
    const out2 = await expandCccNeighbors([anchor], source);
    expect(out2.find((c) => c.chunk_id === 1030)!.on_companion_shelf).toBeNull();
  });

  it("never duplicates a neighbor already among the results", async () => {
    const anchor = chunk({ chunk_id: 1784, citation_label: "CCC 1784" });
    const already = chunk({ chunk_id: 1783, citation_label: "CCC 1783" });
    const source = fakeSource(new Map([[1784, 1784], [1783, 1783]]), [
      row({ chunk_id: 1783, ordinal: 1783 }),
      row({ chunk_id: 1785, ordinal: 1785 }),
    ]);
    const out = await expandCccNeighbors([anchor, already], source);
    expect(out.filter((c) => c.chunk_id === 1783)).toHaveLength(1);
    expect(out.map((c) => c.chunk_id)).toEqual([1784, 1785, 1783]);
  });

  it("makes no reads at all when no result is a CCC anchor", async () => {
    const source = fakeSource(new Map(), []);
    const results = [chunk({ chunk_id: 5, citation_label: "Confessions I.1", document_id: "confessions" })];
    const out = await expandCccNeighbors(results, source);
    expect(out).toBe(results);
    expect(source.calls).toEqual([]);
  });

  it("caps the expanded anchors and leaves the rest of the list untouched", async () => {
    const anchors = Array.from({ length: MAX_EXPANDED_ANCHORS + 2 }, (_, i) =>
      chunk({ chunk_id: 100 + i, citation_label: `CCC ${100 + i}` }),
    );
    const ordinals = new Map(anchors.map((a) => [a.chunk_id, a.chunk_id]));
    const rows = anchors.flatMap((a) => [row({ chunk_id: a.chunk_id + 1000, ordinal: a.chunk_id + 1 })]);
    const source = fakeSource(ordinals, rows);
    const out = await expandCccNeighbors(anchors, source);
    const ordinalReads = source.calls.filter((c) => c.startsWith("ordinal:"));
    expect(ordinalReads).toHaveLength(MAX_EXPANDED_ANCHORS);
    expect(out).toHaveLength(anchors.length + MAX_EXPANDED_ANCHORS);
  });

  it("an anchor whose ordinal is unknown is left alone", async () => {
    const anchor = chunk({ chunk_id: 2302, citation_label: "CCC 2302" });
    const source = fakeSource(new Map(), [row({ chunk_id: 2301, ordinal: 2301 })]);
    const out = await expandCccNeighbors([anchor], source);
    expect(out).toEqual([anchor]);
    expect(source.calls).toEqual(["ordinal:2302"]);
  });

  it("a one-sided neighborhood (document edge) still contributes its one neighbor", async () => {
    const anchor = chunk({ chunk_id: 1, citation_label: "CCC 1" });
    const source = fakeSource(new Map([[1, 1]]), [row({ chunk_id: 2, ordinal: 2 })]);
    const out = await expandCccNeighbors([anchor], source);
    expect(out.map((c) => c.chunk_id)).toEqual([1, 2]);
  });
});
