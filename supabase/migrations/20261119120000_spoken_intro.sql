/*
# Add the `spoken_intro` column to daily_reflections

## Purpose
The spoken intro (Erik, Nov 19, 2026): before the day's Gospel is read aloud,
the day's narrator speaks a short intro that sets the two days side by side —
yesterday's Gospel in one clause, then today's: what the passage is about and
one thing to listen for. It is generated as an extra output of the same
daily-reflection model call that writes the reflection, the scene, the bridge,
and the carry (fenced in the prompts: description only — scenes, people, and
the question the text itself raises; no lessons, no application, no opinions;
facts only from the two Gospels in the input), accepted only when yesterday's
Gospel was actually fetched and the words pass the length gate (30–80 words),
and stored here so the audio renderer can read it alongside the bridge/carry.

## Notes
- Nullable on purpose: a missing or gate-rejected intro stores NULL, and the
  audio assembles byte-identically to the pre-intro script. An intro problem
  must never block the day's reflection or its audio.
- Per (date, audience): like the bridge, the intro is stored per row from
  each track's own generation — never shared between rows.
- The reflection function's public response is unchanged (reflect, challenge,
  facet) — this column is read by the audio renderer through the service
  role only.
- APPLY THIS MIGRATION BEFORE deploying the updated daily-reflection /
  audio-render functions. (Both functions also carry deploy-order guards
  that fall back to the pre-intro shapes if the column is not there yet, so
  an out-of-order deploy degrades to today's behavior instead of failing —
  but the migration is the intended first step.)

Idempotent: safe to paste twice.
*/

ALTER TABLE public.daily_reflections
  ADD COLUMN IF NOT EXISTS spoken_intro text;
