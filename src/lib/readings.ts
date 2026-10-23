const READINGS_BASE = 'https://cpbjr.github.io/catholic-readings-api';
const CACHE_PREFIX = 'sanctum_readings_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export interface DailyReadings {
  date: string;
  season: string | null;
  celebration: string | null;
  firstReading: string | null;
  psalm: string | null;
  secondReading: string | null;
  gospel: string | null;
  usccbLink: string | null;
}

interface ReadingsPayload {
  date?: string;
  season?: string;
  readings?: {
    firstReading?: string;
    psalm?: string;
    secondReading?: string;
    gospel?: string;
  };
  usccbLink?: string;
}

interface CalendarPayload {
  season?: string;
  celebration?: { name?: string };
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function readCache(key: string): DailyReadings | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: DailyReadings };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: DailyReadings): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // ignore
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Today's real Roman Catholic lectionary citations, with the day's celebration.
 * Returns null when offline or unavailable so callers can fall back gracefully.
 */
export async function fetchDailyReadings(date: Date = new Date()): Promise<DailyReadings | null> {
  const key = isoDate(date);
  const cached = readCache(key);
  if (cached) return cached;

  const md = monthDay(date);
  const year = date.getFullYear();
  const [readings, calendar] = await Promise.all([
    fetchJson<ReadingsPayload>(`${READINGS_BASE}/readings/${year}/${md}.json`),
    fetchJson<CalendarPayload>(`${READINGS_BASE}/liturgical-calendar/${year}/${md}.json`),
  ]);

  const gospel = readings?.readings?.gospel ?? null;
  if (!gospel && !calendar?.celebration?.name) return null;

  const result: DailyReadings = {
    date: key,
    season: readings?.season ?? calendar?.season ?? null,
    celebration: calendar?.celebration?.name ?? null,
    firstReading: readings?.readings?.firstReading ?? null,
    psalm: readings?.readings?.psalm ?? null,
    secondReading: readings?.readings?.secondReading ?? null,
    gospel,
    usccbLink: readings?.usccbLink ?? null,
  };

  writeCache(key, result);
  return result;
}
