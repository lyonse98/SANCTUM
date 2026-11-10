/*
  The corpus registry (spec §4.1): every work the pipeline knows, with its
  provenance, license tier (§6), authority tier (§5.1), shelves, and the
  adapter that ingests it. A work that cannot name its source and license
  tier does not belong here — the pipeline refuses unprovenanced text.
*/

import { run as ccc } from './adapters/ccc.mjs';
import { run as bibleFull } from './adapters/bible.mjs';
import { teresaLife, teresaCastle, ignatiusExercises, ignatiusAutobiography } from './adapters/ccel.mjs';
import { storyOfASoul, catherineDialogue, catherineLetters, joanTrial } from './adapters/plaintext.mjs';
import { lumenGentiumMary, diviniAmoris } from './adapters/vatican.mjs';
import { run as curated } from './adapters/curated.mjs';
import { run as anchors } from './adapters/anchors.mjs';
import { run as summa } from './adapters/summa.mjs';
import { run as catena } from './adapters/catena.mjs';
import { athanasiusIncarnation, athanasiusAnthony } from './adapters/npnf204.mjs';
import { chrysostomMatthew, chrysostomJohn, cityOfGod, confessions, enchiridion } from './adapters/nafathers.mjs';

export const WORKS = [
  // ── Phase 0 ──────────────────────────────────────────────────────────────
  {
    phase: 0,
    adapter: ccc,
    doc: {
      id: 'ccc', title: 'Catechism of the Catholic Church', author: 'Holy See', year: 1997,
      source_name: 'scborromeo.org (St. Charles Borromeo Catholic Church) — text: Libreria Editrice Vaticana, 2nd edition',
      source_url: 'https://www.scborromeo.org/ccc/ccc_toc.htm',
      license_tier: 'B', authority_tier: 2, language: 'en',
      shelf_tags: ['catechism'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 0,
    adapter: curated,
    doc: {
      id: 'sanctum-curated', title: 'Sanctum Curated Shelf — Catechism Entries & Objections',
      author: 'Sanctum (Erik-reviewed)', year: 2026,
      source_name: 'Sanctum', source_url: 'src/data/catechism.ts (repo)',
      license_tier: 'A', authority_tier: 8, language: 'en',
      shelf_tags: [], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 0,
    adapter: anchors,
    doc: {
      id: 'scripture-web', title: 'World English Bible — Anchor Passages',
      author: 'World English Bible (public domain)', year: 2020,
      source_name: 'bible.helloao.org (Free Bible API) — WEB Catholic/Protestant editions',
      source_url: 'https://bible.helloao.org/api',
      license_tier: 'A', authority_tier: 1, language: 'en',
      shelf_tags: ['scripture'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  // ── Phase 1 ──────────────────────────────────────────────────────────────
  {
    phase: 1,
    adapter: summa,
    doc: {
      id: 'summa', title: 'Summa Theologiae', author: 'St. Thomas Aquinas', year: 1920,
      source_name: 'New Advent — Fathers of the English Dominican Province translation',
      source_url: 'https://www.newadvent.org/summa/',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['theology'], companion_shelves: ['aquinas'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: catena,
    doc: {
      id: 'catena-aurea', title: 'Catena Aurea — Commentary on the Four Gospels',
      author: 'St. Thomas Aquinas (compiler)', year: 1843,
      source_name: 'archive.org — Oxford edition (1841–45), djvu OCR text',
      source_url: 'https://archive.org/search?query=catena+aurea',
      license_tier: 'A', authority_tier: 5, language: 'en',
      shelf_tags: ['gospel-commentary'], companion_shelves: ['aquinas'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: confessions,
    doc: {
      id: 'confessions-augustine', title: 'Confessions', author: 'St. Augustine of Hippo', year: 1887,
      source_name: 'New Advent — Pusey translation (revised), NPNF',
      source_url: 'https://www.newadvent.org/fathers/1101.htm',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['autobiography', 'prayer'], companion_shelves: ['augustine'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: cityOfGod,
    doc: {
      id: 'city-of-god-augustine', title: 'City of God', author: 'St. Augustine of Hippo', year: 1871,
      source_name: 'New Advent — Dods translation (NPNF)',
      source_url: 'https://www.newadvent.org/fathers/1201.htm',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['history', 'doctrine'], companion_shelves: ['augustine'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: enchiridion,
    doc: {
      id: 'enchiridion-augustine', title: 'Enchiridion (Handbook on Faith, Hope, and Love)', author: 'St. Augustine of Hippo', year: 1887,
      source_name: 'New Advent — Shaw translation (NPNF)',
      source_url: 'https://www.newadvent.org/fathers/1302.htm',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['doctrine'], companion_shelves: ['augustine'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: chrysostomMatthew,
    doc: {
      id: 'chrysostom-matthew', title: 'Homilies on the Gospel of Matthew', author: 'St. John Chrysostom', year: 1888,
      source_name: 'New Advent — NPNF Series I, Vol. X',
      source_url: 'https://www.newadvent.org/fathers/2001.htm',
      license_tier: 'A', authority_tier: 5, language: 'en',
      shelf_tags: ['gospel-commentary'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: chrysostomJohn,
    doc: {
      id: 'chrysostom-john', title: 'Homilies on the Gospel of John', author: 'St. John Chrysostom', year: 1889,
      source_name: 'New Advent — NPNF Series I, Vol. XIV',
      source_url: 'https://www.newadvent.org/fathers/2401.htm',
      license_tier: 'A', authority_tier: 5, language: 'en',
      shelf_tags: ['gospel-commentary'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: athanasiusIncarnation,
    doc: {
      id: 'athanasius-incarnation', title: 'On the Incarnation of the Word', author: 'St. Athanasius', year: 1892,
      source_name: 'CCEL — ThML (Robertson translation, NPNF Series II, Vol. IV)',
      source_url: 'https://ccel.org/ccel/schaff/npnf204.xml',
      license_tier: 'A', authority_tier: 5, language: 'en',
      shelf_tags: ['christology'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 1,
    adapter: athanasiusAnthony,
    doc: {
      id: 'athanasius-anthony', title: 'Life of Anthony', author: 'St. Athanasius', year: 1892,
      source_name: 'CCEL — ThML (Ellershaw translation, NPNF Series II, Vol. IV)',
      source_url: 'https://ccel.org/ccel/schaff/npnf204.xml',
      license_tier: 'A', authority_tier: 5, language: 'en',
      shelf_tags: ['saints', 'monastic'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  // ── Phase 2 — companion source packs ─────────────────────────────────────
  {
    phase: 2,
    adapter: bibleFull,
    doc: {
      id: 'bible-web-full', title: 'World English Bible — Complete (Catholic Edition)',
      author: 'World English Bible (public domain)', year: 2020,
      source_name: 'bible.helloao.org (Free Bible API) — WEB Catholic edition (eng_webc), all 73 books',
      source_url: 'https://bible.helloao.org/api',
      license_tier: 'A', authority_tier: 1, language: 'en',
      shelf_tags: ['scripture'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: storyOfASoul,
    doc: {
      id: 'story-of-a-soul-therese', title: "Story of a Soul (L'Histoire d'une Âme) — with her Counsels, Letters, and Poems",
      author: 'St. Thérèse of Lisieux', year: 1912,
      source_name: 'Project Gutenberg #16772 — T. N. Taylor translation, from "Soeur Thérèse of Lisieux" (Burns, Oates & Washbourne, 1912; 8th ed. 1922)',
      source_url: 'https://www.gutenberg.org/cache/epub/16772/pg16772.txt',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['autobiography', 'saints'], companion_shelves: ['therese', 'therese-women'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: teresaLife,
    doc: {
      id: 'life-teresa', title: 'The Life of St. Teresa of Jesus', author: 'St. Teresa of Avila', year: 1870,
      source_name: 'CCEL — ThML (David Lewis translation, 1870)',
      source_url: 'https://ccel.org/ccel/teresa/life.xml',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['autobiography', 'prayer'], companion_shelves: ['teresa'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: teresaCastle,
    doc: {
      id: 'interior-castle-teresa', title: 'The Interior Castle (The Mansions)', author: 'St. Teresa of Avila', year: 1912,
      source_name: 'CCEL — ThML (Benedictines of Stanbrook translation, 1912)',
      source_url: 'https://ccel.org/ccel/teresa/castle2.xml',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['prayer', 'mysticism'], companion_shelves: ['teresa'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: catherineDialogue,
    doc: {
      id: 'dialogue-catherine', title: 'The Dialogue of the Seraphic Virgin Catherine of Siena', author: 'St. Catherine of Siena', year: 1896,
      source_name: 'archive.org — Algar Thorold translation (Kegan Paul, Trench, Trübner, 1896), djvu text',
      source_url: 'https://archive.org/download/seraphicvirginca00cathuoft/seraphicvirginca00cathuoft_djvu.txt',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['mysticism', 'prayer'], companion_shelves: ['catherine'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: catherineLetters,
    doc: {
      id: 'letters-catherine', title: 'Saint Catherine of Siena as Seen in Her Letters', author: 'St. Catherine of Siena', year: 1905,
      source_name: 'archive.org — Vida D. Scudder translation/edition (J. M. Dent, 1905; scan of the 1911 reprint), djvu text',
      source_url: 'https://archive.org/download/saintcatherineof00cath/saintcatherineof00cath_djvu.txt',
      license_tier: 'A', authority_tier: 4, language: 'en',
      shelf_tags: ['letters', 'saints'], companion_shelves: ['catherine'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: ignatiusExercises,
    doc: {
      id: 'exercises-ignatius', title: 'The Spiritual Exercises', author: 'St. Ignatius of Loyola', year: 1914,
      source_name: 'CCEL — ThML (Elder Mullan translation, 1914)',
      source_url: 'https://ccel.org/ccel/ignatius/exercises.xml',
      license_tier: 'A', authority_tier: 6, language: 'en',
      shelf_tags: ['prayer', 'discernment'], companion_shelves: ['ignatius'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: ignatiusAutobiography,
    doc: {
      id: 'autobiography-ignatius', title: "The Autobiography of St. Ignatius Loyola (A Pilgrim's Journey)", author: 'St. Ignatius of Loyola', year: 1900,
      source_name: "CCEL — ThML (J. F. X. O'Conor translation, 1900)",
      source_url: 'https://ccel.org/ccel/ignatius/autobiography.xml',
      license_tier: 'A', authority_tier: 6, language: 'en',
      shelf_tags: ['autobiography', 'saints'], companion_shelves: ['ignatius'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: joanTrial,
    doc: {
      id: 'trial-joan', title: "The Trial of Jeanne d'Arc — the Trials of Condemnation and Rehabilitation",
      author: "Jeanne d'Arc trial record (trans. T. Douglas Murray)", year: 1902,
      source_name: 'archive.org — Murray, "Jeanne d\'Arc, Maid of Orleans, Deliverer of France" (McClure, Phillips, 1902), djvu text',
      source_url: 'https://archive.org/download/jeannedarcmaidof00murruoft/jeannedarcmaidof00murruoft_djvu.txt',
      license_tier: 'A', authority_tier: 7, language: 'en',
      shelf_tags: ['saints', 'history', 'testimony'], companion_shelves: ['joan'], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: lumenGentiumMary,
    doc: {
      id: 'lumen-gentium', title: 'Lumen Gentium, Chapter VIII — The Blessed Virgin Mary, Mother of God, in the Mystery of Christ and the Church (§§52–69)',
      author: 'Second Vatican Council', year: 1964,
      source_name: 'vatican.va — Dogmatic Constitution Lumen Gentium (21 Nov 1964), chapter VIII only',
      source_url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html',
      license_tier: 'B', authority_tier: 2, language: 'en',
      shelf_tags: ['mariology', 'council'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
  {
    phase: 2,
    adapter: diviniAmoris,
    doc: {
      id: 'divini-amoris-scientia', title: 'Divini Amoris Scientia — St. Thérèse of the Child Jesus Proclaimed a Doctor of the Universal Church',
      author: 'Pope St. John Paul II', year: 1997,
      source_name: 'vatican.va — Apostolic Letter Divini Amoris Scientia (19 Oct 1997)',
      source_url: 'https://www.vatican.va/content/john-paul-ii/en/apost_letters/1997/documents/hf_jp-ii_apl_19101997_divini-amoris.html',
      license_tier: 'B', authority_tier: 3, language: 'en',
      shelf_tags: ['saints', 'papal'], companion_shelves: [], version: 1, ingest_status: 'staged',
    },
  },
];
