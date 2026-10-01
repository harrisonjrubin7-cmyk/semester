-- Semester — degree audit on the server: the school's audit, not the student's calculator.
--
-- D-151 says Semester runs beside a school's systems (Connect) and takes a
-- module over only when the school switches that module to Core. This is the
-- module `degree_audit`: a school publishes the requirements of a degree
-- PROGRAM for a catalog year, and the database runs an AUDIT of one student's
-- academic record against it and keeps the answer.
--
-- This is not `app/src/lib/degree.ts`. That file is a calculator over
-- requirements a student types in, and says so on every screen. This is the
-- school's: the requirements are the school's, the record is the school's
-- ledger (D-145), and the answer is kept with who asked, when, for which date
-- and under which version of the program, so it can be read again and
-- compared with the next one. The two use the same arithmetic on purpose
-- (double counting allowed and stated, in progress is not done, an empty
-- `accepts` means anything, a bare uppercase prefix accepts every course with
-- it) and `app/src/lib/degreeaudit/audit.ts` is the TypeScript twin of
-- `private.degree_audit_compute` below, held equal to it by one shared
-- fixtures file that both `degreeaudit.test.ts` and `degree-audit.check.sql`
-- must reproduce.
--
-- What it decides, and where:
--
--   * **Who authors.** `degree:author` (registrar, dean), held on the school:
--     create a program version, add requirements to a draft, publish, retire.
--   * **Who audits.** `degree:audit` (registrar, dean, academic advisor) may
--     audit any student's record at their own school. Anybody else may audit
--     only themselves, and only through `academic_record_subjects`: the
--     account the school linked to that student reference. Nobody may audit
--     a record at another school.
--   * **Core only.** Every mutation, an audit included, is refused unless the
--     school has switched `degree_audit` to Core (`effective_module_modes`),
--     and refused while the module is frozen or `kill.core_modules` is
--     engaged. Reading is not gated by mode: a frozen module's audits stay
--     readable. Every doubt reads Connect.
--   * **A published program is immutable.** A program is a draft until it is
--     published; its requirements are added while it is a draft and are never
--     edited or removed, and once it is published nothing about it changes
--     except that it is retired. A change is a new version of the program: a
--     new draft, optionally copied from the last, which on publication
--     retires the version it replaces. A trigger refuses every other edit,
--     for the owner too.
--   * **An audit writes nothing to the academic ledger.** It reads the
--     ledger as of a date and writes one append-only row in `degree_audits`
--     naming who asked, the as-of date, the program and version used, a
--     SHA-256 of the exact ledger lines it read, and the result: per
--     requirement what is done, what is in progress and what is left, the
--     courses each requirement counted, and an overall verdict.
--   * **No double runs.** Every mutation takes an idempotency key. The same
--     key and request from the same caller answers as the first call did and
--     writes nothing; the same key for anything else is refused.
--
-- ## What the audit reads, and how (the part a school must agree with)
--
-- Only four kinds of ledger entry, each the one in effect on the as-of date
-- for its key (`private.academic_record_in_effect`'s order), and a `void`
-- entry means the key is absent:
--
--   * `enrollment`, `grade`, `credit`: the key is `<course code> · <term>`,
--     the form the record screen's own hint asks for. The text before the
--     first " · " is the course code (trimmed, upper-cased, runs of spaces
--     collapsed); the rest is the term, kept for display and never parsed.
--     A key with no course code is listed as not counted, never guessed at.
--   * `grade`'s value is the letter. It counts as done only if it is one of
--     the program's `passing_grades`, a list the school writes in order from
--     best to worst. This file does not decide what passes: a program
--     without that list cannot be created.
--   * `credit`'s value is the credit hours, as `3` or `1.5`. A course with no
--     readable hours counts as a course and as zero hours, and says so.
--   * `transfer_credit`: the key is `<course code> · <institution>`, the
--     value the hours. It counts as done for a requirement with no minimum
--     grade, and never for one with a minimum grade, because it has no grade.
--
-- A course instance (one key) with a grade is done or not counted; with no
-- grade but an enrollment it is in progress; with neither it is not counted.
-- A course taken twice is two instances and counts twice: repeat and
-- retake policy is the school's, none has been given, and the audit lists
-- both so a person can see it.
-- `standing`, `requirement` and `conferral` entries are not read: a program
-- being complete here does not mean a degree is conferred, and the audit never
-- says it does.
--
-- ## What this is not
--
-- Not an official degree audit certified by a registrar, not a what-if
-- planner, not a transfer evaluation, not a catalogue import and not a
-- sign-off. It is the smallest real slice: a school's own program, run
-- against the school's own ledger, with the answer kept.
--
-- Account deletion: the programs, requirements and audits belong to the
-- school. A person who wrote a program or asked for an audit is set null, as
-- `erasure.test.ts` requires of every column naming an account, and the row
-- stays. A student's audit is a computation over a record that stays with the
-- school and is keyed by the school's own student reference, not by the account.
--
-- Additive and safe to run again. NOT APPLIED to production; applying it
-- needs owner approval.

-- ── The capabilities ─────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('degree:author', 'Create, add requirements to, publish and retire the degree programs a school audits against.'),
  ('degree:audit',  'Run a degree audit for any student at one school and read every audit kept there.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar',        'degree:author'),
  ('dean',             'degree:author'),
  ('registrar',        'degree:audit'),
  ('dean',             'degree:audit'),
  ('academic_advisor', 'degree:audit')
on conflict do nothing;

-- ── Tables ─────────────────────────────────────────────────

-- The keys every mutation spends. `request` is what was asked, `result` what
-- was answered; a replay compares the first and returns the second.
create table if not exists public.degree_audit_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('create_program', 'add_requirement', 'publish', 'retire', 'run_audit')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

-- A school's degree program for one catalog year, in versions. A version is a
-- draft until published, and only its state ever changes after that.
create table if not exists public.degree_programs (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  code           text        not null check (code ~ '^[A-Z0-9][A-Z0-9 .&/-]{0,39}$'),
  title          text        not null check (length(btrim(title)) between 1 and 200),
  catalog_year   integer     not null check (catalog_year between 1900 and 2200),
  version        integer     not null check (version >= 1),
  state          text        not null default 'draft' check (state in ('draft', 'published', 'retired')),
  -- The grades that count as completing a course, best first. The school's
  -- list: this file has no default and decides nothing about what passes.
  passing_grades text[]      not null check (cardinality(passing_grades) between 1 and 30),
  created_by     uuid        references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  published_by   uuid        references auth.users on delete set null,
  published_at   timestamptz,
  retired_by     uuid        references auth.users on delete set null,
  retired_at     timestamptz,
  operation      text        not null,
  unique (tenant_id, code, catalog_year, version),
  constraint degree_programs_state_stamps check (
    (state = 'draft' and published_at is null and retired_at is null)
    or (state = 'published' and published_at is not null and retired_at is null)
    or (state = 'retired' and retired_at is not null))
);

-- One thing a program asks for. Added to a draft, then fixed.
create table if not exists public.degree_requirements (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  program_id uuid        not null references public.degree_programs(id) on delete cascade,
  sort       integer     not null check (sort >= 1),
  name       text        not null check (length(btrim(name)) between 1 and 200),
  need       text        not null check (need in ('courses', 'hours')),
  need_count numeric(6,2) not null check (need_count > 0),
  -- Course codes, tidied: upper-case, single spaces. Empty means anything; a
  -- bare prefix such as ECON accepts every course whose code starts "ECON ".
  accepts    text[]      not null default '{}' check (cardinality(accepts) <= 100),
  min_grade  text,
  created_at timestamptz not null default now(),
  operation  text        not null,
  unique (program_id, sort),
  unique (program_id, name)
);

-- One audit, kept. Nothing here is ever changed.
create table if not exists public.degree_audits (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  student_ref    text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  program_id     uuid        not null references public.degree_programs(id),
  program_code   text        not null,
  program_title  text        not null,
  catalog_year   integer     not null,
  program_version integer    not null,
  as_of          date        not null,
  requested_by   uuid        references auth.users on delete set null,
  requested_at   timestamptz not null default clock_timestamp(),
  -- SHA-256 of the exact ledger lines this audit read, and how many there were.
  inputs_sha256  text        not null check (inputs_sha256 ~ '^[0-9a-f]{64}$'),
  inputs_count   integer     not null check (inputs_count >= 0),
  verdict        text        not null check (verdict in ('complete', 'complete_if_in_progress_passes', 'incomplete')),
  result         jsonb       not null,
  operation      text        not null
);

-- Every foreign key covered (`indexes.check.sql`), each index by its lead column.
create index if not exists degree_audit_operations_by_actor on public.degree_audit_operations (actor);
create index if not exists degree_programs_by_creator on public.degree_programs (created_by);
create index if not exists degree_programs_by_publisher on public.degree_programs (published_by);
create index if not exists degree_programs_by_retirer on public.degree_programs (retired_by);
create unique index if not exists degree_programs_one_draft on public.degree_programs (tenant_id, code, catalog_year) where state = 'draft';
create unique index if not exists degree_programs_one_published on public.degree_programs (tenant_id, code, catalog_year) where state = 'published';
create index if not exists degree_requirements_by_tenant on public.degree_requirements (tenant_id);
create index if not exists degree_audits_by_student on public.degree_audits (tenant_id, student_ref, requested_at);
create index if not exists degree_audits_by_program on public.degree_audits (program_id);
create index if not exists degree_audits_by_requester on public.degree_audits (requested_by);

comment on table public.degree_audit_operations is 'Idempotency keys the degree-audit mutations spent, with what each asked and answered. Append-only.';
comment on table public.degree_programs is 'A school''s degree program for one catalog year, in versions. A draft until published; after that only its state changes, to retired. A change is a new version.';
comment on table public.degree_requirements is 'One requirement of a program version: need courses or hours, what counts, an optional minimum grade. Added to a draft, never edited or removed.';
comment on table public.degree_audits is 'One degree audit of one student reference against one program version as of a date: who asked, a SHA-256 of the ledger lines read, and the result. Append-only. Nothing here is written to the academic ledger.';

-- ── The pure arithmetic ────────────────────────────────────

-- A course code as the audit compares it: trimmed, upper-cased, runs of
-- whitespace collapsed. `tidy` in app/src/lib/degree.ts, for ASCII.
create or replace function private.degree_tidy(given text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(btrim(regexp_replace(coalesce(given, ''), '\s+', ' ', 'g')));
$$;

revoke all on function private.degree_tidy(text) from public, anon, authenticated;

-- The ledger lines an audit read, as one string: kind, key, value, effective
-- date and entry id, tab-separated, one line each, in byte order of kind then
-- key. Its SHA-256 is what `degree_audits.inputs_sha256` holds. Pure, so the
-- TypeScript twin and a fixtures file can hold it equal.
create or replace function private.degree_audit_inputs_text(want_lines jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(
           (l->>'kind') || E'\t' || (l->>'key') || E'\t' || (l->>'value') || E'\t' || (l->>'effective_on') || E'\t' || (l->>'id'),
           E'\n' order by (l->>'kind') collate "C", (l->>'key') collate "C"), '')
    from jsonb_array_elements(want_lines) l;
$$;

revoke all on function private.degree_audit_inputs_text(jsonb) from public, anon, authenticated;

-- The audit itself, from two documents and nothing else.
--
--   want_program: { passing_grades: [text], requirements: [{ sort, name, need,
--                   count, accepts: [text], min_grade }] }
--   want_lines:   [{ kind, key, value, effective_on, id }], the entry in
--                 effect for each (kind, key), voids already dropped, with at
--                 most one line per (kind, key).
--
-- It reads no table, so the same call is made by `degree_audit_run` on the
-- ledger and by a test on a fixture. The twin is `audit()` in
-- app/src/lib/degreeaudit/audit.ts; `degreeaudit.fixtures.json` is what both
-- must reproduce.
create or replace function private.degree_audit_compute(want_program jsonb, want_lines jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  passing text[] := array(select x from jsonb_array_elements_text(want_program->'passing_grades') with ordinality t(x, i) order by i);
  insts   jsonb;
  reqs    jsonb := '[]'::jsonb;
  courses jsonb;
  r       record;
  accepts text[];
  min_idx integer;
  done_items jsonb;
  doing_items jsonb;
  unmet_items jsonb;
  have    numeric;
  doing   numeric;
  willhave numeric;
  need_n  numeric;
  is_met  boolean;
  is_after boolean;
  all_met boolean := true;
  all_after boolean := true;
  verdict text;
begin
  if exists (select 1 from jsonb_array_elements(want_lines) l group by l->>'kind', l->>'key' having count(*) > 1) then
    raise exception 'semester: an audit reads one ledger line for each kind and key' using errcode = 'check_violation';
  end if;

  -- Every course instance on the record: one per key.
  with ln as (
    select l->>'kind' as kind, l->>'key' as key, l->>'value' as value from jsonb_array_elements(want_lines) l
  ),
  taken as (
    select k.key,
           private.degree_tidy(split_part(k.key, ' · ', 1)) as code,
           case when strpos(k.key, ' · ') > 0 then substr(k.key, strpos(k.key, ' · ') + 3) else '' end as term,
           'course'::text as source,
           (select g.value from ln g where g.kind = 'grade' and g.key = k.key) as grade,
           exists (select 1 from ln e where e.kind = 'enrollment' and e.key = k.key) as enrolled,
           (select c.value from ln c where c.kind = 'credit' and c.key = k.key) as credit
      from (select distinct key from ln where kind in ('enrollment', 'grade', 'credit')) k
  ),
  moved as (
    select t.key,
           private.degree_tidy(split_part(t.key, ' · ', 1)) as code,
           case when strpos(t.key, ' · ') > 0 then substr(t.key, strpos(t.key, ' · ') + 3) else '' end as term,
           'transfer'::text as source,
           null::text as grade,
           t.value as credit
      from ln t where t.kind = 'transfer_credit'
  ),
  both_ as (
    select key, code, term, source, grade,
           case when credit ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then trim_scale(credit::numeric) end as hours,
           case when code = '' then 'not_counted'
                when grade is not null then case when grade = any (passing) then 'done' else 'not_counted' end
                when enrolled then 'in_progress'
                else 'not_counted' end as state,
           case when code = '' then 'no_course_code'
                when grade is not null and grade <> all (passing) then 'grade_not_passing'
                when grade is null and not enrolled then 'no_grade_or_enrollment' end as reason
      from taken
    union all
    select key, code, term, source, grade,
           case when credit ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then trim_scale(credit::numeric) end,
           case when code = '' then 'not_counted'
                when credit ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then 'done'
                else 'not_counted' end,
           case when code = '' then 'no_course_code'
                when credit !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then 'hours_unreadable' end
      from moved
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'code', code, 'term', term, 'source', source, 'grade', grade,
                                               'hours', hours, 'state', state, 'reason', reason)
                            order by key collate "C", source), '[]'::jsonb)
    into insts
    from both_;

  for r in
    select e as req from jsonb_array_elements(want_program->'requirements') e order by (e->>'sort')::integer
  loop
    accepts := array(select jsonb_array_elements_text(r.req->'accepts'));
    min_idx := case when r.req->>'min_grade' is null then null else array_position(passing, r.req->>'min_grade') end;
    if r.req->>'min_grade' is not null and min_idx is null then
      raise exception 'semester: a minimum grade must be one of the program''s passing grades' using errcode = 'check_violation';
    end if;
    need_n  := (r.req->>'count')::numeric;

    with i as (
      select * from jsonb_to_recordset(insts) as x(key text, code text, term text, source text, grade text, hours numeric, state text, reason text)
       where state in ('done', 'in_progress')
         and (cardinality(accepts) = 0
              or exists (select 1 from unnest(accepts) w
                          where w = x.code or (w ~ '^[A-Z]+$' and left(x.code, length(w) + 1) = w || ' ')))
    ),
    sorted as (
      select i.*,
             (state = 'done' and (min_idx is null or (source = 'course' and array_position(passing, grade) <= min_idx))) as counts,
             (state = 'done' and min_idx is not null and not (source = 'course' and array_position(passing, grade) <= min_idx)) as unmet
        from i
    )
    select
      coalesce(jsonb_agg(jsonb_build_object('key', key, 'code', code, 'term', term, 'source', source, 'grade', grade, 'hours', hours)
                         order by key collate "C", source) filter (where counts), '[]'::jsonb),
      coalesce(jsonb_agg(jsonb_build_object('key', key, 'code', code, 'term', term, 'source', source, 'grade', grade, 'hours', hours)
                         order by key collate "C", source) filter (where state = 'in_progress'), '[]'::jsonb),
      coalesce(jsonb_agg(jsonb_build_object('key', key, 'code', code, 'term', term, 'source', source, 'grade', grade, 'hours', hours,
                                            'why', case when source = 'course' then 'below_minimum' else 'no_grade' end)
                         order by key collate "C", source) filter (where unmet), '[]'::jsonb),
      coalesce(sum(case when r.req->>'need' = 'hours' then coalesce(hours, 0) else 1 end) filter (where counts), 0),
      coalesce(sum(case when r.req->>'need' = 'hours' then coalesce(hours, 0) else 1 end) filter (where state = 'in_progress'), 0)
    into done_items, doing_items, unmet_items, have, doing
    from sorted;

    willhave := have + doing;
    is_met := have >= need_n;
    is_after := (not is_met) and willhave >= need_n;
    all_met := all_met and is_met;
    all_after := all_after and (is_met or is_after);
    reqs := reqs || jsonb_build_array(jsonb_build_object(
      'sort', (r.req->>'sort')::integer,
      'name', r.req->>'name',
      'need', r.req->>'need',
      'count', trim_scale(need_n),
      'min_grade', r.req->'min_grade',
      'accepts', r.req->'accepts',
      'have', trim_scale(have),
      'will_have', trim_scale(willhave),
      'left', trim_scale(greatest(0, need_n - willhave)),
      'met', is_met,
      'meets_after', is_after,
      'done', done_items,
      'doing', doing_items,
      'unmet_grade', unmet_items));
  end loop;

  -- Where each course counted: every requirement that named it, so double
  -- counting is stated and not silently applied.
  select coalesce(jsonb_agg(
           jsonb_build_object('key', c.key, 'code', c.code, 'term', c.term, 'source', c.source, 'grade', c.grade,
                              'hours', c.hours, 'state', c.state, 'reason', c.reason,
                              'counted_in', (select coalesce(jsonb_agg(q->>'name' order by (q->>'sort')::integer), '[]'::jsonb)
                                               from jsonb_array_elements(reqs) q
                                              where exists (select 1 from jsonb_array_elements((q->'done') || (q->'doing')) z
                                                             where z->>'key' = c.key and z->>'source' = c.source)))
           order by c.key collate "C", c.source), '[]'::jsonb)
    into courses
    from jsonb_to_recordset(insts) as c(key text, code text, term text, source text, grade text, hours numeric, state text, reason text);

  verdict := case when jsonb_array_length(reqs) > 0 and all_met then 'complete'
                  when jsonb_array_length(reqs) > 0 and all_after then 'complete_if_in_progress_passes'
                  else 'incomplete' end;
  return jsonb_build_object('verdict', verdict, 'requirements', reqs, 'courses', courses);
end $$;

revoke all on function private.degree_audit_compute(jsonb, jsonb) from public, anon, authenticated;

-- ── What may change, for the owner too ───────────────────────

-- A program: a draft is published or retired, a published one retired, and
-- nothing else about it ever changes. Account deletion clearing a person
-- reference is not a change to the program.
create or replace function private.degree_programs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stamps constant text[] := array['state', 'published_at', 'published_by', 'retired_at', 'retired_by'];
  people constant text[] := array['created_by', 'published_by', 'retired_by'];
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.schools s where s.id = old.tenant_id) then return old; end if;
    raise exception 'semester: a degree program is never deleted; retire it' using errcode = '42501';
  end if;
  if (to_jsonb(new) - people) = (to_jsonb(old) - people)
     and (new.created_by is null or new.created_by = old.created_by)
     and (new.published_by is null or new.published_by = old.published_by)
     and (new.retired_by is null or new.retired_by = old.retired_by) then
    return new;
  end if;
  if old.state = 'retired' then
    raise exception 'semester: a retired program does not change' using errcode = '42501';
  end if;
  if (to_jsonb(new) - stamps - 'created_by') <> (to_jsonb(old) - stamps - 'created_by') or new.created_by is distinct from old.created_by then
    raise exception 'semester: a program does not change once made; a change is a new version' using errcode = '42501';
  end if;
  if not ((old.state = 'draft' and new.state in ('published', 'retired')) or (old.state = 'published' and new.state = 'retired')) then
    raise exception 'semester: a program goes draft, published, retired and no other way' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.degree_programs_guard() from public, anon, authenticated;
