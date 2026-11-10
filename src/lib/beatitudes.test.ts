import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BEATITUDES,
  LENS_STORAGE_KEY,
  loadExaminationLens,
  saveExaminationLens,
} from './beatitudes';

/**
 * The Beatitudes lens for Confession prep. Guards: the examination is all eight
 * beatitudes in Matthew's order, each fully written (verse, framing, a small set of
 * concrete questions); the lens defaults to the Ten Commandments and only remembers
 * a man's choice on his own device; and the guide wires both lenses while leaving
 * the existing Commandments examination intact.
 */

/** Minimal Storage whose keys are own enumerable properties, like the browser's. */
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

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
});

describe('the Beatitudes examination', () => {
  it('covers all eight beatitudes in Matthew 5:3–10 order', () => {
    expect(BEATITUDES).toHaveLength(8);
    expect(BEATITUDES.map((b) => b.ref)).toEqual([
      'Matthew 5:3',
      'Matthew 5:4',
      'Matthew 5:5',
      'Matthew 5:6',
      'Matthew 5:7',
      'Matthew 5:8',
      'Matthew 5:9',
      'Matthew 5:10',
    ]);
  });

  it('every beatitude carries its verse, a framing line, and 2–4 questions', () => {
    for (const b of BEATITUDES) {
      expect(b.verse.startsWith('Blessed are'), b.ref).toBe(true);
      expect(b.framing.trim().length, b.ref).toBeGreaterThan(0);
      expect(b.questions.length, b.ref).toBeGreaterThanOrEqual(2);
      expect(b.questions.length, b.ref).toBeLessThanOrEqual(4);
      for (const q of b.questions) expect(q.trim().endsWith('?'), `${b.ref}: ${q}`).toBe(true);
    }
  });
});

describe('the examination lens', () => {
  it('defaults to the Ten Commandments', () => {
    expect(loadExaminationLens()).toBe('commandments');
  });

  it('remembers the Beatitudes once chosen', () => {
    saveExaminationLens('beatitudes');
    expect(localStorage.getItem(LENS_STORAGE_KEY)).toBe('beatitudes');
    expect(loadExaminationLens()).toBe('beatitudes');
  });

  it('switching back restores the Commandments', () => {
    saveExaminationLens('beatitudes');
    saveExaminationLens('commandments');
    expect(loadExaminationLens()).toBe('commandments');
  });

  it('any stored value other than "beatitudes" reads as the Commandments', () => {
    localStorage.setItem(LENS_STORAGE_KEY, 'something-else');
    expect(loadExaminationLens()).toBe('commandments');
  });
});

describe('the Confession guide wiring', () => {
  const guide = readFileSync(new URL('../components/ConfessionGuide.tsx', import.meta.url), 'utf8');

  it('offers the two-lens choice', () => {
    expect(guide).toContain('Examine by:');
    expect(guide).toContain('The Ten Commandments');
    expect(guide).toContain('The Beatitudes');
  });

  it('renders the Beatitudes examination from the lib content', () => {
    expect(guide).toContain("from '@/lib/beatitudes'");
    // Women's Mode: the guide renders the set getBeatitudes(audience) selects
    // from this lib — still single-sourced here, never copied into the component.
    expect(guide).toContain('getBeatitudes');
    expect(guide).toContain('beatitudes.map');
  });

  it('the existing Commandments examination is untouched', () => {
    // The examination data moved verbatim into lib/confession.ts when Women's
    // Mode factored it into a testable module; the men's text itself is the
    // original, asserted there, and the guide renders it via the getter.
    const confession = readFileSync(new URL('./confession.ts', import.meta.url), 'utf8');
    expect(confession).toContain('I am the Lord your God; you shall not have strange gods before Me');
    expect(confession).toContain('You shall not bear false witness');
    expect(confession).toContain('DUTIES_OF_STATE');
    expect(guide).toContain('getCommandments');
    expect(guide).toContain('getDutiesOfState');
  });
});
