import type { Audience } from '@/types';
import {
  isTailorFocus,
  isTailorState,
  isTailorTone,
  tailorFocusLabel,
  type TailorFocus,
  type TailorMediaKind,
  type TailorState,
  type TailorTone,
} from '@/data/tailorBank';
import { profileSignature, type TailorRequestProfile } from '@/lib/tailorProfile';
import { appendLetterThread } from '@/lib/letterThreads';
import { isAccessRequired, loadAccessToken } from '@/lib/accessToken';

/**
 * Tailor Today, client side (Nov 12, 2026). Up to three builds per user per
 * day (Erik, Nov 19, 2026): the day can turn, and the devotional may turn
 * with it — three is the cost cap, refused on the device before any call
 * and backed by the function's own caller cap. Each distinct intake is
 * its own build, kept beside the day's others; the LATEST build is the
 * day's standing record, the one tonight's close and echoes key off. The
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
 * caps builds per day); replaying never does. The meta line also carries
 * the day's build index — every build's hash, hour, and ask — so the
 * panel can walk the day's builds, not just the latest.
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

/**
 * The morning's own intake, kept ON THIS DEVICE ONLY so tonight can close
 * the day against it (the PM twin, Nov 14, 2026). The server never stored
 * it and still does not: it was sent once, transiently, for the morning
 * build, and the evening build re-sends it from here, transiently, the
 * same way. It lives in the meta line under the sanctum_tailor_ prefix,
 * so the panic wipe takes it with everything else.
 */
export interface TailorMorningRecord {
  state: TailorState;
  focus: TailorFocus;
  tone: TailorTone;
  /** The morning's own words — trimmed and capped exactly as the build call caps them. */
  freeText: string;
}

/** How many distinct tailored devotionals one day may hold — the cost cap (Erik, Nov 19, 2026). */
export const TAILOR_DAILY_BUILD_LIMIT = 3;

/**
 * One entry in the day's build index (Erik, Nov 19, 2026): a build the
 * day holds, named by its intake hash and the hour it was made, with
 * the ask it answered — enough for the panel's switcher to label it
 * ("7:02 AM · Work") without opening its package. The index rides
 * inside the meta line, under the same sanctum_ prefix, so the panic
 * wipe takes it with everything else.
 */
export interface TailorBuildEntry {
  hash: string;
  /** When the build was made (epoch ms) — the switcher's hour. */
  builtAt: number;
  focus: TailorFocus;
  state: TailorState;
  tone: TailorTone;
}

export interface TailorMeta {
  hash: string;
  narratorName: string;
  at: number;
  /** The morning's stated focus — tonight's closing echoes it back. */
  focus?: TailorFocus;
  /** The morning's intake, for tonight's close — on this device only. */
  morning?: TailorMorningRecord;
  /** The day's builds in the order they were made — the latest is the standing record above. */
  builds?: TailorBuildEntry[];
}

/** Validates a stored morning record, or null when it cannot be trusted. */
function readMorningRecord(raw: unknown): TailorMorningRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!isTailorState(m.state) || !isTailorFocus(m.focus) || !isTailorTone(m.tone)) return null;
  return {
    state: m.state,
    focus: m.focus,
    tone: m.tone,
    freeText: typeof m.freeText === 'string' ? m.freeText.slice(0, 200) : '',
  };
}

/**
 * Validates a stored build index, or synthesizes the one entry a
 * pre-index meta still names. A malformed entry drops the entry, never
 * the meta — the same posture as the morning record's. A meta written
 * before the day's builds were indexed still names its one build (the
 * latest, in `hash`), and its morning record still knows what was
 * asked, so the day reads as it always did: one build, standing.
 */
