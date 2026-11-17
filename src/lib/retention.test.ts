import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  recordVisit,
  shouldShowInstallPrompt,
  snoozeInstallPrompt,
  markInstallValueMoment,
} from './retention';
import * as retention from './retention';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  // Node has no window/matchMedia: isStandaloneDisplay() must safely read as false.
  Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });
});

describe('install prompt gating', () => {
  it('stays hidden before the third visit', () => {
    localStorage.setItem('sanctum_visit_count', '2');
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it('shows from the third visit', () => {
    localStorage.setItem('sanctum_visit_count', '3');
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('a dismissal snoozes rather than banning forever', () => {
    localStorage.setItem('sanctum_visit_count', '5');
    snoozeInstallPrompt(14);
    expect(shouldShowInstallPrompt()).toBe(false);
    // Simulate the snooze expiring.
    localStorage.setItem('sanctum_install_snooze_until', String(Date.now() - 1000));
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('the legacy "prompted forever" flag becomes one snooze, not a ban', () => {
    localStorage.setItem('sanctum_visit_count', '9');
    localStorage.setItem('sanctum_install_prompted', 'true');
    expect(shouldShowInstallPrompt()).toBe(false);
    expect(localStorage.getItem('sanctum_install_prompted')).toBeNull();
    localStorage.setItem('sanctum_install_snooze_until', String(Date.now() - 1000));
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('an examen value moment asks on any visit', () => {
    localStorage.setItem('sanctum_visit_count', '1');
    markInstallValueMoment();
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('never asks once the installed flag is set', () => {
    localStorage.setItem('sanctum_visit_count', '12');
    localStorage.setItem('sanctum_installed', 'true');
    expect(shouldShowInstallPrompt()).toBe(false);
  });
});

describe('recordVisit — the welcome-back trigger survives the reframing', () => {
  it('a first visit is not a return; a later-day visit is', () => {
    const first = recordVisit();
    expect(first.isFirstVisit).toBe(true);
    expect(first.isReturning).toBe(false);
    // Wind the stored last visit back a day: the next open is a return.
    const d = new Date();
    d.setDate(d.getDate() - 1);
    localStorage.setItem('sanctum_last_visit', `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    const back = recordVisit();
    expect(back.isFirstVisit).toBe(false);
    expect(back.isReturning).toBe(true);
    expect(back.visitCount).toBe(2);
  });
});

/**
 * Play 1 — the forgiveness design (Erik's revised ruling, Nov 16, 2026).
 * Returning is an ordinary day: the welcome-back toast carries no count of
 * the days away, the consecutive-day examen flame is deleted outright (the
 * cumulative days-prayed tally in daysPrayed.ts is its replacement, and it
 * never resets), and the companions are forbidden by their safety preamble
 * from remarking on an absence at all. These pins hold all three.
 */
describe('Play 1(a) — the welcome back measures nothing', () => {
  const welcome = readSrc('components/WelcomeBackPrompt.tsx');

  it('the trigger is unchanged: a returning visit still raises the toast', () => {
    expect(welcome).toContain('recordVisit()');
    expect(welcome).toContain('visit.isReturning');
  });

  it('the copy is an ordinary day — warm, brief, and number-free', () => {
    expect(welcome).toContain('Welcome back.');
    expect(welcome).toContain('Today is a new day. The Gospel is ready when you are.');
  });

  it('no gap is named: no day count, no debt framing, no reunion language', () => {
    expect(welcome).not.toContain('daysSince');
    expect(welcome).not.toContain('daysSinceLast');
    expect(welcome).not.toContain("it's been");
    expect(welcome).not.toContain('Pick up where you left off');
    expect(welcome.toLowerCase()).not.toContain('missed you');
    expect(welcome).not.toContain('Good to see you again');
  });

  it('no component anywhere renders the absence duration', () => {
    const componentsDir = join(ROOT, 'src', 'components');
    for (const file of readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'))) {
      const source = readFileSync(join(componentsDir, file), 'utf8');
      expect(source, file).not.toContain('daysSinceLast');
      expect(source, file).not.toContain('daysSince');
    }
    expect(readSrc('App.tsx')).not.toContain('daysSinceLast');
  });
});

describe('Play 1(b) — the consecutive-day flame is deleted, not renamed', () => {
  const retentionSource = readSrc('lib/retention.ts');
  const examen = readSrc('components/ExamenChecklist.tsx');

  it('the streak API and its keys are gone from retention.ts', () => {
    expect(retentionSource).not.toContain('recordExamenComplete');
    expect(retentionSource).not.toContain('getExamenStreak');
    expect(retentionSource).not.toContain('sanctum_examen_streak');
    expect(retentionSource).not.toContain('sanctum_examen_last_date');
    expect('recordExamenComplete' in retention).toBe(false);
    expect('getExamenStreak' in retention).toBe(false);
  });

  it('no component renders a consecutive-day count or imports the deleted API', () => {
    const componentsDir = join(ROOT, 'src', 'components');
    for (const file of readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'))) {
      const source = readFileSync(join(componentsDir, file), 'utf8');
      expect(source, file).not.toContain('recordExamenComplete');
      expect(source, file).not.toContain('getExamenStreak');
      expect(source, file).not.toContain('sanctum_examen_streak');
    }
    // The checklist itself: no flame, no count — the reset alone survives.
    expect(examen).not.toContain('Flame');
    expect(examen).not.toContain('currentStreak');
    expect(examen).toContain('Reset');
  });

  it('a finished examen still marks the install value moment, directly', () => {
    expect(examen).toContain('markInstallValueMoment()');
    expect(examen).toContain("const STORAGE_KEY = 'sanctum_examen'");
  });

  it('the guilt grammar is absent from the touched user-facing copy', () => {
    for (const source of [readSrc('components/WelcomeBackPrompt.tsx'), examen]) {
      const lower = source.toLowerCase();
      expect(lower).not.toContain('streak');
      expect(lower).not.toContain("don't break");
      expect(lower).not.toContain('keep it going');
    }
  });

  it("a successful Listen play records the day in the days-prayed tally, beside the first-value flag", () => {
    const bar = readSrc('components/ListenBar.tsx');
    expect(bar).toContain("import { recordCoreAct } from '@/lib/daysPrayed'");
    expect(bar).toContain("recordCoreAct('listen')");
    const play = bar.slice(bar.indexOf('await el.play()'));
    expect(play.indexOf('markFirstValue()')).toBeGreaterThanOrEqual(0);
    expect(play.indexOf("recordCoreAct('listen')")).toBeGreaterThan(play.indexOf('markFirstValue()'));
  });
});

describe('Play 1(c) — companions never remark on an absence (chat-proxy source)', () => {
  const source = readRoot('supabase/functions/chat-proxy/index.ts');

  it('both safety preambles carry the absence directive, word for word', () => {
    expect(count(source, 'ABSENCE — NEVER REMARK ON IT')).toBe(2);
    expect(count(source, "Never remark on a user's absence, a gap in their visits, or time away")).toBe(2);
    expect(count(source, 'never note when they last wrote')).toBe(2);
    expect(count(source, 'never comment on irregular attendance')).toBe(2);
    expect(count(source, 'A returning user is simply met where they are, in an ordinary day, with no accounting for the time between')).toBe(2);
  });

  it('the forbidden reunion phrase appears only as the named example of what not to say', () => {
    expect(count(source, `Never say "it's been a while"`)).toBe(2);
  });
});
