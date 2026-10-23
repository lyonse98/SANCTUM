/*
  # Harden email_reminder_subscribers with column-level privileges

  ## Why
  The first version of this table granted full table-level INSERT/UPDATE to `anon`, and its
  UPDATE policy used `WITH CHECK (true)`. Combined, that meant the anon key could rewrite any
  row's `email` and `unsubscribe_token` — i.e. anyone could change another man's address or
  hijack his unsubscribe link. RLS controls WHICH ROWS a request may touch; it does not control
  WHICH COLUMNS. Column privileges do. This migration adds that second layer.

  ## What changes
  1. Revokes all table-level privileges on `email_reminder_subscribers` from `anon` and
     `authenticated`.
  2. Grants back only the specific columns each operation legitimately needs:
     - SELECT: id, email, send_hour, confirmed, active, created_at, updated_at.
       `unsubscribe_token` is deliberately excluded — the browser never needs to read it, so
       a leaked token cannot be harvested by reading the table.
     - INSERT: email, send_hour. Everything else comes from server-side column defaults.
     - UPDATE: send_hour, active, updated_at. So a request can re-activate a lapsed
       subscription or change the send time, but can never change whose address a row is.
  3. Grants no DELETE privilege at all. Unsubscribing sets `active = false`; rows are retained.

  ## Effect on the app
  The client inserts `{ email, send_hour }`. On a duplicate address it must NOT upsert (an
  upsert would try to SET email and fail the column check); it updates by email instead, then
  inserts if nothing matched. See `src/lib/emailReminder.ts`.

  ## Notes
  1. No data is dropped or altered — privileges only.
  2. The service role is unaffected and can still read/write every column, which is how a
     future email sender will work.
*/

REVOKE ALL ON TABLE public.email_reminder_subscribers FROM anon, authenticated;

GRANT SELECT (id, email, send_hour, confirmed, active, created_at, updated_at)
ON public.email_reminder_subscribers TO anon, authenticated;

GRANT INSERT (email, send_hour)
ON public.email_reminder_subscribers TO anon, authenticated;

GRANT UPDATE (send_hour, active, updated_at)
ON public.email_reminder_subscribers TO anon, authenticated;