drop trigger if exists degree_programs_guard on public.degree_programs;
create trigger degree_programs_guard before update or delete on public.degree_programs
  for each row execute function private.degree_programs_guard();

-- A requirement is added to a draft and then never touched.
create or replace function private.degree_requirements_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st text;
begin
  if tg_op = 'INSERT' then
    select p.state into st from public.degree_programs p where p.id = new.program_id;
    if st is distinct from 'draft' then
      raise exception 'semester: requirements are added to a draft only; a published program does not change' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then return old; end if;
  raise exception 'semester: a requirement is never edited or removed; a change is a new version of the program' using errcode = '42501';
end $$;

revoke all on function private.degree_requirements_guard() from public, anon, authenticated;
drop trigger if exists degree_requirements_guard on public.degree_requirements;
create trigger degree_requirements_guard before insert or update or delete on public.degree_requirements
  for each row execute function private.degree_requirements_guard();

-- An audit is kept as it was asked. Only account deletion clearing who asked.
create or replace function private.degree_audits_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'requested_by') = (to_jsonb(old) - 'requested_by')
     and (new.requested_by is null or new.requested_by = old.requested_by) then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then return old; end if;
  raise exception 'semester: a degree audit is kept as it was run; run another' using errcode = '42501';
end $$;

revoke all on function private.degree_audits_guard() from public, anon, authenticated;
drop trigger if exists degree_audits_guard on public.degree_audits;
create trigger degree_audits_guard before update or delete on public.degree_audits
  for each row execute function private.degree_audits_guard();

