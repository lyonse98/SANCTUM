/*
# Daily reminder: drop the Prayer Library and Catechism from the choices

## Why
The owner has narrowed the reminder to four things a man can be reminded about: the day's Gospel,
the Evening Examen, the Rosary, and his Rule of Life. The Prayer Library and the Catechism are no
longer offered, so the app and the database should agree on what is allowed rather than the
database quietly accepting values the app will never send.

## What changes
1. Any existing row still holding 'scripture' or 'catechism' is moved to 'gospel', the default.
   These two values were only ever a stored preference: the sending side is not connected, so no
   email has ever been sent on them and nothing downstream reads them.
2. The CHECK constraint is tightened to the four remaining values, so the column cannot hold a
   value the app no longer offers.
3. `subscribe_email_reminder(p_email, p_focus)` is replaced with the same four-value allowlist. Its
   signature is unchanged, so the app needs no change beyond the shortened dropdown.

## What deliberately does NOT change
No column, row, address, or token is removed. The only rows touched are those carrying one of the
two retired values, and they keep their address, their token, and their active flag — only the
preference moves to the default.

## Security notes
- The function keeps `SECURITY DEFINER` with `SET search_path = ''` and fully-qualified names.
- `EXECUTE` is revoked from `PUBLIC` and granted only to `anon, authenticated`.
- The table stays unreachable from the browser: all four policies remain deny-all and no table
  privileges are granted to `anon` or `authenticated`.
*/

UPDATE public.email_reminder_subscribers
   SET reminder_focus = 'gospel',
       updated_at = now()
 WHERE reminder_focus IN ('scripture', 'catechism');

ALTER TABLE public.email_reminder_subscribers
  DROP CONSTRAINT IF EXISTS email_reminder_focus_check;

ALTER TABLE public.email_reminder_subscribers
  ADD CONSTRAINT email_reminder_focus_check
  CHECK (reminder_focus IN ('gospel', 'examen', 'rosary', 'rule'));

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

  IF v_focus NOT IN ('gospel', 'examen', 'rosary', 'rule') THEN
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
