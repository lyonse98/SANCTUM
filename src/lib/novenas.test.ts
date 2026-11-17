import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOVENAS, novenasForTrack, novenaDay, novenaComplete, emptyNovenaState } from '../data/novenas';
import { PRAYERS } from '../data/prayers';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The Pocket Church build (Erik's approval, Nov 14, 2026): the Confession
 * door finished (the words and the Act of Contrition in the door), Ask
 * reduced to one action with starter questions, and three novenas in
 * Pray — all of it from shared sources, all state on the device under
 * the sanctum_ prefix.
 */
describe('the novenas — data', () => {
  it('carries exactly the three novenas, each with its patronage line', () => {
    expect(NOVENAS.map((n) => n.id)).toEqual(['st-joseph', 'mary-undoer-of-knots', 'st-jude']);
    for (const novena of NOVENAS) {
      expect(novena.title.length).toBeGreaterThan(0);
      expect(novena.patronage.length).toBeGreaterThan(0);
      expect(novena.blocks.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('every block either carries its text or names a prayer on the shared shelf', () => {
    for (const novena of NOVENAS) {
      for (const block of novena.blocks) {
        if (block.sharedTitle) {
          expect(
            PRAYERS.some((p) => p.title === block.sharedTitle),
            `${novena.id}: ${block.sharedTitle} must be on the shared shelf`,
          ).toBe(true);
        } else {
          expect((block.text ?? '').length, `${novena.id}: ${block.label}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('closes each novena with the shared Our Father, Hail Mary, and Glory Be', () => {
    for (const novena of NOVENAS) {
      expect(novena.blocks.slice(-3).map((b) => b.sharedTitle)).toEqual(['Our Father', 'Hail Mary', 'Glory Be']);
    }
  });

  it('orders the shelf per track — identical content, track order', () => {
    expect(novenasForTrack('men').map((n) => n.id)).toEqual(['st-joseph', 'st-jude', 'mary-undoer-of-knots']);
    expect(novenasForTrack('women').map((n) => n.id)).toEqual(['mary-undoer-of-knots', 'st-joseph', 'st-jude']);
  });

  it('the day marker is the count of days prayed, plus one, capped at nine', () => {
    expect(novenaDay(emptyNovenaState())).toBe(1);
    expect(novenaDay({ startedISO: '2026-11-10', prayedDates: ['2026-11-10', '2026-11-11'] })).toBe(3);
    expect(novenaComplete({ startedISO: '2026-11-01', prayedDates: Array(9).fill('2026-11-01') })).toBe(true);
    expect(novenaComplete(emptyNovenaState())).toBe(false);
  });
});

describe('the build’s single-source discipline', () => {
  it('the Confession door imports the script — the words live only in realHelp.ts', () => {
    const guide = read('components/ConfessionGuide.tsx');
    expect(guide).toContain("from '@/lib/realHelp'");
    expect(guide).not.toContain('Bless me, Father');
    expect(guide).toContain("from '@/data/prayers'");
    // The Act of Contrition's text is not copied into the guide either.
    expect(guide).not.toContain('heartily sorry');
  });

  it('the prayer texts live in the data module, not in the library component', () => {
    const library = read('components/PrayerLibrary.tsx');
    expect(library).toContain("from '@/data/prayers'");
    expect(library).not.toContain('heartily sorry');
    expect(PRAYERS).toHaveLength(14);
    expect(PRAYERS.find((p) => p.title === 'Act of Contrition')?.text).toContain('heartily sorry');
  });

  it('the Ask surface has no modes left — no pillars, no objections, no defaultMode', () => {
    const catechism = read('components/PocketCatechism.tsx');
    expect(catechism).not.toContain('PILLARS');
    expect(catechism).not.toContain('OBJECTIONS');
    expect(catechism).not.toContain('defaultMode');
    expect(catechism).toContain('<CatechismQA t={t} audience={audience} />');
    // The data itself stays in the repo — only the surfaces were removed.
    const data = read('data/catechism.ts');
    expect(data).toContain('export const CATECHISM');
    expect(data).toContain('export const OBJECTIONS');
  });

  it('the starter questions are the curated six', () => {
    const qa = read('components/CatechismQA.tsx');
    for (const q of [
      // (The confession question's apostrophe is an escape in the source;
      // its distinctive tail identifies it.)
      'just confess my sins directly to God?',
      'Why do Catholics pray to saints instead of going straight to God?',
      'Why baptize infants?',
      'What is the Eucharist?',
      'How do I start praying?',
      'What happens at Mass?',
    ]) {
      expect(qa).toContain(q);
    }
  });

  it('the new keys live under the sanctum_ prefix, inside the panic wipe’s sweep', () => {
    const guide = read('components/ConfessionGuide.tsx');
    expect(guide).toContain("'sanctum_confession_notes'");
    const novenas = read('components/Novenas.tsx');
    expect(novenas).toContain('sanctum_novena_${id}');
    expect(novenas).toContain('sanctum_novena_${id}_intention');
  });
});
