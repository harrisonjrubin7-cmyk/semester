-- Semester — privacy-safe course demand forecasting (Phase K, DECISION-LOG D-051).
--
-- `20260926150000_expansion_roles_and_features.sql` made the pieces:
-- `term_plan_courses` with a per-row `contributes_to_demand` flag (default
-- off), `course_demand_snapshots` whose check constraints refuse a count
-- below ten, `private.refresh_course_demand`, and `demand:read` for the
-- registrar, department chairs, deans and institutional research. Nothing in
-- the app wrote to or read any of it. This finishes it:
--
--   * **Consent is a record, not a flag.** `demand_consents` holds when a
--     student chose to contribute for a term, and when they stopped. The
--     refresh counts a row only while its owner's consent for that term is
--     live, so a flag set some other way counts for nothing.
--   * **Contributing goes through one function.** `contribute_course_plan`
--     replaces the student's contributed rows for the term with course codes
--     and primary/backup — no section, no time, no instructor — at the
--     school on their profile. A student cannot file demand at another school.
--   * **Stopping is prospective.** `stop_contributing` deletes the rows and
--     stamps the consent. Counts already published keep them until the next
--     refresh, and no refresh after that counts them.
--   * **Staff read counts, never rows.** `course_demand` returns the
--     snapshot rows the caller's `demand:read` scope allows — the school, or
--     one department — with section capacity and waitlist where the registrar
--     has synced them. No function returns a user id, a plan, or a count
--     below ten.
--   * **The refresh is a scaffold.** `refresh_course_demand_snapshots` is
--     callable by the service role only, and nothing schedules it.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Consent ────────────────────────────────────────────────────────────

create table if not exists public.demand_consents (
  user_id      uuid        not null references auth.users on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  term_code    text        not null check (length(trim(term_code)) between 1 and 40),
  consented_at timestamptz not null default now(),
  revoked_at   timestamptz,
  primary key (user_id, term_code),
  constraint demand_consent_order check (revoked_at is null or revoked_at >= consented_at)
);
create index if not exists demand_consents_by_tenant on public.demand_consents (tenant_id, term_code);
alter table public.demand_consents enable row level security;
revoke all on table public.demand_consents from anon, authenticated;
grant select on table public.demand_consents to authenticated;
-- The student reads their own. Writes go through the two functions below;
-- no staff policy exists on this table.
drop policy if exists "a student reads their own consent" on public.demand_consents;
create policy "a student reads their own consent" on public.demand_consents
  for select using (user_id = (select auth.uid()));

-- ── 2. A contributed row counts only at the student's own school ──────────

-- The owner policy from 20260926150000 checked the owner and nothing else,
-- so a direct insert could file a contributing row at any school. A row that
-- contributes must now be at the school on the student's profile.
drop policy if exists "a student owns their term plan" on public.term_plan_courses;
create policy "a student owns their term plan" on public.term_plan_courses
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (not contributes_to_demand or tenant_id = (select private.school_of()))
  );

-- ── 3. The student's two functions ────────────────────────────────────────

-- Replaces the caller's contributed plan for one term. `want_courses` is a
-- JSON array of {"course": "ECON 1010", "role": "primary"} or
-- {"course": "ECON 1020", "role": "backup", "rank": 1}; at most thirty.
create or replace function public.contribute_course_plan(want_term text, want_courses jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := (select private.school_of());
  item   jsonb;
  code   text;
  kind   text;
  n      integer := 0;
begin
  if me is null then
    raise exception 'Sign in to contribute.' using errcode = '42501';
  end if;
  if school is null then
    raise exception 'Set your school on your profile to contribute.';
  end if;
  if want_term is null or length(trim(want_term)) not between 1 and 40 then
    raise exception 'Choose a term.';
  end if;
  if jsonb_typeof(want_courses) <> 'array' or jsonb_array_length(want_courses) not between 1 and 30 then
    raise exception 'Contribute between one and thirty courses.';
  end if;

  delete from public.term_plan_courses
   where user_id = me and term_code = trim(want_term) and contributes_to_demand;

  for item in select * from jsonb_array_elements(want_courses) loop
    -- "econ1010" is stored as "ECON 1010": the department scope splits on the space.
    code := regexp_replace(regexp_replace(upper(trim(item ->> 'course')), '\s+', ' ', 'g'), '^([A-Z&]+) ?([0-9])', '\1 \2');
    kind := item ->> 'role';
    if code is null or code !~ '^[A-Z&]{2,8} ?[0-9]{3,4}[A-Z]?$' then
      raise exception 'Not a course code: %', coalesce(item ->> 'course', '(blank)');
    end if;
    if kind not in ('primary', 'backup') then
      raise exception 'Each course is a primary or a backup.';
    end if;
    -- One row per course: a course that is both is counted as planned.
    if exists (select 1 from public.term_plan_courses
                where user_id = me and term_code = trim(want_term) and contributes_to_demand
                  and course_code = code) then
      if kind = 'primary' then
        update public.term_plan_courses
           set status = 'planned', backup_rank = null, updated_at = now()
         where user_id = me and term_code = trim(want_term) and contributes_to_demand and course_code = code;
      end if;
      continue;
    end if;
    insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, status, backup_rank, contributes_to_demand)
    values (me, school, trim(want_term), code,
            case when kind = 'primary' then 'planned' else 'backup' end,
            case when kind = 'backup' then least(greatest(coalesce((item ->> 'rank')::integer, 1), 1), 20) end,
            true);
    n := n + 1;
  end loop;

  insert into public.demand_consents (user_id, tenant_id, term_code, consented_at, revoked_at)
  values (me, school, trim(want_term), now(), null)
  on conflict (user_id, term_code)
  do update set tenant_id = excluded.tenant_id, consented_at = now(), revoked_at = null;
  return n;
