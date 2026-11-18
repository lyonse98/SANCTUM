import type { Audience } from '@/types';
import { personasForAudience } from '@/personas';
import type { TailorFocus, TailorSearchKind, TailorState, TailorTone } from '@/data/tailorBank';

/**
 * The standing Tailor profile (Erik, Nov 13, 2026). Tailor Today's daily intake
 * says what THIS morning is; the profile says what season the person is in, so
 * most mornings open already aimed. It lives ON-DEVICE ONLY — a localStorage
 * key per track under the sanctum_ prefix, which puts it inside the panic
 * wipe's sweep like every other thing the app keeps — and it persists until
 * the user edits it, erases it, or wipes the device clean. No expiry, no
 * server copy: the profile rides along with a tailor request the way the
 * morning's own words do, transiently, and is stored nowhere else.
 *
 * Erasing is a first-class act, offered in the Tailor panel itself and again
 * in Settings beside the other privacy controls — the same posture the app
 * takes toward chat history: yours, kept here, gone when you say so.
 */

export interface TailorProfile {
  /** A season-of-life chip id from the track's own list, or null. */
  seasonOfLife: string | null;
  /** Battle labels, in the track's own vocabulary (the companions' words). */
  ongoingBattles: string[];
  /** One line, in the user's own words. */
  standingGoal: string;
  /** The media kinds a live pick may be drawn from; empty means any kind. */
  mediaPrefs: TailorSearchKind[];
  /** The usual answer to "what do you want from God today?" */
  defaultTone: TailorTone | null;
  /**
   * The biblical North Star: one chosen scripture or idea (a NORTH_STARS id)
   * that quietly guides Tailor, the companions, and a companion's letter.
   * Optional by design (Erik, Nov 18, 2026) — null is the ordinary state,
   * and nothing anywhere treats its absence as a gap to be filled.
   */
  northStar: string | null;
  /**
   * The voices the reader listens to (VOICES ids, at most five): the
   * teachers whose voice they already trust. MEDIA ONLY (Erik, Nov 18,
   * 2026): they bias which media a Tailor build picks and references —
   * never the reflection, the challenge, the bridge, a companion, or a
   * letter. Optional like the North Star; empty is the ordinary state.
   */
  voices: string[];
  /** One more voice, in the reader's own words (a name, ≤80 chars). Media only, like the chips. */
  voicesOther: string;
}

export const EMPTY_TAILOR_PROFILE: TailorProfile = {
  seasonOfLife: null,
  ongoingBattles: [],
  standingGoal: '',
  mediaPrefs: [],
  defaultTone: null,
  northStar: null,
  voices: [],
  voicesOther: '',
};

// ── The North Stars — one compass, chosen from a list ────────────────────────

export interface NorthStarOption {
  id: string;
  /** The short name the picker shows. */
  label: string;
  /** The words themselves (a verse excerpt, or the idea in one line). */
  text: string;
  /** The verse's citation, or the idea's attribution. */
  citation: string;
}

/**
 * The North Star registry (Erik's FINAL lists, Nov 18, 2026): every star
 * either track may steer by, one entry per id. The menus themselves are
 * per-track (NORTH_STAR_IDS below) — his list and hers differ, curated by
 * Erik star by star; the one shared star, Be still, appears in both with
 * identical words. Verse texts are brief excerpts, exact as given. A
 * chosen star rides with requests only as its resolved phrasing (see
 * northStarLabel) — labels, not ids, exactly like the season of life —
 * and is stored nowhere but here.
 */
