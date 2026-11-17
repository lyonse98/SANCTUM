import { describe, expect, it } from 'vitest';
import { keptWeeks, mondayOfWeek, weekIsKept, weekRangeOf } from './keptWeeks';

// November 2026: Mon Nov 9 – Sun Nov 15 is one calendar week;
// Mon Nov 16 – Sun Nov 22 the next. (Nov 16, 2026 is a Monday.)
const WEEK_ONE = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];

describe('keptWeeks — Monday–Sunday grouping', () => {
  it('mondayOfWeek finds the Monday of any day in the week', () => {
    expect(mondayOfWeek('2026-11-09')).toBe('2026-11-09'); // Monday itself
    expect(mondayOfWeek('2026-11-11')).toBe('2026-11-09'); // Wednesday
    expect(mondayOfWeek('2026-11-15')).toBe('2026-11-09'); // Sunday ends the week it began
    expect(mondayOfWeek('2026-11-16')).toBe('2026-11-16'); // the next Monday starts a new week
  });

  it('weekRangeOf spans Monday to Sunday, across a month boundary', () => {
    expect(weekRangeOf('2026-12-02')).toEqual({ weekStartKey: '2026-11-30', weekEndKey: '2026-12-06' });
  });

  it('a completed week with five distinct prayed days is kept', () => {
    expect(keptWeeks(WEEK_ONE, '2026-11-16')).toEqual([
      { weekStartKey: '2026-11-09', weekEndKey: '2026-11-15', sundayKey: '2026-11-15' },
    ]);
  });

  it('a completed week with four prayed days is absent — not reported, not short', () => {
    expect(keptWeeks(WEEK_ONE.slice(0, 4), '2026-11-16')).toEqual([]);
  });

  it('five entries on fewer distinct days do not make a kept week', () => {
    const dupes = ['2026-11-09', '2026-11-09', '2026-11-10', '2026-11-10', '2026-11-11'];
    expect(keptWeeks(dupes, '2026-11-16')).toEqual([]);
  });

  it('a week still in progress is never returned, even at five days', () => {
    const thisWeek = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
    // Saturday of that week: its Sunday has not passed.
    expect(keptWeeks(thisWeek, '2026-11-21')).toEqual([]);
    // Even on its own Sunday the week is still being lived.
    expect(keptWeeks(thisWeek, '2026-11-22')).toEqual([]);
    // The Monday after, the same week is complete and kept.
    expect(keptWeeks(thisWeek, '2026-11-23')).toEqual([
      { weekStartKey: '2026-11-16', weekEndKey: '2026-11-22', sundayKey: '2026-11-22' },
    ]);
  });

  it('returns kept weeks sorted ascending, skipping the weeks between that were not kept', () => {
    const dates = [
      ...['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'],
      ...WEEK_ONE,
      '2026-11-17', // one day in the week between — that week is simply absent
    ];
    expect(keptWeeks(dates, '2026-12-07')).toEqual([
      { weekStartKey: '2026-11-09', weekEndKey: '2026-11-15', sundayKey: '2026-11-15' },
      { weekStartKey: '2026-11-30', weekEndKey: '2026-12-06', sundayKey: '2026-12-06' },
    ]);
  });

  it('weekIsKept judges a week by its days, including the week still being lived', () => {
    expect(weekIsKept(WEEK_ONE, '2026-11-12')).toBe(true);
    expect(weekIsKept(WEEK_ONE.slice(0, 4), '2026-11-12')).toBe(false);
    expect(weekIsKept([], '2026-11-12')).toBe(false);
  });
});
