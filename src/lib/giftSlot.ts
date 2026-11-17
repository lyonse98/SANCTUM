import { shiftDateKey } from './dayBoundary';
import { COMPANION_QUESTIONS } from '@/data/companionQuestions';
import type { Audience } from '@/types';

export const GIFT_SLOT_KEY = 'sanctum_gift_slot';

export interface GiftSlotState {
  shownKeys: string[];
  quickStreak: number;
  lastQuestion: { personaId: string; dateKey: string } | null;
}

export const DEFAULT_GIFT_STATE: GiftSlotState = { shownKeys: [], quickStreak: 0, lastQuestion: null };

export function hashKey(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export function loadGiftState(): GiftSlotState {
  try {
    const raw = localStorage.getItem(GIFT_SLOT_KEY);
    if (!raw) return { ...DEFAULT_GIFT_STATE, shownKeys: [] };
    const parsed = JSON.parse(raw) as Partial<GiftSlotState>;
    return {
      shownKeys: Array.isArray(parsed.shownKeys) ? parsed.shownKeys.filter((x): x is string => typeof x === 'string') : [],
      quickStreak: typeof parsed.quickStreak === 'number' && Number.isFinite(parsed.quickStreak) ? parsed.quickStreak : 0,
      lastQuestion:
        parsed.lastQuestion && typeof parsed.lastQuestion.personaId === 'string' && typeof parsed.lastQuestion.dateKey === 'string'
          ? parsed.lastQuestion
          : null,
    };
  } catch {
    return { ...DEFAULT_GIFT_STATE, shownKeys: [] };
  }
}

function writeGiftState(state: GiftSlotState): void {
  try {
    localStorage.setItem(GIFT_SLOT_KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
}

export function tierDaysForStreak(quickStreak: number): number {
  if (quickStreak < 3) return 4;
  if (quickStreak <= 5) return 3;
  return 2;
}

export function isGiftDay(dateKey: string, state: GiftSlotState = loadGiftState()): boolean {
  try {
    if (state.shownKeys.includes(dateKey)) return false;
    const tierDays = tierDaysForStreak(state.quickStreak);
    return hashKey(dateKey) % 7 < tierDays;
  } catch {
    return false;
  }
}

export type GiftKind = 'letter-pending' | 'letter-new' | 'anticipation' | 'saint' | 'question' | 'reflection';

export interface GiftInput {
  dateKey: string;
  hasPendingLetter: boolean;
  letterCandidate: string | null;
  anticipation: { name: string; dateKey: string; daysAway: number; beginsText: string } | null;
  saintLine: string | null;
  question: { personaId: string; question: string } | null;
  audience?: Audience;
}

export type Gift =
  | { kind: 'letter-pending' }
  | { kind: 'letter-new'; personaId: string }
  | { kind: 'anticipation'; anticipation: NonNullable<GiftInput['anticipation']> }
  | { kind: 'saint'; saintLine: string }
  | { kind: 'question'; personaId: string; question: string }
  | { kind: 'reflection' };

export function selectGift(input: GiftInput): Gift {
  if (input.hasPendingLetter) return { kind: 'letter-pending' };
  if (input.letterCandidate) return { kind: 'letter-new', personaId: input.letterCandidate };
  if (input.anticipation && input.anticipation.daysAway > 0 && input.anticipation.daysAway <= 5) {
    return { kind: 'anticipation', anticipation: input.anticipation };
  }
  if (input.saintLine) return { kind: 'saint', saintLine: input.saintLine };
  if (input.question) return { kind: 'question', personaId: input.question.personaId, question: input.question.question };
  return { kind: 'reflection' };
}

interface PersonaLike {
  id: string;
  audience?: string;
  name?: string;
}

export function pickQuestion(
  dateKey: string,
  audience: Audience,
  personas: PersonaLike[],
  state: GiftSlotState = loadGiftState(),
): { personaId: string; question: string } | null {
  try {
    const pool = personas.filter((p) => !p.audience || p.audience === audience);
    if (!pool.length) return null;
    // Determine if lastQuestion is within 14 days
    let skipId: string | null = null;
    if (state.lastQuestion) {
      // Compute difference: shift last date by +14 and compare? Use iterative shifting.
      // dateKey - lastDateKey in days: walk forward from earlier to later.
      const lastKey = state.lastQuestion.dateKey;
      // If lastKey <= dateKey <= shift(lastKey,14) then within 14 days
      if (lastKey <= dateKey && dateKey <= shiftDateKey(lastKey, 14)) {
        skipId = state.lastQuestion.personaId;
      }
    }
    const candidates = pool.filter((p) => p.id !== skipId);
    const usable = candidates.length ? candidates : pool;
    const idx = hashKey(dateKey) % usable.length;
    const persona = usable[idx];
    const bank = COMPANION_QUESTIONS[persona.id];
    if (!bank || !bank.length) return null;
    const qIdx = hashKey(dateKey + persona.id) % 3;
    const question = bank[qIdx % bank.length];
    return { personaId: persona.id, question };
  } catch {
    return null;
  }
}

export function recordGiftShown(dateKey: string): void {
  try {
    const state = loadGiftState();
    if (!state.shownKeys.includes(dateKey)) {
      state.shownKeys.push(dateKey);
      if (state.shownKeys.length > 60) state.shownKeys = state.shownKeys.slice(-60);
      writeGiftState(state);
    }
  } catch {
    // best effort
  }
}

export function recordGiftDismissed(dateKey: string, wasQuick: boolean): void {
  // dateKey kept for API symmetry / future use; the streak is the state that changes.
  void dateKey;
  try {
    const state = loadGiftState();
    state.quickStreak = wasQuick ? state.quickStreak + 1 : 0;
    writeGiftState(state);
  } catch {
    // best effort
  }
}

export function recordQuestionShown(personaId: string, dateKey: string): void {
  try {
    const state = loadGiftState();
    state.lastQuestion = { personaId, dateKey };
    writeGiftState(state);
  } catch {
    // best effort
  }
}
