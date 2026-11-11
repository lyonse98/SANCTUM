import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getSeasonTheme } from './seasonTheme';
import { makeLightTheme } from './theme';
import { getDayRank, getMemorialMarker } from './dayTheme';
import { getFeastArt, MARIAN_FEAST_NAMES } from './feastArt';
import { FIXED_FEASTS } from '@/data/feastDays';
import { DAILY_QUOTES, DAILY_QUOTES_WOMEN, quoteForDay, quotesForAudience } from '@/data/quotes';
import { personaForAudience, personasForAudience } from '@/personas';
import type { PersonaTheme } from '@/types';

/**
 * The merged women's design (Erik, Nov 10, 2026) — three layers, one rule:
 * the liturgical spine is shared, her content is hers, and the visual register
 * differs. The first build (HEAD 40bda0b → 7d5b226) pinned the men's theme
 * output value-for-value so a women's change could never quietly repaint his
 * Sanctum.
 *
 * REVISION, same day: Erik reviewed the first build and approved a revised
 * final system — "One Truth, Two Seasonings" — that supersedes the neutral
 * values: both grounds move (his cooler stone-beige, hers warm ivory-sand),
 * the grounds are tinted by the season and graded by a rank ladder (feasts
 * deepen the wash, solemnities ~3x), the accent budget retires each track's
 * secondary accents on feasts and solemnities, his themes gain a slate
 * secondary, and his companions gain a browse-by-need row. The men's
 * snapshots below were therefore re-based DELIBERATELY, with his approval,
 * on that ruling — the values changed, the pinning discipline did not.
 * Men's CONTENT and COPY are untouched by the revision and remain pinned by
 * the genderCopy/portrayal suites, which pass unmodified.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** A theme with its one function field rendered out, so it can be deep-compared. */
function serializable(t: PersonaTheme) {
  const { accentRgba, ...rest } = t;
  return { ...rest, rgba25: accentRgba(0.25), rgba1: accentRgba(1) };
}

const MEN_NEUTRALS = {
  bg: '#E9E6DC',
  card: '#F7F4EC',
  cardHover: '#FFFFFF',
  border: '#CFC9BB',
  borderLight: '#B0A996',
  text: '#35302A',
  textBright: '#191613',
  textMuted: '#5D5649',
  textDim: '#6E665A',
};

/** His slate secondary, and the grey it retires to when a feast leads. */
const MEN_SLATE = '#5A6B7C';
const MEN_SLATE_RETIRED = '#94908A';