function readBuildEntries(raw: unknown, meta: TailorMeta): TailorBuildEntry[] | undefined {
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    const entries: TailorBuildEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      if (typeof e.hash !== 'string' || e.hash.length === 0 || seen.has(e.hash)) continue;
      if (typeof e.builtAt !== 'number' || !Number.isFinite(e.builtAt)) continue;
      if (!isTailorState(e.state) || !isTailorFocus(e.focus) || !isTailorTone(e.tone)) continue;
      seen.add(e.hash);
      entries.push({ hash: e.hash, builtAt: e.builtAt, focus: e.focus, state: e.state, tone: e.tone });
      if (entries.length >= TAILOR_DAILY_BUILD_LIMIT) break;
    }
    if (entries.length > 0) return entries;
  }
  const morning = meta.morning;
  if (morning) {
    return [
      {
        hash: meta.hash,
        builtAt: typeof meta.at === 'number' && Number.isFinite(meta.at) ? meta.at : 0,
        focus: morning.focus,
        state: morning.state,
        tone: morning.tone,
      },
    ];
  }
  return undefined;
}

export function readTailorMeta(dateKey: string, audience: Audience): TailorMeta | null {
  try {
    const raw = localStorage.getItem(tailorMetaKey(dateKey, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TailorMeta;
    if (typeof parsed.hash !== 'string') return null;
    // A malformed morning record drops the record, never the meta — the
    // focus echo and the cached build must survive a bad twin field.
    const morning = readMorningRecord((parsed as { morning?: unknown }).morning);
    const base = morning ? { ...parsed, morning } : { ...parsed, morning: undefined };
    const builds = readBuildEntries((parsed as { builds?: unknown }).builds, base);
    return builds ? { ...base, builds } : { ...base, builds: undefined };
  } catch {
    return null;
  }
}

/** The day's builds, in the order they were made — the index the panel's switcher walks. */
export function readTailorBuilds(dateKey: string, audience: Audience): TailorBuildEntry[] {
  return readTailorMeta(dateKey, audience)?.builds ?? [];
}

function writeTailorMeta(dateKey: string, audience: Audience, meta: TailorMeta): void {
  try {
    localStorage.setItem(tailorMetaKey(dateKey, audience), JSON.stringify(meta));
  } catch {
    // ignore — the cache still holds the devotional itself
  }
}

/**
 * One stitch's banked pieces (Nov 18, 2026): the narration pieces that have
 * already landed on this device, kept beside the devotional they belong to
 * so a stitch interrupted — a weak piece, a resource-limit kill, the app
 * closed mid-flight — resumes where it stopped instead of starting over.
 * `total` is the plan length the bank belongs to; a bank whose total does
 * not match the plan in hand is a different build's and is ignored.
 */
export interface TailorPieceBank {
  total: number;
  byIndex: Record<string, { audioBase64: string; seconds: number }>;
}

/** The minimal store the tailor cache needs — Cache Storage in the browser, a fake in tests. */
export interface TailorStore {
  get(key: string): Promise<TailoredDevotional | null>;
  set(key: string, value: TailoredDevotional): Promise<void>;
  getPieces(key: string): Promise<TailorPieceBank | null>;
  setPieces(key: string, value: TailorPieceBank): Promise<void>;
  deletePieces(key: string): Promise<void>;
}

const CACHE_NAME = 'sanctum-tailor-v1';

function storeKey(dateKey: string, audience: Audience, hash: string): string {
  return `https://tailor.sanctum.local/${dateKey}/${audience}/${hash}`;
}

/** The browser store: Cache Storage, on-device only, never uploaded anywhere. */
export function createCacheStore(): TailorStore {
  const memory = new Map<string, TailoredDevotional>();
  const piecesMemory = new Map<string, TailorPieceBank>();
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
    // The piece bank lives in the SAME cache as the devotional itself, under
    // the devotional's own key + ':pieces' — so the panic wipe, which deletes
    // every Cache Storage cache wholesale, takes the bank with the package.
    async getPieces(key) {
      try {
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(CACHE_NAME);
          const hit = await cache.match(key);
          if (hit) return (await hit.json()) as TailorPieceBank;
          return null;
        }
      } catch {
        // fall through to the in-memory copy
      }
      return piecesMemory.get(key) ?? null;
    },
    async setPieces(key, value) {
      piecesMemory.set(key, value);
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
    async deletePieces(key) {
      piecesMemory.delete(key);
      try {
        if (typeof caches !== 'undefined') {
          const cache = await caches.open(CACHE_NAME);
          await cache.delete(key);
        }
      } catch {
        // a stale bank is ignored once the merged package stands
      }
    },
  };
}

let sharedStore: TailorStore | null = null;
function defaultStore(): TailorStore {
  if (!sharedStore) sharedStore = createCacheStore();
  return sharedStore;
}

const MEDIA_KINDS: readonly string[] = ['song', 'film', 'podcast', 'talk', 'video', 'article', 'book', 'speech', 'interview', 'clip'];

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
  /** Stitch progress, (pieces in hand, plan length) — banked pieces from a resumed stitch count from the start. */
  onProgress?: (done: number, total: number) => void;
  /** The pause between piece retries — injectable so tests never wait on a real backoff. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * The intake hash of the build being stitched, when it is not the
   * day's latest (the panel stitching an earlier build it walked to).
   * The piece bank and the merged package belong to THAT build's key —
   * without it, the stitch follows the meta's standing (latest) build,
   * as it always has.
   */
  buildHash?: string;
}

