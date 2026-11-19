import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  TAILOR_DAILY_BUILD_LIMIT,
  TailorDailyLimitError,
  fetchTailorAudio,
  getOrBuildTailored,
  intakeHash,
  loadTailoredBuild,
  loadTodaysTailored,
  readTailorBuilds,
  readTailorMeta,
  tailorMetaKey,
  type TailorIntake,
  type TailorPieceBank,
  type TailorStore,
  type TailoredDevotional,
} from './tailor';
import { LETTER_THREADS_KEY } from './letterThreads';
import { wipeAllSanctumData } from './storage';
import { getSeasonTheme } from './seasonTheme';
import { tailorFocusLabel } from '@/data/tailorBank';
import { TailorBuildSwitcher } from '../components/TailorToday';

/**
 * The day's several devotionals (Erik, Nov 19, 2026): up to three
 * distinct tailored builds in a day, indexed on the device, walked by
 * the panel's switcher — and a fourth refused HERE, before any server
 * call, because three is the cost cap. The latest build stays the
 * day's standing record: the meta's hash and morning record name it,
 * and tonight's close keys off it exactly as it did with one build.
 */

const DATE = '2026-11-19';

const INTAKE_A: TailorIntake = { state: 'anxious', focus: 'work', tone: 'courage', freeText: 'Big review at 2.' };
const INTAKE_B: TailorIntake = { state: 'steady', focus: 'family', tone: 'comfort', freeText: '' };
const INTAKE_C: TailorIntake = { state: 'grateful', focus: 'marriage', tone: 'consolation', freeText: 'Anniversary week.' };
const INTAKE_D: TailorIntake = { state: 'scattered', focus: 'decision', tone: 'clarity', freeText: 'Two offers on the table.' };

const RESPONSE = {
  ok: true,
  date: DATE,
  narratorId: 'martin',
  narratorName: 'Martin',
  passage: { citation: 'Psalm 90:17', text: 'And let the brightness of the Lord our God be upon us.', translation: 'Douay-Rheims' },
  reflect: 'A tailored reflection.',
  challenge: 'One tailored act.',
  traditionQuote: { text: 'Pray, hope, and don’t worry.', author: 'St. Padre Pio' },
  media: {
    kind: 'song',
    title: "They'll Know We Are Christians",
    creator: 'Peter Scholtes',
    url: 'https://www.youtube.com/results?search_query=x',
    why: 'Chosen for today.',
  },
  audioBase64: 'QUJD',
  audioSeconds: 240,
};

function memoryStore(): TailorStore & {
  map: Map<string, TailoredDevotional>;
  piecesMap: Map<string, TailorPieceBank>;
} {
  const map = new Map<string, TailoredDevotional>();
  const piecesMap = new Map<string, TailorPieceBank>();
  return {
    map,
    piecesMap,
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async getPieces(key) {
      return piecesMap.get(key) ?? null;
    },
    async setPieces(key, value) {
      piecesMap.set(key, value);
    },
    async deletePieces(key) {
      piecesMap.delete(key);
    },
  };
}

/** A build fetch that counts its calls and answers per focus, so each build's package is its own. */
function countingBuildFetch(counter: { n: number }) {
  return vi.fn(async (_url: string, init?: { body?: string }) => {
    counter.n += 1;
    const body = JSON.parse(init?.body ?? '{}') as { focus?: string };
    return {
      ok: true,
      status: 200,
      json: async () => ({ ...RESPONSE, challenge: `Challenge for ${body.focus}` }),
    } as Response;
  }) as unknown as typeof fetch;
}

function stubLocalStorage() {
  const original = globalThis.localStorage;
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    } as Storage,
  });
  return () => {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  };
}

