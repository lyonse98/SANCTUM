/*
  # Hardening: the render-start gate (P-1), and retention purges (P-6)

  Source: the multi-lens audit of Nov 16, 2026 (P-1 HIGH, P-6 MEDIUM);
  scope ruled by Erik, Nov 18, 2026. P-2 and P-4 are deliberately NOT
  touched here — Gate 2 is held, and the chat cap's server backstop
  stays exactly as it is.

  ## 1. P-1 — audio-render accepted unauthenticated render starts

  One anonymous POST { date, audience } built the day's bundle
  (generating the reflection if needed) and chained a complete TTS
  render, for any date the caller named. The function now refuses a
  start that carries neither the render key (the owner's manual door,
  unchanged) nor the schedule's cron token. This migration creates the
  cron side of that gate:

  - `audio_render_cron_token` — a single-row, deny-all table holding a
    random token GENERATED HERE, inside the database. The value is
    written down nowhere else: not in this repo, not in the job
    definitions below, not in any file a person holds.
  - The four render jobs (men + women, morning + retry) are re-issued
    with one added header — 'x-render-cron', whose value is a subquery
    reading the token at call time. Each job's existing schedule,
    address, anon key, and body are preserved by transforming the
    stored command text, never by retyping them. The transform is
    verified per job: a job whose stored shape does not match aborts
    the whole migration loudly, at apply time, rather than leaving the
    gate half-applied to fail silently at 08:20 the next morning.
    Jobs already carrying the header are left as they are, so
    re-running this migration is safe.

  Deploy order is safe in both directions, by the function's own guard:
  the new function lets starts through (with an error log) while this
  table is unreadable, and the old function ignores the new header.
  The gate is real only when both halves have landed — apply this
  migration with the function deploy, and the log line
  "start gate unconfigured" disappearing is the confirmation.

  The Sunday retention job is NOT re-issued: the audit rates its
  pre-auth shape LOW (the cutoff is server-computed; a caller can only
  run housekeeping early), and it starts no renders.

  ## 2. P-3 — Tailor piece tokens (no schema change)

  The token expiry and the piece ceilings are function-side only
  (tailor-devotional): tokens now carry a signed expiry, and piece
  fetches draw on the existing consume_chat_quota RPC. Nothing in the
  database changes for P-3, so nothing appears below for it.

  ## 3. P-6 — retention purges

  feedback_submissions and analytics_events were kept forever, and
  chat_rate_limits rows persisted indefinitely. Three daily jobs in
  the tailor-outputs-retention pattern (pure SQL, no function call)
  now age them out: feedback and analytics at 12 months, rate-limit
  rows at 90 days idle (an untouched row's window and day are long
  past; deleting it is semantically free — the next consume recreates
  it). The Terms page's retention list already names these durations'
  shape; the stores now keep the promise mechanically.
*/

-- ── 1a. The cron token ──────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

CREATE TABLE IF NOT EXISTS public.audio_render_cron_token (
  id integer PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_render_cron_token_singleton CHECK (id = 1)
);

ALTER TABLE public.audio_render_cron_token ENABLE ROW LEVEL SECURITY;

-- No policies, and no grants: the table answers only the service role
-- (the function's read) and the database owner (the cron jobs' read).
REVOKE ALL ON TABLE public.audio_render_cron_token FROM anon, authenticated;

INSERT INTO public.audio_render_cron_token (id, token)
VALUES (
  1,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (id) DO NOTHING;

-- ── 1b. Re-issue the four render jobs with the token header ─────────────────

DO $$
DECLARE
  j record;
  new_command text;
  gated integer := 0;
  already integer := 0;
BEGIN
  FOR j IN
    SELECT jobname, schedule, command
    FROM cron.job
    WHERE jobname IN (
      'sanctum-audio-render',
      'sanctum-audio-render-retry',
      'sanctum-audio-render-women',
      'sanctum-audio-render-women-retry'
    )
  LOOP
    IF position('x-render-cron' in j.command) > 0 THEN
      already := already + 1;
      CONTINUE;
    END IF;
    new_command := replace(
      j.command,
      '''Authorization''',
      '''x-render-cron'', (select token from public.audio_render_cron_token where id = 1), ''Authorization'''
    );
    IF new_command = j.command THEN
      RAISE EXCEPTION
        'audio-render cron job % did not match the expected header shape — aborting rather than leaving the P-1 gate half-applied',
        j.jobname;
    END IF;
    PERFORM cron.unschedule(j.jobname);
    PERFORM cron.schedule(j.jobname, j.schedule, new_command);
    gated := gated + 1;
  END LOOP;
  RAISE NOTICE 'P-1 cron gate: % job(s) re-issued with the token header, % already gated', gated, already;
END $$;

-- ── 3. Retention purges (the tailor-outputs-retention pattern) ──────────────

select cron.unschedule('feedback-retention')
where exists (
  select 1 from cron.job where jobname = 'feedback-retention'
);

select cron.schedule(
  'feedback-retention',
  '31 4 * * *',
  $$ delete from public.feedback_submissions where created_at < now() - interval '12 months' $$
);

select cron.unschedule('analytics-retention')
where exists (
  select 1 from cron.job where jobname = 'analytics-retention'
);

select cron.schedule(
  'analytics-retention',
  '33 4 * * *',
  $$ delete from public.analytics_events where created_at < now() - interval '12 months' $$
);

select cron.unschedule('chat-rate-limits-retention')
where exists (
  select 1 from cron.job where jobname = 'chat-rate-limits-retention'
);

select cron.schedule(
  'chat-rate-limits-retention',
  '35 4 * * *',
  $$ delete from public.chat_rate_limits where updated_at < now() - interval '90 days' $$
);