/** The function's address and public key — the one door both calls use. */
export function tailorEndpoint(): { url: string; anonKey: string } | null {
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
      // The access token (Nov 20, 2026): the device's door key for the
      // testing season, checked by the function before anything is
      // built. Null when the device was never given one.
      accessToken: loadAccessToken(),
    }),
    // A live build (search + composition + a full render) may take a minute
    // or two; the timeout is generous on purpose, and the card's failure
    // state is calm either way.
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) {
    const errorBody: unknown = await res.json().catch(() => null);
    if (isAccessRequired(res.status, errorBody)) throw new TailorAccessRequiredError();
    throw new Error(`tailor-http-${res.status}`);
  }
  const parsed = parseTailorResponse(await res.json());
  if (!parsed) throw new Error('tailor-unusable');
  return parsed;
}

/**
 * A fourth DISTINCT build in one day, refused on the device before any
 * server call (Erik, Nov 19, 2026): the day holds up to
 * TAILOR_DAILY_BUILD_LIMIT tailored devotionals — the cost cap, with
 * the function's own 3-a-day caller cap standing behind it as the hard
 * backstop. The message is the house string code; the class is what
 * the panel catches to answer calmly instead of failing.
 */
export class TailorDailyLimitError extends Error {
  readonly code = 'tailor-daily-limit';
  constructor() {
    super('tailor-daily-limit');
    this.name = 'TailorDailyLimitError';
  }
}

/**
 * The testing-season gate's refusal (Nov 20, 2026): the function
 * answered 403 access_required — this device holds no active token.
 * The class is what the panels catch to show the calm line instead of
 * a failure, exactly as the daily limit shows its note instead of an
 * error face. Shared with the PM close (tailorPm.ts), whose door is
 * the same function's.
 */
export class TailorAccessRequiredError extends Error {
  readonly code = 'tailor-access-required';
  constructor() {
    super('tailor-access-required');
    this.name = 'TailorAccessRequiredError';
  }
}

