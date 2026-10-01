-- Semester — question banks and timed tests held on the server, when a school
-- runs the `lms_assessments` module in Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- `app/src/lib/exam.ts` and `lib/itembank.ts` are a student's own practice and
-- the item model. Nothing here reads or changes them. This is what an
-- institution keeps: an instructor's bank of questions with their keys, a test
-- drawn from it, a student's attempt against a clock the server holds, and the
-- answers they gave.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's
--     `lms_assessments` module is `core`, not frozen, and `kill.core_modules`
--     is disengaged.
--   * **Who.** Held on `<school>/<CODE>/<TERM>` as the gradebook's are:
--     `assessments:author` (faculty) writes banks, tests and time extensions;
--     `assessments:review` (faculty, teaching assistants) reads banks, keys,
--     attempts and answers; `assessments:take` (the student roles) is the
--     roster. A grant with no term authorises nothing.
--   * **The clock is the server's.** An attempt's `started_at` and `deadline_at`
--     are read inside the writer. A student's browser shows a countdown, but
--     it decides nothing: an answer saved after the deadline is refused and the
--     attempt is finished with what was saved.
--   * **A student never receives a key.** The items a student is sent carry
--     the stem and the options and nothing else; the keys live in a table
--     only reviewers can read. After the window, and only if the instructor
--     chose to, a student's review shows what was right.
--   * **Recovery.** An attempt in progress is the same attempt on any device:
--     starting again returns it, with the time that is left. A lost connection
--     costs nothing a saved answer had not already banked.
--   * **Pools.** A test names its items, or draws `pool_size` of them at random
--     from the bank when an attempt starts; the drawn ids are fixed on the
--     attempt, so a refresh is the same questions.
--   * **Accommodations.** Extra time is an explicit grant per student and test
--     (`extra_percent`), by someone holding `assessments:author`, with a short
--     reason that is not a diagnosis. The deadline is the limit stretched by
--     that percent. The accommodations passport (`accommodation_passports`)
--     holds a functional summary in words, never read here.
--   * **Scoring** is the instructor's key applied by rule: one correct option,
--     a set of them, true or false, a number within a tolerance, a short text
--     matching an accepted answer after trimming and case-folding. An essay is
--     not scored and flags the attempt `needs_review`. The score is a figure on
--     the attempt; it does not become a grade. Nothing here writes the
--     gradebook, and AI decides nothing.
--   * **Append-only where it matters.** Bank items, tests, extensions and
--     finished attempts are never rewritten, even by the owner; a retired item
--     is a stamp on the item, not an edit.
--   * **Idempotent.** Every writer but a plain answer save takes a key. Saving
--     an answer is naturally idempotent (the last write wins until the attempt
--     ends).
--
-- Refused, not deferred: biometric proctoring, and any emotion or attention
-- monitoring: nothing here records where a student looked, which window they
-- were in, or anything about their face or voice (DO-NOT-BUILD).
--
-- Account deletion: a student's attempts, answers and time extensions cascade
-- from `auth.users`; the people who wrote banks and tests are set null.

-- ── The capabilities ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('assessments:author', 'Write question banks and tests, and grant extra time, for one course and term.'),
  ('assessments:review', 'Read banks with their keys, and every attempt and answer, for one course and term.'),
  ('assessments:take',   'Take the tests of one course and term: the assessments roster.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('faculty',               'assessments:author'),
  ('faculty',               'assessments:review'),
  ('teaching_assistant',    'assessments:review'),
  ('student',               'assessments:take'),
  ('undergraduate_student', 'assessments:take'),
  ('graduate_student',      'assessments:take'),
  ('transfer_student',      'assessments:take')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.assessment_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('bank', 'item', 'retire', 'create', 'publish', 'close', 'time', 'start', 'finish')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.question_banks (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  course_code text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term        text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  title       text        not null check (length(btrim(title)) between 1 and 200),
  created_by  uuid        references auth.users on delete set null,
  operation   text        not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.bank_items (
  id         uuid          primary key default gen_random_uuid(),
  tenant_id  text          not null references public.schools(id) on delete cascade,
  bank_id    uuid          not null references public.question_banks on delete cascade,
  kind       text          not null check (kind in ('multiple_choice', 'multiple_response', 'true_false', 'numeric', 'short_answer', 'essay')),
  stem       text          not null check (length(btrim(stem)) between 1 and 5000),
  options    jsonb         not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 10),
  answer_key jsonb         not null,
  points     numeric(7, 3) not null default 1 check (points > 0 and points <= 1000),
  retired_at timestamptz,
  created_by uuid          references auth.users on delete set null,
  operation  text          not null,
  created_at timestamptz   not null default now()
);

create table if not exists public.assessments (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  course_code      text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term             text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  bank_id          uuid        not null references public.question_banks on delete cascade,
  title            text        not null check (length(btrim(title)) between 1 and 200),
  instructions     text        not null default '' check (length(instructions) <= 5000),
  item_ids         uuid[],
  pool_size        integer     check (pool_size is null or pool_size between 1 and 200),
  minutes          integer     not null check (minutes between 1 and 600),
  opens_at         timestamptz not null,
  closes_at        timestamptz not null,
  attempts_allowed integer     not null default 1 check (attempts_allowed between 1 and 5),
  shuffle          boolean     not null default false,
  show_answers     boolean     not null default false,
  status           text        not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by       uuid        references auth.users on delete set null,
  operation        text        not null,
  created_at       timestamptz not null default now(),
  published_at     timestamptz,
  constraint assessments_window check (closes_at > opens_at),
  constraint assessments_items_xor_pool check ((item_ids is not null and coalesce(array_length(item_ids, 1), 0) > 0) <> (pool_size is not null))
);

create table if not exists public.assessment_time_extensions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  assessment_id uuid        not null references public.assessments on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  extra_percent integer     not null check (extra_percent between 1 and 200),
  reason        text        not null check (length(btrim(reason)) between 1 and 200),
  granted_by    uuid        references auth.users on delete set null,
  operation     text        not null,
  created_at    timestamptz not null default clock_timestamp()
);

