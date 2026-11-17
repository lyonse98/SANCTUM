import { describe, expect, it } from 'vitest';
import { COMPANION_QUESTIONS } from './companionQuestions';
import { PERSONAS } from '@/personas';

const BANNED = ['been a while', 'last time', 'missed you', 'where have you been', 'streak', 'days since'];

describe('companionQuestions — bank completeness', () => {
  it('has 3 questions for each of the 16 companions plus aquinas (17 entries, 51 questions)', () => {
    const ids = [...PERSONAS.map((p) => p.id), 'aquinas'];
    expect(Object.keys(COMPANION_QUESTIONS).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(COMPANION_QUESTIONS[id], id).toHaveLength(3);
      for (const q of COMPANION_QUESTIONS[id]) {
        expect(typeof q).toBe('string');
        expect(q.trim().length).toBeGreaterThan(10);
        expect(q.trim().endsWith('?')).toBe(true);
      }
    }
    const total = Object.values(COMPANION_QUESTIONS).reduce((n, arr) => n + arr.length, 0);
    expect(total).toBe(51);
  });

  it('contains no banned substrings', () => {
    for (const [id, qs] of Object.entries(COMPANION_QUESTIONS)) {
      for (const q of qs) {
        const lower = q.toLowerCase();
        for (const banned of BANNED) {
          expect(lower.includes(banned), `${id}: ${q}`).toBe(false);
        }
      }
    }
  });

  it('therese (men) and therese-women entries are distinct', () => {
    expect(COMPANION_QUESTIONS['therese']).not.toEqual(COMPANION_QUESTIONS['therese-women']);
  });
});
