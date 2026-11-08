// Structured citations for Ask Aquinas answers (corpus spec §9.1).
//
// When chat-proxy grounds an Aquinas answer in retrieved passages, it appends a
// sources trailer to the text stream after the final token: the sentinel below
// followed by a JSON array of the citations the answer actually used (computed
// server-side, §5.3 rule 3). This module parses that trailer out of the stream
// so CatechismQA can render the sources as small lines under the answer.
//
// The sentinel must match SOURCES_TRAILER_SENTINEL in
// supabase/functions/chat-proxy/corpus.ts — keep the two in sync.

export interface ChatSource {
  label: string;
  documentId: string;
  tier: number;
  licenseTier: string;
  excerpt: string;
}

export const SOURCES_SENTINEL = "\n\n[[SANCTUM_SOURCES]]";

interface WireCitation {
  label: string;
  document_id: string;
  authority_tier: number;
  license_tier: string;
  excerpt: string;
}

export function parseSourcesTrailer(json: string): ChatSource[] | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const sources: ChatSource[] = [];
    for (const item of parsed) {
      const w = item as Partial<WireCitation>;
      if (typeof w.label !== "string" || typeof w.excerpt !== "string") return null;
      sources.push({
        label: w.label,
        documentId: typeof w.document_id === "string" ? w.document_id : "",
        tier: typeof w.authority_tier === "number" ? w.authority_tier : 0,
        licenseTier: typeof w.license_tier === "string" ? w.license_tier : "",
        excerpt: w.excerpt,
      });
    }
    return sources.length > 0 ? sources : null;
  } catch {
    return null;
  }
}

/**
 * Incremental parser for a chat stream that may end with a sources trailer.
 * Feed it raw stream chunks with push(); each call returns the text that is
 * safe to display now (a tail is held back while it could still turn out to be
 * the start of the sentinel). finish() flushes whatever remains: held-back
 * text, and the parsed sources if a trailer arrived.
 *
 * When constructed disabled (no onSources consumer), push() is a pure
 * passthrough and the stream behaves exactly as it did before the corpus.
 */
export class SourcesTrailerParser {
  private buffer = "";
  private trailer = "";
  private inTrailer = false;

  constructor(private enabled: boolean) {}

  push(chunk: string): string {
    if (!this.enabled) return chunk;
    if (this.inTrailer) {
      this.trailer += chunk;
      return "";
    }
    this.buffer += chunk;
    const idx = this.buffer.indexOf(SOURCES_SENTINEL);
    if (idx >= 0) {
      const emit = this.buffer.slice(0, idx);
      this.trailer = this.buffer.slice(idx + SOURCES_SENTINEL.length);
      this.buffer = "";
      this.inTrailer = true;
      return emit;
    }
    // Hold back a tail that could be a partial sentinel split across chunks.
    const hold = SOURCES_SENTINEL.length - 1;
    if (this.buffer.length > hold) {
      const emit = this.buffer.slice(0, this.buffer.length - hold);
      this.buffer = this.buffer.slice(this.buffer.length - hold);
      return emit;
    }
    return "";
  }

  finish(): { text: string; sources: ChatSource[] | null } {
    if (!this.enabled) return { text: "", sources: null };
    if (this.inTrailer) {
      return { text: "", sources: parseSourcesTrailer(this.trailer) };
    }
    const text = this.buffer;
    this.buffer = "";
    return { text, sources: null };
  }
}