create table if not exists public.assessment_attempts (
  id            uuid          primary key default gen_random_uuid(),
  tenant_id     text          not null references public.schools(id) on delete cascade,
  assessment_id uuid          not null references public.assessments on delete cascade,
  student_id    uuid          not null references auth.users on delete cascade,
  attempt       integer       not null check (attempt >= 1),
  started_at    timestamptz   not null,
  deadline_at   timestamptz   not null,
  item_ids      uuid[]        not null check (coalesce(array_length(item_ids, 1), 0) > 0),
  status        text          not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  finished_at   timestamptz,
  score         numeric(9, 3),
  points        numeric(9, 3),
  needs_review  boolean       not null default false,
  operation     text          not null,
  unique (assessment_id, student_id, attempt)
);

create table if not exists public.attempt_answers (
  attempt_id uuid          not null references public.assessment_attempts on delete cascade,
  item_id    uuid          not null references public.bank_items on delete cascade,
  tenant_id  text          not null references public.schools(id) on delete cascade,
  student_id uuid          not null references auth.users on delete cascade,
  answer     jsonb         not null,
  saved_at   timestamptz   not null,
  correct    boolean,
  awarded    numeric(7, 3),
  primary key (attempt_id, item_id)
);

create index if not exists assessment_operations_by_actor on public.assessment_operations (actor);
create index if not exists question_banks_by_course on public.question_banks (tenant_id, course_code, term);
create index if not exists question_banks_by_creator on public.question_banks (created_by);
create index if not exists bank_items_by_bank on public.bank_items (bank_id);
create index if not exists bank_items_by_tenant on public.bank_items (tenant_id);
create index if not exists bank_items_by_creator on public.bank_items (created_by);
create index if not exists assessments_by_course on public.assessments (tenant_id, course_code, term);
create index if not exists assessments_by_bank on public.assessments (bank_id);
create index if not exists assessments_by_creator on public.assessments (created_by);
create index if not exists assessment_time_extensions_by_assessment on public.assessment_time_extensions (assessment_id, student_id, created_at desc);
create index if not exists assessment_time_extensions_by_tenant on public.assessment_time_extensions (tenant_id);
create index if not exists assessment_time_extensions_by_student on public.assessment_time_extensions (student_id);
create index if not exists assessment_time_extensions_by_granter on public.assessment_time_extensions (granted_by);
create index if not exists assessment_attempts_by_tenant on public.assessment_attempts (tenant_id);
create index if not exists assessment_attempts_by_student on public.assessment_attempts (student_id);
create unique index if not exists assessment_one_attempt_in_progress
  on public.assessment_attempts (assessment_id, student_id) where status = 'in_progress';
create index if not exists attempt_answers_by_item on public.attempt_answers (item_id);
create index if not exists attempt_answers_by_tenant on public.attempt_answers (tenant_id);
create index if not exists attempt_answers_by_student on public.attempt_answers (student_id);

comment on table public.assessment_operations is 'Idempotency keys the assessment writers spent, with what each asked and answered. Append-only.';
comment on table public.question_banks is 'An instructor''s bank of questions for one course and term.';
comment on table public.bank_items is 'A question with its key. Readable only by the course''s reviewers; a student is sent the stem and options and never the key. Retired by a stamp, never edited.';
comment on table public.assessments is 'A timed test drawn from a bank, named items or a random pool. Written only by its definer functions, and only while the school runs lms_assessments in Core.';
comment on table public.assessment_time_extensions is 'Extra time granted to one student on one test, as a percent, with a short reason that is not a diagnosis. Append-only; the latest is in force.';
comment on table public.assessment_attempts is 'One attempt against a clock the server holds. A finished attempt is never rewritten.';
comment on table public.attempt_answers is 'The answer given to one item of one attempt; replaced while the attempt is in progress, frozen after.';

-- ── Guards ──────────────────────────────────────────────────────────────

-- Bank items change only to be retired, or to lose the name of the person who
-- wrote them when that person's account is deleted (`on delete set null`).
create or replace function private.guard_bank_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.retired_at is not null and new.retired_at is distinct from old.retired_at)
     or (to_jsonb(new) - 'retired_at' - 'created_by') is distinct from (to_jsonb(old) - 'retired_at' - 'created_by')
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'semester: a bank item is retired, never edited' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_bank_item() from public, anon, authenticated;

-- Extra time is never rewritten; only the granter's name may be cleared when
-- that person's account is deleted.
create or replace function private.guard_time_extension()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'granted_by') is distinct from (to_jsonb(old) - 'granted_by')
     or (new.granted_by is distinct from old.granted_by and new.granted_by is not null) then
    raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_time_extension() from public, anon, authenticated;

-- A finished attempt, and answers of a finished attempt, are frozen.
create or replace function private.guard_attempt()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'in_progress' then
    raise exception 'semester: a finished attempt is never rewritten' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_attempt() from public, anon, authenticated;

