/**
 * The shared brain of the daily audio — the parts the phone, the tests, and the render
 * function must never disagree about: who reads today, what he may say, and the exact
 * words of the script. This file is the source of truth; `scripts/sync-narrator-core.mjs`
 * copies it verbatim into `supabase/functions/audio-render/`, the same arrangement
 * `pushCore` uses for the daily poke. It must therefore stay free of imports and browser
 * APIs — plain TypeScript only.
 *
 * The governing documents are the Narrator Charter (`narrator-charter.md`) and the audio
 * build spec (`audio-build-spec.md`). The rules that matter most, in one place:
 *
 * - Zone 1 is verbatim: the Gospel, the reflection, and the challenge are assembled
 *   byte-for-byte from the stored bundle and are never altered here. Personality lives
 *   only in the framing (Zone 2/3), selected from the bank below — never improvised.
 * - The bank is human-approved text. The lines written for the audio build are listed
 *   in `DRAFT_BANK_LINES` (their drafting registry); Erik approved every one of them as
 *   written on Nov 2, 2026, clearing the spec §5.3 launch gate.
 * - There is NO fallback voice. If a day cannot render in the narrator's own voice, it
 *   does not render (Erik, Nov 2, 2026). This module has no concept of a substitute voice.
 * - TWO COMPANIES, ONE PIPELINE (Erik, Nov 11, 2026): the women's company (Charter
 *   addendum, Nov 11) reads the women's track from the same machinery. Selection,
 *   banks, voices, and storage paths are all keyed by audience, and the tracks can
 *   never borrow each other's voice, bank, reflection, or files. The men's data and
 *   behavior below are unchanged from the Nov 2 approval.
 * - Time-of-day lives only in the two heads (AM/PM). The main segment is time-neutral
 *   (§5.4), enforced by `TIME_NEUTRAL_LINT` in the tests.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Local hour from which the evening head plays (3 p.m. — a tunable constant, spec §11.2). */
export const AUDIO_PM_START_HOUR = 15;

/** The produced silence between the Gospel and the reflection, in seconds (spec §3.4). */
export const AUDIO_SILENCE_SECONDS = 2.0;

/** The signature-sound personas — one per company; the bell is stitched by the phone (spec §5.6). */
export const BELL_PERSONA_ID = 'martin';
export const BELL_PERSONAS: readonly string[] = ['martin', 'marta'];
export const BELL_PATH = 'static/martin-bell.mp3';

/** True when the persona carries the signature bell (Martin for the men, Marta for the women). */
export function personaHasBell(persona: string): boolean {
  return BELL_PERSONAS.includes(persona);
}

// ── Personas ──────────────────────────────────────────────────────────────────

/** The two tracks, as the render pipeline names them (mirrors the app's Audience). */
export type NarratorAudience = 'men' | 'women';

export type PersonaId = 'henry' | 'coach' | 'frank' | 'ben' | 'martin' | 'tom' | 'ed';
export type WomenPersonaId = 'ruth' | 'dana' | 'grace' | 'claire' | 'marta' | 'june' | 'rose';
export type NarratorId = PersonaId | WomenPersonaId | 'lector';

/** The weekday readers plus the Lector — everyone who can voice a daily row. */
export const NARRATOR_IDS: NarratorId[] = [
  'henry', 'coach', 'frank', 'ben', 'martin', 'tom', 'ed',
  'ruth', 'dana', 'grace', 'claire', 'marta', 'june', 'rose',
  'lector',
];

export interface PersonaDisplay {
  /** Short name, e.g. "Ben". */
  name: string;
  /** The name as introduced to the listener, e.g. "Ben, the Brother". */
  displayName: string;
  /** The weekday he reads, e.g. "Wednesday". */
  weekdayName: string;
}

/** Display names for every narrator, including the Pilgrim specials (who have no
 *  daily bank — they are cast, voiced, and named, but read only on the road). */
export const PERSONA_DISPLAY: Record<NarratorId | 'will' | 'willa', PersonaDisplay> = {
  henry: { name: 'Henry', displayName: 'Henry, the Elder', weekdayName: 'Sunday' },
  coach: { name: 'Coach', displayName: 'Coach', weekdayName: 'Monday' },
  frank: { name: 'Frank', displayName: 'Frank, the Working Man', weekdayName: 'Tuesday' },
  ben: { name: 'Ben', displayName: 'Ben, the Brother', weekdayName: 'Wednesday' },
  martin: { name: 'Martin', displayName: 'Martin, the Keeper of the Hours', weekdayName: 'Thursday' },
  tom: { name: 'Tom', displayName: 'Tom, the Night Watchman', weekdayName: 'Friday' },
  ed: { name: 'Ed', displayName: 'Ed, the Neighbor', weekdayName: 'Saturday' },
  ruth: { name: 'Ruth', displayName: 'Ruth, the Elder', weekdayName: 'Sunday' },
  dana: { name: 'Dana', displayName: 'Coach Dana', weekdayName: 'Monday' },
  grace: { name: 'Grace', displayName: 'Grace, the Working Woman', weekdayName: 'Tuesday' },
  claire: { name: 'Claire', displayName: 'Claire, the Sister', weekdayName: 'Wednesday' },
  marta: { name: 'Marta', displayName: 'Marta, the Keeper of the Hours', weekdayName: 'Thursday' },
  june: { name: 'June', displayName: 'June, the Night Watch', weekdayName: 'Friday' },
  rose: { name: 'Rose', displayName: 'Rose, the Neighbor', weekdayName: 'Saturday' },
  will: { name: 'Will', displayName: 'Will, the Pilgrim', weekdayName: '' },
  willa: { name: 'Willa', displayName: 'Willa, the Pilgrim', weekdayName: '' },
  lector: { name: 'The Lector', displayName: 'The Lector', weekdayName: '' },
};

/** Weekday (0 = Sunday) → the brother who reads that day (Charter §4 rotation). */
const WEEKDAY_PERSONA: Record<number, PersonaId> = {
  0: 'henry',
  1: 'coach',
  2: 'frank',
  3: 'ben',
  4: 'martin',
  5: 'tom',
  6: 'ed',
};

/** Weekday (0 = Sunday) → the sister who reads that day (Charter addendum rotation). */
const WEEKDAY_PERSONA_WOMEN: Record<number, WomenPersonaId> = {
  0: 'ruth',
  1: 'dana',
  2: 'grace',
  3: 'claire',
  4: 'marta',
  5: 'june',
  6: 'rose',
};

/** The weekday reader for a track: 0 = Sunday … 6 = Saturday. */
export function weekdayPersona(audience: NarratorAudience, weekday: number): PersonaId | WomenPersonaId {
  return audience === 'women' ? WEEKDAY_PERSONA_WOMEN[weekday] : WEEKDAY_PERSONA[weekday];
}

/**
 * The Pilgrim specials' voices (Charter §4 + addendum): cast and voiced like the
 * Lector, but with no daily bank — Will and Willa read on the road, not in the
 * rotation. Recorded here so the casting table has one home.
 */
export const PILGRIM_VOICES: Record<NarratorAudience, string> = {
  men: 'Umbriel',
  women: 'Leda',
};

/**
 * The storage path of one day's segment file, keyed by audience so the two tracks'
 * files can never collide: "2026-11-05/men/main.mp3" vs "2026-11-05/women/main.mp3".
 * The bell is the one shared object (BELL_PATH) — Marta's bell is Martin's bell.
 */
export function audioSegmentPath(
  dateISO: string,
  audience: NarratorAudience,
  segment: 'head-am' | 'head-pm' | 'main',
): string {
  return `${dateISO}/${audience}/${segment}.mp3`;
}

// ── Date helpers (ISO dates, timezone-free arithmetic) ────────────────────────

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseISODate(dateISO: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateISO.split('-').map((p) => parseInt(p, 10));
  return { y, m, d };
}

export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isoToMs(dateISO: string): number {
  const { y, m, d } = parseISODate(dateISO);
  return Date.UTC(y, m - 1, d);
}

