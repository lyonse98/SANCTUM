import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Nov 19, 2026 client batch (Erik's morning notes) — the pins
 * that live here rather than in the suites they extend:
 *
 * 1. Ten-second skip buttons beside both scrubbers (the ping
 *    toggle's move is pinned in push.test.ts; the challenge marks'
 *    move is pinned in nov18Fixes.test.ts and challengesLived.test.ts;
 *    the in-Settings editor is pinned in nov18Fixes.test.ts).
 * 2. The Reflect plate at the foot of the tailored devotional, and
 *    the hygiene of what it carries into a companion chat.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const tailor = readSrc('components/TailorToday.tsx');
const listen = readSrc('components/ListenBar.tsx');
const card = readSrc('components/DailyQuote.tsx');

describe('skip buttons — ten seconds either way, beside each scrubber', () => {
  it('the Tailor player carries both skips, clamped to the stream\u2019s ends', () => {
    expect(tailor).toContain('aria-label="Back 10 seconds"');
    expect(tailor).toContain('aria-label="Forward 10 seconds"');
    expect(tailor).toContain('onClick={() => skipBy(-10)}');
    expect(tailor).toContain('onClick={() => skipBy(10)}');
    expect(tailor).toContain('Math.min(seekMax, Math.max(0, displayElapsed + delta))');
    // Before any duration is known, the skips stand disabled.
    expect(tailor).toContain('disabled={seekMax <= 0}');
  });

  it('the Listen bar carries both skips on its whole-listening seek', () => {
    expect(listen).toContain('aria-label="Back 10 seconds"');
    expect(listen).toContain('aria-label="Forward 10 seconds"');
    expect(listen).toContain('seekToGlobal(displayElapsed - 10)');
    expect(listen).toContain('seekToGlobal(displayElapsed + 10)');
    // The scrubbers themselves are untouched.
    expect(listen).toContain('aria-label="Seek through the reading"');
    expect(tailor).toContain('aria-label="Seek through your tailored devotional"');
  });
});

describe('the tailored devotional\u2019s Reflect door', () => {
  it('the plate stands at the package\u2019s foot, behind the callback', () => {
    expect(tailor).toContain('data-tile="tailor-reflect"');
    expect(tailor).toContain('{onReflectWithCompanion && (');
    expect(tailor).toContain('Reflect with a companion');
    expect(tailor).toContain('Take today&rsquo;s devotional further');
    // Only in the built state: the plate's JSX stands inside the
    // done view, after the media card.
    expect(tailor.indexOf('data-tile="tailor-reflect"')).toBeGreaterThan(
      tailor.indexOf('devotional.media.url'),
    );
  });

  it('the request carries exactly the devotional\u2019s three pieces', () => {
    const iface = tailor.slice(
      tailor.indexOf('export interface TailorReflectRequest'),
      tailor.indexOf('interface TailorTodayProps'),
    );
    expect(iface).toContain('reflect: string');
    expect(iface).toContain('challenge: string');
    expect(iface).toContain('traditionQuote');
    // Nothing of the morning's intake is in the shape.
    expect(iface).not.toContain('freeText');
    expect(iface).not.toContain('profile');
    expect(iface).not.toContain('passage');
    expect(iface).not.toContain('media');
  });

  it('the card wraps the pieces in the day\u2019s readings, on the existing road', () => {
    expect(card).toContain('buildTailoredReflectionPrompt');
    expect(card).toContain('handleReflectTailoredWithCompanion');
    expect(card).toContain('onReflectWithCompanion(buildTailoredReflectionPrompt(texts, request))');
    // Both prompts open with the one shared readings head.
    expect(card).toContain('const lines = buildReadingsLines(texts);');
    // The tailored prompt's own words name only the devotional's pieces.
    const prompt = card.slice(
      card.indexOf('const buildTailoredReflectionPrompt'),
      card.indexOf('const handleReflectTailoredWithCompanion'),
    );
    expect(prompt).toContain('request.reflect');
    expect(prompt).toContain('request.challenge');
    expect(prompt).toContain('request.traditionQuote');
    expect(prompt).not.toContain('freeText');
    expect(prompt).not.toContain('passage');
    expect(prompt).not.toContain('media');
  });
});
