const API_BASE = 'https://api.getbible.net/v2';
const DEFAULT_TRANSLATION = 'web';
const CACHE_PREFIX = 'sanctum_passage_';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * World English Bible book numbers. Chosen because its psalm numbering matches
 * the modern lectionary citations the readings API returns.
 */
const BOOK_NUMBERS: Record<string, number> = {
  Genesis: 1, Exodus: 2, Leviticus: 3, Numbers: 4, Deuteronomy: 5, Joshua: 6,
  Judges: 7, Ruth: 8, '1 Samuel': 9, '2 Samuel': 10, '1 Kings': 11, '2 Kings': 12,
  '1 Chronicles': 13, '2 Chronicles': 14, Ezra: 15, Nehemiah: 16, Esther: 17,
  Job: 18, Psalms: 19, Proverbs: 20, Ecclesiastes: 21, 'Song of Solomon': 22,
  Isaiah: 23, Jeremiah: 24, Lamentations: 25, Ezekiel: 26, Daniel: 27, Hosea: 28,
  Joel: 29, Amos: 30, Obadiah: 31, Jonah: 32, Micah: 33, Nahum: 34, Habakkuk: 35,
  Zephaniah: 36, Haggai: 37, Zechariah: 38, Malachi: 39, Matthew: 40, Mark: 41,
  Luke: 42, John: 43, Acts: 44, Romans: 45, '1 Corinthians': 46, '2 Corinthians': 47,
  Galatians: 48, Ephesians: 49, Philippians: 50, Colossians: 51, '1 Thessalonians': 52,
  '2 Thessalonians': 53, '1 Timothy': 54, '2 Timothy': 55, Titus: 56, Philemon: 57,
  Hebrews: 58, James: 59, '1 Peter': 60, '2 Peter': 61, '1 John': 62, '2 John': 63,
  '3 John': 64, Jude: 65, 'Revelation of John': 66,
  // Deuterocanonical books — absent from the World English Bible, fetched from
  // the Douay-Rheims instead. These numbers are the Douay-Rheims numbering.
  Tobit: 69, Judith: 70, Wisdom: 73, Sirach: 74, Baruch: 75,
  '1 Maccabees': 80, '2 Maccabees': 81,
};

const BOOK_ALIASES: Record<string, string> = {
  psalm: 'Psalms',
  ps: 'Psalms',
  song: 'Song of Solomon',
  'song of songs': 'Song of Solomon',
  'canticle of canticles': 'Song of Solomon',
  revelation: 'Revelation of John',
  revelations: 'Revelation of John',
  apocalypse: 'Revelation of John',
  ecclesiasticus: 'Sirach',
};

/**
 * The World English Bible omits the deuterocanonical books, and its Daniel and
 * Esther lack the Greek chapters. Those fall back to the Douay-Rheims, whose
 * psalm numbering differs from modern citations — which is why the WEB stays
 * the primary translation.
 */
const FALLBACK_TRANSLATION = 'douayrheims';

export interface Passage {
  citation: string;
  text: string;
  translation: string;
}

export interface PassageVerse {
  verse: number;
  text: string;
}

export interface PassageVerses {
  citation: string;
  translation: string;
  verses: PassageVerse[];
}

interface Verse {
  verse: number;
  text: string;
}

interface Segment {
  start: number;
  end: number;
}

interface ParsedCitation {
  book: number;
  chapter: number;
  segments: Segment[];
}

const chapterCache = new Map<string, Verse[]>();

/** Render the divine name the way the liturgy does, rather than "Yahweh". */
function liturgicalize(text: string): string {
  return text.replace(/\bYahweh\b/g, 'the LORD').replace(/\bYah\b/g, 'the LORD');
}

/** Display form of a citation: alternatives trimmed, non-breaking spaces removed. */
function normalizedCitation(citation: string): string {
  return citation.replace(/\u00a0/g, ' ').split(/\s+or\s+/i)[0].trim();
}

function normalizeBook(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, '').replace(/\s+/g, ' ');
  const lower = cleaned.toLowerCase();
  const alias = BOOK_ALIASES[lower];
  if (alias) return BOOK_NUMBERS[alias] ?? null;
  for (const [name, num] of Object.entries(BOOK_NUMBERS)) {
    if (name.toLowerCase() === lower) return num;
  }
  return null;
}

