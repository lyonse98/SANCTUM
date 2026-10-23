/*
  # Lock down circle_members, including the role column (security fix)

  circle_members.role carries privilege inside a circle ('member' / leader). The table had
  SELECT/INSERT/UPDATE/DELETE granted to `anon` and `authenticated` on every column, so any
  row-level policy added later would also have permitted writing `role` — the classic
  privilege-column escalation. user_id defaults to auth.uid() but a default is not a constraint
  and can be overridden in a request body.

  Grants are revoked now. When this feature is built, `role` must be written through a
  SECURITY DEFINER function or a column-level GRANT, never through a bare row policy.

  No data is dropped or altered.
*/

REVOKE ALL ON TABLE public.circle_members FROM anon, authenticated;
