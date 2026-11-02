import { describe, expect, it } from 'vitest';
import { audioPublicUrl, headForHour, parseAudioRow } from './dailyAudio';
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

describe('headForHour (§11.2 — the 15:00 boundary)', () => {
  it('the boundary constant is 15, AM before it and PM from it', () => {
    expect(AUDIO_PM_START_HOUR).toBe(15);
    expect(headForHour(0)).toBe('am');
    expect(headForHour(14)).toBe('am');
    expect(headForHour(15)).toBe('pm');
    expect(headForHour(23)).toBe('pm');
  });
});
