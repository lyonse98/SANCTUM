/*
# Push subscriptions for the daily reminder

## Why this exists

The daily reminder's return loop is a Web Push notification, not an email: it needs no
address, no sending domain, and no per-message cost, and it opens the app at the part of
Sanctum the man chose. The email scaffolding (`email_reminder_subscribers`) stays in place,
dormant, for the day a domain exists — this table is the push channel's own storage, shaped
the same way on purpose.

## What a row is

One device's push subscription: the endpoint the browser's push service gave that device,
and the two keys needed to encrypt a message to it. The endpoint is a capability URL — who
holds it can send this device a notification — so it is treated with the same care as the
email list: never readable from the browser, and the only write paths are the functions
below, which validate everything because anyone can call them.

Stored beside it are the man's two choices (what to be reminded about, and when), his
timezone captured from the device at opt-in, and the local date of the last delivered poke
— the dispatcher's guard against sending twice in a day, including the autumn day when
the clocks go back and a wall-clock time happens twice.

No name, no account, no email, no link to any conversation. A subscription cannot be joined
to anything else in the database because there is nothing else to join it to.

## Security (mirrors the email subscribers lockdown)

- Row Level Security is ENABLED, all privileges are revoked from `anon` and
  `authenticated`, and all four policies deny everything. The browser cannot read or write
  the table directly at all.
- `upsert_push_subscription(...)` — validates endpoint, keys, focus, time, and timezone,
  then inserts or refreshes the row (re-subscribing is also how the choices change).
- `deactivate_push_subscription(p_endpoint)` — marks the row inactive. The endpoint is the
  credential: only a holder of this device's endpoint can stop its pokes.
- Both run `SECURITY DEFINER` with `SET search_path = ''`, `EXECUTE` revoked from `PUBLIC`
  and granted only to `anon` and `authenticated`.
- The dispatcher uses the service role, which bypasses RLS.
*/

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  focus text NOT NULL DEFAULT 'gospel',
  local_time time NOT NULL DEFAULT '07:00',
  tz text NOT NULL DEFAULT 'America/Los_Angeles',
  active boolean NOT NULL DEFAULT true,
  last_sent_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_focus_check
    CHECK (focus IN ('gospel', 'examen', 'rosary', 'rule')),
  CONSTRAINT push_subscriptions_endpoint_shape
    CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) BETWEEN 12 AND 2048)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;

DROP POLICY IF EXISTS deny_select_push_subscriptions ON public.push_subscriptions;
CREATE POLICY deny_select_push_subscriptions ON public.push_subscriptions
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_insert_push_subscriptions ON public.push_subscriptions;
CREATE POLICY deny_insert_push_subscriptions ON public.push_subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS deny_update_push_subscriptions ON public.push_subscriptions;
CREATE POLICY deny_update_push_subscriptions ON public.push_subscriptions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_delete_push_subscriptions ON public.push_subscriptions;
CREATE POLICY deny_delete_push_subscriptions ON public.push_subscriptions
  FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx
ON public.push_subscriptions (active) WHERE active = true;

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_focus text,
  p_local_time text,
  p_tz text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_endpoint text := btrim(coalesce(p_endpoint, ''));
  v_focus text := lower(btrim(coalesce(p_focus, 'gospel')));
  v_time_text text := btrim(coalesce(p_local_time, ''));
  v_tz text := btrim(coalesce(p_tz, ''));
BEGIN
  IF v_endpoint NOT LIKE 'https://%' OR char_length(v_endpoint) NOT BETWEEN 12 AND 2048 THEN
    RAISE EXCEPTION 'invalid_endpoint' USING ERRCODE = '22023';
  END IF;

  -- The subscription keys are base64url: the public key is an uncompressed P-256 point
  -- (87 characters) and the auth secret is 16 bytes (22 characters). Bounds are loose
  -- enough for either to be sent padded, tight enough to reject junk.
  IF p_p256dh IS NULL OR char_length(p_p256dh) NOT BETWEEN 80 AND 100
     OR p_p256dh !~ '^[A-Za-z0-9_\-]+={0,2}$' THEN
    RAISE EXCEPTION 'invalid_p256dh' USING ERRCODE = '22023';
  END IF;

  IF p_auth IS NULL OR char_length(p_auth) NOT BETWEEN 16 AND 32
     OR p_auth !~ '^[A-Za-z0-9_\-]+={0,2}$' THEN
    RAISE EXCEPTION 'invalid_auth' USING ERRCODE = '22023';
  END IF;

  IF v_focus NOT IN ('gospel', 'examen', 'rosary', 'rule') THEN
    RAISE EXCEPTION 'invalid_focus' USING ERRCODE = '22023';
  END IF;

  IF v_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'invalid_local_time' USING ERRCODE = '22023';
  END IF;

  -- IANA names are letters, digits, and a short punctuation set ("America/New_York",
  -- "UTC", "Etc/GMT+5"). Anything else is not a timezone this app should store.
  IF char_length(v_tz) NOT BETWEEN 1 AND 64 OR v_tz !~ '^[A-Za-z0-9_+\-/\.]+$' THEN
    RAISE EXCEPTION 'invalid_tz' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, p256dh, auth, focus, local_time, tz)
  VALUES (v_endpoint, p_p256dh, p_auth, v_focus, v_time_text::time, v_tz)
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        focus = EXCLUDED.focus,
        local_time = EXCLUDED.local_time,
        tz = EXCLUDED.tz,
        active = true,
        updated_at = now();

  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.deactivate_push_subscription(p_endpoint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_rows integer;
BEGIN
  IF p_endpoint IS NULL OR char_length(p_endpoint) NOT BETWEEN 12 AND 2048 THEN
    RETURN false;
  END IF;

  UPDATE public.push_subscriptions
     SET active = false,
         updated_at = now()
   WHERE endpoint = p_endpoint;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_push_subscription(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_push_subscription(text) TO anon, authenticated;
