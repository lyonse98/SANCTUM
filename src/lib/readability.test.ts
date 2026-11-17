import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PRINT_STAMP_CLASS } from './print';

/**
 * The readability pass (retention Play 2, Nov 16, 2026). The stakeholder
 * audit (P-8) counted 263 instances of 8–12px type; the Users lens found
 * the small type a hard barrier for the 50+/65+ parish backbone. The rule
 * this suite pins: in every WIRED component, nothing a user must read
 * stands below 12px — prose, instructions, and disclosures at 13px where
 * the layout breathes, labels/buttons/status at 12px — and the printed
 * stamp idiom itself now sits at 12px (see print.ts). Sizes only: no
 * copy, color, or structure changed hands in the pass.
 *
 * Scope is every component under src/components plus src/App.tsx, minus
 * the six retired, unwired components named below (verified unwired: no
 * import path from App.tsx reaches them; other suites pin that they stay
 * in the repo unrendered). New components join the scope automatically.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const RETIRED_UNWIRED = new Set([
  'TabBar.tsx',
  'TopHeader.tsx',
  'SaintOfDayCard.tsx',
  'LectioDivina.tsx',
  'RuleOfLife.tsx',
  'EveningExamen.tsx',
]);

const wiredFiles: string[] = [
  ...readdirSync(join(ROOT, 'src', 'components'))
    .filter((name) => name.endsWith('.tsx') && !RETIRED_UNWIRED.has(name))
    .map((name) => `components/${name}`),
  'App.tsx',
];

const wiredSources = wiredFiles.map((rel) => ({ rel, src: readSrc(rel) }));

/**
 * The justified survivor count: ZERO. Every sub-12px instance found by
 * the pass carried unique information — body copy, instructions, form
 * labels, button text, status lines, the crisis lines, the disclosures —
 * and the only purely decorative candidates (single-glyph separators:
 * the "•" between the gate/About chips, the "·" in the utilities line)
 * raised to 12px with no layout cost, so no survivor is justified. The
 * ceiling can only go down from here; a future sub-12px instance fails
 * this suite until it is raised or individually justified in this file.
 */
const SUB_12_SURVIVOR_CEILING = 0;

const countMatches = (src: string, pattern: RegExp) => src.match(pattern)?.length ?? 0;

describe('readability floor — no micro-type in wired components', () => {
  it('no text-[8px] or text-[9px] anywhere in wired components', () => {
    for (const { rel, src } of wiredSources) {
      expect(src, rel).not.toMatch(/text-\[(8|9)px\]/);
    }
  });

  it(`remaining sub-12px instances stay at or under the survivor ceiling (${SUB_12_SURVIVOR_CEILING})`, () => {
    const total = wiredSources.reduce(
      (sum, { src }) => sum + countMatches(src, /text-\[(8|9|10|11)px\]/g),
      0,
    );
    expect(total).toBeLessThanOrEqual(SUB_12_SURVIVOR_CEILING);
  });

  it('the printed stamp idiom itself stands at the 12px floor', () => {
    expect(PRINT_STAMP_CLASS).toContain('text-[12px]');
    expect(readSrc('lib/print.ts')).not.toMatch(/text-\[(8|9|10|11)px\]/);
  });
});

describe('the portrayal disclosure reads as text, not small print', () => {
  /** The class on the element wrapping a rendered line stands just before it. */
  const wrappingClassCarries = (src: string, marker: string, sizeClass: string) => {
    const at = src.indexOf(marker);
    expect(at, marker).toBeGreaterThanOrEqual(0);
    return src.slice(Math.max(0, at - 400), at).includes(sizeClass);
  };

  it('companion select screen: the portrayal line stands at 13px', () => {
    const select = readSrc('components/CompanionSelect.tsx');
    expect(wrappingClassCarries(select, '{COMPANION_PORTRAYAL_LINE}', 'text-[13px]')).toBe(true);
  });

  it('in-chat: the portrayal line stands at 13px', () => {
    const feed = readSrc('components/ChatFeed.tsx');
    expect(wrappingClassCarries(feed, '{COMPANION_PORTRAYAL_LINE}', 'text-[13px]')).toBe(true);
  });

  it('the other disclosure renderings raised in the same pass hold at 13px', () => {
    // Aquinas portrayal line (Ask door), the first-listen narrator note,
    // and the Terms page narrator line — disclosures all, none small print.
    const qa = readSrc('components/CatechismQA.tsx');
    expect(wrappingClassCarries(qa, 'AI portrayal. Type your question', 'text-[13px]')).toBe(true);
    const bar = readSrc('components/ListenBar.tsx');
    expect(wrappingClassCarries(bar, 'data-listen-disclosure-note', 'text-[13px]')).toBe(true);
    const terms = readSrc('components/TermsPage.tsx');
    expect(wrappingClassCarries(terms, '{narratorDisclosureLine(audience)}', 'text-[13px]')).toBe(true);
  });
});
