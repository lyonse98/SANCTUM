import { beforeEach, describe, expect, it } from 'vitest';
import {
  LETTER_THREADS_KEY,
  appendLetterThread,
  latestLetterThread,
  listLetterThreads,
} from './letterThreads';

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

describe('letter threads — the Tailor offering kept for a letter', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('the key starts with sanctum_ (panic-wipe prefix)', () => {
    expect(LETTER_THREADS_KEY.startsWith('sanctum_')).toBe(true);
  });

  it('appends a thread with its day’s enums, most recent first', () => {
    appendLetterThread('2026-11-10', { sentence: 'My father is in hospital.', state: 'anxious', focus: 'family', tone: 'comfort' });
    appendLetterThread('2026-11-12', { sentence: 'The review is Friday.', state: 'scattered', focus: 'work', tone: 'courage' });
    expect(listLetterThreads().map((t) => t.date)).toEqual(['2026-11-12', '2026-11-10']);
    expect(latestLetterThread()).toEqual({
      date: '2026-11-12',
      sentence: 'The review is Friday.',
      state: 'scattered',
      focus: 'work',
      tone: 'courage',
    });
  });

  it('one entry per day — the day’s latest build wins', () => {
    appendLetterThread('2026-11-10', { sentence: 'First words.' });
    appendLetterThread('2026-11-10', { sentence: 'Truer words.', focus: 'grief' });
    expect(listLetterThreads()).toHaveLength(1);
    expect(latestLetterThread()?.sentence).toBe('Truer words.');
  });

  it('keeps only the most recent five', () => {
    for (let d = 1; d <= 7; d++) {
      appendLetterThread(`2026-11-0${d}`, { sentence: `Day ${d}.` });
    }
    expect(listLetterThreads().map((t) => t.date)).toEqual([
      '2026-11-07',
      '2026-11-06',
      '2026-11-05',
      '2026-11-04',
      '2026-11-03',
    ]);
  });

  it('an empty sentence keeps nothing — no thread is handed to a letter', () => {
    appendLetterThread('2026-11-10', { sentence: '   ' });
    expect(listLetterThreads()).toEqual([]);
    expect(latestLetterThread()).toBeNull();
  });

  it('the sentence is normalized and capped at 200 chars, as the build call caps it', () => {
    appendLetterThread('2026-11-10', { sentence: `  Many   spaces\nand ${'x'.repeat(300)}` });
    const t = latestLetterThread();
    expect(t?.sentence.startsWith('Many spaces and ')).toBe(true);
    expect(t?.sentence.length).toBe(200);
  });

  it('a malformed store reads back clean — bad entries drop, good ones stand', () => {
    localStorage.setItem(
      LETTER_THREADS_KEY,
      JSON.stringify([
        { date: 'not-a-date', sentence: 'Bad.' },
        { date: '2026-11-10', sentence: 'Good.', state: 'bogus', focus: 'work' },
        'junk',
      ]),
    );
    expect(listLetterThreads()).toEqual([{ date: '2026-11-10', sentence: 'Good.', focus: 'work' }]);
  });
});
