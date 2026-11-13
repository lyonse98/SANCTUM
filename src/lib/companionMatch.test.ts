import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { personasForAudience } from '@/personas';
import { matchCompanionsByNeed } from './companionMatch';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

/**
 * The typable router (Erik's ruling, Nov 12, 2026): a user who can name what he
 * is carrying types it, and an on-device matcher — no network, no cost — points
 * him at the companions whose cards speak to those very words. These tests pin
 * the two canonical cases Erik named, the graceful no-match, and the cast wall:
 * a track's words are never matched against the other track's companions.
 */

const men = personasForAudience('men');
const women = personasForAudience('women');

describe('the typable companion matcher', () => {
  it("men: 'struggling with lust and shame' surfaces the men who carry those words", () => {
    const matches = matchCompanionsByNeed('struggling with lust and shame', men);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(3);
    const ids = matches.map((m) => m.persona.id);
    // Augustine's card carries Lust itself; David carries Shame, Guilt, Temptation.
    expect(ids).toContain('augustine');
    expect(ids).toContain('david');
    expect(ids.indexOf('augustine')).toBeLessThan(2);
    // Every result is from his own cast, and says why, in the card's words.
    for (const m of matches) {
      expect(m.persona.audience).toBe('men');
      expect(m.reason.length).toBeGreaterThan(10);
    }
    const augustine = matches.find((m) => m.persona.id === 'augustine');
    expect(augustine?.matchedAreas.join(' ').toLowerCase()).toContain('lust');
  });

  it("women: 'grieving a miscarriage' surfaces Mary first, Magdalene beside her", () => {
    const matches = matchCompanionsByNeed('grieving a miscarriage', women);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].persona.id).toBe('mary');
    expect(matches.map((m) => m.persona.id)).toContain('magdalene');
    for (const m of matches) {
      expect(m.persona.audience).toBe('women');
    }
    const mary = matches[0];
    const areas = mary.matchedAreas.join(' ').toLowerCase();
    expect(areas).toMatch(/grief|motherhood/);
  });

  it('a typed need about prayer drying up finds the prayer companions on both tracks', () => {
    const his = matchCompanionsByNeed('my prayer life is dry and distracted', men);
    expect(his.length).toBeGreaterThan(0);
    const hers = matchCompanionsByNeed('my prayer life is dry and distracted', women);
    expect(hers.map((m) => m.persona.id)).toContain('teresa');
  });

  it('gibberish matches nothing — the router must say so, never force a fit', () => {
    expect(matchCompanionsByNeed('xyzzy blorp fizzle wuzzle', men)).toEqual([]);
    expect(matchCompanionsByNeed('xyzzy blorp fizzle wuzzle', women)).toEqual([]);
  });

  it('too-short input matches nothing', () => {
    expect(matchCompanionsByNeed('hi', men)).toEqual([]);
    expect(matchCompanionsByNeed('   ', women)).toEqual([]);
  });

  it('the router offers the typable path and keeps the guided one', () => {
    const router = read('components/CompanionRouter.tsx');
    expect(router).toContain('matchCompanionsByNeed');
    expect(router).toContain('What do you need to talk about?');
    expect(router).toContain('Or say it in your own words');
    // The guided questions survive intact beside it.
    expect(router).toContain('What brings you here?');
    expect(router).toContain('QUESTIONS');
    // And the no-match is answered with the whole cast, not a dead end.
    expect(router).toContain('See the whole cast');
    expect(router).toContain('not a dead end');
  });
});
