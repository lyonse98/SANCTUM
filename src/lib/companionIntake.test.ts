import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONAS, getPersona } from '@/personas';
import { SEASONS_OF_LIFE } from './tailorProfile';
import {
  composeIntakeSeed,
  initialIntakeState,
  intakeQuestions,
  intakeReducer,
  showsIntake,
  type IntakeAction,
  type IntakeState,
} from './companionIntake';
import { CompanionIntake } from '../components/CompanionIntake';

/**
 * The companion intake (Erik, Nov 19, 2026). The pins hold its shape:
 * four fixed questions asked one at a time of a fresh thread only; the
 * season chips read off the Tailor profile's own vocabulary, never a
 * copied list; the own-words escape on every chip question; the
 * answers composed into exactly one opening message in the person's
 * own terms — and the intake itself keeping no state anywhere, so a
 * storage registry that knows nothing of it is the correct registry.
 */

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

function run(actions: IntakeAction[], audience: 'men' | 'women' = 'men'): IntakeState {
  const questions = intakeQuestions(audience);
  return actions.reduce((s, a) => intakeReducer(s, a, questions), initialIntakeState);
}

const chip = (label: string, seed: string): IntakeAction => ({ type: 'chip', chip: { label, seed } });

describe('the four questions', () => {
  it('stands in order: brings, season, help, and the closing own-words', () => {
    expect(intakeQuestions('men').map((q) => q.id)).toEqual(['brings', 'season', 'help', 'words']);
    expect(intakeQuestions('men')[3].chips).toBeNull();
  });

  it('asks what Erik asked: brings, season, help, then in your own words', () => {
    const prompts = intakeQuestions('women').map((q) => q.prompt);
    expect(prompts).toEqual([
      'What brings you here today?',
      'Where is your life right now?',
      'What would help most?',
      'Anything else — in your own words?',
    ]);
  });

  it('the brings chips are the five Erik named', () => {
    expect(intakeQuestions('men')[0].chips?.map((c) => c.label)).toEqual([
      'Carrying something heavy', 'A decision', 'Gratitude', 'Just want company', 'Curious',
    ]);
  });

  it('the help chips are the four Erik named', () => {
    expect(intakeQuestions('men')[2].chips?.map((c) => c.label)).toEqual([
      'To be heard', 'Perspective', 'A challenge', 'Prayer',
    ]);
  });

  it('the season chips ARE the Tailor profile’s vocabulary, per track — no second list', () => {
    for (const audience of ['men', 'women'] as const) {
      expect(intakeQuestions(audience)[1].chips?.map((c) => c.label)).toEqual(
        SEASONS_OF_LIFE[audience].map((s) => s.label),
      );
    }
    const lib = read('lib/companionIntake.ts');
    expect(lib).toContain("SEASONS_OF_LIFE } from './tailorProfile'");
    expect(lib).not.toContain('Father of young children');
    expect(lib).not.toContain('Mother of young children');
  });
});

describe('the flow', () => {
  it('a chip answers and advances, one question at a time', () => {
    const s = run([chip('Carrying something heavy', 'carrying something heavy')]);
    expect(s.stepIndex).toBe(1);
    expect(s.done).toBe(false);
    expect(s.answers.brings).toEqual({ display: 'Carrying something heavy', seed: 'carrying something heavy' });
  });

  it('the own-words escape swaps the field in, and the words answer verbatim', () => {
    const questions = intakeQuestions('men');
    let s = intakeReducer(initialIntakeState, { type: 'own-words' }, questions);
    expect(s.mode).toBe('words');
    expect(s.stepIndex).toBe(0);
    s = intakeReducer(s, { type: 'words', text: '  my brother is in the hospital  ' }, questions);
    expect(s.stepIndex).toBe(1);
    expect(s.mode).toBe('chips');
    expect(s.answers.brings?.display).toBe('my brother is in the hospital');
    expect(s.answers.brings?.seed).toBe('my brother is in the hospital');
  });

  it('back-to-chips restores the choices without answering', () => {
    const questions = intakeQuestions('men');
    let s = intakeReducer(initialIntakeState, { type: 'own-words' }, questions);
    s = intakeReducer(s, { type: 'back-to-chips' }, questions);
    expect(s.mode).toBe('chips');
    expect(s.answers).toEqual({});
  });

  it('an empty own-words submission is a pass — it advances and records nothing', () => {
    const s = run([{ type: 'own-words' }, { type: 'words', text: '   ' }]);
    expect(s.stepIndex).toBe(1);
    expect(s.answers.brings).toBeUndefined();
  });

  it('the closing question takes words or a pass, and either way the intake is done', () => {
    const toLast = [
      chip('Gratitude', 'gratitude'),
      chip('Single', 'single'),
      chip('Prayer', 'prayer'),
    ];
    const withWords = run([...toLast, { type: 'words', text: 'I lost my job last week' }]);
    expect(withWords.done).toBe(true);
    expect(withWords.answers.words?.seed).toBe('I lost my job last week');
    const passed = run([...toLast, { type: 'words', text: '' }]);
    expect(passed.done).toBe(true);
    expect(passed.answers.words).toBeUndefined();
  });

  it('a chip cannot answer the closing question, and a finished intake does not move', () => {
    const atLast = run([chip('Gratitude', 'gratitude'), chip('Single', 'single'), chip('Prayer', 'prayer')]);
    const after = intakeReducer(atLast, chip('Prayer', 'prayer'), intakeQuestions('men'));
    expect(after.stepIndex).toBe(3);
    expect(after.done).toBe(false);
  });
});

