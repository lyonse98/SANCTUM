import { describe, expect, it } from 'vitest';
import {
  buildAudioPlan,
  buildPieceTexts,
  pieceTokenExpiry,
  sha256Hex,
  signPieceToken,
  verifyPieceToken,
} from './audioPlan.ts';
import { TAILOR_PIECE_MAX_CHARS } from './renderPieces.ts';
import type { TailoredScript } from './narratorCore.ts';

function scriptWith(parts: Partial<TailoredScript>): TailoredScript {
  return {
    persona: 'tom',
    lector: false,
    sober: false,
    introIncluded: false,
    head: 'HEAD-TEXT',
    readings: 'READINGS-TEXT',
    passage: 'PASSAGE-TEXT',
    mainB: 'MAINB-TEXT',
    spokenText: '',
    script: '',
    ...parts,
  };
}

// The plan's core promise: the program comes back in the render block's own
// order — head, readings, passage, the produced silence as its own piece,
// second movement — and no spoken piece ever exceeds the CPU-safe cap.
describe('buildPieceTexts', () => {
  it('lays the program out in order, the silence standing as its own piece', () => {
    const pieces = buildPieceTexts(scriptWith({}));
    const kinds = pieces.map((p) => p.kind);
    expect(pieces[0]).toEqual({ kind: 'speech', text: 'HEAD-TEXT' });
    expect(pieces[1]).toEqual({ kind: 'speech', text: 'READINGS-TEXT' });
    expect(pieces[2]).toEqual({ kind: 'speech', text: 'PASSAGE-TEXT' });
    expect(pieces[3]).toEqual({ kind: 'silence', text: '' });
    expect(pieces[4]).toEqual({ kind: 'speech', text: 'MAINB-TEXT' });
    expect(kinds.filter((k) => k === 'silence')).toHaveLength(1);
  });

  it('cuts every spoken piece to the cap — a long unbroken Gospel paragraph included', () => {
    const sentence = 'And Jesus said to them, follow me, and I will make you fishers of men. ';
    const gospel = sentence.repeat(12).trim(); // ~840 chars, one paragraph, no breaks
    const pieces = buildPieceTexts(scriptWith({ readings: gospel }));
    const spoken = pieces.filter((p) => p.kind === 'speech');
    expect(spoken.length).toBeGreaterThan(4);
    for (const piece of spoken) {
      expect(piece.text.length).toBeLessThanOrEqual(TAILOR_PIECE_MAX_CHARS);
      expect(piece.text.length).toBeGreaterThan(0);
    }
    // Nothing spoken is lost: whitespace-normalized, the pieces are the text.
    const rejoined = spoken.map((p) => p.text).join(' ').replace(/\s+/g, ' ');
    const readingsPieces = pieces.slice(1, pieces.length - 3); // between head and passage
    expect(readingsPieces.map((p) => p.text).join(' ').replace(/\s+/g, ' ')).toBe(
      gospel.replace(/\s+/g, ' '),
    );
    expect(rejoined).toContain('follow me');
  });

  it('keeps the readings paragraph split as the outer cut', () => {
    const readings = ['First paragraph stands alone here.', 'Second paragraph follows it.'].join('\n\n');
    const pieces = buildPieceTexts(scriptWith({ readings }));
    const texts = pieces.map((p) => p.text);
    expect(texts).toContain('First paragraph stands alone here.');
    expect(texts).toContain('Second paragraph follows it.');
  });

  it('a single over-long word is sliced — the cap is the cap', () => {
    const pieces = buildPieceTexts(scriptWith({ head: 'x'.repeat(450) }));
    const headPieces = pieces.slice(0, 3);
    expect(headPieces.map((p) => p.text.length)).toEqual([200, 200, 50]);
  });
});

