import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Portrayal contract. The companions speak in the first person as portrayals, never
 * as impersonations. These guards keep the framing from quietly regressing:
 * the honest label must exist in canonical copy, the server preamble must carry the
 * identity rules (they govern every persona at once), and no persona prompt may
 * claim the saint's own heavenly action (intercession) for the AI.
 */

const chatProxy = readFileSync(
  new URL('../../supabase/functions/chat-proxy/index.ts', import.meta.url),
  'utf8',
);
const personas = readFileSync(new URL('../personas.ts', import.meta.url), 'utf8');
const privacyCopy = readFileSync(new URL('./privacyCopy.ts', import.meta.url), 'utf8');

describe('portrayal framing contract', () => {
  it('canonical copy carries the portrayal line', () => {
    expect(privacyCopy).toContain('COMPANION_PORTRAYAL_LINE');
    expect(privacyCopy).toContain('portrayals to pray with, not the saints themselves');
  });

  it('server preamble carries the identity rules', () => {
    expect(chatProxy).toContain('IDENTITY & PORTRAYAL');
    expect(chatProxy).toContain('You are NOT that saint or biblical figure');
    expect(chatProxy).toContain('answer truthfully and briefly');
    expect(chatProxy).toContain('You cannot intercede for him');
    expect(chatProxy).toContain('offer to pray WITH him');
  });

  it('no persona claims the saint’s intercession for itself', () => {
    expect(personas).not.toContain('You intercede.');
    expect(personas).not.toMatch(/you are (now )?in heaven/i);
  });
});
