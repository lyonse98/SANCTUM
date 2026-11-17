import { seasonInstanceKey } from './seasonTurns';
import { contentDate } from './dayBoundary';
import type { Audience } from '@/types';

export const CHAT_DAYS_KEY = 'sanctum_companion_chat_days';
export const LETTERS_KEY = 'sanctum_letters';

export interface StoredLetter {
  personaId: string;
  personaName: string;
  dateKey: string;
  seasonKey: string;
  text: string;
  shown: boolean;
}

function readChatDays(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(CHAT_DAYS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

function writeChatDays(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(CHAT_DAYS_KEY, JSON.stringify(map));
  } catch {
    // best effort
  }
}

function readLetters(): StoredLetter[] {
  try {
    const raw = localStorage.getItem(LETTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StoredLetter =>
        !!x && typeof x === 'object' && typeof (x as StoredLetter).personaId === 'string' && typeof (x as StoredLetter).text === 'string',
    );
  } catch {
    return [];
  }
}

function writeLetters(letters: StoredLetter[]): void {
  try {
    localStorage.setItem(LETTERS_KEY, JSON.stringify(letters));
  } catch {
    // best effort
  }
}

export function recordCompanionChatDay(personaId: string, dateKey: string): void {
  try {
    const map = readChatDays();
    const arr = map[personaId] ?? [];
    if (!arr.includes(dateKey)) {
      arr.push(dateKey);
      arr.sort();
      map[personaId] = arr;
      writeChatDays(map);
    }
  } catch {
    // best effort
  }
}

export function companionChatDays(personaId: string): number {
  return readChatDays()[personaId]?.length ?? 0;
}

export function listLetters(): StoredLetter[] {
  const letters = readLetters();
  // Most recent first: by dateKey descending, preserving insertion order for same day (later stored first)
  return [...letters].reverse().sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
}

export function pendingLetter(): StoredLetter | null {
  return listLetters().find((l) => !l.shown) ?? null;
}

export function storeLetter(letter: StoredLetter): void {
  try {
    const letters = readLetters();
    letters.push(letter);
    writeLetters(letters);
  } catch {
    // best effort
  }
}

export function markLetterShown(dateKey: string, personaId: string): void {
  try {
    const letters = readLetters();
    let changed = false;
    for (const l of letters) {
      if (l.dateKey === dateKey && l.personaId === personaId && !l.shown) {
        l.shown = true;
        changed = true;
      }
    }
    if (changed) writeLetters(letters);
  } catch {
    // best effort
  }
}

// Allow injection for tests: season key provider
let seasonKeyProvider: (date: Date) => string = (d) => seasonInstanceKey(d);
export function __setSeasonKeyProviderForTest(fn: ((date: Date) => string) | null): void {
  seasonKeyProvider = fn ?? ((d) => seasonInstanceKey(d));
}
export function currentSeasonKey(now: Date = contentDate()): string {
  return seasonKeyProvider(now);
}

export function eligibleLetterPersona(
  personaIdsInAudienceOrder: string[],
  now: Date = contentDate(),
): string | null {
  try {
    const seasonKey = currentSeasonKey(now);
    const letters = readLetters();
    for (const id of personaIdsInAudienceOrder) {
      if (companionChatDays(id) < 7) continue;
      const hasThisSeason = letters.some((l) => l.personaId === id && l.seasonKey === seasonKey);
      if (!hasThisSeason) return id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchCompanionLetter(personaId: string, audience: Audience): Promise<string | null> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-proxy`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: 'letter', personaId, audience }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      if (!data || typeof data !== 'object') return null;
      const rec = data as { ok?: unknown; letter?: unknown };
      if (rec.ok !== true || typeof rec.letter !== 'string' || !rec.letter.trim()) return null;
      return rec.letter;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
