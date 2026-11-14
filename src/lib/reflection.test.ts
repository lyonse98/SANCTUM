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

const MEN = { settledAudience: 'men', inFlightAudience: null } as const;
const IDLE = { settledFor: null, inFlightFor: null, settledAudience: null, inFlightAudience: null } as const;

describe('nextReflectionFetch — the fetch fires in parallel, not behind the bundle', () => {
  it('at mount, with no bundle resolved yet, it fires for the locally computed date', () => {
    expect(nextReflectionFetch({ ...IDLE }, LOCAL, null, 'men')).toBe(LOCAL);
  });

  it('never starts a second fetch while one is in flight', () => {
    expect(
      nextReflectionFetch({ settledFor: null, inFlightFor: LOCAL, settledAudience: null, inFlightAudience: 'men' }, LOCAL, null, 'men'),
    ).toBeNull();
    expect(
      nextReflectionFetch({ settledFor: null, inFlightFor: LOCAL, settledAudience: null, inFlightAudience: 'men' }, LOCAL, OTHER, 'men'),
    ).toBeNull();
  });

  it('settled for the wanted date → nothing owed', () => {
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null, ...MEN }, LOCAL, null, 'men')).toBeNull();
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null, ...MEN }, LOCAL, LOCAL, 'men')).toBeNull();
  });
});

describe('nextReflectionFetch — the realignment guard (bundle date is authoritative)', () => {
  it('bundle resolves to a different date after the local fetch settled → refetch for the bundle date', () => {
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null, ...MEN }, LOCAL, OTHER, 'men')).toBe(OTHER);
  });

  it('mismatch arriving mid-flight waits for the in-flight fetch, then realigns', () => {
    // Bundle lands while the local fetch is still out: no parallel fetch.
    expect(
      nextReflectionFetch({ settledFor: null, inFlightFor: LOCAL, settledAudience: null, inFlightAudience: 'men' }, LOCAL, OTHER, 'men'),
    ).toBeNull();
    // The local fetch settles; now the realignment is owed.
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null, ...MEN }, LOCAL, OTHER, 'men')).toBe(OTHER);
    // And once the realigned fetch settles, nothing further is owed.
    expect(nextReflectionFetch({ settledFor: OTHER, inFlightFor: null, ...MEN }, LOCAL, OTHER, 'men')).toBeNull();
  });
});

describe('nextReflectionFetch — the track is part of the settled pair', () => {
  it('settled for the same date on the OTHER track → a fetch is owed for this track', () => {
    // The men's reflection settled for today; a woman who switches tracks in
    // Settings is owed her own — the date matching is not enough.
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null, ...MEN }, LOCAL, LOCAL, 'women')).toBe(LOCAL);
    expect(nextReflectionFetch({ settledFor: LOCAL, inFlightFor: null, ...MEN }, LOCAL, null, 'women')).toBe(LOCAL);
  });

  it('settled for the same date on THIS track → nothing owed, either track', () => {
    expect(
      nextReflectionFetch(
        { settledFor: LOCAL, inFlightFor: null, settledAudience: 'women', inFlightAudience: null },
        LOCAL,
        LOCAL,
        'women',
      ),
    ).toBeNull();
  });

  it('an in-flight fetch gates a second fetch even across a track switch (the settle re-evaluates)', () => {
    expect(
      nextReflectionFetch(
        { settledFor: null, inFlightFor: LOCAL, settledAudience: null, inFlightAudience: 'men' },
        LOCAL,
        LOCAL,
        'women',
      ),
    ).toBeNull();
  });
});

describe('reflectionDisplay — the block renders on the reflection’s own state', () => {
  it('while the readings are still loading and the fetch is in flight, the block is pending (its spinner renders)', () => {
    expect(
      reflectionDisplay({ settledFor: null, inFlightFor: LOCAL, value: null, settledAudience: null, inFlightAudience: 'men' }, null, 'men'),
    ).toEqual({ value: null, pending: true });
  });

  it('a reflection that settles before the bundle does is shown immediately', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE, ...MEN }, null, 'men'),
    ).toEqual({ value: VALUE, pending: false });
  });

  it('a settled failure before the bundle is the plain empty state — not pending, nothing shown', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: null, ...MEN }, null, 'men'),
    ).toEqual({ value: null, pending: false });
  });

  it('once the bundle resolves to the same date, the settled reflection stays shown', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE, ...MEN }, LOCAL, 'men'),
    ).toEqual({ value: VALUE, pending: false });
  });

  it('once the bundle resolves to a different date, the superseded reflection is hidden and the block is pending', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE, ...MEN }, OTHER, 'men'),
    ).toEqual({ value: null, pending: true });
    // …including while the realigning fetch is in flight.
    expect(
      reflectionDisplay(
        { settledFor: LOCAL, inFlightFor: OTHER, value: VALUE, settledAudience: 'men', inFlightAudience: 'men' },
        OTHER,
        'men',
      ),
    ).toEqual({ value: null, pending: true });
    // …until the realigned reflection settles.
    expect(
      reflectionDisplay({ settledFor: OTHER, inFlightFor: null, value: VALUE, ...MEN }, OTHER, 'men'),
    ).toEqual({ value: VALUE, pending: false });
  });
});

describe('reflectionDisplay — the facet follows the track (the "As a man" bug)', () => {
  it('a men’s reflection settled for today is never shown on the women’s track — hidden, pending the women’s fetch', () => {
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE, ...MEN }, LOCAL, 'women'),
    ).toEqual({ value: null, pending: true });
    // …and the same holds before the bundle resolves.
    expect(
      reflectionDisplay({ settledFor: LOCAL, inFlightFor: null, value: VALUE, ...MEN }, null, 'women'),
    ).toEqual({ value: null, pending: true });
  });

  it('a women’s reflection is shown on the women’s track, and hidden on the men’s', () => {
    const HERS: Reflection = { reflect: 'Sit with it.', challenge: 'Do the thing.', facet: 'As a woman' };
    const hers = { settledFor: LOCAL, inFlightFor: null, value: HERS, settledAudience: 'women', inFlightAudience: null } as const;
    expect(reflectionDisplay(hers, LOCAL, 'women')).toEqual({ value: HERS, pending: false });
    expect(reflectionDisplay(hers, LOCAL, 'men')).toEqual({ value: null, pending: true });
  });
});
