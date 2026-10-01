-- supabase/assessments.check.sql — who writes a bank and a test, who may take
-- it, what the server's clock decides, and that a student is never sent a key.
--
-- For 20261001030000_assessments.sql. One course, ECON 1020 in 2026FA at
-- as-u: an instructor, a teaching assistant, two students on the roster, a
-- student of another course, a student whose grant names no term, faculty of
-- another course. What it proves:
--
--   * nothing is written unless the school runs `lms_assessments` in Core —
--     not in Connect, not frozen, not under `kill.core_modules`;
--   * only `assessments:author` writes banks, tests and extra time; a TA
--     reviews but does not write; keys are read by reviewers and no student;
--   * every kind of item is held to a key that makes sense for it;
--   * the items a student is sent carry no key; a started attempt is the same
--     attempt on resume; a pool draws the same questions on a refresh;
--   * an answer has the shape its kind takes; one for a question not on the
--     attempt is refused;
--   * scoring follows the key (choice, set, true/false, number within a
--     tolerance, text after trimming and case-folding); an essay is not scored
--     and flags the attempt for review; the score is not a grade;
--   * the deadline is the server's: past it, a save is answered `time_up` and
--     the attempt is finished with what was saved; extra time stretches it;
--   * the attempt limit and the window are enforced; finishing is idempotent;
--   * a finished attempt and its answers are never rewritten, even by the
--     owner; a bank item is retired, never edited;
--   * a student reviews their own attempt and sees what was right only when
--     the instructor chose to and the test has closed;
--   * nobody writes through the API; deleting an account takes the attempts.
--
--   How to run it: supabase/check.sh assessments

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- The error a statement raises as `who`, or null when it ran.
create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- Refused *for want of the capability on this course and term* — not for a
-- missing draft, a used key or any other reason a broken fixture could give.
create or replace function pg_temp.denied(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%that needs grades:%' then
    raise exception 'FAILED: % — refused, but not for want of the grant: %', what, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- A value a statement returns as `who`, as text.
create or replace function pg_temp.ask(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;


create or replace function pg_temp.denied(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%that needs assessments:%' and e not like '%not on this course''s%' then
    raise exception 'FAILED: % — refused, but not for want of the grant: %', what, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- Refused for the stated reason, so a broken fixture cannot pass for a rule.
create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not ilike '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;



do $$
declare
  prof uuid; ta uuid; other_prof uuid; ana uuid; ben uuid; dan uuid; untermed uuid;
  bank uuid; i_mc uuid; i_mr uuid; i_tf uuid; i_num uuid; i_short uuid; i_essay uuid; extra_item uuid;
  t_mid uuid; tB uuid; tC uuid; tFuture uuid; tOld uuid;
  st jsonb; st2 jsonb; fin jsonb; fin2 jsonb; rev jsonb; sv jsonb; att uuid; att2 uuid; attb uuid; n bigint; ids uuid[]; out_item uuid;
  mkitem constant text := $q$select public.assessment_bank_add_item(%L, %L, %L, %L::jsonb, %L::jsonb, %s, %L)$q$;
  mktest constant text := $q$select public.assessment_create(%L, %L, '', %s, %s, %s, %s, %s, %s, %s, %s, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('as-u', 'Assessments University', array['as-u.example']);
  prof       := pg_temp.newuser('prof@as-u.example', 'as-u');
  ta         := pg_temp.newuser('ta@as-u.example', 'as-u');
  other_prof := pg_temp.newuser('hist@as-u.example', 'as-u');
  ana        := pg_temp.newuser('ana@as-u.example', 'as-u');
  ben        := pg_temp.newuser('ben@as-u.example', 'as-u');
  dan        := pg_temp.newuser('dan@as-u.example', 'as-u');
  untermed   := pg_temp.newuser('una@as-u.example', 'as-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'as-u/ECON 1020/2026FA', 'institution'),
    (ta,         'teaching_assistant',    'course', 'as-u/ECON 1020/2026FA', 'institution'),
    (other_prof, 'faculty',               'course', 'as-u/HIST 2100/2026FA', 'institution'),
    (ana,        'undergraduate_student', 'course', 'as-u/ECON 1020/2026FA', 'institution'),
    (ben,        'student',               'course', 'as-u/ECON 1020/2026FA', 'institution'),
    (dan,        'undergraduate_student', 'course', 'as-u/HIST 2100/2026FA', 'institution'),
    (untermed,   'undergraduate_student', 'course', 'as-u/ECON 1020',         'institution');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('a bank while the school is in Connect', prof,
    $q$select public.assessment_bank_create('ECON 1020', '2026FA', 'Midterm bank', 'bank-connect-key')$q$, 'does not run tests in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('as-u', 'lms_assessments', 'core', false, 'check');

  -- ── The bank ───────────────────────────────────────────────────
  perform pg_temp.denied('a TA writing a bank', ta, $q$select public.assessment_bank_create('ECON 1020', '2026FA', 'TA bank', 'bank-ta-key')$q$);
  perform pg_temp.denied('a student writing a bank', ana, $q$select public.assessment_bank_create('ECON 1020', '2026FA', 'Mine', 'bank-ana-key')$q$);
  perform pg_temp.denied('faculty of another course', other_prof, $q$select public.assessment_bank_create('ECON 1020', '2026FA', 'Theirs', 'bank-oth-key')$q$);
  bank := pg_temp.ask(prof, $q$select public.assessment_bank_create('econ 1020', '2026FA', 'Midterm bank', 'bank-prof-key')$q$)::uuid;
  perform pg_temp.said('the same key answers the same bank', pg_temp.ask(prof, $q$select public.assessment_bank_create('econ 1020', '2026FA', 'Midterm bank', 'bank-prof-key')$q$), bank::text);

  i_mc    := pg_temp.ask(prof, format(mkitem, bank, 'multiple_choice', 'Price rises, demand falls: that is', '[{"id":"a","text":"supply"},{"id":"b","text":"the law of demand"},{"id":"c","text":"inflation"}]', '{"correct":"b"}', '1', 'item-mc-key'))::uuid;
  i_mr    := pg_temp.ask(prof, format(mkitem, bank, 'multiple_response', 'Which are factors of production?', '[{"id":"a","text":"land"},{"id":"b","text":"a coupon"},{"id":"c","text":"labour"}]', '{"correct":["a","c"]}', '2', 'item-mr-key'))::uuid;
  i_tf    := pg_temp.ask(prof, format(mkitem, bank, 'true_false', 'Scarcity exists in every economy.', '[]', '{"correct":true}', '1', 'item-tf-key'))::uuid;
  i_num   := pg_temp.ask(prof, format(mkitem, bank, 'numeric', 'Pi to two places', '[]', '{"value":3.14,"tolerance":0.01}', '1', 'item-num-key'))::uuid;
  i_short := pg_temp.ask(prof, format(mkitem, bank, 'short_answer', 'Name the market model', '[]', '{"accepted":["supply and demand","S&D"]}', '1', 'item-short-key'))::uuid;
  i_essay := pg_temp.ask(prof, format(mkitem, bank, 'essay', 'Discuss scarcity.', '[]', '{}', '5', 'item-essay-key'))::uuid;
  perform pg_temp.counted('six items were written', (select count(*) from public.bank_items), 6);
  perform pg_temp.refused_for('a choice key naming no option', prof, format(mkitem, bank, 'multiple_choice', 'Bad', '[{"id":"a","text":"x"},{"id":"b","text":"y"}]', '{"correct":"z"}', '1', 'item-bad1'), 'names one of the options');
  perform pg_temp.refused_for('a choice question with one option', prof, format(mkitem, bank, 'multiple_choice', 'Bad', '[{"id":"a","text":"x"}]', '{"correct":"a"}', '1', 'item-bad2'), 'two to ten options');
  perform pg_temp.refused_for('a numeric key that is not a number', prof, format(mkitem, bank, 'numeric', 'Bad', '[]', '{"value":"three"}', '1', 'item-bad3'), 'the key is a number');
  perform pg_temp.refused_for('a short-answer key with nothing accepted', prof, format(mkitem, bank, 'short_answer', 'Bad', '[]', '{"accepted":[]}', '1', 'item-bad4'), 'accepted answers');
  perform pg_temp.refused('zero points', prof, format(mkitem, bank, 'true_false', 'Bad', '[]', '{"correct":true}', '0', 'item-bad5'));

  perform pg_temp.counted('the instructor reads the items and keys', pg_temp.seen(prof, 'select 1 from public.bank_items'), 6);
  perform pg_temp.counted('the TA reviews them', pg_temp.seen(ta, 'select 1 from public.bank_items'), 6);
  perform pg_temp.counted('a student reads no item, so no key', pg_temp.seen(ana, 'select 1 from public.bank_items'), 0);
  perform pg_temp.counted('faculty of another course read none', pg_temp.seen(other_prof, 'select 1 from public.bank_items'), 0);

  -- ── Tests ──────────────────────────────────────────────────────
  perform pg_temp.refused_for('items and a pool together', prof,
    format(mktest, bank, 'Both', format('array[%L,%L]::uuid[]', i_mc, i_tf), '2', '30', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '2', 'false', 'false', 'test-both-key'),
    'not both and not neither');
  perform pg_temp.refused_for('neither items nor a pool', prof,
    format(mktest, bank, 'Neither', 'null', 'null', '30', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '2', 'false', 'false', 'test-neither-key'), 'not both and not neither');
  perform pg_temp.refused('a window that ends before it begins', prof,
    format(mktest, bank, 'Backwards', format('array[%L]::uuid[]', i_mc), 'null', '30', $t$now() + interval '1 hour'$t$, $t$now() - interval '1 hour'$t$, '1', 'false', 'false', 'test-back-key'));
  perform pg_temp.denied('a TA creating a test', ta,
    format(mktest, bank, 'TA test', format('array[%L]::uuid[]', i_mc), 'null', '30', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '1', 'false', 'false', 'test-ta-key'));

  t_mid := pg_temp.ask(prof, format(mktest, bank, 'Midterm', format('array[%L,%L,%L,%L,%L,%L]::uuid[]', i_mc, i_mr, i_tf, i_num, i_short, i_essay), 'null', '30',
         $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '2', 'false', 'true', 'test-a-key'))::uuid;
  tB := pg_temp.ask(prof, format(mktest, bank, 'Pool quiz', 'null', '3', '10', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '1', 'false', 'false', 'test-b-key'))::uuid;
  tC := pg_temp.ask(prof, format(mktest, bank, 'Draft test', format('array[%L]::uuid[]', i_mc), 'null', '10', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '1', 'false', 'false', 'test-c-key'))::uuid;
  tFuture := pg_temp.ask(prof, format(mktest, bank, 'Not yet', format('array[%L]::uuid[]', i_mc), 'null', '10', $t$now() + interval '1 hour'$t$, $t$now() + interval '2 hours'$t$, '1', 'false', 'false', 'test-f-key'))::uuid;
  tOld := pg_temp.ask(prof, format(mktest, bank, 'Pool too big', 'null', '99', '10', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '1', 'false', 'false', 'test-big-key'))::uuid;
  perform pg_temp.refused_for('publishing a pool bigger than the bank', prof, format($q$select public.assessment_publish(%L, 'pub-big-key')$q$, tOld), 'bank has only');
  perform pg_temp.denied('a TA publishing', ta, format($q$select public.assessment_publish(%L, 'pub-ta-key')$q$, t_mid));
  perform pg_temp.works('the instructor publishes the midterm', prof, format($q$select public.assessment_publish(%L, 'pub-a-key')$q$, t_mid));
  perform pg_temp.works('and the pool quiz', prof, format($q$select public.assessment_publish(%L, 'pub-b-key')$q$, tB));
  perform pg_temp.works('and the one that opens later', prof, format($q$select public.assessment_publish(%L, 'pub-f-key')$q$, tFuture));
  perform pg_temp.counted('a student reads the published tests, not the drafts', pg_temp.seen(ana, 'select 1 from public.assessments'), 3);
  perform pg_temp.counted('a student of another course reads none', pg_temp.seen(dan, 'select 1 from public.assessments'), 0);
  perform pg_temp.counted('the instructor reads all five', pg_temp.seen(prof, 'select 1 from public.assessments'), 5);

  -- ── Starting ───────────────────────────────────────────────────
  perform pg_temp.denied('a student of another course starting', dan, format($q$select public.assessment_start(%L, 'start-dan-key')$q$, t_mid));
  perform pg_temp.denied('a grant with no term starting', untermed, format($q$select public.assessment_start(%L, 'start-una-key')$q$, t_mid));
  perform pg_temp.refused_for('starting a draft', ana, format($q$select public.assessment_start(%L, 'start-draft-key')$q$, tC), 'not open');
  perform pg_temp.refused_for('starting before the window opens', ana, format($q$select public.assessment_start(%L, 'start-future-key')$q$, tFuture), 'not open right now');

  st := pg_temp.ask(ana, format($q$select public.assessment_start(%L, 'start-ana-1')$q$, t_mid))::jsonb;
  att := (st->>'attempt_id')::uuid;
  perform pg_temp.said('the first attempt is attempt 1', st->>'attempt', '1');
  perform pg_temp.said('and not a resume', st->>'resumed', 'false');
  st2 := pg_temp.ask(ana, format($q$select public.assessment_start(%L, 'start-ana-again')$q$, t_mid))::jsonb;
  perform pg_temp.said('starting again is the same attempt', st2->>'attempt_id', att::text);
  perform pg_temp.said('and says it resumed', st2->>'resumed', 'true');
  perform pg_temp.counted('with one attempt row', (select count(*) from public.assessment_attempts where student_id = ana), 1);
  perform pg_temp.counted('the deadline is the limit after the start (30 minutes)',
    (select count(*) from public.assessment_attempts where id = att and deadline_at - started_at = interval '30 minutes'), 1);

  -- ── The items a student is sent ────────────────────────────────
  perform pg_temp.counted('six questions are sent', (pg_temp.ask(ana, format($q$select jsonb_array_length((public.assessment_items(%L))->'items')$q$, att)))::int, 6);
  perform pg_temp.counted('and no key is in what was sent',
    (pg_temp.ask(ana, format($q$select (public.assessment_items(%L))::text like '%%answer_key%%' or (public.assessment_items(%L))::text like '%%accepted%%' or (public.assessment_items(%L))::text like '%%"correct"%%'$q$, att, att, att)) = 'true')::int, 0);
  perform pg_temp.refused_for('reading another student''s attempt', ben, format($q$select public.assessment_items(%L)$q$, att), 'no such attempt');

  -- ── Answers ────────────────────────────────────────────────────
  perform pg_temp.works('ana answers the choice question', ana, format($q$select public.assessment_save_answer(%L, %L, '{"choice":"b"}'::jsonb)$q$, att, i_mc));
  perform pg_temp.works('and changes her mind and answers again', ana, format($q$select public.assessment_save_answer(%L, %L, '{"choice":"a"}'::jsonb)$q$, att, i_mc));
  perform pg_temp.works('and settles', ana, format($q$select public.assessment_save_answer(%L, %L, '{"choice":"b"}'::jsonb)$q$, att, i_mc));
  perform pg_temp.counted('one answer is kept for the item', (select count(*) from public.attempt_answers where attempt_id = att and item_id = i_mc), 1);
  perform pg_temp.refused_for('an option that does not exist', ana, format($q$select public.assessment_save_answer(%L, %L, '{"choice":"z"}'::jsonb)$q$, att, i_mc), 'pick one');
  perform pg_temp.refused_for('a number given as text', ana, format($q$select public.assessment_save_answer(%L, %L, '{"value":"pi"}'::jsonb)$q$, att, i_num), 'with a number');
  perform pg_temp.works('the set of options', ana, format($q$select public.assessment_save_answer(%L, %L, '{"choices":["c","a"]}'::jsonb)$q$, att, i_mr));
  perform pg_temp.works('true or false', ana, format($q$select public.assessment_save_answer(%L, %L, '{"value":true}'::jsonb)$q$, att, i_tf));
  perform pg_temp.works('a number within the tolerance', ana, format($q$select public.assessment_save_answer(%L, %L, '{"value":3.145}'::jsonb)$q$, att, i_num));
  perform pg_temp.works('a text matching after trimming and case', ana, format($q$select public.assessment_save_answer(%L, %L, '{"text":"  SUPPLY   and Demand "}'::jsonb)$q$, att, i_short));
  perform pg_temp.works('an essay', ana, format($q$select public.assessment_save_answer(%L, %L, '{"text":"Scarcity is the basic economic problem."}'::jsonb)$q$, att, i_essay));
  perform pg_temp.counted('reviewers read the saved answers', pg_temp.seen(ta, 'select 1 from public.attempt_answers'), 6);
  perform pg_temp.counted('a student reads none directly', pg_temp.seen(ana, 'select 1 from public.attempt_answers'), 0);

  -- ── Finishing ──────────────────────────────────────────────────
  fin := pg_temp.ask(ana, format($q$select public.assessment_finish(%L, 'finish-ana-1')$q$, att))::jsonb;
  perform pg_temp.said('submitted', fin->>'status', 'submitted');
  perform pg_temp.said('the score follows the key: 1 + 2 + 1 + 1 + 1', fin->>'score', '6.000');
  perform pg_temp.said('out of every point, the essay included', fin->>'points', '11.000');
  perform pg_temp.said('and the essay flags it for review', fin->>'needs_review', 'true');
  fin2 := pg_temp.ask(ana, format($q$select public.assessment_finish(%L, 'finish-ana-1')$q$, att))::jsonb;
  perform pg_temp.said('the same key replays the same answer', fin2::text, fin::text);
  perform pg_temp.said('another key answers what was stored', (pg_temp.ask(ana, format($q$select public.assessment_finish(%L, 'finish-ana-2')$q$, att))::jsonb)->>'score', '6.000');
  perform pg_temp.refused_for('saving after the attempt is finished', ana, format($q$select public.assessment_save_answer(%L, %L, '{"choice":"a"}'::jsonb)$q$, att, i_mc), 'finished');
  begin
    update public.assessment_attempts set score = 99 where id = att;
    raise exception 'FAILED: the owner rewrote a finished attempt';
  exception when others then
    if sqlerrm not like '%never rewritten%' then raise; end if;
    raise notice 'ok  even the owner cannot rewrite a finished attempt (%)', sqlerrm;
  end;
  begin
    update public.attempt_answers set answer = '{"choice":"a"}'::jsonb where attempt_id = att and item_id = i_mc;
    raise exception 'FAILED: the owner rewrote a finished answer';
  exception when others then
    if sqlerrm not like '%never rewritten%' then raise; end if;
    raise notice 'ok  nor an answer of one (%)', sqlerrm;
  end;

  -- ── The review ─────────────────────────────────────────────────
  rev := pg_temp.ask(ana, format($q$select public.assessment_review(%L)$q$, att))::jsonb;
  perform pg_temp.said('while the test is open, no key is shown', rev->>'shown', 'false');
  perform pg_temp.counted('and none is in the review', (rev::text like '%answer_key%' or rev::text like '%"key"%')::int, 0);
  perform pg_temp.refused_for('reviewing another student''s attempt', ben, format($q$select public.assessment_review(%L)$q$, att), 'no such attempt');
  perform pg_temp.works('the instructor closes the midterm', prof, format($q$select public.assessment_close(%L, 'close-a-key')$q$, t_mid));
  rev := pg_temp.ask(ana, format($q$select public.assessment_review(%L)$q$, att))::jsonb;
  perform pg_temp.said('once it has closed, and the instructor chose to, the key is shown', rev->>'shown', 'true');
  perform pg_temp.counted('with every item', jsonb_array_length(rev->'items'), 6);
  perform pg_temp.refused_for('starting after it closed', ben, format($q$select public.assessment_start(%L, 'start-ben-closed')$q$, t_mid), 'not open');

  -- ── The pool ───────────────────────────────────────────────────
  st := pg_temp.ask(ana, format($q$select public.assessment_start(%L, 'start-ana-pool')$q$, tB))::jsonb;
  att2 := (st->>'attempt_id')::uuid;
  select item_ids into ids from public.assessment_attempts where id = att2;
  perform pg_temp.counted('the pool drew three questions', array_length(ids, 1), 3);
  perform pg_temp.counted('all different', (select count(distinct x) from unnest(ids) x), 3);
  perform pg_temp.counted('the same three on a resume', (pg_temp.ask(ana, format($q$select jsonb_array_length((public.assessment_items(%L))->'items')$q$, att2)))::int, 3);
  select id into out_item from public.bank_items where bank_id = bank and not (id = any(ids)) limit 1;
  perform pg_temp.refused_for('an answer to a question not on the attempt', ana,
    format($q$select public.assessment_save_answer(%L, %L, '{"value":true}'::jsonb)$q$, att2, out_item), 'not on this attempt');

  -- ── The deadline is the server's ───────────────────────────────
  attb := ((pg_temp.ask(ben, format($q$select public.assessment_start(%L, 'start-ben-pool')$q$, tB))::jsonb)->>'attempt_id')::uuid;
  select id into out_item from public.bank_items i where i.id = (select item_ids[1] from public.assessment_attempts where id = attb);
  perform pg_temp.works('ben saves one answer in time', ben, format($q$select public.assessment_save_answer(%L, %L, %L::jsonb)$q$, attb, out_item,
    (select case kind when 'multiple_choice' then '{"choice":"b"}' when 'multiple_response' then '{"choices":["a"]}' when 'true_false' then '{"value":true}'
       when 'numeric' then '{"value":3.14}' else '{"text":"x"}' end from public.bank_items where id = out_item)));
  update public.assessment_attempts set deadline_at = now() - interval '1 minute' where id = attb;
  perform pg_temp.said('past the deadline a save is answered time_up, not raised',
    (pg_temp.ask(ben, format($q$select (public.assessment_save_answer(%L, %L, '{"value":true}'::jsonb))->>'reason'$q$, attb, out_item))), 'time_up');
  perform pg_temp.said('and the attempt was finished as expired', (select status from public.assessment_attempts where id = attb), 'expired');
  perform pg_temp.said('with what was saved scored', (select (score is not null)::text from public.assessment_attempts where id = attb), 'true');
  perform pg_temp.said('and the screen is told so', (pg_temp.ask(ben, format($q$select (public.assessment_items(%L))->>'status'$q$, attb))), 'expired');

  -- ── Limits ─────────────────────────────────────────────────────
  perform pg_temp.refused_for('a second attempt on a one-attempt test', ben, format($q$select public.assessment_start(%L, 'start-ben-again')$q$, tB), 'used all 1 attempts');

  -- ── Extra time ─────────────────────────────────────────────────
  perform pg_temp.denied('a TA granting extra time', ta, format($q$select public.assessment_grant_time(%L, %L, 50, 'Approved by the access office', 'time-ta-key')$q$, tB, ana));
  perform pg_temp.refused_for('extra time for a student not on the roster', prof, format($q$select public.assessment_grant_time(%L, %L, 50, 'Approved', 'time-dan-key')$q$, tB, dan), 'not on this course');
  perform pg_temp.refused('extra time with no reason', prof, format($q$select public.assessment_grant_time(%L, %L, 50, '  ', 'time-noreason-key')$q$, tB, ana));
  perform pg_temp.refused('more than 200 percent', prof, format($q$select public.assessment_grant_time(%L, %L, 250, 'Approved', 'time-big-key')$q$, tB, ana));
  perform pg_temp.works('the instructor grants ana 50 percent more', prof, format($q$select public.assessment_grant_time(%L, %L, 50, 'Approved by the access office', 'time-ana-key')$q$, tB, ana));
  perform pg_temp.counted('ana reads her extra time', pg_temp.seen(ana, 'select 1 from public.assessment_time_extensions'), 1);
  perform pg_temp.counted('ben does not', pg_temp.seen(ben, 'select 1 from public.assessment_time_extensions'), 0);
  -- ana's pool attempt (10 minutes) began before the grant; a new test shows the stretch.
  perform pg_temp.works('a second test opens for the stretch', prof, format($q$select public.assessment_publish(%L, 'pub-c-key')$q$, tC));
  perform pg_temp.works('the instructor extends ana on it too', prof, format($q$select public.assessment_grant_time(%L, %L, 50, 'Approved by the access office', 'time-ana-c')$q$, tC, ana));
  st := pg_temp.ask(ana, format($q$select public.assessment_start(%L, 'start-ana-c')$q$, tC))::jsonb;
  perform pg_temp.counted('ten minutes becomes fifteen', (select count(*) from public.assessment_attempts
    where id = (st->>'attempt_id')::uuid and deadline_at - started_at = interval '15 minutes'), 1);
  st := pg_temp.ask(ben, format($q$select public.assessment_start(%L, 'start-ben-c')$q$, tC))::jsonb;
  perform pg_temp.counted('while ben keeps ten', (select count(*) from public.assessment_attempts
    where id = (st->>'attempt_id')::uuid and deadline_at - started_at = interval '10 minutes'), 1);

  -- ── Reading attempts ───────────────────────────────────────────
  perform pg_temp.counted('ana reads her own attempts only', pg_temp.seen(ana, 'select 1 from public.assessment_attempts'), 3);
  perform pg_temp.counted('the TA reads every attempt', pg_temp.seen(ta, 'select 1 from public.assessment_attempts'), 5);
  perform pg_temp.counted('faculty of another course read none', pg_temp.seen(other_prof, 'select 1 from public.assessment_attempts'), 0);

  -- ── Retiring, and nobody writes through the API ────────────────
  perform pg_temp.denied('a TA retiring an item', ta, format($q$select public.assessment_bank_retire_item(%L, 'retire-ta-key')$q$, i_short));
  perform pg_temp.works('the instructor retires one', prof, format($q$select public.assessment_bank_retire_item(%L, 'retire-short-key')$q$, i_short));
  perform pg_temp.counted('it is stamped, not deleted', (select count(*) from public.bank_items where id = i_short and retired_at is not null), 1);
  begin
    update public.bank_items set stem = 'edited' where id = i_mc;
    raise exception 'FAILED: the owner edited a bank item';
  exception when others then
    if sqlerrm not like '%retired, never edited%' then raise; end if;
    raise notice 'ok  even the owner cannot edit a bank item (%)', sqlerrm;
  end;
  perform pg_temp.refused('the instructor inserting an item directly', prof,
    format($q$insert into public.bank_items (tenant_id, bank_id, kind, stem, answer_key, operation) values ('as-u', %L, 'essay', 'x', '{}', 'k')$q$, bank));
  perform pg_temp.refused('a student updating an attempt', ana, $q$update public.assessment_attempts set score = 100$q$);
  perform pg_temp.refused('a student deleting an answer', ana, $q$delete from public.attempt_answers$q$);
  perform pg_temp.refused('the instructor changing extra time', prof, $q$update public.assessment_time_extensions set extra_percent = 200$q$);

  -- ── Frozen and killed ──────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'as-u' and module = 'lms_assessments';
  perform pg_temp.refused_for('a bank once the module is frozen', prof, $q$select public.assessment_bank_create('ECON 1020', '2026FA', 'Frozen', 'bank-frozen-key')$q$, 'does not run tests in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'as-u' and module = 'lms_assessments';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('as-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('a bank under the kill switch', prof, $q$select public.assessment_bank_create('ECON 1020', '2026FA', 'Killed', 'bank-killed-key')$q$, 'does not run tests in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'as-u';

  -- ── Deleting an account ────────────────────────────────────────
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting ana took her attempts', (select count(*) from public.assessment_attempts where student_id = ana), 0);
  perform pg_temp.counted('and her answers', (select count(*) from public.attempt_answers where student_id = ana), 0);
  perform pg_temp.counted('and her extra time', (select count(*) from public.assessment_time_extensions where student_id = ana), 0);
  perform pg_temp.counted('the bank stays', (select count(*) from public.question_banks where id = bank), 1);
  delete from auth.users where id = prof;
  perform pg_temp.counted('deleting the instructor clears their name, not the bank', (select count(*) from public.question_banks where id = bank and created_by is null), 1);

  raise notice 'assessments: all checks passed';
end $$;

rollback;
