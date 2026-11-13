import type { Persona } from '@/types';

/**
 * The typable companion matcher (Erik's ruling, Nov 12, 2026). The router's guided
 * questions serve a user who likes tapping; this serves the one who knows what he
 * is carrying and wants to say it in his own words. It runs entirely on-device —
 * no network call, no cost, nothing typed leaves the phone — scoring the words
 * against each companion's own areas: the struggles on his card, the issues chips
 * on hers, and the preset labels both casts carry, which are already written in
 * the user's vocabulary of need.
 *
 * Scoring is deliberately plain, and ordered by how much the words can be trusted:
 * a whole area phrase found in the text counts most; a single word the card itself
 * uses counts next; a small synonym table bridges the words users actually type
 * ("porn", "miscarriage", "panic") to the words the cards use ("lust", "grief",
 * "emotional storms") — bridged matches count least, and their total is capped, so
 * one typed word cannot explain a whole card. Zero score means no match — the
 * router then says so and shows the whole cast, never a forced fit.
 */

export interface CompanionMatch {
  persona: Persona;
  score: number;
  /** The areas that matched, in the card's own words — the "why this fit" line. */
  matchedAreas: string[];
  reason: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'i', 'im', "i'm", 'i’ve', "i've", 'my', 'me',
  'to', 'of', 'in', 'on', 'with', 'for', 'am', 'is', 'it', 'its', 'that', 'this',
  'feel', 'feeling', 'feels', 'felt', 'like', 'just', 'really', 'keep', 'keeps',
  'cant', "can't", 'cannot', 'dont', "don't", 'about', 'from', 'have', 'has',
  'been', 'being', 'are', 'was', 'were', 'will', 'would', 'what', 'when',
  'how', 'who', 'whom', 'need', 'want', 'help', 'talk', 'struggling', 'struggle',
  'struggles', 'going', 'through', 'right', 'now', 'today', 'lot', 'very', 'so',
  'too', 'much', 'more', 'all', 'any', 'get', 'getting', 'got', 'make', 'makes',
  'know', 'think', 'every', 'always', 'never', 'again', 'one', 'thing', 'things',
]);

/**
 * Words a user types -> the vocabulary the cards use. Kept small and concrete:
 * each entry exists because a real need is commonly named the left way and the
 * cards name it the right way.
 */
