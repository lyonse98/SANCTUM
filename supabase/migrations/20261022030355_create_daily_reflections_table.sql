/*
# Create daily_reflections table

## Purpose
Stores the pre-generated daily reflection (reflect question + challenge) keyed by date,
so the Gemini API is called once per day total instead of once per user. The edge function
checks this table first; if the row exists, it returns it instantly with no API call.

## New Tables
- `daily_reflections`
  - `date` (date, primary key) — the liturgical date in YYYY-MM-DD
  - `reflect` (text, not null) — one reflect question, two sentences max
  - `challenge` (text, not null) — one concrete action for the day
  - `facet` (text, not null, default 'As a man') — the role the prompts are framed through
  - `celebration` (text, nullable) — the day's feast/celebration name, for context
  - `generated_at` (timestamptz, default now()) — when the row was created

## Security
- RLS ENABLED. anon + authenticated can SELECT (no-auth app; the reflection is shared
  daily content that every user sees identically).
- No INSERT/UPDATE/DELETE policies — only the service role (edge function) can write,
  and the service role bypasses RLS entirely.

## Important Notes
1. The `daily-reflection` edge function checks this table first. If the row exists, it
   returns it immediately (no Gemini call, near-instant). If not, it fetches the day's
   readings citations, calls Gemini, stores the result, and returns it.
2. The first user of the day triggers generation once. All subsequent users get the
   cached row — no per-user API calls.
*/
CREATE TABLE IF NOT EXISTS daily_reflections (
  date date PRIMARY KEY,
  reflect text NOT NULL,
  challenge text NOT NULL,
  facet text NOT NULL DEFAULT 'As a man',
  celebration text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_reflections" ON daily_reflections;
CREATE POLICY "anon_select_daily_reflections"
ON daily_reflections FOR SELECT
TO anon, authenticated USING (true);