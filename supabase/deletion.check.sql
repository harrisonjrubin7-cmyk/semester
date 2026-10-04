-- What "Delete my account" actually empties, walked as the account doing it.
--
-- `deleteEverything` in `app/src/lib/cloud.ts` cannot delete an `auth.users`
-- row — a browser holding a publishable key must not be able to — so the
-- `on delete cascade` that the rest of this schema hangs off **never fires**.
-- What a deleted account is emptied of is exactly the list in `OWNED_TABLES`,
-- sent from the client, under row-level security, one statement per table.
--
-- That made the privacy page's old claim — "removes every row belonging to
-- you… it cascades in the database" — false for eleven tables. `classmates.ts`
-- wrote nine and `formshare.ts` two, none of them in that list, so a student's
-- display name, their enrolments, their group memberships and every message
-- they had sent all survived the button. The client guard that was supposed to
-- catch it read one file out of three; `app/src/lib/privacy.test.ts` reads
-- every module now.
--
-- This file is the other half, and it is the half a TypeScript test cannot
-- reach: whether the policies *permit* what the client sends. Three properties
-- carry it.
--
--   * **Every delete the client sends is allowed.** A statement the policies
--     refuse is a row left behind, and the client sees `row_count = 0` rather
--     than an error — so a forgotten delete policy fails silently, which is
--     the worst way for this particular promise to fail.
--   * **The rows another person relies on stay.** A group you started is used
--     by its other members, so deleting it would destroy their shared tasks.
--     Your membership goes, the group stands. `KEPT_TABLES` holds these three
--     with the reason the privacy page prints.
--   * **Deletion cannot be used to undo somebody else's protection.** The
--     block another student placed on you is keyed on `blocked`, not
--     `user_id`. Deleting your account must not lift it, and the policy here
--     is what stops it — not the client's choice of column.
--
--   How to run it: open the Supabase SQL Editor, paste this file's CONTENTS —
--   not its path — and run. It makes its own users and rolls everything back
--   at the end. Or `supabase/check.sh deletion`, which runs it against a
--   throwaway cluster with every migration applied.
--
-- As with the other suites, `check.sh` grants every table to `anon` and
-- `authenticated` after the migrations, so what is proved below is that
-- row-level security alone holds, with the table grants at their most
-- generous.

begin;

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000dd01';
  other  uuid := 'ffffffff-0000-0000-0000-00000000dd02';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (leaver, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'del.leaver.test@example.edu', now(), now(), now()),
    (other,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'del.other.test@example.edu',  now(), now(), now())
  on conflict (id) do nothing;
end $$;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

-- ── Two students in one class, with everything the feature makes ──────────
--
-- Built as the students themselves rather than with the role reset, so that a
-- row this suite could not have created is not a row it goes on to assert
-- about. The insert policies are checked by the other suites; here they are
-- the setup, and a failure in one of them fails this file loudly at the top.

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000dd01';
  other  uuid := 'ffffffff-0000-0000-0000-00000000dd02';
  n      bigint;
begin
  perform pg_temp.become(leaver);
  insert into public.profiles (user_id, handle) values (leaver, 'the leaver');
  insert into public.enrollments (user_id, term, code) values (leaver, '2026FA', 'vanderbilt/ECON 1020');
  insert into public.messages (id, term, code, user_id, body)
    values ('dddddddd-0000-0000-0000-00000000aa01', '2026FA', 'vanderbilt/ECON 1020', leaver, 'mine, and going');
  insert into public.forms (id, owner, title) values ('dddddddd-0000-0000-0000-00000000bb01', leaver, 'a paper');
  insert into public.groups (id, term, code, name, created_by)
    values ('dddddddd-0000-0000-0000-00000000cc01', '2026FA', 'vanderbilt/ECON 1020', 'the reading group', leaver);
  insert into public.group_members (group_id, user_id)
    values ('dddddddd-0000-0000-0000-00000000cc01', leaver);
  insert into public.group_tasks (id, group_id, title, created_by)
    values ('dddddddd-0000-0000-0000-00000000cc02', 'dddddddd-0000-0000-0000-00000000cc01',
            'read chapter four', leaver);

  perform pg_temp.become(other);
  insert into public.profiles (user_id, handle) values (other, 'the other one');
  insert into public.enrollments (user_id, term, code) values (other, '2026FA', 'vanderbilt/ECON 1020');
  insert into public.messages (id, term, code, user_id, body)
    values ('dddddddd-0000-0000-0000-00000000aa02', '2026FA', 'vanderbilt/ECON 1020', other, 'theirs, and staying');
  insert into public.group_members (group_id, user_id)
    values ('dddddddd-0000-0000-0000-00000000cc01', other);
  -- The two rows deletion must not be able to touch: a report the leaver filed
  -- about somebody else, and a block somebody else placed on the leaver.
  insert into public.blocks (user_id, blocked) values (other, leaver);

  perform pg_temp.become(leaver);
  -- Before the block below, not after: leaving a reaction reads the message it
  -- is on, and a blocked person's message is not readable.
  insert into public.message_reactions (message_id, user_id, emoji, term, code)
    values ('dddddddd-0000-0000-0000-00000000aa02', leaver, '🎯', '2026FA', 'vanderbilt/ECON 1020');
  insert into public.blocks (user_id, blocked) values (leaver, other);
  insert into public.reports (reporter, message_id, about, reason)
    values (leaver, 'dddddddd-0000-0000-0000-00000000aa02', other, 'a reason');
  -- A response to the leaver's form, which has no column naming an account at
  -- all and so is only ever reached by the cascade from `forms`.
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into public.form_responses (form_id, answers)
    values ('dddddddd-0000-0000-0000-00000000bb01', '{"q": "a"}'::jsonb);

  select count(*) into n from public.form_responses
   where form_id = 'dddddddd-0000-0000-0000-00000000bb01';
  perform pg_temp.counted('setup: the form has an answer to lose', n, 1);