-- ── Who reads ──────────────────────────────────────────────

alter table public.degree_audit_operations enable row level security;
alter table public.degree_programs enable row level security;
alter table public.degree_requirements enable row level security;
alter table public.degree_audits enable row level security;

revoke all on table public.degree_audit_operations from anon, authenticated;
revoke all on table public.degree_programs from anon, authenticated;
revoke all on table public.degree_requirements from anon, authenticated;
revoke all on table public.degree_audits from anon, authenticated;
grant select on table public.degree_audit_operations to authenticated;
grant select on table public.degree_programs to authenticated;
grant select on table public.degree_requirements to authenticated;
grant select on table public.degree_audits to authenticated;

drop policy if exists "callers read their own operations" on public.degree_audit_operations;
create policy "callers read their own operations" on public.degree_audit_operations
  for select to authenticated
  using (actor = (select auth.uid()));

-- Authors read every version, a draft included; everybody else at the school
-- reads the published and retired ones, because a student has to be able to
-- read what they were audited against.
drop policy if exists "authors read all, the school reads what is published" on public.degree_programs;
create policy "authors read all, the school reads what is published" on public.degree_programs
  for select to authenticated
  using (private.has_capability('degree:author', 'school', tenant_id)
         or (state in ('published', 'retired') and tenant_id = (select private.school_of())));

