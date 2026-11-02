/**
 * The Beatitudes examination for Confession prep — the second lens beside the Ten
 * Commandments. Where the Commandments examine a man from the law side ("where did
 * I break it"), the Beatitudes examine him from the blessing side ("where did I
 * refuse the blessed life"). Same tool, same privacy: everything stays on-device.
 *
 * Verse text follows the translation the app already quotes (see src/data/quotes.ts),
 * with "meek" kept in 5:5 — the word Catholic men know this beatitude by.
 */

export interface Beatitude {
  /** Short name, e.g. "The Poor in Spirit". */
  name: string;
  /** Verse reference, e.g. "Matthew 5:3". */
  ref: string;
  /** The beatitude itself (Matthew 5:3–10). */
  verse: string;
  /** One line framing the examination from the blessing side. */
  framing: string;
  /** Concrete examination questions for a man's actual life. */
  questions: string[];
}

export const BEATITUDES: Beatitude[] = [
  {
    name: 'The Poor in Spirit',
    ref: 'Matthew 5:3',
    verse: 'Blessed are the poor in spirit, for theirs is the Kingdom of Heaven.',
    framing: 'The saint starts empty-handed. Pride is refusing to need God — and refusing to need anyone.',
    questions: [
      'Have I tried to carry everything myself rather than bring it to God in prayer?',
      'Have I hidden my struggles from my wife or my brothers instead of asking for help?',
      'Have I trusted my money, my job, or my own strength more than I trust God?',
    ],
  },
  {
    name: 'Those Who Mourn',
    ref: 'Matthew 5:4',
    verse: 'Blessed are those who mourn, for they shall be comforted.',
    framing: 'Blessed are the men who let sin grieve them instead of going numb to it.',
    questions: [
      'Have I felt real sorrow for my sins — or have I excused, minimized, or laughed them off?',
      'Have I grieved with my wife or my children in their pain, or rushed past it to fix it or avoid it?',
      'Have I stayed numb — scrolling, drinking, staying busy — rather than face what weighs on me?',
    ],
  },
  {
    name: 'The Meek',
    ref: 'Matthew 5:5',
    verse: 'Blessed are the meek, for they shall inherit the earth.',
    framing: 'Meekness is strength under control — power that does not have to prove itself.',
    questions: [
      'Have I lashed out in anger at my wife, my children, or anyone weaker than me?',
      'Have I needed to win every argument, correct every slight, and defend my pride?',
      'Have I spoken harshly, slammed doors, or used silence as a weapon at home?',
    ],
  },
  {
    name: 'Those Who Hunger for Righteousness',
    ref: 'Matthew 5:6',
    verse: 'Blessed are those who hunger and thirst for righteousness, for they shall be satisfied.',
    framing: 'The blessed man is hungry — for God, for holiness, for things set right.',
    questions: [
      'Have I let my prayer life starve while I fed every other appetite?',
      'Have I been lukewarm — content to be a decent man rather than a saint?',
      'Have I seen something wrong at work or at home and stayed silent because silence was easier?',
    ],
  },
  {
    name: 'The Merciful',
    ref: 'Matthew 5:7',
    verse: 'Blessed are the merciful, for they shall obtain mercy.',
    framing: 'The mercy a man receives is measured by the mercy he hands out.',
    questions: [
      'Am I holding a grudge — against my wife, my father, a friend, a man at work?',
      'Have I withheld forgiveness, waiting for the other person to earn it first?',
      'Have I been stingy with my time, my money, or my attention when someone near me was in need?',
    ],
  },
  {
    name: 'The Pure in Heart',
    ref: 'Matthew 5:8',
    verse: 'Blessed are the pure in heart, for they shall see God.',
    framing: 'Purity is a single heart — what a man watches, wants, and worships all pointing one way.',
    questions: [
      'Have I looked at anything — on a screen, in the street, in my memory — that I would hide from my wife?',
      'Have I entertained lustful thoughts instead of cutting them off at the first look?',
      'Have I split my heart’s loyalty — God on Sundays, appetite the rest of the week?',
    ],
  },
  {
    name: 'The Peacemakers',
    ref: 'Matthew 5:9',
    verse: 'Blessed are the peacemakers, for they shall be called children of God.',
    framing: 'A peacemaker walks toward the conflict he has been avoiding, and tells the truth with love.',
    questions: [
      'Is there a rift I keep stepping around — with my wife, my parents, a brother, a friend?',
      'Have I stirred conflict — gossip, sarcasm, taking sides — instead of healing it?',
      'Have I avoided a hard conversation my family needed me to have?',
    ],
  },
  {
    name: 'The Persecuted',
    ref: 'Matthew 5:10',
    verse: 'Blessed are those who have been persecuted for righteousness’ sake, for theirs is the Kingdom of Heaven.',
    framing: 'Blessed is the man who pays a price for doing right, and pays it without bitterness.',
    questions: [
      'Have I hidden my faith — at work, among friends — to stay comfortable and liked?',
      'Have I stayed silent about the truth when speaking up would have cost me something?',
      'Have I grown bitter or self-pitying when doing right brought trouble instead of thanks?',
    ],
  },
];

/** The two examination lenses the Confession tool offers. */
export type ExaminationLens = 'commandments' | 'beatitudes';

export const LENS_STORAGE_KEY = 'sanctum_confession_lens';

/** The remembered lens. Defaults to the Commandments — the classic path. */
export function loadExaminationLens(): ExaminationLens {
  try {
    return localStorage.getItem(LENS_STORAGE_KEY) === 'beatitudes' ? 'beatitudes' : 'commandments';
  } catch {
    return 'commandments';
  }
}

export function saveExaminationLens(lens: ExaminationLens) {
  try {
    localStorage.setItem(LENS_STORAGE_KEY, lens);
  } catch {
    // ignore
  }
}
