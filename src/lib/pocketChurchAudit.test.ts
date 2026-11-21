import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PocketChurchPage, type ChurchTab, type PraySection } from '../components/PocketChurchPage';
import { getSeasonTheme } from './seasonTheme';
import { SACRAMENT_TEACHING } from './confession';
import { BEATITUDES, BEATITUDES_WOMEN } from './beatitudes';
import { MYSTERIES } from '../components/RosaryPrayer';
import {
  STATIONS,
  STATIONS_VERSICLE,
  STATIONS_PREPARATORY_PRAYER,
  STATIONS_CLOSING_PRAYER,
  STATIONS_FINAL_RUBRIC,
} from '../data/stations';
import { CATECHISM, OBJECTIONS } from '../data/catechism';
import { PRAYERS } from '../data/prayers';
import { SCRIPTURE_TRANSLATION, SCRIPTURE_TRANSLATION_LINE } from './scripture';
import type { Audience } from '@/types';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const utilities = {
  onOpenSettings: vi.fn(),
  onShareInvite: vi.fn(),
  onOpenFeedback: vi.fn(),
  onOpenAbout: vi.fn(),
  onOpenReminder: vi.fn(),
};

function render(audience: Audience, initialTab?: ChurchTab, initialPraySection?: PraySection) {
  return renderToString(
    createElement(PocketChurchPage, {
      onBack: vi.fn(),
      audience,
      seasonTheme: getSeasonTheme(new Date(), audience),
      initialTab: initialTab ?? null,
      initialPraySection: initialPraySection ?? null,
      utilities,
    }),
  );
}

/**
 * The Pocket Church audit fixes (Erik's approval, Nov 20, 2026 — punch-list
 * items 1, 3, 4, 6, 7; items 2 and 5 were NOT approved and are not built):
 * the Confession door teaches the sacrament, the Pray door gains the
 * Liguori Stations and a completed Rosary, the translation is named
 * (Douay-Rheims) and the quoted verses aligned to it, and the Ask bank is
 * corrected and completed with Holy Orders and real CCC references.
 */
describe('Pocket Church audit — item 1: the Confession door teaches the sacrament', () => {
  it('the teaching carries the three conditions, kind and number, the rite, and the scruples line', () => {
    expect(SACRAMENT_TEACHING).toHaveLength(4);
    const text = SACRAMENT_TEACHING.map(
      (b) => `${b.title} ${(b.paragraphs ?? []).join(' ')} ${(b.steps ?? []).join(' ')}`,
    ).join('\n');
    // (a) Mortal sin's three conditions, with the Catechism named.
    expect(text).toContain('grave wrong');
    expect(text).toContain('full knowledge');
    expect(text).toContain('deliberate consent');
    expect(text).toContain('1857');
    // (b) Kind and number; venial recommended, not required.
    expect(text).toContain('kind and number');
    expect(text).toContain('1456');
    expect(text).toContain('not required');
    expect(text).toContain('warmly recommends');
    // (c) The rite's steps, in order.
    expect(text).toContain('Bless me, Father, for I have sinned');
    expect(text).toContain('Act of Contrition');
    expect(text).toContain('absolution');
    // (d) The scrupulous are sent to the priest's direction, not the page.
    expect(text).toContain('scruples');
    expect(text).toContain('direction over any page');
  });

  for (const audience of ['men', 'women'] as const) {
    it(`the teaching renders in the Confession door (${audience})`, () => {
      const html = render(audience, 'confession');
      expect(html).toContain('The Sacrament, Plainly');
      expect(html).toContain('Mortal sin and venial sin');
      expect(html).toContain('In kind and number');
      expect(html).toContain('What happens in the confessional');
      expect(html).toContain('If you struggle with scruples');
    });
  }

  it('the app framing stays verbatim: only a priest can forgive a sin', () => {
    expect(read('lib/realHelp.ts')).toContain('Nothing in this app can forgive a sin. Only a priest can.');
  });
});

describe('Pocket Church audit — item 3: the Stations of the Cross, Liguori form', () => {
  it('all fourteen stations are complete received text', () => {
    expect(STATIONS).toHaveLength(14);
    STATIONS.forEach((s, i) => {
      expect(s.title.length, `station ${i + 1}`).toBeGreaterThan(0);
      expect(s.consideration.length, `station ${i + 1} consideration`).toBeGreaterThan(100);
      expect(s.prayer.length, `station ${i + 1} prayer`).toBeGreaterThan(80);
      expect(s.stabatMater.length, `station ${i + 1} verse`).toBeGreaterThan(20);
    });
    expect(STATIONS[0].title).toBe('Jesus Is Condemned to Death');
    expect(STATIONS[0].consideration).toContain('condemned by Pilate');
    expect(STATIONS[13].title).toBe('Jesus Is Laid in the Sepulchre');
    expect(STATIONS[7].consideration).toContain('Weep not for Me');
  });

  it('the opening and closing are the received frame', () => {
    expect(STATIONS_VERSICLE).toBe('We adore Thee, O Christ, and we bless Thee.');
    expect(STATIONS_PREPARATORY_PRAYER).toContain('love unutterable');
    expect(STATIONS_CLOSING_PRAYER).toContain('Behold, O kind and most sweet Jesus');
    expect(STATIONS_FINAL_RUBRIC).toContain('Sovereign Pontiff');
  });

  it('the Stations render in the Pray door', () => {
    const html = render('men', null, 'stations');
    expect(html).toContain('Preparatory Prayer');
    expect(html).toContain('love unutterable');
    expect(html).toContain('Act of Contrition');
    const src = read('components/StationsOfTheCross.tsx');
    expect(src).toContain('STATIONS_VERSICLE');
    expect(src).toContain('STATIONS_CLOSING_PRAYER');
  });
});

