#!/usr/bin/env node
/*
  Build the COMMITTED load artifacts for the server-side corpus loader
  (supabase/functions/corpus-ingest). The local out/ directory is a gitignored
  build cache; corpus-artifacts/ at the repo root is the published form the
  edge function fetches from raw.githubusercontent.com at load time.

    node scripts/corpus/make-artifacts.mjs

  Layout produced:
    corpus-artifacts/manifest.json          the index the function reads first:
                                            per work — the full document record,
                                            chunk count, and its part files.
    corpus-artifacts/<work>.document.json   the registry record (parity with out/)
    corpus-artifacts/<work>.part-NNN.jsonl  chunk rows, PART_SIZE per file, in
                                            ordinal order, same JSON shape as
                                            out/<work>.chunks.jsonl lines.

  Parts exist because raw fetches and edge-function invocations both prefer
  small files: the largest work (Summa, ~15 MB of chunk JSON) becomes ~1.2 MB
  parts. Re-running is deterministic: same out/ → same artifacts, byte for byte.
*/

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { corpusDir, outDir, repoRoot, sha256 } from './lib.mjs';
import { WORKS } from './works.mjs';

export const PART_SIZE = 250;
export const ARTIFACTS_DIR = 'corpus-artifacts';

const artifactsRoot = join(repoRoot, ARTIFACTS_DIR);

function readOut(name) {
  const path = join(outDir, name);
  if (!existsSync(path)) throw new Error(`missing ${path} — run the chunk stage first`);
  return readFileSync(path, 'utf8');
}

function main() {
  rmSync(artifactsRoot, { recursive: true, force: true });
  mkdirSync(artifactsRoot, { recursive: true });

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
