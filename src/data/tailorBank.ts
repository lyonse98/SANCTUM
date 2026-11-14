/**
 * The Tailor Today banks (Erik's approval, Nov 12, 2026): the need-matched passage
 * and the media card for a personalized devotional. CURATED, never generated — a
 * passage is *selected* from this file by the user's stated state and focus, and
 * the media pick is a real, well-known work of pop culture (a song, a talk,
 * an interview) presented as title + creator with its own page's address —
 * every bank address verified live when curated, never embedded media. If a
 * need is not in the bank, the bank is extended by a human, not by the model.
 *
 * Passage texts are Douay-Rheims (public domain), the translation the app falls
 * back to for the books the World English Bible lacks; each entry carries its
 * citation so the devotional can name what it reads.
 *
 * This file is deliberately import-free and self-contained: it is single-sourced
 * VERBATIM into supabase/functions/tailor-devotional/tailorBank.ts by
 * scripts/sync-tailor.mjs, so the client (labels) and the server (selection) can
 * never carry different banks. Edit here, then run `npm run sync:tailor`.
 */

export type TailorState = 'steady' | 'anxious' | 'down' | 'angry' | 'grateful' | 'numb' | 'scattered';

export type TailorFocus =
  | 'work'
  | 'marriage'
  | 'family'
  | 'conversation'
  | 'grief'
  | 'temptation'
  | 'decision'
  | 'today';

export interface TailorOption {
  id: TailorState | TailorFocus;
  label: string;
}

/** "How are you coming in?" — the exact list, the same on both tracks. */
export const TAILOR_STATES: { id: TailorState; label: string }[] = [
  { id: 'steady', label: 'Steady' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'down', label: 'Down' },
  { id: 'angry', label: 'Angry' },
  { id: 'grateful', label: 'Grateful' },
  { id: 'numb', label: 'Numb' },
  { id: 'scattered', label: 'Scattered' },
];

/**
 * "What's today about?" — worded so nothing is assumed about the user's life:
 * "family & children" rather than fatherhood or motherhood, on both tracks.
 */
export const TAILOR_FOCUSES: { id: TailorFocus; label: string }[] = [
  { id: 'work', label: 'Work & career' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'family', label: 'Family & children' },
  { id: 'conversation', label: 'A hard conversation' },
  { id: 'grief', label: 'Grief' },
  { id: 'temptation', label: 'Temptation' },
  { id: 'decision', label: 'A decision' },
  { id: 'today', label: 'Just today' },
];

export function isTailorState(value: unknown): value is TailorState {
  return typeof value === 'string' && TAILOR_STATES.some((s) => s.id === value);
}

export function isTailorFocus(value: unknown): value is TailorFocus {
  return typeof value === 'string' && TAILOR_FOCUSES.some((f) => f.id === value);
}

export function tailorStateLabel(id: TailorState): string {
  return TAILOR_STATES.find((s) => s.id === id)?.label ?? id;
}

export function tailorFocusLabel(id: TailorFocus): string {
  return TAILOR_FOCUSES.find((f) => f.id === id)?.label ?? id;
}

/**
 * "What do you want from God today?" — the tone of the ask (Erik, Nov 13, 2026).
 * The same grief needs a different devotional depending on whether the person
 * wants to be held or wants to get up: comfort and consolation receive,
 * courage and challenge move, clarity untangles. One list, both tracks; the
 * daily intake asks it fresh each morning, and the standing profile carries a
 * default so most mornings it is already answered.
 */
export type TailorTone = 'comfort' | 'courage' | 'challenge' | 'clarity' | 'consolation';

export const TAILOR_TONES: { id: TailorTone; label: string }[] = [
  { id: 'comfort', label: 'Comfort' },
  { id: 'courage', label: 'Courage' },
  { id: 'challenge', label: 'A challenge' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'consolation', label: 'Consolation' },
];

export function isTailorTone(value: unknown): value is TailorTone {
  return typeof value === 'string' && TAILOR_TONES.some((t) => t.id === value);
}

export function tailorToneLabel(id: TailorTone): string {
  return TAILOR_TONES.find((t) => t.id === id)?.label ?? id;
}

/**
 * The media kinds a LIVE search may go and find (Tailor v2, Nov 13, 2026) —
 * broader than the curated bank's own four types, because the web holds more
 * than the bank can: a video, an article, a book. The standing profile's media
 * preferences are chosen from this same list, so what a user asks for and
 * what the search may return are one vocabulary on both sides of the wire.
 */
