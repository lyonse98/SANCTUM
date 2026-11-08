/*
  Scripture anchor passages (spec §7, Phase 0): the passages the Catechism and
  the curated set actually cite, in the World English Bible — the translation
  the app already uses, public domain (license tier A, authority tier 1).

  Method: extract every distinct Scripture reference from the CCC's paragraph
  text, from its footnote apparatus (harvested from the mirror's raw pages —
  that is where the Catechism's marginal cross-references live), and from the
  curated entries' Scripture fields. Group them into pericopes
  (overlapping ranges in a chapter merge), fetch each needed chapter ONCE from
  the Free Bible API (bible.helloao.org, which serves the WEB text chapter by
  chapter as JSON), and slice the verses out locally.

  The Catholic edition of the WEB (eng_webc) is used when a book exists there,
  so the deuterocanonical books the CCC cites (Tobit, Wisdom, Sirach, Baruch,
  Maccabees) resolve; the Protestant edition (eng_webp) is the fallback.
*/

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCached, htmlToText, makeChunk, outDir, rawDir } from '../lib.mjs';
import { loadCatechismData } from './curated.mjs';

// abbrev (as printed in the CCC) -> { api: helloao book name, label: citation name, companion }
const BOOKS = {
  'Gen': ['Genesis', 'Genesis', 'moses'], 'Ex': ['Exodus', 'Exodus', 'moses'],
  'Lev': ['Leviticus', 'Leviticus', 'moses'], 'Num': ['Numbers', 'Numbers', 'moses'],
  'Deut': ['Deuteronomy', 'Deuteronomy', 'moses'], 'Josh': ['Joshua', 'Joshua', null],
  'Judg': ['Judges', 'Judges', null], 'Ruth': ['Ruth', 'Ruth', null],
  '1 Sam': ['1 Samuel', '1 Samuel', null], '2 Sam': ['2 Samuel', '2 Samuel', null],
  '1 Kgs': ['1 Kings', '1 Kings', null], '2 Kgs': ['2 Kings', '2 Kings', null],
  '1 Chr': ['1 Chronicles', '1 Chronicles', null], '2 Chr': ['2 Chronicles', '2 Chronicles', null],
  'Ezra': ['Ezra', 'Ezra', null], 'Neh': ['Nehemiah', 'Nehemiah', null],
  'Tob': ['Tobit', 'Tobit', null], 'Jdt': ['Judith', 'Judith', null],
  'Est': ['Esther (Greek)', 'Esther', null], '1 Mac': ['1 Maccabees', '1 Maccabees', null],
  '2 Mac': ['2 Maccabees', '2 Maccabees', null], 'Job': ['Job', 'Job', null],
  'Ps': ['Psalms', 'Psalm', 'david'], 'Prov': ['Proverbs', 'Proverbs', null],
  'Eccl': ['Ecclesiastes', 'Ecclesiastes', null], 'Song': ['Song of Solomon', 'Song of Songs', null],
  'Wis': ['Wisdom of Solomon', 'Wisdom', null], 'Sir': ['Sirach', 'Sirach', null],
  'Isa': ['Isaiah', 'Isaiah', null], 'Jer': ['Jeremiah', 'Jeremiah', null],
  'Lam': ['Lamentations', 'Lamentations', null], 'Bar': ['Baruch', 'Baruch', null],
  'Ezek': ['Ezekiel', 'Ezekiel', null], 'Dan': ['Daniel (Greek)', 'Daniel', null],
  'Hos': ['Hosea', 'Hosea', null], 'Joel': ['Joel', 'Joel', null],
  'Amos': ['Amos', 'Amos', null], 'Obad': ['Obadiah', 'Obadiah', null],
  'Jon': ['Jonah', 'Jonah', null], 'Mic': ['Micah', 'Micah', null],
  'Nah': ['Nahum', 'Nahum', null], 'Hab': ['Habakkuk', 'Habakkuk', null],
  'Zeph': ['Zephaniah', 'Zephaniah', null], 'Hag': ['Haggai', 'Haggai', null],
  'Zech': ['Zechariah', 'Zechariah', null], 'Mal': ['Malachi', 'Malachi', null],
  'Mt': ['Matthew', 'Matthew', null], 'Mk': ['Mark', 'Mark', null],
  'Lk': ['Luke', 'Luke', null], 'Jn': ['John', 'John', null],
  'Acts': ['Acts', 'Acts', null], 'Rom': ['Romans', 'Romans', 'paul'],
  '1 Cor': ['1 Corinthians', '1 Corinthians', 'paul'], '2 Cor': ['2 Corinthians', '2 Corinthians', 'paul'],
  'Gal': ['Galatians', 'Galatians', 'paul'], 'Eph': ['Ephesians', 'Ephesians', 'paul'],
  'Phil': ['Philippians', 'Philippians', 'paul'], 'Col': ['Colossians', 'Colossians', 'paul'],
  '1 Thess': ['1 Thessalonians', '1 Thessalonians', 'paul'], '2 Thess': ['2 Thessalonians', '2 Thessalonians', 'paul'],
  '1 Tim': ['1 Timothy', '1 Timothy', 'paul'], '2 Tim': ['2 Timothy', '2 Timothy', 'paul'],
  'Tit': ['Titus', 'Titus', 'paul'], 'Philem': ['Philemon', 'Philemon', 'paul'],
  'Heb': ['Hebrews', 'Hebrews', null], 'Jas': ['James', 'James', null],
  '1 Pet': ['1 Peter', '1 Peter', 'peter'], '2 Pet': ['2 Peter', '2 Peter', 'peter'],
  '1 Jn': ['1 John', '1 John', null], '2 Jn': ['2 John', '2 John', null],
  '3 Jn': ['3 John', '3 John', null], 'Jude': ['Jude', 'Jude', null],
  'Rev': ['Revelation', 'Revelation', null],
};

