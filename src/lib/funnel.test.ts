import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFeastEmblem } from './feastArt';
import { companionForSaint } from './saintCompanion';
import { loadRule, saveRule } from './ruleOfLife';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The November 2026 reshaping (Erik's rulings, Nov 11–12): the Workshop tab retired
 * and its contents absorbed — the Examen home on Today — the quick wellness tools
 * first moved to Real Help, then removed from the app altogether (Nov 12), the
 * Rule of Life and Lectio surfaces retired the same day (components kept,
 * unwired; their stored keys left inert), and every surface funnelled into the next:
 * Gospel → companions, saint → companion, companions → Real Help, Examen → Confession,
 * Real Help → prayer, and all of it pointing at Church. These tests pin the shape so
 * a later edit cannot quietly re-stand the fifth tab or strand a stored practice.
 */

describe('four areas, no Workshop', () => {
  it('the tab set is exactly Church, Companions, Today, Real Help', () => {
    const tabBar = read('components/TabBar.tsx');
    for (const id of ["'church'", "'companions'", "'today'", "'help'"]) {
      expect(tabBar).toContain(`id: ${id}`);
    }
    expect(tabBar).not.toContain("'workshop'");
    expect(read('types.ts')).not.toContain("'workshop'");
  });

  it('the app routes no one to a workshop that no longer exists', () => {
    const app = read('App.tsx');
    expect(app.toLowerCase()).not.toContain('workshop');
    // A companion's examen link lands on Today's evening Examen; the rule link on
    // Pocket Church's Rule of Life; a legacy link naming a removed wellness tool
    // lands on Real Help itself — the page, no tool opened (Nov 12, 2026).
    expect(app).toContain("'examen': { tab: 'today', todayExamen: true }");
    // The Rule of Life surface was retired Nov 12, 2026 (Erik): a saved
    // transcript's rule link lands on the Pocket Church page itself.
    expect(app).toContain("'rule': { tab: 'church' }");
    expect(app).toContain("'cold-start': { tab: 'help' }");
    expect(app).not.toContain('helpTool');
  });
});

describe('the absorbed homes', () => {
  it('the Rule of Life surface is retired — no card in Pocket Church, component file kept unwired', () => {
    const church = read('components/PocketChurchPage.tsx');
    expect(church).not.toContain("from '@/components/RuleOfLife'");
    expect(church).not.toContain('<RuleOfLife');
    expect(church).not.toContain("'rule'");
    // The component stays in the repo, unwired (Erik, Nov 12, 2026) — as does
    // LectioDivina, whose surface was retired the same day.
    expect(existsSync(join(SRC, 'components', 'RuleOfLife.tsx'))).toBe(true);
    expect(existsSync(join(SRC, 'components', 'LectioDivina.tsx'))).toBe(true);
  });

  it('Real Help is real help only — the wellness tools are gone entirely (Nov 12, 2026)', () => {
    const help = read('components/FindHelpPage.tsx');
    expect(help).not.toContain('RightNowTools');
    expect(help).not.toContain('Right Now');
    expect(help).not.toContain('initialTool');
    // The components themselves no longer exist anywhere in the tree.
    for (const gone of ['RightNowTools.tsx', 'LazyTools.tsx', 'ColdStart.tsx', 'BreathPacer.tsx', 'DrivewayReset.tsx']) {
      expect(existsSync(join(SRC, 'components', gone))).toBe(false);
    }
  });

  it('the Evening Examen lives on Today, expandable, from the PM hour the audio day keeps', () => {
    const home = read('components/HomeScreen.tsx');
    expect(home).toContain("import { EveningExamen } from '@/components/EveningExamen'");
    expect(home).toContain('AUDIO_PM_START_HOUR');
    expect(home).toContain('showExamen');
    // A push landing can force it into view at any hour — already open.
    expect(home).toContain('forceExamen');
    const section = read('components/EveningExamen.tsx');
    expect(section).toContain("import { ExamenChecklist } from '@/components/ExamenChecklist'");
    expect(section).toContain('aria-expanded');
  });
});

describe('stored practices survive the move — no key renamed, nothing lost', () => {
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

  const original = globalThis.localStorage;
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  });

  it('a rule written under the old tab reads back verbatim under the same key', () => {
    // Written by the retired Workshop, under the key it has always used.
    globalThis.localStorage.setItem('sanctum_rule_of_life', JSON.stringify(['gospel', 'examen', 'rosary']));
    expect(loadRule()).toEqual(['gospel', 'examen', 'rosary']);
    // And a rule saved from the new home lands under that same key, untouched.
    saveRule(['silence', 'thanks']);
    expect(globalThis.localStorage.getItem('sanctum_rule_of_life')).toBe(JSON.stringify(['silence', 'thanks']));
    expect(loadRule()).toEqual(['silence', 'thanks']);
  });

  it("the Examen's own storage key is the one it has always used", () => {
    expect(read('components/ExamenChecklist.tsx')).toContain("const STORAGE_KEY = 'sanctum_examen'");
  });
});

