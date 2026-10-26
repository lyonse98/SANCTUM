/*
# Nightly pre-generation for the daily reflection

## Problem (field report, Oct 26, 2026)
The daily reflection is generated once per day, server-side, by the first caller
of the day; everyone after gets the cached row instantly (~1s). Measured live:
a cold generation took 13.4s. No cron existed, so at current scale the "first
caller" was almost always Erik, on his morning open, intending to pray — the
worst possible moment for a 13-second spinner.

## Change
Schedule a nightly job (pg_cron + pg_net) that POSTs to the daily-reflection
edge function at 08:00 UTC — midnight PST / 1am PDT — with the date computed in
America/Los_Angeles, so the day's row exists before anyone opens the app. The
function's own table check makes the call a no-op if a row already exists.

## Notes
- The apikey below is the PUBLIC anon key — the same key shipped in the client
  bundle to every browser; Row-Level Security is the access control, not this
  key. It is included because the Supabase gateway will not route edge-function
  requests without it (verified: a keyless POST blackholes).
- Idempotent: re-running unschedules any previous job of the same name first.
*/

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sanctum-daily-reflection-pregen')
where exists (
  select 1 from cron.job where jobname = 'sanctum-daily-reflection-pregen'
);

select cron.schedule(
  'sanctum-daily-reflection-pregen',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://vkycxcehllhedvecvhfd.supabase.co/functions/v1/daily-reflection',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreWN4Y2VobGxoZWR2ZWN2aGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTQ0ODQsImV4cCI6MjEwNTc3MDQ4NH0',
      'Authorization', 'Bearer eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreWN4Y2VobGxoZWR2ZWN2aGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTQ0ODQsImV4cCI6MjEwNTc3MDQ4NH0'
    ),
    body := jsonb_build_object(
      'date', to_char((now() at time zone 'America/Los_Angeles'), 'YYYY-MM-DD')
    )
  );
  $$
);
