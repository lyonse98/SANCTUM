import { personasForAudience } from '@/personas';
import type { Audience, Persona, PersonaId } from '@/types';

/**
 * The Help Me Choose quiz engine (deepened, Erik, Nov 19, 2026).
 *
 * Before: three questions — what brings you (the carrying), how you
 * process, what you need (understood / challenged / steadied / taught) —
 * answered by a hand-authored table of exact keys, with a per-carrying
 * fallback for the combinations the table does not hold.
 *
 * Now: four questions. The carrying question stands verbatim — it works,
 * and its options already ARE what a person is carrying. The need
 * question is re-cut in Erik's four words — comfort / challenge /
 * company / wisdom — and a fourth question asks how you like to be
 * spoken to: gently, or directly. The process question stands between
 * them, as it always has.
 *
 * The engine keeps the hand-authored tables as its first court: Erik's
 * need words translate onto the table's older ones (comfort →
 * understood, challenge → challenged, company → steadied, wisdom →
 * taught), and an exact key still wins outright, with its authored
 * reason. For the combinations the table never held, the engine scores
 * the cast by affinity — the tables inverted, so a companion's declared
 * ground is read off the curation itself — with the spoken-to answer
 * counting beside the rest, ties going to the old per-carrying fallback
 * companion, then to cast order. Deterministic throughout: the same
 * answers always name the same companion.
 *
 * Every recommendation carries a one-line why, composed from the
 * answers and the companion's own data — the carrying named, the need
 * named, the companion's manner named, and her (or his) own tagline
 * from the persona bank to close it.
 */

export type QuizNeed = 'comfort' | 'challenge' | 'company' | 'wisdom';
export type QuizVoice = 'gentle' | 'direct';

export interface QuizAnswers {
  brings: string;
  need: QuizNeed;
  process: string;
  voice: QuizVoice;
}

export interface QuizQuestion {
  id: 'brings' | 'need' | 'process' | 'voice';
  prompt: string;
  options: { label: string; value: string }[];
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'brings',
    prompt: 'What brings you here?',
    options: [
      { label: "I'm overwhelmed", value: 'overwhelmed' },
      { label: 'I keep failing', value: 'failing' },
      { label: "I'm restless", value: 'restless' },
      { label: 'I need direction', value: 'direction' },
      { label: "I'm buried in responsibility", value: 'responsibility' },
      { label: 'My marriage or family', value: 'marriage' },
    ],
  },
  {
    id: 'need',
    prompt: 'What do you most need right now?',
    options: [
      { label: 'Comfort — to be heard and held', value: 'comfort' },
      { label: 'A challenge — to be pushed', value: 'challenge' },
      { label: 'Company — someone to sit with me', value: 'company' },
      { label: 'Wisdom — to be taught', value: 'wisdom' },
    ],
  },
  {
    id: 'process',
    prompt: 'How do you process things?',
    options: [
      { label: 'In my head', value: 'head' },
      { label: 'Through emotion', value: 'emotion' },
      { label: 'Through action', value: 'action' },
      { label: 'Through discipline', value: 'discipline' },
    ],
  },
  {
    id: 'voice',
    prompt: 'How do you like to be spoken to?',
    options: [
      { label: 'Gently', value: 'gentle' },
      { label: 'Directly', value: 'direct' },
    ],
  },
];

/** Erik's need words, translated onto the vocabulary the tables were authored in. */
export const NEED_TO_LEGACY: Record<QuizNeed, string> = {
  comfort: 'understood',
  challenge: 'challenged',
  company: 'steadied',
  wisdom: 'taught',
};

/**
 * Each companion's manner, as the app itself already portrays it — the
 * direct ones name the thing plainly (Catherine, Paul, Joan, Ignatius,
 * Moses, Peter, Teresa); the gentle ones sit down beside you first.
 * The spoken-to answer counts in the scoring below, and the why-line
 * names the recommended companion's own manner, never a promised one.
 */
export const COMPANION_VOICE: Record<PersonaId, QuizVoice> = {
  joseph: 'gentle',
  david: 'gentle',
  paul: 'direct',
  augustine: 'gentle',
  ignatius: 'direct',
  peter: 'direct',
  moses: 'direct',
  therese: 'gentle',
  mary: 'gentle',
  magdalene: 'gentle',
  teresa: 'direct',
  catherine: 'direct',
  monica: 'gentle',
  joan: 'direct',
  clare: 'gentle',
  'therese-women': 'gentle',
};

