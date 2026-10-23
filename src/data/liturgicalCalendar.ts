export type LiturgicalSeason =
  | 'advent'
  | 'christmas'
  | 'ordinary-1'
  | 'lent'
  | 'easter'
  | 'ordinary-2';

export interface SeasonInfo {
  season: LiturgicalSeason;
  name: string;
  accentColor: string;
  accentBright: string;
  accentDark: string;
  themes: string[];
  description: string;
  featuredCompanions: string[];
}

export const SEASONS: Record<LiturgicalSeason, SeasonInfo> = {
  advent: {
    season: 'advent',
    name: 'Advent',
    accentColor: '#2F5D8C',
    accentBright: '#4A7EB3',
    accentDark: '#234A72',
    themes: ['waiting', 'hope', 'preparation', 'longing', 'the coming of Christ'],
    description: 'A season of waiting, hope, and preparation for the coming of Christ.',
    featuredCompanions: ['david', 'john-baptist', 'moses'],
  },
  christmas: {
    season: 'christmas',
    name: 'Christmas',
    accentColor: '#DC2626',
    accentBright: '#EF4444',
    accentDark: '#B91C1C',
    themes: ['incarnation', 'joy', 'light in darkness', 'God with us', 'new beginnings'],
    description: 'The Word became flesh and dwelt among us. God is with us.',
    featuredCompanions: ['joseph', 'peter', 'david'],
  },
  'ordinary-1': {
    season: 'ordinary-1',
    name: 'Ordinary Time',
    accentColor: '#16A34A',
    accentBright: '#22C55E',
    accentDark: '#15803D',
    themes: ['growth', 'discipleship', 'daily faithfulness', 'the ordinary made holy'],
    description: 'The season of growth and daily faithfulness — the ordinary made holy.',
    featuredCompanions: ['joseph', 'paul', 'leo'],
  },
  lent: {
    season: 'lent',
    name: 'Lent',
    accentColor: '#78716C',
    accentBright: '#A8A29E',
    accentDark: '#57534E',
    themes: ['repentance', 'fasting', 'wilderness', 'sacrifice', 'return to the Father'],
    description: 'A season of repentance, fasting, and the wilderness — returning to the Father.',
    featuredCompanions: ['jonah', 'moses', 'john-baptist', 'david'],
  },
  easter: {
    season: 'easter',
    name: 'Easter',
    accentColor: '#F59E0B',
    accentBright: '#FBBF24',
    accentDark: '#D97706',
    themes: ['resurrection', 'new beginnings', 'joy', 'restoration', 'the empty tomb'],
    description: 'He is risen. The season of resurrection, restoration, and joy.',
    featuredCompanions: ['peter', 'paul', 'david'],
  },
  'ordinary-2': {
    season: 'ordinary-2',
    name: 'Ordinary Time',
    accentColor: '#16A34A',
    accentBright: '#22C55E',
    accentDark: '#15803D',
    themes: ['growth', 'discipleship', 'daily faithfulness', 'the ordinary made holy'],
    description: 'The season of growth and daily faithfulness — the ordinary made holy.',
    featuredCompanions: ['joseph', 'paul', 'leo'],
  },
};

export function getCurrentSeason(date: Date = new Date()): SeasonInfo {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const easter = getEasterDate(year);
  const ashWednesday = new Date(easter);
  ashWednesday.setDate(easter.getDate() - 46);
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 49);

  const now = new Date(year, month - 1, day);

  // Advent: starts 4th Sunday before Christmas
  const christmas = new Date(year, 11, 25);
  const christmasDayOfWeek = christmas.getDay();
  const adventStart = new Date(year, 11, 25 - christmasDayOfWeek - 21);
  if (now >= adventStart && now < christmas) return SEASONS.advent;

  // Christmas: Dec 25 through Baptism of the Lord (Sunday after Jan 6)
  const epiphany = new Date(year, 0, 6);
  const baptismSunday = new Date(epiphany);
  baptismSunday.setDate(epiphany.getDate() + (7 - epiphany.getDay()) % 7);
  if (now >= christmas || now <= baptismSunday) return SEASONS.christmas;

  // Lent: Ash Wednesday to Easter Vigil
  if (now >= ashWednesday && now < easter) return SEASONS.lent;

  // Easter: Easter Sunday to Pentecost
  if (now >= easter && now < pentecost) return SEASONS.easter;

  // Ordinary Time: everything else
  // First half: Baptism of Lord to Ash Wednesday
  // Second half: Pentecost to Advent
  if (now < ashWednesday) return SEASONS['ordinary-1'];
  return SEASONS['ordinary-2'];
}

/** Easter Sunday for a given year (Computus — Meeus/Jones/Butcher algorithm). */
export function getEasterDate(year: number): Date {
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
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, easterMonth - 1, easterDay);
}

/** First day of Advent (4th Sunday before Christmas) for a given year. */
export function getAdventStart(year: number): Date {
  const christmas = new Date(year, 11, 25);
  return new Date(year, 11, 25 - christmas.getDay() - 21);
}
