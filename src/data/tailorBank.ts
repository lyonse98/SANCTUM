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

/** Every kind a media pick on the card can carry: the catalog's five, or a found kind. */
export type TailorMediaKind = TailorMediaType | 'film' | 'podcast' | 'video' | 'article' | 'book';

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

export type TailorMediaType = 'song' | 'talk' | 'speech' | 'interview' | 'clip';

export interface TailorMedia {
  kind: TailorMediaType;
  title: string;
  creator: string;
  /** The work's own page — a direct address, verified live when curated. */
  url: string;
  /** One line on what the work is and why it can answer a morning. */
  blurb: string;
  /** The morning's focuses this work can answer. */
  focuses: TailorFocus[];
  /** States the work answers. */
  states: TailorState[];
  /** Tones the work answers. */
  tones: TailorTone[];
  /**
   * Popularity 0–100: the work's cultural footprint — chart, streaming, and
   * view-count tier plus longevity. Goggins / Linkin Park tier ≈ 90+; a
   * solid, well-known work ≈ 60–80; niche work sits below.
   */
  popularity: number;
  /**
   * Alignment with Church values 0–100: the work's SUBSTANCE judged
   * morally (Erik, Nov 13, 2026). Perseverance, hope, sacrificial love,
   * courage, honesty about suffering, gratitude, and redemption score
   * high; a message that mocks faith, glorifies vice, or sinks into
   * nihilism scores low. This axis is NOT about whether the work is
   * religious — the catalog is secular pop culture throughout (church
   * content is excluded on a different rule entirely, in tailorCore).
   */
  values: number;
  /** One line naming the virtue or theme that earns the values score. */
  valuesNote: string;
}

/**
 * THE MEDIA SEED (Erik, Nov 13, 2026 — search-primary, ruled mid-build).
 * The media slot's primary source is the LIVE SEARCH: on every build it
 * gathers fresh candidates, which are verified, excluded, and scored on
 * the same three axes as everything here. This seed is the anchor behind
 * that search — the guaranteed fallback when a build's live hunt returns
 * nothing above the floor, and the reliability bench the live winner
 * must beat. It is deliberately NOT a library: 48 evergreen works (the
 * 16 seeds of the first bank plus 32 more), every one scored on the
 * three axes and every address VERIFIED LIVE at curation through
 * YouTube's oEmbed endpoint — the endpoint answered success for the
 * exact address, with the work's own title on a channel plausibly the
 * work's own. Anything that failed verification was dropped, never
 * replaced by an address from memory.
 *
 * Two entries sit BELOW the values floor on purpose (John Lennon's
 * "Imagine", values 30; Hozier's "Take Me to Church", values 35): the
 * floor is only meaningful if it has real, famous, perfectly-fitting
 * works to bite on. They can never be picked — the floor in
 * scoreCatalogMedia is absolute, and the tests pin that no morning ever
 * returns them.
 *
 * GROWTH PATH (built Nov 13, 2026): entries are plain data and all
 * selection flows through scoreCatalogMedia / bestCatalogMedia, so the
 * DB-backed source — winning live picks captured server-side with their
 * axis scores, the self-growing library (media_winners, recorded by the
 * tailor function's outputs module) — joins the same scored pool by
 * merging rows into this shape through bestCatalogMedia's extra-pool
 * parameter; nothing downstream changes. The seed stays evergreen on
 * purpose: it is the anchor the grown library must beat, not a shelf
 * the library replaces.
 */
