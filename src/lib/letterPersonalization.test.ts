import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/**
 * Letter personalization (Erik's ruling, Nov 16, 2026). A companion's
 * letter may be handed the day's Gospel and what the reader offered Tailor
 * Today — and nothing else. Companion conversation is a sealed zone for
 * letters: data given in conversation stays in conversation. These pins
 * hold the boundary on both sides of the wire, and hold the openness: the
 * Tailor field says what the sentence is for, and About names it too.
 */
describe('letter personalization — the client packet reads no conversation', () => {
  const letters = readSrc('lib/letters.ts');

  it('letters.ts reads no chat history, no message-cap state, no chat client', () => {
    expect(letters).not.toContain('sanctum_chat_history');
    expect(letters).not.toContain('messageCap');
    expect(letters).not.toContain("from './llm'");
    expect(letters).not.toContain('chatHistory');
  });

  it('the packet is built from the readings path and the letter-thread store only', () => {
    expect(letters).toContain("from './readings'");
    expect(letters).toContain("from './bible'");
    expect(letters).toContain("from './keyVerse'");
    expect(letters).toContain("latestLetterThread");
    expect(letters).toContain("from './letterThreads'");
  });

  it('the Tailor build keeps the morning’s sentence as a letter thread', () => {
    const tailor = readSrc('lib/tailor.ts');
    expect(tailor).toContain('appendLetterThread');
    expect(tailor).toContain("from '@/lib/letterThreads'");
  });
});

describe('letter personalization — the openness is on the surface', () => {
  it('the Tailor intake asks for one sentence and discloses the letter use at the field', () => {
    const tailorToday = readSrc('components/TailorToday.tsx');
    expect(tailorToday).toContain('what are you carrying into today?');
    expect(tailorToday).not.toContain('In your own words');
    expect(tailorToday).toContain('kept only on this phone');
    expect(tailorToday).toContain('may one day draw on it');
    // The pre-existing plain privacy sentence still stands above the form.
    expect(tailorToday).toContain('never stored on a server');
  });

  it('About names the letter thread on both tracks', () => {
    const about = readSrc('components/AboutSanctumPage.tsx');
    // The About strings escape the apostrophe (companion\u2019s), so the
    // pin counts the clause around it.
    expect(count(about, 'letter may one day draw on')).toBe(2);
    expect(count(about, 'the one sentence she offers Tailor Today')).toBe(1);
    expect(count(about, 'the one sentence he offers Tailor Today')).toBe(1);
  });
});

describe('letter mode v2 — the function packet', () => {
  const source = readRoot('supabase/functions/chat-proxy/index.ts');
  const letterBranch = source.slice(
    source.indexOf('// ── Letter mode request ──'),
    source.indexOf('// ── Corpus retrieval'),
  );
  const packetFn = source.slice(
    source.indexOf('function letterPacketFromPayload'),
    source.indexOf('function letterPacketBlock'),
  );

  it('the branch validates a packet and composes it after the letter instruction', () => {
    expect(letterBranch).toContain('letterPacketFromPayload(payload)');
    expect(letterBranch).toContain('letterPacketBlock(letterPacket)');
    expect(letterBranch).toContain('${LETTER_INSTRUCTION}');
  });

  it('with no packet, the slot is the v1 letter instruction alone, byte for byte', () => {
    expect(letterBranch).toContain(': LETTER_INSTRUCTION;');
  });

  it('the packet reads only the seven allowlisted fields', () => {
    for (const field of ['gospelCitation', 'keyVerse', 'issue', 'issueDate', 'tailorState', 'tailorFocus', 'tailorTone']) {
      expect(packetFn).toContain(`payload.${field}`);
    }
    expect(packetFn).not.toContain('payload.messages');
    expect(packetFn).not.toContain('payload.freeText');
    expect(packetFn).not.toContain('payload.profile');
  });

  it('the issue is capped at the Tailor field’s own 200 chars; enums are vocabulary-checked', () => {
    expect(packetFn).toContain('clean(payload.issue, 200)');
    expect(source).toContain('LETTER_TAILOR_STATES');
    expect(source).toContain('LETTER_TAILOR_FOCUSES');
    expect(source).toContain('LETTER_TAILOR_TONES');
    expect(packetFn).toContain('in LETTER_TAILOR_STATES');
    expect(packetFn).toContain('in LETTER_TAILOR_FOCUSES');
    expect(packetFn).toContain('in LETTER_TAILOR_TONES');
  });

  it('the composed block labels its sources for what they are', () => {
    expect(source).toContain("FOR THIS LETTER — THE DAY'S GOSPEL");
    expect(source).toContain('WHAT THE READER OFFERED FOR TAILORING');
    expect(source).toContain('given for tailoring, on purpose');
  });

  it('the PERSONAL THREAD section narrows the no-knowledge rule to the offered thread only', () => {
    expect(source).toContain('PERSONAL THREAD — HOW TO CARRY WHAT WAS OFFERED');
    expect(source).toContain('governs everything except this one thread');
    expect(source).toContain('handed a note, not told a story');
    expect(source).toContain('Never write "when you told me"');
    expect(source).toContain('no named sins or struggles the sentence itself does not name');
    expect(source).toContain('never as a fault, a failing, or a debt to be settled');
  });
});