export function parseCitation(citation: string): ParsedCitation | null {
  // Some days offer alternatives: "Daniel 13:1-9 ... or 13:41c-62". Use the first.
  const primary = citation.split(/\s+or\s+/i)[0];
  const normalized = primary.replace(/\u00a0/g, ' ').trim();

  const match = normalized.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z\s.]*?)\s+(\d+)(?::\s*(.+))?$/);
  if (!match) return null;

  const book = normalizeBook(match[1]);
  if (book === null) return null;

  const chapter = parseInt(match[2], 10);
  if (!Number.isFinite(chapter)) return null;

  const segments: Segment[] = [];
  if (match[3]) {
    for (const raw of match[3].split(',')) {
      const clean = raw.replace(/[^\d-]/g, '');
      if (!clean) continue;
      const [a, b] = clean.split('-');
      const start = parseInt(a, 10);
      const end = b ? parseInt(b, 10) : start;
      if (Number.isFinite(start)) segments.push({ start, end: Number.isFinite(end) ? end : start });
    }
  }

  return { book, chapter, segments };
}

function readCache(key: string): Passage | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: Passage };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: Passage): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // ignore
  }
}

async function getChapter(book: number, chapter: number, translation: string): Promise<Verse[] | null> {
  const key = `${translation}:${book}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/${translation}/${book}/${chapter}.json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { verses?: Verse[] };
    if (!Array.isArray(data.verses)) return null;
    chapterCache.set(key, data.verses);
    return data.verses;
  } catch {
    return null;
  }
}

function selectVerses(verses: Verse[], segments: Segment[]): Verse[] {
  const picked: Verse[] = [];
  for (const seg of segments) {
    for (const v of verses) {
      if (v.verse >= seg.start && v.verse <= seg.end) picked.push(v);
    }
  }
  // Drop duplicates and keep canonical order (psalms repeat verses across parts).
  const seen = new Set<number>();
  return picked
    .filter((v) => (seen.has(v.verse) ? false : (seen.add(v.verse), true)))
    .sort((a, b) => a.verse - b.verse);
}

/**
 * Individual verses for a lectionary citation, so callers can pick a line to
 * sit with rather than only reading the passage start to finish.
 * Returns null for books outside both translations or when offline.
 */
export async function fetchPassageVerses(
  citation: string,
  translation: string = DEFAULT_TRANSLATION,
): Promise<PassageVerses | null> {
  const parsed = parseCitation(citation);
  if (!parsed) return null;

  let verses = await getChapter(parsed.book, parsed.chapter, translation);
  let used = translation;

  if (!verses && translation !== FALLBACK_TRANSLATION) {
    verses = await getChapter(parsed.book, parsed.chapter, FALLBACK_TRANSLATION);
    used = FALLBACK_TRANSLATION;
  }

  if (!verses) return null;

  const selected = parsed.segments.length ? selectVerses(verses, parsed.segments) : verses;
  const rendered = selected
    .map((v) => ({ verse: v.verse, text: liturgicalize(v.text.trim()) }))
    .filter((v) => v.text);
  if (!rendered.length) return null;

  return { citation: normalizedCitation(citation), translation: used, verses: rendered };
}

/**
 * Full public-domain text for a lectionary citation, e.g. "Matthew 22:15-21".
 */
export async function fetchPassage(
  citation: string,
  translation: string = DEFAULT_TRANSLATION,
): Promise<Passage | null> {
  const cacheKey = `${translation}|${citation}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const result = await fetchPassageVerses(citation, translation);
  if (!result) return null;

  const passage: Passage = {
    citation: result.citation,
    text: result.verses.map((v) => v.text).join(' '),
    translation: result.translation,
  };
  writeCache(cacheKey, passage);
  return passage;
}

export interface ReadingTexts {
  first: Passage | null;
  psalm: Passage | null;
  second: Passage | null;
  gospel: Passage | null;
}

/** Fetch the full text of every reading in a day's lectionary set. */
export async function fetchReadingTexts(citations: {
  firstReading?: string | null;
  psalm?: string | null;
  secondReading?: string | null;
  gospel?: string | null;
}): Promise<ReadingTexts> {
  const [first, psalm, second, gospel] = await Promise.all([
    citations.firstReading ? fetchPassage(citations.firstReading) : Promise.resolve(null),
    citations.psalm ? fetchPassage(citations.psalm) : Promise.resolve(null),
    citations.secondReading ? fetchPassage(citations.secondReading) : Promise.resolve(null),
    citations.gospel ? fetchPassage(citations.gospel) : Promise.resolve(null),
  ]);
  return { first, psalm, second, gospel };
}
