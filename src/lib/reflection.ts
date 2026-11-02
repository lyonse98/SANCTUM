export interface Reflection {
  reflect: string;
  challenge: string;
  /** The role the prompts are framed through — always "As a man" so no man is excluded. */
  facet: string;
}

const CACHE_PREFIX = 'sanctum_reflection_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function readCache(dateKey: string): Reflection | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + dateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: Reflection };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(dateKey: string, value: Reflection): void {
  try {
    localStorage.setItem(CACHE_PREFIX + dateKey, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // ignore
  }
}

/**
 * The reflection fetch/display coordination DailyQuote runs on. The reflection is
 * pre-generated server-side and answers fast, while the readings bundle can be slow
 * (its fallback assembles the day from third-party APIs) — so the reflection fetch
 * fires in parallel with the readings load, keyed to the locally computed date, and
 * the block renders on the reflection's own state. Once the bundle resolves, its
 * date is authoritative: a reflection settled for any other date is never displayed
 * (the reflection shown must match the Gospel shown) and a realigning fetch is owed.
 */
export interface ReflectionFetchState {
  /** Date the settled reflection (or settled failure) belongs to. */
  settledFor: string | null;
  /** Date of the fetch currently in flight, if any. */
  inFlightFor: string | null;
}

/** The date a fetch should start for now, or null when none is owed. */
export function nextReflectionFetch(
  state: ReflectionFetchState,
  localDate: string,
  bundleDate: string | null,
): string | null {
  if (state.inFlightFor) return null;
  const want = bundleDate ?? localDate;
  return state.settledFor === want ? null : want;
}

/**
 * What the reflection block may show. `pending` covers both an in-flight fetch and a
 * settled reflection whose date the resolved bundle has superseded (realigning) —
 * in both cases the block renders its spinner rather than another date's words.
 */
export function reflectionDisplay(
  state: ReflectionFetchState & { value: Reflection | null },
  bundleDate: string | null,
): { value: Reflection | null; pending: boolean } {
  const superseded =
    bundleDate !== null && state.settledFor !== null && state.settledFor !== bundleDate;
  return {
    value: superseded ? null : state.value,
    pending: state.inFlightFor !== null || superseded,
  };
}

/**
 * Fetches the day's reflection from the server. The server checks a database table first;
 * if the reflection was already generated (by an earlier call or a cron job), it returns
 * the cached row instantly. If not, it generates it, stores it, and returns it — so the
 * Gemini API is called once per day total, not once per user.
 */
export async function fetchReflection(dateKey: string): Promise<Reflection | null> {
  const cached = readCache(dateKey);
  if (cached) return cached;

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-reflection`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ date: dateKey }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { reflect?: unknown; challenge?: unknown; facet?: unknown };
    const reflect = typeof data.reflect === 'string' ? data.reflect.trim() : '';
    const challenge = typeof data.challenge === 'string' ? data.challenge.trim() : '';
    if (!reflect || !challenge) return null;

    const reflection: Reflection = {
      reflect: reflect.slice(0, 400),
      challenge: challenge.slice(0, 400),
      facet: typeof data.facet === 'string' && data.facet.trim() ? data.facet.trim() : 'As a man',
    };
    writeCache(dateKey, reflection);
    return reflection;
  } catch {
    return null;
  }
}