create or replace function private.guard_attempt_answer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.assessment_attempts a where a.id = old.attempt_id and a.status = 'in_progress') then
    raise exception 'semester: the answers of a finished attempt are never rewritten' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_attempt_answer() from public, anon, authenticated;

drop trigger if exists bank_items_retire_only on public.bank_items;
create trigger bank_items_retire_only before update on public.bank_items
for each row execute function private.guard_bank_item();
drop trigger if exists assessment_time_extensions_never_rewritten on public.assessment_time_extensions;
create trigger assessment_time_extensions_never_rewritten before update on public.assessment_time_extensions
for each row execute function private.guard_time_extension();
drop trigger if exists assessment_attempts_frozen on public.assessment_attempts;
create trigger assessment_attempts_frozen before update on public.assessment_attempts
for each row execute function private.guard_attempt();
drop trigger if exists attempt_answers_frozen on public.attempt_answers;
create trigger attempt_answers_frozen before update on public.attempt_answers
for each row execute function private.guard_attempt_answer();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.assessments_staff(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and (private.has_capability('assessments:author', 'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('assessments:review', 'course', private.gradebook_scope(want_tenant, want_code, want_term)));
$$;
revoke all on function private.assessments_staff(text, text, text) from public, anon, authenticated;
grant execute on function private.assessments_staff(text, text, text) to authenticated;

create or replace function private.assessments_roster(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability('assessments:take', 'course', private.gradebook_scope(want_tenant, want_code, want_term));
$$;
revoke all on function private.assessments_roster(text, text, text) from public, anon, authenticated;
grant execute on function private.assessments_roster(text, text, text) to authenticated;

alter table public.assessment_operations enable row level security;
alter table public.question_banks enable row level security;
alter table public.bank_items enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_time_extensions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.attempt_answers enable row level security;

revoke all on table public.assessment_operations from public, anon, authenticated;
revoke all on table public.question_banks from public, anon, authenticated;
revoke all on table public.bank_items from public, anon, authenticated;
revoke all on table public.assessments from public, anon, authenticated;
revoke all on table public.assessment_time_extensions from public, anon, authenticated;
revoke all on table public.assessment_attempts from public, anon, authenticated;
revoke all on table public.attempt_answers from public, anon, authenticated;
grant select on table public.assessment_operations to authenticated;
grant select on table public.question_banks to authenticated;
grant select on table public.bank_items to authenticated;
grant select on table public.assessments to authenticated;
grant select on table public.assessment_time_extensions to authenticated;
grant select on table public.assessment_attempts to authenticated;
grant select on table public.attempt_answers to authenticated;

drop policy if exists "callers read their own assessment operations" on public.assessment_operations;
create policy "callers read their own assessment operations" on public.assessment_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "reviewers read banks" on public.question_banks;
create policy "reviewers read banks" on public.question_banks
  for select to authenticated using (private.assessments_staff(tenant_id, course_code, term));

-- The keys: staff only. A student is sent items through `assessment_items`.
drop policy if exists "reviewers read bank items and keys" on public.bank_items;
create policy "reviewers read bank items and keys" on public.bank_items
  for select to authenticated
  using (exists (select 1 from public.question_banks b where b.id = bank_id and private.assessments_staff(b.tenant_id, b.course_code, b.term)));

drop policy if exists "staff read tests, the roster the published ones" on public.assessments;
create policy "staff read tests, the roster the published ones" on public.assessments
  for select to authenticated
  using (private.assessments_staff(tenant_id, course_code, term)
         or (status in ('published', 'closed') and private.assessments_roster(tenant_id, course_code, term)));

drop policy if exists "staff and the student read extra time" on public.assessment_time_extensions;
create policy "staff and the student read extra time" on public.assessment_time_extensions
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assessments a where a.id = assessment_id and private.assessments_staff(a.tenant_id, a.course_code, a.term)));

drop policy if exists "reviewers and the student read an attempt" on public.assessment_attempts;
create policy "reviewers and the student read an attempt" on public.assessment_attempts
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assessments a where a.id = assessment_id and private.assessments_staff(a.tenant_id, a.course_code, a.term)));

-- Answers: reviewers only. A student reads their own through `assessment_review`,
-- which says what the instructor chose to show.
drop policy if exists "reviewers read answers" on public.attempt_answers;
create policy "reviewers read answers" on public.attempt_answers
  for select to authenticated
  using (exists (select 1 from public.assessment_attempts t join public.assessments a on a.id = t.assessment_id
                  where t.id = attempt_id and private.assessments_staff(a.tenant_id, a.course_code, a.term)));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.assessment_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.assessment_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('assessment-op:' || school || ':' || want_key));
  select * into op from public.assessment_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.assessment_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.assessment_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.assessment_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.assessment_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.assessment_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'lms_assessments') then
    raise exception 'semester: this school does not run tests in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.assessment_core_required(text) from public, anon, authenticated;

create or replace function private.assessment_require(school text, want_code text, want_term text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'course', private.gradebook_scope(school, want_code, want_term)) then
    raise exception 'semester: that needs % on this course in %', want_cap, want_term using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.assessment_require(text, text, text, text) from public, anon, authenticated;

