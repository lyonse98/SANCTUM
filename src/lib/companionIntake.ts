import { PERSONAS } from '@/personas';
import { SEASONS_OF_LIFE } from './tailorProfile';
import type { Audience } from '@/types';

/**
 * The companion intake (Erik, Nov 19, 2026). When a conversation with a
 * companion begins — the stored thread empty, whether never started or
 * just cleared — the chat opens not with a bare page but with a short
 * survey: the companion asks four fixed questions, one at a time, the
 * way a person who means to listen would start. The questions are the
 * app's, authored here, the same for every user of a track; no model
 * invents them, and no answer is scored, stored, or sent anywhere on
 * its own.
 *
 * The answers live exactly one life: when the intake ends they are
 * composed into a single opening message in the person's own terms and
 * sent through the ordinary send path, as the conversation's first
 * message. The user sees precisely what the companion was told, because
 * it stands in the feed as their own words. The intake itself keeps NO
 * state of its own — no storage key, no record beside the conversation
 * it seeded — and leaving mid-intake discards the partial answers with
 * the component that held them.
 */

export type IntakeStepId = 'brings' | 'season' | 'help' | 'words';

export interface IntakeAnswer {
  /** What the answer shows as, in the intake's own transcript — the chip's label, or the person's typed words. */
  display: string;
  /** The phrase the answer contributes to the seed message. */
  seed: string;
}

export type IntakeAnswers = Partial<Record<IntakeStepId, IntakeAnswer>>;

export interface IntakeChip {
  label: string;
  seed: string;
}

export interface IntakeQuestion {
  id: IntakeStepId;
  prompt: string;
  /** The choices, or null on the closing question, which is free text only. */
  chips: IntakeChip[] | null;
}

const BRINGS_CHIPS: IntakeChip[] = [
  { label: 'Carrying something heavy', seed: 'carrying something heavy' },
  { label: 'A decision', seed: 'a decision' },
  { label: 'Gratitude', seed: 'gratitude' },
  { label: 'Just want company', seed: 'just wanting company' },
  { label: 'Curious', seed: 'curiosity' },
];

const HELP_CHIPS: IntakeChip[] = [
  { label: 'To be heard', seed: 'to be heard' },
  { label: 'Perspective', seed: 'perspective' },
  { label: 'A challenge', seed: 'a challenge' },
  { label: 'Prayer', seed: 'prayer' },
];

const lowerFirst = (text: string): string => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/**
 * The four questions, in the order they are asked. The season question's
 * chips are the track's own SEASONS_OF_LIFE vocabulary, read from the
 * Tailor profile data — the list lives there and nowhere else.
 */
export function intakeQuestions(audience: Audience): IntakeQuestion[] {
  return [
    { id: 'brings', prompt: 'What brings you here today?', chips: BRINGS_CHIPS },
    {
      id: 'season',
      prompt: 'Where is your life right now?',
      chips: SEASONS_OF_LIFE[audience].map((s) => ({ label: s.label, seed: lowerFirst(s.label) })),
    },
    { id: 'help', prompt: 'What would help most?', chips: HELP_CHIPS },
    { id: 'words', prompt: 'Anything else — in your own words?', chips: null },
  ];
}

// ── The flow ────────────────────────────────────────────────────────────────

export interface IntakeState {
  /** Index into the questions; equal to the question count when the intake is done. */
  stepIndex: number;
  /** On a chip question: the choices stand, or the own-words field has been swapped in. */
  mode: 'chips' | 'words';
  answers: IntakeAnswers;
  done: boolean;
}

export const initialIntakeState: IntakeState = { stepIndex: 0, mode: 'chips', answers: {}, done: false };

export type IntakeAction =
  | { type: 'chip'; chip: IntakeChip }
  | { type: 'own-words' }
  | { type: 'back-to-chips' }
  | { type: 'words'; text: string };

function advance(state: IntakeState, questions: IntakeQuestion[], answers: IntakeAnswers): IntakeState {
  const stepIndex = state.stepIndex + 1;
  return { stepIndex, mode: 'chips', answers, done: stepIndex >= questions.length };
}

/**
 * The intake as a pure flow, so the conversation it makes can be tested
 * without a screen: a chip answers and advances; the own-words escape
 * swaps the field in; typed words answer in the person's own terms —
 * an empty submission is a pass, advancing without recording; the
 * closing question's words, given or passed over, end the intake.
 */
export function intakeReducer(state: IntakeState, action: IntakeAction, questions: IntakeQuestion[]): IntakeState {
  if (state.done) return state;
  const question = questions[state.stepIndex];
  if (!question) return { ...state, done: true };
  switch (action.type) {
    case 'own-words':
      return question.chips ? { ...state, mode: 'words' } : state;
    case 'back-to-chips':
      return question.chips ? { ...state, mode: 'chips' } : state;
    case 'chip': {
      if (!question.chips) return state;
      const answers = { ...state.answers, [question.id]: { display: action.chip.label, seed: action.chip.seed } };
      return advance(state, questions, answers);
    }
    case 'words': {
      const text = action.text.trim();
      const answers = text
        ? { ...state.answers, [question.id]: { display: text, seed: text } }
        : state.answers;
      return advance(state, questions, answers);
    }
    default:
      return state;
  }
}

// ── The seed ────────────────────────────────────────────────────────────────

/** A sentence ends where the person's words already end it; otherwise the composition closes it. */
function withPeriod(text: string): string {
  return /[.!?…]["'”’)]?$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

/**
 * The answers as one opening message, in the person's own terms — the
 * first thing the companion is told, and the first thing standing in
 * the feed under the person's own name. Null when nothing was answered:
 * an intake skipped at the door seeds nothing, and the chat is the
 * plain empty state it has always been.
 */
export function composeIntakeSeed(answers: IntakeAnswers): string | null {
  const parts: string[] = [];
  if (answers.brings) parts.push(`What brings me here: ${withPeriod(answers.brings.seed)}`);
  if (answers.season) parts.push(`Where my life is right now: ${withPeriod(answers.season.seed)}`);
  if (answers.help) parts.push(`What would help most: ${withPeriod(answers.help.seed)}`);
  if (answers.words) parts.push(`In my own words: ${withPeriod(answers.words.seed)}`);
  return parts.length > 0 ? parts.join(' ') : null;
}

// ── Who is asked ────────────────────────────────────────────────────────────

/**
 * The intake belongs to the companions — the sixteen of the two casts.
 * Aquinas is not among them and never stands in the chat view at all:
 * the Ask door is a Catechism surface, not a conversation, and it asks
 * nothing. The set is the cast itself, read off PERSONAS, so a
 * companion added to the bank is asked after like the rest.
 */
const INTAKE_COMPANION_IDS: ReadonlySet<string> = new Set(PERSONAS.map((p) => p.id));

export function showsIntake(personaId: string): boolean {
  return INTAKE_COMPANION_IDS.has(personaId);
}