-- A requirement is readable exactly when its program is: the program's own
-- policy decides, through the subquery.
drop policy if exists "a requirement reads as its program does" on public.degree_requirements;
create policy "a requirement reads as its program does" on public.degree_requirements
  for select to authenticated
  using (exists (select 1 from public.degree_programs p where p.id = program_id));

-- Auditors read every audit at their school; a student reads the audits of
-- the record the school linked to their account, and no other.
drop policy if exists "auditors read all, a student the audits of their own record" on public.degree_audits;
create policy "auditors read all, a student the audits of their own record" on public.degree_audits
  for select to authenticated
  using (private.has_capability('degree:audit', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = degree_audits.tenant_id
                       and s.student_ref = degree_audits.student_ref
                       and s.user_id = (select auth.uid())));

-- ── The rules every mutation starts with ──────────────────────

create or replace function private.degree_audit_school()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null then
    raise exception 'semester: your account has no school' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;

-- Raises unless the caller holds `want_cap` on their own school.
create or replace function private.degree_audit_require(school text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'school', school) then
    raise exception 'semester: that needs % at your school', want_cap using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Raises unless this school has switched degree_audit to Semester Core, and
-- the module is neither frozen nor paused by the kill switch. A school in
-- Connect never reaches a write here: its degree audit is in its own system.
create or replace function private.degree_audit_require_core(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select e.mode, e.frozen, e.killed into m
    from public.effective_module_modes(school) e
   where e.module = 'degree_audit';
  -- While the kill switch is engaged every module reads Connect, so a school
  -- that really is in Core has to be recognised from its own row to be told
  -- the truth: paused, not "never switched".
  if found and m.killed and exists (select 1 from public.tenant_module_mode t
                                     where t.tenant_id = school and t.module = 'degree_audit' and t.mode = 'core') then
    raise exception 'semester: Core modules are paused for your school' using errcode = 'insufficient_privilege';
  end if;
  if not found or m.mode <> 'core' then
    raise exception 'semester: your school has not switched degree audit to Semester Core' using errcode = 'insufficient_privilege';
  end if;
  if m.frozen then
    raise exception 'semester: degree audit is frozen; the audits are kept and read-only' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- The key check every mutation starts with. Null means go ahead; otherwise it
-- is the first answer to replay. Holds a lock on the key until commit, so two
-- calls with one key cannot both do the work.
create or replace function private.degree_audit_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.degree_audit_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('degree-audit-op:' || school || ':' || want_key));
  select * into op from public.degree_audit_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;