const ABBREV_RE = new RegExp(
  `\\b(${Object.keys(BOOKS).sort((a, b) => b.length - a.length).join('|').replace(/\s/g, '\\s')})\\s+(\\d+):(\\d+)(?:\\s*[-–]\\s*(\\d+))?`,
  'g',
);
const FULLNAME_RE =
  /\b(Genesis|Exodus|Matthew|Mark|Luke|John|Acts|Romans|Revelation|Hebrews|James|Jude|Psalm|Isaiah|Jeremiah|Daniel|Ezekiel|Proverbs|Ecclesiastes)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?/g;

function extractRefs() {
  const refs = new Map(); // key -> {abbrev, chapter, v1, v2}
  const add = (abbrev, ch, v1, v2) => {
    if (!BOOKS[abbrev]) return;
    const end = v2 && v2 >= v1 ? v2 : v1;
    const key = `${abbrev}|${ch}|${v1}|${end}`;
    refs.set(key, { abbrev, chapter: ch, v1, v2: end });
  };
  const cccPath = join(outDir, 'ccc.chunks.jsonl');
  if (existsSync(cccPath)) {
    for (const line of readFileSync(cccPath, 'utf8').split('\n').filter(Boolean)) {
      const { text } = JSON.parse(line);
      for (const m of text.matchAll(ABBREV_RE)) add(m[1].replace(/\s+/g, ' '), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : null);
    }
  }
  // The CCC's marginal apparatus — its Scripture cross-references — lives in
  // the mirror pages' footnote zones (everything after the first <HR>), which
  // the CCC adapter strips from paragraph text. Harvest the references from
  // the cached raw pages so the anchor set reflects the passages the
  // Catechism actually leans on, not only the ones its prose names inline.
  const cccRawDir = join(rawDir, 'ccc');
  if (existsSync(cccRawDir)) {
    for (const file of readdirSync(cccRawDir)) {
      if (!file.endsWith('.htm') || file === 'toc.htm') continue;
      const html = readFileSync(join(cccRawDir, file), 'utf8');
      const hr = html.search(/<HR/i);
      if (hr < 0) continue;
      const notes = htmlToText(html.slice(hr));
      for (const m of notes.matchAll(ABBREV_RE)) add(m[1].replace(/\s+/g, ' '), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : null);
    }
  }
  const { CATECHISM, OBJECTIONS } = loadCatechismData();
  const strings = [];
  for (const entries of Object.values(CATECHISM)) for (const e of entries) strings.push(e.scripture);
  for (const o of OBJECTIONS) strings.push(o.scripture);
  const nameToAbbrev = {};
  for (const [abbrev, [, label]] of Object.entries(BOOKS)) nameToAbbrev[label] = abbrev;
  for (const s of strings) {
    for (const m of s.matchAll(ABBREV_RE)) add(m[1].replace(/\s+/g, ' '), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : null);
    for (const m of s.matchAll(FULLNAME_RE)) {
      const abbrev = nameToAbbrev[m[1]] ?? Object.keys(BOOKS).find((k) => BOOKS[k][1] === m[1]);
      if (abbrev) add(abbrev, Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : null);
    }
  }
  return [...refs.values()];
}

