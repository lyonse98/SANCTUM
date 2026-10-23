export type HelpIconKey = 'church' | 'compass' | 'heart' | 'users' | 'marriage' | 'recovery';

export interface HelpLink {
  label: string;
  href: string;
  detail: string;
}

export interface HelpSection {
  id: string;
  icon: HelpIconKey;
  title: string;
  tagline: string;
  /** Why this matters — the honest reason to go. */
  why: string;
  /** Exactly what to say when he gets there, so he never has to find the words alone. */
  script: string;
  scriptLabel: string;
  links: HelpLink[];
}

/**
 * Curated, static referrals. Sanctum points a man to real people; it never pretends
 * to be one. Kept as plain data — no accounts, no server, nothing to moderate.
 */
export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'mass',
    icon: 'church',
    title: 'Mass & Confession',
    tagline: 'Get to a parish this week',
    why:
      'Nothing in this app can forgive a sin or feed you with the Eucharist. Only a priest can. The sacrament is the real thing — everything here is only a road toward it.',
    scriptLabel: 'What to do',
    script:
      'Look up the confession times for a parish near you. You do not need an appointment, a reason, or an introduction. Walk in, say "Bless me, Father, for I have sinned," and let him lead. If you have not been in years, tell him that first — he has heard it before and he will be glad you came.',
    links: [
      { label: 'Mass Times', href: 'https://www.masstimes.org', detail: 'Mass and confession times for any ZIP code' },
      { label: 'Discover Mass', href: 'https://discovermass.com', detail: 'Find a parish near you' },
    ],
  },
  {
    id: 'director',
    icon: 'compass',
    title: 'A Spiritual Director',
    tagline: 'One man who knows your soul',
    why:
      'A director is not a therapist and not a confessor. He is a steady guide you meet with regularly — monthly is normal — to help you hear what God is actually asking of you. Most men never ask. The men who do rarely go back.',
    scriptLabel: 'How to ask a priest',
    script:
      'Say it plainly: "Father, I am trying to take my faith seriously and I would like a spiritual director. Would you be willing to meet with me, or point me to a priest who could?" That is the whole ask. If he says no, it is not a rejection — it means he is honest about his schedule. Ask him who he would suggest.',
    links: [
      { label: 'Catholic Spiritual Directors Registry', href: 'https://www.catholicsd.com', detail: 'Search directors by location' },
      { label: 'Spiritual Direction', href: 'https://www.spiritualdirection.com', detail: 'Ignatian tradition, plus a directory' },
    ],
  },
  {
    id: 'therapist',
    icon: 'heart',
    title: 'A Catholic Therapist',
    tagline: 'For what prayer alone is not fixing',
    why:
      'Depression, anxiety, trauma, and a marriage in trouble are not failures of faith. They often need real clinical care. A therapist who shares your faith can treat the wound without treating your beliefs as the problem.',
    scriptLabel: 'What to say when you call',
    script:
      '"I am a Catholic man looking for a therapist who works with [what you are facing — anxiety, my marriage, drinking, anger]. Do you have someone you would recommend?" You do not owe a stranger your whole story on the phone. You are just booking the first hour.',
    links: [
      { label: 'Catholic Psychotherapy Association', href: 'https://catholicpsychotherapy.org', detail: 'Find a licensed Catholic therapist' },
      { label: 'Catholic Therapists', href: 'https://catholictherapists.com', detail: 'Directory of Catholic-committed clinicians' },
      { label: 'Catholic Counselors', href: 'https://catholiccounselors.com', detail: 'Pastoral counseling by phone or in person' },
      { label: 'Catholic Charities USA', href: 'https://www.catholiccharitiesusa.org/what-we-do/integrated-health', detail: 'Counseling, plus help with housing, food, and money' },
    ],
  },
  {
    id: 'mens-group',
    icon: 'users',
    title: "A Men's Group",
    tagline: 'You were not made to run alone',
    why:
      'The men who last are not the ones with the strongest will. They are the ones with brothers who notice when they go quiet. A group is the difference between a good month and a changed life.',
    scriptLabel: 'If there is none near you',
    script:
      'Ask your pastor after Mass: "Father, is there a men\'s group here, or any men who would want one?" If he says no, offer to start one — four men, one hour, one book is enough. Most parishes are waiting for a layman to ask. You may be the one he has been praying for.',
    links: [
      { label: 'Knights of Columbus', href: 'https://www.kofc.org/get-involved/find-a-council', detail: 'Find a council near you — the largest Catholic men\'s brotherhood' },
      { label: 'Cor', href: 'https://www.kofc.org/resources/faith-formation/mens-faith-formation/cor', detail: 'The Knights\' small-group formation for men, open to all' },
      { label: 'Exodus 90', href: 'https://exodus90.com', detail: 'A 90-day men\'s fraternity' },
      { label: 'That Man Is You', href: 'https://paradisusdei.org/that-man-is-you', detail: 'Parish men\'s program — find a group' },
    ],
  },
  {
    id: 'marriage',
    icon: 'marriage',
    title: 'A Marriage on the Rocks',
    tagline: 'Before you walk away, or before it gets there',
    why:
      'Most marriages do not die in a single blow. They drift, and then one day the two of you are running a household instead of a marriage. There are programs built for exactly this — run by couples who were there themselves — and they work whether you are barely drifting or already separated.',
    scriptLabel: 'How to bring it up with your wife',
    script:
      'Do not open with a list of what is wrong. Say: "I do not want us to just be roommates. I found a weekend program for couples and I want to do it with you." If she is not ready, go to confession and ask the priest for help — a priest can often say things to her that you cannot, and he has seen this a thousand times.',
    links: [
      { label: 'Retrouvaille', href: 'https://helpourmarriage.org', detail: 'A weekend for marriages in crisis — call 1-800-470-2230' },
      { label: 'Worldwide Marriage Encounter', href: 'https://wwme.org', detail: 'A weekend to deepen a marriage that is not in crisis yet' },
    ],
  },
  {
    id: 'addiction',
    icon: 'recovery',
    title: 'Addiction or Compulsion',
    tagline: 'Porn, drink, gambling, food — it is not a willpower problem',
    why:
      'You have probably tried to stop on your own more than once. Shame keeps a man quiet, and quiet keeps him sick. These are Catholic-specific programs that treat the addiction and the sacrament as one road, not two. You do not have to tell anyone at your parish.',
    scriptLabel: 'What the first meeting is like',
    script:
      'You do not have to speak. You can sit in the back and just listen — that is allowed, and most men do it their first time. Nothing you say leaves the room. If you would rather start alone, the 21-day programs are private and free, and you can begin tonight without telling a soul.',
    links: [
      { label: 'Catholic in Recovery', href: 'https://catholicinrecovery.com', detail: 'In-person and online 12-step groups, rooted in the sacraments' },
      { label: 'Integrity Restored', href: 'https://integrityrestored.com', detail: 'Help for pornography addiction — for men, wives, and families' },
      { label: 'STRIVE 21-Day Detox', href: 'https://www.covenanteyes.com/strive', detail: 'A free, private 21-day program for men — start tonight' },
    ],
  },
];

/** The line that keeps the app honest — shown at the top of the help screen. */
export const HELP_DISCLAIMER =
  'Sanctum cannot baptize, absolve, marry, or anoint. Only a priest can. This screen exists to hand you to a real person.';
