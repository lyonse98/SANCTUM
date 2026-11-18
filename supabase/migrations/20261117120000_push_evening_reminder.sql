/*
# Push subscriptions: an optional evening reminder

A subscriber may add a SECOND daily poke in the evening (Erik's ruling,
Nov 17, 2026). The evening poke is the same poke — same copy, same landing
(the day's Gospel) — only the hour differs, so it needs no new focus and no
new payload: this migration only records the second hour and the dispatcher's
guard against sending it twice in a day.

Safety shape, chosen so push can never break on a half-applied rollout —
the same pattern as the audience migration before it:

- The six- and seven-argument `upsert_push_subscription` overloads are left
  exactly as they are. A client that sends only an older shape keeps working
  whether or not this migration has been pasted.
- This migration ADDS an eight-argument overload (same name, extra
  `p_evening_time`). PostgREST resolves the overloads by argument names; the
  new client sends `p_evening_time`, and if the overload is not there yet the
  call fails cleanly and the client retries with the older shapes. Either way
  the morning subscription saves; only the evening slot waits for this paste.

`evening_time` is NULL when no evening reminder is set — absence is the off
state, so no separate flag exists. `last_evening_sent_on` is the evening
slot's own sent marker, independent of the morning's `last_sent_on`, and an
upsert never touches it: changing the evening hour must not re-arm a poke
that already went out today.

Idempotent: safe to paste twice.
*/

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS evening_time time NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS last_evening_sent_on date NULL;

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_focus text,
  p_local_time text,
  p_tz text,
  p_audience text,
  p_evening_time text
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
  v_evening_text text := btrim(coalesce(p_evening_time, ''));
  v_evening_time time := NULL;
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

  -- The evening hour is optional: NULL or empty means no evening reminder,
  -- and anything else must be a real 'HH:MM' or the whole save is refused —
  -- a malformed second hour must never silently become some other hour.
  IF v_evening_text <> '' THEN
    IF v_evening_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'invalid_evening_time' USING ERRCODE = '22023';
    END IF;
    v_evening_time := v_evening_text::time;
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, p256dh, auth, focus, local_time, tz, audience, evening_time)
  VALUES (v_endpoint, p_p256dh, p_auth, v_focus, v_time_text::time, v_tz, v_audience, v_evening_time)
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        focus = EXCLUDED.focus,
        local_time = EXCLUDED.local_time,
        tz = EXCLUDED.tz,
        audience = EXCLUDED.audience,
        evening_time = EXCLUDED.evening_time,
        active = true,
        updated_at = now();

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text, text, text, text, text) TO anon, authenticated;
