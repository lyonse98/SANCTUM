import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { UtilitiesRow } from '../components/UtilitiesRow';
import type { PersonaTheme } from '@/types';

/**
 * The foot-of-page utilities row (Erik's ruling, Nov 11): Settings graduated to the tab
 * ribbon's fifth slot and the companion-chat header gear, so the row keeps only the four
 * in-the-moment actions — About, Share, Feedback, Reminder — in that order, and must not
 * grow a third Settings door again.
 */

const theme = {
  card: '#F7F4EC',
  border: '#D8D2C2',
  textMuted: '#6B6455',
} as unknown as PersonaTheme;

function renderRow() {
  return renderToString(
    createElement(UtilitiesRow, {
      t: theme,
      utilities: {
        onOpenAbout: vi.fn(),
        onShareInvite: vi.fn(),
        onOpenSettings: vi.fn(),
        onOpenFeedback: vi.fn(),
        onOpenReminder: vi.fn(),
      },
    }),
  );
}

function labels(html: string): string[] {
  return [...html.matchAll(/uppercase tracking-wide">([A-Za-z]+)</g)].map((m) => m[1]);
}

describe('utilities row — four actions, no Settings', () => {
  it('renders exactly About, Share, Feedback, Reminder, in that order', () => {
    expect(labels(renderRow())).toEqual(['About', 'Share', 'Feedback', 'Reminder']);
  });

  it('has no Settings button', () => {
    const html = renderRow();
    expect(html).not.toContain('>Settings<');
    expect(html).not.toContain('title="Settings"');
  });

  it('lays the four out in a four-column grid', () => {
    expect(renderRow()).toContain('grid-cols-4');
  });
});