const SYNONYMS: Record<string, string[]> = {
  porn: ['lust', 'temptation', 'shame'],
  pornography: ['lust', 'temptation', 'shame'],
  lust: ['temptation', 'shame'],
  chastity: ['lust'],
  impure: ['lust', 'shame'],
  miscarriage: ['grief', 'motherhood', 'loss', 'baby'],
  stillbirth: ['grief', 'motherhood', 'loss', 'baby'],
  baby: ['children', 'motherhood', 'parenting', 'fatherhood'],
  grieving: ['grief'],
  grieve: ['grief'],
  lost: ['grief', 'loss'],
  death: ['grief'],
  died: ['grief'],
  anxious: ['anxiety', 'fear', 'overwhelmed', 'emotional'],
  anxiety: ['fear', 'overwhelmed', 'emotional'],
  panic: ['fear', 'overwhelmed', 'emotional'],
  worried: ['anxiety', 'fear'],
  worry: ['anxiety', 'fear'],
  afraid: ['fear', 'courage'],
  scared: ['fear', 'courage'],
  depressed: ['despair', 'hope', 'darkness'],
  depression: ['despair', 'hope', 'darkness'],
  hopeless: ['despair', 'hope'],
  lonely: ['alone', 'hidden', 'unseen'],
  alone: ['lonely', 'hidden'],
  unseen: ['hidden'],
  angry: ['anger'],
  rage: ['anger'],
  temper: ['anger', 'impulsivity'],
  addicted: ['addiction', 'habits'],
  addiction: ['habits'],
  alcohol: ['addiction', 'habits'],
  drinking: ['addiction', 'habits'],
  habit: ['habits'],
  habits: ['addiction'],
  failing: ['failure'],
  failed: ['failure'],
  failure: ['failing'],
  sin: ['shame', 'guilt', 'failure'],
  guilty: ['guilt', 'shame'],
  guilt: ['shame'],
  ashamed: ['shame'],
  shame: ['guilt'],
  tired: ['burnout', 'perseverance', 'endurance'],
  exhausted: ['burnout', 'perseverance'],
  burnout: ['exhaustion', 'perseverance'],
  overwhelmed: ['burnout', 'emotional'],
  decision: ['discernment', 'decision-making', 'vocation'],
  decisions: ['discernment', 'decision-making'],
  direction: ['discernment', 'vocation', 'calling'],
  calling: ['vocation', 'discernment'],
  vocation: ['calling', 'discernment'],
  purpose: ['vocation', 'calling'],
  job: ['work'],
  career: ['work', 'ambition', 'vocation'],
  work: ['work pressure'],
  boss: ['work'],
  wife: ['marriage', 'loving your wife'],
  husband: ['marriage', 'a hard marriage'],
  marriage: ['wife', 'husband'],
  married: ['marriage'],
  kids: ['children', 'parenting', 'fatherhood', 'motherhood'],
  children: ['kids', 'parenting'],
  son: ['children', 'wayward children'],
  daughter: ['children', 'wayward children'],
  child: ['children'],
  father: ['fatherhood', 'parenting'],
  dad: ['fatherhood'],
  mother: ['motherhood'],
  mom: ['motherhood'],
  parents: ['family'],
  family: ['parenting', 'praying for family'],
  prayer: ['dry prayer', 'dryness'],
  praying: ['prayer', 'dry prayer'],
  dry: ['dryness', 'dry prayer'],
  dryness: ['dry prayer', 'perseverance'],
  distracted: ['distraction'],
  distraction: ['dry prayer'],
  god: ['friendship with god', 'trust', 'surrender'],
  distant: ['dryness', 'desolation'],
  desolation: ['dryness', 'perseverance'],
  doubting: ['being doubted', 'doubt'],
  doubted: ['being doubted', 'courage'],
  doubt: ['intellectual doubt', 'being doubted'],
  faith: ['trust', 'staying faithful'],
  courage: ['being doubted'],
  brave: ['courage'],
  truth: ['speaking truth'],
  speak: ['speaking truth'],
  starting: ['starting over', 'new beginning'],
  start: ['starting over'],
  beginning: ['new beginning', 'starting over'],
  believed: ['being believed'],
  small: ['small things', 'the little way', 'hidden life'],
  ordinary: ['small things', 'everyday fidelity'],
  everyday: ['everyday fidelity', 'small things'],
  waiting: ['waiting on god', 'perseverance'],
  wait: ['waiting on god'],
  letting: ['letting go'],
  surrender: ['trust', 'letting go'],
  control: ['surrender', 'letting go', 'trust'],
  yes: ['saying yes'],
  restless: ['restlessness'],
  restlessness: ['chasing'],
  chasing: ['restlessness'],
  temptation: ['lust', 'guilt'],
  tempted: ['temptation'],
  storms: ['emotional storms'],
  emotional: ['emotional storms'],
  emotions: ['emotional storms'],
  leadership: ['reluctant leadership'],
  lead: ['leadership'],
  leader: ['reluctant leadership'],
  midlife: ['midlife reinvention'],
  directionless: ['discernment', 'changing direction'],
  changing: ['changing direction'],
  zeal: ['love of the church'],
  church: ['love of the church'],
  contemplation: ['hidden life', 'simplicity'],
  simplicity: ['letting go'],
  possessions: ['simplicity', 'letting go'],
  impulsive: ['impulsivity'],
  impulsivity: ['impulsive'],
  hidden: ['hidden life', 'hidden suffering', 'feeling unseen'],
  suffering: ['hidden suffering', 'perseverance', 'endurance'],
  pain: ['suffering', 'endurance'],
  hope: ['despair'],
  protect: ['protecting family'],
  protecting: ['protecting family'],
  pressure: ['work pressure'],
  dating: ['marriage'],
  perseverance: ['waiting on god', 'endurance'],
  endurance: ['perseverance'],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\-\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function contentTokens(text: string): string[] {
  return tokenize(text).filter((w) => !STOPWORDS.has(w));
}

/**
 * A persona's areas, in display words: the struggles and issues on the card
 * first (what the companion is *for*), then the preset labels (doors into
 * conversation — real signal, but lighter: a preset that happens to share a
 * word with the need should not outrank another companion's declared area).
 */
function areasOf(persona: Persona): { label: string; tokens: string[]; preset: boolean }[] {
  const entries = [
    ...[...persona.struggles, ...(persona.issues ?? [])].map((label) => ({ label, preset: false })),
    ...persona.presets.map((p) => ({ label: p.label, preset: true })),
  ];
  // De-duplicate case-insensitively, keeping the first (card) spelling.
  const seen = new Set<string>();
  const out: { label: string; tokens: string[]; preset: boolean }[] = [];
  for (const { label, preset } of entries) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, tokens: contentTokens(label), preset });
  }
  return out;
}

