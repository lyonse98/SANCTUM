import { describe, expect, it } from 'vitest';
import { parseCitation } from './citation.ts';

// Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude) are cited by
// verse alone — "2 John 4-9" is the only chapter, verses 4-9 — so no colon
// ever appears. The main grammar reads that shape's first number as a
// chapter and the fetch misses, silently dropping the reading's text.
describe('parseCitation — single-chapter books', () => {
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

  it('covers the rest of the single-chapter set', () => {
    expect(parseCitation('Obadiah 15')).toEqual({
      book: 31,
      chapter: 1,
      segments: [{ start: 15, end: 15 }],
    });
    expect(parseCitation('3 John 13-14')).toEqual({
      book: 64,
      chapter: 1,
      segments: [{ start: 13, end: 14 }],
    });
  });

  it('degrades a letter-suffixed verse to its number', () => {
    expect(parseCitation('Jude 20b')).toEqual({
      book: 65,
      chapter: 1,
      segments: [{ start: 20, end: 20 }],
    });
  });

  it('leaves the colon shape on a single-chapter book untouched', () => {
    expect(parseCitation('Philemon 1:8-22')).toEqual({
      book: 57,
      chapter: 1,
      segments: [{ start: 8, end: 22 }],
    });
  });
});

describe('parseCitation — preserved shapes', () => {
  it('parses an ordinary chapter:verses citation', () => {
    expect(parseCitation('Luke 17:26-37')).toEqual({
      book: 42,
      chapter: 17,
      segments: [{ start: 26, end: 37 }],
    });
  });

  it('keeps a colonless citation to a multi-chapter book a whole chapter', () => {
    expect(parseCitation('Psalm 119')).toEqual({ book: 19, chapter: 119, segments: [] });
    expect(parseCitation('1 John 5')).toEqual({ book: 62, chapter: 5, segments: [] });
  });

  it('parses a deuterocanonical chapter:verses citation', () => {
    expect(parseCitation('Wisdom 13:1-9')).toEqual({
      book: 73,
      chapter: 13,
      segments: [{ start: 1, end: 9 }],
    });
  });

  it('still takes the first of an "or" alternative pair', () => {
    expect(parseCitation('Daniel 13:1-9 or 13:41c-62')).toEqual({
      book: 27,
      chapter: 13,
      segments: [{ start: 1, end: 9 }],
    });
  });
});
