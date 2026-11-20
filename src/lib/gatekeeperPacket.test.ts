import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The gatekeeper packet (Nov 20, 2026). Two printed pages for priests and
 * parish leaders — what Sanctum is, and what a free pilot asks of a parish
 * (nothing) — shipped as a static PDF and offered from the About page's
 * leaders section. These pins hold the three facts that matter: the asset
 * exists and is a real PDF, the About page links it, and the link is the
 * same on both tracks (it is addressed to the parish, not to a track).
 */

const ROOT = join(__dirname, '..', '..');
const about = readFileSync(join(ROOT, 'src/components/AboutSanctumPage.tsx'), 'utf8');

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
});
