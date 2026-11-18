import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock seasonTurns so season cap is deterministic
vi.mock('./seasonTurns', () => ({
  seasonInstanceKey: (d: Date) => {
    // Simple stub: Advent 2026 instance vs Ordinary 2026
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key >= '2026-11-29' ? 'advent:2026-11-29' : 'ordinary-2:2026-05-24';
  },
}));

// The packet's Gospel source: a fixed day's readings and key verse.
vi.mock('./readings', () => ({
  fetchDailyReadings: vi.fn(async () => ({
    date: '2026-11-16',
    season: 'Ordinary Time',
    celebration: null,
    firstReading: null,
    psalm: null,
    secondReading: null,
    gospel: 'Matthew 5:1-12',
    usccbLink: null,
  })),
}));
vi.mock('./bible', () => ({
  fetchPassageVerses: vi.fn(async () => ({ citation: 'Matthew 5:1-12', verses: [] })),
}));
vi.mock('./keyVerse', () => ({
  pickKeyVerse: () => ({
    text: 'Blessed are the poor in spirit, for theirs is the kingdom of heaven.',
    citation: 'Matthew 5:3',
  }),
}));
vi.mock('@/data/liturgicalCalendar', () => ({
  getCurrentSeason: () => ({ name: 'Ordinary Time' }),
}));

import {
  CHAT_DAYS_KEY,
  LETTERS_KEY,
  companionChatDays,
  eligibleLetterPersona,
  letterFramingLine,
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
    // success shape — the packet carries the day's Gospel; with no Tailor
    // thread on the device, no tailor fields ride and the letter is the
    // impersonal form.
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, letter: 'Dear friend...' }) } as Response);
    expect(await fetchCompanionLetter('joseph', 'men')).toEqual({
      text: 'Dear friend...',
      withGospel: true,
      withTailor: false,
      withNorthStar: false,
    });
    // verify request body
    const lastCall = vi.mocked(fetch).mock.calls.at(-1);
    expect(lastCall?.[0]).toContain('/functions/v1/chat-proxy');
    const init = lastCall?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      mode: 'letter',
      personaId: 'joseph',
      season: 'Ordinary Time',
      audience: 'men',
      gospelCitation: 'Matthew 5:1-12',
      keyVerse: 'Blessed are the poor in spirit, for theirs is the kingdom of heaven.',
    });
  });

  it('fetchCompanionLetter hands over the Tailor thread when one exists — allowlisted keys only', async () => {
    const { fetchCompanionLetter } = await import('./letters');
    const { appendLetterThread } = await import('./letterThreads');
    appendLetterThread('2026-11-15', {
      sentence: 'My father is in hospital.',
      state: 'anxious',
      focus: 'family',
      tone: 'comfort',
    });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, letter: 'Dear friend...' }) } as Response);
    const result = await fetchCompanionLetter('joseph', 'men');
    expect(result).toEqual({ text: 'Dear friend...', withGospel: true, withTailor: true, withNorthStar: false });
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.issue).toBe('My father is in hospital.');
    expect(body.issueDate).toBe('2026-11-15');
    expect(body.tailorState).toBe('anxious');
    expect(body.tailorFocus).toBe('family');
    expect(body.tailorTone).toBe('comfort');
    // The allowlist is the whole payload: the four envelope keys plus the
    // packet fields, and nothing else can ride.
    expect(Object.keys(body).sort()).toEqual([
      'audience',
      'gospelCitation',
      'issue',
      'issueDate',
      'keyVerse',
      'mode',
      'personaId',
      'season',
      'tailorFocus',
      'tailorState',
      'tailorTone',
    ]);
  });

  it('fetchCompanionLetter hands over the North Star on its own — no thread needed', async () => {
    const { fetchCompanionLetter } = await import('./letters');
    const { EMPTY_TAILOR_PROFILE, saveTailorProfile } = await import('./tailorProfile');
    saveTailorProfile('men', { ...EMPTY_TAILOR_PROFILE, northStar: 'be-still' });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, letter: 'Dear friend...' }) } as Response);
    const result = await fetchCompanionLetter('joseph', 'men');
    expect(result).toEqual({ text: 'Dear friend...', withGospel: true, withTailor: false, withNorthStar: true });
    const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // The star rides as its resolved phrasing — never the raw id.
    expect(body.northStar).toBe('"Be still, and know that I am God." — Psalm 46:10');
    expect(Object.keys(body).sort()).toEqual([
      'audience',
      'gospelCitation',
      'keyVerse',
      'mode',
      'northStar',
      'personaId',
      'season',
    ]);
  });

  it('letterFramingLine names the sources, or stays silent for an impersonal letter', () => {
    expect(letterFramingLine({})).toBeNull();
    expect(letterFramingLine({ withGospel: false, withTailor: false })).toBeNull();
    expect(letterFramingLine({ withGospel: true })).toBe('Written with today’s Gospel.');
    expect(letterFramingLine({ withTailor: true })).toBe('Written with what you shared in Tailor.');
    expect(letterFramingLine({ withGospel: true, withTailor: true })).toBe(
      'Written with today’s Gospel and what you shared in Tailor.',
    );
    expect(letterFramingLine({ withNorthStar: true })).toBe('Written with your North Star.');
    expect(letterFramingLine({ withGospel: true, withNorthStar: true })).toBe(
      'Written with today’s Gospel and your North Star.',
    );
    expect(letterFramingLine({ withTailor: true, withNorthStar: true })).toBe(
      'Written with what you shared in Tailor and your North Star.',
    );
    expect(letterFramingLine({ withGospel: true, withTailor: true, withNorthStar: true })).toBe(
      'Written with today’s Gospel, what you shared in Tailor, and your North Star.',
    );
  });
});