/**
 * The day's tailored devotional: the device's cached build when this exact
 * intake was already built today (NO server call — a replay is free and
 * private), otherwise one build through the function, cached on-device with
 * its metadata line written for the card. A fresh build joins the day's
 * build index and becomes the day's standing record — the meta's hash,
 * focus, and morning record always name the LATEST build, the one
 * tonight's close keys off.
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
  // The day's cost cap, enforced here, before the call: a NEW distinct
  // intake beyond the day's builds is refused on the device — the
  // standing builds stay fully usable, and an intake the index already
  // counts (its package lost from the cache, say) is not new and goes
  // through. A replay never reaches this line: it was answered above.
  const priorBuilds = readTailorBuilds(dateKey, audience);
  const alreadyCounted = priorBuilds.some((entry) => entry.hash === hash);
  if (!alreadyCounted && priorBuilds.length >= TAILOR_DAILY_BUILD_LIMIT) {
    throw new TailorDailyLimitError();
  }
  const built = await callTailorFunction(dateKey, audience, intake, deps.fetchImpl ?? fetch);
  await store.set(key, built);
  const at = Date.now();
  writeTailorMeta(dateKey, audience, {
    hash,
    narratorName: built.narratorName,
    at,
    focus: intake.focus,
    // The morning record for tonight's close — this device only, capped
    // exactly as the build call caps the words it sends.
    morning: {
      state: intake.state,
      focus: intake.focus,
      tone: intake.tone,
      freeText: intake.freeText.replace(/\s+/g, ' ').trim().slice(0, 200),
    },
    // The day's build index: this build joins the ones already standing
    // (a re-made build the index already counted keeps its first hour).
    builds: alreadyCounted
      ? priorBuilds
      : [...priorBuilds, { hash, builtAt: at, focus: intake.focus, state: intake.state, tone: intake.tone }],
  });
  // The morning's one sentence is also kept as a letter thread (Erik's
  // ruling, Nov 16, 2026): what was given for tailoring may tailor — a
  // companion's letter may one day be handed it, as the field's own
  // disclosure says. On this device only, like the morning record itself.
  appendLetterThread(dateKey, {
    sentence: intake.freeText,
    state: intake.state,
    focus: intake.focus,
    tone: intake.tone,
  });
  return { devotional: built, fromCache: false };
}

/** Loads one of the day's builds by its intake hash — the switcher's road to an earlier build. */
export async function loadTailoredBuild(
  dateKey: string,
  audience: Audience,
  hash: string,
  deps: TailorDeps = {},
): Promise<TailoredDevotional | null> {
  const store = deps.store ?? defaultStore();
  const found = await store.get(storeKey(dateKey, audience, hash));
  return found && found.date === dateKey ? found : null;
}

/** Loads today's existing build (if any) for the card's "play yours" state — the latest, the day's standing record. */
export async function loadTodaysTailored(
  dateKey: string,
  audience: Audience,
  deps: TailorDeps = {},
): Promise<TailoredDevotional | null> {
  const meta = readTailorMeta(dateKey, audience);
  if (!meta) return null;
  return loadTailoredBuild(dateKey, audience, meta.hash, deps);
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

/**
 * One piece render attempt. A failure also says whether the platform's
 * resource limit killed it (HTTP 546 / WORKER_RESOURCE_LIMIT — the burst
 * kill a long stitch can trip): that failure earns the longer pause before
 * the retry, because the limit needs a moment to breathe.
 */
async function callTailorPiece(
  endpoint: { url: string; anonKey: string },
  dateKey: string,
  audience: Audience,
  entry: TailorAudioPlanEntry,
  fetchImpl: typeof fetch,
): Promise<{ piece: { audioBase64: string; seconds: number } | null; resourceLimited: boolean }> {
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
        // The access token rides beside the piece (Nov 20, 2026): the
        // function's gate stands ahead of the piece branch, in addition
        // to the plan token inside it — a piece fetch must pass both.
        accessToken: loadAccessToken(),
      }),
      // One narration piece is seconds of work on the far side; the margin
      // is for a cold start, not for a render that will never finish.
      signal: AbortSignal.timeout(150000),
    });
    if (!res.ok) return { piece: null, resourceLimited: res.status === 546 };
    const json = (await res.json()) as Record<string, unknown>;
    if (json.ok !== true || typeof json.audioBase64 !== 'string' || json.audioBase64.length === 0) {
      const err = typeof json.error === 'string' ? json.error : '';
      return { piece: null, resourceLimited: err.includes('WORKER_RESOURCE_LIMIT') };
    }
    return {
      piece: {
        audioBase64: json.audioBase64,
        seconds: typeof json.seconds === 'number' && json.seconds > 0 ? json.seconds : 0,
      },
      resourceLimited: false,
    };
  } catch {
    return { piece: null, resourceLimited: false };
  }
}

