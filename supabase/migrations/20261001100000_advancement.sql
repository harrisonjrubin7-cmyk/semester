-- Semester — alumni relations and fundraising records for a school that runs
-- the `advancement` module in Core (D-151): alumni who opt in at graduation,
-- funds, campaigns, donors, gifts and pledges recorded by an advancement office,
-- receipts the school's own wording makes, refunds a second person approves, and
-- gift officers' portfolios.
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval, and the wording of a tax receipt and charitable-solicitation
-- registration need the school's counsel before this is used (see D-993).
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's `advancement`
--     module is `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **An alumnus is an alumnus because they said so.** `alumni_opt_in` is the
--     graduate's own act: the caller's account must be linked to a record that has
--     a conferral on it. Nothing else creates an alumni profile, and a profile
--     holds a display name, a class year and two preferences, never a grade, a
--     record reference or anything academic. **A current student is not a
--     constituent:** no table here can be written from a record without a
--     conferral, and no advancement role reads the academic record.
--   * **Solicitation is the alumnus's to switch off.** `alumni_preferences` sets
--     directory visibility and whether the school may solicit; an alumnus who
--     opts out is no longer solicitable, and a contact note of kind
--     `solicitation` is refused for them. Past gifts stay: they are the school's
--     financial record.
--   * **A gift is a record, not a payment.** An officer holding `adv:gift` records
--     a gift (who, how much in cents, which fund, when, how received, by
--     reference); no card or bank detail lives here, and nothing here moves money.
--     A gift is never rewritten. A refund is a separate record by a holder of
--     `adv:refund` who is not the person who recorded the gift.
--   * **A receipt is the school's wording, issued with the gift.** Recording a gift
--     issues a numbered receipt in the same transaction from the statement the
--     school's director set (`advancement_settings`); until the school has set one
--     (after counsel has seen it) no gift can be recorded. Semester ships no tax
--     wording.
--   * **Portfolios.** A gift officer reads the donors assigned to them and the
--     notes they wrote; a director reads all. An alumnus reads their own giving,
--     receipts and pledges (the donor portal); anyone in the school reads a
--     campaign's goal and total, never a name.
--
-- Not here, on purpose: wealth screening and predictive donor scoring (DO-NOT-BUILD
-- rule 3), a payment processor and recurring-gift billing (a pledge is a record of
-- a promise and a schedule; the processor, when connected, writes gifts), class
-- notes, and CASE/VSE exports (the gifts table is the source for them).

-- ── Roles and capabilities ──────────────────────────────────────────────

insert into public.app_roles (role, global) values
  ('advancement_officer',  false),
  ('advancement_director', false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('adv:configure', 'Set the school''s receipt wording, and write funds and campaigns, for one school.'),
  ('adv:gift',      'Record donors, gifts, pledges and contact notes, and issue receipts with them, for one school.'),
  ('adv:refund',    'Refund a gift, never one they recorded, for one school.'),
  ('adv:read',      'Read every donor, gift, pledge, receipt and assignment, for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('advancement_director', 'adv:configure'),
  ('advancement_officer',  'adv:gift'),
  ('advancement_director', 'adv:refund'),
  ('advancement_officer',  'adv:read'),
  ('advancement_director', 'adv:read')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.advancement_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('settings', 'fund', 'campaign', 'donor', 'gift', 'refund', 'pledge', 'cancel', 'assign', 'note', 'opt_in', 'prefs')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.advancement_settings (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null references public.schools(id) on delete cascade,
  version             integer     not null check (version >= 1),
  legal_name          text        not null check (length(btrim(legal_name)) between 2 and 200),
  receipt_statement   text        not null check (length(btrim(receipt_statement)) between 20 and 4000),
  goods_services_note text        not null default '' check (length(goods_services_note) <= 1000),
  set_by              uuid        references auth.users on delete set null,
  set_at              timestamptz not null default clock_timestamp(),
  operation           text        not null,
  unique (tenant_id, version)
);

create table if not exists public.alumni_profiles (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null references public.schools(id) on delete cascade,
  user_id           uuid        not null references auth.users on delete cascade,
  display_name      text        not null check (length(btrim(display_name)) between 1 and 120),
  class_year        integer     not null check (class_year between 1900 and 2200),
  directory_visible boolean     not null default false,
  solicitable       boolean     not null default true,
  opted_in_at       timestamptz not null default clock_timestamp(),
  opted_out_at      timestamptz,
  unique (tenant_id, user_id)
);

create table if not exists public.advancement_funds (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  code        text        not null check (code ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  name        text        not null check (length(btrim(name)) between 1 and 200),
  designation text        not null check (designation in ('unrestricted', 'restricted', 'endowment')),
  created_by  uuid        references auth.users on delete set null,
  created_at  timestamptz not null default clock_timestamp(),
  unique (tenant_id, code)
);

create table if not exists public.advancement_campaigns (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  name        text        not null check (length(btrim(name)) between 1 and 200),
  kind        text        not null check (kind in ('campaign', 'giving_day')),
  goal_cents  bigint      not null check (goal_cents > 0),
  starts_on   date        not null,
  ends_on     date        not null,
  fund_id     uuid        references public.advancement_funds,
  created_by  uuid        references auth.users on delete set null,
  created_at  timestamptz not null default clock_timestamp(),
  operation   text        not null,
  constraint advancement_campaign_dates check (ends_on >= starts_on)
);

create table if not exists public.advancement_donors (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null references public.schools(id) on delete cascade,
  kind              text        not null check (kind in ('alumnus', 'parent', 'friend', 'organization')),
  display_name      text        not null check (length(btrim(display_name)) between 1 and 200),
  email             text        not null default '' check (length(email) <= 200),
  -- Cleared if the alumnus deletes their account; the school keeps its financial record of the gifts.
  alumni_profile_id uuid        references public.alumni_profiles on delete set null,
  contact_ok        boolean     not null default false,
  created_by        uuid        references auth.users on delete set null,
  created_at        timestamptz not null default clock_timestamp(),
  operation         text        not null,
  -- Only an alumnus donor ever links to a profile (the writer requires it, and a deletion clears it).
  constraint advancement_donor_alumnus check (alumni_profile_id is null or kind = 'alumnus')
);

create table if not exists public.advancement_gifts (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  donor_id     uuid        not null references public.advancement_donors,
  fund_id      uuid        not null references public.advancement_funds,
  campaign_id  uuid        references public.advancement_campaigns,
  pledge_id    uuid,
  amount_cents bigint      not null check (amount_cents > 0 and amount_cents <= 100000000000),
  received_on  date        not null,
  method       text        not null check (method in ('card', 'check', 'cash', 'wire', 'stock', 'other')),
  reference    text        not null check (length(btrim(reference)) between 3 and 120),
  tribute      text        not null default '' check (length(tribute) <= 300),
  recorded_by  uuid        references auth.users on delete set null,
  recorded_at  timestamptz not null default clock_timestamp(),
  operation    text        not null
);

create table if not exists public.advancement_pledges (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  donor_id     uuid        not null references public.advancement_donors,
  fund_id      uuid        not null references public.advancement_funds,
  campaign_id  uuid        references public.advancement_campaigns,
  amount_cents bigint      not null check (amount_cents > 0),
  schedule     text        not null check (schedule in ('one_time', 'monthly', 'quarterly', 'annual')),
  installments integer     not null check (installments between 1 and 120),
  starts_on    date        not null,
  created_by   uuid        references auth.users on delete set null,
  created_at   timestamptz not null default clock_timestamp(),
  operation    text        not null
);

create table if not exists public.advancement_pledge_cancellations (
  pledge_id    uuid        primary key references public.advancement_pledges on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  reason       text        not null check (length(btrim(reason)) between 5 and 1000),
  cancelled_by uuid        references auth.users on delete set null,
  cancelled_at timestamptz not null default clock_timestamp()
);

create table if not exists public.advancement_counters (
  tenant_id text    not null references public.schools(id) on delete cascade,
  year      integer not null,
  last      integer not null default 0,
  primary key (tenant_id, year)
);

create table if not exists public.advancement_receipts (
  gift_id      uuid        primary key references public.advancement_gifts on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  number       text        not null check (number ~ '^R-[0-9]{4}-[0-9]{6}$'),
  settings_id  uuid        not null references public.advancement_settings,
  content      jsonb       not null,
  content_hash text        not null check (content_hash ~ '^[0-9a-f]{64}$'),
  issued_at    timestamptz not null default clock_timestamp(),
  unique (tenant_id, number)
);

create table if not exists public.advancement_refunds (
  gift_id     uuid        primary key references public.advancement_gifts on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  reason      text        not null check (length(btrim(reason)) between 10 and 1000),
  reference   text        not null default '' check (length(reference) <= 120),
  refunded_by uuid        references auth.users on delete set null,
  refunded_at timestamptz not null default clock_timestamp(),
  operation   text        not null
);

create table if not exists public.advancement_assignments (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  donor_id    uuid        not null references public.advancement_donors,
  officer     uuid        references auth.users on delete set null,
  assigned_by uuid        references auth.users on delete set null,
  assigned_at timestamptz not null default clock_timestamp(),
  operation   text        not null
);

create table if not exists public.advancement_notes (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  donor_id   uuid        not null references public.advancement_donors,
  kind       text        not null check (kind in ('call', 'meeting', 'email', 'solicitation', 'stewardship')),
  note       text        not null check (length(btrim(note)) between 1 and 4000),
  author     uuid        references auth.users on delete set null,
  at         timestamptz not null default clock_timestamp(),
  operation  text        not null
);

create index if not exists advancement_operations_by_actor on public.advancement_operations (actor);
create index if not exists advancement_settings_by_setter on public.advancement_settings (set_by);
create index if not exists alumni_profiles_by_user on public.alumni_profiles (user_id);
create index if not exists advancement_funds_by_tenant on public.advancement_funds (tenant_id);
create index if not exists advancement_funds_by_creator on public.advancement_funds (created_by);
create index if not exists advancement_campaigns_by_tenant on public.advancement_campaigns (tenant_id);
create index if not exists advancement_campaigns_by_fund on public.advancement_campaigns (fund_id);
create index if not exists advancement_campaigns_by_creator on public.advancement_campaigns (created_by);
create index if not exists advancement_donors_by_tenant on public.advancement_donors (tenant_id);
create index if not exists advancement_donors_by_profile on public.advancement_donors (alumni_profile_id);
create index if not exists advancement_donors_by_creator on public.advancement_donors (created_by);
create index if not exists advancement_gifts_by_donor on public.advancement_gifts (donor_id, received_on desc);
create index if not exists advancement_gifts_by_tenant on public.advancement_gifts (tenant_id);
create index if not exists advancement_gifts_by_fund on public.advancement_gifts (fund_id);
create index if not exists advancement_gifts_by_campaign on public.advancement_gifts (campaign_id);
create index if not exists advancement_gifts_by_recorder on public.advancement_gifts (recorded_by);
create index if not exists advancement_pledges_by_donor on public.advancement_pledges (donor_id);
create index if not exists advancement_pledges_by_tenant on public.advancement_pledges (tenant_id);
create index if not exists advancement_pledges_by_fund on public.advancement_pledges (fund_id);
create index if not exists advancement_pledges_by_campaign on public.advancement_pledges (campaign_id);
create index if not exists advancement_pledges_by_creator on public.advancement_pledges (created_by);
create index if not exists advancement_pledge_cancellations_by_tenant on public.advancement_pledge_cancellations (tenant_id);
create index if not exists advancement_pledge_cancellations_by_canceller on public.advancement_pledge_cancellations (cancelled_by);
create index if not exists advancement_receipts_by_tenant on public.advancement_receipts (tenant_id);
create index if not exists advancement_receipts_by_settings on public.advancement_receipts (settings_id);
create index if not exists advancement_refunds_by_tenant on public.advancement_refunds (tenant_id);
create index if not exists advancement_refunds_by_refunder on public.advancement_refunds (refunded_by);
create index if not exists advancement_assignments_by_donor on public.advancement_assignments (donor_id, assigned_at desc);
create index if not exists advancement_assignments_by_tenant on public.advancement_assignments (tenant_id);
create index if not exists advancement_assignments_by_officer on public.advancement_assignments (officer);
create index if not exists advancement_assignments_by_assigner on public.advancement_assignments (assigned_by);
create index if not exists advancement_notes_by_donor on public.advancement_notes (donor_id, at desc);
create index if not exists advancement_notes_by_tenant on public.advancement_notes (tenant_id);
create index if not exists advancement_notes_by_author on public.advancement_notes (author);

comment on table public.advancement_operations is 'Idempotency keys the advancement writers spent, with what each asked and answered. Append-only.';
comment on table public.advancement_settings is 'The school''s legal name and receipt wording, versioned and never edited. Semester ships no tax wording.';
comment on table public.alumni_profiles is 'An alumnus who opted in at graduation: a display name, a class year and two preferences. Nothing academic. Goes with the account.';
comment on table public.advancement_funds is 'A fund gifts are designated to.';
comment on table public.advancement_campaigns is 'A campaign or a giving day, with a goal and dates.';
comment on table public.advancement_donors is 'A donor: an alumnus who opted in, a parent, a friend or an organization. Never a current student.';
comment on table public.advancement_gifts is 'A gift recorded by an officer. A record, not a payment; never rewritten.';
comment on table public.advancement_pledges is 'A promise and its schedule. A record; a processor, when connected, writes the gifts.';
comment on table public.advancement_receipts is 'The numbered receipt issued with a gift from the school''s own wording. Never rewritten.';
comment on table public.advancement_refunds is 'A refund of a gift by someone other than who recorded it.';
comment on table public.advancement_assignments is 'A donor assigned to a gift officer''s portfolio. Append-only; the latest is current.';
comment on table public.advancement_notes is 'A gift officer''s contact note on a donor. Append-only.';

-- ── Guards ──────────────────────────────────────────────────────────────

-- Everything here is append-only except an alumnus's own profile preferences;
-- only `ON DELETE SET NULL` of a person column may touch the rest.
create or replace function private.guard_advancement_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  person_col text := case tg_table_name
    when 'advancement_settings' then 'set_by'
    when 'advancement_funds' then 'created_by'
    when 'advancement_campaigns' then 'created_by'
    when 'advancement_gifts' then 'recorded_by'
    when 'advancement_pledges' then 'created_by'
    when 'advancement_pledge_cancellations' then 'cancelled_by'
    when 'advancement_refunds' then 'refunded_by'
    when 'advancement_assignments' then 'assigned_by'
    when 'advancement_notes' then 'author'
    else null end;
  was uuid;
  became uuid;
begin
  if person_col is not null then
    was := (to_jsonb(old) ->> person_col)::uuid;
    became := (to_jsonb(new) ->> person_col)::uuid;
    -- A portfolio row names an officer too; a deleted officer's account clears that column as well.
    if tg_table_name = 'advancement_assignments' then
      if (to_jsonb(new) - person_col - 'officer') is not distinct from (to_jsonb(old) - person_col - 'officer')
         and (became is null or became is not distinct from was)
         and (new.officer is null or new.officer is not distinct from old.officer) then
        return new;
      end if;
    elsif (to_jsonb(new) - person_col) is not distinct from (to_jsonb(old) - person_col) and (became is null or became is not distinct from was) then
      return new;
    end if;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_advancement_record() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['advancement_settings', 'advancement_funds', 'advancement_campaigns', 'advancement_gifts', 'advancement_pledges',
                           'advancement_pledge_cancellations', 'advancement_receipts', 'advancement_refunds', 'advancement_assignments', 'advancement_notes'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_never_rewritten', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.guard_advancement_record()', t || '_never_rewritten', t);
  end loop;
end $$;

-- A donor: who they are never changes. Contact permission can only be taken away,
-- and the profile link and the creator are cleared only by an account's deletion.
create or replace function private.guard_advancement_donor()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'contact_ok' - 'alumni_profile_id' - 'created_by') is distinct from (to_jsonb(old) - 'contact_ok' - 'alumni_profile_id' - 'created_by')
     or (new.contact_ok and not old.contact_ok)
     or (new.alumni_profile_id is not null and new.alumni_profile_id is distinct from old.alumni_profile_id)
     or (new.created_by is not null and new.created_by is distinct from old.created_by) then
    raise exception 'semester: a donor is never rewritten; contact permission is only withdrawn' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_advancement_donor() from public, anon, authenticated;
drop trigger if exists advancement_donors_guarded on public.advancement_donors;
create trigger advancement_donors_guarded before update on public.advancement_donors for each row execute function private.guard_advancement_donor();

-- A profile: who and when never change; only the two preferences and the opt-out do, and an opt-out is for good.
create or replace function private.guard_alumni_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'directory_visible' - 'solicitable' - 'opted_out_at' - 'display_name') is distinct from (to_jsonb(old) - 'directory_visible' - 'solicitable' - 'opted_out_at' - 'display_name') then
    raise exception 'semester: an alumni profile''s school, account and class year are never changed' using errcode = 'insufficient_privilege';
  end if;
  if old.opted_out_at is not null and (new.opted_out_at is distinct from old.opted_out_at or new.solicitable or new.directory_visible) then
    raise exception 'semester: an alumnus who opted out stays opted out' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_alumni_profile() from public, anon, authenticated;
drop trigger if exists alumni_profiles_guarded on public.alumni_profiles;
create trigger alumni_profiles_guarded before update on public.alumni_profiles for each row execute function private.guard_alumni_profile();

-- A refund is never by the person who recorded the gift, whatever writes it.
create or replace function private.guard_advancement_refund()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.advancement_gifts g where g.id = new.gift_id and g.recorded_by is not null and g.recorded_by = new.refunded_by) then
    raise exception 'semester: a gift is refunded by someone other than who recorded it' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_advancement_refund() from public, anon, authenticated;
drop trigger if exists advancement_refunds_not_by_recorder on public.advancement_refunds;
create trigger advancement_refunds_not_by_recorder before insert on public.advancement_refunds for each row execute function private.guard_advancement_refund();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.adv_cap(want_tenant text, want_cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability(want_cap, 'school', want_tenant);
$$;
revoke all on function private.adv_cap(text, text) from public, anon, authenticated;
grant execute on function private.adv_cap(text, text) to authenticated;

-- Staff who read the office's records: adv:read, or the gift officer's own capability.
create or replace function private.adv_staff(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.adv_cap(want_tenant, 'adv:read') or private.adv_cap(want_tenant, 'adv:gift') or private.adv_cap(want_tenant, 'adv:configure');
$$;
revoke all on function private.adv_staff(text) from public, anon, authenticated;
grant execute on function private.adv_staff(text) to authenticated;

-- A director sees every donor; an officer sees the ones assigned to them.
create or replace function private.adv_sees_donor(want_donor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.advancement_donors d where d.id = want_donor and (
    private.adv_cap(d.tenant_id, 'adv:configure') or private.adv_cap(d.tenant_id, 'adv:refund')
    or (private.adv_cap(d.tenant_id, 'adv:read') and exists (
         select 1 from public.advancement_assignments a
          where a.donor_id = d.id and a.officer = (select auth.uid())
            and a.assigned_at = (select max(b.assigned_at) from public.advancement_assignments b where b.donor_id = d.id)))));
$$;
revoke all on function private.adv_sees_donor(uuid) from public, anon, authenticated;
grant execute on function private.adv_sees_donor(uuid) to authenticated;

-- Whether the caller is the alumnus a donor record is.
create or replace function private.adv_is_donor(want_donor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.advancement_donors d join public.alumni_profiles p on p.id = d.alumni_profile_id
                  where d.id = want_donor and p.user_id = (select auth.uid()));
$$;
revoke all on function private.adv_is_donor(uuid) from public, anon, authenticated;
grant execute on function private.adv_is_donor(uuid) to authenticated;

create or replace function private.adv_member(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant);
$$;
revoke all on function private.adv_member(text) from public, anon, authenticated;
grant execute on function private.adv_member(text) to authenticated;

alter table public.advancement_operations enable row level security;
alter table public.advancement_settings enable row level security;
alter table public.alumni_profiles enable row level security;
alter table public.advancement_funds enable row level security;
alter table public.advancement_campaigns enable row level security;
alter table public.advancement_donors enable row level security;
alter table public.advancement_gifts enable row level security;
alter table public.advancement_pledges enable row level security;
alter table public.advancement_pledge_cancellations enable row level security;
alter table public.advancement_counters enable row level security;
alter table public.advancement_receipts enable row level security;
alter table public.advancement_refunds enable row level security;
alter table public.advancement_assignments enable row level security;
alter table public.advancement_notes enable row level security;

revoke all on table public.advancement_operations from public, anon, authenticated;
revoke all on table public.advancement_settings from public, anon, authenticated;
revoke all on table public.alumni_profiles from public, anon, authenticated;
revoke all on table public.advancement_funds from public, anon, authenticated;
revoke all on table public.advancement_campaigns from public, anon, authenticated;
revoke all on table public.advancement_donors from public, anon, authenticated;
revoke all on table public.advancement_gifts from public, anon, authenticated;
revoke all on table public.advancement_pledges from public, anon, authenticated;
revoke all on table public.advancement_pledge_cancellations from public, anon, authenticated;
revoke all on table public.advancement_counters from public, anon, authenticated;
revoke all on table public.advancement_receipts from public, anon, authenticated;
revoke all on table public.advancement_refunds from public, anon, authenticated;
revoke all on table public.advancement_assignments from public, anon, authenticated;
revoke all on table public.advancement_notes from public, anon, authenticated;
grant select on table public.advancement_operations to authenticated;
grant select on table public.advancement_settings to authenticated;
grant select on table public.alumni_profiles to authenticated;
grant select on table public.advancement_funds to authenticated;
grant select on table public.advancement_campaigns to authenticated;
grant select on table public.advancement_donors to authenticated;
grant select on table public.advancement_gifts to authenticated;
grant select on table public.advancement_pledges to authenticated;
grant select on table public.advancement_pledge_cancellations to authenticated;
grant select on table public.advancement_receipts to authenticated;
grant select on table public.advancement_refunds to authenticated;
grant select on table public.advancement_assignments to authenticated;
grant select on table public.advancement_notes to authenticated;

drop policy if exists "callers read their own advancement operations" on public.advancement_operations;
create policy "callers read their own advancement operations" on public.advancement_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "staff read the receipt wording" on public.advancement_settings;
create policy "staff read the receipt wording" on public.advancement_settings
  for select to authenticated using (private.adv_staff(tenant_id));

-- An alumnus reads their own profile; staff read the profiles of alumni who opted in (every row is one).
drop policy if exists "alumni read their own profile, staff read profiles" on public.alumni_profiles;
create policy "alumni read their own profile, staff read profiles" on public.alumni_profiles
  for select to authenticated using (user_id = (select auth.uid()) or private.adv_staff(tenant_id));

drop policy if exists "school members read funds" on public.advancement_funds;
create policy "school members read funds" on public.advancement_funds
  for select to authenticated using (private.adv_member(tenant_id));

drop policy if exists "school members read campaigns" on public.advancement_campaigns;
create policy "school members read campaigns" on public.advancement_campaigns
  for select to authenticated using (private.adv_member(tenant_id));

drop policy if exists "directors, assigned officers and the alumnus read a donor" on public.advancement_donors;
create policy "directors, assigned officers and the alumnus read a donor" on public.advancement_donors
  for select to authenticated using (private.adv_sees_donor(id) or private.adv_is_donor(id));

drop policy if exists "whoever reads the donor reads their gifts" on public.advancement_gifts;
create policy "whoever reads the donor reads their gifts" on public.advancement_gifts
  for select to authenticated using (private.adv_sees_donor(donor_id) or private.adv_is_donor(donor_id) or recorded_by = (select auth.uid()));

drop policy if exists "whoever reads the donor reads their pledges" on public.advancement_pledges;
create policy "whoever reads the donor reads their pledges" on public.advancement_pledges
  for select to authenticated using (private.adv_sees_donor(donor_id) or private.adv_is_donor(donor_id) or created_by = (select auth.uid()));

drop policy if exists "whoever reads the pledge reads its cancellation" on public.advancement_pledge_cancellations;
create policy "whoever reads the pledge reads its cancellation" on public.advancement_pledge_cancellations
  for select to authenticated using (exists (select 1 from public.advancement_pledges p where p.id = pledge_id));

drop policy if exists "whoever reads the gift reads its receipt" on public.advancement_receipts;
create policy "whoever reads the gift reads its receipt" on public.advancement_receipts
  for select to authenticated using (exists (select 1 from public.advancement_gifts g where g.id = gift_id));

drop policy if exists "whoever reads the gift reads its refund" on public.advancement_refunds;
create policy "whoever reads the gift reads its refund" on public.advancement_refunds
  for select to authenticated using (exists (select 1 from public.advancement_gifts g where g.id = gift_id));

drop policy if exists "directors and the officer read assignments" on public.advancement_assignments;
create policy "directors and the officer read assignments" on public.advancement_assignments
  for select to authenticated using (officer = (select auth.uid()) or private.adv_cap(tenant_id, 'adv:configure') or private.adv_cap(tenant_id, 'adv:refund'));

drop policy if exists "directors and the author read notes" on public.advancement_notes;
create policy "directors and the author read notes" on public.advancement_notes
  for select to authenticated using (author = (select auth.uid()) or private.adv_cap(tenant_id, 'adv:configure') or private.adv_cap(tenant_id, 'adv:refund'));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.adv_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.advancement_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('adv-op:' || school || ':' || want_key));
  select * into op from public.advancement_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.adv_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.adv_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.advancement_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.adv_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.adv_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'advancement') then
    raise exception 'semester: this school does not run advancement in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.adv_core_required(text) from public, anon, authenticated;

create or replace function private.adv_require(school text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'school', school) then
    raise exception 'semester: that needs % at this school', want_cap using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.adv_require(text, text) from public, anon, authenticated;

-- ── The alumnus's own acts ──────────────────────────────────────────────

-- Opting in at graduation: the caller's account is linked to a record with a conferral.
create or replace function public.alumni_opt_in(want_display_name text, want_class_year integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('name', want_display_name, 'class_year', want_class_year);
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  prior := private.adv_replay(school, want_key, 'opt_in', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  if not exists (
    select 1 from public.academic_record_subjects s
      join public.academic_record_entries e on e.tenant_id = s.tenant_id and e.student_ref = s.student_ref and e.kind = 'conferral' and e.action = 'set' and e.effective_on <= current_date
     where s.tenant_id = school and s.user_id = me) then
    raise exception 'semester: alumni status follows a conferred degree on your record' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.alumni_profiles p where p.tenant_id = school and p.user_id = me) then
    raise exception 'semester: you have already opted in' using errcode = 'check_violation';
  end if;
  insert into public.alumni_profiles (tenant_id, user_id, display_name, class_year) values (school, me, btrim(want_display_name), want_class_year) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'opt_in', req, result);
  return result;
end $$;

-- Directory visibility and whether the school may solicit; opting out is for good.
create or replace function public.alumni_preferences(want_directory boolean, want_solicitable boolean, want_opt_out boolean, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('directory', want_directory, 'solicitable', want_solicitable, 'opt_out', coalesce(want_opt_out, false));
  prior  jsonb;
  p      public.alumni_profiles;
  result jsonb;
begin
  prior := private.adv_replay(school, want_key, 'prefs', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  select * into p from public.alumni_profiles x where x.tenant_id = school and x.user_id = me for update;
  if p.id is null then raise exception 'semester: you have not opted in as an alumnus' using errcode = 'no_data_found'; end if;
  if p.opted_out_at is not null then raise exception 'semester: you opted out; that stays' using errcode = 'check_violation'; end if;
  if coalesce(want_opt_out, false) then
    update public.alumni_profiles set directory_visible = false, solicitable = false, opted_out_at = clock_timestamp() where id = p.id;
    update public.advancement_donors set contact_ok = false where alumni_profile_id = p.id;
  else
    update public.alumni_profiles set directory_visible = coalesce(want_directory, p.directory_visible), solicitable = coalesce(want_solicitable, p.solicitable) where id = p.id;
    if not coalesce(want_solicitable, p.solicitable) then update public.advancement_donors set contact_ok = false where alumni_profile_id = p.id; end if;
  end if;
  result := jsonb_build_object('opted_out', coalesce(want_opt_out, false));
  perform private.adv_spend(school, want_key, 'prefs', req, result);
  return result;
end $$;

-- ── The director's writers ──────────────────────────────────────────────

create or replace function public.adv_settings_set(want_legal_name text, want_statement text, want_goods_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('legal_name', want_legal_name, 'statement', want_statement, 'goods', coalesce(want_goods_note, ''));
  prior  jsonb;
  v      integer;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:configure');
  prior := private.adv_replay(school, want_key, 'settings', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  perform pg_advisory_xact_lock(hashtext('adv-settings:' || school));
  select coalesce(max(s.version), 0) + 1 into v from public.advancement_settings s where s.tenant_id = school;
  insert into public.advancement_settings (tenant_id, version, legal_name, receipt_statement, goods_services_note, set_by, operation)
  values (school, v, btrim(want_legal_name), btrim(want_statement), btrim(coalesce(want_goods_note, '')), me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'version', v);
  perform private.adv_spend(school, want_key, 'settings', req, result);
  return result;
end $$;

create or replace function public.adv_fund_save(want_code text, want_name text, want_designation text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('code', upper(btrim(coalesce(want_code, ''))), 'name', want_name, 'designation', want_designation);
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:configure');
  prior := private.adv_replay(school, want_key, 'fund', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  insert into public.advancement_funds (tenant_id, code, name, designation, created_by) values (school, upper(btrim(want_code)), btrim(want_name), want_designation, me) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'fund', req, result);
  return result;
end $$;

create or replace function public.adv_campaign_save(want_name text, want_kind text, want_goal_cents bigint, want_starts date, want_ends date, want_fund text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('name', want_name, 'kind', want_kind, 'goal', want_goal_cents, 'starts', want_starts, 'ends', want_ends, 'fund', coalesce(want_fund, ''));
  prior  jsonb;
  fid    uuid;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:configure');
  prior := private.adv_replay(school, want_key, 'campaign', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  if coalesce(btrim(want_fund), '') <> '' then
    select f.id into fid from public.advancement_funds f where f.tenant_id = school and f.code = upper(btrim(want_fund));
    if fid is null then raise exception 'semester: no such fund' using errcode = 'no_data_found'; end if;
  end if;
  insert into public.advancement_campaigns (tenant_id, name, kind, goal_cents, starts_on, ends_on, fund_id, created_by, operation)
  values (school, btrim(want_name), want_kind, want_goal_cents, want_starts, want_ends, fid, me, want_key) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'campaign', req, result);
  return result;
end $$;

-- ── The gift office's writers ───────────────────────────────────────────

create or replace function public.adv_donor_save(want_kind text, want_name text, want_email text, want_profile uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('kind', want_kind, 'name', want_name, 'email', coalesce(want_email, ''), 'profile', want_profile);
  prior  jsonb;
  p      public.alumni_profiles;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:gift');
  prior := private.adv_replay(school, want_key, 'donor', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  if want_kind = 'alumnus' then
    select * into p from public.alumni_profiles x where x.id = want_profile and x.tenant_id = school;
    if p.id is null then raise exception 'semester: an alumnus donor is an alumnus who opted in' using errcode = 'check_violation'; end if;
    if p.opted_out_at is not null then raise exception 'semester: that alumnus opted out and is not recorded as a constituent' using errcode = 'check_violation'; end if;
  elsif want_profile is not null then
    raise exception 'semester: only an alumnus donor links to an alumni profile' using errcode = 'check_violation';
  end if;
  insert into public.advancement_donors (tenant_id, kind, display_name, email, alumni_profile_id, contact_ok, created_by, operation)
  values (school, want_kind, btrim(want_name), btrim(coalesce(want_email, '')), case when want_kind = 'alumnus' then want_profile end,
          case when want_kind = 'alumnus' then coalesce(p.solicitable, false) else false end, me, want_key) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'donor', req, result);
  return result;
end $$;

-- Records a gift and issues its receipt, together. A school without receipt wording
-- records none.
create or replace function public.adv_gift_record(
  want_donor uuid, want_fund text, want_campaign uuid, want_pledge uuid, want_amount_cents bigint, want_received date, want_method text,
  want_reference text, want_tribute text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('donor', want_donor, 'fund', upper(btrim(coalesce(want_fund, ''))), 'campaign', want_campaign, 'pledge', want_pledge,
                    'amount', want_amount_cents, 'received', want_received, 'method', want_method, 'reference', coalesce(want_reference, ''), 'tribute', coalesce(want_tribute, ''));
  prior  jsonb;
  d      public.advancement_donors;
  fid    uuid;
  st     public.advancement_settings;
  yr     integer := extract(year from want_received)::integer;
  n      integer;
  made   uuid;
  num    text;
  body   jsonb;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:gift');
  prior := private.adv_replay(school, want_key, 'gift', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  select * into d from public.advancement_donors x where x.id = want_donor and x.tenant_id = school;
  if d.id is null then raise exception 'semester: no such donor' using errcode = 'no_data_found'; end if;
  select f.id into fid from public.advancement_funds f where f.tenant_id = school and f.code = upper(btrim(want_fund));
  if fid is null then raise exception 'semester: no such fund' using errcode = 'no_data_found'; end if;
  select * into st from public.advancement_settings s where s.tenant_id = school order by s.version desc limit 1;
  if st.id is null then
    raise exception 'semester: this school has not set its receipt wording; no gift is recorded until it has' using errcode = 'check_violation';
  end if;
  if want_campaign is not null and not exists (select 1 from public.advancement_campaigns c where c.id = want_campaign and c.tenant_id = school) then
    raise exception 'semester: no such campaign' using errcode = 'no_data_found';
  end if;
  if want_pledge is not null and not exists (select 1 from public.advancement_pledges p where p.id = want_pledge and p.tenant_id = school and p.donor_id = want_donor) then
    raise exception 'semester: that pledge is not this donor''s' using errcode = 'check_violation';
  end if;
  if want_received > current_date then raise exception 'semester: a gift is recorded when it is received' using errcode = 'check_violation'; end if;

  insert into public.advancement_gifts (tenant_id, donor_id, fund_id, campaign_id, pledge_id, amount_cents, received_on, method, reference, tribute, recorded_by, operation)
  values (school, want_donor, fid, want_campaign, want_pledge, want_amount_cents, want_received, want_method, btrim(coalesce(want_reference, '')), btrim(coalesce(want_tribute, '')), me, want_key)
  returning id into made;

  insert into public.advancement_counters (tenant_id, year, last) values (school, yr, 1)
  on conflict (tenant_id, year) do update set last = public.advancement_counters.last + 1 returning last into n;
  num := 'R-' || yr || '-' || lpad(n::text, 6, '0');
  body := jsonb_build_object('number', num, 'institution', st.legal_name, 'donor', d.display_name, 'amount_cents', want_amount_cents,
                             'received_on', want_received, 'fund', upper(btrim(want_fund)), 'statement', st.receipt_statement, 'goods_services', st.goods_services_note);
  insert into public.advancement_receipts (gift_id, tenant_id, number, settings_id, content, content_hash)
  values (made, school, num, st.id, body, encode(sha256(convert_to(body::text, 'UTF8')), 'hex'));
  result := jsonb_build_object('id', made, 'receipt', num);
  perform private.adv_spend(school, want_key, 'gift', req, result);
  return result;
end $$;

create or replace function public.adv_gift_refund(want_gift uuid, want_reason text, want_reference text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('gift', want_gift, 'reason', coalesce(want_reason, ''), 'reference', coalesce(want_reference, ''));
  prior  jsonb;
  g      public.advancement_gifts;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:refund');
  prior := private.adv_replay(school, want_key, 'refund', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  select * into g from public.advancement_gifts x where x.id = want_gift and x.tenant_id = school for update;
  if g.id is null then raise exception 'semester: no such gift' using errcode = 'no_data_found'; end if;
  if g.recorded_by is not distinct from me then raise exception 'semester: a gift is refunded by someone other than who recorded it' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from public.advancement_refunds r where r.gift_id = want_gift) then raise exception 'semester: that gift is already refunded' using errcode = 'check_violation'; end if;
  insert into public.advancement_refunds (gift_id, tenant_id, reason, reference, refunded_by, operation) values (want_gift, school, btrim(coalesce(want_reason, '')), btrim(coalesce(want_reference, '')), me, want_key);
  result := jsonb_build_object('gift', want_gift, 'refunded', true);
  perform private.adv_spend(school, want_key, 'refund', req, result);
  return result;
end $$;

create or replace function public.adv_pledge_save(
  want_donor uuid, want_fund text, want_campaign uuid, want_amount_cents bigint, want_schedule text, want_installments integer, want_starts date, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('donor', want_donor, 'fund', upper(btrim(coalesce(want_fund, ''))), 'campaign', want_campaign, 'amount', want_amount_cents,
                    'schedule', want_schedule, 'installments', want_installments, 'starts', want_starts);
  prior  jsonb;
  fid    uuid;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:gift');
  prior := private.adv_replay(school, want_key, 'pledge', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  if not exists (select 1 from public.advancement_donors d where d.id = want_donor and d.tenant_id = school) then raise exception 'semester: no such donor' using errcode = 'no_data_found'; end if;
  select f.id into fid from public.advancement_funds f where f.tenant_id = school and f.code = upper(btrim(want_fund));
  if fid is null then raise exception 'semester: no such fund' using errcode = 'no_data_found'; end if;
  if want_schedule = 'one_time' and want_installments <> 1 then raise exception 'semester: a one-time pledge has one installment' using errcode = 'check_violation'; end if;
  insert into public.advancement_pledges (tenant_id, donor_id, fund_id, campaign_id, amount_cents, schedule, installments, starts_on, created_by, operation)
  values (school, want_donor, fid, want_campaign, want_amount_cents, want_schedule, want_installments, want_starts, me, want_key) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'pledge', req, result);
  return result;
end $$;

create or replace function public.adv_pledge_cancel(want_pledge uuid, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('pledge', want_pledge, 'reason', coalesce(want_reason, ''));
  prior  jsonb;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:gift');
  prior := private.adv_replay(school, want_key, 'cancel', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  if not exists (select 1 from public.advancement_pledges p where p.id = want_pledge and p.tenant_id = school) then raise exception 'semester: no such pledge' using errcode = 'no_data_found'; end if;
  if exists (select 1 from public.advancement_pledge_cancellations c where c.pledge_id = want_pledge) then raise exception 'semester: that pledge is already cancelled' using errcode = 'check_violation'; end if;
  insert into public.advancement_pledge_cancellations (pledge_id, tenant_id, reason, cancelled_by) values (want_pledge, school, btrim(coalesce(want_reason, '')), me);
  result := jsonb_build_object('pledge', want_pledge, 'cancelled', true);
  perform private.adv_spend(school, want_key, 'cancel', req, result);
  return result;
end $$;

-- A director assigns a donor to an officer's portfolio.
create or replace function public.adv_assign(want_donor uuid, want_officer uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('donor', want_donor, 'officer', want_officer);
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:configure');
  prior := private.adv_replay(school, want_key, 'assign', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  if not exists (select 1 from public.advancement_donors d where d.id = want_donor and d.tenant_id = school) then raise exception 'semester: no such donor' using errcode = 'no_data_found'; end if;
  if not private.subject_has_capability(want_officer, 'adv:gift', 'school', school) then
    raise exception 'semester: that person is not a gift officer at this school' using errcode = 'check_violation';
  end if;
  insert into public.advancement_assignments (tenant_id, donor_id, officer, assigned_by, operation) values (school, want_donor, want_officer, me, want_key) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'assign', req, result);
  return result;
end $$;

-- A contact note, on a donor in the caller's portfolio. A solicitation is refused for a donor who is not solicitable.
create or replace function public.adv_note_add(want_donor uuid, want_kind text, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('donor', want_donor, 'kind', want_kind, 'note', want_note);
  prior  jsonb;
  d      public.advancement_donors;
  made   uuid;
  result jsonb;
begin
  perform private.adv_require(school, 'adv:gift');
  prior := private.adv_replay(school, want_key, 'note', req);
  if prior is not null then return prior; end if;
  perform private.adv_core_required(school);
  select * into d from public.advancement_donors x where x.id = want_donor and x.tenant_id = school;
  if d.id is null or not private.adv_sees_donor(want_donor) then raise exception 'semester: that donor is not in your portfolio' using errcode = 'insufficient_privilege'; end if;
  if want_kind = 'solicitation' and not d.contact_ok then
    raise exception 'semester: this donor may not be solicited' using errcode = 'check_violation';
  end if;
  insert into public.advancement_notes (tenant_id, donor_id, kind, note, author, operation) values (school, want_donor, want_kind, btrim(want_note), me, want_key) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.adv_spend(school, want_key, 'note', req, result);
  return result;
end $$;

-- A campaign's goal and what it has raised, for anyone in the school. No one is named.
create or replace function public.adv_campaign_progress(want_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  c      public.advancement_campaigns;
begin
  select * into c from public.advancement_campaigns x where x.id = want_campaign and x.tenant_id = school;
  if c.id is null then raise exception 'semester: no such campaign' using errcode = 'no_data_found'; end if;
  return jsonb_build_object('goal_cents', c.goal_cents,
    'raised_cents', coalesce((select sum(g.amount_cents) from public.advancement_gifts g where g.campaign_id = c.id
                               and not exists (select 1 from public.advancement_refunds r where r.gift_id = g.id)), 0),
    'gifts', (select count(*) from public.advancement_gifts g where g.campaign_id = c.id and not exists (select 1 from public.advancement_refunds r where r.gift_id = g.id)));
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────

revoke all on function public.alumni_opt_in(text, integer, text) from public, anon;
revoke all on function public.alumni_preferences(boolean, boolean, boolean, text) from public, anon;
revoke all on function public.adv_settings_set(text, text, text, text) from public, anon;
revoke all on function public.adv_fund_save(text, text, text, text) from public, anon;
revoke all on function public.adv_campaign_save(text, text, bigint, date, date, text, text) from public, anon;
revoke all on function public.adv_donor_save(text, text, text, uuid, text) from public, anon;
revoke all on function public.adv_gift_record(uuid, text, uuid, uuid, bigint, date, text, text, text, text) from public, anon;
revoke all on function public.adv_gift_refund(uuid, text, text, text) from public, anon;
revoke all on function public.adv_pledge_save(uuid, text, uuid, bigint, text, integer, date, text) from public, anon;
revoke all on function public.adv_pledge_cancel(uuid, text, text) from public, anon;
revoke all on function public.adv_assign(uuid, uuid, text) from public, anon;
revoke all on function public.adv_note_add(uuid, text, text, text) from public, anon;
revoke all on function public.adv_campaign_progress(uuid) from public, anon;
grant execute on function public.alumni_opt_in(text, integer, text) to authenticated;
grant execute on function public.alumni_preferences(boolean, boolean, boolean, text) to authenticated;
grant execute on function public.adv_settings_set(text, text, text, text) to authenticated;
grant execute on function public.adv_fund_save(text, text, text, text) to authenticated;
grant execute on function public.adv_campaign_save(text, text, bigint, date, date, text, text) to authenticated;
grant execute on function public.adv_donor_save(text, text, text, uuid, text) to authenticated;
grant execute on function public.adv_gift_record(uuid, text, uuid, uuid, bigint, date, text, text, text, text) to authenticated;
grant execute on function public.adv_gift_refund(uuid, text, text, text) to authenticated;
grant execute on function public.adv_pledge_save(uuid, text, uuid, bigint, text, integer, date, text) to authenticated;
grant execute on function public.adv_pledge_cancel(uuid, text, text) to authenticated;
grant execute on function public.adv_assign(uuid, uuid, text) to authenticated;
grant execute on function public.adv_note_add(uuid, text, text, text) to authenticated;
grant execute on function public.adv_campaign_progress(uuid) to authenticated;

-- ── An account that opted in as an alumnus is not untouched ─────────────
--
-- The previous definition is `20261001090000_events.sql`, with one more place to
-- look; an alumni profile goes with the account.

create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id'),
      ('public.help_requests',        'student_id'),
      ('public.mentor_requests',      'requester'),
      ('public.mentor_requests',      'recipient'),
      ('public.peer_mentor_offers',   'user_id'),
      ('public.alumni_mentor_offers', 'user_id'),
      ('public.community_posts',      'author_id'),
      ('public.community_sessions',   'host_id'),
      ('public.community_session_participants', 'user_id'),
      ('public.community_mutes',      'user_id'),
      ('public.community_members',    'user_id'),
      ('public.community_aliases',    'user_id'),
      ('public.community_volunteers', 'user_id'),
      ('public.community_media',      'uploader_id'),
      ('public.graduation_scenarios', 'user_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id'),
      ('public.family_invites',       'student_id'),
      ('public.family_shared_items',  'student_id'),
      ('public.family_access_events', 'student_id'),
      ('public.support_shares',       'student_id'),
      ('public.support_shares',       'staff_id'),
      ('public.registration_enrollments', 'student'),
      ('public.regrade_requests',     'student_id'),
      ('public.dining_orders',        'student'),
      ('public.submissions',          'student_id'),
      ('public.submission_receipts',  'student_id'),
      ('public.assignment_overrides', 'student_id'),
      ('public.attendance_marks',     'student_id'),
      -- 20261001030000: a student's test attempts and any extra time granted.
      ('public.assessment_attempts',  'student_id'),
      ('public.assessment_time_extensions', 'student_id'),
      -- 20261001060000: an application is the applicant's own.
      ('public.applications',         'applicant'),
      -- 20261001080000: a booking is its requester's own.
      ('public.space_bookings',       'requester'),
      -- 20261001090000: an event is its proposer's; an RSVP is its member's.
      ('public.campus_events',        'proposer'),
      ('public.event_rsvps',          'member'),
      -- 20261001100000: an alumni profile is the alumnus's own.
      ('public.alumni_profiles',      'user_id')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid)
  from anon, authenticated;
