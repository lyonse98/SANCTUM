/*
  Vatican.va conciliar text adapter (spec §7, Phase 2): Lumen Gentium
  chapter VIII (§§52–69), the Council's Marian chapter — a text ABOUT
  Our Lady from the highest teaching authority in the corpus after
  Scripture (authority tier 2, license tier B: retrieval + citation +
  short quotes only, §6.1 — the same posture as the Catechism).

  The vatican.va page carries the whole constitution; only chapter
  VIII is taken. Its numbered paragraphs are the chunk unit (spec
  §4.3, conciliar genre), cited as "Lumen Gentium 52" (§4.4). A section
  longer than ~1,600 characters splits on sentence boundaries with the
  section locator kept.
*/

import { chunkProse, fetchCached, htmlToText, makeChunk } from '../lib.mjs';

const LG_URL =
  'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html';

const DAS_URL =
  'https://www.vatican.va/content/john-paul-ii/en/apost_letters/1997/documents/hf_jp-ii_apl_19101997_divini-amoris.html';

/**
 * Divini Amoris Scientia (John Paul II, 19 Oct 1997) — the apostolic
 * letter proclaiming St. Thérèse a Doctor of the Universal Church.
 * A Church document ABOUT a companion (the stretch tier of the Phase 2
 * packs): license B, papal authority tier 3, companion_shelves empty
 * for the same reason as Lumen Gentium — the shelf records authorship,
 * not subject. Numbered paragraphs are the chunk unit.
 */
// The letter's page encodes French names with named entities the shared
// decoder's small map doesn't carry (&eacute;, &egrave;, …). Decode the
// Latin-1 set locally rather than widening the shared table mid-build.
const LATIN1_ENTITIES = {
  '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
  '&acirc;': 'â', '&ocirc;': 'ô', '&icirc;': 'î', '&uacute;': 'ú',
  '&middot;': '·', '&euml;': 'ë', '&iuml;': 'ï', '&ouml;': 'ö',
};

export async function diviniAmoris(doc) {
  const html = await fetchCached(DAS_URL, 'vatican/divini-amoris-scientia.html', { minIntervalMs: 0 });
  const text = htmlToText(html).replace(/&[a-z]+;/gi, (m) => LATIN1_ENTITIES[m] ?? m);
  const start = text.search(/1\.\s+THE SCIENCE OF DIVINE LOVE/i);
  if (start < 0) throw new Error('divini-amoris: opening paragraph not found');
  let body = text.slice(start);
  const end = body.search(/Given in Rome/i);
  if (end > 0) body = body.slice(0, end);
  const marks = [];
  for (const m of body.matchAll(/(?:^|\s)(1[0-3]|[1-9])\.\s+(?=[A-Z"])/g)) {
    marks.push({ n: Number(m[1]), index: m.index, len: m[0].length });
  }
  // Keep only the strictly increasing run 1..N (footnote numerals and
  // dates inside paragraphs must not become section starts).
  const sections = [];
  let expected = 1;
  marks.forEach((mark, i) => {
    if (mark.n !== expected) return;
    const from = mark.index + mark.len;
    const next = marks.slice(i + 1).find((x) => x.n === expected + 1);
    const to = next ? next.index : body.length;
    const secText = body.slice(from, to).replace(/\s+/g, ' ').trim();
    if (secText) sections.push({ n: mark.n, text: secText });
    expected++;
  });
  const chunks = [];
  let ordinal = 0;
  for (const sec of sections) {
    const pieces = sec.text.length > 1600 ? chunkProse([sec.text], 1200) : [sec.text];
    pieces.forEach((piece, k) => {
      chunks.push(
        makeChunk(
          doc,
          ordinal++,
          pieces.length > 1 ? `§${sec.n}, part ${k + 1}` : `§${sec.n}`,
          `Divini Amoris Scientia ${sec.n}`,
          piece,
        ),
      );
    });
  }
  return { chunks, stats: { sections: sections.length, sectionNumbers: sections.map((s) => s.n) } };
}

export async function lumenGentiumMary(doc) {
  const html = await fetchCached(LG_URL, 'vatican/lumen-gentium.html', { minIntervalMs: 0 });
  const text = htmlToText(html);
  const start = text.search(/CHAPTER VIII/i);
  if (start < 0) throw new Error('lumen-gentium: CHAPTER VIII heading not found');
  let body = text.slice(start);
  // Chapter VIII is the last chapter; the document's closing matter
  // (promulgation formula, signatures, notifications) is not conciliar text.
  const endMarkers = [/Given at Rome/i, /NOTIFICATIONS/i, /The foregoing/i];
  for (const re of endMarkers) {
    const i = body.search(re);
    if (i > 0) body = body.slice(0, i);
  }
  // Split at numbered-paragraph starts: "52. ", "53. ", … within 52–69.
  const marks = [];
  for (const m of body.matchAll(/(?:^|\n)\s*(5[2-9]|6[0-9])\.\s+/g)) {
    marks.push({ n: Number(m[1]), index: m.index, len: m[0].length });
  }
  const sections = [];
  marks.forEach((mark, i) => {
    const from = mark.index + mark.len;
    const to = i + 1 < marks.length ? marks[i + 1].index : body.length;
    const secText = body.slice(from, to).replace(/\s+/g, ' ').trim();
    if (secText) sections.push({ n: mark.n, text: secText });
  });
  const chunks = [];
  let ordinal = 0;
  for (const sec of sections) {
    const pieces = sec.text.length > 1600 ? chunkProse([sec.text], 1200) : [sec.text];
    pieces.forEach((piece, k) => {
      chunks.push(
        makeChunk(
          doc,
          ordinal++,
          pieces.length > 1 ? `§${sec.n}, part ${k + 1}` : `§${sec.n}`,
          `Lumen Gentium ${sec.n}`,
          piece,
        ),
      );
    });
  }
  return {
    chunks,
    stats: {
      sections: sections.length,
      first: sections[0]?.n,
      last: sections[sections.length - 1]?.n,
      sectionNumbers: sections.map((s) => s.n),
    },
  };
}
