/*
  # Lock down circles (security fix)

  The circles table had SELECT/INSERT/UPDATE/DELETE granted to both `anon` and `authenticated`
  on every column while RLS was enabled with no policies. The empty policy set is what currently
  denies access; the grants themselves are unnecessary because no application code queries this
  table. Revoking them means the table cannot be opened to the internet by adding a single policy.

  No data is dropped or altered.
*/

REVOKE ALL ON TABLE public.circles FROM anon, authenticated;
