-- Semester — prospective retention for institutional setup requests.
--
-- The approved rule is deliberately narrow: a *new* unconverted
-- `plan_institution_launch` request is eligible after 90 days. The route is
-- server-owned CTA configuration; visitor-supplied JSON is not authority.
-- Existing rows are not backfilled. Other CTA routes receive no deadline.
-- Conversion is an explicit service-owned link to the institution's
-- billing account; a GTM account alone is not conversion because intake
-- creates one for every institutional lead.
--
-- This migration installs the mechanism but does not schedule or run it.
-- Production activation remains a separate release action.

alter table public.site_leads
  add column if not exists retention_class text,
  add column if not exists purge_after timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_billing_account_id uuid
    references public.billing_accounts(id) on delete restrict;

alter table public.site_leads
  drop constraint if exists site_leads_retention_class_check,
  add constraint site_leads_retention_class_check check (
    retention_class is null or retention_class = 'institution_setup_unconverted_90d'
  ),
  drop constraint if exists site_leads_retention_deadline_check,
  add constraint site_leads_retention_deadline_check check (
    (retention_class is null and purge_after is null)
    or (
      retention_class = 'institution_setup_unconverted_90d'
      and purge_after = created_at + interval '90 days'
    )
  ),
  drop constraint if exists site_leads_conversion_check,
  add constraint site_leads_conversion_check check (
    (converted_at is null and converted_billing_account_id is null)
    or (
      converted_at is not null
      and converted_billing_account_id is not null
      and retention_class = 'institution_setup_unconverted_90d'
    )
  );

create index if not exists site_leads_unconverted_retention
  on public.site_leads (purge_after, id)
  where retention_class = 'institution_setup_unconverted_90d'
    and converted_at is null
    and converted_billing_account_id is null;

-- The trigger is prospective by construction. Columns added above default to
-- null and no UPDATE touches old rows; only an INSERT after this migration can
-- receive the category. Caller-provided retention/conversion values are
-- discarded so the server owns the classification.
create or replace function private.site_lead_retention_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.route_key = 'plan_institution_launch' then
    new.retention_class := 'institution_setup_unconverted_90d';
    new.purge_after := new.created_at + interval '90 days';
  else
    new.retention_class := null;
    new.purge_after := null;
  end if;
  new.converted_at := null;
  new.converted_billing_account_id := null;
  return new;
end $$;

revoke all on function private.site_lead_retention_stamp() from public, anon, authenticated;

drop trigger if exists site_lead_retention_stamp on public.site_leads;
create trigger site_lead_retention_stamp
  before insert on public.site_leads
  for each row execute function private.site_lead_retention_stamp();

-- Retention metadata is evidence. It cannot be relabelled or shortened after
-- insertion; conversion can be written once through the service function;
-- and a classified lead can be deleted only by the scoped sweep.
create or replace function private.site_lead_retention_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.retention_class = 'institution_setup_unconverted_90d'
       and coalesce(current_setting('semester.site_lead_retention', true), '') <> 'sweep' then
      raise exception 'A classified institutional setup request may be deleted only by its retention sweep.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if (new.created_at, new.route_key, new.retention_class, new.purge_after)
     is distinct from (old.created_at, old.route_key, old.retention_class, old.purge_after) then
    raise exception 'Site-lead retention route, classification and deadline are immutable.' using errcode = '42501';
  end if;

  if (new.converted_at, new.converted_billing_account_id)
     is distinct from (old.converted_at, old.converted_billing_account_id) then
    if coalesce(current_setting('semester.site_lead_conversion', true), '') <> 'mark' then
      raise exception 'Site-lead conversion is recorded only by the conversion function.' using errcode = '42501';
    end if;
    if old.converted_at is not null or old.converted_billing_account_id is not null then
      raise exception 'Site-lead conversion evidence is immutable.' using errcode = '42501';
    end if;
    if new.retention_class <> 'institution_setup_unconverted_90d'
       or new.converted_at is null or new.converted_billing_account_id is null then
      raise exception 'A classified request needs complete conversion evidence.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

revoke all on function private.site_lead_retention_guard() from public, anon, authenticated;

drop trigger if exists site_lead_retention_guard on public.site_leads;
create trigger site_lead_retention_guard
  before update or delete on public.site_leads
  for each row execute function private.site_lead_retention_guard();

-- service_role owns intake operations but not the retention evidence. Remove
-- its broad table mutation grants, then return only the ordinary operational
-- columns. The SECURITY DEFINER conversion/sweep functions execute as their
-- owner, so a caller cannot bypass their checks by setting the custom GUCs.
revoke update, delete, truncate on public.site_leads from service_role;
grant update (
  reference, destination, name, email, organization, role, message,
  fields, page, status, respond_by, gtm_account_id, gtm_stakeholder_id,
  trust_request_id
) on public.site_leads to service_role;

