import {
  isTailorFocus,
  isTailorState,
  isTailorTone,
  type TailorFocus,
  type TailorState,
  type TailorTone,
} from '@/data/tailorBank';

/**
 * Letter threads — the one personalization source a companion's letter may
 * draw on (Erik's ruling, Nov 16, 2026). Data given in companion
 * conversation stays in conversation, sealed; data given for tailoring may
 * tailor. So when a Tailor build saves its morning record, the morning's
 * one sentence — and only that sentence, with the day's stated enums — is
 * also kept here, on this device only, for a letter to be handed later.
 *
 * The store is small on purpose: the most recent five offerings, one per
 * content day. It lives under the sanctum_ prefix, so the panic wipe takes
 * it with everything else, and nothing here is ever sent anywhere except
 * inside a letter-generation call the user was told about at the field
 * itself (the disclosure stands under the Tailor intake's sentence field).
 */
export const LETTER_THREADS_KEY = 'sanctum_letter_threads';
export const LETTER_THREADS_MAX = 5;

export interface LetterThread {
  /** The content day the offering was made, as a date key. */
  date: string;
  /** The morning's one sentence, trimmed and capped exactly as the build call caps it. */
  sentence: string;
  /** The same morning's stated enums — enums only, never words beyond them. */
  state?: TailorState;
  focus?: TailorFocus;
  tone?: TailorTone;
}

function readThreads(): LetterThread[] {
  try {
    const raw = localStorage.getItem(LETTER_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: LetterThread[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
      if (typeof t.sentence !== 'string' || !t.sentence.trim()) continue;
      out.push({
        date: t.date,
        sentence: t.sentence.slice(0, 200),
        state: isTailorState(t.state) ? t.state : undefined,
        focus: isTailorFocus(t.focus) ? t.focus : undefined,
        tone: isTailorTone(t.tone) ? t.tone : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeThreads(threads: LetterThread[]): void {
  try {
    localStorage.setItem(LETTER_THREADS_KEY, JSON.stringify(threads));
  } catch {
    // best effort — a letter simply falls back to its impersonal form
  }
}

export function listLetterThreads(): LetterThread[] {
  return readThreads().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** The most recent offering a letter may be handed, or null when none exists. */
export function latestLetterThread(): LetterThread | null {
  return listLetterThreads()[0] ?? null;
}

/**
 * Keeps one morning's offering for a future letter. Called when a Tailor
 * build saves its morning record — a cache replay saves nothing new. An
 * empty sentence keeps nothing: there is no thread to hand a letter.
 * One entry per day (the day's latest build wins), most recent five kept.
 */
export function appendLetterThread(
  dateKey: string,
  offering: { sentence: string; state?: TailorState; focus?: TailorFocus; tone?: TailorTone },
): void {
  try {
    const sentence = offering.sentence.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!sentence) return;
    const rest = readThreads().filter((t) => t.date !== dateKey);
    rest.push({
      date: dateKey,
      sentence,
      state: offering.state,
      focus: offering.focus,
      tone: offering.tone,
    });
    rest.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    writeThreads(rest.slice(0, LETTER_THREADS_MAX));
  } catch {
    // best effort
  }
}