describe('the seed — one opening message, in the person’s own terms', () => {
  it('a completed intake composes the whole of it', () => {
    const s = run([
      chip('Carrying something heavy', 'carrying something heavy'),
      { type: 'own-words' },
      { type: 'words', text: 'raising three kids under five' },
      chip('Prayer', 'prayer'),
      { type: 'words', text: '' },
    ]);
    expect(composeIntakeSeed(s.answers)).toBe(
      'What brings me here: carrying something heavy. Where my life is right now: raising three kids under five. What would help most: prayer.',
    );
  });

  it('free text stands verbatim inside the seed', () => {
    const s = run([
      { type: 'own-words' },
      { type: 'words', text: 'I lost my job last week' },
      chip('Single', 'single'),
      chip('To be heard', 'to be heard'),
      { type: 'words', text: 'And my mother is ill.' },
    ]);
    const seed = composeIntakeSeed(s.answers);
    expect(seed).toContain('I lost my job last week');
    expect(seed).toContain('And my mother is ill.');
    expect(seed).toBe(
      'What brings me here: I lost my job last week. Where my life is right now: single. What would help most: to be heard. In my own words: And my mother is ill.',
    );
  });

  it('skipping partway seeds only what was answered', () => {
    const s = run([chip('A decision', 'a decision'), chip('Newly married', 'newly married')]);
    expect(composeIntakeSeed(s.answers)).toBe(
      'What brings me here: a decision. Where my life is right now: newly married.',
    );
  });

  it('nothing answered — skipped at the door — seeds nothing at all', () => {
    expect(composeIntakeSeed(initialIntakeState.answers)).toBeNull();
    expect(composeIntakeSeed({})).toBeNull();
  });
});

describe('who is asked, and where the intake may stand', () => {
  it('every one of the sixteen companions is asked after', () => {
    expect(PERSONAS).toHaveLength(16);
    for (const p of PERSONAS) expect(showsIntake(p.id), p.id).toBe(true);
  });

  it('Aquinas is never asked — he is not a companion, and the Ask door mounts no intake', () => {
    expect(showsIntake('aquinas')).toBe(false);
    expect(PERSONAS.map((p) => p.id)).not.toContain('aquinas');
    expect(read('components/CatechismQA.tsx')).not.toContain('CompanionIntake');
  });

  it('the App gates the intake on a settled, empty thread — never over a history', () => {
    const app = read('App.tsx');
    expect(app).toContain('showsIntake(persona.id)');
    expect(app).toContain('messages.length === 0');
    expect(app).toContain('threadSettled');
    expect(app).toContain('<CompanionIntake');
    // And the seed goes through the ordinary send path, as a first message.
    expect(app).toContain('handleSend(text)');
  });

  it('the intake keeps no state of its own — no storage, no key, nothing beside the conversation', () => {
    for (const src of [read('lib/companionIntake.ts'), read('components/CompanionIntake.tsx')]) {
      expect(src).not.toContain('localStorage');
      expect(src).not.toContain('sessionStorage');
      expect(src).not.toContain('sanctum_');
    }
  });
});

describe('the intake on the screen', () => {
  it('opens on the first question only — the privacy line, the chips, the door out', () => {
    const html = renderToString(
      createElement(CompanionIntake, {
        persona: getPersona('joseph'),
        audience: 'men',
        onSeed: () => {},
        onSkip: () => {},
      }),
    );
    expect(html).toContain('Your answers stay in this conversation — nothing is stored on a server.');
    expect(html).toContain('What brings you here today?');
    expect(html).toContain('Carrying something heavy');
    expect(html).toContain('Say it in my own words');
    expect(html).toContain('Just start talking');
    // One question at a time: the second is not on the page yet.
    expect(html).not.toContain('Where is your life right now?');
    expect(html).not.toContain('What would help most?');
  });

  it('opens on the women’s season vocabulary when her track asks', () => {
    const html = renderToString(
      createElement(CompanionIntake, {
        persona: getPersona('monica'),
        audience: 'women',
        onSeed: () => {},
        onSkip: () => {},
      }),
    );
    expect(html).toContain('What brings you here today?');
    expect(html).toContain('St. Monica');
  });
});
