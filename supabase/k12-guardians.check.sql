-- K–12 guardian links (K12-002): who may record a guardian, who may read the
-- link, and when the link stops counting.
--
-- LOCAL/DISPOSABLE DATABASES ONLY. Inserts synthetic users and schools, then
-- rolls everything back. Run through `supabase/check.sh k12-guardians`.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1));
  update public.profiles set school_id = school where user_id = who;
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

create or replace function pg_temp.answered(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- Runs `statement` as `who`; true when it was refused.
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

-- Asks `private.guardian_may_read` as `who`, the way a policy would.
create or replace function pg_temp.may_read(who uuid, student uuid)
returns boolean language plpgsql as $$
declare answer boolean;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  select private.guardian_may_read(student) into answer;
  return answer;
end $$;

do $$
declare
  staff      uuid;
  other_staff uuid;
  teen       uuid;
  sibling    uuid;
  adult_student uuid;
  parent     uuid;
  second_parent uuid;
  stranger   uuid;
  unstated   uuid;
  college_teen uuid;
  link       uuid;
  n          bigint;
begin
  insert into public.schools (id, name, email_domains, edition) values
    ('maple-k12-check', 'Maple Check High School', array['maple-check.example'], 'k12'),
    ('birch-k12-check', 'Birch Check High School', array['birch-check.example'], 'k12'),
    ('oak-college-check', 'Oak Check College', array['oak-check.example'], 'higher_ed');

  staff         := pg_temp.newuser('office@maple-check.example', 'maple-k12-check');
  other_staff   := pg_temp.newuser('office@birch-check.example', 'birch-k12-check');
  teen          := pg_temp.newuser('teen@maple-check.example', 'maple-k12-check');
  sibling       := pg_temp.newuser('sibling@maple-check.example', 'maple-k12-check');
  adult_student := pg_temp.newuser('senior@maple-check.example', 'maple-k12-check');
  parent        := pg_temp.newuser('parent@home-check.example', null);
  second_parent := pg_temp.newuser('parent2@home-check.example', null);
  stranger      := pg_temp.newuser('stranger@home-check.example', null);
  college_teen  := pg_temp.newuser('teen@oak-check.example', 'oak-college-check');

  -- The fixture makes every account an adult; make the three students minors.
  update private.account_ages set minor_until = current_date + 400 where user_id in (teen, sibling, college_teen);
  -- An account that never stated an age (D-139: not cleared).
  set local semester.fixture_age = 'off';
  unstated := pg_temp.newuser('unstated@home-check.example', null);
  set local semester.fixture_age = 'on';

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (staff, 'university_staff', 'school', 'maple-k12-check', 'institution'),
    (other_staff, 'university_staff', 'school', 'birch-k12-check', 'institution');

  -- ── Who may record a link ──────────────────────────────────────────────

  perform pg_temp.answered('a parent cannot make themselves a guardian',
    pg_temp.refused(parent, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', teen, parent, 'parent')), true);

  perform pg_temp.answered('a student cannot name their own guardian',
    pg_temp.refused(teen, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', teen, stranger, 'parent')), true);

  perform pg_temp.answered('another school''s staff cannot record a guardian here',
    pg_temp.refused(other_staff, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', teen, stranger, 'parent')), true);

  perform pg_temp.answered('staff cannot record a guardian at a college',
    pg_temp.refused(staff, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'oak-college-check', college_teen, parent, 'parent')), true);

  perform pg_temp.answered('staff cannot link a student who is 18',
    pg_temp.refused(staff, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', adult_student, parent, 'parent')), true);

  perform pg_temp.answered('a guardian who never stated an age is not accepted',
    pg_temp.refused(staff, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', teen, unstated, 'parent')), true);

  perform pg_temp.answered('a minor cannot be made a guardian',
    pg_temp.refused(staff, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', teen, sibling, 'other_caregiver')), true);

  perform pg_temp.become(staff);
  insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
  values ('maple-k12-check', teen, parent, 'parent', 'full')
  returning id into link;
  insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
  values ('maple-k12-check', teen, second_parent, 'parent', 'none');
  reset role;

  select count(*) into n from public.guardian_links where student_id = teen and verified_by = staff;
  perform pg_temp.counted('the school''s staff recorded two links, stamped as the verifier', n, 2);

  perform pg_temp.answered('a second live link for the same guardian is refused',
    pg_temp.refused(staff, format(
      'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
      'maple-k12-check', teen, parent, 'legal_guardian')), true);

  -- ── Who may read it ────────────────────────────────────────────────────

  perform pg_temp.become(parent);
  select count(*) into n from public.guardian_links;
  reset role;
  perform pg_temp.counted('a guardian reads only their own link', n, 1);

  perform pg_temp.become(teen);
  select count(*) into n from public.guardian_links;
  reset role;
  perform pg_temp.counted('the student reads both links about them', n, 2);

  perform pg_temp.become(sibling);
  select count(*) into n from public.guardian_links;
  reset role;
  perform pg_temp.counted('another student at the school reads none', n, 0);

  perform pg_temp.become(other_staff);
  select count(*) into n from public.guardian_links;
  reset role;
  perform pg_temp.counted('another school''s staff read none', n, 0);

  perform pg_temp.become(stranger);
  select count(*) into n from public.guardian_links;
  reset role;
  perform pg_temp.counted('a stranger reads none', n, 0);

  -- ── A restriction the guardian must not read ───────────────────────────

  perform pg_temp.become(staff);
  insert into public.guardian_link_restrictions (link_id, school_id, court_order, note)
  values (link, 'birch-k12-check', true, 'Pick-up only by the other parent.');
  reset role;
  select count(*) into n from public.guardian_link_restrictions where link_id = link and school_id = 'maple-k12-check' and written_by = staff;
  perform pg_temp.counted('a restriction takes the link''s school, whatever the writer said', n, 1);

  perform pg_temp.become(parent);
  select count(*) into n from public.guardian_link_restrictions;
  reset role;
  perform pg_temp.counted('the guardian cannot read the restriction about them', n, 0);

  perform pg_temp.become(teen);
  select count(*) into n from public.guardian_link_restrictions;
  reset role;
  perform pg_temp.counted('the student cannot read it either', n, 0);

  perform pg_temp.answered('another school''s staff cannot write a restriction on this link',
    pg_temp.refused(other_staff, format(
      'insert into public.guardian_link_restrictions (link_id, school_id, note) values (%L, %L, %L)',
      gen_random_uuid(), 'birch-k12-check', 'x')), true);

  -- ── Who may read the student's records as a guardian ──────────────────

  perform pg_temp.answered('a guardian with full rights may read', pg_temp.may_read(parent, teen), true);
  perform pg_temp.answered('a guardian with no rights may not', pg_temp.may_read(second_parent, teen), false);
  perform pg_temp.answered('a stranger may not', pg_temp.may_read(stranger, teen), false);
  perform pg_temp.answered('a guardian of one child may not read their sibling', pg_temp.may_read(parent, sibling), false);

  update private.account_ages set minor_until = current_date where user_id = teen;
  perform pg_temp.answered('on the 18th birthday the guardian may no longer read, with nothing run', pg_temp.may_read(parent, teen), false);
  update private.account_ages set minor_until = current_date + 400 where user_id = teen;
  perform pg_temp.answered('the day before, they could', pg_temp.may_read(parent, teen), true);

  -- ── Changing and ending ────────────────────────────────────────────────

  perform pg_temp.answered('the guardian cannot raise their own rights',
    pg_temp.refused(second_parent, format(
      'update public.guardian_links set rights = %L where guardian_id = %L', 'full', second_parent)), false);
  select count(*) into n from public.guardian_links where guardian_id = second_parent and rights = 'none';
  perform pg_temp.counted('— and the row is unchanged (the update matched nothing)', n, 1);

  perform pg_temp.answered('staff cannot move a link to another student',
    pg_temp.refused(staff, format(
      'update public.guardian_links set student_id = %L where id = %L', sibling, link)), true);

  perform pg_temp.become(staff);
  update public.guardian_links set rights = 'view_only' where id = link;
  update public.guardian_links set ended_at = now(), ended_reason = 'school' where id = link;
  reset role;
  perform pg_temp.answered('an ended link reads nothing', pg_temp.may_read(parent, teen), false);

  perform pg_temp.answered('an ended link cannot be reopened',
    pg_temp.refused(staff, format(
      'update public.guardian_links set ended_at = null, ended_reason = null where id = %L', link)), true);

  perform pg_temp.answered('nobody deletes a link',
    pg_temp.refused(staff, format('delete from public.guardian_links where id = %L', link)), true);
  select count(*) into n from public.guardian_links where id = link;
  perform pg_temp.counted('— the ended link is still there', n, 1);

  -- ── History ────────────────────────────────────────────────────────────

  select count(*) into n from public.guardian_link_history where link_id = link;
  perform pg_temp.counted('every change to the link was written down (created, changed, ended)', n, 3);

  perform pg_temp.become(teen);
  select count(*) into n from public.guardian_link_history;
  reset role;
  perform pg_temp.counted('the student reads the history of their links', n, 4);

  perform pg_temp.become(parent);
  select count(*) into n from public.guardian_link_history;
  reset role;
  perform pg_temp.counted('a guardian does not read the history', n, 0);

  perform pg_temp.answered('a client cannot write history',
    pg_temp.refused(staff, format(
      'insert into public.guardian_link_history (link_id, school_id, student_id, action, rights, relationship) values (%L, %L, %L, %L, %L, %L)',
      link, 'maple-k12-check', teen, 'created', 'full', 'parent')), true);

  begin
    update public.guardian_link_history set rights = 'full' where link_id = link;
    raise exception 'FAILED: history was rewritten, even by the owner';
  exception when insufficient_privilege then
    raise notice 'ok  history cannot be rewritten, even by the owner';
  end;

  begin
    delete from public.guardian_link_history where link_id = link;
    raise exception 'FAILED: history was deleted, even by the owner';
  exception when insufficient_privilege then
    raise notice 'ok  history cannot be deleted, even by the owner';
  end;

  -- The student's account deletion takes their links and their history.
  delete from auth.users where id = teen;
  select count(*) into n from public.guardian_links where student_id = teen;
  perform pg_temp.counted('deleting the student''s account removes their links', n, 0);
  select count(*) into n from public.guardian_link_history where student_id = teen;
  perform pg_temp.counted('— and the history of them', n, 0);

  -- A staff member who verified links leaves. Their account's deletion sets
  -- `verified_by` to null on every link they made, live or ended, and that
  -- must not be refused as an edit to a verification: the link stays, and only
  -- the name of who verified it goes.
  declare
    verifier uuid;
    ended_link uuid;
  begin
    verifier := pg_temp.newuser('leaving-office@maple-check.example', 'maple-k12-check');
    insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
      (verifier, 'university_staff', 'school', 'maple-k12-check', 'institution');
    perform pg_temp.become(verifier);
    insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
    values ('maple-k12-check', sibling, parent, 'parent', 'view_only');
    insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
    values ('maple-k12-check', sibling, second_parent, 'parent', 'view_only')
    returning id into ended_link;
    reset role;
    update public.guardian_links set ended_at = now(), ended_reason = 'school' where id = ended_link;

    select count(*) into n from public.guardian_links where verified_by = verifier;
    perform pg_temp.counted('the leaving staff member verified two links, one live and one ended', n, 2);

    select count(*) into n from public.guardian_link_history where changed_by = verifier;
    perform pg_temp.counted('the history names them as the one who made its changes', n, 3);
    delete from auth.users where id = verifier;
    perform pg_temp.counted('their account is deleted', (select count(*) from auth.users where id = verifier), 0);

    select count(*) into n from public.guardian_link_history where changed_by = verifier;
    perform pg_temp.counted('the history no longer names them', n, 0);
    select count(*) into n from public.guardian_link_history where link_id = ended_link;
    perform pg_temp.counted('— and the history itself is kept', n, 3);
    begin
      update public.guardian_link_history set changed_by = staff where link_id = ended_link;
      raise exception 'FAILED: a history actor was rewritten by a direct update';
    exception when insufficient_privilege then
      raise notice 'ok  history cannot be rewritten by a direct update';
    end;
    select count(*) into n from public.guardian_links where student_id = sibling and verified_by is null;
    perform pg_temp.counted('both links are still there, no longer naming who verified them', n, 2);
    select count(*) into n from public.guardian_links where student_id = sibling and ended_at is null;
    perform pg_temp.counted('the live one is still live', n, 1);
    select count(*) into n from public.guardian_links where id = ended_link and ended_at is not null;
    perform pg_temp.counted('the ended one is still ended', n, 1);

    -- The controls, on a live link that still names its verifier: a person
    -- cannot null or rewrite a verification by hand, not even the table's
    -- owner. Only the verifier's account deletion does.
    declare
      held uuid;
    begin
      perform pg_temp.become(staff);
      insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
      values ('maple-k12-check', sibling, stranger, 'other_caregiver', 'view_only')
      returning id into held;
      reset role;
      perform pg_temp.counted('a fresh live link names its verifier', (select count(*) from public.guardian_links where id = held and verified_by = staff), 1);
      begin
        update public.guardian_links set verified_by = null where id = held;
        raise exception 'FAILED: a verification was erased by a direct update';
      exception when check_violation then
        raise notice 'ok  a verification cannot be erased by a direct update';
      end;
      begin
        update public.guardian_links set verified_by = other_staff where id = held;
        raise exception 'FAILED: a verification was rewritten by a direct update';
      exception when check_violation then
        raise notice 'ok  nor rewritten to someone else';
      end;
      perform pg_temp.counted('the verifier is unchanged', (select count(*) from public.guardian_links where id = held and verified_by = staff), 1);
    end;
  end;

  -- ── Grade levels ───────────────────────────────────────────────────────

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (staff, 'university_admin', 'school', 'maple-k12-check', 'institution');
  perform pg_temp.become(staff);
  insert into public.grade_levels (school_id, code, label, sort_order) values ('maple-k12-check', '9', 'Grade 9', 9);
  reset role;
  perform pg_temp.become(sibling);
  select count(*) into n from public.grade_levels;
  reset role;
  perform pg_temp.counted('a student reads their school''s grade levels', n, 1);
  perform pg_temp.become(other_staff);
  select count(*) into n from public.grade_levels;
  reset role;
  perform pg_temp.counted('another school does not', n, 0);
  perform pg_temp.answered('a student cannot add a grade level',
    pg_temp.refused(sibling, format(
      'insert into public.grade_levels (school_id, code, label, sort_order) values (%L, %L, %L, %L)',
      'maple-k12-check', '10', 'Grade 10', 10)), true);
  perform pg_temp.answered('a grade outside K–12 is refused',
    pg_temp.refused(staff, format(
      'insert into public.grade_levels (school_id, code, label, sort_order) values (%L, %L, %L, %L)',
      'maple-k12-check', '13', 'Grade 13', 12)), true);

  -- ── Findings from review ────────────────────────────────────────────────

  -- A school moved back to higher_ed keeps its links, and their verifier's
  -- account must still be erasable.
  declare
    flip_staff uuid; flip_student uuid; flip_link uuid;
  begin
    insert into public.schools (id, name, email_domains, edition)
    values ('flip-k12-check', 'Flip Check High School', array['flip-check.example'], 'k12');
    flip_staff   := pg_temp.newuser('office@flip-check.example', 'flip-k12-check');
    flip_student := pg_temp.newuser('teen@flip-check.example', 'flip-k12-check');
    update private.account_ages set minor_until = current_date + 400 where user_id = flip_student;
    insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
      (flip_staff, 'university_staff', 'school', 'flip-k12-check', 'institution');
    perform pg_temp.become(flip_staff);
    insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
    values ('flip-k12-check', flip_student, parent, 'parent', 'view_only') returning id into flip_link;
    reset role;
    update public.schools set edition = 'higher_ed' where id = 'flip-k12-check';
    delete from auth.users where id = flip_staff;
    perform pg_temp.counted('a verifier at a school moved to higher_ed can be erased, the link stays',
      (select count(*) from public.guardian_links where id = flip_link and verified_by is null), 1);
    perform pg_temp.answered('— but the moved school cannot gain a new link',
      pg_temp.refused(staff, format(
        'insert into public.guardian_links (school_id, student_id, guardian_id, relationship) values (%L, %L, %L, %L)',
        'flip-k12-check', flip_student, second_parent, 'parent')), true);
    perform pg_temp.answered('— nor a grade level',
      pg_temp.refused(staff, format(
        'insert into public.grade_levels (school_id, code, label, sort_order) values (%L, %L, %L, %L)',
        'flip-k12-check', '9', 'Grade 9', 9)), true);
  end;

  -- A higher-ed school cannot keep K–12 grade levels, at insert or by moving.
  -- As the table's owner, so the policy is not what refuses it: the rule holds
  -- for every writer, like the link rules.
  reset role;
  begin
    insert into public.grade_levels (school_id, code, label, sort_order) values ('oak-college-check', '9', 'Grade 9', 9);
    raise exception 'FAILED: a higher-ed school was given a grade level';
  exception when check_violation then
    raise notice 'ok  a higher-ed school cannot have grade levels, whoever writes';
  end;
  begin
    update public.grade_levels set school_id = 'oak-college-check' where school_id = 'maple-k12-check';
    raise exception 'FAILED: a grade level was moved to a higher-ed school';
  exception when check_violation then
    raise notice 'ok  a grade level cannot be moved to a higher-ed school';
  end;

  -- The writer of a restriction leaves: the name goes, the audit time stays.
  declare
    writer uuid; held uuid; stamped timestamptz;
  begin
    writer := pg_temp.newuser('writer@maple-check.example', 'maple-k12-check');
    insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
      (writer, 'university_staff', 'school', 'maple-k12-check', 'institution');
    perform pg_temp.become(staff);
    reset role;
    insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
    values ('maple-k12-check', sibling, adult_student, 'other_caregiver', 'none') returning id into held;
    perform pg_temp.become(writer);
    insert into public.guardian_link_restrictions (link_id, court_order, note) values (held, true, 'order on file');
    reset role;
    update public.guardian_link_restrictions set written_at = now() - interval '3 days' where link_id = held;
    select written_at into stamped from public.guardian_link_restrictions where link_id = held;
    delete from auth.users where id = writer;
    perform pg_temp.counted('a restriction writer can be erased; the name goes, the restriction stays',
      (select count(*) from public.guardian_link_restrictions where link_id = held and written_by is null and court_order), 1);
    perform pg_temp.counted('— and its audit time is not restamped',
      (select count(*) from public.guardian_link_restrictions where link_id = held and written_at = stamped), 1);
  end;

  -- A school is removed: its guardian history goes with it (RETENTION.md).
  declare
    gone_student uuid;
  begin
    insert into public.schools (id, name, email_domains, edition)
    values ('gone-k12-check', 'Gone Check High School', array['gone-check.example'], 'k12');
    gone_student := pg_temp.newuser('teen@gone-check.example', 'gone-k12-check');
    update private.account_ages set minor_until = current_date + 400 where user_id = gone_student;
    perform pg_temp.become(staff);
    reset role;
    insert into public.guardian_links (school_id, student_id, guardian_id, relationship)
    values ('gone-k12-check', gone_student, parent, 'parent');
    perform pg_temp.counted('a school''s links leave history rows',
      (select count(*) from public.guardian_link_history where school_id = 'gone-k12-check'), 1);
    begin
      delete from public.guardian_link_history where school_id = 'gone-k12-check';
      raise exception 'FAILED: history was deleted directly';
    exception when insufficient_privilege then
      raise notice 'ok  history cannot be deleted directly';
    end;
    update public.profiles set school_id = null where user_id = gone_student;
    -- A school is never deleted in production (docs/SCHOOL-OFFBOARDING.md); the
    -- purge that will one day remove one must leave no history behind, so this
    -- takes the refusal off inside the rolled-back test only.
    alter table public.schools disable trigger refuse_school_delete;
    delete from public.schools where id = 'gone-k12-check';
    alter table public.schools enable trigger refuse_school_delete;
    perform pg_temp.counted('deleting the school removes its history too',
      (select count(*) from public.guardian_link_history where school_id = 'gone-k12-check'), 0);
  end;
end $$;

rollback;
