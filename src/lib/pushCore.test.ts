import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import {
  CONFESSION_EVENING_BEFORE_LEAD,
  CONFESSION_EVENING_BEFORE_TIME,
  CONFESSION_PUSH_BODY,
  DRIVE_HOME_PUSH_BODY,
  DRIVE_HOME_PUSH_TITLE,
  MASS_PUSH_BODY,
  PUSH_BODY,
  PUSH_FOCUS_KEYS,
  PUSH_TITLE,
  TAILOR_READY_PUSH_BODY,
  buildPushPayload,
  deepLinkUrlForFocus,
  evaluateConfessionEveDue,
  evaluateDriveDue,
  evaluateDue,
  evaluateEveningDue,
  evaluateWeeklyDue,
  isConfessionEveDue,
  isDriveDue,
  isDue,
  isEveningDue,
  isPushFocus,
  isValidLocalTime,
  isWeeklyDue,
  localNowParts,
  parseFocusParam,
  FOCUS_ROUTES,
} from './pushCore';
import { REMINDER_FOCUS_OPTIONS } from './reminderFocus';

const LA = 'America/Los_Angeles';

describe('push payload — the copy rule', () => {
  it('says the one discreet thing, for every daily-reminder focus', () => {
    for (const focus of ['gospel', 'examen', 'rosary', 'rule'] as const) {
      const payload = buildPushPayload(focus);
      expect(payload.title).toBe('Sanctum');
      expect(payload.title).toBe(PUSH_TITLE);
      expect(payload.body).toBe('Your Gospel and reflection are ready.');
      expect(payload.body).toBe(PUSH_BODY);
      expect(payload.focus).toBe(focus);
    }
  });

  it('the newer pokes carry their own fixed words (Nov 18, 2026) — and nothing personal', () => {
    expect(buildPushPayload('mass').body).toBe('Mass at your parish is coming up.');
    expect(buildPushPayload('mass').body).toBe(MASS_PUSH_BODY);
    expect(buildPushPayload('confession').body).toBe('Confession time at your parish is coming up.');
    expect(buildPushPayload('confession').body).toBe(CONFESSION_PUSH_BODY);
    expect(buildPushPayload('drivehome').body).toBe('Tailor your devotional for the road.');
    expect(buildPushPayload('drivehome').body).toBe(DRIVE_HOME_PUSH_BODY);
    expect(buildPushPayload('tailor').body).toBe('Your tailored devotional is ready to listen to.');
    expect(buildPushPayload('tailor').body).toBe(TAILOR_READY_PUSH_BODY);
  });

  it('the drive-home poke alone carries its own title (Nov 20, 2026) — every other poke is titled Sanctum', () => {
    expect(buildPushPayload('drivehome').title).toBe('The drive home');
    expect(buildPushPayload('drivehome').title).toBe(DRIVE_HOME_PUSH_TITLE);
    for (const focus of PUSH_FOCUS_KEYS) {
      if (focus === 'drivehome') continue;
      expect(buildPushPayload(focus).title).toBe('Sanctum');
    }
  });

  it('never lets the payload carry anything but title, body, url, and focus', () => {
    expect(Object.keys(buildPushPayload('rule')).sort()).toEqual(['body', 'focus', 'title', 'url']);
  });

  it('falls back to the Gospel for an unknown focus', () => {
    expect(buildPushPayload('weather').focus).toBe('gospel');
    expect(buildPushPayload('').url).toBe('/?focus=gospel#daily-gospel');
  });
});

