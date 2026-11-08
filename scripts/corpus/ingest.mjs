#!/usr/bin/env node
/*
  Corpus ingest CLI (spec §3.3). One-command stages:

    node scripts/corpus/ingest.mjs chunk [--work id,id] [--phase 0|1]
    node scripts/corpus/ingest.mjs report
    node scripts/corpus/ingest.mjs embed [--work id,id] [--phase 0|1] [--stub]
    node scripts/corpus/ingest.mjs load  [--work id,id] [--phase 0|1]

  - chunk: fetch (cached) → parse → chunk → out/<work>.chunks.jsonl (+ document
    record) and a manifest entry with measured counts.
  - report: measured per-work counts, token estimates, and the embedding price
    projection — the §12.3 dry-run price gate, printed before any spend.
  - embed: real embeddings via GEMINI_API_KEY (environment or .env.local),
    checkpointed per work. --stub writes deterministic placeholder vectors to
    validate plumbing with zero spend; stub rows are marked and load REFUSES
    them, always.
  - load: upserts documents + chunks via the service role
    (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment or .env.local).
    Without those variables it prints a dry-run summary and changes nothing.

  Every stage is idempotent and resumable: caches and checkpoints live under
  scripts/corpus/raw/ and scripts/corpus/out/ (both gitignored); the manifest
  at scripts/corpus/manifest.jsonl is the committed build record.
*/

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMBED_USD_PER_MTOK, appendManifest, embedWork, ensureDirs, estimateTokens,
  loadEnv, outDir, readChunks, readEmbeddings, writeChunks, writeDocumentRecord,
} from './lib.mjs';
import { WORKS } from './works.mjs';

const args = process.argv.slice(2);
const stage = args[0];
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const workFilter = flag('--work') ? flag('--work').split(',') : null;
const phaseFilter = flag('--phase') ? Number(flag('--phase')) : null;
const selected = WORKS.filter(
  (w) => (!workFilter || workFilter.includes(w.doc.id)) && (phaseFilter === null || w.phase === phaseFilter),
);

function priceFor(tokens) {
  return (tokens / 1_000_000) * EMBED_USD_PER_MTOK;
}

async function doChunk() {
  ensureDirs();
  for (const work of selected) {
    process.stdout.write(`chunk ${work.doc.id} … `);
    const { chunks, stats } = await work.adapter(work.doc);
    writeChunks(work.doc, chunks);
    writeDocumentRecord(work.doc, chunks);
    const tokens = estimateTokens(chunks);
    appendManifest({ stage: 'chunk', work: work.doc.id, phase: work.phase, chunks: chunks.length, chars: chunks.reduce((s, c) => s + c.char_count, 0), estTokens: tokens, stats });
    console.log(`${chunks.length} chunks, ~${tokens.toLocaleString()} tokens, stats: ${JSON.stringify(stats).slice(0, 300)}`);
  }
}

function collectRows() {
  const rows = [];
  for (const work of WORKS) {
    const chunks = readChunks(work.doc.id);
    if (!chunks) continue;
    rows.push({ work, chunks, tokens: estimateTokens(chunks), chars: chunks.reduce((s, c) => s + c.char_count, 0) });
  }
  return rows;
}

function doReport() {
  const rows = collectRows();
  console.log('\nCorpus — measured counts and embedding price projection (standard rate $0.15/Mtok; async batch ≈ half)');
  let p0 = { chunks: 0, tokens: 0 };
  let p1 = { chunks: 0, tokens: 0 };
  for (const r of rows) {
    console.log(
      `  ${r.work.doc.id.padEnd(26)} phase ${r.work.phase}  ${String(r.chunks.length).padStart(6)} chunks  ${String(r.chars).padStart(10)} chars  ~${r.tokens.toLocaleString().padStart(9)} tokens  ~$${priceFor(r.tokens).toFixed(2)}`,
    );
    const bucket = r.work.phase === 0 ? p0 : p1;
    bucket.chunks += r.chunks.length;
    bucket.tokens += r.tokens;
  }
  const totalTokens = p0.tokens + p1.tokens;
  console.log(`  Phase 0 total: ${p0.chunks} chunks, ~$${priceFor(p0.tokens).toFixed(2)}`);
  console.log(`  Phase 1 total: ${p1.chunks} chunks, ~$${priceFor(p1.tokens).toFixed(2)}`);
  console.log(`  P0+P1 projection: ~${totalTokens.toLocaleString()} tokens → ~$${priceFor(totalTokens).toFixed(2)} standard (~$${(priceFor(totalTokens) / 2).toFixed(2)} batch)`);
  console.log(priceFor(totalTokens) > 10 ? '  ⚠ OVER the $10 hard-stop line (spec §12.3) — do not embed.' : '  ✓ Under the $10 hard-stop line.');
}

