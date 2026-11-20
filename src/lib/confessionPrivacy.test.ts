import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Workstream 0 — the last-confession marker is removed entirely
 * (Erik's ruling, Nov 16, 2026) and confession state must never reach
 * companion chat.
 *
 * The prep tool can be used without going to Confession, so the marker
 * tracked tool use, not the sacrament. These pins hold the removal and
 * verify by source scan that neither the client payload nor the
 * chat-proxy function carries any confession-derived field.
 */
describe('confession privacy — the marker is gone', () => {
  const guide = readSrc('components/ConfessionGuide.tsx');

  it('ConfessionGuide contains no trace of the last-confession marker', () => {
    expect(guide).not.toContain('sanctum_last_confession');
    expect(guide).not.toContain('Last confession');
    expect(guide).not.toContain('I went to confession');
    expect(guide).not.toContain('relativeDay');
  });
});

describe('confession privacy — llm.ts never sends confession state', () => {
  const llm = readSrc('lib/llm.ts');

  it('contains no confession string at all (case-insensitive)', () => {
    expect(llm.toLowerCase()).not.toContain('confession');
  });

  it('builds its chat-proxy payload with exactly the eight allowed fields', () => {
    const match = llm.match(/JSON\.stringify\(\{([\s\S]*?)\}\)/);
    expect(match, 'llm.ts should build the chat-proxy body with JSON.stringify').not.toBeNull();
    const block = match![1]
      // Strip line comments so commented prose cannot be mistaken for a field.
      .replace(/\/\/[^\n]*/g, '');
    const fields = [...block.matchAll(/^\s*([A-Za-z]+)\s*(?::|,)/gm)].map((m) => m[1]);
    // northStar joined the set on Erik's ruling (Nov 18, 2026): the reader's
    // chosen compass from the standing profile — a profile label, never
    // anything about confession, and never conversation content. name
    // joined it the same day: the name the reader gave in Settings, kept
    // in its own store, riding as the name itself and nothing more.
    // accessToken joined Nov 20, 2026, on a different footing from both:
    // it is not profile data and nothing is composed from it — it is the
    // device's door key for the testing season, which the function
    // checks at the gate and discards. It carries no confession state,
    // no profile field, and no conversation content, so the privacy
    // invariant this file guards is untouched by its riding.
    expect([...fields].sort()).toEqual([
      'accessToken',
      'audience',
      'distress',
      'messages',
      'name',
      'northStar',
      'personaId',
      'season',
    ]);
  });

  it('the one profile field llm.ts reads is the North Star — nothing else from the store', () => {
    expect(llm).toContain("from '@/lib/tailorProfile'");
    expect(llm).toContain('northStarLabel(loadTailorProfile(audience).northStar)');
    for (const other of ['seasonOfLife', 'ongoingBattles', 'standingGoal', 'mediaPrefs', 'defaultTone']) {
      expect(llm).not.toContain(other);
    }
  });

  it('the name llm.ts sends comes from its own dedicated store — and nothing else rides with it', () => {
    expect(llm).toContain("from '@/lib/readerName'");
    expect(llm).toContain('loadReaderName()');
  });
});

describe('confession privacy — chat-proxy reads no confession-derived field', () => {
  const source = readRoot('supabase/functions/chat-proxy/index.ts');

  it('reads no confession-derived payload field', () => {
    // The function legitimately mentions confession as a *topic* in its
    // prompt text (e.g. SAFETY_PREAMBLE: "hear his confession", the
    // tool:confession link), so a blanket ban on the word would be wrong.
    // The privacy invariant is narrower: no payload field carries it.
    expect(source).not.toMatch(/payload\.[a-zA-Z]*confession/i);
    expect(source).not.toContain('lastConfession');
  });
});
