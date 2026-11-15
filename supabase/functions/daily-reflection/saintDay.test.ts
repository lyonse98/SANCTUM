import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIXED_FEASTS,
  SAINT_LINES,
  buildInputSaintBlock,
  saintForReflectionDate,
  saintWeaveBlock,
} from "./saintDay.ts";

/**
 * Saints in the content (Erik's lean, Nov 14, 2026) — the pins. The weave
 * fires ONLY when the calendar actually keeps a saint the app's own bank
 * can describe: a memorial day's generation input carries the weave and
 * the saint's name; a ferial day's carries neither (the block is the empty
 * string, so the input stays byte-identical). The tables are extracted
 * from src/lib/narratorCore.ts — the drift pin below re-extracts them from
 * that source and fails on any divergence, so the generator can never be
 * taught a saint the app itself does not know.
 */

const narratorCoreSrc = readFileSync(
  join(__dirname, "..", "..", "..", "src", "lib", "narratorCore.ts"),
  "utf8",
);
const fnIndex = readFileSync(join(__dirname, "index.ts"), "utf8");

/** Balanced-brace extraction of a pure-data literal from the source — the
 *  same operation that generated saintDay.ts, repeated here as the check. */
function extractLiteral(src: string, name: string): unknown {
  const start = src.indexOf(`const ${name}`);
  if (start < 0) throw new Error(`${name} not found`);
  const braceStart = src.indexOf("= {", start) + 2;
  let depth = 0;
  let inStr: string | null = null;
  let i = braceStart;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const literal = src.slice(braceStart, i + 1);
  if (literal.includes("`") || literal.includes("=>")) throw new Error(`${name} is not pure data`);
  return new Function(`return (${literal})`)();
}

describe("the extracted tables match the narrator bank exactly", () => {
  it("SAINT_LINES is narratorCore's SAINT_LINES_N, verbatim", () => {
    expect(SAINT_LINES).toEqual(extractLiteral(narratorCoreSrc, "SAINT_LINES_N"));
    expect(Object.keys(SAINT_LINES).length).toBe(161);
  });

  it("FIXED_FEASTS is narratorCore's FIXED_FEASTS_N, verbatim", () => {
    expect(FIXED_FEASTS).toEqual(extractLiteral(narratorCoreSrc, "FIXED_FEASTS_N"));
    expect(Object.keys(FIXED_FEASTS).length).toBe(156);
  });
});

describe("activation — only a described saint day weaves", () => {
  it("a memorial day resolves name, descriptor, and rank from the one bank entry", () => {
    const saint = saintForReflectionDate("2026-11-22");
    expect(saint).toEqual({
      name: "St. Cecilia",
      descriptor: "A Roman martyr and patron of musicians.",
      rank: "memorial",
    });
  });

  it("a saint the line bank knows without a feast-table entry still weaves, rankless", () => {
    const saint = saintForReflectionDate("2027-01-31");
    expect(saint?.name).toBe("St. John Bosco");
    expect(saint?.rank).toBeNull();
    expect(saintWeaveBlock(saint!)).toContain("Today the Church remembers St. John Bosco:");
  });

  it("a feast the line bank cannot describe gets NO weave — never a bare name", () => {
    // Jan 1 (Mary, Mother of God) and Dec 25 sit in FIXED_FEASTS with no
    // SAINT_LINES entry: the generator is not sent a name without the one
    // true clause that may be said.
    expect(saintForReflectionDate("2026-01-01")).toBeNull();
    expect(saintForReflectionDate("2026-12-25")).toBeNull();
    expect(buildInputSaintBlock("2026-01-01")).toBe("");
  });

  it("a ferial day resolves nothing", () => {
    expect(saintForReflectionDate("2026-02-10")).toBeNull();
    expect(buildInputSaintBlock("2026-02-10")).toBe("");
  });

  // The optional memorials (Erik, Nov 15, 2026): named in the client
  // calendar first, then given their bank lines so the weave fires for
  // them too — under their own rank, which the block speaks as
  // "optional memorial".
  it("an optional-memorial saint now weaves, under his own rank (Juan Diego, Dec 9)", () => {
    const saint = saintForReflectionDate("2026-12-09");
    expect(saint).toEqual({
      name: "St. Juan Diego",
      descriptor: "A poor Aztec convert on whose cloak Our Lady of Guadalupe left her image in 1531.",
      rank: "optional-memorial",
    });
    const block = buildInputSaintBlock("2026-12-09");
    expect(block).toContain("Today the Church keeps the optional memorial of St. Juan Diego:");
    expect(block).toContain("A poor Aztec convert on whose cloak Our Lady of Guadalupe left her image in 1531.");
    expect(block).toContain("Weave the saint in ONCE");
  });

  it("the other two optional-memorial saints weave too (Becket, Sylvester)", () => {
    expect(saintForReflectionDate("2026-12-29")).toEqual({
      name: "St. Thomas Becket",
      descriptor: "The chancellor turned Archbishop of Canterbury who defended the Church's liberty against his friend King Henry II.",
      rank: "optional-memorial",
    });
    expect(buildInputSaintBlock("2026-12-29")).toContain("St. Thomas Becket");
    expect(saintForReflectionDate("2026-12-31")).toEqual({
      name: "St. Sylvester I",
      descriptor: "The pope who led the Church out of the catacombs into the peace of Constantine.",
      rank: "optional-memorial",
    });
    expect(buildInputSaintBlock("2026-12-31")).toContain("St. Sylvester I");
  });

  it("the Basilicas dedication gets NO weave — the feast table names it, but it is not a person", () => {
    expect(FIXED_FEASTS["11-18"]).toEqual(["Dedication of the Basilicas of Sts. Peter and Paul", "optional-memorial"]);
    expect(saintForReflectionDate("2026-11-18")).toBeNull();
    expect(buildInputSaintBlock("2026-11-18")).toBe("");
  });

  it("Nov 23 already wove before the optional memorials arrived — for Miguel Pro, rankless", () => {
    // The bank's Nov 23 line has always been St. Miguel Pro's (the client
    // calendar names Clement and Columban for the date; the spoken slot
    // is his). With no FIXED_FEASTS entry for 11-23, his weave rides the
    // rankless shape — and it fired before this build, unchanged by it.
    const saint = saintForReflectionDate("2026-11-23");
    expect(saint).toEqual({
      name: "St. Miguel Pro",
      descriptor: "A Jesuit priest in Mexico who was executed by the government for his faith.",
      rank: null,
    });
    expect(buildInputSaintBlock("2026-11-23")).toContain(
      "Today the Church remembers St. Miguel Pro: A Jesuit priest in Mexico who was executed by the government for his faith.",
    );
  });
});

