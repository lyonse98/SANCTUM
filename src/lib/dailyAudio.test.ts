import { describe, expect, it } from 'vitest';
import { audioPublicUrl, headForHour, parseAudioRow, sequenceSeekTarget } from './dailyAudio';
import { AUDIO_PM_START_HOUR, BELL_PATH } from './narratorCore';

const URL_BASE = 'https://example.supabase.co';

const READY_ROW = {
  date: '2026-11-05',
  persona: 'martin',
  status: 'ready',
  head_am_path: '2026-11-05/head-am.mp3',
  head_pm_path: '2026-11-05/head-pm.mp3',
  main_path: '2026-11-05/main.mp3',
  head_am_seconds: 14.2,
  head_pm_seconds: 15.1,
  main_seconds: 118.4,
};

describe('parseAudioRow (§11.1 — the player trusts only well-formed rows)', () => {
  it('builds public URLs from the row’s paths, never constructed by the client', () => {
    const audio = parseAudioRow(READY_ROW, URL_BASE);
    expect(audio?.headAmUrl).toBe(`${URL_BASE}/storage/v1/object/public/daily-audio/2026-11-05/head-am.mp3`);
    expect(audio?.mainUrl).toBe(`${URL_BASE}/storage/v1/object/public/daily-audio/2026-11-05/main.mp3`);
    expect(audio?.bellUrl).toBe(audioPublicUrl(URL_BASE, BELL_PATH));
    expect(audio?.persona).toBe('martin');
    expect(audio?.mainSeconds).toBe(118.4);
  });

  it('a ready row missing any path is malformed → null (no half-broken player)', () => {
    expect(parseAudioRow({ ...READY_ROW, main_path: null }, URL_BASE)).toBeNull();
    expect(parseAudioRow({ ...READY_ROW, head_am_path: '' }, URL_BASE)).toBeNull();
  });

  it('a failed row parses with no URLs — the card shows its one plain line', () => {
    const audio = parseAudioRow(
      { ...READY_ROW, status: 'failed', head_am_path: null, head_pm_path: null, main_path: null },
      URL_BASE,
    );
    expect(audio?.status).toBe('failed');
    expect(audio?.mainUrl).toBeNull();
  });

  it('rejects junk: unknown persona, bad date, non-object', () => {
    expect(parseAudioRow({ ...READY_ROW, persona: 'puck' }, URL_BASE)).toBeNull();
    expect(parseAudioRow({ ...READY_ROW, date: 'Nov 5' }, URL_BASE)).toBeNull();
    expect(parseAudioRow(null, URL_BASE)).toBeNull();
    expect(parseAudioRow('ready', URL_BASE)).toBeNull();
  });

  it('non-numeric durations become null, never NaN', () => {
    const audio = parseAudioRow({ ...READY_ROW, main_seconds: '118' }, URL_BASE);
    expect(audio?.mainSeconds).toBeNull();
  });
});

describe('sequenceSeekTarget (§11.3 — a global second lands in exactly one file)', () => {
  const HEAD_MAIN = [10, 100];

  it('before the boundary stays in the head', () => {
    expect(sequenceSeekTarget(0, HEAD_MAIN)).toEqual({ index: 0, offset: 0, baseOffset: 0 });
    expect(sequenceSeekTarget(5, HEAD_MAIN)).toEqual({ index: 0, offset: 5, baseOffset: 0 });
    expect(sequenceSeekTarget(9.5, HEAD_MAIN)).toEqual({ index: 0, offset: 9.5, baseOffset: 0 });
  });

  it('exactly on the boundary belongs to the main at offset 0', () => {
    expect(sequenceSeekTarget(10, HEAD_MAIN)).toEqual({ index: 1, offset: 0, baseOffset: 10 });
  });

  it('after the boundary carries the head into the base offset', () => {
    expect(sequenceSeekTarget(45, HEAD_MAIN)).toEqual({ index: 1, offset: 35, baseOffset: 10 });
  });

  it('the very end rests at the last file’s end', () => {
    expect(sequenceSeekTarget(110, HEAD_MAIN)).toEqual({ index: 1, offset: 100, baseOffset: 10 });
  });

  it('beyond the end clamps to the end, and before the start to the start', () => {
    expect(sequenceSeekTarget(999, HEAD_MAIN)).toEqual({ index: 1, offset: 100, baseOffset: 10 });
    expect(sequenceSeekTarget(-30, HEAD_MAIN)).toEqual({ index: 0, offset: 0, baseOffset: 0 });
    expect(sequenceSeekTarget(Number.NaN, HEAD_MAIN)).toEqual({ index: 0, offset: 0, baseOffset: 0 });
  });

  it('a single file is the degenerate case', () => {
    expect(sequenceSeekTarget(25, [60])).toEqual({ index: 0, offset: 25, baseOffset: 0 });
    expect(sequenceSeekTarget(90, [60])).toEqual({ index: 0, offset: 60, baseOffset: 0 });
  });

  it('walks past two files and skips zero-length ones', () => {
    expect(sequenceSeekTarget(35, [10, 20, 30])).toEqual({ index: 2, offset: 5, baseOffset: 30 });
    expect(sequenceSeekTarget(5, [0, 50])).toEqual({ index: 1, offset: 5, baseOffset: 0 });
    expect(sequenceSeekTarget(15, [10, 0, 30])).toEqual({ index: 2, offset: 5, baseOffset: 10 });
  });

  it('an empty sequence resolves to the origin', () => {
    expect(sequenceSeekTarget(30, [])).toEqual({ index: 0, offset: 0, baseOffset: 0 });
    expect(sequenceSeekTarget(30, [0, 0])).toEqual({ index: 0, offset: 0, baseOffset: 0 });
  });
});

describe('headForHour (§11.2 — the 15:00 boundary)', () => {
  it('the boundary constant is 15, AM before it and PM from it', () => {
    expect(AUDIO_PM_START_HOUR).toBe(15);
    expect(headForHour(0)).toBe('am');
    expect(headForHour(14)).toBe('am');
    expect(headForHour(15)).toBe('pm');
    expect(headForHour(23)).toBe('pm');
  });
});
