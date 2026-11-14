import type { Audience } from '@/types';
import { tailorFocusLabel, type TailorFocus, type TailorMediaKind, type TailorState, type TailorTone } from '@/data/tailorBank';
import { profileSignature, type TailorRequestProfile } from '@/lib/tailorProfile';

/**
 * Tailor Today, client side (Nov 12, 2026). One build per user per day: the
 * intake goes to the tailor-devotional function, which composes the devotional
 * in memory and returns the package in the response — the server stores
 * NOTHING (see the function's header; the privacy promise is the feature).
 * AUDIO (Nov 13, 2026): the narration is client-orchestrated. A full render
 * exceeds the platform's per-request CPU ceiling inside one invocation, so
 * the build returns the text package plus a signed AUDIO PLAN — the script
 * cut into ≤200-char pieces — and this device fetches each piece from the
 * function's piece mode (the plan token is the authorization), concatenates
 * the MP3 bytes here, and caches the joined audio in place of the plan's
 * promise, exactly where the old baked audio lived. A build whose function
 * has no render key configured returns no plan: the text-only package, with
 * the panel showing no Listen bar.
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
  /** "What do you want from God today?" — the tone of the ask (Nov 13, 2026). */
  tone: TailorTone;
  freeText: string;
  /**
   * The standing profile's request shape (labels, not ids), snapshotted at
   * build time — or null when the user keeps no profile. It rides with the
   * request transiently; the server stores nothing, and the snapshot is
   * folded into the cache key so a profile edit makes the same stated
   * morning a new build rather than a stale replay.
   */
  profile?: TailorRequestProfile | null;
}

export interface TailoredDevotional {
  date: string;
  narratorId: string;
  narratorName: string;
  passage: { citation: string; text: string; translation: string };
  reflect: string;
  challenge: string;
  /** A word from the tradition, chosen for this morning — or null when none was found. */
  traditionQuote: { text: string; author: string } | null;
  media: {
    kind: TailorMediaKind;
    title: string;
    creator: string;
    /** A found item's own page (live search), or a search URL (the curated bank). */
    url: string;
    /** One line, from the morning's categories only: why this, today. */
    why: string;
  };
  /**
   * The build's narration, base64 MP3 — or null until the audio plan below
   * has been fetched and stitched on this device (or for good, on a build
   * whose function issued no plan). A null renders the full package with
   * the Listen bar simply absent; older cached builds keep their audio.
   */
  audioBase64: string | null;
  audioSeconds: number;
  /**
   * The build's signed audio plan (function side: audioPlan.ts) — the
   * pieces this device fetches one call at a time and stitches into
   * audioBase64. Null when the build issued none. Kept on the cached
   * package so a day whose stitch failed can be retried on a later open
   * without a rebuild.
   */
  audioPlan: TailorAudioPlanEntry[] | null;
}

/** One signed piece of a build's audio plan — text plus its render token. */
export interface TailorAudioPlanEntry {
  index: number;
  /** The spoken text ('' for the produced-silence piece). */
  text: string;
  token: string;
}

