/*
  Summa Theologiae, complete — public-domain English translation (Fathers of
  the English Dominican Province), as hosted by New Advent (spec §7, Phase 1).
  License tier A. Aquinas's own shelf (companion_shelves: ['aquinas']).

  New Advent serves one page per question: summa/{part}{question:03}.htm with
  part digits 1=I, 2=I-II, 3=II-II, 4=III, 5=Supplement. Each page's articles
  are headed "Article N. Whether …?" and contain objections, sed contra, the
  respondeo, and the replies — one article is one complete argument, so one
  article is one chunk (spec §4.3). Articles longer than ~9,000 chars split at
  paragraph boundaries with the article locator kept.

  Expected shape (for the manifest's actuals-vs-estimate report): 611 question
  pages (119 + 114 + 189 + 90 + 99), roughly 3,100–3,500 articles.
*/

import { fetchCached, htmlToText, makeChunk } from '../lib.mjs';

const PARTS = [
  { digit: '1', label: 'I', questions: 119, tags: ['doctrine'] },
  { digit: '2', label: 'I-II', questions: 114, tags: ['moral', 'doctrine'] },
  { digit: '3', label: 'II-II', questions: 189, tags: ['moral', 'virtues'] },
  { digit: '4', label: 'III', questions: 90, tags: ['sacraments', 'christology'] },
  { digit: '5', label: 'Supp.', questions: 99, tags: ['sacraments', 'eschatology'] },
];

function splitArticle(text) {
  if (text.length <= 9000) return [text];
  const paras = text.split(/\n\n+/);
  const parts = [];
  let current = '';
  for (const p of paras) {
    if (current && current.length + p.length + 2 > 9000) {
      parts.push(current);
      current = '';
    }
    current += (current ? '\n\n' : '') + p;
  }
  if (current) parts.push(current);
  return parts;
}

export async function run(doc) {
  const chunks = [];
  let ordinal = 0;
  const missingPages = [];
  let questionsFound = 0;
  for (const part of PARTS) {
    for (let q = 1; q <= part.questions; q++) {
      const file = `${part.digit}${String(q).padStart(3, '0')}.htm`;
      let html;
      try {
        html = await fetchCached(`https://www.newadvent.org/summa/${file}`, `summa/${file}`, { minIntervalMs: 200 });
      } catch {
        missingPages.push(file);
        continue;
      }
      let text = htmlToText(html);
      // The page ends with edition/copyright boilerplate, not Summa text —
      // cut it before it can glue itself onto the last article's chunk.
      for (const marker of ['Online Edition Copyright', 'translated by Fathers of the English Dominican Province']) {
        const i = text.indexOf(marker);
        if (i >= 0) text = text.slice(0, i);
      }
      const articleRe = /^\s*Article (\d+)\.\s*/gm;
      const starts = [...text.matchAll(articleRe)];
      if (starts.length === 0) {
        missingPages.push(`${file} (no articles parsed)`);
        continue;
      }
      questionsFound++;
      for (let i = 0; i < starts.length; i++) {
        const start = starts[i].index;
        const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
        const articleText = text.slice(start, end).trim();
        const a = Number(starts[i][1]);
        const label = `ST ${part.label}, q. ${q}, a. ${a}`;
        const parts = splitArticle(articleText);
        parts.forEach((piece, k) => {
          chunks.push(
            makeChunk(
              doc,
              ordinal++,
              parts.length > 1 ? `${part.label} q.${q} a.${a}, part ${k + 1}` : `${part.label} q.${q} a.${a}`,
              label,
              piece,
              { shelf_tags: [...doc.shelf_tags, ...part.tags] },
            ),
          );
        });
      }
    }
  }
  return {
    chunks,
    stats: { questionsFound, missingPages: missingPages.slice(0, 20), missingCount: missingPages.length },
  };
}