describe('deep links', () => {
  it('lands every daily-reminder focus on Today — the Gospel is the one landing (Nov 16, 2026)', () => {
    expect(FOCUS_ROUTES.gospel).toEqual({ tab: 'today' });
    expect(FOCUS_ROUTES.examen).toEqual({ tab: 'today' });
    expect(FOCUS_ROUTES.rosary).toEqual({ tab: 'today' });
    expect(FOCUS_ROUTES.rule).toEqual({ tab: 'today' });
  });

  it('the newer pokes land where their words promise (Nov 18, 2026)', () => {
    // The Mass poke points at the Gospel — the readings are what he takes to Mass.
    expect(FOCUS_ROUTES.mass).toEqual({ tab: 'today' });
    // The Confession poke opens Pocket Church's Confession door.
    expect(FOCUS_ROUTES.confession).toEqual({ tab: 'church', churchTab: 'confession' });
    // The drive-home poke opens the Tailor panel (Nov 20, 2026 — it once
    // opened Tonight, when closing the day was its purpose); the
    // tailor-ready poke opens the Tailor panel too.
    expect(FOCUS_ROUTES.drivehome).toEqual({ tab: 'today', todayTailor: true });
    expect(FOCUS_ROUTES.tailor).toEqual({ tab: 'today', todayTailor: true });
  });

  it('the app offers exactly one daily focus, while the vocabulary keeps the legacy keys and gains the landing keys', () => {
    expect(REMINDER_FOCUS_OPTIONS.map((o) => o.key)).toEqual(['gospel']);
    expect([...PUSH_FOCUS_KEYS]).toEqual([
      'gospel', 'examen', 'rosary', 'rule', 'mass', 'confession', 'drivehome', 'tailor',
    ]);
  });

  it('builds the URL the app will open — the Gospel URL, whatever the stored daily focus', () => {
    expect(deepLinkUrlForFocus('gospel')).toBe('/?focus=gospel#daily-gospel');
    expect(deepLinkUrlForFocus('examen')).toBe('/?focus=gospel#daily-gospel');
    expect(deepLinkUrlForFocus('rosary')).toBe('/?focus=gospel#daily-gospel');
    expect(deepLinkUrlForFocus('rule')).toBe('/?focus=gospel#daily-gospel');
  });

  it('builds the newer pokes their own URLs', () => {
    expect(deepLinkUrlForFocus('mass')).toBe('/?focus=mass#daily-gospel');
    expect(deepLinkUrlForFocus('confession')).toBe('/?focus=confession');
    expect(deepLinkUrlForFocus('drivehome')).toBe('/?focus=drivehome');
    expect(deepLinkUrlForFocus('tailor')).toBe('/?focus=tailor');
    expect(deepLinkUrlForFocus('weather')).toBe('/?focus=gospel#daily-gospel');
  });

  it('parses the focus back out of the query string', () => {
    expect(parseFocusParam('?focus=examen')).toBe('examen');
    expect(parseFocusParam('?focus=rosary&x=1')).toBe('rosary');
    expect(parseFocusParam('?focus=confession')).toBe('confession');
    expect(parseFocusParam('?focus=drivehome')).toBe('drivehome');
    expect(parseFocusParam('?focus=bogus')).toBeNull();
    expect(parseFocusParam('')).toBeNull();
    expect(parseFocusParam('?x=1')).toBeNull();
  });

  it('recognises exactly the eight focus keys', () => {
    for (const key of PUSH_FOCUS_KEYS) expect(isPushFocus(key)).toBe(true);
    expect(isPushFocus('scripture')).toBe(false);
    expect(isPushFocus(null)).toBe(false);
    expect(isPushFocus(undefined)).toBe(false);
  });
});

describe('local time validation', () => {
  it('accepts HH:MM in range and rejects everything else', () => {
    expect(isValidLocalTime('07:00')).toBe(true);
    expect(isValidLocalTime('23:59')).toBe(true);
    expect(isValidLocalTime('00:00')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidLocalTime('7:00')).toBe(false);
    expect(isValidLocalTime('07:60')).toBe(false);
    expect(isValidLocalTime(700)).toBe(false);
    expect(isValidLocalTime(null)).toBe(false);
  });
});

describe('due matching — quarter hour, timezone, already sent', () => {
  const sub = { tz: LA, localTime: '07:00', lastSentOn: null as string | null };

  it('is due inside the quarter-hour window after the chosen time', () => {
    // 14:10 UTC = 07:10 PDT on Oct 15, 2026.
    expect(isDue(sub, new Date('2026-10-15T14:10:00Z'))).toBe(true);
    // 14:14 UTC = 07:14 local — still inside the window.
    expect(isDue(sub, new Date('2026-10-15T14:14:00Z'))).toBe(true);
  });

  it('is not due before the time, or once the window has passed', () => {
    expect(isDue(sub, new Date('2026-10-15T13:50:00Z'))).toBe(false); // 06:50 local
    expect(isDue(sub, new Date('2026-10-15T14:15:00Z'))).toBe(false); // 07:15 local — window closed
  });

  it('does not send twice in a day', () => {
    const sent = { ...sub, lastSentOn: '2026-10-15' };
    expect(isDue(sent, new Date('2026-10-15T14:10:00Z'))).toBe(false);
    // Yesterday's marker does not block today.
    const sentYesterday = { ...sub, lastSentOn: '2026-10-14' };
    expect(isDue(sentYesterday, new Date('2026-10-15T14:10:00Z'))).toBe(true);
  });

  it('reads the local date in the subscription timezone, not UTC', () => {
    const now = new Date('2026-10-15T04:30:00Z');
    expect(localNowParts(now, 'America/New_York').dateKey).toBe('2026-10-15');
    expect(localNowParts(now, LA).dateKey).toBe('2026-10-14');
    expect(localNowParts(now, LA).minutes).toBe(21 * 60 + 30);
  });

  it('never sends for an unparseable timezone or time', () => {
    expect(isDue({ tz: 'Not/AZone', localTime: '07:00', lastSentOn: null }, new Date('2026-10-15T14:10:00Z'))).toBe(false);
    expect(isDue({ tz: LA, localTime: '25:00', lastSentOn: null }, new Date('2026-10-15T14:10:00Z'))).toBe(false);
  });
});

