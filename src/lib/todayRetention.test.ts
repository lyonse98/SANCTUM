import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MASS_INTENTION_PREFIX,
  loadMassIntention,
  massIntentionKey,
  saveMassIntention,
  sundayCelebrationName,
} from '../components/TonightClosing';

/**
 * The Today/Tonight retention plays (Builder C, Nov 16, 2026): Play 4's
 * findable AM→PM loop, Play 5's arc lines, and Play 8's Saturday look
 * ahead. Unit tests cover the Saturday helpers; the rest are source pins
 * in the house style, so a later edit cannot quietly unwire a door, a
 * cue, or a tally call.
 */

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const home = read('components/HomeScreen.tsx');
const app = read('App.tsx');
const tailor = read('components/TailorToday.tsx');
const tailorPm = read('components/TailorPm.tsx');
const tonight = read('components/TonightClosing.tsx');

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

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
});

describe('Play 4 — the AM→PM loop is findable, and both halves count the day', () => {
  it('Today itself carries a Tailor door into the existing flow', () => {
    // Deliberate change (Erik, Nov 18, 2026, evening): the Tailor door
    // lives on the Gospel card again — restored beside Reflect after
    // the morning dedupe moved it to a plate in Today's stack — and
    // the stack plate is gone, so the card door is once more Tailor's
    // ONE entry on Today, not the second of two.
    const card = read('components/DailyQuote.tsx');
    expect(card).toContain('data-tile="tailor"');
    expect(card).toContain("panel === 'tailor'");
    expect(card).toContain('<TailorToday t={t} audience={audience} dateKey={readings.date} startOpen profileOpenSignal={profileOpenSignal} onReflectWithCompanion={onReflectWithCompanion ? handleReflectTailoredWithCompanion : undefined} />');
    expect(home).not.toContain('data-tailor-entry');
    expect(home).not.toContain('<TailorToday');
    expect(home).toContain('contentDateKey()');
  });

  it('the card\u2019s Tailor door never swaps — Close the day lives only in Tonight', () => {
    // Reversal (Erik, Nov 18, 2026, later that evening): an evening
    // swap that turned the card's Tailor door into "Close the day"
    // after 17:00 was reverted the same night. A first-time arrival
    // at night must still find the Tailor devotional, and there is
    // exactly ONE "Close the day" surface — Tonight's PM plate. The
    // door is Tailor at every hour; the card mounts no TailorPm.
    const card = read('components/DailyQuote.tsx');
    expect(card).not.toContain('TailorPm');
    expect(card).not.toContain('tailorDoorIsClose');
    expect(card).not.toContain("panel === 'close'");
    expect(card).not.toContain('For your evening');
    expect(card).toContain("setPanel((p) => (p === 'tailor' ? 'none' : 'tailor'))");
    // Tonight's own PM plate stands untouched — the one Close the day.
    expect(tonight).toContain('<TailorPm t={t} audience={audience} dateKey={dateKey} morning={tailorMeta.morning} />');
  });

  it('a completed Tailor build records the tailor act; a completed close records tonight', () => {
    expect(tailor).toContain("recordCoreAct('tailor')");
    expect(tailorPm).toContain("recordCoreAct('tonight')");
    // Tonight's own resolve, written in the user's hand, counts the day too.
    expect(tonight).toContain("recordCoreAct('tonight')");
    expect(tonight).toContain('if (value.trim())');
  });

  it('the evening cue stands in Tonight when a morning record awaits its close', () => {
    expect(tonight).toContain('data-evening-cue');
    expect(tonight).toContain('readTailorMeta(contentKey, audience)');
    expect(tonight).toContain('loadTonightsClose(contentKey, audience)');
    expect(tonight).toContain('cueMeta?.morning');
    expect(tonight).toContain('showEveningCue');
    expect(tonight).toContain('This morning you tailored');
    // In-app only: the cue's file sends nothing and schedules nothing.
    expect(tonight).not.toContain('Notification');
  });
});