export const MEDIA_CATALOG: TailorMedia[] = [
  {
    kind: "speech",
    title: "Make Your Bed — UT Austin Commencement Address",
    creator: "Admiral William H. McRaven",
    url: "https://www.youtube.com/watch?v=pxBQLFLei70",
    blurb: "A Navy SEAL admiral's ten lessons: start with one small thing done right, and never ring the bell.",
    focuses: ["decision", "work"],
    states: ["scattered", "anxious", "down"],
    tones: ["clarity", "courage", "challenge"],
    popularity: 92,
    values: 90,
    valuesNote: "Discipline, humility, and perseverance in small duties.",
  },
  {
    kind: "talk",
    title: "The Power of Vulnerability",
    creator: "Brené Brown (TED)",
    url: "https://www.youtube.com/watch?v=iCvmsMzlF7o",
    blurb: "Brown's famous TED talk: real connection begins exactly where pretending ends.",
    focuses: ["conversation"],
    states: ["anxious", "angry", "numb"],
    tones: ["clarity", "courage", "comfort"],
    popularity: 93,
    values: 85,
    valuesNote: "Honesty and vulnerability as the door to love.",
  },
  {
    kind: "talk",
    title: "10 Ways to Have a Better Conversation",
    creator: "Celeste Headlee (TED)",
    url: "https://www.youtube.com/watch?v=R1vskiVDwl4",
    blurb: "A radio host's ten rules for the talk you are dreading — listen first, be brief, be interested.",
    focuses: ["conversation"],
    states: ["scattered", "angry", "anxious"],
    tones: ["clarity", "challenge"],
    popularity: 68,
    values: 80,
    valuesNote: "Listening as charity; presence over performance.",
  },
  {
    kind: "interview",
    title: "Joe Rogan Experience, Episode 1080 — David Goggins",
    creator: "David Goggins with Joe Rogan",
    url: "https://www.youtube.com/watch?v=5tSTk1083VY",
    blurb: "Goggins tells how a man rebuilds himself from nothing — the accountability mirror, and showing up on the hardest days.",
    focuses: ["work", "temptation"],
    states: ["down", "scattered", "angry"],
    tones: ["challenge", "courage"],
    popularity: 94,
    values: 80,
    valuesNote: "Endurance, self-examination, and refusing victimhood.",
  },
  {
    kind: "song",
    title: "Here Comes the Sun",
    creator: "The Beatles",
    url: "https://www.youtube.com/watch?v=KQetemT1sWc",
    blurb: "Harrison's sunrise after a long, cold winter — this day, received as a gift.",
    focuses: ["today"],
    states: ["grateful", "steady", "down"],
    tones: ["comfort", "consolation"],
    popularity: 96,
    values: 80,
    valuesNote: "Hope after a long winter; gratitude for ordinary light.",
  },
  {
    kind: "song",
    title: "See You Again",
    creator: "Wiz Khalifa feat. Charlie Puth",
    url: "https://www.youtube.com/watch?v=RgKAFK5djSk",
    blurb: "Written for Paul Walker: grief that ends in reunion, not in despair.",
    focuses: ["grief"],
    states: ["down", "grateful"],
    tones: ["consolation", "comfort"],
    popularity: 96,
    values: 78,
    valuesNote: "Grief ordered toward reunion and gratitude.",
  },
  {
    kind: "song",
    title: "Thinking Out Loud",
    creator: "Ed Sheeran",
    url: "https://www.youtube.com/watch?v=lp-EO5I60KA",
    blurb: "Loving someone at seventy the way you love them now — a marriage measured in decades, not moments.",
    focuses: ["marriage"],
    states: ["grateful", "steady"],
    tones: ["comfort", "consolation"],
    popularity: 95,
    values: 85,
    valuesNote: "Faithfulness across a whole lifetime.",
  },
  {
    kind: "song",
    title: "All of Me",
    creator: "John Legend",
    url: "https://www.youtube.com/watch?v=450p7goxZqg",
    blurb: "Legend gives all of himself, imperfections included — the shape of a vow, sung plain.",
    focuses: ["marriage"],
    states: ["grateful", "steady", "down"],
    tones: ["comfort", "consolation"],
    popularity: 95,
    values: 85,
    valuesNote: "Total self-gift, flaws included.",
  },
  {
    kind: "song",
    title: "Numb",
    creator: "Linkin Park",
    url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
    blurb: "The sound of feeling nothing under everyone else's expectations — and refusing to stay there.",
    focuses: ["temptation", "family"],
    states: ["numb", "down", "angry"],
    tones: ["challenge", "courage"],
    popularity: 95,
    values: 58,
    valuesNote: "Honest despair that refuses to stay numb.",
  },
  {
    kind: "song",
    title: "Fix You",
    creator: "Coldplay",
    url: "https://www.youtube.com/watch?v=k4V3Mo61fJM",
    blurb: "For the one who tried their best and it was not enough — lights will guide you home.",
    focuses: ["grief"],
    states: ["down", "numb"],
    tones: ["consolation", "comfort"],
    popularity: 94,
    values: 82,
    valuesNote: "Love that stays and repairs what it can.",
  },
  {
    kind: "song",
    title: "Counting Stars",
    creator: "OneRepublic",
    url: "https://www.youtube.com/watch?v=hT_nvWreIhg",
    blurb: "A man awake at night, dreaming bigger than his paycheck for the people he loves.",
    focuses: ["family", "work"],
    states: ["anxious", "down", "scattered"],
    tones: ["courage", "clarity"],
    popularity: 93,
    values: 70,
    valuesNote: "Hope and provision for the household.",
  },
  {
    kind: "song",
    title: "Three Little Birds",
    creator: "Bob Marley & The Wailers",
    url: "https://www.youtube.com/watch?v=HNBCVM4KbUM",
    blurb: "Don't worry about a thing — the day's worry answered in three minutes flat.",
    focuses: ["today"],
    states: ["anxious", "steady", "scattered"],
    tones: ["comfort", "courage"],
    popularity: 90,
    values: 75,
    valuesNote: "Trust over anxiety; every little thing.",
  },
  {
    kind: "song",
    title: "Count on Me",
    creator: "Bruno Mars",
    url: "https://www.youtube.com/watch?v=6k8cpUkKK4c",
    blurb: "You can count on me like one, two, three — the simple promise every home quietly runs on.",
    focuses: ["family"],
    states: ["grateful", "steady", "anxious"],
    tones: ["comfort", "courage"],
    popularity: 90,
    values: 88,
    valuesNote: "Presence guaranteed: family as a kept promise.",
  },
  {
    kind: "song",
    title: "Demons",
    creator: "Imagine Dragons",
    url: "https://www.youtube.com/watch?v=mWRsgZuwf_8",
    blurb: "Naming the demons out loud instead of feeding them in the dark.",
    focuses: ["temptation"],
    states: ["angry", "down", "numb"],
    tones: ["challenge", "clarity"],
    popularity: 90,
    values: 65,
    valuesNote: "Honesty about inner darkness; bringing it into the light.",
  },
  {
    kind: "song",
    title: "Hall of Fame",
    creator: "The Script feat. will.i.am",
    url: "https://www.youtube.com/watch?v=mk48xRzuNvA",
    blurb: "A mainstream anthem about doing the unglamorous work, day after day, until the world knows your name.",
    focuses: ["work"],
    states: ["down", "scattered", "steady"],
    tones: ["courage", "challenge"],
    popularity: 88,
    values: 75,
    valuesNote: "Diligence and earned excellence.",
  },
  {
    kind: "song",
    title: "Unwritten",
    creator: "Natasha Bedingfield",
    url: "https://www.youtube.com/watch?v=b7k0a5hYnSI",
    blurb: "The rest is still unwritten — a blank page taken as an invitation, not a threat.",
    focuses: ["decision", "today"],
    states: ["scattered", "anxious", "steady"],
    tones: ["courage", "clarity"],
    popularity: 80,
    values: 72,
    valuesNote: "Trust toward an unscripted future.",
  },
  {
    kind: "song",
    title: "Imagine",
    creator: "John Lennon",
    url: "https://www.youtube.com/watch?v=YkgkThdzX-8",
    blurb: "Lennon's famous reverie asks for a world with nothing above us and nothing to kill for.",
    focuses: ["today", "decision"],
    states: ["steady", "scattered"],
    tones: ["clarity"],
    popularity: 97,
    values: 30,
    valuesNote: "Below the floor: its peace is built on imagining heaven and faith away.",
  },
  {
    kind: "song",
    title: "Take Me to Church",
    creator: "Hozier",
    url: "https://www.youtube.com/watch?v=PVjiKRfKpPI",
    blurb: "Hozier's fevered metaphor borrows worship's language for a lover's altar.",
    focuses: ["temptation", "marriage"],
    states: ["numb", "down"],
    tones: ["clarity"],
    popularity: 93,
    values: 35,
    valuesNote: "Below the floor: the sacred is used as a metaphor for desire.",
  },
  {
    kind: "speech",
    title: "Stanford Commencement Address (How to Live Before You Die)",
    creator: "Steve Jobs",
    url: "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
    blurb: "Jobs at Stanford: connect the dots looking backward, love what you do, and remember you are mortal.",
    focuses: ["work", "decision"],
    states: ["scattered", "down"],
    tones: ["clarity", "courage"],
    popularity: 95,
    values: 82,
    valuesNote: "Purpose found through vocation and mortality honestly faced.",
  },
  {
    kind: "talk",
    title: "Do Schools Kill Creativity?",
    creator: "Ken Robinson (TED)",
    url: "https://www.youtube.com/watch?v=iG9CE55wbtY",
    blurb: "Robinson argues schools squeeze out the creativity children are born with.",
    focuses: ["family", "work"],
    states: ["scattered", "steady"],
    tones: ["clarity"],
    popularity: 89,
    values: 72,
    valuesNote: "Wonder and the dignity of each child's gifts.",
  },
  {
    kind: "talk",
    title: "Start with Why",
    creator: "Simon Sinek (TED)",
    url: "https://www.youtube.com/watch?v=u4ZoJKF_VuA",
    blurb: "Sinek's golden circle: people don't buy what you do, they buy why you do it.",
    focuses: ["work", "decision"],
    states: ["scattered", "steady"],
    tones: ["clarity"],
    popularity: 86,
    values: 72,
    valuesNote: "Purpose before profit; work with a why.",
  },
  {
    kind: "talk",
    title: "The Last Lecture",
    creator: "Randy Pausch",
    url: "https://www.youtube.com/watch?v=ji5_MqicxSo",
    blurb: "A dying professor's last lecture on achieving your childhood dreams — and living so they can.",
    focuses: ["family", "work"],
    states: ["down", "steady"],
    tones: ["clarity", "comfort"],
    popularity: 90,
    values: 92,
    valuesNote: "Gratitude, honesty, and loving people well to the end.",
  },
  {
    kind: "talk",
    title: "Your Body Language May Shape Who You Are",
    creator: "Amy Cuddy (TED)",
    url: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc",
    blurb: "Cuddy on how posture and presence shape confidence before the big moment.",
    focuses: ["work", "conversation"],
    states: ["anxious", "down"],
    tones: ["courage", "clarity"],
    popularity: 84,
    values: 66,
    valuesNote: "Stewardship of the body God gave you; quiet confidence.",
  },
  {
    kind: "talk",
    title: "Inside the Mind of a Master Procrastinator",
    creator: "Tim Urban (TED)",
    url: "https://www.youtube.com/watch?v=arj7oStGLkU",
    blurb: "A funny, painfully accurate tour inside the procrastinator's mind — and the panic monster that wakes us.",
    focuses: ["work", "temptation"],
    states: ["scattered", "numb"],
    tones: ["clarity", "challenge"],
    popularity: 84,
    values: 72,
    valuesNote: "Self-knowledge and taking time seriously.",
  },
  {
    kind: "talk",
    title: "What Makes a Good Life? Lessons from the Longest Study on Happiness",
    creator: "Robert Waldinger (TED)",
    url: "https://www.youtube.com/watch?v=8KkKuTCFvzI",
    blurb: "Harvard's 75-year happiness study lands on one answer: good relationships keep us healthy and happy.",
    focuses: ["family", "marriage"],
    states: ["steady", "down"],
    tones: ["clarity", "comfort"],
    popularity: 85,
    values: 88,
    valuesNote: "Love of family and friends as life's real wealth.",
  },
  {
    kind: "talk",
    title: "How to Make Stress Your Friend",
    creator: "Kelly McGonigal (TED)",
    url: "https://www.youtube.com/watch?v=RcGyVTAoXEU",
    blurb: "McGonigal reframes stress: the body's strain can be read as readiness, and stress makes us social.",
    focuses: ["work", "today"],
    states: ["anxious", "scattered"],
    tones: ["clarity", "courage"],
    popularity: 78,
    values: 72,
    valuesNote: "Courage under pressure; suffering reinterpreted, not denied.",
  },
  {
    kind: "talk",
    title: "How to Speak So That People Want to Listen",
    creator: "Julian Treasure (TED)",
    url: "https://www.youtube.com/watch?v=eIho2S0ZahI",
    blurb: "A sound expert's rules for speaking so people want to listen — and listening so people feel heard.",
    focuses: ["conversation"],
    states: ["steady", "scattered"],
    tones: ["clarity"],
    popularity: 74,
    values: 72,
    valuesNote: "Speech as a moral act: honesty, kindness, silence.",
  },
  {
    kind: "talk",
    title: "Listening to Shame",
    creator: "Brené Brown (TED)",
    url: "https://www.youtube.com/watch?v=psN1DORYYV0",
    blurb: "Brown on shame: it survives in secrecy and dies when met with empathy.",
    focuses: ["temptation", "conversation"],
    states: ["down", "numb"],
    tones: ["clarity", "comfort"],
    popularity: 80,
    values: 84,
    valuesNote: "Shame answered by compassion, not hiding.",
  },
  {
    kind: "talk",
    title: "The Danger of a Single Story",
    creator: "Chimamanda Ngozi Adichie (TED)",
    url: "https://www.youtube.com/watch?v=D9Ihs241zeg",
    blurb: "Adichie warns what happens when a people is known by only one story.",
    focuses: ["conversation"],
    states: ["steady", "angry"],
    tones: ["clarity"],
    popularity: 79,
    values: 82,
    valuesNote: "Respect for the full dignity of every person and culture.",
  },
  {
    kind: "talk",
    title: "The Power of Introverts",
    creator: "Susan Cain (TED)",
    url: "https://www.youtube.com/watch?v=c0KYU2j0TM4",
    blurb: "Cain makes the case for the quiet half of the world — solitude as strength, not defect.",
    focuses: ["conversation", "work"],
    states: ["anxious", "steady"],
    tones: ["clarity", "comfort"],
    popularity: 80,
    values: 72,
    valuesNote: "Contemplation and the worth of the quiet temperament.",
  },
  {
    kind: "talk",
    title: "The Puzzle of Motivation",
    creator: "Dan Pink (TED)",
    url: "https://www.youtube.com/watch?v=rrkrvAUbU9Y",
    blurb: "Pink shows carrots and sticks fail: autonomy, mastery, and purpose are what move people.",
    focuses: ["work"],
    states: ["steady", "scattered"],
    tones: ["clarity"],
    popularity: 76,
    values: 66,
    valuesNote: "Work ordered to purpose, not mere reward.",
  },
  {
    kind: "talk",
    title: "My Stroke of Insight",
    creator: "Jill Bolte Taylor (TED)",
    url: "https://www.youtube.com/watch?v=UyyjU8fzEYU",
    blurb: "A neuroscientist describes her own stroke — and the peace she found when striving went quiet.",
    focuses: ["today", "grief"],
    states: ["numb", "down"],
    tones: ["clarity", "consolation"],
    popularity: 72,
    values: 66,
    valuesNote: "Stillness, wonder, and the soul beneath achievement.",
  },
  {
    kind: "talk",
    title: "The Happy Secret to Better Work",
    creator: "Shawn Achor (TED)",
    url: "https://www.youtube.com/watch?v=fLJsdqxnZb0",
    blurb: "Achor's argument that happiness fuels success, not the other way around — gratitude first.",
    focuses: ["work"],
    states: ["down", "scattered"],
    tones: ["courage", "clarity"],
    popularity: 76,
    values: 76,
    valuesNote: "Gratitude as a discipline with measurable fruit.",
  },
  {
    kind: "clip",
    title: "The Great Dictator — Final Speech",
    creator: "Charlie Chaplin",
    url: "https://www.youtube.com/watch?v=J7GY1Xg6X20",
    blurb: "Chaplin's dictator turns to the camera and pleads for mercy, brotherhood, and a world without hate.",
    focuses: ["today", "conversation"],
    states: ["angry", "down"],
    tones: ["courage", "challenge"],
    popularity: 88,
    values: 86,
    valuesNote: "Mercy over hatred; the dignity of every soldier and citizen.",
  },
  {
    kind: "song",
    title: "Man in the Mirror",
    creator: "Michael Jackson",
    url: "https://www.youtube.com/watch?v=PivWY9wn5ps",
    blurb: "Jackson starts with the man in the mirror — change your ways before you preach them.",
    focuses: ["temptation", "decision"],
    states: ["steady", "down"],
    tones: ["challenge", "clarity"],
    popularity: 92,
    values: 88,
    valuesNote: "Self-examination before reforming the world.",
  },
  {
    kind: "song",
    title: "Let It Be",
    creator: "The Beatles",
    url: "https://www.youtube.com/watch?v=QDYfEBY9NM4",
    blurb: "When the night is dark, words of wisdom: let it be.",
    focuses: ["grief", "decision"],
    states: ["anxious", "down"],
    tones: ["consolation", "comfort"],
    popularity: 95,
    values: 80,
    valuesNote: "Surrender and trust when answers won't come.",
  },
  {
    kind: "song",
    title: "I Will Always Love You",
    creator: "Whitney Houston",
    url: "https://www.youtube.com/watch?v=3JWTaaS7LdU",
    blurb: "Houston's towering farewell — love that remains even as it lets go.",
    focuses: ["marriage", "grief"],
    states: ["grateful", "down"],
    tones: ["consolation", "comfort"],
    popularity: 96,
    values: 78,
    valuesNote: "Love that endures past parting; dignity in goodbye.",
  },
  {
    kind: "song",
    title: "Everybody Hurts",
    creator: "R.E.M.",
    url: "https://www.youtube.com/watch?v=5rOiW_xY-kc",
    blurb: "Stipe's hand extended to anyone at the end of their rope: hold on.",
    focuses: ["grief", "today"],
    states: ["down", "numb"],
    tones: ["consolation", "comfort"],
    popularity: 90,
    values: 86,
    valuesNote: "Hope spoken directly to the despairing; never alone.",
  },
  {
    kind: "song",
    title: "If I Ain't Got You",
    creator: "Alicia Keys",
    url: "https://www.youtube.com/watch?v=Ju8Hr50Ckwk",
    blurb: "Alicia has no use for mansions if she ain't got the one she loves.",
    focuses: ["marriage", "family"],
    states: ["grateful", "steady"],
    tones: ["comfort", "clarity"],
    popularity: 90,
    values: 86,
    valuesNote: "Love ranked above every luxury.",
  },
  {
    kind: "song",
    title: "Hey Jude",
    creator: "The Beatles",
    url: "https://www.youtube.com/watch?v=A_MjCqQoLLA",
    blurb: "written to carry a grieving boy: take a sad song and make it better.",
    focuses: ["family", "grief"],
    states: ["down", "anxious"],
    tones: ["comfort", "courage"],
    popularity: 97,
    values: 78,
    valuesNote: "Consolation offered person to person; sorrow carried together.",
  },
  {
    kind: "song",
    title: "Beautiful Day",
    creator: "U2",
    url: "https://www.youtube.com/watch?v=co6WMzDOh1o",
    blurb: "Bono finds a beautiful day in the wreckage — grace after the flood, not before it.",
    focuses: ["today", "grief"],
    states: ["down", "grateful"],
    tones: ["comfort", "courage"],
    popularity: 90,
    values: 82,
    valuesNote: "Gratitude on the far side of loss.",
  },
  {
    kind: "song",
    title: "What I've Done",
    creator: "Linkin Park",
    url: "https://www.youtube.com/watch?v=8sgycukafqQ",
    blurb: "Linkin Park faces what he has done and decides to face himself and let it go.",
    focuses: ["temptation", "decision"],
    states: ["down", "steady"],
    tones: ["clarity", "challenge"],
    popularity: 90,
    values: 72,
    valuesNote: "Contrition and starting clean.",
  },
  {
    kind: "song",
    title: "With or Without You",
    creator: "U2",
    url: "https://www.youtube.com/watch?v=ujNeHIo7oTE",
    blurb: "Bono can't live with or without her — love as the wound and the weather at once.",
    focuses: ["marriage", "temptation"],
    states: ["numb", "down"],
    tones: ["clarity"],
    popularity: 88,
    values: 65,
    valuesNote: "Desire and dependence named honestly.",
  },
  {
    kind: "song",
    title: "Humble and Kind",
    creator: "Tim McGraw",
    url: "https://www.youtube.com/watch?v=awzNHuGqoMc",
    blurb: "McGraw's graduation charge: always stay humble and kind, help the next one in line.",
    focuses: ["family", "conversation"],
    states: ["steady", "grateful"],
    tones: ["clarity", "comfort"],
    popularity: 86,
    values: 92,
    valuesNote: "Humility and kindness as a whole life program.",
  },
  {
    kind: "song",
    title: "My Heart Will Go On",
    creator: "Celine Dion",
    url: "https://www.youtube.com/watch?v=9bFHsd3o1w0",
    blurb: "The Titanic ballad — a heart that goes on beating after the ship and the man are gone.",
    focuses: ["grief", "marriage"],
    states: ["down", "numb"],
    tones: ["consolation"],
    popularity: 95,
    values: 72,
    valuesNote: "Love surviving death; memory as fidelity.",
  },
  {
    kind: "song",
    title: "I Don't Want to Miss a Thing",
    creator: "Aerosmith",
    url: "https://www.youtube.com/watch?v=JkK8g6FMEXE",
    blurb: "Aerosmith at the bedside: every moment spent right there, treasured.",
    focuses: ["marriage", "family"],
    states: ["grateful", "steady"],
    tones: ["comfort"],
    popularity: 90,
    values: 85,
    valuesNote: "Presence; not wasting the people in front of you.",
  },
  {
    kind: "song",
    title: "Just Give Me a Reason",
    creator: "P!nk feat. Nate Ruess",
    url: "https://www.youtube.com/watch?v=OpQFFLBMEPI",
    blurb: "Two voices in one marriage fight honestly for the same ending: just give me a reason.",
    focuses: ["marriage", "conversation"],
    states: ["angry", "down"],
    tones: ["clarity", "courage"],
    popularity: 90,
    values: 82,
    valuesNote: "Fighting for a marriage instead of out of it.",
  },
  {
    kind: "song",
    title: "Good Riddance (Time of Your Life)",
    creator: "Green Day",
    url: "https://www.youtube.com/watch?v=CnQ8N1KacJc",
    blurb: "Green Day's toast to a crossroads: every new beginning comes from some other beginning's end.",
    focuses: ["decision", "today"],
    states: ["steady", "down"],
    tones: ["clarity", "comfort"],
    popularity: 90,
    values: 76,
    valuesNote: "Gratitude at life's turning points.",
  },
];