/** A stable short hash of the intake — the day's build is keyed by what was asked. */
export function intakeHash(intake: TailorIntake): string {
  const seed = [
    intake.state,
    intake.focus,
    intake.tone,
    intake.freeText.trim().toLowerCase(),
    profileSignature(intake.profile ?? null),
  ].join('|');
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

const MEDIA_KINDS: readonly string[] = ['song', 'film', 'podcast', 'talk', 'video', 'article', 'book'];

/**
 * Validates a build's audio plan, or null. The plan is additive — a build
 * without one (or with a malformed one) still parses as the text package —
 * so a bad plan degrades to null rather than rejecting the devotional.
 * Entries are re-sorted by index: the stitch must follow the plan's order,
 * not the wire's.
 */
export function parseAudioPlan(raw: unknown): TailorAudioPlanEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries: TailorAudioPlanEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const e = item as Record<string, unknown>;
    if (typeof e.index !== 'number' || !Number.isInteger(e.index) || e.index < 0) return null;
    if (typeof e.text !== 'string' || typeof e.token !== 'string' || e.token.length === 0) return null;
    entries.push({ index: e.index, text: e.text, token: e.token });
  }
  entries.sort((a, b) => a.index - b.index);
  return entries;
}

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
  // Audio is the one optional field: the text package stands on its own,
  // and a build without narration (absent, null, or empty) parses whole
  // with audioBase64 null — the panel then shows no Listen bar.
  const audioBase64 = str(r.audioBase64);
  if (!date || !narratorId || !narratorName || !reflect || !challenge) {
    return null;
  }
  const passage = r.passage as Record<string, unknown> | undefined;
  const media = r.media as Record<string, unknown> | undefined;
  const pCitation = str(passage?.citation);
  const pText = str(passage?.text);
  const mTitle = str(media?.title);
  const mCreator = str(media?.creator);
  // v2 names them kind/url; the v1 aliases (type/searchUrl) are still honoured
  // so a response from either shape of the function parses the same way.
  const mUrl = str(media?.url) ?? str(media?.searchUrl);
  const mKindRaw = typeof media?.kind === 'string' ? media.kind : media?.type;
  const mKind = typeof mKindRaw === 'string' && MEDIA_KINDS.includes(mKindRaw) ? (mKindRaw as TailorMediaKind) : null;
  if (!pCitation || !pText || !mTitle || !mCreator || !mUrl || !mKind) return null;
  const quote = r.traditionQuote as Record<string, unknown> | null | undefined;
  const qText = str(quote?.text);
  const qAuthor = str(quote?.author);
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
    traditionQuote: qText && qAuthor ? { text: qText, author: qAuthor } : null,
    media: { kind: mKind, title: mTitle, creator: mCreator, url: mUrl, why: str(media?.why) ?? '' },
    audioBase64,
    audioSeconds: typeof r.audioSeconds === 'number' && r.audioSeconds > 0 ? r.audioSeconds : 0,
    audioPlan: parseAudioPlan(r.audioPlan),
  };
}

export interface TailorDeps {
  fetchImpl?: typeof fetch;
  store?: TailorStore;
}

/** The function's address and public key — the one door both calls use. */
function tailorEndpoint(): { url: string; anonKey: string } | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return null;
  return { url: `${supabaseUrl}/functions/v1/tailor-devotional`, anonKey };
}

async function callTailorFunction(
  dateKey: string,
  audience: Audience,
  intake: TailorIntake,
  fetchImpl: typeof fetch,
): Promise<TailoredDevotional> {
  const endpoint = tailorEndpoint();
  if (!endpoint) throw new Error('tailor-unconfigured');
  const { url, anonKey } = endpoint;
  const res = await fetchImpl(url, {
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
      tone: intake.tone,
      freeText: intake.freeText,
      // The standing profile rides transiently, exactly like the morning's own
      // words: the function phrases from it and stores nothing (privacy pins).
      profile: intake.profile ?? null,
    }),
    // A live build (search + composition + a full render) may take a minute
    // or two; the timeout is generous on purpose, and the card's failure
    // state is calm either way.
    signal: AbortSignal.timeout(300000),
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

// ── The audio plan, fetched and stitched on-device ───────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Joins base64 MP3 pieces into one base64 stream, in the order given. The
 * pieces are encoded at identical settings (24 kHz mono CBR 64 kbps, bare
 * frames), so the join is a plain byte concatenation — the same frame
 * concatenation the daily render's finalize relies on server-side. Null
 * for no pieces: an empty program has no audio to stitch.
 */
export function concatBase64Mp3(pieces: string[]): string | null {
  if (pieces.length === 0) return null;
  const decoded = pieces.map(base64ToBytes);
  const total = decoded.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const piece of decoded) {
    out.set(piece, at);
    at += piece.length;
  }
  return bytesToBase64(out);
}

/** How many piece renders run at once — a few buckets in the air, no flood. */
const PIECE_CONCURRENCY = 3;

