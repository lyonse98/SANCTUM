/*
  The Sanctum-curated set (spec §§2.1, 7 Phase 0): the 26 pillar entries + 13
  objections that Ask Aquinas runs on today, re-ingested as tier 8 corpus
  chunks so retrieval can rank them alongside the shelf. Source of record is
  the CLIENT file src/data/catechism.ts (the server copy in chat-proxy is a
  hand-synced duplicate; Phase 0's manifest records this adapter reading the
  client file). Transpiled with the repo's own typescript package — the same
  pattern as scripts/audio-dry-run.mjs.
*/

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { makeChunk, repoRoot } from '../lib.mjs';

export function loadCatechismData() {
  const path = join(repoRoot, 'src/data/catechism.ts');
  const source = readFileSync(path, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  const fn = new Function('module', 'exports', js);
  fn(moduleShim, moduleShim.exports);
  return moduleShim.exports;
}

export async function run(doc) {
  const { CATECHISM, OBJECTIONS, PILLARS } = loadCatechismData();
  const chunks = [];
  let ordinal = 0;
  for (const pillar of PILLARS) {
    for (const e of CATECHISM[pillar.id] ?? []) {
      const text = [
        `Question: ${e.question}`,
        `Answer: ${e.answer}`,
        `Scripture: ${e.scripture}`,
        `Tradition: ${e.tradition}`,
      ].join('\n');
      chunks.push(
        makeChunk(doc, ordinal++, `pillar ${pillar.id} — ${e.id}`, `Sanctum shelf — "${e.question}"`, text, {
          shelf_tags: [pillar.id],
        }),
      );
    }
  }
  for (const o of OBJECTIONS) {
    const text = [
      `Objection: ${o.question}`,
      `Answer: ${o.shortAnswer}`,
      `Scripture: ${o.scripture}`,
      `Tradition: ${o.tradition}`,
    ].join('\n');
    chunks.push(
      makeChunk(doc, ordinal++, `objection — ${o.id}`, `Sanctum shelf — "${o.question}"`, text, {
        shelf_tags: ['objections'],
      }),
    );
  }
  return { chunks, stats: { entries: chunks.length } };
}