const RECOMMENDATIONS: Record<string, { personaId: string; reason: string }> = {
  'overwhelmed-head-taught': { personaId: 'ignatius', reason: 'Ignatius is a methodical thinker who helps you find God in the chaos. He will not give you airy answers — he sends you into prayer with a concrete question and helps you weigh what comes back.' },
  'overwhelmed-emotion-understood': { personaId: 'david', reason: 'David knows the whole of a man\'s emotional life — anger, fear, grief, shame — without flinching. He will not shame you for what you feel. He will teach you to pour it out before God like a psalm.' },
  'overwhelmed-action-steadied': { personaId: 'joseph', reason: 'Joseph carried a household through chaos without anyone writing it down. He trusts the body first — work, sleep, food, the feel of wood in the hands. When you are spiraling, he sends you to your hands before your head.' },
  'overwhelmed-discipline-challenged': { personaId: 'moses', reason: 'Moses burned out leading a million complainers through a desert for forty years. His father-in-law had to tell him to delegate. He knows what it is to be exhausted, angry, and ready to quit — and he will help you find the next step without quitting.' },
  'failing-emotion-understood': { personaId: 'peter', reason: 'Peter swore he would never fall and denied Christ three times. He sits with a man who has failed because he has been there, and he knows the look Jesus gave him across that fire. The story is not over.' },
  'failing-action-challenged': { personaId: 'peter', reason: 'Peter is the man who cut off the ear, jumped out of the boat, said "not me, Lord." He understands impulsivity and failure. He will not let you hide from your brothers, but he will not let you stay down.' },
  'failing-discipline-challenged': { personaId: 'paul', reason: 'Paul was the persecutor turned apostle. He knows what it is to become someone entirely new. He will challenge passivity and comfort, but always grounded in grace — never crushing the wounded.' },
  'failing-head-taught': { personaId: 'augustine', reason: 'Augustine spent years doing the thing he hated and praying for the virtue he was afraid to receive. He knows the divided will. He will not moralize at you — he has been there, for years.' },
  'restless-head-taught': { personaId: 'augustine', reason: 'Augustine chased pleasure, prestige, and truth for thirty years and found them all wanting. "Our heart is restless until it rests in You." He speaks to the man whose mind will not stop and whose will will not hold.' },
  'restless-emotion-understood': { personaId: 'david', reason: 'David is passionate, raw, and honest. He chased and fell and rose through tears. He will help you bring your restlessness before God as worship — not as a problem to solve, but as a psalm to pray.' },
  'restless-action-challenged': { personaId: 'paul', reason: 'Paul channeled his restless energy into the race. He will help you redirect your drive from chasing to running — "I have fought the good fight, I have finished the race."' },
  'restless-discipline-steadied': { personaId: 'ignatius', reason: 'Ignatius was a man of ambition and vanity before a cannonball stopped him. He does not crush a man\'s drive — he redirects it. He will help you sort ambition from vanity and find the greater glory.' },
  'direction-head-taught': { personaId: 'ignatius', reason: 'Ignatius gave the Church the Spiritual Exercises — the art of discerning God\'s will. He teaches you to read the movements of your own heart like a general reads terrain. He will send you into prayer with a concrete question.' },
  'direction-emotion-understood': { personaId: 'david', reason: 'David is the warrior-poet who learned to listen. He will help you bring your desires before God honestly and trust the tug of the heart when it is grounded in faith.' },
  'direction-action-steadied': { personaId: 'joseph', reason: 'Joseph trusted dreams. God spoke to him four times in the night. He will help you trust the nudge, the instinct, the pull — and act on it with steady hands.' },
  'direction-discipline-challenged': { personaId: 'ignatius', reason: 'Ignatius discerned his vocation from a sickbed. He will give you concrete steps — pray this passage, make the examen, write down where you felt consolation. He trusts that God speaks in the doing.' },
  'responsibility-head-steadied': { personaId: 'joseph', reason: 'Joseph carried the weight of the Holy Family without recognition. He knows what it is to lead a household through chaos. He will steady you and send you to the work in front of you.' },
  'responsibility-emotion-understood': { personaId: 'moses', reason: 'Moses never wanted the job. He argued with God at the burning bush, begged Him to send someone else, and then carried the people anyway. He understands the weight of responsibility you did not ask for — and the anger that comes with it.' },
  'responsibility-action-steadied': { personaId: 'joseph', reason: 'Joseph is the craftsman. He trusts the body: work, sleep, food. When you are buried, he sends you to your hands before your head. One concrete step at a time.' },
  'responsibility-discipline-challenged': { personaId: 'paul', reason: 'Paul endured shipwrecks, prisons, and beatings — and kept running. He will challenge you to endure, but he will also remind you that grace is sufficient. You do not have to bootstrap this.' },
  'marriage-head-taught': { personaId: 'therese', reason: 'Thérèse grew up inside the only marriage the Church has ever canonized — Louis and Zélie Martin, nine children, a business, and daily prayer. She will help you see what the small daily kindnesses in your marriage are actually building.' },
  'marriage-emotion-understood': { personaId: 'therese', reason: 'Thérèse loved her sisters in the cloister when they were difficult, and she says plainly that love is a decision you make with your will — often before your feelings agree. She will not tell you to feel differently. She will show you what to do next.' },
  'marriage-action-steadied': { personaId: 'therese', reason: 'Thérèse taught the Little Way: greatness is not in the great deed but in the small one done with love. She will give you one small, doable thing to do for your wife today — and it will matter more than you think.' },
  'marriage-discipline-challenged': { personaId: 'therese', reason: 'Thérèse never did anything the world would call great. She did a hundred small duties with great love and became a Doctor of the Church. She will hold you to that standard, because she lived it.' },
};

