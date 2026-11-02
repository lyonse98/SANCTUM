#!/usr/bin/env node
/*
  The audio dry-run harness (spec §10.4) — the productized samples pipeline, and the
  permanent "what will tomorrow sound like" check.

  Usage:
    node scripts/audio-dry-run.mjs [YYYY-MM-DD] [--render] [--out <dir>] [--drafts]

  Default date: tomorrow in America/Los_Angeles. The script fetches the day's live
  daily_readings bundle + daily_reflections row (the same rows the render function
  will read), assembles the script locally with src/lib/narratorCore.ts, and prints
  it in full — both heads and the main — for the paper check.

  --render also renders MP3s with the samples' workstation method (Gemini TTS +
  ffmpeg atempo + concat) into a scratch folder for pre-launch listening. It needs
  GEMINI_API_KEY — Sanctum's own key — from the environment or .env.local. It NEVER
  reads the Leo's World key file the samples staged; that key is another app's.

  --drafts prints the DRAFT bank lines (§5.3) awaiting paper approval.

  Config: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the environment or the
  repo's .env.local. Read-only against the database; writes nothing anywhere except
  the --render scratch folder.
*/

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Args + config ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const render = args.includes('--render');
const showDrafts = args.includes('--drafts');
const outFlag = args.indexOf('--out');
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

function losAngelesDate(offsetDays) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const dateISO = dateArg ?? losAngelesDate(1);

function loadEnv() {
  const env = { ...process.env };
  const envFile = join(repoRoot, '.env.local');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (env or .env.local).');
  process.exit(1);
}

// ── narratorCore, transpiled from the client source (the same code the server runs) ──

function loadNarratorCore() {
  const source = readFileSync(join(repoRoot, 'src/lib/narratorCore.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(
    () => {
      throw new Error('narratorCore must stay import-free');
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}

const core = loadNarratorCore();

// ── Fetch the day's rows (read-only) ──────────────────────────────────────────

async function restOne(table, select) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?date=eq.${dateISO}&select=${select}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) return { row: null, status: res.status };
  const rows = await res.json();
  return { row: Array.isArray(rows) && rows.length > 0 ? rows[0] : null, status: res.status };
}

/**
 * The readings bundle, by whichever door is open: the table directly, or the
 * daily-readings function (which builds and caches it). Before the Nov 17 deploy the
 * function doesn't exist and the table may not either — the caller reports that
 * precisely rather than pretending the day has no bundle.
 */
async function fetchReadingsPayload() {
  const { row } = await restOne('daily_readings', 'payload');
  if (row?.payload?.citations) return row.payload;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-readings?date=${dateISO}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload?.citations) return payload;
    }
  } catch {
    // fall through to the caller's diagnosis
  }
  return null;
}

async function fetchTomorrowCitations() {
  const tomorrow = core.addDaysISO(dateISO, 1);
  const base = 'https://cpbjr.github.io/catholic-readings-api';
  try {
    const [readingsRes, calendarRes] = await Promise.all([
      fetch(`${base}/readings/${tomorrow.slice(0, 4)}/${tomorrow.slice(5)}.json`),
      fetch(`${base}/liturgical-calendar/${tomorrow.slice(0, 4)}/${tomorrow.slice(5)}.json`),
    ]);
    const readings = readingsRes.ok ? await readingsRes.json() : null;
    const calendar = calendarRes.ok ? await calendarRes.json() : null;
    return {
      celebration: typeof calendar?.celebration?.name === 'string' ? calendar.celebration.name : null,
      gospel: typeof readings?.readings?.gospel === 'string' ? readings.readings.gospel : null,
    };
  } catch {
    return { celebration: null, gospel: null };
  }
}

const payload = await fetchReadingsPayload();
// The scene column arrives with the audio migration; before it is applied, a select
// naming it fails wholesale — retry without it (the scene is then simply absent).
let reflectionResult = await restOne('daily_reflections', 'reflect,challenge,facet,scene');
if (!reflectionResult.row && reflectionResult.status === 400) {
  reflectionResult = await restOne('daily_reflections', 'reflect,challenge,facet');
}
const reflectionRow = reflectionResult.row;
if (!payload || !reflectionRow) {
  console.error(
    `No complete bundle for ${dateISO} yet (readings: ${payload ? 'yes' : 'no'}, ` +
      `reflection: ${reflectionRow ? 'yes' : 'no'}). Rows appear after the day's first ` +
      'app open or the nightly pre-generation — and the readings bundle needs the ' +
      'daily_readings table + daily-readings function from the deploy packet.',
  );
  process.exit(1);
}

const tomorrow = await fetchTomorrowCitations();

