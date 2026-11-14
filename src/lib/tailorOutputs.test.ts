import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MEDIA_CATALOG,
  bestCatalogMedia,
  type TailorMedia,
} from '@/data/tailorBank';
import {
  composeTailored,
  type TailorBundle,
} from '../../supabase/functions/tailor-devotional/tailorCore';
import {
  TAILOR_BUILD_STAMP,
  buildOutputRow,
  loadMediaWinners,
  recordComposedOutput,
  type OutputsTransport,
} from '../../supabase/functions/tailor-devotional/outputs';

const ROOT = join(__dirname, '..', '..');
const readRoot = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Tailor's output record (Nov 13, 2026, Erik's ruling): what a build RETURNS
 * is recorded — the devotional's own text for quality review, and a winning
 * live find (a public link) for the growing library — while what the user
 * ISSUED is never written anywhere. These pins hold both halves: the exact
 * field set that may be recorded, and the structural absence of the intake
 * from the only module allowed to write.
 */

const BUNDLE: TailorBundle = {
  celebration: null,
  gospelCitation: 'John 6:37-40',
  gospelText: 'GOSPEL TEXT VERBATIM — All that the Father giveth to me shall come to me.',
  readings: [
    { kind: 'first', citation: '1 Kings 19:11-13', text: 'FIRST READING VERBATIM TEXT.' },
    { kind: 'psalm', citation: 'Psalm 27', text: 'PSALM VERBATIM TEXT.' },
    { kind: 'gospel', citation: 'John 6:37-40', text: 'GOSPEL TEXT VERBATIM — All that the Father giveth to me shall come to me.' },
  ],
  reflect: 'The canonical reflection, for everyone.',
  challenge: 'The canonical challenge.',
  facet: 'As a man',
};

const INTAKE = { state: 'anxious' as const, focus: 'work' as const, tone: 'courage' as const, freeText: 'Big review at 2.' };

const GROUNDED_DEMONS = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '{"title": "Demons", "creator": "Imagine Dragons", "kind": "song", "url": "https://www.youtube.com/watch?v=mWRsgZuwf_8"}',
          },
        ],
      },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://www.youtube.com/watch?v=mWRsgZuwf_8', title: 'Imagine Dragons - Demons (Official Music Video)' } },
        ],
      },
    },
  ],
};

function scorerReplyWithTags(scores: Record<string, unknown>[]) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify({ scores }) }] } }],
  };
}

const generateTailored = async () => ({
  reflect: 'TAILORED REFLECTION — aimed at the review at two.',
  challenge: 'TAILORED CHALLENGE — one concrete act.',
});

/** A build whose live hunt wins the card, with the scorer's tags for the work. */
async function liveWinComposed() {
  return composeTailored({
    dateISO: '2026-11-12',
    audience: 'men',
    intake: INTAKE,
    bundle: BUNDLE,
    generateTailored,
    findMedia: async () => GROUNDED_DEMONS,
    scoreMedia: async () =>
      scorerReplyWithTags([
        {
          fit: 40,
          alignment: 35,
          popularity: 25,
          focuses: ['temptation'],
          states: ['down', 'numb'],
          tones: ['challenge'],
        },
      ]),
    hour: 7,
  });
}

interface CapturedCall {
  url: string;
  method: string;
  prefer: string | null;
  body: Record<string, unknown> | null;
}

/** An outputs transport whose fetch is a stub: captures every call, answers reads from `readReply`. */
function stubTransport(calls: CapturedCall[], readReply: unknown = []): OutputsTransport {
  return {
    baseUrl: 'https://db.example',
    serviceKey: 'service-key',
    fetchFn: (async (url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      calls.push({
        url: u,
        method,
        prefer: init?.headers?.Prefer ?? null,
        body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null,
      });
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => readReply } as Response;
      }
      return { ok: true, status: 201, json: async () => null } as Response;
    }) as unknown as typeof fetch,
  };
}

