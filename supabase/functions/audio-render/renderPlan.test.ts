import { describe, expect, it } from 'vitest';
import {
  HEAD_AM,
  HEAD_PM,
  MAIN_PIECE_MAX_CHARS,
  mainJoinPlan,
  mainPieceId,
  mp3SecondsFromBytes,
  nextPiece,
  pieceStoragePath,
  planNext,
  splitMainScript,
  splitSpeechText,
  type PieceSpec,
  type PlanInput,
} from './renderPlan.ts';

// The piece planner (Nov 13, 2026 rework; finer pieces, second round): one
// invocation renders at most one piece, storage is the progress ledger, the
// main track is cut into ≤800-char chunks, and an attempt is consumed only
// by a fresh start — never by resuming a day that holds pieces.

const STALE = 10 * 60 * 1000;
const NOW = 1_700_000_000_000;

// A representative day: two heads, two A chunks, one B chunk.
const DAY: PieceSpec[] = [
  HEAD_AM,
  HEAD_PM,
  { id: 'main-000', kind: 'main', group: 'a', index: 0 },
  { id: 'main-001', kind: 'main', group: 'a', index: 1 },
  { id: 'main-002', kind: 'main', group: 'b', index: 2 },
];

function plan(overrides: Partial<PlanInput> = {}) {
  return planNext({
    status: null,
    attempts: 0,
    updatedAtMs: null,
    nowMs: NOW,
    staleMs: STALE,
    force: false,
    viaStep: false,
    lector: false,
    pieces: DAY,
    piecesDone: new Set<string>(),
    maxAttempts: 6,
    retryAttempts: 2,
    ...overrides,
  });
}

const render = (piece: PieceSpec, claimAttempt: boolean, mode: 'tts' | 'copy' = 'tts') => ({
  kind: 'render',
  piece,
  mode,
  claimAttempt,
});

describe('planNext — terminal and in-flight gates', () => {
  it('a ready day is skipped unless forced', () => {
    expect(plan({ status: 'ready' })).toEqual({ kind: 'skip', reason: 'ready' });
    expect(plan({ status: 'ready', force: true }).kind).toBe('render');
  });

  it('a fresh rendering row stops external callers', () => {
    expect(plan({ status: 'rendering', attempts: 1, updatedAtMs: NOW - 60_000 })).toEqual({
      kind: 'skip',
      reason: 'in-flight',
    });
  });

  it('the chain’s own step call is not stopped by the freshness gate', () => {
    const action = plan({
      status: 'rendering',
      attempts: 1,
      updatedAtMs: NOW - 60_000,
      viaStep: true,
    });
    expect(action).toEqual(render(HEAD_AM, true));
  });

  it('a stale rendering row is resumed by anyone', () => {
    const action = plan({ status: 'rendering', attempts: 1, updatedAtMs: NOW - STALE - 1 });
    expect(action.kind).toBe('render');
  });
});

describe('planNext — resume from live state (men’s 2026-11-13)', () => {
  // The men's row has both heads at their final paths and no main chunks:
  // the next call must pick the first main chunk, spend no attempt, and
  // never look at the caps.
  it('heads-only state resumes at main-000 for free', () => {
    const action = plan({
      status: 'rendering',
      attempts: 3,
      updatedAtMs: NOW - STALE - 1,
      piecesDone: new Set(['head-am', 'head-pm']),
    });
    expect(action).toEqual(render(DAY[2], false));
  });

  it('a mid-main state resumes at the next missing chunk', () => {
    const action = plan({
      status: 'rendering',
      attempts: 3,
      updatedAtMs: NOW - STALE - 1,
      piecesDone: new Set(['head-am', 'head-pm', 'main-000']),
    });
    expect(action).toEqual(render(DAY[3], false));
  });
});

describe('planNext — the zero-progress trap (women’s 2026-11-13)', () => {
  // Her row burned every fresh-start attempt on kicks the worker killed:
  // status `rendering`, zero pieces. Under the old cap of 3 a plain call
  // answered {"skipped":"attempts"} forever. A fossil — a rendering claim
  // whose attempts never recorded an outcome — must stay startable by the
  // schedule at ANY attempt count.
  it('a rendering fossil at the old cap still starts', () => {
    const action = plan({ status: 'rendering', attempts: 3, updatedAtMs: NOW - STALE - 1 });
    expect(action).toEqual(render(HEAD_AM, true));
  });

  it('a rendering fossil beyond the hard cap still starts', () => {
    const action = plan({ status: 'rendering', attempts: 6, updatedAtMs: NOW - STALE - 1 });
    expect(action).toEqual(render(HEAD_AM, true));
  });

  it('a rendering fossil far beyond the hard cap still starts', () => {
    const action = plan({ status: 'rendering', attempts: 25, updatedAtMs: NOW - STALE - 1 });
    expect(action).toEqual(render(HEAD_AM, true));
  });
});

