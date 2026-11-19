import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTailorTask, buildPmTask } from '../../supabase/functions/tailor-devotional/prompts';

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/**
 * The Catholic-distinctives pass (Erik, Nov 16, 2026). The reflection and
 * challenge writers named the app "Catholic" but were given nothing Catholic
 * to write from, and the output drifted generic. These pins hold the fix:
 * both daily-reflection track prompts and the Tailor task carry the same
 * substance — the sacramental life as the writing's natural furniture, a
 * challenge practice bank drawn from the Church's own practices, season
 * weighting, and a hard ban on citations the input did not supply. The push
 * itself is placed pair-level and kept subtle (tuned on Erik's word the same
 * day — "a subtle catholic push, not super obvious but enough to sell a
 * priest"): on a given day it lands in the Reflect OR the Challenge, never
 * both, woven in assumed, lived, and unexplained, so a priest reading a week
 * of them would know they are ours while a newcomer never feels lectured.
 * The spoken bridge gains framing only, as background texture, under its
 * unchanged fence; output shapes and length gates do not move.
 */

describe('daily-reflection — the Catholic shape section', () => {
  const source = readRoot('supabase/functions/daily-reflection/index.ts');

  it('both track prompts carry the section and its sacramental furniture', () => {
    expect(count(source, 'THE CATHOLIC SHAPE OF IT')).toBe(2);
    expect(
      count(
        source,
        "the Church's sacramental life: the Mass and the Eucharist, Confession, Mary, the communion of saints",
      ),
    ).toBe(2);
    expect(count(source, 'never as jargon, never as decoration, never as a lecture')).toBe(2);
  });

  it('the push is placed pair-level — Reflect OR Challenge, never both — in both prompts', () => {
    expect(count(source, 'ONE PUSH, IN ONE PIECE, NEVER BOTH')).toBe(2);
    expect(count(source, 'the Reflect OR the Challenge — never in both')).toBe(2);
    expect(count(source, 'the Reflect stays a plain question, with no Catholic furniture added')).toBe(2);
    expect(count(source, 'the Challenge stays an ordinary concrete action')).toBe(2);
    expect(count(source, 'add no push at all — the readings carry the day')).toBe(2);
    expect(count(source, 'the push should be there most days, in one slot or the other')).toBe(2);
  });

  it('the subtlety standard is stated in both prompts', () => {
    expect(count(source, 'AND KEEP IT SUBTLE')).toBe(2);
    expect(count(source, 'the way a Catholic friend would say it — assumed, lived, unexplained')).toBe(2);
    expect(count(source, 'no announcing it, no explaining what it is, no catechesis, no signaling')).toBe(2);
    expect(count(source, 'should recognize them as genuinely ours')).toBe(2);
    expect(count(source, 'should never feel lectured or marketed to')).toBe(2);
    expect(count(source, 'Authenticity over visibility')).toBe(2);
    expect(count(source, 'is the failure mode. Never force it.')).toBe(2);
  });

  it('the practice bank is present in both prompts', () => {
    for (const item of [
      'a decade of the Rosary',
      'ten minutes before the Blessed Sacrament, or a brief visit to a church',
      'an act of contrition with a concrete plan to get to Confession',
      'a corporal or spiritual work of mercy',
      'a small fast, or one comfort given up and offered for someone',
      'prayer for a named soul in purgatory, or a Mass intention asked for them',
      "offered up and united to Christ's suffering",
      'a brief examination of conscience tonight',
      'an invitation for someone to come to Mass',
      'asking for the prayers of the saint the Church keeps today',
      'a Friday asks for penance the way a Friday does',
      'not a quota to fill',
    ]) {
      expect(count(source, item), item).toBe(2);
    }
  });

  it('season weighting is stated in both prompts', () => {
    expect(count(source, 'LET THE SEASON SET THE WEIGHT')).toBe(2);
    expect(count(source, 'Lent leans toward prayer, fasting, and almsgiving')).toBe(2);
    expect(count(source, 'Advent toward preparation and honest waiting')).toBe(2);
    expect(count(source, 'the Easter season toward thanksgiving and witness')).toBe(2);
    expect(count(source, 'the ordinary practices of the life of grace')).toBe(2);
  });

  it('the no-fabricated-citations prohibition is a hard failure in both prompts', () => {
    expect(count(source, 'NEVER INVENT A CITATION')).toBe(2);
    expect(count(source, 'never print a Catechism paragraph number')).toBe(2);
    expect(count(source, "never put a quotation in a saint's mouth")).toBe(2);
    expect(count(source, 'A fabricated citation is a hard failure')).toBe(2);
    expect(
      count(
        source,
        "The only saint material you may use as fact is the name and the one clause today's input supplies",
      ),
    ).toBe(2);
  });

  it('the bridge gains framing only — its fence and length gates are untouched', () => {
    expect(count(source, 'FRAMING: you may name the day the way the Church names it')).toBe(2);
    expect(count(source, 'say plainly that the Church gives us this Gospel today')).toBe(2);
    expect(count(source, 'Framing only: it adds no claim of its own')).toBe(2);
    expect(count(source, 'Keep it background texture')).toBe(2);
    expect(count(source, 'never spotlight it')).toBe(2);
    // Twice in the bridge fences — and twice more since Nov 19, 2026, in
    // the spoken intro's fences, which carry the same sentence by design
    // (the intro stands under the same fence family; spokenIntro.test.ts
    // pins the intro sections themselves).
    expect(count(source, "no opinions — not yours, not anyone's")).toBe(4);
    expect(source).toContain('SPOKEN_BRIDGE_MAX_CHARS = 1200');
    expect(source).toContain('SPOKEN_CARRY_MAX_CHARS = 300');
    expect(source).toContain('validateSpokenBridge(parsed.bridge)');
    expect(source).toContain('validateSpokenCarry(parsed.carry)');
  });

  it('the output shape and parse ceilings are unchanged', () => {
    expect(count(source, '"reflect":"<one question, two sentences max>"')).toBe(2);
    expect(count(source, '"bridge":"<the spoken bridge, or empty string>"')).toBe(2);
    expect(source).toContain('reflect: reflect.slice(0, 400)');
    expect(source).toContain('challenge: challenge.slice(0, 400)');
    expect(source).toContain('SCENE_MAX_CHARS = 280');
  });
});