describe('due matching — midnight wrap', () => {
  const sub = { tz: LA, localTime: '23:55', lastSentOn: '2026-10-13' as string | null };

  it('a 23:55 poke caught by the 00:05 tick fires, and belongs to the day its time fell on', () => {
    // 07:05 UTC Oct 15 = 00:05 PDT Oct 15; the 23:55 in question was Oct 14's.
    const result = evaluateDue(sub, new Date('2026-10-15T07:05:00Z'));
    expect(result.due).toBe(true);
    expect(result.localDateKey).toBe('2026-10-14');
  });

  it('and is not re-sent if the 23:55 tick already delivered it', () => {
    const sent = { ...sub, lastSentOn: '2026-10-14' };
    expect(isDue(sent, new Date('2026-10-15T07:05:00Z'))).toBe(false);
  });
});

describe('due matching — daylight saving', () => {
  it('fall-back (Nov 1, 2026): the repeated 1:30 sends once, not twice', () => {
    const sub = { tz: LA, localTime: '01:30', lastSentOn: null as string | null };
    // First 1:30 — 08:32 UTC, still PDT.
    const first = evaluateDue(sub, new Date('2026-11-01T08:32:00Z'));
    expect(first.due).toBe(true);
    expect(first.localDateKey).toBe('2026-11-01');
    // Second 1:30 — 09:31 UTC, now PST. Same wall-clock time, same local date:
    // the sent marker refuses the duplicate.
    const sent = { ...sub, lastSentOn: first.localDateKey };
    expect(isDue(sent, new Date('2026-11-01T09:31:00Z'))).toBe(false);
  });

  it('spring-forward (Mar 8, 2026): a 2:30 poke, whose hour never exists, is skipped', () => {
    const sub = { tz: LA, localTime: '02:30', lastSentOn: null as string | null };
    // 09:55 UTC = 1:55 PST (before the jump); 10:05 UTC = 3:05 PDT (after it).
    expect(isDue(sub, new Date('2026-03-08T09:55:00Z'))).toBe(false);
    expect(isDue(sub, new Date('2026-03-08T10:05:00Z'))).toBe(false);
  });
});

describe('evening due matching — the second poke (Nov 17, 2026)', () => {
  // November evenings in Los Angeles are PST (UTC-8): 04:0x UTC is 20:0x local the day before.
  const sub = {
    tz: LA,
    localTime: '07:00',
    lastSentOn: null as string | null,
    eveningTime: '20:00' as string | null,
    eveningLastSentOn: null as string | null,
  };

  it('is due inside the quarter-hour window after the evening time', () => {
    // 04:05 UTC Nov 17 = 20:05 PST Nov 16.
    const result = evaluateEveningDue(sub, new Date('2026-11-17T04:05:00Z'));
    expect(result.due).toBe(true);
    expect(result.localDateKey).toBe('2026-11-16');
    expect(isEveningDue(sub, new Date('2026-11-17T04:14:00Z'))).toBe(true);
  });

  it('is not due before the evening time, or once its window has passed', () => {
    expect(isEveningDue(sub, new Date('2026-11-17T03:50:00Z'))).toBe(false); // 19:50 local
    expect(isEveningDue(sub, new Date('2026-11-17T04:15:00Z'))).toBe(false); // 20:15 local — window closed
  });

  it('the evening sent marker guards the evening slot — and only that slot', () => {
    const eveningSent = { ...sub, eveningLastSentOn: '2026-11-16' };
    expect(isEveningDue(eveningSent, new Date('2026-11-17T04:05:00Z'))).toBe(false);
    // Yesterday's evening marker does not block tonight.
    const eveningSentYesterday = { ...sub, eveningLastSentOn: '2026-11-15' };
    expect(isEveningDue(eveningSentYesterday, new Date('2026-11-17T04:05:00Z'))).toBe(true);
    // The morning marker is the morning slot's business; it never blocks the evening.
    const morningSent = { ...sub, lastSentOn: '2026-11-16' };
    expect(isEveningDue(morningSent, new Date('2026-11-17T04:05:00Z'))).toBe(true);
  });

  it('an evening hour equal to the morning hour is one poke, never two', () => {
    const same = { ...sub, eveningTime: '07:00' };
    // 15:05 UTC Nov 16 = 07:05 PST — squarely inside the shared window.
    expect(evaluateEveningDue(same, new Date('2026-11-16T15:05:00Z')).due).toBe(false);
  });

  it('no evening hour set — or a malformed one — never sends', () => {
    expect(isEveningDue({ ...sub, eveningTime: null }, new Date('2026-11-17T04:05:00Z'))).toBe(false);
    expect(isEveningDue({ ...sub, eveningTime: '25:00' }, new Date('2026-11-17T04:05:00Z'))).toBe(false);
    expect(isEveningDue({ ...sub, eveningTime: '8pm' }, new Date('2026-11-17T04:05:00Z'))).toBe(false);
  });
});

