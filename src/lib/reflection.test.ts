import { describe, expect, it } from 'vitest';
import { nextReflectionFetch, reflectionDisplay, type Reflection } from './reflection';
import { isoDate } from './readingsBundle';

const LOCAL = '2026-11-02';
const OTHER = '2026-11-01';
const VALUE: Reflection = { reflect: 'Sit with it.', challenge: 'Do the thing.', facet: 'As a man' };

describe('the local date key (the reflection fetch and the readings bundle share one rule)', () => {
  it('is the readings bundle’s own isoDate — local time, padded', () => {
    // Built from local components, so these hold in any test-runner timezone.
    expect(isoDate(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
    expect(isoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('nextReflectionFetch — the fetch fires in parallel, not behind the bundle', () => {
  it('at mount, with no bundle resolved yet, it fires for the locally computed date', () => {
    expect(nextReflectionFetch({ settledFor: null, inFlightFor: null }, LOCAL, null)).toBe(LOCAL);
  });

  it('never starts a second fetch while one is in flight', () => {
    expect(nextReflectionFetch({ settledFor: null, inFlightFor: LOCAL }, LOCAL, null)).toBeNull();
    expect(nextReflectionFetch({ settledFor: null, inFlightFor: LOCAL }, LOCAL, OTHER)).toBeNull();
  });

  it('settled for the wanted date → nothing owed', () => {
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null }, LOCAL, null)).toBeNull();
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null }, LOCAL, LOCAL)).toBeNull();
  });
});

describe('nextReflectionFetch — the realignment guard (bundle date is authoritative)', () => {
  it('bundle resolves to a different date after the local fetch settled → refetch for the bundle date', () => {
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null }, LOCAL, OTHER)).toBe(OTHER);
  });

  it('mismatch arriving mid-flight waits for the in-flight fetch, then realigns', () => {
    // Bundle lands while the local fetch is still out: no parallel fetch.
    expect(nextReflectionFetch({ settledFor: null, inFlightFor: LOCAL }, LOCAL, OTHER)).toBeNull();
    // The local fetch settles; now the realignment is owed.
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null }, LOCAL, OTHER)).toBe(OTHER);
    // And once the realigned fetch settles, nothing further is owed.
    expect(nextReflectionFetch({ settledFor: OTHER, inFlightFor: null }, LOCAL, OTHER)).toBeNull();
  });
});

describe('reflectionDisplay — the block renders on the reflection’s own state', () => {
  it('while the readings are still loading and the fetch is in flight, the block is pending (its spinner renders)', () => {
    expect(
      reflectionDisplay({ settledFor: null, inFlightFor: LOCAL, value: null }, null),
    ).toEqual({ value: null, pending: true });
  });

  it('a reflection that settles before the bundle does is shown immediately', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE }, null),
    ).toEqual({ value: VALUE, pending: false });
  });

  it('a settled failure before the bundle is the plain empty state — not pending, nothing shown', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: null }, null),
    ).toEqual({ value: null, pending: false });
  });

  it('once the bundle resolves to the same date, the settled reflection stays shown', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE }, LOCAL),
    ).toEqual({ value: VALUE, pending: false });
  });

  it('once the bundle resolves to a different date, the superseded reflection is hidden and the block is pending', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE }, OTHER),
    ).toEqual({ value: null, pending: true });
    // …including while the realigning fetch is in flight.
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: OTHER, value: VALUE }, OTHER),
    ).toEqual({ value: null, pending: true });
    // …until the realigned reflection settles.
    expect(
      reflectionDisplay({ settledFor: OTHER, inFlightFor: null, value: VALUE }, OTHER),
    ).toEqual({ value: VALUE, pending: false });
  });
});
