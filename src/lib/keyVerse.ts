import type { PassageVerse } from '@/lib/bible';

/**
 * Words that tend to mark a line worth sitting with — commands, promises,
 * and the vocabulary of the interior life.
 */
export const STRONG_TERMS = [
  'love', 'mercy', 'merciful', 'forgive', 'forgiven', 'peace', 'afraid',
  'fear not', 'come', 'follow', 'believe', 'faith', 'hope', 'truth', 'heart',
  'soul', 'neighbor', 'servant', 'serve', 'humble', 'give', 'pray', 'seek',
  'knock', 'ask', 'rest', 'burden', 'light', 'life', 'way', 'kingdom',
  'father', 'grace', 'repent', 'joy', 'sorrow', 'cross', 'deny', 'poor',
  'weak', 'lost', 'found', 'shepherd', 'vine', 'bread', 'water', 'living',
  'blessed', 'holy', 'spirit', 'watch', 'remain', 'abide', 'rejoice',
  'comfort', 'strength', 'salvation', 'righteous', 'judge', 'judgment',
  'generous', 'treasure', 'mammon', 'worried', 'anxious', 'tomorrow',
];

/** Markers of a saying rather than narration — the aphoristic hinge. */
const CONTRAST_TERMS = ['but i say', 'but whoever', 'rather', 'however', 'whoever', 'therefore'];

/** Material that is almost never the line to sit with. */
const SKIP_PATTERNS = [
  /\bbegat\b/i,
  /\bthe sons of\b/i,
  /\bson of .+, son of\b/i,
  /^\s*\d+\s*$/,
  /^\(.*\)$/,
];

const MIN_LENGTH = 55;
const MAX_LENGTH = 320;

function scoreVerse(text: string, index: number, total: number): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const term of STRONG_TERMS) {
    if (lower.includes(term)) score += 3;
  }
  for (const term of CONTRAST_TERMS) {
    if (lower.includes(term)) score += 2;
  }

  // Direct speech carries the weight of the passage.
  if (/[“"]/.test(text)) score += 4;
  if (/\bjesus\b|\blord\b|\bhe said\b|\bi say to you\b/i.test(text)) score += 3;

  // Second-person address turns a line toward the reader.
  if (/\byou\b|\byour\b/i.test(text)) score += 3;
  if (/\bi am\b/i.test(text)) score += 4;

  // Favour lines with enough substance, but not rambling blocks.
  if (text.length >= 90) score += 2;
  if (text.length > MAX_LENGTH) score -= 3;

  // The turn of a passage usually lands late; mildly prefer it.
  if (total > 3 && index >= Math.floor(total / 2)) score += 2;
  if (total > 4 && index === total - 1) score += 1;

  return score;
}

function isEligible(text: string): boolean {
  if (text.length < MIN_LENGTH) return false;
  if (SKIP_PATTERNS.some((re) => re.test(text))) return false;
  return true;
}

export interface KeyVerse {
  text: string;
  /** Citation narrowed to the chosen verse, e.g. "Matthew 22:21". */
  citation: string;
}

/**
 * Pick the single most reflection-worthy verse from a Gospel passage.
 * Deterministic for a given passage, and falls back to the longest eligible
 * verse when no line stands out.
 */
export function pickKeyVerse(passage: { citation: string; verses: PassageVerse[] }): KeyVerse | null {
  const verses = passage.verses.filter((v) => isEligible(v.text));
  const pool = verses.length ? verses : passage.verses;
  if (!pool.length) return null;

  let best = pool[0];
  let bestScore = -Infinity;
  pool.forEach((v, i) => {
    const s = scoreVerse(v.text, i, pool.length);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  });

  const base = passage.citation.split(':')[0];
  return { text: best.text, citation: `${base}:${best.verse}` };
}
