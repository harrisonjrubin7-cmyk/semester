-- Semester — which institutional membership an LTI launch belongs to.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `20260927180000_lti_integration_binding.sql` gave a registration its school.
-- This joins a launch through that registration to the person's
-- `institution_membership` in that school, so a launch can be judged by the
-- membership's current lifecycle state and roles rather than by what the LMS
-- says about the person.
--
-- ## The only path, and why it is the only one
--
--     lti_platform (issuer, client, deployment) → tenant_id
--     lti_identity (issuer, subject), origin = 'linked' → user_id
--     institution_membership (tenant_id, auth_user_id = user_id)
--
-- Each hop is a row a service-role writer created. None of it reads a launch
-- claim beyond the three the launch was already verified on. In particular it
-- does not match on email, `lis_person_sourcedid`, or any SIS id a platform
-- sends. Each is a string a registered platform chooses, and a join on one
-- hands a membership to whoever can get one registration row wrong.
-- `_shared/ltiaccount.ts` refuses email matching for the same reason.
--
-- `origin = 'linked'` is required, not incidental. A `provisioned` identity
-- points at the account the launch itself made on `lti.invalid`, which no SSO
-- sign-in can be and so no membership is bound to. A `linked` identity points
-- at an account a person signed in to and claimed with a single-use ticket
-- (`adopt_lti_identity`). That is the one proof, on both sides, that the LMS
-- person and the campus person are the same human.
--
-- ## It reads and never writes
--
-- A launch never creates, reactivates or widens a membership: SCIM is the
-- lifecycle (docs/SCIM-LIFECYCLE-MANAGEMENT.md). This answers a question and
-- returns why when the answer is no. The launch goes through either way;
-- what a caller does with `membership-suspended` is that caller's rule.

create or replace function public.lti_launch_membership(
  want_issuer text,
  want_client text,
  want_deployment text,
  want_subject text
)
returns table (outcome text, tenant_id text, membership_id uuid, roles text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text;
  identity public.lti_identity;
  m public.institution_membership;
begin
  -- The registration by its whole key. Not by issuer and client alone: one
  -- client can hold a deployment per school, and the deployment is what the
  -- launch was verified against.
  select p.tenant_id into school
    from public.lti_platform p
   where p.issuer = want_issuer
     and p.client_id = want_client
     and p.deployment_id = want_deployment;
  if not found then
    return query select 'no-registration'::text, null::text, null::uuid, null::text[];
    return;
  end if;
  if school is null then
    return query select 'unbound'::text, null::text, null::uuid, null::text[];
    return;
  end if;

  select * into identity from public.lti_identity i
   where i.issuer = want_issuer and i.subject = want_subject;
  if not found then
    return query select 'no-identity'::text, school, null::uuid, null::text[];
    return;
  end if;
  if identity.origin <> 'linked' then
    return query select 'identity-not-linked'::text, school, null::uuid, null::text[];
    return;
  end if;

  -- At most one: `institution_membership_one_user_per_tenant`.
  select * into m from public.institution_membership im
   where im.tenant_id = school and im.auth_user_id = identity.user_id;
  if not found then
    return query select 'no-membership'::text, school, null::uuid, null::text[];
    return;
  end if;
  if m.status <> 'active' then
    return query select ('membership-' || m.status)::text, school, m.id, null::text[];
    return;
  end if;

  return query select 'joined'::text, school, m.id, m.roles;
end $$;

-- Both spellings, for the reason 20260921160000_lti.sql gives at length:
-- PUBLIC's grant and Supabase's by-name default grant are separate doors.
revoke all on function public.lti_launch_membership(text, text, text, text) from public;
revoke all on function public.lti_launch_membership(text, text, text, text) from anon, authenticated;
grant execute on function public.lti_launch_membership(text, text, text, text) to service_role;

comment on function public.lti_launch_membership(text, text, text, text) is
  'Service-only: the institution_membership a verified LTI launch joins, through registration school and a linked identity only. Reads; never writes. Roles only when joined.';
