import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FIRST_VALUE_KEY,
  LISTEN_REMINDER_PROMPTED_KEY,
  REMINDER_DISMISS_WINDOW_MS,
  REMINDER_PROMPT_DISMISSED_KEY,
  formatReminderTime,
  listenReminderLineDue,
  reminderCardState,
  reminderSummaryLine,
} from './reminderCard';
import type { PushReminderState } from './push';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, 'src', rel), 'utf8');

const UNSET: PushReminderState = {
  enabled: false,
  endpoint: '',
  focus: 'gospel',
  localTime: '07:00',
  tz: 'America/Los_Angeles',
  audience: 'men',
};
const SET: PushReminderState = { ...UNSET, enabled: true, endpoint: 'https://push.example/x', focus: 'rosary' };

const NOW = 1_800_000_000_000;

describe('the reminder card — three states', () => {
  it('a set reminder collapses the card to its quiet line, whatever the dismiss state', () => {
    expect(reminderCardState(SET, null, NOW, true)).toBe('set');
    expect(reminderCardState(SET, NOW, NOW, true)).toBe('set');
  });

  it('a set reminder shows its line even before any first-value moment', () => {
    expect(reminderCardState(SET, null, NOW, false)).toBe('set');
  });

  it('no reminder, no dismiss, first value had: the invitation shows', () => {
    expect(reminderCardState(UNSET, null, NOW, true)).toBe('prompt');
  });

  it('a dismiss hides the invitation for fourteen days — then it returns, gently', () => {
    expect(reminderCardState(UNSET, NOW - 1000, NOW, true)).toBe('hidden');
    expect(reminderCardState(UNSET, NOW - REMINDER_DISMISS_WINDOW_MS + 1000, NOW, true)).toBe('hidden');
    expect(reminderCardState(UNSET, NOW - REMINDER_DISMISS_WINDOW_MS, NOW, true)).toBe('prompt');
    expect(reminderCardState(UNSET, NOW - REMINDER_DISMISS_WINDOW_MS * 3, NOW, true)).toBe('prompt');
  });

  it('the flywheel keys live under the sanctum_ prefix — inside the panic wipe', () => {
    expect(REMINDER_PROMPT_DISMISSED_KEY.startsWith('sanctum_')).toBe(true);
    expect(LISTEN_REMINDER_PROMPTED_KEY.startsWith('sanctum_')).toBe(true);
    expect(FIRST_VALUE_KEY.startsWith('sanctum_')).toBe(true);
  });
});

describe('the deferred offer — the invitation waits for a first moment of value (W-7)', () => {
  it('before any first value, an unset reminder is hidden — no dismiss needed', () => {
    expect(reminderCardState(UNSET, null, NOW, false)).toBe('hidden');
    expect(reminderCardState(UNSET, NOW - REMINDER_DISMISS_WINDOW_MS * 3, NOW, false)).toBe('hidden');
  });

  it('the two first-value moments are wired: a Listen play and a prayer-surface open', () => {
    expect(read('components/ListenBar.tsx')).toContain('markFirstValue()');
    expect(read('components/PocketChurchPage.tsx')).toContain('markFirstValue()');
    expect(read('components/ReminderCard.tsx')).toContain('readFirstValue()');
  });
});

describe('the set line and its time', () => {
  it('formats the chosen time the way a person says it', () => {
    expect(formatReminderTime('07:00')).toBe('7:00 AM');
    expect(formatReminderTime('19:30')).toBe('7:30 PM');
    expect(formatReminderTime('12:00')).toBe('12:00 PM');
    expect(formatReminderTime('00:15')).toBe('12:15 AM');
    expect(formatReminderTime('soon')).toBe('soon');
  });

  it('the summary line names the time and the focus', () => {
    // SET still holds a legacy 'rosary' focus from before the Nov 16, 2026 collapse;
    // it reads back as the Gospel, the reminder's one landing.
    expect(reminderSummaryLine(SET)).toBe('Morning reminder · 7:00 AM · The day’s Gospel');
    expect(reminderSummaryLine({ ...SET, focus: 'gospel', localTime: '06:30' })).toBe(
      'Morning reminder · 6:30 AM · The day’s Gospel',
    );
  });
});

describe('the post-listen line — once ever, and only when there is something to ask', () => {
  it('due only when no reminder is set and it has never been shown', () => {
    expect(listenReminderLineDue(UNSET, false)).toBe(true);
    expect(listenReminderLineDue(UNSET, true)).toBe(false);
    expect(listenReminderLineDue(SET, false)).toBe(false);
    expect(listenReminderLineDue(SET, true)).toBe(false);
  });

  it('the Listen bar wires completion to the line, and the line to the form', () => {
    const bar = read('components/ListenBar.tsx');
    expect(bar).toContain('listenReminderLineDue');
    expect(bar).toContain('markListenReminderPrompted()');
    expect(bar).toContain('Want this waiting for you tomorrow morning?');
    expect(bar).toContain('data-listen-reminder-line');
  });

  it('the card and the line both open the shell’s one reminder form', () => {
    const home = read('components/HomeScreen.tsx');
    expect(home).toContain('<ReminderCard t={seasonTheme} onOpenReminder={onOpenReminder} />');
    const card = read('components/ReminderCard.tsx');
    // Plain words since audit W-7: the invitation says "reminder" and
    // "notification" — the old line named neither.
    expect(card).toContain('Get a morning reminder — a notification with today');
    expect(card).not.toContain('Have Sanctum meet you in the morning');
    expect(card).toContain('data-reminder-card="set"');
    expect(card).toContain('data-reminder-card="prompt"');
  });
});