export const NORTH_STARS: NorthStarOption[] = [
  { id: 'be-still', label: 'Be still', text: 'Be still, and know that I am God.', citation: 'Psalm 46:10' },
  { id: 'thy-will', label: 'Not my will', text: 'Not my will, but yours, be done.', citation: 'Luke 22:42' },
  { id: 'press-on', label: 'Press on', text: 'Forgetting what lies behind, I press on toward the goal.', citation: 'Philippians 3:13–14' },
  { id: 'stand-firm', label: 'Stand firm', text: 'Be watchful, stand firm in the faith, act like men, be strong.', citation: '1 Corinthians 16:13' },
  { id: 'talents', label: 'Don\'t bury the talent', text: 'Well done, good and faithful servant.', citation: 'Matthew 25:21' },
  { id: 'narrow-gate', label: 'The narrow gate', text: 'Enter by the narrow gate.', citation: 'Matthew 7:13' },
  { id: 'micah', label: 'Act justly', text: 'Act justly, love mercy, walk humbly with your God.', citation: 'Micah 6:8' },
  { id: 'radical-love', label: 'Radical love', text: 'Father, forgive them.', citation: 'Luke 23:34' },
  { id: 'small-things', label: 'Small things, great love', text: 'Do small things with great love.', citation: 'St. Teresa of Calcutta' },
  { id: 'breastplate', label: 'The Breastplate', text: 'Christ beside me, Christ before me, Christ behind me, Christ within me.', citation: "St. Patrick's Breastplate" },
  { id: 'fiat', label: 'The Fiat', text: 'Let it be to me according to your word.', citation: 'Luke 1:38' },
  { id: 'little-way', label: 'The little way', text: 'The little way — small things done with great love.', citation: 'after St. Thérèse of Lisieux' },
  { id: 'catherine-fire', label: 'Be who God meant you to be', text: 'Be who God meant you to be, and you will set the world on fire.', citation: 'St. Catherine of Siena' },
  { id: 'come-and-rest', label: 'Come and rest', text: 'Come to me, all who labor, and I will give you rest.', citation: 'Matthew 11:28' },
  { id: 'god-is-within-her', label: 'God is within her', text: 'God is within her, she will not fall.', citation: 'Psalm 46:5' },
  { id: 'love-is-patient', label: 'Love is patient', text: 'Love is patient and kind. Love never fails.', citation: '1 Corinthians 13' },
  { id: 'totus-tuus', label: 'Totus Tuus', text: 'Totus tuus — totally yours.', citation: 'St. John Paul II, to Mary' },
  { id: 'bahala-na', label: 'Bahala na', text: 'Bahala na — leave it to God.', citation: 'the Filipino trust' },
];

export function northStarById(id: string | null): NorthStarOption | null {
  if (!id) return null;
  return NORTH_STARS.find((s) => s.id === id) ?? null;
}

/**
 * The tracks' menus: ordered ids into the registry above — the order the
 * picker shows them, Erik's order. A stored id counts only when it sits
 * on the OWNING track's menu (see loadTailorProfile): a star from the
 * other track's list is not this track's star, shared ids excepted.
 */
const NORTH_STAR_IDS: Record<Audience, string[]> = {
  men: [
    'be-still',
    'thy-will',
    'press-on',
    'stand-firm',
    'talents',
    'narrow-gate',
    'micah',
    'radical-love',
    'small-things',
    'breastplate',
  ],
  women: [
    'fiat',
    'be-still',
    'little-way',
    'catherine-fire',
    'come-and-rest',
    'god-is-within-her',
    'love-is-patient',
    'totus-tuus',
    'bahala-na',
  ],
};

/** The stars this track may choose from, in the order the picker shows them. */
export function northStarsForAudience(audience: Audience): NorthStarOption[] {
  return NORTH_STAR_IDS[audience]
    .map((id) => northStarById(id))
    .filter((s): s is NorthStarOption => s !== null);
}

/** Whether an id is on this track's own list — the load-time gate. */
export function isNorthStarForAudience(audience: Audience, id: string | null): boolean {
  return id !== null && NORTH_STAR_IDS[audience].includes(id);
}

/** The one phrasing a chosen star travels as: its words, then its source. */
export function northStarLabel(id: string | null): string | null {
  const star = northStarById(id);
  if (!star) return null;
  return star.citation ? `"${star.text}" — ${star.citation}` : `"${star.text}"`;
}

// ── The voices — who the reader already listens to ───────────────────────────

export interface VoiceOption {
  id: string;
  /** The name the chip shows — the same string that rides with a request. */
  label: string;
  /** The shelf the chip sits on in the editor. */
  group: 'faith' | 'culture';
}

/** How many voices a reader may name — a handful of real influences, not a fan list. */
export const VOICES_MAX = 5;

/**
 * The voices lists (Erik's FINAL lists, Nov 18, 2026, expanded the same
 * day with his approved additions): per track, two
 * shelves — the faith voices and the culture & self-help voices a reader
 * plausibly already trusts. Their whole job is vibe, message, interests,
 * and trust FOR MEDIA SELECTION: a Tailor build may surface a real work
 * by or featuring a chosen voice. NO political figures — Erik's standing
 * rule for these lists. Unlike the North Stars the tracks share nothing
 * here: his shelf and hers are different people, because his listening
 * and hers are. A chosen voice rides with a request as its LABEL, like
 * every other profile field — and only as far as the media hunt.
 */
