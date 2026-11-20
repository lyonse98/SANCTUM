// The counts-only profile tally (Erik's design, Nov 18–20, 2026): the
// analytics-track function's second mode. A reader who turned anonymous
// counts on may send the LIST-PICKS of their standing Tailor profile —
// the voices they chose, their season of life, their ongoing battles,
// their North Star — as ids, and nothing else. The counts say what the
// whole company is carrying; no words ever ride.
//
// The vocabularies below are MIRRORED from the canonical lists in
// src/lib/tailorProfile.ts (voices, seasons, North Star menus) and from
// the battles the client's battlesForAudience derives out of
// src/personas.ts — the same mirroring discipline as chat-proxy's
// letter-mode vocabularies. A src-side test
// (src/lib/profileTally.test.ts) imports this module and fails if the
// two sides ever drift apart, so edit the client source first and this
// copy in the same commit.
//
// Validation posture, mirroring letterPacketFromPayload: ids that are
// not in the owning track's vocabulary are DROPPED, arrays are capped
// at the profile's own caps, and a payload whose shape is wrong (bad
// token, bad track, a field of the wrong type) is rejected WHOLE —
// nothing partial is ever stored.

export type TallyAudience = "men" | "women";

export const TALLY_VOICES_MAX = 5;

export const TALLY_VOICES: Record<TallyAudience, string[]> = {
  men: [
    "fr-mike", "barron", "fradd", "roumie", "cavins", "west", "hahn", "casey-cole",
    "david-michael", "josh-johnson", "evert", "stefanick", "akin", "horn", "kreeft",
    "riccardo", "guy-in-the-pew", "schadt", "larry-richards", "bobby-angel",
    "matthew-kelly", "exodus-90", "paul-kim", "catholic-gentleman", "pints",
    "huberman", "peterson", "williamson", "bartlett", "clear", "goggins", "rogan",
    "howes", "mylett", "robbins", "ramsey", "manson", "holiday", "ferriss",
    "newport", "brooks", "haidt", "dungy", "tebow",
  ],
  women: [
    "sr-miriam", "khym", "beth-davis", "cobble", "jackie-hill-perry", "wilkin",
    "sadie", "emily-wilson", "katie-prejean", "darrow", "brenninkmeyer",
    "mother-angelica", "cameron-fradd", "haley-stewart", "kendra-tierney",
    "she-reads-truth", "risen-motherhood", "jackie-angel", "benzinger",
    "josephine-garrett", "hendey", "bean", "lenaburg", "shirer", "terkeurst",
    "uebbing", "balducci", "engstrom", "beth-moore", "her-true-worth",
    "girls-gone-bible", "simcha-fisher", "daigle", "annie-downs", "brene-brown",
    "mel-robbins", "jay-shetty", "parton", "gaines", "guthrie", "ivey",
    "emily-freeman", "lazy-genius", "underwood", "winans",
  ],
};

export const TALLY_SEASONS: Record<TallyAudience, string[]> = {
  men: [
    "single", "dating-engaged", "newly-married", "father-young", "father-older",
    "empty-nest", "widowed", "divorced-separated",
  ],
  women: [
    "single", "dating-engaged", "newly-married", "expecting", "mother-young",
    "mother-older", "empty-nest", "widowed", "divorced-separated",
  ],
};

export const TALLY_NORTH_STARS: Record<TallyAudience, string[]> = {
  men: [
    "be-still", "thy-will", "press-on", "stand-firm", "talents", "narrow-gate",
    "micah", "radical-love", "small-things", "breastplate",
  ],
  women: [
    "fiat", "be-still", "little-way", "catherine-fire", "come-and-rest",
    "god-is-within-her", "love-is-patient", "totus-tuus", "bahala-na",
  ],
};

// The battles' vocabulary IS the words — the struggles and issues the
// track's own companions carry, deduped in cast order, exactly as the
// client's battlesForAudience derives them. There is no separate cap:
// a stored profile can only ever hold words from this list, deduped,
// so the list's own length is the cap.
export const TALLY_BATTLES: Record<TallyAudience, string[]> = {
  men: [
    "Fatherhood", "Marriage", "Protecting family", "Work pressure", "Guilt",
    "Temptation", "Emotional storms", "Shame", "Addiction", "Discipline",
    "Changing direction", "Endurance", "Restlessness", "Lust",
    "Intellectual doubt", "Habits I can't break", "Discernment", "Ambition",
    "Vocation", "Decision-making", "Failure", "Impulsivity", "Starting over",
    "Burnout", "Reluctant leadership", "Anger", "Midlife reinvention",
    "Dating", "Parenting", "Loving your wife",
  ],
  women: [
    "Trust", "Surrender", "Motherhood", "Grief", "Saying yes", "Starting over",
    "Shame", "Hope", "Being believed", "Prayer", "Dryness", "Perseverance",
    "Friendship with God", "Courage", "Speaking truth", "Work",
    "Love of the Church", "Waiting on God", "Praying for family", "Letting go",
    "Calling", "Discernment", "Being doubted", "Simplicity", "Contemplation",
    "Hidden life", "The little way", "Hidden suffering", "Everyday fidelity",
  ],
};

export interface ValidatedTally {
  /** The raw device-held token. It is hashed before it is stored — the
   *  database only ever sees the SHA-256 (see index.ts). */
  tallyToken: string;
  audience: TallyAudience;
  voices: string[];
  seasonOfLife: string | null;
  ongoingBattles: string[];
  northStar: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanIdList(value: unknown, vocab: readonly string[], cap: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set(vocab);
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string" && allowed.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}

function cleanSingleId(value: unknown, vocab: readonly string[]): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  return vocab.includes(value) ? value : null;
}

/**
 * Validate a tally payload field by field. Returns null when the payload
 * is malformed as a whole (not an object, a token that is not a UUID,
 * an unknown track, a field of the wrong type); a well-shaped payload
 * always validates, with unknown ids dropped and arrays capped.
 */
export function validateTallyPayload(raw: unknown): ValidatedTally | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;

  if (typeof p.tallyToken !== "string" || !UUID_RE.test(p.tallyToken)) return null;
  if (p.audience !== "men" && p.audience !== "women") return null;
  const audience = p.audience as TallyAudience;

  const voices = cleanIdList(p.voices, TALLY_VOICES[audience], TALLY_VOICES_MAX);
  if (voices === null) return null;
  const battles = cleanIdList(p.ongoingBattles, TALLY_BATTLES[audience], TALLY_BATTLES[audience].length);
  if (battles === null) return null;
  const seasonOfLife = cleanSingleId(p.seasonOfLife, TALLY_SEASONS[audience]);
  if (seasonOfLife === undefined) return null;
  const northStar = cleanSingleId(p.northStar, TALLY_NORTH_STARS[audience]);
  if (northStar === undefined) return null;

  return {
    tallyToken: p.tallyToken,
    audience,
    voices,
    seasonOfLife,
    ongoingBattles: battles,
    northStar,
  };
}

/** SHA-256 hex of the tally token — the only form the database holds. */
export async function hashTallyToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
