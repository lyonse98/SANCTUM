import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Nov 18, 2026 batch (Erik): the canonical crisis line placed where a
 * person in trouble would meet it, and two duplications taken off Today.
 *
 * WS1 — one shared CrisisLine ("In crisis? Call or text 988 — free, day or
 * night", the number a tel: link) at the TOP of Companions, About,
 * Settings, and the Pocket Church hub, and at the FOOT of Today only (the
 * under-masthead line retired the same day, at Erik's word). Real Help
 * already leads with its crisis card and the welcome gate already carries
 * its own 988 — both untouched, both pinned as found.
 *
 * WS2 — the day's celebration was named by the SeasonBadge chip as well as
 * the masthead; the chip now keeps season + rank and its colour behaviour,
 * and the name renders once.
 *
 * WS3 — Tailor had two doors on Today (the Gospel card's tile and the
 * page's plate); the card's door is gone, the plate is the one entry.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const crisisLine = readSrc('components/CrisisLine.tsx');
const home = readSrc('components/HomeScreen.tsx');
const companions = readSrc('components/CompanionSelect.tsx');
const about = readSrc('components/AboutSanctumPage.tsx');
const settings = readSrc('components/SettingsModal.tsx');
const church = readSrc('components/PocketChurchPage.tsx');
const help = readSrc('components/FindHelpPage.tsx');
const hero = readSrc('components/TodayHero.tsx');
const badge = readSrc('components/SeasonBadge.tsx');
const card = readSrc('components/DailyQuote.tsx');

describe('WS1 — the canonical crisis line, one component everywhere', () => {
  it('the component carries the sentence, the tel: link, and a readable size', () => {
    expect(crisisLine).toContain('In crisis? Call or text');
    expect(crisisLine).toContain('href="tel:988"');
    expect(crisisLine).toContain('— free, day or night.');
    expect(crisisLine).toContain('text-[13px]');
    expect(crisisLine).toContain('data-crisis-line');
  });

  it('Companions: the line is the first thing on the surface, above the quiz and the list', () => {
    expect(companions).toContain('<CrisisLine');
    expect(companions.indexOf('<CrisisLine')).toBeLessThan(companions.indexOf('Not sure who to talk to?'));
    expect(companions.indexOf('<CrisisLine')).toBeLessThan(companions.indexOf('cast.map'));
  });

  it('About: the line stands at the top, above the thesis', () => {
    expect(about).toContain('<CrisisLine');
    expect(about.indexOf('<CrisisLine')).toBeLessThan(about.indexOf('{MISSION_LINE}'));
  });

  it('Settings: the line stands at the top of the sheet, above the track switch', () => {
    expect(settings).toContain('<CrisisLine');
    expect(settings.indexOf('<CrisisLine')).toBeLessThan(settings.indexOf('Your Track'));
  });

  it('Pocket Church: the line stands at the top of the hub, above the doors', () => {
    expect(church).toContain('<CrisisLine');
    expect(church.indexOf('<CrisisLine')).toBeLessThan(church.indexOf('Three doors: pray'));
    expect(church.indexOf('<CrisisLine')).toBeLessThan(church.indexOf('role="tablist"'));
  });

  it('Today: the line stands once, at the foot — below More of Sanctum, above the utilities', () => {
    expect(home.match(/<CrisisLine/g) ?? []).toHaveLength(1);
    expect(home.indexOf('<CrisisLine')).toBeGreaterThan(home.indexOf('<MoreOfSanctum'));
    expect(home.indexOf('<CrisisLine')).toBeLessThan(home.indexOf('<UtilitiesLine'));
    // No inline copy remains on Today — the component is the only carrier.
    expect(home).not.toContain('href="tel:988"');
    expect(home).not.toContain('In crisis? Call or text');
  });

  it('Real Help still leads with its crisis card, untouched', () => {
    expect(help.indexOf('<CrisisCard')).toBeGreaterThan(-1);
    expect(help.indexOf('<CrisisCard')).toBeLessThan(help.indexOf('{HELP_DISCLAIMER}'));
    expect(help.indexOf('<CrisisCard')).toBeLessThan(help.indexOf('sections.map'));
  });
});

describe('WS2 — the celebration is named once on Home', () => {
  it('the badge no longer renders the feast name', () => {
    expect(badge).not.toContain('{visual.feastName}</span>');
    expect(badge).not.toContain('<span>{visual.feastName}');
  });

  it('the chip keeps the season and the rank label on feast days', () => {
    expect(badge).toContain('<span>{season.name}</span>');
    expect(badge).toContain('RANK_LABEL[visual.feastRank]');
  });

  it('the chip keeps its feast-day colour behaviour', () => {
    expect(badge).toContain("visual.feastName ? '1F' : '15'");
    expect(badge).toContain("visual.feastName ? '60' : '40'");
  });

  it('the masthead keeps the naming: the emblem and art lines still carry name and rank', () => {
    expect(hero).toContain('{feastEmblem.name}');
    expect(hero).toContain('{feastEmblem.rank}');
    expect(hero).toContain('{feastArt.feast.name}');
    expect(hero).toContain('{feastArt.feast.rank}');
  });
});

describe('WS3 — exactly one Tailor entry on Today', () => {
  it('the Gospel card has no Tailor door left', () => {
    expect(card).not.toContain('data-tile="tailor"');
    expect(card).not.toContain('<TailorToday');
  });

  it('the page plate is the one entry, mounting the one panel', () => {
    expect(home.match(/data-tailor-entry/g) ?? []).toHaveLength(1);
    expect(home.match(/<TailorToday/g) ?? []).toHaveLength(1);
    expect(home).toContain('Tailor today&rsquo;s devotional');
  });

  it('Reflect with a companion is untouched — a different feature', () => {
    expect(card).toContain('data-tile="reflect"');
    expect(card).toContain('onClick={handleReflectWithCompanion}');
    expect(card).toContain('aria-label="Reflect with a Companion"');
  });
});
