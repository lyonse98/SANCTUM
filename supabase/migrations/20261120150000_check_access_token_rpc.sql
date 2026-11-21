-- The access gate's verdict door (Nov 20, 2026).
--
-- The gate originally read access_tokens directly with the service
-- role. On the evening of Nov 20 that read began failing from inside
-- the edge functions while the identical query succeeded from every
-- other client — the gate failed closed, as designed, and locked
-- every token holder out. This function is the durable shape: a
-- security-definer door that answers exactly one question — "is this
-- token hash an active token?" — true or false, nothing else. It
-- runs as the table's owner, so the answer does not depend on which
-- role the caller presents as, and the table itself stays locked
-- down (RLS deny-all, no grants to anon/authenticated).
--
-- Applied live via the Management API on Nov 20, 2026, ahead of the
-- gate code that calls it; this file is the repo record.

create or replace function public.check_access_token(p_token_hash text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.access_tokens
    where token_hash = p_token_hash and status = 'active'
  );
$$;

revoke all on function public.check_access_token(text) from public;
grant execute on function public.check_access_token(text) to anon, authenticated, service_role;
