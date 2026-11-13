import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Outward-pointing contract (Erik, Nov 11, 2026). The companions are a porch,
 * not a house: their shared server blocks must bias toward the Church, the
 * sacraments, and real people — Mass named first, Confession made concrete
 * (with the scrupulosity guard), community named when isolation surfaces —
 * while the anti-nag rules (one referral per reply, never pitch the app)
 * survive untouched. The blocks also describe the app as it now is: four
 * areas, no Workshop. Both tracks carry every amendment with identical
 * force; these guards pin BOTH sides.
 */

const chatProxy = readFileSync(
  new URL('../../supabase/functions/chat-proxy/index.ts', import.meta.url),
  'utf8',
);
const womenBlocks = chatProxy.slice(chatProxy.indexOf('SCRIPTURE_GROUNDING_WOMEN'));
const menBlocks = chatProxy.slice(0, chatProxy.indexOf('SCRIPTURE_GROUNDING_WOMEN'));

const tracks = [
  { name: 'men', blocks: menBlocks, pronoun: 'him', poss: 'his', group: "a men's group" },
  { name: 'women', blocks: womenBlocks, pronoun: 'her', poss: 'her', group: "a women's group" },
] as const;

describe('outward pointing — both tracks', () => {
  for (const t of tracks) {
    describe(t.name, () => {
      it('names Sunday Mass first in the parish practices', () => {
        expect(t.blocks).toContain(`take it to ${t.poss} parish: Sunday Mass, Confession,`);
      });

      it('directs a man or woman who has drifted from Mass back to Mass, without guilt mechanics', () => {
        expect(t.blocks).toContain('MASS: if');
        expect(t.blocks).toContain('drifted from Mass');
        expect(t.blocks).toContain('returning to Sunday Mass');
        expect(t.blocks).toContain('No guilt, no shaming, nothing that feeds scrupulosity');
      });

      it('makes Confession the concrete step, with preparation offered and probing forbidden', () => {
        expect(t.blocks).toContain('CONFESSION: if');
        expect(t.blocks).toContain('name Confession itself as the step');
        expect(t.blocks).toContain('priests hear this every day');
        expect(t.blocks).toContain('[the Confession Guide](tool:confession)');
        expect(t.blocks).toContain('Never probe for details');
        expect(t.blocks).toContain('never do anything that resembles absolution');
      });

      it('guards the scrupulous away from more confession, toward one priest obeyed', () => {
        expect(t.blocks).toContain('SCRUPULOSITY GUARD:');
        expect(t.blocks).toContain('do NOT urge');
        expect(t.blocks).toContain('one priest or spiritual director and obey that one voice');
      });

      it('points the isolated to real community through Find Real Help', () => {
        expect(t.blocks).toContain('COMMUNITY: if');
        expect(t.blocks).toContain(t.group);
        expect(t.blocks).toContain('[Find Real Help](tool:help) is the door');
        expect(t.blocks).toContain('a bridge to people, never a replacement for them');
      });

      it('keeps the outward bias with the one-referral cap and the no-pitch rule', () => {
        expect(t.blocks).toContain('the bias is outward');
        expect(t.blocks).toContain('Never more than one referral per reply');
        expect(t.blocks).toContain('Do not force a referral into a reply where it doesn\'t belong');
        expect(t.blocks).toContain('Never push the app itself. Point to Christ, to the sacraments, and to real people first.');
        expect(t.blocks).not.toContain('A reply with no referral is usually the better reply');
      });

      it('describes the current app — four areas, Examen on Today, Real Help is people only', () => {
        expect(t.blocks).toContain('This app has four areas.');
        expect(t.blocks).toContain("the day's Gospel, the saint of the day, and the Evening Examen");
        expect(t.blocks).toContain('Confession prep, and the Catechism');
        // The wellness tools were removed Nov 12, 2026: Find Real Help is described
        // as the door to people, and the tool list offers none of the four dead ids.
        expect(t.blocks).toContain('This is the door out of the app.');
        expect(t.blocks).not.toContain('Right Now');
        for (const dead of ['tool:cold-start', 'tool:breathing', 'tool:grounding', 'tool:driveway']) {
          expect(t.blocks).not.toContain(dead);
        }
        // The Rule of Life surface was retired the same day (Erik): its tool id is
        // gone from the list, and nothing describes it as part of the Church area.
        expect(t.blocks).not.toContain('tool:rule');
        expect(t.blocks).not.toContain('Rule of Life');
        // The surviving tool links all still resolve to real destinations.
        for (const live of ['tool:examen', 'tool:scripture', 'tool:lectio', 'tool:rosary', 'tool:confession', 'tool:catechism', 'tool:help']) {
          expect(t.blocks).toContain(live);
        }
      });
    });
  }

  it('no shared block anywhere still names the retired Workshop or five areas', () => {
    expect(chatProxy).not.toContain('Workshop');
    expect(chatProxy).not.toContain('five areas');
    expect(chatProxy).not.toContain('rare, and only when it truly fits');
  });
});
