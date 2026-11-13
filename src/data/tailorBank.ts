/**
 * The Tailor Today banks (Erik's approval, Nov 12, 2026): the need-matched passage
 * and the media card for a personalized devotional. CURATED, never generated — a
 * passage is *selected* from this file by the user's stated state and focus, and
 * the media pick is a real, well-known work (a song, a film, a podcast, a talk)
 * presented as title + creator with a *search* URL built from the two (never an
 * invented media id, never embedded media). If a need is not in the bank, the
 * bank is extended by a human, not by the model.
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
}

/**
 * The media bank (Nov 12, 2026 — broadened from songs at Erik's steer): ONE
 * pick per devotional, spanning songs, films, podcasts, and video talks,
 * chosen to tie the day's readings to the stated need. Every entry is a real,
 * well-known work. The card carries title + creator + a SEARCH URL only —
 * YouTube for songs and talks, Spotify for podcasts, a web search for films —
 * never an invented direct media id, never embedded media.
 */
export const MEDIA_BY_FOCUS: Record<TailorFocus, TailorMedia[]> = {
  work: [
    { type: 'song', title: "They'll Know We Are Christians", creator: 'Peter Scholtes' },
    { type: 'film', title: 'A Man for All Seasons', creator: 'Fred Zinnemann' },
  ],
  marriage: [
    { type: 'song', title: 'When Love Is Found', creator: 'Brian Wren' },
    { type: 'podcast', title: 'The Messy Family Project', creator: 'Mike and Alicia Hernon' },
  ],
  family: [
    { type: 'song', title: 'All Are Welcome', creator: 'Marty Haugen' },
    { type: 'film', title: 'The Lion, the Witch and the Wardrobe', creator: 'Andrew Adamson' },
  ],
  conversation: [
    { type: 'song', title: 'Prayer of St. Francis', creator: 'Sebastian Temple' },
    { type: 'film', title: 'The Mission', creator: 'Roland Joffé' },
  ],
  grief: [
    { type: 'song', title: "On Eagle's Wings", creator: 'Michael Joncas' },
    { type: 'talk', title: 'The Seven Last Words', creator: 'Fulton J. Sheen' },
  ],
  temptation: [
    { type: 'song', title: 'Amazing Grace', creator: 'John Newton' },
    { type: 'podcast', title: 'The Bible in a Year', creator: 'Fr. Mike Schmitz' },
  ],
  decision: [
    { type: 'song', title: 'Here I Am, Lord', creator: 'Dan Schutte' },
    { type: 'talk', title: 'Do Not Be Afraid — Inaugural Homily', creator: 'St. John Paul II' },
  ],
  today: [
    { type: 'song', title: 'Morning Has Broken', creator: 'Eleanor Farjeon' },
    { type: 'talk', title: 'The Weight of Glory', creator: 'C. S. Lewis' },
  ],
};

/** The card's link for a pick — a search for the work, never a media id. */
export function mediaSearchUrl(media: TailorMedia): string {
  const query = encodeURIComponent(`${media.title} ${media.creator}`);
  switch (media.type) {
    case 'podcast':
      return `https://open.spotify.com/search/${query}`;
    case 'film':
      return `https://www.google.com/search?q=${query}`;
    default:
      return `https://www.youtube.com/results?search_query=${query}`;
  }
}

/** The day's media pick for a focus — same rotation discipline as the passage. */
export function pickMedia(focus: TailorFocus, dateISO: string): TailorMedia {
  const bank = MEDIA_BY_FOCUS[focus];
  let hash = 0;
  const seed = `${dateISO}|media|${focus}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return bank[hash % bank.length];
}