describe("the day's build index", () => {
  let restore: () => void;
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    restore = stubLocalStorage();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    restore();
  });

  it('accumulates distinct builds in build order, each with the ask it answered', async () => {
    const store = memoryStore();
    const counter = { n: 0 };
    const fetchImpl = countingBuildFetch(counter);

    await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_B, { fetchImpl, store });
    expect(counter.n).toBe(2);

    const builds = readTailorBuilds(DATE, 'men');
    expect(builds).toHaveLength(2);
    expect(builds[0].hash).toBe(intakeHash(INTAKE_A));
    expect(builds[0]).toMatchObject({ focus: 'work', state: 'anxious', tone: 'courage' });
    expect(builds[1].hash).toBe(intakeHash(INTAKE_B));
    expect(builds[1]).toMatchObject({ focus: 'family', state: 'steady', tone: 'comfort' });
    expect(builds[0].builtAt).toBeGreaterThan(0);
    expect(builds[1].builtAt).toBeGreaterThanOrEqual(builds[0].builtAt);

    // The standing record names the LATEST build — hash, focus, and the
    // morning record tonight's close will re-send.
    const meta = readTailorMeta(DATE, 'men');
    expect(meta?.hash).toBe(intakeHash(INTAKE_B));
    expect(meta?.focus).toBe('family');
    expect(meta?.morning).toMatchObject({ state: 'steady', focus: 'family', tone: 'comfort' });

    // The other track's day is its own — no index leaks across.
    expect(readTailorBuilds(DATE, 'women')).toEqual([]);
  });

  it('a replay is not a new entry, never reaches the server, and never moves the standing record', async () => {
    const store = memoryStore();
    const counter = { n: 0 };
    const fetchImpl = countingBuildFetch(counter);

    await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_B, { fetchImpl, store });
    const replay = await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });

    expect(replay.fromCache).toBe(true);
    expect(counter.n).toBe(2); // the replay never touched the server
    expect(readTailorBuilds(DATE, 'men').map((b) => b.hash)).toEqual([
      intakeHash(INTAKE_A),
      intakeHash(INTAKE_B),
    ]);
    // A replay is not a build: the standing record still names B.
    expect(readTailorMeta(DATE, 'men')?.hash).toBe(intakeHash(INTAKE_B));
  });

  it("each fresh build still offers its sentence to the letter threads — the day's latest build wins the day's one slot", async () => {
    const store = memoryStore();
    const counter = { n: 0 };
    const fetchImpl = countingBuildFetch(counter);
    await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_C, { fetchImpl, store });
    // The threads keep one entry per day (their standing rule): the
    // second build's offering replaced the first's for this date —
    // the append happened per fresh build, as it always has.
    const threads = JSON.parse(localStorage.getItem(LETTER_THREADS_KEY) ?? '[]') as {
      date: string;
      sentence: string;
    }[];
    expect(threads).toEqual([
      expect.objectContaining({ date: DATE, sentence: 'Anniversary week.' }),
    ]);
  });

  it('a pre-index meta still reads as its one build, and the next build joins it', async () => {
    const store = memoryStore();
    const counter = { n: 0 };
    const fetchImpl = countingBuildFetch(counter);
    // A meta written before the index existed: hash + morning record only.
    localStorage.setItem(
      tailorMetaKey(DATE, 'men'),
      JSON.stringify({
        hash: 'legacyhash',
        narratorName: 'Martin',
        at: 1763530800000,
        focus: 'work',
        morning: { state: 'anxious', focus: 'work', tone: 'courage', freeText: 'Old words.' },
      }),
    );
    expect(readTailorBuilds(DATE, 'men')).toEqual([
      { hash: 'legacyhash', builtAt: 1763530800000, focus: 'work', state: 'anxious', tone: 'courage' },
    ]);

    await getOrBuildTailored(DATE, 'men', INTAKE_B, { fetchImpl, store });
    const builds = readTailorBuilds(DATE, 'men');
    expect(builds.map((b) => b.hash)).toEqual(['legacyhash', intakeHash(INTAKE_B)]);
    expect(readTailorMeta(DATE, 'men')?.morning?.focus).toBe('family');
  });

  it('a malformed index drops its bad entries, never the meta', async () => {
    localStorage.setItem(
      tailorMetaKey(DATE, 'men'),
      JSON.stringify({
        hash: 'standinghash',
        narratorName: 'Martin',
        at: 1763530800000,
        morning: { state: 'steady', focus: 'today', tone: 'comfort', freeText: '' },
        builds: [
          { hash: 42, builtAt: 1, focus: 'work', state: 'steady', tone: 'comfort' },
          { hash: 'bad-date', builtAt: 'soon', focus: 'work', state: 'steady', tone: 'comfort' },
          { hash: 'bad-enum', builtAt: 5, focus: 'nope', state: 'steady', tone: 'comfort' },
          { hash: 'good', builtAt: 6, focus: 'work', state: 'anxious', tone: 'courage' },
          { hash: 'good', builtAt: 7, focus: 'family', state: 'steady', tone: 'comfort' },
        ],
      }),
    );
    expect(readTailorBuilds(DATE, 'men')).toEqual([
      { hash: 'good', builtAt: 6, focus: 'work', state: 'anxious', tone: 'courage' },
    ]);
    expect(readTailorMeta(DATE, 'men')?.hash).toBe('standinghash');
  });
});

