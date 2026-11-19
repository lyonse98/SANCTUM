/*
  The textual-analysis proofread gate (Nov 19, 2026) — Erik's ask after a
  stage direction reached his ear: a whole-script read for language,
  grammar, and flow BEFORE anything is voiced, so mechanical defects are
  caught by a reader, not by the listener.

  The gate runs on the assembled script, paragraph by paragraph, in this
  function (audio-render, the daily Listen) and in tailor-devotional (the
  tailored program) — the instruction text below is shared verbatim
  between the two copies, per the codebase's duplication pattern.

  THE FENCE, by construction: only paragraphs marked eligible are ever
  sent to the model. Scripture paragraphs — the day's Gospel text, the
  reading texts, the supplement passage text, Scripture quotes, citations,
  and the fixed ritual formulas around them — are classified protected by
  the caller and never leave the function; the output restores them
  byte-identical because the gate can only rewrite eligible slots.

  FAIL-OPEN, always: a missing key, a model error, a timeout, or a reply
  whose paragraph count or order does not match the input leaves the
  original script untouched. The gate logs a stage code and a
  changed-paragraph count — never content (the privacy discipline).
*/

import {
  ACCLAMATION,
  AUDIO_SILENCE_SECONDS,
  GOSPEL_CLOSE,
  type AssembledScript,
} from "./narratorCore.ts";

/** The one proofread instruction, shared verbatim with tailor-devotional. */
export const PROOFREAD_INSTRUCTION = `You are Sanctum's proofreader for spoken audio. You are given paragraphs from a devotional script that is about to be read aloud by a speech engine, as a JSON array of strings. Read them as a whole and fix ONLY mechanics:

- grammar and agreement errors
- duplicated words
- stage directions, bracketed notes, or markup that would be read aloud by mistake
- broken or run-on sentences, and punctuation that would mislead a speech reader

Never change meaning. Never change Scripture, quotations, citations, names, numbers, or the author's voice and wording beyond the mechanical fix. If a paragraph needs no fix, return it exactly as given.

Answer with ONLY a JSON array of strings — the paragraphs in the same order and the same count as the input, nothing else.`;

/** One paragraph of the assembled script, and whether the gate may touch it. */
export interface ProofreadUnit {
  text: string;
  eligible: boolean;
}

/**
 * The model seam: given the eligible paragraphs in order, return the raw
 * reply text, or null on any failure. index.ts wires this to Gemini Flash;
 * tests inject fakes.
 */
export type ProofreadModel = (paragraphs: string[]) => Promise<string | null>;

/**
 * Parses a proofread reply: a JSON array of exactly `expected` non-empty
 * strings. Anything else — prose around the array is tolerated only outside
 * the brackets — is a failed gate, and the caller falls back to the
 * original.
 */
export function parseProofreadReply(raw: string, expected: number): string[] | null {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== expected) return null;
  if (parsed.some((p) => typeof p !== "string" || !p.trim())) return null;
  return parsed as string[];
}

/**
 * Runs the gate over a unit list: the eligible paragraphs go to the model
 * in order; the reply, if it validates, is written back into exactly those
 * slots. Protected units are never sent and never altered. Any failure
 * returns the original list with changed = 0.
 */
export async function proofreadUnits(
  units: ProofreadUnit[],
  model: ProofreadModel,
): Promise<{ units: ProofreadUnit[]; changed: number }> {
  const eligibleAt = units
    .map((u, i) => (u.eligible && u.text.trim() ? i : -1))
    .filter((i) => i >= 0);
  if (!eligibleAt.length) return { units, changed: 0 };
  let raw: string | null = null;
  try {
    raw = await model(eligibleAt.map((i) => units[i].text));
  } catch {
    raw = null;
  }
  if (typeof raw !== "string") return { units, changed: 0 };
  const fixed = parseProofreadReply(raw, eligibleAt.length);
  if (!fixed) return { units, changed: 0 };
  const out = units.map((u) => ({ ...u }));
  let changed = 0;
  eligibleAt.forEach((unitAt, k) => {
    if (fixed[k] !== out[unitAt].text) {
      out[unitAt] = { ...out[unitAt], text: fixed[k] };
      changed += 1;
    }
  });
  return { units: out, changed };
}

/** A text split into gate units, with the means to rebuild it exactly. */
export interface ScriptUnits {
  units: ProofreadUnit[];
  /** Reassembles the full text from (possibly proofread) units. */
  join: (units: ProofreadUnit[]) => string;
}

/**
 * Splits an assembled text on its paragraph boundaries, keeping the exact
 * separators (the produced pause beats ride in them) for the rebuild. A
 * paragraph the classifier protects is marked ineligible; everything else
 * is eligible. Empty edge tokens are never eligible.
 */
export function splitScriptUnits(
  text: string,
  isProtected: (paragraph: string) => boolean,
): ScriptUnits {
  const tokens = text.split(/(\n{2,})/);
  const units: ProofreadUnit[] = [];
  const paragraphTokenAt: number[] = [];
  tokens.forEach((token, i) => {
    if (i % 2 === 1) return; // a separator token — carried by the join
    paragraphTokenAt.push(i);
    units.push({ text: token, eligible: token.trim() !== "" && !isProtected(token) });
  });
  return {
    units,
    join: (next: ProofreadUnit[]) => {
      const out = [...tokens];
      paragraphTokenAt.forEach((tokenAt, k) => {
        out[tokenAt] = next[k]?.text ?? out[tokenAt];
      });
      return out.join("");
    },
  };
}

/** The filled Gospel intro's fixed opening — the formula is protected. */
const GOSPEL_INTRO_PREFIX = "A reading from the holy Gospel according to ";

/**
 * The daily gate flow: proofreads the assembled script's four texts as one
 * whole-script read (heads, first movement, second movement, in program
 * order) and returns the assembled script with the proofread texts — and
 * the audit script rebuilt from them. The Gospel text and the ritual
 * formulas are protected by construction. The spoken intro (Nov 19,
 * 2026), when the day carries one, rides in mainA as its own paragraph
 * and is ELIGIBLE — generated connective speech, not Scripture.
 */
export async function proofreadAssembledScript<T extends AssembledScript>(
  assembled: T,
  gospelText: string,
  model: ProofreadModel,
): Promise<{ assembled: T; changed: number }> {
  const isProtected = (p: string) =>
    p === gospelText || p === GOSPEL_CLOSE || p === ACCLAMATION ||
    p.startsWith(GOSPEL_INTRO_PREFIX);
  const fields = [assembled.headAM, assembled.headPM, assembled.mainA, assembled.mainB]
    .map((text) => splitScriptUnits(text, isProtected));
  const allUnits = fields.flatMap((f) => f.units);
  const { units, changed } = await proofreadUnits(allUnits, model);
  if (!changed) return { assembled, changed: 0 };
  const rebuilt: string[] = [];
  let at = 0;
  for (const field of fields) {
    rebuilt.push(field.join(units.slice(at, at + field.units.length)));
    at += field.units.length;
  }
  const [headAM, headPM, mainA, mainB] = rebuilt;
  const script = [
    `HEAD (AM)\n${headAM}`,
    `HEAD (PM)\n${headPM}`,
    `MAIN\n${mainA}\n\n[${AUDIO_SILENCE_SECONDS.toFixed(1)}s silence]\n\n${mainB}`,
  ].join("\n\n");
  return { assembled: { ...assembled, headAM, headPM, mainA, mainB, script }, changed };
}
