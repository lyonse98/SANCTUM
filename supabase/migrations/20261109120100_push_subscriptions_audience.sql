/*
# Push subscriptions: record which track a device is on

Women's Mode stores the subscriber's audience beside her choices, so dispatch can
one day word a poke for the track she actually reads. Dispatch copy today is
generic and does not branch on this column — this migration only records it.

Safety shape, chosen so push can never break on a half-applied rollout:

- The original six-argument `upsert_push_subscription` is left exactly as it is.
  A client that sends only the old shape keeps working whether or not this
  migration has been pasted.
- This migration ADDS a seven-argument overload (same name, extra `p_audience`).
  PostgREST resolves the two by argument names; the new client sends
  `p_audience`, and if the overload is not there yet the call fails cleanly and
  the client retries with the old shape. Either way the subscription saves.

Idempotent: safe to paste twice.
*/

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'men';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_audience_check'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_audience_check CHECK (audience IN ('men', 'women'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_focus text,
  p_local_time text,
  p_tz text,
  p_audience text
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
  v_audience text := lower(btrim(coalesce(p_audience, 'men')));
BEGIN
  IF v_endpoint NOT LIKE 'https://%' OR char_length(v_endpoint) NOT BETWEEN 12 AND 2048 THEN
    RAISE EXCEPTION 'invalid_endpoint' USING ERRCODE = '22023';
  END IF;

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

  IF char_length(v_tz) NOT BETWEEN 1 AND 64 OR v_tz !~ '^[A-Za-z0-9_+\-/\.]+$' THEN
    RAISE EXCEPTION 'invalid_tz' USING ERRCODE = '22023';
  END IF;

  IF v_audience NOT IN ('men', 'women') THEN
    RAISE EXCEPTION 'invalid_audience' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, p256dh, auth, focus, local_time, tz, audience)
  VALUES (v_endpoint, p_p256dh, p_auth, v_focus, v_time_text::time, v_tz, v_audience)
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        focus = EXCLUDED.focus,
        local_time = EXCLUDED.local_time,
        tz = EXCLUDED.tz,
        audience = EXCLUDED.audience,
        active = true,
        updated_at = now();

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text, text) TO anon, authenticated;
