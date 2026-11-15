/**
 * The novenas (Pocket Church, Pray door — Nov 14, 2026). Three novenas in
 * their established traditional forms: the same prayers each of the nine
 * days, which is the correct shape for these devotions — the day marker,
 * not a new text, carries the progress. Every text below is the received
 * traditional one (the St. Jude prayer in the form the National Shrine of
 * St. Jude has distributed since the 1920s; St. Joseph's Memorare in the
 * Raccolta text; the Undoer of Knots prayer of that devotion) — nothing
 * here was composed for this app, and no words are put in a saint's mouth.
 *
 * A day's praying is a list of blocks, in order. A block either carries
 * its own text or names a prayer on the shared shelf (src/data/prayers.ts)
 * whose text is prayed — the Our Father, Hail Mary, and Glory Be the
 * traditional forms prescribe are never copied into this file.
 */

export type NovenaId = 'st-joseph' | 'mary-undoer-of-knots' | 'st-jude';

export interface NovenaBlock {
  /** The stamped heading over the block. */
  label: string;
  /** The block's own text (a prayer of this devotion). */
  text?: string;
  /** The title of a prayer on the shared shelf whose text is prayed here. */
  sharedTitle?: string;
}

export interface Novena {
  id: NovenaId;
  title: string;
  /** One line: who the saint is for, and what the novena is prayed for. */
  patronage: string;
  /** A rubric of the traditional form, where the form carries one. */
  note?: string;
  blocks: NovenaBlock[];
}

const CLOSING: NovenaBlock[] = [
  { label: 'Our Father', sharedTitle: 'Our Father' },
  { label: 'Hail Mary', sharedTitle: 'Hail Mary' },
  { label: 'Glory Be', sharedTitle: 'Glory Be' },
];

export const NOVENAS: Novena[] = [
  {
    id: 'st-joseph',
    title: 'Novena to St. Joseph',
    patronage: 'Patron of families and workers — for work, for the house, and for a happy death.',
    blocks: [
      {
        label: 'Memorare of St. Joseph',
        text: 'Remember, O most pure spouse of Mary ever-Virgin, my loving protector, St. Joseph, that never has it been heard that anyone ever invoked thy protection, or besought aid of thee, without being consoled. In this confidence I come before thee; I fervently recommend myself to thee. Despise not my prayer, foster-father of our Redeemer, but do thou in thy pity receive it.\n\nAmen.',
      },
      {
        label: 'Novena Prayer',
        text: 'O glorious St. Joseph, faithful follower of Jesus Christ, to thee do we raise our hearts and hands to implore thy powerful intercession in obtaining from the benign Heart of Jesus all the helps and graces necessary for our spiritual and temporal welfare, particularly the grace of a happy death, and the special favor we now implore (mention your intention).\n\nO glorious St. Joseph, through the love thou bearest to Jesus Christ, and for the glory of His name, hear our prayers and obtain our petitions.\n\nAmen.',
      },
      ...CLOSING,
    ],
  },
  {
    id: 'mary-undoer-of-knots',
    title: 'Novena to Mary, Undoer of Knots',
    patronage: 'For the knots in a life — the troubles and tangles that will not come undone.',
    note: 'The traditional form prays this novena with the Rosary: the first three decades before the prayer below, the last two after it.',
    blocks: [
      { label: 'Act of Contrition', sharedTitle: 'Act of Contrition' },
      {
        label: 'Prayer to Mary, Undoer of Knots',
        text: 'Virgin Mary, Mother of fair love, Mother who never refuses to come to the aid of a child in need, Mother whose hands never cease to serve your beloved children because they are moved by the divine love and immense mercy that exists in your heart, cast your compassionate eyes upon me and see the snarl of knots that exist in my life.\n\nYou know very well how desperate I am, my pain and how I am bound up by the knots. Mary, Mother to whom God entrusted the undoing of the knots in the lives of his children, I entrust into your hands the ribbon of my life. No one, not even the evil one himself, can take it away from your precious care. In your hands there is no knot that cannot be undone.\n\nPowerful Mother, by your grace and intercessory power with Your Son and My Liberator, Jesus, take into your hands today this knot (mention your intention). I beg you to undo it for the glory of God, once and for all. You are my hope. O my Lady, you are the only consolation God gives me, the fortification of my feeble strength, the enrichment of my destitution and with Christ the freedom from my chains. Hear my plea. Keep me, guide me, protect me, o safe refuge.\n\nMary, Undoer of Knots, pray for me.\n\nAmen.',
      },
      ...CLOSING,
    ],
  },
  {
    id: 'st-jude',
    title: 'Novena to St. Jude',
    patronage: 'Patron of hopeless cases — prayed when the need is desperate and almost despaired of.',
    blocks: [
      {
        label: 'Invocation',
        text: 'St. Jude, glorious Apostle, faithful servant and friend of Jesus, the name of the traitor has caused thee to be forgotten by many, but the true Church invokes thee universally as the patron of things despaired of. Pray for me, who am so miserable; pray for me, that I may receive the consolations and the succour of Heaven in all my necessities, tribulations, and sufferings, particularly (mention your intention), and that I may bless God with the elect throughout eternity.\n\nAmen.',
      },
      {
        label: 'Novena Prayer',
        text: 'Most holy Apostle, St. Jude, faithful servant and friend of Jesus, the Church honors and invokes you universally, as the patron of hopeless cases, of things almost despaired of. Pray for me, I am so helpless and alone. Make use, I implore you, of that particular privilege given to you, to bring visible and speedy help where help is almost despaired of. Come to my assistance in this great need, that I may receive the consolation and help of heaven in all my necessities, tribulations and sufferings, particularly (mention your request), and that I may praise God with you and all the elect forever.\n\nI promise, O blessed St. Jude, to be ever mindful of this great favor, to always honor you as my special and powerful patron, and to gratefully encourage devotion to you.\n\nAmen.',
      },
      ...CLOSING,
    ],
  },
];

/**
 * The shelf order per track (Erik's build spec, Nov 14, 2026): the content
 * is identical on both tracks; only the order differs — men meet St. Joseph
 * first, then St. Jude, then Mary; women meet Mary first, then St. Joseph,
 * then St. Jude.
 */
const ORDER: Record<'men' | 'women', NovenaId[]> = {
  men: ['st-joseph', 'st-jude', 'mary-undoer-of-knots'],
  women: ['mary-undoer-of-knots', 'st-joseph', 'st-jude'],
};

export function novenasForTrack(audience: 'men' | 'women'): Novena[] {
  return ORDER[audience].map((id) => NOVENAS.find((n) => n.id === id)!);
}

/** One novena's on-device record, kept under `sanctum_novena_<id>`. */
export interface NovenaState {
  /** The local date (YYYY-MM-DD) the novena was begun — the first day marked. */
  startedISO: string;
  /** The local dates on which a day was marked prayed. Its length is the progress. */
  prayedDates: string[];
}

export function emptyNovenaState(): NovenaState {
  return { startedISO: '', prayedDates: [] };
}

/** The day the next marking counts as: the count of days prayed, plus one. */
export function novenaDay(state: NovenaState): number {
  return Math.min(state.prayedDates.length + 1, 9);
}

export function novenaComplete(state: NovenaState): boolean {
  return state.prayedDates.length >= 9;
}
