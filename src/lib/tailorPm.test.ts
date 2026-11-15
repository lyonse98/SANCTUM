import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getOrBuildTailored,
  readTailorMeta,
  tailorMetaKey,
  type TailorStore,
  type TailoredDevotional,
} from './tailor';
import {
  EVENING_STATES,
  buildCloseOfDay,
  loadTonightsClose,
  saveTonightsClose,
  tailorPmKey,
  type TailorPmPackage,
} from './tailorPm';
import {
  buildPmSystemPrompt,
  buildPmUserPrompt,
  composePmEvening,
  parsePmResult,
  validatePmRequest,
  type TailorBundle,
} from '../../supabase/functions/tailor-devotional/tailorCore';
import {
  TAILOR_BUILD_STAMP,
  TAILOR_PM_BUILD_STAMP,
  buildOutputRow,
  buildPmOutputRow,
  recordPmOutput,
  type OutputsTransport,
} from '../../supabase/functions/tailor-devotional/outputs';

/**
 * Close the day — the Tailor PM twin (Nov 14, 2026). The pins hold the
 * twin's whole contract:
 *  - the morning record: the intake is kept ON THE DEVICE (trimmed and
 *    capped as the build call caps it), the panel and privacy copy say
 *    exactly that, and nothing about the server rule changes;
 *  - the evening build: the morning validates through the SAME allowlist
 *    as a morning build, the dusk word is a four-value enum, the package
 *    is three short pieces, and the quota is its own — one close per
 *    (day, caller) under a pm discriminator;
 *  - the record: the PM row carries the morning row's exact key set under
 *    a distinguishing stamp, and holds none of the morning's words;
 *  - the surface: Tonight shows the plate only when a morning record
 *    exists, and a built close is cached on-device for the night.
 */

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { for (const k of Object.keys(store)) delete store[k]; } },
  });
  return store as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const MORNING = { state: 'anxious' as const, focus: 'work' as const, tone: 'courage' as const, freeText: 'Big review at 2.' };
const EVENING: TailorPmPackage = {
  reflect: 'You named the review this morning, and it took the day. What was asked of you was real, and you stayed.',
  prayer: 'Into your hands, O Lord, I commend my spirit; you have redeemed me, O Lord, God of truth.',
  carry: 'The day is named, and it is handed over.',
};
const BUNDLE: TailorBundle = {
  celebration: null,
  gospelCitation: 'John 6:37-40',
  gospelText: 'GOSPEL TEXT VERBATIM.',
  readings: [{ kind: 'gospel', citation: 'John 6:37-40', text: 'GOSPEL TEXT VERBATIM.' }],
  reflect: 'The canonical reflection, for everyone.',
  challenge: 'The canonical challenge.',
  facet: 'As a man',
};

// ── The morning record ───────────────────────────────────────────────────────

describe('the morning record — the intake, kept on this device only', () => {
  const RESPONSE = {
    ok: true,
    date: '2026-11-14',
    narratorId: 'ben',
    narratorName: 'Ben',
    passage: { citation: 'Psalm 90:17', text: 'And let the brightness of the Lord our God be upon us.', translation: 'Douay-Rheims' },
    reflect: 'A tailored reflection.',
    challenge: 'One tailored act.',
    traditionQuote: null,
    media: {
      kind: 'song', type: 'song', title: 'A Song', creator: 'A Singer',
      url: 'https://www.youtube.com/results?search_query=x', searchUrl: 'https://www.youtube.com/results?search_query=x',
      why: 'Chosen for today.',
    },
    audioBase64: null,
    audioSeconds: 0,
  };

  function fakeStore(): TailorStore {
    const memory = new Map<string, TailoredDevotional>();
    return {
      async get(key) { return memory.get(key) ?? null; },
      async set(key, value) { memory.set(key, value); },
    };
  }

  it('a fresh build writes the morning into the meta — trimmed and capped like the call', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => RESPONSE }) as Response);
    const messy = { ...MORNING, freeText: `  Big   review\n at 2.  ${'x'.repeat(300)}` };
    await getOrBuildTailored('2026-11-14', 'men', messy, { fetchImpl, store: fakeStore() });
    const meta = readTailorMeta('2026-11-14', 'men');
    expect(meta?.morning?.state).toBe('anxious');
    expect(meta?.morning?.focus).toBe('work');
    expect(meta?.morning?.tone).toBe('courage');
    expect(meta?.morning?.freeText.startsWith('Big review at 2.')).toBe(true);
    expect(meta?.morning?.freeText.length).toBe(200);
    // The meta key is the same sanctum_tailor_ line the panic wipe covers.
    expect(tailorMetaKey('2026-11-14', 'men')).toBe('sanctum_tailor_2026-11-14');
  });

  it('a malformed morning record drops the record, never the meta', () => {
    localStorage.setItem(
      tailorMetaKey('2026-11-14', 'women'),
      JSON.stringify({ hash: 'x', narratorName: 'Claire', at: 1, focus: 'grief', morning: { state: 'bogus', focus: 'work', tone: 'courage', freeText: 'hi' } }),
    );
    const meta = readTailorMeta('2026-11-14', 'women');
    expect(meta?.focus).toBe('grief');
    expect(meta?.morning).toBeUndefined();
  });

  it('a meta written before the twin (no morning field) reads back without one', () => {
    localStorage.setItem(
      tailorMetaKey('2026-11-14', 'men'),
      JSON.stringify({ hash: 'x', narratorName: 'Ben', at: 1, focus: 'work' }),
    );
    expect(readTailorMeta('2026-11-14', 'men')?.morning).toBeUndefined();
  });
});