create or replace function private.degree_audit_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.degree_audit_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;

-- Grades as a program states them: trimmed, none empty, none repeated, and
-- short enough to be a grade. Raises otherwise.
create or replace function private.degree_audit_grades(given text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  tidy text[] := array(select btrim(g) from unnest(coalesce(given, '{}')) g);
begin
  if cardinality(tidy) not between 1 and 30 or exists (select 1 from unnest(tidy) g where g !~ '^[A-Za-z0-9+-]{1,6}$') then
    raise exception 'semester: the passing grades are 1 to 30 grades of up to 6 letters, digits, + or -, best first' using errcode = 'check_violation';
  end if;
  if (select count(distinct g) from unnest(tidy) g) <> cardinality(tidy) then
    raise exception 'semester: a grade is listed once in the passing grades' using errcode = 'check_violation';
  end if;
  return tidy;
end $$;

revoke all on function private.degree_audit_grades(text[]) from public, anon, authenticated;

-- ── Authoring a program ────────────────────────────────────

-- Makes the next version of a program, as a draft. `want_copy_from` is an
-- earlier version of the same program and catalog year whose requirements and
-- passing grades the draft starts with; `want_passing` replaces the grades
-- when given.
create or replace function public.degree_program_create(
  want_code text, want_title text, want_catalog_year integer, want_passing text[], want_copy_from uuid, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.degree_audit_school();
  pcode   text := private.degree_tidy(want_code);
  req     jsonb := jsonb_build_object('code', private.degree_tidy(want_code), 'title', btrim(coalesce(want_title, '')),
                                      'year', want_catalog_year, 'passing', to_jsonb(want_passing), 'copy', want_copy_from);
  prior   jsonb;
  src     public.degree_programs;
  grades  text[];
  n       integer;
  made    uuid;
begin
  perform private.degree_audit_require(school, 'degree:author');
  perform private.degree_audit_require_core(school);
  prior := private.degree_audit_replay(school, want_key, 'create_program', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if pcode !~ '^[A-Z0-9][A-Z0-9 .&/-]{0,39}$' then
    raise exception 'semester: a program code is up to 40 letters, digits, spaces or . & / -' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_title, ''))) not between 1 and 200 then
    raise exception 'semester: a title is 1 to 200 characters' using errcode = 'check_violation';
  end if;
  if want_catalog_year is null or want_catalog_year not between 1900 and 2200 then
    raise exception 'semester: that is not a catalog year' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.degree_programs d
              where d.tenant_id = school and d.code = pcode and d.catalog_year = want_catalog_year and d.state = 'draft') then
    raise exception 'semester: a draft of this program already exists; publish or retire it first' using errcode = 'unique_violation';
  end if;

  if want_copy_from is not null then
    select * into src from public.degree_programs d where d.id = want_copy_from and d.tenant_id = school;
    if not found or src.code <> pcode or src.catalog_year <> want_catalog_year then
      raise exception 'semester: a new version copies an earlier version of the same program and catalog year' using errcode = 'check_violation';
    end if;
  end if;
  grades := private.degree_audit_grades(coalesce(want_passing, src.passing_grades));

  select coalesce(max(d.version), 0) + 1 into n
    from public.degree_programs d where d.tenant_id = school and d.code = pcode and d.catalog_year = want_catalog_year;
  insert into public.degree_programs (tenant_id, code, title, catalog_year, version, passing_grades, created_by, operation)
  values (school, pcode, btrim(want_title), want_catalog_year, n, grades, me, want_key)
  returning id into made;

  if src.id is not null then
    if exists (select 1 from public.degree_requirements q where q.program_id = src.id and q.min_grade is not null and q.min_grade <> all (grades)) then
      raise exception 'semester: a requirement of the earlier version names a minimum grade these passing grades do not include' using errcode = 'check_violation';
    end if;
    insert into public.degree_requirements (tenant_id, program_id, sort, name, need, need_count, accepts, min_grade, operation)
    select school, made, q.sort, q.name, q.need, q.need_count, q.accepts, q.min_grade, want_key
      from public.degree_requirements q where q.program_id = src.id;
  end if;
  perform private.degree_audit_spend(school, want_key, 'create_program', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Adds one requirement to a draft, after the last.
create or replace function public.degree_requirement_add(
  want_program uuid, want_name text, want_need text, want_count numeric, want_accepts text[], want_min_grade text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school  text := private.degree_audit_school();
  p       public.degree_programs;
  accepts text[];
  grade   text := nullif(btrim(coalesce(want_min_grade, '')), '');
  req     jsonb;
  prior   jsonb;
  nextsort integer;
  made    uuid;
begin
  accepts := array(select t.a from (select distinct private.degree_tidy(x) as a from unnest(coalesce(want_accepts, '{}')) x) t order by t.a collate "C");
  req := jsonb_build_object('program', want_program, 'name', btrim(coalesce(want_name, '')), 'need', want_need,
                            'count', want_count, 'accepts', to_jsonb(array(select a from unnest(accepts) a order by a collate "C")),
                            'min_grade', grade);
  select * into p from public.degree_programs x where x.id = want_program and x.tenant_id = school;
  if not found then raise exception 'semester: no such program here' using errcode = 'check_violation'; end if;
  perform private.degree_audit_require(school, 'degree:author');
  perform private.degree_audit_require_core(school);
  prior := private.degree_audit_replay(school, want_key, 'add_requirement', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if p.state <> 'draft' then
    raise exception 'semester: requirements are added to a draft only; this program is %', p.state using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_name, ''))) not between 1 and 200 then
    raise exception 'semester: a requirement name is 1 to 200 characters' using errcode = 'check_violation';
  end if;
  if want_need is null or want_need not in ('courses', 'hours') then
    raise exception 'semester: a requirement needs courses or hours' using errcode = 'check_violation';
  end if;
  if want_count is null or want_count <= 0 or want_count > 1000 or scale(want_count) > 2
     or (want_need = 'courses' and want_count <> trunc(want_count)) then
    raise exception 'semester: how many is a positive whole number of courses, or hours to two decimal places' using errcode = 'check_violation';
  end if;
  if cardinality(accepts) > 100 or exists (select 1 from unnest(accepts) a where a !~ '^[A-Z0-9][A-Z0-9 .&/-]{0,39}$') then
    raise exception 'semester: what counts is up to 100 course codes or prefixes such as ECON or ECON 1010' using errcode = 'check_violation';
  end if;
  if grade is not null and grade <> all (p.passing_grades) then
    raise exception 'semester: the minimum grade must be one of the program''s passing grades' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.degree_requirements q where q.program_id = p.id) >= 60 then
    raise exception 'semester: a program has at most 60 requirements' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.degree_requirements q where q.program_id = p.id and q.name = btrim(want_name)) then
    raise exception 'semester: this program already has a requirement of that name' using errcode = 'unique_violation';
  end if;

  select coalesce(max(q.sort), 0) + 1 into nextsort from public.degree_requirements q where q.program_id = p.id;
  insert into public.degree_requirements (tenant_id, program_id, sort, name, need, need_count, accepts, min_grade, operation)
  values (school, p.id, nextsort, btrim(want_name), want_need, want_count, accepts, grade, want_key)
  returning id into made;
  perform private.degree_audit_spend(school, want_key, 'add_requirement', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Publishes a draft. The version it replaces, if any, is retired in the same
-- transaction, so a program and catalog year have one published version.
create or replace function public.degree_program_publish(want_program uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.degree_audit_school();
  p      public.degree_programs;
  req    jsonb := jsonb_build_object('program', want_program);
  prior  jsonb;
begin
  select * into p from public.degree_programs x where x.id = want_program and x.tenant_id = school;
  if not found then raise exception 'semester: no such program here' using errcode = 'check_violation'; end if;
  perform private.degree_audit_require(school, 'degree:author');
  perform private.degree_audit_require_core(school);
  prior := private.degree_audit_replay(school, want_key, 'publish', req);
  if prior is not null then return; end if;

  if p.state <> 'draft' then
    raise exception 'semester: only a draft can be published; this one is %', p.state using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.degree_requirements q where q.program_id = p.id) then
    raise exception 'semester: a program with no requirements cannot be published' using errcode = 'check_violation';
  end if;
  update public.degree_programs x set state = 'retired', retired_by = me, retired_at = now()
   where x.tenant_id = school and x.code = p.code and x.catalog_year = p.catalog_year and x.state = 'published';
  update public.degree_programs x set state = 'published', published_by = me, published_at = now() where x.id = p.id;
  perform private.degree_audit_spend(school, want_key, 'publish', req, '{}'::jsonb);
end $$;

create or replace function public.degree_program_retire(want_program uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.degree_audit_school();
  p      public.degree_programs;
  req    jsonb := jsonb_build_object('program', want_program);
  prior  jsonb;
begin
  select * into p from public.degree_programs x where x.id = want_program and x.tenant_id = school;
  if not found then raise exception 'semester: no such program here' using errcode = 'check_violation'; end if;
  perform private.degree_audit_require(school, 'degree:author');
  perform private.degree_audit_require_core(school);
  prior := private.degree_audit_replay(school, want_key, 'retire', req);
  if prior is not null then return; end if;

  if p.state = 'retired' then
    raise exception 'semester: this program is already retired' using errcode = 'check_violation';
  end if;
  update public.degree_programs x set state = 'retired', retired_by = me, retired_at = now() where x.id = p.id;
  perform private.degree_audit_spend(school, want_key, 'retire', req, '{}'::jsonb);
end $$;

-- ── Running an audit ───────────────────────────────────────

-- Audits one student reference against one published program as of a date, and
-- keeps the answer. Returns the audit's id; a replay of the same key returns
-- the same id and writes nothing. Reads the ledger and writes nothing to it.
--
-- Who: `degree:audit` at the caller's school for any student there; anybody
-- else only for the student reference the school linked to their own account.
-- The as-of date may not be later than tomorrow by the server's clock (a day's
-- slack for a caller east of UTC): an audit "as of" a date that has not
-- happened would count entries not yet in effect and read as a forecast.
create or replace function public.degree_audit_run(want_program uuid, want_student_ref text, want_as_of date, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.degree_audit_school();
  p       public.degree_programs;
  req     jsonb := jsonb_build_object('program', want_program, 'student', want_student_ref, 'as_of', want_as_of);
  prior   jsonb;
  staff   boolean := private.has_capability('degree:audit', 'school', school);
  own     boolean;
  lines   jsonb;
  prog    jsonb;
  result  jsonb;
  made    uuid;
begin
  own := exists (select 1 from public.academic_record_subjects s
                  where s.tenant_id = school and s.student_ref = want_student_ref and s.user_id = me);
  if not (staff or own) then
    raise exception 'semester: you can audit your own record, or any record if your school gave you degree:audit' using errcode = 'insufficient_privilege';
  end if;
  perform private.degree_audit_require_core(school);
  prior := private.degree_audit_replay(school, want_key, 'run_audit', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_student_ref is null or want_student_ref !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: that is not a student reference' using errcode = 'check_violation';
  end if;
  if want_as_of is null or want_as_of > current_date + 1 then
    raise exception 'semester: an audit is as of today or an earlier date, never a later one' using errcode = 'check_violation';
  end if;
  if want_as_of < date '1900-01-01' then
    raise exception 'semester: that is not a date an audit can be as of' using errcode = 'check_violation';
  end if;
  select * into p from public.degree_programs x where x.id = want_program and x.tenant_id = school;
  if not found or p.state = 'draft' then raise exception 'semester: no such published program here' using errcode = 'check_violation'; end if;
  if p.state <> 'published' then
    raise exception 'semester: this program version is retired; audit against its published version' using errcode = 'check_violation';
  end if;
  if not own and not exists (select 1 from public.academic_record_subjects s where s.tenant_id = school and s.student_ref = want_student_ref)
     and not exists (select 1 from public.academic_record_entries e where e.tenant_id = school and e.student_ref = want_student_ref) then
    raise exception 'semester: there is no academic record for that student here' using errcode = 'check_violation';
  end if;

  -- The record as it stood on the date: for each key the entry in effect, in
  -- the ledger's own order (effective date, then when it was recorded, then
  -- id), and a void entry means the key is absent.
  select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'key', l.subject_key, 'value', l.value,
                                               'effective_on', l.effective_on, 'id', l.id)
                            order by l.kind collate "C", l.subject_key collate "C"), '[]'::jsonb)
    into lines
    from (select distinct on (e.kind, e.subject_key) e.*
            from public.academic_record_entries e
           where e.tenant_id = school and e.student_ref = want_student_ref
             and e.kind in ('enrollment', 'grade', 'credit', 'transfer_credit')
             and e.effective_on <= want_as_of
           order by e.kind, e.subject_key, e.effective_on desc, e.recorded_at desc, e.id desc) l
   where l.action = 'set';

  prog := jsonb_build_object(
    'passing_grades', to_jsonb(p.passing_grades),
    'requirements', coalesce((select jsonb_agg(jsonb_build_object('sort', q.sort, 'name', q.name, 'need', q.need, 'count', q.need_count,
                                                                  'accepts', to_jsonb(q.accepts), 'min_grade', q.min_grade) order by q.sort)
                                from public.degree_requirements q where q.program_id = p.id), '[]'::jsonb));
  result := private.degree_audit_compute(prog, lines);

  insert into public.degree_audits
    (tenant_id, student_ref, program_id, program_code, program_title, catalog_year, program_version, as_of,
     requested_by, inputs_sha256, inputs_count, verdict, result, operation)
  values (school, want_student_ref, p.id, p.code, p.title, p.catalog_year, p.version, want_as_of,
          me, encode(sha256(convert_to(private.degree_audit_inputs_text(lines), 'UTF8')), 'hex'),
          jsonb_array_length(lines), result->>'verdict', result, want_key)
  returning id into made;
  perform private.degree_audit_spend(school, want_key, 'run_audit', req, jsonb_build_object('id', made));
  return made;
end $$;

revoke all on function public.degree_program_create(text, text, integer, text[], uuid, text) from public, anon;
revoke all on function public.degree_requirement_add(uuid, text, text, numeric, text[], text, text) from public, anon;
revoke all on function public.degree_program_publish(uuid, text) from public, anon;
revoke all on function public.degree_program_retire(uuid, text) from public, anon;
revoke all on function public.degree_audit_run(uuid, text, date, text) from public, anon;
grant execute on function public.degree_program_create(text, text, integer, text[], uuid, text) to authenticated;
grant execute on function public.degree_requirement_add(uuid, text, text, numeric, text[], text, text) to authenticated;
grant execute on function public.degree_program_publish(uuid, text) to authenticated;
grant execute on function public.degree_program_retire(uuid, text) to authenticated;
grant execute on function public.degree_audit_run(uuid, text, date, text) to authenticated;

revoke all on function private.degree_audit_school() from public, anon, authenticated;
revoke all on function private.degree_audit_require(text, text) from public, anon, authenticated;
revoke all on function private.degree_audit_require_core(text) from public, anon, authenticated;
revoke all on function private.degree_audit_replay(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.degree_audit_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;
