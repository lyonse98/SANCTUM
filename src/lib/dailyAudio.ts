import { AUDIO_PM_START_HOUR, BELL_PATH, type NarratorId } from './narratorCore';

/**
 * The day's audio row, as the Gospel card's ListenBar consumes it. Mirrors the shape of
 * src/lib/reflection.ts: a REST read with the public anon key (the table's RLS permits
 * exactly this), cached in localStorage keyed by date, and fully fail-silent — any
 * error, timeout, or malformed row resolves to null and the card simply shows no bar.
 * The player can never block, delay, or alter the text experience (spec §11.1), and it
 * sends nothing anywhere: no play events, no analytics.
 */
export interface DailyAudio {
  date: string;
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

const PERSONA_IDS: NarratorId[] = ['henry', 'coach', 'frank', 'ben', 'martin', 'tom', 'ed', 'lector'];

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
  if (typeof row.persona !== 'string' || !PERSONA_IDS.includes(row.persona as NarratorId)) return null;
  if (typeof row.status !== 'string') return null;

  const path = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;
  const headAmPath = path(row.head_am_path);
  const headPmPath = path(row.head_pm_path);
  const mainPath = path(row.main_path);
  if (row.status === 'ready' && (!headAmPath || !headPmPath || !mainPath)) return null;

  return {
    date: row.date,
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

function readCache(dateKey: string, supabaseUrl: string): DailyAudio | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + dateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: unknown };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parseAudioRow(parsed.value, supabaseUrl);
  } catch {
    return null;
  }
}

function writeCache(dateKey: string, row: Record<string, unknown>): void {
  try {
    localStorage.setItem(CACHE_PREFIX + dateKey, JSON.stringify({ at: Date.now(), value: row }));
  } catch {
    // ignore
  }
}

/**
 * Reads the day's daily_audio row. Only 'ready' rows are cached — a 'failed' row can
 * still be healed by the morning retry, and the card should see that on its next open.
 */
export async function fetchDailyAudio(dateKey: string): Promise<DailyAudio | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return null;

  const cached = readCache(dateKey, supabaseUrl);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_audio?date=eq.${dateKey}&select=date,persona,status,head_am_path,head_pm_path,main_path,head_am_seconds,head_pm_seconds,main_seconds`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const audio = parseAudioRow(rows[0], supabaseUrl);
    if (audio?.status === 'ready') {
      writeCache(dateKey, rows[0] as Record<string, unknown>);
    }
    return audio;
  } catch {
    return null;
  }
}
