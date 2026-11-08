/*
  Athanasius from CCEL's NPNF Series II, Vol. IV (Schaff) ThML — a dedicated
  parser, because this volume's structure defeats the generic assumptions:
  each work sits in a <div1> whose SECOND <div2> is the work itself (the
  first is the editor's introduction, excluded), and the work's sections are
  <div3> elements — sequential for On the Incarnation (§§1–57), carrying an
  `n` attribute ("1,2", "3,4", …) for the Life of Anthony (§§1–94, plus
  Athanasius's own preface letter). Public-domain translations, license A.
*/

import { chunkProse, fetchCached, htmlToText, makeChunk } from '../lib.mjs';

const XML_URL = 'https://ccel.org/ccel/schaff/npnf204.xml';

function flattenThml(fragment) {
  const noNotes = fragment
    .replace(/<note\b[^>]*>[\s\S]*?<\/note>/gi, ' ')
    .replace(/<note\b[^>]*\/>/gi, ' ')
    .replace(/<pb\b[^>]*>/gi, ' ');
  return htmlToText(noNotes);
}

function span(xml, openRe, closeRe, from = 0) {
  const open = openRe.exec(xml.slice(from));
  if (!open) return null;
  const start = from + open.index;
  const rest = xml.slice(start + open[0].length);
  const close = closeRe.exec(rest);
  const end = close ? start + open[0].length + close.index : xml.length;
  return { start, end, inner: xml.slice(start + open[0].length, end) };
}

/**
 * config: { div1Title, workDiv2Title, sectionLabel(n, isFront) -> {locator,label},
 *           numberedBy: 'sequence' | 'n-attr' }
 */
function npnf204Adapter(config) {
  return async function run(doc) {
    const xml = await fetchCached(XML_URL, 'ccel/npnf204.xml', { minIntervalMs: 0 });
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const div1 = span(xml, new RegExp(`<div1 title="${esc(config.div1Title)}"[^>]*>`), /<div1\s/);
    if (!div1) throw new Error(`npnf204: div1 "${config.div1Title}" not found`);
    const work = span(div1.inner, new RegExp(`<div2 title="${esc(config.workDiv2Title)}"[^>]*>`), /<div2\s/);
    if (!work) throw new Error(`npnf204: work div2 "${config.workDiv2Title}" not found in ${config.div1Title}`);

    // Split the work span at <div3> boundaries.
    const parts = work.inner.split(/(?=<div3[\s>])/);
    const chunks = [];
    let ordinal = 0;
    let sequence = 0;
    const sectionsSeen = [];
    for (const part of parts) {
      const head = part.match(/^<div3([^>]*)>/);
      if (!head) continue; // preamble before the first div3
      const attrs = head[1];
      const title = /title="([^"]*)"/.exec(attrs)?.[1] ?? '';
      const nAttr = /n="([\d,]+)"/.exec(attrs)?.[1] ?? null;
      const isFront = /^(Prologue|Preface)\.?$/.test(title);
      sequence++;
      const n = config.numberedBy === 'n-attr' && nAttr ? Number(nAttr.split(',')[0]) : sequence;
      const { locator, label } = config.sectionLabel(isFront ? title.replace(/\.$/, '').toLowerCase() : n, isFront);
      const text = flattenThml(part);
      const paras = text.split(/\n\n+/).filter((p) => p.trim());
      if (!paras.length) continue;
      sectionsSeen.push(locator);
      const pieces = chunkProse(paras, 1000);
      pieces.forEach((piece, k) => {
        chunks.push(
          makeChunk(doc, ordinal++, pieces.length > 1 ? `${locator}, part ${k + 1}` : locator, label, piece),
        );
      });
    }
    return { chunks, stats: { sections: sectionsSeen.length, first: sectionsSeen[0], last: sectionsSeen[sectionsSeen.length - 1] } };
  };
}

export const athanasiusIncarnation = npnf204Adapter({
  div1Title: 'The Incarnation of the Word.',
  workDiv2Title: 'On the Incarnation of the Word.',
  numberedBy: 'sequence',
  sectionLabel: (n) => ({ locator: `§${n}`, label: `Athanasius, On the Incarnation §${n}` }),
});

export const athanasiusAnthony = npnf204Adapter({
  div1Title: 'Life of Antony. (Vita Antoni.)',
  workDiv2Title: 'Life of Antony. (Vita Antoni.)',
  numberedBy: 'n-attr',
  sectionLabel: (n, isFront) =>
    isFront
      ? { locator: String(n), label: `Athanasius, Life of Anthony ${n}` }
      : { locator: `ch. ${n}`, label: `Athanasius, Life of Anthony ch. ${n}` },
});
