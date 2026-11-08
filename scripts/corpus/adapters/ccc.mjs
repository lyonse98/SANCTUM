/*
  Catechism of the Catholic Church — full text (spec §7, Phase 0).

  Source: the Second Edition English translation (Libreria Editrice Vaticana),
  as hosted in clean HTML by St. Charles Borromeo Catholic Church
  (scborromeo.org/ccc). The old vatican.va archive (ENG0015) no longer serves
  the text (its URLs 404 since the vatican.va redesign), so this parish mirror
  of the identical official text is the machine-readable source; the ingest
  validates the result (exactly 2,865 numbered paragraphs, in order) and the
  deploy notes record the spot-check cross-validation. License tier B:
  retrieval + citation + short quotes only (spec §6.1).

  Page quirks (adapter notes):
  - Paragraph numbers appear in three marker forms:
      <B>751</B>
      <B><A HREF="javascript:openWindow('cr/752.htm');">752</A></B>
      <A NAME=754></a><B><A HREF="...">754</A></B>
    The marker regex below matches all three and ONLY those (a heading like
    <B> <A NAME=753></a>Symbols of the Church </B> must not match — it doesn't:
    its <B> is not immediately followed by digits or by an <A> wrapping digits).
  - Footnote references are <SUP>n</SUP> — apparatus, stripped.
  - Footnotes themselves sit after an <HR> at the page foot — segments cut there.
  - Non-marker <B>...</B> spans are section headings — removed from segments.
  - Long paragraphs split at sentence boundaries, keeping the paragraph number
    (spec §4.3).
*/

import { fetchCached, htmlToText, makeChunk, decodeEntities } from '../lib.mjs';

const TOC_URL = 'https://www.scborromeo.org/ccc/ccc_toc.htm';
const BASE = 'https://www.scborromeo.org/ccc/';
// Paragraph markers on this mirror come in a few shapes (same number; the
// anchor sometimes wraps the digits; occasional site HTML quirks):
//   <B>1</B> · <A NAME=882></A><B>882</B> · <B><A NAME=753></a>753</B>
//   <STRONG>920</B></STRONG> (¶920) · <B><A HREF="javascript:…">1184</a> <span class=text1></B> (¶¶1184–1185)
const MARKER = /(?:<A NAME=\d+><\/a>)?<(?:B|STRONG)>(?:<A[^>]*>)?(\d+)(?:<\/A>)?(?:\s*<span[^>]*>)?(?:<\/B>|<\/STRONG>)/gi;

function shelfForParagraph(n) {
  if (n <= 1065) return ['creed'];
  if (n <= 1690) return ['sacraments'];
  if (n <= 2557) return ['moral'];
  return ['prayer'];
}

function cleanSegment(html) {
  let seg = html;
  const hr = seg.search(/<HR/i);
  if (hr >= 0) seg = seg.slice(0, hr);
  seg = seg.replace(/<SUP>[\s\S]*?<\/SUP>/gi, ' ');
  // Remove non-marker bold spans (section headings) — any <B> left that is not
  // a paragraph marker. Markers were already consumed by the split, so every
  // remaining <B> span in a segment is a heading or apparatus.
  seg = seg.replace(/<B>[\s\S]*?<\/B>/gi, ' ');
  return htmlToText(seg);
}

export async function fetchCcc() {
  const toc = await fetchCached(TOC_URL, 'ccc/toc.htm');
  const pages = [];
  const seen = new Set();
  for (const m of toc.matchAll(/HREF=([a-z0-9_]+\.htm)/gi)) {
    const name = m[1].toLowerCase();
    if (!/^(prologue|p[1-4][a-z0-9]*)\.htm$/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    pages.push(name);
  }
  const htmlPages = [];
  for (const name of pages) {
    htmlPages.push({ name, html: await fetchCached(BASE + name, `ccc/${name}`) });
  }
  return htmlPages;
}

export function parseCcc(htmlPages) {
  const paragraphs = new Map(); // number -> text (first occurrence wins)
  const duplicates = [];
  for (const { name, html } of htmlPages) {
    const markers = [...html.matchAll(MARKER)];
    for (let i = 0; i < markers.length; i++) {
      const num = Number(markers[i][1]);
      if (num < 1 || num > 2865) continue;
      const start = markers[i].index + markers[i][0].length;
      const end = i + 1 < markers.length ? markers[i + 1].index : html.length;
      const text = cleanSegment(html.slice(start, end));
      if (!text) continue;
      if (paragraphs.has(num)) {
        duplicates.push({ num, page: name });
        continue;
      }
      paragraphs.set(num, text);
    }
  }
  return { paragraphs, duplicates };
}

export function chunkCcc(doc, paragraphs) {
  const chunks = [];
  let ordinal = 0;
  const missing = [];
  for (let n = 1; n <= 2865; n++) {
    const text = paragraphs.get(n);
    if (!text) {
      missing.push(n);
      continue;
    }
    // Split long paragraphs at sentence boundaries, paragraph number kept.
    const parts = [];
    if (text.length <= 1700) {
      parts.push(text);
    } else {
      const sentences = text.match(/[^.!?]+[.!?]+["'”’)]?\s*/g) ?? [text];
      let current = '';
      for (const s of sentences) {
        if (current && current.length + s.length > 1700) {
          parts.push(current.trim());
          current = '';
        }
        current += s;
      }
      if (current.trim()) parts.push(current.trim());
    }
    parts.forEach((part, i) => {
      chunks.push(
        makeChunk(
          doc,
          ordinal++,
          parts.length > 1 ? `para ${n}, part ${i + 1}` : `para ${n}`,
          `CCC ${n}`,
          part,
          { shelf_tags: [...doc.shelf_tags, ...shelfForParagraph(n)] },
        ),
      );
    });
  }
  return { chunks, missing };
}

export async function run(doc) {
  const pages = await fetchCcc();
  const { paragraphs, duplicates } = parseCcc(pages);
  const { chunks, missing } = chunkCcc(doc, paragraphs);
  return {
    chunks,
    stats: {
      pages: pages.length,
      paragraphsFound: paragraphs.size,
      missing,
      duplicates: duplicates.length,
    },
  };
}

export { decodeEntities };