describe('tailor-devotional — the same shape, fitted to one morning', () => {
  for (const audience of ['men', 'women'] as const) {
    it(`the ${audience} morning task carries the distinctives`, () => {
      const task = buildTailorTask(audience);
      expect(task).toContain('THE CATHOLIC SHAPE OF IT');
      expect(task).toContain(
        "the Church's sacramental life: the Mass and the Eucharist, Confession, Mary, the communion of saints",
      );
      expect(task).toContain('ONE PUSH ACROSS THE PAIR, IN ONE PIECE, KEPT QUIET');
      expect(task).toContain('at most one distinctively Catholic push');
      expect(task).toContain('it lands in one piece or the other, never both');
      expect(task).toContain('assumed, lived, unexplained');
      expect(task).toContain('should recognize them as genuinely ours');
      expect(task).toContain('should never feel lectured or marketed to');
      expect(task).toContain('LET THE SEASON SET THE WEIGHT');
      expect(task).toContain('Lent leans toward prayer, fasting, and almsgiving');
      expect(task).toContain('never a paragraph number, never an invented quotation');
    });

    it(`the ${audience} challenge bank is fitted to the stated focus`, () => {
      const task = buildTailorTask(audience);
      for (const phrase of [
        'grief asks for prayer for the dead, or a Mass intention asked for the one who has died',
        'temptation asks for an act of contrition with a concrete plan for Confession, or a small fast',
        'a decision asks for ten minutes before the Blessed Sacrament',
        'marriage and family ask for a work of mercy inside the home, or praying together tonight',
        'a decade of the Rosary',
        'a brief examination of conscience tonight',
        'not a quota to fill',
      ]) {
        expect(task).toContain(phrase);
      }
      // The morning output shape is unchanged: exactly the two fields.
      expect(task).toContain('{"reflect": "...", "challenge": "..."}');
      expect(task).toContain('40 words or fewer');
    });
  }

  it('the PM twin gains the distinctives lightly — the prayer instructions stand as they were', () => {
    for (const audience of ['men', 'women'] as const) {
      const pm = buildPmTask(audience);
      expect(pm).toContain('Where the reckoning genuinely opens onto');
      expect(pm).toContain('name it plainly, once, as furniture and not as a lesson');
      // The closing prayer keeps its original fence, word for word.
      expect(pm).toContain('NEVER attribute words to a saint or to Scripture that are not theirs');
      expect(pm).toContain('{"reflect": "...", "prayer": "...", "carry": "..."}');
      expect(pm).toContain('80 words or fewer');
      expect(pm).toContain('50 words or fewer');
      expect(pm).toContain('20 words or fewer');
    }
  });
});
