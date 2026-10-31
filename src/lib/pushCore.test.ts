import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import {
  PUSH_BODY,
  PUSH_FOCUS_KEYS,
  PUSH_TITLE,
  buildPushPayload,
  deepLinkUrlForFocus,
  evaluateDue,
  isDue,
  isPushFocus,
  isValidLocalTime,
  localNowParts,
  parseFocusParam,
  FOCUS_ROUTES,
} from './pushCore';
import { REMINDER_FOCUS_OPTIONS } from './reminderFocus';

const LA = 'America/Los_Angeles';

describe('push payload — the copy rule', () => {
  it('says the one discreet thing, for every focus', () => {
    for (const focus of PUSH_FOCUS_KEYS) {
      const payload = buildPushPayload(focus);
      expect(payload.title).toBe('Sanctum');
      expect(payload.title).toBe(PUSH_TITLE);
      expect(payload.body).toBe('Your Gospel and reflection are ready.');
      expect(payload.body).toBe(PUSH_BODY);
      expect(payload.focus).toBe(focus);
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
  it('maps every focus to the surface that actually holds it', () => {
    expect(FOCUS_ROUTES.gospel).toEqual({ tab: 'today' });
    expect(FOCUS_ROUTES.examen).toEqual({ tab: 'workshop', workshopTool: 'examen' });
    expect(FOCUS_ROUTES.rosary).toEqual({ tab: 'church', churchTab: 'rosary' });
    expect(FOCUS_ROUTES.rule).toEqual({ tab: 'workshop', workshopTool: 'rule' });
  });

  it('agrees with the focus list the app already offers', () => {
    expect([...PUSH_FOCUS_KEYS].sort()).toEqual(REMINDER_FOCUS_OPTIONS.map((o) => o.key).sort());
  });

  it('builds the URL the app will open', () => {
    expect(deepLinkUrlForFocus('gospel')).toBe('/?focus=gospel#daily-gospel');
    expect(deepLinkUrlForFocus('examen')).toBe('/?focus=examen');
    expect(deepLinkUrlForFocus('rosary')).toBe('/?focus=rosary');
    expect(deepLinkUrlForFocus('rule')).toBe('/?focus=rule');
  });

  it('parses the focus back out of the query string', () => {
    expect(parseFocusParam('?focus=examen')).toBe('examen');
    expect(parseFocusParam('?focus=rosary&x=1')).toBe('rosary');
    expect(parseFocusParam('?focus=bogus')).toBeNull();
    expect(parseFocusParam('')).toBeNull();
    expect(parseFocusParam('?x=1')).toBeNull();
  });

  it('recognises exactly the four focus keys', () => {
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

describe('server copy sync', () => {
  it('the generated push-dispatch core matches this source (npm run sync:push)', () => {
    execFileSync('node', ['scripts/sync-push-core.mjs', '--check'], { stdio: 'pipe' });
  });
});
