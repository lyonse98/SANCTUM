import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TonightClosing } from '../components/TonightClosing';
import { getSeasonTheme } from './seasonTheme';
import { isoDate } from './readingsBundle';
import { tailorMetaKey } from './tailor';
import { FOCUS_ROUTES } from './pushCore';
import { wipeAllSanctumData } from './storage';
import {
  GRATITUDE_LINES,
  TONIGHT_RESOLVE_KEY,
  gratitudeForDate,
  honestLookLine,
  loadTonightResolve,
  morningResolve,
  saintLine,
  saveTonightResolve,
  tailorEchoLine,
} from './tonight';
import type { Audience } from '@/types';

/**
 * Tonight (Erik's ruling, Nov 12, 2026): the Examen retired as an on-screen
 * tool. What replaced the expandable card is a short closing on Today whose
 * SHAPE is the examen's — gratitude, one honest look, one resolve — titled
 * simply "Tonight". These tests pin the shape: PM-gated in HomeScreen with a
 * forced landing, composed on-device, and the one kept thing (the resolve)
 * stored on-device only, shown next morning until midday, and wiped by the
 * panic wipe like everything else under the sanctum_ prefix.
 */

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

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
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStorage(), configurable: true });
});

function render(audience: Audience) {
  return renderToString(
    createElement(TonightClosing, { t: getSeasonTheme(new Date(), audience), audience }),
  );
}

describe('the Tonight closing on Today', () => {
  it('renders the shape: gratitude, the saint line, and one resolve (men)', () => {
    const html = render('men');
    expect(html).toContain('Tonight');
    expect(html).toContain(gratitudeForDate(isoDate(new Date())));
    expect(html).toContain('You walked today with');
    expect(html).toContain('One resolve for tomorrow');
    expect(html).toContain('id="tonight-resolve"');
    // No checkboxes, no checklist — the tool is retired, the shape remains.
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('Contrition');
  });

  it('renders on her track too, and never names the method on screen', () => {
    const html = render('women');
    expect(html).toContain('Tonight');
    expect(html).toContain('You walked today with');
    expect(html).not.toContain('Examen');
  });

  it("the men's closing never names the method on screen either", () => {
    expect(render('men')).not.toContain('Examen');
  });

  it('echoes the tailored morning only when a tailor build exists today', () => {
    expect(render('men')).not.toContain('You said this morning was about');
    const dateKey = isoDate(new Date());
    localStorage.setItem(
      tailorMetaKey(dateKey, 'men'),
      JSON.stringify({ hash: 'x', narratorName: 'Ben', at: Date.now(), focus: 'grief' }),
    );
    expect(render('men')).toContain('You said this morning was about grief.');
    // Her track reads her own meta — the men's build does not echo for her.
    expect(render('women')).not.toContain('You said this morning was about');
  });
});

describe('the closing’s composed pieces', () => {
  it('gratitude rotates by date from the bank, stable within a day', () => {
    expect(GRATITUDE_LINES.length).toBeGreaterThanOrEqual(5);
    expect(gratitudeForDate('2026-11-12')).toBe(gratitudeForDate('2026-11-12'));
    const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
      .map(gratitudeForDate);
    expect(new Set(week).size).toBeGreaterThan(1);
    for (const line of week) expect(GRATITUDE_LINES).toContain(line);
  });

  it('the saint line names today’s saint', () => {
    expect(saintLine(new Date(2026, 10, 11))).toBe('You walked today with St. Martin of Tours.');
  });

  it('the honest look echoes the morning challenge as a question, first sentence only', () => {
    expect(honestLookLine('Call your brother before noon. Apologize first, explain second.')).toBe(
      "This morning's challenge was: Call your brother before noon. Where did it meet the day?",
    );
  });

  it('the tailor echo uses the bank’s own label for the focus', () => {
    expect(tailorEchoLine('work')).toBe('You said this morning was about work & career.');
    expect(tailorEchoLine('grief')).toBe('You said this morning was about grief.');
  });
});