describe('planNext — attempt caps gate fresh starts only', () => {
  it('a failed day at the retry window is done', () => {
    expect(plan({ status: 'failed', attempts: 2 })).toEqual({ kind: 'skip', reason: 'attempts' });
  });

  it('a failed day inside the retry window starts a new chain, consuming an attempt', () => {
    expect(plan({ status: 'failed', attempts: 1 })).toEqual(render(HEAD_AM, true));
  });

  it('the hard cap stops a fresh start with no live claim', () => {
    expect(plan({ status: null, attempts: 6 })).toEqual({ kind: 'skip', reason: 'attempts' });
    expect(plan({ status: 'expired', attempts: 6 })).toEqual({ kind: 'skip', reason: 'attempts' });
  });

  it('force bypasses the caps', () => {
    expect(plan({ status: 'failed', attempts: 6, force: true }).kind).toBe('render');
  });

  it('a failed day holding pieces resumes despite the caps', () => {
    const action = plan({
      status: 'failed',
      attempts: 6,
      piecesDone: new Set(['head-am', 'head-pm', 'main-000', 'main-001']),
    });
    expect(action).toEqual(render(DAY[4], false));
  });
});

describe('planNext — piece order, lector, finalize', () => {
  it('walks the pieces in render order', () => {
    const done = new Set<string>();
    for (const piece of DAY) {
      expect(nextPiece(DAY, done)).toBe(piece);
      done.add(piece.id);
    }
    expect(nextPiece(DAY, done)).toBeNull();
  });

  it('a lector day’s head-pm is a copy, not a second voice call', () => {
    const action = plan({ lector: true, piecesDone: new Set(['head-am']) });
    expect(action).toEqual(render(HEAD_PM, false, 'copy'));
  });

  it('all pieces down means finalize — even off a failed row, spending no attempt', () => {
    const action = plan({
      status: 'failed',
      attempts: 6,
      piecesDone: new Set(DAY.map((p) => p.id)),
    });
    expect(action).toEqual({ kind: 'finalize' });
  });

  it('no row at all starts a fresh chain', () => {
    expect(plan()).toEqual(render(HEAD_AM, true));
  });
});

describe('splitSpeechText', () => {
  it('keeps short text as one chunk', () => {
    expect(splitSpeechText('One paragraph only.')).toEqual(['One paragraph only.']);
  });

  it('packs paragraphs greedily up to the cap, in order', () => {
    const p = (n: number) => `Paragraph ${n} ` + 'x'.repeat(40);
    const text = [p(1), p(2), p(3), p(4)].join('\n\n');
    const chunks = splitSpeechText(text, 130);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('Paragraph 1');
    expect(chunks[0]).toContain('Paragraph 2');
    expect(chunks[1]).toContain('Paragraph 3');
    expect(chunks[1]).toContain('Paragraph 4');
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(130);
  });

  it('preserves paragraph separators inside a chunk', () => {
    const chunks = splitSpeechText('First para.\n\n\nSecond para.', 800);
    expect(chunks).toEqual(['First para.\n\n\nSecond para.']);
  });

  it('splits an over-cap paragraph at sentence boundaries', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog. ';
    const para = sentence.repeat(6).trim(); // ~270 chars, one paragraph
    const chunks = splitSpeechText(para, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(100);
      expect(c.endsWith('.')).toBe(true);
    }
    expect(chunks.join(' ')).toBe(para);
  });

  it('hard-wraps a single sentence longer than the cap', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitSpeechText(words, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
    expect(chunks.join(' ')).toBe(words);
  });

  it('returns no chunks for empty or whitespace text', () => {
    expect(splitSpeechText('')).toEqual([]);
    expect(splitSpeechText('\n\n  \n\n')).toEqual([]);
  });

  it('is deterministic — the same text yields the same cut', () => {
    const text = Array.from({ length: 9 }, (_, i) => `Para ${i}. ` + 'y'.repeat(120)).join('\n\n');
    expect(splitSpeechText(text)).toEqual(splitSpeechText(text));
  });
});