describe('weekly due matching — the parish pokes (Nov 18, 2026)', () => {
  // November in Los Angeles is PST (UTC-8). Nov 15, 2026 is a Sunday.
  const SUNDAY = 0;
  const SATURDAY = 6;

  it('is due once the lead has run out before the event', () => {
    // Sunday Mass 09:30, one hour ahead: the poke belongs to 08:30.
    // 16:35 UTC = 08:35 PST on Sunday Nov 15.
    const result = evaluateWeeklyDue(new Date('2026-11-15T16:35:00Z'), LA, SUNDAY, '09:30', 60, null);
    expect(result.due).toBe(true);
    expect(result.localDateKey).toBe('2026-11-15');
    expect(isWeeklyDue(new Date('2026-11-15T16:35:00Z'), LA, SUNDAY, '09:30', 60, null)).toBe(true);
  });

  it('is not due before the reminder moment, nor after the grace past the event', () => {
    // 08:20 local — the hour's lead has not run out yet.
    expect(isWeeklyDue(new Date('2026-11-15T16:20:00Z'), LA, SUNDAY, '09:30', 60, null)).toBe(false);
    // 09:45 local — inside the half hour after Mass begins, still a nudge.
    expect(isWeeklyDue(new Date('2026-11-15T17:45:00Z'), LA, SUNDAY, '09:30', 60, null)).toBe(true);
    // 10:05 local — the grace has passed; a poke now would be a post-mortem.
    expect(isWeeklyDue(new Date('2026-11-15T18:05:00Z'), LA, SUNDAY, '09:30', 60, null)).toBe(false);
  });

  it('the sent marker is the event date — and only that event', () => {
    const now = new Date('2026-11-15T16:35:00Z');
    expect(isWeeklyDue(now, LA, SUNDAY, '09:30', 60, '2026-11-15')).toBe(false);
    // Last Sunday's marker does not block this Sunday.
    expect(isWeeklyDue(now, LA, SUNDAY, '09:30', 60, '2026-11-08')).toBe(true);
  });

  it('a weekday that is not the event day never fires', () => {
    // Monday Nov 16, 08:35 local — the same wall clock, the wrong day.
    expect(isWeeklyDue(new Date('2026-11-16T16:35:00Z'), LA, SUNDAY, '09:30', 60, null)).toBe(false);
    // Nor does next Sunday's poke arrive a week early.
    expect(isWeeklyDue(new Date('2026-11-15T16:35:00Z'), LA, SATURDAY, '09:30', 60, null)).toBe(false);
  });

  it('a lead that crosses midnight reminds the night before, for the event date', () => {
    // Sunday 01:00, two hours ahead: the poke belongs to Saturday 23:00.
    // 07:10 UTC Nov 15 = 23:10 PST Nov 14 — Saturday night, inside the window.
    const result = evaluateWeeklyDue(new Date('2026-11-15T07:10:00Z'), LA, SUNDAY, '01:00', 120, null);
    expect(result.due).toBe(true);
    // The marker is the EVENT's date — Sunday's, not the Saturday the poke landed on.
    expect(result.localDateKey).toBe('2026-11-15');
    // Saturday 22:50 local (06:50 UTC) — the reminder moment has not come yet.
    expect(isWeeklyDue(new Date('2026-11-15T06:50:00Z'), LA, SUNDAY, '01:00', 120, null)).toBe(false);
    // And once sent for that event, the small hours do not send it again.
    expect(isWeeklyDue(new Date('2026-11-15T08:35:00Z'), LA, SUNDAY, '01:00', 120, '2026-11-15')).toBe(false);
  });

  it('a Saturday event evaluated from Friday night stays quiet until its own lead', () => {
    // Saturday Confession 15:30, 30 ahead: the poke belongs to Saturday 15:00.
    // Friday Nov 13, 15:05 local (23:05 UTC) — a full day early.
    expect(isWeeklyDue(new Date('2026-11-13T23:05:00Z'), LA, SATURDAY, '15:30', 30, null)).toBe(false);
    // Saturday Nov 14, 15:05 local (23:05 UTC) — inside the window.
    const result = evaluateWeeklyDue(new Date('2026-11-14T23:05:00Z'), LA, SATURDAY, '15:30', 30, null);
    expect(result.due).toBe(true);
    expect(result.localDateKey).toBe('2026-11-14');
  });

  it('never sends for a malformed day, time, lead, or timezone', () => {
    const now = new Date('2026-11-15T16:35:00Z');
    expect(isWeeklyDue(now, LA, 7, '09:30', 60, null)).toBe(false);
    expect(isWeeklyDue(now, LA, -1, '09:30', 60, null)).toBe(false);
    expect(isWeeklyDue(now, LA, SUNDAY, '25:00', 60, null)).toBe(false);
    expect(isWeeklyDue(now, LA, SUNDAY, '09:30', 0, null)).toBe(false);
    expect(isWeeklyDue(now, 'Not/AZone', SUNDAY, '09:30', 60, null)).toBe(false);
  });
});