describe('Pocket Church audit — item 4: the Rosary completed', () => {
  it('every mystery carries a real meditation', () => {
    const sets = Object.values(MYSTERIES);
    expect(sets).toHaveLength(4);
    let count = 0;
    for (const set of sets) {
      expect(set).toHaveLength(5);
      for (const m of set) {
        count += 1;
        expect(m.meditation.length, m.title).toBeGreaterThan(60);
      }
    }
    expect(count).toBe(20);
    expect(MYSTERIES.joyful[0].meditation).toContain('Be it done unto me');
    expect(MYSTERIES.glorious[3].meditation).toContain('clothed with the sun');
  });

  it('the Rosary reads its prayers from the shared shelf and steps the whole opening', () => {
    const src = read('components/RosaryPrayer.tsx');
    expect(src).toContain("from '@/data/prayers'");
    // The truncated private copy of the Hail, Holy Queen is gone.
    expect(src).not.toContain('Hail, Holy Queen, Mother of Mercy');
    // The three introductory Hail Marys are stepped, one by one.
    expect(src).toContain('Hail Mary ${phase.index} of 3');
    // The concluding versicle and prayer close the prayer.
    expect(src).toContain('Concluding Prayer');
    expect(src).toContain('O God, whose only-begotten Son');
    expect(src).toContain('That we may be made worthy of the promises of Christ');
  });

  it('the shelf copy of the Hail, Holy Queen is the complete one', () => {
    const hhq = PRAYERS.find((p) => p.title === 'Hail, Holy Queen');
    expect(hhq).toBeDefined();
    expect(hhq!.text).toContain('Pray for us, O holy Mother of God');
    expect(hhq!.text.trim().endsWith('Amen.')).toBe(true);
  });

  it('the Rosary opens on the Creed', () => {
    const html = render('women', null, 'rosary');
    expect(html).toContain('I believe in God, the Father almighty');
  });
});

describe('Pocket Church audit — item 6: the translation named and the verses aligned', () => {
  it('the named translation is Douay-Rheims, printed in both doors', () => {
    expect(SCRIPTURE_TRANSLATION).toBe('Douay-Rheims');
    expect(SCRIPTURE_TRANSLATION_LINE).toContain('Douay-Rheims');
    expect(render('men')).toContain(SCRIPTURE_TRANSLATION_LINE);
    expect(render('men', 'ask')).toContain('Douay-Rheims');
    expect(read('components/PocketCatechism.tsx')).toContain('SCRIPTURE_TRANSLATION_LINE');
    expect(read('components/PocketChurchPage.tsx')).toContain('SCRIPTURE_TRANSLATION_LINE');
  });

  it('the Beatitudes examination quotes Douay-Rheims wording in both tracks', () => {
    for (const track of [BEATITUDES, BEATITUDES_WOMEN]) {
      const verses = track.map((b) => b.verse);
      expect(verses).toHaveLength(8);
      expect(verses[0]).toBe('Blessed are the poor in spirit: for theirs is the kingdom of heaven.');
      expect(verses[2]).toBe('Blessed are the meek: for they shall possess the land.');
      expect(verses[3]).toBe('Blessed are they that hunger and thirst after justice: for they shall have their fill.');
      expect(verses[5]).toBe('Blessed are the clean of heart: for they shall see God.');
      expect(verses[7]).toContain('suffer persecution');
    }
  });

  it('the Ask bank quotes Douay-Rheims wording', () => {
    const all = Object.values(CATECHISM).flat();
    const byId = (id: string) => all.find((e) => e.id === id)!;
    expect(byId('creed-god').scripture).toContain('teach ye all nations');
    expect(byId('sac-eucharist').scripture).toContain('He that eateth my flesh');
    expect(byId('sac-anointing').scripture).toContain('bring in the priests of the church');
    const atheism = OBJECTIONS.find((o) => o.id === 'obj-atheism')!;
    expect(atheism.scripture).toContain('The fool hath said in his heart');
    const purgatory = OBJECTIONS.find((o) => o.id === 'obj-purgatory')!;
    expect(purgatory.scripture).toContain('yet so as by fire');
  });
});

describe('Pocket Church audit — item 7: the Ask bank corrected and completed', () => {
  it('every entry carries real Catechism paragraphs', () => {
    const all = Object.values(CATECHISM).flat();
    expect(all.length).toBe(27);
    for (const e of all) {
      expect(e.ccc, e.id).toMatch(/^CCC \d/);
    }
  });

  it('all seven sacraments are covered, Holy Orders added', () => {
    const sacraments = CATECHISM.sacraments;
    expect(sacraments).toHaveLength(7);
    const orders = sacraments.find((e) => e.id === 'sac-holy-orders');
    expect(orders).toBeDefined();
    expect(orders!.question).toContain('Holy Orders');
    expect(orders!.ccc).toContain('1536');
    expect(orders!.tradition).toContain('Ignatius of Antioch');
  });

  it('the loose attributions, the overstatement, and the combative lines are gone', () => {
    const data = read('data/catechism.ts');
    // The apocryphal Augustine ship/pilot quote.
    expect(data).not.toContain('priest is the pilot');
    // The self-contradictory Augustine hell line.
    expect(data).not.toContain('God did not create hell; He created it');
    // The Didache overstatement.
    expect(data).not.toContain('confirm infant baptism');
    expect(data).toContain('already gives baptismal instructions');
    expect(data).toContain('household baptisms');
    // The combative defense register.
    expect(data).not.toContain('contradicts all historical scholarship');
    expect(data).not.toContain('just read the news');
    expect(data).not.toContain('just biology');
  });
});
