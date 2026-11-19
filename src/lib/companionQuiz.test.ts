import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONAS } from '@/personas';
import {
  COMPANION_VOICE,
  QUESTIONS,
  composeWhyLine,
  recommendCompanion,
  type QuizAnswers,
} from './companionQuiz';

/**
 * Help Me Choose, deepened (Erik, Nov 19, 2026). The pins hold the
 * shape Erik ruled: four questions — the carrying (the original first
 * question, verbatim), the need in his four words, the process, and
 * how you like to be spoken to — and an engine whose first court is
 * still the hand-authored table, whose second is affinity scored off
 * that same curation, and whose every answer carries a one-line why
 * naming the carrying, the need, and the companion's own manner.
 */

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('the four questions', () => {
  it('stands in Erik’s order: carrying, need, process, spoken-to', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(['brings', 'need', 'process', 'voice']);
  });

  it('the carrying question is the original, word for word', () => {
    expect(QUESTIONS[0].prompt).toBe('What brings you here?');
    expect(QUESTIONS[0].options.map((o) => o.value)).toEqual([
      'overwhelmed', 'failing', 'restless', 'direction', 'responsibility', 'marriage',
    ]);
  });

  it('the need is asked in the four words: comfort, challenge, company, wisdom', () => {
    expect(QUESTIONS[1].options.map((o) => o.value)).toEqual(['comfort', 'challenge', 'company', 'wisdom']);
  });

  it('the spoken-to question offers gentle and direct, nothing else', () => {
    expect(QUESTIONS[3].options.map((o) => o.value)).toEqual(['gentle', 'direct']);
  });

  it('every companion in both casts carries a manner', () => {
    expect(PERSONAS).toHaveLength(16);
    for (const p of PERSONAS) {
      expect(COMPANION_VOICE[p.id], p.id).toMatch(/^(gentle|direct)$/);
    }
  });
});

describe('the table still rules where it holds an exact key', () => {
  it('men: overwhelmed + wisdom + head → Ignatius, on the authored key', () => {
    const r = recommendCompanion({ brings: 'overwhelmed', need: 'wisdom', process: 'head', voice: 'direct' }, 'men');
    expect(r.persona.id).toBe('ignatius');
    expect(r.viaKey).toBe(true);
    expect(r.reason).toContain('methodical thinker');
  });

  it('men: failing + comfort + emotion → Peter', () => {
    const r = recommendCompanion({ brings: 'failing', need: 'comfort', process: 'emotion', voice: 'gentle' }, 'men');
    expect(r.persona.id).toBe('peter');
    expect(r.viaKey).toBe(true);
  });

  it('women: responsibility + comfort + emotion → Monica, with her authored reason', () => {
    const r = recommendCompanion({ brings: 'responsibility', need: 'comfort', process: 'emotion', voice: 'gentle' }, 'women');
    expect(r.persona.id).toBe('monica');
    expect(r.viaKey).toBe(true);
    expect(r.reason).toContain('wept in front of a bishop');
  });

  it('women: marriage + challenge + discipline → Thérèse', () => {
    const r = recommendCompanion({ brings: 'marriage', need: 'challenge', process: 'discipline', voice: 'direct' }, 'women');
    expect(r.persona.id).toBe('therese-women');
    expect(r.viaKey).toBe(true);
  });
});

describe('behind the table, affinity — and the spoken-to answer counts', () => {
  it('women: failing + company + head, spoken to gently → Monica', () => {
    const r = recommendCompanion({ brings: 'failing', need: 'company', process: 'head', voice: 'gentle' }, 'women');
    expect(r.viaKey).toBe(false);
    expect(r.persona.id).toBe('monica');
  });

  it('women: the same answers, spoken to directly → Teresa — the fourth answer moved it', () => {
    const r = recommendCompanion({ brings: 'failing', need: 'company', process: 'head', voice: 'direct' }, 'women');
    expect(r.viaKey).toBe(false);
    expect(r.persona.id).toBe('teresa');
  });

  it('men: restless + company + head + gentle → Augustine', () => {
    const r = recommendCompanion({ brings: 'restless', need: 'company', process: 'head', voice: 'gentle' }, 'men');
    expect(r.viaKey).toBe(false);
    expect(r.persona.id).toBe('augustine');
  });

  it('the same answers always name the same companion', () => {
    const answers: QuizAnswers = { brings: 'direction', need: 'company', process: 'discipline', voice: 'gentle' };
    const a = recommendCompanion(answers, 'women');
    const b = recommendCompanion(answers, 'women');
    expect(a.persona.id).toBe(b.persona.id);
    expect(a.why).toBe(b.why);
  });
});

describe('the one-line why', () => {
  it('names the carrying, the need, the manner, and closes on her own tagline', () => {
    const r = recommendCompanion({ brings: 'responsibility', need: 'comfort', process: 'emotion', voice: 'gentle' }, 'women');
    expect(r.why).toBe(
      "For the weight you're carrying — St. Monica, who brings comfort in a gentle voice — the child of those tears will not perish.",
    );
  });

  it('names the need it answers — a challenge reads as a challenge', () => {
    const r = recommendCompanion({ brings: 'marriage', need: 'challenge', process: 'discipline', voice: 'direct' }, 'women');
    expect(r.why).toContain('an honest challenge');
    expect(r.why).toContain('St. Thérèse of Lisieux');
  });

  it('names wisdom when wisdom was asked, and the carrying with it', () => {
    const r = recommendCompanion({ brings: 'overwhelmed', need: 'wisdom', process: 'head', voice: 'direct' }, 'men');
    expect(r.why).toContain("when you're overwhelmed");
    expect(r.why).toContain('wisdom');
    expect(r.why).toContain('St. Ignatius');
  });

  it('is one line, composed from the persona’s real data', () => {
    const answers: QuizAnswers = { brings: 'restless', need: 'company', process: 'head', voice: 'gentle' };
    const r = recommendCompanion(answers, 'men');
    expect(r.why).not.toContain('\n');
    expect(r.why).toContain(r.persona.tagline.charAt(0).toLowerCase() + r.persona.tagline.slice(1));
    expect(composeWhyLine(r.persona, answers)).toBe(r.why);
  });
});

describe('the surfaces speak of four questions now', () => {
  it('the router runs on the engine and keeps the typable road beside it', () => {
    const router = read('components/CompanionRouter.tsx');
    expect(router).toContain('recommendCompanion');
    expect(router).toContain('matchCompanionsByNeed');
    expect(router).toContain('or answer four questions');
    expect(router).toContain('Answer four short questions');
    expect(router).toContain('data-quiz-why');
  });

  it('the companions page invites four questions', () => {
    const select = read('components/CompanionSelect.tsx');
    expect(select).toContain('Answer four quick questions to find your fit');
    expect(select).toContain("Answer four quick questions and we'll point you to the right companion.");
    expect(select).not.toContain('three quick questions');
  });
});
