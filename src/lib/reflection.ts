import type { Audience } from '@/types';
import { audienceFacet } from '@/lib/audience';

export interface Reflection {
  reflect: string;
  challenge: string;
  /** The role the prompts are framed through — "As a man" / "As a woman", so no one is excluded. */
  facet: string;
}

const CACHE_PREFIX = 'sanctum_reflection_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * The on-device cache key. Men's entries keep the original `sanctum_reflection_<date>`
 * shape (existing installs' caches stay valid); women's entries are namespaced apart
 * so the two tracks' reflections can never be served to the wrong audience.
 */
export function reflectionCacheKey(dateKey: string, audience: Audience): string {
  return audience === 'women' ? `${CACHE_PREFIX}women_${dateKey}` : `${CACHE_PREFIX}${dateKey}`;
}

function readCache(dateKey: string, audience: Audience): Reflection | null {
  try {
    const raw = localStorage.getItem(reflectionCacheKey(dateKey, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: Reflection };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(dateKey: string, audience: Audience, value: Reflection): void {
  try {
    localStorage.setItem(reflectionCacheKey(dateKey, audience), JSON.stringify({ at: Date.now(), value }));
  } catch {
    // ignore
  }
}

/** The exact request body sent to the daily-reflection function. */
export function reflectionRequestBody(dateKey: string, audience: Audience): { date: string; audience: Audience } {
  return { date: dateKey, audience };
}

/**
 * The reflection fetch/display coordination DailyQuote runs on. The reflection is
 * pre-generated server-side and answers fast, while the readings bundle can be slow
 * (its fallback assembles the day from third-party APIs) — so the reflection fetch
 * fires in parallel with the readings load, keyed to the locally computed date, and
 * the block renders on the reflection's own state. Once the bundle resolves, its
 * date is authoritative: a reflection settled for any other date is never displayed
 * (the reflection shown must match the Gospel shown) and a realigning fetch is owed.
 * The pair rule extends to the track: settled state is a (date, audience) pair, so
 * a reflection fetched for one track is never displayed on the other — a Settings
 * track switch owes a fresh fetch for the new track, facet included.
 */
export interface ReflectionFetchState {
  /** Date the settled reflection (or settled failure) belongs to. */
  settledFor: string | null;
  /** Date of the fetch currently in flight, if any. */
  inFlightFor: string | null;
  /**
   * Track the settled reflection was fetched for. A reflection only ever
   * answers for its own (date, audience) pair: the men's reflection settled
   * for today is NOT settled for a woman who switches tracks — its words,
   * and its "As a man" facet, belong to the other track.
   */
  settledAudience: Audience | null;
  /** Track the in-flight fetch is for, if any. */
  inFlightAudience: Audience | null;
}

/** The date a fetch should start for now, or null when none is owed. */
export function nextReflectionFetch(
  state: ReflectionFetchState,
  localDate: string,
  bundleDate: string | null,
  audience: Audience,
): string | null {
  if (state.inFlightFor) return null;
  const want = bundleDate ?? localDate;
  const settled = state.settledFor === want && state.settledAudience === audience;
  return settled ? null : want;
}

/**
 * What the reflection block may show. `pending` covers both an in-flight fetch and a
 * settled reflection the current view has superseded — because the resolved bundle
 * moved the day (realigning), or because the track switched and the settled words
 * are the other audience's. In both cases the block renders its spinner rather
 * than another date's — or another track's — words.
 */
export function reflectionDisplay(
  state: ReflectionFetchState & { value: Reflection | null },
  bundleDate: string | null,
  audience: Audience,
): { value: Reflection | null; pending: boolean } {
  const superseded =
    (bundleDate !== null && state.settledFor !== null && state.settledFor !== bundleDate) ||
    (state.settledAudience !== null && state.settledAudience !== audience);
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
export async function fetchReflection(dateKey: string, audience: Audience = 'men'): Promise<Reflection | null> {
  const cached = readCache(dateKey, audience);
  if (cached) return cached;

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-reflection`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(reflectionRequestBody(dateKey, audience)),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { reflect?: unknown; challenge?: unknown; facet?: unknown };
    const reflect = typeof data.reflect === 'string' ? data.reflect.trim() : '';
    const challenge = typeof data.challenge === 'string' ? data.challenge.trim() : '';
    if (!reflect || !challenge) return null;

    const reflection: Reflection = {
      reflect: reflect.slice(0, 400),
      challenge: challenge.slice(0, 400),
      facet: typeof data.facet === 'string' && data.facet.trim() ? data.facet.trim() : audienceFacet(audience),
    };
    writeCache(dateKey, audience, reflection);
    return reflection;
  } catch {
    return null;
  }
}
