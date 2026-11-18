import { seasonInstanceKey } from './seasonTurns';
import { contentDate } from './dayBoundary';
import { fetchDailyReadings } from './readings';
import { fetchPassageVerses } from './bible';
import { pickKeyVerse } from './keyVerse';
import { latestLetterThread } from './letterThreads';
import { loadTailorProfile, northStarLabel } from './tailorProfile';
import { loadReaderName } from './readerName';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
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
  /** The letter was handed the day's Gospel (named under the letter where it is read). */
  withGospel?: boolean;
  /** The letter was handed the reader's Tailor thread (named under the letter, openly). */
  withTailor?: boolean;
  /** The letter was handed the reader's North Star (named under the letter, openly). */
  withNorthStar?: boolean;
}

/**
 * The framing line under a personalized letter, naming its sources in plain
 * words (Erik's ruling, Nov 16, 2026: the personalization is OPEN, never
 * silent). An impersonal letter — no packet was handed over — gets no line.
 */
export function letterFramingLine(
  letter: Pick<StoredLetter, 'withGospel' | 'withTailor' | 'withNorthStar'>,
): string | null {
  const parts: string[] = [];
  if (letter.withGospel) parts.push('today’s Gospel');
  if (letter.withTailor) parts.push('what you shared in Tailor');
  if (letter.withNorthStar) parts.push('your North Star');
  if (parts.length === 0) return null;
  if (parts.length === 1) return `Written with ${parts[0]}.`;
  if (parts.length === 2) return `Written with ${parts[0]} and ${parts[1]}.`;
  return `Written with ${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
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

/**
 * The personalization packet a letter may be handed (Erik's ruling,
 * Nov 16, 2026). Sources are allowlisted by kind: the user profile (the
 * track, sent as `audience`; the season; and, since Nov 18, 2026, the
 * standing profile's North Star — chosen by the reader, resolved to its
 * phrasing on-device), the daily Gospel, and Tailor. Companion
 * conversation is NEVER a source — this module reads no chat history and
 * no message state; what was said to a companion stays with that
 * companion. When no Tailor thread exists, no tailor fields are sent and
 * the letter falls back to its impersonal form. The reader's name
 * joined the allowlist on Nov 18, 2026 — read from its own store, as
 * the name itself, so the letter may open with it.
 */
export interface LetterPacket {
  gospelCitation?: string;
  keyVerse?: string;
  issue?: string;
  issueDate?: string;
  tailorState?: string;
  tailorFocus?: string;
  tailorTone?: string;
  northStar?: string;
  name?: string;
}

export async function buildLetterPacket(audience: Audience): Promise<LetterPacket> {
  const packet: LetterPacket = {};
  try {
    const readings = await fetchDailyReadings(contentDate());
    if (readings?.gospel) {
      packet.gospelCitation = readings.gospel;
      const passage = await fetchPassageVerses(readings.gospel);
      const verse = passage ? pickKeyVerse(passage) : null;
      if (verse?.text) packet.keyVerse = verse.text;
    }
  } catch {
    // No Gospel at hand — the packet simply goes without it.
  }
  const thread = latestLetterThread();
  if (thread) {
    packet.issue = thread.sentence;
    packet.issueDate = thread.date;
    if (thread.state) packet.tailorState = thread.state;
    if (thread.focus) packet.tailorFocus = thread.focus;
    if (thread.tone) packet.tailorTone = thread.tone;
  }
  // The North Star stands on its own: it rides whether or not a Tailor
  // thread exists, because it was chosen to steer, not offered for a day.
  const star = northStarLabel(loadTailorProfile(audience).northStar);
  if (star) packet.northStar = star;
  // The reader's name (Erik, Nov 18, 2026) — the ninth allowlisted
  // field: given by the reader in Settings and kept in its own store,
  // it rides as the name itself, so the letter may open with it. Like
  // the star it stands on its own; the framing line is unchanged,
  // because a name in a greeting is not a source the letter drew on.
  const readerName = loadReaderName();
  if (readerName) packet.name = readerName;
  return packet;
}

export interface CompanionLetterResult {
  text: string;
  /** The packet handed over carried the day's Gospel. */
  withGospel: boolean;
  /** The packet handed over carried the reader's Tailor thread. */
  withTailor: boolean;
  /** The packet handed over carried the reader's North Star. */
  withNorthStar: boolean;
}

export async function fetchCompanionLetter(
  personaId: string,
  audience: Audience,
): Promise<CompanionLetterResult | null> {
  try {
    const packet = await buildLetterPacket(audience);
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
        body: JSON.stringify({
          mode: 'letter',
          personaId,
          season: getCurrentSeason(contentDate()).name,
          audience,
          ...packet,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      if (!data || typeof data !== 'object') return null;
      const rec = data as { ok?: unknown; letter?: unknown };
      if (rec.ok !== true || typeof rec.letter !== 'string' || !rec.letter.trim()) return null;
      return {
        text: rec.letter,
        withGospel: Boolean(packet.gospelCitation),
        withTailor: Boolean(packet.issue),
        withNorthStar: Boolean(packet.northStar),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
