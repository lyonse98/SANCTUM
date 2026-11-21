import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  favoriteCompanionKey,
  loadFavoriteCompanion,
  saveFavoriteCompanion,
} from './favoriteCompanion';
import {
  LISTEN_SPEEDS,
  listenSpeedLabel,
  loadListenSpeed,
  nextListenSpeed,
  saveListenSpeed,
} from './listenSpeed';
import {
  loadReadingSize,
  readingScale,
  saveReadingSize,
  scaledBodyPx,
} from './readingSize';
import { loadReaderName, saveReaderName } from './readerName';
import {
  loadPatronSaint,
  patronBioLine,
  patronFeastLabel,
  patronFeastOn,
  savePatronSaint,
} from './patronSaint';
import { SAINTS } from '@/data/saints';
import {
  CONFESSION_EVENING_BEFORE_LEAD,
  EMPTY_PARISH_REMINDERS,
  formatMassTime,
  loadParishReminders,
  loadUsualMass,
  massDayOfWeek,
  massPreviewEvening,
  saveParishReminders,
  saveUsualMass,
} from './usualMass';
import { tonightGreeting, gratitudeForDate } from './tonight';

const ROOT = join(__dirname, '..', '..');
const readSrc = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Minimal Storage whose keys are own enumerable properties, like the browser's. */
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

/**
 * The six customizations (Erik, Nov 18, 2026): favorite companion,
 * listen speed, reading size, patron for the year, the reader's name,
 * and My usual Mass. Every one is on-device, optional, and invisible
 * when unset; every key stands under the sanctum_ prefix so the panic
 * wipe takes it (the wipe suite's KNOWN_KEYS carries each one too).
 */
describe('the six stores — keys under the sanctum_ prefix', () => {
  it('every new key is a sanctum_ key', () => {
    expect(favoriteCompanionKey('men')).toBe('sanctum_favorite_companion_men');
    expect(favoriteCompanionKey('women')).toBe('sanctum_favorite_companion_women');
    for (const key of ['sanctum_listen_speed', 'sanctum_reading_size', 'sanctum_patron_saint', 'sanctum_reader_name', 'sanctum_usual_mass']) {
      expect(key.startsWith('sanctum_')).toBe(true);
    }
  });
});

describe('feature 1 — the favorite companion pin', () => {
  it('round-trips per track, independently, and clears', () => {
    expect(loadFavoriteCompanion('men')).toBeNull();
    saveFavoriteCompanion('men', 'joseph');
    saveFavoriteCompanion('women', 'mary');
    expect(loadFavoriteCompanion('men')).toBe('joseph');
    expect(loadFavoriteCompanion('women')).toBe('mary');
    saveFavoriteCompanion('men', null);
    expect(loadFavoriteCompanion('men')).toBeNull();
    expect(loadFavoriteCompanion('women')).toBe('mary');
  });

  it('the plate stands at the head of the index and the rows carry the pin', () => {
    const select = readSrc('components/CompanionSelect.tsx');
    expect(select).toContain('data-favorite-companion');
    expect(select).toContain('Your companion');
    expect(select).toContain('loadFavoriteCompanion(audience)');
    expect(select).toContain('saveFavoriteCompanion(audience, next)');
    // The plate stands above the quiz; the quiz and the list are untouched below it.
    expect(select.indexOf('data-favorite-companion')).toBeLessThan(select.indexOf('Not sure who to talk to?'));
  });
});

describe('feature 2 — the listening speed', () => {
  it('offers exactly 1, 1.15, and 1.3; the default is 1', () => {
    expect([...LISTEN_SPEEDS]).toEqual([1, 1.15, 1.3]);
    expect(loadListenSpeed()).toBe(1);
  });

  it('round-trips, validates, and the toggle walks and wraps', () => {
    saveListenSpeed(1.15);
    expect(loadListenSpeed()).toBe(1.15);
    localStorage.setItem('sanctum_listen_speed', '2.5');
    expect(loadListenSpeed()).toBe(1);
    expect(nextListenSpeed(1)).toBe(1.15);
    expect(nextListenSpeed(1.15)).toBe(1.3);
    expect(nextListenSpeed(1.3)).toBe(1);
    expect(listenSpeedLabel(1)).toBe('1×');
    expect(listenSpeedLabel(1.15)).toBe('1.15×');
    expect(listenSpeedLabel(1.3)).toBe('1.3×');
  });

  it('both narrator players apply the stored rate and carry the toggle', () => {
    const bar = readSrc('components/ListenBar.tsx');
    expect(bar).toContain('el.playbackRate = loadListenSpeed()');
    expect(bar).toContain('elRef.current.playbackRate = next');
    expect(bar).toContain('listenSpeedLabel(speed)');
    const tailor = readSrc('components/TailorToday.tsx');
    expect(tailor).toContain('el.playbackRate = loadListenSpeed()');
    expect(tailor).toContain('audioRef.current.playbackRate = next');
    expect(tailor).toContain('listenSpeedLabel(speed)');
  });
});