function msToISO(ms: number): string {
  const dt = new Date(ms);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDaysISO(dateISO: string, days: number): string {
  return msToISO(isoToMs(dateISO) + days * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, for the civil date named by the ISO string. */
export function weekdayOfISO(dateISO: string): number {
  return new Date(isoToMs(dateISO)).getUTCDay();
}

export function weekdayNameOfISO(dateISO: string): string {
  return WEEKDAY_NAMES[weekdayOfISO(dateISO)];
}

function sundayOfWeekISO(dateISO: string): string {
  return addDaysISO(dateISO, -weekdayOfISO(dateISO));
}

function weeksBetweenISO(fromSundayISO: string, toSundayISO: string): number {
  return Math.round((isoToMs(toSundayISO) - isoToMs(fromSundayISO)) / (7 * DAY_MS));
}

/** Easter Sunday (Computus) — ported from src/data/liturgicalCalendar.ts. */
export function getEasterDateISO(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISODate(year, month, day);
}

/** First day of Advent — ported from src/data/liturgicalCalendar.ts. */
export function getAdventStartISO(year: number): string {
  const christmasMs = Date.UTC(year, 11, 25);
  const christmasDow = new Date(christmasMs).getUTCDay();
  return msToISO(christmasMs - (christmasDow + 21) * DAY_MS);
}

/** The Baptism of the Lord: the Sunday after Jan 6 (the app's own rule, ported). */
function baptismSundayISO(year: number): string {
  const epiphanyMs = Date.UTC(year, 0, 6);
  const dow = new Date(epiphanyMs).getUTCDay();
  return msToISO(epiphanyMs + ((7 - dow) % 7) * DAY_MS);
}

// ── Number words ──────────────────────────────────────────────────────────────

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Cardinal in words: 14 → "fourteen", 115 → "one hundred fifteen". */
export function numberWords(n: number): string {
  if (n < 0 || n > 999) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) {
    const rest = n % 10;
    return rest === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]}-${ONES[rest]}`;
  }
  const rest = n % 100;
  return rest === 0
    ? `${ONES[Math.floor(n / 100)]} hundred`
    : `${ONES[Math.floor(n / 100)]} hundred ${numberWords(rest)}`;
}

const ORDINALS: Record<number, string> = {
  1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth',
  7: 'Seventh', 8: 'Eighth', 9: 'Ninth', 10: 'Tenth', 11: 'Eleventh', 12: 'Twelfth',
  13: 'Thirteenth', 14: 'Fourteenth', 15: 'Fifteenth', 16: 'Sixteenth',
  17: 'Seventeenth', 18: 'Eighteenth', 19: 'Nineteenth', 20: 'Twentieth',
  21: 'Twenty-First', 22: 'Twenty-Second', 23: 'Twenty-Third', 24: 'Twenty-Fourth',
  25: 'Twenty-Fifth', 26: 'Twenty-Sixth', 27: 'Twenty-Seventh', 28: 'Twenty-Eighth',
  29: 'Twenty-Ninth', 30: 'Thirtieth', 31: 'Thirty-First', 32: 'Thirty-Second',
  33: 'Thirty-Third', 34: 'Thirty-Fourth',
};

/** Ordinal in words, capitalized as the frames speak it: 30 → "Thirtieth". */
export function ordinalWords(n: number): string {
  return ORDINALS[n] ?? String(n);
}

/**
 * Speaks the digits inside a lectionary string: "Friday of the 30th week of Ordinary
 * Time" → "Friday of the Thirtieth week of Ordinary Time". The samples spoke the
 * ordinals as words; the lectionary writes them as digits. Only ordinal suffixes
 * (1st/2nd/3rd/4th…) are touched — verse numbers and years are left alone.
 */
export function spokenizeOrdinals(text: string): string {
  return text
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)(\s+)week\b/gi, (_whole, digits: string, gap: string) => {
      return `${ordinalWords(parseInt(digits, 10))}${gap}Week`;
    })
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, (whole, digits: string) => {
      return ordinalWords(parseInt(digits, 10)) ?? whole;
    })
    // The API writes "Week of Ordinary Time"; the approved samples speak "Week in
    // Ordinary Time" (the USCCB's own phrasing). The spoken label follows the samples.
    .replace(/Week of Ordinary Time/g, 'Week in Ordinary Time');
}

/** Uppercases the first letter (the lectionary's strings arrive sentence-ready but lowercase-safe). */
export function sentenceStart(text: string): string {
  const t = text.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** "As a man" → "as a man" for the challenge hand-off slot. */
export function facetLower(facet: string): string {
  const t = facet.trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// ── Feast resolution (ported from src/data/feastDays.ts, reduced to name + rank) ──

export type FeastRankN = 'solemnity' | 'feast' | 'memorial';

export interface FeastDayN {
  name: string;
  rank: FeastRankN;
}

/** Fixed-date feasts, keyed MM-DD — a faithful reduction of FIXED_FEASTS. A vitest drift
 *  check compares this table against src/data/feastDays.ts across a full year. */
const FIXED_FEASTS_N: Record<string, [string, FeastRankN]> = {
  '01-01': ["Mary, Mother of God", 'solemnity'],
  '01-06': ["Epiphany", 'solemnity'],
  '01-17': ["St. Anthony of the Desert", 'memorial'],
  '01-20': ["St. Sebastian", 'memorial'],
  '01-24': ["St. Francis de Sales", 'memorial'],
  '01-28': ["St. Thomas Aquinas", 'memorial'],
  '02-02': ["Presentation of the Lord", 'feast'],
  '02-03': ["St. Blaise", 'memorial'],
  '02-11': ["Our Lady of Lourdes", 'memorial'],
  '02-14': ["St. Valentine", 'memorial'],
  '03-17': ["St. Patrick", 'feast'],
  '03-19': ["St. Joseph", 'solemnity'],
  '03-25': ["The Annunciation", 'solemnity'],
  '04-23': ["St. George", 'memorial'],
  '04-25': ["St. Mark", 'feast'],
  '04-29': ["St. Catherine of Siena", 'memorial'],
  '05-13': ["Our Lady of Fatima", 'memorial'],
  '05-15': ["St. Isidore the Farmer", 'memorial'],
  '05-22': ["St. Rita of Cascia", 'memorial'],
  '06-13': ["St. Anthony of Padua", 'memorial'],
  '06-24': ["Nativity of John the Baptist", 'solemnity'],
  '06-29': ["Sts. Peter and Paul", 'solemnity'],
  '07-11': ["St. Benedict", 'feast'],
  '07-14': ["St. Camillus de Lellis", 'memorial'],
  '07-16': ["Our Lady of Mount Carmel", 'memorial'],
  '07-22': ["St. Mary Magdalene", 'feast'],
  '07-25': ["St. James", 'feast'],
  '07-31': ["St. Ignatius of Loyola", 'memorial'],
  '08-04': ["St. John Vianney", 'memorial'],
  '08-08': ["St. Dominic", 'memorial'],
  '08-10': ["St. Lawrence", 'feast'],
  '08-11': ["St. Clare of Assisi", 'memorial'],
  '08-14': ["St. Maximilian Kolbe", 'memorial'],
  '08-15': ["The Assumption", 'solemnity'],
  '08-20': ["St. Bernard of Clairvaux", 'memorial'],
  '08-25': ["St. Louis IX", 'memorial'],
  '08-28': ["St. Augustine", 'memorial'],
  '09-03': ["St. Gregory the Great", 'memorial'],
  '09-05': ["St. Teresa of Calcutta", 'memorial'],
  '09-14': ["Exaltation of the Holy Cross", 'feast'],
  '09-15': ["Our Lady of Sorrows", 'memorial'],
  '09-21': ["St. Matthew", 'feast'],
  '09-23': ["St. Padre Pio", 'memorial'],
  '09-29': ["Sts. Michael, Gabriel & Raphael", 'feast'],
  '10-01': ["St. Thérèse of Lisieux", 'memorial'],
  '10-02': ["Guardian Angels", 'memorial'],
  '10-04': ["St. Francis of Assisi", 'feast'],
  '10-05': ["St. Faustina Kowalska", 'memorial'],
  '10-07': ["Our Lady of the Rosary", 'memorial'],
  '10-15': ["St. Teresa of Avila", 'memorial'],
  '10-18': ["St. Luke", 'feast'],
  '10-19': ["Sts. Jean de Brébeuf & Isaac Jogues", 'memorial'],
  '10-22': ["St. John Paul II", 'memorial'],
  '10-28': ["Sts. Simon and Jude", 'feast'],
  '11-01': ["All Saints", 'solemnity'],
  '11-02': ["All Souls", 'solemnity'],
  '11-03': ["St. Martin de Porres", 'memorial'],
  '11-11': ["St. Martin of Tours", 'memorial'],
  '11-12': ["St. Josaphat", 'memorial'],
  '11-13': ["St. Frances Xavier Cabrini", 'memorial'],
  '11-17': ["St. Elizabeth of Hungary", 'memorial'],
  '11-21': ["Presentation of the Blessed Virgin Mary", 'memorial'],
  '11-22': ["St. Cecilia", 'memorial'],
  '11-24': ["Sts. Andrew Dung-Lac and Companions", 'memorial'],
  '11-30': ["St. Andrew", 'feast'],
  '12-03': ["St. Francis Xavier", 'memorial'],
  '12-06': ["St. Nicholas", 'memorial'],
  '12-07': ["St. Ambrose", 'memorial'],
  '12-08': ["The Immaculate Conception", 'solemnity'],
  '12-12': ["Our Lady of Guadalupe", 'feast'],
  '12-13': ["St. Lucy", 'memorial'],
  '12-14': ["St. John of the Cross", 'memorial'],
  '12-25': ["The Nativity of the Lord", 'solemnity'],
  '12-26': ["St. Stephen", 'feast'],
  '12-27': ["St. John the Evangelist", 'feast'],
  '12-28': ["The Holy Innocents", 'feast'],
};

/** Moveable feasts (Easter offsets / Advent Sundays), in the app's resolution order. */
const MOVEABLE_FEASTS_N: { name: string; rank: FeastRankN; easterOffset?: number; adventSunday?: number }[] = [
  { name: 'Ash Wednesday', rank: 'feast', easterOffset: -46 },
  { name: 'Palm Sunday', rank: 'solemnity', easterOffset: -7 },
  { name: 'Holy Thursday', rank: 'solemnity', easterOffset: -3 },
  { name: 'Good Friday', rank: 'solemnity', easterOffset: -2 },
  { name: 'Holy Saturday', rank: 'solemnity', easterOffset: -1 },
  { name: 'Easter Sunday', rank: 'solemnity', easterOffset: 0 },
  { name: 'Divine Mercy Sunday', rank: 'solemnity', easterOffset: 7 },
  { name: 'The Ascension', rank: 'solemnity', easterOffset: 39 },
  { name: 'Pentecost', rank: 'solemnity', easterOffset: 49 },
  { name: 'Trinity Sunday', rank: 'solemnity', easterOffset: 56 },
  { name: 'Corpus Christi', rank: 'solemnity', easterOffset: 63 },
  { name: 'The Sacred Heart', rank: 'solemnity', easterOffset: 68 },
  { name: 'Gaudete Sunday', rank: 'feast', adventSunday: 3 },
  { name: 'Laetare Sunday', rank: 'feast', easterOffset: -21 },
  { name: 'Christ the King', rank: 'solemnity', adventSunday: 0 },
];

/** The feast or solemnity on a date, or null on an ordinary day — the app's resolver, ported. */
export function resolveFeastDay(dateISO: string): FeastDayN | null {
  const { y, m, d } = parseISODate(dateISO);
  const easter = getEasterDateISO(y);
  const adventStart = getAdventStartISO(y);

  for (const feast of MOVEABLE_FEASTS_N) {
    if (feast.easterOffset !== undefined) {
      if (dateISO === addDaysISO(easter, feast.easterOffset)) return { name: feast.name, rank: feast.rank };
    } else if (feast.adventSunday !== undefined) {
      const offset = feast.adventSunday === 0 ? -7 : (feast.adventSunday - 1) * 7;
      if (dateISO === addDaysISO(adventStart, offset)) return { name: feast.name, rank: feast.rank };
    }
  }

  const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const fixed = FIXED_FEASTS_N[mmdd];
  return fixed ? { name: fixed[0], rank: fixed[1] } : null;
}

// ── Saint lines (ported from src/data/saints.ts) ──────────────────────────────

/**
 * The frame's one factual saint line: the first sentence of the saint entry's shortBio,
 * verbatim (spec §6.2). Keyed MM-DD, first entry wins where two saints share a date —
 * the same order the app keeps. A drift check pins this table against src/data/saints.ts.
 */
const SAINT_LINES_N: Record<string, { name: string; line: string }> = {
  '01-28': { name: "St. Thomas Aquinas", line: "The Dominican friar who married faith and reason." },
  '02-31': { name: "St. John Bosco", line: "A priest who dedicated his life to troubled youth, founding schools and orphanages for boys others had given up on." },
  '08-14': { name: "St. Maximilian Kolbe", line: "A Franciscan friar who volunteered to die in place of a stranger at Auschwitz." },
  '08-28': { name: "St. Augustine", line: "A philosopher, partygoer, and seeker who chased pleasure for years before his mother's prayers and a Bible verse brought him to his knees." },
  '08-27': { name: "St. Monica", line: "A mother who prayed for her wayward son Augustine for 17 years without giving up." },
  '09-23': { name: "St. Padre Pio", line: "A Capuchin friar who bore the stigmata for 50 years, heard confessions for hours daily, and could read souls." },
  '10-04': { name: "St. Francis of Assisi", line: "A rich young man who stripped naked in the town square, renounced his inheritance, and rebuilt the Church one stone at a time." },
  '10-01': { name: "St. Thérèse of Lisieux", line: "A cloistered Carmelite who died at 24 and taught the \"Little Way\" — doing small things with great love." },
  '07-31': { name: "St. Ignatius of Loyola", line: "A soldier whose leg was shattered by a cannonball." },
  '07-11': { name: "St. Benedict", line: "A young man who fled corrupt Rome for a cave in the mountains." },
  '10-15': { name: "St. Teresa of Avila", line: "A Carmelite reformer and mystic who wrote the Interior Castle." },
  '12-14': { name: "St. John of the Cross", line: "A Carmelite mystic and poet who was imprisoned by his own brothers in a dark cell for months." },
  '01-17': { name: "St. Anthony of the Desert", line: "The first monk." },
  '08-04': { name: "St. John Vianney", line: "A parish priest who barely passed seminary but became the patron of parish priests." },
  '09-05': { name: "St. Teresa of Calcutta", line: "A tiny nun who picked up the dying from the streets of Calcutta." },
  '10-22': { name: "St. John Paul II", line: "The pope who survived an assassination attempt, helped bring down communism, and wrote more encyclicals than any pope in history." },
  '06-22': { name: "St. Thomas More", line: "A lawyer, father, and Lord Chancellor who chose death over betraying his conscience." },
  '01-24': { name: "St. Francis de Sales", line: "A gentle bishop who won back thousands of Calvinists to the faith through kindness, not argument." },
  '08-20': { name: "St. Bernard of Clairvaux", line: "A Cistercian abbot who preached the Second Crusade, advised popes, and wrote luminous sermons on the Song of Songs." },
  '04-29': { name: "St. Catherine of Siena", line: "A Dominican tertiary who counseled popes and cared for the dying." },
  '06-13': { name: "St. Anthony of Padua", line: "A Franciscan preacher known for his eloquence and his love of the poor." },
  '01-02': { name: "St. Basil the Great", line: "A bishop who built hospitals, defended the faith against heresy, and wrote the rule of life still followed by Eastern monks." },
  '09-13': { name: "St. John Chrysostom", line: "The \"golden-mouthed\" preacher of Constantinople." },
  '10-05': { name: "St. Faustina Kowalska", line: "A Polish nun who received visions of Jesus as Divine Mercy." },
  '03-19': { name: "St. Joseph", line: "The quiet foster father of Jesus." },
  '06-29': { name: "St. Paul", line: "The persecutor turned apostle." },
  '06-24': { name: "St. John the Baptist", line: "The forerunner who ate locusts in the desert and pointed to the Lamb." },
  '09-29': { name: "St. Michael the Archangel", line: "The warrior angel who cast Satan from heaven." },
  '10-28': { name: "St. Jude Thaddeus", line: "The patron of lost causes." },
  '07-25': { name: "St. Christopher", line: "The patron of travelers." },
  '10-18': { name: "St. Luke", line: "A physician, painter, and the author of the Gospel of Luke and Acts." },
  '10-19': { name: "Sts. Jean de Brébeuf & Isaac Jogues", line: "French Jesuit missionaries who brought the Gospel to the Huron and Iroquois peoples of North America." },
  '04-25': { name: "St. Mark", line: "The Gospel writer who was Peter's interpreter and Paul's failed companion." },
  '09-21': { name: "St. Matthew", line: "A tax collector — a collaborator, a traitor to his people — who Jesus called from the counting table." },
  '11-01': { name: "All Saints", line: "The feast of everyone who made it home — the known and the unknown, the famous and the forgotten." },
  '11-02': { name: "All Souls", line: "The feast of the faithful departed." },
  '12-06': { name: "St. Nicholas", line: "A bishop who punched a heretic at the Council of Nicaea and secretly gave gold to poor girls so they could marry." },
  '12-13': { name: "St. Lucy", line: "A young Sicilian martyr who consecrated her virginity and was killed for it." },
  '12-07': { name: "St. Ambrose", line: "The bishop who baptized Augustine." },
  '12-26': { name: "St. Stephen", line: "The first martyr." },
  '12-27': { name: "St. John the Evangelist", line: "The beloved disciple who leaned on Jesus at the Last Supper." },
  '02-03': { name: "St. Blaise", line: "A bishop and martyr, patron of throat ailments." },
  '02-14': { name: "St. Valentine", line: "A priest and martyr who secretly married Christian couples." },
  '03-17': { name: "St. Patrick", line: "A kidnapped slave who escaped Ireland, returned as a bishop, and converted a nation." },
  '04-23': { name: "St. George", line: "A Roman soldier martyred for refusing to renounce Christ." },
  '05-22': { name: "St. Rita of Cascia", line: "A wife, mother, then widow, then nun." },
  '05-26': { name: "St. Philip Neri", line: "The \"Apostle of Rome\" who founded the Oratory." },
  '06-03': { name: "St. Charles Lwanga", line: "A young Ugandan page who was burned alive for resisting the king's abuse." },
  '06-05': { name: "St. Boniface", line: "The \"Apostle of Germany\" who chopped down the sacred oak of Thor and built a chapel from its wood." },
  '07-14': { name: "St. Camillus de Lellis", line: "A gambling addict and soldier who lost everything, found Christ in a hospital, and founded an order to serve the sick." },
  '07-22': { name: "St. Mary Magdalene", line: "The first witness of the Resurrection." },
  '07-23': { name: "St. Bridget of Sweden", line: "A mystic, mother of eight, and widow who founded an order and received revelations from Christ." },
  '08-11': { name: "St. Clare of Assisi", line: "A young noblewoman who fled an arranged marriage to follow Francis." },
  '08-10': { name: "St. Lawrence", line: "A deacon who was grilled alive — and joked \"Turn me over, I'm done on this side.\" He is the patron of comedians and cooks." },
  '08-08': { name: "St. Dominic", line: "The founder of the Order of Preachers." },
  '08-09': { name: "St. Edith Stein", line: "A Jewish philosopher who became a Carmelite nun and died at Auschwitz." },
  '08-21': { name: "St. Pius X", line: "A pope who lowered the age of First Communion and fought modernism." },
  '08-23': { name: "St. Rose of Lima", line: "The first saint of the Americas." },
  '09-03': { name: "St. Gregory the Great", line: "A monk made pope against his will." },
  '09-17': { name: "St. Robert Bellarmine", line: "A Jesuit cardinal and theologian who defended the faith against Protestant reformers." },
  '09-27': { name: "St. Vincent de Paul", line: "A priest who was captured by pirates, enslaved, and freed." },
  '09-28': { name: "St. Wenceslaus", line: "A duke of Bohemia who was murdered by his brother for being too Christian." },
  '09-30': { name: "St. Jerome", line: "The scholar who translated the Bible into Latin — the Vulgate." },
  '10-16': { name: "St. Margaret Mary Alacoque", line: "A Visitation nun who received visions of the Sacred Heart." },
  '11-03': { name: "St. Martin de Porres", line: "A Dominican lay brother in Lima — the illegitimate son of a freed slave." },
  '11-04': { name: "St. Charles Borromeo", line: "A cardinal who reformed the Church after the Council of Trent." },
  '11-11': { name: "St. Martin of Tours", line: "A Roman soldier who cut his cloak in half to share with a beggar — who turned out to be Christ." },
  '11-15': { name: "St. Albert the Great", line: "A Dominican bishop and scientist — the teacher of Aquinas." },
  '11-17': { name: "St. Elizabeth of Hungary", line: "A princess who built a hospital and served the sick with her own hands." },
  '11-12': { name: "St. Josaphat", line: "A Ruthenian archbishop martyred in 1623 for working to heal the split between East and West." },
  '11-21': { name: "Presentation of the Blessed Virgin Mary", line: "The feast of the child Mary presented in the Temple, offered wholly to God by her parents." },
  '11-24': { name: "Sts. Andrew Dung-Lac and Companions", line: "A Vietnamese priest beheaded in 1839 for refusing to renounce Christ — one of the 117 martyrs of Vietnam." },
  '11-22': { name: "St. Cecilia", line: "A Roman martyr and patron of musicians." },
  '11-30': { name: "St. Andrew", line: "The first apostle called — Peter's brother." },
  '12-03': { name: "St. Francis Xavier", line: "A Jesuit missionary who baptized tens of thousands in India, Indonesia, and Japan." },
  '12-08': { name: "Immaculate Conception", line: "The feast of Mary, preserved from original sin from the first moment of her existence." },
  '12-12': { name: "Our Lady of Guadalupe", line: "Mary appeared to Juan Diego, a poor indigenous man, and left her image on his tilma." },
  '12-21': { name: "St. Peter Canisius", line: "A Jesuit who defended the faith in Germany after the Reformation." },
  '01-20': { name: "St. Sebastian", line: "A Roman soldier who secretly served Christ until he was found out, shot full of arrows, and left for dead — then recovered and confronted the emperor again." },
  '05-15': { name: "St. Isidore the Farmer", line: "A poor farm laborer who prayed while he plowed." },
  '08-25': { name: "St. Louis IX", line: "King of France, father of eleven, crusader, and a man who washed the feet of the poor." },
  '10-24': { name: "St. Kaleb of Ethiopia", line: "A king of Ethiopia who answered the call to defend Christians being persecuted in Arabia." },
  '06-26': { name: "St. Josemaría Escrivá", line: "A priest who taught that ordinary work is a path to holiness." },
  '10-12': { name: "Blessed Carlo Acutis", line: "A teenager who loved computers, coding, and the Eucharist." },
  '11-23': { name: "St. Miguel Pro", line: "A Jesuit priest in Mexico who was executed by the government for his faith." },
  '02-23': { name: "St. Polycarp", line: "A disciple of the Apostle John, bishop of Smyrna, martyred at 86." },
  '06-21': { name: "St. Aloysius Gonzaga", line: "A young nobleman who gave up a fortune to join the Jesuits." },
  '03-15': { name: "St. Longinus", line: "The Roman centurion who pierced Christ's side with a spear and, seeing the blood and water, declared \"Truly this was the Son of God.\" A soldier who found faith at the cross." },
  '09-20': { name: "St. Eustace", line: "A Roman general who saw a stag with a cross between its antlers while hunting." },
  '01-21': { name: "St. Meinrad", line: "A hermit who lived in a forest in Switzerland." },
  '11-13': { name: "St. Frances Xavier Cabrini", line: "An Italian nun who crossed the Atlantic in 1889 and built schools, hospitals, and orphanages for immigrants across America." },
  '06-30': { name: "St. Adolf", line: "A monk in Spain who refused to renounce his faith before the Moors and was martyred." },
  '02-06': { name: "St. Paul Miki", line: "A Japanese Jesuit seminarian crucified with twenty-five companions in Nagasaki." },
  '08-16': { name: "St. Roch", line: "A pilgrim who ministered to plague victims until he caught the plague himself." },
  '04-21': { name: "St. Conrad of Parzham", line: "A porter at a Franciscan friary for forty-one years." },
  '10-06': { name: "St. Bruno", line: "The founder of the Carthusian order, the strictest monks in the Church." },
  '02-27': { name: "St. Gabriel Possenti", line: "A young Passionist seminarian known for his charm and holiness." },
};

/** The spoken saint line for a date, or null when the app has no saint entry for it. */
export function saintLineFor(dateISO: string): string | null {
  const { m, d } = parseISODate(dateISO);
  const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return SAINT_LINES_N[mmdd]?.line ?? null;
}

/** Person-like celebrations (a saint's feast) vs day/season names — ported from src/lib/celebration.ts. */
export function isPersonCelebration(name: string): boolean {
  return /^(st\.|saint|blessed|our lady|all saints|all souls|the holy)/i.test(name.trim());
}

// ── Week labels ───────────────────────────────────────────────────────────────

export interface WeekParts {
  weekday: string;
  /** Week number within the season (1-based), as the lectionary counts it. */
  week: number;
  /** 'Ordinary Time' | 'Advent' | 'Lent' | 'Easter'. */
  seasonName: 'Ordinary Time' | 'Advent' | 'Lent' | 'Easter';
}

/**
 * The season + week of a date, as the lectionary names them, or null when the date's
 * week has no lectionary label (the Christmas season, the Ash Wednesday stub week).
 * Mirrors the season boundaries of src/data/liturgicalCalendar.ts.
 */
export function computeWeekParts(dateISO: string): WeekParts | null {
  const { y } = parseISODate(dateISO);
  const easter = getEasterDateISO(y);
  const ashWednesday = addDaysISO(easter, -46);
  const pentecost = addDaysISO(easter, 49);
  const adventStart = getAdventStartISO(y);
  const christmas = toISODate(y, 12, 25);
  const baptism = baptismSundayISO(y);
  const weekday = weekdayNameOfISO(dateISO);
  const sunday = sundayOfWeekISO(dateISO);

  // Advent: from the first Advent Sunday until Christmas.
  if (dateISO >= adventStart && dateISO < christmas) {
    const week = 1 + weeksBetweenISO(adventStart, sunday);
    return week >= 1 && week <= 4 ? { weekday, week, seasonName: 'Advent' } : null;
  }
  // Christmas season carries no week label in the lectionary strings.
  if (dateISO >= christmas || dateISO < baptism) return null;
  // Lent: Ash Wednesday to Easter. The stub week before the First Sunday has no number.
  if (dateISO >= ashWednesday && dateISO < easter) {
    const firstLentSunday = addDaysISO(easter, -42);
    if (dateISO < firstLentSunday) return null;
    const week = 1 + weeksBetweenISO(firstLentSunday, sunday);
    return week >= 1 && week <= 5 ? { weekday, week, seasonName: 'Lent' } : null;
  }
  // Easter season: Easter Sunday opens week 1; Pentecost closes week 7.
  if (dateISO >= easter && dateISO <= pentecost) {
    const week = 1 + weeksBetweenISO(easter, sunday);
    return week >= 1 && week <= 7 ? { weekday, week, seasonName: 'Easter' } : null;
  }
  // Ordinary Time, first half: the Baptism week is week 1.
  if (dateISO < ashWednesday) {
    const week = 1 + weeksBetweenISO(baptismSundayISO(y), sunday);
    return week >= 1 && week <= 34 ? { weekday, week, seasonName: 'Ordinary Time' } : null;
  }
  // Ordinary Time, second half: counted back from Christ the King, the 34th week.
  const christKing = addDaysISO(adventStart, -7);
  const week = 34 - weeksBetweenISO(sunday, christKing);
  return week >= 1 && week <= 34 ? { weekday, week, seasonName: 'Ordinary Time' } : null;
}

/**
 * The full spoken label the feria frame would carry on its own: "Friday of the
 * Thirtieth Week in Ordinary Time". Null when the week has no label (§6.1 fallback).
 */
export function computeWeekLabel(dateISO: string): string | null {
  const parts = computeWeekParts(dateISO);
  if (!parts) return null;
  const ordinal = ordinalWords(parts.week);
  return parts.seasonName === 'Ordinary Time'
    ? `${parts.weekday} of the ${ordinal} Week in Ordinary Time`
    : `${parts.weekday} of the ${ordinal} Week of ${parts.seasonName}`;
}

/** The short week phrase the teaser uses: "the Thirtieth Week". Null when unlabeled. */
export function computeWeekShort(dateISO: string): string | null {
  const parts = computeWeekParts(dateISO);
  return parts ? `the ${ordinalWords(parts.week)} Week` : null;
}

// ── Variant selection — date-keyed, deterministic (spec §5.5) ─────────────────

export type SelectionSlot =
  | 'signOnAM' | 'signOnPM' | 'signOff' | 'sceneLeadIn' | 'teaser'
  | 'soberSignOnAM' | 'soberSignOnPM';

/** djb2 over the selection key, mod count. Same inputs → same choice, forever. */
export function pickVariant(dateISO: string, personaId: string, slot: string, count: number): number {
  if (count <= 1) return 0;
  const key = `${dateISO}:${personaId}:${slot}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
}

// ── Suppression and sober gear (spec §7) — calendar + citation only ───────────

export function isGoodFriday(dateISO: string): boolean {
  const { y } = parseISODate(dateISO);
  return dateISO === addDaysISO(getEasterDateISO(y), -2);
}

export function isHolySaturday(dateISO: string): boolean {
  const { y } = parseISODate(dateISO);
  return dateISO === addDaysISO(getEasterDateISO(y), -1);
}

/** The Passion accounts, by book and chapter range (spec §7). */
const PASSION_RANGES: Record<string, [number, number]> = {
  Matthew: [26, 27],
  Mark: [14, 15],
  Luke: [22, 23],
  John: [18, 19],
};

/**
 * The chapters a Gospel citation touches, across its spans: "Luke 14:1, 7-11" → [14];
 * "Matthew 26:14—27:66" → [26, 27]; "John 18:1—19:42" → [18, 19].
 */
export function citationChapters(citation: string): { book: string; chapters: number[] } | null {
  const match = citation.trim().match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z\s.]*?)\s+(.+)$/);
  if (!match) return null;
  const book = match[1].trim().replace(/\s+/g, ' ');
  const rest = match[2];
  const chapters = new Set<number>();
  // Cross-chapter spans: "26:14—27:66" (em dash, en dash, or hyphen between chapters).
  const span = rest.match(/(\d+)\s*:\s*\d+\s*[—–-]\s*(\d+)\s*:/);
  if (span) {
    const from = parseInt(span[1], 10);
    const to = parseInt(span[2], 10);
    for (let c = from; c <= to; c++) chapters.add(c);
    return { book, chapters: [...chapters].sort((a, b) => a - b) };
  }
  const single = rest.match(/^(\d+)\s*:/) ?? rest.match(/^(\d+)\b/);
  if (single) chapters.add(parseInt(single[1], 10));
  return { book, chapters: [...chapters] };
}

