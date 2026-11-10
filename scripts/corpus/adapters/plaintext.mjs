/*
  Plain-text book adapter (spec §7, Phase 2): works sourced as a single
  text file — Project Gutenberg editions and archive.org djvu OCR of
  public-domain print editions. License tier A throughout; the registry
  entry for each work names the exact edition and translation, and the
  adapter refuses nothing it cannot provenance because provenance lives
  in works.mjs (§6.2).

  Text hygiene, kept deliberately conservative:
  - Gutenberg license furniture is cut at the START/END markers.
  - archive.org OCR: scanner banners fall before the configured body
    start; running heads and bare page numbers are stripped by pattern;
    the OCR habit of double-spacing every word is collapsed.
  - Lines are re-joined into paragraphs on blank lines, then chunked as
    continuous prose (~1,000 chars, spec §4.3) inside segments the
    config detects (chapters, letter invocations, trial sessions).
*/

import { chunkProse, fetchCached, makeChunk, normalizeText } from '../lib.mjs';

const cleanLine = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * config: {
 *   url, cacheName, gutenberg?: bool,
 *   startAt?: RegExp, startAfterLine?: int,   // body start (first match wins)
 *   endAt?: RegExp,                            // body end (first match after start)
 *   stripLines?: RegExp[],                     // lines to drop entirely
 *   segmentOn?: (text, state) => {locator, label} | null,  // heading paragraphs
 *   splitParagraph?: RegExp,                   // paragraphs starting a new segment (kept as content)
 *   splitLabel?: (n, state) => {locator, label},
 *   trimSegment?: (paras) => paras,
 *   defaultLabel: {locator, label},
 * }
 */
export function plainTextAdapter(config) {
  return async function run(doc) {
    let raw = await fetchCached(config.url, config.cacheName, { minIntervalMs: 0 });
    if (config.gutenberg) {
      const start = raw.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*/i);
      const end = raw.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
      if (start >= 0) raw = raw.slice(start);
      if (end > start) raw = raw.slice(0, end);
    }
    let lines = raw.split('\n').map(cleanLine);
    if (config.startAt) {
      const from = config.startAfterLine ?? 0;
      const i = lines.findIndex((l, idx) => idx >= from && config.startAt.test(l));
      if (i < 0) throw new Error(`plaintext: startAt not found for ${doc.id}`);
      lines = lines.slice(i);
    }
    if (config.endAt) {
      const i = lines.findIndex((l) => config.endAt.test(l));
      if (i > 0) lines = lines.slice(0, i);
    }
    if (config.stripLines?.length) {
      lines = lines.filter((l) => !config.stripLines.some((re) => re.test(l)));
    }
    // Re-join wrapped lines into paragraphs on blank lines.
    const paragraphs = [];
    let cur = '';
    for (const l of lines) {
      if (!l) {
        if (cur) paragraphs.push(cur);
        cur = '';
      } else {
        cur = cur ? `${cur} ${l}` : l;
      }
    }
    if (cur) paragraphs.push(cur);

    const segments = [];
    let current = { ...config.defaultLabel, paras: [] };
    const state = {};
    const pushCurrent = () => {
      const paras = config.trimSegment ? config.trimSegment(current.paras) : current.paras;
      if (paras.some((p) => p.trim())) segments.push({ locator: current.locator, label: current.label, paras });
    };
    let splitCount = 0;
    for (const p of paragraphs) {
      const heading = config.segmentOn && p.length <= 160 ? config.segmentOn(p, state) : null;
      if (heading) {
        pushCurrent();
        current = { ...heading, paras: [] };
        continue;
      }
      if (config.splitParagraph?.test(p)) {
        pushCurrent();
        splitCount++;
        current = { ...config.splitLabel(splitCount, state), paras: [p] };
        continue;
      }
      current.paras.push(p);
    }
    pushCurrent();

    const chunks = [];
    let ordinal = 0;
    for (const seg of segments) {
      const pieces = chunkProse(seg.paras.map((p) => normalizeText(p)), 1000);
      pieces.forEach((piece, k) => {
        chunks.push(makeChunk(doc, ordinal++, pieces.length > 1 ? `${seg.locator}, part ${k + 1}` : seg.locator, seg.label, piece));
      });
    }
    return {
      chunks,
      stats: { segments: segments.length, first: segments[0]?.locator, last: segments[segments.length - 1]?.locator },
    };
  };
}

// ── Thérèse of Lisieux, Story of a Soul (Gutenberg #16772, Taylor 1912) ──
export const storyOfASoul = plainTextAdapter({
  url: 'https://www.gutenberg.org/cache/epub/16772/pg16772.txt',
  cacheName: 'gutenberg/story-of-a-soul.txt',
  gutenberg: true,
  startAt: /^CHAPTER I$/,
  startAfterLine: 100,
  defaultLabel: { locator: 'Story of a Soul', label: 'Thérèse of Lisieux, Story of a Soul' },
  segmentOn: (p) => {
    let m = p.match(/^CHAPTER (I{1,3}|IV|V|VI{0,3}|IX|X|XI)\b/);
    if (m) return { locator: `ch. ${m[1]}`, label: `Thérèse of Lisieux, Story of a Soul ch. ${m[1]}` };
    if (/^COUNSELS AND REMINISCENCES/.test(p)) return { locator: 'Counsels and Reminiscences', label: 'Thérèse of Lisieux, Counsels and Reminiscences' };
    if (/^LETTERS OF SOEUR THERESE/.test(p) || /^LETTERS TO /.test(p)) {
      const name = p.replace(/^LETTERS (OF SOEUR THERESE\s*)?/, '').trim();
      const pretty = name ? name.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase()) : 'Her Sisters and Others';
      return { locator: `Letters — ${pretty}`, label: `Thérèse of Lisieux, Letters — ${pretty}` };
    }
    if (/^SELECTED POEMS/.test(p)) return { locator: 'Selected Poems', label: 'Thérèse of Lisieux, Selected Poems' };
    return null;
  },
});