end $$;

-- ── Every delete the client sends, as the client sends it ─────────────────
--
-- One statement per row of `OWNED_TABLES`, keyed on the column that row names.
-- `row_count` is what is asserted rather than a count afterwards, because a
-- policy that refuses a delete returns zero rows and no error — which is
-- exactly how nine of these tables came to be missing without anybody seeing
-- a failure.

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000dd01';
  n      bigint;
begin
  perform pg_temp.become(leaver);

  -- In the order `OWNED_TABLES` lists them, because that order is what this
  -- suite exists to check. See the block comment further down: three of these
  -- stop being deletable the moment the enrolment is gone.
  delete from public.messages where user_id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('your own messages go', n, 1);

  delete from public.message_reactions where user_id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('and the reactions you left', n, 1);

  delete from public.group_members where user_id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('you leave every group you are in', n, 1);

  delete from public.enrollments where user_id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('which classes you said you were in goes', n, 1);

  delete from public.profiles where user_id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('the display name goes', n, 1);

  delete from public.blocks where user_id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('the blocks you made go', n, 1);

  -- `owner`, not `user_id`. The one table in this list that spells ownership
  -- differently, and the reason `OWNED_TABLES` carries a column per row
  -- instead of deleting everything `.eq('user_id', id)`.
  delete from public.forms where owner = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('your shared papers go, by owner rather than user_id', n, 1);
end $$;

-- ── What the client never sends, and must not need to ─────────────────────

do $$
declare n bigint;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- The cascade the client relies on rather than a request of its own. A
  -- referential action runs as the table's owner, not under row-level
  -- security, so withdrawing the form takes the answers even though nothing
  -- in `form_responses` names an account. `forms.check.sql` proves the same
  -- thing from the owner's side; this proves the row is gone after the walk
  -- above, which is the state the privacy page describes.
  select count(*) into n from public.form_responses
   where form_id = 'dddddddd-0000-0000-0000-00000000bb01';
  perform pg_temp.counted('the answers went with the form', n, 0);
end $$;

-- ── The rows another person is relying on ─────────────────────────────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000dd01';
  other  uuid := 'ffffffff-0000-0000-0000-00000000dd02';
  n      bigint;
begin
  perform pg_temp.become(other);

  -- The group the leaver started stands, with its shared part still on it.
  -- This is the product decision `KEPT_TABLES` records: deleting the group
  -- would have destroyed this member's data, and "delete everything" cannot
  -- mean deleting somebody else's.
  select count(*) into n from public.groups where id = 'dddddddd-0000-0000-0000-00000000cc01';
  perform pg_temp.counted('a group you started outlives your account', n, 1);

  select count(*) into n from public.group_tasks
   where id = 'dddddddd-0000-0000-0000-00000000cc02';
  perform pg_temp.counted('and the part you added is still on it', n, 1);

  select count(*) into n from public.group_members
   where group_id = 'dddddddd-0000-0000-0000-00000000cc01' and user_id = other;
  perform pg_temp.counted('the remaining member is still in it', n, 1);

  select count(*) into n from public.group_members
   where group_id = 'dddddddd-0000-0000-0000-00000000cc01' and user_id = leaver;
  perform pg_temp.counted('and the leaver is not', n, 0);

  -- Their own message is untouched. The leaver's is gone from the thread,
  -- which is the gap the privacy page says deletion leaves.
  select count(*) into n from public.messages where term = '2026FA' and code = 'vanderbilt/ECON 1020';
  perform pg_temp.counted('their message stays and yours left a gap', n, 1);