/** True when the day's Gospel citation intersects a Passion account. */
export function gospelTouchesPassion(citation: string): boolean {
  const parsed = citationChapters(citation);
  if (!parsed) return false;
  const range = PASSION_RANGES[parsed.book];
  if (!range) return false;
  return parsed.chapters.some((c) => c >= range[0] && c <= range[1]);
}

/** Sober gear (spec §7): Good Friday, Holy Saturday, or a Passion Gospel. */
export function isSoberDay(dateISO: string, gospelCitation: string): boolean {
  return isGoodFriday(dateISO) || isHolySaturday(dateISO) || gospelTouchesPassion(gospelCitation);
}

/** The teaser is suppressed outright on Good Friday and Holy Saturday (spec §7). */
export function isTeaserSuppressed(dateISO: string): boolean {
  return isGoodFriday(dateISO) || isHolySaturday(dateISO);
}

// ── Gospel citation helpers ───────────────────────────────────────────────────

const SPOKEN_BOOK_PREFIX: Record<string, string> = { '1': 'First', '2': 'Second', '3': 'Third' };

/** "Luke" from "Luke 14:1-6" — the evangelist named in the Gospel introduction. */
export function evangelistOf(citation: string): string | null {
  const parsed = citationChapters(citation);
  if (!parsed) return null;
  const parts = parsed.book.split(' ');
  const last = parts[parts.length - 1];
  return last || null;
}

