-- The Workflow Builder (D-1018): who may draft and who may publish a school's
-- workflow definition, that whoever drafted it does not publish it, that a
-- published version is never edited or deleted, that every write is held to
-- the closed spec (steps, eligibility rules, the facts a rule may read), that
-- a definition with an official handoff has the student confirm first and
-- names the office, and that deleting an account leaves the school's workflow
-- standing. Every refusal is attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh workflow-builder

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

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

-- Rows a statement touched as someone; zero is a refusal by row-level security.
create or replace function pg_temp.touched(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute q;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
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

create or replace function pg_temp.says(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is null or position(want in got) = 0 then
    raise exception 'FAILED: % — expected "%", got "%"', what, want, got;
  end if;
  raise notice 'ok  % ("%")', what, want;
end $$;

create or replace function pg_temp.runs_clean(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;


-- A valid definition to vary from.
create or replace function pg_temp.valid_def() returns text language sql as $$
  select '{"title": "Registration clearance",
    "steps": [
      {"id": "check", "kind": "rule_check", "title": "Check eligibility", "owner": "system"},
      {"id": "confirm", "kind": "student_confirm", "title": "Confirm the request", "owner": "student", "sla_days": 3},
      {"id": "handoff", "kind": "official_handoff", "title": "Send to the registrar", "owner": "office"},
      {"id": "done", "kind": "complete", "title": "Done", "owner": "system"}],
    "requires": [
      {"id": "enrolled", "fact": "program_enrolled", "op": "eq", "value": true,
       "explain": "You need to be enrolled in a program.", "next_step": "Ask the registrar to confirm your enrolment."},
      {"id": "credits", "fact": "credits_earned", "op": "gte", "value": 12,
       "explain": "This needs 12 credits earned.", "next_step": "See your advisor about your plan."}],
    "handoff": "Office of the Registrar"}';
$$;

-- Problems with a definition, as one string ('' when none).
create or replace function pg_temp.problems(d text)
returns text language sql as $$
  select coalesce(array_to_string(private.workflow_problems(d::jsonb), ','), '');
$$;

-- Replace a piece of the valid definition, then list its problems.
create or replace function pg_temp.variant(from_text text, to_text text)
returns text language sql as $$
  select pg_temp.problems(replace(pg_temp.valid_def(), from_text, to_text));
$$;

create or replace function pg_temp.draft(who uuid, wf text, def text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'insert into public.workflow_versions (tenant_id, workflow, definition) values (''wf-u'', %L, %L::jsonb)', wf, def));
end $$;

create or replace function pg_temp.publish(who uuid, wf text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'update public.workflow_versions set state = ''published'' where tenant_id = ''wf-u'' and workflow = %L and state = ''draft''', wf));
end $$;

