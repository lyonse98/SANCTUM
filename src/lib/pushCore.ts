/**
 * The shared brain of the daily poke — the parts the browser and the dispatch function must
 * never disagree about: what the notification says, where it opens, and when a subscription
 * is due. This file is the source of truth; `scripts/sync-push-core.mjs` copies it verbatim
 * into `supabase/functions/push-dispatch/`, the same arrangement the companion prompts use.
 * It must therefore stay free of imports and browser APIs — plain TypeScript and `Intl` only.
 *
 * The copy rule lives here so it can be tested: a notification is read on a lock screen, by
 * whoever is holding the phone. It says the day's Gospel is ready and nothing more — nothing
 * tender, nothing personal, ever. The depth waits inside the app.
 */

export const PUSH_TITLE = 'Sanctum';
export const PUSH_BODY = 'Your Gospel and reflection are ready.';

/**
 * The stored vocabulary of reminder focuses — the same vocabulary as the email reminder.
 * Since Erik's ruling of Nov 16, 2026 the reminder has exactly ONE landing (the day's
 * Gospel — see FOCUS_ROUTES and deepLinkUrlForFocus below); the other three keys survive
 * only so subscriptions and links created before the ruling still parse.
 */
export const PUSH_FOCUS_KEYS = ['gospel', 'examen', 'rosary', 'rule'] as const;
export type PushFocus = (typeof PUSH_FOCUS_KEYS)[number];
export const DEFAULT_PUSH_FOCUS: PushFocus = 'gospel';

export function isPushFocus(value: unknown): value is PushFocus {
  return typeof value === 'string' && (PUSH_FOCUS_KEYS as readonly string[]).includes(value);
}

/**
 * Where a tap on the notification lands. Erik's ruling (Nov 16, 2026): the reminder has
 * one landing — the day's Gospel on Today. The notification's own words promise the
 * Gospel ("Your Gospel and reflection are ready"), so every focus, including the three
 * legacy keys kept for old subscriptions, resolves to the same route. A focus that
 * cannot resolve to a real screen would be a broken promise, so the map stays total
 * over the four keys and tests pin it.
 */
export interface FocusRoute {
  tab: 'today' | 'church';
  churchTab?: string;
  /** Inside the Pray door: which section opens. */
  churchPray?: string;
  /** Land on Today with the Tonight closing revealed, even outside the evening hours. */
  todayExamen?: boolean;
}

export const FOCUS_ROUTES: Record<PushFocus, FocusRoute> = {
  gospel: { tab: 'today' },
  examen: { tab: 'today' },
  rosary: { tab: 'today' },
  rule: { tab: 'today' },
};

/**
 * The URL the notification opens. One landing since Nov 16, 2026: the Gospel, carrying
 * the `#daily-gospel` fragment the Today screen honours by scrolling the readings into
 * view. Whatever focus an old subscription still holds, this is where its tap goes.
 */
export function deepLinkUrlForFocus(_focus: string): string {
  return '/?focus=gospel#daily-gospel';
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  focus: PushFocus;
}

/** Builds exactly what the service worker is allowed to show. No other text ever ships. */
export function buildPushPayload(focus: string): PushPayload {
  const safe: PushFocus = isPushFocus(focus) ? focus : DEFAULT_PUSH_FOCUS;
  return { title: PUSH_TITLE, body: PUSH_BODY, url: deepLinkUrlForFocus(safe), focus: safe };
}

/** Reads the focus out of a page URL's query string (`?focus=examen`); null when absent or unknown. */
export function parseFocusParam(search: string): PushFocus | null {
  try {
    const value = new URLSearchParams(search).get('focus');
    return isPushFocus(value) ? value : null;
  } catch {
    return null;
  }
}

/** A reminder time is always 'HH:MM', 24-hour — the shape an <input type="time"> produces. */
export function isValidLocalTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function localTimeToMinutes(localTime: string): number {
  const [h, m] = localTime.split(':').map((part) => Number(part));
  return h * 60 + m;
}

/** The dispatch cron runs every quarter hour; a poke is due inside one quarter-hour window. */
export const DISPATCH_WINDOW_MINUTES = 15;