describe("men's season theme — the approved stone-beige ground, rank for rank", () => {
  it('an ordinary day in Ordinary Time — ferial wash, slate at full strength', () => {
    expect(serializable(getSeasonTheme(new Date('2026-06-15T12:00:00')))).toEqual({
      ...MEN_NEUTRALS,
      bgGradient:
        'radial-gradient(ellipse at 18% 0%, rgba(30,107,58,0.20) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(30,107,58,0.12) 0%, transparent 55%), linear-gradient(180deg, #EFEBE2 0%, #E1DDD0 100%)',
      accent: '#1E6B3A',
      accentBright: '#2A8A4E',
      accentDark: '#15502B',
      glow: 'rgba(30,107,58,0.20)',
      secondaryAccent: MEN_SLATE,
      rgba25: 'rgba(30,107,58,0.25)',
      rgba1: 'rgba(30,107,58,1)',
    });
  });

  it('the Immaculate Conception (Marian blue) — solemnity wash at 3x, slate retired', () => {
    expect(serializable(getSeasonTheme(new Date('2026-12-08T12:00:00')))).toEqual({
      ...MEN_NEUTRALS,
      bgGradient:
        'radial-gradient(ellipse at 18% 0%, rgba(42,78,140,0.60) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(42,78,140,0.36) 0%, transparent 55%), linear-gradient(180deg, #EFEBE2 0%, #E1DDD0 100%)',
      accent: '#2A4E8C',
      accentBright: '#3F6BB0',
      accentDark: '#1E3A68',
      glow: 'rgba(42,78,140,0.20)',
      secondaryAccent: MEN_SLATE_RETIRED,
      rgba25: 'rgba(42,78,140,0.25)',
      rgba1: 'rgba(42,78,140,1)',
    });
  });

  it('Mary, Mother of God (white solemnity) — solemnity wash at 3x, slate retired', () => {
    expect(serializable(getSeasonTheme(new Date('2026-01-01T12:00:00')))).toEqual({
      ...MEN_NEUTRALS,
      bgGradient:
        'radial-gradient(ellipse at 18% 0%, rgba(140,106,31,0.60) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(140,106,31,0.36) 0%, transparent 55%), linear-gradient(180deg, #EFEBE2 0%, #E1DDD0 100%)',
      accent: '#8C6A1F',
      accentBright: '#B08A2E',
      accentDark: '#6B4F15',
      glow: 'rgba(140,106,31,0.20)',
      secondaryAccent: MEN_SLATE_RETIRED,
      rgba25: 'rgba(140,106,31,0.25)',
      rgba1: 'rgba(140,106,31,1)',
    });
  });

  it('Easter Sunday (gold) — solemnity wash at 3x, slate retired', () => {
    expect(serializable(getSeasonTheme(new Date('2026-04-05T12:00:00')))).toEqual({
      ...MEN_NEUTRALS,
      bgGradient:
        'radial-gradient(ellipse at 18% 0%, rgba(166,124,26,0.60) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(166,124,26,0.36) 0%, transparent 55%), linear-gradient(180deg, #EFEBE2 0%, #E1DDD0 100%)',
      accent: '#A67C1A',
      accentBright: '#C9A02E',
      accentDark: '#7E5C10',
      glow: 'rgba(166,124,26,0.20)',
      secondaryAccent: MEN_SLATE_RETIRED,
      rgba25: 'rgba(166,124,26,0.25)',
      rgba1: 'rgba(166,124,26,1)',
    });
  });

  it("default and explicit 'men' are the same call; his keys are his own", () => {
    const date = new Date('2026-06-15T12:00:00');
    expect(serializable(getSeasonTheme(date))).toEqual(serializable(getSeasonTheme(date, 'men')));
    const men = getSeasonTheme(date, 'men');
    // The revision gives him a slate secondary of his own — never her colours.
    expect(men.secondaryAccent).toBe(MEN_SLATE);
    expect('tertiaryAccent' in men).toBe(false);
    expect(men.secondaryAccent).not.toBe('#B85C38');
    const seed = { accent: '#123456', accentBright: '#234567', accentDark: '#0A1B2C', tint: '18,52,86' };
    expect(serializable(makeLightTheme(seed))).toEqual(serializable(makeLightTheme(seed, 'men')));
  });

  it("a men's companion theme (Joseph) stands on the new ground, slate full, ferial wash", () => {
    const joseph = personaForAudience('joseph', 'men');
    expect(joseph).not.toBeNull();
    expect(serializable(joseph!.theme)).toEqual({
      ...MEN_NEUTRALS,
      bgGradient:
        'radial-gradient(ellipse at 18% 0%, rgba(194,65,12,0.20) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(194,65,12,0.12) 0%, transparent 55%), linear-gradient(180deg, #EFEBE2 0%, #E1DDD0 100%)',
      accent: '#C2410C',
      accentBright: '#E8590C',
      accentDark: '#9A3412',
      glow: 'rgba(194,65,12,0.20)',
      secondaryAccent: MEN_SLATE,
      rgba25: 'rgba(194,65,12,0.25)',
      rgba1: 'rgba(194,65,12,1)',
    });
  });
});

