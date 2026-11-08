import { describe, expect, it } from "vitest";
import {
  buildSourcesBlock,
  clipText,
  displayExcerpt,
  extractUsedCitations,
  type CorpusResult,
} from "./corpus.ts";

function result(partial: Partial<CorpusResult> & { citation_label: string }): CorpusResult {
  return {
    chunk_id: 1,
    document_id: "ccc",
    locator: "para 1",
    authority_tier: 2,
    license_tier: "B",
    text: "passage text",
    score: 0.8,
    on_companion_shelf: null,
    ...partial,
  };
}

describe("clipText", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(clipText("a  b\n c", 100)).toBe("a b c");
  });
  it("clips at a word boundary with an ellipsis", () => {
    const out = clipText("one two three four five six seven eight", 20);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out).not.toContain("fiv…");
  });
});

describe("displayExcerpt (§9.1 display contract)", () => {
  it("shows license tier A in full", () => {
    const long = "x".repeat(900);
    const r = result({ citation_label: "ST I, q. 1, a. 1", license_tier: "A", text: long });
    expect(displayExcerpt(r)).toBe(long);
  });
  it("clips license tier B to a short excerpt", () => {
    const r = result({ citation_label: "CCC 1", license_tier: "B", text: "word ".repeat(200) });
    const out = displayExcerpt(r);
    expect(out.length).toBeLessThanOrEqual(281);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildSourcesBlock", () => {
  it("labels each passage with its citation and tier, in the given (tier-grouped) order", () => {
    const block = buildSourcesBlock([
      result({ citation_label: "John 1:14", authority_tier: 1, text: "And the Word became flesh" }),
      result({ citation_label: "CCC 460", authority_tier: 2, text: "The Word became flesh" }),
    ]);
    expect(block).toContain("[1] John 1:14 (authority tier 1)");
    expect(block).toContain("[2] CCC 460 (authority tier 2)");
    expect(block.indexOf("John 1:14")).toBeLessThan(block.indexOf("CCC 460"));
  });

  it("marks passages from the companion's own writings", () => {
    const block = buildSourcesBlock([
      result({
        citation_label: "Augustine, Confessions X.27",
        document_id: "confessions-augustine",
        on_companion_shelf: true,
      }),
    ]);
    expect(block).toContain("from your own writings");
  });

  it("clips passages when a clip is requested (companion prompt economy)", () => {
    const block = buildSourcesBlock([result({ citation_label: "CCC 1", text: "word ".repeat(500) })], 100);
    expect(block.length).toBeLessThan(400);
  });
});

describe("extractUsedCitations (§5.3 rule 3, mechanical)", () => {
  const shelf = [
    result({ citation_label: "CCC 2412", document_id: "ccc", authority_tier: 2 }),
    result({ citation_label: "ST II-II, q. 66, a. 6", document_id: "summa", authority_tier: 4, license_tier: "A" }),
    result({ citation_label: "CCC 2240", document_id: "ccc", authority_tier: 2 }),
  ];

  it("returns only labels that appear in the answer, in answer order", () => {
    const used = extractUsedCitations(
      "Aquinas treats this at length (ST II-II, q. 66, a. 6), and the Catechism is plain (CCC 2412).",
      shelf,
    );
    expect(used.map((u) => u.label)).toEqual(["ST II-II, q. 66, a. 6", "CCC 2412"]);
  });

  it("never returns a label the shelf did not hand over", () => {
    const used = extractUsedCitations("The Catechism teaches this (CCC 9999).", shelf);
    expect(used).toEqual([]);
  });

  it("deduplicates repeated citations", () => {
    const used = extractUsedCitations("CCC 2412 … and again CCC 2412.", shelf);
    expect(used).toHaveLength(1);
  });

  it("carries the display excerpt per license tier", () => {
    const used = extractUsedCitations("See CCC 2412.", [
      result({ citation_label: "CCC 2412", text: "word ".repeat(200), license_tier: "B" }),
    ]);
    expect(used[0].excerpt.length).toBeLessThanOrEqual(281);
  });
});
