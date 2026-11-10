/*
  Generic CCEL ThML adapter (spec §7, Phase 2): single-work volumes CCEL
  serves as one ThML XML file whose <div1> elements are parts/front matter
  and whose <div2> elements are chapters (Teresa's Life and Interior
  Castle, Ignatius's Exercises). Ignatius's Autobiography carries its
  chapters as <div1> elements instead — the `level` config covers both.

  Editorial matter is excluded structurally, the same posture as the
  NPNF adapter: front-matter divisions are skipped by title, footnote
  <note> elements are stripped, and only the work's own divisions are
  chunked, as continuous prose (~1,000 chars, spec §4.3) with the
  chapter kept as locator. Public-domain translations, license tier A.
*/

import { chunkProse, fetchCached, htmlToText, makeChunk } from '../lib.mjs';

function flattenThml(fragment) {
  const noNotes = fragment
    .replace(/<note\b[^>]*>[\s\S]*?<\/note>/gi, ' ')
    .replace(/<note\b[^>]*\/>/gi, ' ')
    .replace(/<pb\b[^>]*>/gi, ' ');
  return htmlToText(noNotes);
}

function attr(attrs, name) {
  return new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
}

/** Split ThML into ordered div blocks: [{level, title, type, n, text}]. */
function divBlocks(xml) {
  const tokens = [];
  for (const m of xml.matchAll(/<div([12])\b([^>]*)>/g)) {
    tokens.push({
      level: Number(m[1]),
      index: m.index,
      end: m.index + m[0].length,
      title: attr(m[2], 'title')?.trim() ?? '',
      type: attr(m[2], 'type') ?? '',
      n: attr(m[2], 'n'),
    });
  }
  const blocks = [];
  tokens.forEach((tok, i) => {
    // A block's content runs to the next token of the same or higher level.
    let contentEnd = xml.length;
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].level <= tok.level) { contentEnd = tokens[j].index; break; }
    }
    const inner = xml.slice(tok.end, contentEnd);
    // For a div1 in level-2 mode, direct text = content before its first div2.
    const firstChild = tokens.slice(i + 1).find((t) => t.level === 2 && t.index < contentEnd);
    const direct = tok.level === 1 && firstChild ? xml.slice(tok.end, firstChild.index) : inner;
    blocks.push({ ...tok, contentEnd, text: flattenThml(tok.level === 1 ? direct : inner), fullText: flattenThml(inner) });
  });
  return blocks;
}

/**
 * config: {
 *   url, cacheName,
 *   level: 2 | 1,                       // which div level carries the units
 *   div1Filter?: (block) => bool,       // for level 2: which div1s hold the work
 *   skip?: RegExp,                      // unit titles to exclude (front matter)
 *   labelFor: (unit, parent) => { locator, label },
 * }
 */
export function ccelAdapter(config) {
  return async function run(doc) {
    const xml = await fetchCached(config.url, config.cacheName, { minIntervalMs: 0 });
    const blocks = divBlocks(xml);
    const chunks = [];
    let ordinal = 0;
    const unitsSeen = [];

    const emit = (locator, label, text) => {
      const paras = text.split(/\n\n+/).filter((p) => p.trim());
      if (!paras.length) return;
      unitsSeen.push(locator);
      const pieces = chunkProse(paras, 1000);
      pieces.forEach((piece, k) => {
        chunks.push(makeChunk(doc, ordinal++, pieces.length > 1 ? `${locator}, part ${k + 1}` : locator, label, piece));
      });
    };

    if (config.level === 1) {
      for (const b of blocks.filter((x) => x.level === 1)) {
        if (config.skip?.test(b.title)) continue;
        const { locator, label } = config.labelFor(b, null);
        emit(locator, label, b.fullText);
      }
    } else {
      let parent = null;
      for (const b of blocks) {
        if (b.level === 1) {
          parent = !config.div1Filter || config.div1Filter(b) ? b : null;
          // A kept div1 with text of its own (e.g. a mansion's opening or
          // the Exercises' Principle and Foundation when it sits at div1)
          // is a unit when it has no div2 children of its own.
          if (parent && b.text.trim() && !config.skip?.test(b.title)) {
            const hasChildren = blocks.some((x) => x.level === 2 && x.index > b.index && x.index < b.contentEnd);
            if (!hasChildren) {
              const { locator, label } = config.labelFor(b, b);
              emit(locator, label, b.text);
            }
          }
          continue;
        }
        if (!parent) continue;
        if (config.skip?.test(b.title)) continue;
        const { locator, label } = config.labelFor(b, parent);
        emit(locator, label, b.text);
      }
    }
    return { chunks, stats: { units: unitsSeen.length, first: unitsSeen[0], last: unitsSeen[unitsSeen.length - 1] } };
  };
}

