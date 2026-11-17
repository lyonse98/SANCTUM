import { describe, it, expect, beforeEach } from 'vitest';
import {
  CAP_CLOSING_PRAYER,
  CAP_OUTWARD_LINE,
  DAILY_MESSAGE_CAP,
  capRemainingLine,
  getDailyMessageCount,
  incrementDailyMessageCount,
  getRemainingMessages,
  isAtMessageCap,
} from './messageCap';

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
});

describe('daily message cap', () => {
  it('a stale date means a fresh day: yesterday’s cap does not carry over', () => {
    localStorage.setItem('sanctum_daily_msg_date', '1999-0-1');
    localStorage.setItem('sanctum_daily_msg_count', String(DAILY_MESSAGE_CAP));
    expect(getDailyMessageCount()).toBe(0);
    expect(isAtMessageCap()).toBe(false);
    expect(getRemainingMessages()).toBe(DAILY_MESSAGE_CAP);
  });

  it('the first message of a new day resets the counter to 1', () => {
    localStorage.setItem('sanctum_daily_msg_date', '1999-0-1');
    localStorage.setItem('sanctum_daily_msg_count', '14');
    expect(incrementDailyMessageCount()).toBe(1);
  });

  it('increments within the day and reports the cap at the limit', () => {
    for (let i = 1; i <= DAILY_MESSAGE_CAP; i++) {
      expect(incrementDailyMessageCount()).toBe(i);
    }
    expect(isAtMessageCap()).toBe(true);
    expect(getRemainingMessages()).toBe(0);
  });
});

describe('cap-as-rhythm copy (Play 9b)', () => {
  it('the cap itself is unchanged: 15 messages a day', () => {
    expect(DAILY_MESSAGE_CAP).toBe(15);
  });

  it('counts the unit the cap actually counts — messages — in the keeping-hours frame', () => {
    expect(capRemainingLine(5)).toBe('Companions keep hours — 5 messages left today');
    expect(capRemainingLine(1)).toBe('Companions keep hours — 1 message left today');
    expect(capRemainingLine(0)).toBe('Companions keep hours — no messages left today');
    // The old mislabel is gone: the cap never counted conversations.
    expect(capRemainingLine(5)).not.toContain('conversation');
  });

  it('at the cap there is a closing prayer, and it ends in Amen', () => {
    expect(CAP_CLOSING_PRAYER.length).toBeGreaterThan(0);
    expect(CAP_CLOSING_PRAYER).toContain('Amen.');
  });

  it('at the cap the pointer runs outward — a priest, Mass, and Confession first', () => {
    expect(CAP_OUTWARD_LINE).toContain('priest');
    expect(CAP_OUTWARD_LINE).toContain('Mass');
    expect(CAP_OUTWARD_LINE).toContain('Confession');
    expect(CAP_OUTWARD_LINE).toContain('Real Help');
  });
});
