-- Semester — which school an LTI registration belongs to.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `lti_platform` is keyed by issuer, client and deployment, and until now that
-- was all it said. A validated launch therefore proved which *LMS deployment*
-- sent a student and nothing about which Semester tenant the deployment
-- belongs to. So a launch could not be joined to `institution_membership`, to
-- a tenant's policies, or to the entitlement chain's course steps
-- (docs/ENTITLEMENT-RESOLUTION.md). This column is that join.
--
-- ## Nullable, and deliberately so
--
-- The same reasoning as `20260921162000_lti_token_url.sql`. A registration
-- installed before this existed has no school recorded, and nothing in the row
-- says which one it is: an issuer is the LMS vendor's host, often shared, and
-- the display `name` is never matched on. A default would be a guess, and the
-- thing being guessed at is **which school's data a launch may reach**. So it
-- stays null until an administrator records it, and a launch keeps working
-- exactly as before; nothing reads the column yet.
--
-- ## A school's removal removes its registrations
--
-- `on delete cascade`, as every tenant-bound identity table does
-- (`institution_identity_provider` is the precedent). The alternative,
-- `set null`, would leave a platform this tool still believes with no school
-- behind it, which is the unbound state this column exists to end.

alter table public.lti_platform
  add column if not exists tenant_id text;

-- Guarded, because `add column if not exists` is a no-op on a re-run and the
-- constraint would then be added twice.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.lti_platform'::regclass
       and conname = 'lti_platform_tenant_id_fkey'
  ) then
    alter table public.lti_platform
      add constraint lti_platform_tenant_id_fkey
      foreign key (tenant_id) references public.schools (id) on delete cascade;
  end if;
end $$;

-- Every foreign key is indexed (`indexes.check.sql`), and this one is the
-- column a school's removal and every "registrations for this tenant" read
-- will look up by.
create index if not exists lti_platform_by_tenant on public.lti_platform (tenant_id);

comment on column public.lti_platform.tenant_id is
  'The Semester school this deployment belongs to. Null until an administrator records it; a launch does not read it yet.';
