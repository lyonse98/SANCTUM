/*
  Tailor Today's composition core — the pure half of the tailor-devotional
  function (intake + profile validation, prompt assembly, passage/media
  selection, script assembly, response shaping). Everything here is
  deterministic and free of network, storage, and environment access, so the
  vitest suite can pin the whole composition with the model layer mocked.
  index.ts wires the real dependencies (bundle reads, the Gemini calls, the
  corpus shelf, TTS) into composeTailored.

  NO COMPANION LENS (Erik, Nov 12, 2026): companions are text-only and live
  in their chats. The tailoring is done here, on the narrator side — the
  intake aims the generation directly, under the Scripture-grounding blocks
  and the tailor task, and the day's narrator frames and voices the result.
  No persona sheet enters any prompt this module builds.

  V2 (Nov 13, 2026): the intake gains the tone of the ask ("what do you want
  from God today?") and may carry the user's standing profile (season of
  life, ongoing battles, a standing goal, media preferences) — phrased for
  the track, transient like the morning's own words, stored nowhere. The
  composition also finds two things the v1 bank could not hold: a word from
  the tradition (the corpus shelf first, the app's own daily-quotes dataset
  as the standing fallback) and one media item found by LIVE SEARCH, under
  hard rules — the search query is built from enum categories only, and a
  found item's address must come from the search's own grounding sources.
  Any failure on either hunt falls back quietly: the bank still picks, the
  devotional still builds.

  PRIVACY, BY CONSTRUCTION: this module holds no persistence of any kind.
  The intake, the profile, and the composed devotional pass through it and
  out with the HTTP response; nothing here can write them anywhere.
*/

import {
  TAILOR_SEARCH_KINDS,
  TAILOR_SEARCH_KIND_LABELS,
  isTailorFocus,
  isTailorSearchKind,
  isTailorState,
  isTailorTone,
  mediaSearchUrl,
  pickMedia,
  pickPassage,
  tailorFocusLabel,
  tailorStateLabel,
  tailorToneLabel,
  type TailorFocus,
  type TailorMediaKind,
  type TailorPassage,
  type TailorSearchKind,
  type TailorState,
  type TailorTone,
} from "./tailorBank.ts";
import { quotesForAudience } from "./quotes.ts";
import {
  AUDIO_PM_START_HOUR,
  PERSONA_DISPLAY,
  TIME_NEUTRAL_LINT,
  assembleTailoredScript,
  type NarratorAudience,
  type TailoredReadingPart,
  type TailoredScript,
} from "./narratorCore.ts";
import {
  SCRIPTURE_GROUNDING,
  SCRIPTURE_GROUNDING_WOMEN,
  buildTailorTask,
} from "./prompts.ts";
import type { TailorAudioPlanEntry } from "./audioPlan.ts";

export interface TailorIntake {
  state: TailorState;
  focus: TailorFocus;
  /** What the person is asking of God today — or null when the morning didn't say. */
  tone: TailorTone | null;
  /** The user's own line about the morning — optional, capped, never stored. */
  freeText: string;
}

/**
 * Validates a request payload into an intake, or returns null. Every field
 * is allowlisted: state and focus must be bank keys, the tone must be a tone
 * key when present, and the free text is trimmed to one short line. There is
 * no lens field — a payload carrying one simply has it ignored.
 */
export function validateIntake(payload: Record<string, unknown>): TailorIntake | null {
  if (!isTailorState(payload.state)) return null;
  if (!isTailorFocus(payload.focus)) return null;
  const freeText = typeof payload.freeText === "string"
    ? payload.freeText.replace(/\s+/g, " ").trim().slice(0, 200)
    : "";
  return {
    state: payload.state,
    focus: payload.focus,
    tone: isTailorTone(payload.tone) ? payload.tone : null,
    freeText,
  };
}

