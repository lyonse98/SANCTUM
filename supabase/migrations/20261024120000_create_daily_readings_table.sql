/*
# Create daily_readings table

## Purpose
Caches the day's full readings bundle (citations + Gospel verses + every reading's
full text) assembled by the `daily-readings` edge function, so the app's front door no
longer depends on every phone calling an unofficial single-maintainer lectionary API
and a Bible API directly. The first request of the day assembles the bundle; every
later request that day is a table read.

## New Tables
- `daily_readings`
  - `date` (date, primary key) — the liturgical date in YYYY-MM-DD
  - `payload` (jsonb, not null) — { citations, gospelVerses, texts } as served to the client
  - `fetched_at` (timestamptz, default now()) — when the bundle was assembled

## Security
- RLS ENABLED. anon + authenticated can SELECT (no-auth app; the readings are shared
  daily content, identical for every user).
- No INSERT/UPDATE/DELETE policies — only the service role (edge function) writes,
  and the service role bypasses RLS entirely.
*/
CREATE TABLE IF NOT EXISTS daily_readings (
  date date PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_readings" ON daily_readings;
CREATE POLICY "anon_select_daily_readings"
ON daily_readings FOR SELECT
TO anon, authenticated USING (true);