export type TailorSearchKind = 'song' | 'video' | 'talk' | 'podcast' | 'article' | 'book';

export const TAILOR_SEARCH_KINDS: TailorSearchKind[] = ['song', 'video', 'talk', 'podcast', 'article', 'book'];

export const TAILOR_SEARCH_KIND_LABELS: Record<TailorSearchKind, string> = {
  song: 'Song',
  video: 'Video',
  talk: 'Talk',
  podcast: 'Podcast',
  article: 'Article',
  book: 'Book',
};

export function isTailorSearchKind(value: unknown): value is TailorSearchKind {
  return typeof value === 'string' && (TAILOR_SEARCH_KINDS as string[]).includes(value);
}

/** Every kind a media pick on the card can carry: the bank's four, or a found kind. */
export type TailorMediaKind = TailorMediaType | 'video' | 'article' | 'book';

export interface TailorPassage {
  citation: string;
  text: string;
  translation: string;
}

const DR = 'Douay-Rheims';

export const PASSAGES_BY_FOCUS: Record<TailorFocus, TailorPassage[]> = {
  work: [
    {
      citation: 'Colossians 3:23',
      text: 'Whatsoever you do, do it from the heart, as to the Lord, and not to men.',
      translation: DR,
    },
    {
      citation: '1 Corinthians 15:58',
      text: 'Therefore, my beloved brethren, be ye steadfast and unmoveable; always abounding in the work of the Lord, knowing that your labour is not in vain in the Lord.',
      translation: DR,
    },
  ],
  marriage: [
    {
      citation: 'Ephesians 5:25',
      text: 'Husbands, love your wives, as Christ also loved the church, and delivered himself up for it.',
      translation: DR,
    },
    {
      citation: 'Genesis 2:24',
      text: 'Wherefore a man shall leave father and mother, and shall cleave to his wife: and they shall be two in one flesh.',
      translation: DR,
    },
  ],
  family: [
    {
      citation: 'Joshua 24:15',
      text: 'But if it seem evil to you to serve the Lord, you have your choice: choose this day that which pleaseth you, whom you would rather serve... but as for me and my house, we will serve the Lord.',
      translation: DR,
    },
    {
      citation: 'Deuteronomy 6:6-7',
      text: 'And these words which I command thee this day, shall be in thy heart: and thou shalt tell them to thy children, and thou shalt meditate upon them sitting in thy house, and walking on thy journey, sleeping and rising.',
      translation: DR,
    },
  ],
  conversation: [
    {
      citation: 'James 1:19',
      text: 'Wherefore, my dearly beloved brethren, let every man be swift to hear, but slow to speak, and slow to anger.',
      translation: DR,
    },
    {
      citation: 'Proverbs 15:1',
      text: 'A mild answer breaketh wrath: but a harsh word stirreth up fury.',
      translation: DR,
    },
  ],
  grief: [
    {
      citation: 'John 11:35',
      text: 'And Jesus wept.',
      translation: DR,
    },
    {
      citation: 'Lamentations 3:22-23',
      text: 'The mercies of the Lord that we are not consumed: because his commiserations have not failed. They are new every morning: great is thy faithfulness.',
      translation: DR,
    },
  ],
  temptation: [
    {
      citation: '1 Corinthians 10:13',
      text: 'Let no temptation take hold on you, but such as is human. And God is faithful, who will not suffer you to be tempted above that which you are able: but will make also with temptation issue, that you may be able to bear it.',
      translation: DR,
    },
    {
      citation: 'Hebrews 4:15',
      text: 'For we have not a high priest, who can not have compassion on our infirmities: but one tempted in all things like as we are, without sin.',
      translation: DR,
    },
  ],
  decision: [
    {
      citation: 'Proverbs 3:5-6',
      text: 'Have confidence in the Lord with all thy heart, and lean not upon thy own prudence. In all thy ways think on him, and he will direct thy steps.',
      translation: DR,
    },
    {
      citation: 'James 1:5',
      text: 'But if any of you want wisdom, let him ask of God, who giveth to all men abundantly, and upbraideth not; and it shall be given him.',
      translation: DR,
    },
  ],
  today: [
    {
      citation: 'Matthew 6:34',
      text: 'Be not therefore solicitous for tomorrow; for the morrow will be solicitous for itself. Sufficient for the day is the evil thereof.',
      translation: DR,
    },
    {
      citation: 'Psalm 118:24',
      text: 'This is the day which the Lord hath made: let us be glad and rejoice therein.',
      translation: DR,
    },
  ],
};

