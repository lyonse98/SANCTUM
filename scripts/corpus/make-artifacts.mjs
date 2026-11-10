#!/usr/bin/env node
/*
  Build the load artifacts for the server-side corpus loader
  (supabase/functions/corpus-ingest). The local out/ directory is a gitignored
  build cache; the artifacts are the published form the edge function fetches
  from raw.githubusercontent.com at load time.

  Since Nov 10, 2026 the artifacts live in their OWN repo —
  lyonse98/sanctum-corpus — because ~47 MB of data files pushed this app repo
  past Bolt's import size limit. This script writes into a local checkout of
  that repo; afterwards, commit + push the result in that checkout.

    node scripts/corpus/make-artifacts.mjs [--out /path/to/sanctum-corpus]

  Output directory resolution: `--out <dir>` wins, then $CORPUS_ARTIFACTS_DIR,
  then the default sibling checkout ../corpus-repo relative to this repo's
  root (~/workspace/sanctum/corpus-repo in the standard layout).

  Layout produced (at the sanctum-corpus repo root):
    manifest.json          the index the function reads first:
                           per work — the full document record,
                           chunk count, and its part files.
    <work>.document.json   the registry record (parity with out/)
    <work>.part-NNN.jsonl  chunk rows, PART_SIZE per file, in
                           ordinal order, same JSON shape as
                           out/<work>.chunks.jsonl lines.

  Parts exist because raw fetches and edge-function invocations both prefer
  small files: the largest work (Summa, ~15 MB of chunk JSON) becomes ~1.2 MB
  parts. Re-running is deterministic: same out/ → same artifacts, byte for byte.
*/

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { corpusDir, outDir, repoRoot, sha256 } from './lib.mjs';
import { WORKS } from './works.mjs';

export const PART_SIZE = 250;
// Historical in-repo directory name (pre-Nov 2026). Kept for reference only —
// artifacts are no longer written into this repo; see resolveArtifactsRoot.
export const ARTIFACTS_DIR = 'corpus-artifacts';

function resolveArtifactsRoot() {
  const outIdx = process.argv.indexOf('--out');
  if (outIdx !== -1 && process.argv[outIdx + 1]) return resolve(process.argv[outIdx + 1]);
  if (process.env.CORPUS_ARTIFACTS_DIR) return resolve(process.env.CORPUS_ARTIFACTS_DIR);
  return join(repoRoot, '..', 'corpus-repo');
}

const artifactsRoot = resolveArtifactsRoot();

function readOut(name) {
  const path = join(outDir, name);
  if (!existsSync(path)) throw new Error(`missing ${path} — run the chunk stage first`);
  return readFileSync(path, 'utf8');
}

function main() {
  mkdirSync(artifactsRoot, { recursive: true });
  // The output root is the sanctum-corpus repo checkout — never wipe the
  // directory itself (it holds .git and README.md). Remove only the generated
  // files this script owns, so stale parts from a shrunk work cannot linger.
  for (const name of readdirSync(artifactsRoot)) {
    if (name === 'manifest.json' || name.endsWith('.document.json') || /\.part-\d+\.jsonl$/.test(name)) {
      rmSync(join(artifactsRoot, name), { force: true });
    }
  }
  console.log(`writing artifacts to ${artifactsRoot}`);

  const manifest = { version: 1, part_size: PART_SIZE, works: [] };
  let totalChunks = 0;
  let totalBytes = 0;

  for (const work of WORKS) {
    const doc = work.doc;
    const document = JSON.parse(readOut(`${doc.id}.document.json`));
    const lines = readOut(`${doc.id}.chunks.jsonl`).split('\n').filter(Boolean);
    if (lines.length !== document.chunk_count) {
      throw new Error(`${doc.id}: document record says ${document.chunk_count} chunks, file has ${lines.length}`);
    }
    // Ordinals must be 0..n-1 in order — the loader's per-part resume math
    // (ordinal ranges) depends on it.
    lines.forEach((line, i) => {
      const row = JSON.parse(line);
      if (row.document_id !== doc.id || row.ordinal !== i) {
        throw new Error(`${doc.id}: chunk line ${i} has document_id=${row.document_id} ordinal=${row.ordinal}`);
      }
    });

    const docFile = `${doc.id}.document.json`;
    const docText = JSON.stringify(document, null, 1) + '\n';
    writeFileSync(join(artifactsRoot, docFile), docText);
    totalBytes += Buffer.byteLength(docText);

    const parts = [];
    for (let start = 0; start < lines.length; start += PART_SIZE) {
      const slice = lines.slice(start, start + PART_SIZE);
      const file = `${doc.id}.part-${String(parts.length + 1).padStart(3, '0')}.jsonl`;
      const text = slice.join('\n') + '\n';
      writeFileSync(join(artifactsRoot, file), text);
      const bytes = Buffer.byteLength(text);
      totalBytes += bytes;
      parts.push({ file, chunks: slice.length, first_ordinal: start, bytes });
    }

    manifest.works.push({
      id: doc.id,
      phase: work.phase,
      document,
      chunk_count: lines.length,
      parts,
    });
    totalChunks += lines.length;
    console.log(`${doc.id}: ${lines.length} chunks → ${parts.length} part(s)`);
  }

  manifest.total_chunks = totalChunks;
  manifest.content_hash = sha256(manifest.works.map((w) => w.document.content_hash).join('\n'));
  const manifestText = JSON.stringify(manifest, null, 1) + '\n';
  writeFileSync(join(artifactsRoot, 'manifest.json'), manifestText);
  totalBytes += Buffer.byteLength(manifestText);

  console.log(
    `manifest: ${manifest.works.length} works, ${totalChunks} chunks, ` +
    `${manifest.works.reduce((n, w) => n + w.parts.length, 0)} parts, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total`,
  );
}

main();
