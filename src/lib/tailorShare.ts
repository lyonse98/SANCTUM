import type { Audience } from '@/types';
import type { TailoredDevotional } from '@/lib/tailor';

/**
 * The tailored morning's shareable pieces, kept on-device (Nov 13, 2026).
 *
 * When a Tailor Today build completes, two of its pieces are worth handing
 * to someone else — the supplement passage and the word from the tradition.
 * They are copied here, into a small dated store, so the Gospel card's share
 * shelf can offer them without reopening the tailor cache. The store holds
 * ONLY those pieces: passage citation + a short excerpt, and the quote +
 * its author. The intake — state, focus, the user's own free-text line —
 * never enters it; the writer's shape makes that impossible rather than
 * merely unlikely (see shareEntryFromDevotional, which reads exactly two
 * fields of the devotional).
 *
 * Keyed by date AND track, under the sanctum_ prefix, so the panic wipe
 * clears it with everything else and yesterday's pieces can never surface
 * on today's shelf.
 */

export interface TailorShareEntry {
  passageCitation: string;
  passageExcerpt: string;
  traditionQuote: { text: string; author: string } | null;
}

export function tailorShareKey(dateKey: string, audience: Audience): string {
  return `sanctum_tailor_share_${dateKey}_${audience}`;
}

const MAX_EXCERPT_CHARS = 200;

/** Words that mark the sentence a passage turns on — its key verbs and nouns. */
const KEY_TERMS = [
  'trust', 'wait', 'hope', 'love', 'soul', 'heart', 'lord', 'god', 'strength',
  'refuge', 'mercy', 'fear', 'peace', 'light', 'deliver', 'save', 'blessed',
];

/** Splits a passage into its sentences, keeping terminal punctuation attached. */
export function splitPassageSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g);
  return (matches ?? [cleaned]).map((s) => s.trim()).filter(Boolean);
}

/**
 * A short excerpt of the supplement passage for the share card: the first
 * sentence when it stands on its own, otherwise the sentence carrying the
 * passage's key verb — never more than ~200 characters, clipped at a word
 * boundary when no whole sentence fits.
 */
export function excerptPassage(passageText: string, maxChars: number = MAX_EXCERPT_CHARS): string {
  const sentences = splitPassageSentences(passageText);
  if (sentences.length === 0) return '';

  const first = sentences[0];
  if (first.length >= 40 && first.length <= maxChars) return first;

  let best: string | null = null;
  let bestScore = -1;
  for (const sentence of sentences) {
    if (sentence.length > maxChars) continue;
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const term of KEY_TERMS) {
      if (lower.includes(term)) score += 1;
    }
    if (sentence.length >= 60) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  if (best) return best;

  // Nothing whole fits: clip the first sentence at a word boundary.
  const clipped = first.slice(0, maxChars - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
}

/** The two shareable fields of a tailored devotional — and nothing else. */
export type TailorShareSource = Pick<TailoredDevotional, 'passage' | 'traditionQuote'>;

/**
 * Builds the store entry from a completed devotional. Reads ONLY the
 * passage (citation + text, excerpted) and the tradition quote — the
 * devotional's reflect/challenge and the morning's intake are not touched.
 */
export function shareEntryFromDevotional(devotional: TailorShareSource): TailorShareEntry {
  return {
    passageCitation: devotional.passage.citation,
    passageExcerpt: excerptPassage(devotional.passage.text),
    traditionQuote: devotional.traditionQuote
      ? { text: devotional.traditionQuote.text, author: devotional.traditionQuote.author }
      : null,
  };
}

export function writeTailorShare(dateKey: string, audience: Audience, entry: TailorShareEntry): void {
  try {
    // The stored object is rebuilt field by field — even a caller handing
    // over a wider object cannot smuggle extra fields into the store.
    const stored: TailorShareEntry = {
      passageCitation: entry.passageCitation,
      passageExcerpt: entry.passageExcerpt,
      traditionQuote: entry.traditionQuote
        ? { text: entry.traditionQuote.text, author: entry.traditionQuote.author }
        : null,
    };
    localStorage.setItem(tailorShareKey(dateKey, audience), JSON.stringify(stored));
  } catch {
    // ignore — the shelf simply won't offer the tailored pieces today
  }
}

export function readTailorShare(dateKey: string, audience: Audience): TailorShareEntry | null {
  try {
    const raw = localStorage.getItem(tailorShareKey(dateKey, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TailorShareEntry>;
    if (typeof parsed.passageCitation !== 'string' || typeof parsed.passageExcerpt !== 'string') {
      return null;
    }
    const quote =
      parsed.traditionQuote &&
      typeof parsed.traditionQuote.text === 'string' &&
      typeof parsed.traditionQuote.author === 'string'
        ? { text: parsed.traditionQuote.text, author: parsed.traditionQuote.author }
        : null;
    if (!parsed.passageCitation && !quote) return null;
    return {
      passageCitation: parsed.passageCitation,
      passageExcerpt: parsed.passageExcerpt,
      traditionQuote: quote,
    };
  } catch {
    return null;
  }
}