export const VOICES: Record<Audience, VoiceOption[]> = {
  men: [
    { id: 'fr-mike', label: 'Fr. Mike Schmitz', group: 'faith' },
    { id: 'barron', label: 'Bishop Barron', group: 'faith' },
    { id: 'fradd', label: 'Matt Fradd', group: 'faith' },
    { id: 'roumie', label: 'Jonathan Roumie', group: 'faith' },
    { id: 'cavins', label: 'Jeff Cavins', group: 'faith' },
    { id: 'west', label: 'Christopher West', group: 'faith' },
    { id: 'hahn', label: 'Scott Hahn', group: 'faith' },
    { id: 'casey-cole', label: 'Fr. Casey Cole', group: 'faith' },
    { id: 'david-michael', label: 'Fr. David Michael Moses', group: 'faith' },
    { id: 'josh-johnson', label: 'Fr. Josh Johnson', group: 'faith' },
    { id: 'evert', label: 'Jason Evert', group: 'faith' },
    { id: 'stefanick', label: 'Chris Stefanick', group: 'faith' },
    { id: 'akin', label: 'Jimmy Akin', group: 'faith' },
    { id: 'horn', label: 'Trent Horn', group: 'faith' },
    { id: 'kreeft', label: 'Peter Kreeft', group: 'faith' },
    { id: 'huberman', label: 'Andrew Huberman', group: 'culture' },
    { id: 'peterson', label: 'Jordan Peterson', group: 'culture' },
    { id: 'williamson', label: 'Chris Williamson (Modern Wisdom)', group: 'culture' },
    { id: 'bartlett', label: 'Steven Bartlett (Diary of a CEO)', group: 'culture' },
    { id: 'clear', label: 'James Clear', group: 'culture' },
    { id: 'goggins', label: 'David Goggins', group: 'culture' },
    { id: 'rogan', label: 'Joe Rogan', group: 'culture' },
    { id: 'howes', label: 'Lewis Howes', group: 'culture' },
    { id: 'mylett', label: 'Ed Mylett', group: 'culture' },
    { id: 'robbins', label: 'Tony Robbins', group: 'culture' },
    { id: 'ramsey', label: 'Dave Ramsey', group: 'culture' },
    { id: 'manson', label: 'Mark Manson', group: 'culture' },
    { id: 'holiday', label: 'Ryan Holiday', group: 'culture' },
    { id: 'ferriss', label: 'Tim Ferriss', group: 'culture' },
    { id: 'newport', label: 'Cal Newport', group: 'culture' },
    { id: 'brooks', label: 'Arthur Brooks', group: 'culture' },
    { id: 'haidt', label: 'Jonathan Haidt', group: 'culture' },
  ],
  women: [
    { id: 'sr-miriam', label: 'Sr. Miriam James', group: 'faith' },
    { id: 'khym', label: 'Heather Khym', group: 'faith' },
    { id: 'beth-davis', label: 'Beth Davis (Blessed Is She)', group: 'faith' },
    { id: 'cobble', label: 'Tara-Leigh Cobble (The Bible Recap)', group: 'faith' },
    { id: 'jackie-hill-perry', label: 'Jackie Hill Perry', group: 'faith' },
    { id: 'wilkin', label: 'Jen Wilkin', group: 'faith' },
    { id: 'sadie', label: 'Sadie Robertson Huff', group: 'faith' },
    { id: 'emily-wilson', label: 'Emily Wilson', group: 'faith' },
    { id: 'katie-prejean', label: 'Katie Prejean McGrady', group: 'faith' },
    { id: 'darrow', label: 'Leah Darrow', group: 'faith' },
    { id: 'brenninkmeyer', label: 'Lisa Brenninkmeyer', group: 'faith' },
    { id: 'mother-angelica', label: 'Mother Angelica', group: 'faith' },
    { id: 'cameron-fradd', label: 'Cameron Fradd (Among the Lilies)', group: 'faith' },
    { id: 'haley-stewart', label: 'Haley Stewart', group: 'faith' },
    { id: 'kendra-tierney', label: 'Kendra Tierney', group: 'faith' },
    { id: 'she-reads-truth', label: 'She Reads Truth', group: 'faith' },
    { id: 'risen-motherhood', label: 'Risen Motherhood', group: 'faith' },
    { id: 'daigle', label: 'Lauren Daigle', group: 'culture' },
    { id: 'annie-downs', label: 'Annie F. Downs', group: 'culture' },
    { id: 'brene-brown', label: 'Brené Brown', group: 'culture' },
    { id: 'mel-robbins', label: 'Mel Robbins', group: 'culture' },
    { id: 'jay-shetty', label: 'Jay Shetty', group: 'culture' },
    { id: 'parton', label: 'Dolly Parton', group: 'culture' },
    { id: 'gaines', label: 'Joanna Gaines', group: 'culture' },
    { id: 'guthrie', label: 'Savannah Guthrie', group: 'culture' },
    { id: 'ivey', label: 'Jamie Ivey', group: 'culture' },
    { id: 'emily-freeman', label: 'Emily P. Freeman', group: 'culture' },
    { id: 'lazy-genius', label: 'The Lazy Genius (Kendra Adachi)', group: 'culture' },
    { id: 'underwood', label: 'Carrie Underwood', group: 'culture' },
    { id: 'winans', label: 'CeCe Winans', group: 'culture' },
  ],
};

