const HARD_CRISIS_KEYWORDS = [
  'suicide',
  'kill myself',
  'want to die',
  'end it all',
  'end my life',
  'take my life',
  'better off dead',
  'no reason to live',
  'dont want to live',
  "don't want to live",
  'going to kill',
  'hurt myself',
  'cutting myself',
  'overdose',
  'jump off',
  'hang myself',
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
  const lower = input.toLowerCase();
  if (HARD_CRISIS_KEYWORDS.some((kw) => lower.includes(kw))) return 'hard';
  if (SOFT_DISTRESS_KEYWORDS.some((kw) => lower.includes(kw))) return 'soft';
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
