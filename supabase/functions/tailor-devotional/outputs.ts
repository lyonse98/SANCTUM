/*
  Tailor Today — the output record (Nov 13, 2026, Erik's ruling).

  "Store what is being returned to a user so we can analyze text itself,
  not the input user issues." This module is the ONLY write path in the
  tailor-devotional function, and by construction it can only ever hold
  what a build RETURNED:

    - tailor_outputs: the composed devotional itself — the reflection and
      challenge Sanctum wrote, the passage and tradition quote it served,
      the media pick, the narrator's name for the day — kept unattributed
      for quality review and deleted by the database at 90 days. There is
      no column here for anything the morning brought in, and this module
      never sees it: its inputs are the finished package and the media
      result, nothing upstream of them.
    - media_winners: when a work found by the live hunt wins the card,
      the work is public — a link anyone can open — so the find itself is
      captured with the scorer's judgments ABOUT THE WORK (which kinds of
      mornings it answers, its popularity, its alignment), and read back
      into later mornings' scored pools. That is the self-growing library.

  Every call here is fail-open and fired after the response is shaped:
  a slow, failed, or unconfigured record changes nothing the user sees —
  the build's response is byte-identical either way. Logs are stage
  codes only, as everywhere in this function.
*/

import type { ComposedTailored } from "./tailorCore.ts";
import {
  isTailorFocus,
  isTailorState,
  isTailorTone,
  type TailorMedia,
} from "./tailorBank.ts";

/** Stamped on every recorded row, so a quality review reads against the composer that wrote it. */
export const TAILOR_BUILD_STAMP = "2026-11-13.outputs-1";

/** How much of the grown library rides into one morning's pool. */
const WINNERS_POOL_LIMIT = 200;

export interface OutputsTransport {
  fetchFn: typeof fetch;
  baseUrl: string;
  serviceKey: string;
}

export interface OutputsDeps {
  /** undefined = read the service config from the environment; null = recording off. */
  transport?: OutputsTransport | null;
  now?: () => Date;
}

