/*
  Catena Aurea — Aquinas's chain of the Fathers on the four Gospels, in the
  public-domain Oxford translation (1841–45), from archive.org scans of the
  original edition (spec §7, Phase 1). License tier A, authority tier 5,
  shelf: gospel-commentary.

  OCR reality (recorded honestly): the djvu text is a raw OCR of 1840s print.
  The edition's structure survives in its RUNNING HEADS — even pages read
  "GOSPEL ACCORDING TO — CHAP. V.", odd pages "VER. 3. ST. MATTHEW." — which
  give every page a (chapter, verse) context; we track that state line by
  line. Father attributions were margin notes in the print edition; where a
  paragraph begins with a Father's name we take it as the attribution (the
  spec's label format), otherwise the chunk is unlabeled by Father. Margin
  gibberish lines (high symbol density) are dropped. What remains is noisy
  but genuinely the Fathers on the passage — good enough for tier-5
  retrieval grounding, and the noise is a known property of this shelf.
*/

import { fetchCached, makeChunk, normalizeText } from '../lib.mjs';

const VOLUMES = [
  'catenaaureacomme01thom',
  'catenaaureacomme02thom',
  'catenaaureacomme03thomuoft',
  'p1catenaaureacomme04thom',
  'p2catenaaureacom05thomuoft',
  'catenaaureacomme06unse',
];

const GOSPELS = { MATTHEW: 'Mt', MARK: 'Mk', LUKE: 'Lk', JOHN: 'Jn' };
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23, XXIV: 24, XXV: 25, XXVI: 26, XXVII: 27, XXVIII: 28 };

const FATHERS = [
  [/^Aug(\.|ustine)/, 'Augustine'], [/^Chrys(\.|ostom)/, 'Chrysostom'], [/^Jerome/, 'Jerome'],
  [/^Gregory/, 'Gregory'], [/^Ambrose/, 'Ambrose'], [/^Hilary/, 'Hilary'], [/^Gloss/, 'Gloss'],
  [/^Remig(\.|ius)/, 'Remigius'], [/^Raban(\.|us)/, 'Rabanus'], [/^Bede/, 'Bede'],
  [/^Leo/, 'Leo'], [/^Origen/, 'Origen'], [/^Cyril/, 'Cyril'], [/^Euseb(\.|ius)/, 'Eusebius'],
  [/^Pseudo-Chrys/, 'Pseudo-Chrysostom'], [/^Pseudo-Athan/, 'Pseudo-Athanasius'],
  [/^Isid(\.|ore)/, 'Isidore'], [/^Maximus/, 'Maximus'], [/^Dionys/, 'Dionysius'],
  [/^John of Damascus|Damascene/, 'John of Damascus'], [/^Theophyl/, 'Theophylact'],
];

function detectGospel(text) {
  const head = text.slice(0, 60000);
  const m = head.match(/ST\.\s+(MATTHEW|MARK|LUKE|JOHN)/);
  if (m) return GOSPELS[m[1]];
  const m2 = head.match(/GOSPEL (?:OF|ACCORDING TO)[\s\S]{0,40}?(MATTHEW|MARK|LUKE|JOHN)/);
  return m2 ? GOSPELS[m2[1]] : null;
}

// A Gospel can begin mid-scan (the bound parts don't respect volume
// boundaries — Mark starts inside the second scan), so the gospel is state
// tracked through the volume: a title line ("ST. MARK.") or a running head
// naming another Gospel switches it.
const TITLE_LINE_RE = /^ST\.\s+(MATTHEW|MARK|LUKE|JOHN)\.?\s*(PART.*)?$/;
const VER_HEAD_GOSPEL_RE = /VER\.\s*\d+\.\s+ST\.\s+(MATTHEW|MARK|LUKE|JOHN)/;

function isGarbageLine(line) {
  const t = line.trim();
  if (t.length < 3) return true;
  const alnum = (t.match(/[A-Za-z0-9 ]/g) ?? []).length;
  return t.length >= 12 && alnum / t.length < 0.55;
}

