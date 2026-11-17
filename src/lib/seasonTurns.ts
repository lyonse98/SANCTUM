import { getAdventStart, getCurrentSeason, getEasterDate } from '@/data/liturgicalCalendar';
import { dateKeyOf, shiftDateKey } from './dayBoundary';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SeasonTurn {
  name: string;
  dateKey: string;
  daysAway: number;
  beginsText: string;
}

interface Boundary {
  name: string;
  date: Date;
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const c = atMidnight(d);
  c.setDate(c.getDate() + days);
  return c;
}

function baptismSunday(year: number): Date {
  const epiphany = new Date(year, 0, 6);
  const offset = (7 - epiphany.getDay()) % 7;
  return addDays(epiphany, offset);
}

function boundariesForYear(year: number): Boundary[] {
  const easter = getEasterDate(year);
  const ashWednesday = addDays(easter, -46);
  const holyThursday = addDays(easter, -3);
  return [
    { name: 'Advent', date: atMidnight(getAdventStart(year)) },
    { name: 'Christmas', date: new Date(year, 11, 25) },
    { name: 'Lent', date: ashWednesday },
    { name: 'the Triduum', date: holyThursday },
    { name: 'Easter', date: atMidnight(easter) },
  ];
}

function beginsTextFor(name: string, date: Date, daysAway: number): string {
  if (daysAway === 0) return `${name} begins today`;
  if (daysAway === 1) return `${name} begins tomorrow`;
  if (daysAway <= 6) return `${name} begins ${WEEKDAY_NAMES[date.getDay()]}`;
  // Honest for far dates: name the calendar date rather than an ambiguous weekday.
  return `${name} begins on ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function nextSeasonTurn(from: Date): SeasonTurn {
  const fromMid = atMidnight(from);
  const fromKey = dateKeyOf(fromMid);
  const years = [from.getFullYear() - 1, from.getFullYear(), from.getFullYear() + 1, from.getFullYear() + 2];
  const all: Boundary[] = [];
  for (const y of years) all.push(...boundariesForYear(y));
  all.sort((a, b) => a.date.getTime() - b.date.getTime());
  // A boundary on the calendar day of `from` counts as today (daysAway 0).
  // Past boundaries (dateKey < fromKey) are excluded.
  const next = all.find((b) => dateKeyOf(b.date) >= fromKey) ?? all[all.length - 1];
  const daysAway = Math.round((atMidnight(next.date).getTime() - fromMid.getTime()) / 86400000);
  return {
    name: next.name,
    dateKey: dateKeyOf(next.date),
    daysAway,
    beginsText: beginsTextFor(next.name, next.date, daysAway),
  };
}

/**
 * Season start boundaries for seasonInstanceKey.
 * These are the starts of the seasons getCurrentSeason reports:
 * Advent, Christmas, Ordinary-1 (day after Baptism), Lent, Easter, Ordinary-2 (Pentecost).
 */
function seasonStartsForYear(year: number): { dateKey: string }[] {
  const easter = getEasterDate(year);
  const easterKey = dateKeyOf(easter);
  const starts: string[] = [
    dateKeyOf(getAdventStart(year)),
    `${year}-12-25`,
    // Ordinary Time (first part) begins the day after Baptism of the Lord
    shiftDateKey(dateKeyOf(baptismSunday(year)), 1),
    shiftDateKey(easterKey, -46), // Ash Wednesday -> Lent
    easterKey, // Easter
    shiftDateKey(easterKey, 49), // Pentecost -> Ordinary-2
  ];
  return starts.map((dateKey) => ({ dateKey }));
}

export function seasonInstanceKey(date: Date): string {
  const season = getCurrentSeason(date).season;
  const key = dateKeyOf(atMidnight(date));
  const years = [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1];
  const all: string[] = [];
  for (const y of years) for (const s of seasonStartsForYear(y)) all.push(s.dateKey);
  all.sort();
  let mostRecent = all[0];
  for (const k of all) {
    if (k <= key) mostRecent = k;
    else break;
  }
  return `${season}:${mostRecent}`;
}