describe('outputs — the source pin: the write path cannot see the intake', () => {
  const outputs = readRoot('supabase/functions/tailor-devotional/outputs.ts');

  it('no intake identifier appears anywhere in the module — words, fields, or helpers', () => {
    expect(outputs).not.toMatch(/\bfreeText\b/);
    expect(outputs).not.toMatch(/\bgoal\b/);
    expect(outputs).not.toMatch(/\bprofile\b/);
    expect(outputs).not.toMatch(/\bstate\b/);
    expect(outputs).not.toMatch(/\bfocus\b/);
    expect(outputs).not.toMatch(/\btone\b/);
    expect(outputs).not.toMatch(/\bip\b/);
    expect(outputs).not.toContain('TailorIntake');
    expect(outputs).not.toContain('TailorProfileInput');
    expect(outputs).not.toContain('validateIntake');
    expect(outputs).not.toContain('validateProfile');
    expect(outputs).not.toContain('standingGoal');
    expect(outputs).not.toContain('clientIdentifier');
    expect(outputs).not.toContain('hashClientKey');
  });

  it('the module writes only the two output tables, and uploads nothing', () => {
    expect(outputs).toContain('"tailor_outputs"');
    expect(outputs).toContain('media_winners');
    expect(outputs).not.toContain('/storage/v1/object');
    expect(outputs).not.toContain('daily_reflections');
    expect(outputs).not.toContain('daily_readings');
  });

  it('index.ts delegates: the writes live in outputs.ts and nowhere else in the handler', () => {
    const fnIndex = readRoot('supabase/functions/tailor-devotional/index.ts');
    expect(fnIndex).toContain('from "./outputs.ts"');
    expect(fnIndex).toContain('recordComposedOutput(dateISO, audience, composed)');
    expect(fnIndex).toContain('loadWinners: () => loadMediaWinners()');
    expect(fnIndex).not.toMatch(/\.upsert\(/);
    expect(fnIndex).not.toMatch(/\.insert\(/);
  });
});

describe('the recorded row — the package’s fields, exactly', () => {
  it('buildOutputRow carries exactly the allowed keys', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      datasetQuote: null,
      hour: 7,
    });
    const row = buildOutputRow('2026-11-12', 'men', composed);
    expect(Object.keys(row).sort()).toEqual(
      [
        'audience',
        'build_stamp',
        'challenge',
        'devotional_date',
        'media_creator',
        'media_kind',
        'media_title',
        'media_url',
        'narrator',
        'passage_citation',
        'passage_text',
        'quote_source',
        'quote_text',
        'reflection',
      ].sort(),
    );
    expect(row.devotional_date).toBe('2026-11-12');
    expect(row.audience).toBe('men');
    expect(row.reflection).toBe('TAILORED REFLECTION — aimed at the review at two.');
    expect(row.challenge).toBe('TAILORED CHALLENGE — one concrete act.');
    expect(row.passage_citation).toBe(composed.passage.citation);
    expect(row.passage_text).toBe(composed.passage.text);
    // No quote this build (the dataset seam was nulled): the columns ride null, not invented.
    expect(row.quote_text).toBeNull();
    expect(row.quote_source).toBeNull();
    expect(row.media_url).toBe(composed.media.url);
    expect(row.narrator).toBe(composed.script.persona);
    expect(row.build_stamp).toBe(TAILOR_BUILD_STAMP);
  });

  it('a captured insert posts exactly that row to tailor_outputs and nothing else', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      hour: 7,
    });
    const calls: CapturedCall[] = [];
    await recordComposedOutput('2026-11-12', 'men', composed, { transport: stubTransport(calls) });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://db.example/rest/v1/tailor_outputs');
    expect(calls[0].body).toEqual(buildOutputRow('2026-11-12', 'men', composed));
  });
});

