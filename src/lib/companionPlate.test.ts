import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CompanionPlate } from '@/components/CompanionPlate';
import { getPersona } from '@/personas';
import type { PersonaTheme } from '@/types';

/**
 * The companion's presence on Today (Erik, Nov 20, 2026): companions are
 * half the app, so the plate stands directly under the masthead — the
 * pinned companion's face and name, one tap into the conversation; the
 * door itself when nobody is pinned. These pins keep the plate on Today,
 * in its slot, and honest in both states (a named companion only when
 * one is actually pinned; never a fabricated presence).
 */

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}

let storage: ReturnType<typeof makeStorage>;
const theme: PersonaTheme = getPersona('joseph').theme;

function renderPlate() {
  return renderToString(
    createElement(CompanionPlate, {
      t: theme,
      audience: 'men' as const,
      onOpenCompanion: () => {},
      onNavigate: () => {},
    }),
  );
}

beforeEach(() => {
  storage = makeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});

afterEach(() => {
  // @ts-expect-error — removing the stub between tests
  delete globalThis.localStorage;
});

describe('the companion plate on Today', () => {
  it('stands on Today directly under the masthead, above the Gospel', () => {
    const home = readFileSync('src/components/HomeScreen.tsx', 'utf8');
    const hero = home.indexOf('<TodayHero');
    const plate = home.indexOf('<CompanionPlate');
    const gospel = home.indexOf('<DailyQuote');
    expect(hero).toBeGreaterThan(-1);
    expect(plate).toBeGreaterThan(hero);
    expect(gospel).toBeGreaterThan(plate);
  });

  it('shows the pinned companion — face, name, and his own tagline', () => {
    storage.setItem('sanctum_favorite_companion_men', 'joseph');
    const html = renderPlate();
    expect(html).toContain('data-companion-plate');
    expect(html).toContain('Your companion');
    expect(html).toContain('St. Joseph');
    expect(html).toContain('By doing, not by talking');
  });

  it('with nobody pinned, the plate is the door — no invented companion', () => {
    const html = renderPlate();
    expect(html).toContain('data-companion-plate');
    expect(html).toContain('Talk through today with a saint');
    expect(html).toContain('Choose a voice to walk with you.');
    expect(html).not.toContain('St. Joseph');
  });
});
