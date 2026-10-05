-- Bind the first verified SAML login to the membership SCIM created before
-- the person had a Supabase Auth id. The verified provider, tenant and
-- asserted email must all agree; a browser can never call this function.

create or replace function public.bind_institution_sso_membership(
  want_tenant text,
  want_provider uuid,
  want_auth_user uuid,
  want_user_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
  email_domain text;
  changed bigint;
begin
  if want_auth_user is null
     or length(trim(want_user_name)) not between 3 and 300
     or trim(want_user_name) !~ '^[^@]+@[^@]+$'
  then return false; end if;

  email_domain := lower(split_part(trim(want_user_name), '@', 2));
  if not exists (
    select 1
      from public.institution_identity_provider p
     where p.id = want_provider
       and p.tenant_id = want_tenant
       and p.status = 'authorized'
       and exists (
         select 1 from unnest(p.domains) allowed(domain)
          where lower(trim(allowed.domain)) = email_domain
       )
  ) then return false; end if;

  -- The per-tenant user_name index makes this at most one row. Lock it so two
  -- simultaneous first logins cannot both claim the same SCIM identity.
  select e.membership_id into member_id
    from public.scim_external_identity e
    join public.institution_membership m
      on m.id = e.membership_id and m.tenant_id = e.tenant_id
   where e.tenant_id = want_tenant
     and lower(e.user_name) = lower(trim(want_user_name))
     and e.active
     and m.status = 'active'
     and (m.auth_user_id is null or m.auth_user_id = want_auth_user)
     and (m.identity_provider_id is null or m.identity_provider_id = want_provider)
   for update of e, m;

  if member_id is null then return false; end if;

  update public.institution_membership
     set auth_user_id = want_auth_user,
         identity_provider_id = want_provider,
         updated_at = now()
   where id = member_id
     and tenant_id = want_tenant
     and (auth_user_id is null or auth_user_id = want_auth_user)
     and (identity_provider_id is null or identity_provider_id = want_provider);
  get diagnostics changed = row_count;
  return changed = 1;
exception
  when unique_violation or foreign_key_violation then return false;
end
$$;

revoke all on function public.bind_institution_sso_membership(text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.bind_institution_sso_membership(text, uuid, uuid, text)
  to service_role;

comment on function public.bind_institution_sso_membership(text, uuid, uuid, text) is
  'Service-only first-login binding from an authorized SAML assertion to a pre-provisioned SCIM membership.';