describe("women's theme — warm ivory-sand over the same liturgical spine", () => {
  it('the season accent stays primary; only the neutral ground warms', () => {
    const date = new Date('2026-12-08T12:00:00');
    const men = getSeasonTheme(date, 'men');
    const women = getSeasonTheme(date, 'women');
    // The liturgical colour — accent, its shades, its glow — is identical.
    expect(women.accent).toBe(men.accent);
    expect(women.accentBright).toBe(men.accentBright);
    expect(women.accentDark).toBe(men.accentDark);
    expect(women.glow).toBe(men.glow);
    expect(women.accentRgba(0.4)).toBe(men.accentRgba(0.4));
    // The ground is hers: warm ivory-sand surfaces, plum-brown text.
    expect(women.bg).toBe('#F5EDDE');
    expect(women.card).toBe('#FCF8EF');
    expect(women.border).toBe('#DFC8AF');
    expect(women.text).toBe('#3E2B31');
    expect(women.textBright).toBe('#251820');
    expect(women.bg).not.toBe(men.bg);
    expect(women.text).not.toBe(men.text);
    // Dec 8 is a solemnity: the accent budget has retired her secondaries to
    // their neutral cousins (the rank-ladder suite pins the full-strength day).
    expect(women.secondaryAccent).toBe('#C8A184');
    expect(women.tertiaryAccent).toBe('#9AA08E');
  });

  it('on an ordinary day her secondaries ride at full strength — clay and sage', () => {
    const women = getSeasonTheme(new Date('2026-06-15T12:00:00'), 'women');
    expect(women.secondaryAccent).toBe('#B85C38');
    expect(women.tertiaryAccent).toBe('#7C8A6A');
  });

  it("her companions stand on the same warm ground, in their own colours", () => {
    const mary = personaForAudience('mary', 'women');
    expect(mary?.theme.card).toBe('#FCF8EF');
    expect(mary?.theme.bg).toBe('#F5EDDE');
    expect(mary?.theme.accent).toBe('#274690');
    // A companion's theme never retires — her colours are her identity.
    expect(mary?.theme.secondaryAccent).toBe('#B85C38');
  });

  it('the serif display voice is wired, and only for her', () => {
    const css = read('../index.css');
    expect(css).toContain("[data-audience='women'] .font-display");
    expect(css).toContain('Georgia');
    expect(read('../App.tsx')).toContain('dataset.audience');
  });

  it('the masthead motifs are wired per track — his ruling, her botanical wash', () => {
    const css = read('../index.css');
    expect(css).toContain("[data-audience='men'] .masthead-motif::before");
    expect(css).toContain("[data-audience='women'] .masthead-motif::before");
    expect(css).toContain('repeating-linear-gradient');
    expect(css).toContain('radial-gradient(ellipse 64px 26px');
    expect(read('../components/TodayHero.tsx')).toContain('masthead-motif');
  });
});

describe('feast-day art — the Illuminated Garden (women only)', () => {
  it('the Immaculate Conception wears her portrait', () => {
    const art = getFeastArt(new Date(2026, 11, 8), 'women');
    expect(art?.feast.name).toBe('The Immaculate Conception');
    expect(art?.feast.rank).toBe('solemnity');
    expect(art?.marian).toBe(true);
    expect(art?.image).toBe('/mary.webp');
  });

  it('Mary, Mother of God (Jan 1) wears her portrait', () => {
    const art = getFeastArt(new Date(2026, 0, 1), 'women');
    expect(art?.feast.name).toBe('Mary, Mother of God');
    expect(art?.marian).toBe(true);
    expect(art?.image).toBe('/mary.webp');
  });

  it('a Marian memorial below solemnity rank still earns the art (Our Lady of Lourdes)', () => {
    const art = getFeastArt(new Date(2026, 1, 11), 'women');
    expect(art?.feast.name).toBe('Our Lady of Lourdes');
    expect(art?.feast.rank).toBe('memorial');
    expect(art?.marian).toBe(true);
  });

  it('a non-Marian solemnity wears its season photograph (Easter Sunday)', () => {
    const art = getFeastArt(new Date(2026, 3, 5), 'women');
    expect(art?.feast.name).toBe('Easter Sunday');
    expect(art?.feast.rank).toBe('solemnity');
    expect(art?.marian).toBe(false);
    expect(art?.image).toBe('/backdrops/easter.webp');
  });

  it('an ordinary day wears nothing extra', () => {
    expect(getFeastArt(new Date(2026, 5, 15), 'women')).toBeNull();
  });

  it("a non-Marian feast below solemnity wears nothing extra (St. Francis)", () => {
    expect(getFeastArt(new Date(2026, 9, 4), 'women')).toBeNull();
  });

  it("the men's track gets no feast art on any day", () => {
    expect(getFeastArt(new Date(2026, 11, 8), 'men')).toBeNull();
    expect(getFeastArt(new Date(2026, 0, 1), 'men')).toBeNull();
    expect(getFeastArt(new Date(2026, 3, 5), 'men')).toBeNull();
  });

  it('every name in the Marian set is a real day on the shared calendar', () => {
    const calendarNames = new Set(Object.values(FIXED_FEASTS).map((f) => f.name));
    for (const name of MARIAN_FEAST_NAMES) {
      expect(calendarNames.has(name), name).toBe(true);
    }
  });

  it("the hero renders the art through the gated helper", () => {
    expect(read('../components/TodayHero.tsx')).toContain('getFeastArt');
  });
});

