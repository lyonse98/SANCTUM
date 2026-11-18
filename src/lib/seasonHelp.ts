import { getHelpSections, type HelpSection } from '@/lib/realHelp';
import { loadTailorProfile } from '@/lib/tailorProfile';
import type { Audience } from '@/types';

/**
 * Season of life → Real Help (Erik, Nov 18, 2026 — the personal form of
 * the season-of-life routing): the standing Tailor profile already knows
 * the reader's season, in the track's own vocabulary
 * (src/lib/tailorProfile.ts SEASONS_OF_LIFE). This map names, for each
 * season, the Real Help doors that season most often needs first. It is
 * a reading aid, not a diagnosis: Real Help shows the mapped doors on a
 * quiet "For this season" plate at its head, and the full list stands
 * below unchanged. Read on-device from the profile the reader wrote;
 * nothing new is stored, and nothing shows when no season is set.
 *
 * The map (section ids from src/lib/realHelp.ts; GROUP is the track's
 * own group door — mens-group / womens-group):
 *
 *   single              → director, GROUP        (a guide, and brothers/sisters)
 *   dating-engaged      → director, confession   (discernment, and a clean start)
 *   newly-married       → marriage, director     (deepen early, with a guide)
 *   expecting           → therapist, GROUP       (support for the body and the wait)
 *   father-young        → GROUP, marriage        (brothers, and the marriage at the center)
 *   mother-young        → therapist, GROUP       (postpartum is named in her therapist door)
 *   father-older        → director, GROUP
 *   mother-older        → director, GROUP
 *   empty-nest          → director, marriage     (a new season, discerned and shared)
 *   widowed             → therapist, director    (grief care first, then a guide)
 *   divorced-separated  → marriage, therapist, confession (Retrouvaille serves the separated)
 */

const GROUP = 'group';

const SEASON_HELP: Record<string, string[]> = {
  single: ['director', GROUP],
  'dating-engaged': ['director', 'confession'],
  'newly-married': ['marriage', 'director'],
  expecting: ['therapist', GROUP],
  'father-young': [GROUP, 'marriage'],
  'mother-young': ['therapist', GROUP],
  'father-older': ['director', GROUP],
  'mother-older': ['director', GROUP],
  'empty-nest': ['director', 'marriage'],
  widowed: ['therapist', 'director'],
  'divorced-separated': ['marriage', 'therapist', 'confession'],
};

/** The Real Help section ids a season names first, in the map's own order. */
export function seasonHelpSectionIds(audience: Audience, seasonId: string | null): string[] {
  if (!seasonId) return [];
  const ids = SEASON_HELP[seasonId];
  if (!ids) return [];
  const groupId = audience === 'women' ? 'womens-group' : 'mens-group';
  return ids.map((id) => (id === GROUP ? groupId : id));
}

/**
 * The mapped Real Help sections for the reader's stored season, resolved
 * against the track's own list. Empty when no season is set — the plate
 * on Real Help simply never stands.
 */
export function seasonHelpSections(audience: Audience): HelpSection[] {
  const seasonId = loadTailorProfile(audience).seasonOfLife;
  const ids = seasonHelpSectionIds(audience, seasonId);
  if (!ids.length) return [];
  const all = getHelpSections(audience);
  const seen = new Set<string>();
  const out: HelpSection[] = [];
  for (const id of ids) {
    const section = all.find((s) => s.id === id);
    if (section && !seen.has(section.id)) {
      seen.add(section.id);
      out.push(section);
    }
  }
  return out;
}
