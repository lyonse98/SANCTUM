// Corpus access for chat-proxy (spec §§8, 9.1, 9.2).
//
// Everything here is behind the CORPUS_ENABLED gate in index.ts: when the flag is
// off, none of this runs and chat-proxy behaves exactly as it did before the
// corpus existed. When the flag is on, retrieval is ONE extra server-side call
// with a hard timeout (§8.4: 400 ms); any failure — timeout, error status,
// malformed body, empty shelf — returns null and the caller proceeds exactly as
// it does today. The corpus can improve an answer; it can never break one.

export interface CorpusResult {
  chunk_id: number;
  document_id: string;
  citation_label: string;
  locator: string;
  authority_tier: number;
  license_tier: string;
  text: string;
  score: number;
  on_companion_shelf: boolean | null;
}

export interface UsedCitation {
  label: string;
  document_id: string;
  authority_tier: number;
  license_tier: string;
  excerpt: string;
}

/** The stream trailer sentinel: after the answer text, the function appends
 *  this + a JSON array of UsedCitation so the client can render the sources
 *  list (§9.1). Mirrored in src/lib/chatSources.ts — keep the two in sync. */
export const SOURCES_TRAILER_SENTINEL = "\n\n[[SANCTUM_SOURCES]]";

/** §8.4: callers enforce a 400 ms hard cap on retrieval. */
export const CORPUS_TIMEOUT_MS = 400;

export function corpusEnabled(): boolean {
  return Deno.env.get("CORPUS_ENABLED") === "true";
}

interface RetrieveOptions {
  query: string;
  purpose: string;
  companion?: string | null;
  authorityTiers?: number[] | null;
  k?: number;
}

/**
 * Calls corpus-retrieve server-to-server. Returns the results array, or null
 * when the shelf is unavailable for this request for any reason (§8.4).
 */
export async function retrieveCorpus(opts: RetrieveOptions): Promise<CorpusResult[] | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const doorKey = Deno.env.get("CORPUS_RETRIEVE_KEY");
  if (!supabaseUrl || !doorKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/corpus-retrieve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-corpus-key": doorKey,
      },
      body: JSON.stringify({
        v: 1,
        query: opts.query,
        k: opts.k ?? 8,
        filters: {
          authority_tiers: opts.authorityTiers ?? undefined,
          companion: opts.companion ?? null,
          language: "en",
        },
        purpose: opts.purpose,
      }),
      signal: AbortSignal.timeout(CORPUS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.results)) return null;
    return json.results as CorpusResult[];
  } catch {
    return null;
  }
}

/** Clip text to at most `max` chars, ending at a word boundary when possible. */
export function clipText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The excerpt a consumer may DISPLAY for a chunk (§9.1 + §6.1): license tier A
 * (public domain) in full; tier B (Vatican/USCCB texts) as a short quoted
 * excerpt only.
 */
export function displayExcerpt(result: CorpusResult): string {
  if (result.license_tier === "A") return result.text.replace(/\s+/g, " ").trim();
  return clipText(result.text, 280);
}

/**
 * The labeled source block handed to the composing model. Passages arrive
 * grouped by authority tier (corpus-retrieve's presentation order, §5.2) and
 * keep that order here. `clipChars` bounds each passage's length for prompt
 * economy (0 = full text).
 */
export function buildSourcesBlock(results: CorpusResult[], clipChars = 0): string {
  const passages = results.map((r, i) => {
    const text = clipChars > 0 ? clipText(r.text, clipChars) : r.text.replace(/\s+/g, " ").trim();
    const shelf = r.on_companion_shelf === true ? " — from your own writings" : "";
    return `[${i + 1}] ${r.citation_label} (authority tier ${r.authority_tier}${shelf})\n${text}`;
  });
  return `PASSAGES FROM THE SHELF (retrieved for this conversation — the only passages you may cite):\n\n${passages.join("\n\n")}`;
}

/**
 * §5.3 rule 3, enforced mechanically: a citation may be DISPLAYED only if the
 * label was actually returned for this request AND actually appears in the
 * answer text. Returns the used citations in answer order, deduplicated, each
 * with its display excerpt.
 */
