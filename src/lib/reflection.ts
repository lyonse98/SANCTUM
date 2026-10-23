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
