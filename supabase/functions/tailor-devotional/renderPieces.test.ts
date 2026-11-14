import { describe, expect, it } from 'vitest';
import {
  TAILOR_PIECE_MAX_CHARS,
  splitReadingsParagraphs,
  splitSpokenText,
} from './renderPieces.ts';

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

// The plan's cap: ~15 s of speech per piece, the envelope whose CPU fits a
// single edge request. Every chunk must respect it, however the text falls.
describe('splitSpokenText', () => {
  it('packs small paragraphs together up to the cap, separators kept', () => {
    const a = 'A'.repeat(90);
    const b = 'B'.repeat(90);
    const c = 'C'.repeat(90);
    const chunks = splitSpokenText([a, b, c].join('\n\n'));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(`${a}\n\n${b}`);
    expect(chunks[1]).toBe(c);
  });

  it('falls to sentence boundaries inside an over-long paragraph', () => {
    const s1 = `${'One '.repeat(30)}done.`;
    const s2 = `${'Two '.repeat(30)}done.`;
    const chunks = splitSpokenText(`${s1} ${s2}`);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(s1);
    expect(chunks[1]).toBe(s2);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(TAILOR_PIECE_MAX_CHARS);
  });

  it('never exceeds the cap and never loses a word', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Word${i} follows the one before it.`).join(' ');
    const chunks = splitSpokenText(text);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(TAILOR_PIECE_MAX_CHARS);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('empty and blank text yield no pieces', () => {
    expect(splitSpokenText('')).toEqual([]);
    expect(splitSpokenText('\n\n  \n\n')).toEqual([]);
  });
});
