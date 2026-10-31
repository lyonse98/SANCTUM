/*
# Quarter-hourly dispatch for the daily push reminder

## What this does
Schedules a pg_cron job that POSTs to the push-dispatch edge function every 15 minutes.
The function itself decides who is due: it reads each active subscription's stored
timezone and chosen local time, and sends the poke to the ones whose time fell inside the
last quarter hour and who have not already been sent today's. The cron is deliberately
dumb — every rule lives in the function and in src/lib/pushCore.ts, where the tests are.

## The key
The apikey below is the FULL public anon key (208 characters — the same key shipped in
the client bundle to every browser; RLS is the access control, not this key). It is
included because the Supabase gateway will not route edge-function requests without it.
The original reflection-pregen migration embedded a 127-character truncation of this key
and every scheduled run 401'd silently for days; this key was verified character-for-
character against the corrected schedule when this file was written.

## Notes
- Idempotent: re-running unschedules any previous job of the same name first.
- An empty JSON body means "run the dispatch". (A body of {"test": true, "endpoint": …}
  pokes one subscription immediately — the deploy packet uses that for the phone test.)
*/

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sanctum-push-dispatch')
where exists (
  select 1 from cron.job where jobname = 'sanctum-push-dispatch'
);

select cron.schedule(
  'sanctum-push-dispatch',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://vkycxcehllhedvecvhfd.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreWN4Y2VobGxoZWR2ZWN2aGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTQ0ODQsImV4cCI6MjEwNTc3MDQ4NH0.19hKOv127bI0PinQ8xGbcYIcmSoAQ5UROPPd5Uy2sgs',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreWN4Y2VobGxoZWR2ZWN2aGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTQ0ODQsImV4cCI6MjEwNTc3MDQ4NH0.19hKOv127bI0PinQ8xGbcYIcmSoAQ5UROPPd5Uy2sgs'
    ),
    body := '{}'::jsonb
  );
  $$
);