const RECOMMENDATIONS_WOMEN: Record<string, { personaId: string; reason: string }> = {
  'overwhelmed-head-taught': { personaId: 'teresa', reason: 'Teresa mapped the interior life like a castle with seven dwellings — she takes an overwhelmed mind and gives it rooms to walk through, one at a time. Methodical, honest, and never airy.' },
  'overwhelmed-emotion-understood': { personaId: 'magdalene', reason: 'Mary Magdalene stayed at the cross and came weeping to the tomb. She will not hurry your feelings or tidy them up. She knows what it is to love Jesus with your whole heart in the middle of grief.' },
  'overwhelmed-action-steadied': { personaId: 'clare', reason: 'Clare steadied fifty sisters for forty years on almost nothing. When everything feels like too much, she starts with one thing let go of — and the hands empty enough to hold what matters.' },
  'overwhelmed-discipline-challenged': { personaId: 'catherine', reason: 'Catherine of Siena wrote to popes the way other people breathe. She will not let overwhelm become an hiding place — she will hand you the truth and the next faithful step, in that order.' },
  'failing-emotion-understood': { personaId: 'magdalene', reason: 'Magdalene was misjudged for centuries for sins she never committed — and Jesus entrusted her with the first news of Easter anyway. She sits with a woman who has failed or been shamed, and she does not flinch.' },
  'failing-action-challenged': { personaId: 'joan', reason: 'Joan was captured, chained, and tried — and she never stopped answering truthfully. She understands the woman who acts fast and pays for it. She will get you back on your feet and pointed at the real fight.' },
  'failing-discipline-challenged': { personaId: 'catherine', reason: 'Catherine’s most famous sentence is a challenge: be who God meant you to be and you will set the world on fire. She names the failure plainly — and then names the woman underneath it, whom she refuses to give up on.' },
  'failing-head-taught': { personaId: 'teresa', reason: 'Teresa spent twenty years in tepid, distracted prayer before anything changed. She knows the divided heart from the inside, and she teaches — patiently, exactly — how a woman begins again.' },
  'restless-head-taught': { personaId: 'teresa', reason: 'Teresa’s restless mind became the Church’s map of prayer. She will give your thoughts somewhere true to go: dwelling by dwelling, toward the King at the center.' },
  'restless-emotion-understood': { personaId: 'magdalene', reason: 'Magdalene’s restlessness ended at a tomb garden, searching for the one she loved. She understands a heart that will not settle for less than Jesus himself — because hers would not.' },
  'restless-action-challenged': { personaId: 'joan', reason: 'Joan took a peasant girl’s energy and put it entirely at God’s disposal. She will help you aim your drive instead of apologizing for it — once the call is tested, no more shrinking.' },
  'restless-discipline-steadied': { personaId: 'clare', reason: 'Clare redirected a noblewoman’s whole ambition into one small convent and one great love. She knows how restlessness quiets: not by doing less, but by wanting one thing completely.' },
  'direction-head-taught': { personaId: 'teresa', reason: 'Teresa is the Church’s teacher of prayer — how to tell where you are with God, what is dryness, what is growth, what is a trap. Discernment, in her hands, is a craft you can learn.' },
  'direction-emotion-understood': { personaId: 'mary', reason: 'Mary pondered everything in her heart before she understood any of it. If you need direction and your heart is loud, she teaches the older way: keep the things, turn them over, and let God ripen them.' },
  'direction-action-steadied': { personaId: 'joan', reason: 'Joan did not act on a feeling — she let the Church examine her first, then rode. She will steady your hand: test the call, then obey it without theatrics.' },
  'direction-discipline-challenged': { personaId: 'catherine', reason: 'Catherine discerned her vocation in a tiny cell and then walked into the politics of nations. She pairs self-knowledge with obedience — and she will press you on both.' },
  'responsibility-head-steadied': { personaId: 'monica', reason: 'Monica carried a household, a hard marriage, and a lost son for decades — with her mind fixed on God the whole time. She steadies women who carry people: hope as a discipline, not a mood.' },
  'responsibility-emotion-understood': { personaId: 'monica', reason: 'Monica wept in front of a bishop until he answered her. She knows the tears that come with responsibility you did not choose, and she will teach you to make them into prayer instead of despair.' },
  'responsibility-action-steadied': { personaId: 'clare', reason: 'Clare ran a community on prayer and whatever arrived at the door that day. For the woman buried in responsibility, she is relentlessly practical: hold less, trust more, do the next true thing.' },
  'responsibility-discipline-challenged': { personaId: 'catherine', reason: 'Catherine carried the wounds of the whole Church as her own responsibility — and let it make her bolder, not bitter. She will challenge you to carry your load the same way.' },
  'marriage-head-taught': { personaId: 'therese-women', reason: 'Thérèse grew up inside the only marriage the Church has ever canonized — Louis and Zélie Martin, nine children, a business, and daily prayer. She will help you see what the small daily kindnesses in your marriage are actually building.' },
  'marriage-emotion-understood': { personaId: 'therese-women', reason: 'Thérèse loved the sisters who were hardest to love, and she says plainly that love is a decision of the will — often before the feelings agree. She will not tell you to feel differently. She will show you the next small thing.' },
  'marriage-action-steadied': { personaId: 'therese-women', reason: 'Thérèse taught the Little Way: holiness is the small act done with great love. She will give you one small, doable thing to do for your husband today — and it will matter more than you think.' },
  'marriage-discipline-challenged': { personaId: 'therese-women', reason: 'Thérèse never did anything the world calls great. She did a hundred small duties with great love and became a Doctor of the Church. She will hold you to that standard, because she lived it.' },
};

