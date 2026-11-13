import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { EveningExamen } from '../components/EveningExamen';
import { getSeasonTheme } from './seasonTheme';
import type { Audience } from '@/types';

/**
 * The expandable Evening Examen (Erik's ruling, Nov 12, 2026): the six checkboxes
 * inline on the Gospel screen were too much. On Today the Examen now rests as a
 * single row — title, one line, a chevron — and the checklist exists only once
 * the row is opened. A reminder landing is the one arrival that comes pre-opened.
 */

function render(audience: Audience, forceOpen = false) {
  return renderToString(
    createElement(EveningExamen, {
      t: getSeasonTheme(new Date(), audience),
      audience,
      onOpenConfession: vi.fn(),
      onOpenHelp: vi.fn(),
      forceOpen,
    }),
  );
}

describe('the Evening Examen section on Today', () => {
  it('rests collapsed: one row, a chevron, and no checklist (men)', () => {
    const html = render('men');
    expect(html).toContain('Evening Examen');
    expect(html).toContain('Close the day with Ignatius');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="evening-examen-body"');
    // The checklist steps are not on the screen until it is opened.
    expect(html).not.toContain('Contrition');
    expect(html).not.toContain('Shadow &amp; Friction');
    expect(html).not.toContain('id="evening-examen-body"');
  });

  it('rests collapsed on her track too', () => {
    const html = render('women');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Contrition');
  });

  it('a reminder landing arrives already open, checklist and all', () => {
    const html = render('men', true);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="evening-examen-body"');
    expect(html).toContain('Contrition');
    expect(html).toContain('Gratitude');
  });

  it('the forced-open landing works on her track too', () => {
    const html = render('women', true);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Contrition');
  });
});
