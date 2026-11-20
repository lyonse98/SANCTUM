import type { Audience } from '@/types';
import { isAnalyticsEnabled } from './analytics';
import { loadTailorProfile, type TailorProfile } from './tailorProfile';
import { contentDateKey } from './dayBoundary';

/**
 * The counts-only profile tally (Erik's design, Nov 18–20, 2026).
 *
 * The standing Tailor profile holds list-picks: the voices a reader
 * chose, their season of life, their ongoing battles, their North Star.
 * Counted across every reader, those picks say what the whole company
 * is carrying — the input the generic reflections are one day steered
 * by, and the proof a parish conversation cites. Erik's rule for the
 * mechanism: COUNTS, NEVER WORDS. Only ids ride, and only from the
 * fields named in buildTallyPayload below — the payload is built by
 * picking fields one by one, never by spreading the profile, so a
 * field the profile gains tomorrow cannot leak into the tally by
 * accident. The reader's own written words are not fields of this
 * payload and never leave the phone through this door.
 *
 * Consent: the tally rides the anonymous analytics opt-in (off by
 * default, Settings). Nothing is sent unless the reader turned counts
 * on; turning it off stops future sends, and a snapshot already held
 * ages out server-side after 90 unrefreshed days. The tally token is
 * a random UUID kept only on this device; the server stores only its
 * SHA-256 hash, one snapshot row per token, so the counts are people,
 * not submissions. The token key lives under the sanctum_ prefix, so
 * the panic wipe takes it like everything else.
 *
 * Every send is fire-and-forget: a tally is never worth an error
 * surface, a retry queue, or a blocked save.
 */

export const TALLY_TOKEN_KEY = 'sanctum_profile_tally_token';
const TALLY_SENT_KEY = 'sanctum_profile_tally_sent';

/** The tally payload: ids only, exactly these keys, in this shape. */
export interface TallyPayload {
  tallyToken: string;
  audience: Audience;
  voices: string[];
  seasonOfLife: string | null;
  ongoingBattles: string[];
  northStar: string | null;
}

function newToken(): string {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return '';
  }
}

/** The device's tally token, created on first use and kept until the wipe. */
export function getTallyToken(): string {
  try {
    let token = localStorage.getItem(TALLY_TOKEN_KEY);
    if (!token) {
      token = newToken();
      if (token) localStorage.setItem(TALLY_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return '';
  }
}

/**
 * Build the payload from a profile by picking the tallied fields BY
 * NAME — voices, season, battles, North Star, and nothing else the
 * profile carries. This function is the fence: what is not named here
 * does not ride.
 */
export function buildTallyPayload(
  audience: Audience,
  profile: TailorProfile,
  token: string = getTallyToken(),
): TallyPayload {
  return {
    tallyToken: token,
    audience,
    voices: [...profile.voices],
    seasonOfLife: profile.seasonOfLife,
    ongoingBattles: [...profile.ongoingBattles],
    northStar: profile.northStar,
  };
}

/** A profile carries a tally when at least one tallied pick is set. */
export function hasTalliedPicks(profile: TailorProfile): boolean {
  return (
    profile.voices.length > 0 ||
    profile.seasonOfLife !== null ||
    profile.ongoingBattles.length > 0 ||
    profile.northStar !== null
  );
}

async function postTally(payload: TallyPayload): Promise<void> {
  if (!payload.tallyToken) return;
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analytics-track`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ tally: payload }),
    });
  } catch {
    // swallow — the tally never breaks the app
  }
}

/**
 * Send the current snapshot for a track. Called when the profile is
 * saved in the editor: whatever the picks now are — including none —
 * replaces what the server held, so the counts track the profile.
 * No-op unless the reader turned counts on.
 */
export async function sendProfileTally(
  audience: Audience,
  profile: TailorProfile = loadTailorProfile(audience),
): Promise<void> {
  if (!isAnalyticsEnabled()) return;
  await postTally(buildTallyPayload(audience, profile));
}

/**
 * The erase bookkeeping: one final snapshot with every pick cleared,
 * so the counts stop carrying a profile that no longer exists. Still
 * just ids — the emptiest ones. No-op unless counts are on.
 */
export async function sendEmptyProfileTally(audience: Audience): Promise<void> {
  if (!isAnalyticsEnabled()) return;
  await postTally({
    tallyToken: getTallyToken(),
    audience,
    voices: [],
    seasonOfLife: null,
    ongoingBattles: [],
    northStar: null,
  });
}

function lastSentDay(audience: Audience): string | null {
  try {
    const raw = localStorage.getItem(TALLY_SENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<Audience, string>>;
    return typeof parsed[audience] === 'string' ? parsed[audience] : null;
  } catch {
    return null;
  }
}

function markSentDay(audience: Audience, day: string): void {
  try {
    let record: Partial<Record<Audience, string>> = {};
    const raw = localStorage.getItem(TALLY_SENT_KEY);
    if (raw) record = JSON.parse(raw) as Partial<Record<Audience, string>>;
    record[audience] = day;
    localStorage.setItem(TALLY_SENT_KEY, JSON.stringify(record));
  } catch {
    // ignore — the guard is a courtesy, not a contract
  }
}

/**
 * The app-open send: once per content day (the 04:00 day) per track,
 * when counts are on and the track's profile holds at least one
 * tallied pick. Keeps live snapshots fresh against the server's
 * 90-day expiry without ever sending more than the day's first open.
 */
export async function maybeSendDailyProfileTally(
  audience: Audience,
  now: Date = new Date(),
): Promise<void> {
  if (!isAnalyticsEnabled()) return;
  const profile = loadTailorProfile(audience);
  if (!hasTalliedPicks(profile)) return;
  const day = contentDateKey(now);
  if (lastSentDay(audience) === day) return;
  markSentDay(audience, day);
  await postTally(buildTallyPayload(audience, profile));
}
