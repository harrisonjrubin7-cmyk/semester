-- Semester — a student asks their instructor for an extension, an excused
-- absence or an incomplete, and the instructor answers.
--
-- Slice 3 of the unified-workspace plan. Until now a student who needed more
-- time, or missed a class for a reason, had only the email drafter
-- (`app/src/lib/mail.ts`, a device-local helper that writes a message and
-- records nothing) and the instructor had no queue: nothing said what was
-- asked, who answered, or what was granted. This file is that record.
--
-- What it decides, and where:
--
--   * **Scope.** A request is about one course in one term, keyed exactly as
--     the gradebook keys one: `<school>/<CODE>/<TERM>` (20260929310000). The
--     school is the caller's own (`profiles.school_id`), never a parameter.
--     A grant on another course, another term, the untermed course or at
--     another school authorises nothing here.
--   * **Who asks.** A new capability, `course_requests:create`, held by the
--     student roles that carry `grades:receive`, at course-and-term scope. A
--     request may name one of the course's gradebook items; an item on
--     another course, term or school is "no such item on this course".
--   * **Who answers.** `course_requests:decide`, held by `faculty` only.
--     Teaching assistants hold `course_requests:view`: they read the queue
--     and do not decide it. That split is an owner decision recorded in
--     D-1658 — an extension or an incomplete changes what the
--     course of record expects of a student, which is the instructor's call.
--     Nobody decides a request they filed.
--   * **Who reads.** The student their own; holders of `:decide` or `:view`
--     on the course and term, at their own school. Not the registrar, not a
--     chair, not another student, not the course's other terms.
--   * **States.** `open` → `info_requested` (the instructor asks a question)
--     → `open` (the student answers) → `approved` | `denied`; the student may
--     withdraw while `open` or `info_requested`. `approved`, `denied` and
--     `withdrawn` are closed: nothing moves a closed request. An approved
--     extension carries a `granted_due`, which may differ from the date asked.
--   * **Expected version.** Every change after filing names the version the
--     caller read (`want_expect`). A request that has moved since — a
--     colleague decided it, the student withdrew it — is refused with
--     SQLSTATE 40001 and nothing is written, so two instructors cannot both
--     decide one request and a student cannot withdraw a request that was
--     just approved without seeing the approval.
--   * **Idempotent, on the gradebook's ledger.** Keys go through
--     `private.gradebook_replay` / `_spend` with four new kinds. The same
--     caller, key and request replay the first receipt and write nothing;
--     the same key for anything else is refused. Replay is checked before the
--     version, so a retried decision whose first answer was lost answers as
--     it did rather than reading as stale.
--   * **Audited.** `course_request_actions` is append-only: one row per act
--     (filed, withdrawn, info_requested, responded, approved, denied) with who,
--     when, the version it produced, the operation's key, and the note the
--     other party reads. No client may insert, update or delete it.
--   * **Events, from the registry.** `course_request.filed` and
--     `course_request.decided` (packages/institution/src/events.ts,
--     education_record / student_record) go to the outbox through
--     `private.emit_domain_event` in the same transaction. Payloads carry ids,
--     the course, the term, the kind and the outcome word — never the student,
--     the reason, or the note.
--   * **A granted date moves a due date only through the next file.**
--     Gradebook items have no due date here; `20261021130000_gradebook_due_dates.sql`
--     gives them one and reads an approved extension's `granted_due` as that
--     student's date for the item. An approved excused absence or incomplete
--     does not mark a grade; that is named as not done in D-1658.
--
-- Account deletion: a student's requests cascade from `auth.users`, and their
-- actions with them; an instructor deleting theirs clears who decided and
-- leaves the decision.
--
-- Merge hazard, named so it is not found the hard way: `20261019120000`
-- (Slice 1, #1653) also redefines the ledger's kind check and
-- `lti_account_untouched`. Whichever of the two merges second must carry the
-- other's kind ('submit' is already allowed here) and the other's
-- `lti_account_untouched` row.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The capabilities ──────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('course_requests:create', 'Ask a course''s instructor for an extension, an excused absence or an incomplete, for one course and term.'),
  ('course_requests:decide', 'Approve, deny or ask about students'' requests on one course and term.'),
  ('course_requests:view',   'Read the requests students filed on one course and term, without deciding them.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('student',               'course_requests:create'),
  ('undergraduate_student', 'course_requests:create'),
  ('graduate_student',      'course_requests:create'),
  ('transfer_student',      'course_requests:create'),
  ('faculty',               'course_requests:decide'),
  ('faculty',               'course_requests:view'),
  ('teaching_assistant',    'course_requests:view')
on conflict do nothing;

-- ── The ledger takes four new kinds ───────────────────────────────────────
-- 'submit' is Slice 1's (20261019120000); allowing it here is harmless before
-- that file lands and keeps its rows valid after.

alter table public.gradebook_operations drop constraint if exists gradebook_operations_kind_check;
alter table public.gradebook_operations add constraint gradebook_operations_kind_check
  check (kind in ('scheme', 'item', 'enter', 'moderate', 'release', 'regrade', 'resolve', 'passback', 'submit',
                  'request_file', 'request_withdraw', 'request_respond', 'request_decide'));

-- ── The tables ────────────────────────────────────────────────────────────

create table if not exists public.course_requests (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  course_code   text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term          text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  student_id    uuid        not null references auth.users on delete cascade,
  kind          text        not null check (kind in ('extension', 'excused_absence', 'incomplete')),
  reason        text        not null check (length(btrim(reason)) between 1 and 2000),
  item_id       uuid        references public.gradebook_items(id) on delete set null,
  requested_due date,
  status        text        not null default 'open'
                            check (status in ('open', 'info_requested', 'approved', 'denied', 'withdrawn')),
  decided_by    uuid        references auth.users on delete set null,
  decided_at    timestamptz,
  granted_due   date,
  decision_note text        not null default '' check (length(decision_note) <= 2000),
  version       integer     not null default 1 check (version >= 1),
  operation     text        not null,
  filed_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- A date is asked, and granted, only for an extension; an approved one has one.
  check (kind = 'extension' or requested_due is null),
  check (granted_due is null or (kind = 'extension' and status = 'approved')),
  check (not (kind = 'extension' and status = 'approved' and granted_due is null)),
  -- A decision has a time; nothing else does.
  check ((status in ('approved', 'denied')) = (decided_at is not null))
);

-- One request in progress per student, course-term, kind and item.
create unique index if not exists course_requests_one_in_progress
  on public.course_requests (tenant_id, course_code, term, student_id, kind,
                             coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('open', 'info_requested');
create index if not exists course_requests_by_course on public.course_requests (tenant_id, course_code, term);
create index if not exists course_requests_by_student on public.course_requests (student_id);
create index if not exists course_requests_by_item on public.course_requests (item_id);
create index if not exists course_requests_by_decider on public.course_requests (decided_by);

create table if not exists public.course_request_actions (
  id         uuid        primary key default gen_random_uuid(),
  request_id uuid        not null references public.course_requests on delete cascade,
  tenant_id  text        not null references public.schools(id) on delete cascade,
  actor      uuid        references auth.users on delete set null,
  action     text        not null check (action in ('filed', 'withdrawn', 'info_requested', 'responded', 'approved', 'denied')),
  -- What the other party reads: the instructor's question or decision note,
  -- the student's answer. Empty for filing (the reason is on the request) and
  -- for a withdrawal.
  note       text        not null default '' check (length(note) <= 2000),
  version    integer     not null check (version >= 1),
  operation  text        not null,
  at         timestamptz not null default now(),
  unique (request_id, version)
);

create index if not exists course_request_actions_by_tenant on public.course_request_actions (tenant_id);
create index if not exists course_request_actions_by_actor on public.course_request_actions (actor);

comment on table public.course_requests is 'A student''s request to a course''s instructor: an extension, an excused absence or an incomplete, and its one decision. Written only by the course_request_* functions.';
comment on table public.course_request_actions is 'Every act on a course request — filed, withdrawn, asked about, answered, approved, denied — with who and the version it made. Append-only.';

-- ── Who reads ─────────────────────────────────────────────────────────────

-- Somebody who reads a course's requests: `:decide` or `:view` over this
-- course in this term, at their own school.
create or replace function private.course_request_reader(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and (private.has_capability('course_requests:decide', 'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('course_requests:view',   'course', private.gradebook_scope(want_tenant, want_code, want_term)));
$$;

revoke all on function private.course_request_reader(text, text, text) from public, anon, authenticated;
grant execute on function private.course_request_reader(text, text, text) to authenticated;

alter table public.course_requests enable row level security;
alter table public.course_request_actions enable row level security;
revoke all on table public.course_requests from anon, authenticated;
revoke all on table public.course_request_actions from anon, authenticated;
grant select on table public.course_requests to authenticated;
grant select on table public.course_request_actions to authenticated;

drop policy if exists "students read their own requests, the course's instructors the course's" on public.course_requests;
create policy "students read their own requests, the course's instructors the course's" on public.course_requests
  for select to authenticated
  using (student_id = (select auth.uid())
         or private.course_request_reader(tenant_id, course_code, term));

drop policy if exists "whoever reads the request reads its history" on public.course_request_actions;
create policy "whoever reads the request reads its history" on public.course_request_actions
  for select to authenticated
  using (exists (select 1 from public.course_requests r where r.id = request_id));

-- ── Helpers ───────────────────────────────────────────────────────────────

-- The request, locked, at the caller's school; "no such request here" otherwise.
create or replace function private.course_request_locked(school text, want_request uuid)
returns public.course_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.course_requests;
begin
  select * into r from public.course_requests x where x.id = want_request and x.tenant_id = school for update;
  if not found then raise exception 'semester: no such request here' using errcode = 'check_violation'; end if;
  return r;
end $$;

-- Raises unless the request is still in progress and at the version the
-- caller read. Closed first: it says more than "it moved".
create or replace function private.course_request_expect(r public.course_requests, want_expect integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if r.status not in ('open', 'info_requested') then
    raise exception 'semester: that request is already %, so it cannot change', replace(r.status, '_', ' ')
      using errcode = 'check_violation';
  end if;
  if want_expect is null or r.version <> want_expect then
    raise exception 'semester: this request changed since you read it (it is at version % now). Reload it and look again', r.version
      using errcode = 'serialization_failure';
  end if;
end $$;

-- The receipt every writer answers with.
create or replace function private.course_request_receipt(r public.course_requests)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('request', r.id, 'status', r.status, 'version', r.version,
                            'granted_due', r.granted_due, 'at', r.updated_at);
$$;

revoke all on function private.course_request_locked(text, uuid) from public, anon, authenticated;
revoke all on function private.course_request_expect(public.course_requests, integer) from public, anon, authenticated;
revoke all on function private.course_request_receipt(public.course_requests) from public, anon, authenticated;

-- ── Filing ────────────────────────────────────────────────────────────────

create or replace function public.course_request_file(
  want_course text, want_term text, want_kind text, want_item uuid,
  want_requested_due date, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
  req    jsonb;
  prior  jsonb;
  made   public.course_requests;
  answer jsonb;
  corr   text;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  perform private.gradebook_require(school, code, want_term, 'course_requests:create', false);

  req := jsonb_build_object('course', code, 'term', want_term, 'kind', want_kind, 'item', want_item,
                            'requested_due', want_requested_due, 'reason', want_reason);
  prior := private.gradebook_replay(school, want_key, 'request_file', req);
  if prior is not null then return prior; end if;

  if want_kind is null or want_kind not in ('extension', 'excused_absence', 'incomplete') then
    raise exception 'semester: a request is for an extension, an excused absence or an incomplete' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_reason, ''))) not between 1 and 2000 then
    raise exception 'semester: say why, in at most 2,000 characters' using errcode = 'check_violation';
  end if;
  if want_kind = 'extension' and want_requested_due is null then
    raise exception 'semester: an extension asks for a new date' using errcode = 'check_violation';
  end if;
  if want_kind <> 'extension' and want_requested_due is not null then
    raise exception 'semester: only an extension asks for a new date' using errcode = 'check_violation';
  end if;
  if want_item is not null and not exists (
       select 1 from public.gradebook_items i
        where i.id = want_item and i.tenant_id = school and i.course_code = code and i.term = want_term) then
    raise exception 'semester: no such item on this course' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('course-request:' || school || ':' || code || ':' || want_term || ':' || me::text));
  if exists (select 1 from public.course_requests r
              where r.tenant_id = school and r.course_code = code and r.term = want_term and r.student_id = me
                and r.kind = want_kind and r.item_id is not distinct from want_item
                and r.status in ('open', 'info_requested')) then
    raise exception 'semester: you already have this request waiting; withdraw it or wait for the answer' using errcode = 'check_violation';
  end if;

  insert into public.course_requests
    (tenant_id, course_code, term, student_id, kind, reason, item_id, requested_due, operation)
  values (school, code, want_term, me, want_kind, btrim(want_reason), want_item, want_requested_due, want_key)
  returning * into made;
  insert into public.course_request_actions (request_id, tenant_id, actor, action, version, operation)
  values (made.id, school, me, 'filed', made.version, want_key);

  answer := private.course_request_receipt(made);
  corr := case when length(want_key) <= 128 then want_key else 'cr:' || md5(want_key) end;
  perform private.emit_domain_event(
    'course_request', made.id::text, 'course_request.filed', 1,
    school, 'course_requests', corr, want_key,
    jsonb_build_object('request', made.id, 'course_code', code, 'term', want_term,
                       'kind', want_kind, 'item', want_item, 'version', made.version),
    'education_record', 'student_record'
  );
  perform private.gradebook_spend(school, want_key, 'request_file', req, answer);
  return answer;
end $$;

-- ── The student's two moves: withdraw, and answer a question ─────────────

create or replace function public.course_request_withdraw(want_request uuid, want_expect integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  r      public.course_requests;
  req    jsonb := jsonb_build_object('request', want_request, 'expect', want_expect);
  prior  jsonb;
  answer jsonb;
begin
  r := private.course_request_locked(school, want_request);
  if r.student_id is distinct from me then
    raise exception 'semester: only the student who asked can withdraw a request' using errcode = 'insufficient_privilege';
  end if;
  prior := private.gradebook_replay(school, want_key, 'request_withdraw', req);
  if prior is not null then return prior; end if;
  perform private.course_request_expect(r, want_expect);

  update public.course_requests
     set status = 'withdrawn', version = version + 1, updated_at = now()
   where id = r.id
  returning * into r;
  insert into public.course_request_actions (request_id, tenant_id, actor, action, version, operation)
  values (r.id, school, me, 'withdrawn', r.version, want_key);

  answer := private.course_request_receipt(r);
  perform private.gradebook_spend(school, want_key, 'request_withdraw', req, answer);
  return answer;
end $$;

create or replace function public.course_request_respond(want_request uuid, want_note text, want_expect integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  r      public.course_requests;
  req    jsonb := jsonb_build_object('request', want_request, 'note', want_note, 'expect', want_expect);
  prior  jsonb;
  answer jsonb;
begin
  r := private.course_request_locked(school, want_request);
  if r.student_id is distinct from me then
    raise exception 'semester: only the student who asked can answer for it' using errcode = 'insufficient_privilege';
  end if;
  prior := private.gradebook_replay(school, want_key, 'request_respond', req);
  if prior is not null then return prior; end if;
  perform private.course_request_expect(r, want_expect);
  if r.status <> 'info_requested' then
    raise exception 'semester: your instructor has not asked anything about this request' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_note, ''))) not between 1 and 2000 then
    raise exception 'semester: write your answer, in at most 2,000 characters' using errcode = 'check_violation';
  end if;

  update public.course_requests
     set status = 'open', version = version + 1, updated_at = now()
   where id = r.id
  returning * into r;
  insert into public.course_request_actions (request_id, tenant_id, actor, action, note, version, operation)
  values (r.id, school, me, 'responded', btrim(want_note), r.version, want_key);

  answer := private.course_request_receipt(r);
  perform private.gradebook_spend(school, want_key, 'request_respond', req, answer);
  return answer;
end $$;

-- ── The instructor's decision ─────────────────────────────────────────────
-- `want_outcome`: 'approve', 'deny' or 'ask'. Approving an extension needs
-- `want_granted_due`; denying and asking need a note the student reads.

create or replace function public.course_request_decide(
  want_request uuid, want_outcome text, want_granted_due date, want_note text,
  want_expect integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  r       public.course_requests;
  req     jsonb := jsonb_build_object('request', want_request, 'outcome', want_outcome, 'granted_due', want_granted_due,
                                      'note', want_note, 'expect', want_expect);
  prior   jsonb;
  said    text := btrim(coalesce(want_note, ''));
  moved   text;
  answer  jsonb;
  corr    text;
begin
  r := private.course_request_locked(school, want_request);
  perform private.gradebook_require(school, r.course_code, r.term, 'course_requests:decide', false);
  if r.student_id = me then
    raise exception 'semester: nobody decides a request they filed' using errcode = 'insufficient_privilege';
  end if;
  prior := private.gradebook_replay(school, want_key, 'request_decide', req);
  if prior is not null then return prior; end if;
  perform private.course_request_expect(r, want_expect);

  if want_outcome is null or want_outcome not in ('approve', 'deny', 'ask') then
    raise exception 'semester: a request is approved, denied or asked about' using errcode = 'check_violation';
  end if;
  if length(said) > 2000 then
    raise exception 'semester: a note is at most 2,000 characters' using errcode = 'check_violation';
  end if;
  if want_outcome in ('deny', 'ask') and said = '' then
    raise exception 'semester: say why, or what you need to know; the student reads it' using errcode = 'check_violation';
  end if;
  if want_outcome = 'ask' and r.status <> 'open' then
    raise exception 'semester: the student has not answered your last question yet' using errcode = 'check_violation';
  end if;
  if want_outcome = 'approve' and r.kind = 'extension' and want_granted_due is null then
    raise exception 'semester: approving an extension sets the new date' using errcode = 'check_violation';
  end if;
  if want_granted_due is not null and not (want_outcome = 'approve' and r.kind = 'extension') then
    raise exception 'semester: a new date is granted only by approving an extension' using errcode = 'check_violation';
  end if;

  moved := case want_outcome when 'approve' then 'approved' when 'deny' then 'denied' else 'info_requested' end;
  update public.course_requests
     set status        = moved,
         version       = version + 1,
         updated_at    = now(),
         decided_by    = case when moved in ('approved', 'denied') then me end,
         decided_at    = case when moved in ('approved', 'denied') then now() end,
         granted_due   = case when moved = 'approved' then want_granted_due end,
         decision_note = case when moved in ('approved', 'denied') then said else decision_note end
   where id = r.id
  returning * into r;
  insert into public.course_request_actions (request_id, tenant_id, actor, action, note, version, operation)
  values (r.id, school, me, moved, said, r.version, want_key);

  answer := private.course_request_receipt(r);
  corr := case when length(want_key) <= 128 then want_key else 'cr:' || md5(want_key) end;
  perform private.emit_domain_event(
    'course_request', r.id::text, 'course_request.decided', 1,
    school, 'course_requests', corr, want_key,
    jsonb_build_object('request', r.id, 'course_code', r.course_code, 'term', r.term,
                       'kind', r.kind, 'outcome', moved, 'version', r.version),
    'education_record', 'student_record'
  );
  perform private.gradebook_spend(school, want_key, 'request_decide', req, answer);
  return answer;
end $$;

revoke all on function public.course_request_file(text, text, text, uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.course_request_withdraw(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.course_request_respond(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.course_request_decide(uuid, text, date, text, integer, text) from public, anon, authenticated;
grant execute on function public.course_request_file(text, text, text, uuid, date, text, text) to authenticated;
grant execute on function public.course_request_withdraw(uuid, integer, text) to authenticated;
grant execute on function public.course_request_respond(uuid, text, integer, text) to authenticated;
grant execute on function public.course_request_decide(uuid, text, date, text, integer, text) to authenticated;

-- ── A request is something a person did ───────────────────────────────────
-- `lti_account_untouched` decides whether an account may be linked away as
-- empty. A request a student filed is their own act, like a regrade request,
-- so an account holding one is not untouched. Unchanged from
-- 20261004181000 except for the last row.

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
      ('public.productivity_workspace', 'user_id'),
      ('public.productivity_task',      'owner_id'),
      ('public.productivity_event',     'owner_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id'),
      ('public.family_invites',       'student_id'),
      ('public.family_shared_items',  'student_id'),
      ('public.family_access_events', 'student_id'),
      ('public.support_shares',       'student_id'),
      ('public.support_shares',       'staff_id'),
      -- 20260929360000: what a person did in three school domains.
      ('public.registration_enrollments', 'student'),
      ('public.regrade_requests',     'student_id'),
      ('public.dining_orders',        'student'),
      -- 20261021120000: what a student asked their instructor.
      ('public.course_requests',      'student_id')
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
revoke all on function public.lti_account_untouched(uuid) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   -- First re-run lti_account_untouched from 20261004181000 (or from
--   -- 20261019120000 if it is applied), which drops the course_requests row.
--   drop function if exists public.course_request_decide(uuid, text, date, text, integer, text);
--   drop function if exists public.course_request_respond(uuid, text, integer, text);
--   drop function if exists public.course_request_withdraw(uuid, integer, text);
--   drop function if exists public.course_request_file(text, text, text, uuid, date, text, text);
--   drop function if exists private.course_request_receipt(public.course_requests);
--   drop function if exists private.course_request_expect(public.course_requests, integer);
--   drop function if exists private.course_request_locked(text, uuid);
--   drop table if exists public.course_request_actions;
--   drop table if exists public.course_requests;
--   drop function if exists private.course_request_reader(text, text, text);
--   delete from public.gradebook_operations where kind like 'request\_%';
--   alter table public.gradebook_operations drop constraint if exists gradebook_operations_kind_check;
--   alter table public.gradebook_operations add constraint gradebook_operations_kind_check
--     check (kind in ('scheme', 'item', 'enter', 'moderate', 'release', 'regrade', 'resolve', 'passback', 'submit'));
--   delete from public.role_capabilities where capability like 'course\_requests:%';
--   delete from public.app_capabilities where capability like 'course\_requests:%';
--   commit;
