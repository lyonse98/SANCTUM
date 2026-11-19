import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFeastForDate } from '@/data/feastDays';
import { getDailyVisual } from '@/lib/liturgicalVisuals';

/**
 * The Nov 18, 2026 evening fixes (Erik, five rulings):
 *
 * 1. "Bring someone home" must read as a button — the come-home entry
 *    under More of Sanctum now wears the same ruled plate as the three
 *    destinations, not a bare text line.
 * 2. Optional memorials stand nowhere on Today's default face — the
 *    masthead reads as a ferial day's, the Gospel card's header line is
 *    silent, and the day is named only inside the expanded readings
 *    (and in the spoken program, untouched here).
 * 3. The Gospel card's Tailor door is restored beside Reflect and
 *    the stack plate is gone. An evening swap (the door becoming
 *    "Close the day" after 17:00) shipped with this batch and was
 *    REVERTED the same night at Erik's ruling — the door is Tailor
 *    at every hour, and "Close the day" lives only in Tonight. The
 *    reverted state is pinned below and in todayRetention.test.ts.
 * 4. "I did this" must read as a button — both challenge marks now
 *    wear a bordered button's frame. (Placement reversed Nov 19,
 *    2026: the marks live in Tonight now — see the fix 4 pins.)
 * 5. The Tailor profile is editable from Settings — one entry, the
 *    same editor, the same store. (Deepened Nov 19, 2026: the editor
 *    stands inside the Settings sheet now — see the fix 5 pins.)
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const more = readSrc('components/MoreOfSanctum.tsx');
const hero = readSrc('components/TodayHero.tsx');
const card = readSrc('components/DailyQuote.tsx');
const tailor = readSrc('components/TailorToday.tsx');
const settings = readSrc('components/SettingsModal.tsx');
const tonight = readSrc('components/TonightClosing.tsx');
const app = readSrc('App.tsx');
const home = readSrc('components/HomeScreen.tsx');

describe('fix 1 — Bring someone home reads as a button', () => {
  it('the entry wears the shared plate class, like the destinations', () => {
    const start = more.indexOf('data-bring-someone-home');
    const button = more.slice(more.lastIndexOf('<button', start), more.indexOf('</button>', start));
    expect(button).toContain('className={ROW_CLASS}');
    expect(button).toContain('border: `1px solid ${t.border}`');
    expect(button).toContain('backgroundColor: `${t.border}1F`');
    expect(button).toContain('ChevronRight');
  });

  it('the bare text-line styling is gone', () => {
    expect(more).not.toContain('block w-full text-center mt-3 py-1');
  });

  it('the tap still opens the same sheet', () => {
    expect(more).toContain('onClick={onBringSomeoneHome}');
    expect(home).toContain('onBringSomeoneHome={() => setComeHomeSheetOpen(true)}');
    expect(home).toContain('<BringSomeoneHome');
  });

  it('the row spans are overflow-proofed — the hint truncates inside the plate', () => {
    // Erik's field report (Nov 18, 2026, later that evening): the
    // bring plate's text spilled past its border on mobile — label,
    // hint, and chevron were all flex-shrink-0, ~394px of
    // unshrinkable content on a ~360px screen, while the three
    // destination rows fit only because their words are shorter.
    const start = more.indexOf('data-bring-someone-home');
    const button = more.slice(more.lastIndexOf('<button', start), more.indexOf('</button>', start));
    // The bring plate's hint ellipsizes before anything can spill.
    expect(button).toContain('text-[12px] italic min-w-0 truncate');
    expect(button).not.toContain('italic flex-shrink-0');
    // The label is the anchor: min-w-0 + truncate, second line of defense.
    expect(button).toContain('text-[15px] font-semibold min-w-0 truncate');
    expect(button).not.toContain('font-semibold flex-shrink-0');
    // The dotted leader keeps a floor and never collapses to nothing.
    expect(button).toContain('flex-1 min-w-[16px]');
    // The three destination rows wear the same spans (the entries map).
    expect(more.split('text-[12px] italic min-w-0 truncate')).toHaveLength(3);
    expect(more.split('text-[15px] font-semibold min-w-0 truncate')).toHaveLength(3);
    expect(more.split('flex-1 min-w-[16px]')).toHaveLength(3);
  });
});

describe('fix 2 — optional memorials stand nowhere on Today\u2019s default face', () => {
  it('the calendar data the pins lean on: Juan Diego is optional, Cabrini is obligatory', () => {
    expect(getFeastForDate(new Date(2026, 11, 9, 12))?.name).toBe('St. Juan Diego');
    expect(getFeastForDate(new Date(2026, 11, 9, 12))?.rank).toBe('optional-memorial');
    expect(getFeastForDate(new Date(2026, 10, 13, 12))?.rank).toBe('memorial');
    // The visual layer still resolves the optional day (palette, rank) —
    // only the naming leaves the face.
    const visual = getDailyVisual(new Date(2026, 11, 9, 12));
    expect(visual.feastRank).toBe('optional-memorial');
    expect(visual.feastName).toBe('St. Juan Diego');
  });

  it('the masthead line falls back to the season\u2019s description on an optional memorial', () => {
    expect(hero).toContain("visual.feastRank === 'optional-memorial' ? season.description");
    expect(hero).toContain('{mastheadNote}');
    // The naming survives for every other rank — the fallback is the
    // feast note first, exactly as before.
    expect(hero).toContain('visual.feastNote ?? season.description');
  });

  it('the Gospel card\u2019s header line is silent on an optional memorial', () => {
    expect(card).toContain("feast?.rank !== 'optional-memorial'");
    expect(card).toContain('readings.celebration');
  });

  it('the expanded readings name the day, at their head, in the feast\u2019s own name', () => {
    expect(card).toContain('data-optional-memorial-line');
    expect(card).toContain("feast?.rank === 'optional-memorial'");
    expect(card).toContain('{feastRankLabel(feast.rank)} of {feast.name}');
    expect(card.indexOf('data-optional-memorial-line')).toBeGreaterThan(card.indexOf('{expanded && readings &&'));
    expect(card.indexOf('data-optional-memorial-line')).toBeLessThan(card.indexOf('loadingAll && !allTexts'));
  });

  it('the spoken program is untouched — narratorCore keeps its feast table', () => {
    const narrator = readSrc('lib/narratorCore.ts');
    expect(narrator).toContain('FIXED_FEASTS');
  });
});

describe('fix 3 — the Tailor door restored; the evening swap REVERTED', () => {
  // The swap shipped with this batch and was reverted the same night
  // at Erik's ruling: a first-time arrival at night must still find
  // the Tailor devotional, and "Close the day" has exactly one
  // surface — the PM plate inside Tonight. The helper
  // (tailorDoorIsClose) and its unit tests are gone with the swap.
  it('the card door is Tailor at every hour — no swap state, no PM mount', () => {
    expect(card).not.toContain('tailorDoorIsClose');
    expect(card).not.toContain('TailorPm');
    expect(card).not.toContain('For your evening');
    expect(card).toContain("setPanel((p) => (p === 'tailor' ? 'none' : 'tailor'))");
    expect(card).toContain("panel === 'tailor'");
  });

  it('the helper is gone from the PM lib; the PM record logic stands', () => {
    const pm = readSrc('lib/tailorPm.ts');
    expect(pm).not.toContain('tailorDoorIsClose');
    expect(pm).not.toContain('TAILOR_DOOR_PM_HOUR');
    expect(pm).toContain('loadTonightsClose');
    expect(pm).toContain('buildCloseOfDay');
  });
});

describe('fix 4 — "I did this" reads as a button, in both challenges', () => {
  // Placement REVERSED (Erik, Nov 19, 2026): the mark no longer
  // stands under the morning's challenges at all — it lives in
  // Tonight, at the day's close, and only on days the user prayed
  // with the app in the morning. What survives of this fix is the
  // button's frame, carried into Tonight unchanged; what changed
  // is where — and when — the mark stands.
  const buttonOf = (src: string) => {
    const start = src.indexOf('data-challenge-lived-button');
    return src.slice(src.lastIndexOf('<button', start), src.indexOf('</button>', start));
  };

  it('the marks are gone from the morning surfaces', () => {
    expect(card).not.toContain('data-challenge-lived-button');
    expect(tailor).not.toContain('data-challenge-lived-button');
    expect(card).not.toContain('markDailyChallengeLived');
    expect(tailor).not.toContain('markTailorChallengeLived');
    expect(card).not.toContain('This one was lived.');
    expect(tailor).not.toContain('This one was lived.');
  });

  it('the mark stands in Tonight, wearing the same bordered frame', () => {
    const button = buttonOf(tonight);
    expect(button).toContain('border: `1px solid ${t.border}`');
    expect(button).toContain('backgroundColor: `${t.border}1F`');
    expect(button).toContain('px-3 py-1.5');
    expect(button).toContain('I did this');
  });

  it('both challenges are marked from Tonight, against the same journal', () => {
    expect(tonight).toContain('livedMark(dailyLived, markDailyChallengeLived, unmarkDailyChallengeLived)');
    expect(tonight).toContain('livedMark(tailorLived, markTailorChallengeLived, unmarkTailorChallengeLived)');
    expect(tonight).toContain('This one was lived.');
    expect(tonight).toContain("source: 'daily'");
    expect(tonight).toContain("source: 'tailor'");
    expect(tonight).toContain('markChallengeLived');
    expect(tonight).toContain('unmarkChallengeLived');
  });

  it('the gate is the morning\u2019s prayer: a Tailor morning record, or the day already counted', () => {
    expect(tonight).toContain('Boolean(tailorMeta?.morning) || loadDaysPrayedDates().includes(dateKey)');
    expect(tonight).toContain('morningPrayed && livedMark(dailyLived');
    expect(tonight).toContain('morningPrayed && tailoredPkg');
  });
});

describe('fix 5 — the Tailor profile is editable from Settings', () => {
  // Deepened (Erik, Nov 19, 2026): editing no longer routes out to
  // Today's Tailor panel — the same editor stands inside the
  // Settings sheet itself, expanding under its card, with a Done
  // that folds it away. The one-shot road (Settings → App →
  // HomeScreen → Gospel card → panel nonce) is gone with the
  // behavior it served. The erase stands where it stood, behind
  // its has-profile guard.
  it('Settings carries the entry and the editor, in the sheet', () => {
    expect(settings).toContain('data-edit-tailor-profile');
    expect(settings).toContain('Edit Tailor profile');
    expect(settings).toContain('<TailorProfileEditor');
    expect(settings).toContain('setProfileEditorOpen');
    // The erase still stands, behind its has-profile guard.
    expect(settings).toContain('Erase Tailor profile');
    expect(settings).toContain('tailorProfileExists &&');
  });

  it('the editor is TailorToday\u2019s own, exported — one editor, one store', () => {
    expect(tailor).toContain('export function TailorProfileEditor');
    expect(tailor).toContain('<TailorProfileEditor t={t} audience={audience} onSaved={setProfile} />');
    expect(tailor).toContain('loadTailorProfile');
    expect(tailor).toContain('saveTailorProfile');
  });

  it('the route-out plumbing is gone, end to end', () => {
    expect(settings).not.toContain('onEditTailorProfile');
    expect(app).not.toContain('onEditTailorProfile');
    expect(app).not.toContain('tailorProfileOpen');
    expect(home).not.toContain('tailorProfileOpen');
    expect(card).not.toContain('tailorProfileOpen');
    expect(card).not.toContain('profileOpenSignal');
    expect(tailor).not.toContain('profileOpenSignal');
    // The card's own Tailor door is untouched by the removal.
    expect(card).toContain("setPanel('tailor')");
  });
});