/**
 * The standing profile as the function may receive it: the season and battles
 * as short label strings (the client's own chip vocabulary), the goal as one
 * capped line, the media preferences as search-kind keys. Everything is
 * sanitized to shape and length — labels are phrasing for the prompt, never
 * instructions — and a profile carrying nothing at all validates to null.
 */
export interface TailorProfileInput {
  seasonOfLife: string | null;
  ongoingBattles: string[];
  standingGoal: string;
  mediaPrefs: TailorSearchKind[];
}

export function validateProfile(payload: Record<string, unknown>): TailorProfileInput | null {
  const raw = payload.profile;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const clean = (v: unknown, max: number): string =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const seasonOfLife = clean(p.seasonOfLife, 60);
  const ongoingBattles = Array.isArray(p.ongoingBattles)
    ? p.ongoingBattles.map((b) => clean(b, 40)).filter((b) => b.length > 0).slice(0, 12)
    : [];
  const standingGoal = clean(p.standingGoal, 120);
  const mediaPrefs = Array.isArray(p.mediaPrefs)
    ? [...new Set(p.mediaPrefs.filter(isTailorSearchKind))]
    : [];
  if (!seasonOfLife && ongoingBattles.length === 0 && !standingGoal && mediaPrefs.length === 0) {
    return null;
  }
  return { seasonOfLife: seasonOfLife || null, ongoingBattles, standingGoal, mediaPrefs };
}

/** The day's canonical bundle, as read from the day's own rows. */
export interface TailorBundle {
  celebration: string | null;
  gospelCitation: string;
  /** Zone 1 — verbatim. Composed into the script untouched, never regenerated. */
  gospelText: string;
  /** The day's readings entire, in lectionary order — all verbatim. */
  readings: TailoredReadingPart[];
  reflect: string;
  challenge: string;
  facet: string;
}

export interface TailoredParts {
  reflect: string;
  challenge: string;
}

/** The system prompt: the grounding block for the track, then the tailor task. */
export function buildTailorSystemPrompt(audience: NarratorAudience): string {
  const grounding = audience === "women" ? SCRIPTURE_GROUNDING_WOMEN : SCRIPTURE_GROUNDING;
  return `${grounding}\n\n${buildTailorTask(audience)}`;
}

/** The user prompt: the canonical day + the curated passage + this morning. */
export function buildTailorUserPrompt(
  bundle: TailorBundle,
  intake: TailorIntake,
  passage: TailorPassage,
  profile?: TailorProfileInput | null,
  audience: NarratorAudience = "men",
): string {
  const she = audience === "women";
  const poss = she ? "her" : "his";
  const lines: string[] = [];
  lines.push(`Today's Gospel: ${bundle.gospelCitation}`);
  if (bundle.celebration) lines.push(`The Church celebrates: ${bundle.celebration}`);
  lines.push(`\nThe day's canonical reflection (${bundle.facet}):\n${bundle.reflect}`);
  lines.push(`\nThe day's canonical challenge:\n${bundle.challenge}`);
  lines.push(
    `\nThe curated passage for this need — ${passage.citation} (${passage.translation}):\n"${passage.text}"`,
  );
  lines.push(`\nHow this person is coming in: ${tailorStateLabel(intake.state)}.`);
  lines.push(`What today is about: ${tailorFocusLabel(intake.focus)}.`);
  if (intake.tone) {
    lines.push(`What ${she ? "she" : "he"} is asking of God today: ${tailorToneLabel(intake.tone)}.`);
  }
  if (profile?.seasonOfLife) {
    lines.push(`The season of ${poss} life: ${profile.seasonOfLife}.`);
  }
  if (profile && profile.ongoingBattles.length > 0) {
    lines.push(`Battles ${she ? "she" : "he"} carries in this season: ${profile.ongoingBattles.join(", ")}.`);
  }
  if (profile?.standingGoal) {
    lines.push(`${she ? "Her" : "His"} standing goal, in ${poss} own words: "${profile.standingGoal}"`);
  }
  if (intake.freeText) lines.push(`In their own words: "${intake.freeText}"`);
  lines.push(
    `\nRe-aim the reflection and the challenge at this morning, under the rules above. Output only the JSON object.`,
  );
  return lines.join("\n");
}

