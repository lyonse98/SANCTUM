/*
# Add the `spoken_bridge` and `spoken_carry` columns to daily_reflections

## Purpose
The spoken bridge (Erik, Nov 14, 2026): after the Gospel is read aloud, the day's
narrator speaks a short conversational bridge — a homily-like tie-in of questions,
connections, and focus prompts binding the Gospel to the day's reflection and
challenge — and after the challenge, one short "carry" line to take into the day.
Both are generated as extra outputs of the same daily-reflection model call that
writes the reflection (fenced in the prompts: no opinions, no new facts, no
quotations beyond the day's own texts), gated on the Gospel text being in the
model input and on a length lint (bridge <= 1200 chars, carry <= 300 chars), and
stored here so the audio renderer can read them alongside reflect/challenge/facet.

## Notes
- Nullable on purpose: a missing or lint-rejected bridge stores NULL, and the
  audio assembles byte-identically to the pre-bridge script. A bridge problem
  must never block the day's reflection or its audio.
- Per (date, audience): each track's bridge binds its own track's reflection
  and challenge, so unlike the scene the bridge is never shared between rows.
- The reflection function's public response is unchanged (reflect, challenge,
  facet) — these columns are read by the audio renderer through the service
  role only.
- APPLY THIS MIGRATION BEFORE deploying the updated daily-reflection /
  audio-render functions. (Both functions also carry deploy-order guards that
  fall back to the pre-bridge shapes if the columns are not there yet, so an
  out-of-order deploy degrades to today's behavior instead of failing — but
  the migration is the intended first step.)

Idempotent: safe to paste twice.
*/

ALTER TABLE public.daily_reflections
  ADD COLUMN IF NOT EXISTS spoken_bridge text;

ALTER TABLE public.daily_reflections
  ADD COLUMN IF NOT EXISTS spoken_carry text;