describe('Play 5 — the arc lines on Today', () => {
  it('the novena line names the arc and walks to the Novenas section', () => {
    expect(home).toContain("from '@/lib/novenaProgress'");
    expect(home).toContain('currentNovenaArc()');
    expect(home).toContain('data-novena-arc');
    expect(home).toContain('day {novenaArc.dayCount} of 9');
    expect(home).toContain('onOpenNovenas');
    // The shell routes it the way every Pray-door landing routes: tab + section.
    expect(app).toContain("setChurchTab('pray'); setChurchPray('novenas'); setView('church')");
    expect(app).toContain('onOpenNovenas=');
  });

  it('the Advent line stands in the same quiet area, from the season lib', () => {
    expect(home).toContain("from '@/lib/seasonArcs'");
    expect(home).toContain('adventProgress(contentDate())');
    expect(home).toContain('data-advent-arc');
    expect(home).toContain('Advent &middot; day {advent.day} of {advent.totalDays}');
    expect(home).toContain('data-in-progress');
  });
});

describe('Play 8 — Saturday’s Tomorrow at Mass', () => {
  it('the block is gated on the content day’s Saturday, aimed at its Sunday', () => {
    expect(tonight).toContain('data-tomorrow-at-mass');
    expect(tonight).toContain('contentDate(now).getDay() === 6');
    expect(tonight).toContain('shiftDateKey(contentKey, 1)');
    expect(tonight).toContain('Tomorrow at Mass');
  });

  it('Sunday’s name and Gospel come from the calendar and the by-date readings path', () => {
    expect(tonight).toContain("from '@/data/feastDays'");
    expect(tonight).toContain('getFeastForDate(sunday)');
    expect(tonight).toContain('fetchDailyReadings(sundayDate)');
    expect(tonight).toContain('fetchPassageVerses(readings.gospel)');
    expect(tonight).toContain('pickKeyVerse(verses)');
  });

  it('the intention is one on-device line under a sanctum_ key named by the Sunday', () => {
    expect(tonight).toContain('Bring to Mass tomorrow:');
    expect(MASS_INTENTION_PREFIX).toBe('sanctum_mass_intention_');
    expect(massIntentionKey('2026-11-22')).toBe('sanctum_mass_intention_2026-11-22');
    saveMassIntention('2026-11-22', '  For Anna, and for Leo.  ');
    expect(loadMassIntention('2026-11-22')).toBe('For Anna, and for Leo.');
    expect(loadMassIntention('2026-11-29')).toBe('');
    saveMassIntention('2026-11-22', '   ');
    expect(loadMassIntention('2026-11-22')).toBe('');
    // The stored value is the plain note itself — no record rides with it.
    saveMassIntention('2026-11-22', 'For my father.');
    expect(localStorage.getItem(massIntentionKey('2026-11-22'))).toBe('For my father.');
  });

  it('nothing in the block keeps any record of the day itself', () => {
    expect(tonight.toLowerCase()).not.toContain('attendance');
    expect(tonight).not.toContain('didAttend');
    expect(tonight).not.toContain('wentToMass');
  });

  it('the Mass entry stands in its Real Help words, with the way onward', () => {
    expect(tonight).toContain("from '@/lib/realHelp'");
    expect(tonight).toContain("s.id === 'mass'");
    expect(tonight).toContain('massSection.title');
    expect(tonight).toContain('massSection.tagline');
    expect(tonight).toContain('data-mass-entry');
    expect(tonight).toContain('Real Help · Mass');
    expect(home).toContain('<TonightClosing t={seasonTheme} audience={audience} onOpenHelp={onOpenHelp} />');
  });

  it('Sunday’s name: the calendar first, the lectionary next, the season last', () => {
    // Nov 29, 2026 — the First Sunday of Advent, named by the season fallback.
    expect(sundayCelebrationName(new Date(2026, 10, 29))).toBe('First Sunday of Advent');
    expect(sundayCelebrationName(new Date(2026, 11, 6))).toBe('Second Sunday of Advent');
    // Dec 13, 2026 — the calendar's own name for the third Sunday wins.
    expect(sundayCelebrationName(new Date(2026, 11, 13))).toBe('Gaudete Sunday');
    // Nov 22, 2026 — Christ the King, from the feast table.
    expect(sundayCelebrationName(new Date(2026, 10, 22))).toBe('Christ the King');
    // An ordinary Sunday: the lectionary's celebration when supplied…
    expect(sundayCelebrationName(new Date(2026, 10, 15), '33rd Sunday in Ordinary Time')).toBe(
      '33rd Sunday in Ordinary Time',
    );
    // …and the season's plain name when it is not.
    expect(sundayCelebrationName(new Date(2026, 10, 15))).toBe('Sunday in Ordinary Time');
  });
});
