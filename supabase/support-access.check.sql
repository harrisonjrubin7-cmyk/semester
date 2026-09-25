-- Student-granted, time-boxed and audited support access.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

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
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  student uuid;
  supporter uuid;
  stranger uuid;
  other_tenant_supporter uuid;
  consent uuid;
  second_consent uuid;
  first_grant_id uuid;
  second_grant_id uuid;
  ui_grant_id uuid;
  reopened_grant_id uuid;
  ui_consent_id uuid;
  evidence uuid;
  n bigint;
  revoked boolean;
begin
  insert into public.schools (id, name, email_domains) values
    ('support-check', 'Support Check University', array['support-check.example']),
    ('other-support-check', 'Other Support University', array['other-support-check.example']);

  student := pg_temp.newuser('student@support-check.example', 'support-check');
  supporter := pg_temp.newuser('supporter@support-check.example', 'support-check');
  stranger := pg_temp.newuser('stranger@support-check.example', 'support-check');
  other_tenant_supporter := pg_temp.newuser(
    'supporter@other-support-check.example', 'other-support-check'
  );

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance)
  values
    (supporter, 'university_staff', 'school', 'support-check', 'institution'),
    (other_tenant_supporter, 'university_staff', 'school',
     'other-support-check', 'institution');

  perform pg_temp.become(student);
  select count(*) into n
    from public.available_supporters();
  reset role;
  perform pg_temp.counted(
    'the student can choose only the verified same-school supporter', n, 1
  );

  perform pg_temp.become(student);
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version,
     recorded_by, expires_at)
  values
    ('support-check', student, 'support:read', 'consented', '1',
     student, now() + interval '2 days')
  returning id into consent;

  insert into public.support_access_grant
    (tenant_id, student_id, supporter_id, consent_id, scopes, reason, expires_at)
  values
    ('support-check', student, supporter, consent,
     array['learning-progress'], 'Help me plan a recovery conversation.',
     now() + interval '1 day')
  returning id into first_grant_id;

  insert into public.evidence_reference
    (tenant_id, person_id, course_id, title, origin, authority, locator, created_by)
  values
    ('support-check', student, 'econ', 'Practice result', 'student',
     'confirmed', 'practice:1', student)
  returning id into evidence;
  insert into public.concept_evidence
    (tenant_id, person_id, evidence_id, course_id, concept_id, kind, score)
  values
    ('support-check', student, evidence, 'econ', 'elasticity', 'practice', 0.65);
  insert into public.mistake_evidence
    (tenant_id, person_id, evidence_id, course_id, concept_id, classification, detail)
  values
    ('support-check', student, evidence, 'econ', 'elasticity', 'concept',
     'Private detail that support must never receive.');
  reset role;

  perform pg_temp.become(supporter);
  select count(*) into n
    from public.support_access_grant g
   where g.id = first_grant_id;
  reset role;
  perform pg_temp.counted('the named supporter sees the active grant', n, 1);

  perform pg_temp.become(stranger);
  select count(*) into n
    from public.support_access_grant g
   where g.id = first_grant_id;
  reset role;
  perform pg_temp.counted('another same-school account sees no grant', n, 0);

  perform pg_temp.become(other_tenant_supporter);
  select count(*) into n
    from public.support_access_grant g
   where g.id = first_grant_id;
  reset role;
  perform pg_temp.counted('another tenant sees no grant', n, 0);

  perform pg_temp.become(supporter);
  select count(*) into n from public.read_support_signals(first_grant_id)
   where course_id = 'econ' and evidence_count = 1 and mistake_count = 1
     and average_score = 0.65;
  reset role;
  perform pg_temp.counted('the supporter receives one aggregate course signal', n, 1);

  perform pg_temp.become(supporter);
  select count(*) into n from public.mistake_evidence where person_id = student;
  reset role;
  perform pg_temp.counted('the supporter still cannot read raw mistake detail', n, 0);

  perform pg_temp.become(student);
  select count(*) into n
    from public.support_access_event e
   where e.grant_id = first_grant_id and e.action = 'signals_viewed';
  reset role;
  perform pg_temp.counted('the student can see the recorded support read', n, 1);

  perform pg_temp.become(stranger);
  select count(*) into n
    from public.support_access_event e
   where e.grant_id = first_grant_id;
  reset role;
  perform pg_temp.counted('another account sees no support access evidence', n, 0);

  perform pg_temp.become(other_tenant_supporter);
  select count(*) into n
    from public.support_access_event e
   where e.grant_id = first_grant_id;
  reset role;
  perform pg_temp.counted('another tenant sees no support access evidence', n, 0);

  if not pg_temp.refused(
    stranger,
    format('select * from public.read_support_signals(%L)', first_grant_id)
  ) then
    raise exception 'FAILED: another account used the support grant';
  end if;
  raise notice 'ok  another account cannot use the support grant';

  if not pg_temp.refused(
    student,
    format(
      'insert into public.support_access_grant '
      '(tenant_id, student_id, supporter_id, consent_id, scopes, reason, expires_at) '
      'values (%L, %L, %L, %L, array[''learning-progress''], %L, now() + interval ''1 day'')',
      'support-check', student, stranger, consent, 'Unverified supporter'
    )
  ) then
    raise exception 'FAILED: a person without support:read received a grant';
  end if;
  raise notice 'ok  an unverified supporter cannot receive a grant';

  if not pg_temp.refused(
    student,
    format(
      'insert into public.support_access_grant '
      '(tenant_id, student_id, supporter_id, consent_id, scopes, reason, expires_at) '
      'values (%L, %L, %L, %L, array[''learning-progress''], %L, now() + interval ''8 days'')',
      'support-check', student, supporter, consent, 'Too long'
    )
  ) then
    raise exception 'FAILED: a support grant lasted more than seven days';
  end if;
  raise notice 'ok  a support grant cannot last more than seven days';

  if not pg_temp.refused(
    student,
    format(
      'insert into public.support_access_grant '
      '(tenant_id, student_id, supporter_id, consent_id, scopes, reason, created_at, expires_at) '
      'values (%L, %L, %L, %L, array[''learning-progress''], %L, '
      'now() + interval ''10 days'', now() + interval ''11 days'')',
      'support-check', student, supporter, consent, 'Forged creation time'
    )
  ) then
    raise exception 'FAILED: a caller forged created_at to bypass the seven-day limit';
  end if;
  raise notice 'ok  a caller cannot forge created_at to bypass the seven-day limit';

  perform pg_temp.become(student);
  update public.support_access_grant g
     set revoked_at = now()
   where g.id = first_grant_id;
  reset role;
  if not pg_temp.refused(
    supporter,
    format('select * from public.read_support_signals(%L)', first_grant_id)
  ) then
    raise exception 'FAILED: a revoked support grant still worked';
  end if;
  raise notice 'ok  revocation stops the next support read';

  perform pg_temp.become(student);
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version,
     recorded_by, expires_at)
  values
    ('support-check', student, 'support:read', 'consented', '2',
     student, now() + interval '2 days')
  returning id into second_consent;
  insert into public.support_access_grant
    (tenant_id, student_id, supporter_id, consent_id, reason, expires_at)
  values
    ('support-check', student, supporter, second_consent,
     'Second window for consent withdrawal.', now() + interval '1 day')
  returning id into second_grant_id;
  update public.consent_record
     set status = 'revoked', revoked_at = now()
   where id = second_consent;
  reset role;

  select count(*) into n
    from public.support_access_grant g
   where g.id = second_grant_id and g.revoked_at is not null;
  perform pg_temp.counted('consent withdrawal automatically revokes its grant', n, 1);

  perform pg_temp.become(student);
  select public.create_support_access(
    supporter, 'Help me understand the aggregate learning pattern.', 1
  ) into ui_grant_id;
  select count(*) into n
    from public.support_access_windows() w
   where w.grant_id = ui_grant_id
     and w.side = 'student'
     and w.counterpart_label = 'supporter';
  reset role;
  perform pg_temp.counted('the student surface creates and lists its atomic consent window', n, 1);

  perform pg_temp.become(supporter);
  select count(*) into n
    from public.support_access_windows() w
   where w.grant_id = ui_grant_id
     and w.side = 'supporter'
     and w.counterpart_label = 'student';
  reset role;
  perform pg_temp.counted('the named supporter surface lists the active window', n, 1);

  select g.consent_id into ui_consent_id
    from public.support_access_grant g where g.id = ui_grant_id;
  perform pg_temp.become(student);
  select public.revoke_support_access(ui_grant_id) into revoked;
  reset role;
  if not revoked then raise exception 'FAILED: the student revoke returned false'; end if;
  select count(*) into n
    from public.support_access_grant g
    join public.consent_record c on c.id = g.consent_id
   where g.id = ui_grant_id
     and g.revoked_at is not null
     and c.id = ui_consent_id
     and c.status = 'revoked'
     and c.revoked_at is not null;
  perform pg_temp.counted('revoke closes both the support grant and its consent', n, 1);

  perform pg_temp.become(student);
  select public.create_support_access(
    supporter, 'A later, separately consented support window.', 1
  ) into reopened_grant_id;
  reset role;
  if reopened_grant_id = ui_grant_id then
    raise exception 'FAILED: renewed support access reused revoked consent';
  end if;
  raise notice 'ok  later access creates a separate consented window';

  if not pg_temp.refused(
    supporter,
    format('select public.revoke_support_access(%L)', reopened_grant_id)
  ) then
    raise exception 'FAILED: the supporter revoked the student consent';
  end if;
  raise notice 'ok  only the student can revoke the support window';

  if not pg_temp.refused(
    student,
    format(
      'select public.create_support_access(%L, %L, 1)',
      stranger, 'This account has no verified support role.'
    )
  ) then
    raise exception 'FAILED: the student surface granted an unverified account';
  end if;
  raise notice 'ok  the student surface refuses an unverified supporter';

  if not pg_temp.refused(
    supporter,
    format('update public.support_access_event set action = %L where grant_id = %L',
           'signals_viewed', first_grant_id)
  ) then
    raise exception 'FAILED: a supporter changed immutable access evidence';
  end if;
  raise notice 'ok  support access evidence is immutable';

  perform pg_temp.become(student);
  select public.forget_my_support_access() into n;
  reset role;
  select count(*) into n
    from public.support_access_grant g
   where g.student_id = student or g.supporter_id = student;
  perform pg_temp.counted('account deletion helper removes every support grant', n, 0);

  select count(*) into n
    from public.support_access_event e
   where e.grant_id in (
     first_grant_id, second_grant_id, ui_grant_id, reopened_grant_id
   );
  if n < 4 then
    raise exception 'FAILED: pseudonymous support evidence disappeared — got %', n;
  end if;
  raise notice 'ok  pseudonymous support evidence remains after grant deletion (%)', n;

  select count(*) into n
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'support_access_event'
     and c.column_name in (
       'student_id', 'supporter_id', 'consent_id', 'reason',
       'old_data', 'new_data'
     );
  perform pg_temp.counted('support evidence has no raw identity, reason or free-form data fields', n, 0);

  raise notice 'support access: every check passed';
end $$;

rollback;
