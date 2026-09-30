-- Semester — alumni profiles and the three consents an alum gives (ADV-001).
--
-- Safe to run again.
--
-- ## The decision
--
-- The owner asked for alumni relations and fundraising to be built out. This
-- is the foundation and nothing that touches money: a school's staff record
-- that someone graduated, and the graduate decides, separately and with
-- nothing pre-ticked, whether the school may send alumni news, may contact
-- them about giving, and may list them in an alumni directory.
--
-- ## The lines this holds
--
-- - **Nobody is solicited without asking.** Fundraising contact is a consent
--   the alum gives themselves, and withdrawing it is one update that takes
--   effect at once. `private.fundraising_reachable` is the only answer to
--   "may the school contact this person about giving", and it is false
--   without a live consent.
-- - **No current student's record reaches advancement** (DO-NOT-BUILD rule
--   13). These tables name no enrolment, course, plan or study table, and
--   `donotbuild.test.ts` fails if an advancement migration ever does.
-- - **No minor is asked for money.** Fundraising contact needs an account
--   that has stated it is 18 or over (`private.age_cleared`, D-139).
-- - **Consent history is kept as written.** Every give and withdraw is a row
--   nobody rewrites.

insert into public.app_capabilities (capability, about) values
  ('alumni:manage', 'Record the graduates of one school, and read the consents they have given it.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('university_admin', 'alumni:manage'),
  ('university_staff', 'alumni:manage')
on conflict do nothing;

-- ── Alumni profiles ─────────────────────────────────────────────────────────

create table if not exists public.alumni_profiles (
  user_id          uuid        not null references auth.users on delete cascade,
  school_id        text        not null references public.schools on delete cascade,
  -- As the school writes it: '2026-spring', '2027-fall', '2026'.
  graduation_term  text        not null check (graduation_term ~ '^[0-9]{4}(-(spring|summer|fall|winter))?$'),
  credential       text        not null default '' check (length(credential) <= 120),
  preferred_name   text        not null default '' check (length(preferred_name) <= 80),
  recorded_by      uuid        references auth.users on delete set null,
  recorded_at      timestamptz not null default now(),
  primary key (user_id, school_id)
);
alter table public.alumni_profiles enable row level security;
create index if not exists alumni_profiles_by_school on public.alumni_profiles (school_id);
create index if not exists alumni_profiles_by_recorder on public.alumni_profiles (recorded_by);

-- ── Consents ────────────────────────────────────────────────────────────────

create table if not exists public.alumni_consents (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  school_id       text        not null references public.schools on delete cascade,
  kind            text        not null check (kind in ('alumni_communications', 'fundraising_contact', 'directory_listing')),
  -- The version of the words the alum was shown when they said yes.
  wording_version text        not null check (wording_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  given_at        timestamptz not null default now(),
  withdrawn_at    timestamptz,
  foreign key (user_id, school_id) references public.alumni_profiles (user_id, school_id) on delete cascade
);
alter table public.alumni_consents enable row level security;
create unique index if not exists alumni_consents_one_live
  on public.alumni_consents (user_id, school_id, kind) where withdrawn_at is null;
create index if not exists alumni_consents_by_school on public.alumni_consents (school_id, kind);
create index if not exists alumni_consents_by_alum on public.alumni_consents (user_id, school_id);

create table if not exists public.alumni_consent_history (
  id          bigint      generated always as identity primary key,
  consent_id  uuid        not null,
  -- Goes with the alum's account, like the consents it records.
  user_id     uuid        not null references auth.users on delete cascade,
  school_id   text        not null,
  kind        text        not null,
  action      text        not null check (action in ('given', 'withdrawn')),
  wording_version text    not null,
  at          timestamptz not null default now()
);
alter table public.alumni_consent_history enable row level security;
create index if not exists alumni_consent_history_by_user on public.alumni_consent_history (user_id);

-- ── Rules ───────────────────────────────────────────────────────────────────

create or replace function private.alumni_profile_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.school_id <> old.school_id) then
    raise exception 'semester: an alumni profile belongs to one person at one school' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    new.recorded_by := (select auth.uid());
    new.recorded_at := now();
  else
    new.recorded_by := old.recorded_by;
    new.recorded_at := old.recorded_at;
  end if;
  return new;
end $$;
revoke all on function private.alumni_profile_rules() from public;

drop trigger if exists alumni_profile_rules on public.alumni_profiles;
create trigger alumni_profile_rules
  before insert or update on public.alumni_profiles
  for each row execute function private.alumni_profile_rules();

-- A consent is given as it is, and the only change it can take is to be
-- withdrawn, once.
create or replace function private.alumni_consent_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'fundraising_contact' and not private.age_cleared(new.user_id) then
      raise exception 'semester: fundraising contact needs an adult who has stated their age' using errcode = 'check_violation';
    end if;
    new.given_at := now();
    new.withdrawn_at := null;
    return new;
  end if;
  if old.withdrawn_at is not null then
    raise exception 'semester: a withdrawn consent stays withdrawn; give a new one' using errcode = 'check_violation';
  end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.school_id <> old.school_id
     or new.kind <> old.kind or new.wording_version <> old.wording_version or new.given_at <> old.given_at
     or new.withdrawn_at is null then
    raise exception 'semester: a consent can only be withdrawn' using errcode = 'check_violation';
  end if;
  new.withdrawn_at := now();
  return new;
end $$;
revoke all on function private.alumni_consent_rules() from public;

drop trigger if exists alumni_consent_rules on public.alumni_consents;
create trigger alumni_consent_rules
  before insert or update on public.alumni_consents
  for each row execute function private.alumni_consent_rules();

create or replace function private.record_alumni_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.alumni_consent_history (consent_id, user_id, school_id, kind, action, wording_version)
  values (new.id, new.user_id, new.school_id, new.kind,
          case when tg_op = 'INSERT' then 'given' else 'withdrawn' end,
          new.wording_version);
  return null;
end $$;
revoke all on function private.record_alumni_consent() from public;

drop trigger if exists alumni_consent_history on public.alumni_consents;
create trigger alumni_consent_history
  after insert or update on public.alumni_consents
  for each row execute function private.record_alumni_consent();

create or replace function private.refuse_alumni_history_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The one removal allowed: the alum's account is being deleted, and the
  -- cascade is taking their history with it.
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception 'semester: alumni consent history is kept as written' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.refuse_alumni_history_change() from public;

drop trigger if exists alumni_consent_history_is_kept on public.alumni_consent_history;
create trigger alumni_consent_history_is_kept
  before update or delete on public.alumni_consent_history
  for each row execute function private.refuse_alumni_history_change();

-- ── The one answer fundraising may ask ──────────────────────────────────────

create or replace function private.fundraising_reachable(who uuid, school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null
     and private.age_cleared(who)
     and exists (
       select 1 from public.alumni_consents c
        where c.user_id = who and c.school_id = school
          and c.kind = 'fundraising_contact' and c.withdrawn_at is null
     );
$$;
revoke all on function private.fundraising_reachable(uuid, text) from public;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on table public.alumni_profiles, public.alumni_consents, public.alumni_consent_history
  from anon, authenticated;
grant select, insert, update on table public.alumni_profiles to authenticated;
grant select, insert, update on table public.alumni_consents to authenticated;
grant select on table public.alumni_consent_history to authenticated;

-- ── Policies ────────────────────────────────────────────────────────────────

-- The alum reads their own profile; the school's staff record and read theirs.
drop policy if exists "an alum reads their own profile" on public.alumni_profiles;
create policy "an alum reads their own profile" on public.alumni_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "school staff read alumni" on public.alumni_profiles;
create policy "school staff read alumni" on public.alumni_profiles
  for select to authenticated
  using (private.has_capability('alumni:manage', 'school', school_id));

drop policy if exists "school staff record alumni" on public.alumni_profiles;
create policy "school staff record alumni" on public.alumni_profiles
  for insert to authenticated
  with check (private.has_capability('alumni:manage', 'school', school_id)
              and user_id <> (select auth.uid()));

drop policy if exists "school staff correct alumni" on public.alumni_profiles;
create policy "school staff correct alumni" on public.alumni_profiles
  for update to authenticated
  using (private.has_capability('alumni:manage', 'school', school_id))
  with check (private.has_capability('alumni:manage', 'school', school_id));

-- Only the alum gives or withdraws a consent. Staff read them; they cannot
-- give one on the alum's behalf.
drop policy if exists "an alum reads their own consents" on public.alumni_consents;
create policy "an alum reads their own consents" on public.alumni_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "school staff read consents" on public.alumni_consents;
create policy "school staff read consents" on public.alumni_consents
  for select to authenticated
  using (private.has_capability('alumni:manage', 'school', school_id));

drop policy if exists "an alum gives their own consent" on public.alumni_consents;
create policy "an alum gives their own consent" on public.alumni_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "an alum withdraws their own consent" on public.alumni_consents;
create policy "an alum withdraws their own consent" on public.alumni_consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "an alum and school staff read consent history" on public.alumni_consent_history;
create policy "an alum and school staff read consent history" on public.alumni_consent_history
  for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_capability('alumni:manage', 'school', school_id));