function mergeRanges(refs) {
  const byChapter = new Map();
  for (const r of refs) {
    const key = `${r.abbrev}|${r.chapter}`;
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key).push(r);
  }
  const pericopes = [];
  for (const list of byChapter.values()) {
    list.sort((a, b) => a.v1 - b.v1);
    let cur = null;
    for (const r of list) {
      if (cur && r.v1 <= cur.v2 + 1) {
        cur.v2 = Math.max(cur.v2, r.v2);
      } else {
        cur = { ...r };
        pericopes.push(cur);
      }
    }
  }
  return pericopes;
}

function verseText(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.type === 'verse') {
    return (item.content ?? []).map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join('');
  }
  return '';
}

const WEBP_NAME = { 'Esther (Greek)': 'Esther', 'Daniel (Greek)': 'Daniel' };

async function fetchChapter(apiBook, chapter) {
  const webpBook = WEBP_NAME[apiBook] ?? apiBook;
  // Esther: prefer the Hebrew text (eng_webp) — the CCC's Esther references
  // follow it; the Greek edition reorders the material. Everything else
  // prefers the Catholic edition so deuterocanon resolves.
  const order =
    apiBook === 'Esther (Greek)'
      ? [['eng_webp', webpBook], ['eng_webc', apiBook]]
      : [['eng_webc', apiBook], ['eng_webp', webpBook]];
  for (const [translation, name] of order) {
    const url = `https://bible.helloao.org/api/${translation}/${encodeURIComponent(name)}/${chapter}.json`;
    try {
      const raw = await fetchCached(url, `anchors/${translation}-${name.replace(/\s+/g, '_')}-${chapter}.json`, { minIntervalMs: 120 });
      const data = JSON.parse(raw);
      const verses = new Map();
      for (const item of data.chapter?.content ?? []) {
        if (item.type === 'verse') verses.set(item.number, verseText(item).replace(/\s+/g, ' ').trim());
      }
      if (verses.size > 0) return verses;
    } catch {
      // try the other translation
    }
  }
  return null;
}

export async function run(doc) {
  const refs = extractRefs();
  const pericopes = mergeRanges(refs);
  const chaptersNeeded = new Map();
  for (const p of pericopes) {
    const key = `${p.abbrev}|${p.chapter}`;
    if (!chaptersNeeded.has(key)) chaptersNeeded.set(key, BOOKS[p.abbrev][0]);
  }
  const chapterCache = new Map();
  const missingChapterKeys = [];
  for (const [key, apiBook] of chaptersNeeded) {
    const chapter = Number(key.split('|')[1]);
    const verses = await fetchChapter(apiBook, chapter);
    if (!verses) missingChapterKeys.push(key);
    chapterCache.set(key, verses);
  }
  const chunks = [];
  let ordinal = 0;
  const unresolvedSamples = [];
  pericopes.sort((a, b) => a.abbrev.localeCompare(b.abbrev) || a.chapter - b.chapter || a.v1 - b.v1);
  for (const p of pericopes) {
    const verses = chapterCache.get(`${p.abbrev}|${p.chapter}`);
    if (!verses) { unresolvedSamples.push(`${p.abbrev} ${p.chapter}:${p.v1}`); continue; }
    const texts = [];
    for (let v = p.v1; v <= p.v2; v++) {
      const t = verses.get(v);
      if (t) texts.push(t);
    }
    if (texts.length === 0) { unresolvedSamples.push(`${p.abbrev} ${p.chapter}:${p.v1}`); continue; }
    const [, labelBook, companion] = BOOKS[p.abbrev];
    const range = p.v1 === p.v2 ? `${p.v1}` : `${p.v1}–${p.v2}`;
    chunks.push(
      makeChunk(
        doc,
        ordinal++,
        `${labelBook} ${p.chapter}:${p.v1}-${p.v2}`,
        `${labelBook} ${p.chapter}:${range}`,
        texts.join(' '),
        { companion_shelves: companion ? [companion] : [] },
      ),
    );
  }
  return {
    chunks,
    stats: {
      refsExtracted: refs.length,
      pericopes: pericopes.length,
      chaptersFetched: chaptersNeeded.size,
      missingChapters: missingChapterKeys.length,
      missingChapterKeys: missingChapterKeys.slice(0, 20),
      unresolved: unresolvedSamples.length,
      unresolvedSamples: unresolvedSamples.slice(0, 20),
    },
  };
}
