import { describe, expect, it } from 'vitest';
import { getEasterDate } from '@/data/liturgicalCalendar';
import { nextSeasonTurn, seasonInstanceKey } from './seasonTurns';
import { dateKeyOf, shiftDateKey } from './dayBoundary';

describe('seasonTurns — nextSeasonTurn', () => {
  it('from mid-November 2026 the next turn is Advent Nov 29 2026', () => {
    const turn = nextSeasonTurn(new Date(2026, 10, 16));
    expect(turn.name).toBe('Advent');
    expect(turn.dateKey).toBe('2026-11-29');
    expect(turn.daysAway).toBe(13);
  });

  it('from mid-Ordinary Time the next turn is Ash Wednesday computed from Easter 2027', () => {
    const easter2027 = getEasterDate(2027);
    const ashKey = shiftDateKey(dateKeyOf(easter2027), -46);
    // Mid-Ordinary: late January 2027, after Baptism, before Lent
    const turn = nextSeasonTurn(new Date(2027, 0, 20));
    expect(turn.name).toBe('Lent');
    expect(turn.dateKey).toBe(ashKey);
  });

  it('beginsText: tomorrow, weekday within 6 days, and today', () => {
    // Advent 2026 is Nov 29 (Sunday)
    const tomorrow = nextSeasonTurn(new Date(2026, 10, 28));
    expect(tomorrow.daysAway).toBe(1);
    expect(tomorrow.beginsText).toBe('Advent begins tomorrow');

    const in3 = nextSeasonTurn(new Date(2026, 10, 26));
    expect(in3.daysAway).toBe(3);
    expect(in3.beginsText).toBe('Advent begins Sunday');

    const today = nextSeasonTurn(new Date(2026, 10, 29));
    expect(today.daysAway).toBe(0);
    expect(today.beginsText).toBe('Advent begins today');
  });

  it('Holy Thursday is named the Triduum and Easter follows it', () => {
    const easter2027 = getEasterDate(2027);
    const holyThuKey = shiftDateKey(dateKeyOf(easter2027), -3);
    const [y, m, d] = holyThuKey.split('-').map(Number);
    // Day before Holy Thursday
    const before = new Date(y, m - 1, d - 1);
    const turn = nextSeasonTurn(before);
    expect(turn.name).toBe('the Triduum');
    expect(turn.dateKey).toBe(holyThuKey);
    expect(turn.daysAway).toBe(1);
    expect(turn.beginsText).toBe('the Triduum begins tomorrow');

    const onEasterMinus1 = nextSeasonTurn(new Date(y, m - 1, d + 2)); // Holy Saturday approx: Easter-1
    // Actually compute Easter-1 date
    const easterKey = dateKeyOf(easter2027);
    const [ey, em, ed] = easterKey.split('-').map(Number);
    const dayBeforeEaster = new Date(ey, em - 1, ed - 1);
    const easterTurn = nextSeasonTurn(dayBeforeEaster);
    expect(easterTurn.name).toBe('Easter');
    expect(easterTurn.dateKey).toBe(easterKey);
    expect(onEasterMinus1.name).toBeDefined();
  });

  it('Christmas follows Advent', () => {
    const turn = nextSeasonTurn(new Date(2026, 11, 20));
    expect(turn.name).toBe('Christmas');
    expect(turn.dateKey).toBe('2026-12-25');
  });
});

describe('seasonTurns — seasonInstanceKey', () => {
  it('two dates in the same season share a key', () => {
    const a = seasonInstanceKey(new Date(2026, 10, 16)); // Ordinary-2
    const b = seasonInstanceKey(new Date(2026, 10, 20));
    expect(a).toBe(b);
    expect(a.startsWith('ordinary-2:')).toBe(true);
  });

  it('dates across a boundary differ', () => {
    const before = seasonInstanceKey(new Date(2026, 10, 28)); // Ordinary-2
    const after = seasonInstanceKey(new Date(2026, 10, 30)); // Advent
    expect(before).not.toBe(after);
    expect(after.startsWith('advent:')).toBe(true);
    expect(after).toContain('2026-11-29');
  });

  it('Christmas instance is keyed by Dec 25, including early January', () => {
    const dec = seasonInstanceKey(new Date(2026, 11, 26));
    const jan = seasonInstanceKey(new Date(2027, 0, 2));
    expect(dec).toBe(jan);
    expect(dec).toBe('christmas:2026-12-25');
  });

  it('Lent and Easter instances differ and Lent is keyed by Ash Wednesday', () => {
    const easter2027 = getEasterDate(2027);
    const ashKey = shiftDateKey(dateKeyOf(easter2027), -46);
    const lent = seasonInstanceKey(new Date(2027, 2, 10));
    expect(lent).toBe(`lent:${ashKey}`);
    const easterKey = dateKeyOf(easter2027);
    const [ey, em, ed] = easterKey.split('-').map(Number);
    const easterInst = seasonInstanceKey(new Date(ey, em - 1, ed + 2));
    expect(easterInst).toBe(`easter:${easterKey}`);
    expect(lent).not.toBe(easterInst);
  });

  it('Pentecost starts a new Ordinary instance', () => {
    const easter2026 = getEasterDate(2026);
    const pentecostKey = shiftDateKey(dateKeyOf(easter2026), 49);
    const [py, pm, pd] = pentecostKey.split('-').map(Number);
    const before = seasonInstanceKey(new Date(py, pm - 1, pd - 1));
    const on = seasonInstanceKey(new Date(py, pm - 1, pd));
    expect(before).not.toBe(on);
    expect(on).toBe(`ordinary-2:${pentecostKey}`);
  });

  it('Ordinary-1 after Baptism is keyed by the day after Baptism', () => {
    const a = seasonInstanceKey(new Date(2027, 0, 20));
    const b = seasonInstanceKey(new Date(2027, 1, 1));
    expect(a).toBe(b);
    expect(a.startsWith('ordinary-1:')).toBe(true);
  });
});
