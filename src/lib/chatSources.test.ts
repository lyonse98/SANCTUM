import { describe, expect, it } from "vitest";
import { SourcesTrailerParser, parseSourcesTrailer } from "./chatSources";

const TRAILER_JSON = JSON.stringify([
  { label: "CCC 2477", document_id: "ccc", authority_tier: 2, license_tier: "B", excerpt: "Respect for the reputation…" },
  { label: "ST II-II, q. 73, a. 2", document_id: "summa", authority_tier: 4, license_tier: "A", excerpt: "Detraction is…" },
]);

describe("SourcesTrailerParser", () => {
  it("is a pure passthrough when disabled", () => {
    const p = new SourcesTrailerParser(false);
    expect(p.push("hello ")).toBe("hello ");
    expect(p.push("world")).toBe("world");
    expect(p.finish()).toEqual({ text: "", sources: null });
  });

  it("passes text through unchanged when no trailer ever arrives", () => {
    const p = new SourcesTrailerParser(true);
    let out = "";
    for (const c of ["The ans", "wer is pl", "ain."]) out += p.push(c);
    const fin = p.finish();
    expect(out + fin.text).toBe("The answer is plain.");
    expect(fin.sources).toBeNull();
  });

  it("strips the trailer and parses sources, even split across chunks", () => {
    const p = new SourcesTrailerParser(true);
    const stream = `The answer cites the Catechism (CCC 2477).\n\n[[SANCTUM_SOURCES]]${TRAILER_JSON}`;
    let out = "";
    // Feed in awkward 7-char slices so the sentinel straddles boundaries.
    for (let i = 0; i < stream.length; i += 7) out += p.push(stream.slice(i, i + 7));
    const fin = p.finish();
    expect(out + fin.text).toBe("The answer cites the Catechism (CCC 2477).");
    expect(fin.sources).toHaveLength(2);
    expect(fin.sources?.[0]).toMatchObject({ label: "CCC 2477", documentId: "ccc", tier: 2, licenseTier: "B" });
    expect(fin.sources?.[1].label).toBe("ST II-II, q. 73, a. 2");
  });

  it("a malformed trailer yields no sources and loses no answer text", () => {
    const p = new SourcesTrailerParser(true);
    let out = p.push("Answer text.");
    out += p.push("\n\n[[SANCTUM_SOURCES]]{not json");
    const fin = p.finish();
    expect(out + fin.text).toBe("Answer text.");
    expect(fin.sources).toBeNull();
  });

  it("a partial sentinel at end of stream is flushed as text", () => {
    const p = new SourcesTrailerParser(true);
    let out = p.push("Ends with brackets [[SAN");
    const fin = p.finish();
    expect(out + fin.text).toBe("Ends with brackets [[SAN");
  });
});

describe("parseSourcesTrailer", () => {
  it("rejects non-arrays and items without label/excerpt", () => {
    expect(parseSourcesTrailer("{}")).toBeNull();
    expect(parseSourcesTrailer('[{"label":"CCC 1"}]')).toBeNull();
    expect(parseSourcesTrailer("[]")).toBeNull();
  });
});
