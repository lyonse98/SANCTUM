import { SAINTS } from '@/data/saints';
import { getFeastForDate } from '@/data/feastDays';
import { tailorFocusLabel, type TailorFocus } from '@/data/tailorBank';

/**
 * Tonight — the day's closing on Today (Erik's ruling, Nov 12, 2026: the Examen
 * retires as an on-screen tool). Lectio and the Examen are METHODS, not screen
 * features: the examen's movements — gratitude, one honest look, one resolve —
 * survive as the SHAPE of this short closing, composed entirely from pieces the
 * app already has on the device. No checkboxes, no streaks, no completion state,
 * no scoring, no new server generation. The whole section reads in under thirty
 * seconds, and the word for the method is whispered only where it is honest —
 * the About page and the reminder name a user chose for himself.
 */

/** The one thing Tonight persists: tomorrow's resolve, on-device only. */
export const TONIGHT_RESOLVE_KEY = 'sanctum_tonight_resolve';

/**
 * Short gratitude framings — signposts, not content. The bank rotates by date so
 * the closing does not say the same words every night; both tracks share the
 * bank (gratitude needs no pronoun), in the app's plain voice.
 */
export const GRATITUDE_LINES: string[] = [
  'Begin with thanks. Something today was gift, even if the day was not.',
  'First, gratitude: name one good thing about today before anything else.',
  'Thanks first. The day held at least one mercy — say it plainly.',
  'Start where the day was kind. One gift, named, before the looking back.',
  'Gratitude opens the night: one thing today you did not earn and would not trade.',
  'Before the honest look, the honest thanks — one good, received today.',
  'Let the first word tonight be thanks. The day was not all weight.',
];

function dateSeed(dateKey: string): number {
  let hash = 5381;
  for (let i = 0; i < dateKey.length; i++) {
    hash = ((hash * 33) ^ dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** The gratitude framing for a date — the same all day, different across days. */
export function gratitudeForDate(dateKey: string): string {
  return GRATITUDE_LINES[dateSeed(dateKey) % GRATITUDE_LINES.length];
}

/**
 * Today's saint, resolved exactly as the Saint of the Day card resolves it —
 * the saints list first, the feast calendar second, the day-of-year fallback
 * last — so the closing names the same companion the day itself carried.
 */
export function tonightSaintName(date: Date = new Date()): string {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const listed = SAINTS.find((s) => s.feastDate === mmdd);
  if (listed) return listed.name;
  const feast = getFeastForDate(date);
  if (feast) return feast.name;
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return SAINTS[dayOfYear % SAINTS.length].name;
}

/** The saint line of the closing: "You walked today with —." */
export function saintLine(date: Date = new Date()): string {
  return `You walked today with ${tonightSaintName(date)}.`;
}

/**
 * The honest look: this morning's challenge, echoed back as a question. The
 * challenge is trimmed to its first sentence — the closing quotes the day, it
 * does not re-print it.
 */
export function honestLookLine(challenge: string): string {
  const first = challenge.trim().split(/(?<=[.!?])\s+/)[0] ?? challenge.trim();
  return `This morning's challenge was: ${first} Where did it meet the day?`;
}

/**
 * The Tailor echo: when this morning's tailored devotional exists, tonight
 * remembers what the day was said to be about. Label comes from the bank so
 * the wording matches what the user picked at dawn.
 */
export function tailorEchoLine(focus: TailorFocus): string {
  return `You said this morning was about ${tailorFocusLabel(focus).toLowerCase()}.`;
}

// ── The resolve ──────────────────────────────────────────────────────────────
// One typed line for tomorrow, kept on the device under the sanctum_ prefix
// (the panic wipe takes it with everything else). It is shown once, the next
// morning, in small text at the top of Today, and only until midday.

export interface TonightResolve {
  /** The local date (YYYY-MM-DD) of the evening it was written. */
  date: string;
  text: string;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadTonightResolve(): TonightResolve | null {
  try {
    const raw = localStorage.getItem(TONIGHT_RESOLVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TonightResolve;
    if (typeof parsed.date !== 'string' || typeof parsed.text !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Writes tonight's resolve, dated by the evening it is written on. */
export function saveTonightResolve(text: string, now: Date = new Date()): void {
  try {
    const trimmed = text.trim();
    if (!trimmed) {
      localStorage.removeItem(TONIGHT_RESOLVE_KEY);
      return;
    }
    const value: TonightResolve = { date: localDateKey(now), text: trimmed };
    localStorage.setItem(TONIGHT_RESOLVE_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable — the closing still reads; the resolve just isn't kept
  }
}

/**
 * What the morning shows: last night's resolve, and only last night's — a
 * resolve from two nights ago is not this morning's business. Visible until
 * midday (hour < 12) by the device's clock.
 */
export function morningResolve(now: Date = new Date()): string | null {
  if (now.getHours() >= 12) return null;
  const stored = loadTonightResolve();
  if (!stored || !stored.text) return null;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return stored.date === localDateKey(yesterday) ? stored.text : null;
}