function parseVolume(raw, initialGospel) {
  const lines = raw.split('\n');
  let gospel = initialGospel;
  let chapter = null;
  let verse = null;
  let started = false;
  const blocks = []; // {gospel, chapter, verse, father, text}
  let paraLines = [];
  const flushPara = () => {
    if (!paraLines.length) return;
    let text = paraLines.join(' ');
    paraLines = [];
    text = text.replace(/(\w)-\s+(\w)/g, '$1$2').replace(/\s+/g, ' ').trim();
    if (text.length < 40) return;
    let father = null;
    for (const [re, name] of FATHERS) {
      if (re.test(text)) { father = name; break; }
    }
    blocks.push({ gospel, chapter, verse, father, text });
  };
  for (const line of lines) {
    const t = line.trim();
    // A new Gospel's title page switches the gospel state (and resets the
    // chapter/verse state until its running heads take over).
    const titleM = t.length < 60 ? t.replace(/\s+/g, ' ').match(TITLE_LINE_RE) : null;
    if (titleM && GOSPELS[titleM[1]] !== gospel) {
      flushPara();
      gospel = GOSPELS[titleM[1]];
      chapter = null;
      verse = null;
      started = false;
      continue;
    }
    // Running heads carry the (chapter, verse) state — and the gospel name.
    const chapM = t.match(/CHAP?\.?\s*([IVX]{1,8})\b/i);
    const verM = t.match(/\bVER\.\s*(\d+)/i);
    if (t.length < 70 && (chapM || verM) && /\d/.test(t)) {
      const headGospel = t.match(VER_HEAD_GOSPEL_RE);
      if (headGospel && GOSPELS[headGospel[1]] !== gospel) {
        flushPara();
        gospel = GOSPELS[headGospel[1]];
        chapter = null;
        verse = null;
      }
      if (chapM && ROMAN[chapM[1].toUpperCase()]) {
        flushPara();
        chapter = ROMAN[chapM[1].toUpperCase()];
        started = true;
      }
      if (verM) verse = Number(verM[1]);
      continue;
    }
    if (!started) continue;
    if (!t) { flushPara(); continue; }
    if (isGarbageLine(t)) continue;
    paraLines.push(t);
  }
  flushPara();
  return blocks;
}

export async function run(doc) {
  const chunks = [];
  let ordinal = 0;
  const perVolume = [];
  for (const id of VOLUMES) {
    const url = `https://archive.org/download/${id}/${id}_djvu.txt`;
    let raw;
    try {
      raw = await fetchCached(url, `catena/${id}.txt`, { minIntervalMs: 0 });
    } catch (err) {
      perVolume.push({ id, error: String(err).slice(0, 120) });
      continue;
    }
    const gospel = detectGospel(raw);
    if (!gospel) {
      perVolume.push({ id, error: 'gospel not detected' });
      continue;
    }
    const blocks = parseVolume(raw, gospel);
    // Group blocks into chunks: new chunk at size, at gospel/chapter change,
    // or at a fresh Father attribution once the chunk has substance.
    let current = null;
    const flush = () => {
      if (!current) return;
      const { gospel: g, chapter, verse, father } = current;
      const ref = verse ? `${g} ${chapter}:${verse}` : `${g} ${chapter}`;
      const label = father ? `Catena Aurea on ${ref} (${father})` : `Catena Aurea on ${ref}`;
      chunks.push(
        makeChunk(doc, ordinal++, `on ${ref}`, label, current.texts.join('\n\n'), {
          shelf_tags: [...doc.shelf_tags],
        }),
      );
      current = null;
    };
    for (const b of blocks) {
      if (!b.chapter) continue;
      const size = current ? current.texts.join('').length : 0;
      const newChunk =
        !current ||
        b.gospel !== current.gospel ||
        b.chapter !== current.chapter ||
        size > 950 ||
        (b.father && b.father !== current.father && size > 420);
      if (newChunk) {
        flush();
        current = { gospel: b.gospel, chapter: b.chapter, verse: b.verse, father: b.father, texts: [b.text] };
      } else {
        current.texts.push(b.text);
        if (!current.father && b.father) current.father = b.father;
        if (current.verse == null && b.verse != null) current.verse = b.verse;
      }
    }
    flush();
    const gospelsSeen = [...new Set(blocks.map((b) => b.gospel))];
    perVolume.push({ id, gospels: gospelsSeen, blocks: blocks.length });
  }
  return { chunks, stats: { perVolume } };
}

export { normalizeText };