/** The voices this track may choose from, faith shelf first, Erik's order. */
export function voicesForAudience(audience: Audience): VoiceOption[] {
  return VOICES[audience];
}

export function voiceById(audience: Audience, id: string): VoiceOption | null {
  return VOICES[audience].find((v) => v.id === id) ?? null;
}

/** Whether an id is on this track's own list — the load-time gate, as with the stars. */
export function isVoiceForAudience(audience: Audience, id: string): boolean {
  return VOICES[audience].some((v) => v.id === id);
}

/** The label a chosen voice travels as — labels, not ids, like everything else here. */
export function voiceLabel(audience: Audience, id: string): string | null {
  return voiceById(audience, id)?.label ?? null;
}

/**
 * Stored or drafted voices, made safe: this track's ids only, deduped,
 * at most VOICES_MAX. Used at load (a foreign or retired id drops) and at
 * save (the cap is the profile's shape, not just the editor's manners).
 */
function cleanVoices(audience: Audience, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === 'string' && isVoiceForAudience(audience, v) && !out.includes(v)) out.push(v);
    if (out.length >= VOICES_MAX) break;
  }
  return out;
}

export function tailorProfileKey(audience: Audience): string {
  return `sanctum_tailor_profile_${audience}`;
}

// ── The seasons of life, worded per track ────────────────────────────────────

export interface SeasonOption {
  id: string;
  label: string;
}

/**
 * The seasons, in the track's own terms: his list speaks of a father, hers of
 * a mother, and hers names expecting a child — the season Sanctum's women
 * most often carry into a morning. Both lists stay plain about the hard ones:
 * widowed, divorced or separated are seasons too, and the devotional should
 * be allowed to know them when the user chooses to say so.
 */
export const SEASONS_OF_LIFE: Record<Audience, SeasonOption[]> = {
  men: [
    { id: 'single', label: 'Single' },
    { id: 'dating-engaged', label: 'Dating or engaged' },
    { id: 'newly-married', label: 'Newly married' },
    { id: 'father-young', label: 'Father of young children' },
    { id: 'father-older', label: 'Father of older children' },
    { id: 'empty-nest', label: 'Empty nest' },
    { id: 'widowed', label: 'Widowed' },
    { id: 'divorced-separated', label: 'Divorced or separated' },
  ],
  women: [
    { id: 'single', label: 'Single' },
    { id: 'dating-engaged', label: 'Dating or engaged' },
    { id: 'newly-married', label: 'Newly married' },
    { id: 'expecting', label: 'Expecting a child' },
    { id: 'mother-young', label: 'Mother of young children' },
    { id: 'mother-older', label: 'Mother of older children' },
    { id: 'empty-nest', label: 'Empty nest' },
    { id: 'widowed', label: 'Widowed' },
    { id: 'divorced-separated', label: 'Divorced or separated' },
  ],
};

export function seasonLabel(audience: Audience, id: string | null): string | null {
  if (!id) return null;
  return SEASONS_OF_LIFE[audience].find((s) => s.id === id)?.label ?? null;
}

// ── The battles, in the companions' own vocabulary ───────────────────────────

/**
 * The ongoing battles are chosen from the words the track's own companions
 * already carry: the struggles on the men's cards, the issues on the women's.
 * The vocabulary is the app's — a battle the user can name here is a battle a
 * companion in the next room speaks to by the same name. Deduped, in cast
 * order.
 */
