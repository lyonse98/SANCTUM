import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MenuSheet } from '../components/MenuSheet';
import { TopHeader } from '../components/TopHeader';
import { FOCUS_ROUTES } from './pushCore';
import type { PersonaTheme } from '@/types';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The core diet (Erik, Nov 13, 2026): the bottom tab bar is retired. Today is
 * the only home under a slim top header; everything else — Companions, Pocket
 * Church, Real Help, and the housekeeping — lives in the menu sheet. TabBar.tsx
 * stays in the repo UNWIRED, exactly as it was, so the diet can be reverted by
 * re-mounting it. These tests pin the new shape: no bar mounted in either
 * shell, the sheet's eight entries in their two groups, and every landing
 * (push focus, companion tool link) still resolving to a real view.
 */

const theme = {
  bg: '#E9E6DC',
  card: '#F7F4EC',
  border: '#D8D2C2',
  accent: '#1E6B3A',
  text: '#3A352E',
  textBright: '#1B1815',
  textMuted: '#6B6455',
  textDim: '#8A8272',
} as unknown as PersonaTheme;

const utilities = {
  onOpenSettings: vi.fn(),
  onShareInvite: vi.fn(),
  onOpenFeedback: vi.fn(),
  onOpenAbout: vi.fn(),
  onOpenReminder: vi.fn(),
};

function renderSheet() {
  return renderToString(
    createElement(MenuSheet, {
      open: true,
      t: theme,
      onClose: vi.fn(),
      onNavigate: vi.fn(),
      utilities,
    }),
  );
}

function entryOrder(html: string): string[] {
  return [...html.matchAll(/data-menu-entry="([a-z-]+)"/g)].map((m) => m[1]);
}

describe('the tab bar is retired, not deleted', () => {
  it('TabBar.tsx stays in the repo, unwired, with its slot geometry intact for a revert', () => {
    expect(existsSync(join(SRC, 'components', 'TabBar.tsx'))).toBe(true);
    const bar = read('components/TabBar.tsx');
    expect(bar).toContain('export const TABS');
    expect(bar).toContain('export function TabBar');
  });

  it('neither shell mounts it any more', () => {
    const app = read('App.tsx');
    expect(app).not.toContain('<TabBar');
    expect(app).not.toContain("from '@/components/TabBar'");
  });

  it('the main shell wears the slim top header; both shells carry the menu sheet', () => {
    const app = read('App.tsx');
    expect(app).toContain('<TopHeader');
    expect(app.match(/<MenuSheet/g)).toHaveLength(2);
    // The wordmark is the way home.
    expect(app).toContain("onHome={() => handleChangeView('today')}");
    // Sub-views carry the plain return under the header.
    expect(app).toContain('&lsaquo; Today');
  });

  it('the chat shell keeps its own header and gains the Menu button', () => {
    const app = read('App.tsx');
    expect(app).toContain('onOpenMenu={() => setMenuOpen(true)}');
    expect(read('components/Header.tsx')).toContain('onOpenMenu');
  });
});

describe('the top header — wordmark and Menu, nothing else', () => {
  it('renders Sanctum and a Menu button', () => {
    const html = renderToString(
      createElement(TopHeader, { t: theme, onHome: vi.fn(), onOpenMenu: vi.fn() }),
    );
    expect(html).toContain('Sanctum');
    expect(html).toContain('Menu');
    expect(html).not.toContain('Companions');
    expect(html).not.toContain('Real Help');
  });
});

describe('the menu sheet — two groups, eight entries', () => {
  it('GO holds Companions, Pocket Church, Real Help, in that order', () => {
    const order = entryOrder(renderSheet());
    expect(order.slice(0, 3)).toEqual(['companions', 'church', 'help']);
  });

  it('APP holds Settings, Reminders, Feedback, About, Share, in that order', () => {
    const order = entryOrder(renderSheet());
    expect(order.slice(3)).toEqual(['settings', 'reminders', 'feedback', 'about', 'share']);
    expect(order).toHaveLength(8);
  });

  it('each destination carries its one-line descriptor', () => {
    const html = renderSheet();
    expect(html).toContain('Talk through today with a saint');
    expect(html).toContain('Pray · Confession · Ask');
    expect(html).toContain('Priests, counselors, crisis lines');
  });

  it('Real Help is rendered with exactly the same weight as the other destinations', () => {
    const html = renderSheet();
    const rowClass = (key: string) => {
      const start = html.indexOf(`data-menu-entry="${key}"`);
      const buttonStart = html.lastIndexOf('<button', start);
      const tag = html.slice(buttonStart, html.indexOf('>', buttonStart));
      return /class="([^"]*)"/.exec(tag)?.[1];
    };
    expect(rowClass('help')).toBe(rowClass('companions'));
    expect(rowClass('help')).toBe(rowClass('church'));
    // No alarm styling on the row: the crisis content lives inside Real Help itself.
    const helpStart = html.indexOf('data-menu-entry="help"');
    const helpRow = html.slice(html.lastIndexOf('<button', helpStart), html.indexOf('</button>', helpStart));
    expect(helpRow).not.toContain('988');
  });

  it('a closed sheet renders nothing', () => {
    const html = renderToString(
      createElement(MenuSheet, {
        open: false,
        t: theme,
        onClose: vi.fn(),
        onNavigate: vi.fn(),
        utilities,
      }),
    );
    expect(html).toBe('');
  });
});

describe('landings still resolve to views', () => {
  it('push focuses land where they always landed', () => {
    expect(FOCUS_ROUTES.gospel).toEqual({ tab: 'today' });
    expect(FOCUS_ROUTES.examen).toEqual({ tab: 'today', todayExamen: true });
    expect(FOCUS_ROUTES.rosary).toEqual({ tab: 'church', churchTab: 'pray', churchPray: 'rosary' });
    expect(FOCUS_ROUTES.rule).toEqual({ tab: 'church' });
    const app = read('App.tsx');
    expect(app).toContain('parseFocusParam(window.location.search)');
    expect(app).toContain('setView(route.tab)');
  });

  it('companion tool links still route — church doors, help, tonight, and chat itself', () => {
    const app = read('App.tsx');
    expect(app).toContain("'rosary': { tab: 'church', churchTab: 'pray', churchPray: 'rosary' }");
    expect(app).toContain("'confession': { tab: 'church', churchTab: 'confession' }");
    expect(app).toContain("'catechism': { tab: 'church', churchTab: 'ask' }");
    expect(app).toContain("'help': { tab: 'help' }");
    expect(app).toContain("'examen': { tab: 'today', todayExamen: true }");
    // The chat feed still hands its tool links to the router.
    expect(app).toContain('onOpenTool={openToolLink}');
  });
});
