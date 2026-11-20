/*
  # Counts-only profile tallies (Erik's design, Nov 18–20, 2026)

  ## What this is

  The aggregate companion to the standing Tailor profile. A reader's
  profile holds list-picks — the voices they listen to, their season of
  life, their ongoing battles, their North Star. Those picks, COUNTED
  across readers, say what the whole company is carrying: which seasons
  dominate, which battles are common, which voices are trusted. That is
  the input the generic (non-Tailor) reflections are one day steered
  by — St. Paul writing to a church, not to a diary — and it is the
  proof a parish conversation eventually cites.

  Erik's rule for the mechanism, agreed Nov 18 and built Nov 20, 2026:
  COUNTS, NEVER WORDS. The tally carries list-pick IDS only. Free text
  — the "someone else" voice, the standing goal, the Tailor sentence,
  the reader's name — is structurally incapable of entering the
  payload: the client builds it by picking fields by name, and the
  analytics-track function's tally mode validates every id against the
  profile's own vocabularies (mirrored from src/lib/tailorProfile.ts)
  before anything is written.

  ## Consent

  The tally rides the existing anonymous analytics opt-in (off by
  default, in Settings). Nothing is sent unless the reader turned
  counts on. Turning it off stops future sends; a snapshot already
  held simply ages out under the retention job below. There is
  deliberately NO delete-my-tally endpoint in this pass: the token is
  a random UUID held only on the device, stored here only as its
  SHA-256 hash, and linked to nothing — no account, no address, no
  session, no other table's key.

  ## The table

  `profile_tallies` — ONE row per tally token, so counts mean PEOPLE,
  not submissions:

  - `token_hash` (text, primary key) — SHA-256 of the device-held
    random token, the same one-way treatment as the rate-limit keys.
    The raw token never reaches the database.
  - `audience` (text) — 'men' or 'women'; a snapshot belongs to the
    track whose profile it counts.
  - `voices` (jsonb array of ids), `season_of_life` (text id, null),
    `ongoing_battles` (jsonb array of battle words — the battles'
    vocabulary IS the words), `north_star` (text id, null).
  - `updated_at` — when this snapshot last replaced itself.

  A new snapshot UPSERTS on `token_hash`, replacing the old row whole:
  when a reader changes a pick, the counts move; when the profile is
  erased, the client sends one final empty snapshot and the counts
  stop carrying a profile that no longer exists.

  ## Security

  The tailor_outputs lockdown, mirrored: RLS enabled, all privileges
  revoked from `anon` and `authenticated`, and four policies deny
  everything to both roles. The only writer is the analytics-track
  function, through the service role; the only reader is the owner,
  through the view below (also revoked from anon/authenticated).

  ## Reading the counts — THE query

  Erik or Muse runs this (Management API / SQL editor) to read the
  board. `field` is one of voices / season_of_life / ongoing_battles /
  north_star; `n` is the number of LIVE snapshots (readers) carrying
  that pick, per track:

      select field, value_id, audience, n
      from public.profile_tally_counts
      order by field, audience, n desc, value_id;

  ## Retention

  A daily pg_cron job in the hardening pattern deletes snapshots
  unrefreshed for 90 days: a reader who wiped, uninstalled, or turned
  counts off and never returned stops being counted a season later.
*/

CREATE TABLE IF NOT EXISTS public.profile_tallies (
  token_hash text PRIMARY KEY,
  audience text NOT NULL,
  voices jsonb NOT NULL DEFAULT '[]'::jsonb,
  season_of_life text,
  ongoing_battles jsonb NOT NULL DEFAULT '[]'::jsonb,
  north_star text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_tallies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profile_tallies FROM anon, authenticated;

DROP POLICY IF EXISTS deny_select_profile_tallies ON public.profile_tallies;
CREATE POLICY deny_select_profile_tallies ON public.profile_tallies
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_insert_profile_tallies ON public.profile_tallies;
CREATE POLICY deny_insert_profile_tallies ON public.profile_tallies
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS deny_update_profile_tallies ON public.profile_tallies;
CREATE POLICY deny_update_profile_tallies ON public.profile_tallies
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_delete_profile_tallies ON public.profile_tallies;
CREATE POLICY deny_delete_profile_tallies ON public.profile_tallies
  FOR DELETE TO anon, authenticated USING (false);

-- ── The counts: one row per (field, value, track) over live snapshots ───────

CREATE OR REPLACE VIEW public.profile_tally_counts AS
  SELECT 'voices' AS field, elem AS value_id, t.audience, count(*)::bigint AS n
  FROM public.profile_tallies t
  CROSS JOIN LATERAL jsonb_array_elements_text(t.voices) AS elem
  GROUP BY elem, t.audience
  UNION ALL
  SELECT 'season_of_life', t.season_of_life, t.audience, count(*)::bigint
  FROM public.profile_tallies t
  WHERE t.season_of_life IS NOT NULL
  GROUP BY t.season_of_life, t.audience
  UNION ALL
  SELECT 'ongoing_battles', elem, t.audience, count(*)::bigint
  FROM public.profile_tallies t
  CROSS JOIN LATERAL jsonb_array_elements_text(t.ongoing_battles) AS elem
  GROUP BY elem, t.audience
  UNION ALL
  SELECT 'north_star', t.north_star, t.audience, count(*)::bigint
  FROM public.profile_tallies t
  WHERE t.north_star IS NOT NULL
  GROUP BY t.north_star, t.audience;

-- The board is the owner's reading, not an API: nobody with the public
-- app key can read a single count out of the view either.
REVOKE ALL ON public.profile_tally_counts FROM anon, authenticated;

-- ── Retention: snapshots unrefreshed for 90 days stop being counted ─────────

select cron.unschedule('profile-tallies-retention')
where exists (
  select 1 from cron.job where jobname = 'profile-tallies-retention'
);

select cron.schedule(
  'profile-tallies-retention',
  '37 4 * * *',
  $$ delete from public.profile_tallies where updated_at < now() - interval '90 days' $$
);