describe("the day's cap — three builds, and a fourth refused on the device", () => {
  let restore: () => void;
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
    restore = stubLocalStorage();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    restore();
  });

  it('the fourth distinct intake throws the limit error BEFORE any call; the three stand usable', async () => {
    const store = memoryStore();
    const counter = { n: 0 };
    const fetchImpl = countingBuildFetch(counter);

    await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_B, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_C, { fetchImpl, store });
    expect(counter.n).toBe(3);
    expect(readTailorBuilds(DATE, 'men')).toHaveLength(TAILOR_DAILY_BUILD_LIMIT);

    const err = await getOrBuildTailored(DATE, 'men', INTAKE_D, { fetchImpl, store }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(TailorDailyLimitError);
    expect((err as TailorDailyLimitError).code).toBe('tailor-daily-limit');
    expect((err as Error).message).toBe('tailor-daily-limit');
    // NO fourth call was made — the refusal happened on the device.
    expect(counter.n).toBe(3);
    expect(readTailorBuilds(DATE, 'men')).toHaveLength(3);

    // The three standing builds stay fully usable, each by its hash…
    for (const intake of [INTAKE_A, INTAKE_B, INTAKE_C]) {
      const pkg = await loadTailoredBuild(DATE, 'men', intakeHash(intake), { store });
      expect(pkg?.challenge).toBe(`Challenge for ${intake.focus}`);
    }
    // …the latest is still the standing record…
    const latest = await loadTodaysTailored(DATE, 'men', { store });
    expect(latest?.challenge).toBe('Challenge for marriage');
    // …and a replay of an existing build is not a new build — never blocked.
    const replay = await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    expect(replay.fromCache).toBe(true);
    expect(counter.n).toBe(3);

    // The cap is per track: the women's day is untouched by the men's.
    await getOrBuildTailored(DATE, 'women', INTAKE_D, { fetchImpl, store });
    expect(counter.n).toBe(4);
    expect(readTailorBuilds(DATE, 'women')).toHaveLength(1);
  });

  it('an intake the index already counts is not new — a lost package may be rebuilt at the cap', async () => {
    const store = memoryStore();
    const counter = { n: 0 };
    const fetchImpl = countingBuildFetch(counter);
    await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_B, { fetchImpl, store });
    await getOrBuildTailored(DATE, 'men', INTAKE_C, { fetchImpl, store });
    expect(counter.n).toBe(3);

    // The cache loses build A's package (eviction, say) — the index
    // still counts A, so re-asking A goes through, and the index
    // keeps A's first hour rather than appending a duplicate.
    store.map.delete([...store.map.keys()].find((k) => k.endsWith(`/${intakeHash(INTAKE_A)}`))!);
    const rebuilt = await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl, store });
    expect(rebuilt.fromCache).toBe(false);
    expect(counter.n).toBe(4);
    const builds = readTailorBuilds(DATE, 'men');
    expect(builds.map((b) => b.hash)).toEqual([
      intakeHash(INTAKE_A),
      intakeHash(INTAKE_B),
      intakeHash(INTAKE_C),
    ]);
  });
});

