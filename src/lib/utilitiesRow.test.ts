import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The foot-of-page utilities row retired with the tab bar (core diet, Erik,
 * Nov 13, 2026): About, Share, Feedback, and Reminders — plus Settings, which
 * had already graduated off the row — now live in the menu sheet's APP group.
 * UtilitiesRow.tsx stays in the repo UNWIRED, like TabBar, so the diet can be
 * reverted. These pins keep the row off every page and the actions in the sheet.
 */
describe('utilities — in the sheet, off the pages', () => {
  it('UtilitiesRow.tsx stays in the repo, unwired', () => {
    expect(existsSync(join(SRC, 'components', 'UtilitiesRow.tsx'))).toBe(true);
    expect(read('components/UtilitiesRow.tsx')).toContain('export function UtilitiesRow');
  });

  it('no page mounts or imports the row any more', () => {
    for (const page of [
      'components/HomeScreen.tsx',
      'components/CompanionSelect.tsx',
      'components/PocketChurchPage.tsx',
      'components/FindHelpPage.tsx',
    ]) {
      expect(read(page), page).not.toContain('UtilitiesRow');
      expect(read(page), page).not.toContain('utilities');
    }
  });

  it('the utilities object is handed only to the menu sheets (one per shell)', () => {
    const app = read('App.tsx');
    expect(app.match(/utilities=\{utilities\}/g)).toHaveLength(2);
    // Both hand-offs sit inside MenuSheet mounts.
    const mounts = [...app.matchAll(/<MenuSheet[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(mounts).toHaveLength(2);
    for (const mount of mounts) {
      expect(mount).toContain('utilities={utilities}');
    }
  });

  it('the sheet’s APP group is the five housekeeping actions, Settings first', () => {
    const sheet = read('components/MenuSheet.tsx');
    const keys = [...sheet.matchAll(/key: '(settings|reminders|feedback|about|share)'/g)].map((m) => m[1]);
    expect(keys).toEqual(['settings', 'reminders', 'feedback', 'about', 'share']);
    // Each one fires the existing utility action — no new flows.
    expect(sheet).toContain('utilities.onOpenSettings');
    expect(sheet).toContain('utilities.onOpenReminder');
    expect(sheet).toContain('utilities.onOpenFeedback');
    expect(sheet).toContain('utilities.onOpenAbout');
    expect(sheet).toContain('utilities.onShareInvite');
  });
});
