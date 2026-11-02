/*
# Create daily_audio table + the daily-audio storage bucket

## Purpose
Stores the daily Gospel audio render's bookkeeping: which narrator read the day, whether
the render succeeded, where the three segment files live, and the full assembled script
(kept forever as the audit trail — the audio files themselves are deleted after 90 days
by the render function's retention mode; the rows are never deleted).

The segments themselves live in the public `daily-audio` storage bucket created below,
under `<date>/head-am.mp3`, `<date>/head-pm.mp3`, and `<date>/main.mp3`, plus one static
asset, `static/martin-bell.mp3` (the Thursday bell, uploaded by the render function the
first time it is needed).

## Security
- RLS ENABLED on `daily_audio`. anon + authenticated can SELECT (no-auth app; the audio
  is shared daily content that every user hears identically — same posture as
  `daily_reflections`).
- No INSERT/UPDATE/DELETE policies — only the service role (the `audio-render` edge
  function) can write, and the service role bypasses RLS entirely.
- The bucket is PUBLIC so phones can fetch the segment files by URL (they are daily
  published content, not user data). Uploads happen only through the service role.
  No storage policies are created: public-bucket reads need none, and writes stay
  service-role-only.

## Important Notes
1. `status` moves pending → rendering → ready | failed; retention marks old rows
   `expired` and nulls their paths. A `failed` row is what tells the Gospel card to show
   its one plain "audio unavailable today" line (Erik's no-fallback-voice decision,
   Nov 2, 2026) — no row at all means the card shows nothing.
2. `last_error` holds a short stage/code string only (bundle|tts|assemble|encode|upload),
   never payloads or script text.
3. `attempts` is the renderer's own cost guard: scheduled runs stop at the retry
   window (a failed day at 2 attempts is done; 3 is the hard cap) — only Erik's
   key-guarded force path can render a day again (spec §8.2).
*/
CREATE TABLE IF NOT EXISTS daily_audio (
  date            date PRIMARY KEY,
  persona         text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  head_am_path    text,
  head_pm_path    text,
  main_path       text,
  head_am_seconds numeric,
  head_pm_seconds numeric,
  main_seconds    numeric,
  script          text,
  script_hash     text,
  scene           text,
  sober           boolean NOT NULL DEFAULT false,
  teaser_included boolean NOT NULL DEFAULT false,
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  rendered_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_audio" ON daily_audio;
CREATE POLICY "anon_select_daily_audio"
ON daily_audio FOR SELECT
TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-audio', 'daily-audio', true)
ON CONFLICT (id) DO NOTHING;
