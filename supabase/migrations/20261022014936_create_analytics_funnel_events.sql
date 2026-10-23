/*
# Create anonymous analytics funnel events

## Purpose
Anonymous, metadata-only usage analytics so the app owner can see a funnel of how men
move through the app — which screens they open, which tools they use, where they drop off.
This is strictly behavioral metadata. No message text, no typed input, no email, no user
identity is ever stored. Only an opaque per-browser session id (a locally-generated random
string, not tied to auth or PII) so a single man's path through the app can be followed
as a sequence of events.

## New Tables
- `analytics_events`
  - `id` (bigint identity, primary key)
  - `session_id` (text, not null) — opaque random string generated client-side, rotated
    on app reinstall / cache clear. NOT a user id. NOT tied to auth.
  - `event_name` (text, not null) — allowlisted event name (e.g. 'tab_view', 'tool_open',
    'companion_route', 'reflection_loaded'). Validated server-side against an allowlist.
  - `event_property` (text, nullable) — one optional allowlisted property value
    (e.g. the tab id 'today', the tool id 'rosary'). No free text from the user.
  - `created_at` (timestamptz, default now())

## Security
- RLS ENABLED on `analytics_events`. No direct INSERT/SELECT/UPDATE/DELETE policies —
  the table is locked down for anon and authenticated roles.
- A SECURITY DEFINER function `track_event(p_session, p_name, p_property)` is the ONLY
  way to write a row. It validates the event name and property against allowlists, so a
  caller cannot store arbitrary strings or PII.
- EXECUTE on `track_event` granted to `anon` and `authenticated` only.
- No one can read the table except the service role (the owner, via the dashboard).
  This is by design: the data is for the owner's analysis, not for users.

## Important Notes
1. The browser sends `{ session, name, property }` to the `analytics-track` edge function,
   which calls `track_event`. The browser never inserts directly.
2. The allowlists are enforced inside the SECURITY DEFINER function, so even a hand-crafted
   request cannot smuggle unapproved event names or free-text properties into the table.
3. `session_id` is a client-generated random string stored in localStorage. It is NOT tied
   to auth, email, or any PII. It exists only to group a single man's events into a path.
*/

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  event_name text NOT NULL,
  event_property text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- No direct policies: deny all direct access for anon and authenticated.
-- The SECURITY DEFINER function below is the only write path.

-- Allowlisted event names. Add new funnel events here.
CREATE OR REPLACE FUNCTION analytics_event_name_allowed(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_name IN (
    'app_open',
    'tab_view',
    'tool_open',
    'companion_selected',
    'companion_route',
    'reflection_loaded',
    'share_opened',
    'reminder_signup',
    'feedback_opened'
  )
$$;

-- Allowlisted property values. Tab ids, tool ids, companion ids — never free text.
-- NULL property is always allowed (events with no property).
CREATE OR REPLACE FUNCTION analytics_property_allowed(p_property text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_property IS NULL OR p_property IN (
    -- tabs
    'today', 'church', 'companions', 'help', 'workshop',
    -- tools
    'rosary', 'confession', 'catechism', 'lectio', 'examen', 'cold-start',
    'breathing', 'grounding', 'driveway', 'rule', 'scripture', 'prayer-library',
    -- companions
    'joseph', 'david', 'paul', 'augustine', 'ignatius', 'peter', 'moses', 'therese', 'aquinas',
    -- funnel sources
    'gospel', 'tab-bar', 'cold-start', 'companion-select', 'settings'
  )
$$;

-- The ONLY write path. SECURITY DEFINER so it runs as the owner; RLS blocks direct inserts.
CREATE OR REPLACE FUNCTION track_event(
  p_session text,
  p_name text,
  p_property text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT analytics_event_name_allowed(p_name) THEN
    RAISE EXCEPTION 'disallowed event name';
  END IF;
  IF NOT analytics_property_allowed(p_property) THEN
    RAISE EXCEPTION 'disallowed event property';
  END IF;
  IF length(p_session) < 8 OR length(p_session) > 64 THEN
    RAISE EXCEPTION 'invalid session id';
  END IF;
  INSERT INTO analytics_events (session_id, event_name, event_property)
  VALUES (p_session, p_name, p_property);
END;
$$;

REVOKE ALL ON analytics_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION track_event(text, text, text) TO anon, authenticated;

-- Index for the owner's funnel queries.
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events (event_name, created_at DESC);
