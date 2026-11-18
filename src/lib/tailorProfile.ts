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
}

export const EMPTY_TAILOR_PROFILE: TailorProfile = {
  seasonOfLife: null,
  ongoingBattles: [],
  standingGoal: '',
  mediaPrefs: [],
  defaultTone: null,
  northStar: null,
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
 * The North Star list (Erik, Nov 18, 2026) — the same list on both tracks:
 * short, famous verses, and ideas the Church has long steered by. Verse
 * texts are brief excerpts, exact as given. A chosen star rides with
 * requests only as its resolved phrasing (see northStarLabel) — labels, not
 * ids, exactly like the season of life — and is stored nowhere but here.
 *
 * DRAFT: Erik vets this menu before it ships. Striking or rewording an
 * entry is a change to this one constant (plus its test pins) — nothing
 * else in the app hardcodes a star.
 */
export const NORTH_STARS: NorthStarOption[] = [
  { id: 'be-still', label: 'Be still', text: 'Be still, and know that I am God.', citation: 'Psalm 46:10' },
  { id: 'fear-not', label: 'Fear not', text: 'Fear not, for I am with you.', citation: 'Isaiah 41:10' },
  { id: 'thy-will', label: 'Thy will be done', text: 'Not my will, but yours, be done.', citation: 'Luke 22:42' },
  { id: 'help-unbelief', label: 'Help my unbelief', text: 'I believe; help my unbelief.', citation: 'Mark 9:24' },
  { id: 'micah', label: 'Justice, kindness, humility', text: 'Do justice, love kindness, walk humbly with your God.', citation: 'Micah 6:8' },
  { id: 'seek-first', label: 'Seek first the kingdom', text: 'Seek first the kingdom of God.', citation: 'Matthew 6:33' },
  { id: 'grace-sufficient', label: 'Grace sufficient', text: 'My grace is sufficient for you.', citation: '2 Corinthians 12:9' },
  { id: 'nothing-separates', label: 'Nothing separates', text: 'Nothing will be able to separate us from the love of God.', citation: 'Romans 8:39' },
  { id: 'lamp', label: 'A lamp to my feet', text: 'Your word is a lamp to my feet, a light to my path.', citation: 'Psalm 119:105' },
  { id: 'love-one-another', label: 'Love one another', text: 'Love one another, as I have loved you.', citation: 'John 13:34' },
  { id: 'not-anxious', label: 'Not anxious', text: 'Do not be anxious about tomorrow.', citation: 'Matthew 6:34' },
  { id: 'well-done', label: 'Well done', text: 'Well done, good and faithful servant.', citation: 'Matthew 25:21' },
  { id: 'golden-rule', label: 'The Golden Rule', text: 'Do to others as you would have them do to you.', citation: 'Matthew 7:12' },
  { id: 'press-on', label: 'Forward, not back', text: 'Forgetting what lies behind, I press on toward the goal.', citation: 'Philippians 3:13–14' },
  { id: 'become-a-saint', label: 'Become a saint', text: 'The only real tragedy is not to become a saint.', citation: 'after Léon Bloy' },
  { id: 'little-way', label: 'The little way', text: 'The little way — small things done with great love.', citation: 'after St. Thérèse of Lisieux' },
  { id: 'memento-mori', label: 'Memento mori', text: 'Memento mori — remember your death, and live today accordingly.', citation: "the Church's old counsel" },
  { id: 'radical-love', label: 'Radical love', text: 'Radical loving in every moment.', citation: '' },
];

export function northStarById(id: string | null): NorthStarOption | null {
  if (!id) return null;
  return NORTH_STARS.find((s) => s.id === id) ?? null;
}

/** The one phrasing a chosen star travels as: its words, then its source. */
export function northStarLabel(id: string | null): string | null {
  const star = northStarById(id);
  if (!star) return null;
  return star.citation ? `"${star.text}" — ${star.citation}` : `"${star.text}"`;
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
      northStar:
        typeof parsed.northStar === 'string' && northStarById(parsed.northStar) ? parsed.northStar : null,
    };
  } catch {
    return { ...EMPTY_TAILOR_PROFILE };
  }
}

export function saveTailorProfile(audience: Audience, profile: TailorProfile): void {
  try {
    localStorage.setItem(tailorProfileKey(audience), JSON.stringify(profile));
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
    p.northStar !== null
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
}

export function profileForRequest(audience: Audience, profile: TailorProfile): TailorRequestProfile | null {
  if (!hasTailorProfileValues(profile)) return null;
  return {
    seasonOfLife: seasonLabel(audience, profile.seasonOfLife),
    ongoingBattles: [...profile.ongoingBattles],
    standingGoal: profile.standingGoal.trim(),
    mediaPrefs: [...profile.mediaPrefs],
    northStar: northStarLabel(profile.northStar),
  };
}

function hasTailorProfileValues(profile: TailorProfile): boolean {
  return (
    profile.seasonOfLife !== null ||
    profile.ongoingBattles.length > 0 ||
    profile.standingGoal.trim().length > 0 ||
    profile.mediaPrefs.length > 0 ||
    profile.defaultTone !== null ||
    profile.northStar !== null
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