describe('the winner capture — live wins only, with the scorer’s tags', () => {
  it('a live win upserts media_winners with scorer-derived tags and the unscaled axes', async () => {
    const composed = await liveWinComposed();
    expect(composed.mediaWin.source).toBe('live');
    expect(composed.mediaWin.popularity).toBe(100);
    expect(composed.mediaWin.values).toBe(100);
    const calls: CapturedCall[] = [];
    const now = new Date('2026-11-13T15:00:00.000Z');
    await recordComposedOutput('2026-11-12', 'men', composed, {
      transport: stubTransport(calls, [{ win_count: 3 }]),
      now: () => now,
    });
    const winnerCalls = calls.filter((c) => c.url.includes('media_winners'));
    expect(winnerCalls).toHaveLength(2); // the count read, then the upsert
    const upsert = winnerCalls[1];
    expect(upsert.method).toBe('POST');
    expect(upsert.url).toContain('on_conflict=url');
    expect(upsert.prefer).toContain('resolution=merge-duplicates');
    expect(upsert.body).toEqual({
      title: 'Demons',
      creator: 'Imagine Dragons',
      url: 'https://www.youtube.com/watch?v=mWRsgZuwf_8',
      kind: 'song',
      focus_tags: ['temptation'],
      state_tags: ['down', 'numb'],
      tone_tags: ['challenge'],
      popularity: 100,
      values_score: 100,
      win_count: 4,
      last_won_at: '2026-11-13T15:00:00.000Z',
    });
  });

  it('a first win starts the count at one', async () => {
    const composed = await liveWinComposed();
    const calls: CapturedCall[] = [];
    await recordComposedOutput('2026-11-12', 'men', composed, { transport: stubTransport(calls, []) });
    const upsert = calls.find((c) => c.url.includes('on_conflict=url'));
    expect(upsert?.body?.win_count).toBe(1);
  });

  it('a catalog win writes no winner row at all', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: INTAKE,
      bundle: BUNDLE,
      generateTailored,
      hour: 7,
    });
    expect(composed.mediaWin.source).toBe('catalog');
    const calls: CapturedCall[] = [];
    await recordComposedOutput('2026-11-12', 'men', composed, { transport: stubTransport(calls) });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('tailor_outputs');
  });
});

describe('fail-open — the record can never touch the build', () => {
  it('a throwing transport still resolves, for record and for the library read', async () => {
    const throwing: OutputsTransport = {
      baseUrl: 'https://db.example',
      serviceKey: 'service-key',
      fetchFn: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    };
    const composed = await liveWinComposed();
    await expect(
      recordComposedOutput('2026-11-12', 'men', composed, { transport: throwing }),
    ).resolves.toBeUndefined();
    await expect(loadMediaWinners({ transport: throwing })).resolves.toEqual([]);
  });

  it('an unconfigured transport records nothing and reads an empty library', async () => {
    const composed = await liveWinComposed();
    await expect(
      recordComposedOutput('2026-11-12', 'men', composed, { transport: null }),
    ).resolves.toBeUndefined();
    await expect(loadMediaWinners({ transport: null })).resolves.toEqual([]);
  });
});

describe('the grown library joins the pool', () => {
  const GROWN: TailorMedia = {
    kind: 'song',
    title: 'A Grown Winner',
    creator: 'The Library',
    url: 'https://www.youtube.com/watch?v=grown000001',
    blurb: 'A winning find from a past morning.',
    focuses: ['grief'],
    states: ['down'],
    tones: ['consolation'],
    popularity: 100,
    values: 100,
    valuesNote: 'Judged on the morning it won.',
  };

  it('bestCatalogMedia scores merged rows on the same axes — a perfect grown fit wins', () => {
    const best = bestCatalogMedia('grief', 'down', 'consolation', '2026-11-12', [GROWN]);
    expect(best?.media.url).toBe(GROWN.url);
    expect(best?.axes.total).toBe(100);
    // Without the merge, the seed's own best is a different, lower work.
    const seedOnly = bestCatalogMedia('grief', 'down', 'consolation', '2026-11-12');
    expect(seedOnly?.media.url).not.toBe(GROWN.url);
    expect(seedOnly?.axes.total).toBeLessThan(100);
  });

  it('a grown row duplicating a seed address is ignored, not double-scored', () => {
    const dupe: TailorMedia = { ...GROWN, url: MEDIA_CATALOG[0].url };
    const withDupe = bestCatalogMedia('decision', 'scattered', 'clarity', '2026-11-12', [dupe]);
    const seedOnly = bestCatalogMedia('decision', 'scattered', 'clarity', '2026-11-12');
    expect(withDupe?.media.url).toBe(seedOnly?.media.url);
    expect(withDupe?.axes.total).toBe(seedOnly?.axes.total);
  });

  it('loadMediaWinners maps rows into the catalog shape and drops untrustworthy ones', async () => {
    const rows = [
      {
        title: 'A Talk Worth Keeping',
        creator: 'Some Speaker',
        url: 'https://www.youtube.com/watch?v=talk0000001',
        kind: 'video',
        focus_tags: ['work', 'not-a-focus'],
        state_tags: ['anxious'],
        tone_tags: [],
        popularity: 88,
        values_score: 91,
      },
      { title: 'Broken Row', creator: '', url: 'not-a-url', kind: 'song', focus_tags: [], state_tags: [], tone_tags: [], popularity: 50, values_score: 50 },
      { title: 'No Scores', creator: 'X', url: 'https://www.youtube.com/watch?v=xxxxxxxxxxx', kind: 'song', focus_tags: [], state_tags: [], tone_tags: [], popularity: null, values_score: 50 },
    ];
    const calls: CapturedCall[] = [];
    const winners = await loadMediaWinners({ transport: stubTransport(calls, rows) });
    expect(calls[0].url).toContain('order=last_won_at.desc');
    expect(calls[0].url).toContain('limit=200');
    expect(winners).toHaveLength(1);
    expect(winners[0].kind).toBe('clip'); // the search's broader kind, carried into the catalog's five
    expect(winners[0].focuses).toEqual(['work']);
    expect(winners[0].popularity).toBe(88);
    expect(winners[0].values).toBe(91);
  });

  it('a compose with the library merged can serve the grown winner — as a catalog win, not a live one', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: { state: 'down', focus: 'grief', tone: 'consolation', freeText: '' },
      bundle: BUNDLE,
      generateTailored,
      loadWinners: async () => [GROWN],
      hour: 7,
    });
    expect(composed.media.url).toBe(GROWN.url);
    expect(composed.mediaWin.source).toBe('catalog');
  });

  it('a failed library read degrades to the seed pool, silently', async () => {
    const composed = await composeTailored({
      dateISO: '2026-11-12',
      audience: 'men',
      intake: { state: 'down', focus: 'grief', tone: 'consolation', freeText: '' },
      bundle: BUNDLE,
      generateTailored,
      loadWinners: async () => {
        throw new Error('read down');
      },
      hour: 7,
    });
    expect(MEDIA_CATALOG.some((m) => m.url === composed.media.url)).toBe(true);
  });
});

