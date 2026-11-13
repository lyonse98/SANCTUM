import type { KeyVerse } from '@/lib/keyVerse';
import type { Reflection } from '@/lib/reflection';
import type { TailorShareEntry } from '@/lib/tailorShare';

/**
 * The share shelf (Nov 13, 2026). Sharing used to offer one fixed stack —
 * verse + full reflection + full challenge — in five visual skins: the same
 * words wearing different paint, which is not a real choice. The shelf
 * inverts it: the user first picks WHICH piece of today's devotional to
 * send, and the visual style is the second, lesser choice. Each piece is
 * set alone on its own card, generously — one text, its label, its
 * attribution.
 */

export type SharePieceId = 'verse' | 'reflection' | 'challenge' | 'passage' | 'tradition';

export interface SharePiece {
  id: SharePieceId;
  /** The picker's name for the piece — what the user taps. */
  pickerLabel: string;
  /** The label set on the card itself, above the text. */
  cardLabel: string;
  /** The exact text that ships on the card. */
  text: string;
  /** Citation or author line drawn under the text, when the piece has one. */
  attribution: string | null;
}

/** Splits prose into sentences, keeping terminal punctuation and closing quotes attached. */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g);
  return (matches ?? [cleaned]).map((s) => s.trim()).filter(Boolean);
}

/** Language ABOUT the devotional rather than from it — never the line to send. */
const META_PATTERN =
  /\btoday'?s (gospel|reading|reflection|passage)\b|\bthis (morning|passage|reading|reflection)\b|\bin the gospel\b|\bthe reflection\b/i;

/** Scene-setting openers — narration that needs the sentences around it. */
const SCENE_START = /^(in|on|when|as|after|before|then|meanwhile)\b/i;

/** Sentences that lean on what came before them. */
const DANGLING_START = /^(and|but|so|then|for|yet)\b/i;

/** Verbs that open a sentence as a word spoken TO the reader. */
const IMPERATIVE_START =
  /^(come|go|do|let|take|give|pray|trust|remember|be|seek|ask|forgive|love|wait|rise|return|look|listen|fear not|do not|don'?t|stop|start|choose|hold|keep|leave|bring|tell|thank|repent|believe|watch|stay|rest)\b/i;

function scoreShareSentence(sentence: string, index: number, total: number): number {
  const len = sentence.length;
  let score = 0;

  // Length: a line that can be read at a glance, but with enough body to land.
  if (len >= 50 && len <= 160) score += 4;
  else if (len >= 35 && len < 50) score += 2;
  else if (len > 160 && len <= 200) score += 1;
  else if (len < 35) score -= 2;
  else score -= Math.min(6, Math.floor((len - 200) / 40) + 2);

  // Addressed to the reader, or spoken as an imperative — self-contained by shape.
  if (/\byou\b|\byour\b|\byours\b/i.test(sentence)) score += 3;
  if (IMPERATIVE_START.test(sentence)) score += 4;
  if (/\bwe\b|\bus\b|\bour\b/i.test(sentence)) score += 1;

  // A promise or a paradox carries on its own.
  if (/\bwill\b|\bshall\b/i.test(sentence)) score += 1;
  if (/\bbut\b/i.test(sentence)) score += 1;

  // A balanced two-clause sentence — "not the reward; it is the gift" —
  // is the classic quotable shape.
  if (sentence.includes(';')) score += 2;

  // The first sentence usually sets the scene for the rest; the quotable
  // line tends to come once the scene is set.
  if (index === 0 && total > 1) score -= 3;
  if (index === 0 && SCENE_START.test(sentence)) score -= 3;
  if (index > 0) score += 1;

  // Meta-language talks about the devotional instead of speaking from it.
  if (META_PATTERN.test(sentence)) score -= 8;

  // A sentence that opens mid-thought ships badly.
  if (DANGLING_START.test(sentence)) score -= 2;

  return score;
}

/**
 * The one strongest line of today's reflection — the sentence that can
 * stand alone in someone else's morning. Deterministic: same reflection,
 * same line, every time. Returns '' for empty text (the piece then simply
 * doesn't appear on the shelf).
 */
export function pickShareLine(reflectionText: string): string {
  const sentences = splitSentences(reflectionText ?? '');
  if (sentences.length === 0) return '';
  if (sentences.length === 1) return sentences[0];

  let best = sentences[0];
  let bestScore = -Infinity;
  sentences.forEach((sentence, i) => {
    const score = scoreShareSentence(sentence, i, sentences.length);
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  });
  return best;
}

/**
 * The shelf for today, in the order the pieces are offered: the verse, the
 * reflection's strongest line, the challenge standing alone — then, when
 * the user tailored their morning, the supplement passage and the word from
 * the tradition. A piece whose source is missing today does not appear.
 */
export function buildSharePieces(input: {
  keyVerse: KeyVerse | null;
  reflection: Reflection | null;
  tailorShare: TailorShareEntry | null;
}): SharePiece[] {
  const pieces: SharePiece[] = [];
  const { keyVerse, reflection, tailorShare } = input;

  if (keyVerse?.text) {
    pieces.push({
      id: 'verse',
      pickerLabel: 'The Verse',
      cardLabel: 'THE VERSE',
      text: keyVerse.text,
      attribution: keyVerse.citation ?? null,
    });
  }

  if (reflection?.reflect) {
    const line = pickShareLine(reflection.reflect);
    if (line) {
      pieces.push({
        id: 'reflection',
        pickerLabel: 'The Reflection',
        cardLabel: 'FROM THE REFLECTION',
        text: line,
        attribution: null,
      });
    }
  }

  if (reflection?.challenge) {
    pieces.push({
      id: 'challenge',
      pickerLabel: 'The Challenge',
      cardLabel: "TODAY'S CHALLENGE",
      text: reflection.challenge,
      attribution: null,
    });
  }

  if (tailorShare?.passageExcerpt) {
    pieces.push({
      id: 'passage',
      pickerLabel: 'The Passage',
      cardLabel: 'A WORD FOR TODAY',
      text: tailorShare.passageExcerpt,
      attribution: tailorShare.passageCitation || null,
    });
  }

  if (tailorShare?.traditionQuote?.text) {
    pieces.push({
      id: 'tradition',
      pickerLabel: 'From the Tradition',
      cardLabel: 'FROM THE TRADITION',
      text: tailorShare.traditionQuote.text,
      attribution: tailorShare.traditionQuote.author || null,
    });
  }

  return pieces;
}

export interface ShareCardTextPlan {
  header: string;
  subtitle: string;
  label: string;
  text: string;
  attribution: string | null;
  footer: string;
}

/**
 * Everything a share card says, as pure text — the canvas layout draws
 * exactly this and nothing else, so a test can prove a card carries only
 * its own piece.
 */
export function cardTextPlan(
  piece: SharePiece,
  options: { season?: string | null; celebration?: string | null; facet?: string | null },
): ShareCardTextPlan {
  const subtitle =
    [options.season, options.celebration].filter(Boolean).join(' · ') || 'The Word for today';
  return {
    header: 'DAILY GOSPEL',
    subtitle,
    label: piece.cardLabel,
    text: piece.text,
    attribution: piece.attribution ? `— ${piece.attribution}` : null,
    footer: options.facet ?? 'A word for the road',
  };
}
