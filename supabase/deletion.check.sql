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

rollback;
