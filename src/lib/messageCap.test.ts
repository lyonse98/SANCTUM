import { describe, it, expect, beforeEach } from 'vitest';
import {
  DAILY_MESSAGE_CAP,
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
