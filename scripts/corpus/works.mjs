/*
  The corpus registry (spec §4.1): every work the pipeline knows, with its
  provenance, license tier (§6), authority tier (§5.1), shelves, and the
  adapter that ingests it. A work that cannot name its source and license
  tier does not belong here — the pipeline refuses unprovenanced text.
*/

import { run as ccc } from './adapters/ccc.mjs';
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
];
