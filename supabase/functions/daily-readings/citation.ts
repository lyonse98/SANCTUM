// Citation grammar for the daily readings (ported from src/lib/bible.ts — the
// two must parse identically). Pure and dependency-free, in its own module so
// the grammar can be unit-tested without booting the function's serve entry.

const BOOK_NUMBERS: Record<string, number> = {
  Genesis: 1, Exodus: 2, Leviticus: 3, Numbers: 4, Deuteronomy: 5, Joshua: 6,
  Judges: 7, Ruth: 8, "1 Samuel": 9, "2 Samuel": 10, "1 Kings": 11, "2 Kings": 12,
  "1 Chronicles": 13, "2 Chronicles": 14, Ezra: 15, Nehemiah: 16, Esther: 17,
  Job: 18, Psalms: 19, Proverbs: 20, Ecclesiastes: 21, "Song of Solomon": 22,
  Isaiah: 23, Jeremiah: 24, Lamentations: 25, Ezekiel: 26, Daniel: 27, Hosea: 28,
  Joel: 29, Amos: 30, Obadiah: 31, Jonah: 32, Micah: 33, Nahum: 34, Habakkuk: 35,
  Zephaniah: 36, Haggai: 37, Zechariah: 38, Malachi: 39, Matthew: 40, Mark: 41,
  Luke: 42, John: 43, Acts: 44, Romans: 45, "1 Corinthians": 46, "2 Corinthians": 47,
  Galatians: 48, Ephesians: 49, Philippians: 50, Colossians: 51, "1 Thessalonians": 52,
  "2 Thessalonians": 53, "1 Timothy": 54, "2 Timothy": 55, Titus: 56, Philemon: 57,
  Hebrews: 58, James: 59, "1 Peter": 60, "2 Peter": 61, "1 John": 62, "2 John": 63,
  "3 John": 64, Jude: 65, "Revelation of John": 66,
  Tobit: 69, Judith: 70, Wisdom: 73, Sirach: 74, Baruch: 75,
  "1 Maccabees": 80, "2 Maccabees": 81,
};

const BOOK_ALIASES: Record<string, string> = {
  psalm: "Psalms",
  ps: "Psalms",
  song: "Song of Solomon",
  "song of songs": "Song of Solomon",
  "canticle of canticles": "Song of Solomon",
  revelation: "Revelation of John",
  revelations: "Revelation of John",
  apocalypse: "Revelation of John",
  ecclesiasticus: "Sirach",
};

export interface Segment { start: number; end: number }

// The single-chapter books, by the numbers above. Citations to them are
// written by verse alone — "2 John 4-9" is the only chapter, verses 4-9 —
// so no colon ever appears in the citation.
const SINGLE_CHAPTER_BOOKS = new Set([31, 57, 63, 64, 65]); // Obadiah, Philemon, 2 John, 3 John, Jude

function normalizeBook(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();
  const alias = BOOK_ALIASES[lower];
  if (alias) return BOOK_NUMBERS[alias] ?? null;
  for (const [name, num] of Object.entries(BOOK_NUMBERS)) {
    if (name.toLowerCase() === lower) return num;
  }
  return null;
}

function parseSegments(rawList: string): Segment[] {
  const segments: Segment[] = [];
  for (const raw of rawList.split(",")) {
    const clean = raw.replace(/[^\d-]/g, "");
    if (!clean) continue;
    const [a, b] = clean.split("-");
    const start = parseInt(a, 10);
    const end = b ? parseInt(b, 10) : start;
    if (Number.isFinite(start)) segments.push({ start, end: Number.isFinite(end) ? end : start });
  }
  return segments;
}

export function parseCitation(citation: string): { book: number; chapter: number; segments: Segment[] } | null {
  const primary = citation.split(/\s+or\s+/i)[0];
  const normalized = primary.replace(/ /g, " ").trim();

  // Single-chapter shape first: a colonless verse list after the book name
  // ("2 John 4-9", "Jude 17, 20-25", "Philemon 6") is chapter 1 with those
  // verses. For any other book a colonless tail keeps its old meaning in the
  // main grammar below — a whole chapter ("Psalm 119").
  const verseList = normalized.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z\s.]*?)\s+(\d+[a-zA-Z]?(?:\s*-\s*\d+[a-zA-Z]?)?(?:\s*,\s*\d+[a-zA-Z]?(?:\s*-\s*\d+[a-zA-Z]?)?)*)$/);
  if (verseList) {
    const book = normalizeBook(verseList[1]);
    if (book !== null && SINGLE_CHAPTER_BOOKS.has(book)) {
      const segments = parseSegments(verseList[2]);
      if (segments.length) return { book, chapter: 1, segments };
    }
  }

  const match = normalized.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z\s.]*?)\s+(\d+)(?::\s*(.+))?$/);
  if (!match) return null;
  const book = normalizeBook(match[1]);
  if (book === null) return null;
  const chapter = parseInt(match[2], 10);
  if (!Number.isFinite(chapter)) return null;
  const segments = match[3] ? parseSegments(match[3]) : [];
  return { book, chapter, segments };
}
