import { describe, expect, it } from "vitest";
import { rerankChunks, TIER_WEIGHTS, type RawChunk } from "./rerank.ts";

function chunk(partial: Partial<RawChunk> & { chunk_id: number }): RawChunk {
  return {
    document_id: "ccc",
    locator: `para ${partial.chunk_id}`,
    citation_label: `CCC ${partial.chunk_id}`,
    text: `text ${partial.chunk_id}`,
    authority_tier: 2,
    license_tier: "B",
    shelf_tags: [],
    companion_shelves: [],
    similarity: 0.5,
    ...partial,
  };
}

describe("tier weights (spec §5.2 defaults)", () => {
  it("match the spec table exactly", () => {
    expect(TIER_WEIGHTS).toEqual({
      1: 1.0, 2: 0.98, 3: 0.93, 4: 0.88, 5: 0.85, 6: 0.78, 7: 0.7, 8: 0.9,
    });
  });

  it("weights similarity by tier", () => {
    const [r] = rerankChunks([chunk({ chunk_id: 1, similarity: 0.5, authority_tier: 2 })], { k: 8 });
    expect(r.score).toBeCloseTo(0.49);
  });
});

describe("near-duplicate suppression (§8.3)", () => {
  it("collapses same document + same locator to the best score", () => {
    const out = rerankChunks(
      [
        chunk({ chunk_id: 1, locator: "para 10", similarity: 0.4 }),
        chunk({ chunk_id: 2, locator: "para 10", similarity: 0.7 }),
        chunk({ chunk_id: 3, locator: "para 11", similarity: 0.6 }),
      ],
      { k: 8 },
    );
    expect(out.map((c) => c.chunk_id)).toEqual([2, 3]);
  });

  it("collapses identical text within one document", () => {
    const out = rerankChunks(
      [
        chunk({ chunk_id: 1, locator: "para 10", text: "same words here", similarity: 0.7 }),
        chunk({ chunk_id: 2, locator: "para 99", text: "same words here", similarity: 0.6 }),
      ],
      { k: 8 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].chunk_id).toBe(1);
  });
});

describe("selection and presentation", () => {
  it("selects top-k by weighted score", () => {
    const out = rerankChunks(
      [
        chunk({ chunk_id: 1, similarity: 0.9, authority_tier: 7 }), // 0.63
        chunk({ chunk_id: 2, similarity: 0.7, authority_tier: 1 }), // 0.70
        chunk({ chunk_id: 3, similarity: 0.65, authority_tier: 2 }), // 0.637
      ],
      { k: 2 },
    );
    expect(out.map((c) => c.chunk_id).sort()).toEqual([2, 3]);
  });

  it("presents grouped by tier, highest authority first", () => {
    const out = rerankChunks(
      [
        chunk({ chunk_id: 1, similarity: 0.99, authority_tier: 5 }),
        chunk({ chunk_id: 2, similarity: 0.4, authority_tier: 1 }),
        chunk({ chunk_id: 3, similarity: 0.41, authority_tier: 1 }),
      ],
      { k: 3 },
    );
    expect(out.map((c) => c.chunk_id)).toEqual([3, 2, 1]);
  });

  it("marks on_companion_shelf null without a companion filter", () => {
    const [r] = rerankChunks([chunk({ chunk_id: 1 })], { k: 1 });
    expect(r.on_companion_shelf).toBeNull();
  });

  it("selects a companion's own shelf ahead of stronger off-shelf matches", () => {
    const out = rerankChunks(
      [
        chunk({ chunk_id: 1, similarity: 0.95, authority_tier: 2, companion_shelves: [] }),
        chunk({
          chunk_id: 2, similarity: 0.55, authority_tier: 4,
          document_id: "confessions-augustine", companion_shelves: ["augustine"],
        }),
      ],
      { k: 1, companion: "augustine" },
    );
    expect(out).toHaveLength(1);
    expect(out[0].chunk_id).toBe(2);
    expect(out[0].on_companion_shelf).toBe(true);
  });

  it("presents the on-shelf group before the off-shelf group", () => {
    const out = rerankChunks(
      [
        chunk({ chunk_id: 1, similarity: 0.95, authority_tier: 1, companion_shelves: [] }),
        chunk({
          chunk_id: 2, similarity: 0.5, authority_tier: 4,
          document_id: "confessions-augustine", companion_shelves: ["augustine"],
        }),
      ],
      { k: 2, companion: "augustine" },
    );
    expect(out.map((c) => c.chunk_id)).toEqual([2, 1]);
    expect(out[1].on_companion_shelf).toBe(false);
  });
});
