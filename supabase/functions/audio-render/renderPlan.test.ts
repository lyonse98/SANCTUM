import { describe, expect, it } from 'vitest';
import {
  RENDER_PIECES,
  mp3SecondsFromBytes,
  nextPiece,
  pieceStoragePath,
  planNext,
  type PlanInput,
  type RenderPiece,
} from './renderPlan.ts';

// The piece planner (Nov 13, 2026 rework): one invocation renders at most one
// segment, storage is the progress ledger, and an attempt is consumed only by
// a fresh start — never by resuming a half-rendered day.

const STALE = 10 * 60 * 1000;
const NOW = 1_700_000_000_000;

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
    piecesDone: new Set<RenderPiece>(),
    maxAttempts: 3,
    retryAttempts: 2,
    ...overrides,
  });
}

describe('planNext — terminal and in-flight gates', () => {
  it('a ready day is skipped unless forced', () => {
    expect(plan({ status: 'ready' })).toEqual({ kind: 'skip', reason: 'ready' });
    expect(plan({ status: 'ready', force: true }).kind).toBe('render');
  });

  it('a fresh rendering row stops external callers', () => {
    expect(
      plan({ status: 'rendering', attempts: 1, updatedAtMs: NOW - 60_000 }),
    ).toEqual({ kind: 'skip', reason: 'in-flight' });
  });

  it('the chain\u2019s own step call is not stopped by the freshness gate', () => {
    const action = plan({ status: 'rendering', attempts: 1, updatedAtMs: NOW - 60_000, viaStep: true });
    expect(action).toEqual({ kind: 'render', piece: 'head-am', mode: 'tts', claimAttempt: true });
  });

  it('a stale rendering row is resumed by anyone', () => {
    const action = plan({ status: 'rendering', attempts: 1, updatedAtMs: NOW - STALE - 1 });
    expect(action.kind).toBe('render');
  });
});

describe('planNext — the stuck 2026-11-13 shape', () => {
  // Both tracks sit at attempts=2, status rendering, zero pieces on disk: the
  // rows the free-tier worker kills left behind. A plain schedule call must
  // be able to finish the day with no hand surgery.
  it('starts attempt 3 from the first piece', () => {
    const action = plan({ status: 'rendering', attempts: 2, updatedAtMs: NOW - STALE - 1 });
    expect(action).toEqual({ kind: 'render', piece: 'head-am', mode: 'tts', claimAttempt: true });
  });

  it('once a piece lands, further work is a free resume — the cap no longer gates', () => {
    const action = plan({
      status: 'rendering',
      attempts: 3,
      updatedAtMs: NOW - STALE - 1,
      piecesDone: new Set<RenderPiece>(['head-am']),
    });
    expect(action).toEqual({ kind: 'render', piece: 'head-pm', mode: 'tts', claimAttempt: false });
  });
});

describe('planNext — attempt caps gate fresh starts only', () => {
  it('a failed day at the retry window is done', () => {
    expect(plan({ status: 'failed', attempts: 2 })).toEqual({ kind: 'skip', reason: 'attempts' });
  });

  it('a failed day inside the retry window starts a new chain, consuming an attempt', () => {
    const action = plan({ status: 'failed', attempts: 1 });
    expect(action).toEqual({ kind: 'render', piece: 'head-am', mode: 'tts', claimAttempt: true });
  });

  it('the hard cap stops a fresh start at max attempts', () => {
    expect(plan({ status: 'rendering', attempts: 3, updatedAtMs: NOW - STALE - 1 })).toEqual({
      kind: 'skip',
      reason: 'attempts',
    });
  });

  it('force bypasses the caps', () => {
    expect(plan({ status: 'failed', attempts: 3, force: true }).kind).toBe('render');
  });

  it('a failed day holding pieces resumes despite the caps', () => {
    const action = plan({
      status: 'failed',
      attempts: 3,
      piecesDone: new Set<RenderPiece>(['head-am', 'head-pm', 'main-a']),
    });
    expect(action).toEqual({ kind: 'render', piece: 'main-b', mode: 'tts', claimAttempt: false });
  });
});

describe('planNext — piece order, lector, finalize', () => {
  it('walks the pieces in render order', () => {
    const done = new Set<RenderPiece>();
    for (const piece of RENDER_PIECES) {
      expect(nextPiece(done)).toBe(piece);
      done.add(piece);
    }
    expect(nextPiece(done)).toBeNull();
  });

  it('a lector day\u2019s head-pm is a copy, not a second voice call', () => {
    const action = plan({ lector: true, piecesDone: new Set<RenderPiece>(['head-am']) });
    expect(action).toEqual({ kind: 'render', piece: 'head-pm', mode: 'copy', claimAttempt: false });
  });

  it('all pieces down means finalize — even off a failed row, spending no attempt', () => {
    const action = plan({
      status: 'failed',
      attempts: 3,
      piecesDone: new Set<RenderPiece>(RENDER_PIECES),
    });
    expect(action).toEqual({ kind: 'finalize' });
  });

  it('no row at all starts a fresh chain', () => {
    expect(plan()).toEqual({ kind: 'render', piece: 'head-am', mode: 'tts', claimAttempt: true });
  });
});

describe('piece storage paths', () => {
  it('heads live at their final segment paths', () => {
    expect(pieceStoragePath('2026-11-13', 'women', 'head-am')).toBe('2026-11-13/women/head-am.mp3');
    expect(pieceStoragePath('2026-11-13', 'men', 'head-pm')).toBe('2026-11-13/men/head-pm.mp3');
  });

  it('main halves stage under parts/ — never at the main path half-written', () => {
    expect(pieceStoragePath('2026-11-13', 'men', 'main-a')).toBe('2026-11-13/men/parts/main-a.mp3');
    expect(pieceStoragePath('2026-11-13', 'men', 'main-b')).toBe('2026-11-13/men/parts/main-b.mp3');
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
