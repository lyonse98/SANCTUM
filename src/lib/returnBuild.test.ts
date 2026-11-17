import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The return & companions micro-pass (Plays 9 + 6, Nov 16, 2026), pinned
 * at the source level the way the house pins its other settled shapes:
 * the intro is tap-to-skip but still appears; the cap counts as rhythm,
 * never as an alarm; a companion send records the day's companion act;
 * and a cold start restores the last surface behind the restore decision.
 */

describe('Play 9a — the intro is tap-to-skip, and still appears', () => {
  const intro = read('components/PersonaIntro.tsx');

  it('a tap anywhere on the splash finishes it, through the idempotent finish', () => {
    expect(intro).toContain('onClick={finish}');
    expect(intro).toContain('doneRef');
  });

  it('carries a visible, quiet Begin affordance that finishes it too', () => {
    expect(intro).toContain('Begin');
    expect(intro).toContain('e.stopPropagation()');
  });

  it('the timed entry is unchanged: the splash still appears and auto-advances', () => {
    expect(intro).toContain('setTimeout(finish, 2200)');
    const app = read('App.tsx');
    expect(app).toContain('setIntroActive(true)');
    expect(app).toContain('<PersonaIntro');
  });

  it('the quiet doors still point onward, and their taps are not skips', () => {
    expect(intro).toContain('Find a priest · Real Help');
    expect(intro).toContain('onOpenPray');
  });
});

describe('Play 9b — the cap as rhythm', () => {
  it('ChatInput states the count through the keeping-hours line, with no escalation colours', () => {
    const input = read('components/ChatInput.tsx');
    expect(input).toContain('capRemainingLine(remainingMessages)');
    expect(input).not.toContain('#f59e0b');
    expect(input).not.toContain('Daily limit reached');
    expect(input).not.toContain('messages left today');
  });

  it('the cap modal closes in prayer and points outward to a priest and the sacraments', () => {
    const app = read('App.tsx');
    expect(app).toContain('The Companions Keep Hours');
    expect(app).toContain('CAP_CLOSING_PRAYER');
    expect(app).toContain('CAP_OUTWARD_LINE');
    expect(app).toContain('Find Real Help');
    // The old bare wall is gone — and its mislabelled unit with it.
    expect(app).not.toContain('Daily Limit Reached');
    expect(app).not.toContain('daily conversations');
  });
});

describe('Play 9c — a companion send records the day', () => {
  it('recordCoreAct(\'companion\') is wired at the send site in App', () => {
    const app = read('App.tsx');
    expect(app).toContain("recordCoreAct('companion')");
    expect(app).toContain('incrementDailyMessageCount()');
  });
});

describe('Play 6 — one-tap return', () => {
  const app = read('App.tsx');

  it('App saves the surface as it changes and restores through the decision helper', () => {
    expect(app).toContain('saveLastSurface');
    expect(app).toContain('loadLastSurface()');
    expect(app).toContain('shouldRestoreSurface');
    expect(app).toContain('personaForAudience(saved.companionId, audience)');
  });

  it('the focus routing stays authoritative and untouched', () => {
    expect(app).toContain('parseFocusParam(window.location.search)');
    expect(app).toContain('FOCUS_ROUTES[focus]');
  });

  it('the persistent return strip shows only off Today, and Today’s scroll is restored', () => {
    expect(app).toContain('data-return-strip');
    expect(app).toContain("loadScrollPosition('today')");
    expect(app).toContain("saveScrollPosition('today', top)");
    const home = read('components/HomeScreen.tsx');
    expect(home).toContain('initialScrollTop');
    expect(home).toContain('onScrollTopChange');
  });
});