describe('confession evening-before due matching — the sentinel lead (Nov 20, 2026)', () => {
  // November in Los Angeles is PST (UTC-8). Nov 13, 2026 is a Friday,
  // Nov 14 a Saturday, Nov 15 a Sunday.
  const SATURDAY = 6;
  const SUNDAY = 0;

  it('the sentinel is -1 and the eve hour is 7:00 PM', () => {
    expect(CONFESSION_EVENING_BEFORE_LEAD).toBe(-1);
    expect(CONFESSION_EVENING_BEFORE_TIME).toBe('19:00');
  });

  it('is due inside the quarter-hour after 7 PM on the day before Confession', () => {
    // Saturday Confession: the eve is Friday. 03:05 UTC Nov 14 = 19:05 PST Fri Nov 13.
    const result = evaluateConfessionEveDue(new Date('2026-11-14T03:05:00Z'), LA, SATURDAY, null);
    expect(result.due).toBe(true);
    // The marker is the CONFESSION day's date — Saturday's, not the Friday the poke lands on.
    expect(result.localDateKey).toBe('2026-11-14');
    expect(isConfessionEveDue(new Date('2026-11-14T03:14:00Z'), LA, SATURDAY, null)).toBe(true);
  });

  it('is not due before 7 PM, or once the window has passed', () => {
    // 18:55 local Friday (02:55 UTC) — the eve hour has not come.
    expect(isConfessionEveDue(new Date('2026-11-14T02:55:00Z'), LA, SATURDAY, null)).toBe(false);
    // 19:15 local Friday (03:15 UTC) — the window has closed.
    expect(isConfessionEveDue(new Date('2026-11-14T03:15:00Z'), LA, SATURDAY, null)).toBe(false);
    // 7 PM on the Confession day itself (Sat 19:05 local, 03:05 UTC Nov 15) is a day late.
    expect(isConfessionEveDue(new Date('2026-11-15T03:05:00Z'), LA, SATURDAY, null)).toBe(false);
  });

  it('an evening whose tomorrow is not the Confession day never fires', () => {
    // Thursday Nov 12, 19:05 local (03:05 UTC Nov 13): tomorrow is Friday, not Saturday.
    expect(isConfessionEveDue(new Date('2026-11-13T03:05:00Z'), LA, SATURDAY, null)).toBe(false);
    // The same Friday eve, asked about a Sunday Confession, is quiet too.
    expect(isConfessionEveDue(new Date('2026-11-14T03:05:00Z'), LA, SUNDAY, null)).toBe(false);
  });

  it('a Sunday Confession is reminded on Saturday evening', () => {
    // 03:05 UTC Nov 15 = 19:05 PST Sat Nov 14 — the eve of Sunday.
    const result = evaluateConfessionEveDue(new Date('2026-11-15T03:05:00Z'), LA, SUNDAY, null);
    expect(result.due).toBe(true);
    expect(result.localDateKey).toBe('2026-11-15');
  });

  it('the sent marker is the Confession date — shared with the minutes leads, so the two never double-poke', () => {
    const eve = new Date('2026-11-14T03:05:00Z'); // Friday 19:05 local, for Saturday's Confession
    // A poke already sent for this Confession day — by either lead shape — refuses another.
    expect(isConfessionEveDue(eve, LA, SATURDAY, '2026-11-14')).toBe(false);
    // Last week's Confession marker does not block this week's eve.
    expect(isConfessionEveDue(eve, LA, SATURDAY, '2026-11-07')).toBe(true);
    // The eve's own date as a marker (a shape no writer produces) does not block it either:
    // the guard is the event's date, never the day the poke happened to land on.
    expect(isConfessionEveDue(eve, LA, SATURDAY, '2026-11-13')).toBe(true);
  });

  it('the sentinel can never be read as a weekly lead', () => {
    // evaluateWeeklyDue refuses a lead of zero or less outright, so even a
    // wiring mistake cannot turn -1 into a time before the event.
    const now = new Date('2026-11-14T23:05:00Z'); // Saturday 15:05 local
    expect(isWeeklyDue(now, LA, SATURDAY, '15:30', CONFESSION_EVENING_BEFORE_LEAD, null)).toBe(false);
  });

  it('never sends for a malformed Confession day or timezone', () => {
    const eve = new Date('2026-11-14T03:05:00Z');
    expect(isConfessionEveDue(eve, LA, 7, null)).toBe(false);
    expect(isConfessionEveDue(eve, LA, -1, null)).toBe(false);
    expect(isConfessionEveDue(eve, 'Not/AZone', SATURDAY, null)).toBe(false);
  });
});

