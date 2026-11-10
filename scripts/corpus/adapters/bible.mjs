/*
  The complete World English Bible, Catholic edition (spec §7, Phase 2):
  all 73 books of the Catholic canon, fetched chapter by chapter from the
  Free Bible API (bible.helloao.org, translation eng_webc) — the same API
  and edition the Phase 0 anchor set drew its pericopes from, here taken
  whole instead of footnote-harvested. Public domain (license tier A,
  authority tier 1). The anchor set stays as its own work: it is the
  Catechism's citation footprint; this is the book itself.

  Chunking (spec §4.3, Scripture): pericope-shaped runs of verses —
  verses accumulate to ~1,100 characters and break only on verse
  boundaries, so every chunk cites as a verse range (Genesis 1:1–5).
  A chapter never spans chunks across its boundary, and a single verse
  longer than the target stands alone rather than splitting mid-verse.
*/

import { fetchCached, makeChunk } from '../lib.mjs';

const TRANSLATION = 'eng_webc';
const FALLBACK = 'eng_webp';
const TARGET_CHARS = 1100;

function verseText(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.type === 'verse') {
    // Verse content arrives as fragments split at footnote markers and
    // formatting boundaries ("In the beginning, God" + note + "created
    // the heavens…"). Join on a space and repair the punctuation spacing
    // that creates — joining on '' would weld words together.
    return (item.content ?? [])
      .map((c) => (typeof c === 'string' ? c : c?.text ?? ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/ ([,.;:!?%)])/g, '$1')
      .replace(/([(\[]) /g, '$1')
      .trim();
  }
  return '';
}

async function fetchJson(url, cacheName) {
  const raw = await fetchCached(url, cacheName, { minIntervalMs: 60 });
  return JSON.parse(raw);
}

async function fetchChapter(book, chapter) {
  try {
    const data = await fetchJson(
      `https://bible.helloao.org/api/${TRANSLATION}/${book.id}/${chapter}.json`,
      `bible/${TRANSLATION}-${book.id}-${chapter}.json`,
    );
    if (data?.chapter?.content?.length) return { data, used: TRANSLATION };
  } catch { /* fall through to the fallback edition */ }
  try {
    const data = await fetchJson(
      `https://bible.helloao.org/api/${FALLBACK}/${book.id}/${chapter}.json`,
      `bible/${FALLBACK}-${book.id}-${chapter}.json`,
    );
    if (data?.chapter?.content?.length) return { data, used: FALLBACK };
  } catch { /* missing entirely — recorded in stats by the caller */ }
  return { data: null, used: null };
}

export async function run(doc) {
  const index = await fetchJson(
    `https://bible.helloao.org/api/${TRANSLATION}/books.json`,
    `bible/books-${TRANSLATION}.json`,
  );
  const books = index.books ?? [];
  const chunks = [];
  let ordinal = 0;
  const stats = {
    books: books.length,
    chapters: 0,
    verses: 0,
    fallbackChapters: [],
    missingChapters: [],
  };

  // Fetch every chapter through a small worker pool (the API is slow
  // per request; sequential fetching of ~1,330 chapters takes the
  // better part of an hour). Results land in a map; chunking below
  // still walks the canon in order.
  const tasks = [];
  for (const book of books) {
    for (let chapter = 1; chapter <= book.numberOfChapters; chapter++) tasks.push({ book, chapter });
  }
  const fetched = new Map();
  let cursor = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      fetched.set(`${task.book.id}|${task.chapter}`, await fetchChapter(task.book, task.chapter));
    }
  });
  await Promise.all(workers);

  for (const book of books) {
    const labelBook = book.id === 'PSA' ? 'Psalm' : book.name;
    for (let chapter = 1; chapter <= book.numberOfChapters; chapter++) {
      const { data, used } = fetched.get(`${book.id}|${chapter}`) ?? { data: null, used: null };
      const verses = [];
      for (const item of data?.chapter?.content ?? []) {
        if (item.type === 'verse') {
          const t = verseText(item).replace(/\s+/g, ' ').trim();
          if (t) verses.push({ n: item.number, text: t });
        }
      }
      if (verses.length === 0) {
        stats.missingChapters.push(`${book.name} ${chapter}`);
        continue;
      }
      if (used === FALLBACK) stats.fallbackChapters.push(`${book.name} ${chapter}`);
      stats.chapters++;
      stats.verses += verses.length;

      let runStart = null;
      let runEnd = null;
      let runTexts = [];
      let runChars = 0;
      const flush = () => {
        if (!runTexts.length) return;
        const range = runStart === runEnd ? `${runStart}` : `${runStart}–${runEnd}`;
        chunks.push(
          makeChunk(
            doc,
            ordinal++,
            `${labelBook} ${chapter}:${runStart}-${runEnd}`,
            `${labelBook} ${chapter}:${range}`,
            runTexts.join(' '),
          ),
        );
        runStart = null;
        runEnd = null;
        runTexts = [];
        runChars = 0;
      };
      for (const v of verses) {
        if (runTexts.length && runChars + v.text.length + 1 > TARGET_CHARS) flush();
        if (runStart === null) runStart = v.n;
        runTexts.push(v.text);
        runEnd = v.n;
        runChars += v.text.length + 1;
      }
      flush();
    }
  }
  stats.fallbackChapters = stats.fallbackChapters.slice(0, 20);
  stats.missingChapters = stats.missingChapters.slice(0, 20);
  return { chunks, stats };
}