/** "Luke 14:1, 7-11" → "Luke, chapter fourteen" (verses dropped, spec §6.5). */
export function bookChapterSpoken(citation: string): string | null {
  const parsed = citationChapters(citation);
  if (!parsed || parsed.chapters.length === 0) return null;
  const parts = parsed.book.split(' ');
  const spokenParts = parts.map((p, i) => (i === 0 && SPOKEN_BOOK_PREFIX[p] ? SPOKEN_BOOK_PREFIX[p] : p));
  return `${spokenParts.join(' ')}, chapter ${numberWords(parsed.chapters[0])}`;
}

// ── The bank (Charter Zone 3 — fixed, human-approved) ─────────────────────────
//
// Provenance: unmarked lines are the approved bank v2 text (the character-pass sheets,
// approved by Erik Nov 2, 2026), split into AM/PM sets per spec §5.3 — morning-leaning
// lines sit in AM; time-neutral approved lines may sit in both. Lines marked
// `// DRAFT §5.3` are new text written for this build (the PM sets, the sober sets, and
// slots bank v2 never had). They are listed in DRAFT_BANK_LINES; Erik approved them all
// as written on Nov 2, 2026 (spec §5.3 gate cleared).

export interface PauseBeats {
  afterScene: number;
  afterGospel: number;
  beforeChallenge: number;
  afterChallenge: number;
}

export interface PersonaBank {
  voice: string;
  tempo: number;
  pauseBeats: PauseBeats;
  signOnsAM: string[];
  signOnsPM: string[];
  signOffs: string[];
  /** Templates with slots {label} {weekday} — the label is the bundle's spoken feria string. */
  frameFeriaAM: string;
  frameFeriaPM: string;
  /** Templates with slots {label} {celebration} {saintLine} (saintLine carries its own leading space or is empty). */
  frameMemorialAM: string;
  frameMemorialPM: string;
  sceneLeadIns: string[];
  reflectionHandoff: string;
  /** Template with a {facetLower} slot. */
  challengeHandoff: string;
  /** Templates with slots {tomorrowWeekday} {tomorrowCelebration} {tomorrowWeek} {bookChapter}. */
  teaserTemplates: string[];
  soberSignOnsAM: string[];
  soberSignOnsPM: string[];
  /** Slotless by design — a solemn day needs no week arithmetic to name it. */
  soberFrame: string;
}

const NO_BEATS: PauseBeats = { afterScene: 0, afterGospel: 0, beforeChallenge: 0, afterChallenge: 0 };