const PHRASE_POINTS = 8;
const WORD_POINTS = 4;
const PRESET_PHRASE_POINTS = 5;
const PRESET_WORD_POINTS = 2;
const BRIDGE_FULL_POINTS = 3;
const BRIDGE_PART_POINTS = 1;
const BRIDGE_CAP = 5;

function scorePersona(inputTokens: Set<string>, persona: Persona): CompanionMatch | null {
  let score = 0;
  const matched: string[] = [];
  const matchedKeys = new Set<string>();
  const noteMatch = (area: string, points: number) => {
    score += points;
    const key = area.toLowerCase();
    if (!matchedKeys.has(key)) {
      matchedKeys.add(key);
      matched.push(area);
    }
  };

  const areas = areasOf(persona);
  const areaByKey = new Map(areas.map((a) => [a.label.toLowerCase(), a]));

  // Direct pass — the card's own words, typed by the user.
  for (const area of areas) {
    if (area.tokens.length === 0) continue;
    if (area.tokens.length > 1 && area.tokens.every((tok) => inputTokens.has(tok))) {
      noteMatch(area.label, (area.preset ? PRESET_PHRASE_POINTS : PHRASE_POINTS) + area.tokens.length);
      continue;
    }
    let hits = 0;
    for (const tok of area.tokens) {
      if (tok.length >= 4 && inputTokens.has(tok)) hits += 1;
    }
    if (hits > 0) noteMatch(area.label, Math.min(hits, 2) * (area.preset ? PRESET_WORD_POINTS : WORD_POINTS));
  }

  // Synonym bridge — each typed word explains at most one area well, and the
  // bridged total is capped, so synonyms can support a match but not invent one.
  let bridged = 0;
  for (const tok of inputTokens) {
    const synonyms = SYNONYMS[tok];
    if (!synonyms) continue;
    const expanded = new Set<string>();
    for (const syn of synonyms) for (const t of tokenize(syn)) expanded.add(t);

    let best: { label: string; points: number } | null = null;
    for (const syn of synonyms) {
      const area = areaByKey.get(syn.toLowerCase());
      if (area && !matchedKeys.has(area.label.toLowerCase())) {
        best = { label: area.label, points: BRIDGE_FULL_POINTS };
        break;
      }
    }
    if (!best) {
      for (const area of areas) {
        if (matchedKeys.has(area.label.toLowerCase())) continue;
        if (area.tokens.some((t) => t.length >= 4 && expanded.has(t))) {
          best = { label: area.label, points: BRIDGE_PART_POINTS };
          break;
        }
      }
    }
    if (best && bridged < BRIDGE_CAP) {
      const points = Math.min(best.points, BRIDGE_CAP - bridged);
      bridged += points;
      noteMatch(best.label, points);
    }
  }

  // The companion's own name, typed plainly, is a match like any other.
  const nameTokens = tokenize(persona.name.replace(/^St\.\s*/i, ''));
  if (nameTokens.some((tok) => inputTokens.has(tok))) {
    score += 3;
    if (matched.length === 0) matched.push(persona.tagline);
  }

  if (score === 0) return null;

  const whyAreas = matched.slice(0, 3).join(' · ').toLowerCase();
  return {
    persona,
    score,
    matchedAreas: matched,
    reason: whyAreas
      ? `${persona.name} speaks to ${whyAreas} — ${persona.tagline.charAt(0).toLowerCase()}${persona.tagline.slice(1)}.`
      : `${persona.name} — ${persona.tagline}.`,
  };
}

/**
 * Score a typed need against a cast. Returns up to `limit` matches, best first;
 * an empty array means nothing matched, and the caller shows the whole cast.
 */
export function matchCompanionsByNeed(need: string, cast: Persona[], limit = 3): CompanionMatch[] {
  if (need.trim().length < 3) return [];
  const inputTokens = new Set(tokenize(need));
  return cast
    .map((persona) => scorePersona(inputTokens, persona))
    .filter((m): m is CompanionMatch => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