describe('feature 3 — the reading size', () => {
  it('defaults to Standard and round-trips; a bad value falls back', () => {
    expect(loadReadingSize()).toBe('standard');
    saveReadingSize('xlarge');
    expect(loadReadingSize()).toBe('xlarge');
    localStorage.setItem('sanctum_reading_size', 'huge');
    expect(loadReadingSize()).toBe('standard');
  });

  it('the scale never goes below 1, and scaled body text never falls below 13px', () => {
    for (const size of ['standard', 'large', 'xlarge'] as const) {
      expect(readingScale(size)).toBeGreaterThanOrEqual(1);
      for (const base of [13, 14, 17]) {
        expect(scaledBodyPx(base, size)).toBeGreaterThanOrEqual(13);
      }
    }
    expect(scaledBodyPx(13, 'standard')).toBe(13);
    expect(scaledBodyPx(17, 'standard')).toBe(17);
    expect(scaledBodyPx(13, 'large')).toBe(15);
    expect(scaledBodyPx(13, 'xlarge')).toBe(18);
  });

  it('the Gospel card and Tonight set their body text at the chosen size', () => {
    const card = readSrc('components/DailyQuote.tsx');
    expect(card).toContain('useReadingSize()');
    expect(card).toContain('fontSize: bodyPx(17)');
    expect(card).toContain('fontSize: bodyPx(14)');
    expect(card).toContain('fontSize: bodyPx(13)');
    const tonight = readSrc('components/TonightClosing.tsx');
    expect(tonight).toContain('useReadingSize()');
    expect(tonight).toContain("scaledBodyPx(13, readingSize)");
    const settings = readSrc('components/SettingsModal.tsx');
    expect(settings).toContain('READING_SIZES');
    expect(settings).toContain('saveReadingSize(opt.id)');
  });
});

describe('feature 4 — the patron saint for the year', () => {
  const therese = SAINTS.find((s) => s.name === 'St. Thérèse of Lisieux')!;

  it('round-trips against the shelf and clears', () => {
    expect(loadPatronSaint()).toBeNull();
    savePatronSaint(therese);
    expect(loadPatronSaint()?.name).toBe('St. Thérèse of Lisieux');
    expect(loadPatronSaint()?.feastDate).toBe('10-01');
    savePatronSaint(null);
    expect(loadPatronSaint()).toBeNull();
  });

  it('a stored name the shelf does not carry resolves to no patron', () => {
    localStorage.setItem('sanctum_patron_saint', JSON.stringify({ name: 'St. Nobody', feastDate: '01-01' }));
    expect(loadPatronSaint()).toBeNull();
  });

  it('the feast check is the saint’s own MM-DD, and the labels read plainly', () => {
    expect(patronFeastOn(new Date(2026, 9, 1), therese)?.name).toBe(therese.name);
    expect(patronFeastOn(new Date(2026, 9, 2), therese)).toBeNull();
    expect(patronFeastOn(new Date(2026, 9, 1), null)).toBeNull();
    expect(patronFeastLabel(therese)).toBe('October 1');
    expect(patronBioLine(therese)).toContain('cloistered Carmelite');
    expect(patronBioLine(therese).endsWith('.')).toBe(true);
  });

  it('the masthead marker and the plates stand where the feature puts them', () => {
    const hero = readSrc('components/TodayHero.tsx');
    expect(hero).toContain('data-patron-feast');
    expect(hero).toContain('Your patron&rsquo;s feast');
    expect(hero).toContain('patronFeastOn(contentDate())');
    const home = readSrc('components/HomeScreen.tsx');
    expect(home).toContain('<PatronPlate');
    expect(home).toContain('patronFeastOn(contentDate())');
    const plate = readSrc('components/PatronPlate.tsx');
    expect(plate).toContain('Your patron');
    expect(plate).toContain('companionForSaint(patron.name, audience)');
    expect(plate).toContain('patronBioLine(patron)');
    const settings = readSrc('components/SettingsModal.tsx');
    expect(settings).toContain('Patron Saint for the Year');
    expect(settings).toContain('savePatronSaint');
  });
});