end;
$$;
revoke all on function public.contribute_course_plan(text, jsonb) from public, anon;
grant execute on function public.contribute_course_plan(text, jsonb) to authenticated;

-- Stops contributing for one term, from now on.
create or replace function public.stop_contributing(want_term text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from public.term_plan_courses
   where user_id = me and term_code = trim(want_term) and contributes_to_demand;
  update public.demand_consents set revoked_at = now()
   where user_id = me and term_code = trim(want_term) and revoked_at is null;
end;
$$;
revoke all on function public.stop_contributing(text) from public, anon;
grant execute on function public.stop_contributing(text) to authenticated;

-- What the caller is contributing for a term: their consent and their rows.
create or replace function public.my_demand_contribution(want_term text)
returns table (course_code text, role text, backup_rank integer, consented_at timestamptz, revoked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.course_code, case when c.status = 'backup' then 'backup' else 'primary' end, c.backup_rank,
         d.consented_at, d.revoked_at
    from public.demand_consents d
    left join public.term_plan_courses c
      on c.user_id = d.user_id and c.term_code = d.term_code and c.contributes_to_demand
   where d.user_id = (select auth.uid()) and d.term_code = trim(want_term)
   order by c.status desc, c.backup_rank nulls first, c.course_code;
$$;
revoke all on function public.my_demand_contribution(text) from public, anon;
grant execute on function public.my_demand_contribution(text) to authenticated;

-- ── 4. The refresh counts only live consent ───────────────────────────────

create or replace function private.refresh_course_demand(want_tenant text, want_term text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.course_demand_snapshots where tenant_id = want_tenant and term_code = want_term;
  insert into public.course_demand_snapshots (tenant_id, term_code, course_code, planned_students, backup_students)
  select want_tenant, want_term, c.course_code,
         count(distinct c.user_id) filter (where c.status in ('planned', 'registered', 'waitlisted')),
         nullif(case when count(distinct c.user_id) filter (where c.status = 'backup') >= 10
                     then count(distinct c.user_id) filter (where c.status = 'backup') else 0 end, 0)
    from public.term_plan_courses c
    join public.demand_consents d
      on d.user_id = c.user_id and d.term_code = c.term_code and d.tenant_id = c.tenant_id
     and d.revoked_at is null
   where c.tenant_id = want_tenant and c.term_code = want_term and c.contributes_to_demand
   group by c.course_code
  having count(distinct c.user_id) filter (where c.status in ('planned', 'registered', 'waitlisted')) >= 10;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.refresh_course_demand(text, text) from public, anon, authenticated;

-- The job's door, for the service role only. Nothing schedules it: a school
-- turns it on when it turns the feature on (docs/COURSE-DEMAND-FORECASTING.md).
create or replace function public.refresh_course_demand_snapshots(want_tenant text, want_term text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.refresh_course_demand(want_tenant, want_term);
$$;
revoke all on function public.refresh_course_demand_snapshots(text, text) from public, anon, authenticated;
grant execute on function public.refresh_course_demand_snapshots(text, text) to service_role;

-- ── 5. What staff read ────────────────────────────────────────────────────

-- The caller's live demand:read scopes.
create or replace function public.my_demand_scopes()
returns table (scope_kind text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct g.scope_kind, g.scope_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role and rc.capability = 'demand:read'
   where g.subject = (select auth.uid())
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
     and g.scope_kind in ('school', 'department')
   order by 1, 2;
$$;
revoke all on function public.my_demand_scopes() from public, anon;
grant execute on function public.my_demand_scopes() to authenticated;

-- One term's snapshot rows the caller may read (the table's own policy
-- decides which), with capacity and waitlist summed over sections where the
-- registrar has synced them. Aggregates only: no row here has a person in it.
create or replace function public.course_demand(want_term text)
returns table (
  tenant_id text, course_code text, planned_students integer, backup_students integer,
  generated_at timestamptz, capacity integer, waitlist integer, sections integer,
  capacity_source text, capacity_synced_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.tenant_id, s.course_code, s.planned_students, s.backup_students, s.generated_at,
         sum(cs.capacity)::integer, sum(cs.waitlist_count)::integer, count(cs.section)::integer,
         min(cs.source_system), max(cs.synced_at)
    from public.course_demand_snapshots s
    left join public.catalog_sections cs
      on cs.tenant_id = s.tenant_id and cs.term_code = s.term_code and cs.course_code = s.course_code
   where s.term_code = trim(want_term)
   group by s.tenant_id, s.course_code, s.planned_students, s.backup_students, s.generated_at
   order by s.course_code
   limit 2000;
$$;
revoke all on function public.course_demand(text) from public, anon;
grant execute on function public.course_demand(text) to authenticated;