describe("the men's feast emblem — his hero wears the symbol, hers the painting", () => {
  it('a feast day earns the emblem on the men’s track (St. Luke, Oct 18, 2026)', () => {
    const emblem = getFeastEmblem(new Date(2026, 9, 18), 'men');
    expect(emblem).not.toBeNull();
    expect(emblem?.glyph).toBeTruthy();
    expect(emblem?.motif).toBeTruthy();
  });

  it('a solemnity earns it too (Immaculate Conception, Dec 8, 2026)', () => {
    expect(getFeastEmblem(new Date(2026, 11, 8), 'men')).not.toBeNull();
  });

  it('an ordinary day earns nothing (Jun 15, 2026)', () => {
    expect(getFeastEmblem(new Date(2026, 5, 15), 'men')).toBeNull();
  });

  it('a memorial earns nothing (St. Martin of Tours, Nov 11, 2026)', () => {
    expect(getFeastEmblem(new Date(2026, 10, 11), 'men')).toBeNull();
  });

  it('the women’s track never takes the emblem — she has the art', () => {
    expect(getFeastEmblem(new Date(2026, 9, 18), 'women')).toBeNull();
    const hero = read('components/TodayHero.tsx');
    expect(hero).toContain('getFeastEmblem');
    expect(hero).toContain('feastEmblem.glyph');
  });

  it('Sundays carry the quiet Mass door to Real Help', () => {
    const hero = read('components/TodayHero.tsx');
    expect(hero).toContain('isSunday');
    expect(hero).toContain('Mass today');
  });
});

describe('portrait frames and grades, by track', () => {
  const css = read('index.css');

  it('her portraits wear the cathedral arch; his keep the shapes they had', () => {
    expect(css).toContain("[data-audience='women'] .portrait-arch {");
    expect(css).toContain('border-radius: 999px 999px 12px 12px');
    expect(css).toContain("[data-audience='women'] .portrait-arch-banner {");
    expect(css).not.toContain("[data-audience='men'] .portrait-arch");
  });

  it('the grade differs by track — his cooler, hers warmer', () => {
    expect(css).toContain("[data-audience='men'] .portrait-grade {");
    expect(css).toContain("[data-audience='women'] .portrait-grade {");
    expect(css).toContain('sepia(0.12)');
  });

  it('the frames are actually worn — select cards, avatars, the router portrait', () => {
    expect(read('components/CompanionSelect.tsx')).toContain('portrait-arch-banner');
    expect(read('components/CompanionAvatar.tsx')).toContain('portrait-arch');
    expect(read('components/CompanionRouter.tsx')).toContain('portrait-grade');
  });
});

describe('the funnel — every surface points at the next', () => {
  it('the saint of the day opens their companion, when they are in the cast', () => {
    expect(companionForSaint('St. Joseph', 'men')?.id).toBe('joseph');
    expect(companionForSaint('St. Augustine', 'men')?.id).toBe('augustine');
    expect(companionForSaint('St. Thérèse of Lisieux', 'men')?.id).toBe('therese');
    expect(companionForSaint('St. Thérèse of Lisieux', 'women')?.id).toBe('therese-women');
    expect(companionForSaint('St. Monica', 'women')?.id).toBe('monica');
    expect(companionForSaint('St. Joan of Arc', 'women')?.id).toBe('joan');
    const card = read('components/SaintOfDayCard.tsx');
    expect(card).toContain('companionForSaint');
    expect(card).toContain('Spend a few minutes with');
  });

  it('a saint outside the cast gets no door', () => {
    expect(companionForSaint('St. Martin of Tours', 'men')).toBeNull();
    expect(companionForSaint('St. Martin of Tours', 'women')).toBeNull();
    // Monica is in her cast, not his.
    expect(companionForSaint('St. Monica', 'men')).toBeNull();
  });

  it('Our Lady’s days find her — and Magdalene’s day finds Magdalene, not her', () => {
    expect(companionForSaint('Our Lady of Lourdes', 'women')?.id).toBe('mary');
    expect(companionForSaint('Mary, Mother of God', 'women')?.id).toBe('mary');
    expect(companionForSaint('St. Mary Magdalene', 'women')?.id).toBe('magdalene');
  });

  it('the finished Examen points to Confession and to a priest', () => {
    const examen = read('components/ExamenChecklist.tsx');
    expect(examen).toContain('onOpenConfession');
    expect(examen).toContain('Take tonight');
    expect(examen).toContain('Find a priest · Real Help');
  });

  it('companion doors: the intro points to Real Help and to prayer', () => {
    const intro = read('components/PersonaIntro.tsx');
    expect(intro).toContain('Find a priest · Real Help');
    expect(intro).toContain('onOpenPray');
  });

  it('Real Help’s foot points back to prayer', () => {
    const help = read('components/FindHelpPage.tsx');
    expect(help).toContain('Pray now');
    expect(help).toContain('onPrayNow');
  });

  it('the Gospel card already carries the companion door', () => {
    expect(read('components/DailyQuote.tsx')).toContain('Reflect with a Companion');
  });
});

describe('the About page tells the new shape', () => {
  it('describes the Ignatian arc and never mentions the retired tab', () => {
    const about = read('components/AboutSanctumPage.tsx');
    expect(about).toContain('The shape of a day');
    expect(about).toContain('Hear the Gospel');
    expect(about).toContain('Examen');
    expect(about.toLowerCase()).not.toContain('workshop');
  });
});