describe('drive-home due matching — the third daily poke (Nov 18, 2026)', () => {
  const sub = {
    tz: LA,
    localTime: '07:00',
    lastSentOn: null as string | null,
    driveTime: '17:30' as string | null,
    driveLastSentOn: null as string | null,
  };

  it('is due inside the quarter-hour window after the drive hour', () => {
    // 01:35 UTC Nov 17 = 17:35 PST Nov 16.
    const result = evaluateDriveDue(sub, new Date('2026-11-17T01:35:00Z'));
    expect(result.due).toBe(true);
    expect(result.localDateKey).toBe('2026-11-16');
    expect(isDriveDue(sub, new Date('2026-11-17T01:44:00Z'))).toBe(true);
    expect(isDriveDue(sub, new Date('2026-11-17T01:45:00Z'))).toBe(false); // 17:45 — window closed
  });

  it('its own marker guards it — and only it', () => {
    const sent = { ...sub, driveLastSentOn: '2026-11-16' };
    expect(isDriveDue(sent, new Date('2026-11-17T01:35:00Z'))).toBe(false);
    // The morning marker never blocks the drive home.
    const morningSent = { ...sub, lastSentOn: '2026-11-16' };
    expect(isDriveDue(morningSent, new Date('2026-11-17T01:35:00Z'))).toBe(true);
  });

  it('is independent of the evening slot — a shared hour still fires for its own purpose', () => {
    // The evening slot refuses an hour equal to the morning's; the drive
    // slot has no such pair and no such guard.
    const shared = { ...sub, driveTime: '20:00' };
    // 04:05 UTC Nov 17 = 20:05 PST Nov 16.
    expect(isDriveDue(shared, new Date('2026-11-17T04:05:00Z'))).toBe(true);
    const eveningShared = {
      tz: LA, localTime: '20:00', lastSentOn: null as string | null,
      eveningTime: '20:00' as string | null, eveningLastSentOn: null as string | null,
    };
    expect(isEveningDue(eveningShared, new Date('2026-11-17T04:05:00Z'))).toBe(false);
  });

  it('no drive hour set — or a malformed one — never sends', () => {
    expect(isDriveDue({ ...sub, driveTime: null }, new Date('2026-11-17T01:35:00Z'))).toBe(false);
    expect(isDriveDue({ ...sub, driveTime: '5:30pm' }, new Date('2026-11-17T01:35:00Z'))).toBe(false);
  });
});

describe('server copy sync', () => {
  it('the generated push-dispatch core matches this source (npm run sync:push)', () => {
    execFileSync('node', ['scripts/sync-push-core.mjs', '--check'], { stdio: 'pipe' });
  });
});