export function battlesForAudience(audience: Audience): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const persona of personasForAudience(audience)) {
    const words = audience === 'women' ? (persona.issues ?? persona.struggles) : persona.struggles;
    for (const word of words) {
      if (!seen.has(word)) {
        seen.add(word);
        out.push(word);
      }
    }
  }
  return out;
}

// ── Storage ──────────────────────────────────────────────────────────────────

const SEARCH_KINDS: TailorSearchKind[] = ['song', 'video', 'talk', 'podcast', 'article', 'book'];

function filterSearchKinds(value: unknown): TailorSearchKind[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is TailorSearchKind => typeof v === 'string' && (SEARCH_KINDS as string[]).includes(v));
}

const TONES: TailorTone[] = ['comfort', 'courage', 'challenge', 'clarity', 'consolation'];

/** Reads the track's profile, tolerating any damage — a broken profile is no profile. */
export function loadTailorProfile(audience: Audience): TailorProfile {
  try {
    const raw = localStorage.getItem(tailorProfileKey(audience));
    if (!raw) return { ...EMPTY_TAILOR_PROFILE };
    const parsed = JSON.parse(raw) as Partial<TailorProfile>;
    const seasonIds = SEASONS_OF_LIFE[audience].map((s) => s.id);
    const battleWords = new Set(battlesForAudience(audience));
    return {
      seasonOfLife:
        typeof parsed.seasonOfLife === 'string' && seasonIds.includes(parsed.seasonOfLife)
          ? parsed.seasonOfLife
          : null,
      ongoingBattles: Array.isArray(parsed.ongoingBattles)
        ? parsed.ongoingBattles.filter((b): b is string => typeof b === 'string' && battleWords.has(b))
        : [],
      standingGoal: typeof parsed.standingGoal === 'string' ? parsed.standingGoal.slice(0, 120) : '',
      mediaPrefs: [...new Set(filterSearchKinds(parsed.mediaPrefs))],
      defaultTone:
        typeof parsed.defaultTone === 'string' && (TONES as string[]).includes(parsed.defaultTone)
          ? (parsed.defaultTone as TailorTone)
          : null,
      // A star validates against the OWNING track's menu, not the whole
      // registry: her Fiat stored under his key (or a retired draft id)
      // reads as no star at all.
      northStar:
        typeof parsed.northStar === 'string' && isNorthStarForAudience(audience, parsed.northStar)
          ? parsed.northStar
          : null,
      // Voices likewise: only this track's own ids survive, capped at
      // five; the free-text name is one short line.
      voices: cleanVoices(audience, parsed.voices),
      voicesOther: typeof parsed.voicesOther === 'string' ? parsed.voicesOther.slice(0, 80) : '',
    };
  } catch {
    return { ...EMPTY_TAILOR_PROFILE };
  }
}

export function saveTailorProfile(audience: Audience, profile: TailorProfile): void {
  try {
    // The voices' shape is enforced here, not only in the editor: this
    // track's ids, at most five, and the free-text name within its cap.
    const normalized: TailorProfile = {
      ...profile,
      voices: cleanVoices(audience, profile.voices),
      voicesOther: (profile.voicesOther ?? '').slice(0, 80),
    };
    localStorage.setItem(tailorProfileKey(audience), JSON.stringify(normalized));
  } catch {
    // Storage unavailable — the profile simply does not persist.
  }
}

/** A profile counts when it carries anything at all — the Settings erase shows only then. */
export function hasTailorProfile(audience: Audience): boolean {
  const p = loadTailorProfile(audience);
  return (
    p.seasonOfLife !== null ||
    p.ongoingBattles.length > 0 ||
    p.standingGoal.trim().length > 0 ||
    p.mediaPrefs.length > 0 ||
    p.defaultTone !== null ||
    p.northStar !== null ||
    p.voices.length > 0 ||
    p.voicesOther.trim().length > 0
  );
}

export function eraseTailorProfile(audience: Audience): void {
  try {
    localStorage.removeItem(tailorProfileKey(audience));
  } catch {
    // ignore — nothing to erase where nothing could be stored
  }
}

// ── What rides with a tailor request ─────────────────────────────────────────

/** The profile as the function receives it: labels, not ids — phrasing, not keys. */
export interface TailorRequestProfile {
  seasonOfLife: string | null;
  ongoingBattles: string[];
  standingGoal: string;
  mediaPrefs: TailorSearchKind[];
  /** The North Star's resolved phrasing (see northStarLabel), or null. */
  northStar: string | null;
  /** The chosen voices' LABELS (see voiceLabel) — media selection only, server-fenced. */
  voices: string[];
  /** The free-text voice, trimmed — media selection only, like the labels. */
  voicesOther: string;
}