/** The service config from the environment — null when unconfigured (recording off, builds unaffected). */
function envTransport(): OutputsTransport | null {
  const deno = (
    globalThis as {
      Deno?: { env?: { get?: (name: string) => string | undefined } };
    }
  ).Deno;
  let url = "";
  let key = "";
  try {
    url = deno?.env?.get?.("SUPABASE_URL") ?? "";
    key = deno?.env?.get?.("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  } catch {
    return null;
  }
  if (!url || !key) return null;
  return { fetchFn: fetch, baseUrl: url.replace(/\/+$/, ""), serviceKey: key };
}

function restHeaders(transport: OutputsTransport, prefer?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: transport.serviceKey,
    Authorization: `Bearer ${transport.serviceKey}`,
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

/** One REST read; null on any failure — callers degrade, never throw. */
async function restRead(transport: OutputsTransport, path: string): Promise<unknown> {
  try {
    const res = await transport.fetchFn(`${transport.baseUrl}/rest/v1/${path}`, {
      headers: restHeaders(transport),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** One REST write; false on any failure — callers degrade, never throw. */
async function restWrite(
  transport: OutputsTransport,
  path: string,
  body: Record<string, unknown>,
  prefer: string,
): Promise<boolean> {
  try {
    const res = await transport.fetchFn(`${transport.baseUrl}/rest/v1/${path}`, {
      method: "POST",
      headers: restHeaders(transport, prefer),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The tailor_outputs row for one build — the package's own fields and no
 * others. The key set is the whole contract: it is pinned by test, and
 * anything beyond it does not exist to be written.
 */
export function buildOutputRow(
  dateISO: string,
  audience: "men" | "women",
  composed: ComposedTailored,
): Record<string, unknown> {
  return {
    devotional_date: dateISO,
    audience,
    reflection: composed.tailored.reflect,
    challenge: composed.tailored.challenge,
    passage_citation: composed.passage.citation,
    passage_text: composed.passage.text,
    quote_text: composed.traditionQuote?.text ?? null,
    quote_source: composed.traditionQuote?.author ?? null,
    media_title: composed.media.title,
    media_creator: composed.media.creator,
    media_url: composed.media.url,
    media_kind: composed.media.kind,
    narrator: composed.script.persona,
    build_stamp: TAILOR_BUILD_STAMP,
  };
}

/**
 * The media_winners row for a build's winner — only when the live hunt
 * took the card. The tags are the scorer's judgments about the work,
 * produced by the scoring call; nothing here is copied from the morning
 * that found it. The win count and last-won time are set at write time.
 */
export function buildWinnerRow(composed: ComposedTailored): Record<string, unknown> | null {
  const win = composed.mediaWin;
  if (win.source !== "live") return null;
  return {
    title: composed.media.title,
    creator: composed.media.creator,
    url: composed.media.url,
    kind: composed.media.kind,
    focus_tags: [...(win.tags?.focuses ?? [])],
    state_tags: [...(win.tags?.states ?? [])],
    tone_tags: [...(win.tags?.tones ?? [])],
    popularity: win.popularity,
    values_score: win.values,
  };
}

/**
 * Records one finished build: the devotional row always, the winner row
 * when the live hunt won. Never throws and never blocks — the caller
 * fires this under the runtime's background-task hook after the response
 * is shaped, and the response does not depend on the outcome.
 */
export async function recordComposedOutput(
  dateISO: string,
  audience: "men" | "women",
  composed: ComposedTailored,
  deps: OutputsDeps = {},
): Promise<void> {
  try {
    const transport = deps.transport === undefined ? envTransport() : deps.transport;
    if (!transport) return;
    await restWrite(
      transport,
      "tailor_outputs",
      buildOutputRow(dateISO, audience, composed),
      "return=minimal",
    );
    const winner = buildWinnerRow(composed);
    if (winner) {
      const existing = await restRead(
        transport,
        `media_winners?url=eq.${encodeURIComponent(String(winner.url))}&select=win_count`,
      );
      const prior =
        Array.isArray(existing) &&
        typeof (existing[0] as Record<string, unknown> | undefined)?.win_count === "number"
          ? ((existing[0] as Record<string, unknown>).win_count as number)
          : 0;
      await restWrite(
        transport,
        "media_winners?on_conflict=url",
        {
          ...winner,
          win_count: prior + 1,
          last_won_at: (deps.now?.() ?? new Date()).toISOString(),
        },
        "resolution=merge-duplicates,return=minimal",
      );
    }
  } catch {
    // A record that cannot be written is a stage code in the log and
    // nothing else — the morning already has its devotional.
    console.error("tailor-outputs: stage=record");
  }
}

/** Live finds speak in the search's broader kinds; the catalog's shape carries five. */
const WINNER_KIND: Record<string, TailorMedia["kind"]> = {
  song: "song",
  talk: "talk",
  speech: "speech",
  interview: "interview",
  clip: "clip",
  video: "clip",
  film: "clip",
  podcast: "talk",
  article: "talk",
  book: "talk",
};

/** One stored winner back into the catalog's shape — or null when the row cannot be trusted. */
function winnerRowToMedia(row: unknown): TailorMedia | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const creator = typeof r.creator === "string" ? r.creator.trim() : "";
  const url = typeof r.url === "string" ? r.url.trim() : "";
  const kind = typeof r.kind === "string" ? WINNER_KIND[r.kind] : undefined;
  if (!title || !creator || !url.startsWith("https://") || !kind) return null;
  const score = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(100, Math.round(v)))
      : null;
  const popularity = score(r.popularity);
  const values = score(r.values_score);
  if (popularity === null || values === null) return null;
  const tagList = <T extends string>(v: unknown, guard: (x: unknown) => x is T): T[] =>
    Array.isArray(v) ? v.filter(guard) : [];
  return {
    kind,
    title,
    creator,
    url,
    blurb:
      "A winning find from a past morning's live search — kept in the library because it answered, and scored on the morning it won.",
    focuses: tagList(r.focus_tags, isTailorFocus),
    states: tagList(r.state_tags, isTailorState),
    tones: tagList(r.tone_tags, isTailorTone),
    popularity,
    values,
    valuesNote: "Alignment judged by the media scorer on the morning this work won its card.",
  };
}

/**
 * The grown library, most recent winners first, in the catalog's shape —
 * ready to merge into a morning's scored pool. Any failure (unconfigured,
 * unreachable, unusable rows) reads as an empty library: the seed pool
 * answers alone, silently.
 */
export async function loadMediaWinners(deps: OutputsDeps = {}): Promise<TailorMedia[]> {
  const transport = deps.transport === undefined ? envTransport() : deps.transport;
  if (!transport) return [];
  const rows = await restRead(
    transport,
    `media_winners?select=title,creator,url,kind,focus_tags,state_tags,tone_tags,popularity,values_score&order=last_won_at.desc&limit=${WINNERS_POOL_LIMIT}`,
  );
  if (!Array.isArray(rows)) return [];
  const out: TailorMedia[] = [];
  for (const row of rows) {
    const media = winnerRowToMedia(row);
    if (media) out.push(media);
  }
  return out;
}
