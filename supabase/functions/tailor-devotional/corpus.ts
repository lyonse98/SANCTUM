// Corpus access for tailor-devotional — the tradition quote's first shelf.
//
// The same discipline as chat-proxy's corpus module: everything sits behind
// the CORPUS_ENABLED flag and the CORPUS_RETRIEVE_KEY door key, retrieval is
// one server-to-server call, and ANY failure — flag off, key unset, timeout,
// error status, malformed body, an empty shelf — returns null and the caller
// falls back to the daily-quotes dataset exactly as it would have anyway.
// The corpus can give the morning a better word from the tradition; it can
// never break the build.
//
// The query it carries is built in tailorCore from enum categories only (the
// day's focus and tone) — nothing the user wrote ever enters it.

export interface CorpusQuoteResult {
  text: string;
  author: string;
}

/** A tailored build may take a minute or two; the shelf gets a few seconds, no more. */
const CORPUS_TIMEOUT_MS = 4000;

/** Spoken quotes stay short — a word from the tradition, not a reading. */
const MAX_QUOTE_CHARS = 320;
const MIN_QUOTE_CHARS = 20;

export function corpusEnabled(): boolean {
  return Deno.env.get("CORPUS_ENABLED") === "true";
}

interface CorpusChunk {
  citation_label?: unknown;
  license_tier?: unknown;
  text?: unknown;
}

/** Clip text to at most `max` chars, ending at a word boundary when possible. */
function clipText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The excerpt a consumer may carry for a chunk, under the corpus license
 * rule: tier A (public domain) in full; anything else as a short quoted
 * excerpt only.
 */
function displayExcerpt(chunk: CorpusChunk): string {
  const text = typeof chunk.text === "string" ? chunk.text : "";
  if (chunk.license_tier === "A") return text.replace(/\s+/g, " ").trim();
  return clipText(text, 280);
}

/**
 * Asks the shelf for one short passage to carry as the morning's word from
 * the tradition. Returns the first result that fits a spoken quote's length,
 * or null when the shelf has nothing to say to this build.
 */
export async function retrieveTraditionQuote(query: string): Promise<CorpusQuoteResult | null> {
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
        query,
        k: 5,
        filters: { language: "en" },
        purpose: "tailor-quote",
      }),
      signal: AbortSignal.timeout(CORPUS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.results)) return null;
    for (const chunk of json.results as CorpusChunk[]) {
      const text = displayExcerpt(chunk);
      const author = typeof chunk.citation_label === "string" ? chunk.citation_label.trim() : "";
      if (author && text.length >= MIN_QUOTE_CHARS && text.length <= MAX_QUOTE_CHARS) {
        return { text, author };
      }
    }
    return null;
  } catch {
    return null;
  }
}
