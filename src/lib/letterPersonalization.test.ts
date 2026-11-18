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

  it('the one profile source a letter may read is the North Star (Nov 18, 2026)', () => {
    expect(letters).toContain("from './tailorProfile'");
    expect(letters).toContain('northStarLabel(loadTailorProfile(audience).northStar)');
    // No other profile field may ride into a letter — the rest of the
    // standing profile stays Tailor-and-companions only.
    for (const other of ['seasonOfLife', 'ongoingBattles', 'standingGoal', 'mediaPrefs', 'defaultTone']) {
      expect(letters).not.toContain(other);
    }
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

  it('About names the North Star choice on both tracks (Nov 18, 2026)', () => {
    const about = readSrc('components/AboutSanctumPage.tsx');
    expect(count(about, 'the North Star she may choose')).toBe(1);
    expect(count(about, 'the North Star he may choose')).toBe(1);
    expect(count(about, 'which guides Tailor, the companions, and a companion')).toBe(2);
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

  it('the packet reads only the eight allowlisted fields', () => {
    for (const field of ['gospelCitation', 'keyVerse', 'issue', 'issueDate', 'tailorState', 'tailorFocus', 'tailorTone', 'northStar']) {
      expect(packetFn).toContain(`payload.${field}`);
    }
    expect(packetFn).not.toContain('payload.messages');
    expect(packetFn).not.toContain('payload.freeText');
    expect(packetFn).not.toContain('payload.profile');
  });

  it('the North Star is a standalone field — admitted without the Tailor issue', () => {
    // It is cleaned before (and independently of) the issue block: the
    // enums ride only with their sentence, the star rides on its own.
    const starAt = packetFn.indexOf('cleanNorthStar(payload.northStar)');
    const issueAt = packetFn.indexOf('const issue = clean(payload.issue, 200)');
    expect(starAt).toBeGreaterThanOrEqual(0);
    expect(starAt).toBeLessThan(issueAt);
    expect(source).toContain("THE READER'S NORTH STAR");
    expect(source).toContain('You may quote it exactly as given');
    expect(source).toContain('Never present it as revelation');
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

  it('the chat path carries its own North Star block — and letter mode never uses it', () => {
    // Chat: one guarded append to the persona instruction, both tracks and
    // Aquinas alike (they share the personaPrompt this rides on).
    expect(source).toContain('const northStar = cleanNorthStar(payload.northStar);');
    expect(source).toContain('quietly color your counsel when it genuinely fits');
    expect(source).toContain('do not recite it back in every reply');
    // Letters are handed the star through the packet block instead — the
    // letter branch must not contain the chat block's wording.
    expect(letterBranch).not.toContain('quietly color your counsel');
    expect(letterBranch).toContain('letterPacketFromPayload(payload)');
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
