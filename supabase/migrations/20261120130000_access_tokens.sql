/*
  # Access tokens — gate the spend, not the page (Erik's design, Nov 20, 2026)

  ## What this is

  Sanctum is in a small testing season. The app itself stays open: the
  daily readings, the reflection, and the Listen audio are generated
  once and shared by everyone, so a crowd costs almost nothing and the
  porch stays open to anyone holding the link — including the
  come-home door. What costs real money is three things, each spending
  Gemini calls on a caller's behalf: companion chats (and letters),
  through chat-proxy, and Tailor builds, PM closes, and audio pieces,
  through tailor-devotional.

  Erik's rule for the mechanism: GATE THE SPEND, NOT THE PAGE. Those
  two functions now ask, before any quota is consumed and before any
  model is called, for a personal access token. A token belongs to one
  approved person. Without one — or with a revoked one — the costly
  doors answer 403 { error: 'access_required' } and spend nothing;
  everything else in the app works exactly as before.

  ## Issuance and revocation

  Tokens are issued OUT OF BAND in this pass — there is no admin UI
  and no issuance endpoint. The flow is the one Erik runs by hand: a
  person asks at the request page (sanctumdaily.app/?access=1), Erik
  approves, Muse inserts a row here with the person's name as the
  label, and Erik sends them their personal link personally:

      https://sanctumdaily.app/?k=<raw token>

  The phone keeps the token on-device (under `sanctum_access_token`,
  inside the panic wipe) and presents it with each gated call.
  Revoking a person is one flip:

      update public.access_tokens set status = 'revoked'
      where label = '<their name>';

  ## The table

  `access_tokens` — one row per issued token:

  - `token_hash` (text, primary key) — SHA-256 of the raw token, the
    same one-way treatment as the rate-limit keys and the tally
    tokens. THE RAW TOKEN IS NEVER STORED, here or anywhere server-
    side; a database read yields hashes and names, never a usable key.
  - `label` (text) — who the token was issued to (the requester's
    name). An access-control record, nothing more: it is never linked
    to anything the person writes, and no other table references it.
  - `status` (text) — 'active' or 'revoked'; the primary key lookup
    the functions perform reads exactly this.
  - `created_at` — when the token was issued.

  The functions look up by `token_hash` (the primary key — one
  indexed read), through the service role, and fail CLOSED: a missing
  row, a revoked row, or a lookup that errors all read as no access.

  ## Security

  The profile_tallies lockdown, mirrored: RLS enabled, all privileges
  revoked from `anon` and `authenticated`, and four policies deny
  everything to both roles. The only readers are chat-proxy and
  tailor-devotional, through the service role; the only writer is the
  owner, issuing and revoking by hand.
*/

CREATE TABLE IF NOT EXISTS public.access_tokens (
  token_hash text PRIMARY KEY,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.access_tokens FROM anon, authenticated;

DROP POLICY IF EXISTS deny_select_access_tokens ON public.access_tokens;
CREATE POLICY deny_select_access_tokens ON public.access_tokens
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_insert_access_tokens ON public.access_tokens;
CREATE POLICY deny_insert_access_tokens ON public.access_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS deny_update_access_tokens ON public.access_tokens;
CREATE POLICY deny_update_access_tokens ON public.access_tokens
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_delete_access_tokens ON public.access_tokens;
CREATE POLICY deny_delete_access_tokens ON public.access_tokens
  FOR DELETE TO anon, authenticated USING (false);
