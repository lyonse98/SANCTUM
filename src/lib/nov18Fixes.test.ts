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
 *    wear a bordered button's frame.
 * 5. The Tailor profile is editable from Settings — one entry, the
 *    same editor, the same store.
 */

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const more = readSrc('components/MoreOfSanctum.tsx');
const hero = readSrc('components/TodayHero.tsx');
const card = readSrc('components/DailyQuote.tsx');
const tailor = readSrc('components/TailorToday.tsx');
const settings = readSrc('components/SettingsModal.tsx');
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
  const buttonOf = (src: string) => {
    const start = src.indexOf('data-challenge-lived-button');
    return src.slice(src.lastIndexOf('<button', start), src.indexOf('</button>', start));
  };

  it('the daily challenge\u2019s mark wears a bordered button\u2019s frame', () => {
    const button = buttonOf(card);
    expect(button).toContain('border: `1px solid ${t.border}`');
    expect(button).toContain('backgroundColor: `${t.border}1F`');
    expect(button).toContain('px-3 py-1.5');
    expect(button).toContain('I did this');
    expect(button).toContain('onClick={markDailyChallengeLived}');
  });

  it('the Tailor challenge\u2019s mark wears the same frame', () => {
    const button = buttonOf(tailor);
    expect(button).toContain('border: `1px solid ${t.border}`');
    expect(button).toContain('backgroundColor: `${t.border}1F`');
    expect(button).toContain('px-3 py-1.5');
    expect(button).toContain('I did this');
    expect(button).toContain('onClick={markTailorChallengeLived}');
  });

  it('the lived state and its undo are unchanged', () => {
    expect(card).toContain('This one was lived.');
    expect(tailor).toContain('This one was lived.');
    expect(card).toContain('onClick={unmarkDailyChallengeLived}');
    expect(tailor).toContain('onClick={unmarkTailorChallengeLived}');
  });
});

describe('fix 5 — the Tailor profile is editable from Settings', () => {
  it('Settings carries the entry, one tap out', () => {
    expect(settings).toContain('data-edit-tailor-profile');
    expect(settings).toContain('Edit Tailor profile');
    expect(settings).toContain('onEditTailorProfile');
    // The erase still stands, behind its has-profile guard.
    expect(settings).toContain('Erase Tailor profile');
    expect(settings).toContain('tailorProfileExists &&');
  });

  it('the shell routes the request to Today\u2019s Gospel card', () => {
    expect(app).toContain('onEditTailorProfile={() => { setSettingsOpen(false); setView(\'today\'); setTailorProfileOpen(true); }}');
    expect(app).toContain('tailorProfileOpen={tailorProfileOpen}');
    expect(app).toContain('onConsumeTailorProfileOpen={() => setTailorProfileOpen(false)}');
    expect(home).toContain('tailorProfileOpen={tailorProfileOpen}');
    expect(home).toContain('onConsumeTailorProfileOpen={onConsumeTailorProfileOpen}');
  });

  it('the card opens the Tailor panel and passes the request to the one editor', () => {
    expect(card).toContain("setPanel('tailor')");
    expect(card).toContain('profileOpenSignal={profileOpenSignal}');
    expect(card).toContain('onConsumeTailorProfileOpen?.()');
    // The editor it opens is TailorToday's own — the same component
    // that renders the intake's editor, bound to the same store.
    expect(tailor).toContain('profileOpenSignal');
    expect(tailor).toContain('if (profileOpenSignal > 0) setProfileOpen(true)');
    expect(tailor).toContain('<TailorProfileEditor t={t} audience={audience} onSaved={setProfile} />');
    expect(tailor).toContain('loadTailorProfile');
    expect(tailor).toContain('saveTailorProfile');
  });
});
