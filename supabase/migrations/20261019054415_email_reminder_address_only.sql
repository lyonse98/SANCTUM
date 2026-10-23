/*
# Email reminder: the address is the only thing asked for

## Why
The reminder used to collect a preferred hour of day as well as an address. The owner wants it
to be just the address: one less decision at signup, and the sending side is not built yet.

## What changes
1. `subscribe_email_reminder(p_email)` replaces the two-argument version. The address is the
   only input, and reactivating an existing address no longer rewrites a send time.
2. `set_email_reminder_hour(p_token, p_hour)` is dropped — there is no time left to set, so
   leaving a callable function that only writes a dead column would be a loose end.

## What deliberately does NOT change
The `send_hour` column is NOT dropped. Dropping it would discard data for every address already
collected, and nothing here needs that. It keeps its default, is no longer written, and is no
longer read. The `confirmed` column stays as-is for the same reason.

## Security notes
- Both functions keep `SECURITY DEFINER` with `SET search_path = ''` and fully-qualified names.
- `EXECUTE` is revoked from `PUBLIC` and granted only to `anon, authenticated`.
- The browser still has no direct access to the table: all four policies remain deny-all and
  all table privileges remain revoked from `anon` and `authenticated`.
*/

DROP FUNCTION IF EXISTS public.set_email_reminder_hour(text, integer);

DROP FUNCTION IF EXISTS public.subscribe_email_reminder(text, integer);

CREATE OR REPLACE FUNCTION public.subscribe_email_reminder(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
BEGIN
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.email_reminder_subscribers (email)
  VALUES (v_email)
  ON CONFLICT (email) DO UPDATE
    SET active = true,
        updated_at = now()
  RETURNING unsubscribe_token INTO v_token;

  RETURN v_token;
END;
$fn$;

REVOKE ALL ON FUNCTION public.subscribe_email_reminder(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_email_reminder(text) TO anon, authenticated;
