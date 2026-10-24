import { describe, it, expect } from 'vitest';
import { isPersonCelebration, shouldMirrorCelebration } from './celebration';

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
