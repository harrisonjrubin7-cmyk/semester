-- The campus office action feed (Phase J, D-048): who may publish as which
-- office, the draft → review → published workflow, who a published action
-- reaches, and that an office learns a completion count only at ten or more
-- and nothing else. Every refusal is attempted as the account that should be
-- refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh officeactions

begin;

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
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
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

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  -- A statement that ran but touched no row was refused by RLS.
  return n = 0;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was allowed', what;
  end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was refused', what;
  end if;
  raise notice 'ok  % is allowed', what;
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

-- A value the statement returns, run as someone.
create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

-- The error a statement raises as someone, or null when it runs.
create or replace function pg_temp.error_as(who uuid, q text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

-- The error a statement raises as the database owner, or null.
create or replace function pg_temp.error_raw(q text)
returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function pg_temp.says(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is null or position(want in got) = 0 then
    raise exception 'FAILED: % — expected "%", got "%"', what, want, got;
  end if;
  raise notice 'ok  % ("%")', what, want;
end $$;

-- A draft in the given office, as someone. Returns its id.
create or replace function pg_temp.draft(who uuid, office text, scope text, kind text, audience text, target text,
                                         title text default 'FAFSA verification documents are due October 15')
returns uuid language plpgsql as $$
begin
  return pg_temp.value_as(who, format(
    'select public.draft_office_action(%L, ''school'', %L, %L, %L, %L, %L, %L, %L, %L, %L)',
    office, scope, kind, audience, target, title, 'This may affect aid processing.',
    '2026-10-15T23:59:00Z', 'https://aid.oa-u.example/verification', 'Financial Aid verification checklist'))::uuid;
end $$;

create or replace function pg_temp.move(who uuid, id uuid, step text, note text default null)
returns text language plpgsql as $$
begin
  return pg_temp.value_as(who, format('select public.move_office_action(%L, %L, %L)', id, step, note));
end $$;

do $$
declare
  aid1 uuid; aid2 uuid; registrar uuid; ra uuid; far_aid uuid;
  student uuid; elig uuid; prog uuid; plain uuid; far uuid;
  crowd uuid[] := '{}';
  a_tenant uuid; a_elig uuid; a_prog uuid; a_cohort uuid; a_draft uuid; a_res uuid; legacy uuid;
  who uuid; i int;
begin
  insert into public.schools (id, name, email_domains) values
    ('oa-u', 'Office Action University', array['oa-u.example']),
    ('oa-other', 'Other University', array['oa-other.example']);

  aid1      := pg_temp.newuser('aid1@oa-u.example', 'oa-u');
  aid2      := pg_temp.newuser('aid2@oa-u.example', 'oa-u');
  registrar := pg_temp.newuser('registrar@oa-u.example', 'oa-u');
  ra        := pg_temp.newuser('ra@oa-u.example', 'oa-u');
  far_aid   := pg_temp.newuser('aid@oa-other.example', 'oa-other');
  student   := pg_temp.newuser('student@oa-u.example', 'oa-u');
  elig      := pg_temp.newuser('elig@oa-u.example', 'oa-u');
  prog      := pg_temp.newuser('prog@oa-u.example', 'oa-u');
  plain     := pg_temp.newuser('plain@oa-u.example', 'oa-u');
  far       := pg_temp.newuser('far@oa-other.example', 'oa-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (aid1,      'financial_aid_officer', 'school', 'oa-u',            'institution'),
    (aid2,      'financial_aid_officer', 'school', 'oa-u',            'institution'),
    (registrar, 'registrar',             'school', 'oa-u',            'institution'),
    (ra,        'resident_assistant',    'school', 'oa-u',            'institution'),
    (far_aid,   'financial_aid_officer', 'school', 'oa-other',        'institution'),
    (student,   'student',               'cohort', 'oa-u/first-year', 'institution');

  -- ── who may publish as which office ────────────────────────────────────
  perform pg_temp.counted('a financial aid officer may publish for Financial Aid',
    pg_temp.seen(aid1, $q$select * from public.my_action_publish_scopes() where office = 'financial_aid' and not resource_only$q$), 1);
  perform pg_temp.counted('a resident assistant may publish resources only',
    pg_temp.seen(ra, $q$select * from public.my_action_publish_scopes() where office = 'residence_life' and resource_only$q$), 1);
  perform pg_temp.counted('a student may publish for no office',
    pg_temp.seen(student, 'select * from public.my_action_publish_scopes()'), 0);

  a_tenant := pg_temp.draft(aid1, 'financial_aid', 'oa-u', 'aid', 'tenant', null);
  perform pg_temp.counted('the officer drafted one', (select count(*) from public.institution_actions where id = a_tenant and status = 'draft'), 1);
  perform pg_temp.says('the registrar cannot publish as Financial Aid',
    pg_temp.error_as(registrar, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      't', 'w', null, 'https://x.example', 's')$q$), 'cannot publish for that office');
  perform pg_temp.says('an officer cannot publish at another school',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-other', 'aid', 'tenant', null,
      't', 'w', null, 'https://x.example', 's')$q$), 'cannot publish for that office');
  perform pg_temp.says('a resident assistant cannot publish a deadline',
    pg_temp.error_as(ra, $q$select public.draft_office_action('residence_life', 'school', 'oa-u', 'deadline', 'tenant', null,
      't', 'w', null, 'https://x.example', 's')$q$), 'cannot publish for that office');
  perform pg_temp.expect_allowed('a resident assistant drafts a resource', ra,
    $q$select public.draft_office_action('residence_life', 'school', 'oa-u', 'resource', 'tenant', null,
      'Floor study room is open late', 'Quiet space before midterms.', null, 'https://housing.oa-u.example/rooms', 'Residence Life')$q$);

  -- ── what a draft must carry ────────────────────────────────────────────
  perform pg_temp.says('an http link is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      't', 'w', null, 'http://aid.oa-u.example', 's')$q$), 'official https link');
  perform pg_temp.says('no link is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      't', 'w', null, null, 's')$q$), 'official https link');
  perform pg_temp.says('no source is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      't', 'w', null, 'https://x.example', '  ')$q$), 'where this comes from');
  perform pg_temp.says('no reason is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      't', '', null, 'https://x.example', 's')$q$), 'why it matters');
  perform pg_temp.says('"at risk" is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      'Students at risk of losing aid', 'w', null, 'https://x.example', 's')$q$), 'Rephrase');
  perform pg_temp.says('"behind" is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'tenant', null,
      't', 'If you are behind on forms', null, 'https://x.example', 's')$q$), 'Rephrase');
  perform pg_temp.says('a named student is not an audience',
    pg_temp.error_as(aid1, format($q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'student', %L,
      't', 'w', null, 'https://x.example', 's')$q$, student)), 'Choose who this is for');
  perform pg_temp.says('an unknown eligibility is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'eligibility', 'disability',
      't', 'w', null, 'https://x.example', 's')$q$), 'institution_action_eligibility_known');
  perform pg_temp.says('a program at another school is refused',
    pg_temp.error_as(aid1, $q$select public.draft_office_action('financial_aid', 'school', 'oa-u', 'aid', 'program', 'oa-other/economics',
      't', 'w', null, 'https://x.example', 's')$q$), 'institution_action_program_in_tenant');

  -- Nobody writes the table directly.
  perform pg_temp.expect_refused('a direct insert by an officer', aid1,
    $q$insert into public.institution_actions (tenant_id, publisher_id, publisher_scope_kind, publisher_scope_id, office,
         action_type, audience_kind, title, why_it_matters, official_url, source_note, status)
       select 'oa-u', (select auth.uid()), 'school', 'oa-u', 'financial_aid', 'aid', 'tenant', 't', 'w',
              'https://x.example', 's', 'published'$q$);
  perform pg_temp.expect_refused('a direct update to publish a draft', aid1,
    format($q$update public.institution_actions set status = 'published' where id = %L$q$, a_tenant));
  perform pg_temp.expect_refused('a direct update to withdraw', aid1,
    format($q$update public.institution_actions set withdrawn_at = now() where id = %L$q$, a_tenant));
  perform pg_temp.says('even the owner cannot store an office row without a link',
    pg_temp.error_raw($q$insert into public.institution_actions (tenant_id, publisher_scope_kind, publisher_scope_id, office,
      action_type, audience_kind, title, why_it_matters, source_note) values
      ('oa-u', 'school', 'oa-u', 'financial_aid', 'aid', 'tenant', 't', 'w', 's')$q$), 'institution_action_complete');

  -- ── draft → review → published, by two people ──────────────────────────
  perform pg_temp.counted('a draft reaches no student',
    pg_temp.seen(student, 'select * from public.my_office_actions()'), 0);
  perform pg_temp.counted('nor through the table',
    pg_temp.seen(student, 'select * from public.institution_actions'), 0);
  perform pg_temp.says('a draft cannot be approved before it is submitted',
    pg_temp.error_as(aid2, format('select public.move_office_action(%L, ''approve'', null)', a_tenant)), 'Cannot approve an action that is draft');
  perform pg_temp.says('the author submits it', pg_temp.move(aid1, a_tenant, 'submit'), 'in_review');
  perform pg_temp.says('the author cannot approve their own',
    pg_temp.error_as(aid1, format('select public.move_office_action(%L, ''approve'', null)', a_tenant)), 'Someone else in your office');
  perform pg_temp.says('another office cannot approve it',
    pg_temp.error_as(registrar, format('select public.move_office_action(%L, ''approve'', null)', a_tenant)), 'No such action in your scope');
  perform pg_temp.says('the same office at another school cannot approve it',
    pg_temp.error_as(far_aid, format('select public.move_office_action(%L, ''approve'', null)', a_tenant)), 'No such action in your scope');
  perform pg_temp.says('a return needs a note',
    pg_temp.error_as(aid2, format('select public.move_office_action(%L, ''return'', '' '')', a_tenant)), 'Say what needs changing');
  perform pg_temp.says('a colleague returns it with a note', pg_temp.move(aid2, a_tenant, 'return', 'Add the form name'), 'draft');
  perform pg_temp.counted('the note is kept for the author',
    pg_temp.seen(aid1, format($q$select * from public.office_desk_actions() where id = %L and review_note = 'Add the form name'$q$, a_tenant)), 1);
  perform pg_temp.says('resubmitted', pg_temp.move(aid1, a_tenant, 'submit'), 'in_review');
  perform pg_temp.says('a colleague approves it', pg_temp.move(aid2, a_tenant, 'approve'), 'published');

  -- ── who a published action reaches ─────────────────────────────────────
  perform pg_temp.counted('a student at the school sees the school-wide action',
    pg_temp.seen(plain, 'select * from public.my_office_actions()'), 1);
  perform pg_temp.counted('with its office, link, source and dates',
    pg_temp.seen(plain, $q$select * from public.my_office_actions()
      where office_label = 'Financial Aid' and official_url like 'https://%' and source_note <> ''
        and updated_at is not null and published_at is not null$q$), 1);
  perform pg_temp.counted('a student at another school does not',
    pg_temp.seen(far, 'select * from public.my_office_actions()'), 0);
  perform pg_temp.counted('nor through the table',
    pg_temp.seen(far, 'select * from public.institution_actions'), 0);

  a_elig := pg_temp.draft(aid1, 'financial_aid', 'oa-u', 'aid', 'eligibility', 'aid_applicant', 'Aid applicants: verification');
  perform pg_temp.move(aid1, a_elig, 'submit'); perform pg_temp.move(aid2, a_elig, 'approve');
  a_prog := pg_temp.draft(aid1, 'financial_aid', 'oa-u', 'aid', 'program', 'oa-u/economics', 'Economics scholarship form');
  perform pg_temp.move(aid1, a_prog, 'submit'); perform pg_temp.move(aid2, a_prog, 'approve');
  a_cohort := pg_temp.draft(aid1, 'financial_aid', 'oa-u', 'aid', 'cohort', 'oa-u/first-year', 'First-year aid meeting');
  perform pg_temp.move(aid1, a_cohort, 'submit'); perform pg_temp.move(aid2, a_cohort, 'approve');

  perform pg_temp.counted('eligibility reaches nobody who has not chosen it',
    pg_temp.seen(elig, format('select * from public.my_office_actions() where id = %L', a_elig)), 0);
  perform pg_temp.expect_allowed('a student says they applied for aid', elig,
    $q$insert into public.institution_action_audiences (user_id, kind, value) select (select auth.uid()), 'eligibility', 'aid_applicant'$q$);
  perform pg_temp.counted('and now sees it',
    pg_temp.seen(elig, format('select * from public.my_office_actions() where id = %L', a_elig)), 1);
  perform pg_temp.counted('a student who did not choose it does not',
    pg_temp.seen(plain, format('select * from public.my_office_actions() where id = %L', a_elig)), 0);
  perform pg_temp.expect_refused('a student cannot choose an eligibility that is not on the list', elig,
    $q$insert into public.institution_action_audiences (user_id, kind, value) select (select auth.uid()), 'eligibility', 'disability'$q$);
  perform pg_temp.expect_refused('nor choose for someone else', elig,
    format($q$insert into public.institution_action_audiences (user_id, kind, value) values (%L, 'eligibility', 'international')$q$, plain));

  perform pg_temp.counted('a student can see which programs are published to',
    pg_temp.seen(prog, $q$select * from public.office_action_programs() where program = 'oa-u/economics'$q$), 1);
  perform pg_temp.counted('but not another school''s',
    pg_temp.seen(far, 'select * from public.office_action_programs()'), 0);
  perform pg_temp.expect_allowed('a student chooses their program', prog,
    $q$insert into public.institution_action_audiences (user_id, kind, value) select (select auth.uid()), 'program', 'oa-u/economics'$q$);
  perform pg_temp.counted('and sees the program action',
    pg_temp.seen(prog, format('select * from public.my_office_actions() where id = %L', a_prog)), 1);
  perform pg_temp.counted('a student in another program does not',
    pg_temp.seen(plain, format('select * from public.my_office_actions() where id = %L', a_prog)), 0);
  perform pg_temp.counted('a choice made at one school reaches nothing at another',
    pg_temp.seen(far, format('select * from public.my_office_actions() where id = %L', a_prog)), 0);

  perform pg_temp.counted('the cohort student sees the cohort action',
    pg_temp.seen(student, format('select * from public.my_office_actions() where id = %L', a_cohort)), 1);
  perform pg_temp.counted('a student outside the cohort does not',
    pg_temp.seen(plain, format('select * from public.my_office_actions() where id = %L', a_cohort)), 0);

  -- ── no office sees who chose what, or who did what ─────────────────────
  foreach who in array array[aid1, aid2, registrar, ra, far_aid] loop
    perform pg_temp.counted('an office reads nobody''s choices',
      pg_temp.seen(who, 'select * from public.institution_action_audiences'), 0);
  end loop;
  perform pg_temp.counted('a student reads only their own choices',
    pg_temp.seen(plain, 'select * from public.institution_action_audiences'), 0);

  -- ── completion: the student's mark, and the office's count ─────────────
  perform pg_temp.expect_allowed('a student marks an action that reaches them done', plain,
    format($q$insert into public.institution_action_progress (action_id, user_id) select %L, (select auth.uid())$q$, a_tenant));
  perform pg_temp.counted('and it shows in their feed',
    pg_temp.seen(plain, format('select * from public.my_office_actions() where id = %L and done_at is not null', a_tenant)), 1);
  perform pg_temp.expect_refused('a student cannot mark one that does not reach them', plain,
    format($q$insert into public.institution_action_progress (action_id, user_id) select %L, (select auth.uid())$q$, a_elig));
  a_draft := pg_temp.draft(aid1, 'financial_aid', 'oa-u', 'aid', 'tenant', null, 'Still a draft');
  perform pg_temp.expect_refused('nor a draft', plain,
    format($q$insert into public.institution_action_progress (action_id, user_id) select %L, (select auth.uid())$q$, a_draft));
  perform pg_temp.expect_refused('nor mark one for someone else', plain,
    format($q$insert into public.institution_action_progress (action_id, user_id) values (%L, %L)$q$, a_tenant, student));
  foreach who in array array[aid1, aid2, registrar] loop
    perform pg_temp.counted('an office reads no completion rows',
      pg_temp.seen(who, 'select * from public.institution_action_progress'), 0);
  end loop;

  for i in 1..8 loop
    crowd := crowd || pg_temp.newuser(format('crowd%s@oa-u.example', i), 'oa-u');
    perform pg_temp.value_as(crowd[i], format(
      $q$insert into public.institution_action_progress (action_id, user_id) select %L, (select auth.uid()) returning 1$q$, a_tenant));
  end loop;
  perform pg_temp.counted('nine done: the office sees no count',
    pg_temp.seen(aid1, format('select * from public.office_desk_actions() where id = %L and completed is null', a_tenant)), 1);
  crowd := crowd || pg_temp.newuser('crowd9@oa-u.example', 'oa-u');
  perform pg_temp.value_as(crowd[9], format(
    $q$insert into public.institution_action_progress (action_id, user_id) select %L, (select auth.uid()) returning 1$q$, a_tenant));
  perform pg_temp.counted('ten done: the office sees ten',
    pg_temp.seen(aid1, format('select * from public.office_desk_actions() where id = %L and completed = 10', a_tenant)), 1);
  perform pg_temp.expect_allowed('a student takes their mark back', crowd[9],
    format('delete from public.institution_action_progress where action_id = %L', a_tenant));
  perform pg_temp.counted('and the count is hidden again',
    pg_temp.seen(aid1, format('select * from public.office_desk_actions() where id = %L and completed is null', a_tenant)), 1);
  perform pg_temp.counted('a student reads no office desk',
    pg_temp.seen(plain, 'select * from public.office_desk_actions()'), 0);
  perform pg_temp.counted('another office reads none of Financial Aid''s',
    pg_temp.seen(registrar, 'select * from public.office_desk_actions() where office = ''financial_aid'''), 0);
  perform pg_temp.counted('the same office at another school reads none either',
    pg_temp.seen(far_aid, 'select * from public.office_desk_actions()'), 0);

  -- The table itself answers the same way as the desk (review fix
  -- 20260928310000): authenticated keeps SELECT on it, so a policy that asked
  -- only for a publishing capability let another office read the rows.
  perform pg_temp.counted('another office cannot select Financial Aid''s draft directly',
    pg_temp.seen(registrar, format('select * from public.institution_actions where id = %L', a_draft)), 0);
  perform pg_temp.counted('nor can a resources-only publisher',
    pg_temp.seen(ra, format('select * from public.institution_actions where id = %L', a_draft)), 0);
  perform pg_temp.counted('Financial Aid itself can (the control)',
    pg_temp.seen(aid2, format('select * from public.institution_actions where id = %L', a_draft)), 1);

  -- ── withdrawal ─────────────────────────────────────────────────────────
  perform pg_temp.says('a colleague withdraws it', pg_temp.move(aid2, a_tenant, 'withdraw'), 'withdrawn');
  perform pg_temp.counted('and it leaves every feed',
    pg_temp.seen(plain, format('select * from public.my_office_actions() where id = %L', a_tenant)), 0);
  perform pg_temp.says('a withdrawn action stays withdrawn',
    pg_temp.error_as(aid1, format('select public.move_office_action(%L, ''submit'', null)', a_tenant)), 'Cannot submit');

  -- ── rows from before Phase J ───────────────────────────────────────────
  insert into public.institution_actions (tenant_id, publisher_scope_kind, publisher_scope_id, action_type,
                                          audience_kind, target_student, title, status)
  values ('oa-u', 'school', 'oa-u', 'hold', 'student', student, 'An old hold', 'published')
  returning id into legacy;
  perform pg_temp.counted('a row with no office never reaches the feed',
    pg_temp.seen(student, format('select * from public.my_office_actions() where id = %L', legacy)), 0);
  perform pg_temp.says('and cannot be moved through the workflow',
    pg_temp.error_as(registrar, format('select public.move_office_action(%L, ''withdraw'', null)', legacy)), 'No such action in your scope');
  perform pg_temp.counted('a row with no office keeps the rule it was written under',
    pg_temp.seen(registrar, format('select * from public.institution_actions where id = %L', legacy)), 1);
end $$;

-- Anonymous callers reach none of it.
set local role anon;
do $$
begin
  perform public.my_office_actions();
  raise exception 'FAILED: anon read the office feed';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read the office feed';
end $$;
do $$
begin
  perform public.office_desk_actions();
  raise exception 'FAILED: anon read an office desk';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read an office desk';
end $$;
reset role;

rollback;