/**
 * The values floor (Erik, Nov 13, 2026): a work whose substance falls
 * below this line is excluded outright — no popularity and no fit, however
 * perfect, can carry it onto the card.
 */
export const MEDIA_VALUES_FLOOR = 40;

/** The unified media total: fit (0–40) + alignment (0–35) + popularity (0–25) = 0–100. */
export interface MediaAxisScore {
  /** Tag fit to the morning: focus, state, tone (the model scores this axis for live finds). */
  fit: number;
  /** The values score, scaled to its 35-point weight. */
  alignment: number;
  /** The popularity score, scaled to its 25-point weight. */
  popularity: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** fit + alignment + popularity, on the unified three-axis total. */
export function mediaAxisTotal(fit: number, alignment: number, popularity: number): number {
  return round2(fit + alignment + popularity);
}

/**
 * The fit axis for a catalog entry, from its tags: the day's focus leads
 * (18), the morning's state answers next (12), the asked tone last (10).
 */
export function catalogFit(media: TailorMedia, focus: TailorFocus, state: TailorState, tone: TailorTone | null): number {
  let fit = 0;
  if (media.focuses.includes(focus)) fit += 18;
  if (media.states.includes(state)) fit += 12;
  if (tone !== null && media.tones.includes(tone)) fit += 10;
  return fit;
}

/**
 * Scores one catalog entry for one morning on the unified axes — or null
 * when the entry falls below the values floor. The floor is checked
 * FIRST and is absolute: a null here can never be outvoted by fit or fame.
 */
export function scoreCatalogMedia(
  media: TailorMedia,
  focus: TailorFocus,
  state: TailorState,
  tone: TailorTone | null,
): MediaAxisScore | null {
  if (media.values < MEDIA_VALUES_FLOOR) return null;
  const fit = catalogFit(media, focus, state, tone);
  const alignment = round2(media.values * 0.35);
  const popularity = round2(media.popularity * 0.25);
  return { fit, alignment, popularity, total: mediaAxisTotal(fit, alignment, popularity) };
}

export interface ScoredCatalogMedia {
  media: TailorMedia;
  axes: MediaAxisScore;
}

/**
 * The catalog's best answer to one morning: the highest unified total
 * among above-floor entries, exact ties broken by the date rotation so
 * the same need on a different day does not always land on the same work.
 * Null only if nothing in the catalog clears the floor for the morning —
 * the catalog is curated so that cannot happen (the tests pin per-focus
 * depth above the floor), and callers still degrade rather than fail.
 *
 * THE GROWTH PLUG-IN: `extra` merges further rows in this same shape —
 * the self-growing library's captured winners — into the scored pool
 * BEFORE selection runs, so a grown row competes on the identical axes
 * and can win a morning outright. A row whose address the seed already
 * carries is skipped: the seed's curated entry is the same work, kept.
 */
export function bestCatalogMedia(
  focus: TailorFocus,
  state: TailorState,
  tone: TailorTone | null,
  dateISO: string,
  extra: TailorMedia[] = [],
): ScoredCatalogMedia | null {
  const pool: TailorMedia[] = [...MEDIA_CATALOG];
  if (extra.length > 0) {
    const seen = new Set(MEDIA_CATALOG.map((m) => m.url));
    for (const row of extra) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      pool.push(row);
    }
  }
  let best: ScoredCatalogMedia | null = null;
  let tied: ScoredCatalogMedia[] = [];
  for (const media of pool) {
    const axes = scoreCatalogMedia(media, focus, state, tone);
    if (!axes) continue;
    if (!best || axes.total > best.axes.total) {
      best = { media, axes };
      tied = [best];
    } else if (axes.total === best.axes.total) {
      tied.push({ media, axes });
    }
  }
  if (!best) return null;
  if (tied.length === 1) return best;
  let hash = 0;
  const seed = `${dateISO}|media|${focus}|${state}|${tone ?? ''}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return tied[hash % tied.length];
}

/**
 * The day's media pick from the catalog alone: the unified scoring's
 * winner for the morning's focus, state, and tone. Deterministic — the
 * same (focus, state, tone, date) always selects the same entry.
 */
export function pickMedia(
  focus: TailorFocus,
  state: TailorState,
  tone: TailorTone | null,
  dateISO: string,
): TailorMedia {
  // The catalog always holds above-floor entries for every focus (pinned
  // by the schema tests); the literal fallback is unreachable by curation.
  return bestCatalogMedia(focus, state, tone, dateISO)?.media ?? MEDIA_CATALOG[0];
}

