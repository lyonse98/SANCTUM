/*
# Add the `scene` column to daily_reflections

## Purpose
The audio narrator speaks a short "scene" line before the Gospel — pure passage fact
(where, when, who is present), never interpretation. The scene is generated as an extra
output of the same daily-reflection model call (spec §6.3), validated by the scene lint,
and stored here so the audio renderer can read it alongside reflect/challenge/facet.

## Notes
- Nullable on purpose: a failed or lint-rejected scene stores NULL, and the audio simply
  omits the scene and its lead-in. A scene problem must never block the day's reflection.
- The reflection function's public response is unchanged (reflect, challenge, facet) —
  this column is read by the audio renderer through the service role only.
*/
ALTER TABLE daily_reflections ADD COLUMN IF NOT EXISTS scene text;