const assembled = core.assembleScript({
  dateISO,
  celebration: payload.citations?.celebration ?? null,
  gospelCitation: payload.citations?.gospel,
  gospelText: payload.texts?.gospel?.text,
  reflect: reflectionRow.reflect,
  challenge: reflectionRow.challenge,
  facet: reflectionRow.facet ?? 'As a man',
  scene: reflectionRow.scene ?? null,
  tomorrowCelebration: tomorrow.celebration,
  tomorrowGospelCitation: tomorrow.gospel,
});

// ── Print the script ──────────────────────────────────────────────────────────

const bar = '─'.repeat(72);
console.log(bar);
console.log(
  `${dateISO} · persona=${assembled.persona} · sober=${assembled.sober} · ` +
    `teaser=${assembled.teaserIncluded} · scene=${assembled.sceneIncluded}`,
);
console.log(`selections: ${JSON.stringify(assembled.selections)}`);
console.log(bar);
console.log('HEAD — AM\n');
console.log(assembled.headAM);
console.log(`\n${bar}\nHEAD — PM\n`);
console.log(assembled.headPM);
console.log(`\n${bar}\nMAIN — A (scene → Gospel → acclamation)\n`);
console.log(assembled.mainA);
console.log(`\n${bar}\nMAIN — B (reflection → challenge → sign-off → teaser)\n`);
console.log(assembled.mainB);
console.log(bar);

if (showDrafts) {
  console.log('\nDRAFT bank lines awaiting paper approval (spec §5.3):\n');
  for (const draft of core.DRAFT_BANK_LINES) {
    console.log(`- [${draft.persona} · ${draft.slot}] ${draft.line}`);
  }
  console.log('');
}

// ── Optional render (the samples' workstation method) ────────────────────────

if (render) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('\n--render needs GEMINI_API_KEY (Sanctum’s own key) in the environment or .env.local.');
    process.exit(1);
  }
  const outDir =
    outFlag >= 0 && args[outFlag + 1]
      ? args[outFlag + 1]
      : join(process.env.HOME, 'workspace', 'sanctum', 'dry-runs', dateISO);
  mkdirSync(outDir, { recursive: true });

  const profile =
    assembled.persona === 'lector' ? core.LECTOR_BANK : core.BANK[assembled.persona];

  async function tts(text, name) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: profile.voice } } },
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`TTS HTTP ${res.status} for ${name}`);
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    const data = part?.inlineData ?? part?.inline_data;
    if (!data?.data) throw new Error(`TTS returned no audio for ${name}`);
    const rawPath = join(outDir, `${name}.raw`);
    writeFileSync(rawPath, Buffer.from(data.data, 'base64'));
    return rawPath;
  }

  function toMp3(rawPath, name) {
    const bytes = readFileSync(rawPath);
    const isWav = bytes.subarray(0, 4).toString() === 'RIFF';
    const mp3Path = join(outDir, `${name}.mp3`);
    const inputArgs = isWav
      ? ['-y', '-i', rawPath]
      : ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', rawPath];
    execFileSync(
      'ffmpeg',
      [...inputArgs, '-af', `atempo=${profile.tempo}`, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ar', '24000', '-ac', '1', mp3Path],
      { stdio: 'pipe' },
    );
    return mp3Path;
  }

  // Speech payloads carry the lexicon transform, exactly as production sends them.
  const headAmMp3 = toMp3(await tts(core.applyLexicon(assembled.headAM), 'head-am'), 'head-am');
  const headPmMp3 = assembled.lector
    ? headAmMp3
    : toMp3(await tts(core.applyLexicon(assembled.headPM), 'head-pm'), 'head-pm');
  const mainAMp3 = toMp3(await tts(core.applyLexicon(assembled.mainA), 'main-a'), 'main-a');
  const mainBMp3 = toMp3(await tts(core.applyLexicon(assembled.mainB), 'main-b'), 'main-b');

  const mainPath = join(outDir, 'main.mp3');
  execFileSync(
    'ffmpeg',
    [
      '-y', '-i', mainAMp3,
      '-f', 'lavfi', '-t', '2', '-i', 'anullsrc=r=24000:cl=mono',
      '-i', mainBMp3,
      '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]',
      '-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '64k', '-ar', '24000', '-ac', '1',
      mainPath,
    ],
    { stdio: 'pipe' },
  );

  console.log(`\nRendered (${profile.voice} @ ${profile.tempo}x) into ${outDir}:`);
  for (const f of [headAmMp3, headPmMp3, mainPath]) {
    let probe = '';
    try {
      probe = execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'csv=p=0', f],
        { encoding: 'utf8' },
      ).trim();
    } catch {
      probe = '';
    }
    console.log(`- ${f}${probe ? `  (${probe})` : ''}`);
  }
}