const titleCase = (s) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\b(I{1,3}|Iv|Ix|Vi{0,3}|X{1,3})\b/gi, (m) => m.toUpperCase());

const romanOf = (title) => {
  const m = title.match(/Chapter\s+([IVXLC]+|\d+)/i) ?? title.match(/\bn="([IVXLC]+)"/);
  return m ? m[1].toUpperCase() : null;
};

export const teresaLife = ccelAdapter({
  url: 'https://ccel.org/ccel/teresa/life.xml',
  cacheName: 'ccel/teresa-life.xml',
  level: 2,
  div1Filter: (b) => b.type === 'Work' && /^The Life/.test(b.title),
  skip: /^(Frontispiece|Title Page|Contents|Index)$/i,
  labelFor: (unit) => {
    if (/^Prologue/i.test(unit.title)) return { locator: 'Prologue', label: 'Teresa of Avila, Life — Prologue' };
    const n = unit.n ?? romanOf(unit.title);
    return { locator: `ch. ${n}`, label: `Teresa of Avila, Life ch. ${n}` };
  },
});

export const teresaCastle = ccelAdapter({
  url: 'https://ccel.org/ccel/teresa/castle2.xml',
  cacheName: 'ccel/teresa-castle.xml',
  level: 2,
  div1Filter: (b) => /Mansions$/.test(b.title) || /^Epilogue$/i.test(b.title),
  skip: /^(Title Page|Note|Introduction|Preface|Subject Index|Indexes)$/i,
  labelFor: (unit, parent) => {
    if (/^Epilogue$/i.test(parent?.title ?? '')) return { locator: 'Epilogue', label: 'Teresa of Avila, Interior Castle — Epilogue' };
    const mansion = (parent?.title ?? '').replace(/^The /, '');
    const n = romanOf(unit.title) ?? unit.n;
    return {
      locator: `${mansion}, ch. ${n}`,
      label: `Teresa of Avila, Interior Castle — ${mansion}, ch. ${n}`,
    };
  },
});

export const ignatiusExercises = ccelAdapter({
  url: 'https://ccel.org/ccel/ignatius/exercises.xml',
  cacheName: 'ccel/ignatius-exercises.xml',
  level: 2,
  div1Filter: (b) => !/^(Title Page|Contents|Indexes|Preface|Paul III)/i.test(b.title),
  skip: /^(APPROBATION OF THE LATIN TEXTS|VULGATE VERSION|LITERAL VERSION|Title Page|Contents|Indexes|Preface|Paul III.*|General Index|General Note)$/i,
  labelFor: (unit) => {
    const name = titleCase(unit.title.replace(/\s+/g, ' ').trim());
    return { locator: name, label: `Ignatius of Loyola, Spiritual Exercises — ${name}` };
  },
});

export const ignatiusAutobiography = ccelAdapter({
  url: 'https://ccel.org/ccel/ignatius/autobiography.xml',
  cacheName: 'ccel/ignatius-autobiography.xml',
  level: 1,
  skip: /^(Title Page|Images|Editor's Preface|Preface of the Write|APPENDIX|Indexes)$/i,
  labelFor: (unit) => {
    const m = unit.title.match(/^CHAPTER\s+([IVXLC]+)/i);
    const n = m ? m[1].toUpperCase() : unit.title;
    return { locator: `ch. ${n}`, label: `Ignatius of Loyola, Autobiography ch. ${n}` };
  },
});