describe('the migration — the outputs table holds no answers', () => {
  const migration = readRoot(
    'supabase/migrations/20261113120000_create_tailor_outputs_and_media_winners.sql',
  );

  it('tailor_outputs carries exactly the output columns — no input-shaped column exists', () => {
    const start = migration.indexOf('CREATE TABLE IF NOT EXISTS public.tailor_outputs');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = migration.slice(start, migration.indexOf(');', start));
    for (const col of [
      'devotional_date', 'audience', 'reflection', 'challenge',
      'passage_citation', 'passage_text', 'quote_text', 'quote_source',
      'media_title', 'media_creator', 'media_url', 'media_kind',
      'narrator', 'build_stamp',
    ]) {
      expect(block).toContain(col);
    }
    expect(block).not.toMatch(/\bstate\b/);
    expect(block).not.toMatch(/\bfocus\b/);
    expect(block).not.toMatch(/\btone\b/);
    expect(block).not.toMatch(/\bgoal\b/);
    expect(block).not.toMatch(/\bprofile\b/);
    expect(block).not.toMatch(/\bip\b/);
    expect(block).not.toMatch(/free_?text/i);
    expect(block).not.toContain('focus_tags');
    expect(block).not.toContain('state_tags');
    expect(block).not.toContain('tone_tags');
  });

  it('media_winners is keyed by the work’s own address and is never retention-deleted', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.media_winners');
    expect(migration).toMatch(/url text UNIQUE/);
    expect(migration).toContain('win_count integer NOT NULL DEFAULT 1');
    const retention = migration.slice(migration.indexOf("cron.schedule(\n  'tailor-outputs-retention'"));
    expect(retention).toContain('public.tailor_outputs');
    expect(retention).toContain("interval '90 days'");
    expect(retention).not.toContain('media_winners');
    expect(migration).not.toContain('net.http_post');
    expect(migration).not.toContain('.supabase.co');
  });

  it('both tables sit behind the lockdown: RLS on, privileges revoked, deny policies', () => {
    for (const table of ['tailor_outputs', 'media_winners']) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`);
      expect(migration).toContain(`deny_select_${table}`);
      expect(migration).toContain(`deny_insert_${table}`);
      expect(migration).toContain(`deny_update_${table}`);
      expect(migration).toContain(`deny_delete_${table}`);
    }
  });
});
