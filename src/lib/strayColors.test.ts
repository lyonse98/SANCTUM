import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The stray-colour guard (Erik's calendar-supremacy ruling, Nov 11, 2026).
 *
 * Erik's complaint, from the live app: "a feast day but highlights or
 * selection buttons remain a different color." Colour now belongs to the
 * calendar — every accent in the app is either the day theme's accent
 * family, the track's neutral ground/ink, or a companion's own accent
 * inside companion space. None of those needs a hex literal in a component:
 * they all arrive through the theme object. So this test scans every
 * component source for hex literals and fails on any that is not
 * allowlisted below, each with its justification. New colour literals must
 * argue their way onto this list — that argument is the review.
 *
 * Pure white (#fff / #ffffff) is always allowed: it is the app's one
 * text/glyph colour on top of accent fills, not an accent of its own.
 */

const SRC_ROOT = new URL('../', import.meta.url).pathname;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

/** Files that ARE the colour system — palettes and the ground itself live here by design. */
const SYSTEM_FILES = new Set([
  'lib/theme.ts', // the track grounds (both neutrals) are defined here
  'lib/seasonTheme.ts', // legacy per-season accent table
  'lib/dayTheme.ts', // memorial marker colours — the calendar's own drawing of each colour
  'lib/liturgicalVisuals.ts', // the season/feast palettes
  'lib/feastArt.ts', // feast-art selection data
  'personas.ts', // companion-space accents — each saint's own colour, the one allowed exception
  'data/feastDays.ts', // the shared calendar's per-day palettes
  'data/liturgicalCalendar.ts', // season colour data
]);

/** Per-file surviving literals, each justified. Anything else fails. */
const LITERAL_ALLOWLIST: Record<string, { literals: string[]; why: string }> = {
  'App.tsx': {
    literals: ['#EFEAE2', '#FBF8F3', '#DCD3C5', '#3A352E', '#635C51'],
    why: 'the offline/error fallback surface and theme-color meta — a static neutral house ground shown when the themed app cannot render',
  },
  'lib/shareCard.ts': {
    literals: ['#1E1B19'],
    why: 'the exported share image’s fixed ink — a rendered PNG cannot follow the day theme once it leaves the app',
  },
  'components/FeedbackProvider.tsx': {
    literals: ['#FBF8F3', '#F3EEE7', '#FFFFFF', '#DCD3C5', '#E8E1D6', '#C2410C', '#EA580C', '#9A3412', '#3A352E', '#1B1815', '#635C51', '#756D61'],
    why: 'FALLBACK_THEME — the static neutral theme for surfaces mounted outside any day theme (welcome/offline); its burnt-orange accent is a fixed house colour, not a track secondary, and the live app always passes the day theme over it',
  },
  'components/TermsModal.tsx': {
    literals: ['#FBF8F3', '#DCD3C5', '#F3EEE7', '#C2410C', '#1B1815', '#635C51', '#4A443C', '#A39A8A', '#DC2626', '#B91C1C', '#756D61', '#4A6B4A', '#E7E2D6'],
    why: 'the pre-track door: deliberately neutral house palette (stone ground, house-green selection) shown before any track or day theme exists; #DC2626/#B91C1C are the semantic crisis red of the 988 line',
  },
  'components/TodayHero.tsx': {
    literals: ['#FFF6E8', '#FFFBF2'],
    why: 'warm-white text drawn over feast-art photography, with its dark scrim — legibility over imagery, not an accent',
  },
  'components/ChatInput.tsx': {
    literals: ['#991B1B', '#B91C1C', '#F59E0B'],
    why: 'semantic status colours — deep red for the crisis/error notices, amber for the low-message warning; their meaning would break if they followed the day accent',
  },
  'components/CrisisCard.tsx': {
    literals: ['#991B1B', '#B91C1C', '#F87171', '#FCA5A5', '#D1D5DB', '#9CA3AF', '#A3C4A3'],
    why: 'the crisis card’s fixed safety palette (light and dark variants) — high-visibility red by design, identical on every day of the year',
  },
  'components/ConfessionGuide.tsx': {
    literals: ['#991B1B', '#B91C1C'],
    why: 'the examination notice’s semantic warning red — a caution, not a decoration',
  },
  'components/PocketCatechism.tsx': {
    literals: ['#991B1B', '#B91C1C'],
    why: '“The Objection” is marked in semantic red — the colour is the content’s label, not chrome',
  },
  'components/EmailReminderForm.tsx': {
    literals: ['#991B1B'],
    why: 'semantic error red on the form’s failure notice',
  },
  'components/FeedbackModal.tsx': {
    literals: ['#991B1B'],
    why: 'semantic error red on the form’s failure notice',
  },
  'components/ReminderForm.tsx': {
    literals: ['#991B1B'],
    why: 'semantic error red on the form’s failure notice',
  },
};

const HEX = /#[0-9A-Fa-f]{3,8}\b/g;
const ALWAYS_ALLOWED = new Set(['#fff', '#ffffff']);

function literalsOf(source: string): string[] {
  return [...new Set((source.match(HEX) ?? []).map((h) => h.toLowerCase()))];
}

describe('the stray-colour guard — no hex literals outside the colour system', () => {
  const files = [...walk(SRC_ROOT)].map((abs) => ({
    abs,
    rel: abs.slice(SRC_ROOT.length),
  }));

  it('scans a real tree (the guard cannot pass vacuously)', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(files.some((f) => f.rel === 'components/CompanionSelect.tsx')).toBe(true);
  });

  it('every component literal is allowlisted, with a reason on file', () => {
    const offenders: string[] = [];
    for (const { abs, rel } of files) {
      if (SYSTEM_FILES.has(rel)) continue;
      const allowed = new Set((LITERAL_ALLOWLIST[rel]?.literals ?? []).map((h) => h.toLowerCase()));
      for (const literal of literalsOf(readFileSync(abs, 'utf8'))) {
        if (ALWAYS_ALLOWED.has(literal)) continue;
        if (!allowed.has(literal)) offenders.push(`${rel}: ${literal}`);
      }
    }
    expect(offenders, 'unlisted colour literals — re-point them to the theme, or allowlist them here with a justification').toEqual([]);
  });

  it('the allowlist carries no stale entries (a re-pointed colour must leave the list)', () => {
    const stale: string[] = [];
    for (const [rel, entry] of Object.entries(LITERAL_ALLOWLIST)) {
      const present = new Set(literalsOf(readFileSync(join(SRC_ROOT, rel), 'utf8')));
      for (const literal of entry.literals) {
        if (!present.has(literal.toLowerCase())) stale.push(`${rel}: ${literal}`);
      }
      expect(entry.why.trim().length, rel).toBeGreaterThan(0);
    }
    expect(stale).toEqual([]);
  });
});
