import { describe, it, expect } from 'vitest';
import { getEasterDate, getAdventStart, getCurrentSeason } from './liturgicalCalendar';

describe('computus and season boundaries', () => {
  it('Easter 2025 is April 20 and Easter 2026 is April 5', () => {
    const e2025 = getEasterDate(2025);
    expect([e2025.getFullYear(), e2025.getMonth(), e2025.getDate()]).toEqual([2025, 3, 20]);
    const e2026 = getEasterDate(2026);
    expect([e2026.getFullYear(), e2026.getMonth(), e2026.getDate()]).toEqual([2026, 3, 5]);
  });

  it('Advent 2026 begins Sunday November 29', () => {
    const advent = getAdventStart(2026);
    expect([advent.getMonth(), advent.getDate(), advent.getDay()]).toEqual([10, 29, 0]);
  });

  it('season lookup: Christmas Day, Ash Wednesday week, Easter Sunday, mid-July', () => {
    expect(getCurrentSeason(new Date(2026, 11, 25)).season).toBe('christmas');
    // Ash Wednesday 2026 is Feb 18 (Easter Apr 5 minus 46 days)
    expect(getCurrentSeason(new Date(2026, 1, 18)).season).toBe('lent');
    expect(getCurrentSeason(new Date(2026, 3, 5)).season).toBe('easter');
    expect(getCurrentSeason(new Date(2026, 6, 15)).season).toBe('ordinary-2');
    expect(getCurrentSeason(new Date(2026, 0, 20)).season).toBe('ordinary-1');
  });
});

describe('server prompt sync', () => {
  it('generated server prompts match the client sources (npm run sync:prompts)', async () => {
    const { execFileSync } = await import('node:child_process');
    execFileSync('node', ['scripts/sync-server-prompts.mjs', '--check'], { stdio: 'pipe' });
  });
});