export const BANK: Record<PersonaId, PersonaBank> = {
  henry: {
    voice: 'Algenib',
    tempo: 0.88,
    pauseBeats: { afterScene: 1, afterGospel: 1, beforeChallenge: 1, afterChallenge: 1 },
    signOnsAM: [
      "Well. Let's see what He has for us today.",
      "Well. Sit down a minute. He's never in a hurry, and neither are we.",
      "Well. I've heard these Gospels a good many years now. They haven't worn out. Listen.",
    ],
    signOnsPM: [
      "Well. Let's see what He has for us today.",
      "Well. Sit down a minute. He's never in a hurry, and neither are we.",
    ],
    signOffs: [
      "Same time tomorrow. He'll be here. So will I.",
      "That's enough for today. Same time tomorrow — He'll be here, and so will I.",
    ],
    frameFeriaAM: "It's {label}. No feast today. An ordinary day — and He shows up in those, same as the great ones.",
    frameFeriaPM: "It's {label}. No feast today. An ordinary day — and He shows up in those, same as the great ones.",
    frameMemorialAM: "It's {label} — and today the Church gives us {celebration}.{saintLine}", // DRAFT §5.3
    frameMemorialPM: "It's {label} — and today the Church gives us {celebration}.{saintLine}", // DRAFT §5.3
    sceneLeadIns: [
      'See the scene:', // DRAFT §5.3
      'Look at the room:', // DRAFT §5.3
    ],
    reflectionHandoff: "Listen to that silence once more. Here is today's reflection.",
    challengeHandoff: "And here is today's challenge — {facetLower}.",
    teaserTemplates: [
      "Tomorrow's {tomorrowWeekday} — and the Gospel is {bookChapter}.",
      "Tomorrow is {tomorrowWeekday} — {tomorrowCelebration}. The Gospel is {bookChapter}.", // DRAFT §5.3
    ],
    soberSignOnsAM: ["Well. Today is a solemn day. Sit down, and let's hear it."], // DRAFT §5.3
    soberSignOnsPM: ["Well. The day is nearly done, and it is a solemn one. Let's hear the Gospel."], // DRAFT §5.3
    soberFrame: 'A solemn day on the calendar. We keep it quietly.', // DRAFT §5.3
  },

  coach: {
    voice: 'Sadachbia',
    tempo: 1.08,
    pauseBeats: { ...NO_BEATS },
    signOnsAM: [
      "Let's get after it.",
      "First rep of the day. Let's get after the Gospel.",
      'No speeches today. Just the Gospel, then we work.',
    ],
    signOnsPM: [
      "Let's get after it.",
      'No speeches today. Just the Gospel, then we work.',
    ],
    signOffs: [
      'Now go live it.',
      "That's the word. Now go live it.",
    ],
    frameFeriaAM: '{label}. No feast today. Just a regular {weekday} — and regular days are where this gets built.',
    frameFeriaPM: '{label}. No feast today. Just a regular {weekday} — and regular days are where this gets built.',
    frameMemorialAM: '{label} — and today the Church gives us {celebration}.{saintLine}', // DRAFT §5.3
    frameMemorialPM: '{label} — and today the Church gives us {celebration}.{saintLine}', // DRAFT §5.3
    sceneLeadIns: [
      "Here's the scene.",
      'Watch this scene.', // DRAFT §5.3
    ],
    reflectionHandoff: "Sit with that for a second. Here's today's reflection.",
    challengeHandoff: 'Now the challenge — {facetLower}.',
    teaserTemplates: [
      'Tomorrow: {tomorrowWeekday}. {bookChapter}. Be ready.',
      'Tomorrow: {tomorrowCelebration}. The Gospel is {bookChapter}.', // DRAFT §5.3
    ],
    soberSignOnsAM: ['No speeches today. This one we just hear.'], // DRAFT §5.3
    soberSignOnsPM: ['No speeches tonight. This one we just hear.'], // DRAFT §5.3
    soberFrame: 'A hard, holy day. We take it straight.', // DRAFT §5.3
  },

  frank: {
    voice: 'Zubenelgenubi',
    tempo: 1.0,
    pauseBeats: { ...NO_BEATS, afterGospel: 1 },
    signOnsAM: [
      'Alright. Boots on. First things first.',
      "Alright. Day's already moving. Gospel before the work.",
      'Alright. Before the day gets loud — the Gospel.', // DRAFT §5.3
    ],
    signOnsPM: [
      'Alright. Tools down a minute. First things first.',
      'Alright. The work can wait a minute. Gospel first.', // DRAFT §5.3
    ],
    signOffs: [
      'Now go build something that lasts.',
      "That's the day's first job done. Now go build something that lasts.",
    ],
    frameFeriaAM: "{label}. No feast today. Plain workday — He's in it all the same.",
    frameFeriaPM: "{label}. No feast today. Plain workday — He's in it all the same.",
    frameMemorialAM: '{label} — and today the Church gives us {celebration}.{saintLine}', // DRAFT §5.3
    frameMemorialPM: '{label} — and today the Church gives us {celebration}.{saintLine}', // DRAFT §5.3
    sceneLeadIns: [
      "Here's the picture:", // DRAFT §5.3
      'The scene:', // DRAFT §5.3
    ],
    reflectionHandoff: "Here's today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}.",
    teaserTemplates: [
      'Tomorrow: {tomorrowWeekday}. {bookChapter}.',
      'Tomorrow: {tomorrowCelebration}. The Gospel is {bookChapter}.', // DRAFT §5.3
    ],
    soberSignOnsAM: ['Alright. Quiet today. Just the Gospel, plain.'], // DRAFT §5.3
    soberSignOnsPM: ['Alright. Tools down. A solemn one today — just the Gospel.'], // DRAFT §5.3
    soberFrame: 'A solemn day. Plain and quiet, like it should be.', // DRAFT §5.3
  },

  ben: {
    voice: 'Iapetus',
    tempo: 1.0,
    pauseBeats: { ...NO_BEATS },
    signOnsAM: [
      "Morning, brother. Let's start where we always start.",
      'Morning, brother. Before the house wakes — the Gospel first.',
      "Brother, it's midweek — right where habits are won and lost. Let's hear the Gospel.",
    ],
    signOnsPM: [
      "Brother, it's midweek — right where habits are won and lost. Let's hear the Gospel.",
      "Evening, brother. The day's nearly done — let's hear the Gospel before it is.", // DRAFT §5.3
      'Brother. Whatever today was, end it here — with the Gospel.', // DRAFT §5.3
    ],
    signOffs: [
      'Pray first. Then fight.',
      'Same time tomorrow, brother. Pray first. Then fight.',
    ],
    frameFeriaAM: "It's {label}. No feast today — an ordinary {weekday}.",
    frameFeriaPM: "It's {label}. No feast today — an ordinary {weekday}.",
    frameMemorialAM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    frameMemorialPM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    sceneLeadIns: [
      "Here's the scene:",
      "Here's the room:", // DRAFT §5.3
    ],
    reflectionHandoff: "Sit with that a second. Here's today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}. One thing, today:",
    teaserTemplates: [
      "Tomorrow's {tomorrowWeekday}, still {tomorrowWeek} — and the Gospel is {bookChapter}.",
      'Tomorrow is {tomorrowWeekday} — {tomorrowCelebration}. The Gospel is {bookChapter}.', // DRAFT §5.3
    ],
    soberSignOnsAM: ['Morning, brother. A hard day today. We read it anyway.'], // DRAFT §5.3
    soberSignOnsPM: ['Evening, brother. A hard day. We end it with the Gospel anyway.'], // DRAFT §5.3
    soberFrame: 'A solemn day — we take it as it comes.', // DRAFT §5.3
  },

  martin: {
    voice: 'Schedar',
    tempo: 0.94,
    pauseBeats: { afterScene: 1, afterGospel: 1, beforeChallenge: 0, afterChallenge: 1 },
    signOnsAM: [
      "The hour is His. Let's keep it.",
      "Another hour, given. Let's spend this one on the Gospel.",
      'We keep the hours, and the hours keep us. Begin.',
    ],
    signOnsPM: [
      "The hour is His. Let's keep it.",
      'We keep the hours, and the hours keep us. Begin.',
    ],
    signOffs: [
      'Keep the rhythm.',
      "Until tomorrow's hour. Keep the rhythm.",
    ],
    frameFeriaAM: '{label}. The calendar gives no feast today — an ordinary hour, kept like all the rest.',
    frameFeriaPM: '{label}. The calendar gives no feast today — an ordinary hour, kept like all the rest.',
    frameMemorialAM: '{label}. Today the hours carry {celebration}.{saintLine}',
    frameMemorialPM: '{label}. Today the hours carry {celebration}.{saintLine}',
    sceneLeadIns: [
      'See the scene:', // DRAFT §5.3
      'Picture the room:', // DRAFT §5.3
    ],
    reflectionHandoff: "Keep that room in mind. Here is today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}.",
    teaserTemplates: [
      'Tomorrow is {tomorrowWeekday} — {tomorrowCelebration}. The Gospel is {bookChapter}.',
      'Tomorrow, {tomorrowWeekday} of {tomorrowWeek} — the Gospel is {bookChapter}.', // DRAFT §5.3
    ],
    soberSignOnsAM: ["The hour is His — and today it is a solemn one. Let's keep it."], // DRAFT §5.3
    soberSignOnsPM: ["Another hour, given — a solemn one. Let's keep it."], // DRAFT §5.3
    soberFrame: 'A solemn day. The hours are kept quietly today.', // DRAFT §5.3
  },

  tom: {
    voice: 'Enceladus',
    tempo: 0.9,
    pauseBeats: { ...NO_BEATS, afterGospel: 1, afterChallenge: 1 },
    signOnsAM: [
      "Whatever hour this finds you — He's awake. Listen.",
      "The watch is ending. He's been with you all night. Listen.", // DRAFT §5.3
      "Morning's coming. One more thing before you rest — the Gospel.", // DRAFT §5.3
    ],
    signOnsPM: [
      "Still up? You're not the only one.",
      "The dark hours are His hours too. Here's the Gospel.",
      "Whatever hour this finds you — He's awake. Listen.",
    ],
    signOffs: [
      'He keeps watch with you. Rest when you can.',
      // Approved as written — Tom's night register is the Charter's deliberate change of
      // key, and it stands in his sign-off too (the §5.4 lint exempts this one slot).
      'The watch goes on tonight. He keeps watch with you. Rest when you can.',
    ],
    frameFeriaAM: '{label}. No feast on the calendar. An ordinary watch, ending — He keeps those, too.', // DRAFT §5.3
    frameFeriaPM: '{label}. No feast on the calendar tonight. An ordinary watch — He keeps those, too.',
    frameMemorialAM: '{label} — and today the Church gives us {celebration}.{saintLine}', // DRAFT §5.3
    frameMemorialPM: '{label}. Tonight the Church gives us {celebration}.{saintLine}', // DRAFT §5.3
    sceneLeadIns: [
      'The scene, plain:', // DRAFT §5.3
      'Look:', // DRAFT §5.3
    ],
    reflectionHandoff: "Sit in that silence a moment. Here's today's reflection.",
    challengeHandoff: 'And the challenge — {facetLower}.',
    teaserTemplates: [
      "Tomorrow is {tomorrowWeekday}, the week's end. The Gospel is {bookChapter}.",
      'Tomorrow: {tomorrowCelebration}. The Gospel is {bookChapter}.', // DRAFT §5.3
    ],
    soberSignOnsAM: ["The watch ends on a solemn morning. He's here. Listen."], // DRAFT §5.3
    soberSignOnsPM: ["Still up? Tonight of all nights — He's here. Listen."], // DRAFT §5.3
    soberFrame: 'A solemn watch. We keep it with Him.', // DRAFT §5.3
  },

  ed: {
    voice: 'Achird',
    tempo: 1.02,
    pauseBeats: { ...NO_BEATS, afterGospel: 1 },
    signOnsAM: [
      "Morning. Coffee's on. Let's sit a minute.",
      'Morning, neighbor. Pull up a chair — Gospel first, then the day.',
      'Morning. You look like you could use a minute. Here it is.',
    ],
    signOnsPM: [
      "Evening, neighbor. Pull up a chair — Gospel before the day's done.", // DRAFT §5.3
      "Neighbor. Day's winding down. Let's sit a minute with the Gospel.", // DRAFT §5.3
    ],
    signOffs: [
      "I'll be here tomorrow.",
      "You know where to find me. I'll be here tomorrow.",
    ],
    frameFeriaAM: "It's {label}. No feast today — just an ordinary {weekday}, the kind most of life is made of.",
    frameFeriaPM: "It's {label}. No feast today — just an ordinary {weekday}, the kind most of life is made of.",
    frameMemorialAM: "It's {label} — and today the Church gives us {celebration}.{saintLine}", // DRAFT §5.3
    frameMemorialPM: "It's {label} — and today the Church gives us {celebration}.{saintLine}", // DRAFT §5.3
    sceneLeadIns: [
      'Picture this:',
      "Here's the scene:", // DRAFT §5.3
    ],
    reflectionHandoff: "Now here's today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}.",
    teaserTemplates: [
      "Tomorrow's {tomorrowWeekday} — {tomorrowCelebration} — and the Gospel is {bookChapter}.",
      'Tomorrow is {tomorrowWeekday}. The Gospel is {bookChapter}.', // DRAFT §5.3
    ],
    soberSignOnsAM: ["Morning, neighbor. A solemn one today. Let's sit with it."], // DRAFT §5.3
    soberSignOnsPM: ["Evening, neighbor. A solemn day, this one. Let's sit with it a while."], // DRAFT §5.3
    soberFrame: "A solemn day — the kind we don't rush past.", // DRAFT §5.3
  },
};

/** The Lector's whole bank: ritual formulas only (Charter §4, spec §5.2). */
export const LECTOR_BANK = {
  voice: 'Charon',
  tempo: 1.0,
  pauseBeats: { ...NO_BEATS } as PauseBeats,
  frameSolemnity: '{weekday} — and today the Church keeps the Solemnity of {celebrationBare}.',
  reflectionHandoff: "Today's reflection.",
  challengeHandoff: "Today's challenge — {facetLower}.", // DRAFT §5.3 (formulation)
};

// ── The women's company (Charter addendum, Nov 11, 2026) ──────────────────────
//
// Cast by Erik on Nov 11, 2026, reversing the earlier women's-audio exclusion. The
// sheets live in the charter's addendum; the bank below is their voice in the same
// Zone 3 discipline as the men's: selected, never improvised; framing points at
// the text, never concludes it. Each woman's sign-on and brand sign-off are her
// sheet's canonical lines; the remaining variants were authored for this build in
// her register, mirroring her weekday counterpart's devotion and cadence profile.
// Voices are Gemini TTS stock, assigned by descriptor in the charter's table.

