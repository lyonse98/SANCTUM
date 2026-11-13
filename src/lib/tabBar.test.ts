import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MoreOfSanctum } from '../components/MoreOfSanctum';
import { UtilitiesLine } from '../components/UtilitiesLine';
import { FOCUS_ROUTES } from './pushCore';
import type { PersonaTheme } from '@/types';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * Navigation, third shape (Erik, Nov 13, 2026 — Option B, "Foot of Today"):
 * the bottom tab bar was retired first, then the top header and menu sheet
 * followed it. Today is the only home and it ends, in order, with the More
 * of Sanctum block (the three destinations) over the utilities line; the
 * same utilities line closes the three destination pages. TabBar.tsx,
 * TopHeader.tsx, and MenuSheet.tsx all stay in the repo UNWIRED, so any of
 * the retired shapes can be reverted by re-mounting. These tests pin the
 * new shape: no header or sheet mounted in either shell, the Today stack
 * order, the More rows' destinations, and every landing (push focus,
 * companion tool link) still resolving to a real view.
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

describe('the retired chrome stays in the repo, unwired', () => {
  it('TabBar.tsx, TopHeader.tsx, and MenuSheet.tsx all still exist with their exports', () => {
    expect(existsSync(join(SRC, 'components', 'TabBar.tsx'))).toBe(true);
    expect(read('components/TabBar.tsx')).toContain('export function TabBar');
    expect(existsSync(join(SRC, 'components', 'TopHeader.tsx'))).toBe(true);
    expect(read('components/TopHeader.tsx')).toContain('export function TopHeader');
    expect(existsSync(join(SRC, 'components', 'MenuSheet.tsx'))).toBe(true);
    expect(read('components/MenuSheet.tsx')).toContain('export function MenuSheet');
  });

  it('neither shell mounts the bar, the header, or the sheet any more', () => {
    const app = read('App.tsx');
    expect(app).not.toContain('<TabBar');
    expect(app).not.toContain('<TopHeader');
    expect(app).not.toContain('<MenuSheet');
    expect(app).not.toContain("from '@/components/TabBar'");
    expect(app).not.toContain("from '@/components/TopHeader'");
    expect(app).not.toContain("from '@/components/MenuSheet'");
    // The sheet's open state died with its mounts.
    expect(app).not.toContain('menuOpen');
    expect(app).not.toContain('setMenuOpen');
  });

  it('sub-views carry the plain "‹ Today" return at the top of the content area', () => {
    const app = read('App.tsx');
    expect(app).toContain('&lsaquo; Today');
    expect(app).toContain("view !== 'today'");
    expect(app).toContain("onClick={() => handleChangeView('today')}");
  });

  it('the chat shell has no Menu button — its header keeps its own controls', () => {
    const app = read('App.tsx');
    expect(app).not.toContain('onOpenMenu');
    const header = read('components/Header.tsx');
    expect(header).not.toContain('onOpenMenu');
    expect(header).not.toContain('aria-label="Menu"');
    // The gear and the rest of the chat header's controls remain.
    expect(header).toContain('onOpenSettings');
    expect(header).toContain('onGoHome');
    expect(header).toContain('onPanic');
  });

  it('the chat shell no longer mounts the invite modal — it lives in the main shell only', () => {
    const app = read('App.tsx');
    expect(app.match(/<ShareInviteModal/g)).toHaveLength(1);
  });
});

describe('the Today stack — Gospel, reminder, Tonight, More, utilities (in that order)', () => {
  const home = read('components/HomeScreen.tsx');

  it('renders the five pieces in Erik’s order, the utilities line last', () => {
    const at = (needle: string) => home.indexOf(needle);
    const gospel = at('<DailyQuote');
    const reminder = at('<ReminderCard');
    const tonight = at('<TonightClosing');
    const more = at('<MoreOfSanctum');
    const line = at('<UtilitiesLine');
    for (const i of [gospel, reminder, tonight, more, line]) expect(i).toBeGreaterThan(-1);
    expect(gospel).toBeLessThan(reminder);
    expect(reminder).toBeLessThan(tonight);
    expect(tonight).toBeLessThan(more);
    // More of Sanctum still above Settings, Reminders, Feedback, About —
    // the utilities line is the final element of the stack.
    expect(more).toBeLessThan(line);
  });

  it('the old one-line Real Help link is gone — the More block replaced it', () => {
    expect(home).not.toContain('Need real help?');
    expect(home).not.toContain('HeartHandshake');
  });
});

describe('More of Sanctum — the three destinations at the foot of Today', () => {
  function renderMore() {
    return renderToString(createElement(MoreOfSanctum, { t: theme, onNavigate: vi.fn() }));
  }

  it('holds Companions, Pocket Church, Real Help, in that order, under its heading', () => {
    const html = renderMore();
    expect(html).toContain('More of Sanctum');
    const order = [...html.matchAll(/data-more-entry="([a-z-]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['companions', 'church', 'help']);
  });

  it('each row carries its one-line descriptor', () => {
    const html = renderMore();
    expect(html).toContain('Talk through today with a saint');
    expect(html).toContain('Pray · Confession · Ask');
    expect(html).toContain('Priests, counselors, crisis lines');
  });

  it('Real Help is rendered with exactly the same weight as the other destinations', () => {
    const html = renderMore();
    const rowClass = (key: string) => {
      const start = html.indexOf(`data-more-entry="${key}"`);
      const buttonStart = html.lastIndexOf('<button', start);
      const tag = html.slice(buttonStart, html.indexOf('>', buttonStart));
      return /class="([^"]*)"/.exec(tag)?.[1];
    };
    expect(rowClass('help')).toBe(rowClass('companions'));
    expect(rowClass('help')).toBe(rowClass('church'));
    // No alarm styling on the row: the crisis content lives inside Real Help itself.
    const helpStart = html.indexOf('data-more-entry="help"');
    const helpRow = html.slice(html.lastIndexOf('<button', helpStart), html.indexOf('</button>', helpStart));
    expect(helpRow).not.toContain('988');
  });

  it('the rows navigate through the shell’s view change, handed down by App', () => {
    expect(read('components/MoreOfSanctum.tsx')).toContain('onNavigate(entry.key)');
    expect(read('components/HomeScreen.tsx')).toContain('onNavigate={onNavigate}');
    expect(read('App.tsx')).toContain('onNavigate={handleChangeView}');
  });
});

describe('the utilities line — on Today and at the foot of the other three views', () => {
  it('renders Settings · Reminders · Feedback · About · Share, in that order', () => {
    const html = renderToString(createElement(UtilitiesLine, { t: theme, utilities }));
    const order = [...html.matchAll(/data-utilities-entry="([a-z-]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['settings', 'reminders', 'feedback', 'about', 'share']);
    for (const label of ['Settings', 'Reminders', 'Feedback', 'About', 'Share']) {
      expect(html).toContain(label);
    }
  });

  it('every main view mounts the line, and App hands each one the utilities object', () => {
    for (const page of [
      'components/HomeScreen.tsx',
      'components/CompanionSelect.tsx',
      'components/PocketChurchPage.tsx',
      'components/FindHelpPage.tsx',
    ]) {
      expect(read(page), page).toContain('<UtilitiesLine');
    }
    expect(read('App.tsx').match(/utilities=\{utilities\}/g)).toHaveLength(4);
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
