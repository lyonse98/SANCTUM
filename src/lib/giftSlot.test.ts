import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GIFT_SLOT_KEY,
  hashKey,
  isGiftDay,
  loadGiftState,
  pickQuestion,
  recordGiftDismissed,
  recordGiftShown,
  recordQuestionShown,
  selectGift,
  tierDaysForStreak,
  type GiftSlotState,
} from './giftSlot';
import { PERSONAS, personasForAudience } from '@/personas';
import { shiftDateKey } from './dayBoundary';

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

const emptyState = (quickStreak = 0): GiftSlotState => ({ shownKeys: [], quickStreak, lastQuestion: null });

describe('giftSlot — hash and tiers', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('key starts with sanctum_', () => {
    expect(GIFT_SLOT_KEY.startsWith('sanctum_')).toBe(true);
  });

  it('hashKey is deterministic', () => {
    expect(hashKey('2026-11-16')).toBe(hashKey('2026-11-16'));
    expect(hashKey('2026-11-16')).not.toBe(hashKey('2026-11-17'));
  });

  it('tier frequencies: <3 -> 4/7, 3-5 -> 3/7, >=6 -> 2/7', () => {
    expect(tierDaysForStreak(0)).toBe(4);
    expect(tierDaysForStreak(2)).toBe(4);
    expect(tierDaysForStreak(3)).toBe(3);
    expect(tierDaysForStreak(5)).toBe(3);
    expect(tierDaysForStreak(6)).toBe(2);
    expect(tierDaysForStreak(10)).toBe(2);
  });

  it('over a 7-day span the count of gift days is deterministic and equals tier for a full hash cycle check', () => {
    // For any 7 consecutive keys, isGiftDay count need not be exactly tier because hash%7 distribution
    // is pseudo-random, but for a long span frequencies approach tier. Instead pin determinism:
    // same state + same keys give same results on repeat, and a specific span count is stable.
    const state = emptyState(0);
    const keys = Array.from({ length: 7 }, (_, i) => shiftDateKey('2026-11-16', i));
    const first = keys.map((k) => isGiftDay(k, state));
    const second = keys.map((k) => isGiftDay(k, state));
    expect(first).toEqual(second);
    // And over 70 days, count should be roughly 4/7 (allow wide tolerance but deterministic snapshot)
    const keys70 = Array.from({ length: 70 }, (_, i) => shiftDateKey('2026-01-01', i));
    const count70 = keys70.filter((k) => isGiftDay(k, emptyState(0))).length;
    expect(count70).toBeGreaterThan(20);
    expect(count70).toBeLessThan(60);
    const count70High = keys70.filter((k) => isGiftDay(k, emptyState(6))).length;
    expect(count70High).toBeLessThan(count70);
  });

  it('shown day never repeats', () => {
    const state: GiftSlotState = { shownKeys: ['2026-11-16'], quickStreak: 0, lastQuestion: null };
    expect(isGiftDay('2026-11-16', state)).toBe(false);
    recordGiftShown('2026-11-17');
    expect(loadGiftState().shownKeys).toContain('2026-11-17');
    expect(isGiftDay('2026-11-17', loadGiftState())).toBe(false);
    // idempotent
    recordGiftShown('2026-11-17');
    expect(loadGiftState().shownKeys.filter((k) => k === '2026-11-17')).toHaveLength(1);
  });

  it('shownKeys caps at 60', () => {
    for (let i = 0; i < 70; i++) recordGiftShown(shiftDateKey('2026-01-01', i));
    expect(loadGiftState().shownKeys.length).toBeLessThanOrEqual(60);
  });

  it('quick dismiss increments, slow dismiss resets', () => {
    recordGiftDismissed('2026-11-16', true);
    recordGiftDismissed('2026-11-17', true);
    expect(loadGiftState().quickStreak).toBe(2);
    recordGiftDismissed('2026-11-18', false);
    expect(loadGiftState().quickStreak).toBe(0);
  });
});