end $$;

-- ── And what deletion cannot be used to undo ──────────────────────────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000dd01';
  other  uuid := 'ffffffff-0000-0000-0000-00000000dd02';
  n      bigint;
begin
  perform pg_temp.become(leaver);

  -- The block the other student placed on the leaver. Keyed on `blocked`, and
  -- the policy is `using (auth.uid() = user_id)`, so it is not the client's
  -- choice of column that protects it. Deleting your account is not a way to
  -- reappear in somebody's room.
  delete from public.blocks where blocked = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('you cannot lift a block somebody placed on you', n, 0);

  -- A report is a record about another person. There is no delete policy on
  -- this table at all, deliberately — deleting your account is not a way to
  -- withdraw one. `KEPT_TABLES` says so and the privacy page prints it.
  delete from public.reports where reporter = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('you cannot withdraw a report by deleting your account', n, 0);

  reset role;
  perform set_config('request.jwt.claims', '', true);

  select count(*) into n from public.blocks where user_id = other and blocked = leaver;
  perform pg_temp.counted('the block is still there', n, 1);

  select count(*) into n from public.reports where reporter = leaver;
  perform pg_temp.counted('and so is the report', n, 1);
end $$;

-- ── The order is the check, not a detail of it ────────────────────────────
--
-- PostgreSQL applies SELECT policies to the WHERE clause of a DELETE, so a row
-- this account cannot read is a row it cannot delete *by a filter* — and
-- PostgREST only ever sends filters. `messages` and `message_reactions` are
-- readable through `private.in_class`, `group_members` through
-- `private.group_in_my_class`; all three go through `public.enrollments`.
--
-- Delete the enrolment first and those three stop matching. There is no error:
-- `row_count` is 0, PostgREST returns 204, and `deleteEverything` reports a
-- deleted account over a room still holding every message the student sent.
-- That is the same silent shape as the original defect, one layer down, and
-- the client's own tests cannot see it — a fake Supabase answers whatever it
-- is told to. Only a real policy does this.
--
-- So: the wrong order, on purpose, and the rows still there afterwards.

do $$
declare
  third uuid := 'aaaaaaaa-0000-0000-0000-00000000dd03';
  n     bigint;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values (third, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'del.third.test@example.edu', now(), now(), now())
  on conflict (id) do nothing;

  perform pg_temp.become(third);
  insert into public.enrollments (user_id, term, code)
    values (third, '2026FA', 'vanderbilt/HIST 1010');
  insert into public.messages (id, term, code, user_id, body)
    values ('dddddddd-0000-0000-0000-00000000ee01', '2026FA', 'vanderbilt/HIST 1010',
            third, 'said in a class I am about to leave');

  -- The enrolment first: the mistake.
  delete from public.enrollments where user_id = third;
  get diagnostics n = row_count;
  perform pg_temp.counted('the enrolment goes either way', n, 1);

  delete from public.messages where user_id = third;
  get diagnostics n = row_count;
  perform pg_temp.counted('and then the message cannot be deleted at all', n, 0);

  reset role;
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.messages
   where id = 'dddddddd-0000-0000-0000-00000000ee01';
  perform pg_temp.counted('so it is still in the room, with nobody told', n, 1);
end $$;

