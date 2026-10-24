import { describe, it, expect } from 'vitest';
import { isPersonCelebration, resolveCelebrationName, shouldMirrorCelebration } from './celebration';

describe('saint-of-the-day mirroring rule', () => {
  it('mirrors a saint memorial (the Oct 24, 2026 case)', () => {
    expect(shouldMirrorCelebration('Saint Anthony Mary Claret, Bishop')).toBe(true);
    expect(isPersonCelebration('Saint Anthony Mary Claret, Bishop')).toBe(true);
  });

  it('mirrors feasts that are not persons', () => {
    expect(shouldMirrorCelebration('The Dedication of the Lateran Basilica')).toBe(true);
    expect(isPersonCelebration('The Dedication of the Lateran Basilica')).toBe(false);
    expect(shouldMirrorCelebration('Exaltation of the Holy Cross')).toBe(true);
    expect(shouldMirrorCelebration('Ash Wednesday')).toBe(true);
  });

  it('mirrors Our Lady and joint saints', () => {
    expect(shouldMirrorCelebration('Our Lady of Guadalupe')).toBe(true);
    expect(isPersonCelebration('Our Lady of Guadalupe')).toBe(true);
    expect(shouldMirrorCelebration('Saints Simon and Jude, Apostles')).toBe(true);
  });

  it('does not mirror a plain weekday or an ordinary Sunday', () => {
    expect(shouldMirrorCelebration('Saturday of the Twenty-Ninth Week in Ordinary Time')).toBe(false);
    expect(shouldMirrorCelebration('Thirtieth Sunday in Ordinary Time')).toBe(false);
    expect(shouldMirrorCelebration('Monday of the Second Week of Advent')).toBe(false);
  });

  it('does not mirror nothing', () => {
    expect(shouldMirrorCelebration(null)).toBe(false);
    expect(shouldMirrorCelebration(undefined)).toBe(false);
    expect(shouldMirrorCelebration('')).toBe(false);
  });
});

describe('celebration resolution (bundle vs direct)', () => {
  const today = '2026-10-24';
  it('a fresh bundle wins', () => {
    expect(resolveCelebrationName({
      bundleCelebration: 'Saint Anthony Mary Claret, Bishop', bundleDate: today, todayKey: today,
      directCelebration: 'Someone Else',
    })).toBe('Saint Anthony Mary Claret, Bishop');
  });
  it('a stale bundle is ignored in favor of the direct path', () => {
    expect(resolveCelebrationName({
      bundleCelebration: 'Yesterday’s Saint', bundleDate: '2026-10-23', todayKey: today,
      directCelebration: 'Saint Anthony Mary Claret, Bishop',
    })).toBe('Saint Anthony Mary Claret, Bishop');
  });
  it('no bundle falls back to the direct path', () => {
    expect(resolveCelebrationName({
      bundleCelebration: null, bundleDate: null, todayKey: today,
      directCelebration: 'Saint Anthony Mary Claret, Bishop',
    })).toBe('Saint Anthony Mary Claret, Bishop');
  });
  it('nothing anywhere resolves to null (card keeps its local saint)', () => {
    expect(resolveCelebrationName({ todayKey: today })).toBeNull();
  });
});
