-- supabase/career-evidence.check.sql — a student picks exact versions of their
-- work as portfolio evidence, and an employer reads them only through a grant
-- the student made to them, scoped to those items, while it is live.
--
-- For 20261023120000_career_evidence.sql, on top of #1661's workspace objects.
-- Two schools, ce-u and ce-v. People: a student and a second student at the
-- other school; an employer at acme, a colleague at acme, an employer at
-- globex, a stranger with no role, and a minor. What it proves:
--
--   * only the student adds evidence, withdraws it, grants and revokes; each
--     names the portfolio revision it read (40001 when stale), is idempotent
--     (same key replays, same key with other input is 23505), and is audited;
--   * evidence names a pinned version: after the student saves again the
--     employer still reads the version chosen, never the live object, and
--     #1661's own read and tables give the employer nothing;
--   * the employer reads only items named in the grant, only with their own
--     grant, only while it is unrevoked, unexpired, their role is live and the
--     student is age-cleared; every refusal is word for word the answer for
--     an id that never existed;
--   * a colleague at the same employer, an employer at another, and a
--     stranger read nothing; one student's grant never reaches another's
--     evidence, across schools;
--   * an employer holding a grant reads no grade: the grade table shows them
--     nothing, the gradebook export refuses them, and no career function so
--     much as names a grade table (a structural check, with a control);
--   * a grant cannot be widened, changed or un-revoked, even by the table
--     owner; evidence is only ever withdrawn;
--   * every employer listing and read is audited, and no audit row carries
--     the content.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh career-evidence

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

create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  if who is not null then perform pg_temp.become(who); end if;
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlstate || ' ' || sqlerrm;
end $$;

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text, because text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || because || '%' then
    raise exception 'FAILED: % — refused, but not because %: %', what, because, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.ask(who uuid, q text)
returns jsonb language plpgsql as $$
declare v jsonb;
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

do $$
declare
  student uuid; second uuid; employer uuid; colleague uuid; globex uuid; stranger uuid; minor uuid;
  obj uuid; v1 uuid; v2 uuid; journal uuid; journal_v uuid; second_obj uuid; second_v uuid; minor_v uuid;
  ev2 uuid; ev1 uuid; second_ev uuid; minor_ev uuid;
  g uuid; g_second uuid; g_old uuid; g_wide uuid;
  r jsonb; r2 jsonb; item uuid;
  nowhere text;
  make constant text := $q$select public.workspace_object_create('document', %L, %L, 'text/plain', 'semester.text/1', %L)$q$;
  save constant text := $q$select public.workspace_object_save(%L::uuid, %s, %L, %L, 'text/plain', 'semester.text/1', %L)$q$;
  add constant text := $q$select public.career_evidence_add(%L::uuid, %L, %s, %L)$q$;
  withdraw constant text := $q$select public.career_evidence_withdraw(%L::uuid, %s, %L)$q$;
  share constant text := $q$select public.career_evidence_grant(%L, %L, %L::uuid[], %L, %L, %L::timestamptz, %s, %L)$q$;
  revoke_ constant text := $q$select public.career_evidence_revoke(%L::uuid, %s, %L)$q$;
  rd constant text := $q$select public.career_evidence_read(%L::uuid, %L::uuid)$q$;
  listing constant text := 'select public.career_evidence_shared_with_me()';
  mine constant text := 'select public.career_evidence_mine()';
  soon constant timestamptz := now() + interval '30 days';
