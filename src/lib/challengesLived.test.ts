import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHALLENGES_LIVED_KEY,
  isChallengeLived,
  listChallengesLived,
  markChallengeLived,
  unmarkChallengeLived,
} from './challengesLived';

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

describe('challengesLived — the journal of challenges taken up', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });

  it('lives under the sanctum_challenges_lived key so the panic wipe clears it', () => {
    expect(CHALLENGES_LIVED_KEY).toBe('sanctum_challenges_lived');
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Visit someone lonely.' });
    expect(localStorage.getItem(CHALLENGES_LIVED_KEY)).toContain('Visit someone lonely.');
  });

  it('starts empty and unmarked', () => {
    expect(listChallengesLived()).toEqual([]);
    expect(isChallengeLived('2026-11-16', 'daily')).toBe(false);
  });

  it('marking keeps the entry with its date, source, and own words', () => {
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Visit someone lonely.' });
    expect(isChallengeLived('2026-11-16', 'daily')).toBe(true);
    expect(isChallengeLived('2026-11-16', 'tailor')).toBe(false);
    expect(isChallengeLived('2026-11-15', 'daily')).toBe(false);
    expect(listChallengesLived()).toEqual([
      { dateKey: '2026-11-16', source: 'daily', text: 'Visit someone lonely.' },
    ]);
  });

  it('marking is idempotent per day and source — the first kept words stand', () => {
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'First wording.' });
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Second wording.' });
    expect(listChallengesLived()).toEqual([
      { dateKey: '2026-11-16', source: 'daily', text: 'First wording.' },
    ]);
    // The other source on the same day is a different challenge entirely.
    markChallengeLived({ dateKey: '2026-11-16', source: 'tailor', text: 'Tailored one.' });
    expect(listChallengesLived()).toHaveLength(2);
  });

  it('unmarking sets the mark aside — that entry only, and it is not an error when absent', () => {
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Daily one.' });
    markChallengeLived({ dateKey: '2026-11-16', source: 'tailor', text: 'Tailored one.' });
    unmarkChallengeLived('2026-11-16', 'daily');
    expect(isChallengeLived('2026-11-16', 'daily')).toBe(false);
    expect(isChallengeLived('2026-11-16', 'tailor')).toBe(true);
    expect(listChallengesLived()).toEqual([
      { dateKey: '2026-11-16', source: 'tailor', text: 'Tailored one.' },
    ]);
    // Setting aside a mark that is not there changes nothing and never throws.
    expect(() => unmarkChallengeLived('2026-11-16', 'daily')).not.toThrow();
    expect(listChallengesLived()).toHaveLength(1);
    // And a set-aside challenge can be marked lived again.
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Daily one.' });
    expect(isChallengeLived('2026-11-16', 'daily')).toBe(true);
  });

  it('lists most recent first — by day, and within a day by latest marked', () => {
    markChallengeLived({ dateKey: '2026-11-14', source: 'daily', text: 'Older day.' });
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Newer day, daily.' });
    markChallengeLived({ dateKey: '2026-11-16', source: 'tailor', text: 'Newer day, tailor.' });
    markChallengeLived({ dateKey: '2026-11-15', source: 'tailor', text: 'Middle day.' });
    expect(listChallengesLived().map((e) => e.text)).toEqual([
      'Newer day, tailor.',
      'Newer day, daily.',
      'Middle day.',
      'Older day.',
    ]);
  });

  it('survives corrupt stored state by reading as empty, never throwing', () => {
    localStorage.setItem(CHALLENGES_LIVED_KEY, '{not json');
    expect(listChallengesLived()).toEqual([]);
    localStorage.setItem(CHALLENGES_LIVED_KEY, JSON.stringify([{ nope: true }, 'junk', null]));
    expect(listChallengesLived()).toEqual([]);
    expect(isChallengeLived('2026-11-16', 'daily')).toBe(false);
    markChallengeLived({ dateKey: '2026-11-16', source: 'daily', text: 'Kept.' });
    expect(listChallengesLived()).toEqual([
      { dateKey: '2026-11-16', source: 'daily', text: 'Kept.' },
    ]);
  });
});

describe('challenges lived — the surface carries the testimony affordance', () => {
  // The affordance's home moved (Erik, Nov 19, 2026): the marks
  // stood under the morning's challenges when this suite was
  // written; they live in Tonight now, at the day's close, gated
  // on the morning having been prayed with the app. The journal
  // behavior pinned above is untouched — only the marking's home.
  const SRC = join(__dirname, '..');
  const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

  it('Tonight renders "I did this" for the day\u2019s challenge and counts the day as a challenge act', () => {
    const tonight = read('components/TonightClosing.tsx');
    expect(tonight).toContain('I did this');
    expect(tonight).toContain('This one was lived.');
    expect(tonight).toContain("recordCoreAct('challenge')");
    expect(tonight).toContain('markChallengeLived');
    expect(tonight).toContain('unmarkChallengeLived');
    expect(tonight).toContain("isChallengeLived(dateKey, 'daily')");
    expect(tonight).toContain("source: 'daily'");
  });

  it('Tonight renders the same affordance for the tailored challenge, as source tailor', () => {
    const tonight = read('components/TonightClosing.tsx');
    expect(tonight).toContain("isChallengeLived(dateKey, 'tailor')");
    expect(tonight).toContain("source: 'tailor'");
    expect(tonight).toContain('loadTodaysTailored');
  });

  it('the morning surfaces no longer carry the mark', () => {
    const card = read('components/DailyQuote.tsx');
    const tailor = read('components/TailorToday.tsx');
    expect(card).not.toContain('I did this');
    expect(tailor).not.toContain('I did this');
    expect(card).not.toContain('markChallengeLived');
    expect(tailor).not.toContain('markChallengeLived');
  });
});