describe("the full-year optional memorials weave too (Nov 15, 2026 completion)", () => {
  it("Januarius (Sep 19) weaves under his own rank", () => {
    expect(saintForReflectionDate("2026-09-19")).toEqual({
      name: "St. Januarius",
      descriptor: "A bishop of Benevento martyred under Diocletian around 305.",
      rank: "optional-memorial",
    });
    expect(buildInputSaintBlock("2026-09-19")).toContain(
      "Today the Church keeps the optional memorial of St. Januarius:",
    );
  });

  it("Drexel (Mar 3 — a US-proper addition) weaves", () => {
    expect(saintForReflectionDate("2026-03-03")?.name).toBe("St. Katharine Drexel");
    expect(buildInputSaintBlock("2026-03-03")).toContain(
      "optional memorial of St. Katharine Drexel",
    );
  });

  it("Vincent the deacon (Jan 22) weaves", () => {
    expect(saintForReflectionDate("2027-01-22")?.name).toBe("St. Vincent");
    expect(buildInputSaintBlock("2027-01-22")).toContain("St. Vincent");
  });

  it("the non-person and Joseph days get NO weave — named in the table, never spoken as a saint", () => {
    expect(FIXED_FEASTS["08-05"]).toEqual(["Dedication of the Basilica of St. Mary Major", "optional-memorial"]);
    expect(saintForReflectionDate("2026-08-05")).toBeNull();
    expect(buildInputSaintBlock("2026-08-05")).toBe("");
    expect(FIXED_FEASTS["09-12"]).toEqual(["The Most Holy Name of Mary", "optional-memorial"]);
    expect(saintForReflectionDate("2026-09-12")).toBeNull();
    expect(FIXED_FEASTS["05-01"]).toEqual(["St. Joseph the Worker", "optional-memorial"]);
    expect(saintForReflectionDate("2026-05-01")).toBeNull();
  });
});

describe("the two input shapes the brief requires", () => {
  it("a memorial day's block carries the weave and the saint's name", () => {
    const block = buildInputSaintBlock("2026-11-22");
    expect(block).toContain("St. Cecilia");
    expect(block).toContain("A Roman martyr and patron of musicians.");
    expect(block).toContain("Today the Church keeps the memorial of St. Cecilia:");
    expect(block).toContain("Weave the saint in ONCE");
  });

  it("the weave is fenced: one sentence, existing lengths, bank facts only", () => {
    const block = buildInputSaintBlock("2026-11-22");
    expect(block).toContain("The weave replaces words; it does not add length.");
    expect(block).toContain("no other biographical claims, no quotations, no promises of intercession");
    expect(block).toContain("the Challenge stays the reader's own act");
  });

  it("a ferial day's block is empty — neither weave nor name nor placeholder", () => {
    const block = buildInputSaintBlock("2026-02-10");
    expect(block).toBe("");
    expect(block).not.toContain("Weave");
    expect(block).not.toContain("saint");
  });
});

describe("the wiring — the weave lives in the input, never in the prompts", () => {
  it("buildInput appends the block only when it is non-empty, from the date", () => {
    expect(fnIndex).toContain("buildInputSaintBlock(dateKey)");
    expect(fnIndex).toContain("if (saintBlock) {");
  });

  it("neither system prompt carries a saint instruction — ferial behavior is the prompts' own", () => {
    for (const name of ["PROMPT", "PROMPT_WOMEN"] as const) {
      const m = fnIndex.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
      expect(m).not.toBeNull();
      expect(m![1]).not.toContain("Weave the saint");
      expect(m![1]).not.toContain("SAINT_LINES");
    }
  });
});