begin
  insert into public.schools (id, name, email_domains) values
    ('ce-u', 'Evidence University', array['ce-u.example']),
    ('ce-v', 'Other University', array['ce-v.example']);

  student   := pg_temp.newuser('student@ce-u.example', 'ce-u');
  second    := pg_temp.newuser('second@ce-v.example', 'ce-v');
  employer  := pg_temp.newuser('hiring@acme.example', 'ce-u');
  colleague := pg_temp.newuser('colleague@acme.example', 'ce-u');
  globex    := pg_temp.newuser('hiring@globex.example', 'ce-u');
  stranger  := pg_temp.newuser('stranger@ce-u.example', 'ce-u');
  minor     := pg_temp.newuser('minor@ce-u.example', 'ce-u');
  insert into public.student_context (user_id, is_minor) values (minor, true);

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (employer,  'employer', 'employer', 'acme',   'platform'),
    (colleague, 'employer', 'employer', 'acme',   'platform'),
    (globex,    'employer', 'employer', 'globex', 'platform');

  -- A released grade the student can see, so "the employer sees none" has a control.
  insert into public.gradebook_items (id, tenant_id, course_code, term, category_key, title, points_possible, operation)
  values ('00000000-0000-0000-0000-00000000ce01', 'ce-u', 'ECON 1020', '2026FA', 'essays', 'Capstone', 100, 'ce-fixture');
  insert into public.grade_entries (tenant_id, course_code, term, item_id, student_id, version, score, status, action, operation)
  values ('ce-u', 'ECON 1020', '2026FA', '00000000-0000-0000-0000-00000000ce01', student, 1, 61, 'released', 'released', 'ce-fixture');

  -- The student's work: a report with two versions, and a journal never chosen.
  r := pg_temp.ask(student, format(make, 'Capstone report', 'Draft one.', 'ce-make-0001'));
  obj := (r->>'object')::uuid; v1 := (r->>'version')::uuid;
  r := pg_temp.ask(student, format(save, obj, 1, 'Capstone report', 'Final report.', 'ce-save-0001'));
  v2 := (r->>'version')::uuid;
  r := pg_temp.ask(student, format(make, 'Private journal', 'Not for anyone.', 'ce-make-0002'));
  journal := (r->>'object')::uuid; journal_v := (r->>'version')::uuid;
  r := pg_temp.ask(second, format(make, 'Other capstone', 'Second student''s work.', 'ce-make-0003'));
  second_obj := (r->>'object')::uuid; second_v := (r->>'version')::uuid;
  r := pg_temp.ask(minor, format(make, 'Minor''s essay', 'Fifteen years old.', 'ce-make-0004'));
  minor_v := (r->>'version')::uuid;

  -- ── Choosing evidence ─────────────────────────────────────────────────

  perform pg_temp.said('a new portfolio is at revision 0', pg_temp.ask(student, mine)->>'revision', '0');
  perform pg_temp.refused('a stranger adding the student''s version', stranger,
    format(add, v2, 'Their report', 0, 'ce-add-strange'), '42501 semester: no such version here');
  perform pg_temp.refused('an employer adding it', employer,
    format(add, v2, 'Their report', 0, 'ce-add-employer'), '42501 semester: no such version here');

  r := pg_temp.ask(student, format(add, v2, 'Capstone, final', 0, 'ce-add-0001'));
  ev2 := (r->>'evidence')::uuid;
  perform pg_temp.said('the student adds version 2, moving to revision 1', r->>'revision', '1');
  perform pg_temp.said('the evidence names version 2', (select version_id::text from public.career_evidence where id = ev2), v2::text);
  r2 := pg_temp.ask(student, format(add, v2, 'Capstone, final', 0, 'ce-add-0001'));
  perform pg_temp.said('the same key and input replays the receipt', r2::text, r::text);
  perform pg_temp.counted('and adds nothing', (select count(*) from public.career_evidence where workspace_id = (select workspace_id from public.workspace_objects where id = obj)), 1);
  perform pg_temp.refused('the same key with another label', student,
    format(add, v2, 'Something else', 0, 'ce-add-0001'), '23505 semester: that idempotency key was already used');
  perform pg_temp.refused('adding on revision 0 after it moved to 1', student,
    format(add, v1, 'Capstone, draft', 0, 'ce-add-stale'), '40001 semester: your portfolio changed since you read it');
  perform pg_temp.counted('and the stale add wrote nothing', (select count(*) from public.career_evidence where version_id = v1), 0);
  perform pg_temp.counted('nor spent its key', (select count(*) from public.workspace_object_operations where idempotency_key = 'ce-add-stale'), 0);
  perform pg_temp.refused('the same version twice', student,
    format(add, v2, 'Again', 1, 'ce-add-twice'), 'already in your portfolio');

  r := pg_temp.ask(student, format(add, v1, 'Capstone, draft', 1, 'ce-add-0002'));
  ev1 := (r->>'evidence')::uuid;
  perform pg_temp.said('a second item, at revision 2', r->>'revision', '2');
  perform pg_temp.counted('the student lists two items', jsonb_array_length(pg_temp.ask(student, mine)->'evidence'), 2);

  r := pg_temp.ask(second, format(add, second_v, 'Other capstone', 0, 'ce-add-0003'));
  second_ev := (r->>'evidence')::uuid;
  r := pg_temp.ask(minor, format(add, minor_v, 'Minor''s essay', 0, 'ce-add-0004'));
  minor_ev := (r->>'evidence')::uuid;

  -- ── Granting ──────────────────────────────────────────────────────────

  perform pg_temp.refused('a stranger granting the student''s evidence', stranger,
    format(share, 'hiring@acme.example', 'acme', array[ev2], 'Student', 'Interview', soon, 2, 'ce-grant-strange'),
    '42501 semester: no such evidence here');
  perform pg_temp.refused('the employer granting it to themselves', employer,
    format(share, 'colleague@acme.example', 'acme', array[ev2], 'Student', 'Interview', soon, 2, 'ce-grant-employer'),
    '42501 semester: no such evidence here');
  perform pg_temp.refused('the student naming another student''s evidence', student,
    format(share, 'hiring@acme.example', 'acme', array[ev2, second_ev], 'Sam', 'Interview', soon, 2, 'ce-grant-mixed'),
    '42501 semester: no such evidence here');
  perform pg_temp.refused('a minor granting to an employer', minor,
    format(share, 'hiring@acme.example', 'acme', array[minor_ev], 'Kid', 'Interview', soon, 1, 'ce-grant-minor'),
    'sharing with employers opens once');
  perform pg_temp.refused('an address that is no employer', student,
    format(share, 'stranger@ce-u.example', 'acme', array[ev2], 'Sam', 'Interview', soon, 2, 'ce-grant-nobody'),
    'P0002 semester: nobody at that employer uses that address');
  perform pg_temp.refused('an employer named for an employer they do not act for', student,
    format(share, 'hiring@acme.example', 'globex', array[ev2], 'Sam', 'Interview', soon, 2, 'ce-grant-wrongco'),
    'P0002 semester: nobody at that employer uses that address');
  perform pg_temp.refused('a share with no end', student,
    format(share, 'hiring@acme.example', 'acme', array[ev2], 'Sam', 'Interview', null, 2, 'ce-grant-forever'),
    'ends within 180 days');
  perform pg_temp.refused('a share past 180 days', student,
    format(share, 'hiring@acme.example', 'acme', array[ev2], 'Sam', 'Interview', now() + interval '181 days', 2, 'ce-grant-long'),
    'ends within 180 days');
  perform pg_temp.refused('granting on a stale revision', student,
    format(share, 'hiring@acme.example', 'acme', array[ev2], 'Sam', 'Interview', soon, 1, 'ce-grant-stale'),
    '40001 semester: your portfolio changed');
  perform pg_temp.counted('none of those made a grant', (select count(*) from public.career_evidence_grants), 0);

  r := pg_temp.ask(student, format(share, 'Hiring@Acme.example ', 'acme', array[ev2], 'Sam Student', 'Graduate analyst interview', soon, 2, 'ce-grant-0001'));
  g := (r->>'grant')::uuid;
  perform pg_temp.said('the student grants version 2 to the acme employer, at revision 3', r->>'revision', '3');
  perform pg_temp.said('naming that account', (select grantee::text from public.career_evidence_grants where id = g), employer::text);
  perform pg_temp.counted('and that one item only', (select count(*) from public.career_evidence_grant_items where grant_id = g), 1);
  r2 := pg_temp.ask(student, format(share, 'Hiring@Acme.example ', 'acme', array[ev2], 'Sam Student', 'Graduate analyst interview', soon, 2, 'ce-grant-0001'));
  perform pg_temp.said('the same key and input replays the grant', r2::text, r::text);
  perform pg_temp.counted('and makes no second one', (select count(*) from public.career_evidence_grants), 1);
  perform pg_temp.refused('the same key for another purpose', student,
    format(share, 'Hiring@Acme.example ', 'acme', array[ev2], 'Sam Student', 'Something else', soon, 2, 'ce-grant-0001'),
    '23505');
  perform pg_temp.said('the receiving account is no longer untouched', public.lti_account_untouched(employer)::text, 'false');
  perform pg_temp.said('a colleague who received nothing still is', public.lti_account_untouched(colleague)::text, 'true');

  r := pg_temp.ask(second, format(share, 'hiring@acme.example', 'acme', array[second_ev], 'Alex', 'Interview', soon, 1, 'ce-grant-0002'));
  g_second := (r->>'grant')::uuid;

  -- ── What the employer sees ────────────────────────────────────────────

  r := pg_temp.ask(employer, listing);
  perform pg_temp.counted('the employer lists both students'' grants', jsonb_array_length(r), 2);
  perform pg_temp.counted('the student''s grant shows one item, not the draft',
    (select jsonb_array_length(j->'evidence') from jsonb_array_elements(r) j where j->>'grant' = g::text), 1);
  perform pg_temp.said('labelled as the student chose',
    (select j->'evidence'->0->>'label' from jsonb_array_elements(r) j where j->>'grant' = g::text), 'Capstone, final');

  r := pg_temp.ask(employer, format(rd, g, ev2));
  perform pg_temp.said('the employer reads version 2', r->>'body', 'Final report.');
  perform pg_temp.said('and is told nothing of the object', (r ? 'object')::text, 'false');

  perform pg_temp.works('the student saves version 3', student, format(save, obj, 2, 'Capstone report', 'Private notes, after the fact.', 'ce-save-0002'));
  r := pg_temp.ask(employer, format(rd, g, ev2));
  perform pg_temp.said('after a new save the employer still reads version 2, never the live object', r->>'body' || '|' || (r->>'version_number'), 'Final report.|2');
  perform pg_temp.refused('the employer opening the live object through #1661', employer,
    format('select public.workspace_object_read(%L::uuid, null)', obj), '42501 semester: no such object here');
  perform pg_temp.refused('or the granted version through #1661', employer,
    format('select public.workspace_object_read(%L::uuid, %L::uuid)', obj, v2), '42501 semester: no such object here');
  perform pg_temp.refused('or the journal', employer,
    format('select public.workspace_object_read(%L::uuid, null)', journal), '42501 semester: no such object here');
  perform pg_temp.counted('the employer sees no workspace object', pg_temp.seen(employer, 'select * from public.workspace_objects'), 0);
  perform pg_temp.counted('no version', pg_temp.seen(employer, 'select * from public.workspace_object_versions'), 0);
  perform pg_temp.counted('no workspace grant', pg_temp.seen(employer, 'select * from public.workspace_object_grants'), 0);
  perform pg_temp.counted('no evidence row', pg_temp.seen(employer, 'select * from public.career_evidence'), 0);
  perform pg_temp.counted('no grant row', pg_temp.seen(employer, 'select * from public.career_evidence_grants'), 0);
  perform pg_temp.counted('no grant item', pg_temp.seen(employer, 'select * from public.career_evidence_grant_items'), 0);
  perform pg_temp.counted('no portfolio', pg_temp.seen(employer, 'select * from public.career_portfolios'), 0);
  perform pg_temp.counted('while the student sees their two grants'' rows', pg_temp.seen(student, 'select * from public.career_evidence_grants'), 1);
  perform pg_temp.said('and the employer''s own portfolio is empty', pg_temp.ask(employer, mine)->>'evidence', '[]');

  -- The answer for an id that was never anything: every refusal below must match it.
  nowhere := pg_temp.err(employer, format(rd, gen_random_uuid(), gen_random_uuid()));
  perform pg_temp.said('an id that never existed', nowhere, '42501 semester: no such evidence here');
  perform pg_temp.said('an item the grant does not name reads the same', pg_temp.err(employer, format(rd, g, ev1)), nowhere);
  perform pg_temp.said('the journal''s version id as an item reads the same', pg_temp.err(employer, format(rd, g, journal_v)), nowhere);
  perform pg_temp.said('a colleague at acme with the same grant reads the same', pg_temp.err(colleague, format(rd, g, ev2)), nowhere);
  perform pg_temp.said('an employer at globex reads the same', pg_temp.err(globex, format(rd, g, ev2)), nowhere);
  perform pg_temp.said('a stranger reads the same', pg_temp.err(stranger, format(rd, g, ev2)), nowhere);
  perform pg_temp.counted('the colleague lists nothing', jsonb_array_length(pg_temp.ask(colleague, listing)), 0);

  -- Across students and schools.
  perform pg_temp.said('the second student''s grant reads their evidence', pg_temp.ask(employer, format(rd, g_second, second_ev))->>'body', 'Second student''s work.');
  perform pg_temp.said('but never the first student''s', pg_temp.err(employer, format(rd, g_second, ev2)), nowhere);
  perform pg_temp.said('and the first student''s grant never reaches the second''s', pg_temp.err(employer, format(rd, g, second_ev)), nowhere);
  perform pg_temp.refused('nor can the second student revoke the first''s grant', second,
    format(revoke_, g, 1, 'ce-revoke-other'), '42501 semester: no such grant here');

  -- ── Grades ────────────────────────────────────────────────────────────

  perform pg_temp.counted('the student sees their released grade', pg_temp.seen(student, 'select * from public.grade_entries'), 1);
  perform pg_temp.counted('the employer holding a grant sees no grade row', pg_temp.seen(employer, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('nor any gradebook item', pg_temp.seen(employer, 'select * from public.gradebook_items'), 0);
  perform pg_temp.refused('nor exports the gradebook', employer,
    $q$select public.gradebook_export('ECON 1020', '2026FA')$q$, '42501');
  perform pg_temp.counted('the control: the gradebook export does name the grade table',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'gradebook_export' and p.prosrc ~* 'grade_entries'), 1);
  perform pg_temp.counted('no career function names any grade table',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.proname like 'career%'
        and p.prosrc ~* '(grade_entries|gradebook_|regrade_|grade_passbacks)'), 0);
  perform pg_temp.counted('no policy on a grade table mentions career evidence',
    (select count(*) from pg_policies
      where tablename in ('grade_entries', 'gradebook_items', 'gradebook_schemes', 'regrade_requests', 'regrade_resolutions', 'grade_passbacks')
        and coalesce(qual, '') || coalesce(with_check, '') ~* 'career'), 0);

  -- ── The grant ends without a revoke ───────────────────────────────────

  update public.role_grants set revoked_at = now() where subject = employer and scope_id = 'acme';
  perform pg_temp.said('once the employer loses the role the read reads as nothing', pg_temp.err(employer, format(rd, g, ev2)), nowhere);
  perform pg_temp.counted('and lists neither student''s grant: both name acme', jsonb_array_length(pg_temp.ask(employer, listing)), 0);
  perform pg_temp.said('the student sees that employer as no longer active',
    pg_temp.ask(student, mine)->'grants'->0->>'employer_active', 'false');
  update public.role_grants set revoked_at = null where subject = employer and scope_id = 'acme';
  perform pg_temp.said('the control: given the role back, it reads again', pg_temp.ask(employer, format(rd, g, ev2))->>'body', 'Final report.');

  insert into public.student_context (user_id, is_minor) values (student, true)
  on conflict (user_id) do update set is_minor = true;
  perform pg_temp.said('a student marked a minor is read as nothing', pg_temp.err(employer, format(rd, g, ev2)), nowhere);
  update public.student_context set is_minor = false where user_id = student;
  perform pg_temp.said('the control: cleared again, it reads', pg_temp.ask(employer, format(rd, g, ev2))->>'body', 'Final report.');

  -- Expiry: a grant made through the function, then backdated past its end.
  r := pg_temp.ask(student, format(share, 'hiring@acme.example', 'acme', array[ev1], 'Sam Student', 'Earlier round', soon, 3, 'ce-grant-0003'));
  g_old := (r->>'grant')::uuid;
  perform pg_temp.said('a second grant reads the draft while live', pg_temp.ask(employer, format(rd, g_old, ev1))->>'body', 'Draft one.');
  alter table public.career_evidence_grants disable trigger career_evidence_grant_fixed;
  update public.career_evidence_grants set created_at = now() - interval '31 days', expires_at = now() - interval '1 second' where id = g_old;
  alter table public.career_evidence_grants enable trigger career_evidence_grant_fixed;
  perform pg_temp.said('an expired grant reads as nothing', pg_temp.err(employer, format(rd, g_old, ev1)), nowhere);
  perform pg_temp.counted('and is not listed to the employer', jsonb_array_length(pg_temp.ask(employer, listing)), 2);
  perform pg_temp.counted('nor to the student as having access', jsonb_array_length(pg_temp.ask(student, mine)->'grants'), 1);

  -- ── Nothing changes a grant but revocation ────────────────────────────

  perform pg_temp.refused('widening an older grant, as the table owner', null,
    format('insert into public.career_evidence_grant_items (workspace_id, grant_id, evidence_id) select workspace_id, %L, %L from public.career_evidence where id = %L', g_old, ev2, ev2),
    'never widened');
  perform pg_temp.refused('swapping a grant''s item, as the table owner', null,
    format('update public.career_evidence_grant_items set evidence_id = %L where grant_id = %L', ev1, g), 'never changes');
  perform pg_temp.refused('removing a grant''s item, as the table owner', null,
    format('delete from public.career_evidence_grant_items where grant_id = %L', g), 'never changes');
  perform pg_temp.refused('extending a grant, as the table owner', null,
    format('update public.career_evidence_grants set expires_at = expires_at + interval ''1 day'' where id = %L', g), 'only ever revoked');
  perform pg_temp.refused('re-pointing a grant at another employer, as the table owner', null,
    format('update public.career_evidence_grants set grantee = %L where id = %L', colleague, g), 'only ever revoked');
  perform pg_temp.refused('relabelling evidence, as the table owner', null,
    format('update public.career_evidence set label = ''Better'' where id = %L', ev2), 'only ever withdrawn');
  perform pg_temp.refused('deleting evidence, as the table owner', null,
    format('delete from public.career_evidence where id = %L', ev2), 'withdrawn, never deleted');
  perform pg_temp.refused('pointing evidence at another student''s version, as the table owner', null,
    format('insert into public.career_evidence (workspace_id, object_id, version_id, label) select workspace_id, %L, %L, ''x'' from public.career_evidence where id = %L', second_obj, second_v, ev2),
    'foreign key');
  perform pg_temp.refused('writing a grant through the API', student,
    format('insert into public.career_evidence_grants (workspace_id, grantee, employer_scope, shared_as, purpose, expires_at) select workspace_id, %L, ''acme'', ''x'', ''x'', now() + interval ''1 day'' from public.career_evidence where id = %L', colleague, ev2),
    '42501');
  perform pg_temp.refused('revoking by writing the table', student,
    format('update public.career_evidence_grants set revoked_at = now() where id = %L', g), '42501');

  -- ── Withdrawal and revocation ─────────────────────────────────────────

  r := pg_temp.ask(student, format(add, journal_v, 'Journal (by mistake)', 4, 'ce-add-0005'));
  item := (r->>'evidence')::uuid;
  r := pg_temp.ask(student, format(share, 'hiring@globex.example', 'globex', array[item], 'Sam Student', 'Mistake', soon, 5, 'ce-grant-0004'));
  g_wide := (r->>'grant')::uuid;
  perform pg_temp.said('globex reads the item while it is in the portfolio', pg_temp.ask(globex, format(rd, g_wide, item))->>'body', 'Not for anyone.');
  r := pg_temp.ask(student, format(withdraw, item, 6, 'ce-withdraw-0001'));
  perform pg_temp.said('withdrawing moves to revision 7', r->>'revision', '7');
  perform pg_temp.said('a withdrawn item reads as nothing, though its grant stands', pg_temp.err(globex, format(rd, g_wide, item)), nowhere);
  perform pg_temp.said('withdrawing again answers the first withdrawal',
    pg_temp.ask(student, format(withdraw, item, 7, 'ce-withdraw-0002'))->>'withdrawn_at', r->>'withdrawn_at');
  perform pg_temp.refused('un-withdrawing, as the table owner', null,
    format('update public.career_evidence set withdrawn_at = null where id = %L', item), 'only ever withdrawn');

  perform pg_temp.refused('revoking on a stale revision', student, format(revoke_, g, 6, 'ce-revoke-stale'), '40001');
  perform pg_temp.said('and the grant still reads', pg_temp.ask(employer, format(rd, g, ev2))->>'body', 'Final report.');
  r := pg_temp.ask(student, format(revoke_, g, 7, 'ce-revoke-0001'));
  perform pg_temp.said('the student revokes, moving to revision 8', r->>'revision', '8');
  perform pg_temp.said('a revoked grant reads as nothing, at once', pg_temp.err(employer, format(rd, g, ev2)), nowhere);
  perform pg_temp.counted('and is not listed', (select count(*) from jsonb_array_elements(pg_temp.ask(employer, listing)) j where j->>'grant' = g::text), 0);
  perform pg_temp.counted('nor shown to the student as having access',
    (select count(*) from jsonb_array_elements(pg_temp.ask(student, mine)->'grants') j where j->>'grant' = g::text), 0);
  perform pg_temp.said('the same revoke key replays', pg_temp.ask(student, format(revoke_, g, 7, 'ce-revoke-0001'))::text, r::text);
  r2 := pg_temp.ask(student, format(revoke_, g, 8, 'ce-revoke-0002'));
  perform pg_temp.said('revoking again answers the first revocation', r2->>'revoked_at', r->>'revoked_at');
  perform pg_temp.said('and moves nothing', r2->>'revision', '8');
  perform pg_temp.refused('un-revoking, as the table owner', null,
    format('update public.career_evidence_grants set revoked_at = null where id = %L', g), 'only ever revoked');
  perform pg_temp.said('the second student''s grant is untouched by it', pg_temp.ask(employer, format(rd, g_second, second_ev))->>'body', 'Second student''s work.');

  -- ── Audit ─────────────────────────────────────────────────────────────

  -- Adds: student 3, second 1, minor 1. Grants: g, g_second, g_old, g_wide.
  perform pg_temp.counted('adds audited', (select count(*) from public.audit_event where action = 'career_evidence.added' and occurred_at = now()), 5);
  perform pg_temp.counted('grants audited', (select count(*) from public.audit_event where action = 'career_evidence.granted' and occurred_at = now()), 4);
  perform pg_temp.counted('one withdrawal audited, not two', (select count(*) from public.audit_event where action = 'career_evidence.withdrawn' and occurred_at = now()), 1);
  perform pg_temp.counted('one revocation audited, not two', (select count(*) from public.audit_event where action = 'career_evidence.revoked' and occurred_at = now()), 1);
  perform pg_temp.counted('every employer read that answered is audited',
    (select count(*) from public.audit_event where action = 'career_evidence.read' and occurred_at = now()), 9);
  perform pg_temp.counted('every grant an employer was shown is audited',
    (select count(*) from public.audit_event where action = 'career_evidence.listed' and occurred_at = now()), 5);
  perform pg_temp.counted('no audit row names an id in the clear or carries content',
    (select count(*) from public.audit_event where action like 'career_evidence.%'
        and (object_sha256 in (ev2::text, g::text) or detail::text ~ '(Final report|Capstone|Sam Student|acme)')), 0);
  perform pg_temp.counted('and the ledger holds no label, purpose or address',
    (select count(*) from public.workspace_object_operations where request::text ~ '(Capstone|Interview|hiring@|Sam Student)'), 0);

  -- ── Account deletion's cascade takes it all ───────────────────────────

  delete from public.workspaces where owner_id = student;
  perform pg_temp.counted('deleting the student takes their portfolio', (select count(*) from public.career_portfolios p where not exists (select 1 from public.workspaces w where w.id = p.workspace_id)), 0);
  perform pg_temp.counted('their evidence, past its trigger', (select count(*) from public.career_evidence where id in (ev1, ev2, item)), 0);
  perform pg_temp.counted('their grants and items', (select count(*) from public.career_evidence_grants where id in (g, g_old, g_wide))
                                                   + (select count(*) from public.career_evidence_grant_items where grant_id in (g, g_old, g_wide)), 0);
  perform pg_temp.counted('and leaves the second student''s grant', (select count(*) from public.career_evidence_grant_items where grant_id = g_second), 1);
end $$;

rollback;