describe("companion issue tags — hers, on her screen only", () => {
  const EXPECTED_ISSUES: Record<string, string[]> = {
    mary: ['Trust', 'Surrender', 'Motherhood', 'Grief', 'Saying yes'],
    magdalene: ['Starting over', 'Shame', 'Grief', 'Hope', 'Being believed'],
    teresa: ['Prayer', 'Dryness', 'Perseverance', 'Friendship with God'],
    catherine: ['Courage', 'Speaking truth', 'Work', 'Love of the Church'],
    monica: ['Waiting on God', 'Praying for family', 'Perseverance', 'Letting go'],
    joan: ['Courage', 'Calling', 'Discernment', 'Being doubted'],
    clare: ['Simplicity', 'Letting go', 'Contemplation', 'Hidden life'],
    'therese-women': ['The little way', 'Hidden suffering', 'Everyday fidelity', 'Dryness'],
  };

  it('every women’s companion carries 3–5 short issue tags — the pinned lists', () => {
    for (const p of personasForAudience('women')) {
      expect(p.issues, p.id).toEqual(EXPECTED_ISSUES[p.id]);
      expect(p.issues!.length).toBeGreaterThanOrEqual(3);
      expect(p.issues!.length).toBeLessThanOrEqual(5);
      expect(new Set(p.issues).size).toBe(p.issues!.length);
      for (const tag of p.issues!) expect(tag.trim().length).toBeGreaterThan(0);
    }
  });

  it('no men’s companion carries issue tags', () => {
    for (const p of personasForAudience('men')) {
      expect(p.issues, p.id).toBeUndefined();
    }
  });

  it('needs cross-link the cast — a woman can enter by her need, not by a name', () => {
    const carriers = (tag: string) =>
      personasForAudience('women').filter((p) => p.issues?.includes(tag)).map((p) => p.id);
    expect(carriers('Grief')).toEqual(expect.arrayContaining(['mary', 'magdalene']));
    expect(carriers('Courage')).toEqual(expect.arrayContaining(['catherine', 'joan']));
    expect(carriers('Letting go')).toEqual(expect.arrayContaining(['monica', 'clare']));
    expect(carriers('Dryness')).toEqual(expect.arrayContaining(['teresa', 'therese-women']));
  });

  it('the select screen surfaces the tags as chips and a browse-by-need row', () => {
    const src = read('../components/CompanionSelect.tsx');
    expect(src).toContain('Browse by need');
    expect(src).toContain('persona.issues');
    expect(src).toContain("audience === 'women'");
    expect(src).toContain('needsOf');
  });
});

