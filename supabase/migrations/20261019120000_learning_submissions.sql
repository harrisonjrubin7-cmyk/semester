-- Semester — a student hands in work, and a grade names the copy it graded.
--
-- Slice 1 of the unified-workspace plan (handoff/SLICE-1-PLAN.md in the
-- Claude Design bundle): assignment → fixed submission → released grade. The
-- gradebook (20260929310000) keeps every version of a grade, but until now
-- nothing kept the work being graded. A score could not say which essay it
-- was for, and a student could not show what they handed in.
--
-- What it decides, and where:
--
--   * **What is handed in is fixed.** `learning_submissions` is append-only
--     like `grade_entries`: no client may insert, update or delete a row, and
--     the only writer is `learning_submit`. Handing in again is a new row with
--     the next version; the earlier one stays exactly as it was, with the
--     SHA-256 of its text, so "what did I hand in on Tuesday" always has one
--     answer. A student's later drafts live wherever they write them and
--     change nothing here.
--   * **Who hands in.** A new capability, `submissions:create`, held by the
--     same student roles that carry `grades:receive`, at the same
--     course-and-term scope `<school>/<CODE>/<TERM>`. Holding it on another
--     course, another term or the untermed course authorises nothing.
--   * **Who reads.** The student their own rows; the course's grade authors
--     (`private.gradebook_author`: enter, moderate or release on this course
--     and term) every row on it. Not the registrar, whose reading is released
--     grades; not a department chair, who sees aggregates.
--   * **What counts as assigned.** A gradebook item. Items have no separate
--     published state: an item exists because somebody holding
--     `grades:release` added it, and that is the act that assigns it. An item
--     at another school is "no such item here", never a hint that it exists.
--   * **Idempotent, on the gradebook's ledger.** The key goes through
--     `private.gradebook_replay` / `_spend` with a new kind, `submit`, so one
--     ledger holds every grading-side key. The request recorded is the item
--     and the text's hash, not the text. The same key with the same text
--     answers the first receipt and writes nothing; with other text it is
--     refused.
--   * **One transaction with its event.** `submission.finalized` goes
--     to the outbox through `private.emit_domain_event` before the function
--     returns, keyed and correlated as `gradebook_release` does it
--     (20261012010000). The type is the registry's own
--     (`packages/institution/src/events.ts`: `submission.finalized`, v1,
--     education_record, student_record), not a new name. The payload is the
--     item, course, term, submission id and version — never the student,
--     never the text.
--   * **Not yet reconciled with `packages/institution/src/assignment-submission.ts`.**
--     That module models the same slice in memory (assignment windows,
--     private drafts, receipts) with no Postgres adapter. This table is the
--     gradebook-side record a student can use today; joining the two — an
--     assignment's window, its draft store — is named in D-1653 as the
--     next step, not done here.
--   * **A grade names its submission.** `grade_entries.submission_id`, set by
--     a trigger so no existing writer's signature changes: a score that is
--     entered, changed or regraded binds the student's latest submission on
--     that item at that moment (null when there is none, as for an exam
--     graded on paper); moderation and release carry the version before them
--     forward. Handing in again after a grade does not move the grade.
--
-- Account deletion: a student's submissions cascade from `auth.users`, as
-- `erasure.test.ts` requires of every column naming an account, and a grade
-- whose submission is gone keeps its score with `submission_id` set null.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The capability ────────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('submissions:create', 'Hand in work on a graded item, for one course and term.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('student',               'submissions:create'),
  ('undergraduate_student', 'submissions:create'),
  ('graduate_student',      'submissions:create'),
  ('transfer_student',      'submissions:create')
on conflict do nothing;

-- ── The ledger takes a new kind ───────────────────────────────────────────

alter table public.gradebook_operations drop constraint if exists gradebook_operations_kind_check;
alter table public.gradebook_operations add constraint gradebook_operations_kind_check
  check (kind in ('scheme', 'item', 'enter', 'moderate', 'release', 'regrade', 'resolve', 'passback', 'submit'));

-- ── The table ─────────────────────────────────────────────────────────────

create table if not exists public.learning_submissions (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  course_code  text        not null,
  term         text        not null,
  item_id      uuid        not null references public.gradebook_items(id) on delete cascade,
  student_id   uuid        not null references auth.users on delete cascade,
  version      integer     not null check (version >= 1),
  body         text        not null check (length(btrim(body)) between 1 and 200000),
  content_hash text        not null check (content_hash ~ '^[0-9a-f]{64}$'),
  operation    text        not null,
  submitted_at timestamptz not null default now(),
  unique (item_id, student_id, version)
);

create index if not exists learning_submissions_by_course on public.learning_submissions (tenant_id, course_code, term);
create index if not exists learning_submissions_by_student on public.learning_submissions (student_id);

comment on table public.learning_submissions is 'Work a student handed in on a gradebook item, one row per hand-in, never changed. Students read their own; the course''s grade authors read the course''s.';

alter table public.grade_entries
  add column if not exists submission_id uuid references public.learning_submissions(id) on delete set null;
create index if not exists grade_entries_by_submission on public.grade_entries (submission_id);
comment on column public.grade_entries.submission_id is 'The submission this version of the grade was given on; null when nothing was handed in through Semester.';

alter table public.learning_submissions enable row level security;
revoke all on table public.learning_submissions from anon, authenticated;
grant select on table public.learning_submissions to authenticated;

drop policy if exists "students read their own submissions, graders the course's" on public.learning_submissions;
create policy "students read their own submissions, graders the course's" on public.learning_submissions
  for select to authenticated
  using (student_id = (select auth.uid())
         or private.gradebook_author(tenant_id, course_code, term));

-- ── A grade names its submission ──────────────────────────────────────────
-- Invoker: it runs as whoever inserted the grade row, which is only ever the
-- gradebook's definer functions, so it adds nothing to the definer register.

create or replace function private.grade_entry_binds_submission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.submission_id is not null then
    return new;
  end if;
  if new.action in ('entered', 'changed', 'regraded') then
    select s.id into new.submission_id
      from public.learning_submissions s
     where s.item_id = new.item_id and s.student_id = new.student_id
     order by s.version desc
     limit 1;
  else
    select g.submission_id into new.submission_id
      from public.grade_entries g
     where g.item_id = new.item_id and g.student_id = new.student_id and g.version = new.version - 1;
  end if;
  return new;
end $$;

revoke all on function private.grade_entry_binds_submission() from public, anon, authenticated;

drop trigger if exists grade_entry_binds_submission on public.grade_entries;
create trigger grade_entry_binds_submission
  before insert on public.grade_entries
  for each row execute function private.grade_entry_binds_submission();

-- ── Handing in ────────────────────────────────────────────────────────────
-- Answers {submission, version, content_hash, submitted_at}: the receipt.

create or replace function public.learning_submit(want_item uuid, want_body text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  it     public.gradebook_items;
  hash   text;
  req    jsonb;
  prior  jsonb;
  ver    integer;
  made   public.learning_submissions;
  answer jsonb;
  corr   text;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'submissions:create', false);

  if want_body is null or length(btrim(want_body)) = 0 then
    raise exception 'semester: there is nothing to hand in' using errcode = 'check_violation';
  end if;
  if length(btrim(want_body)) > 200000 then
    raise exception 'semester: a submission is at most 200,000 characters' using errcode = 'check_violation';
  end if;
  hash := encode(sha256(convert_to(want_body, 'UTF8')), 'hex');
  req := jsonb_build_object('item', want_item, 'content_hash', hash);
  prior := private.gradebook_replay(school, want_key, 'submit', req);
  if prior is not null then return prior; end if;

  perform pg_advisory_xact_lock(hashtext('submission:' || it.id::text || ':' || me::text));
  select coalesce(max(s.version), 0) + 1 into ver
    from public.learning_submissions s
   where s.item_id = it.id and s.student_id = me;

  insert into public.learning_submissions
    (tenant_id, course_code, term, item_id, student_id, version, body, content_hash, operation)
  values (school, it.course_code, it.term, it.id, me, ver, want_body, hash, want_key)
  returning * into made;

  answer := jsonb_build_object('submission', made.id, 'version', made.version,
                               'content_hash', made.content_hash, 'submitted_at', made.submitted_at);

  corr := case when length(want_key) <= 128 then want_key else 'sb:' || md5(want_key) end;
  perform private.emit_domain_event(
    'learning_submission', made.id::text, 'submission.finalized', 1,
    school, 'gradebook', corr, want_key,
    jsonb_build_object('submission', made.id, 'item', it.id, 'course_code', it.course_code,
                       'term', it.term, 'version', made.version),
    'education_record', 'student_record'
  );

  perform private.gradebook_spend(school, want_key, 'submit', req, answer);
  return answer;
end $$;

revoke all on function public.learning_submit(uuid, text, text) from public, anon, authenticated;
grant execute on function public.learning_submit(uuid, text, text) to authenticated;

-- ── A hand-in is something a person did ───────────────────────────────────
-- `lti_account_untouched` decides whether an account may be linked away as
-- empty. Work a student handed in is their own act, like a regrade request,
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
      -- 20261019120000: work a student handed in.
      ('public.learning_submissions', 'student_id')
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
--   -- First re-run lti_account_untouched from 20261004181000, which drops the
--   -- learning_submissions row.
--   drop function if exists public.learning_submit(uuid, text, text);
--   drop trigger if exists grade_entry_binds_submission on public.grade_entries;
--   drop function if exists private.grade_entry_binds_submission();
--   alter table public.grade_entries drop column if exists submission_id;
--   drop table if exists public.learning_submissions;
--   delete from public.gradebook_operations where kind = 'submit';
--   alter table public.gradebook_operations drop constraint if exists gradebook_operations_kind_check;
--   alter table public.gradebook_operations add constraint gradebook_operations_kind_check
--     check (kind in ('scheme', 'item', 'enter', 'moderate', 'release', 'regrade', 'resolve', 'passback'));
--   delete from public.role_capabilities where capability = 'submissions:create';
--   delete from public.app_capabilities where capability = 'submissions:create';
--   commit;