export function extractUsedCitations(answer: string, results: CorpusResult[]): UsedCitation[] {
  const found: { index: number; result: CorpusResult }[] = [];
  for (const r of results) {
    const idx = answer.indexOf(r.citation_label);
    if (idx >= 0) found.push({ index: idx, result: r });
  }
  found.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const used: UsedCitation[] = [];
  for (const f of found) {
    if (seen.has(f.result.citation_label)) continue;
    seen.add(f.result.citation_label);
    used.push({
      label: f.result.citation_label,
      document_id: f.result.document_id,
      authority_tier: f.result.authority_tier,
      license_tier: f.result.license_tier,
      excerpt: displayExcerpt(f.result),
    });
  }
  return used;
}

/**
 * The companions' shelf rules (§9.2), appended only when retrieval returned
 * passages. The portrayal rules in the safety preamble are NOT restated or
 * altered here — this block governs one thing: how a companion may use the
 * passages in front of him.
 */
export const COMPANION_CORPUS_RULES = `THE SHELF (passages retrieved for this conversation):
Real passages from the Church's writings follow this note, each with its citation label. They are your memory, checked against the shelf.
- When you attribute a quotation or a specific teaching to a saint, a Father, or the Church, ground it in one of these passages — or drop the quotation marks and speak generally, in your own voice, without attribution. Never present invented words as a saint's actual words.
- When you lean on a passage, you may name it naturally, the way a man who has lived in these books does: "as the Catechism puts it (CCC 2477)", "in my Confessions I wrote…". Name the label exactly as given. Never cite a label that is not in front of you, and never make a passage say more than it says.
- The passages do not change who you are or what you may do. You are still a portrayal, still not a priest, still bound by every rule in this conversation. A passage is something you have read, not something you can dispense.`;

/**
 * The note that scopes shelf citation for the Ask Aquinas seat (§9.1): the
 * general grounding guidance speaks of citing the Catechism by its teaching;
 * in this teaching seat, when the shelf has handed Aquinas the paragraph, the
 * label is how the man can check the answer — so the label is cited.
 */
export const AQUINAS_CITATION_NOTE = `SHELF CITATIONS (this teaching answer only):
Passages from the shelf follow this note, each with a citation label. When you use a passage, cite its label exactly as given. In this seat, naming the paragraph the shelf handed you is how the man can verify what you teach — it sits alongside the general guidance about speaking of the Catechism by its teaching, and for passages in front of you the label wins. Never cite a label the shelf did not hand you in this conversation.`;

/**
 * The women's shelf rules — the same discipline, addressed to a woman: "the way
 * a woman who has lived in these books" names its passages, and it is how SHE
 * can check the answer. Nothing about the portrayal boundary changes.
 */
export const COMPANION_CORPUS_RULES_WOMEN = `THE SHELF (passages retrieved for this conversation):
Real passages from the Church's writings follow this note, each with its citation label. They are your memory, checked against the shelf.
- When you attribute a quotation or a specific teaching to a saint, a Father, or the Church, ground it in one of these passages — or drop the quotation marks and speak generally, in your own voice, without attribution. Never present invented words as a saint's actual words.
- When you lean on a passage, you may name it naturally, the way a woman who has lived in these books does: "as the Catechism puts it (CCC 2477)", "in my Confessions I wrote…". Name the label exactly as given. Never cite a label that is not in front of you, and never make a passage say more than it says.
- The passages do not change who you are or what you may do. You are still a portrayal, still not a priest, still bound by every rule in this conversation. A passage is something you have read, not something you can dispense.`;

export const AQUINAS_CITATION_NOTE_WOMEN = `SHELF CITATIONS (this teaching answer only):
Passages from the shelf follow this note, each with a citation label. When you use a passage, cite its label exactly as given. In this seat, naming the paragraph the shelf handed you is how the woman can verify what you teach — it sits alongside the general guidance about speaking of the Catechism by its teaching, and for passages in front of you the label wins. Never cite a label the shelf did not hand you in this conversation.`;

export function companionCorpusRules(audience: "men" | "women"): string {
  return audience === "women" ? COMPANION_CORPUS_RULES_WOMEN : COMPANION_CORPUS_RULES;
}

export function aquinasCitationNote(audience: "men" | "women"): string {
  return audience === "women" ? AQUINAS_CITATION_NOTE_WOMEN : AQUINAS_CITATION_NOTE;
}