-- ── Personal intelligence evidence leaves with its owner ─────────────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ef01';
  other uuid := 'ffffffff-0000-0000-0000-00000000ef02';
  evidence uuid;
  claim uuid;
  consent uuid;
  capture uuid;
  n bigint;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into public.schools (id, name, email_domains)
  values ('deletion-evidence', 'Deletion Evidence University', array['deletion-evidence.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (leaver, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leaver@deletion-evidence.example', now(), now(), now()),
    (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@deletion-evidence.example', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values
    (leaver, 'evidence leaver', 'deletion-evidence'),
    (other, 'evidence keeper', 'deletion-evidence');

  perform pg_temp.become(leaver);
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by, expires_at)
  values ('deletion-evidence', leaver, 'lecture_capture', 'consented', '1', leaver, now() + interval '1 day')
  returning id into consent;
  insert into public.evidence_reference
    (tenant_id, person_id, course_id, title, origin, authority, locator)
  values ('deletion-evidence', leaver, 'econ', 'Private practice', 'student', 'unverified', 'question 1')
  returning id into evidence;
  insert into public.concept_evidence
    (tenant_id, person_id, evidence_id, course_id, concept_id, kind, score)
  values ('deletion-evidence', leaver, evidence, 'econ', 'demand', 'practice', 0.5);
  insert into public.mistake_evidence
    (tenant_id, person_id, evidence_id, course_id, concept_id, classification)
  values ('deletion-evidence', leaver, evidence, 'econ', 'demand', 'concept');
  insert into public.skill_claim (tenant_id, person_id, skill_name)
  values ('deletion-evidence', leaver, 'Demand analysis') returning id into claim;
  insert into public.skill_claim_evidence (tenant_id, person_id, skill_claim_id, evidence_id)
  values ('deletion-evidence', leaver, claim, evidence);
  insert into public.capture_asset
    (tenant_id, person_id, course_id, consent_id, name, mime, content_hash)
  values ('deletion-evidence', leaver, 'econ', consent, 'lecture.m4a', 'audio/mp4', 'sha256-delete')
  returning id into capture;
  insert into public.capture_segment (tenant_id, person_id, capture_id, locator, body)
  values ('deletion-evidence', leaver, capture, '00:01:00', 'Private transcript.');
  insert into public.capture_artifact (tenant_id, person_id, capture_id, kind, body, created_by)
  values ('deletion-evidence', leaver, capture, 'notes', '{}', leaver);

  -- These are the root records a deletion client removes. Their normalized
  -- children follow by cascade, so no derived learning or capture data is
  -- left detached from an account.
  delete from public.capture_asset where person_id = leaver;
  delete from public.skill_claim where person_id = leaver;
  delete from public.evidence_reference where person_id = leaver;
  delete from public.consent_record where subject_user_id = leaver;
  reset role;

  select
    (select count(*) from public.evidence_reference where person_id = leaver) +
    (select count(*) from public.concept_evidence where person_id = leaver) +
    (select count(*) from public.mistake_evidence where person_id = leaver) +
    (select count(*) from public.skill_claim where person_id = leaver) +
    (select count(*) from public.skill_claim_evidence where person_id = leaver) +
    (select count(*) from public.capture_asset where person_id = leaver) +
    (select count(*) from public.capture_segment where person_id = leaver) +
    (select count(*) from public.capture_artifact where person_id = leaver)
  into n;
  perform pg_temp.counted('personal learning, skill and capture evidence goes', n, 0);

  insert into public.evidence_reference
    (tenant_id, person_id, course_id, title, origin, authority, locator, created_by)
  values ('deletion-evidence', other, 'econ', 'Other student evidence', 'student', 'unverified', 'question 2', other);
  select count(*) into n from public.evidence_reference where person_id = other;
  perform pg_temp.counted('another student evidence remains', n, 1);
end $$;


-- ══ The server's erasure, and the export ════════════════════════════════
--
-- Everything above is the old client path, and it stays proved because its
-- policies still stand. What follows is the path the button takes now:
-- `erase_account(uuid)` (20260929010000), called by the `delete-account` Edge
-- Function with the service role, followed by the auth user's deletion.
-- Four properties, each checked against real policies and real cascades:
--
--   * **It is complete.** After it, no column anywhere that references
--     `auth.users` names the account — counted by a catalog scan written
--     here, not by the function's own list.
--   * **It keeps what the privacy page says stays.** A group you started, the
--     part you added, a report you filed, a post a moderation case holds —
--     each survives, with you no longer named. And then the auth row really
--     is deleted, and none of them go with it.
--   * **It is one transaction.** A refusal anywhere, including after most of
--     the rows are gone, leaves every row where it was.
--   * **The export is the same list.** Every table the account has rows in
--     comes back, apart from three that are another person's record about it.

create or replace function pg_temp.naming(who uuid)
returns bigint language plpgsql as $$
declare
  k record;
  n bigint;
  total bigint := 0;
begin
  -- Independent of `private.account_data_map()`: every single-column foreign
  -- key to auth.users, read straight off the catalog.
  for k in
    select format('%I.%I', ns.nspname, c.relname) as rel, a.attname as col
      from pg_constraint f
      join pg_class c on c.oid = f.conrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute a on a.attrelid = f.conrelid and a.attnum = f.conkey[1]
     where f.contype = 'f' and f.confrelid = 'auth.users'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', k.rel, k.col) into n using who;
    total := total + n;
  end loop;
  return total;
end $$;

do $$
declare
  n bigint;
  m bigint;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- The map is the catalog. A foreign key to auth.users it does not list is a
  -- column erasure would leave and export would miss.
  select count(*) into n from pg_constraint f
   join pg_class c on c.oid = f.conrelid
   join pg_namespace ns on ns.oid = c.relnamespace
   where f.contype = 'f' and f.confrelid = 'auth.users'::regclass and ns.nspname in ('public', 'private');
  select count(*) into m from private.account_data_map();
  perform pg_temp.counted('the map lists every foreign key to auth.users', m, n);
  -- The control: a map that matched nothing would pass the line above against
  -- an empty catalog, and so would every check below.
  perform pg_temp.counted('and there are plenty of them', (n > 100)::int, 1);

  select count(*) into n from private.account_data_map() where on_delete = 'refuse';
  perform pg_temp.counted('none of them would make the auth delete fail', n, 0);

  select count(*) into n from private.account_data_map()
   where (table_name, column_name, on_delete) in
         (('courses', 'user_id', 'delete'), ('forms', 'owner', 'delete'),
          ('groups', 'created_by', 'clear'), ('reports', 'reporter', 'clear'),
          ('community_posts', 'author_id', 'clear'), ('data_requests', 'user_id', 'clear'));
  perform pg_temp.counted('each column has the rule the privacy page needs', n, 6);

  select count(*) into n from private.account_data_map() where not exported;
  perform pg_temp.counted('three columns are withheld from an export', n, 3);

  perform pg_temp.counted('only the service role may erase an account',
    (not has_function_privilege('anon', 'public.erase_account(uuid)', 'execute'))::int
    + (not has_function_privilege('authenticated', 'public.erase_account(uuid)', 'execute'))::int
    + has_function_privilege('service_role', 'public.erase_account(uuid)', 'execute')::int, 3);
  perform pg_temp.counted('a signed-in account may export, a signed-out one may not',
    (not has_function_privilege('anon', 'public.export_my_data()', 'execute'))::int
    + has_function_privilege('authenticated', 'public.export_my_data()', 'execute')::int, 2);
end $$;

-- ── A leaver with a bit of everything, and a stayer beside them ───────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
  stayer uuid := 'ffffffff-0000-0000-0000-00000000ee12';
  space uuid;
  consent uuid;
  cohort uuid;
  membership uuid;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into public.schools (id, name, email_domains)
  values ('erasure-u', 'Erasure University', array['erasure.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (leaver, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'leaver@erasure.example', now(), now(), now()),
    (stayer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'stayer@erasure.example', now(), now(), now());
  insert into public.invites (email, note) values ('leaver@erasure.example', 'pilot');

  -- Built as postgres: the insert policies are the other suites' business,
  -- and here they would only decide which of these rows could exist.
  insert into public.profiles (user_id, handle, school_id) values
    (leaver, 'the eraser', 'erasure-u'), (stayer, 'the stayer', 'erasure-u');
  insert into public.courses (user_id, id, data) values (leaver, 'econ', '{"name": "Economics"}');
  insert into public.enrollments (user_id, term, code) values
    (leaver, '2026FA', 'vanderbilt/ECON 3030'), (stayer, '2026FA', 'vanderbilt/ECON 3030');
  insert into public.messages (id, term, code, user_id, body) values
    ('dddddddd-0000-0000-0000-0000000e0a01', '2026FA', 'vanderbilt/ECON 3030', leaver, 'mine'),
    ('dddddddd-0000-0000-0000-0000000e0a02', '2026FA', 'vanderbilt/ECON 3030', stayer, 'theirs');
  insert into public.message_reactions (message_id, user_id, emoji, term, code)
    values ('dddddddd-0000-0000-0000-0000000e0a01', stayer, '👍', '2026FA', 'vanderbilt/ECON 3030');
  insert into public.groups (id, term, code, name, created_by)
    values ('dddddddd-0000-0000-0000-0000000e0c01', '2026FA', 'vanderbilt/ECON 3030', 'study group', leaver);
  insert into public.group_members (group_id, user_id) values
    ('dddddddd-0000-0000-0000-0000000e0c01', leaver), ('dddddddd-0000-0000-0000-0000000e0c01', stayer);
  insert into public.group_tasks (id, group_id, title, created_by)
    values ('dddddddd-0000-0000-0000-0000000e0c02', 'dddddddd-0000-0000-0000-0000000e0c01', 'chapter five', leaver);
  insert into public.forms (id, owner, title) values ('dddddddd-0000-0000-0000-0000000e0b01', leaver, 'a paper');
  insert into public.form_responses (form_id, answers)
    values ('dddddddd-0000-0000-0000-0000000e0b01', '{"q": "a"}'::jsonb);
  insert into public.blocks (user_id, blocked) values (leaver, stayer), (stayer, leaver);
  insert into public.reports (reporter, message_id, about, reason) values
    (leaver, 'dddddddd-0000-0000-0000-0000000e0a02', stayer, 'filed by the leaver'),
    (stayer, 'dddddddd-0000-0000-0000-0000000e0a01', leaver, 'filed about the leaver');
  insert into public.data_requests (user_id, kind, details)
    values (leaver, 'correct', 'My legal name is Erin Leaver, not E. Leaver.');

  -- Rows that hang off the account only through another table.
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by, expires_at)
  values ('erasure-u', leaver, 'lecture_capture', 'consented', '1', leaver, now() + interval '1 day')
  returning id into consent;
  insert into public.capture_asset (tenant_id, person_id, course_id, consent_id, name, mime, content_hash)
  values ('erasure-u', leaver, 'econ', consent, 'lecture.m4a', 'audio/mp4', 'sha256-erasure');

  insert into public.beta_programs (id, name, status, support_contact)
    values ('erasure-beta', 'Erasure beta', 'active', 'beta@erasure.example');
  insert into public.beta_cohorts (program_id, kind, capacity)
    values ('erasure-beta', 'students', 10) returning id into cohort;
  insert into public.beta_invitations (cohort_id, email) values (cohort, 'leaver@erasure.example');
  insert into public.beta_memberships (cohort_id, user_id) values (cohort, leaver) returning id into membership;
  insert into public.beta_feedback (membership_id, kind, body) values (membership, 'idea', 'dark mode');

  -- A community post a moderation case holds, one no case holds, and a
  -- report the leaver filed on the stayer's post.
  insert into public.communities (tenant_id, kind, name) values ('erasure-u', 'study_group', 'Econ circle')
    returning id into space;
  insert into public.community_members (community_id, user_id) values (space, leaver), (space, stayer);
  insert into public.community_posts (id, community_id, tenant_id, author_id, author_ref, author_name, body) values
    ('dddddddd-0000-0000-0000-0000000e0d01', space, 'erasure-u', leaver, 'ref-l1', 'Erin', 'held by a case'),
    ('dddddddd-0000-0000-0000-0000000e0d02', space, 'erasure-u', leaver, 'ref-l2', 'Erin', 'nothing holds this'),
    ('dddddddd-0000-0000-0000-0000000e0d03', space, 'erasure-u', stayer, 'ref-s1', 'Sam', 'the stayer says');
  insert into public.community_cases (tenant_id, post_id, category, severity)
    values ('erasure-u', 'dddddddd-0000-0000-0000-0000000e0d01', 'harassment_or_bullying', 'P2');
  insert into public.community_reports (post_id, reporter_id, category)
    values ('dddddddd-0000-0000-0000-0000000e0d03', leaver, 'spam_scam_or_phishing');
end $$;

-- ── The export, as the leaver ─────────────────────────────────────────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
  file jsonb;
  t text;
begin
  perform pg_temp.become(leaver);
  file := public.export_my_data();
  reset role;

  perform pg_temp.counted('the export says whose it is',
    (file -> 'account' ->> 'email' = 'leaver@erasure.example')::int, 1);
  -- One of each way a row can belong to an account: its own column, a
  -- cleared column, a cascade child two tables down, a membership's feedback,
  -- and the rows keyed on the address rather than the account.
  foreach t in array array['courses', 'profiles', 'messages', 'enrollments', 'forms', 'form_responses',
                           'groups', 'group_tasks', 'group_members', 'consent_record', 'capture_asset',
                           'beta_memberships', 'beta_feedback', 'beta_invitations', 'invites',
                           'community_posts', 'community_reports', 'data_requests'] loop
    if not (file -> 'tables' ? t) then
      raise exception 'FAILED: the export has no % rows', t;
    end if;
  end loop;
  raise notice 'ok  every kind of row the leaver has is in the export (18 tables)';

  perform pg_temp.counted('your own block is in it',
    jsonb_array_length(file -> 'tables' -> 'blocks'), 1);
  perform pg_temp.counted('and the block somebody placed on you is not',
    (select count(*) from jsonb_array_elements(file -> 'tables' -> 'blocks') b
      where b ->> 'blocked' = leaver::text)::bigint, 0);
  perform pg_temp.counted('the report you filed is in it',
    jsonb_array_length(file -> 'tables' -> 'reports'), 1);
  perform pg_temp.counted('and the one filed about you, which names its reporter, is not',
    (select count(*) from jsonb_array_elements(file -> 'tables' -> 'reports') r
      where r ->> 'about' = leaver::text)::bigint, 0);
  -- Three columns of the person's own tables, and one whole table (a school's
  -- guardian restrictions, 20261004150000).
  perform pg_temp.counted('and the file says what it left out, and why',
    jsonb_array_length(file -> 'withheld'), 4);
  perform pg_temp.counted('the export is itself on the record',
    (select count(*) from jsonb_array_elements(file -> 'tables' -> 'data_requests') d
      where d ->> 'kind' = 'export')::bigint, 1);
  perform pg_temp.counted('no password hash travels with it',
    (file::text like '%encrypted_password%')::int, 0);
end $$;

do $$
declare
  stayer uuid := 'ffffffff-0000-0000-0000-00000000ee12';
  file jsonb;
begin
  perform pg_temp.become(stayer);
  file := public.export_my_data();
  reset role;
  perform pg_temp.counted('another account exports only its own',
    ((file -> 'tables' ? 'courses') or (file -> 'tables' ? 'forms'))::int, 0);

  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    perform public.export_my_data();
    raise exception 'FAILED: a signed-out caller exported something';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-out caller cannot export';
  end;
  reset role;
end $$;

-- ── Nobody but the service role can erase ─────────────────────────────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
begin
  perform pg_temp.become(leaver);
  begin
    perform public.erase_account(leaver);
    raise exception 'FAILED: an account erased itself without the Edge Function';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-in account cannot call erase_account, even on itself';
  end;
  reset role;
end $$;

-- ── All or nothing ─────────────────────────────────────────────────────────
--
-- Two ways it can refuse, both rolled back whole. The first is caught before a
-- row is touched: a column with no delete rule. The second is the one that
-- matters, because it happens after the community post has been withdrawn,
-- the memberships deleted and most of the loop run — a trigger refusing the
-- clear, the shape `tenant_plan_history` has on a real project. Both are
-- made here, for this transaction, and dropped.

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  create table public.zz_erasure_probe (who uuid references auth.users(id));
  insert into public.zz_erasure_probe values (leaver);
  begin
    perform public.erase_account(leaver);
    raise exception 'FAILED: erasure ran past a column with no delete rule';
  exception when object_not_in_prerequisite_state then
    raise notice 'ok  a column with no delete rule stops erasure before it starts';
  end;
  drop table public.zz_erasure_probe;

  create table public.zz_erasure_probe (who uuid references auth.users(id) on delete set null);
  create function pg_temp.refuse() returns trigger language plpgsql as
    $f$ begin raise exception 'this history is immutable'; end $f$;
  create trigger zz_refuse before update on public.zz_erasure_probe
    for each row execute function pg_temp.refuse();
  insert into public.zz_erasure_probe values (leaver);
  begin
    perform public.erase_account(leaver);
    raise exception 'FAILED: erasure succeeded through a refusing trigger';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok  a refusal half way through is an error, not a partial erasure';
  end;
  drop table public.zz_erasure_probe;
end $$;

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
  n bigint;
begin
  reset role;
  select count(*) into n from public.courses where user_id = leaver;
  perform pg_temp.counted('after both refusals the courses are still there', n, 1);
  select count(*) into n from public.community_members where user_id = leaver;
  perform pg_temp.counted('and the memberships a forget_my_* function had already removed', n, 1);
  select count(*) into n from public.community_posts
   where id = 'dddddddd-0000-0000-0000-0000000e0d01' and status = 'published' and author_id = leaver;
  perform pg_temp.counted('and the held post is as it was, not withdrawn', n, 1);
  select count(*) into n from public.data_requests where kind = 'delete' and user_id is null;
  perform pg_temp.counted('and no deletion is on the record', n, 0);
end $$;

-- ── Erasure, as the Edge Function calls it ────────────────────────────────

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
  said jsonb;
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  -- Supabase grants the service role this; the stub does not.
  grant usage on schema public to service_role;
  execute 'set local role service_role';
  said := public.erase_account(leaver);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.counted('it reports what it removed',
    ((said -> 'removed' ->> 'courses')::bigint), 1);
  perform pg_temp.counted('and hands back a receipt', (said ->> 'receipt' is not null)::int, 1);
  perform pg_temp.counted('no column that references auth.users still names the account',
    pg_temp.naming(leaver), 0);
end $$;

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
  stayer uuid := 'ffffffff-0000-0000-0000-00000000ee12';
  n bigint;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);

  select count(*) into n from public.form_responses where form_id = 'dddddddd-0000-0000-0000-0000000e0b01';
  perform pg_temp.counted('the answers to the leaver''s form went with it', n, 0);
  select count(*) into n from public.capture_asset where person_id = leaver;
  perform pg_temp.counted('a recording hanging off a consent went with it', n, 0);
  select count(*) into n from public.beta_feedback f
    join public.beta_memberships b on b.id = f.membership_id where b.user_id = leaver;
  perform pg_temp.counted('beta feedback went with the membership', n, 0);
  select count(*) into n from public.beta_invitations where email = 'leaver@erasure.example';
  perform pg_temp.counted('the beta invitation to the address went', n, 0);
  select count(*) into n from public.invites where email = 'leaver@erasure.example';
  perform pg_temp.counted('and the pilot invitation to it', n, 0);
  select count(*) into n from public.message_reactions where message_id = 'dddddddd-0000-0000-0000-0000000e0a01';
  perform pg_temp.counted('a reaction to the leaver''s message went with the message', n, 0);

  select count(*) into n from public.groups
   where id = 'dddddddd-0000-0000-0000-0000000e0c01' and created_by is null;
  perform pg_temp.counted('the group the leaver started stands, starter cleared', n, 1);
  select count(*) into n from public.group_tasks
   where id = 'dddddddd-0000-0000-0000-0000000e0c02' and created_by is null;
  perform pg_temp.counted('and the part they added', n, 1);
  select count(*) into n from public.group_members where user_id = stayer;
  perform pg_temp.counted('and the other member is still in it', n, 1);
  select count(*) into n from public.messages where user_id = stayer;
  perform pg_temp.counted('the stayer''s message is untouched', n, 1);
  select count(*) into n from public.reports where reason = 'filed by the leaver' and reporter is null;
  perform pg_temp.counted('a report the leaver filed stays, not attributed', n, 1);
  select count(*) into n from public.reports where reason = 'filed about the leaver' and reporter = stayer;
  perform pg_temp.counted('a report about the leaver stays with its reporter', n, 1);
  select count(*) into n from public.blocks where user_id = stayer;
  perform pg_temp.counted('a block on the leaver is gone with the account it named', n, 0);
  select count(*) into n from public.community_posts
   where id = 'dddddddd-0000-0000-0000-0000000e0d01' and author_id is null
     and status = 'withdrawn' and author_name = 'Deleted account';
  perform pg_temp.counted('a post a case holds is withdrawn and anonymised, not deleted', n, 1);
  select count(*) into n from public.community_posts where id = 'dddddddd-0000-0000-0000-0000000e0d02';
  perform pg_temp.counted('a post nothing holds is gone', n, 0);
  select count(*) into n from public.community_reports where reporter_id is null;
  perform pg_temp.counted('a community report the leaver filed stays, not attributed', n, 1);

  select count(*) into n from public.data_requests
   where kind = 'correct' and user_id is null and details = '';
  perform pg_temp.counted('an earlier request stays, cleared of who and what it said', n, 1);
  select count(*) into n from public.data_requests
   where kind = 'delete' and status = 'completed' and user_id is null and completed_at is not null;
  perform pg_temp.counted('and the deletion is on the record, naming nobody', n, 1);
  select count(*) into n from public.data_requests where details like '%Erin%' or details like '%leaver%';
  perform pg_temp.counted('no request text still names the leaver', n, 0);
