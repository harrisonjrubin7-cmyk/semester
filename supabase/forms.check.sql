-- The second table in this schema a stranger is meant to be able to reach,
-- and the first one they are meant to be able to *write* to.
--
-- `public.published_forms` hands a form's questions to somebody with no
-- account, and `public.form_responses` takes their answers. The link is the
-- whole of the authentication, exactly as it is for `calendar_feeds`, so the
-- deliberate hole must be the shape it was meant to be and no larger.
--
-- What this covers:
--
--   * The answer key never leaves the owner. `marking` is in no grant and in
--     no view; a respondent reading the published form gets questions and no
--     way to know which option scores.
--   * `owner` is not selectable through the view either — a form's link would
--     otherwise hand out the account id of whoever made it.
--   * The signed-out `anon` role — the role the app's publishable key maps to
--     — can read nothing from `public.forms` itself.
--   * A stranger cannot read anybody's responses, including to a form they
--     just answered. Answering is write-only, which is what makes a form a
--     ballot box rather than a noticeboard.
--   * A closed form, a form that has not opened, a withdrawn form and a form
--     at its cap all refuse the next answer — in the database, not in the
--     client that can be skipped by anyone who can read the link.
--   * One account cannot read, change, or delete another's form.
--   * Deleting the account takes the forms with it, and deleting a form takes
--     its responses with it. A live link outliving the account that published
--     it is the worst bug this feature could have.
--
-- ## What these checks are indifferent to, and why that is right
--
-- Mutating the migration proves which line each check is actually holding.
-- Widening the form's select policy to `true`, widening the response read,
-- exposing `marking` or `owner` through the view, and dropping the cap clause
-- are each caught here. Two mutations are *not*: granting `select` on
-- `public.forms` to `anon`, and granting `select` on `public.form_responses`
-- to `anon`. Both pass.
--
-- That is not a hole in the checks. Row-level security is the gate, and a
-- grant with no policy permitting the row exposes nothing — as `anon`,
-- `auth.uid()` is null and neither table has a policy that matches. The
-- `revoke` and the narrow grants in the migration are defence in depth, and
-- the checks being indifferent to them is the accurate reading: it is the
-- policies that must not move, and it is the policies these fail on.
--
--   How to run it: open the Supabase SQL Editor, paste this file's CONTENTS —
--   not its path — and run. It makes its own users and rolls everything back
--   at the end, so it leaves nothing behind and is safe against a project with
--   real data in it. Or `supabase/check.sh forms`, which is how it is run here.

begin;

do $$
declare
  author   uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  stranger uuid := 'ffffffff-0000-0000-0000-000000000002';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (author,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'form.author.test@example.edu',   now(), now(), now()),
    (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'form.stranger.test@example.edu', now(), now(), now())
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

-- Signed out, which is the role the shipped publishable key maps to.
create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

-- ── The author publishes a form ───────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  insert into public.forms (id, owner, title, description, questions, marking, response_limit)
  values ('11111111-1111-1111-1111-111111111111', auth.uid(),
          'Study group interest',
          'Two questions, thirty seconds.',
          '[{"id":"q1","title":"Which section are you in?","type":"Multiple choice","required":true,"options":["001","002"],"condition":null}]'::jsonb,
          '{"q1":{"answer":"001","points":1}}'::jsonb,
          null);

  select count(*) into n from public.forms where owner = auth.uid();
  perform pg_temp.counted('the author can read their own form', n, 1);

  select count(*) into n from public.forms where marking ? 'q1';
  perform pg_temp.counted('and the answer key is theirs to read', n, 1);
end $$;

-- ── A respondent, holding only the link ───────────────────────────────────

do $$
declare n bigint; got text;
begin
  perform pg_temp.become_anon();

  select count(*) into n from public.published_forms
   where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.counted('a stranger with the link can read the questions', n, 1);

  -- The table itself, as opposed to the view. Revoked, so this is a privilege
  -- error rather than an empty result — and either would be a pass, which is
  -- why both are caught and only a returned row fails.
  begin
    select count(*) into n from public.forms;
    perform pg_temp.counted('a stranger cannot read the forms table', n, 0);
  exception when insufficient_privilege then
    raise notice 'ok  a stranger cannot read the forms table (no grant)';
  end;

  -- The two columns the whole split exists for. `marking` is the answer key
  -- and `owner` is an account id; neither is in the view, so asking for them
  -- is an error about a column that does not exist on this relation.
  begin
    execute 'select marking from public.published_forms limit 1' into got;
    raise exception 'FAILED: the answer key is readable through the published view';
  exception when undefined_column then
    raise notice 'ok  the answer key is not a column a respondent can ask for';
  end;

  begin
    execute 'select owner from public.published_forms limit 1' into got;
    raise exception 'FAILED: the author''s account id is readable through the published view';
  exception when undefined_column then
    raise notice 'ok  the author''s account id is not a column a respondent can ask for';
  end;
end $$;

