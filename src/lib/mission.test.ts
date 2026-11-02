import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MISSION_LINE, MISSION_ATTRIBUTION, MISSION_SENTENCE } from './mission';

/**
 * Mission contract. Sanctum's thesis — Bloy's line in Erik's rendering — is defined
 * once in src/lib/mission.ts and rendered from the constant on every surface that
 * carries it. These guards keep a surface from quietly rewording it, dropping the
 * attribution, or hard-coding a copy that drifts from the canonical text.
 */

const homeScreen = readFileSync(new URL('../components/HomeScreen.tsx', import.meta.url), 'utf8');
const termsModal = readFileSync(new URL('../components/TermsModal.tsx', import.meta.url), 'utf8');
const aboutPage = readFileSync(new URL('../components/AboutSanctumPage.tsx', import.meta.url), 'utf8');

const SURFACES: [string, string][] = [
  ['Today (HomeScreen)', homeScreen],
  ['Welcome gate (TermsModal)', termsModal],
  ['About (AboutSanctumPage)', aboutPage],
];

describe('mission copy', () => {
  it('the canonical line is Erik’s rendering, word for word', () => {
    expect(MISSION_LINE).toBe('The biggest tragedy in life is not becoming a saint.');
  });

  it('the attribution is Léon Bloy', () => {
    expect(MISSION_ATTRIBUTION).toBe('Léon Bloy');
  });

  it('the mission sentence is exactly the one approved sentence', () => {
    expect(MISSION_SENTENCE).toBe('Sanctum exists so that you become a saint.');
  });
});

describe('mission placements', () => {
  for (const [name, source] of SURFACES) {
    it(`${name} renders the line from the single source`, () => {
      expect(source).toContain("from '@/lib/mission'");
      expect(source).toContain('{MISSION_LINE}');
      expect(source).toContain('{MISSION_ATTRIBUTION}');
    });

    it(`${name} does not hard-code the line`, () => {
      expect(source).not.toContain('biggest tragedy in life is not becoming a saint');
    });
  }

  it('About carries the "Why Sanctum exists" block with the mission sentence', () => {
    expect(aboutPage).toContain('Why Sanctum exists');
    expect(aboutPage).toContain('{MISSION_SENTENCE}');
  });
});
