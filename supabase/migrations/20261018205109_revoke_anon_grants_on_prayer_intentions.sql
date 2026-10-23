/*
  # Lock down prayer_intentions (security fix)

  prayer_intentions holds private prayer text. The table had SELECT/INSERT/UPDATE/DELETE granted
  to both `anon` and `authenticated` on every column, with RLS enabled and no policies. Access is
  currently denied by the empty policy set, but the standing grants mean the first policy written
  against this table would expose private prayers (and allow anonymous deletion) rather than
  scoping them to circle members.

  Nothing in the application queries this table yet, so revoking the grants changes no behaviour
  and leaves two independent layers that must both be opened deliberately.

  No data is dropped or altered.
*/

REVOKE ALL ON TABLE public.prayer_intentions FROM anon, authenticated;