/**
 * Parses the model's JSON into the two tailored parts, or null. Tolerant of a
 * code fence around the object; strict about shape — both parts must be real
 * strings of sane length, clamped to the spoken lengths the task promises.
 */
export function parseTailorResult(text: string): TailoredParts | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed.reflect !== "string" || typeof parsed.challenge !== "string") return null;
    const reflect = parsed.reflect.trim().slice(0, 1600);
    const challenge = parsed.challenge.trim().slice(0, 400);
    if (reflect.length < 10 || challenge.length < 3) return null;
    return { reflect, challenge };
  } catch {
    return null;
  }
}

// ── A word from the tradition ────────────────────────────────────────────────

export interface TraditionQuote {
  /** The words themselves — retrieved or dataset text, never composed here. */
  text: string;
  /** Who they belong to, as the card and the narrator name them. */
  author: string;
}

/**
 * Words the spoken main segment keeps out of its own framing (the day's
 * time-neutral rule) — a quote carrying one would smuggle time-of-day
 * language into a segment that forbids it, and a quote promising "tomorrow"
 * would break the tailored script's no-teaser shape. Such quotes stay in the
 * dataset for the card rotation; they are simply not spoken here.
 */
const SPOKEN_QUOTE_EXCLUSIONS = [...TIME_NEUTRAL_LINT, "tomorrow"];

/** Keyword affinities for matching a dataset quote to a stated need. */
const QUOTE_KEYWORDS_BY_FOCUS: Record<TailorFocus, string[]> = {
  work: ["work", "labour", "labor", "qualified", "hands", "stream"],
  marriage: ["love", "family", "home", "wife", "husband"],
  family: ["family", "home", "children", "love"],
  conversation: ["gentle", "gentleness", "patience", "words", "peace", "strength"],
  grief: ["sorrow", "tears", "brokenhearted", "despair", "weep", "hope", "wine of the soul"],
  temptation: ["temptation", "passions", "struggle", "cross", "breath"],
  decision: ["trust", "afraid", "courage", "heart", "plans"],
  today: ["today", "day", "small things", "beginning"],
};

const QUOTE_KEYWORDS_BY_TONE: Record<TailorTone, string[]> = {
  comfort: ["rest", "peace", "still", "sustain", "shepherd"],
  courage: ["courage", "strong", "afraid", "frightened", "dismayed"],
  challenge: ["mediocrity", "fire", "be one", "cross", "struggle"],
  clarity: ["truth", "light", "mind", "lion", "explanation"],
  consolation: ["hope", "sorrow", "joy", "despair", "well"],
};

function dateHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * The dataset fallback for the tradition quote: one line from the track's OWN
 * daily-quotes shelf — the only shelf it may draw from — matched to the
 * stated focus and tone by keyword affinity and rotated by date. A quote
 * enters the spoken script only if it is short enough to speak and carries
 * no excluded word. Returns null only if the shelf itself has nothing
 * speakable, which the caller treats as "no quote today", never as failure.
 */
export function pickTraditionQuote(
  audience: NarratorAudience,
  focus: TailorFocus,
  tone: TailorTone | null,
  dateISO: string,
): TraditionQuote | null {
  const shelf = quotesForAudience(audience);
  const eligible = shelf.filter((q) => {
    const text = q.text.trim();
    if (text.length < 10 || text.length > 240) return false;
    const lower = text.toLowerCase();
    return !SPOKEN_QUOTE_EXCLUSIONS.some((w) => lower.includes(w));
  });
  if (eligible.length === 0) return null;
  const keywords = [
    ...QUOTE_KEYWORDS_BY_FOCUS[focus],
    ...(tone ? QUOTE_KEYWORDS_BY_TONE[tone] : []),
  ];
  const scored = eligible.map((q) => {
    const hay = `${q.text} ${q.author}`.toLowerCase();
    return { q, score: keywords.filter((k) => hay.includes(k)).length };
  });
  const best = Math.max(...scored.map((s) => s.score));
  const pool = (best > 0 ? scored.filter((s) => s.score === best) : scored).map((s) => s.q);
  const picked = pool[dateHash(`${dateISO}|quote|${focus}|${tone ?? ""}`) % pool.length];
  return {
    text: picked.text.trim(),
    author: picked.source ? `${picked.author}, ${picked.source}` : picked.author,
  };
}