/** Attempts per piece before the stitch settles for this open (Nov 18, 2026: three, with backoff). */
const PIECE_MAX_ATTEMPTS = 3;
/** The pause before the 2nd and 3rd attempts. */
const PIECE_BACKOFF_MS = [1000, 3000];
/** A resource-limit kill always earns at least this long a pause. */
const RESOURCE_LIMIT_PAUSE_MS = 3000;

async function fetchPieceWithRetries(
  endpoint: { url: string; anonKey: string },
  dateKey: string,
  audience: Audience,
  entry: TailorAudioPlanEntry,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<{ audioBase64: string; seconds: number } | null> {
  for (let attempt = 0; attempt < PIECE_MAX_ATTEMPTS; attempt += 1) {
    const { piece, resourceLimited } = await callTailorPiece(endpoint, dateKey, audience, entry, fetchImpl);
    if (piece) return piece;
    if (attempt < PIECE_MAX_ATTEMPTS - 1) {
      const base = PIECE_BACKOFF_MS[attempt];
      await sleep(resourceLimited ? Math.max(base, RESOURCE_LIMIT_PAUSE_MS) : base);
    }
  }
  return null;
}

/** Progress is the caller's courtesy — a throwing listener must never break the stitch. */
function reportProgress(deps: TailorDeps, done: number, total: number): void {
  try {
    deps.onProgress?.(done, total);
  } catch {
    // ignore
  }
}

/**
 * Completes a planned devotional's narration on this device: every plan
 * piece is fetched from the function's piece mode (its token is the
 * authorization — no build quota is involved), the MP3 bytes are joined in
 * plan order, and the stitched package replaces the plan's promise in the
 * on-device cache, so the play bar, replay, and share flows take it from
 * there unchanged.
 *
 * Resilient by design (Nov 18, 2026): pieces are BANKED to the on-device
 * store as they land, under the devotional's own key + ':pieces', so a
 * stitch that fails — or an app closed mid-stitch — resumes on the next
 * open with only the missing pieces fetched; each piece gets three
 * attempts with backoff (a resource-limit kill earns the longer pause);
 * and the promise NEVER rejects — a run that cannot finish resolves null
 * with the bank intact, leaving the package text-only and its plan ready
 * for the next open. On success the merged package is cached exactly as
 * before and the bank is deleted.
 */
export async function fetchTailorAudio(
  dateKey: string,
  audience: Audience,
  devotional: TailoredDevotional,
  deps: TailorDeps = {},
): Promise<TailoredDevotional | null> {
  try {
    const plan = devotional.audioPlan;
    if (!plan || plan.length === 0 || devotional.audioBase64) return null;
    const endpoint = tailorEndpoint();
    if (!endpoint) return null;
    const fetchImpl = deps.fetchImpl ?? fetch;
    const sleep =
      deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const store = deps.store ?? defaultStore();

    const ordered = [...plan].sort((a, b) => a.index - b.index);
    const total = ordered.length;

    // The bank's home: the devotional's own store key, so the bank and the
    // package live and die together (the panic wipe takes the whole cache).
    // The build being stitched names the key — the panel passes its open
    // build's hash, so one build's bank never serves or overwrites
    // another's; without one, the meta's standing (latest) build is
    // meant, as before. Without any key there is nothing to bank under —
    // the stitch then runs in memory only, exactly as it did before
    // banking existed.
    const meta = readTailorMeta(dateKey, audience);
    const ownHash = deps.buildHash ?? meta?.hash ?? null;
    const devKey = ownHash ? storeKey(dateKey, audience, ownHash) : null;
    const piecesKey = devKey ? `${devKey}:pieces` : null;

    const pieces = new Array<string | null>(total).fill(null);
    const pieceSeconds = new Array<number>(total).fill(0);
    const bank: TailorPieceBank = { total, byIndex: {} };
    let done = 0;
    if (piecesKey) {
      try {
        const saved = await store.getPieces(piecesKey);
        if (saved && saved.total === total && saved.byIndex && typeof saved.byIndex === 'object') {
          ordered.forEach((entry, pos) => {
            const hit = saved.byIndex[String(entry.index)];
            if (hit && typeof hit.audioBase64 === 'string' && hit.audioBase64.length > 0) {
              pieces[pos] = hit.audioBase64;
              pieceSeconds[pos] =
                typeof hit.seconds === 'number' && hit.seconds > 0 ? hit.seconds : 0;
              bank.byIndex[String(entry.index)] = {
                audioBase64: hit.audioBase64,
                seconds: pieceSeconds[pos],
              };
              done += 1;
            }
          });
        }
      } catch {
        // The bank is a courtesy — an unreadable bank just means a fresh stitch.
      }
    }
    reportProgress(deps, done, total);

    // Bank writes are serialized through one chain: workers mutate the
    // shared bank, then queue a snapshot, so no two writes can race an
    // older state over a newer one. A failed write never fails the stitch.
    let bankChain: Promise<void> = Promise.resolve();
    const persistBank = () => {
      if (!piecesKey) return;
      const snapshot: TailorPieceBank = { total, byIndex: { ...bank.byIndex } };
      bankChain = bankChain.then(async () => {
        try {
          await store.setPieces(piecesKey, snapshot);
        } catch {
          // the in-memory stitch still stands; the next open re-fetches what it must
        }
      });
    };

    const missing: number[] = [];
    ordered.forEach((entry, pos) => {
      if (!pieces[pos]) missing.push(pos);
    });
    let failed = false;
    let cursor = 0;
    const worker = async () => {
      while (!failed && cursor < missing.length) {
        const pos = missing[cursor];
        cursor += 1;
        const entry = ordered[pos];
        const got = await fetchPieceWithRetries(endpoint, dateKey, audience, entry, fetchImpl, sleep);
        if (!got) {
          failed = true;
          return;
        }
        pieces[pos] = got.audioBase64;
        pieceSeconds[pos] = got.seconds;
        bank.byIndex[String(entry.index)] = { audioBase64: got.audioBase64, seconds: got.seconds };
        persistBank();
        done += 1;
        reportProgress(deps, done, total);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PIECE_CONCURRENCY, missing.length) }, () => worker()),
    );
    // Let the last bank writes land before answering, so a quick reopen
    // resumes from everything this run managed to fetch.
    await bankChain;
    if (failed || pieces.some((p) => p === null)) return null;

    const audioBase64 = concatBase64Mp3(pieces as string[]);
    if (!audioBase64) return null;
    const seconds = pieceSeconds.reduce((n, s) => n + s, 0);
    const merged: TailoredDevotional = {
      ...devotional,
      audioBase64,
      audioSeconds: Math.round(seconds * 10) / 10,
    };
    // The stitched package takes the plan's place in the cache, under the
    // day's own key — a replay from here is the old baked-audio replay —
    // and the bank, its work done, is deleted.
    if (devKey) {
      try {
        await store.set(devKey, merged);
      } catch {
        // The merged package still plays this session; the cache is a courtesy.
      }
      if (piecesKey) {
        try {
          await store.deletePieces(piecesKey);
        } catch {
          // a stale bank is ignored once the package carries its audio
        }
      }
    }
    return merged;
  } catch {
    // Never reject: whatever went wrong — a concat failure, a store that
    // threw past its guards — the answer is the text package, plan intact,
    // bank intact, and a later open to try again.
    return null;
  }
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
  speech: 'Speech',
  interview: 'Interview',
  clip: 'Clip',
};

/** Decodes the response's base64 audio into a playable object URL — null when the build carries no audio. */
export function tailorAudioUrl(devotional: TailoredDevotional): string | null {
  if (!devotional.audioBase64) return null;
  const binary = atob(devotional.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}