describe("men's browse-by-need — his struggles, the same row", () => {
  it("the men's needs list derives from the cast's own struggles and is not empty", () => {
    const cast = personasForAudience('men');
    const needs = [...new Set(cast.flatMap((p) => p.struggles))];
    expect(needs.length).toBeGreaterThanOrEqual(20);
    for (const tag of needs) expect(tag.trim().length).toBeGreaterThan(0);
    // His register, not hers: his list is built from struggles alone.
    expect(needs).toContain('Lust');
    expect(needs).toContain('Anger');
    expect(needs).not.toContain('Waiting on God');
  });

  it('every men’s companion is reachable by at least one of his own needs', () => {
    const cast = personasForAudience('men');
    for (const p of cast) {
      expect(p.struggles.length, p.id).toBeGreaterThanOrEqual(3);
      const reachable = cast.filter((c) => c.struggles.includes(p.struggles[0]));
      expect(reachable.map((c) => c.id), p.id).toContain(p.id);
    }
  });

  it("his needs cross-link too — 'Shame' and 'Marriage' each carry two companions", () => {
    const cast = personasForAudience('men');
    const carriers = (tag: string) => cast.filter((p) => p.struggles.includes(tag)).map((p) => p.id);
    expect(carriers('Shame').length).toBeGreaterThanOrEqual(2);
    expect(carriers('Marriage').length).toBeGreaterThanOrEqual(2);
  });
});

describe('the rank ladder — the season leads, feasts deepen, solemnities deepen most', () => {
  /** The first tint wash alpha in a theme's ground gradient. */
  const washAlpha = (t: PersonaTheme) => {
    const m = t.bgGradient.match(/rgba\([\d,]+,([\d.]+)\)/);
    return m ? parseFloat(m[1]) : NaN;
  };

  it('ranks resolve against the shared calendar', () => {
    expect(getDayRank(new Date(2026, 5, 15)).rank).toBe('ferial');
    expect(getDayRank(new Date(2026, 9, 1)).rank).toBe('memorial'); // St. Thérèse
    expect(getDayRank(new Date(2026, 9, 18)).rank).toBe('feast'); // St. Luke
    expect(getDayRank(new Date(2026, 11, 8)).rank).toBe('solemnity'); // Immaculate Conception
    expect(getDayRank(new Date(2026, 3, 5)).rank).toBe('solemnity'); // Easter Sunday
  });

  it('tint strength orders solemnity > feast > ferial, on both tracks', () => {
    const ferial = new Date('2026-06-15T12:00:00');
    const feast = new Date('2026-10-18T12:00:00');
    const solemnity = new Date('2026-12-08T12:00:00');
    for (const audience of ['men', 'women'] as const) {
      const f = washAlpha(getSeasonTheme(ferial, audience));
      const fe = washAlpha(getSeasonTheme(feast, audience));
      const s = washAlpha(getSeasonTheme(solemnity, audience));
      expect(f, audience).toBe(0.2);
      expect(fe, audience).toBe(0.35);
      expect(s, audience).toBe(0.6);
      expect(s).toBeGreaterThan(fe);
      expect(fe).toBeGreaterThan(f);
    }
  });

  it("a feast's own colour takes the lead — St. Luke wears martyr red on both tracks", () => {
    for (const audience of ['men', 'women'] as const) {
      const t = getSeasonTheme(new Date('2026-10-18T12:00:00'), audience);
      expect(t.accent, audience).toBe('#A31F1F');
      expect(t.accentBright, audience).toBe('#C72E2E');
      expect(t.accentDark, audience).toBe('#7E1616');
    }
  });

  it('a memorial in a privileged season never repaints the theme — the season leads as on a ferial', () => {
    // Our Lady of Lourdes, Feb 11, 2027 — a memorial inside Lent. Ordinary
    // Time memorials now take the lead (the refinement suite below); in the
    // privileged seasons the old rule stands untouched.
    const memorial = new Date('2027-02-11T12:00:00');
    const ferial = new Date('2027-02-12T12:00:00');
    for (const audience of ['men', 'women'] as const) {
      expect(serializable(getSeasonTheme(memorial, audience)), audience).toEqual(
        serializable(getSeasonTheme(ferial, audience)),
      );
      // Lent's violet leads — not the saint's blue.
      expect(getSeasonTheme(memorial, audience).accent, audience).toBe('#5E2A6B');
    }
  });

  it('the accent budget retires both tracks’ secondaries on a feast day', () => {
    const feastDay = new Date('2026-10-18T12:00:00');
    const women = getSeasonTheme(feastDay, 'women');
    expect(women.secondaryAccent).toBe('#C8A184'); // clay → sand
    expect(women.tertiaryAccent).toBe('#9AA08E'); // sage → stone-sage
    const men = getSeasonTheme(feastDay, 'men');
    expect(men.secondaryAccent).toBe('#94908A'); // slate → grey
  });

  it('the memorial marker wears the saint’s liturgical colour — and only on memorials', () => {
    // St. Thérèse, a virgin: the white marker — ivory fill, gold ring.
    expect(getMemorialMarker(new Date(2026, 9, 1))).toEqual({
      colorName: 'white',
      fill: '#FDFAF2',
      ring: '#B08A2E',
    });
    // St. Cecilia, a martyr (Nov 22, 2027 — in 2026 the day is Christ the King).
    expect(getMemorialMarker(new Date(2027, 10, 22))).toEqual({
      colorName: 'red',
      fill: '#A31F1F',
      ring: null,
    });
    // Feasts, solemnities, and ferials earn no marker.
    expect(getMemorialMarker(new Date(2026, 9, 18))).toBeNull();
    expect(getMemorialMarker(new Date(2026, 11, 8))).toBeNull();
    expect(getMemorialMarker(new Date(2026, 5, 15))).toBeNull();
  });

  it('the Saint of the Day card renders the marker from the ladder', () => {
    const src = read('../components/SaintOfDayCard.tsx');
    expect(src).toContain('getMemorialMarker');
    expect(src).toContain('marker.fill');
  });
});