/**
 * The corpus query for the tradition quote — categories only, like every
 * query this function builds: the day's stated focus and tone, nothing the
 * user wrote.
 */
export function buildCorpusQuoteQuery(intake: TailorIntake): string {
  const parts = [tailorFocusLabel(intake.focus)];
  if (intake.tone) parts.push(tailorToneLabel(intake.tone));
  parts.push("hope", "the saints");
  return parts.join(" ");
}

// ── The media pick: live search first, the bank behind it ────────────────────

export interface ComposedMedia {
  kind: TailorMediaKind;
  title: string;
  creator: string;
  /** A found item's own page (live search), or a search URL (the curated bank). */
  url: string;
  /** One line, written from the morning's categories only: why this, today. */
  why: string;
}

export interface MediaSearchArgs {
  focus: TailorFocus;
  tone: TailorTone | null;
  audience: NarratorAudience;
  kinds: TailorSearchKind[];
}

/**
 * THE SEARCH QUERY — built from enum categories ONLY. This function accepts
 * nothing else: no free text, no standing goal, no battle beyond its
 * category, no name. The internet gets the category, never the person —
 * pinned by a source test that drives a build with sentinel strings in
 * every user-written field and asserts none of them reaches the query.
 */
export function buildMediaSearchQuery(args: MediaSearchArgs): string {
  const kindWords = args.kinds.map((k) => `${TAILOR_SEARCH_KIND_LABELS[k].toLowerCase()}s`).join(", ");
  const who = args.audience === "women" ? "woman" : "man";
  const seeking = args.tone ? tailorToneLabel(args.tone).toLowerCase() : "encouragement";
  return (
    `Find one real, well-known work — one of these kinds only: ${kindWords} — ` +
    `for a Catholic ${who} whose day is about ${tailorFocusLabel(args.focus).toLowerCase()}, seeking ${seeking}. ` +
    `It must be uplifting and truthful, compatible with the Catholic faith: nothing that feeds despair, ` +
    `nothing scrupulous, no prosperity-gospel framing; a secular work that genuinely lifts is welcome when it fits. ` +
    `Answer with only a JSON object: {"title": "...", "creator": "...", "kind": one of ${args.kinds.join("/")}, "url": "..."} ` +
    `where url is the exact address of the work itself from your search results — never a search page, never an address you composed.`
  );
}

const SEARCH_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "duckduckgo.com",
  "html.duckduckgo.com",
  "search.yahoo.com",
]);

function isSearchPageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:") return true;
  if (SEARCH_HOSTS.has(parsed.hostname)) return true;
  if (/(^|\/)(search|results)(\/|$)/.test(parsed.pathname)) return true;
  if (parsed.searchParams.has("search_query")) return true;
  return false;
}

/**
 * Validates a grounded search response into a media pick, or null. The rule
 * that makes a found link trustworthy: the address must appear VERBATIM
 * among the response's own grounding sources — the model's word alone never
 * mints a URL — and it must be the work's own page, not a search page. The
 * kind must be one of the kinds the morning allowed.
 */
