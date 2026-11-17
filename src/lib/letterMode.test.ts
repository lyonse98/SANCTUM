import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Letter mode (chat-proxy). A companion can write the user a short letter:
 * the caller names a companion and nothing else — no text, no conversation —
 * and the function composes the whole request server-side. These pins hold
 * the shape: the branch exists, Aquinas is excluded, caller messages can
 * never reach the letter body, generation is non-streaming on the default
 * model with no corpus, and the letter instruction carries its guardrails.
 */

const ROOT = join(__dirname, '..', '..');
const source = readFileSync(join(ROOT, 'supabase/functions/chat-proxy/index.ts'), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const letterBranch = source.slice(
  source.indexOf('// ── Letter mode request ──'),
  source.indexOf('// ── Corpus retrieval'),
);

function grabConst(name: string): string {
  const m = source.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[1];
}

describe('letter mode — the branch and its gates', () => {
  it('the mode triggers on payload.mode === "letter"', () => {
    expect(source).toContain('payload.mode === "letter"');
    expect(source).toContain('const isLetterMode');
    expect(letterBranch.length).toBeGreaterThan(0);
  });

  it('messages validation applies to chat only — letter mode skips it', () => {
    // The letter flag is resolved before the validation, and the validation
    // sits inside the not-letter-mode guard, so a letter request with no
    // messages array at all still reaches the shared gates.
    expect(source.indexOf('const isLetterMode')).toBeLessThan(source.indexOf('Missing messages array'));
    expect(source).toContain('if (!isLetterMode) {');
  });

  it('both modes pass through the one quota check, exactly once', () => {
    expect(count(source, 'await withinQuota(req)')).toBe(1);
  });

  it('Aquinas is excluded from letters — a companion id is required', () => {
    expect(source).toContain('personaId === "aquinas" || !isPersonaId(personaId)');
    // The chat path keeps its own, separate Aquinas-admitting check.
    expect(source).toContain('personaId !== "aquinas" && !isPersonaId(personaId)');
  });
});

describe('letter mode — the caller can supply no text', () => {
  it('the only contents turn is the server-held fixed string', () => {
    expect(source).toContain('const LETTER_SERVER_TURN = "The letter is yours to write now."');
    expect(letterBranch).toContain('[{ role: "user", content: LETTER_SERVER_TURN }]');
  });

  it('the letter path never reads or forwards caller messages', () => {
    expect(letterBranch).not.toContain('payload.messages');
    expect(letterBranch).not.toContain('normalizeMessages');
    expect(letterBranch).not.toContain('rawMessages');
  });

  it('no corpus is retrieved for a letter, and distress is ignored', () => {
    expect(letterBranch).not.toContain('retrieveCorpus');
    expect(letterBranch).not.toContain('corpusBlock');
    expect(letterBranch).not.toContain('DISTRESS_NOTE');
    expect(letterBranch).not.toContain('payload.distress');
  });
});

describe('letter mode — generation and response', () => {
  it('generates non-streaming on the default model under the letter cap', () => {
    expect(source).toContain('const LETTER_MAX_OUTPUT_TOKENS = 1024');
    expect(letterBranch).toContain('nonStreamGemini(DEFAULT_MODEL, apiKey, letterBody)');
    expect(letterBranch).toContain('DEFAULT_MODEL');
    expect(letterBranch).toContain('LETTER_MAX_OUTPUT_TOKENS');
  });

  it('composes through buildBody with the letter instruction in the corpus slot', () => {
    expect(letterBranch).toContain('buildBody(');
    expect(letterBranch).toContain('LETTER_INSTRUCTION');
    expect(letterBranch).toContain('PERSONA_PROMPTS[personaId as string]');
  });

  it('answers with the JSON letter shape on the JSON headers', () => {
    expect(letterBranch).toContain('JSON.stringify({ ok: true, letter: letterText })');
    expect(letterBranch).toContain('headers: jsonHeaders');
  });

  it('upstream failure degrades through the existing generic error', () => {
    expect(letterBranch).toContain('errorResponse(GENERIC_UPSTREAM_ERROR, 502)');
  });
});

describe('LETTER_INSTRUCTION — the guardrails travel with the letter form', () => {
  const instruction = grabConst('LETTER_INSTRUCTION');

  it('fixes the form: a short letter, roughly 120–200 words', () => {
    expect(instruction).toContain('LETTER MODE');
    expect(instruction).toContain('roughly 120');
    expect(instruction).toContain('200 words');
  });

  it('carries the portrayal lightly — never the saint, never sent from heaven', () => {
    expect(instruction).toContain('PORTRAYAL');
    expect(instruction).toContain('portrayal');
    expect(instruction).toContain('sent from heaven');
    expect(instruction).toContain("claiming the saint's own authorship is not");
  });

  it('forbids fabricated memories of a shared past', () => {
    expect(instruction).toContain('NO FABRICATED MEMORIES');
    expect(instruction).toContain('no record of past conversations');
    expect(instruction).toContain('"when you told me"');
    expect(instruction).toContain('the shared road in general terms');
  });

  it('forbids intercession promises — praying WITH only', () => {
    expect(instruction).toContain('NO INTERCESSION PROMISES');
    expect(instruction).toContain('Never promise to pray for the reader');
    expect(instruction).toContain('praying WITH');
  });

  it('points outward to a priest, the sacraments, and the reader’s own people', () => {
    expect(instruction).toContain('POINT OUTWARD');
    expect(instruction).toContain('Sunday Mass');
    expect(instruction).toContain('Confession named plainly');
    expect(instruction).toContain('One direction, not a list');
  });

  it('restates the absence rule for the letter form', () => {
    expect(instruction).toContain('ABSENCE:');
    expect(instruction).toContain('Never remark on absence');
  });

  it('bars revelation, absolution-adjacent language, and invented quotations', () => {
    expect(instruction).toContain('no private revelation, no prophecy');
    expect(instruction).toContain('nothing that resembles absolution');
    expect(instruction).toContain('Never invent a quotation');
  });
});

describe('letter mode — the preambles are untouched', () => {
  it('the absence guardrail still stands in both safety preambles, word for word', () => {
    expect(count(source, 'ABSENCE — NEVER REMARK ON IT')).toBe(2);
    expect(count(source, "Never remark on a user's absence, a gap in their visits, or time away")).toBe(2);
  });
});
