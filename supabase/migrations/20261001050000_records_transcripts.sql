-- Semester — term grades, signed transcripts and verification letters, the
-- FERPA disclosure log and graduation clearance, when a school runs the
-- `records` module in Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- The academic-record ledger (`20260929210000_academic_record_ledger.sql`) is
-- what a registrar keeps: a change is proposed and approved by two people, and
-- an entry is never rewritten. This is what a school *does* with it.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's `records`
--     module is `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **Final grades arrive by two hands.** An instructor holding
--     `grades:release` over the course and term posts final grades
--     (`term_grades_post`); nothing reaches the record from that alone. A
--     registrar holding `records:accept` turns the posts into ledger *proposals*
--     (`term_grades_accept`), and the ledger's own rule decides them: someone
--     else approves, and correcting a grade already on the record is a
--     registrar override. A grade is never written to the ledger by the person
--     who gave it.
--   * **A document is a record.** `record_document_issue` (`records:issue`)
--     snapshots the ledger as of today into a transcript or an enrollment
--     verification letter, hashes it (SHA-256 of the canonical JSON) and signs
--     it (HMAC-SHA256 under a per-school key held in `private`, readable by no
--     client role), and keeps it with a verification code. The row is never
--     rewritten; revoking is a separate record. The code opens the document at
--     the verification endpoint (`record_document_verify`, service role only,
--     reached through the `verify-record` function), until it expires or is
--     revoked, and each opening is recorded.
--   * **Every release to anyone but the student is disclosed.** Issuing to a
--     recipient other than the student writes a disclosure row in the same
--     transaction, with the exception it relies on; written consent needs the
--     consent's reference. `record_disclosure_log` records a release made
--     outside Semester. The student reads their own log.
--   * **Graduation clearance reads, it does not decide.** `graduation_clearance_run`
--     (`records:clear`) records whether a saved degree audit is complete and
--     fresh against the ledger, no change or exception is waiting, and no
--     registration hold is open. A conferral is still proposed and approved in
--     the ledger by two people; the clearance is what they read.
--
-- ## What this is not
-- A key in an external KMS (the key is in the database, so someone who can
-- rewrite a document, its hash and the key together is not caught by the
-- signature alone; the ledger's own hash chain is the other half), a PDF
-- renderer (the app prints the signed content), a credential-exchange network
-- (Clearinghouse, Parchment), or the school's decision to confer a degree.

-- ── The capabilities ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('records:issue',  'Issue and revoke a transcript or enrollment verification and log a release made outside Semester, for one school.'),
  ('records:accept', 'Turn an instructor''s posted final grades into proposals on one school''s academic record.'),
  ('records:clear',  'Run graduation clearance for one school''s students.'),
  ('records:audit',  'Read one school''s issued documents, disclosure log, posted grades and clearances.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar', 'records:issue'),
  ('registrar', 'records:accept'),
  ('registrar', 'records:clear'),
  ('dean',      'records:clear'),
  ('registrar', 'records:audit'),
  ('dean',      'records:audit')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.records_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('post', 'accept', 'issue', 'revoke', 'disclose', 'clear')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.term_grade_posts (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   text          not null references public.schools(id) on delete cascade,
  course_code text          not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term        text          not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  student_ref text          not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  version     integer       not null check (version >= 1),
  grade       text          not null check (grade ~ '^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P|NP|W|I|AU)$'),
  credits     numeric(4, 2) not null check (credits between 0 and 20),
  posted_by   uuid          references auth.users on delete set null,
  posted_at   timestamptz   not null default clock_timestamp(),
  operation   text          not null,
  unique (tenant_id, course_code, term, student_ref, version)
);

create table if not exists public.term_grade_acceptances (
  post_id     uuid        primary key references public.term_grade_posts on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  change_ids  uuid[]      not null,
  accepted_by uuid        references auth.users on delete set null,
  accepted_at timestamptz not null default clock_timestamp()
);

create table if not exists public.record_documents (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  student_ref    text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  kind           text        not null check (kind in ('transcript', 'enrollment_verification')),
  code           text        not null unique check (code ~ '^[0-9A-F]{24}$'),
  as_of          date        not null,
  content        jsonb       not null,
  content_hash   text        not null check (content_hash ~ '^[0-9a-f]{64}$'),
  signature      text        not null check (signature ~ '^[0-9a-f]{64}$'),
  recipient      text        not null default '' check (length(recipient) <= 200),
  recipient_kind text        not null check (recipient_kind in ('student', 'school_official', 'consent', 'directory', 'health_safety', 'subpoena', 'other_exception')),
  issued_by      uuid        references auth.users on delete set null,
  issued_at      timestamptz not null default clock_timestamp(),
  expires_at     timestamptz not null,
  operation      text        not null
);

create table if not exists public.record_document_revocations (
  document_id uuid        primary key references public.record_documents on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  reason      text        not null check (length(btrim(reason)) between 10 and 1000),
  revoked_by  uuid        references auth.users on delete set null,
  revoked_at  timestamptz not null default clock_timestamp()
);

create table if not exists public.record_document_openings (
  id          uuid        primary key default gen_random_uuid(),
  document_id uuid        not null references public.record_documents on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  outcome     text        not null check (outcome in ('opened', 'expired', 'revoked', 'altered')),
  at          timestamptz not null default clock_timestamp()
);

create table if not exists public.record_disclosures (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  student_ref    text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  recipient      text        not null check (length(btrim(recipient)) between 2 and 200),
  recipient_kind text        not null check (recipient_kind in ('school_official', 'consent', 'directory', 'health_safety', 'subpoena', 'other_exception')),
  basis          text        not null check (length(btrim(basis)) between 10 and 1000),
  consent_ref    text        not null default '' check (length(consent_ref) <= 200),
  what           text        not null check (length(btrim(what)) between 3 and 500),
  document_id    uuid        references public.record_documents on delete set null,
  released_by    uuid        references auth.users on delete set null,
  released_at    timestamptz not null default clock_timestamp(),
  operation      text        not null,
  constraint record_disclosure_consent check (recipient_kind <> 'consent' or length(btrim(consent_ref)) >= 3)
);

create table if not exists public.graduation_clearances (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  student_ref text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  status      text        not null check (status in ('cleared', 'blocked')),
  checks      jsonb       not null,
  run_by      uuid        references auth.users on delete set null,
  run_at      timestamptz not null default clock_timestamp(),
  operation   text        not null
);

create table if not exists private.records_signing_key (
  tenant_id  text        primary key references public.schools(id) on delete cascade,
  key        bytea       not null,
  created_at timestamptz not null default now()
);
alter table private.records_signing_key enable row level security;
revoke all on table private.records_signing_key from public, anon, authenticated;

create index if not exists records_operations_by_actor on public.records_operations (actor);
create index if not exists term_grade_posts_by_course on public.term_grade_posts (tenant_id, course_code, term);
create index if not exists term_grade_posts_by_poster on public.term_grade_posts (posted_by);
create index if not exists term_grade_acceptances_by_tenant on public.term_grade_acceptances (tenant_id);
create index if not exists term_grade_acceptances_by_acceptor on public.term_grade_acceptances (accepted_by);
create index if not exists record_documents_by_student on public.record_documents (tenant_id, student_ref, issued_at desc);
create index if not exists record_documents_by_issuer on public.record_documents (issued_by);
create index if not exists record_document_revocations_by_tenant on public.record_document_revocations (tenant_id);
create index if not exists record_document_revocations_by_revoker on public.record_document_revocations (revoked_by);
create index if not exists record_document_openings_by_document on public.record_document_openings (document_id, at desc);
create index if not exists record_document_openings_by_tenant on public.record_document_openings (tenant_id);
create index if not exists record_disclosures_by_student on public.record_disclosures (tenant_id, student_ref, released_at desc);
create index if not exists record_disclosures_by_document on public.record_disclosures (document_id);
create index if not exists record_disclosures_by_releaser on public.record_disclosures (released_by);
create index if not exists graduation_clearances_by_student on public.graduation_clearances (tenant_id, student_ref, run_at desc);
create index if not exists graduation_clearances_by_runner on public.graduation_clearances (run_by);

comment on table public.records_operations is 'Idempotency keys the records writers spent, with what each asked and answered. Append-only.';
comment on table public.term_grade_posts is 'Final grades an instructor posted for a course and term. Nothing reaches the ledger from this alone; a registrar accepts them into proposals.';
comment on table public.term_grade_acceptances is 'Which ledger proposals a posted grade became, and who accepted it.';
comment on table public.record_documents is 'An issued transcript or enrollment verification: the content, its SHA-256, its HMAC signature and its verification code. Never rewritten.';
comment on table public.record_document_revocations is 'A document revoked, with a reason. The document row itself is never touched.';
comment on table public.record_document_openings is 'Each time a verification code opened, or failed to open, a document.';
comment on table public.record_disclosures is 'Every release of a student''s record to anyone but the student, with the exception relied on. Append-only; the student reads their own.';
comment on table public.graduation_clearances is 'The result of a graduation clearance run: what was checked and what blocked. Never rewritten.';

-- ── Guards ──────────────────────────────────────────────────────────────

-- These rows are never rewritten. The one thing that may touch one is
-- `ON DELETE SET NULL` of the staff column that names who wrote it.
create or replace function private.guard_records_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  staff_col text := case tg_table_name
    when 'term_grade_posts' then 'posted_by'
    when 'term_grade_acceptances' then 'accepted_by'
    when 'record_documents' then 'issued_by'
    when 'record_document_revocations' then 'revoked_by'
    when 'record_disclosures' then 'released_by'
    when 'graduation_clearances' then 'run_by'
    else null end;
  was uuid;
  became uuid;
begin
  if staff_col is not null then
    was := (to_jsonb(old) ->> staff_col)::uuid;
    became := (to_jsonb(new) ->> staff_col)::uuid;
    if (to_jsonb(new) - staff_col) is not distinct from (to_jsonb(old) - staff_col) and (became is null or became is not distinct from was) then
      return new;
    end if;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_records_record() from public, anon, authenticated;

drop trigger if exists term_grade_posts_never_rewritten on public.term_grade_posts;
create trigger term_grade_posts_never_rewritten before update on public.term_grade_posts
for each row execute function private.guard_records_record();
drop trigger if exists term_grade_acceptances_never_rewritten on public.term_grade_acceptances;
create trigger term_grade_acceptances_never_rewritten before update on public.term_grade_acceptances
for each row execute function private.guard_records_record();
drop trigger if exists record_documents_never_rewritten on public.record_documents;
create trigger record_documents_never_rewritten before update on public.record_documents
for each row execute function private.guard_records_record();
drop trigger if exists record_document_revocations_never_rewritten on public.record_document_revocations;
create trigger record_document_revocations_never_rewritten before update on public.record_document_revocations
for each row execute function private.guard_records_record();
drop trigger if exists record_disclosures_never_rewritten on public.record_disclosures;
create trigger record_disclosures_never_rewritten before update on public.record_disclosures
for each row execute function private.guard_records_record();
drop trigger if exists graduation_clearances_never_rewritten on public.graduation_clearances;
create trigger graduation_clearances_never_rewritten before update on public.graduation_clearances
for each row execute function private.guard_records_record();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.records_staff(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability('records:audit', 'school', want_tenant);
$$;
revoke all on function private.records_staff(text) from public, anon, authenticated;
grant execute on function private.records_staff(text) to authenticated;

create or replace function private.records_is_subject(want_tenant text, want_student text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.academic_record_subjects s
                  where s.tenant_id = want_tenant and s.student_ref = want_student and s.user_id = (select auth.uid()));
$$;
revoke all on function private.records_is_subject(text, text) from public, anon, authenticated;
grant execute on function private.records_is_subject(text, text) to authenticated;

alter table public.records_operations enable row level security;
alter table public.term_grade_posts enable row level security;
alter table public.term_grade_acceptances enable row level security;
alter table public.record_documents enable row level security;
alter table public.record_document_revocations enable row level security;
alter table public.record_document_openings enable row level security;
alter table public.record_disclosures enable row level security;
alter table public.graduation_clearances enable row level security;

revoke all on table public.records_operations from public, anon, authenticated;
revoke all on table public.term_grade_posts from public, anon, authenticated;
revoke all on table public.term_grade_acceptances from public, anon, authenticated;
revoke all on table public.record_documents from public, anon, authenticated;
revoke all on table public.record_document_revocations from public, anon, authenticated;
revoke all on table public.record_document_openings from public, anon, authenticated;
revoke all on table public.record_disclosures from public, anon, authenticated;
revoke all on table public.graduation_clearances from public, anon, authenticated;
grant select on table public.records_operations to authenticated;
grant select on table public.term_grade_posts to authenticated;
grant select on table public.term_grade_acceptances to authenticated;
grant select on table public.record_documents to authenticated;
grant select on table public.record_document_revocations to authenticated;
grant select on table public.record_document_openings to authenticated;
grant select on table public.record_disclosures to authenticated;
grant select on table public.graduation_clearances to authenticated;

drop policy if exists "callers read their own records operations" on public.records_operations;
create policy "callers read their own records operations" on public.records_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "the poster and records staff read posted grades" on public.term_grade_posts;
create policy "the poster and records staff read posted grades" on public.term_grade_posts
  for select to authenticated using (posted_by = (select auth.uid()) or private.records_staff(tenant_id));

drop policy if exists "records staff read acceptances" on public.term_grade_acceptances;
create policy "records staff read acceptances" on public.term_grade_acceptances
  for select to authenticated using (private.records_staff(tenant_id));

drop policy if exists "staff and the student read an issued document" on public.record_documents;
create policy "staff and the student read an issued document" on public.record_documents
  for select to authenticated using (private.records_staff(tenant_id) or private.records_is_subject(tenant_id, student_ref));

drop policy if exists "whoever reads the document reads its revocation" on public.record_document_revocations;
create policy "whoever reads the document reads its revocation" on public.record_document_revocations
  for select to authenticated using (exists (select 1 from public.record_documents d where d.id = document_id));

drop policy if exists "whoever reads the document reads its openings" on public.record_document_openings;
create policy "whoever reads the document reads its openings" on public.record_document_openings
  for select to authenticated using (exists (select 1 from public.record_documents d where d.id = document_id));

drop policy if exists "staff and the student read the disclosure log" on public.record_disclosures;
create policy "staff and the student read the disclosure log" on public.record_disclosures
  for select to authenticated using (private.records_staff(tenant_id) or private.records_is_subject(tenant_id, student_ref));

drop policy if exists "staff and the student read a clearance" on public.graduation_clearances;
create policy "staff and the student read a clearance" on public.graduation_clearances
  for select to authenticated using (private.records_staff(tenant_id) or private.records_is_subject(tenant_id, student_ref));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.records_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.records_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('records-op:' || school || ':' || want_key));
  select * into op from public.records_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.records_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.records_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.records_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.records_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.records_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'records') then
    raise exception 'semester: this school does not run records in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.records_core_required(text) from public, anon, authenticated;

create or replace function private.records_require(school text, want_cap text)
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
revoke all on function private.records_require(text, text) from public, anon, authenticated;

-- The school's signing key, made the first time it is needed.
create or replace function private.records_key(school text)
returns bytea
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k bytea;
begin
  select s.key into k from private.records_signing_key s where s.tenant_id = school;
  if k is null then
    insert into private.records_signing_key (tenant_id, key)
    values (school, decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'))
    on conflict (tenant_id) do nothing;
    select s.key into k from private.records_signing_key s where s.tenant_id = school;
  end if;
  return k;
end $$;
revoke all on function private.records_key(text) from public, anon, authenticated;

-- What a signature covers: the row's identity, its content hash and when it was issued.
create or replace function private.records_signed_text(d public.record_documents)
returns text
language sql
immutable
set search_path = ''
as $$
  select d.id::text || '|' || d.tenant_id || '|' || d.student_ref || '|' || d.kind || '|'
         || to_char(d.issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || d.content_hash;
$$;
revoke all on function private.records_signed_text(public.record_documents) from public, anon, authenticated;

create or replace function private.records_hash(want jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(want::text, 'UTF8')), 'hex');
$$;
revoke all on function private.records_hash(jsonb) from public, anon, authenticated;

-- The ledger as of today: the entry in effect on each line, of the given kinds.
create or replace function private.records_snapshot(want_tenant text, want_student text, want_kinds text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'key', x.subject_key, 'value', x.value, 'effective_on', x.effective_on)
                            order by x.kind, x.effective_on, x.subject_key), '[]'::jsonb)
    from (select distinct on (e.kind, e.subject_key) e.kind, e.subject_key, e.action, e.value, e.effective_on
            from public.academic_record_entries e
           where e.tenant_id = want_tenant and e.student_ref = want_student
             and e.kind = any (want_kinds) and e.effective_on <= current_date
           order by e.kind, e.subject_key, e.effective_on desc, e.recorded_at desc, e.id desc) x
   where x.action = 'set';
$$;
revoke all on function private.records_snapshot(text, text, text[]) from public, anon, authenticated;

-- 2026FA -> Fall 2026, the way the ledger keys a course's term.
create or replace function private.records_term_label(want_term text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case substr(want_term, 5, 2) when 'FA' then 'Fall' when 'SP' then 'Spring' else 'Summer' end || ' ' || substr(want_term, 1, 4);
$$;
revoke all on function private.records_term_label(text) from public, anon, authenticated;

-- ── Final grades ────────────────────────────────────────────────────────

-- An instructor posts final grades: [{student: <account id>, grade, credits}].
-- A student with no record link is skipped and said so, never guessed.
create or replace function public.term_grades_post(want_course text, want_term text, want_grades jsonb, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  ccode   text := private.course_code(want_course);
  req     jsonb := jsonb_build_object('course', private.course_code(want_course), 'term', want_term, 'grades', want_grades);
  prior   jsonb;
  g       jsonb;
  who     uuid;
  sref    text;
  last_v  integer;
  posted  integer := 0;
  skipped jsonb := '[]'::jsonb;
  result  jsonb;
begin
  if ccode = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  perform private.gradebook_require(school, ccode, want_term, 'grades:release', false);
  prior := private.records_replay(school, want_key, 'post', req);
  if prior is not null then return prior; end if;
  perform private.records_core_required(school);
  if want_grades is null or jsonb_typeof(want_grades) <> 'array' or jsonb_array_length(want_grades) = 0 then
    raise exception 'semester: post at least one grade' using errcode = 'check_violation';
  end if;

  for g in select * from jsonb_array_elements(want_grades) loop
    who := (g->>'student')::uuid;
    if who = me then raise exception 'semester: nobody posts their own grade' using errcode = 'insufficient_privilege'; end if;
    if not private.subject_has_capability(who, 'grades:receive', 'course', private.gradebook_scope(school, ccode, want_term)) then
      raise exception 'semester: a student in these grades is not enrolled in this course' using errcode = 'check_violation';
    end if;
    select s.student_ref into sref from public.academic_record_subjects s where s.tenant_id = school and s.user_id = who;
    if sref is null then
      skipped := skipped || jsonb_build_array(jsonb_build_object('student', who, 'why', 'no record link'));
      continue;
    end if;
    select max(p.version) into last_v from public.term_grade_posts p
     where p.tenant_id = school and p.course_code = ccode and p.term = want_term and p.student_ref = sref;
    if last_v is not null and exists (select 1 from public.term_grade_acceptances a join public.term_grade_posts p on p.id = a.post_id
                                       where p.tenant_id = school and p.course_code = ccode and p.term = want_term and p.student_ref = sref) then
      raise exception 'semester: that grade is already accepted onto the record; a correction goes to the registrar' using errcode = 'check_violation';
    end if;
    insert into public.term_grade_posts (tenant_id, course_code, term, student_ref, version, grade, credits, posted_by, operation)
    values (school, ccode, want_term, sref, coalesce(last_v, 0) + 1, upper(btrim(g->>'grade')), (g->>'credits')::numeric, me, want_key);
    posted := posted + 1;
  end loop;
  result := jsonb_build_object('posted', posted, 'skipped', skipped);
  perform private.records_spend(school, want_key, 'post', req, result);
  return result;
end $$;

-- A registrar turns each unaccepted latest post for a course and term into two
-- ledger proposals (grade and credit). The ledger's own rule decides them.
create or replace function public.term_grades_accept(want_course text, want_term text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  ccode  text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', private.course_code(want_course), 'term', want_term);
  prior  jsonb;
  p      public.term_grade_posts;
  skey   text;
  g_id   uuid;
  c_id   uuid;
  n      integer := 0;
  result jsonb;
begin
  perform private.records_require(school, 'records:accept');
  prior := private.records_replay(school, want_key, 'accept', req);
  if prior is not null then return prior; end if;
  perform private.records_core_required(school);
  skey := ccode || ' · ' || private.records_term_label(want_term);
  for p in
    select x.* from public.term_grade_posts x
     where x.tenant_id = school and x.course_code = ccode and x.term = want_term
       and x.version = (select max(y.version) from public.term_grade_posts y
                         where y.tenant_id = x.tenant_id and y.course_code = x.course_code and y.term = x.term and y.student_ref = x.student_ref)
       and not exists (select 1 from public.term_grade_acceptances a where a.post_id = x.id)
     order by x.student_ref
  loop
    insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
    values (school, p.student_ref, 'grade', skey, 'set', p.grade, current_date,
            'Final grade posted by the instructor for ' || skey || ' and accepted by the registrar.', 'faculty') returning id into g_id;
    insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
    values (school, p.student_ref, 'credit', skey, 'set', trim_scale(p.credits)::text, current_date,
            'Credits for ' || skey || ' posted with the final grade.', 'faculty') returning id into c_id;
    insert into public.term_grade_acceptances (post_id, tenant_id, change_ids, accepted_by) values (p.id, school, array[g_id, c_id], me);
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'semester: no posted grades are waiting for this course and term' using errcode = 'no_data_found'; end if;
  result := jsonb_build_object('proposed', n);
  perform private.records_spend(school, want_key, 'accept', req, result);
  return result;
end $$;

-- ── Documents and disclosures ───────────────────────────────────────────

create or replace function public.record_document_issue(
  want_student text, want_kind text, want_recipient text, want_recipient_kind text,
  want_basis text, want_consent text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  req     jsonb := jsonb_build_object('student', want_student, 'kind', want_kind, 'recipient', coalesce(want_recipient, ''),
                     'recipient_kind', want_recipient_kind, 'basis', coalesce(want_basis, ''), 'consent', coalesce(want_consent, ''));
  prior   jsonb;
  doc     public.record_documents;
  body    jsonb;
  kinds   text[];
  school_name text;
  code    text;
  result  jsonb;
begin
  perform private.records_require(school, 'records:issue');
  prior := private.records_replay(school, want_key, 'issue', req);
  if prior is not null then return prior; end if;
  perform private.records_core_required(school);
  if want_kind not in ('transcript', 'enrollment_verification') then
    raise exception 'semester: a document is a transcript or an enrollment verification' using errcode = 'check_violation';
  end if;
  if want_recipient_kind is null or want_recipient_kind not in ('student', 'school_official', 'consent', 'directory', 'health_safety', 'subpoena', 'other_exception') then
    raise exception 'semester: say who it is released to, and under which exception' using errcode = 'check_violation';
  end if;
  if want_recipient_kind <> 'student' and (length(btrim(coalesce(want_recipient, ''))) < 2 or length(btrim(coalesce(want_basis, ''))) < 10) then
    raise exception 'semester: a release to anyone but the student names the recipient and the basis' using errcode = 'check_violation';
  end if;
  if want_recipient_kind = 'consent' and length(btrim(coalesce(want_consent, ''))) < 3 then
    raise exception 'semester: a release on written consent names the consent' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.academic_record_entries e where e.tenant_id = school and e.student_ref = want_student) then
    raise exception 'semester: that student has nothing on the record' using errcode = 'no_data_found';
  end if;

  kinds := case want_kind when 'transcript' then array['enrollment', 'grade', 'credit', 'transfer_credit', 'standing', 'conferral']
                          else array['enrollment', 'standing', 'conferral'] end;
  select s.name into school_name from public.schools s where s.id = school;
  body := jsonb_build_object('school', school_name, 'student_ref', want_student, 'kind', want_kind, 'as_of', current_date,
                             'entries', private.records_snapshot(school, want_student, kinds));
  code := upper(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 24));

  doc.id := gen_random_uuid();
  doc.tenant_id := school;
  doc.student_ref := want_student;
  doc.kind := want_kind;
  doc.issued_at := clock_timestamp();
  doc.content_hash := private.records_hash(body);
  insert into public.record_documents (id, tenant_id, student_ref, kind, code, as_of, content, content_hash, signature,
                                       recipient, recipient_kind, issued_by, issued_at, expires_at, operation)
  values (doc.id, school, want_student, want_kind, code, current_date, body, doc.content_hash,
          private.console_audit_hmac(private.records_signed_text(doc), private.records_key(school)),
          btrim(coalesce(want_recipient, '')), want_recipient_kind, me, doc.issued_at, doc.issued_at + interval '180 days', want_key);

  if want_recipient_kind <> 'student' then
    insert into public.record_disclosures (tenant_id, student_ref, recipient, recipient_kind, basis, consent_ref, what, document_id, released_by, operation)
    values (school, want_student, btrim(want_recipient), want_recipient_kind, btrim(want_basis), btrim(coalesce(want_consent, '')),
            case want_kind when 'transcript' then 'Official transcript' else 'Enrollment verification' end, doc.id, me, want_key);
  end if;
  result := jsonb_build_object('id', doc.id, 'code', code);
  perform private.records_spend(school, want_key, 'issue', req, result);
  return result;
end $$;

create or replace function public.record_document_revoke(want_id uuid, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('id', want_id, 'reason', coalesce(want_reason, ''));
  prior  jsonb;
  result jsonb;
begin
  perform private.records_require(school, 'records:issue');
  prior := private.records_replay(school, want_key, 'revoke', req);
  if prior is not null then return prior; end if;
  perform private.records_core_required(school);
  if not exists (select 1 from public.record_documents d where d.id = want_id and d.tenant_id = school) then
    raise exception 'semester: no such document' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.record_document_revocations r where r.document_id = want_id) then
    raise exception 'semester: that document is already revoked' using errcode = 'check_violation';
  end if;
  insert into public.record_document_revocations (document_id, tenant_id, reason, revoked_by) values (want_id, school, btrim(coalesce(want_reason, '')), me);
  result := jsonb_build_object('id', want_id, 'revoked', true);
  perform private.records_spend(school, want_key, 'revoke', req, result);
  return result;
end $$;

-- A release made outside Semester, logged so the student's log is whole.
create or replace function public.record_disclosure_log(
  want_student text, want_recipient text, want_recipient_kind text, want_basis text, want_consent text, want_what text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('student', want_student, 'recipient', coalesce(want_recipient, ''), 'recipient_kind', want_recipient_kind,
                    'basis', coalesce(want_basis, ''), 'consent', coalesce(want_consent, ''), 'what', coalesce(want_what, ''));
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.records_require(school, 'records:issue');
  prior := private.records_replay(school, want_key, 'disclose', req);
  if prior is not null then return prior; end if;
  perform private.records_core_required(school);
  insert into public.record_disclosures (tenant_id, student_ref, recipient, recipient_kind, basis, consent_ref, what, released_by, operation)
  values (school, want_student, btrim(coalesce(want_recipient, '')), want_recipient_kind, btrim(coalesce(want_basis, '')),
          btrim(coalesce(want_consent, '')), btrim(coalesce(want_what, '')), me, want_key)
  returning id into made;
  result := jsonb_build_object('id', made);
  perform private.records_spend(school, want_key, 'disclose', req, result);
  return result;
end $$;

-- Opens a document by its code, for the verification endpoint only. The service
-- role calls this; no signed-in or signed-out client role can. A wrong code is
-- a plain "no". An altered row, an expired code and a revoked document each
-- say so and show no content.
create or replace function public.record_document_verify(want_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d      public.record_documents;
  rev    public.record_document_revocations;
  clean  text := upper(regexp_replace(coalesce(want_code, ''), '[^0-9A-Fa-f]', '', 'g'));
  intact boolean;
  school_name text;
begin
  if clean !~ '^[0-9A-F]{24}$' then return jsonb_build_object('valid', false, 'reason', 'unknown'); end if;
  select * into d from public.record_documents x where x.code = clean;
  if d.id is null then return jsonb_build_object('valid', false, 'reason', 'unknown'); end if;
  select * into rev from public.record_document_revocations r where r.document_id = d.id;
  intact := d.content_hash = private.records_hash(d.content)
        and d.signature = private.console_audit_hmac(private.records_signed_text(d), private.records_key(d.tenant_id));
  select s.name into school_name from public.schools s where s.id = d.tenant_id;
  if not intact then
    insert into public.record_document_openings (document_id, tenant_id, outcome) values (d.id, d.tenant_id, 'altered');
    return jsonb_build_object('valid', false, 'reason', 'altered', 'school', school_name);
  end if;
  if rev.document_id is not null then
    insert into public.record_document_openings (document_id, tenant_id, outcome) values (d.id, d.tenant_id, 'revoked');
    return jsonb_build_object('valid', false, 'reason', 'revoked', 'school', school_name, 'revoked_at', rev.revoked_at);
  end if;
  if clock_timestamp() > d.expires_at then
    insert into public.record_document_openings (document_id, tenant_id, outcome) values (d.id, d.tenant_id, 'expired');
    return jsonb_build_object('valid', false, 'reason', 'expired', 'school', school_name, 'expired_at', d.expires_at);
  end if;
  insert into public.record_document_openings (document_id, tenant_id, outcome) values (d.id, d.tenant_id, 'opened');
  return jsonb_build_object('valid', true, 'kind', d.kind, 'school', school_name, 'issued_at', d.issued_at, 'as_of', d.as_of,
                            'expires_at', d.expires_at, 'hash', d.content_hash, 'content', d.content);
end $$;

-- ── Graduation clearance ────────────────────────────────────────────────

create or replace function public.graduation_clearance_run(want_student text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  req     jsonb := jsonb_build_object('student', want_student);
  prior   jsonb;
  declared uuid;
  run     public.degree_audit_runs;
  fp      text;
  who     uuid;
  offices text;
  blocks  jsonb := '[]'::jsonb;
  checks  jsonb;
  made    uuid;
  result  jsonb;
begin
  perform private.records_require(school, 'records:clear');
  prior := private.records_replay(school, want_key, 'clear', req);
  if prior is not null then return prior; end if;
  perform private.records_core_required(school);
  if want_student is null or want_student !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: that is not a student reference' using errcode = 'check_violation';
  end if;

  select d.version_id into declared from public.student_degrees d
   where d.tenant_id = school and d.student_ref = want_student order by d.declared_at desc, d.id desc limit 1;
  if declared is null then
    blocks := blocks || jsonb_build_array('The student is not held to a catalog year.');
  else
    select * into run from public.degree_audit_runs r
     where r.tenant_id = school and r.student_ref = want_student and r.version_id = declared order by r.run_at desc, r.id desc limit 1;
    select encode(sha256(convert_to(coalesce(string_agg(e.id::text || e.recorded_at::text, ',' order by e.id), ''), 'UTF8')), 'hex')
      into fp from public.academic_record_entries e
     where e.tenant_id = school and e.student_ref = want_student and e.kind in ('grade', 'credit', 'transfer_credit');
    if run.id is null then
      blocks := blocks || jsonb_build_array('No degree audit has been saved for the catalog year they are held to.');
    elsif run.result->>'status' <> 'complete' then
      blocks := blocks || jsonb_build_array('The saved degree audit is not complete.');
    elsif run.fingerprint <> fp then
      blocks := blocks || jsonb_build_array('The record has changed since the degree audit was saved; run it again.');
    end if;
  end if;
  if exists (select 1 from public.academic_record_changes c where c.tenant_id = school and c.student_ref = want_student and c.status = 'proposed') then
    blocks := blocks || jsonb_build_array('A change to the record is waiting for a decision.');
  end if;
  if exists (select 1 from public.degree_exceptions x where x.tenant_id = school and x.student_ref = want_student and x.status = 'proposed') then
    blocks := blocks || jsonb_build_array('A waiver or substitution is waiting for a decision.');
  end if;
  select s.user_id into who from public.academic_record_subjects s where s.tenant_id = school and s.student_ref = want_student;
  if who is null then
    blocks := blocks || jsonb_build_array('No account is linked to this record, so holds could not be checked.');
  else
    select string_agg(h.office, ', ' order by h.office) into offices from public.registration_holds h
     where h.tenant_id = school and h.student = who and h.released_at is null;
    if offices is not null then blocks := blocks || jsonb_build_array('An open hold: ' || offices || '.'); end if;
  end if;

  checks := jsonb_build_object('blocks', blocks, 'version', declared, 'audit_run', run.id, 'ledger_fingerprint', fp);
  insert into public.graduation_clearances (tenant_id, student_ref, status, checks, run_by, operation)
  values (school, want_student, case when jsonb_array_length(blocks) = 0 then 'cleared' else 'blocked' end, checks, me, want_key)
  returning id into made;
  result := jsonb_build_object('id', made, 'status', case when jsonb_array_length(blocks) = 0 then 'cleared' else 'blocked' end, 'blocks', blocks);
  perform private.records_spend(school, want_key, 'clear', req, result);
  return result;
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────

revoke all on function public.term_grades_post(text, text, jsonb, text) from public, anon;
revoke all on function public.term_grades_accept(text, text, text) from public, anon;
revoke all on function public.record_document_issue(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.record_document_revoke(uuid, text, text) from public, anon;
revoke all on function public.record_disclosure_log(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.graduation_clearance_run(text, text) from public, anon;
grant execute on function public.term_grades_post(text, text, jsonb, text) to authenticated;
grant execute on function public.term_grades_accept(text, text, text) to authenticated;
grant execute on function public.record_document_issue(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.record_document_revoke(uuid, text, text) to authenticated;
grant execute on function public.record_disclosure_log(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.graduation_clearance_run(text, text) to authenticated;

-- The verification function is for the endpoint alone: service role, nobody else.
revoke all on function public.record_document_verify(text) from public, anon, authenticated;
grant execute on function public.record_document_verify(text) to service_role;
