/*
# Collect feedback (ideas and bugs) from users

## Why

Feedback was a `mailto:` link pointing at `feedback@sanctum.app`, an address that does not
exist. Anything a man typed into it bounced. It was also only reachable from two places.

## What this adds

### 1. New table `feedback_submissions`
One row per piece of feedback.

- `id` (uuid, primary key)
- `category` (text, not null) — one of `idea`, `bug`, `other`. Constrained so the column
  cannot hold arbitrary values.
- `message` (text, not null) — what the user wrote. Length-checked between 1 and 4000.
- `contact_email` (text, nullable) — only if the user wants a reply. No account, no name.
- `page` (text, nullable) — which screen they were on, so a bug report has context.
- `reviewed` (boolean, not null, default false) — a flag the owner can tick later.
- `created_at` (timestamptz, not null, default now())

### 2. Security
- RLS is enabled and the four policies deny everything to `anon` and `authenticated`.
- All table privileges are revoked from `anon` and `authenticated`.
- The table is therefore unreachable through the Data API. Feedback is written only by the
  `feedback-submit` edge function using the service role, which bypasses RLS.

This matters because feedback can contain anything a man chooses to type. Nobody with the
public app key should be able to read other people's submissions.

### 3. Rate limiting
No new table or function. The edge function reuses the existing `consume_chat_quota` with a
key prefixed `feedback:`, so feedback gets its own bucket inside the existing limiter and
cannot be used to exhaust anyone's chat quota.

## Notes
- Nothing is emailed. Submissions land in this table and stay there. That is deliberate for
  now: the owner asked for a placeholder until a mail service is connected, and a stored row
  is strictly better than a dead `mailto:` link because nothing is lost.
- When a mail service is connected later, the `feedback-submit` edge function is the single
  place to send from.
*/

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('idea', 'bug', 'other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  page text CHECK (page IS NULL OR char_length(page) <= 64),
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.feedback_submissions FROM anon, authenticated;

DROP POLICY IF EXISTS deny_select_feedback ON public.feedback_submissions;
CREATE POLICY deny_select_feedback ON public.feedback_submissions
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_insert_feedback ON public.feedback_submissions;
CREATE POLICY deny_insert_feedback ON public.feedback_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS deny_update_feedback ON public.feedback_submissions;
CREATE POLICY deny_update_feedback ON public.feedback_submissions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_delete_feedback ON public.feedback_submissions;
CREATE POLICY deny_delete_feedback ON public.feedback_submissions
  FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS feedback_submissions_created_at_idx
  ON public.feedback_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_submissions_unreviewed_idx
  ON public.feedback_submissions (created_at DESC) WHERE reviewed = false;
