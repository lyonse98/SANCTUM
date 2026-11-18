/*
# Push subscriptions: parish reminder times and the drive-home hour

The notifications batch (Erik, Nov 18, 2026) adds three more pokes, each
with its own hour and its own sent marker, beside the morning and evening
slots:

- a WEEKLY poke before the reader's usual Mass at his parish,
- a WEEKLY poke before his parish's Confession time,
- a DAILY drive-home poke, opening Tonight for the ride home.

What the server holds for these is deliberately little: days of week,
times of day, and how many minutes ahead a poke may come. The parish's
NAME is never sent and never stored here — it lives only on the reader's
phone. A poke that says "Mass at your parish is coming up" needs no name
to keep its promise.

Safety shape, the same as the evening migration before it:

- Every new column is nullable; absence is the off state, so no flags.
- The sync is a NEW function, `upsert_parish_reminders`, matched by
  endpoint. The existing `upsert_push_subscription` overloads are left
  exactly as they are — a client (or dispatcher) from before this
  migration keeps working whether or not this paste has happened, and
  the dispatcher's reads fall back through narrower selects the same way.
- An upsert never touches a sent marker: changing an hour must not re-arm
  a poke that already went out for that event.

Idempotent: safe to paste twice.
*/

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS mass_day smallint NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS mass_time time NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS mass_lead_min int NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS mass_last_sent_on date NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS conf_day smallint NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS conf_time time NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS conf_lead_min int NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS conf_last_sent_on date NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS drive_time time NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS drive_last_sent_on date NULL;

CREATE OR REPLACE FUNCTION public.upsert_parish_reminders(
  p_endpoint text,
  p_mass_day int,
  p_mass_time text,
  p_mass_lead int,
  p_conf_day int,
  p_conf_time text,
  p_conf_lead int,
  p_drive_time text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_endpoint text := btrim(coalesce(p_endpoint, ''));
  v_mass_time_text text := btrim(coalesce(p_mass_time, ''));
  v_conf_time_text text := btrim(coalesce(p_conf_time, ''));
  v_drive_time_text text := btrim(coalesce(p_drive_time, ''));
  v_mass_time time := NULL;
  v_conf_time time := NULL;
  v_drive_time time := NULL;
BEGIN
  IF v_endpoint NOT LIKE 'https://%' OR char_length(v_endpoint) NOT BETWEEN 12 AND 2048 THEN
    RAISE EXCEPTION 'invalid_endpoint' USING ERRCODE = '22023';
  END IF;

  -- Days of week are 0 (Sunday) through 6 (Saturday), or NULL for unset.
  IF p_mass_day IS NOT NULL AND (p_mass_day < 0 OR p_mass_day > 6) THEN
    RAISE EXCEPTION 'invalid_mass_day' USING ERRCODE = '22023';
  END IF;

  IF p_conf_day IS NOT NULL AND (p_conf_day < 0 OR p_conf_day > 6) THEN
    RAISE EXCEPTION 'invalid_conf_day' USING ERRCODE = '22023';
  END IF;

  -- Leads are one of the three offered, or NULL for no reminder.
  IF p_mass_lead IS NOT NULL AND p_mass_lead NOT IN (30, 60, 120) THEN
    RAISE EXCEPTION 'invalid_mass_lead' USING ERRCODE = '22023';
  END IF;

  IF p_conf_lead IS NOT NULL AND p_conf_lead NOT IN (30, 60, 120) THEN
    RAISE EXCEPTION 'invalid_conf_lead' USING ERRCODE = '22023';
  END IF;

  -- Times are optional: NULL or empty means unset, and anything else must
  -- be a real 'HH:MM' or the whole save is refused — a malformed hour must
  -- never silently become some other hour.
  IF v_mass_time_text <> '' THEN
    IF v_mass_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'invalid_mass_time' USING ERRCODE = '22023';
    END IF;
    v_mass_time := v_mass_time_text::time;
  END IF;

  IF v_conf_time_text <> '' THEN
    IF v_conf_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'invalid_conf_time' USING ERRCODE = '22023';
    END IF;
    v_conf_time := v_conf_time_text::time;
  END IF;

  IF v_drive_time_text <> '' THEN
    IF v_drive_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'invalid_drive_time' USING ERRCODE = '22023';
    END IF;
    v_drive_time := v_drive_time_text::time;
  END IF;

  UPDATE public.push_subscriptions
    SET mass_day = p_mass_day,
        mass_time = v_mass_time,
        mass_lead_min = p_mass_lead,
        conf_day = p_conf_day,
        conf_time = v_conf_time,
        conf_lead_min = p_conf_lead,
        drive_time = v_drive_time,
        updated_at = now()
    WHERE endpoint = v_endpoint;

  -- No row matched: there is no subscription to hang these times on.
  -- That is a truthful "not saved", not an error — the client keeps the
  -- settings on the device and syncs again when a subscription exists.
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_parish_reminders(text, int, text, int, int, text, int, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_parish_reminders(text, int, text, int, int, text, int, text) TO anon, authenticated;
