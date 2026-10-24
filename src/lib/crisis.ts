/**
 * Crisis detection. Two layers:
 *
 * HARD — the conversation stops and the full-screen crisis card shows. Detection must be
 * high-precision: a false alarm on ordinary speech ("I'm going to kill it in this
 * presentation") teaches a man to route around the safety net, so high-risk verbs require
 * a self-directed object, and only unambiguous phrases match on their own.
 *
 * SOFT — a gentleness flag is sent with the request so the companion responds with extra
 * care. Low precision is acceptable here; nothing visible changes.
 *
 * Both layers match against NORMALIZED text (lowercased, curly apostrophes straightened,
 * punctuation collapsed) so "don't" / "dont" / "don’t" are the same input.
 * The phrase test set in crisis.test.ts is the contract: change the lists, run the tests.
 */

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Phrases that are unambiguous on their own, matched against normalized text. */
const HARD_PHRASES = [
  'suicide',
  'suicidal',
  'kill myself',
  'end my life',
  'take my life',
  'want to die',
  'wanna die',
  'better off dead',
  'better off without me',
  'no reason to live',
  'no point in living',
  'no point to live',
  "don't want to live",
  'dont want to live',
  'do not want to live',
  "don't want to be here anymore",
  'dont want to be here anymore',
  'do not want to be here anymore',
  'wish i was dead',
  'wish i were dead',
  'wishing i was dead',
  'wishing i were dead',
  'wish i was not alive',
  'end it all',
  'ending it all',
  'hurt myself',
  'hurting myself',
  'harming myself',
  'self harm',
  'cutting myself',
  'end my suffering',
  'overdose myself',
  'overdosing',
];

/** Patterns where a high-risk word only counts with a self-directed object or a concrete means. */
const HARD_PATTERNS: RegExp[] = [
  /\b(kill|hang|shoot|stab|drown|strangle)\s+(myself|me)\b/,
  /\bjump\s+(off|from)\s+(a\s+|the\s+)?(bridge|building|roof|cliff|window|balcony)\b/,
  /\bhang\s+myself\b/,
  /\b(take|took|taking)\s+all\s+(my|the)\s+pills\b/,
  /\bslit\s+my\s+wrists\b/,
];

const SOFT_DISTRESS_KEYWORDS = [
  "can't go on",
  'cant go on',
  'no way out',
  'giving up',
  'i give up',
  'too much to bear',
  'cannot bear',
  'cant bear it',
  'hopeless',
  'worthless',
  'empty',
  'numb',
  'exhausted',
  'trapped',
  'alone',
  'no one cares',
  'nobody cares',
  'falling apart',
  'broken',
];

export type CrisisLevel = 'hard' | 'soft' | null;

export function detectCrisis(input: string): boolean {
  return detectCrisisLevel(input) === 'hard';
}

export function detectCrisisLevel(input: string): CrisisLevel {
  const text = normalize(input);
  if (HARD_PHRASES.some((kw) => text.includes(kw))) return 'hard';
  if (HARD_PATTERNS.some((re) => re.test(text))) return 'hard';
  if (SOFT_DISTRESS_KEYWORDS.some((kw) => text.includes(kw))) return 'soft';
  return null;
}

export interface CrisisResource {
  label: string;
  action: string;
  detail: string;
  href: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    label: '988 Suicide & Crisis Lifeline',
    action: 'Call or Text 988',
    detail: 'Available 24/7 in the US',
    href: 'tel:988',
  },
  {
    label: 'Crisis Text Line',
    action: 'Text HOME to 741741',
    detail: 'Free 24/7 text-based support',
    href: 'sms:741741?&body=HOME',
  },
  {
    label: 'Veterans Crisis Line',
    action: 'Dial 988 then press 1',
    detail: 'For veterans and their loved ones',
    href: 'tel:988',
  },
  {
    label: 'National Domestic Violence Hotline',
    action: 'Call 1-800-799-7233',
    detail: '24/7 confidential support',
    href: 'tel:18007997233',
  },
  {
    label: 'Find A Helpline (International)',
    action: 'findahelpline.com',
    detail: 'Find crisis support outside the US',
    href: 'https://findahelpline.com',
  },
];
