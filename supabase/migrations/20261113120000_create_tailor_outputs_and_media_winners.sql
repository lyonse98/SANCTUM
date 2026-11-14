/*
# Record what Tailor Today RETURNS — never what it is told

## Why this migration exists

Erik's ruling (Nov 13, 2026): "store what is being returned to a user so we can
analyze text itself, not the input user issues." Until now the tailored
devotional existed only on the user's device — by design, the function wrote
nothing at all. That made the tailored text itself unreviewable: nobody could
read across mornings and judge whether the reflections repeat themselves,
whether the challenges stay concrete, whether the tradition quotes land.

This migration adds the two tables that hold the OUTPUT side of Tailor only.

## What this adds

### 1. New table `tailor_outputs`
One row per tailored build — the devotional Sanctum RETURNED, and nothing else:

- `id` (uuid, primary key)
- `created_at` (timestamptz, not null, default now())
- `devotional_date` (date) — the morning the devotional is for
- `audience` (text) — the track the devotional was written for
- `reflection` (text) — the tailored reflection, as returned
- `challenge` (text) — the tailored challenge, as returned
- `passage_citation` / `passage_text` (text) — the supplement passage served
- `quote_text` / `quote_source` (text) — the tradition quote served, and who
  it belongs to; null when no quote was served
- `media_title` / `media_creator` / `media_url` / `media_kind` (text) — the
  media pick served
- `narrator` (text) — the day narrator who read it
- `build_stamp` (text) — which build of the composer produced it, so quality
  reviews can be read against the code that wrote them

There are deliberately NO other columns. The morning's own answers and words
are not here in any form — nothing the user said, chose, or wrote is recorded,
and there is no identifier of any kind: no address, no hash, no device mark.
A row can be read for the quality of its text and for nothing else.

### 2. New table `media_winners`
The self-growing media library. When a work found by the live search wins a
morning's card, the work itself is public — a link anyone can open — so it is
captured here with the scorer's judgments about THE WORK (which mornings it
answers, how popular it is, how its substance aligns), and later builds read
these rows back into the scored pool beside the curated seed.

- `id` (uuid, primary key), `created_at` (timestamptz, not null, default now())
- `title`, `creator`, `kind` (text) — the work's own name, maker, and kind
- `url` (text, UNIQUE) — the work's own page; one row per work
- `focus_tags`, `state_tags`, `tone_tags` (text[]) — the scorer's judgments
  about which mornings the work answers, never a copy of any user's answers
- `popularity` (integer) — the work's popularity on the catalog's 0–100 scale
- `values_score` (integer) — its alignment on the 0–100 scale
- `win_count` (integer, not null, default 1) — mornings won
- `last_won_at` (timestamptz, default now()) — the read side takes the most
  recent winners first

### 3. Security
Both tables follow the feedback table's lockdown: RLS is enabled, all
privileges are revoked from `anon` and `authenticated`, and the four policies
deny everything to both roles. The rows are reachable only through the
service role, which the tailor-devotional function uses to record a build
and to read the winners back. Nobody with the public app key can read a
single tailored devotional out of `tailor_outputs`.

### 4. Retention
`tailor_outputs` is a review corpus, not an archive: a daily pg_cron job
(pure SQL — no function call, no embedded address) deletes rows older than
90 days, matching what the app's privacy wording promises. `media_winners`
is NOT retention-deleted: its rows are public links, and the library is
meant to grow.
*/

CREATE TABLE IF NOT EXISTS public.tailor_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  devotional_date date,
  audience text,
  reflection text,
  challenge text,
  passage_citation text,
  passage_text text,
  quote_text text,
  quote_source text,
  media_title text,
  media_creator text,
  media_url text,
  media_kind text,
  narrator text,
  build_stamp text
);

ALTER TABLE public.tailor_outputs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tailor_outputs FROM anon, authenticated;

DROP POLICY IF EXISTS deny_select_tailor_outputs ON public.tailor_outputs;
CREATE POLICY deny_select_tailor_outputs ON public.tailor_outputs
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_insert_tailor_outputs ON public.tailor_outputs;
CREATE POLICY deny_insert_tailor_outputs ON public.tailor_outputs
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS deny_update_tailor_outputs ON public.tailor_outputs;
CREATE POLICY deny_update_tailor_outputs ON public.tailor_outputs
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_delete_tailor_outputs ON public.tailor_outputs;
CREATE POLICY deny_delete_tailor_outputs ON public.tailor_outputs
  FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS tailor_outputs_created_at_idx
  ON public.tailor_outputs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.media_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  title text,
  creator text,
  url text UNIQUE,
  kind text,
  focus_tags text[] NOT NULL DEFAULT '{}',
  state_tags text[] NOT NULL DEFAULT '{}',
  tone_tags text[] NOT NULL DEFAULT '{}',
  popularity integer,
  values_score integer,
  win_count integer NOT NULL DEFAULT 1,
  last_won_at timestamptz DEFAULT now()
);

ALTER TABLE public.media_winners ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.media_winners FROM anon, authenticated;

DROP POLICY IF EXISTS deny_select_media_winners ON public.media_winners;
CREATE POLICY deny_select_media_winners ON public.media_winners
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_insert_media_winners ON public.media_winners;
CREATE POLICY deny_insert_media_winners ON public.media_winners
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS deny_update_media_winners ON public.media_winners;
CREATE POLICY deny_update_media_winners ON public.media_winners
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_delete_media_winners ON public.media_winners;
CREATE POLICY deny_delete_media_winners ON public.media_winners
  FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS media_winners_last_won_at_idx
  ON public.media_winners (last_won_at DESC);

-- Retention: the review corpus ages out at 90 days, daily. Pure SQL — the
-- job touches no function and embeds no project address.
create extension if not exists pg_cron;

select cron.unschedule('tailor-outputs-retention')
where exists (
  select 1 from cron.job where jobname = 'tailor-outputs-retention'
);

select cron.schedule(
  'tailor-outputs-retention',
  '23 4 * * *',
  $$ delete from public.tailor_outputs where created_at < now() - interval '90 days' $$
);