describe('splitMainScript', () => {
  it('lays out heads first, then A chunks, then B chunks, numbered across the silence', () => {
    const { aChunks, bChunks, specs } = splitMainScript('Alpha text.', 'Beta text.');
    expect(aChunks).toEqual(['Alpha text.']);
    expect(bChunks).toEqual(['Beta text.']);
    expect(specs).toEqual([
      HEAD_AM,
      HEAD_PM,
      { id: 'main-000', kind: 'main', group: 'a', index: 0 },
      { id: 'main-001', kind: 'main', group: 'b', index: 1 },
    ]);
  });

  it('numbers chunks sequentially as each group grows', () => {
    const long = (tag: string) =>
      Array.from({ length: 5 }, (_, i) => `${tag} paragraph ${i} ` + 'z'.repeat(300)).join('\n\n');
    const { aChunks, bChunks, specs } = splitMainScript(long('A'), long('B'));
    expect(aChunks.length).toBeGreaterThan(1);
    expect(bChunks.length).toBeGreaterThan(1);
    const mains = specs.filter((s) => s.kind === 'main');
    expect(mains.map((s) => s.id)).toEqual(mains.map((_, i) => mainPieceId(i)));
    expect(mains.slice(0, aChunks.length).every((s) => s.group === 'a')).toBe(true);
    expect(mains.slice(aChunks.length).every((s) => s.group === 'b')).toBe(true);
  });

  it('an empty B side yields no B pieces', () => {
    const { specs } = splitMainScript('Only the Gospel side.', '');
    expect(specs.filter((s) => s.group === 'b')).toEqual([]);
  });
});

describe('mainJoinPlan — silence placement', () => {
  it('silence sits exactly once, between the last A chunk and the first B chunk', () => {
    const { specs } = splitMainScript(
      Array.from({ length: 4 }, (_, i) => `A${i} ` + 'q'.repeat(300)).join('\n\n'),
      Array.from({ length: 4 }, (_, i) => `B${i} ` + 'q'.repeat(300)).join('\n\n'),
    );
    const join = mainJoinPlan(specs);
    const silences = join.filter((p) => p.kind === 'silence');
    expect(silences).toHaveLength(1);
    const at = join.findIndex((p) => p.kind === 'silence');
    const aIds = specs.filter((s) => s.group === 'a').map((s) => s.id);
    const bIds = specs.filter((s) => s.group === 'b').map((s) => s.id);
    expect(join.slice(0, at)).toEqual(aIds.map((id) => ({ kind: 'piece', id })));
    expect(join.slice(at + 1)).toEqual(bIds.map((id) => ({ kind: 'piece', id })));
  });

  it('no silence when a group is empty', () => {
    const { specs } = splitMainScript('Only A.', '');
    expect(mainJoinPlan(specs)).toEqual([{ kind: 'piece', id: 'main-000' }]);
  });
});

describe('piece storage paths', () => {
  it('heads live at their final segment paths', () => {
    expect(pieceStoragePath('2026-11-13', 'women', HEAD_AM)).toBe('2026-11-13/women/head-am.mp3');
    expect(pieceStoragePath('2026-11-13', 'men', HEAD_PM)).toBe('2026-11-13/men/head-pm.mp3');
  });

  it('main chunks stage under parts/ — never at the main path half-written', () => {
    const chunk: PieceSpec = { id: 'main-007', kind: 'main', group: 'b', index: 7 };
    expect(pieceStoragePath('2026-11-13', 'men', chunk)).toBe('2026-11-13/men/parts/main-007.mp3');
  });

  it('the default cap is the ~45–60 s target', () => {
    expect(MAIN_PIECE_MAX_CHARS).toBe(800);
  });
});

describe('mp3SecondsFromBytes', () => {
  it('prices CBR 64 kbps audio from its bytes', () => {
    expect(mp3SecondsFromBytes(8000 * 60)).toBe(60);
    expect(mp3SecondsFromBytes(8000 * 95 + 400)).toBe(95.1);
  });

  it('guards junk input', () => {
    expect(mp3SecondsFromBytes(0)).toBe(0);
    expect(mp3SecondsFromBytes(-5)).toBe(0);
    expect(mp3SecondsFromBytes(Number.NaN)).toBe(0);
  });
});