async function callTailorPiece(
  endpoint: { url: string; anonKey: string },
  dateKey: string,
  audience: Audience,
  entry: TailorAudioPlanEntry,
  fetchImpl: typeof fetch,
): Promise<{ audioBase64: string; seconds: number } | null> {
  try {
    const res = await fetchImpl(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: endpoint.anonKey,
        Authorization: `Bearer ${endpoint.anonKey}`,
      },
      body: JSON.stringify({
        piece: { date: dateKey, audience, index: entry.index, text: entry.text, token: entry.token },
      }),
      // One narration piece is seconds of work on the far side; the margin
      // is for a cold start, not for a render that will never finish.
      signal: AbortSignal.timeout(150000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    if (json.ok !== true || typeof json.audioBase64 !== 'string' || json.audioBase64.length === 0) {
      return null;
    }
    return {
      audioBase64: json.audioBase64,
      seconds: typeof json.seconds === 'number' && json.seconds > 0 ? json.seconds : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Completes a planned devotional's narration on this device: every plan
 * piece is fetched from the function's piece mode (its token is the
 * authorization — no build quota is involved), the MP3 bytes are joined in
 * plan order, and the stitched package replaces the plan's promise in the
 * on-device cache, so the play bar, replay, and share flows take it from
 * there unchanged. Fail-open by design: any piece that fails its one retry
 * leaves the package text-only (null returned) with its plan intact, and a
 * later open may try again.
 */
export async function fetchTailorAudio(
  dateKey: string,
  audience: Audience,
  devotional: TailoredDevotional,
  deps: TailorDeps = {},
): Promise<TailoredDevotional | null> {
  const plan = devotional.audioPlan;
  if (!plan || plan.length === 0 || devotional.audioBase64) return null;
  const endpoint = tailorEndpoint();
  if (!endpoint) return null;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const ordered = [...plan].sort((a, b) => a.index - b.index);
  const pieces = new Array<string | null>(ordered.length).fill(null);
  let seconds = 0;
  let failed = false;
  let cursor = 0;
  const worker = async () => {
    while (!failed && cursor < ordered.length) {
      const at = cursor;
      cursor += 1;
      const entry = ordered[at];
      // One retry per piece: a cold start or a dropped call should not cost
      // the morning its narration; a second failure settles it.
      let got = await callTailorPiece(endpoint, dateKey, audience, entry, fetchImpl);
      if (!got) got = await callTailorPiece(endpoint, dateKey, audience, entry, fetchImpl);
      if (!got) {
        failed = true;
        return;
      }
      pieces[at] = got.audioBase64;
      seconds += got.seconds;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PIECE_CONCURRENCY, ordered.length) }, () => worker()),
  );
  if (failed || pieces.some((p) => p === null)) return null;

  const audioBase64 = concatBase64Mp3(pieces as string[]);
  if (!audioBase64) return null;
  const merged: TailoredDevotional = {
    ...devotional,
    audioBase64,
    audioSeconds: Math.round(seconds * 10) / 10,
  };
  // The stitched package takes the plan's place in the cache, under the
  // day's own key — a replay from here is the old baked-audio replay.
  const meta = readTailorMeta(dateKey, audience);
  if (meta) {
    const store = deps.store ?? defaultStore();
    try {
      await store.set(storeKey(dateKey, audience, meta.hash), merged);
    } catch {
      // The merged package still plays this session; the cache is a courtesy.
    }
  }
  return merged;
}

/**
 * The honest stages of a live build, in the order the work roughly happens.
 * They rotate on the client's own clock while the one request is in flight —
 * a truthful account of what the build does, not a fake progress feed.
 */
export function tailorProgressLines(focus: TailorFocus): string[] {
  return [
    'Reading today’s readings…',
    `Finding a passage for ${tailorFocusLabel(focus).toLowerCase()}…`,
    'Choosing something to lift you…',
    'Putting your morning together…',
  ];
}

/** "Tailored for today · read by Ben" — the credit line over the player. Narrator only: no companion lens exists in Tailor Today. */
export function tailorCreditLine(devotional: TailoredDevotional): string {
  return `Tailored for today · read by ${devotional.narratorName}`;
}

/** What the media card's link does, named by where the link points. */
export function mediaActionLabel(media: TailoredDevotional['media']): string {
  if (media.url.includes('open.spotify.com/search')) return 'Find it on Spotify';
  if (media.url.includes('youtube.com/results')) return 'Watch on YouTube';
  if (media.url.includes('google.com/search')) return 'Look it up';
  if (media.url.includes('youtube.com') || media.url.includes('youtu.be') || media.url.includes('vimeo.com')) {
    return 'Watch it';
  }
  if (media.url.includes('spotify.com') || media.url.includes('podcasts.apple.com')) return 'Listen';
  return 'Open it';
}

export const MEDIA_KIND_LABELS: Record<TailorMediaKind, string> = {
  song: 'Song',
  film: 'Film',
  podcast: 'Podcast',
  talk: 'Talk',
  video: 'Video',
  article: 'Article',
  book: 'Book',
};

/** Decodes the response's base64 audio into a playable object URL — null when the build carries no audio. */
export function tailorAudioUrl(devotional: TailoredDevotional): string | null {
  if (!devotional.audioBase64) return null;
  const binary = atob(devotional.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}