const FALLBACK_WOMEN: Record<string, string> = {
  overwhelmed: 'monica',
  failing: 'magdalene',
  restless: 'teresa',
  direction: 'mary',
  responsibility: 'monica',
  marriage: 'therese-women',
};

const FALLBACK_MEN: Record<string, string> = {
  overwhelmed: 'moses',
  failing: 'peter',
  restless: 'augustine',
  direction: 'ignatius',
  responsibility: 'joseph',
  marriage: 'therese',
};

interface Affinity {
  brings: Set<string>;
  process: Set<string>;
  needs: Set<string>;
}

/**
 * The tables, inverted: for each companion, the ground the curation
 * itself says she (or he) covers — the carryings she answers, the ways
 * of processing she meets, the needs she serves. Read off the authored
 * entries, never re-guessed.
 */
function buildAffinity(table: Record<string, { personaId: string; reason: string }>): Map<string, Affinity> {
  const map = new Map<string, Affinity>();
  for (const [key, rec] of Object.entries(table)) {
    const [brings, process, need] = key.split('-');
    let entry = map.get(rec.personaId);
    if (!entry) {
      entry = { brings: new Set(), process: new Set(), needs: new Set() };
      map.set(rec.personaId, entry);
    }
    entry.brings.add(brings);
    entry.process.add(process);
    entry.needs.add(need);
  }
  return map;
}

