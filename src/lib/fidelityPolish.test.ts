import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAquinasCorpusPrompt, buildAquinasPrompt } from '../../supabase/functions/chat-proxy/aquinas';

/**
 * Fidelity polish pins (Nov 14, 2026) — the prompt half of the batch. The
 * Nov 14 live eval scored 29/42 with nonAffirmation at 37.5%: answers
 * engaged false premises (a fabricated Catechism paragraph, an invented
 * Augustine quote, the date of the second coming) without ever saying
 * plainly that the premise is not so. These pins hold the FALSE PREMISES
 * instruction in place on every surface that answers — both companion
 * preambles and both Aquinas prompts — and hold its fences: it defers to
 * the crisis protocol, it lives in the safety preamble and the Aquinas
 * grounding rules only, and the Scripture-grounding blocks (mirrored into
 * tailor-devotional under their own pin) are untouched by it.
 */

const chatProxy = readFileSync(
  new URL('../../supabase/functions/chat-proxy/index.ts', import.meta.url),
  'utf8',
);
const corpusRetrieve = readFileSync(
  new URL('../../supabase/functions/corpus-retrieve/index.ts', import.meta.url),
  'utf8',
);

function grabConst(src: string, name: string): string {
  const m = src.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[1];
}

describe('FALSE PREMISES — the companion preambles', () => {
  for (const name of ['SAFETY_PREAMBLE', 'SAFETY_PREAMBLE_WOMEN'] as const) {
    it(`${name} carries the section with the plain non-affirmation forms`, () => {
      const preamble = grabConst(chatProxy, name);
      expect(preamble).toContain('FALSE PREMISES (say what is not true, plainly and early)');
      // The explicit forms the eval scorer listens for, in the persona's voice.
      expect(preamble).toContain('That is not in the Catechism.');
      expect(preamble).toContain('There is no such paragraph.');
      expect(preamble).toContain('That is not a verse of Scripture.');
      expect(preamble).toContain('never wrote that.');
      expect(preamble).toContain('The day is not given to us.');
    });

    it(`${name} defers to the crisis protocol and forbids building on the premise`, () => {
      const preamble = grabConst(chatProxy, name);
      expect(preamble).toContain('This section never overrides the CRISIS PROTOCOL above');
      expect(preamble).toContain('Do not build on the false premise');
      // The section sits AFTER the crisis protocol in the text — crisis first.
      expect(preamble.indexOf('CRISIS PROTOCOL')).toBeLessThan(preamble.indexOf('FALSE PREMISES'));
    });
  }

  it('the grounding blocks do NOT carry it — the tailor mirror pin stays honest', () => {
    for (const name of ['SCRIPTURE_GROUNDING', 'SCRIPTURE_GROUNDING_WOMEN'] as const) {
      expect(grabConst(chatProxy, name)).not.toContain('FALSE PREMISES');
    }
  });
});

describe('FALSE PREMISES — the Aquinas seat (the one the eval measures)', () => {
  it('the corpus prompt carries the rule in its grounding rules', () => {
    for (const audience of ['men', 'women'] as const) {
      const prompt = buildAquinasCorpusPrompt(audience);
      expect(prompt).toContain('FALSE PREMISES:');
      expect(prompt).toContain('That is not in the Catechism.');
      expect(prompt).toContain('There is no such paragraph.');
      expect(prompt).toContain('never wrote that.');
      expect(prompt).toContain('The day is not given to us.');
      expect(prompt).toContain('Do not build on the premise');
    }
  });

  it('the legacy (flag-off) prompt carries it too — one behavior either way', () => {
    const prompt = buildAquinasPrompt('men');
    expect(prompt).toContain('FALSE PREMISES:');
    expect(prompt).toContain('That is not in the Catechism.');
    expect(prompt).toContain('Do not build on the premise');
  });
});

describe('neighbor expansion — the retrieval half is wired into corpus-retrieve', () => {
  it('the handler expands the reranked results and fails open', () => {
    expect(corpusRetrieve).toContain('expandCccNeighbors(results, neighborSource, companion)');
    expect(corpusRetrieve).toContain('neighbor expansion failed (serving unexpanded)');
    // The response is built from the expanded list, not the raw rerank.
    expect(corpusRetrieve).toContain('results: presented.map(');
  });
});