describe('the memorial refinement — in Ordinary Time the saint leads, the season keeps the ground (Erik, Nov 11, 2026)', () => {
  // Erik's ruling from the live app on St. Martin's day: with green on every
  // accent surface and the saint reduced to a marker, the memorial clashed.
  // In Ordinary Time the saint's colour now takes the lead accent set and the
  // green steps back to the ground wash and the season chip — as at Mass,
  // where a memorial's vestments are the saint's colour. In the privileged
  // seasons the season still rides primary (pinned above).

  it('St. Martin of Tours (Nov 11, 2026, white, Ordinary Time): the gold family leads, the green only washes the ground', () => {
    const date = new Date('2026-11-11T12:00:00');
    expect(getDayRank(date).rank).toBe('memorial');
    expect(serializable(getSeasonTheme(date, 'men'))).toEqual({
      ...MEN_NEUTRALS,
      // The ground wash is still Ordinary Time green, at ferial strength.
      bgGradient:
        'radial-gradient(ellipse at 18% 0%, rgba(30,107,58,0.20) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(30,107,58,0.12) 0%, transparent 55%), linear-gradient(180deg, #EFEBE2 0%, #E1DDD0 100%)',
      // The accent set is the white palette the feast path uses — gold.
      accent: '#8C6A1F',
      accentBright: '#B08A2E',
      accentDark: '#6B4F15',
      glow: 'rgba(140,106,31,0.20)',
      // The saint leads, so the budget retires his slate.
      secondaryAccent: MEN_SLATE_RETIRED,
      rgba25: 'rgba(140,106,31,0.25)',
      rgba1: 'rgba(140,106,31,1)',
    });
    const women = getSeasonTheme(date, 'women');
    expect(women.accent).toBe('#8C6A1F');
    expect(women.accentBright).toBe('#B08A2E');
    expect(women.accentDark).toBe('#6B4F15');
    expect(women.accentRgba(1)).toBe('rgba(140,106,31,1)');
    expect(women.bgGradient).toContain('rgba(30,107,58,0.20)');
    // Her secondaries retire too — clay to sand, sage to stone-sage.
    expect(women.secondaryAccent).toBe('#C8A184');
    expect(women.tertiaryAccent).toBe('#9AA08E');
  });

  it('a red martyr memorial in Ordinary Time wears red — St. Blaise (Feb 3, 2026)', () => {
    // St. Josaphat (Nov 12) is not on the app's calendar, so the red-martyr
    // case is pinned on St. Blaise, the in-calendar red memorial of
    // Ordinary Time's first half. Same rule, same red family.
    const date = new Date('2026-02-03T12:00:00');
    expect(getDayRank(date).rank).toBe('memorial');
    expect(getDayRank(date).feast?.name).toBe('St. Blaise');
    for (const audience of ['men', 'women'] as const) {
      const t = getSeasonTheme(date, audience);
      expect(t.accent, audience).toBe('#A31F1F');
      expect(t.accentBright, audience).toBe('#C72E2E');
      expect(t.accentDark, audience).toBe('#7E1616');
      expect(t.bgGradient, audience).toContain('rgba(30,107,58,0.20)');
    }
  });

  it('St. Thérèse (Oct 1, 2026) now leads in her white — gold accents over the green ground', () => {
    const date = new Date('2026-10-01T12:00:00');
    for (const audience of ['men', 'women'] as const) {
      const t = getSeasonTheme(date, audience);
      expect(t.accent, audience).toBe('#8C6A1F');
      expect(t.accent, audience).not.toBe('#1E6B3A');
      expect(t.bgGradient, audience).toContain('rgba(30,107,58,0.20)');
    }
    // No longer the ferial's twin.
    expect(serializable(getSeasonTheme(date, 'men'))).not.toEqual(
      serializable(getSeasonTheme(new Date('2026-10-06T12:00:00'), 'men')),
    );
  });

  it('a memorial inside Lent keeps the season in the lead and the secondaries at full strength', () => {
    const date = new Date('2027-02-11T12:00:00'); // Our Lady of Lourdes, in Lent 2027
    expect(getDayRank(date).rank).toBe('memorial');
    const women = getSeasonTheme(date, 'women');
    expect(women.accent).toBe('#5E2A6B'); // Lent violet, not Lourdes blue
    expect(women.secondaryAccent).toBe('#B85C38');
    expect(women.tertiaryAccent).toBe('#7C8A6A');
    const men = getSeasonTheme(date, 'men');
    expect(men.accent).toBe('#5E2A6B');
    expect(men.secondaryAccent).toBe(MEN_SLATE);
  });
});