export const BANK_WOMEN: Record<WomenPersonaId, PersonaBank> = {
  ruth: {
    voice: 'Gacrux',
    tempo: 0.88,
    pauseBeats: { afterScene: 1, afterGospel: 1, beforeChallenge: 1, afterChallenge: 1 },
    signOnsAM: [
      "Well. Let's see what He has for us today.",
      "Well. Sit down a minute. He's never in a hurry, and neither are we.",
      "Well. I've heard these Gospels a good many years now. They haven't worn out. Listen.",
    ],
    signOnsPM: [
      "Well. Let's see what He has for us today.",
      "Well. Sit down a minute. He's never in a hurry, and neither are we.",
    ],
    signOffs: [
      "Same time tomorrow. He'll be here. So will I.",
      "That's enough for today. Same time tomorrow — He'll be here, and so will I.",
    ],
    frameFeriaAM: "It's {label}. No feast today. An ordinary day — and He shows up in those, same as the great ones.",
    frameFeriaPM: "It's {label}. No feast today. An ordinary day — and He shows up in those, same as the great ones.",
    frameMemorialAM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    frameMemorialPM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    sceneLeadIns: [
      'See the scene:',
      'Look at the room:',
    ],
    reflectionHandoff: "Listen to that silence once more. Here is today's reflection.",
    challengeHandoff: "And here is today's challenge — {facetLower}.",
    teaserTemplates: [
      "Tomorrow's {tomorrowWeekday} — and the Gospel is {bookChapter}.",
      "Tomorrow is {tomorrowWeekday} — {tomorrowCelebration}. The Gospel is {bookChapter}.",
    ],
    soberSignOnsAM: ["Well. Today is a solemn day. Sit down, and let's hear it."],
    soberSignOnsPM: ["Well. The day is nearly done, and it is a solemn one. Let's hear the Gospel."],
    soberFrame: 'A solemn day on the calendar. We keep it quietly.',
  },

  dana: {
    voice: 'Kore',
    tempo: 1.08,
    pauseBeats: { ...NO_BEATS },
    signOnsAM: [
      "Let's get after it.",
      "First rep of the day. Let's get after the Gospel.",
      'No speeches today. Just the Gospel, then we work.',
    ],
    signOnsPM: [
      "Let's get after it.",
      'No speeches today. Just the Gospel, then we work.',
    ],
    signOffs: [
      'Now go live it.',
      "That's the word. Now go live it.",
    ],
    frameFeriaAM: '{label}. No feast today. Just a regular {weekday} — and regular days are where this gets built.',
    frameFeriaPM: '{label}. No feast today. Just a regular {weekday} — and regular days are where this gets built.',
    frameMemorialAM: '{label} — and today the Church gives us {celebration}.{saintLine}',
    frameMemorialPM: '{label} — and today the Church gives us {celebration}.{saintLine}',
    sceneLeadIns: [
      "Here's the scene.",
      'Watch this scene.',
    ],
    reflectionHandoff: "Sit with that for a second. Here's today's reflection.",
    challengeHandoff: 'Now the challenge — {facetLower}.',
    teaserTemplates: [
      'Tomorrow: {tomorrowWeekday}. {bookChapter}. Be ready.',
      'Tomorrow: {tomorrowCelebration}. The Gospel is {bookChapter}.',
    ],
    soberSignOnsAM: ['No speeches today. This one we just hear.'],
    soberSignOnsPM: ['No speeches tonight. This one we just hear.'],
    soberFrame: 'A hard, holy day. We take it straight.',
  },

  grace: {
    voice: 'Pulcherrima',
    tempo: 1.0,
    pauseBeats: { ...NO_BEATS, afterGospel: 1 },
    signOnsAM: [
      'Alright. First things first.',
      "Alright. Day's already moving. Gospel before the work.",
      'Alright. Before the day gets loud — the Gospel.',
    ],
    signOnsPM: [
      'Alright. The work can wait a minute. First things first.',
      'Alright. Tools down a minute. Gospel first.',
    ],
    signOffs: [
      'Now go do the next right thing.',
      "That's the day's first job done. Now go do the next right thing.",
    ],
    frameFeriaAM: "{label}. No feast today. Plain workday — He's in it all the same.",
    frameFeriaPM: "{label}. No feast today. Plain workday — He's in it all the same.",
    frameMemorialAM: '{label} — and today the Church gives us {celebration}.{saintLine}',
    frameMemorialPM: '{label} — and today the Church gives us {celebration}.{saintLine}',
    sceneLeadIns: [
      "Here's the picture:",
      'The scene:',
    ],
    reflectionHandoff: "Here's today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}.",
    teaserTemplates: [
      'Tomorrow: {tomorrowWeekday}. {bookChapter}.',
      'Tomorrow: {tomorrowCelebration}. The Gospel is {bookChapter}.',
    ],
    soberSignOnsAM: ['Alright. Quiet today. Just the Gospel, plain.'],
    soberSignOnsPM: ['Alright. Tools down. A solemn one today — just the Gospel.'],
    soberFrame: 'A solemn day. Plain and quiet, like it should be.',
  },

  claire: {
    voice: 'Erinome',
    tempo: 1.0,
    pauseBeats: { ...NO_BEATS },
    signOnsAM: [
      "Morning, sister. Let's start where we always start.",
      'Morning, sister. Before the house wakes — the Gospel first.',
      "Sister, it's midweek — right where habits are won and lost. Let's hear the Gospel.",
    ],
    signOnsPM: [
      "Sister, it's midweek — right where habits are won and lost. Let's hear the Gospel.",
      "Evening, sister. The day's nearly done — let's hear the Gospel before it is.",
      'Sister. Whatever today was, end it here — with the Gospel.',
    ],
    signOffs: [
      'Pray first. Then fight.',
      'Same time tomorrow, sister. Pray first. Then fight.',
    ],
    frameFeriaAM: "It's {label}. No feast today — an ordinary {weekday}.",
    frameFeriaPM: "It's {label}. No feast today — an ordinary {weekday}.",
    frameMemorialAM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    frameMemorialPM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    sceneLeadIns: [
      "Here's the scene:",
      "Here's the room:",
    ],
    reflectionHandoff: "Sit with that a second. Here's today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}. One thing, today:",
    teaserTemplates: [
      "Tomorrow's {tomorrowWeekday}, still {tomorrowWeek} — and the Gospel is {bookChapter}.",
      'Tomorrow is {tomorrowWeekday} — {tomorrowCelebration}. The Gospel is {bookChapter}.',
    ],
    soberSignOnsAM: ['Morning, sister. A hard day today. We read it anyway.'],
    soberSignOnsPM: ['Evening, sister. A hard day. We end it with the Gospel anyway.'],
    soberFrame: 'A solemn day — we take it as it comes.',
  },

  marta: {
    voice: 'Despina',
    tempo: 0.94,
    pauseBeats: { afterScene: 1, afterGospel: 1, beforeChallenge: 0, afterChallenge: 1 },
    signOnsAM: [
      "The hour is His. Let's keep it.",
      "Another hour, given. Let's spend this one on the Gospel.",
      'We keep the hours, and the hours keep us. Begin.',
    ],
    signOnsPM: [
      "The hour is His. Let's keep it.",
      'We keep the hours, and the hours keep us. Begin.',
    ],
    signOffs: [
      'Keep the rhythm.',
      "Until tomorrow's hour. Keep the rhythm.",
    ],
    frameFeriaAM: '{label}. The calendar gives no feast today — an ordinary hour, kept like all the rest.',
    frameFeriaPM: '{label}. The calendar gives no feast today — an ordinary hour, kept like all the rest.',
    frameMemorialAM: '{label}. Today the hours carry {celebration}.{saintLine}',
    frameMemorialPM: '{label}. Today the hours carry {celebration}.{saintLine}',
    sceneLeadIns: [
      'See the scene:',
      'Picture the room:',
    ],
    reflectionHandoff: "Keep that room in mind. Here is today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}.",
    teaserTemplates: [
      'Tomorrow is {tomorrowWeekday} — {tomorrowCelebration}. The Gospel is {bookChapter}.',
      'Tomorrow, {tomorrowWeekday} of {tomorrowWeek} — the Gospel is {bookChapter}.',
    ],
    soberSignOnsAM: ["The hour is His — and today it is a solemn one. Let's keep it."],
    soberSignOnsPM: ["Another hour, given — a solemn one. Let's keep it."],
    soberFrame: 'A solemn day. The hours are kept quietly today.',
  },

  june: {
    voice: 'Sulafat',
    tempo: 0.9,
    pauseBeats: { ...NO_BEATS, afterGospel: 1, afterChallenge: 1 },
    signOnsAM: [
      "Whatever hour this finds you — He's awake. Listen.",
      "The watch is ending. He's been with you all night. Listen.",
      "Morning's coming. One more thing before you rest — the Gospel.",
    ],
    signOnsPM: [
      "Still up? You're not the only one.",
      "The dark hours are His hours too. Here's the Gospel.",
      "Whatever hour this finds you — He's awake. Listen.",
    ],
    signOffs: [
      'He keeps watch with you. Rest when you can.',
      'The watch goes on. He keeps watch with you. Rest when you can.',
    ],
    frameFeriaAM: '{label}. No feast on the calendar. An ordinary watch, ending — He keeps those, too.',
    frameFeriaPM: '{label}. No feast on the calendar tonight. An ordinary watch — He keeps those, too.',
    frameMemorialAM: '{label} — and today the Church gives us {celebration}.{saintLine}',
    frameMemorialPM: '{label}. Tonight the Church gives us {celebration}.{saintLine}',
    sceneLeadIns: [
      'The scene, plain:',
      'Look:',
    ],
    reflectionHandoff: "Sit in that silence a moment. Here's today's reflection.",
    challengeHandoff: 'And the challenge — {facetLower}.',
    teaserTemplates: [
      "Tomorrow is {tomorrowWeekday}, the week's end. The Gospel is {bookChapter}.",
      'Tomorrow: {tomorrowCelebration}. The Gospel is {bookChapter}.',
    ],
    soberSignOnsAM: ["The watch ends on a solemn morning. He's here. Listen."],
    soberSignOnsPM: ["Still up? Tonight of all nights — He's here. Listen."],
    soberFrame: 'A solemn watch. We keep it with Him.',
  },

  rose: {
    voice: 'Callirrhoe',
    tempo: 1.02,
    pauseBeats: { ...NO_BEATS, afterGospel: 1 },
    signOnsAM: [
      "Morning. Coffee's on. Let's sit a minute.",
      'Morning, neighbor. Pull up a chair — Gospel first, then the day.',
      'Morning. You look like you could use a minute. Here it is.',
    ],
    signOnsPM: [
      "Evening, neighbor. Pull up a chair — Gospel before the day's done.",
      "Neighbor. Day's winding down. Let's sit a minute with the Gospel.",
    ],
    signOffs: [
      "I'll be here tomorrow.",
      "You know where to find me. I'll be here tomorrow.",
    ],
    frameFeriaAM: "It's {label}. No feast today — just an ordinary {weekday}, the kind most of life is made of.",
    frameFeriaPM: "It's {label}. No feast today — just an ordinary {weekday}, the kind most of life is made of.",
    frameMemorialAM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    frameMemorialPM: "It's {label} — and today the Church gives us {celebration}.{saintLine}",
    sceneLeadIns: [
      'Picture this:',
      "Here's the scene:",
    ],
    reflectionHandoff: "Now here's today's reflection.",
    challengeHandoff: "And today's challenge — {facetLower}.",
    teaserTemplates: [
      "Tomorrow's {tomorrowWeekday} — {tomorrowCelebration} — and the Gospel is {bookChapter}.",
      'Tomorrow is {tomorrowWeekday}. The Gospel is {bookChapter}.',
    ],
    soberSignOnsAM: ["Morning, neighbor. A solemn one today. Let's sit with it."],
    soberSignOnsPM: ["Evening, neighbor. A solemn day, this one. Let's sit with it a while."],
    soberFrame: "A solemn day — the kind we don't rush past.",
  },
};