export function pickGroundedMedia(raw: unknown, kinds: TailorSearchKind[]): Omit<ComposedMedia, "why"> | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = (raw as Record<string, unknown>).candidates as Record<string, unknown>[] | undefined;
  const first = Array.isArray(candidate) ? candidate[0] : undefined;
  if (!first) return null;

  const metadata = first.groundingMetadata as Record<string, unknown> | undefined;
  const chunks = metadata?.groundingChunks as Record<string, unknown>[] | undefined;
  const sources = new Map<string, string>();
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      const web = chunk.web as Record<string, unknown> | undefined;
      if (web && typeof web.uri === "string") {
        sources.set(web.uri, typeof web.title === "string" ? web.title : "");
      }
    }
  }
  if (sources.size === 0) return null;

  const content = first.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Record<string, unknown>[] | undefined;
  const text = Array.isArray(parts)
    ? parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("")
    : "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let answer: Record<string, unknown>;
  try {
    answer = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const url = typeof answer.url === "string" ? answer.url : "";
  if (!url || !sources.has(url) || isSearchPageUrl(url)) return null;
  if (!isTailorSearchKind(answer.kind) || !kinds.includes(answer.kind)) return null;
  const title =
    (typeof answer.title === "string" && answer.title.trim()) || sources.get(url) || "";
  if (!title) return null;
  let creator = typeof answer.creator === "string" ? answer.creator.trim() : "";
  if (!creator) {
    try {
      creator = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      creator = "";
    }
  }
  if (!creator) return null;
  return { kind: answer.kind, title: title.slice(0, 160), creator: creator.slice(0, 120), url };
}

const TONE_WHY_PHRASES: Record<TailorTone, string> = {
  comfort: "a little comfort",
  courage: "a little courage",
  challenge: "a push forward",
  clarity: "a clearer head",
  consolation: "consolation",
};

/** The media card's why-line: categories only, the same for found and bank picks alike. */
export function mediaWhyLine(focus: TailorFocus, tone: TailorTone | null): string {
  const forWhat = tailorFocusLabel(focus).toLowerCase();
  return tone
    ? `Chosen for ${forWhat} — ${TONE_WHY_PHRASES[tone]} for today.`
    : `Chosen for ${forWhat} — for today.`;
}

export interface ComposedTailored {
  passage: TailorPassage;
  media: ComposedMedia;
  tailored: TailoredParts;
  traditionQuote: TraditionQuote | null;
  script: TailoredScript;
  /** The day narrator's name — the only credit the tailored devotional carries. */
  narratorName: string;
}

export interface ComposeDeps {
  dateISO: string;
  audience: NarratorAudience;
  intake: TailorIntake;
  bundle: TailorBundle;
  /** The standing profile, validated — shapes phrasing and the media hunt. */
  profile?: TailorProfileInput | null;
  /** The one model call — injected so tests mock the model layer. */
  generateTailored: (systemPrompt: string, userPrompt: string) => Promise<TailoredParts>;
  /**
   * The live media search — injected; receives the enum-only query and
   * returns the grounded response raw. Absent or failed: the bank picks.
   */
  findMedia?: (query: string) => Promise<unknown>;
  /**
   * A tradition quote already retrieved from the corpus shelf (index.ts
   * resolves it before composing). Null/absent: the dataset shelf answers.
   */
  corpusQuote?: TraditionQuote | null;
  /** Test seam for the dataset quote: undefined = pick from the dataset. */
  datasetQuote?: TraditionQuote | null;
  /** Device hour at build time — picks the AM or PM head, as the player does. */
  hour: number;
}

/**
 * The whole composition, end to end, minus I/O: select the passage, hunt the
 * media (live search, bank behind it), settle the tradition quote (corpus,
 * dataset behind it), run the one generation, and assemble the narrator's
 * script around the day's readings ENTIRE — every part asserted byte-for-byte
 * verbatim in the tests.
 */