async function doEmbed() {
  const env = loadEnv();
  const stub = args.includes('--stub');
  for (const work of selected) {
    const chunks = readChunks(work.doc.id);
    if (!chunks) {
      console.log(`embed ${work.doc.id}: no chunks (run chunk first) — skipped`);
      continue;
    }
    process.stdout.write(`embed ${work.doc.id}${stub ? ' (STUB)' : ''} … `);
    const res = await embedWork(work.doc, chunks, env, { stub });
    appendManifest({ stage: 'embed', work: work.doc.id, embedded: res.embedded, total: res.total, stub: res.stub });
    console.log(`${res.embedded} new, ${res.total} total`);
  }
}

async function doLoad() {
  const env = loadEnv();
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const rows = collectRows().filter((r) => selected.some((w) => w.doc.id === r.work.doc.id));

  // Validate embedding coverage (and refuse stubs) before touching anything.
  let totalChunks = 0;
  for (const r of rows) {
    const emb = readEmbeddings(r.work.doc.id);
    const covered = r.chunks.filter((c) => emb.has(c.content_hash)).length;
    const stubbed = [...emb.values()].some((e) => e.stub);
    if (stubbed) {
      console.error(`load ${r.work.doc.id}: STUB embeddings present — refusing. Re-run embed without --stub.`);
      process.exit(1);
    }
    if (covered !== r.chunks.length) {
      console.error(`load ${r.work.doc.id}: embeddings cover ${covered}/${r.chunks.length} chunks — run embed first.`);
      process.exit(1);
    }
    totalChunks += r.chunks.length;
  }

  if (!supabaseUrl || !serviceKey) {
    console.log('\nLOAD DRY RUN (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — nothing was written):');
    for (const r of rows) console.log(`  would upsert document ${r.work.doc.id} + ${r.chunks.length} chunks`);
    console.log(`  would stamp corpus_version in corpus_meta. Total chunks: ${totalChunks}`);
    return;
  }

  const headers = {
    apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  const post = async (path, body) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`POST ${path} failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };

  for (const r of rows) {
    const doc = r.work.doc;
    const recordPath = join(outDir, `${doc.id}.document.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    process.stdout.write(`load ${doc.id} … `);
    await post('corpus_documents?on_conflict=id', [{
      ...record, ingest_status: 'live', ingested_at: new Date().toISOString(),
    }]);
    // Prune chunks from older versions of this document, then upsert this set.
    const del = await fetch(
      `${supabaseUrl}/rest/v1/corpus_chunks?document_id=eq.${encodeURIComponent(doc.id)}&doc_version=lt.${doc.version}`,
      { method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!del.ok) throw new Error(`prune for ${doc.id} failed ${del.status}`);
    const emb = readEmbeddings(doc.id);
    const CHUNK_PAGE = 200;
    for (let i = 0; i < r.chunks.length; i += CHUNK_PAGE) {
      const page = r.chunks.slice(i, i + CHUNK_PAGE).map((c) => ({
        ...c, doc_version: doc.version, embedding: `[${emb.get(c.content_hash).embedding.join(',')}]`,
      }));
      await post('corpus_chunks?on_conflict=document_id,ordinal', page);
    }
    appendManifest({ stage: 'load', work: doc.id, chunks: r.chunks.length });
    console.log(`${r.chunks.length} chunks live`);
  }

  const version = `ingest-${new Date().toISOString().slice(0, 10)}-${totalChunks}chunks`;
  await post('corpus_meta?on_conflict=key', [{ key: 'corpus_version', value: version, updated_at: new Date().toISOString() }]);
  console.log(`corpus_version stamped: ${version}`);
}

const stages = { chunk: doChunk, report: doReport, embed: doEmbed, load: doLoad };
if (!stages[stage]) {
  console.error('Usage: ingest.mjs <chunk|report|embed|load> [--work id,id] [--phase 0|1] [--stub]');
  process.exit(2);
}
await stages[stage]();
