import { describe, expect, it } from 'vitest';
import { adventProgress, adventRange } from './seasonArcs';

/**
 * Play 5c — Advent as a finite arc on Today. The bounds are the Church's
 * own: Advent begins on the fourth Sunday before Christmas (the Sunday
 * nearest Nov 30) and the arc runs through Dec 24.
 */
describe('seasonArcs — Advent (Play 5c)', () => {
  it('in 2026 Advent begins Sunday Nov 29 and the arc is 26 days', () => {
    const { start, end } = adventRange(2026);
    expect(start.getDay()).toBe(0); // a Sunday
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 10, 29]);
    expect([end.getMonth(), end.getDate()]).toEqual([11, 24]);
    expect(adventProgress(new Date(2026, 10, 29))).toEqual({ day: 1, totalDays: 26 });
    expect(adventProgress(new Date(2026, 11, 24))).toEqual({ day: 26, totalDays: 26 });
  });

  it('counts calendar days from Advent Sunday — Dec 10, 2026 is day 12 of 26', () => {
    expect(adventProgress(new Date(2026, 11, 10, 15, 30))).toEqual({ day: 12, totalDays: 26 });
    expect(adventProgress(new Date(2026, 10, 30))).toEqual({ day: 2, totalDays: 26 });
  });

  it('is null outside Advent — the day before, Christmas Day, and the rest of the year', () => {
    expect(adventProgress(new Date(2026, 10, 28))).toBeNull();
    expect(adventProgress(new Date(2026, 11, 25))).toBeNull();
    expect(adventProgress(new Date(2026, 10, 16))).toBeNull();
    expect(adventProgress(new Date(2027, 0, 6))).toBeNull();
    expect(adventProgress(new Date(2026, 5, 15))).toBeNull();
  });

  it('the arc length follows the calendar each year (2025: Nov 30 – Dec 24, 25 days)', () => {
    expect(adventProgress(new Date(2025, 10, 30))).toEqual({ day: 1, totalDays: 25 });
    expect(adventProgress(new Date(2025, 10, 29))).toBeNull();
    expect(adventProgress(new Date(2025, 11, 24))).toEqual({ day: 25, totalDays: 25 });
  });
});