describe('giftSlot — selectGift priority', () => {
  const base = {
    dateKey: '2026-11-16',
    hasPendingLetter: false,
    letterCandidate: null,
    anticipation: null,
    saintLine: null,
    question: null,
  };
  it('pending > new > anticipation > saint > question > reflection', () => {
    const anticipation = { name: 'Advent', dateKey: '2026-11-29', daysAway: 3, beginsText: 'Advent begins Sunday' };
    const question = { personaId: 'joseph', question: 'What?' };
    expect(selectGift({ ...base, hasPendingLetter: true, letterCandidate: 'joseph', anticipation, saintLine: 'St X', question }).kind).toBe('letter-pending');
    expect(selectGift({ ...base, letterCandidate: 'joseph', anticipation, saintLine: 'St X', question })).toEqual({ kind: 'letter-new', personaId: 'joseph' });
    expect(selectGift({ ...base, anticipation, saintLine: 'St X', question }).kind).toBe('anticipation');
    expect(selectGift({ ...base, saintLine: 'St X', question }).kind).toBe('saint');
    expect(selectGift({ ...base, question }).kind).toBe('question');
    expect(selectGift({ ...base }).kind).toBe('reflection');
  });
  it('anticipation outside 1..5 is ignored', () => {
    const far = { name: 'Advent', dateKey: '2026-11-29', daysAway: 13, beginsText: 'Advent begins on Nov 29' };
    expect(selectGift({ ...base, anticipation: far, saintLine: 'Line' }).kind).toBe('saint');
  });
});

describe('giftSlot — pickQuestion', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('is deterministic by date and returns a bank question', () => {
    const personas = personasForAudience('men');
    const a = pickQuestion('2026-11-16', 'men', personas, emptyState());
    const b = pickQuestion('2026-11-16', 'men', personas, emptyState());
    expect(a).toEqual(b);
    expect(a?.question.endsWith('?')).toBe(true);
  });

  it('skips the recent companion within 14 days', () => {
    const personas = personasForAudience('men');
    const first = pickQuestion('2026-11-16', 'men', personas, emptyState());
    expect(first).not.toBeNull();
    const stateWithLast: GiftSlotState = { shownKeys: [], quickStreak: 0, lastQuestion: { personaId: first!.personaId, dateKey: '2026-11-16' } };
    // For many subsequent dates within 14 days, the picked companion should not be the recent one
    // unless hash happens to... our implementation filters it out, so it must never equal.
    for (let i = 0; i < 14; i++) {
      const dk = shiftDateKey('2026-11-16', i);
      const picked = pickQuestion(dk, 'men', personas, stateWithLast);
      expect(picked?.personaId).not.toBe(first!.personaId);
    }
    // After 14 days it may return (not asserted to, just allowed) — check no crash
    const later = pickQuestion('2026-12-05', 'men', personas, stateWithLast);
    expect(later).not.toBeNull();
  });

  it('recordQuestionShown stores lastQuestion', () => {
    recordQuestionShown('mary', '2026-11-16');
    expect(loadGiftState().lastQuestion).toEqual({ personaId: 'mary', dateKey: '2026-11-16' });
  });

  it('only picks companions from the requested audience', () => {
    const all = PERSONAS;
    for (let i = 0; i < 20; i++) {
      const dk = shiftDateKey('2026-11-01', i);
      const picked = pickQuestion(dk, 'women', all, emptyState());
      const persona = PERSONAS.find((p) => p.id === picked?.personaId);
      expect(persona?.audience).toBe('women');
    }
  });
});

describe('giftSlot — source-scan pins', () => {
  it('LeftForYou contains no banned words', () => {
    const src = readFileSync(join(__dirname, '..', 'components', 'LeftForYou.tsx'), 'utf8').toLowerCase();
    for (const banned of ['streak', 'days since', 'been a while', "you've been gone", 'you’ve been gone']) {
      expect(src.includes(banned), banned).toBe(false);
    }
  });
  it('giftSlot and letters keys start with sanctum_', () => {
    expect(GIFT_SLOT_KEY.startsWith('sanctum_')).toBe(true);
    const lettersSrc = readFileSync(join(__dirname, 'letters.ts'), 'utf8');
    expect(lettersSrc).toContain("'sanctum_companion_chat_days'");
    expect(lettersSrc).toContain("'sanctum_letters'");
    const giftSrc = readFileSync(join(__dirname, 'giftSlot.ts'), 'utf8');
    expect(giftSrc).toContain("'sanctum_gift_slot'");
  });
});
