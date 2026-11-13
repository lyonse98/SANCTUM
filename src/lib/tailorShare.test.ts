import { describe, it, expect, beforeEach } from 'vitest';
import {
  excerptPassage,
  readTailorShare,
  shareEntryFromDevotional,
  tailorShareKey,
  writeTailorShare,
  type TailorShareEntry,
} from './tailorShare';
import type { TailoredDevotional } from './tailor';

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

const ENTRY: TailorShareEntry = {
  passageCitation: 'Psalm 42:2',
  passageExcerpt: 'As the deer longs for streams of water, so my soul longs for you, O God.',
  traditionQuote: { text: 'Late have I loved you, O Beauty ever ancient, ever new.', author: 'St. Augustine' },
};

describe('the store key', () => {
  it('is dated and tracked, under the sanctum_ prefix the panic wipe clears', () => {
    expect(tailorShareKey('2026-11-13', 'men')).toBe('sanctum_tailor_share_2026-11-13_men');
    expect(tailorShareKey('2026-11-13', 'women')).toBe('sanctum_tailor_share_2026-11-13_women');
  });
});

describe('write / read', () => {
  it('round-trips an entry for its own date and track only', () => {
    writeTailorShare('2026-11-13', 'men', ENTRY);
    expect(readTailorShare('2026-11-13', 'men')).toEqual(ENTRY);
    expect(readTailorShare('2026-11-14', 'men')).toBeNull();
    expect(readTailorShare('2026-11-13', 'women')).toBeNull();
  });

  it('the stored JSON carries exactly the three share fields — nothing else can be smuggled in', () => {
    const poisoned = {
      ...ENTRY,
      freeText: 'my review is at 2 and I am terrified',
      focus: 'work',
      reflect: 'the tailored reflection',
    } as unknown as TailorShareEntry;
    writeTailorShare('2026-11-13', 'men', poisoned);
    const raw = localStorage.getItem(tailorShareKey('2026-11-13', 'men'))!;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['passageCitation', 'passageExcerpt', 'traditionQuote']);
    expect(raw).not.toContain('terrified');
    expect(raw).not.toContain('the tailored reflection');
  });

  it('a malformed stored value reads as no entry', () => {
    localStorage.setItem(tailorShareKey('2026-11-13', 'men'), '{"nope":true}');
    expect(readTailorShare('2026-11-13', 'men')).toBeNull();
    localStorage.setItem(tailorShareKey('2026-11-13', 'men'), 'not json');
    expect(readTailorShare('2026-11-13', 'men')).toBeNull();
  });
});

describe('shareEntryFromDevotional — the field pin', () => {
  const devotional = {
    passage: {
      citation: 'Isaiah 41:10',
      text: 'Do not fear, for I am with you. Do not be dismayed, for I am your God.',
      translation: 'Douay-Rheims',
    },
    traditionQuote: { text: 'Late have I loved you.', author: 'St. Augustine' },
    reflect: 'the tailored reflection — never shared from here',
    challenge: 'the tailored challenge',
    audioBase64: 'AAAA',
  } as unknown as TailoredDevotional;

  it('reads only the passage and the quote', () => {
    const entry = shareEntryFromDevotional(devotional);
    expect(Object.keys(entry).sort()).toEqual(['passageCitation', 'passageExcerpt', 'traditionQuote']);
    expect(entry.passageCitation).toBe('Isaiah 41:10');
    expect(JSON.stringify(entry)).not.toContain('never shared');
    expect(JSON.stringify(entry)).not.toContain('AAAA');
  });

  it('a missing tradition quote stays null', () => {
    const entry = shareEntryFromDevotional({ ...devotional, traditionQuote: null });
    expect(entry.traditionQuote).toBeNull();
    expect(entry.passageCitation).toBe('Isaiah 41:10');
  });
});

describe('excerptPassage', () => {
  it('takes the first sentence when it stands on its own', () => {
    const text =
      'As the deer longs for streams of water, so my soul longs for you, O God. My soul thirsts for God, for the living God.';
    expect(excerptPassage(text)).toBe('As the deer longs for streams of water, so my soul longs for you, O God.');
  });

  it('when the first sentence is a fragment, takes the sentence carrying the key verb', () => {
    const text =
      'A song of trust. My soul waits for the Lord more than watchmen wait for the dawn, and in his word I put my hope. Selah.';
    const excerpt = excerptPassage(text);
    expect(excerpt).toBe('My soul waits for the Lord more than watchmen wait for the dawn, and in his word I put my hope.');
  });

  it('never exceeds the cap — a single endless sentence is clipped at a word boundary', () => {
    const text = `Trust in the Lord ${'and lean not on your own understanding in all your ways '.repeat(6)}acknowledge him.`;
    const excerpt = excerptPassage(text);
    expect(excerpt.length).toBeLessThanOrEqual(200);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('empty text excerpts to empty', () => {
    expect(excerptPassage('')).toBe('');
  });
});