export async function composeTailored(deps: ComposeDeps): Promise<ComposedTailored> {
  const { dateISO, audience, intake, bundle } = deps;
  const profile = deps.profile ?? null;
  const passage = pickPassage(intake.focus, intake.state, dateISO);

  // The media: a live search through the morning's allowed kinds first; any
  // failure — no search wired, no answer, an unusable answer — and the
  // curated bank picks, exactly as v1 did. Either way the why-line is
  // written here, from categories only.
  const kinds: TailorSearchKind[] =
    profile && profile.mediaPrefs.length > 0 ? profile.mediaPrefs : [...TAILOR_SEARCH_KINDS];
  let found: Omit<ComposedMedia, "why"> | null = null;
  if (deps.findMedia) {
    const query = buildMediaSearchQuery({ focus: intake.focus, tone: intake.tone, audience, kinds });
    const raw = await deps.findMedia(query).catch(() => null);
    found = pickGroundedMedia(raw, kinds);
  }
  const media: ComposedMedia = found
    ? { ...found, why: mediaWhyLine(intake.focus, intake.tone) }
    : (() => {
        const pick = pickMedia(intake.focus, dateISO);
        return {
          kind: pick.type,
          title: pick.title,
          creator: pick.creator,
          url: mediaSearchUrl(pick),
          why: mediaWhyLine(intake.focus, intake.tone),
        };
      })();

  // The tradition quote: the corpus shelf's word when retrieval brought one,
  // the dataset shelf's behind it, and no quote at all rather than a forced one.
  const traditionQuote =
    deps.corpusQuote ??
    (deps.datasetQuote !== undefined
      ? deps.datasetQuote
      : pickTraditionQuote(audience, intake.focus, intake.tone, dateISO));

  const systemPrompt = buildTailorSystemPrompt(audience);
  const userPrompt = buildTailorUserPrompt(bundle, intake, passage, profile, audience);
  const tailored = await deps.generateTailored(systemPrompt, userPrompt);

  const script = assembleTailoredScript({
    dateISO,
    audience,
    celebration: bundle.celebration,
    gospelCitation: bundle.gospelCitation,
    gospelText: bundle.gospelText,
    readings: bundle.readings,
    reflect: tailored.reflect,
    challenge: tailored.challenge,
    facet: bundle.facet,
    scene: null,
    tomorrowCelebration: null,
    tomorrowGospelCitation: null,
    passageCitation: passage.citation,
    passageText: passage.text,
    traditionQuote,
    head: deps.hour < AUDIO_PM_START_HOUR ? "am" : "pm",
  });

  return {
    passage,
    media,
    tailored,
    traditionQuote,
    script,
    narratorName: PERSONA_DISPLAY[script.persona]?.name ?? "The Lector",
  };
}

/**
 * The response body the client parses — text, quote, media card, credit, and
 * the audio. audioBase64 is null while the function's in-render is disabled
 * (see TAILOR_AUDIO_ENABLED in index.ts): the text package is complete
 * without it, and the client's audio field is optional by design. In its
 * place the body carries the audio PLAN (audioPlan.ts) when the render key
 * is configured: the signed pieces the device fetches one call at a time
 * and stitches on-device. audioPlan is null when no key is configured —
 * the same text-only package the interim builds returned.
 */
export function buildResponseBody(
  dateISO: string,
  composed: ComposedTailored,
  audioBase64: string | null,
  audioSeconds: number,
  audioPlan: TailorAudioPlanEntry[] | null = null,
): Record<string, unknown> {
  return {
    ok: true,
    date: dateISO,
    narratorId: composed.script.persona,
    narratorName: composed.narratorName,
    passage: {
      citation: composed.passage.citation,
      text: composed.passage.text,
      translation: composed.passage.translation,
    },
    reflect: composed.tailored.reflect,
    challenge: composed.tailored.challenge,
    traditionQuote: composed.traditionQuote,
    media: {
      kind: composed.media.kind,
      // v1 aliases, carried so either shape of client parses the same card.
      type: composed.media.kind,
      title: composed.media.title,
      creator: composed.media.creator,
      url: composed.media.url,
      searchUrl: composed.media.url,
      why: composed.media.why,
    },
    audioBase64,
    audioSeconds,
    audioPlan,
  };
}
