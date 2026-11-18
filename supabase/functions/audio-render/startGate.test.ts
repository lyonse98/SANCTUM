import { describe, expect, it } from 'vitest';
import { evaluateStartGate, timingSafeEqualString } from './startGate.ts';

// P-1 (Nov 18, 2026): a fresh render start — the function's only
// unauthenticated spend — must be authorized by the render key or the
// schedule's cron token. The one softness is deliberate: an unreadable
// token store (the hardening migration still to land) lets a start
// through rather than silencing a morning, and nothing a caller sends
// can select that path.
describe('evaluateStartGate', () => {
  const STORED = 'cron-token-value';

  it('the render key authorizes outright, whatever the cron state', () => {
    expect(
      evaluateStartGate({ keyMatches: true, presentedCronToken: null, storedCronToken: STORED }),
    ).toEqual({ allowed: true, via: 'key' });
    expect(
      evaluateStartGate({ keyMatches: true, presentedCronToken: 'wrong', storedCronToken: null }),
    ).toEqual({ allowed: true, via: 'key' });
  });

  it('the cron token authorizes when it matches the stored value', () => {
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: STORED, storedCronToken: STORED }),
    ).toEqual({ allowed: true, via: 'cron' });
  });

  it('refuses a wrong, missing, or empty cron token once the store answers', () => {
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: 'wrong', storedCronToken: STORED }),
    ).toEqual({ allowed: false, via: null });
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: null, storedCronToken: STORED }),
    ).toEqual({ allowed: false, via: null });
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: '', storedCronToken: STORED }),
    ).toEqual({ allowed: false, via: null });
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: `${STORED}x`, storedCronToken: STORED }),
    ).toEqual({ allowed: false, via: null });
  });

  it('an unreadable store is the deploy-order guard: allowed, and named unconfigured', () => {
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: null, storedCronToken: null }),
    ).toEqual({ allowed: true, via: 'unconfigured' });
    // A presented token cannot manufacture the guard either way — with no
    // stored value there is nothing to match, and the start is the
    // guard's, not the token's.
    expect(
      evaluateStartGate({ keyMatches: false, presentedCronToken: 'anything', storedCronToken: null }),
    ).toEqual({ allowed: true, via: 'unconfigured' });
  });
});

describe('timingSafeEqualString', () => {
  it('compares by content, not by reference', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'ab')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(true);
    expect(timingSafeEqualString('', 'a')).toBe(false);
  });
});
