/*
  # Server-side rate limiting for the chat proxy

  Adds a durable, server-enforced quota for the public `chat-proxy` edge function.
  Before this, the only limits were in the browser (localStorage day counter and an
  in-memory per-window counter), so a direct HTTP call had no limit at all.

  1. New table
    - `chat_rate_limits`
      - `client_key` (text, primary key) — SHA-256 hash of the caller IP. Hashed so no
        raw address is stored, keeping the app's "no user data on servers" claim true.
      - `window_start` (timestamptz) — start of the current short rolling window
      - `window_count` (integer) — requests inside the current short window
      - `day` (date) — UTC day the daily counter belongs to
      - `day_count` (integer) — requests made on that day
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled with NO policies, and all privileges revoked from `anon` and
      `authenticated`: the table is unreachable through the Data API. Only the
      service role (which bypasses RLS) touches it, via the function below.
    - `consume_chat_quota` is SECURITY DEFINER with a pinned `search_path`. EXECUTE is
      revoked from PUBLIC/anon/authenticated and granted only to `service_role`, so the
      browser cannot call it to burn or reset someone else's quota.

  3. Notes
    - The counter update is a single atomic INSERT ... ON CONFLICT DO UPDATE, so two
      concurrent callers cannot both pass the check on a read-then-write race.
    - Returns TRUE when the request is allowed, FALSE when either ceiling is exceeded.
*/

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  client_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_count integer NOT NULL DEFAULT 0,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  day_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE chat_rate_limits FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS chat_rate_limits_updated_at_idx ON chat_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION consume_chat_quota(
  p_client_key text,
  p_window_limit integer DEFAULT 20,
  p_day_limit integer DEFAULT 200,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date := (v_now AT TIME ZONE 'utc')::date;
  v_window_count integer;
  v_day_count integer;
BEGIN
  IF p_client_key IS NULL OR length(p_client_key) = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO chat_rate_limits AS crl (client_key, window_start, window_count, day, day_count, updated_at)
  VALUES (p_client_key, v_now, 1, v_today, 1, v_now)
  ON CONFLICT (client_key) DO UPDATE
    SET
      window_start = CASE
        WHEN crl.window_start < v_now - make_interval(secs => p_window_seconds) THEN v_now
        ELSE crl.window_start
      END,
      window_count = CASE
        WHEN crl.window_start < v_now - make_interval(secs => p_window_seconds) THEN 1
        ELSE crl.window_count + 1
      END,
      day = v_today,
      day_count = CASE
        WHEN crl.day = v_today THEN crl.day_count + 1
        ELSE 1
      END,
      updated_at = v_now
  RETURNING crl.window_count, crl.day_count INTO v_window_count, v_day_count;

  RETURN v_window_count <= p_window_limit AND v_day_count <= p_day_limit;
END;
$$;

REVOKE ALL ON FUNCTION consume_chat_quota(text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_chat_quota(text, integer, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_chat_quota(text, integer, integer, integer) TO service_role;
