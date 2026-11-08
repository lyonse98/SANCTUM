import { describe, expect, test } from 'vitest';
import { scoreCase, summarize } from './scorer.mjs';
import { FIXTURE_CASES } from './fixtures.mjs';

// The fidelity harness's own self-test (spec §10): proves the scorer works
// offline before anyone trusts its live verdicts. Every planted violation in
// the fixtures must be caught by name; every clean case must pass.
describe('corpus fidelity scorer (offline self-test)', () => {
  for (const fixture of FIXTURE_CASES) {
    test(`fixture: ${fixture.name}`, () => {
      const result = scoreCase(fixture);
      expect(result.pass, JSON.stringify(result.failures)).toBe(fixture.expectPass);
      for (const check of fixture.expectFailures ?? []) {
        expect(result.checks[check]).toBe(false);
      }
    });
  }

  test('summarize applies the §10.3 thresholds', () => {
    const clean = FIXTURE_CASES.filter((f) => f.expectPass).map((f) => ({
      ...scoreCase(f),
      item: f.item,
    }));
    const summary = summarize(clean);
    expect(summary.allThresholdsMet).toBe(true);

    const dirty = FIXTURE_CASES.map((f) => ({ ...scoreCase(f), item: f.item }));
    expect(summarize(dirty).allThresholdsMet).toBe(false);
  });
});
