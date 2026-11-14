import { describe, expect, it } from 'vitest';
import {
  BEAT_SILENCE_SECONDS,
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
  splitSpeechTextDetailed,
  type PieceSpec,
  type PlanInput,
} from './renderPlan.ts';

// The piece planner (Nov 13, 2026 rework; finer pieces, second round;
// head-scale pieces, third round): one invocation renders at most one piece,
// storage is the progress ledger, the main track is cut into ≤200-char
// chunks (the platform's 2 s CPU budget, priced in renderPlan.ts), and an
// attempt is consumed only by a fresh start — never by resuming a day that
// holds pieces.

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

describe('piece counts at the 200-char cap (round 3 — the 2 s CPU budget)', () => {
  // Paragraphs under the cap pack one-per-chunk when two cannot share:
  // p + '\n\n' + p exceeds 200 for both fixtures below, so the counts are
  // exactly the paragraph counts — derived from the packing rule, then
  // asserted against the splitter.
  const para = (ch: string, n: number) => ch.repeat(n);

  it('a weekday-scale main (~900 + ~550 chars) is 8 main pieces, 10 with heads', () => {
    const mainA = Array.from({ length: 5 }, () => para('w', 180)).join('\n\n');
    const mainB = Array.from({ length: 3 }, () => para('w', 180)).join('\n\n');
    const { aChunks, bChunks, specs } = splitMainScript(mainA, mainB);
    expect(aChunks).toHaveLength(5);
    expect(bChunks).toHaveLength(3);
    expect(specs).toHaveLength(10);
    for (const c of [...aChunks, ...bChunks]) expect(c.length).toBeLessThanOrEqual(200);
  });

  it('a Sunday-scale main (~2,300 + ~770 chars) is 16 main pieces, 18 with heads', () => {
    const mainA = Array.from({ length: 12 }, () => para('s', 190)).join('\n\n');
    const mainB = Array.from({ length: 4 }, () => para('s', 190)).join('\n\n');
    const { aChunks, bChunks, specs } = splitMainScript(mainA, mainB);
    expect(aChunks).toHaveLength(12);
    expect(bChunks).toHaveLength(4);
    expect(specs).toHaveLength(18);
    const mains = specs.filter((s) => s.kind === 'main');
    expect(mains.map((s) => s.id)).toEqual(mains.map((_, i) => mainPieceId(i)));
  });

  it('an over-cap paragraph falls to sentences and packs them to the cap', () => {
    const sentence = 's'.repeat(44) + '.'; // 45 chars, terminator attached
    const paragraph = Array.from({ length: 6 }, () => sentence).join(' '); // 275 chars
    const chunks = splitSpeechText(paragraph);
    // 45, then +1+45 steps: 91, 137, 183 fit; a fifth sentence (229) does not.
    expect(chunks.map((c) => c.length)).toEqual([183, 91]);
    expect(chunks.join(' ')).toBe(paragraph);
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

  it('the default cap is the proven head envelope — ~15 s of speech', () => {
    expect(MAIN_PIECE_MAX_CHARS).toBe(200);
  });
});

describe('pause-map beats — the fourth-round accounting', () => {
  // The assembler encodes a persona's pause map as blank lines: '\n\n' is a
  // plain paragraph break, each extra '\n' is one beat. A beat packed inside
  // a chunk rides in the chunk's text (the TTS realizes it, as it did for
  // the monolith); a beat on a chunk boundary is recorded here and restored
  // by mainJoinPlan as produced silence. Never neither.
  const para = (ch: string, n: number) => ch.repeat(n);

  it('the beat unit is one spoken breath: 0.6 s', () => {
    expect(BEAT_SILENCE_SECONDS).toBe(0.6);
  });

  it('a beat joint packed inside a chunk keeps its separator and records nothing', () => {
    const { chunks, boundaryBeats } = splitSpeechTextDetailed('First para.\n\n\nSecond para.', 800);
    expect(chunks).toEqual(['First para.\n\n\nSecond para.']);
    expect(boundaryBeats).toEqual([0]);
  });

  it('a beat joint on a chunk boundary is recorded against the chunk it opens', () => {
    // 120 + 3 + 120 > 200: the joint must become a boundary.
    const text = para('a', 120) + '\n\n\n' + para('b', 120);
    const { chunks, boundaryBeats } = splitSpeechTextDetailed(text, 200);
    expect(chunks).toEqual([para('a', 120), para('b', 120)]);
    expect(boundaryBeats).toEqual([0, 1]);
  });

  it('a plain paragraph break on a boundary records no beat', () => {
    const text = para('a', 120) + '\n\n' + para('b', 120);
    const { boundaryBeats } = splitSpeechTextDetailed(text, 200);
    expect(boundaryBeats).toEqual([0, 0]);
  });

  it('a two-beat joint records two beats', () => {
    const text = para('a', 120) + '\n\n\n\n' + para('b', 120);
    const { boundaryBeats } = splitSpeechTextDetailed(text, 200);
    expect(boundaryBeats).toEqual([0, 2]);
  });

  it('an over-cap paragraph after a beat joint: its first sentence joins by the true separator when it fits', () => {
    // The Gospel shape: short intro, then a long reading whose sentences
    // are cut. Intro + '\n\n\n' + first sentence fits the cap, so the beat
    // rides inside the chunk, exactly as the monolith sent it.
    const intro = 'A reading from the holy Gospel according to Luke.';
    const sentence = 'As it was in the days of Noah, so will it be in the days of the Son of Man. ';
    const gospel = (sentence.repeat(4)).trim(); // ~308 chars, over the cap
    const { chunks, boundaryBeats } = splitSpeechTextDetailed(intro + '\n\n\n' + gospel, 200);
    expect(chunks[0]).toBe(intro + '\n\n\n' + sentence.trim());
    expect(boundaryBeats[0]).toBe(0);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('an over-cap paragraph after a beat joint: when its first sentence cannot join, the boundary keeps the beat', () => {
    const intro = 'A reading from the holy Gospel according to Luke.'; // 50
    const longSentence = 'x'.repeat(160) + '.'; // 161: 50 + 3 + 161 > 200
    const gospel = longSentence + ' ' + 'Short one.';
    const { chunks, boundaryBeats } = splitSpeechTextDetailed(intro + '\n\n\n' + gospel, 200);
    expect(chunks).toEqual([intro, longSentence + ' Short one.']);
    expect(boundaryBeats).toEqual([0, 1]);
  });

  it('splitMainScript aligns boundaryBeats with the flattened chunk list, group heads at 0', () => {
    const mainA = para('a', 120) + '\n\n\n' + para('b', 120);
    const mainB = para('c', 120) + '\n\n\n' + para('d', 120);
    const { aChunks, bChunks, boundaryBeats } = splitMainScript(mainA, mainB);
    expect(aChunks).toHaveLength(2);
    expect(bChunks).toHaveLength(2);
    expect(boundaryBeats).toEqual([0, 1, 0, 1]);
  });

  it('mainJoinPlan restores boundary beats as 0.6 s silences at their seams, around the 2.0 s group silence', () => {
    const mainA = para('a', 120) + '\n\n\n' + para('b', 120);
    const mainB = para('c', 120) + '\n\n\n' + para('d', 120);
    const { specs, boundaryBeats } = splitMainScript(mainA, mainB);
    expect(mainJoinPlan(specs, boundaryBeats)).toEqual([
      { kind: 'piece', id: 'main-000' },
      { kind: 'silence', seconds: 0.6 },
      { kind: 'piece', id: 'main-001' },
      { kind: 'silence', seconds: 2.0 },
      { kind: 'piece', id: 'main-002' },
      { kind: 'silence', seconds: 0.6 },
      { kind: 'piece', id: 'main-003' },
    ]);
  });

  it('mainJoinPlan scales a two-beat joint to 1.2 s', () => {
    const mainA = para('a', 120) + '\n\n\n\n' + para('b', 120);
    const { specs, boundaryBeats } = splitMainScript(mainA, 'Tail.');
    const join = mainJoinPlan(specs, boundaryBeats);
    expect(join).toContainEqual({ kind: 'silence', seconds: 1.2 });
  });

  it('mainJoinPlan without beat accounting is the old join: the group silence only, now carrying its seconds', () => {
    const { specs } = splitMainScript('Alpha text.', 'Beta text.');
    expect(mainJoinPlan(specs)).toEqual([
      { kind: 'piece', id: 'main-000' },
      { kind: 'silence', seconds: 2.0 },
      { kind: 'piece', id: 'main-001' },
    ]);
  });

  it('a beat on the first chunk of a group is impossible by construction — and ignored if handed one', () => {
    // The joint between the groups is the 2.0 s silence, never a beat; a
    // stray count against a group's first chunk must not double it.
    const { specs } = splitMainScript('Alpha text.', 'Beta text.');
    expect(mainJoinPlan(specs, [1, 1])).toEqual([
      { kind: 'piece', id: 'main-000' },
      { kind: 'silence', seconds: 2.0 },
      { kind: 'piece', id: 'main-001' },
    ]);
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