-- Raises unless an item's options and key make sense for its kind.
create or replace function private.assessment_validate_item(want_kind text, want_options jsonb, want_key jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  ids text[];
  n   integer;
begin
  if want_kind in ('multiple_choice', 'multiple_response') then
    if jsonb_typeof(want_options) <> 'array' or jsonb_array_length(want_options) not between 2 and 10 then
      raise exception 'semester: a choice question has two to ten options' using errcode = 'check_violation';
    end if;
    if exists (select 1 from jsonb_array_elements(want_options) o
                where jsonb_typeof(o) <> 'object' or coalesce(o->>'id', '') !~ '^[A-Za-z0-9_-]{1,20}$' or length(btrim(coalesce(o->>'text', ''))) = 0) then
      raise exception 'semester: every option has an id and some text' using errcode = 'check_violation';
    end if;
    select array_agg(o->>'id') into ids from jsonb_array_elements(want_options) o;
    if (select count(distinct x) from unnest(ids) x) <> array_length(ids, 1) then
      raise exception 'semester: option ids are unique' using errcode = 'check_violation';
    end if;
    if want_kind = 'multiple_choice' then
      if jsonb_typeof(want_key->'correct') <> 'string' or not (want_key->>'correct' = any(ids)) then
        raise exception 'semester: the key names one of the options' using errcode = 'check_violation';
      end if;
    else
      if jsonb_typeof(want_key->'correct') <> 'array' then raise exception 'semester: the key lists the correct options' using errcode = 'check_violation'; end if;
      n := jsonb_array_length(want_key->'correct');
      if n < 1 or exists (select 1 from jsonb_array_elements_text(want_key->'correct') c where not (c = any(ids))) then
        raise exception 'semester: the key names at least one of the options, and only options' using errcode = 'check_violation';
      end if;
    end if;
  elsif want_kind = 'true_false' then
    if jsonb_typeof(want_key->'correct') <> 'boolean' then raise exception 'semester: the key is true or false' using errcode = 'check_violation'; end if;
  elsif want_kind = 'numeric' then
    if jsonb_typeof(want_key->'value') <> 'number' or (want_key ? 'tolerance' and (jsonb_typeof(want_key->'tolerance') <> 'number' or (want_key->>'tolerance')::numeric < 0)) then
      raise exception 'semester: the key is a number, with an optional tolerance of zero or more' using errcode = 'check_violation';
    end if;
  elsif want_kind = 'short_answer' then
    if jsonb_typeof(want_key->'accepted') <> 'array' or jsonb_array_length(want_key->'accepted') not between 1 and 20
       or exists (select 1 from jsonb_array_elements(want_key->'accepted') a where jsonb_typeof(a) <> 'string' or length(btrim(a #>> '{}')) = 0) then
      raise exception 'semester: the key lists the accepted answers' using errcode = 'check_violation';
    end if;
  elsif want_kind = 'essay' then
    null;
  else
    raise exception 'semester: unknown question kind %', want_kind using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.assessment_validate_item(text, jsonb, jsonb) from public, anon, authenticated;

-- Raises unless an answer has the shape its item's kind takes.
create or replace function private.assessment_validate_answer(want_kind text, want_options jsonb, want_answer jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  ids text[];
begin
  select coalesce(array_agg(o->>'id'), '{}') into ids from jsonb_array_elements(want_options) o;
  if want_kind = 'multiple_choice' then
    if jsonb_typeof(want_answer->'choice') <> 'string' or not (want_answer->>'choice' = any(ids)) then
      raise exception 'semester: pick one of the options' using errcode = 'check_violation';
    end if;
  elsif want_kind = 'multiple_response' then
    if jsonb_typeof(want_answer->'choices') <> 'array' or exists (select 1 from jsonb_array_elements_text(want_answer->'choices') c where not (c = any(ids))) then
      raise exception 'semester: pick from the options' using errcode = 'check_violation';
    end if;
  elsif want_kind = 'true_false' then
    if jsonb_typeof(want_answer->'value') <> 'boolean' then raise exception 'semester: answer true or false' using errcode = 'check_violation'; end if;
  elsif want_kind = 'numeric' then
    if jsonb_typeof(want_answer->'value') <> 'number' then raise exception 'semester: answer with a number' using errcode = 'check_violation'; end if;
  elsif want_kind in ('short_answer', 'essay') then
    if jsonb_typeof(want_answer->'text') <> 'string' or length(want_answer->>'text') > (case when want_kind = 'essay' then 20000 else 2000 end) then
      raise exception 'semester: that answer is too long' using errcode = 'check_violation';
    end if;
  end if;
end $$;
revoke all on function private.assessment_validate_answer(text, jsonb, jsonb) from public, anon, authenticated;

-- Scores one answer by the item's key. Null for an essay.
create or replace function private.assessment_mark(want_kind text, want_key jsonb, want_answer jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if want_answer is null then return false; end if;
  if want_kind = 'multiple_choice' then
    return want_answer->>'choice' = want_key->>'correct';
  elsif want_kind = 'multiple_response' then
    return (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from jsonb_array_elements_text(want_answer->'choices') x)
         = (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from jsonb_array_elements_text(want_key->'correct') x);
  elsif want_kind = 'true_false' then
    return (want_answer->>'value')::boolean = (want_key->>'correct')::boolean;
  elsif want_kind = 'numeric' then
    return abs((want_answer->>'value')::numeric - (want_key->>'value')::numeric) <= coalesce((want_key->>'tolerance')::numeric, 0);
  elsif want_kind = 'short_answer' then
    return exists (select 1 from jsonb_array_elements_text(want_key->'accepted') a
                    where lower(btrim(regexp_replace(a, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(want_answer->>'text', '\s+', ' ', 'g'))));
  end if;
  return null;
end $$;
revoke all on function private.assessment_mark(text, jsonb, jsonb) from public, anon, authenticated;

-- Finishes an attempt with what was saved: scores it and freezes it. Called
-- when a student submits, and when anything touches an attempt past its time.
create or replace function private.assessment_finalize(want_attempt uuid, want_status text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.assessment_attempts;
  it record;
  ans jsonb;
  hit boolean;
  got numeric(9, 3) := 0;
  total numeric(9, 3) := 0;
  review boolean := false;
begin
  select * into t from public.assessment_attempts x where x.id = want_attempt for update;
  if t.status <> 'in_progress' then
    return jsonb_build_object('status', t.status, 'score', t.score, 'points', t.points, 'needs_review', t.needs_review);
  end if;
  for it in select i.id, i.kind, i.answer_key, i.points from public.bank_items i where i.id = any(t.item_ids) loop
    total := total + it.points;
    select a.answer into ans from public.attempt_answers a where a.attempt_id = t.id and a.item_id = it.id;
    hit := private.assessment_mark(it.kind, it.answer_key, ans);
    if hit is null then
      review := true;
      update public.attempt_answers set correct = null, awarded = null where attempt_id = t.id and item_id = it.id;
    else
      if hit then got := got + it.points; end if;
      update public.attempt_answers set correct = hit, awarded = case when hit then it.points else 0 end
       where attempt_id = t.id and item_id = it.id;
    end if;
  end loop;
  update public.assessment_attempts
     set status = want_status, finished_at = clock_timestamp(), score = got, points = total, needs_review = review
   where id = t.id;
  return jsonb_build_object('status', want_status, 'score', got, 'points', total, 'needs_review', review);
end $$;
revoke all on function private.assessment_finalize(uuid, text) from public, anon, authenticated;

-- ── The instructor's writers ────────────────────────────────────────────

create or replace function public.assessment_bank_create(want_course text, want_term text, want_title text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', code, 'term', want_term, 'title', want_title);
  prior  jsonb;
  made   uuid;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then raise exception 'semester: that is not a term' using errcode = 'check_violation'; end if;
  perform private.assessment_require(school, code, want_term, 'assessments:author');
  prior := private.assessment_replay(school, want_key, 'bank', req);
  if prior is not null then return (prior->>'id')::uuid; end if;
  perform private.assessment_core_required(school);
  insert into public.question_banks (tenant_id, course_code, term, title, created_by, operation)
  values (school, code, want_term, btrim(coalesce(want_title, '')), me, want_key) returning id into made;
  perform private.assessment_spend(school, want_key, 'bank', req, jsonb_build_object('id', made));
  return made;
end $$;

create or replace function public.assessment_bank_add_item(
  want_bank uuid, want_kind text, want_stem text, want_options jsonb, want_answer_key jsonb, want_points numeric, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  b      public.question_banks;
  opts   jsonb := coalesce(want_options, '[]'::jsonb);
  req    jsonb;
  prior  jsonb;
  made   uuid;
begin
  select * into b from public.question_banks x where x.id = want_bank and x.tenant_id = school;
  if b.id is null then raise exception 'semester: no such bank' using errcode = 'no_data_found'; end if;
  perform private.assessment_require(school, b.course_code, b.term, 'assessments:author');
  req := jsonb_build_object('bank', want_bank, 'kind', want_kind, 'stem', want_stem, 'options', opts, 'key', want_answer_key, 'points', want_points);
  prior := private.assessment_replay(school, want_key, 'item', req);
  if prior is not null then return (prior->>'id')::uuid; end if;
  perform private.assessment_core_required(school);
  perform private.assessment_validate_item(want_kind, opts, coalesce(want_answer_key, '{}'::jsonb));
  insert into public.bank_items (tenant_id, bank_id, kind, stem, options, answer_key, points, created_by, operation)
  values (school, want_bank, want_kind, btrim(want_stem), opts, coalesce(want_answer_key, '{}'::jsonb), coalesce(want_points, 1), me, want_key)
  returning id into made;
  perform private.assessment_spend(school, want_key, 'item', req, jsonb_build_object('id', made));
  return made;
end $$;

create or replace function public.assessment_bank_retire_item(want_item uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  i      public.bank_items;
  b      public.question_banks;
  req    jsonb := jsonb_build_object('item', want_item);
begin
  select * into i from public.bank_items x where x.id = want_item and x.tenant_id = school;
  if i.id is null then raise exception 'semester: no such item' using errcode = 'no_data_found'; end if;
  select * into b from public.question_banks x where x.id = i.bank_id;
  perform private.assessment_require(school, b.course_code, b.term, 'assessments:author');
  if private.assessment_replay(school, want_key, 'retire', req) is not null then return; end if;
  perform private.assessment_core_required(school);
  update public.bank_items set retired_at = clock_timestamp() where id = want_item and retired_at is null;
  perform private.assessment_spend(school, want_key, 'retire', req, jsonb_build_object('item', want_item));
end $$;

create or replace function public.assessment_create(
  want_bank uuid, want_title text, want_instructions text, want_item_ids uuid[], want_pool_size integer,
  want_minutes integer, want_opens timestamptz, want_closes timestamptz, want_attempts integer,
  want_shuffle boolean, want_show_answers boolean, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  b      public.question_banks;
  req    jsonb;
  prior  jsonb;
  made   uuid;
  ids    uuid[] := case when want_item_ids is not null and coalesce(array_length(want_item_ids, 1), 0) > 0 then want_item_ids end;
begin
  select * into b from public.question_banks x where x.id = want_bank and x.tenant_id = school;
  if b.id is null then raise exception 'semester: no such bank' using errcode = 'no_data_found'; end if;
  perform private.assessment_require(school, b.course_code, b.term, 'assessments:author');
  req := jsonb_build_object('bank', want_bank, 'title', want_title, 'instructions', want_instructions, 'items', want_item_ids,
           'pool', want_pool_size, 'minutes', want_minutes, 'opens', want_opens, 'closes', want_closes, 'attempts', want_attempts,
           'shuffle', want_shuffle, 'show', want_show_answers);
  prior := private.assessment_replay(school, want_key, 'create', req);
  if prior is not null then return (prior->>'id')::uuid; end if;
  perform private.assessment_core_required(school);
  if (ids is null) = (want_pool_size is null) then
    raise exception 'semester: name the items, or give a pool size, not both and not neither' using errcode = 'check_violation';
  end if;
  insert into public.assessments (tenant_id, course_code, term, bank_id, title, instructions, item_ids, pool_size, minutes,
                                  opens_at, closes_at, attempts_allowed, shuffle, show_answers, created_by, operation)
  values (school, b.course_code, b.term, want_bank, btrim(coalesce(want_title, '')), coalesce(want_instructions, ''), ids, want_pool_size,
          want_minutes, want_opens, want_closes, coalesce(want_attempts, 1), coalesce(want_shuffle, false), coalesce(want_show_answers, false), me, want_key)
  returning id into made;
  perform private.assessment_spend(school, want_key, 'create', req, jsonb_build_object('id', made));
  return made;
end $$;

create or replace function public.assessment_publish(want_id uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  a      public.assessments;
  eligible integer;
  req    jsonb := jsonb_build_object('id', want_id);
begin
  select * into a from public.assessments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such test' using errcode = 'no_data_found'; end if;
  perform private.assessment_require(school, a.course_code, a.term, 'assessments:author');
  if private.assessment_replay(school, want_key, 'publish', req) is not null then return; end if;
  perform private.assessment_core_required(school);
  if a.status <> 'draft' then raise exception 'semester: only a draft is published' using errcode = 'check_violation'; end if;
  if a.item_ids is not null then
    if exists (select 1 from unnest(a.item_ids) x where not exists (
         select 1 from public.bank_items i where i.id = x and i.bank_id = a.bank_id and i.retired_at is null)) then
      raise exception 'semester: every named item must be in the bank and not retired' using errcode = 'check_violation';
    end if;
  else
    select count(*) into eligible from public.bank_items i where i.bank_id = a.bank_id and i.retired_at is null;
    if eligible < a.pool_size then
      raise exception 'semester: the pool draws % but the bank has only % usable items', a.pool_size, eligible using errcode = 'check_violation';
    end if;
  end if;
  update public.assessments set status = 'published', published_at = clock_timestamp() where id = want_id;
  perform private.assessment_spend(school, want_key, 'publish', req, jsonb_build_object('id', want_id));
end $$;

create or replace function public.assessment_close(want_id uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  a      public.assessments;
  req    jsonb := jsonb_build_object('id', want_id);
begin
  select * into a from public.assessments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such test' using errcode = 'no_data_found'; end if;
  perform private.assessment_require(school, a.course_code, a.term, 'assessments:author');
  if private.assessment_replay(school, want_key, 'close', req) is not null then return; end if;
  perform private.assessment_core_required(school);
  if a.status <> 'published' then raise exception 'semester: only a published test is closed' using errcode = 'check_violation'; end if;
  update public.assessments set status = 'closed', closes_at = least(closes_at, clock_timestamp()) where id = want_id;
  perform private.assessment_spend(school, want_key, 'close', req, jsonb_build_object('id', want_id));
end $$;

-- Extra time for one student on one test, as a percent of the limit.
create or replace function public.assessment_grant_time(
  want_assessment uuid, want_student uuid, want_percent integer, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  a      public.assessments;
  req    jsonb := jsonb_build_object('assessment', want_assessment, 'student', want_student, 'percent', want_percent, 'reason', want_reason);
  prior  jsonb;
  made   uuid;
begin
  select * into a from public.assessments x where x.id = want_assessment and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such test' using errcode = 'no_data_found'; end if;
  perform private.assessment_require(school, a.course_code, a.term, 'assessments:author');
  prior := private.assessment_replay(school, want_key, 'time', req);
  if prior is not null then return (prior->>'id')::uuid; end if;
  perform private.assessment_core_required(school);
  if not private.subject_has_capability(want_student, 'assessments:take', 'course', private.gradebook_scope(school, a.course_code, a.term)) then
    raise exception 'semester: that student is not on this course''s tests roster for %', a.term using errcode = 'check_violation';
  end if;
  insert into public.assessment_time_extensions (tenant_id, assessment_id, student_id, extra_percent, reason, granted_by, operation)
  values (school, want_assessment, want_student, want_percent, btrim(coalesce(want_reason, '')), me, want_key) returning id into made;
  perform private.assessment_spend(school, want_key, 'time', req, jsonb_build_object('id', made));
  return made;
end $$;

-- ── The student's writers ───────────────────────────────────────────────

-- Starts an attempt, or returns the one already in progress.
create or replace function public.assessment_start(want_assessment uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  a       public.assessments;
  req     jsonb := jsonb_build_object('assessment', want_assessment);
  prior   jsonb;
  t       public.assessment_attempts;
  now_ts  timestamptz := clock_timestamp();
  extra   integer;
  used    integer;
  drawn   uuid[];
  limit_m numeric;
  dl      timestamptz;
  result  jsonb;
begin
  select * into a from public.assessments x where x.id = want_assessment and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such test' using errcode = 'no_data_found'; end if;
  if not private.has_capability('assessments:take', 'course', private.gradebook_scope(school, a.course_code, a.term)) then
    raise exception 'semester: you are not on this course''s tests roster for %', a.term using errcode = 'insufficient_privilege';
  end if;
  prior := private.assessment_replay(school, want_key, 'start', req);
  if prior is not null then return prior; end if;
  perform private.assessment_core_required(school);
  perform pg_advisory_xact_lock(hashtext('assessment-start:' || want_assessment::text || ':' || me::text));

  -- The same attempt on any device: one in progress is returned, with its time.
  select * into t from public.assessment_attempts x where x.assessment_id = want_assessment and x.student_id = me and x.status = 'in_progress';
  if t.id is not null then
    if t.deadline_at > now_ts then
      result := jsonb_build_object('attempt_id', t.id, 'attempt', t.attempt, 'started_at', t.started_at, 'deadline_at', t.deadline_at, 'resumed', true);
      perform private.assessment_spend(school, want_key, 'start', req, result);
      return result;
    end if;
    perform private.assessment_finalize(t.id, 'expired');
  end if;

  if a.status <> 'published' then raise exception 'semester: this test is not open' using errcode = 'check_violation'; end if;
  select coalesce((select e.extra_percent from public.assessment_time_extensions e
                    where e.assessment_id = want_assessment and e.student_id = me order by e.created_at desc limit 1), 0) into extra;
  limit_m := a.minutes * (100 + extra) / 100.0;
  if now_ts < a.opens_at or now_ts > a.closes_at then
    raise exception 'semester: this test is not open right now' using errcode = 'check_violation';
  end if;
  select count(*) into used from public.assessment_attempts x where x.assessment_id = want_assessment and x.student_id = me;
  if used >= a.attempts_allowed then
    raise exception 'semester: you have used all % attempts', a.attempts_allowed using errcode = 'check_violation';
  end if;

  if a.item_ids is not null then
    drawn := case when a.shuffle then (select array_agg(x order by random()) from unnest(a.item_ids) x) else a.item_ids end;
  else
    select array_agg(i.id) into drawn from (
      select id from public.bank_items where bank_id = a.bank_id and retired_at is null order by random() limit a.pool_size) i;
  end if;
  if coalesce(array_length(drawn, 1), 0) = 0 then raise exception 'semester: this test has no questions' using errcode = 'check_violation'; end if;

  -- The limit, stretched by any extra time, ending when the window ends (stretched by the same extra).
  dl := least(now_ts + make_interval(secs => limit_m * 60), a.closes_at + make_interval(secs => a.minutes * extra / 100.0 * 60));
  insert into public.assessment_attempts (tenant_id, assessment_id, student_id, attempt, started_at, deadline_at, item_ids, operation)
  values (school, want_assessment, me, used + 1, now_ts, dl, drawn, want_key) returning * into t;
  result := jsonb_build_object('attempt_id', t.id, 'attempt', t.attempt, 'started_at', t.started_at, 'deadline_at', t.deadline_at, 'resumed', false);
  perform private.assessment_spend(school, want_key, 'start', req, result);
  return result;
end $$;

-- The questions of an attempt in progress, without keys, with the time left
-- and the answers already saved. Past the deadline it finishes the attempt.
create or replace function public.assessment_items(want_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t  public.assessment_attempts;
  now_ts timestamptz := clock_timestamp();
begin
  select * into t from public.assessment_attempts x where x.id = want_attempt and x.student_id = me;
  if t.id is null then raise exception 'semester: no such attempt' using errcode = 'no_data_found'; end if;
  if t.status = 'in_progress' and t.deadline_at <= now_ts then
    perform private.assessment_finalize(t.id, 'expired');
    select * into t from public.assessment_attempts x where x.id = want_attempt;
  end if;
  if t.status <> 'in_progress' then
    return jsonb_build_object('status', t.status, 'score', t.score, 'points', t.points, 'needs_review', t.needs_review, 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'status', 'in_progress', 'deadline_at', t.deadline_at, 'remaining_seconds', floor(extract(epoch from (t.deadline_at - now_ts)))::int,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'stem', i.stem, 'options', i.options, 'points', i.points)
                                        order by array_position(t.item_ids, i.id))
                         from public.bank_items i where i.id = any(t.item_ids)), '[]'::jsonb),
    'answers', coalesce((select jsonb_object_agg(a.item_id::text, a.answer) from public.attempt_answers a where a.attempt_id = t.id), '{}'::jsonb));
end $$;

-- Saves one answer and answers `{ok: true}`. The last write wins until the
-- attempt ends. Past the deadline the attempt is finished with what was saved
-- and the answer is `{ok: false, reason: 'time_up'}`: answered, not raised, so
-- the finish is kept.
create or replace function public.assessment_save_answer(want_attempt uuid, want_item uuid, want_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t  public.assessment_attempts;
  i  public.bank_items;
begin
  select * into t from public.assessment_attempts x where x.id = want_attempt and x.student_id = me;
  if t.id is null then raise exception 'semester: no such attempt' using errcode = 'no_data_found'; end if;
  if t.status <> 'in_progress' then raise exception 'semester: this attempt is finished' using errcode = 'check_violation'; end if;
  if t.deadline_at <= clock_timestamp() then
    perform private.assessment_finalize(t.id, 'expired');
    return jsonb_build_object('ok', false, 'reason', 'time_up');
  end if;
  if not (want_item = any(t.item_ids)) then raise exception 'semester: that question is not on this attempt' using errcode = 'check_violation'; end if;
  select * into i from public.bank_items x where x.id = want_item;
  perform private.assessment_validate_answer(i.kind, i.options, want_answer);
  insert into public.attempt_answers (attempt_id, item_id, tenant_id, student_id, answer, saved_at)
  values (t.id, want_item, t.tenant_id, me, want_answer, clock_timestamp())
  on conflict (attempt_id, item_id) do update set answer = excluded.answer, saved_at = excluded.saved_at;
  return jsonb_build_object('ok', true);
end $$;

-- Submits an attempt. Idempotent on its key; past the deadline it is finished
-- as expired with what was saved.
create or replace function public.assessment_finish(want_attempt uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  t      public.assessment_attempts;
  req    jsonb := jsonb_build_object('attempt', want_attempt);
  prior  jsonb;
  result jsonb;
begin
  select * into t from public.assessment_attempts x where x.id = want_attempt and x.student_id = me and x.tenant_id = school;
  if t.id is null then raise exception 'semester: no such attempt' using errcode = 'no_data_found'; end if;
  prior := private.assessment_replay(school, want_key, 'finish', req);
  if prior is not null then return prior; end if;
  perform private.assessment_core_required(school);
  result := private.assessment_finalize(t.id, case when t.deadline_at <= clock_timestamp() then 'expired' else 'submitted' end);
  perform private.assessment_spend(school, want_key, 'finish', req, result);
  return result;
end $$;

-- A student's own finished attempt: their answers and total, and what was
-- right only if the instructor chose to show it and the test has closed.
create or replace function public.assessment_review(want_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t  public.assessment_attempts;
  a  public.assessments;
  show boolean;
begin
  select * into t from public.assessment_attempts x where x.id = want_attempt and x.student_id = me;
  if t.id is null then raise exception 'semester: no such attempt' using errcode = 'no_data_found'; end if;
  if t.status = 'in_progress' then raise exception 'semester: finish the attempt first' using errcode = 'check_violation'; end if;
  select * into a from public.assessments x where x.id = t.assessment_id;
  show := a.show_answers and (a.status = 'closed' or a.closes_at <= clock_timestamp());
  return jsonb_build_object(
    'status', t.status, 'score', t.score, 'points', t.points, 'needs_review', t.needs_review, 'shown', show,
    'items', coalesce((select jsonb_agg(
        jsonb_build_object('id', i.id, 'kind', i.kind, 'stem', i.stem, 'options', i.options, 'answer', ans.answer)
        || case when show then jsonb_build_object('correct', ans.correct, 'awarded', ans.awarded, 'key', i.answer_key, 'points', i.points) else '{}'::jsonb end
        order by array_position(t.item_ids, i.id))
       from public.bank_items i
       left join public.attempt_answers ans on ans.attempt_id = t.id and ans.item_id = i.id
      where i.id = any(t.item_ids)), '[]'::jsonb));
end $$;

-- ── Who may call what ───────────────────────────────────────────────────

revoke all on function public.assessment_bank_create(text, text, text, text) from public, anon, authenticated;
revoke all on function public.assessment_bank_add_item(uuid, text, text, jsonb, jsonb, numeric, text) from public, anon, authenticated;
revoke all on function public.assessment_bank_retire_item(uuid, text) from public, anon, authenticated;
revoke all on function public.assessment_create(uuid, text, text, uuid[], integer, integer, timestamptz, timestamptz, integer, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.assessment_publish(uuid, text) from public, anon, authenticated;
revoke all on function public.assessment_close(uuid, text) from public, anon, authenticated;
revoke all on function public.assessment_grant_time(uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.assessment_start(uuid, text) from public, anon, authenticated;
revoke all on function public.assessment_items(uuid) from public, anon, authenticated;
revoke all on function public.assessment_save_answer(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.assessment_finish(uuid, text) from public, anon, authenticated;
revoke all on function public.assessment_review(uuid) from public, anon, authenticated;
grant execute on function public.assessment_bank_create(text, text, text, text) to authenticated;
grant execute on function public.assessment_bank_add_item(uuid, text, text, jsonb, jsonb, numeric, text) to authenticated;
grant execute on function public.assessment_bank_retire_item(uuid, text) to authenticated;
grant execute on function public.assessment_create(uuid, text, text, uuid[], integer, integer, timestamptz, timestamptz, integer, boolean, boolean, text) to authenticated;
grant execute on function public.assessment_publish(uuid, text) to authenticated;
grant execute on function public.assessment_close(uuid, text) to authenticated;
grant execute on function public.assessment_grant_time(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.assessment_start(uuid, text) to authenticated;
grant execute on function public.assessment_items(uuid) to authenticated;
grant execute on function public.assessment_save_answer(uuid, uuid, jsonb) to authenticated;
grant execute on function public.assessment_finish(uuid, text) to authenticated;
grant execute on function public.assessment_review(uuid) to authenticated;

-- ── An account that took a test is not untouched ────────────────────────
--
-- The previous definition is `20261001020000_attendance.sql`, with two more
-- places to look; `attempt_answers` goes with its attempt.

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
      ('public.assessment_time_extensions', 'student_id')
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