export const PASSAGES_BY_STATE: Record<TailorState, TailorPassage[]> = {
  steady: [
    {
      citation: 'Philippians 4:7',
      text: 'And the peace of God, which surpasseth all understanding, keep your hearts and minds in Christ Jesus.',
      translation: DR,
    },
    {
      citation: 'Isaiah 40:31',
      text: 'But they that hope in the Lord shall renew their strength, they shall take wings as eagles, they shall run and not be weary, they shall walk and not faint.',
      translation: DR,
    },
  ],
  anxious: [
    {
      citation: 'Philippians 4:6',
      text: 'Be nothing solicitous; but in every thing, by prayer and supplication, with thanksgiving, let your petitions be made known to God.',
      translation: DR,
    },
    {
      citation: 'Matthew 11:28',
      text: 'Come to me, all you that labour, and are burdened, and I will refresh you.',
      translation: DR,
    },
  ],
  down: [
    {
      citation: 'Psalm 42:11',
      text: 'Why art thou sad, O my soul? and why dost thou trouble me? Hope in God, for I will still give praise to him: the salvation of my countenance, and my God.',
      translation: DR,
    },
    {
      citation: 'Romans 15:13',
      text: 'Now the God of hope fill you with all joy and peace in believing; that you may abound in hope, and in the power of the Holy Ghost.',
      translation: DR,
    },
  ],
  angry: [
    {
      citation: 'Ephesians 4:26',
      text: 'Be angry, and sin not. Let not the sun go down upon your anger.',
      translation: DR,
    },
    {
      citation: 'James 1:20',
      text: 'For the anger of man worketh not the justice of God.',
      translation: DR,
    },
  ],
  grateful: [
    {
      citation: '1 Thessalonians 5:18',
      text: 'In all things give thanks; for this is the will of God in Christ Jesus concerning you all.',
      translation: DR,
    },
    {
      citation: 'Colossians 3:17',
      text: 'And whatsoever you do in word or in work, do all in the name of the Lord Jesus Christ, giving thanks to God and the Father by him.',
      translation: DR,
    },
  ],
  numb: [
    {
      citation: 'Psalm 51:12',
      text: 'Restore unto me the joy of thy salvation, and strengthen me with a perfect spirit.',
      translation: DR,
    },
    {
      citation: 'Ezekiel 36:26',
      text: 'And I will give you a new heart, and put a new spirit within you: and I will take away the stony heart out of your flesh, and will give you a heart of flesh.',
      translation: DR,
    },
  ],
  scattered: [
    {
      citation: 'Matthew 6:33',
      text: 'Seek ye therefore first the kingdom of God, and his justice, and all these things shall be added unto you.',
      translation: DR,
    },
    {
      citation: '1 Corinthians 14:33',
      text: 'For God is not the God of dissension, but of peace: as also I teach in all the churches of the saints.',
      translation: DR,
    },
  ],
};

/**
 * Selects the day's passage for one user's need. The pool is the focus bank
 * first (what today is about leads), then the state bank (how he or she is
 * coming in) — the pick rotates by date so the same need on a different day
 * does not always land on the same verse. Deterministic: the same
 * (focus, state, date) always selects the same passage, on client and server
 * alike, because both run this file.
 */
