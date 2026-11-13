import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PocketChurchPage, type ChurchTab, type PraySection } from '../components/PocketChurchPage';
import { getSeasonTheme } from './seasonTheme';
import type { Audience, UtilityActions } from '@/types';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const utilities: UtilityActions = {
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
      utilities,
      audience,
      seasonTheme: getSeasonTheme(new Date(), audience),
      initialTab: initialTab ?? null,
      initialPraySection: initialPraySection ?? null,
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

    it(`the Ask door opens the Catechism question surface by default (${audience})`, () => {
      const html = render(audience, 'ask');
      expect(html).toContain('Ask Aquinas');
    });
  }

  it('the page source keeps the re-cut shape', () => {
    const page = read('components/PocketChurchPage.tsx');
    expect(page).toContain("export type ChurchTab = 'pray' | 'confession' | 'ask'");
    // Pray opens on the Rosary by construction.
    expect(page).toContain("useState<PraySection>(initialPraySection ?? 'rosary')");
    // Ask mounts the Catechism in its question mode, logic untouched.
    expect(page).toContain('<PocketCatechism t={t} audience={audience} defaultMode="ask" />');
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