const AFFINITY: Record<Audience, Map<string, Affinity>> = {
  men: buildAffinity(RECOMMENDATIONS),
  women: buildAffinity(RECOMMENDATIONS_WOMEN),
};

const CARRYING_PHRASE: Record<string, string> = {
  overwhelmed: "when you're overwhelmed",
  failing: 'when you keep failing',
  restless: 'a restless heart',
  direction: 'when you need direction',
  responsibility: "the weight you're carrying",
  marriage: 'your marriage and family',
};

const NEED_NOUN: Record<QuizNeed, string> = {
  comfort: 'comfort',
  challenge: 'an honest challenge',
  company: 'company',
  wisdom: 'wisdom',
};

/**
 * The one-line why: the carrying named, the companion named, the need
 * she answers and the manner she answers it in — her own, from
 * COMPANION_VOICE — closed with her own tagline from the persona bank.
 */
export function composeWhyLine(persona: Persona, answers: QuizAnswers): string {
  const carrying = CARRYING_PHRASE[answers.brings] ?? 'for what you carry';
  const tagline = `${persona.tagline.charAt(0).toLowerCase()}${persona.tagline.slice(1)}`;
  return `For ${carrying} — ${persona.name}, who brings ${NEED_NOUN[answers.need]} in a ${COMPANION_VOICE[persona.id]} voice — ${tagline}.`;
}

export interface QuizResult {
  persona: Persona;
  /** The one-line why, composed from the answers and the companion's own data. */
  why: string;
  /** The fuller reason: the table's authored paragraph on an exact key, the plain fallback line otherwise. */
  reason: string;
  /** True when the hand-authored table held the exact combination. */
  viaKey: boolean;
}

const BRINGS_POINTS = 3;
const PROCESS_POINTS = 2;
const NEED_POINTS = 2;
const VOICE_POINTS = 2;

export function recommendCompanion(answers: QuizAnswers, audience: Audience): QuizResult {
  const cast = personasForAudience(audience);
  const resolve = (id: string): Persona => cast.find((p) => p.id === id) ?? cast[0];
  const legacyNeed = NEED_TO_LEGACY[answers.need];
  const table = audience === 'women' ? RECOMMENDATIONS_WOMEN : RECOMMENDATIONS;

  // First court: the hand-authored table, on the translated key.
  const exact = table[`${answers.brings}-${answers.process}-${legacyNeed}`];
  if (exact) {
    const persona = resolve(exact.personaId);
    return { persona, why: composeWhyLine(persona, answers), reason: exact.reason, viaKey: true };
  }

  // Second court: affinity scoring over the cast. The old per-carrying
  // fallback companion holds the seat first, so ties go to her (or him),
  // then to cast order — a strictly higher score is the only way past.
  const affinity = AFFINITY[audience];
  const fallbackId = (audience === 'women' ? FALLBACK_WOMEN : FALLBACK_MEN)[answers.brings] ?? cast[0].id;
  const scoreOf = (persona: Persona): number => {
    const entry = affinity.get(persona.id);
    let score = 0;
    if (entry?.brings.has(answers.brings)) score += BRINGS_POINTS;
    if (entry?.process.has(answers.process)) score += PROCESS_POINTS;
    if (entry?.needs.has(legacyNeed)) score += NEED_POINTS;
    if (COMPANION_VOICE[persona.id] === answers.voice) score += VOICE_POINTS;
    return score;
  };
  let best = resolve(fallbackId);
  let bestScore = scoreOf(best);
  for (const persona of cast) {
    const score = scoreOf(persona);
    if (score > bestScore) {
      best = persona;
      bestScore = score;
    }
  }
  return {
    persona: best,
    why: composeWhyLine(best, answers),
    reason: `${best.name} speaks to ${audience === 'women' ? 'women' : 'men'} like you. Read the card and see if the voice fits — you can always switch.`,
    viaKey: false,
  };
}
