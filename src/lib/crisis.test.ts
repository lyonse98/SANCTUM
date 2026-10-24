import { describe, it, expect } from 'vitest';
import { detectCrisisLevel } from './crisis';

/**
 * The phrase contract for crisis detection. Every case here is a sentence a real user
 * might type. HARD must stop the conversation and show real help; SOFT only adds a
 * gentleness flag; NONE must not be flagged hard. If a list change breaks a case,
 * the case wins — change the list, not the expectation, unless the expectation itself
 * is being deliberately re-decided.
 */
const HARD_CASES = [
  'I want to die',
  "I've been thinking about suicide",
  "I'm going to kill myself tonight",
  'Everyone would be better off without me',
  "I don't want to live anymore",
  'I wish I was dead',
  'Sometimes I think about hurting myself',
  'I want to hang myself',
  "I'm going to jump off a bridge",
  "There's no reason to live like this",
  'I keep thinking about ending it all',
  'Im suicidal',
  'I’ve been cutting myself again',
  'Some nights I do not want to be here anymore',
  'I keep wishing I were dead',
  'What if I just took all my pills tonight',
  'Honestly I just want it to end my life feels pointless',
];

const SOFT_CASES = [
  'I feel empty and numb lately',
  "I'm exhausted and feel trapped in this job",
  "I can't go on like this at work, something has to change",
  'I give up, you win the argument',
];

const NOT_HARD_CASES = [
  "I'm going to kill it in this presentation tomorrow",
  'This traffic is killing me',
  'I have to jump off this call in five minutes',
  'My brother overdosed last year and I still miss him',
  'Dead tired after that shift',
  'My dog died last spring and I still miss him',
  "I'll hang the picture myself, I guess",
  'We read a psalm about death at Mass and it stayed with me',
];

describe('crisis detection — hard cases stop the conversation', () => {
  it.each(HARD_CASES)('hard: %s', (input: string) => {
    expect(detectCrisisLevel(input)).toBe('hard');
  });
});

describe('crisis detection — soft cases only add gentleness', () => {
  it.each(SOFT_CASES)('soft: %s', (input: string) => {
    expect(detectCrisisLevel(input)).toBe('soft');
  });
});

describe('crisis detection — ordinary speech is not flagged hard', () => {
  it.each(NOT_HARD_CASES)('not hard: %s', (input: string) => {
    expect(detectCrisisLevel(input)).not.toBe('hard');
  });
});
