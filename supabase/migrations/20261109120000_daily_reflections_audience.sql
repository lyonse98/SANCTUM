/*
# Daily reflections: one row per (date, audience)

Women's Mode gives the day two reflections — the men's (facet "As a man", the
original prompt, unchanged) and the women's (facet "As a woman", its own prompt).
Until now `daily_reflections` was keyed by date alone, so the second track had
nowhere to live.

- Adds `audience` ('men' | 'women'), defaulting to 'men' — every existing row is
  a men's reflection, which is exactly what the default says.
- The primary key becomes (date, audience). The daily-reflection function stores
  and reads with `on_conflict=date,audience` to match.
- `daily_audio` is deliberately NOT touched: there is no women's audio in this
  release, and the men's narration pipeline keeps keying by date.

Idempotent: safe to paste twice.
*/

ALTER TABLE public.daily_reflections
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'men';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_reflections_audience_check'
  ) THEN
    ALTER TABLE public.daily_reflections
      ADD CONSTRAINT daily_reflections_audience_check CHECK (audience IN ('men', 'women'));
  END IF;
END $$;

DO $$
BEGIN
  -- Re-key only if the old single-column key is still in place.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_reflections_pkey' AND contype = 'p'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.daily_reflections'::regclass
      AND i.indisprimary
      AND a.attname = 'audience'
  ) THEN
    ALTER TABLE public.daily_reflections DROP CONSTRAINT daily_reflections_pkey;
    ALTER TABLE public.daily_reflections ADD PRIMARY KEY (date, audience);
  END IF;
END $$;