// ── The evening build (function core) ────────────────────────────────────────

describe('the PM request — the morning through the same allowlist, one dusk word', () => {
  it('validates a well-formed PM payload', () => {
    const pm = validatePmRequest({ morning: MORNING, eveningState: 'held' });
    expect(pm?.intake.state).toBe('anxious');
    expect(pm?.intake.freeText).toBe('Big review at 2.');
    expect(pm?.eveningState).toBe('held');
  });

  it('rejects a missing morning, a bad morning, and a bad dusk word', () => {
    expect(validatePmRequest({ eveningState: 'held' })).toBeNull();
    expect(validatePmRequest({ morning: { state: 'bogus', focus: 'work' }, eveningState: 'held' })).toBeNull();
    expect(validatePmRequest({ morning: MORNING, eveningState: 'fine' })).toBeNull();
    expect(validatePmRequest({ morning: MORNING })).toBeNull();
  });

  it('the dusk enum is exactly the four words the panel offers', () => {
    expect(EVENING_STATES.map((s) => s.id)).toEqual(['held', 'broke', 'mixed', 'heavy']);
  });
});

describe('the PM composition — prompts carry the morning and the dusk word', () => {
  it('the system prompt is the track grounding plus the evening-close task', () => {
    const men = buildPmSystemPrompt('men');
    expect(men).toContain('THE TAILOR TASK — THE EVENING CLOSE (CLOSE THE DAY)');
    expect(men).toContain('no invented quotations, no invented attributions');
    const women = buildPmSystemPrompt('women');
    expect(women).toContain("closing one woman's day");
  });

  it('the user prompt sets the morning beside the dusk word over the canonical day', () => {
    const user = buildPmUserPrompt(BUNDLE, { ...MORNING, tone: 'courage' }, 'broke', 'men');
    expect(user).toContain('John 6:37-40');
    expect(user).toContain('The canonical reflection, for everyone.');
    expect(user).toContain('In their own words this morning: "Big review at 2."');
    expect(user).toContain("broke from the morning's intention");
  });

  it('composePmEvening runs the one generation and returns its package', async () => {
    const seen: string[] = [];
    const out = await composePmEvening({
      audience: 'women',
      intake: { ...MORNING },
      eveningState: 'heavy',
      bundle: { ...BUNDLE, facet: 'As a woman' },
      generatePm: async (system, user) => {
        seen.push(system, user);
        return EVENING;
      },
    });
    expect(out).toEqual(EVENING);
    expect(seen[0]).toContain('THE EVENING CLOSE');
    expect(seen[1]).toContain('the day was heavy');
  });
});

describe('parsePmResult — the package is three short pieces or nothing', () => {
  it('parses the plain and the fenced shapes', () => {
    expect(parsePmResult(JSON.stringify(EVENING))).toEqual(EVENING);
    expect(parsePmResult('```json\n' + JSON.stringify(EVENING) + '\n```')).toEqual(EVENING);
  });

  it('rejects a missing piece and clamps an over-long one', () => {
    expect(parsePmResult(JSON.stringify({ reflect: EVENING.reflect, prayer: EVENING.prayer }))).toBeNull();
    expect(parsePmResult('not json')).toBeNull();
    const long = parsePmResult(JSON.stringify({ ...EVENING, carry: 'y'.repeat(500) }));
    expect(long?.carry.length).toBe(200);
  });
});

// ── The record (outputs.ts) ──────────────────────────────────────────────────

