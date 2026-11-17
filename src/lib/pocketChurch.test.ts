import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PocketChurchPage, type ChurchTab, type PraySection } from '../components/PocketChurchPage';
import { getSeasonTheme } from './seasonTheme';
import type { Audience } from '@/types';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const utilities = {
  onOpenSettings: vi.fn(),
  onShareInvite: vi.fn(),
  onOpenFeedback: vi.fn(),
  onOpenAbout: vi.fn(),
  onOpenReminder: vi.fn(),
};

function render(audience: Audience, initialTab?: ChurchTab, initialPraySection?: PraySection) {
  return renderToString(
    createElement(PocketChurchPage, {
      onBack: vi.fn(),
      audience,
      seasonTheme: getSeasonTheme(new Date(), audience),
      initialTab: initialTab ?? null,
      initialPraySection: initialPraySection ?? null,
      utilities,
    }),
  );
}

/**
 * The Pocket Church re-cut (Erik's approval, Nov 12, 2026): three doors —
 * PRAY (the Rosary first, the prayer library beside it), CONFESSION (the
 * existing prep), ASK (the Catechism as a question surface). Lectio Divina
 * and the Rule of Life are not surfaces anywhere in this page; their
 * components stay in the repo, unwired, and every landing that once named
 * them still resolves to a real destination.
 */
describe('Pocket Church — three doors', () => {
  for (const audience of ['men', 'women'] as const) {
    it(`renders exactly the three doors on the ${audience} track`, () => {
      const html = render(audience);
      expect(html).toContain('>Pray<');
      expect(html).toContain('>Confession<');
      expect(html).toContain('>Ask<');
      // Retired surfaces are absent — no door, no card, no mention.
      expect(html).not.toContain('Rule of Life');
      expect(html).not.toContain('Lectio');
    });

    it(`the Pray door opens on the Rosary, with the Prayer Library beside it (${audience})`, () => {
      const html = render(audience);
      expect(html).toContain('The Rosary');
      expect(html).toContain('Prayer Library');
      // The library's prayers are not on screen until the section is chosen.
      expect(html).not.toContain('Our Father, who art in heaven');
    });

    it(`the Pray door can open on the Prayer Library (${audience})`, () => {
      const html = render(audience, 'pray', 'prayers');
      // The library mounts as its prayer reference (collapsed until opened).
      expect(html).toContain('Prayer reference');
      expect(html).toContain('prayers');
    });

    it(`the Confession door renders the existing prep (${audience})`, () => {
      const html = render(audience, 'confession');
      expect(html).toContain('Confession Prep');
    });

    it(`the Pray door can open on the Novenas, in the track's order (${audience})`, () => {
      const html = render(audience, 'pray', 'novenas');
      expect(html).toContain('Novenas');
      const joseph = html.indexOf('Novena to St. Joseph');
      const jude = html.indexOf('Novena to St. Jude');
      const mary = html.indexOf('Novena to Mary, Undoer of Knots');
      expect(joseph).toBeGreaterThan(-1);
      expect(jude).toBeGreaterThan(-1);
      expect(mary).toBeGreaterThan(-1);
      // Identical shelf, track order: men lead St. Joseph, women lead Mary.
      if (audience === 'men') {
        expect(joseph).toBeLessThan(jude);
        expect(jude).toBeLessThan(mary);
      } else {
        expect(mary).toBeLessThan(joseph);
        expect(joseph).toBeLessThan(jude);
      }
    });

    it(`the Confession door carries the words, and the marker is gone (${audience})`, () => {
      const html = render(audience, 'confession');
      // The Real Help script, rendered in the door from the shared data.
      expect(html).toContain('What to do');
      expect(html).toContain('Bless me, Father, for I have sinned');
      // The Act of Contrition, from the shared shelf.
      expect(html).toContain('Act of Contrition');
      expect(html).toContain('heartily sorry for having offended You');
      // The last-confession marker was removed entirely (Erik's ruling,
      // Nov 16, 2026): the prep tool can be used without going, so the
      // marker tracked tool use, not the sacrament.
      expect(html).not.toContain('Last confession');
      expect(html).not.toContain('I went to confession');
      expect(html).not.toContain('marked yet');
    });

    it(`the Ask door opens the Catechism question surface by default (${audience})`, () => {
      const html = render(audience, 'ask');
      expect(html).toContain('Ask Aquinas');
      // One door, one action (Nov 14, 2026): the reading surfaces are gone.
      expect(html).not.toContain('Objections');
      expect(html).not.toContain('The Faith');
      // The starter questions stand over the empty conversation.
      expect(html).toContain('What happens at Mass?');
      expect(html).toContain('How do I start praying?');
    });
  }

  it('the page source keeps the re-cut shape', () => {
    const page = read('components/PocketChurchPage.tsx');
    expect(page).toContain("export type ChurchTab = 'pray' | 'confession' | 'ask'");
    // Pray opens on the Rosary by construction.
    expect(page).toContain("useState<PraySection>(initialPraySection ?? 'rosary')");
    // Ask mounts the Catechism as the question surface itself (Nov 14, 2026:
    // the pillars/objections reading modes were removed — one door, one action).
    expect(page).toContain('<PocketCatechism t={t} audience={audience} />');
    expect(page).toContain('<ConfessionGuide t={t} audience={audience} />');
    // No retired surface is mounted or named.
    expect(page).not.toContain('RuleOfLife');
    expect(page).not.toContain('LectioDivina');
  });
});

describe('retired-surface landings still resolve', () => {
  it('a companion lectio link lands on Today — the Gospel card itself, nothing opened', () => {
    const app = read('App.tsx');
    expect(app).toContain("'lectio': { tab: 'today' }");
  });

  it('a companion rule link lands on the Pocket Church page, at the top', () => {
    const app = read('App.tsx');
    expect(app).toContain("'rule': { tab: 'church' }");
    expect(app).not.toContain('churchRule');
  });

  it('Lectio is absent from the Prayer Library it used to live in', () => {
    const library = read('components/PrayerLibrary.tsx');
    // No component, no modal, no prop — a comment recording the removal is all that remains.
    expect(library).not.toContain('LectioDivina');
    expect(library).not.toContain('autoOpenLectio');
    expect(library).not.toContain('onConsumeLectio');
  });
});