/** The women's Lector: the same ritual formulas, her own voice and formal profile. */
export const LECTOR_BANK_WOMEN = {
  voice: 'Autonoe',
  tempo: 1.0,
  pauseBeats: { ...NO_BEATS } as PauseBeats,
  frameSolemnity: '{weekday} — and today the Church keeps the Solemnity of {celebrationBare}.',
  reflectionHandoff: "Today's reflection.",
  challengeHandoff: "Today's challenge — {facetLower}.",
};

/** All Souls (Nov 2) — the commemoration frame, approved wording (character-pass sheet). */
export const COMMEMORATION_FRAME =
  '{weekday} — today is All Souls, the Commemoration of All the Faithful Departed.';

/** The ritual formulas every narrator speaks, identical for all (samples, approved). */
export const GOSPEL_INTRO = 'A reading from the holy Gospel according to {evangelist}.';
export const GOSPEL_CLOSE = 'The Gospel of the Lord.';
export const ACCLAMATION = 'Praise to you, Lord Jesus Christ.';

// ── The draft registry — every line written for this build (§5.3) ─────
//
// Built by reference into the bank above, so the registry can never quote a line the
// bank doesn't actually speak. Erik approved every line as written on Nov 2, 2026;
// the render does not distinguish them. The dry-run tool prints this list.

export interface DraftBankLine {
  persona: NarratorId;
  slot: string;
  text: string;
}

function draft(persona: NarratorId, slot: string, text: string): DraftBankLine {
  return { persona, slot, text };
}

export const DRAFT_BANK_LINES: DraftBankLine[] = [
  // PM sign-ons and the AM additions bank v2 never had.
  draft('frank', 'signOnsAM', BANK.frank.signOnsAM[2]),
  draft('ben', 'signOnsPM', BANK.ben.signOnsPM[1]),
  draft('ben', 'signOnsPM', BANK.ben.signOnsPM[2]),
  draft('frank', 'signOnsPM', BANK.frank.signOnsPM[1]),
  draft('tom', 'signOnsAM', BANK.tom.signOnsAM[1]),
  draft('tom', 'signOnsAM', BANK.tom.signOnsAM[2]),
  draft('ed', 'signOnsPM', BANK.ed.signOnsPM[0]),
  draft('ed', 'signOnsPM', BANK.ed.signOnsPM[1]),
  // Memorial/feast frame templates for the men whose sheets approved only Ben's and
  // Martin's forms on paper.
  draft('henry', 'frameMemorial', BANK.henry.frameMemorialAM),
  draft('coach', 'frameMemorial', BANK.coach.frameMemorialAM),
  draft('frank', 'frameMemorial', BANK.frank.frameMemorialAM),
  draft('tom', 'frameMemorialAM', BANK.tom.frameMemorialAM),
  draft('tom', 'frameMemorialPM', BANK.tom.frameMemorialPM),
  draft('ed', 'frameMemorial', BANK.ed.frameMemorialAM),
  // Tom's morning frame (his approved frame was always an evening one).
  draft('tom', 'frameFeriaAM', BANK.tom.frameFeriaAM),
  // Scene lead-ins where the samples gave the man a whole scene and no separate lead-in.
  draft('henry', 'sceneLeadIns', BANK.henry.sceneLeadIns[0]),
  draft('henry', 'sceneLeadIns', BANK.henry.sceneLeadIns[1]),
  draft('coach', 'sceneLeadIns', BANK.coach.sceneLeadIns[1]),
  draft('frank', 'sceneLeadIns', BANK.frank.sceneLeadIns[0]),
  draft('frank', 'sceneLeadIns', BANK.frank.sceneLeadIns[1]),
  draft('ben', 'sceneLeadIns', BANK.ben.sceneLeadIns[1]),
  draft('martin', 'sceneLeadIns', BANK.martin.sceneLeadIns[0]),
  draft('martin', 'sceneLeadIns', BANK.martin.sceneLeadIns[1]),
  draft('tom', 'sceneLeadIns', BANK.tom.sceneLeadIns[0]),
  draft('tom', 'sceneLeadIns', BANK.tom.sceneLeadIns[1]),
  draft('ed', 'sceneLeadIns', BANK.ed.sceneLeadIns[1]),
  // Second teaser templates (the first is the slot-generalized approved line).
  draft('henry', 'teaserTemplates', BANK.henry.teaserTemplates[1]),
  draft('coach', 'teaserTemplates', BANK.coach.teaserTemplates[1]),
  draft('frank', 'teaserTemplates', BANK.frank.teaserTemplates[1]),
  draft('ben', 'teaserTemplates', BANK.ben.teaserTemplates[1]),
  draft('martin', 'teaserTemplates', BANK.martin.teaserTemplates[1]),
  draft('tom', 'teaserTemplates', BANK.tom.teaserTemplates[1]),
  draft('ed', 'teaserTemplates', BANK.ed.teaserTemplates[1]),
  // Sober sets — bank v2 had none, for any man (spec §7).
  ...(['henry', 'coach', 'frank', 'ben', 'martin', 'tom', 'ed'] as PersonaId[]).flatMap((id) => [
    draft(id, 'soberSignOnsAM', BANK[id].soberSignOnsAM[0]),
    draft(id, 'soberSignOnsPM', BANK[id].soberSignOnsPM[0]),
    draft(id, 'soberFrame', BANK[id].soberFrame),
  ]),
  // The Lector's challenge hand-off formulation (his reflection hand-off is spec text).
  draft('lector', 'challengeHandoff', LECTOR_BANK.challengeHandoff),
];

// ── The pronunciation lexicon (spec §13) ──────────────────────────────────────

/**
 * Exceptions only, applied to speech payloads after assembly and hashing; stored and
 * displayed text is never altered. Seed content is exactly the one proven entry from
 * the samples. Entries are added one heard mispronunciation at a time — never guessed.
 */
export const LEXICON: [string, string][] = [
  ['sonor', 'son or'],
];

/** Applies the lexicon to a speech payload, in order. Canonical text never passes through here. */
export function applyLexicon(payload: string): string {
  let out = payload;
  for (const [pattern, replacement] of LEXICON) {
    out = out.split(pattern).join(replacement);
  }
  return out;
}

// ── The scene lint (spec §6.3/§10.5) ──────────────────────────────────────────

export const SCENE_MAX_CHARS = 280;

/** Shapes a scene may never take — interpretation dressed as description (Charter Zone 2). */
export const SCENE_BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bmeans\b/i, reason: 'banned:means' },
  { pattern: /teaches us/i, reason: 'banned:teaches-us' },
  { pattern: /we learn/i, reason: 'banned:we-learn' },
  { pattern: /really saying/i, reason: 'banned:really-saying' },
  { pattern: /in my experience/i, reason: 'banned:in-my-experience' },
  { pattern: /a real man would/i, reason: 'banned:a-real-man-would' },
  { pattern: /what this means/i, reason: 'banned:what-this-means' },
  { pattern: /the problem with men today/i, reason: 'banned:problem-with-men' },
];

export type SceneValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validates a generated scene body. An invalid scene is stored as NULL and the day
 * renders without one — a scene failure never blocks the reflection (spec §6.3).
 */
export function validateScene(scene: unknown): SceneValidation {
  if (typeof scene !== 'string' || !scene.trim()) return { ok: false, reason: 'missing' };
  const text = scene.trim();
  if (text.length > SCENE_MAX_CHARS) return { ok: false, reason: 'too-long' };
  for (const { pattern, reason } of SCENE_BANNED) {
    if (pattern.test(text)) return { ok: false, reason };
  }
  return { ok: true };
}

/** The Charter's banned shapes, checked over bank text (spec §10.1). */
export const BANNED_BANK_PATTERNS: RegExp[] = [
  /what Jesus is really saying/i,
  /the problem with men today/i,
  /here's what this means/i,
  /a real man would/i,
  /in my experience/i,
];

/**
 * Time-of-day language banned from the main segment (spec §5.4). All such language is
 * confined to the heads. One standing exception: Tom's sign-offs (see BANK.tom).
 */
export const TIME_NEUTRAL_LINT: string[] = [
  'morning',
  'tonight',
  'this evening',
  'good evening',
  'before the house wakes',
  'still up',
  'end of watch',
  'afternoon',
  'midnight',
  'sunrise',
];

// ── Script assembly (spec §6) ─────────────────────────────────────────────────

export interface AssembleInputs {
  dateISO: string;
  /** Which company's day this is. Defaults to 'men' — the original pipeline's track. */
  audience?: NarratorAudience;
  /** The bundle's celebration name (the name the app displays), or null. */
  celebration: string | null;
  gospelCitation: string;
  /** Zone 1 — verbatim, from the stored bundle. */
  gospelText: string;
  reflect: string;
  challenge: string;
  facet: string;
  /** The generated scene body, already lint-validated — or null to omit the scene. */
  scene: string | null;
  tomorrowCelebration: string | null;
  tomorrowGospelCitation: string | null;
  /** Test/dry-run seam: force variant indices instead of the date-keyed picks. */
  forceSelections?: Partial<Record<SelectionSlot, number>>;
  /**
   * Test seam: force the narrator instead of resolving from the date. The approved
   * samples had every man read the same Friday bundle (§10.3's contract fixture);
   * production never sets this — the render always resolves from the date.
   */
  forcePersona?: NarratorId;
}

export interface AssembledScript {
  persona: NarratorId;
  lector: boolean;
  sober: boolean;
  teaserIncluded: boolean;
  sceneIncluded: boolean;
  headAM: string;
  headPM: string;
  /** Speech request A: scene → Gospel → acclamation (the produced silence follows). */
  mainA: string;
  /** Speech request B: reflection → challenge → sign-off → teaser. */
  mainB: string;
  /** The full audit text (both heads + main with the silence marked). */
  script: string;
  selections: Partial<Record<SelectionSlot, number>>;
}

function fillTemplate(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => slots[name] ?? whole);
}