describe('the PM output record — same key set, its own stamp, none of the morning', () => {
  it('the PM stamp distinguishes evening rows from morning rows', () => {
    expect(TAILOR_PM_BUILD_STAMP).not.toBe(TAILOR_BUILD_STAMP);
    expect(buildPmOutputRow('2026-11-14', 'men', EVENING).build_stamp).toBe(TAILOR_PM_BUILD_STAMP);
  });

  it('buildPmOutputRow carries exactly the morning row’s key set', () => {
    const pmRow = buildPmOutputRow('2026-11-14', 'women', EVENING);
    const morningKeys = Object.keys(
      buildOutputRow('2026-11-14', 'women', {
        tailored: { reflect: 'r', challenge: 'c' },
        passage: { citation: 'x', text: 'y' },
        traditionQuote: null,
        media: { title: 't', creator: 'c', url: 'u', kind: 'song' },
        script: { persona: 'claire' },
      } as never),
    ).sort();
    expect(Object.keys(pmRow).sort()).toEqual(morningKeys);
    expect(pmRow.reflection).toBe(EVENING.reflect);
    expect(pmRow.challenge).toBe(EVENING.carry);
    expect(pmRow.quote_text).toBe(EVENING.prayer);
    expect(pmRow.quote_source).toBe('Closing prayer');
    expect(pmRow.passage_citation).toBeNull();
    expect(pmRow.media_title).toBeNull();
    expect(pmRow.narrator).toBeNull();
  });

  it('recordPmOutput writes the PM row to tailor_outputs and nothing else', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const transport: OutputsTransport = {
      baseUrl: 'https://example.supabase.co',
      serviceKey: 'service-test',
      fetchFn: (async (url: string, init?: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
        return { ok: true, json: async () => [] } as Response;
      }) as typeof fetch,
    };
    await recordPmOutput('2026-11-14', 'men', EVENING, { transport });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/rest/v1/tailor_outputs');
    expect(calls[0].body).toEqual(buildPmOutputRow('2026-11-14', 'men', EVENING));
    // None of the morning's words exist anywhere in the recorded row.
    expect(JSON.stringify(calls[0].body)).not.toContain('Big review');
    expect(JSON.stringify(calls[0].body)).not.toContain('anxious');
  });
});

// ── The client call + the night cache ────────────────────────────────────────

describe('buildCloseOfDay — one call, then the device keeps the night', () => {
  it('sends the PM shape and caches the package under the tailor prefix', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      return { ok: true, status: 200, json: async () => ({ ok: true, mode: 'pm', date: '2026-11-14', evening: EVENING }) } as Response;
    }) as unknown as typeof fetch;
    const out = await buildCloseOfDay('2026-11-14', 'men', MORNING, 'mixed', { fetchImpl });
    expect(out).toEqual(EVENING);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].mode).toBe('pm');
    expect(bodies[0].eveningState).toBe('mixed');
    expect(bodies[0].morning).toEqual(MORNING);
    expect(tailorPmKey('2026-11-14', 'men')).toBe('sanctum_tailor_pm_2026-11-14');
    expect(loadTonightsClose('2026-11-14', 'men')).toEqual({ eveningState: 'mixed', evening: EVENING });
    // A second ask reads the device, not the function — one close per day.
    const again = await buildCloseOfDay('2026-11-14', 'men', MORNING, 'mixed', { fetchImpl });
    expect(again).toEqual(EVENING);
    expect(bodies).toHaveLength(1);
  });

  it('save/load round-trips per track, and a malformed cache reads as none', () => {
    saveTonightsClose('2026-11-14', 'women', 'held', EVENING);
    expect(loadTonightsClose('2026-11-14', 'women')?.eveningState).toBe('held');
    expect(loadTonightsClose('2026-11-14', 'men')).toBeNull();
    localStorage.setItem(tailorPmKey('2026-11-14', 'men'), '{"eveningState":"fine","evening":{}}');
    expect(loadTonightsClose('2026-11-14', 'men')).toBeNull();
  });
});

// ── Source pins: the handler, the copy, the surface ──────────────────────────

describe('the wiring — handler branch, quota discriminator, honest copy, the plate', () => {
  const fnIndex = readRoot('supabase/functions/tailor-devotional/index.ts');

  it('the PM mode branches ahead of the morning intake, with its own quota', () => {
    expect(fnIndex).toContain('if (payload.mode === "pm")');
    expect(fnIndex.indexOf('payload.mode === "pm"')).toBeLessThan(fnIndex.indexOf('const intake = validateIntake(payload)'));
    expect(fnIndex).toContain('PM_RATE_DAY_LIMIT = 1');
    expect(fnIndex).toContain('tailor-pm:${dateISO}:${identifier}');
    expect(fnIndex).toContain('recordPmOutput(dateISO, audience, evening)');
  });

  it('the Tailor panel copy tells the truth about the morning’s words', () => {
    const panel = readRoot('src/components/TailorToday.tsx');
    expect(panel).toContain('never stored on a server');
    expect(panel).toContain('stay on this device, kept for tonight');
    expect(panel).not.toContain('What you tell Sanctum is never stored.');
  });

  it('the privacy list covers the evening record too', () => {
    const copy = readRoot('src/lib/privacyCopy.ts');
    expect(copy).toContain('or to close your day at night');
    expect(copy).toContain('night reflection, closing prayer, and carry line');
    expect(copy).toContain('with none of your answers');
  });

  it('Tonight renders the plate only behind a morning record', () => {
    const tonight = readRoot('src/components/TonightClosing.tsx');
    expect(tonight).toContain('tailorMeta?.morning');
    expect(tonight).toContain('<TailorPm');
  });
});