describe('per-build piece banks — one build’s stitch never serves another’s', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      data: new Map<string, string>(),
      getItem(k: string) {
        return this.data.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.data.set(k, v);
      },
      removeItem(k: string) {
        this.data.delete(k);
      },
    });
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const noSleep = async () => {};

  const PLAN_A = [0, 1, 2].map((i) => ({ index: i, text: `A piece ${i}`, token: `tok-work-${i}` }));
  const PLAN_B = [0, 1, 2].map((i) => ({ index: i, text: `B piece ${i}`, token: `tok-family-${i}` }));
  /** A: ABC·DEF·GHI; B: JKL·MNO·PQR — no byte is shared between the builds. */
  const AUDIO_BY_TOKEN: Record<string, string> = {
    'tok-work-0': 'QUJD',
    'tok-work-1': 'REVG',
    'tok-work-2': 'R0hJ',
    'tok-family-0': 'SktM',
    'tok-family-1': 'TU5P',
    'tok-family-2': 'UFFS',
  };

  it('banks, merges, and caches stay under each build’s own key', async () => {
    const store = memoryStore();
    const buildFetch = vi.fn(async (_url: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? '{}') as { focus?: string };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...RESPONSE,
          audioBase64: null,
          audioSeconds: 0,
          audioPlan: body.focus === 'family' ? PLAN_B : PLAN_A,
          challenge: `Challenge for ${body.focus}`,
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const a = await getOrBuildTailored(DATE, 'men', INTAKE_A, { fetchImpl: buildFetch, store });
    const b = await getOrBuildTailored(DATE, 'men', INTAKE_B, { fetchImpl: buildFetch, store });
    const hashA = intakeHash(INTAKE_A);
    const hashB = intakeHash(INTAKE_B);
    // The meta's standing record is B (the latest) — A's stitch must
    // still bank under A's key, which is the whole point of buildHash.
    expect(readTailorMeta(DATE, 'men')?.hash).toBe(hashB);

    const failing = new Set<string>(['tok-work-1']);
    const pieceCalls: string[] = [];
    const pieceFetch = vi.fn(async (_url: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? '{}') as { piece: { token: string } };
      pieceCalls.push(body.piece.token);
      if (failing.has(body.piece.token)) {
        return { ok: false, status: 403, json: async () => ({ ok: false }) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, audioBase64: AUDIO_BY_TOKEN[body.piece.token], seconds: 10 }),
      } as Response;
    }) as unknown as typeof fetch;

    // A's stitch fails on its middle piece: A resolves null, and ONLY
    // A's bank exists — keyed under A's own store key, holding A's
    // landed pieces, nothing of B's.
    const aMerged = await fetchTailorAudio(DATE, 'men', a.devotional, {
      fetchImpl: pieceFetch,
      store,
      sleep: noSleep,
      buildHash: hashA,
    });
    expect(aMerged).toBeNull();
    expect(store.piecesMap.size).toBe(1);
    const [aBankKey, aBank] = [...store.piecesMap.entries()][0];
    expect(aBankKey.startsWith(`https://tailor.sanctum.local/${DATE}/men/${hashA}:pieces`)).toBe(true);
    expect(Object.keys(aBank.byIndex).sort()).toEqual(['0', '2']);
    expect(aBank.byIndex['0'].audioBase64).toBe('QUJD');
    // A's cached package is untouched: text standing, plan intact.
    const aCached = await loadTailoredBuild(DATE, 'men', hashA, { store });
    expect(aCached?.audioBase64).toBeNull();
    expect(aCached?.audioPlan).toEqual(PLAN_A);

    // B stitches clean from ITS bank: B's audio is B's bytes only, B's
    // bank is deleted behind it, and A's bank still stands untouched.
    const bMerged = await fetchTailorAudio(DATE, 'men', b.devotional, {
      fetchImpl: pieceFetch,
      store,
      sleep: noSleep,
      buildHash: hashB,
    });
    expect(bMerged?.audioBase64).toBe('SktMTU5PUFFS');
    expect(store.piecesMap.size).toBe(1);
    expect([...store.piecesMap.keys()][0]).toBe(aBankKey);
    expect((await loadTailoredBuild(DATE, 'men', hashB, { store }))?.audioBase64).toBe('SktMTU5PUFFS');

    // A resumes: with the failure gone, only A's missing piece is
    // fetched — B's banked pieces were never A's to spend.
    failing.clear();
    pieceCalls.length = 0;
    const aResumed = await fetchTailorAudio(DATE, 'men', a.devotional, {
      fetchImpl: pieceFetch,
      store,
      sleep: noSleep,
      buildHash: hashA,
    });
    expect(aResumed?.audioBase64).toBe('QUJDREVGR0hJ');
    expect(pieceCalls).toEqual(['tok-work-1']);
    expect(store.piecesMap.size).toBe(0);
    expect((await loadTailoredBuild(DATE, 'men', hashA, { store }))?.audioBase64).toBe('QUJDREVGR0hJ');
    // And the standing record never moved: today still loads B.
    expect((await loadTodaysTailored(DATE, 'men', { store }))?.challenge).toBe('Challenge for family');
  });
});

