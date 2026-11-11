/*
# Daily audio: one row per (date, audience)

The women's company (Narrator Charter addendum, Erik, Nov 11, 2026) reverses the
earlier women's-audio exclusion, so the day now has two renders — the men's and
the women's — and `daily_audio`, keyed by date alone, had nowhere for the second
to live. This is the same re-key `daily_reflections` received on Nov 9; it
supersedes that migration's note that daily_audio was deliberately untouched.

- Adds `audience` ('men' | 'women'), defaulting to 'men' — every existing row is
  a men's render, which is exactly what the default says.
- The primary key becomes (date, audience). The audio-render function stores
  and reads with `on_conflict=date,audience` to match, and the app reads with
  an audience filter, so the two tracks' bars can never cross.
- The segment files gain the audience as a path segment (`<date>/<audience>/…`)
  in code, not in this migration — storage needs no schema change.

Idempotent: safe to paste twice.
*/

ALTER TABLE public.daily_audio
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'men';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_audio_audience_check'
  ) THEN
    ALTER TABLE public.daily_audio
      ADD CONSTRAINT daily_audio_audience_check CHECK (audience IN ('men', 'women'));
  END IF;
END $$;

DO $$
BEGIN
  -- Re-key only if the old single-column key is still in place.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_audio_pkey' AND contype = 'p'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.daily_audio'::regclass
      AND i.indisprimary
      AND a.attname = 'audience'
  ) THEN
    ALTER TABLE public.daily_audio DROP CONSTRAINT daily_audio_pkey;
    ALTER TABLE public.daily_audio ADD PRIMARY KEY (date, audience);
  END IF;
END $$;
