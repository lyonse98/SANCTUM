import { describe, expect, it } from 'vitest';
import { parseCitation } from './bible';

// The client twin of the daily-readings function's citation grammar — the two
// must parse identically (see supabase/functions/daily-readings/citation.ts).
// Single-chapter books are cited by verse alone ("2 John 4-9" = chapter 1,
// verses 4-9); the old grammar read the 4 as a chapter and dropped the text.
describe('parseCitation (client) — single-chapter books', () => {
  it('reads a verse range with no chapter as chapter 1', () => {
    expect(parseCitation('2 John 4-9')).toEqual({
      book: 63,
      chapter: 1,
      segments: [{ start: 4, end: 9 }],
    });
  });

  it('reads a comma list of verses and ranges', () => {
    expect(parseCitation('Jude 17, 20-25')).toEqual({
      book: 65,
      chapter: 1,
      segments: [
        { start: 17, end: 17 },
        { start: 20, end: 25 },
      ],
    });
  });

  it('reads a bare verse', () => {
    expect(parseCitation('Philemon 6')).toEqual({
      book: 57,
      chapter: 1,
      segments: [{ start: 6, end: 6 }],
    });
  });
});

describe('parseCitation (client) — preserved shapes', () => {
  it('parses an ordinary chapter:verses citation', () => {
    expect(parseCitation('Luke 17:26-37')).toEqual({
      book: 42,
      chapter: 17,
      segments: [{ start: 26, end: 37 }],
    });
  });

  it('keeps a colonless citation to a multi-chapter book a whole chapter', () => {
    expect(parseCitation('Psalm 119')).toEqual({ book: 19, chapter: 119, segments: [] });
  });

  it('parses a deuterocanonical chapter:verses citation', () => {
    expect(parseCitation('Wisdom 13:1-9')).toEqual({
      book: 73,
      chapter: 13,
      segments: [{ start: 1, end: 9 }],
    });
  });
});