describe('the build switcher', () => {
  const t = getSeasonTheme(new Date(2026, 10, 19), 'men');
  const at = (hour: number, minute: number) => new Date(2026, 10, 19, hour, minute).getTime();
  // The label as it lands in the page — React escapes the focus
  // labels' ampersands ("Work & career") on the way out.
  const label = (ts: number, focus: 'work' | 'family') =>
    `${new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${tailorFocusLabel(focus)}`.replace(
      /&/g,
      '&amp;',
    );
  const entry = (hash: string, builtAt: number, focus: 'work' | 'family') => ({
    hash,
    builtAt,
    focus,
    state: 'steady' as const,
    tone: 'comfort' as const,
  });

  it('renders nothing for a one-build day — the row exists only when there is somewhere to walk', () => {
    expect(
      renderToString(
        createElement(TailorBuildSwitcher, { t, builds: [entry('h1', at(7, 2), 'work')], openHash: 'h1', onOpen: () => {} }),
      ),
    ).toBe('');
    expect(
      renderToString(createElement(TailorBuildSwitcher, { t, builds: [], openHash: null, onOpen: () => {} })),
    ).toBe('');
  });

  it('names each build by its hour and its morning, with the open one pressed', () => {
    const morning = at(7, 2);
    const midday = at(12, 45);
    const html = renderToString(
      createElement(TailorBuildSwitcher, {
        t,
        builds: [entry('h1', morning, 'work'), entry('h2', midday, 'family')],
        openHash: 'h2',
        onOpen: () => {},
      }),
    );
    expect(html).toContain('Today’s devotionals');
    const firstLabel = label(morning, 'work');
    const secondLabel = label(midday, 'family');
    expect(html).toContain(firstLabel);
    expect(html).toContain(secondLabel);
    // The unopened chip stands unpressed before the opened one's press.
    expect(html.indexOf('aria-pressed="false"')).toBeLessThan(html.indexOf(firstLabel));
    expect(html.indexOf('aria-pressed="true"')).toBeGreaterThan(html.indexOf(firstLabel));
    expect(html.indexOf('aria-pressed="true"')).toBeLessThan(html.indexOf(secondLabel));
  });
});

describe('the panic wipe takes the index with the meta', () => {
  // A Storage whose data keys are its own enumerable properties — the
  // shape the wipe enumerates with Object.keys (the house test stub).
  function makeStorage(): Storage {
    const store: Record<string, string> = {};
    Object.defineProperties(store, {
      getItem: { value: (k: string) => (k in store ? store[k] : null) },
      setItem: {
        value: (k: string, v: string) => {
          store[k] = String(v);
        },
      },
      removeItem: {
        value: (k: string) => {
          delete store[k];
        },
      },
      clear: {
        value: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
      },
    });
    return store as unknown as Storage;
  }

  it('the build index lives inside the meta line, under the sanctum_ prefix the wipe sweeps', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
    try {
      const key = tailorMetaKey(DATE, 'men');
      // No new key was introduced for the index: it rides the meta
      // line, which already lives under the wiped prefix.
      expect(key.startsWith('sanctum_')).toBe(true);
      localStorage.setItem(
        key,
        JSON.stringify({
          hash: 'h1',
          narratorName: 'Martin',
          at: 1763530800000,
          builds: [{ hash: 'h1', builtAt: 1763530800000, focus: 'work', state: 'steady', tone: 'comfort' }],
        }),
      );
      localStorage.setItem('unrelated-key', 'x');
      wipeAllSanctumData();
      expect(localStorage.getItem(key)).toBeNull();
      expect(localStorage.getItem('unrelated-key')).toBe('x');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });
});