function templateSlots(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

function joinParagraphs(paragraphs: string[], beatsBetween: number[]): string {
  let out = paragraphs[0] ?? '';
  for (let i = 1; i < paragraphs.length; i++) {
    const beats = beatsBetween[i - 1] ?? 0;
    out += '\n\n' + '\n'.repeat(Math.max(0, beats)) + paragraphs[i];
  }
  return out;
}

/** Solemnities the Lector does NOT take: the days spec §7 reserves for a sober brother. */
function lectorTakes(dateISO: string, feast: FeastDayN): boolean {
  if (feast.rank !== 'solemnity') return false;
  if (isGoodFriday(dateISO) || isHolySaturday(dateISO)) return false;
  if (feast.name === 'Palm Sunday') return false;
  // All Souls is a commemoration with its own approved frame (character-pass sheet),
  // read by the weekday brother with the teaser present (spec §16 default) — the app's
  // display table ranks it a solemnity, the lectionary API a feast; neither makes it
  // the Lector's day.
  if (parseISODate(dateISO).m === 11 && parseISODate(dateISO).d === 2) return false;
  return true;
}

export function assembleScript(inputs: AssembleInputs): AssembledScript {
  const dateISO = inputs.dateISO;
  const weekday = weekdayNameOfISO(dateISO);
  const feast = resolveFeastDay(dateISO);
  const lector = inputs.forcePersona
    ? inputs.forcePersona === 'lector'
    : feast
      ? lectorTakes(dateISO, feast)
      : false;
  const audience: NarratorAudience = inputs.audience ?? 'men';
  const persona: NarratorId =
    inputs.forcePersona ?? (lector ? 'lector' : weekdayPersona(audience, weekdayOfISO(dateISO)));
  const sober = !lector && isSoberDay(dateISO, inputs.gospelCitation);
  const teaserSuppressed = isTeaserSuppressed(dateISO);
  const { m, d } = parseISODate(dateISO);
  const isAllSouls = m === 11 && d === 2;

  const selections: Partial<Record<SelectionSlot, number>> = {};
  const pick = (slot: SelectionSlot, count: number): number => {
    const forced = inputs.forceSelections?.[slot];
    const idx = forced !== undefined ? Math.min(Math.max(forced, 0), count - 1) : pickVariant(dateISO, persona, slot, count);
    selections[slot] = idx;
    return idx;
  };

  // ── Frame slots ──
  const celebrationName = (inputs.celebration ?? feast?.name ?? '').trim();
  const feriaLabel = celebrationName
    ? spokenizeOrdinals(sentenceStart(celebrationName))
    : (computeWeekLabel(dateISO) ?? weekday);
  const weekLabel = computeWeekLabel(dateISO);
  const personDay = celebrationName ? isPersonCelebration(celebrationName) : false;
  const saint = personDay && !isAllSouls ? saintLineFor(dateISO) : null;
  const frameSlots: Record<string, string> = {
    weekday,
    label: weekLabel ?? '',
    celebration: spokenizeOrdinals(celebrationName),
    saintLine: saint ? ` ${saint}` : '',
    celebrationBare: celebrationName.replace(/^The /, 'the '),
  };

  let headAM: string;
  let headPM: string;
  let mainA: string;
  let mainB: string;
  let sceneIncluded = false;
  let teaserIncluded = false;

  if (lector) {
    const lectorBank = audience === 'women' ? LECTOR_BANK_WOMEN : LECTOR_BANK;
    const frame = fillTemplate(lectorBank.frameSolemnity, frameSlots);
    headAM = frame;
    headPM = frame;
    const evangelist = evangelistOf(inputs.gospelCitation) ?? '';
    mainA = joinParagraphs(
      [fillTemplate(GOSPEL_INTRO, { evangelist }), inputs.gospelText, GOSPEL_CLOSE, ACCLAMATION],
      [0, lectorBank.pauseBeats.afterGospel, 0],
    );
    mainB = joinParagraphs(
      [
        lectorBank.reflectionHandoff,
        inputs.reflect,
        fillTemplate(lectorBank.challengeHandoff, { facetLower: facetLower(inputs.facet) }),
        inputs.challenge,
      ],
      [0, 0, 0],
    );
  } else {
    const bank =
      audience === 'women' ? BANK_WOMEN[persona as WomenPersonaId] : BANK[persona as PersonaId];

    const frameFor = (ampm: 'AM' | 'PM'): string => {
      if (sober) return bank.soberFrame;
      if (isAllSouls) return fillTemplate(COMMEMORATION_FRAME, frameSlots);
      if (personDay) {
        if (!weekLabel) {
          // §6.1 degradation: weekday + celebration only, no invented week.
          return `${weekday} — today the Church gives us ${frameSlots.celebration}.${frameSlots.saintLine}`;
        }
        return fillTemplate(ampm === 'AM' ? bank.frameMemorialAM : bank.frameMemorialPM, frameSlots);
      }
      return fillTemplate(ampm === 'AM' ? bank.frameFeriaAM : bank.frameFeriaPM, {
        ...frameSlots,
        label: feriaLabel,
      });
    };

    const signOnAM = sober
      ? bank.soberSignOnsAM[pick('soberSignOnAM', bank.soberSignOnsAM.length)]
      : bank.signOnsAM[pick('signOnAM', bank.signOnsAM.length)];
    const signOnPM = sober
      ? bank.soberSignOnsPM[pick('soberSignOnPM', bank.soberSignOnsPM.length)]
      : bank.signOnsPM[pick('signOnPM', bank.signOnsPM.length)];

    headAM = `${signOnAM}\n\n${frameFor('AM')}`;
    headPM = `${signOnPM}\n\n${frameFor('PM')}`;

    const beats = bank.pauseBeats;
    const aParagraphs: string[] = [];
    const aBeats: number[] = [];
    const sceneText = typeof inputs.scene === 'string' ? inputs.scene.trim() : '';
    if (sceneText) {
      const leadIn = bank.sceneLeadIns[pick('sceneLeadIn', bank.sceneLeadIns.length)];
      aParagraphs.push(`${leadIn} ${sceneText}`);
      aBeats.push(beats.afterScene);
      sceneIncluded = true;
    }
    const evangelist = evangelistOf(inputs.gospelCitation) ?? '';
    aParagraphs.push(fillTemplate(GOSPEL_INTRO, { evangelist }), inputs.gospelText, GOSPEL_CLOSE, ACCLAMATION);
    aBeats.push(beats.afterGospel, 0);
    mainA = joinParagraphs(aParagraphs, aBeats);

    const signOff = sober
      ? bank.signOffs[0]
      : bank.signOffs[pick('signOff', bank.signOffs.length)];
    const bParagraphs: string[] = [
      bank.reflectionHandoff,
      inputs.reflect,
      fillTemplate(bank.challengeHandoff, { facetLower: facetLower(inputs.facet) }),
      inputs.challenge,
      signOff,
    ];
    const bBeats: number[] = [0, beats.beforeChallenge, beats.afterChallenge, 0];

    if (!teaserSuppressed && inputs.tomorrowGospelCitation) {
      const bookChapter = bookChapterSpoken(inputs.tomorrowGospelCitation);
      const tomorrowISO = addDaysISO(dateISO, 1);
      const teaserSlots: Record<string, string> = {
        tomorrowWeekday: weekdayNameOfISO(tomorrowISO),
        tomorrowCelebration: inputs.tomorrowCelebration
          ? spokenizeOrdinals(sentenceStart(inputs.tomorrowCelebration))
          : '',
        tomorrowWeek: computeWeekShort(tomorrowISO) ?? '',
        bookChapter: bookChapter ?? '',
      };
      const template = bank.teaserTemplates[pick('teaser', bank.teaserTemplates.length)];
      const needed = templateSlots(template);
      if (bookChapter && needed.every((s) => (teaserSlots[s] ?? '') !== '')) {
        bParagraphs.push(fillTemplate(template, teaserSlots));
        bBeats.push(0);
        teaserIncluded = true;
      }
    }
    mainB = joinParagraphs(bParagraphs, bBeats);
  }

  const script = [
    `HEAD (AM)\n${headAM}`,
    `HEAD (PM)\n${headPM}`,
    `MAIN\n${mainA}\n\n[${AUDIO_SILENCE_SECONDS.toFixed(1)}s silence]\n\n${mainB}`,
  ].join('\n\n');

  return {
    persona,
    lector,
    sober,
    teaserIncluded,
    sceneIncluded,
    headAM,
    headPM,
    mainA,
    mainB,
    script,
    selections,
  };
}

// ── Tailored script assembly (Tailor Today, Nov 12, 2026) ────────────────────

/** One of the day's readings, verbatim from the bundle, in lectionary order. */
export interface TailoredReadingPart {
  kind: 'first' | 'psalm' | 'second' | 'gospel';
  citation: string;
  text: string;
}

/**
 * The personalized devotional's script. The narrator is the day's own — same
 * company, same framing banks, same head — and the body is the day's READINGS
 * ENTIRE, verbatim from the bundle exactly as the free devotional carries
 * them (first reading, psalm, second reading, Gospel — never regenerated,
 * never replaced). What is tailored is what follows: one need-matched passage
 * from the curated bank, offered AFTER the readings as a supplement and
 * introduced as one ("And for what you're carrying today —"), then the
 * reflection and challenge re-aimed at one user's stated morning, uniting
 * the readings to what that user brought in. There is no scene (the scene
 * belongs to the day) and no tomorrow teaser (a tailored devotional ends
 * with the sign-off). The head is the half of the day the build happens in:
 * a tailored devotional is built when it is asked for, so it speaks the
 * current hour's sign-on rather than carrying both.
 */
export interface TailoredAssembleInputs extends AssembleInputs {
  /** The day's readings entire, in order — the Gospel part must be present. */
  readings: TailoredReadingPart[];
  /** The curated bank's passage for this user's need — selected, never generated. */
  passageCitation: string;
  passageText: string;
  /** Which head the build speaks, from the device's own hour at build time. */
  head: 'am' | 'pm';
}

export interface TailoredScript {
  persona: NarratorId;
  lector: boolean;
  sober: boolean;
  /** The spoken parts, in order — rendered separately and joined with the produced silence. */
  head: string;
  readings: string;
  passage: string;
  mainB: string;
  /** The full spoken text (head + body), for audit. */
  spokenText: string;
  script: string;
}

/** How each reading is introduced when it is spoken. */
function readingIntro(part: TailoredReadingPart): string {
  switch (part.kind) {
    case 'gospel':
      return fillTemplate(GOSPEL_INTRO, { evangelist: evangelistOf(part.citation) ?? '' });
    case 'psalm':
      return `The responsorial psalm — ${spokenizeOrdinals(part.citation)}.`;
    default:
      return `A reading from ${spokenizeOrdinals(part.citation)}.`;
  }
}

export function assembleTailoredScript(inputs: TailoredAssembleInputs): TailoredScript {
  const gospel = inputs.readings.find((p) => p.kind === 'gospel');
  if (!gospel) throw new Error('tailored assembly requires the day\'s Gospel');
  // The day's own assembly decides who reads (weekday narrator, Lector on a
  // solemnity), whether the day is sober, both heads, and the whole second
  // movement (reflection hand-off → tailored reflection → challenge hand-off
  // → tailored challenge → sign-off) — the tailored build reuses all of it
  // and replaces only the first movement with the readings entire.
  const base = assembleScript({
    ...inputs,
    gospelCitation: gospel.citation,
    gospelText: gospel.text,
    scene: null,
    tomorrowCelebration: null,
    tomorrowGospelCitation: null,
  });
  const head = inputs.head === 'pm' ? base.headPM : base.headAM;

  const readingParagraphs: string[] = [];
  for (const part of inputs.readings) {
    readingParagraphs.push(`${readingIntro(part)}\n${part.text}`);
    if (part.kind === 'gospel') {
      readingParagraphs.push(GOSPEL_CLOSE, ACCLAMATION);
    }
  }
  const readings = readingParagraphs.join('\n\n');

  const passage = `And for what you're carrying today — ${spokenizeOrdinals(inputs.passageCitation)}. ${inputs.passageText}`;

  const spokenText = [head, readings, passage, base.mainB].join('\n\n');
  const script = [
    `HEAD (${inputs.head.toUpperCase()})\n${head}`,
    `MAIN\n${readings}\n\n${passage}\n\n[${AUDIO_SILENCE_SECONDS.toFixed(1)}s silence]\n\n${base.mainB}`,
  ].join('\n\n');
  return {
    persona: base.persona,
    lector: base.lector,
    sober: base.sober,
    head,
    readings,
    passage,
    mainB: base.mainB,
    spokenText,
    script,
  };
}
