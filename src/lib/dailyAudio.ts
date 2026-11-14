import {
  AUDIO_PM_START_HOUR,
  BELL_PATH,
  NARRATOR_IDS,
  type NarratorAudience,
  type NarratorId,
} from './narratorCore';
import type { Audience } from '@/types';

/**
 * The day's audio row, as the Gospel card's ListenBar consumes it. Mirrors the shape of
 * src/lib/reflection.ts: a REST read with the public anon key (the table's RLS permits
 * exactly this), cached in localStorage keyed by date, and fully fail-silent — any
 * error, timeout, or malformed row resolves to null and the card simply shows no bar.
 * The player can never block, delay, or alter the text experience (spec §11.1), and it
 * sends nothing anywhere: no play events, no analytics.
 *
 * Rows are per (date, audience): the two tracks render independently, and a missing
 * or failed row on one track says nothing about the other.
 */
export interface DailyAudio {
  date: string;
  audience: NarratorAudience;
  persona: NarratorId;
  status: string;
  headAmUrl: string | null;
  headPmUrl: string | null;
  mainUrl: string | null;
  bellUrl: string;
  headAmSeconds: number | null;
  headPmSeconds: number | null;
  mainSeconds: number | null;
}

const CACHE_PREFIX = 'sanctum_audio_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * The cache key for a track's row. Men's keeps the original key (existing devices
 * hold valid cached rows under it); women's gets its own, mirroring reflection.ts,
 * so the two tracks' caches can never serve each other's row.
 */
export function audioCacheKey(dateKey: string, audience: Audience): string {
  return audience === 'women' ? `${CACHE_PREFIX}women_${dateKey}` : `${CACHE_PREFIX}${dateKey}`;
}

export function audioPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/daily-audio/${path}`;
}

function secondsOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Validates a raw daily_audio row into the shape the player trusts. A 'ready' row must
 * carry all three paths; anything malformed resolves to null (no bar) rather than a
 * half-broken player.
 */
export function parseAudioRow(raw: unknown, supabaseUrl: string): DailyAudio | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null;
  if (typeof row.persona !== 'string' || !NARRATOR_IDS.includes(row.persona as NarratorId)) return null;
  if (typeof row.status !== 'string') return null;
  // Rows written before the audience re-key carry no audience; they are men's rows.
  const audience: NarratorAudience = row.audience === 'women' ? 'women' : 'men';

  const path = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;
  const headAmPath = path(row.head_am_path);
  const headPmPath = path(row.head_pm_path);
  const mainPath = path(row.main_path);
  if (row.status === 'ready' && (!headAmPath || !headPmPath || !mainPath)) return null;

  return {
    date: row.date,
    audience,
    persona: row.persona as NarratorId,
    status: row.status,
    headAmUrl: headAmPath ? audioPublicUrl(supabaseUrl, headAmPath) : null,
    headPmUrl: headPmPath ? audioPublicUrl(supabaseUrl, headPmPath) : null,
    mainUrl: mainPath ? audioPublicUrl(supabaseUrl, mainPath) : null,
    bellUrl: audioPublicUrl(supabaseUrl, BELL_PATH),
    headAmSeconds: secondsOrNull(row.head_am_seconds),
    headPmSeconds: secondsOrNull(row.head_pm_seconds),
    mainSeconds: secondsOrNull(row.main_seconds),
  };
}

/** Which head a session plays, from the device's own hour (§11.2). Locked at first tap. */
export function headForHour(hour: number): 'am' | 'pm' {
  return hour < AUDIO_PM_START_HOUR ? 'am' : 'pm';
}

/** Where a global second lands inside a sequence of files (§11.3 seek mapping). */
export interface SequenceSeekTarget {
  /** Index of the file that holds the target second. */
  index: number;
  /** Seconds into that file. */
  offset: number;
  /** Seconds before that file — the player's base offset while it plays. */
  baseOffset: number;
}

/**
 * Maps a position in the whole day's listening (what the seek slider and the
 * lock-screen controls speak) to a file and an offset within it, for the
 * sequence fallback where head and main are separate files. The target is
 * clamped into [0, total]; a position exactly on a boundary belongs to the
 * following file at offset 0 (the same audible instant, without resting on
 * the earlier file's ended edge), except the very end, which rests at the
 * last file's end. Zero-length segments are passed over; an empty or
 * all-zero sequence resolves to the origin.
 */
export function sequenceSeekTarget(globalSeconds: number, durations: number[]): SequenceSeekTarget {
  const total = durations.reduce((n, d) => n + (Number.isFinite(d) && d > 0 ? d : 0), 0);
  const target = Number.isFinite(globalSeconds) ? Math.min(Math.max(0, globalSeconds), total) : 0;
  let base = 0;
  for (let i = 0; i < durations.length; i++) {
    const d = Number.isFinite(durations[i]) && durations[i] > 0 ? durations[i] : 0;
    const isLast = i === durations.length - 1;
    if (d > 0 && (target < base + d || isLast)) {
      return { index: i, offset: Math.min(target - base, d), baseOffset: base };
    }
    base += d;
  }
  return { index: 0, offset: 0, baseOffset: 0 };
}

function readCache(dateKey: string, audience: Audience, supabaseUrl: string): DailyAudio | null {
  try {
    const raw = localStorage.getItem(audioCacheKey(dateKey, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: unknown };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    const audio = parseAudioRow(parsed.value, supabaseUrl);
    // A cached row from the other track is never served, even if a key collided.
    return audio && audio.audience === audience ? audio : null;
  } catch {
    return null;
  }
}

function writeCache(dateKey: string, audience: Audience, row: Record<string, unknown>): void {
  try {
    localStorage.setItem(audioCacheKey(dateKey, audience), JSON.stringify({ at: Date.now(), value: row }));
  } catch {
    // ignore
  }
}

/**
 * Reads the day's daily_audio row FOR ONE TRACK. Only 'ready' rows are cached — a
 * 'failed' row can still be healed by the morning retry, and the card should see
 * that on its next open. The audience filter is in the query itself, so one track's
 * render state can never leak into the other's card.
 */
export async function fetchDailyAudio(dateKey: string, audience: Audience = 'men'): Promise<DailyAudio | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return null;

  const cached = readCache(dateKey, audience, supabaseUrl);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_audio?date=eq.${dateKey}&audience=eq.${audience}&select=date,audience,persona,status,head_am_path,head_pm_path,main_path,head_am_seconds,head_pm_seconds,main_seconds`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const audio = parseAudioRow(rows[0], supabaseUrl);
    if (audio?.status === 'ready' && audio.audience === audience) {
      writeCache(dateKey, audience, rows[0] as Record<string, unknown>);
    }
    return audio && audio.audience === audience ? audio : null;
  } catch {
    return null;
  }
}
