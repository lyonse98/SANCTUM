import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock seasonTurns so season cap is deterministic
vi.mock('./seasonTurns', () => ({
  seasonInstanceKey: (d: Date) => {
    // Simple stub: Advent 2026 instance vs Ordinary 2026
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key >= '2026-11-29' ? 'advent:2026-11-29' : 'ordinary-2:2026-05-24';
  },
}));

import {
  CHAT_DAYS_KEY,
  LETTERS_KEY,
  companionChatDays,
  eligibleLetterPersona,
  listLetters,
  markLetterShown,
  pendingLetter,
  recordCompanionChatDay,
  storeLetter,
} from './letters';
import { contentDate } from './dayBoundary';

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

describe('letters — chat days, store, eligibility', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('keys start with sanctum_', () => {
    expect(CHAT_DAYS_KEY.startsWith('sanctum_')).toBe(true);
    expect(LETTERS_KEY.startsWith('sanctum_')).toBe(true);
  });

  it('recordCompanionChatDay is idempotent per day', () => {
    recordCompanionChatDay('joseph', '2026-11-10');
    recordCompanionChatDay('joseph', '2026-11-10');
    recordCompanionChatDay('joseph', '2026-11-11');
    expect(companionChatDays('joseph')).toBe(2);
    expect(companionChatDays('david')).toBe(0);
  });

  it('store, list (most recent first), pending and mark shown', () => {
    storeLetter({ personaId: 'joseph', personaName: 'St. Joseph', dateKey: '2026-11-10', seasonKey: 'ordinary-2:2026-05-24', text: 'First', shown: false });
    storeLetter({ personaId: 'david', personaName: 'King David', dateKey: '2026-11-12', seasonKey: 'ordinary-2:2026-05-24', text: 'Second', shown: false });
    expect(listLetters().map((l) => l.text)).toEqual(['Second', 'First']);
    expect(pendingLetter()?.text).toBe('Second');
    markLetterShown('2026-11-12', 'david');
    expect(pendingLetter()?.text).toBe('First');
    markLetterShown('2026-11-10', 'joseph');
    expect(pendingLetter()).toBeNull();
  });

  it('eligible requires >=7 chat days', () => {
    for (let i = 1; i <= 6; i++) recordCompanionChatDay('joseph', `2026-11-0${i}`);
    expect(eligibleLetterPersona(['joseph', 'david'], contentDate(new Date(2026, 10, 16, 10)))).toBeNull();
    recordCompanionChatDay('joseph', '2026-11-07');
    expect(eligibleLetterPersona(['joseph', 'david'], contentDate(new Date(2026, 10, 16, 10)))).toBe('joseph');
  });

  it('eligible respects audience order and the one-per-season cap (stubbed season key)', () => {
    for (let i = 1; i <= 7; i++) {
      recordCompanionChatDay('joseph', `2026-11-0${i}`);
      recordCompanionChatDay('david', `2026-11-0${i}`);
    }
    const now = contentDate(new Date(2026, 10, 16, 10)); // ordinary stub
    expect(eligibleLetterPersona(['david', 'joseph'], now)).toBe('david');
    // David already has a letter this season -> next eligible is Joseph
    storeLetter({ personaId: 'david', personaName: 'King David', dateKey: '2026-11-16', seasonKey: 'ordinary-2:2026-05-24', text: 'Hi', shown: false });
    expect(eligibleLetterPersona(['david', 'joseph'], now)).toBe('joseph');
    // In a new season (Advent stub), David is eligible again
    const adventNow = contentDate(new Date(2026, 11, 5, 10));
    expect(eligibleLetterPersona(['david', 'joseph'], adventNow)).toBe('david');
  });

  it('fetchCompanionLetter degrades to null on non-OK / bad shape / network', async () => {
    const { fetchCompanionLetter } = await import('./letters');
    // non-OK (simulating undeployed function returning 400)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) } as Response);
    expect(await fetchCompanionLetter('joseph', 'men')).toBeNull();
    // bad shape
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: false }) } as Response);
    expect(await fetchCompanionLetter('joseph', 'men')).toBeNull();
    // network throw
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    expect(await fetchCompanionLetter('joseph', 'men')).toBeNull();
    // success shape
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, letter: 'Dear friend...' }) } as Response);
    expect(await fetchCompanionLetter('joseph', 'men')).toBe('Dear friend...');
    // verify request body
    const lastCall = vi.mocked(fetch).mock.calls.at(-1);
    expect(lastCall?.[0]).toContain('/functions/v1/chat-proxy');
    const init = lastCall?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ mode: 'letter', personaId: 'joseph', audience: 'men' });
  });
});
