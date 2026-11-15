/**
 * Neighbor expansion for Catechism anchors (fidelity polish, Nov 14, 2026).
 *
 * The fidelity eval (scripts/corpus/eval) showed the shape of the remaining
 * required-citation misses: the model is asked for one Catechism paragraph
 * and retrieval lands its NEIGHBOR instead — envy retrieves 2540's ground
 * but the required paragraph is 2539; purgatory lands beside 1030/1031;
 * conscience beside 1783/1784. Semantic search cannot be steered onto an
 * exact paragraph number, but the Catechism's argument runs paragraph to
 * paragraph, so the fix is structural: when a bare Catechism paragraph
 * ("CCC 2277") is among the results, its immediate neighbors (±1 by the
 * chunk table's ordinal) ride along, spliced in directly behind it.
 *
 * This runs INSIDE corpus-retrieve, on results already fetched — the
 * expansion is two small indexed PostgREST reads per anchor (capped at
 * three anchors), never an extra chat-proxy round trip, so the caller's
 * 2500ms retrieval fence (chat-proxy/corpus.ts) keeps its shape. The logic
 * here is pure over an injected NeighborSource so it is unit tested without
 * a database; index.ts supplies the PostgREST source and fails open to the
 * unexpanded results on any error.
 */

/** The chunk shape expansion works over — rerank.ts's RankedChunk. */
export interface ExpandableChunk {
  chunk_id: number;
  document_id: string;
  locator: string;
  citation_label: string;
  text: string;
  authority_tier: number;
  license_tier: string;
  shelf_tags: string[];
  companion_shelves: string[];
  similarity: number;
  score: number;
  on_companion_shelf: boolean | null;
}

/** One neighboring row of the same document, as the source returns it. */
export interface NeighborRow {
  chunk_id: number;
  ordinal: number;
  locator: string;
  citation_label: string;
  text: string;
  companion_shelves: string[];
}

/** The two reads expansion needs, injected so the logic stays pure. */
export interface NeighborSource {
  /** The anchor chunk's own ordinal in its document, or null when unknown. */
  ordinalFor(chunkId: number): Promise<number | null>;
  /** Rows at the given ordinals of one document (any order). */
  rowsAt(documentId: string, ordinals: number[]): Promise<NeighborRow[]>;
}

/**
 * A bare Catechism paragraph label — the anchor shape. Labels with a suffix
 * (a range like "CCC 2277-2279" or a section head) are not single paragraphs
 * and do not anchor an expansion.
 */
export const CCC_ANCHOR_LABEL = /^CCC \d+$/;

/** At most this many anchors expand per retrieval — bounds the extra reads. */
export const MAX_EXPANDED_ANCHORS = 3;

export function isCccAnchor(citationLabel: string): boolean {
  return CCC_ANCHOR_LABEL.test(citationLabel);
}

/**
 * Splice each CCC anchor's ±1 neighbors in directly behind it, in ordinal
 * order. A neighbor already among the results is never duplicated. A
 * neighbor inherits its anchor's score, similarity, authority tier, license
 * tier, and shelf tags (same document — those are the document's own), and
 * carries its own locator, label, text, and shelf membership: when a
 * companion filter is in play, on_companion_shelf is computed from the
 * neighbor's own companion_shelves, exactly as rerank computes it.
 * Anchors past the cap, anchors whose ordinal is unknown, and anchors with
 * no fresh neighbors leave the list exactly as it was.
 */
export async function expandCccNeighbors(
  results: ExpandableChunk[],
  source: NeighborSource,
  companion: string | null = null,
): Promise<ExpandableChunk[]> {
  const anchors = results.filter((r) => isCccAnchor(r.citation_label)).slice(0, MAX_EXPANDED_ANCHORS);
  if (anchors.length === 0) return results;

  const present = new Set(results.map((r) => r.chunk_id));
  const insertions = new Map<number, ExpandableChunk[]>();
  for (const anchor of anchors) {
    const ordinal = await source.ordinalFor(anchor.chunk_id);
    if (ordinal == null) continue;
    const rows = await source.rowsAt(anchor.document_id, [ordinal - 1, ordinal + 1]);
    const fresh = rows
      .filter((row) => row.chunk_id !== anchor.chunk_id && !present.has(row.chunk_id))
      .sort((a, b) => a.ordinal - b.ordinal);
    if (fresh.length === 0) continue;
    insertions.set(
      anchor.chunk_id,
      fresh.map((row) => ({
        chunk_id: row.chunk_id,
        document_id: anchor.document_id,
        locator: row.locator,
        citation_label: row.citation_label,
        text: row.text,
        authority_tier: anchor.authority_tier,
        license_tier: anchor.license_tier,
        shelf_tags: anchor.shelf_tags,
        companion_shelves: row.companion_shelves,
        similarity: anchor.similarity,
        score: anchor.score,
        on_companion_shelf: companion ? row.companion_shelves.includes(companion) : null,
      })),
    );
    for (const row of fresh) present.add(row.chunk_id);
  }
  if (insertions.size === 0) return results;

  const out: ExpandableChunk[] = [];
  for (const r of results) {
    out.push(r);
    const extra = insertions.get(r.chunk_id);
    if (extra) out.push(...extra);
  }
  return out;
}
