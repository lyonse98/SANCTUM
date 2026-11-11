import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TabBar, TABS } from '../components/TabBar';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The five-slot bar (Erik's ruling, Nov 11, option B): four areas made an even bar, and
 * an even bar has no centre — the raised Today sat third of four, visibly right of the
 * middle. Settings takes the fifth slot as an ACTION, so Today is slot three of five,
 * dead centre, with two slots flanking it on each side. These tests pin that geometry
 * and the action-not-a-tab contract so a later edit cannot quietly un-centre the Gospel
 * or promote Settings into a destination.
 */

function renderBar(active: 'church' | 'companions' | 'today' | 'help' = 'today') {
  return renderToString(
    createElement(TabBar, {
      active,
      onChange: vi.fn(),
      accent: '#1E6B3A',
      cardColor: '#F7F4EC',
      borderColor: '#D8D2C2',
      textDim: '#8A8272',
      onOpenSettings: vi.fn(),
    }),
  );
}

function slotOrder(html: string): string[] {
  return [...html.matchAll(/data-slot="([a-z-]+)"/g)].map((m) => m[1]);
}

describe('five slots, Today dead centre', () => {
  it('the tab list itself is Church, Companions, Today, Real Help — Today at index 2', () => {
    expect(TABS.map((t) => t.id)).toEqual(['church', 'companions', 'today', 'help']);
    expect(TABS[2].id).toBe('today');
  });

  it('renders exactly five slots, settings last, Today the centre slot', () => {
    const order = slotOrder(renderBar());
    expect(order).toEqual(['church', 'companions', 'today', 'help', 'settings']);
    expect(order).toHaveLength(5);
    expect(order[2]).toBe('today');
  });

  it('the centre slot is the raised one', () => {
    const html = renderBar();
    const todayButton = html.slice(html.indexOf('data-slot="today"'));
    // The raised treatment: lifted out of the ribbon (-mt-9) on the big ringed circle.
    expect(todayButton.slice(0, todayButton.indexOf('</button>'))).toContain('-mt-9');
  });

  it('two slots flank Today on each side', () => {
    const order = slotOrder(renderBar());
    expect(order.slice(0, 2)).toEqual(['church', 'companions']);
    expect(order.slice(3)).toEqual(['help', 'settings']);
  });
});

describe('settings is an action, not a tab', () => {
  it('is not in the TabId union and not in the tab list', () => {
    expect(read('types.ts')).not.toContain("'settings'");
    expect(TABS.map((t) => t.id)).not.toContain('settings');
  });

  it('the settings slot carries no active state, whatever tab is active', () => {
    for (const active of ['church', 'companions', 'today', 'help'] as const) {
      const html = renderBar(active);
      const settingsButton = html.slice(html.indexOf('data-slot="settings"'));
      const settingsMarkup = settingsButton.slice(0, settingsButton.indexOf('</button>'));
      expect(settingsMarkup).not.toContain('aria-current');
      // And the genuinely active tab keeps its highlight while settings sits beside it.
      const activeButton = html.slice(html.indexOf(`data-slot="${active}"`));
      expect(activeButton.slice(0, activeButton.indexOf('</button>'))).toContain('aria-current="page"');
    }
  });

  it('the slot is wired to the existing settings-open state in App, on both bars', () => {
    const app = read('App.tsx');
    const bars = [...app.matchAll(/<TabBar[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(bars.length).toBeGreaterThanOrEqual(2);
    for (const bar of bars) {
      expect(bar).toContain('onOpenSettings={() => setSettingsOpen(true)}');
    }
    // The modal it opens is the one SettingsModal instance state the app already owned.
    expect(app).toContain('const [settingsOpen, setSettingsOpen] = useState(false)');
  });
});