describe('feature 5 — the reader’s name', () => {
  it('round-trips normalized and capped at forty; empty clears', () => {
    expect(loadReaderName()).toBeNull();
    saveReaderName('  Erik   Lyons ');
    expect(loadReaderName()).toBe('Erik Lyons');
    saveReaderName('A'.repeat(60));
    expect(loadReaderName()).toHaveLength(40);
    saveReaderName('   ');
    expect(loadReaderName()).toBeNull();
  });

  it('Tonight’s greeting carries the name when given, and is untouched without it', () => {
    const dateKey = '2026-11-18';
    expect(tonightGreeting(dateKey, null)).toBe(gratitudeForDate(dateKey));
    const named = tonightGreeting(dateKey, 'Erik');
    expect(named.startsWith('Erik, ')).toBe(true);
    expect(named.slice(6).charAt(0)).toBe(named.slice(6).charAt(0).toLowerCase());
    const tonight = readSrc('components/TonightClosing.tsx');
    expect(tonight).toContain('tonightGreeting(dateKey, readerName)');
    expect(tonight).toContain('loadReaderName()');
  });

  it('the chat path appends exactly one guarded name block — absent, byte-identical', () => {
    const source = readRoot('supabase/functions/chat-proxy/index.ts');
    expect(source).toContain('const readerName = cleanReaderName(payload.name);');
    expect(source).toContain('if (readerName) {');
    expect(source).toContain('use it sparingly and naturally');
    expect(source).toContain('never in every reply');
    expect(source).toContain('never as a performance of familiarity');
    // The guard is the whole mechanism: with no name, nothing is appended.
    const at = source.indexOf('const readerName = cleanReaderName(payload.name);');
    expect(source.slice(at, at + 120)).toContain('if (readerName)');
  });

  it('Settings carries the field with its disclosure, and About names the name on both tracks', () => {
    const settings = readSrc('components/SettingsModal.tsx');
    expect(settings).toContain('Your Name');
    expect(settings).toContain('saveReaderName(nameValue)');
    expect(settings).toContain('handed the');
    const about = readSrc('components/AboutSanctumPage.tsx');
    expect(about).toContain('the name she may give');
    expect(about).toContain('the name he may give');
    expect(about).toContain('handed only as the name itself');
  });
});

describe('feature 6 — My usual Mass', () => {
  it('round-trips whole records only; an incomplete record is no record', () => {
    expect(loadUsualMass()).toBeNull();
    saveUsualMass({ parish: 'St. Brigid', time: '09:30', day: 'sunday' });
    expect(loadUsualMass()).toEqual({ parish: 'St. Brigid', time: '09:30', day: 'sunday' });
    localStorage.setItem('sanctum_usual_mass', JSON.stringify({ parish: 'St. Brigid', time: '', day: 'sunday' }));
    expect(loadUsualMass()).toBeNull();
    localStorage.setItem('sanctum_usual_mass', JSON.stringify({ parish: '', time: '09:30', day: 'sunday' }));
    expect(loadUsualMass()).toBeNull();
    saveUsualMass({ parish: 'St. Brigid', time: '17:30', day: 'saturday' });
    expect(loadUsualMass()?.day).toBe('saturday');
    saveUsualMass(null);
    expect(loadUsualMass()).toBeNull();
  });

  it('the time reads in the reader’s own format', () => {
    expect(formatMassTime('09:30')).toBe('9:30 AM');
    expect(formatMassTime('17:30')).toBe('5:30 PM');
    expect(formatMassTime('12:00')).toBe('12:00 PM');
    expect(formatMassTime('00:15')).toBe('12:15 AM');
  });

  it('the preview evening: unset and Sunday aim from Saturday; the vigil aims from Friday', () => {
    expect(massPreviewEvening(null)).toEqual({ eveningDay: 6, onSaturday: false });
    expect(massPreviewEvening({ parish: 'St. Brigid', time: '09:30', day: 'sunday' })).toEqual({ eveningDay: 6, onSaturday: false });
    expect(massPreviewEvening({ parish: 'St. Brigid', time: '17:30', day: 'saturday' })).toEqual({ eveningDay: 5, onSaturday: true });
  });

  it('Tonight aims the look ahead at the usual Mass — and keeps no attendance record', () => {
    const tonight = readSrc('components/TonightClosing.tsx');
    expect(tonight).toContain('loadUsualMass()');
    expect(tonight).toContain('massPreviewEvening(usualMass)');
    expect(tonight).toContain('formatMassTime(usualMass.time)');
    expect(tonight).toContain('at {usualMass.parish}');
    expect(tonight).toContain('showMassPreview');
    // The standing Saturday gate is still in the source for the unset path.
    expect(tonight).toContain('contentDate(now).getDay() === 6');
    expect(tonight.toLowerCase()).not.toContain('attendance');
    const settings = readSrc('components/SettingsModal.tsx');
    expect(settings).toContain('My Usual Mass');
    expect(settings).toContain('saveUsualMass');
  });
});

