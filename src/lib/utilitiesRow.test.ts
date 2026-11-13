import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The utilities, third shape (Erik, Nov 13, 2026 — Option B, "Foot of
 * Today"): the foot-of-page UtilitiesRow card retired with the tab bar, its
 * actions moved briefly into the menu sheet, and now live in the utilities
 * LINE — one quiet line of footer text (Settings · Reminders · Feedback ·
 * About · Share) at the foot of every main view. UtilitiesRow.tsx stays in
 * the repo UNWIRED, like TabBar and MenuSheet, so the diet can be reverted.
 * These pins keep the row off every page and the actions in the line, each
 * firing the existing UtilityActions flow — no new flows.
 */
describe('utilities — in the line, off the pages as a row', () => {
  it('UtilitiesRow.tsx stays in the repo, unwired', () => {
    expect(existsSync(join(SRC, 'components', 'UtilitiesRow.tsx'))).toBe(true);
    expect(read('components/UtilitiesRow.tsx')).toContain('export function UtilitiesRow');
  });

  it('no page mounts or imports the row any more', () => {
    for (const page of [
      'App.tsx',
      'components/HomeScreen.tsx',
      'components/CompanionSelect.tsx',
      'components/PocketChurchPage.tsx',
      'components/FindHelpPage.tsx',
    ]) {
      expect(read(page), page).not.toContain('UtilitiesRow');
    }
  });

  it('the line is the five housekeeping actions, Settings first, Share last', () => {
    const line = read('components/UtilitiesLine.tsx');
    const keys = [...line.matchAll(/key: '(settings|reminders|feedback|about|share)'/g)].map((m) => m[1]);
    expect(keys).toEqual(['settings', 'reminders', 'feedback', 'about', 'share']);
    // Each one fires the existing utility action — no new flows.
    expect(line).toContain('onOpenSettings');
    expect(line).toContain('onOpenReminder');
    expect(line).toContain('onOpenFeedback');
    expect(line).toContain('onOpenAbout');
    expect(line).toContain('onShareInvite');
  });

  it('Share in the line is the app invite, not the Gospel share modal', () => {
    const app = read('App.tsx');
    // The shell's one utilities object wires Share to the invite modal.
    expect(app).toContain('onShareInvite: () => setShareInviteOpen(true)');
    expect(app.match(/<ShareInviteModal/g)).toHaveLength(1);
    // The Gospel card's own share is a different door and stays in the card.
    expect(read('components/DailyQuote.tsx')).toContain('DailyGospelShareModal');
  });

  it('the utilities object reaches all four main views (Today + the three pages)', () => {
    const app = read('App.tsx');
    expect(app.match(/utilities=\{utilities\}/g)).toHaveLength(4);
    for (const page of [
      'components/HomeScreen.tsx',
      'components/CompanionSelect.tsx',
      'components/PocketChurchPage.tsx',
      'components/FindHelpPage.tsx',
    ]) {
      expect(read(page), page).toContain('utilities: UtilityActions');
      expect(read(page), page).toContain('<UtilitiesLine');
    }
  });
});