do $$
declare
  editor uuid; editor2 uuid; publisher uuid; admin uuid; researcher uuid; student uuid; far_editor uuid;
  gone uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('wf-u', 'Workflow University', array['wf-u.example']),
    ('wf-other', 'Other University', array['wf-other.example']);

  editor     := pg_temp.newuser('editor@wf-u.example', 'wf-u');
  editor2    := pg_temp.newuser('editor2@wf-u.example', 'wf-u');
  publisher  := pg_temp.newuser('registrar@wf-u.example', 'wf-u');
  admin      := pg_temp.newuser('admin@wf-u.example', 'wf-u');
  researcher := pg_temp.newuser('ir@wf-u.example', 'wf-u');
  student    := pg_temp.newuser('student@wf-u.example', 'wf-u');
  far_editor := pg_temp.newuser('editor@wf-other.example', 'wf-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (editor,     'implementation_manager',   'school', 'wf-u',     'institution'),
    (editor2,    'integration_admin',        'school', 'wf-u',     'institution'),
    (publisher,  'registrar',                'school', 'wf-u',     'institution'),
    (admin,      'university_admin',         'school', 'wf-u',     'institution'),
    (researcher, 'institutional_researcher', 'school', 'wf-u',     'institution'),
    (student,    'student',                  'school', 'wf-u',     'institution'),
    (far_editor, 'implementation_manager',   'school', 'wf-other', 'institution');

  -- ── the spec ───────────────────────────────────────────────────────────
  perform pg_temp.counted('ten workflow templates, the ten the brief lists',
    jsonb_array_length(private.workflow_spec() -> 'workflows'), 10);
  perform pg_temp.counted('the valid definition has no problems', length(pg_temp.problems(pg_temp.valid_def())), 0);
  perform pg_temp.says('a definition must be an object', pg_temp.problems('[1]'), 'not_object');
  perform pg_temp.says('an unknown top-level key', pg_temp.variant('"handoff":', '"webhook_url": "x", "handoff":'), 'unknown_key:webhook_url');
  perform pg_temp.says('a step holding a student''s email',
    pg_temp.variant('"id": "check", "kind"', '"id": "check", "student_email": "a@b.example", "kind"'), 'step_unknown_key:check');
  perform pg_temp.says('a check holding a student''s email',
    pg_temp.variant('"id": "enrolled", "fact"', '"id": "enrolled", "student_email": "a@b.example", "fact"'), 'req_unknown_key:enrolled');
  perform pg_temp.says('a blank title', pg_temp.variant('"Registration clearance"', '"  "'), 'title');
  perform pg_temp.says('a card number in the title', pg_temp.variant('"Registration clearance"', '"Pay 4111 1111 1111 1111"'), 'title');
  perform pg_temp.says('an unknown step kind', pg_temp.variant('"rule_check"', '"run_script"'), 'step_kind:check');
  perform pg_temp.says('an unknown owner', pg_temp.variant('"owner": "system"}', '"owner": "robot"}'), 'step_owner:check');
  perform pg_temp.says('a step id that is not a slug', pg_temp.variant('"id": "check"', '"id": "Check It"'), 'step_id:1');
  perform pg_temp.says('a repeated step id', pg_temp.variant('"id": "done"', '"id": "check"'), 'dup_step:check');
  perform pg_temp.says('an out-of-range SLA', pg_temp.variant('"sla_days": 3', '"sla_days": 61'), 'step_sla:confirm');
  perform pg_temp.says('the last step must complete the workflow', pg_temp.variant('"kind": "complete"', '"kind": "notify"'), 'last_step_complete');
  perform pg_temp.says('the student confirms before the handoff',
    pg_temp.variant('"kind": "student_confirm"', '"kind": "notify"'), 'confirm_before_handoff:handoff');
  perform pg_temp.says('a handoff step needs the office it hands off to',
    pg_temp.variant(E',\n    "handoff": "Office of the Registrar"', ''), 'handoff_missing');
  perform pg_temp.says('no steps', pg_temp.problems('{"title": "x", "steps": []}'), 'steps_count');
  perform pg_temp.says('an unknown fact — a grade is not one the school may read',
    pg_temp.variant('"fact": "program_enrolled"', '"fact": "final_grade"'), 'req_fact:enrolled');
  perform pg_temp.says('nor a balance', pg_temp.variant('"fact": "program_enrolled"', '"fact": "balance_owed"'), 'req_fact:enrolled');
  perform pg_temp.says('a bool fact only equals', pg_temp.variant('"op": "eq", "value": true', '"op": "gte", "value": true'), 'req_op:enrolled');
  perform pg_temp.says('a bool fact takes a bool', pg_temp.variant('"value": true', '"value": 1'), 'req_value:enrolled');
  perform pg_temp.says('an int fact stays in range', pg_temp.variant('"value": 12', '"value": 401'), 'req_value:credits');
  perform pg_temp.says('and takes a whole number', pg_temp.variant('"value": 12', '"value": 12.5'), 'req_value:credits');
  perform pg_temp.says('a requirement must explain itself', pg_temp.variant('"explain": "This needs 12 credits earned."', '"explain": ""'), 'req_explain:credits');
  perform pg_temp.says('and say what to do next', pg_temp.variant('"next_step": "See your advisor about your plan."', '"next_step": 5'), 'req_next:credits');
  perform pg_temp.says('a repeated requirement id', pg_temp.variant('"id": "credits"', '"id": "enrolled"'), 'dup_req:enrolled');

  -- ── who may draft and see ──────────────────────────────────────────────
  perform pg_temp.runs_clean('an editor drafts', pg_temp.draft(editor, 'registration_clearance', pg_temp.valid_def()));
  perform pg_temp.says('a registrar cannot draft', pg_temp.draft(publisher, 'advisor_approval', pg_temp.valid_def()), 'row-level security');
  perform pg_temp.says('nor a student', pg_temp.draft(student, 'advisor_approval', pg_temp.valid_def()), 'row-level security');
  perform pg_temp.says('nor an editor at another school',
    pg_temp.error_as(far_editor, format($q$insert into public.workflow_versions (tenant_id, workflow, definition) values ('wf-u', 'advisor_approval', %L::jsonb)$q$, pg_temp.valid_def())),
    'row-level security');
  perform pg_temp.says('a workflow has one draft', pg_temp.draft(editor2, 'registration_clearance', pg_temp.valid_def()), 'duplicate key');
  perform pg_temp.says('an unknown workflow kind is refused', pg_temp.draft(editor, 'payroll', pg_temp.valid_def()), 'check constraint');
  perform pg_temp.says('a draft the spec refuses is refused by the database',
    pg_temp.draft(editor, 'advisor_approval', replace(pg_temp.valid_def(), '"fact": "program_enrolled"', '"fact": "final_grade"')), 'req_fact:enrolled');
  perform pg_temp.counted('the draft is stamped a draft with no version and its author',
    (select count(*) from public.workflow_versions where workflow = 'registration_clearance' and state = 'draft' and version is null and created_by = editor), 1);
  perform pg_temp.counted('the publisher reads it', pg_temp.seen(publisher, 'select * from public.workflow_versions'), 1);
  perform pg_temp.counted('the researcher reads it', pg_temp.seen(researcher, 'select * from public.workflow_versions'), 1);
  perform pg_temp.counted('a student reads none', pg_temp.seen(student, 'select * from public.workflow_versions'), 0);
  perform pg_temp.counted('an editor elsewhere reads none', pg_temp.seen(far_editor, 'select * from public.workflow_versions'), 0);
  perform pg_temp.counted('a draft is saved again by its author',
    pg_temp.touched(editor, $q$update public.workflow_versions set note = 'first pass' where workflow = 'registration_clearance'$q$), 1);
  perform pg_temp.counted('the researcher cannot change one',
    pg_temp.touched(researcher, $q$update public.workflow_versions set note = 'x' where workflow = 'registration_clearance'$q$), 0);
  perform pg_temp.says('a publisher without the drafting role cannot rewrite a draft they are to review',
    pg_temp.error_as(publisher, $q$update public.workflow_versions set note = 'sneaky' where workflow = 'registration_clearance'$q$),
    'cannot change a draft');
  perform pg_temp.says('a draft does not change school',
    pg_temp.error_as(editor, $q$update public.workflow_versions set tenant_id = 'wf-other' where workflow = 'registration_clearance'$q$), 'stays with its school');
  perform pg_temp.says('an editor cannot publish',
    pg_temp.error_as(editor, $q$update public.workflow_versions set state = 'published' where workflow = 'registration_clearance'$q$), 'cannot publish');

  -- ── publishing ─────────────────────────────────────────────────────────
  perform pg_temp.says('an editor without the capability cannot publish another editor''s draft',
    pg_temp.publish(editor2, 'registration_clearance'), 'cannot publish');
  perform pg_temp.says('a publisher cannot change the draft in the same breath',
    pg_temp.error_as(publisher, $q$update public.workflow_versions set state = 'published', note = 'changed' where workflow = 'registration_clearance'$q$),
    'published as it was reviewed');
  perform pg_temp.says('nor swap the definition in the same breath',
    pg_temp.error_as(publisher, $q$update public.workflow_versions set state = 'published',
      definition = '{"title": "Swapped", "steps": [{"id": "done", "kind": "complete", "title": "Done", "owner": "system"}]}'::jsonb
      where workflow = 'registration_clearance'$q$),
    'published as it was reviewed');
  perform pg_temp.runs_clean('the registrar publishes it', pg_temp.publish(publisher, 'registration_clearance'));
  perform pg_temp.counted('it is version 1, stamped by the publisher',
    (select count(*) from public.workflow_versions where workflow = 'registration_clearance' and state = 'published' and version = 1 and published_by = publisher), 1);
  perform pg_temp.counted('and the draft is gone into it',
    (select count(*) from public.workflow_versions where workflow = 'registration_clearance' and state = 'draft'), 0);
  perform pg_temp.counted('a published version is not edited',
    pg_temp.touched(editor, $q$update public.workflow_versions set note = 'x' where workflow = 'registration_clearance'$q$), 0);
  perform pg_temp.counted('not even by the publisher',
    pg_temp.touched(publisher, $q$update public.workflow_versions set note = 'x' where workflow = 'registration_clearance'$q$), 0);
  perform pg_temp.counted('nor deleted by an editor',
    pg_temp.touched(editor, $q$delete from public.workflow_versions where workflow = 'registration_clearance'$q$), 0);
  perform pg_temp.counted('nor by an admin',
    pg_temp.touched(admin, $q$delete from public.workflow_versions where workflow = 'registration_clearance'$q$), 0);

  -- ── the second-person rule, on a holder of both capabilities ───────────
  perform pg_temp.runs_clean('an admin (who holds both capabilities) drafts a change',
    pg_temp.error_as(admin, format($q$insert into public.workflow_versions (tenant_id, workflow, definition, based_on, note)
      values ('wf-u', 'registration_clearance', %L::jsonb, 1, 'stricter')$q$, replace(pg_temp.valid_def(), '"value": 12', '"value": 24'))));
  perform pg_temp.says('and does not publish their own draft', pg_temp.publish(admin, 'registration_clearance'), 'does not publish it');
  perform pg_temp.runs_clean('the registrar publishes it', pg_temp.publish(publisher, 'registration_clearance'));
  perform pg_temp.counted('as version 2', (select count(*) from public.workflow_versions where workflow = 'registration_clearance' and version = 2), 1);

  -- ── a rollback ─────────────────────────────────────────────────────────
  perform pg_temp.says('a draft cannot be based on a version that does not exist',
    pg_temp.error_as(editor, format($q$insert into public.workflow_versions (tenant_id, workflow, definition, based_on)
      values ('wf-u', 'registration_clearance', %L::jsonb, 9)$q$, pg_temp.valid_def())), 'no published version 9');
  perform pg_temp.runs_clean('a rollback is a draft copied from version 1',
    pg_temp.error_as(editor, format($q$insert into public.workflow_versions (tenant_id, workflow, definition, based_on, note)
      values ('wf-u', 'registration_clearance', %L::jsonb, 1, 'back to version 1')$q$, pg_temp.valid_def())));
  perform pg_temp.runs_clean('and is published by the admin as version 3', pg_temp.publish(admin, 'registration_clearance'));
  perform pg_temp.counted('history holds all three',
    (select count(*) from public.workflow_versions where workflow = 'registration_clearance' and state = 'published'), 3);
  perform pg_temp.counted('the current definition is version 3''s, which is version 1''s again',
    (select count(*) from public.workflow_versions where workflow = 'registration_clearance'
        and version = (select max(version) from public.workflow_versions where workflow = 'registration_clearance')
        and definition = pg_temp.valid_def()::jsonb), 1);

  -- ── a draft is discarded by an editor, not a researcher ────────────────
  perform pg_temp.runs_clean('a second workflow drafted', pg_temp.draft(editor, 'tutoring_referral', pg_temp.valid_def()));
  perform pg_temp.counted('a researcher cannot discard it',
    pg_temp.touched(researcher, $q$delete from public.workflow_versions where workflow = 'tutoring_referral'$q$), 0);
  perform pg_temp.counted('an editor can', pg_temp.touched(editor, $q$delete from public.workflow_versions where workflow = 'tutoring_referral'$q$), 1);

  -- ── a client cannot pass itself off as an account deletion ─────────────
  perform pg_temp.runs_clean('an admin drafts another workflow to try it on', pg_temp.draft(admin, 'tutoring_referral', pg_temp.valid_def()));
  perform pg_temp.says('a drafter cannot clear their own name from a draft, to then publish it',
    pg_temp.error_as(admin, $q$update public.workflow_versions set created_by = null where workflow = 'tutoring_referral'$q$),
    'is not changed');
  perform pg_temp.says('and so still cannot publish it', pg_temp.publish(admin, 'tutoring_referral'), 'does not publish it');
  perform pg_temp.counted('their name is still on the draft',
    (select count(*) from public.workflow_versions where workflow = 'tutoring_referral' and created_by = admin), 1);
  perform pg_temp.counted('discarding it', pg_temp.touched(admin, $q$delete from public.workflow_versions where workflow = 'tutoring_referral'$q$), 1);

  -- ── editing a draft makes you its drafter ─────────────────────────────
  -- Whoever last changed what a draft says is the person who wrote it. An
  -- account holding both capabilities (an administrator) that rewrote someone
  -- else's draft used to leave the original name on it, and then publish it: a
  -- second person who had reviewed nothing of what they wrote.
  perform pg_temp.runs_clean('an editor drafts a workflow', pg_temp.draft(editor, 'advisor_approval', pg_temp.valid_def()));
  perform pg_temp.counted('the editor is its drafter',
    (select count(*) from public.workflow_versions where workflow = 'advisor_approval' and created_by = editor), 1);
  perform pg_temp.runs_clean('an admin (both capabilities) rewrites the editor''s draft',
    pg_temp.error_as(admin, $q$update public.workflow_versions set note = 'rewritten by the admin' where workflow = 'advisor_approval'$q$));
  perform pg_temp.counted('the rewrite makes the admin its drafter',
    (select count(*) from public.workflow_versions where workflow = 'advisor_approval' and created_by = admin), 1);
  perform pg_temp.says('so the admin cannot publish what they wrote',
    pg_temp.publish(admin, 'advisor_approval'), 'does not publish it');
  perform pg_temp.runs_clean('saving the same content again is not authorship',
    pg_temp.error_as(editor2, $q$update public.workflow_versions set note = note where workflow = 'advisor_approval'$q$));
  perform pg_temp.counted('the admin is still its drafter',
    (select count(*) from public.workflow_versions where workflow = 'advisor_approval' and created_by = admin), 1);
  perform pg_temp.runs_clean('a change of note alone is a change of what the draft says',
    pg_temp.error_as(editor2, $q$update public.workflow_versions set note = 'reviewed differently' where workflow = 'advisor_approval'$q$));
  perform pg_temp.counted('and makes editor2 its drafter',
    (select count(*) from public.workflow_versions where workflow = 'advisor_approval' and created_by = editor2), 1);
  perform pg_temp.counted('the draft is discarded', pg_temp.touched(editor2, $q$delete from public.workflow_versions where workflow = 'advisor_approval'$q$), 1);

  -- ── the audit trail ────────────────────────────────────────────────────
  perform pg_temp.counted('a publish is recorded, draft to published, three times',
    (select count(*) from public.tenant_policy_audit_event e
      where e.tenant_id = 'wf-u' and e.entity_type = 'workflow_versions' and e.action = 'update'
        and e.old_data ->> 'state' = 'draft' and e.new_data ->> 'state' = 'published'
        and e.actor_grant_id is not null), 3);
  perform pg_temp.counted('and each discard is recorded, the editor’s, the admin’s and the authorship test’s',
    (select count(*) from public.tenant_policy_audit_event e
      where e.tenant_id = 'wf-u' and e.entity_type = 'workflow_versions' and e.action = 'delete'), 3);

  -- ── the trigger is a lock of its own, behind row-level security ────────
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
  begin
    update public.workflow_versions set note = 'x' where workflow = 'registration_clearance' and version = 1;
    raise exception 'FAILED: the owner edited a published version';
  exception when others then
    perform pg_temp.says('even the table''s owner cannot edit a published version', sqlerrm, 'is not edited');
  end;

  -- ── an account goes; the school's workflow stays ───────────────────────
  gone := publisher;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = gone;
  perform pg_temp.counted('the versions stay with the school', (select count(*) from public.workflow_versions where tenant_id = 'wf-u'), 3);
  perform pg_temp.counted('no longer naming who published the first two',
    (select count(*) from public.workflow_versions where workflow = 'registration_clearance' and version in (1, 2) and published_by is null), 2);
end $$;

reset role;
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  perform count(*) from public.workflow_versions;
  raise exception 'FAILED: anon read the workflows';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read a school''s workflows';
end $$;
reset role;

rollback;