// The token discipline: a plan entry authorizes EXACTLY its own piece —
// its words, at its index, for its date and track, under the build's key,
// inside its week. The clock is pinned inside the plan's window so the
// roundtrips never rot with the calendar.
describe('piece tokens', () => {
  const KEY = 'test-render-key';
  const DATE = '2026-11-13';
  const TEXT = 'A reading from the holy Gospel according to Luke.';
  const NOW = Math.floor(Date.parse('2026-11-13T12:00:00Z') / 1000);

  it('sha256Hex matches the known empty-string digest', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('signs and verifies a roundtrip — the token carries its expiry up front', async () => {
    const token = await signPieceToken(KEY, DATE, 'men', 3, TEXT);
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(token.startsWith(`${pieceTokenExpiry(DATE)}.`)).toBe(true);
    expect(await verifyPieceToken(KEY, DATE, 'men', 3, TEXT, token, { nowSeconds: NOW })).toBe(true);
  });

  it('the same words at another index carry a different token', async () => {
    const a = await signPieceToken(KEY, DATE, 'men', 3, TEXT);
    const b = await signPieceToken(KEY, DATE, 'men', 4, TEXT);
    expect(a).not.toBe(b);
    expect(await verifyPieceToken(KEY, DATE, 'men', 4, TEXT, a, { nowSeconds: NOW })).toBe(false);
  });

  it('rejects tampered text, another day, another track, and another key', async () => {
    const token = await signPieceToken(KEY, DATE, 'women', 0, TEXT);
    const at = { nowSeconds: NOW };
    expect(await verifyPieceToken(KEY, DATE, 'women', 0, `${TEXT} Amen.`, token, at)).toBe(false);
    expect(await verifyPieceToken(KEY, '2026-11-14', 'women', 0, TEXT, token, at)).toBe(false);
    expect(await verifyPieceToken(KEY, DATE, 'men', 0, TEXT, token, at)).toBe(false);
    expect(await verifyPieceToken('another-key', DATE, 'women', 0, TEXT, token, at)).toBe(false);
    expect(await verifyPieceToken(KEY, DATE, 'women', 0, TEXT, 'not-a-token', at)).toBe(false);
    expect(await verifyPieceToken(KEY, DATE, 'women', 0, TEXT, '', at)).toBe(false);
  });

  it('the silence piece signs over its empty text like any other', async () => {
    const token = await signPieceToken(KEY, DATE, 'men', 7, '');
    expect(await verifyPieceToken(KEY, DATE, 'men', 7, '', token, { nowSeconds: NOW })).toBe(true);
    expect(await verifyPieceToken(KEY, DATE, 'men', 7, ' ', token, { nowSeconds: NOW })).toBe(false);
  });

  // P-3 (Nov 18, 2026): the expiry is the fix — a captured plan rots.
  it('dies at its expiry: alive the second before, dead at and after it', async () => {
    const token = await signPieceToken(KEY, DATE, 'men', 3, TEXT);
    const expiry = pieceTokenExpiry(DATE);
    expect(await verifyPieceToken(KEY, DATE, 'men', 3, TEXT, token, { nowSeconds: expiry - 1 })).toBe(true);
    expect(await verifyPieceToken(KEY, DATE, 'men', 3, TEXT, token, { nowSeconds: expiry })).toBe(false);
    expect(await verifyPieceToken(KEY, DATE, 'men', 3, TEXT, token, { nowSeconds: expiry + 86400 })).toBe(false);
  });

  it('an expiry scribbled later over the real one fails the signature', async () => {
    const token = await signPieceToken(KEY, DATE, 'men', 3, TEXT);
    const forged = token.replace(/^\d+/, `${pieceTokenExpiry(DATE) + 86400}`);
    expect(forged).not.toBe(token);
    expect(await verifyPieceToken(KEY, DATE, 'men', 3, TEXT, forged, { nowSeconds: NOW })).toBe(false);
  });

  it('a plan from long ago is dead at the real clock, no injection needed', async () => {
    const token = await signPieceToken(KEY, '2020-01-01', 'men', 0, TEXT);
    expect(await verifyPieceToken(KEY, '2020-01-01', 'men', 0, TEXT, token)).toBe(false);
  });

});

describe('buildAudioPlan', () => {
  it('issues sequential signed entries matching the piece texts, silence included', async () => {
    const script = scriptWith({});
    const plan = await buildAudioPlan('plan-key', '2026-11-13', 'men', script);
    const texts = buildPieceTexts(script);
    const now = Math.floor(Date.parse('2026-11-13T12:00:00Z') / 1000);
    expect(plan).toHaveLength(texts.length);
    for (let i = 0; i < plan.length; i++) {
      expect(plan[i].index).toBe(i);
      expect(plan[i].text).toBe(texts[i].text);
      expect(
        await verifyPieceToken('plan-key', '2026-11-13', 'men', i, plan[i].text, plan[i].token, {
          nowSeconds: now,
        }),
      ).toBe(true);
    }
    expect(plan[3].text).toBe(''); // the silence rides as an entry of its own
  });

  it('stamps one shared expiry across the whole plan', async () => {
    const plan = await buildAudioPlan('plan-key', '2026-11-13', 'women', scriptWith({}));
    const prefixes = new Set(plan.map((entry) => entry.token.split('.')[0]));
    expect(prefixes.size).toBe(1);
    expect([...prefixes][0]).toBe(`${pieceTokenExpiry('2026-11-13')}`);
  });
});
