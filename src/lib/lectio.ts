import type { Passage } from '@/lib/bible';

/**
 * Lectio Divina, the ancient four-movement way of praying Scripture: read, reflect, answer, rest.
 *
 * This exists because the app's Prayer tab was a shelf — fourteen texts in an accordion, each one
 * answering "what is this?" and never "what do I do now?". A shelf is a reference; this is a
 * practice. The same pattern the Workshop already proved three times over (Cold Start, the Breath
 * Pacer, the Examen): numbered steps, a pace, and a finish.
 *
 * The text itself comes from the lectionary, so nothing here is authored content that can go
 * stale — the words are the Church's, the path through them is ours.
 */

export type LectioStepKey = 'lectio' | 'meditatio' | 'oratio' | 'contemplatio';

export interface LectioStep {
  key: LectioStepKey;
  latin: string;
  label: string;
  instruction: string;
  /** The one step where he is asked to write something back. */
  writes?: boolean;
}

export const LECTIO_STEPS: LectioStep[] = [
  {
    key: 'lectio',
    latin: 'Lectio',
    label: 'Read',
    instruction:
      'Read it once slowly. Read it again. Listen for the one word or phrase that catches on you — the one that seems to have been written for today. Do not analyze it. Just notice it.',
  },
  {
    key: 'meditatio',
    latin: 'Meditatio',
    label: 'Reflect',
    instruction:
      'Stay with that word. Turn it over. Where does it touch your life as it actually is right now — your work, your marriage, your worry, the thing you have been avoiding? Let the word meet the real day, not the one you would prefer to be having.',
  },
  {
    key: 'oratio',
    latin: 'Oratio',
    label: 'Pray',
    instruction:
      'Now answer. Speak to God plainly, in your own words, about what you noticed. Not a performance — a conversation. Ask for what you actually need.',
    writes: true,
  },
  {
    key: 'contemplatio',
    latin: 'Contemplatio',
    label: 'Rest',
    instruction:
      'Put the words down. Sit in silence for a moment with what has been given. You are not working now. You are being looked at.',
  },
];

/** The prompt handed to a companion when a man finishes and wants to keep going. */
export function buildLectioPrompt(gospel: Passage, note: string): string {
  const lines = [
    'I prayed today\'s Gospel with Lectio Divina.',
    `\nGospel: ${gospel.citation}`,
    `"${gospel.text}"`,
  ];
  if (note.trim()) {
    lines.push(`\nWhat I said back to God:\n${note.trim()}`);
  }
  lines.push('\nStay with me on this passage. What is it asking of me today?');
  return lines.join('\n');
}