export function profileForRequest(audience: Audience, profile: TailorProfile): TailorRequestProfile | null {
  if (!hasTailorProfileValues(profile)) return null;
  return {
    seasonOfLife: seasonLabel(audience, profile.seasonOfLife),
    ongoingBattles: [...profile.ongoingBattles],
    standingGoal: profile.standingGoal.trim(),
    mediaPrefs: [...profile.mediaPrefs],
    northStar: northStarLabel(profile.northStar),
    // Ids never cross the wire: each chosen voice resolves to its label,
    // and an id that is not this track's own simply does not ride.
    voices: (profile.voices ?? [])
      .map((id) => voiceLabel(audience, id))
      .filter((l): l is string => l !== null)
      .slice(0, VOICES_MAX),
    voicesOther: (profile.voicesOther ?? '').trim(),
  };
}

function hasTailorProfileValues(profile: TailorProfile): boolean {
  return (
    profile.seasonOfLife !== null ||
    profile.ongoingBattles.length > 0 ||
    profile.standingGoal.trim().length > 0 ||
    profile.mediaPrefs.length > 0 ||
    profile.defaultTone !== null ||
    profile.northStar !== null ||
    (profile.voices ?? []).length > 0 ||
    (profile.voicesOther ?? '').trim().length > 0
  );
}

/**
 * A stable signature of everything in the profile that can change a build —
 * folded into the day's cache key, so editing the standing profile and
 * rebuilding the same stated morning is a new build, not a stale replay.
 */
export function profileSignature(profile: TailorRequestProfile | null): string {
  if (!profile) return 'noprofile';
  return [
    profile.seasonOfLife ?? '',
    profile.ongoingBattles.join(','),
    profile.standingGoal.trim().toLowerCase(),
    profile.mediaPrefs.join(','),
    profile.northStar ?? '',
    // The voices change which media a build picks, so they change the
    // build: a voices edit busts the day's cache like any other edit.
    (profile.voices ?? []).join(','),
    (profile.voicesOther ?? '').trim().toLowerCase(),
  ].join('|');
}

// ── Prefill: the standing season leans the morning's first answer ────────────

/** Battles that name today's focus outright, in a fixed priority order. */
const FOCUS_BY_BATTLE: { focus: TailorFocus; battles: string[] }[] = [
  { focus: 'grief', battles: ['Grief'] },
  { focus: 'temptation', battles: ['Lust', 'Temptation', 'Addiction', "Habits I can't break"] },
  { focus: 'marriage', battles: ['Marriage', 'A hard marriage', 'Loving your wife'] },
  { focus: 'family', battles: ['Fatherhood', 'Parenting', 'Motherhood', 'Wayward children', 'Praying for family'] },
  { focus: 'work', battles: ['Work pressure', 'Work'] },
  { focus: 'decision', battles: ['Discernment', 'Decision-making', 'Vocation', 'Calling'] },
  { focus: 'conversation', battles: ['Speaking truth'] },
];

/** Battles whose weather is a state of arrival, in the order the user listed them. */
const STATE_BY_BATTLE: Record<string, TailorState> = {
  Anger: 'angry',
  Grief: 'down',
  Burnout: 'down',
  'Feeling unseen': 'down',
  Dryness: 'numb',
  'Dry prayer': 'numb',
  Restlessness: 'scattered',
  'Emotional storms': 'anxious',
};

/**
 * The intake's opening position, leaned by the standing profile — a SUGGESTION
 * the morning can override with one tap, never a lock: the focus is the first
 * priority focus any standing battle names, the state is the weather of the
 * first battle that carries one. Season of life deliberately does NOT prefill
 * (it shapes the server's phrasing, not the morning's own two answers).
 */
export function profileDefaults(profile: TailorProfile): { state?: TailorState; focus?: TailorFocus } {
  const out: { state?: TailorState; focus?: TailorFocus } = {};
  for (const battle of profile.ongoingBattles) {
    const state = STATE_BY_BATTLE[battle];
    if (state) {
      out.state = state;
      break;
    }
  }
  for (const { focus, battles } of FOCUS_BY_BATTLE) {
    if (battles.some((b) => profile.ongoingBattles.includes(b))) {
      out.focus = focus;
      break;
    }
  }
  return out;
}
