/*
# Daily reminder: let a man choose what he is reminded about

## Why
The reminder mails "the day's Gospel" and nothing else. The owner wants the signup to let a man
pick which part of Sanctum the morning email should point him at, from a short list of the app's
own features, so the email can meet him where he actually is.

## What changes
1. New column `email_reminder_subscribers.reminder_focus` (text, NOT NULL, default 'gospel') —
   which part of Sanctum the email points at. A CHECK constraint limits it to the same short list
   the app offers, so the column can never hold anything else.
2. `subscribe_email_reminder(p_email, p_focus)` replaces the one-argument version. Both the
   address and the focus are inputs now. Re-subscribing with an address already on the list
   updates the focus, which is also how a man changes it later — there is no separate
   "change focus" function, and so no second code path to keep in step.

## What deliberately does NOT change
No existing row is rewritten. Adding the column with a default leaves every address, token, and
active flag exactly as it was; existing subscribers are simply recorded as focused on the Gospel.
`send_hour` and `confirmed` remain untouched and unread.

## Security notes
- The focus is checked against the same allowlist the column enforces. A value outside it raises
  an error rather than being stored, so the column cannot be used to smuggle arbitrary text into
  whatever eventually sends the mail.
- The function keeps `SECURITY DEFINER` with `SET search_path = ''` and fully-qualified names.
- `EXECUTE` is revoked from `PUBLIC` and granted only to `anon, authenticated`.
- The table stays unreachable from the browser: all four policies remain deny-all and no table
  privileges are granted to `anon` or `authenticated`.
*/

ALTER TABLE public.email_reminder_subscribers
  ADD COLUMN IF NOT EXISTS reminder_focus text NOT NULL DEFAULT 'gospel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_reminder_focus_check'
      AND conrelid = 'public.email_reminder_subscribers'::regclass
  ) THEN
    ALTER TABLE public.email_reminder_subscribers
      ADD CONSTRAINT email_reminder_focus_check
      CHECK (reminder_focus IN ('gospel', 'examen', 'rosary', 'scripture', 'catechism', 'rule'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.subscribe_email_reminder(text);

CREATE OR REPLACE FUNCTION public.subscribe_email_reminder(p_email text, p_focus text DEFAULT 'gospel')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_focus text := lower(btrim(coalesce(p_focus, 'gospel')));
  v_token text;
BEGIN
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  IF v_focus NOT IN ('gospel', 'examen', 'rosary', 'scripture', 'catechism', 'rule') THEN
    RAISE EXCEPTION 'invalid_focus' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.email_reminder_subscribers (email, reminder_focus)
  VALUES (v_email, v_focus)
  ON CONFLICT (email) DO UPDATE
    SET active = true,
        reminder_focus = EXCLUDED.reminder_focus,
        updated_at = now()
  RETURNING unsubscribe_token INTO v_token;

  RETURN v_token;
END;
$fn$;

REVOKE ALL ON FUNCTION public.subscribe_email_reminder(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_email_reminder(text, text) TO anon, authenticated;