end $$;

-- ── And then the auth row, which is what the Edge Function deletes next ──
--
-- The delete GoTrue runs. Nothing is left to cascade, so what is proved is
-- the other half: no foreign key refuses it, and none of the rows above that
-- were promised to stay goes with it. Before 20260929010000 this took the
-- group, the task, both reports and the held post.

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000ee11';
  n bigint;
begin
  reset role;
  delete from auth.users where id = leaver;
  get diagnostics n = row_count;
  perform pg_temp.counted('the sign-in itself is deleted', n, 1);
  select count(*) into n from public.groups where id = 'dddddddd-0000-0000-0000-0000000e0c01';
  perform pg_temp.counted('and the group is still standing after it', n, 1);
  select count(*) into n from public.community_posts where id = 'dddddddd-0000-0000-0000-0000000e0d01';
  perform pg_temp.counted('and so is the held post', n, 1);
end $$;

-- ── The pinned starter is still pinned against everybody else ─────────────

do $$
declare
  stayer uuid := 'ffffffff-0000-0000-0000-00000000ee12';
begin
  reset role;
  insert into public.groups (id, term, code, name, created_by)
    values ('dddddddd-0000-0000-0000-0000000e0c09', '2026FA', 'vanderbilt/ECON 3030', 'another', stayer);
  begin
    update public.groups set created_by = null where id = 'dddddddd-0000-0000-0000-0000000e0c09';
    raise exception 'FAILED: a live starter was cleared off their group';
  exception when restrict_violation then
    raise notice 'ok  a live account cannot be cleared off a group it started';
  end;
  begin
    update public.groups set created_by = 'eeeeeeee-0000-0000-0000-00000000ee11'
     where id = 'dddddddd-0000-0000-0000-0000000e0c09';
    raise exception 'FAILED: a group''s starter was rewritten';
  exception when restrict_violation or foreign_key_violation then
    raise notice 'ok  nor can the starter be rewritten to somebody else';
  end;
end $$;

rollback;
