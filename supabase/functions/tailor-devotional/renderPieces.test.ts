import { describe, expect, it } from 'vitest';
import { splitReadingsParagraphs } from './renderPieces.ts';

// The free-plan render peak: the readings entire are spoken piece by piece,
// split where narratorCore joined them (blank lines between paragraphs).
describe('splitReadingsParagraphs', () => {
  it('splits on the paragraph boundaries narratorCore joins with', () => {
    const readings = [
      'A reading from the Book of Genesis.\nIn the beginning God created the heavens and the earth.',
      'The responsorial psalm — Psalm 95.\nIf today you hear his voice, harden not your hearts.',
      'A reading from the Gospel according to John.\nIn the beginning was the Word.',
      'The Gospel of the Lord.',
      'Praise to you, Lord Jesus Christ.',
    ].join('\n\n');
    const parts = splitReadingsParagraphs(readings);
    expect(parts).toHaveLength(5);
    expect(parts[0]).toContain('A reading from the Book of Genesis.');
    expect(parts[2]).toContain('from the Gospel according to John');
    // Round trip: the pieces are the whole text, in order, nothing lost.
    expect(parts.join('\n\n')).toBe(readings);
  });

  it('keeps a single-paragraph reading whole', () => {
    const readings = 'A reading from the Gospel according to Luke.\nOne unbroken passage.';
    expect(splitReadingsParagraphs(readings)).toEqual([readings]);
  });

  it('drops blank runs instead of speaking silence-shaped text', () => {
    expect(splitReadingsParagraphs('First.\n\n\n\nSecond.')).toEqual(['First.', 'Second.']);
    expect(splitReadingsParagraphs('')).toEqual([]);
    expect(splitReadingsParagraphs('\n\n')).toEqual([]);
  });

  it('preserves each paragraph byte-for-byte (no trimming of real text)', () => {
    const readings = 'Intro line.\nText with a trailing space. \n\nNext part.';
    const parts = splitReadingsParagraphs(readings);
    expect(parts[0]).toBe('Intro line.\nText with a trailing space. ');
    expect(parts[1]).toBe('Next part.');
  });
});
