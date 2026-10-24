// Serves the day's readings bundle: lectionary citations + Gospel verses + the full
// text of every reading, assembled ONCE per day and cached in `daily_readings`.
//
// Why: the client used to call an unofficial single-maintainer lectionary API and the
// getbible.net API from every phone, every day. If that API died, Sanctum's front page
// was empty. Now the first request of the day pays the upstream calls; everyone else
// gets the cached row. The browser sends only a date string.
//
// verify_jwt is false: no-auth app, public daily content.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const READINGS_BASE = "https://cpbjr.github.io/catholic-readings-api";
const GETBIBLE_BASE = "https://api.getbible.net/v2";
const DEFAULT_TRANSLATION = "web";
const FALLBACK_TRANSLATION = "douayrheims";

// ── Bible text (ported from src/lib/bible.ts — the two must render identically) ──

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

interface Verse { verse: number; text: string }
interface Segment { start: number; end: number }

function liturgicalize(text: string): string {
  return text.replace(/\bYahweh\b/g, "the LORD").replace(/\bYah\b/g, "the LORD");
}

function normalizedCitation(citation: string): string {
  return citation.replace(/ /g, " ").split(/\s+or\s+/i)[0].trim();
}

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

function parseCitation(citation: string): { book: number; chapter: number; segments: Segment[] } | null {
  const primary = citation.split(/\s+or\s+/i)[0];
  const normalized = primary.replace(/ /g, " ").trim();
  const match = normalized.match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z\s.]*?)\s+(\d+)(?::\s*(.+))?$/);
  if (!match) return null;
  const book = normalizeBook(match[1]);
  if (book === null) return null;
  const chapter = parseInt(match[2], 10);
  if (!Number.isFinite(chapter)) return null;
  const segments: Segment[] = [];
  if (match[3]) {
    for (const raw of match[3].split(",")) {
      const clean = raw.replace(/[^\d-]/g, "");
      if (!clean) continue;
      const [a, b] = clean.split("-");
      const start = parseInt(a, 10);
      const end = b ? parseInt(b, 10) : start;
      if (Number.isFinite(start)) segments.push({ start, end: Number.isFinite(end) ? end : start });
    }
  }
  return { book, chapter, segments };
}

const chapterCache = new Map<string, Verse[]>();

async function getChapter(book: number, chapter: number, translation: string): Promise<Verse[] | null> {
  const key = `${translation}:${book}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(`${GETBIBLE_BASE}/${translation}/${book}/${chapter}.json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json();
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
  const seen = new Set<number>();
  return picked
    .filter((v) => (seen.has(v.verse) ? false : (seen.add(v.verse), true)))
    .sort((a, b) => a.verse - b.verse);
}

async function fetchPassageVerses(citation: string) {
  const parsed = parseCitation(citation);
  if (!parsed) return null;
  let verses = await getChapter(parsed.book, parsed.chapter, DEFAULT_TRANSLATION);
  let used = DEFAULT_TRANSLATION;
  if (!verses && DEFAULT_TRANSLATION !== FALLBACK_TRANSLATION) {
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

async function fetchPassage(citation: string) {
  const result = await fetchPassageVerses(citation);
  if (!result) return null;
  return {
    citation: result.citation,
    text: result.verses.map((v) => v.text).join(" "),
    translation: result.translation,
  };
}

// ── Lectionary citations (mirrors src/lib/readings.ts) ──────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function buildBundle(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  const md = `${month}-${day}`;
  const [readings, calendar] = await Promise.all([
    fetchJson<any>(`${READINGS_BASE}/readings/${year}/${md}.json`),
    fetchJson<any>(`${READINGS_BASE}/liturgical-calendar/${year}/${md}.json`),
  ]);
  const gospel = readings?.readings?.gospel ?? null;
  if (!gospel && !calendar?.celebration?.name) return null;

  const citations = {
    date: dateKey,
    season: readings?.season ?? calendar?.season ?? null,
    celebration: calendar?.celebration?.name ?? null,
    firstReading: readings?.readings?.firstReading ?? null,
    psalm: readings?.readings?.psalm ?? null,
    secondReading: readings?.readings?.secondReading ?? null,
    gospel,
    usccbLink: readings?.usccbLink ?? null,
  };

  const [gospelVerses, first, psalm, second, gospelText] = await Promise.all([
    gospel ? fetchPassageVerses(gospel) : Promise.resolve(null),
    citations.firstReading ? fetchPassage(citations.firstReading) : Promise.resolve(null),
    citations.psalm ? fetchPassage(citations.psalm) : Promise.resolve(null),
    citations.secondReading ? fetchPassage(citations.secondReading) : Promise.resolve(null),
    gospel ? fetchPassage(gospel) : Promise.resolve(null),
  ]);

  return { citations, gospelVerses, texts: { first, psalm, second, gospel: gospelText } };
}

// ── Table cache ─────────────────────────────────────────────────────────────

async function checkTable(dateKey: string): Promise<unknown | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_readings?date=eq.${dateKey}&select=payload`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0].payload) return rows[0].payload;
    return null;
  } catch {
    return null;
  }
}

async function storeBundle(dateKey: string, payload: unknown): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/daily_readings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: <redacted>
        Authorization: <redacted>
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ date: dateKey, payload }),
    });
  } catch {
    // A failed store only means the next request rebuilds — never fail the read for it.
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("date");
    const dateKey = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayKey();

    const cached = await checkTable(dateKey);
    if (cached) {
      return new Response(JSON.stringify(cached), { headers: jsonHeaders });
    }

    const bundle = await buildBundle(dateKey);
    if (!bundle) {
      return new Response(
        JSON.stringify({ error: "Readings unavailable for that date." }),
        { status: 502, headers: jsonHeaders },
      );
    }
    await storeBundle(dateKey, bundle);
    return new Response(JSON.stringify(bundle), { headers: jsonHeaders });
  } catch {
    return new Response(
      JSON.stringify({ error: "Readings unavailable." }),
      { status: 502, headers: jsonHeaders },
    );
  }
});
