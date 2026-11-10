/*
# Analytics allowlist: the eight women's companion ids

`track_event` rejects any property the allowlist does not name. Women's Mode adds
eight companions; without this migration their `companion_selected` events would
be refused server-side (the client degrades silently — the events simply never
land). The list below is the original list plus the new ids, nothing else moved.

Idempotent: CREATE OR REPLACE.
*/

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
    -- companions (men's track, then women's track)
    'joseph', 'david', 'paul', 'augustine', 'ignatius', 'peter', 'moses', 'therese', 'aquinas',
    'mary', 'magdalene', 'teresa', 'catherine', 'monica', 'joan', 'clare', 'therese-women',
    -- funnel sources
    'gospel', 'tab-bar', 'cold-start', 'companion-select', 'settings'
  )
$$;
