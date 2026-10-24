import type { DailyReadings } from './readings';
import type { PassageVerses, ReadingTexts } from './bible';

/**
 * The day's readings as one server-assembled bundle (the `daily-readings` edge function
 * caches it in the daily_readings table, so the first phone of the day pays the upstream
 * calls and everyone else reads the row). This replaces per-phone calls to the unofficial
 * lectionary API and getbible.net as the primary path; DailyQuote keeps the direct path
 * as a fallback, and if both fail, the last good bundle is served stale — labeled.
 */
export interface ReadingsBundle {
  citations: DailyReadings;
  gospelVerses: PassageVerses | null;
  texts: ReadingTexts;
  stale?: boolean;
  staleDate?: string;
}

const BUNDLE_KEY = 'sanctum_readings_bundle';

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readStaleBundle(): { dateKey: string; bundle: ReadingsBundle } | null {
  try {
    const raw = localStorage.getItem(BUNDLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { dateKey: string; bundle: ReadingsBundle };
    if (!parsed?.bundle?.citations) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBundle(dateKey: string, bundle: ReadingsBundle): void {
  try {
    localStorage.setItem(BUNDLE_KEY, JSON.stringify({ dateKey, bundle }));
  } catch {
    // ignore
  }
}

let inflight: Promise<ReadingsBundle | null> | null = null;
let inflightKey = '';

export function fetchReadingsBundle(date: Date = new Date()): Promise<ReadingsBundle | null> {
  const key = isoDate(date);
  if (inflight && inflightKey === key) return inflight;
  inflightKey = key;
  inflight = (async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (supabaseUrl && anonKey) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/daily-readings?date=${key}`, {
          headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          const bundle = (await res.json()) as ReadingsBundle;
          if (bundle?.citations) {
            writeBundle(key, bundle);
            return bundle;
          }
        }
      } catch {
        // fall through to the stale cache
      }
    }
    const stale = readStaleBundle();
    if (stale) return { ...stale.bundle, stale: true, staleDate: stale.dateKey };
    return null;
  })();
  return inflight;
}