export interface PushSubscriptionTiming {
  tz: string;
  /** 'HH:MM', the subscriber's chosen local time. */
  localTime: string;
  /** 'YYYY-MM-DD' in the subscriber's timezone — the local date of the last delivered poke. */
  lastSentOn: string | null;
}

export interface LocalNow {
  dateKey: string;
  minutes: number;
}

/** What the wall clock in `tz` says right now: the local date, and minutes since local midnight. */
export function localNowParts(now: Date, tz: string): LocalNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(get('hour')) % 24; // h23 can still report 24 at midnight in some engines
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  };
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part));
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export interface DueEvaluation {
  due: boolean;
  /** The local date this poke belongs to — what gets written to `last_sent_on` on delivery. */
  localDateKey: string;
}

/**
 * Is this subscription owed a poke on this dispatch tick?
 *
 * Due when the chosen local time fell inside the last quarter hour and no poke has been
 * delivered for that local date yet. The arithmetic is done in minutes-of-day, modulo a
 * day, so a 23:55 reminder caught by the 00:05 tick still fires — and belongs to the date
 * its time fell on, which the wrap branch recovers by stepping the date back one day.
 *
 * Daylight saving is handled by the `lastSentOn` guard rather than by the clock math:
 * on the autumn fall-back day a 1:30 reminder's local time happens twice, but the second
 * occurrence finds the date already marked sent. On the spring-forward day a 2:30 reminder
 * never falls inside any window (that hour does not exist) and is simply skipped — one
 * missed poke in a year, by design, rather than a poke at a wrong-feeling hour.
 */
export function evaluateDue(sub: PushSubscriptionTiming, now: Date): DueEvaluation {
  if (!isValidLocalTime(sub.localTime)) return { due: false, localDateKey: '' };
  let local: LocalNow;
  try {
    local = localNowParts(now, sub.tz);
  } catch {
    return { due: false, localDateKey: '' }; // an unparseable timezone never sends
  }

  const target = localTimeToMinutes(sub.localTime);
  const sinceTarget = (local.minutes - target + 1440) % 1440;
  if (sinceTarget >= DISPATCH_WINDOW_MINUTES) {
    return { due: false, localDateKey: local.dateKey };
  }

  const targetDateKey = local.minutes >= target ? local.dateKey : shiftDateKey(local.dateKey, -1);
  return { due: sub.lastSentOn !== targetDateKey, localDateKey: targetDateKey };
}

export function isDue(sub: PushSubscriptionTiming, now: Date): boolean {
  return evaluateDue(sub, now).due;
}

/**
 * The evening slot (Erik's ruling, Nov 17, 2026): a subscriber may add a
 * second daily poke in the evening. It is the SAME poke — same payload, same
 * Gospel landing — so the only new question is when it is due, and that is
 * the morning question asked of the evening hour, with the evening slot's
 * own sent marker. Two guards keep it honest:
 *
 * - No evening hour set (or a malformed one) means no evening poke, ever.
 * - An evening hour equal to the morning hour is one poke, never two
 *   identical ones minutes apart in spirit and seconds apart in fact.
 */
export interface PushEveningTiming extends PushSubscriptionTiming {
  /** 'HH:MM', the optional evening hour; null when no evening reminder is set. */
  eveningTime: string | null;
  /** 'YYYY-MM-DD' in the subscriber's timezone — the local date of the last delivered evening poke. */
  eveningLastSentOn: string | null;
}

export function evaluateEveningDue(sub: PushEveningTiming, now: Date): DueEvaluation {
  if (!isValidLocalTime(sub.eveningTime)) return { due: false, localDateKey: '' };
  if (sub.eveningTime === sub.localTime) return { due: false, localDateKey: '' };
  return evaluateDue(
    { tz: sub.tz, localTime: sub.eveningTime, lastSentOn: sub.eveningLastSentOn },
    now,
  );
}

export function isEveningDue(sub: PushEveningTiming, now: Date): boolean {
  return evaluateEveningDue(sub, now).due;
}
