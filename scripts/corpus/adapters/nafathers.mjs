/*
  New Advent "Fathers of the Church" adapter (spec §7, Phase 1): works New
  Advent serves as an index page linking one page per unit (a homily, a book).
  Public-domain NPNF translations (license tier A).

  Page quirks:
  - Content starts at the page's <h1> and runs to the footer furniture
    (a cluster of named <div>s — springfield/ogdenville/capitalcity/mobilecity —
    or the "pub" ad div). We cut at the earliest of those markers.
  - The unit's name is in <title>: "CHURCH FATHERS: Homily 44 on Matthew
    (Chrysostom)" — the parenthetical is the volume's author tag, dropped.
  - Units chunk as continuous prose (~1,000 chars, spec §4.3), optionally
    split first at chapter headings (City of God).
*/

import { chunkProse, fetchCached, htmlToText, makeChunk } from '../lib.mjs';

const FOOTER_MARKERS = [
  '<div id="springfield', '<div id="ogdenville', '<div id="capitalcity',
  '<div id="mobilecity', '<div class="pub"', 'About this page',
];

function extractContent(html) {
  const h1 = html.search(/<h1>/i);
  let body = h1 >= 0 ? html.slice(h1) : html;
  let cut = body.length;
  for (const marker of FOOTER_MARKERS) {
    const i = body.indexOf(marker);
    if (i >= 0 && i < cut) cut = i;
  }
  body = body.slice(0, cut);
  const titleMatch = html.match(/<title>CHURCH FATHERS:\s*([^<(]+)/i);
  // Drop New Advent's support banner paragraph — site furniture that sits
  // directly under the <h1> on every page, not part of any work.
  const text = htmlToText(body)
    .split(/\n\n+/)
    .filter((p) => !/help support the mission of New Advent|instant download/i.test(p))
    .join('\n\n');
  return { title: titleMatch ? titleMatch[1].trim() : '', text };
}

/**
 * config: {
 *   indexUrl: string, cachePrefix: string,
 *   linkFilter: (file: string) => bool,           // which index links are units
 *   labelFor: (unitTitle: string) => { locator: string, label: string },
 *   chapterRe?: RegExp,                            // optional in-unit chapter split
 *   chapterLabel?: (unit, chapterNum, part) => { locator, label },
 * }
 */
export function naFathersAdapter(config) {
  return async function run(doc) {
    const index = await fetchCached(config.indexUrl, `${config.cachePrefix}/index.htm`, { minIntervalMs: 200 });
    const files = [];
    const seen = new Set();
    for (const m of index.matchAll(/href="(?:(?:\.\.\/|https:\/\/www\.newadvent\.org\/)fathers\/)?(\d+\.htm)"/gi)) {
      const file = m[1];
      if (!config.linkFilter(file) || seen.has(file)) continue;
      seen.add(file);
      files.push(file);
    }
    const chunks = [];
    let ordinal = 0;
    const failed = [];
    for (const file of files) {
      let html;
      try {
        html = await fetchCached(`https://www.newadvent.org/fathers/${file}`, `${config.cachePrefix}/${file}`, { minIntervalMs: 200 });
      } catch {
        failed.push(file);
        continue;
      }
      const { title, text } = extractContent(html);
      const base = config.labelFor(title, file);
      // Split into segments: whole unit, or chapters when configured.
      let segments = [{ locator: base.locator, label: base.label, paras: text.split(/\n\n+/).filter((p) => p.trim()) }];
      if (config.chapterRe) {
        const chapSegments = [];
        let current = null;
        for (const para of segments[0].paras) {
          const m = para.match(config.chapterRe);
          if (m) {
            if (current) chapSegments.push(current);
            const cl = config.chapterLabel(base, m);
            current = { locator: cl.locator, label: cl.label, paras: [para] };
          } else if (current) {
            current.paras.push(para);
          }
          // Paragraphs before the Chapter 1 heading are New Advent's
          // editorial synopsis of the unit, not the work — dropped.
        }
        if (current) chapSegments.push(current);
        if (chapSegments.length > 1) segments = chapSegments;
      }
      for (const seg of segments) {
        const pieces = chunkProse(seg.paras, 1000);
        pieces.forEach((piece, k) => {
          chunks.push(
            makeChunk(
              doc,
              ordinal++,
              pieces.length > 1 ? `${seg.locator}, part ${k + 1}` : seg.locator,
              seg.label,
              piece,
            ),
          );
        });
      }
    }
    return { chunks, stats: { units: files.length, failed } };
  };
}

const homilyNum = (title) => {
  const m = title.match(/Homily\s+(\d+)/i);
  return m ? Number(m[1]) : null;
};

export const chrysostomMatthew = naFathersAdapter({
  indexUrl: 'https://www.newadvent.org/fathers/2001.htm',
  cachePrefix: 'chrysostom-matthew',
  linkFilter: (f) => /^2001\d\d\.htm$/.test(f),
  labelFor: (title) => {
    const n = homilyNum(title);
    return { locator: `Homily ${n} on Matthew`, label: `Chrysostom, Homilies on Matthew ${n}` };
  },
});

export const chrysostomJohn = naFathersAdapter({
  indexUrl: 'https://www.newadvent.org/fathers/2401.htm',
  cachePrefix: 'chrysostom-john',
  linkFilter: (f) => /^2401\d\d\.htm$/.test(f),
  labelFor: (title) => {
    const n = homilyNum(title);
    return { locator: `Homily ${n} on John`, label: `Chrysostom, Homilies on John ${n}` };
  },
});

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII'];
const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100 };
function romanToInt(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN_VALUES[s[i]];
    const next = ROMAN_VALUES[s[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}
// New Advent book titles use Roman numerals ("City of God, Book II").
function bookFromTitle(title) {
  const m = title.match(/Book\s+([IVXLC]+|\d+)/i);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : romanToInt(m[1].toUpperCase());
}
const bookChapter = {
  chapterRe: /^\s*Chapter\s+(\d+)\.\s*/,
  chapterLabel: (base, m) => ({
    locator: `${base.locator}, ch. ${m[1]}`,
    label: `${base.label}.${m[1]}`,
  }),
};

export const cityOfGod = naFathersAdapter({
  indexUrl: 'https://www.newadvent.org/fathers/1201.htm',
  cachePrefix: 'city-of-god',
  linkFilter: (f) => /^1201\d\d\.htm$/.test(f),
  labelFor: (title) => {
    const book = bookFromTitle(title);
    return {
      locator: `Book ${book}`,
      label: `Augustine, City of God ${book ? ROMAN_NUMERALS[book - 1] : '?'}`,
      book,
    };
  },
  ...bookChapter,
});

export const confessions = naFathersAdapter({
  indexUrl: 'https://www.newadvent.org/fathers/1101.htm',
  cachePrefix: 'confessions',
  linkFilter: (f) => /^1101\d\d\.htm$/.test(f),
  labelFor: (title) => {
    const book = bookFromTitle(title);
    return {
      locator: `Book ${book}`,
      label: `Augustine, Confessions ${book ? ROMAN_NUMERALS[book - 1] : '?'}`,
      book,
    };
  },
  ...bookChapter,
});

// The Enchiridion is a single New Advent page holding the whole work (its
// self-link in the page is what the link filter catches).
export const enchiridion = naFathersAdapter({
  indexUrl: 'https://www.newadvent.org/fathers/1302.htm',
  cachePrefix: 'enchiridion',
  linkFilter: (f) => f === '1302.htm',
  labelFor: () => ({ locator: 'Enchiridion', label: 'Augustine, Enchiridion' }),
  chapterRe: /^\s*Chapter\s+(\d+)\.\s*/,
  chapterLabel: (base, m) => ({
    locator: `ch. ${m[1]}`,
    label: `Augustine, Enchiridion ch. ${m[1]}`,
  }),
});
