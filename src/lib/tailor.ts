import type { Audience } from '@/types';
import type { TailorFocus, TailorMediaType, TailorState } from '@/data/tailorBank';

/**
 * Tailor Today, client side (Nov 12, 2026). One build per user per day: the
 * intake goes to the tailor-devotional function, which composes the devotional
 * in memory and returns text + audio in the response — the server stores
 * NOTHING (see the function's header; the privacy promise is the feature).
 * What the user keeps lives here, on the device: the full payload in Cache
 * Storage (audio included), a small metadata line in localStorage so the
 * Gospel card knows today's tailored devotional exists without opening the
 * cache. Rebuilding is an explicit act and goes back to the server (which
 * caps builds per day); replaying never does.
 *
 * There is no companion lens (Erik, Nov 12, 2026): companions are text-only
 * and live in their chats. The tailoring is the narrator-side pipeline's —
 * the intake aims the generation, the day's narrator voices the result, and
 * the credit line names the narrator only.
 */

export interface TailorIntake {
  state: TailorState;
  focus: TailorFocus;
  freeText: string;
}

export interface TailoredDevotional {
  date: string;
  narratorId: string;
  narratorName: string;
  passage: { citation: string; text: string; translation: string };
  reflect: string;
  challenge: string;
  media: { type: TailorMediaType; title: string; creator: string; searchUrl: string };
  audioBase64: string;
  audioSeconds: number;
}

/** A stable short hash of the intake — the day's build is keyed by what was asked. */
export function intakeHash(intake: TailorIntake): string {
  const seed = `${intake.state}|${intake.focus}|${intake.freeText.trim().toLowerCase()}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

const META_PREFIX = 'sanctum_tailor_';

export function tailorMetaKey(dateKey: string, audience: Audience): string {
  return audience === 'women' ? `${META_PREFIX}women_${dateKey}` : `${META_PREFIX}${dateKey}`;
}

export interface TailorMeta {
  hash: string;
  narratorName: string;
  at: number;
  /** The morning's stated focus — tonight's closing echoes it back. */
  focus?: TailorFocus;
}

export function readTailorMeta(dateKey: string, audience: Audience): TailorMeta | null {
  try {
    const raw = localStorage.getItem(tailorMetaKey(dateKey, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TailorMeta;
    if (typeof parsed.hash !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTailorMeta(dateKey: string, audience: Audience, meta: TailorMeta): void {
  try {
    localStorage.setItem(tailorMetaKey(dateKey, audience), JSON.stringify(meta));
  } catch {
    // ignore — the cache still holds the devotional itself
  }
}

/** The minimal store the tailor cache needs — Cache Storage in the browser, a fake in tests. */
export interface TailorStore {
  get(key: string): Promise<TailoredDevotional | null>;
  set(key: string, value: TailoredDevotional): Promise<void>;
}

const CACHE_NAME = 'sanctum-tailor-v1';

function storeKey(dateKey: string, audience: Audience, hash: string): string {
  return `https://tailor.sanctum.local/${dateKey}/${audience}/${hash}`;
}

/** The browser store: Cache Storage, on-device only, never uploaded anywhere. */
export function createCacheStore(): TailorStore {
  const memory = new Map<string, TailoredDevotional>();
  return {
    async get(key) {
      try {
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(CACHE_NAME);
          const hit = await cache.match(key);
          if (hit) return (await hit.json()) as TailoredDevotional;
          return null;
        }
      } catch {
        // fall through to the in-memory copy
      }
      return memory.get(key) ?? null;
    },
    async set(key, value) {
      memory.set(key, value);
      try {
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(
            key,
            new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }),
          );
        }
      } catch {
        // the in-memory copy still serves this session
      }
    },
  };
}

let sharedStore: TailorStore | null = null;
function defaultStore(): TailorStore {
  if (!sharedStore) sharedStore = createCacheStore();
  return sharedStore;
}

const MEDIA_TYPES: readonly string[] = ['song', 'film', 'podcast', 'talk'];