// ── Catherine of Siena, The Dialogue (Thorold 1896, archive.org OCR) ────
// Thorold numbers the chapters continuously I–CXLVIII across the whole
// work, so the chapter is the locator. (The four treatise divisions are
// marked in the print but their title lines do not survive OCR cleanly
// enough to assign every chapter reliably — better a certain chapter
// citation than a guessed treatise.)
export const catherineDialogue = plainTextAdapter({
  url: 'https://archive.org/download/seraphicvirginca00cathuoft/seraphicvirginca00cathuoft_djvu.txt',
  cacheName: 'archive/dialogue-thorold.txt',
  startAt: /^CHAPTER\s+I\.$/,
  startAfterLine: 1000,
  stripLines: [/^A TREATISE OF\b.*$/, /^THE DIALOGUE OF\b.*$/, /^\d+$/, /^CHAP\.\s*$/],
  defaultLabel: { locator: 'ch. I', label: 'Catherine of Siena, Dialogue ch. I' },
  segmentOn: (p) => {
    const m = p.match(/^CHAPTER\s+([IVXLC]+)\.?$/);
    if (!m) return null;
    return { locator: `ch. ${m[1]}`, label: `Catherine of Siena, Dialogue ch. ${m[1]}` };
  },
});

// ── Catherine of Siena, Letters (Scudder 1905, archive.org OCR) ─────────
export const catherineLetters = plainTextAdapter({
  url: 'https://archive.org/download/saintcatherineof00cath/saintcatherineof00cath_djvu.txt',
  cacheName: 'archive/catherine-letters-scudder.txt',
  startAt: /^In the Name of Jesus Christ crucified/,
  stripLines: [/^LETTERS OF CATHERINE BENINCASA\s*\d*$/, /^\d+$/, /^SAINT CATHERINE OF SIENA\s*\d*$/],
  splitParagraph: /^In the Name of Jesus Christ crucified/,
  splitLabel: (n) => ({ locator: `Letter ${n}`, label: `Catherine of Siena, Letters — letter ${n}` }),
  defaultLabel: { locator: 'Letters', label: 'Catherine of Siena, Letters' },
  // Scudder interleaves short editorial notes between letters; a letter's
  // own closing formula is the reliable seam — cut the segment there so
  // the next letter's introduction is not absorbed into this one. Letters
  // whose closing the OCR mangles keep their full segment (counted in
  // the manifest stats via segments/chunks, and honest either way).
  trimSegment: (paras) => {
    const closeRe = /remain in the holy|sweet Jesus, Jesus Love|Jesus, Jesus Love|sweet beholding of God/i;
    let cut = -1;
    paras.forEach((p, i) => { if (closeRe.test(p)) cut = i; });
    return cut >= 0 ? paras.slice(0, cut + 1) : paras;
  },
});

// ── Joan of Arc, Trial of Condemnation + Rehabilitation (Murray 1902) ────
const JOAN_HEADINGS = /^(SIX PUBLIC EXAMINATIONS|NINE PRIVATE EXAMINATIONS|THE TRIAL IN ORDINARY|EXHORTATIONS AND ADMONITIONS|FINAL SESSION AND SENTENCE.*|THE SENTENCE.*|SENTENCE OF DEATH|SUBSEQUENT EXAMINATIONS.*|EXAMINATION OF WITNESSES.*|THE FIRST ENQUIRY.*|THE SECOND ENQUIRY.*|DEPOSITIONS.*|APPENDIX.*|FIRST PROCESS.*|SECOND PROCESS.*|PART I.*|PART II.*)$/;
export const joanTrial = plainTextAdapter({
  url: 'https://archive.org/download/jeannedarcmaidof00murruoft/jeannedarcmaidof00murruoft_djvu.txt',
  cacheName: 'archive/joan-trial-murray.txt',
  startAt: /^\(?SIX PUBLIC EXAMINATIONS/,
  startAfterLine: 1000,
  endAt: /^INDEX\b/,
  stripLines: [/^\d+$/, /^JEANNE D'ARC.*\d+$/],
  defaultLabel: { locator: 'Six Public Examinations', label: "Trial of Jeanne d'Arc — Six Public Examinations" },
  segmentOn: (p, state) => {
    const norm = p.replace(/\s+\d+\s*$/, '').replace(/^\(/, '').trim();
    if (!JOAN_HEADINGS.test(norm)) return null;
    if (state.currentHeading === norm) return null; // running head, not a new session
    state.currentHeading = norm;
    const pretty = norm.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
    return { locator: pretty, label: `Trial of Jeanne d'Arc — ${pretty}` };
  },
});
