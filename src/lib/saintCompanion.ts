import { personasForAudience } from '@/personas';
import type { Audience, Persona } from '@/types';

/**
 * The Saint of the Day funnel: when today's saint is one of the user's own
 * companions, the saint's card can open a door straight into their company.
 * Matching is by name, normalised the same way on both sides — prefixes
 * (St., Saint, King, Our Lady) stripped — and the longest matching core wins,
 * so St. Mary Magdalene resolves to Magdalene and never to Our Lady, whose
 * own days ("Our Lady of…", "Mary, Mother of God") still find her.
 */

function coreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(st\.|saint|blessed)\s+/i, '')
    .replace(/^king\s+/i, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(saintCore: string, persona: Persona): number {
  // Our Lady's persona name carries no "Mary" — her days name her by title.
  if (persona.id === 'mary') {
    return saintCore.includes('our lady') || saintCore.startsWith('mary') ? 'mary'.length : 0;
  }
  const core = coreName(persona.name);
  if (!core) return 0;
  if (saintCore === core) return 100 + core.length;
  if (saintCore.includes(core) || core.includes(saintCore)) return core.length;
  return 0;
}

/** The companion in this track's cast who is today's saint, or null when they are not in the cast. */
export function companionForSaint(saintName: string, audience: Audience): Persona | null {
  const saintCore = coreName(saintName);
  if (!saintCore) return null;
  let best: Persona | null = null;
  let bestScore = 0;
  for (const persona of personasForAudience(audience)) {
    const score = matchScore(saintCore, persona);
    if (score > bestScore) {
      best = persona;
      bestScore = score;
    }
  }
  return best;
}
