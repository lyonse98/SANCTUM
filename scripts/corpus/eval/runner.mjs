#!/usr/bin/env node
/*
  Fidelity harness runner (spec §10) — runs the gold bank against a LIVE
  deployment and scores the answers. The live run happens after ingest +
  deploy + CORPUS_ENABLED; until then this file exists to be ready, and its
  scorer is proven offline by scorer.test.mjs.

  Configuration (environment; nothing secret is ever printed):
    CORPUS_EVAL_FUNCTIONS_URL   e.g. https://<ref>.supabase.co/functions/v1
    SUPABASE_ANON_KEY           the app's public anon key (chat-proxy auth)
    CORPUS_RETRIEVE_KEY         optional; when set, each question is also run
                                through corpus-retrieve so citation integrity
                                is scored against the truly retrieved set.

  Usage: node scripts/corpus/eval/runner.mjs [--out report.json]
  Exit code 0 when every §10.3 threshold is met, 1 otherwise.
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreCase, summarize } from './scorer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.CORPUS_EVAL_FUNCTIONS_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const retrieveKey = process.env.CORPUS_RETRIEVE_KEY;
if (!base || !anon) {
  console.error('Set CORPUS_EVAL_FUNCTIONS_URL and SUPABASE_ANON_KEY (see header).');
  process.exit(2);
}

const SENTINEL = '\n\n[[SANCTUM_SOURCES]]';
const gold = readFileSync(join(here, 'gold.jsonl'), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

async function retrieveLabels(question) {
  if (!retrieveKey) return null;
  try {
    const res = await fetch(`${base}/corpus-retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-corpus-key': retrieveKey },
      body: JSON.stringify({ v: 1, query: question, purpose: 'aquinas-qa', authority_tiers: [1, 2, 3, 4, 5, 8], k: 8 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results ?? []).map((r) => r.citation_label);
  } catch {
    return null;
  }
}

async function askAquinas(question) {
  const started = Date.now();
  const res = await fetch(`${base}/chat-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ persona: 'aquinas', messages: [{ role: 'user', content: question }] }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`chat-proxy ${res.status}`);
  const raw = await res.text();
  const cut = raw.indexOf(SENTINEL);
  const answer = cut >= 0 ? raw.slice(0, cut) : raw;
  let sources = [];
  if (cut >= 0) {
    try {
      sources = JSON.parse(raw.slice(cut + SENTINEL.length)).map((s) => ({
        label: s.label, authority_tier: s.authority_tier,
      }));
    } catch { /* trailer malformed — integrity remains scorable via labels=[] */ }
  }
  return { answer, sources, ms: Date.now() - started };
}

const results = [];
for (const item of gold) {
  process.stdout.write(`${item.id} … `);
  try {
    const retrieved = await retrieveLabels(item.question);
    const { answer, sources, ms } = await askAquinas(item.question);
    const scored = { ...scoreCase({ item, answer, sources, retrieved }), item };
    results.push(scored);
    console.log(`${scored.pass ? 'PASS' : 'FAIL'} (${ms} ms)${scored.failures.length ? ` — ${scored.failures.join('; ')}` : ''}`);
  } catch (err) {
    console.log(`ERROR — ${String(err).slice(0, 160)}`);
    results.push({ id: item.id, item, checks: {}, pass: false, failures: [`runner error: ${String(err).slice(0, 120)}`] });
  }
}

const summary = summarize(results);
console.log('\n── Summary (§10.3 thresholds) ──');
console.log(JSON.stringify(summary, null, 2));
const outIdx = process.argv.indexOf('--out');
if (outIdx >= 0) {
  writeFileSync(process.argv[outIdx + 1], JSON.stringify({ summary, results }, null, 2));
  console.log(`Report written to ${process.argv[outIdx + 1]}`);
}
process.exit(summary.allThresholdsMet ? 0 : 1);
