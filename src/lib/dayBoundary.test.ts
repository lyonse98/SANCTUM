import { describe, expect, it } from 'vitest';
import { DAY_START_HOUR, contentDate, contentDateKey, dateKeyOf, shiftDateKey } from './dayBoundary';

describe('dayBoundary — the content day flips at 04:00 local', () => {
  it('pins the flip hour at 4', () => {
    expect(DAY_START_HOUR).toBe(4);
  });

  it('after midnight but before 04:00, the content day is still yesterday', () => {
    expect(contentDateKey(new Date(2026, 10, 17, 0, 30))).toBe('2026-11-16');
    expect(contentDateKey(new Date(2026, 10, 17, 3, 59))).toBe('2026-11-16');
  });

  it('at 04:00 the new content day begins', () => {
    expect(contentDateKey(new Date(2026, 10, 17, 4, 0))).toBe('2026-11-17');
    expect(contentDateKey(new Date(2026, 10, 17, 23, 45))).toBe('2026-11-17');
  });

  it('contentDate returns local midnight of the content day', () => {
    const d = contentDate(new Date(2026, 0, 1, 2, 15));
    expect(dateKeyOf(d)).toBe('2025-12-31');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('shiftDateKey walks across months and years', () => {
    expect(shiftDateKey('2026-11-16', 1)).toBe('2026-11-17');
    expect(shiftDateKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-11-16', 0)).toBe('2026-11-16');
  });
});