describe("the daily-quote rotations — his untouched, hers her own", () => {
  it("the men's rotation is the same shelf it always was", () => {
    expect(DAILY_QUOTES).toHaveLength(192);
    expect(DAILY_QUOTES[0]).toEqual({
      text: 'Our hearts are restless until they rest in You.',
      author: 'St. Augustine',
      source: 'Confessions',
    });
    expect(quotesForAudience('men')).toBe(DAILY_QUOTES);
    expect(quotesForAudience('women')).toBe(DAILY_QUOTES_WOMEN);
  });

  it("a men's day resolves exactly as the old arithmetic resolved it", () => {
    for (const iso of ['2026-01-01T12:00:00', '2026-06-15T12:00:00', '2026-12-25T12:00:00', '2027-03-19T12:00:00']) {
      const date = new Date(iso);
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
      expect(quoteForDay(date, 'men')).toBe(DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]);
      expect(quoteForDay(date, 'women')).toBe(DAILY_QUOTES_WOMEN[dayOfYear % DAILY_QUOTES_WOMEN.length]);
    }
  });

  it("every women's entry is attributed, and the named voices are all present", () => {
    for (const q of DAILY_QUOTES_WOMEN) {
      expect(q.text.trim().length, q.author).toBeGreaterThan(0);
      expect(q.author.trim().length).toBeGreaterThan(0);
      expect(q.text.toLowerCase()).not.toContain('brother');
    }
    const authors = DAILY_QUOTES_WOMEN.map((q) => q.author);
    for (const voice of [
      'St. Thérèse of Lisieux',
      'St. Teresa of Avila',
      'St. Catherine of Siena',
      'Julian of Norwich',
      'St. Edith Stein',
      'St. Hildegard of Bingen',
      'St. Monica',
      'St. Elizabeth of the Trinity',
      'Luke 1:45',
      'Proverbs 31:25',
    ]) {
      expect(authors, voice).toContain(voice);
    }
  });

  it('all three quote surfaces read through the audience selector', () => {
    expect(read('../components/DailyQuote.tsx')).toContain('quoteForDay');
    expect(read('../components/ExamenChecklist.tsx')).toContain('quoteForDay');
    expect(read('../components/LectioDivina.tsx')).toContain('quoteForDay');
  });
});