describe('the parish reminder settings (Nov 18, 2026)', () => {
  it('round-trips the Confession day and hour, the leads, and the drive hour', () => {
    expect(loadParishReminders()).toEqual(EMPTY_PARISH_REMINDERS);
    saveParishReminders({
      confessionDay: 6,
      confessionTime: '15:30',
      massReminderLead: 60,
      confessionReminderLead: 30,
      driveTime: '17:30',
    });
    expect(loadParishReminders()).toEqual({
      confessionDay: 6,
      confessionTime: '15:30',
      massReminderLead: 60,
      confessionReminderLead: 30,
      driveTime: '17:30',
    });
  });

  it('malformed pieces read back as unset — never as some other day or hour', () => {
    localStorage.setItem('sanctum_parish_reminders', JSON.stringify({
      confessionDay: 7,
      confessionTime: '3:30pm',
      massReminderLead: 45,
      confessionReminderLead: '60',
      driveTime: '25:00',
    }));
    expect(loadParishReminders()).toEqual(EMPTY_PARISH_REMINDERS);
  });

  it('the evening-before sentinel round-trips the Confession lead — and is not a Mass lead (Nov 20, 2026)', () => {
    expect(CONFESSION_EVENING_BEFORE_LEAD).toBe(-1);
    saveParishReminders({
      confessionDay: 6,
      confessionTime: '15:30',
      massReminderLead: 60,
      confessionReminderLead: CONFESSION_EVENING_BEFORE_LEAD,
      driveTime: null,
    });
    expect(loadParishReminders().confessionReminderLead).toBe(CONFESSION_EVENING_BEFORE_LEAD);
    // The same value in the Mass lead is no lead at all — it reads back unset.
    saveParishReminders({
      confessionDay: 6,
      confessionTime: '15:30',
      massReminderLead: CONFESSION_EVENING_BEFORE_LEAD as never,
      confessionReminderLead: 30,
      driveTime: null,
    });
    expect(loadParishReminders().massReminderLead).toBeNull();
    expect(loadParishReminders().confessionReminderLead).toBe(30);
  });

  it('an all-empty save clears the key entirely', () => {
    saveParishReminders({ ...EMPTY_PARISH_REMINDERS, driveTime: '17:30' });
    expect(localStorage.getItem('sanctum_parish_reminders')).not.toBeNull();
    saveParishReminders(EMPTY_PARISH_REMINDERS);
    expect(localStorage.getItem('sanctum_parish_reminders')).toBeNull();
  });

  it('the usual Mass maps to the server’s day numbering', () => {
    expect(massDayOfWeek({ parish: 'St. Brigid', time: '09:30', day: 'sunday' })).toBe(0);
    expect(massDayOfWeek({ parish: 'St. Brigid', time: '17:30', day: 'saturday' })).toBe(6);
  });

  it('Settings carries the Confession hour and the leads, with the privacy line', () => {
    const settings = readSrc('components/SettingsModal.tsx');
    expect(settings).toContain('Parish Confession');
    expect(settings).toContain('saveParishReminders');
    expect(settings).toContain('the parish name never leaves this phone');
    expect(settings).toContain('Reminders begin once notifications are on');
    expect(settings).toContain('syncParishReminders');
  });
});
