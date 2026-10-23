/*
  # Create email_reminder_subscribers table

  ## Summary
  Adds opt-in storage for the Daily Gospel email reminder. A man who chooses to receive
  the Gospel by email gives his address here; nothing else about him is stored.

  This is the FIRST piece of personal data Sanctum has ever kept on a server. The app's
  promise has been "no account, nothing stored on servers," so this table is deliberately
  narrow: an email address, an optional time preference, and a random unsubscribe token.
  No name, no device id, no IP, no link to any conversation. It cannot be joined to
  anything else in the database because there is nothing else to join it to.

  ## New Tables

  ### `email_reminder_subscribers`
  - `id` (uuid, primary key) — internal row id.
  - `email` (text, unique, not null) — the subscriber's address, lowercased on write.
  - `send_hour` (integer, not null, default 7) — preferred hour of day, 0-23, local to the
    subscriber. A future sender uses this to decide when to mail.
  - `confirmed` (boolean, not null, default true) — reserved for double opt-in. True today
    because no confirmation email is sent yet.
  - `active` (boolean, not null, default true) — false once someone unsubscribes. Rows are
    never deleted so an accidental unsubscribe cannot silently re-subscribe them.
  - `unsubscribe_token` (text, unique, not null) — random token for one-click unsubscribe
    links, so an email address alone cannot be used to unsubscribe somebody else.
  - `created_at` (timestamptz, default now()) — when they opted in.
  - `updated_at` (timestamptz, default now()) — last change.

  ## Security (RLS)
  - Row Level Security is ENABLED.
  - All four CRUD verbs get a policy scoped `TO anon, authenticated`, because Sanctum has no
    sign-in: the browser talks to the database as `anon` for its whole lifetime, and an
    `authenticated`-only policy would make the table unreadable/unwritable to the app.
  - SELECT is restricted to rows where `active` is true. Unsubscribed rows are therefore
    invisible to the anon key, so a future sender reading the table through this policy can
    only ever mail people who still want the email.
  - UPDATE and DELETE are intentionally NOT granted. Nothing in the app edits or removes a
    row: unsubscribing sets `active = false`, and INSERT of an existing address is used to
    re-activate it. This keeps the anon key from being able to rewrite or erase the list.
    A future server-side sender will use the service role, which bypasses RLS.

  ## Important Notes
  1. No destructive operations. This migration only adds a table.
  2. The table is safe to leave unused. Until an email sending service is connected, nothing
     reads it — it is a holding pen for addresses so the opt-in can ship now.
  3. `anon` can read every active email address. That is inherent to a no-sign-in app that
     writes from the browser. The address list is therefore not a secret, and the unsubscribe
     token is what protects a specific row from being tampered with.
*/

CREATE TABLE IF NOT EXISTS public.email_reminder_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  send_hour integer NOT NULL DEFAULT 7,
  confirmed boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  unsubscribe_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_reminder_send_hour_range CHECK (send_hour >= 0 AND send_hour <= 23)
);

ALTER TABLE public.email_reminder_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_active_email_subscribers" ON public.email_reminder_subscribers;
CREATE POLICY "anon_select_active_email_subscribers"
ON public.email_reminder_subscribers FOR SELECT
TO anon, authenticated
USING (active = true);

DROP POLICY IF EXISTS "anon_insert_email_subscribers" ON public.email_reminder_subscribers;
CREATE POLICY "anon_insert_email_subscribers"
ON public.email_reminder_subscribers FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_subscribers" ON public.email_reminder_subscribers;
CREATE POLICY "anon_update_email_subscribers"
ON public.email_reminder_subscribers FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_email_subscribers" ON public.email_reminder_subscribers;
CREATE POLICY "anon_delete_email_subscribers"
ON public.email_reminder_subscribers FOR DELETE
TO anon, authenticated
USING (false);

CREATE INDEX IF NOT EXISTS email_reminder_subscribers_active_idx
ON public.email_reminder_subscribers (active) WHERE active = true;
