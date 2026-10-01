-- Semester — attendance: an instructor opens a session, students check in with
-- a code, an instructor can mark anyone, and every mark is kept, when a school
-- runs the `attendance` module in Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's `attendance`
--     module is `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **Who.** A course is `<school>/<CODE>` plus a term, and a grant is held
--     on `<school>/<CODE>/<TERM>` as the gradebook's are. `attendance:take`
--     (faculty, teaching assistants) opens and closes sessions and marks
--     anyone on the roster; `attendance:attend` (the student roles) is the
--     roster and the only thing that lets a person check in.
--   * **The clock is the server's.** A check-in is `present` inside the
--     session's late window and `late` after it, by `clock_timestamp()` read in
--     the writer; outside the open window it is refused.
--   * **A code is a secret for one session.** Six digits, made by the server,
--     unique among the school's open sessions, shown to the people who take
--     attendance and to nobody else: the sessions table has no student read.
--     A wrong code is *answered*, not raised, so the failed try is kept, and
--     five failures in ten minutes stop that person's check-ins for the rest
--     of the window.
--   * **Append-only marks.** A mark is a row; changing one is a new row with the
--     next version, carrying who and why. The latest version is the mark. An
--     excused absence needs a note. Nobody inserts, updates or deletes through
--     the API, and even the owner cannot rewrite a mark.
--   * **Closing** marks every roster member without a mark `absent`, once.
--   * **Idempotent.** Every writer takes a key; the same key and request answers
--     as the first call did and writes nothing.
--
-- Not here, on purpose: location or device checks, photographs, and any
-- measure of attention. The brief's "no emotion or attention monitoring" is a
-- refusal, not a deferral.
--
-- Account deletion: a student's marks and failed tries cascade from
-- `auth.users`; the people who took attendance are set null.

-- ── Whether a module is Core for a school ───────────────────────────────

create or replace function private.module_is_core(want_tenant text, want_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tenant_module_mode m
                  where m.tenant_id = want_tenant and m.module = want_module
                    and m.mode = 'core' and not m.frozen)
     and not public.kill_switch_engaged('kill.core_modules', want_tenant);
$$;
revoke all on function private.module_is_core(text, text) from public, anon, authenticated;

-- ── The capabilities ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('attendance:take',   'Open and close attendance sessions and mark anyone on the roster, for one course and term.'),
  ('attendance:attend', 'Check in to attendance for one course and term: the attendance roster.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('faculty',               'attendance:take'),
  ('teaching_assistant',    'attendance:take'),
  ('student',               'attendance:attend'),
  ('undergraduate_student', 'attendance:attend'),
  ('graduate_student',      'attendance:attend'),
  ('transfer_student',      'attendance:attend')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.attendance_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('open', 'close', 'mark', 'checkin')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.attendance_sessions (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null references public.schools(id) on delete cascade,
  course_code        text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term               text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  title              text        not null default '' check (length(title) <= 200),
  held_on            date        not null,
  opens_at           timestamptz not null,
  closes_at          timestamptz not null,
  late_after_minutes integer     not null default 10 check (late_after_minutes between 0 and 600),
  code               text        not null check (code ~ '^[0-9]{6}$'),
  status             text        not null default 'open' check (status in ('open', 'closed')),
  opened_by          uuid        references auth.users on delete set null,
  operation          text        not null,
  created_at         timestamptz not null default now(),
  closed_at          timestamptz,
  constraint attendance_window check (closes_at > opens_at and closes_at <= opens_at + interval '12 hours')
);

create table if not exists public.attendance_marks (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  session_id uuid        not null references public.attendance_sessions on delete cascade,
  student_id uuid        not null references auth.users on delete cascade,
  course_code text       not null,
  term       text        not null,
  held_on    date        not null,
  version    integer     not null check (version >= 1),
  status     text        not null check (status in ('present', 'late', 'absent', 'excused')),
  method     text        not null check (method in ('code', 'instructor', 'close')),
  marked_by  uuid        references auth.users on delete set null,
  note       text        not null default '' check (length(note) <= 500),
  marked_at  timestamptz not null,
  operation  text        not null,
  unique (session_id, student_id, version),
  constraint attendance_excused_needs_note check (status <> 'excused' or length(btrim(note)) > 0)
);

create table if not exists public.attendance_failures (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  user_id    uuid        not null references auth.users on delete cascade,
  failed_at  timestamptz not null default clock_timestamp()
);

create index if not exists attendance_operations_by_actor on public.attendance_operations (actor);
create index if not exists attendance_sessions_by_course on public.attendance_sessions (tenant_id, course_code, term, held_on);
create index if not exists attendance_sessions_by_opener on public.attendance_sessions (opened_by);
create index if not exists attendance_marks_by_session on public.attendance_marks (session_id, student_id, version desc);
create index if not exists attendance_marks_by_tenant on public.attendance_marks (tenant_id);
create index if not exists attendance_marks_by_student on public.attendance_marks (student_id);
create index if not exists attendance_marks_by_marker on public.attendance_marks (marked_by);
create index if not exists attendance_failures_by_user on public.attendance_failures (user_id, failed_at desc);
create index if not exists attendance_failures_by_tenant on public.attendance_failures (tenant_id);
create unique index if not exists attendance_one_open_code
  on public.attendance_sessions (tenant_id, code) where status = 'open';

comment on table public.attendance_operations is 'Idempotency keys the attendance writers spent, with what each asked and answered. Append-only.';
comment on table public.attendance_sessions is 'One class meeting a code can check in to. Staff read it, including the code; no student does.';
comment on table public.attendance_marks is 'Every version of every mark: present, late, absent, excused. Append-only; the latest version is the mark.';
comment on table public.attendance_failures is 'A wrong code tried at check-in, kept so five in ten minutes stop further tries.';

create or replace function private.refuse_attendance_record_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'semester: attendance marks are never rewritten; a change is a new version' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.refuse_attendance_record_change() from public, anon, authenticated;

drop trigger if exists attendance_marks_never_rewritten on public.attendance_marks;
create trigger attendance_marks_never_rewritten before update on public.attendance_marks
for each row execute function private.refuse_attendance_record_change();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.attendance_taker(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability('attendance:take', 'course', private.gradebook_scope(want_tenant, want_code, want_term));
$$;
revoke all on function private.attendance_taker(text, text, text) from public, anon, authenticated;
grant execute on function private.attendance_taker(text, text, text) to authenticated;

-- The people on a course's attendance roster for a term: who holds
-- `attendance:attend` over exactly that scope, on the same terms as
-- `private.has_capability` reads a grant.
create or replace function private.attendance_roster(want_tenant text, want_code text, want_term text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct g.subject
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where rc.capability = 'attendance:attend'
     and g.scope_kind = 'course'
     and g.scope_id = private.gradebook_scope(want_tenant, want_code, want_term)
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now());
$$;
revoke all on function private.attendance_roster(text, text, text) from public, anon, authenticated;

alter table public.attendance_operations enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_marks enable row level security;
alter table public.attendance_failures enable row level security;

revoke all on table public.attendance_operations from public, anon, authenticated;
revoke all on table public.attendance_sessions from public, anon, authenticated;
revoke all on table public.attendance_marks from public, anon, authenticated;
revoke all on table public.attendance_failures from public, anon, authenticated;
grant select on table public.attendance_operations to authenticated;
grant select on table public.attendance_sessions to authenticated;
grant select on table public.attendance_marks to authenticated;

drop policy if exists "callers read their own attendance operations" on public.attendance_operations;
create policy "callers read their own attendance operations" on public.attendance_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "attendance takers read sessions" on public.attendance_sessions;
create policy "attendance takers read sessions" on public.attendance_sessions
  for select to authenticated
  using (private.attendance_taker(tenant_id, course_code, term));

drop policy if exists "takers read marks, a student their own" on public.attendance_marks;
create policy "takers read marks, a student their own" on public.attendance_marks
  for select to authenticated
  using (student_id = (select auth.uid()) or private.attendance_taker(tenant_id, course_code, term));

-- No policy on attendance_failures: nobody reads it through the API.

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.attendance_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.attendance_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('attendance-op:' || school || ':' || want_key));
  select * into op from public.attendance_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.attendance_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.attendance_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.attendance_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.attendance_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.attendance_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'attendance') then
    raise exception 'semester: this school does not run attendance in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.attendance_core_required(text) from public, anon, authenticated;

-- The next version of a student's mark in a session, written once.
create or replace function private.attendance_write_mark(
  s public.attendance_sessions, want_student uuid, want_status text, want_method text,
  want_by uuid, want_note text, want_at timestamptz, want_key text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  perform pg_advisory_xact_lock(hashtext('attendance-mark:' || s.id::text || ':' || want_student::text));
  select coalesce(max(m.version), 0) + 1 into v from public.attendance_marks m
   where m.session_id = s.id and m.student_id = want_student;
  insert into public.attendance_marks (tenant_id, session_id, student_id, course_code, term, held_on, version,
                                       status, method, marked_by, note, marked_at, operation)
  values (s.tenant_id, s.id, want_student, s.course_code, s.term, s.held_on, v, want_status, want_method,
          want_by, coalesce(want_note, ''), want_at, want_key);
  return v;
end $$;
revoke all on function private.attendance_write_mark(public.attendance_sessions, uuid, text, text, uuid, text, timestamptz, text) from public, anon, authenticated;

-- ── The instructor's writers ────────────────────────────────────────────

-- Opens a session and returns its id and code. The code is the server's.
create or replace function public.attendance_open_session(
  want_course text, want_term text, want_title text, want_held_on date,
  want_opens timestamptz, want_closes timestamptz, want_late_after integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', code, 'term', want_term, 'title', want_title, 'held_on', want_held_on,
                    'opens', want_opens, 'closes', want_closes, 'late_after', want_late_after);
  prior  jsonb;
  made   uuid;
  pin    text;
  tries  integer := 0;
  result jsonb;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  if not private.has_capability('attendance:take', 'course', private.gradebook_scope(school, code, want_term)) then
    raise exception 'semester: that needs attendance:take on this course in %', want_term using errcode = 'insufficient_privilege';
  end if;
  prior := private.attendance_replay(school, want_key, 'open', req);
  if prior is not null then return prior; end if;
  perform private.attendance_core_required(school);

  loop
    pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.attendance_sessions x where x.tenant_id = school and x.code = pin and x.status = 'open');
    tries := tries + 1;
    if tries > 50 then raise exception 'semester: no free code; close a session and try again' using errcode = 'check_violation'; end if;
  end loop;

  insert into public.attendance_sessions (tenant_id, course_code, term, title, held_on, opens_at, closes_at,
                                          late_after_minutes, code, opened_by, operation)
  values (school, code, want_term, btrim(coalesce(want_title, '')), want_held_on, want_opens, want_closes,
          coalesce(want_late_after, 10), pin, me, want_key)
  returning id into made;
  result := jsonb_build_object('id', made, 'code', pin);
  perform private.attendance_spend(school, want_key, 'open', req, result);
  return result;
end $$;

-- Closes a session: every roster member without a mark is marked absent, once.
create or replace function public.attendance_close_session(want_id uuid, want_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  s      public.attendance_sessions;
  req    jsonb := jsonb_build_object('id', want_id);
  prior  jsonb;
  who    uuid;
  absent integer := 0;
begin
  select * into s from public.attendance_sessions x where x.id = want_id and x.tenant_id = school;
  if s.id is null then raise exception 'semester: no such session' using errcode = 'no_data_found'; end if;
  if not private.has_capability('attendance:take', 'course', private.gradebook_scope(school, s.course_code, s.term)) then
    raise exception 'semester: that needs attendance:take on this course in %', s.term using errcode = 'insufficient_privilege';
  end if;
  prior := private.attendance_replay(school, want_key, 'close', req);
  if prior is not null then return (prior->>'absent')::integer; end if;
  perform private.attendance_core_required(school);
  if s.status <> 'open' then raise exception 'semester: that session is already closed' using errcode = 'check_violation'; end if;

  for who in select r from private.attendance_roster(school, s.course_code, s.term) r loop
    if not exists (select 1 from public.attendance_marks m where m.session_id = s.id and m.student_id = who) then
      perform private.attendance_write_mark(s, who, 'absent', 'close', me, 'Not checked in when the session closed.', clock_timestamp(), want_key);
      absent := absent + 1;
    end if;
  end loop;
  update public.attendance_sessions set status = 'closed', closed_at = clock_timestamp() where id = want_id;
  perform private.attendance_spend(school, want_key, 'close', req, jsonb_build_object('absent', absent));
  return absent;
end $$;

-- An instructor marks one student, or changes a mark: a new version.
create or replace function public.attendance_mark(
  want_session uuid, want_student uuid, want_status text, want_note text, want_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  s      public.attendance_sessions;
  req    jsonb := jsonb_build_object('session', want_session, 'student', want_student, 'status', want_status, 'note', want_note);
  prior  jsonb;
  v      integer;
begin
  select * into s from public.attendance_sessions x where x.id = want_session and x.tenant_id = school;
  if s.id is null then raise exception 'semester: no such session' using errcode = 'no_data_found'; end if;
  if not private.has_capability('attendance:take', 'course', private.gradebook_scope(school, s.course_code, s.term)) then
    raise exception 'semester: that needs attendance:take on this course in %', s.term using errcode = 'insufficient_privilege';
  end if;
  prior := private.attendance_replay(school, want_key, 'mark', req);
  if prior is not null then return (prior->>'version')::integer; end if;
  perform private.attendance_core_required(school);
  if want_status not in ('present', 'late', 'absent', 'excused') then
    raise exception 'semester: a mark is present, late, absent or excused' using errcode = 'check_violation';
  end if;
  if want_status = 'excused' and length(btrim(coalesce(want_note, ''))) = 0 then
    raise exception 'semester: an excused absence needs a note' using errcode = 'check_violation';
  end if;
  if not private.subject_has_capability(want_student, 'attendance:attend', 'course', private.gradebook_scope(school, s.course_code, s.term)) then
    raise exception 'semester: that student is not on this course''s attendance roster for %', s.term using errcode = 'check_violation';
  end if;
  v := private.attendance_write_mark(s, want_student, want_status, 'instructor', me, want_note, clock_timestamp(), want_key);
  perform private.attendance_spend(school, want_key, 'mark', req, jsonb_build_object('version', v));
  return v;
end $$;

-- ── The student's writer ────────────────────────────────────────────────

-- Answers `{ok: true, status}` or `{ok: false, reason}`. A wrong code is an
-- answer, not an error, so the failed try is kept.
create or replace function public.attendance_check_in(want_code text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  req     jsonb := jsonb_build_object('code', want_code);
  prior   jsonb;
  s       public.attendance_sessions;
  at_time timestamptz := clock_timestamp();
  stat    text;
  fails   integer;
  v       integer;
  result  jsonb;
begin
  prior := private.attendance_replay(school, want_key, 'checkin', req);
  if prior is not null then return prior; end if;
  perform private.attendance_core_required(school);

  select count(*) into fails from public.attendance_failures f
   where f.user_id = me and f.failed_at > at_time - interval '10 minutes';
  if fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_tries');
  end if;

  select * into s from public.attendance_sessions x
   where x.tenant_id = school and x.code = coalesce(want_code, '') and x.status = 'open';
  if s.id is null then
    insert into public.attendance_failures (tenant_id, user_id) values (school, me);
    return jsonb_build_object('ok', false, 'reason', 'no_such_code');
  end if;
  if not private.has_capability('attendance:attend', 'course', private.gradebook_scope(school, s.course_code, s.term)) then
    -- The code is right but the caller is not on this course: say the same as a wrong code.
    insert into public.attendance_failures (tenant_id, user_id) values (school, me);
    return jsonb_build_object('ok', false, 'reason', 'no_such_code');
  end if;
  if at_time < s.opens_at or at_time > s.closes_at then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  if exists (select 1 from public.attendance_marks m where m.session_id = s.id and m.student_id = me) then
    return jsonb_build_object('ok', false, 'reason', 'already_marked');
  end if;

  stat := case when at_time > s.opens_at + make_interval(mins => s.late_after_minutes) then 'late' else 'present' end;
  v := private.attendance_write_mark(s, me, stat, 'code', null, '', at_time, want_key);
  result := jsonb_build_object('ok', true, 'status', stat, 'course', s.course_code, 'held_on', s.held_on, 'marked_at', at_time);
  perform private.attendance_spend(school, want_key, 'checkin', req, result);
  return result;
end $$;

-- ── Who may call what ───────────────────────────────────────────────────

revoke all on function public.attendance_open_session(text, text, text, date, timestamptz, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.attendance_close_session(uuid, text) from public, anon, authenticated;
revoke all on function public.attendance_mark(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.attendance_check_in(text, text) from public, anon, authenticated;
grant execute on function public.attendance_open_session(text, text, text, date, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.attendance_close_session(uuid, text) to authenticated;
grant execute on function public.attendance_mark(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.attendance_check_in(text, text) to authenticated;

-- ── An account that was marked is not untouched ─────────────────────────
--
-- The previous definition is `20261001010000_assignments.sql`, with one more
-- place to look.

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
      -- 20261001020000: a student's attendance marks.
      ('public.attendance_marks',     'student_id')
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