-- ── They answer it ────────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become_anon();

  insert into public.form_responses (form_id, answers)
  values ('11111111-1111-1111-1111-111111111111', '{"q1":"001"}'::jsonb);

  -- And cannot read it back, or anybody else's.
  begin
    select count(*) into n from public.form_responses;
    perform pg_temp.counted('answering is write-only for a respondent', n, 0);
  exception when insufficient_privilege then
    raise notice 'ok  answering is write-only for a respondent (no grant)';
  end;
end $$;

-- ── The author reads what came back ───────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  select count(*) into n from public.form_responses
   where form_id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.counted('the author reads the answers', n, 1);
end $$;

-- ── A second account may not ──────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('ffffffff-0000-0000-0000-000000000002');

  select count(*) into n from public.forms;
  perform pg_temp.counted('a stranger cannot read your form row', n, 0);

  select count(*) into n from public.form_responses;
  perform pg_temp.counted('a stranger cannot read your responses', n, 0);

  update public.forms set title = 'taken over' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform pg_temp.counted('a stranger cannot rename your form', n, 0);

  delete from public.forms where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform pg_temp.counted('a stranger cannot withdraw your form', n, 0);

  delete from public.form_responses;
  get diagnostics n = row_count;
  perform pg_temp.counted('a stranger cannot destroy your responses', n, 0);
end $$;

-- ── Closed means closed, in the database ──────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');
  update public.forms set accepting = false where id = '11111111-1111-1111-1111-111111111111';

  perform pg_temp.become_anon();

  select count(*) into n from public.published_forms
   where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.counted('a form no longer accepting is not published', n, 0);

  begin
    insert into public.form_responses (form_id, answers)
    values ('11111111-1111-1111-1111-111111111111', '{"q1":"002"}'::jsonb);
    raise exception 'FAILED: a closed form took an answer';
  exception when insufficient_privilege then
    raise notice 'ok  a closed form refuses the next answer';
  end;
end $$;

-- ── And so does a window that has not opened, or has passed ───────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');
  update public.forms
     set accepting = true, opens = now() + interval '1 day', closes = null
   where id = '11111111-1111-1111-1111-111111111111';

  perform pg_temp.become_anon();
  select count(*) into n from public.published_forms
   where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.counted('a form that has not opened yet is not published', n, 0);

  begin
    insert into public.form_responses (form_id, answers) values ('11111111-1111-1111-1111-111111111111', '{}'::jsonb);
    raise exception 'FAILED: a form that has not opened took an answer';
  exception when insufficient_privilege then
    raise notice 'ok  a form that has not opened refuses an answer';
  end;

  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');
  update public.forms
     set opens = now() - interval '2 days', closes = now() - interval '1 day'
   where id = '11111111-1111-1111-1111-111111111111';

  perform pg_temp.become_anon();
  select count(*) into n from public.published_forms
   where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.counted('a form whose window has passed is not published', n, 0);

  begin
    insert into public.form_responses (form_id, answers) values ('11111111-1111-1111-1111-111111111111', '{}'::jsonb);
    raise exception 'FAILED: a closed window took an answer';
  exception when insufficient_privilege then
    raise notice 'ok  a form whose window has passed refuses an answer';
  end;
end $$;

-- ── The cap is enforced where it cannot be skipped ────────────────────────
--
-- The control matters here: the first insert under the cap must succeed. A
-- test that only watches the refusal would pass against a form that refused
-- everything, which is the failure mode a cap actually has.

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');
  insert into public.forms (id, owner, title, questions, response_limit)
  values ('22222222-2222-2222-2222-222222222222', auth.uid(), 'One answer only', '[]'::jsonb, 2);

  perform pg_temp.become_anon();

  insert into public.form_responses (form_id, answers) values ('22222222-2222-2222-2222-222222222222', '{"a":"1"}'::jsonb);
  raise notice 'ok  the first answer under the cap is taken';
  insert into public.form_responses (form_id, answers) values ('22222222-2222-2222-2222-222222222222', '{"a":"2"}'::jsonb);
  raise notice 'ok  the second answer under the cap is taken';

  begin
    insert into public.form_responses (form_id, answers) values ('22222222-2222-2222-2222-222222222222', '{"a":"3"}'::jsonb);
    raise exception 'FAILED: a form at its cap took one more';
  exception when insufficient_privilege then
    raise notice 'ok  a form at its cap refuses the next answer';
  end;
end $$;

-- ── Nobody may edit a submitted answer ────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  update public.form_responses set answers = '{"a":"rewritten"}'::jsonb
   where form_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform pg_temp.counted('not even the author can rewrite a response', n, 0);
end $$;

-- ── Withdrawing a form takes its answers with it ──────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  select count(*) into n from public.form_responses where form_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.counted('the capped form has its answers', n, 2);

  delete from public.forms where id = '22222222-2222-2222-2222-222222222222';

  select count(*) into n from public.form_responses where form_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.counted('withdrawing a form takes its answers with it', n, 0);
end $$;

-- ── And deleting the account takes the forms ──────────────────────────────

do $$
declare n bigint;
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);

  delete from auth.users where id = 'eeeeeeee-0000-0000-0000-000000000001';

  select count(*) into n from public.forms where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.counted('deleting the account takes the form with it', n, 0);
end $$;

rollback;