export function pickPassage(focus: TailorFocus, state: TailorState, dateISO: string): TailorPassage {
  const pool = [...PASSAGES_BY_FOCUS[focus], ...PASSAGES_BY_STATE[state]];
  let hash = 0;
  const seed = `${dateISO}|${focus}|${state}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export type TailorMediaType = 'song' | 'film' | 'podcast' | 'talk';

export interface TailorMedia {
  type: TailorMediaType;
  title: string;
  creator: string;
  /** The work's own page — a direct address, verified live when curated. */
  url: string;
  /** One line on what the work is and why it can answer a morning. */
  blurb: string;
  /** States the work answers — the fallback pick's tag-fit scoring reads these. */
  states: TailorState[];
  /** Tones the work answers. */
  tones: TailorTone[];
}

/**
 * The media bank — RE-CURATED Nov 13, 2026 at Erik's direction: POP CULTURE,
 * not church content. The tradition quote carries the sacred register; this
 * card is the worldly voice answering the day — a David Goggins interview,
 * a Linkin Park song, a TED talk, a commencement address. No worship music,
 * no hymns, no sermons, no church or ministry podcasts: none are in the
 * bank, and the live-search path hard-excludes them before scoring.
 *
 * Every entry is a real, well-known work, and every URL is the work's own
 * YouTube page, VERIFIED LIVE at curation time through YouTube's oEmbed
 * endpoint (the endpoint answered success for the exact address, with the
 * work's own title and channel). A shorter bank of real links beats a long
 * one with dead ones — anything that stops verifying gets dropped, never
 * replaced by a search URL or an address from memory.
 */
export const MEDIA_BY_FOCUS: Record<TailorFocus, TailorMedia[]> = {
  work: [
    {
      type: 'podcast',
      title: 'Joe Rogan Experience, Episode 1080 — David Goggins',
      creator: 'David Goggins with Joe Rogan',
      url: 'https://www.youtube.com/watch?v=5tSTk1083VY',
      blurb: 'Goggins tells how a man rebuilds himself from nothing — the accountability mirror, and showing up on the days it is hardest.',
      states: ['down', 'scattered', 'angry'],
      tones: ['challenge', 'courage'],
    },
    {
      type: 'song',
      title: 'Hall of Fame',
      creator: 'The Script feat. will.i.am',
      url: 'https://www.youtube.com/watch?v=mk48xRzuNvA',
      blurb: 'A mainstream anthem about doing the unglamorous work, day after day, until the world knows your name.',
      states: ['down', 'scattered', 'steady'],
      tones: ['courage', 'challenge'],
    },
  ],
  marriage: [
    {
      type: 'song',
      title: 'All of Me',
      creator: 'John Legend',
      url: 'https://www.youtube.com/watch?v=450p7goxZqg',
      blurb: 'Legend gives all of himself, imperfections included — the shape of a vow, sung plain.',
      states: ['grateful', 'steady', 'down'],
      tones: ['comfort', 'consolation'],
    },
    {
      type: 'song',
      title: 'Thinking Out Loud',
      creator: 'Ed Sheeran',
      url: 'https://www.youtube.com/watch?v=lp-EO5I60KA',
      blurb: 'Loving someone at seventy the way you love them now — a marriage measured in decades, not moments.',
      states: ['grateful', 'steady'],
      tones: ['comfort', 'consolation'],
    },
  ],
  family: [
    {
      type: 'song',
      title: 'Count on Me',
      creator: 'Bruno Mars',
      url: 'https://www.youtube.com/watch?v=6k8cpUkKK4c',
      blurb: '“You can count on me” — the simple promise every home quietly runs on.',
      states: ['grateful', 'steady', 'anxious'],
      tones: ['comfort', 'courage'],
    },
    {
      type: 'song',
      title: 'Counting Stars',
      creator: 'OneRepublic',
      url: 'https://www.youtube.com/watch?v=hT_nvWreIhg',
      blurb: 'A man awake at night, dreaming bigger than his paycheck for the people he loves.',
      states: ['anxious', 'down', 'scattered'],
      tones: ['courage', 'clarity'],
    },
  ],
  conversation: [
    {
      type: 'talk',
      title: 'The Power of Vulnerability',
      creator: 'Brené Brown (TED)',
      url: 'https://www.youtube.com/watch?v=iCvmsMzlF7o',
      blurb: 'Brown’s famous TED talk: real connection begins exactly where pretending ends.',
      states: ['anxious', 'angry', 'numb'],
      tones: ['clarity', 'courage', 'comfort'],
    },
    {
      type: 'talk',
      title: '10 Ways to Have a Better Conversation',
      creator: 'Celeste Headlee (TED)',
      url: 'https://www.youtube.com/watch?v=R1vskiVDwl4',
      blurb: 'A radio host’s ten rules for the talk you are dreading — listen first, be brief, be interested.',
      states: ['scattered', 'angry', 'anxious'],
      tones: ['clarity', 'challenge'],
    },
  ],
  grief: [
    {
      type: 'song',
      title: 'Fix You',
      creator: 'Coldplay',
      url: 'https://www.youtube.com/watch?v=k4V3Mo61fJM',
      blurb: 'For the one who tried their best and it was not enough — lights will guide you home.',
      states: ['down', 'numb'],
      tones: ['consolation', 'comfort'],
    },
    {
      type: 'song',
      title: 'See You Again',
      creator: 'Wiz Khalifa feat. Charlie Puth',
      url: 'https://www.youtube.com/watch?v=RgKAFK5djSk',
      blurb: 'Written for Paul Walker: grief that ends in reunion, not in despair.',
      states: ['down', 'grateful'],
      tones: ['consolation', 'comfort'],
    },
  ],
  temptation: [
    {
      type: 'song',
      title: 'Demons',
      creator: 'Imagine Dragons',
      url: 'https://www.youtube.com/watch?v=mWRsgZuwf_8',
      blurb: 'Naming the demons out loud instead of feeding them in the dark.',
      states: ['angry', 'down', 'numb'],
      tones: ['challenge', 'clarity'],
    },
    {
      type: 'song',
      title: 'Numb',
      creator: 'Linkin Park',
      url: 'https://www.youtube.com/watch?v=kXYiU_JCYtU',
      blurb: 'The sound of feeling nothing under everyone else’s expectations — and refusing to stay there.',
      states: ['numb', 'down', 'angry'],
      tones: ['challenge', 'courage'],
    },
  ],
  decision: [
    {
      type: 'talk',
      title: 'Make Your Bed — UT Austin Commencement Address',
      creator: 'Admiral William H. McRaven',
      url: 'https://www.youtube.com/watch?v=pxBQLFLei70',
      blurb: 'A Navy SEAL admiral’s ten lessons: start with one small thing done right, and never ring the bell.',
      states: ['scattered', 'anxious', 'down'],
      tones: ['clarity', 'courage', 'challenge'],
    },
    {
      type: 'song',
      title: 'Unwritten',
      creator: 'Natasha Bedingfield',
      url: 'https://www.youtube.com/watch?v=b7k0a5hYnSI',
      blurb: '“The rest is still unwritten” — a blank page taken as an invitation, not a threat.',
      states: ['scattered', 'anxious', 'steady'],
      tones: ['courage', 'clarity'],
    },
  ],
  today: [
    {
      type: 'song',
      title: 'Here Comes the Sun',
      creator: 'The Beatles',
      url: 'https://www.youtube.com/watch?v=KQetemT1sWc',
      blurb: 'Harrison’s sunrise after a long, cold winter — this day, received as a gift.',
      states: ['grateful', 'steady', 'down'],
      tones: ['comfort', 'consolation'],
    },
    {
      type: 'song',
      title: 'Three Little Birds',
      creator: 'Bob Marley & The Wailers',
      url: 'https://www.youtube.com/watch?v=HNBCVM4KbUM',
      blurb: '“Don’t worry about a thing” — the day’s worry answered in three minutes flat.',
      states: ['anxious', 'steady', 'scattered'],
      tones: ['comfort', 'courage'],
    },
  ],
};

/**
 * The fallback pick's local scoring — the live rubric's shape, computed from
 * tags instead of a model call (weights mirror the rubric in tailorCore):
 *   thematic fit /40 — the entry sits in the day's focus bank (16), and its
 *     tags name the morning's state (14) and tone (10);
 *   reflection thrust /25 — the bank's blurbs were written to the states
 *     they serve, so a state tag earns the full thrust weight, else 10;
 *   recognizability /20 — every bank entry is mainstream by curation: 20;
 *   format /15 — a song or a talk opens cleanly from a devotional (15);
 *     a full podcast episode asks more of the morning (10).
 */
export function scoreBankMedia(
  media: TailorMedia,
  state: TailorState,
  tone: TailorTone | null,
): number {
  const stateHit = media.states.includes(state);
  const toneHit = tone !== null && media.tones.includes(tone);
  let score = 16 + 20 + (media.type === 'podcast' ? 10 : 15);
  score += stateHit ? 14 + 25 : 10;
  score += toneHit ? 10 : 0;
  return score;
}

/**
 * The day's media pick from the bank: the tag-fit winner for the morning's
 * state and tone, ties broken by the date rotation so the same need on a
 * different day does not always land on the same work. Deterministic — the
 * same (focus, state, tone, date) always selects the same entry.
 */
export function pickMedia(
  focus: TailorFocus,
  state: TailorState,
  tone: TailorTone | null,
  dateISO: string,
): TailorMedia {
  const bank = MEDIA_BY_FOCUS[focus];
  const scored = bank.map((m) => ({ m, score: scoreBankMedia(m, state, tone) }));
  const best = Math.max(...scored.map((s) => s.score));
  const pool = scored.filter((s) => s.score === best).map((s) => s.m);
  let hash = 0;
  const seed = `${dateISO}|media|${focus}|${state}|${tone ?? ''}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