create or replace function private.mark_site_lead_converted(
  want_reference text,
  want_billing_account uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  lead public.site_leads;
  conversion_time constant timestamptz := now();
begin
  select * into lead from public.site_leads
   where reference = want_reference
   for update;
  if not found then
    raise exception 'No such site lead.' using errcode = 'P0002';
  end if;
  if lead.retention_class <> 'institution_setup_unconverted_90d' then
    raise exception 'Only a classified institutional setup request can be converted.' using errcode = '22023';
  end if;
  if lead.converted_at is not null or lead.converted_billing_account_id is not null then
    if lead.converted_billing_account_id = want_billing_account then return false; end if;
    raise exception 'This request is already linked to a different customer account.' using errcode = '23514';
  end if;
  if lead.gtm_account_id is null or not exists (
    select 1 from public.billing_accounts b
     where b.id = want_billing_account
       and b.kind = 'institution'
       and b.gtm_account_id = lead.gtm_account_id
  ) then
    raise exception 'Conversion must link the request''s GTM account to its institutional billing account.'
      using errcode = '23514';
  end if;

  perform set_config('semester.site_lead_conversion', 'mark', true);
  update public.site_leads
     set converted_at = conversion_time,
         converted_billing_account_id = want_billing_account
   where id = lead.id;
  perform set_config('semester.site_lead_conversion', '', true);
  return true;
end $$;

revoke all on function private.mark_site_lead_converted(text, uuid)
  from public, anon, authenticated;
grant execute on function private.mark_site_lead_converted(text, uuid) to service_role;

-- Hold placement/release and deleting runs take the same transaction lock.
-- If a hold wins, the sweep waits and then sees it. If a sweep wins, hold
-- placement waits until that deleting transaction is complete; there is no
-- interval in which a committed hold exists but the sweep has not observed it.
create or replace function private.site_lead_retention_hold_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subject_kind = 'platform' or (tg_op = 'UPDATE' and old.subject_kind = 'platform') then
    perform pg_advisory_xact_lock(hashtext('site_lead_retention:platform_hold'));
  end if;
  return new;
end $$;

revoke all on function private.site_lead_retention_hold_lock() from public, anon, authenticated;

drop trigger if exists site_lead_retention_hold_lock on public.legal_holds;
create trigger site_lead_retention_hold_lock
  before insert or update on public.legal_holds
  for each row execute function private.site_lead_retention_hold_lock();

-- Counts only: no lead id, reference, name, email, organization, message or
-- fields enter the journal. There is deliberately no scheduler in this
-- migration; a production run needs the separate release approval.
create table if not exists public.site_lead_retention_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  as_of       timestamptz not null,
  dry_run     boolean     not null,
  candidates  integer     not null check (candidates >= 0),
  deleted     integer     not null check (deleted between 0 and candidates),
  skipped     text        check (skipped is null or skipped = 'legal_hold'),
  check (not dry_run or deleted = 0),
  check (skipped is null or deleted = 0)
);

alter table public.site_lead_retention_runs enable row level security;
revoke all on public.site_lead_retention_runs from public, anon, authenticated;
revoke all on public.site_lead_retention_runs from service_role;
grant select on public.site_lead_retention_runs to service_role;

create or replace function private.site_lead_retention_run(
  as_of timestamptz default now(),
  batch_size integer default 200,
  dry_run boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate_count integer := 0;
  deleted_count integer := 0;
  skipped_reason text;
begin
  if as_of is null then raise exception 'An evaluation time is required.' using errcode = '22023'; end if;
  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception 'Batch size must be between 1 and 1000.' using errcode = '22023';
  end if;
  if dry_run is null then raise exception 'Dry-run choice is required.' using errcode = '22023'; end if;
  if not dry_run and as_of > now() then
    raise exception 'A deleting run cannot evaluate a future time.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('site_lead_retention:platform_hold'));
  if private.platform_is_held() then
    skipped_reason := 'legal_hold';
  elsif dry_run then
    select count(*) into candidate_count from (
      select l.id
        from public.site_leads l
       where l.retention_class = 'institution_setup_unconverted_90d'
         and l.route_key = 'plan_institution_launch'
         and l.purge_after is not null and l.purge_after <= as_of
         and l.converted_at is null and l.converted_billing_account_id is null
       order by l.purge_after, l.id
       limit batch_size
    ) eligible;
  else
    perform set_config('semester.site_lead_retention', 'sweep', true);
    with eligible as (
      select l.id
        from public.site_leads l
       where l.retention_class = 'institution_setup_unconverted_90d'
         and l.route_key = 'plan_institution_launch'
         and l.purge_after is not null and l.purge_after <= as_of
         and l.converted_at is null and l.converted_billing_account_id is null
       order by l.purge_after, l.id
       for update skip locked
       limit batch_size
    ), removed as (
      delete from public.site_leads l
       using eligible e
       where l.id = e.id
       returning l.id
    )
    select count(*) into deleted_count from removed;
    candidate_count := deleted_count;
    perform set_config('semester.site_lead_retention', '', true);
  end if;

  insert into public.site_lead_retention_runs (as_of, dry_run, candidates, deleted, skipped)
  values (as_of, dry_run, candidate_count, deleted_count, skipped_reason);

  return jsonb_build_object(
    'as_of', as_of,
    'dry_run', dry_run,
    'candidates', candidate_count,
    'deleted', deleted_count,
    'skipped', skipped_reason
  );
end $$;

revoke all on function private.site_lead_retention_run(timestamptz, integer, boolean)
  from public, anon, authenticated;
grant execute on function private.site_lead_retention_run(timestamptz, integer, boolean) to service_role;

comment on column public.site_leads.retention_class is
  'Prospective class derived from the server-owned CTA route. Null means no approved automatic purge applies; never infer one from historical data.';
comment on column public.site_leads.converted_billing_account_id is
  'Explicit customer conversion link. A GTM account alone is not conversion because intake creates it.';
comment on table public.site_lead_retention_runs is
  'Counts-only record of manual institutional-intake retention checks/runs. Contains no lead payload. No production schedule is installed.';
comment on function private.site_lead_retention_run(timestamptz, integer, boolean) is
  'Service-only, unscheduled and dry-run by default. Removes only prospectively classified, unconverted institutional setup requests due after 90 days; a platform legal hold pauses it.';