describe('the resolve — on-device only, one morning only', () => {
  const evening = new Date(2026, 10, 12, 21, 30); // Thu Nov 12, 2026, 9:30pm

  it('saves under the sanctum_ key, dated by its evening', () => {
    saveTonightResolve('  Speak gently at breakfast.  ', evening);
    expect(TONIGHT_RESOLVE_KEY).toBe('sanctum_tonight_resolve');
    expect(loadTonightResolve()).toEqual({ date: '2026-11-12', text: 'Speak gently at breakfast.' });
  });

  it('shows the next morning until midday, then is gone', () => {
    saveTonightResolve('Speak gently at breakfast.', evening);
    expect(morningResolve(new Date(2026, 10, 13, 7, 15))).toBe('Speak gently at breakfast.');
    expect(morningResolve(new Date(2026, 10, 13, 11, 59))).toBe('Speak gently at breakfast.');
    expect(morningResolve(new Date(2026, 10, 13, 12, 0))).toBeNull();
    expect(morningResolve(new Date(2026, 10, 13, 18, 0))).toBeNull();
  });

  it('does not carry a resolve from two nights ago into this morning', () => {
    saveTonightResolve('An old resolve.', evening);
    expect(morningResolve(new Date(2026, 10, 14, 8, 0))).toBeNull();
    expect(morningResolve(new Date(2026, 10, 12, 8, 0))).toBeNull();
  });

  it('clearing the line clears the stored resolve', () => {
    saveTonightResolve('Kept small.', evening);
    saveTonightResolve('   ', evening);
    expect(loadTonightResolve()).toBeNull();
  });

  it('the panic wipe takes the resolve with everything else', () => {
    saveTonightResolve('Speak gently at breakfast.', evening);
    expect(localStorage.getItem(TONIGHT_RESOLVE_KEY)).not.toBeNull();
    wipeAllSanctumData();
    expect(localStorage.getItem(TONIGHT_RESOLVE_KEY)).toBeNull();
  });
});

describe('the retirement is structural', () => {
  it('HomeScreen mounts the Tonight closing, PM-gated, with a forced landing — and no Examen tool', () => {
    const home = read('components/HomeScreen.tsx');
    expect(home).toContain("import { TonightClosing } from '@/components/TonightClosing'");
    expect(home).toContain('<TonightClosing');
    expect(home).toContain('AUDIO_PM_START_HOUR');
    expect(home).toContain('forceTonight');
    expect(home).not.toContain('EveningExamen');
    expect(home).not.toContain('ExamenChecklist');
    // The Gospel card's old "Evening Examen" door is gone with the card.
    const gospel = read('components/DailyQuote.tsx');
    expect(gospel).not.toContain('onOpenExamen');
    expect(gospel).not.toContain('Evening Examen');
  });

  it('the retired components stay in the repo, unwired', () => {
    expect(existsSync(join(SRC, 'components', 'EveningExamen.tsx'))).toBe(true);
    expect(existsSync(join(SRC, 'components', 'ExamenChecklist.tsx'))).toBe(true);
  });

  it('the examen focus and the examen tool still land on Today', () => {
    expect(FOCUS_ROUTES.examen).toEqual({ tab: 'today', todayExamen: true });
    const app = read('App.tsx');
    expect(app).toContain("'examen': { tab: 'today', todayExamen: true }");
    // The chat label for the tool now matches the surface it opens.
    expect(read('components/ChatFeed.tsx')).toContain("'examen': \"Tonight's closing\"");
    // And the center tab's evening word is the closing's name, not the method's.
    const appSource = read('App.tsx');
    expect(appSource).toContain("hourOfDay < 17 ? 'Prayer' : 'Tonight'");
    expect(appSource).not.toContain(": 'Examen'");
  });

  it('the companion prompts describe the closing without naming a tool, both tracks', () => {
    const prompts = readFileSync(join(SRC, '..', 'supabase', 'functions', 'chat-proxy', 'index.ts'), 'utf8');
    expect(prompts).not.toContain('the Evening Examen');
    expect(prompts.split('a short closing reflection at night')).toHaveLength(3); // 2 tracks + split artifact
    expect(prompts.split("tool:examen — Tonight's closing")).toHaveLength(3);
  });
});
