/*
# Push subscriptions: the Confession "evening before" lead

Erik's ruling (Nov 20, 2026): a Confession reminder may come not a count
of minutes before the Confession hour, but on the EVENING BEFORE the
Confession day — one poke at 7:00 PM local, the night to examine before
the morning to confess. Lead-minutes arithmetic cannot express that, so
the lead is carried as a SENTINEL in the column it already travels in:

  conf_lead_min = -1  means "the evening before" — not a count of minutes.

The sentinel is Confession-only. The Mass lead keeps its three values,
and the dispatcher special-cases -1 for Confession alone (see
evaluateConfessionEveDue in src/lib/pushCore.ts): it never reaches the
weekly due arithmetic, whose own guard refuses a lead of zero or less.

This migration replaces ONLY the validation inside
`upsert_parish_reminders` (created by 20261118140000_parish_reminders.sql,
which is left exactly as it was — applied migrations are never edited).
The function body is otherwise identical: same parameters, same times
validation, same update, and an upsert still never touches a sent marker.

Idempotent: safe to paste twice.
*/

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

  -- The Confession lead accepts the three offered values and, since
  -- Nov 20, 2026, the evening-before sentinel -1 (see the header).
  IF p_conf_lead IS NOT NULL AND p_conf_lead NOT IN (30, 60, 120, -1) THEN
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
