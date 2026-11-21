import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The gatekeeper packet (Nov 20, 2026; v2 the same day). Two printed pages
 * for priests and parish leaders — what Sanctum is, and what a free pilot
 * asks of a parish (nothing) — shipped as a static PDF and offered from
 * the About page's leaders section. The PDF is built from
 * docs/gatekeeper-packet.html via WeasyPrint; the content pins below read
 * that source, and they hold the v2 facts: the elevator pitch leads, the
 * priest-review ask is explicit with the honest status (no review
 * completed, no pilot run), the privacy headline stands in its true form
 * with the held-remotely things named, the audio claim is the corrected
 * one (narrated AI voice, companions text-only), no per-parish report is
 * promised, and the economics stay specific. The founder-thesis line
 * never appears — it is individual-facing only.
 */

const ROOT = join(__dirname, '..', '..');
const about = readFileSync(join(ROOT, 'src/components/AboutSanctumPage.tsx'), 'utf8');
const packet = readFileSync(join(ROOT, 'docs/gatekeeper-packet.html'), 'utf8');
// Visible text only: the source's comments are build notes, not packet copy.
const packetText = packet.replace(/<!--[\s\S]*?-->/g, '');

describe('the gatekeeper packet', () => {
  it('the PDF ships as a static asset', () => {
    const path = join(ROOT, 'public/gatekeeper-packet.pdf');
    const head = readFileSync(path).subarray(0, 4).toString('latin1');
    expect(head).toBe('%PDF');
    expect(statSync(path).size).toBeGreaterThan(5000);
  });

  it('the About page offers the download, once, in the leaders section', () => {
    expect(about.split('gatekeeper-packet.pdf').length - 1).toBe(1);
    expect(about).toContain('href="/gatekeeper-packet.pdf"');
    expect(about).toContain('For parish leaders — the gatekeeper packet');
    // The link stands after the leaders copy it belongs with.
    expect(about.indexOf('gatekeeper-packet.pdf')).toBeGreaterThan(
      about.indexOf('For priests and group leaders'),
    );
  });

  it('the link block does not branch by track — both tracks see it identically', () => {
    const block = about.slice(
      about.indexOf('The gatekeeper packet (Nov 20, 2026)'),
      about.indexOf('gatekeeper-packet.pdf'),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toContain('w ?');
  });

  it('v2 leads with the pitch and the review ask, status stated honestly', () => {
    // The thirty-second pitch stands before the description of the app.
    expect(packetText).toContain('your people live on their phones between Sundays');
    expect(packetText.indexOf('between Sundays')).toBeLessThan(packetText.indexOf('What Sanctum Is'));
    // The ask is explicit, and so is the fact that it has not happened yet.
    expect(packetText).toContain('What I am asking of you');
    expect(packetText).toContain('No priest review has been completed yet, and no pilot has run');
  });

  it('v2 keeps the privacy headline in its true form and names what is held', () => {
    expect(packetText).toContain('Nothing a user writes is stored on a server');
    expect(packetText).toContain('a scrambled anti-abuse counter');
    expect(packetText).toContain('anonymous usage counts, only for those who turn them on');
    expect(packetText).toContain('deleted within ninety days');
    expect(packetText).toContain('The parish name never leaves the phone');
  });

  it('v2 states the corrected audio claim and the portrayal fences', () => {
    expect(packetText).toContain('narrated as well as written, in an AI voice');
    expect(packetText).toContain('Companions are <strong>text-only</strong>');
    expect(packetText).not.toContain('plain human voice');
    expect(packetText).not.toContain('Everything can be listened to');
    expect(packetText).toContain('handed to 988 and to real help');
    expect(packetText).toContain('masstimes.org');
  });

  it('v2 promises no per-parish report and splits the pilot into now and later', () => {
    expect(packetText).toContain('No per-parish report exists, and this pilot does not promise one');
    expect(packetText).not.toContain('Counts, and only counts');
    expect(packetText).toContain('None of these are built yet');
  });

  it('v2 keeps the economics specific and the thesis line out', () => {
    expect(packetText).toContain('one flat license');
    expect(packetText).toContain('No per-person fees, no challenge credits, no percentage of donations, ever');
    expect(packetText).toContain('Prayer will never be metered, and it will never be paywalled');
    // The founder-thesis line is individual-facing only (Erik, Nov 20).
    expect(packetText).not.toContain('Bloy');
    expect(packetText).not.toContain('not becoming a saint');
  });
});