/** Validates the function's response into the shape the card trusts, or null. */
export function parseTailorResponse(raw: unknown): TailoredDevotional | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.ok !== true) return null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
  const date = str(r.date);
  const narratorId = str(r.narratorId);
  const narratorName = str(r.narratorName);
  const reflect = str(r.reflect);
  const challenge = str(r.challenge);
  const audioBase64 = str(r.audioBase64);
  if (!date || !narratorId || !narratorName || !reflect || !challenge || !audioBase64) {
    return null;
  }
  const passage = r.passage as Record<string, unknown> | undefined;
  const media = r.media as Record<string, unknown> | undefined;
  const pCitation = str(passage?.citation);
  const pText = str(passage?.text);
  const mTitle = str(media?.title);
  const mCreator = str(media?.creator);
  const mUrl = str(media?.searchUrl);
  const mType = typeof media?.type === 'string' && MEDIA_TYPES.includes(media.type) ? (media.type as TailorMediaType) : null;
  if (!pCitation || !pText || !mTitle || !mCreator || !mUrl || !mType) return null;
  return {
    date,
    narratorId,
    narratorName,
    passage: {
      citation: pCitation,
      text: pText,
      translation: str(passage?.translation) ?? 'Douay-Rheims',
    },
    reflect,
    challenge,
    media: { type: mType, title: mTitle, creator: mCreator, searchUrl: mUrl },
    audioBase64,
    audioSeconds: typeof r.audioSeconds === 'number' && r.audioSeconds > 0 ? r.audioSeconds : 0,
  };
}

export interface TailorDeps {
  fetchImpl?: typeof fetch;
  store?: TailorStore;
}

async function callTailorFunction(
  dateKey: string,
  audience: Audience,
  intake: TailorIntake,
  fetchImpl: typeof fetch,
): Promise<TailoredDevotional> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) throw new Error('tailor-unconfigured');
  const res = await fetchImpl(`${supabaseUrl}/functions/v1/tailor-devotional`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      date: dateKey,
      audience,
      state: intake.state,
      focus: intake.focus,
      freeText: intake.freeText,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`tailor-http-${res.status}`);
  const parsed = parseTailorResponse(await res.json());
  if (!parsed) throw new Error('tailor-unusable');
  return parsed;
}

/**
 * The day's tailored devotional: the device's cached build when this exact
 * intake was already built today (NO server call — a replay is free and
 * private), otherwise one build through the function, cached on-device with
 * its metadata line written for the card.
 */
export async function getOrBuildTailored(
  dateKey: string,
  audience: Audience,
  intake: TailorIntake,
  deps: TailorDeps = {},
): Promise<{ devotional: TailoredDevotional; fromCache: boolean }> {
  const store = deps.store ?? defaultStore();
  const hash = intakeHash(intake);
  const key = storeKey(dateKey, audience, hash);
  const cached = await store.get(key);
  if (cached && cached.date === dateKey) {
    return { devotional: cached, fromCache: true };
  }
  const built = await callTailorFunction(dateKey, audience, intake, deps.fetchImpl ?? fetch);
  await store.set(key, built);
  writeTailorMeta(dateKey, audience, {
    hash,
    narratorName: built.narratorName,
    at: Date.now(),
    focus: intake.focus,
  });
  return { devotional: built, fromCache: false };
}

/** Loads today's existing build (if any) for the card's "play yours" state. */
export async function loadTodaysTailored(
  dateKey: string,
  audience: Audience,
  deps: TailorDeps = {},
): Promise<TailoredDevotional | null> {
  const meta = readTailorMeta(dateKey, audience);
  if (!meta) return null;
  const store = deps.store ?? defaultStore();
  const found = await store.get(storeKey(dateKey, audience, meta.hash));
  return found && found.date === dateKey ? found : null;
}

/** "Tailored for today · read by Ben" — the credit line over the player. Narrator only: no companion lens exists in Tailor Today. */
export function tailorCreditLine(devotional: TailoredDevotional): string {
  return `Tailored for today · read by ${devotional.narratorName}`;
}

/** What the media card's link does, named by where the search URL points. */
export function mediaActionLabel(media: TailoredDevotional['media']): string {
  if (media.searchUrl.includes('open.spotify.com')) return 'Find it on Spotify';
  if (media.searchUrl.includes('youtube.com')) return 'Watch on YouTube';
  return 'Look it up';
}

export const MEDIA_TYPE_LABELS: Record<TailorMediaType, string> = {
  song: 'Song',
  film: 'Film',
  podcast: 'Podcast',
  talk: 'Talk',
};

/** Decodes the response's base64 audio into a playable object URL. */
export function tailorAudioUrl(devotional: TailoredDevotional): string {
  const binary = atob(devotional.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}
