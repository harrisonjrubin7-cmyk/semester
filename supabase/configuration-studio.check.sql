-- The Configuration Studio (D-1011): who may draft and who may publish a
-- school's configuration, that whoever drafted it does not publish it, that a
-- published version is never edited or deleted, that every write is held to
-- the closed spec (unknown keys, wrong types and out-of-range values are
-- refused), that reporting can raise the platform's n = 10 floor and never
-- lower it, and that deleting an account leaves the school's configuration
-- standing. Every refusal is attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh configuration-studio

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

-- Save a draft (insert), as someone. Returns the error, or null.
create or replace function pg_temp.draft(who uuid, dom text, settings text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'insert into public.school_config_versions (tenant_id, domain, settings) values (''cs-u'', %L, %L::jsonb)', dom, settings));
end $$;

-- Publish a school's draft for a domain, as someone. Returns the error, or null.
create or replace function pg_temp.publish(who uuid, dom text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'update public.school_config_versions set state = ''published'' where tenant_id = ''cs-u'' and domain = %L and state = ''draft''', dom));
end $$;

-- A problem list as one string, empty when there is none.
create or replace function pg_temp.problems(dom text, s text)
returns text language sql as $$
  select coalesce(array_to_string(private.config_problems(dom, s::jsonb), ','), '');
$$;

do $$
declare
  editor uuid; editor2 uuid; publisher uuid; admin uuid; researcher uuid; student uuid; far_editor uuid;
  gone uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('cs-u', 'Configuration University', array['cs-u.example']),
    ('cs-other', 'Other University', array['cs-other.example']);

  editor     := pg_temp.newuser('editor@cs-u.example', 'cs-u');
  editor2    := pg_temp.newuser('editor2@cs-u.example', 'cs-u');
  publisher  := pg_temp.newuser('registrar@cs-u.example', 'cs-u');
  admin      := pg_temp.newuser('admin@cs-u.example', 'cs-u');
  researcher := pg_temp.newuser('ir@cs-u.example', 'cs-u');
  student    := pg_temp.newuser('student@cs-u.example', 'cs-u');
  far_editor := pg_temp.newuser('editor@cs-other.example', 'cs-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (editor,     'implementation_manager',   'school', 'cs-u',     'institution'),
    (editor2,    'integration_admin',        'school', 'cs-u',     'institution'),
    (publisher,  'registrar',                'school', 'cs-u',     'institution'),
    (admin,      'university_admin',         'school', 'cs-u',     'institution'),
    (researcher, 'institutional_researcher', 'school', 'cs-u',     'institution'),
    (student,    'student',                  'school', 'cs-u',     'institution'),
    (far_editor, 'implementation_manager',   'school', 'cs-other', 'institution');

  -- ── the spec ───────────────────────────────────────────────────────────
  perform pg_temp.counted('the spec names the eleven domains the brief lists',
    (select count(*) from jsonb_object_keys(private.config_spec())), 11);
  perform pg_temp.says('a valid domain with valid settings has no problems',
    'ok' || pg_temp.problems('workflows', '{"approval_sla_days": 5, "advisor_approval_required": true}'), 'ok');
  perform pg_temp.counted('exactly none',
    length(pg_temp.problems('workflows', '{"approval_sla_days": 5, "advisor_approval_required": true}')), 0);
  perform pg_temp.says('an unknown domain is a problem', pg_temp.problems('payroll', '{}'), 'unknown_domain');
  perform pg_temp.says('so is an unknown key', pg_temp.problems('workflows', '{"secret_key": 1}'), 'unknown_key:secret_key');
  perform pg_temp.says('a number out of range', pg_temp.problems('workflows', '{"approval_sla_days": 61}'), 'bad_value:approval_sla_days');
  perform pg_temp.says('a number under range', pg_temp.problems('workflows', '{"approval_sla_days": 0}'), 'bad_value:approval_sla_days');
  perform pg_temp.says('a string where a number goes', pg_temp.problems('workflows', '{"approval_sla_days": "5"}'), 'bad_value:approval_sla_days');
  perform pg_temp.says('a fraction where an integer goes', pg_temp.problems('workflows', '{"approval_sla_days": 5.5}'), 'bad_value:approval_sla_days');
  perform pg_temp.says('a number where a boolean goes', pg_temp.problems('workflows', '{"advisor_approval_required": 1}'), 'bad_value:advisor_approval_required');
  perform pg_temp.says('a word outside an enum', pg_temp.problems('academic_structure', '{"grading_scale": "vibes"}'), 'bad_value:grading_scale');
  perform pg_temp.says('a set with a stranger in it', pg_temp.problems('roles', '{"enabled_roles": ["student", "superuser"]}'), 'bad_value:enabled_roles');
  perform pg_temp.says('a set with a repeat', pg_temp.problems('roles', '{"enabled_roles": ["student", "student"]}'), 'bad_value:enabled_roles');
  perform pg_temp.says('an empty set', pg_temp.problems('roles', '{"enabled_roles": []}'), 'bad_value:enabled_roles');
  perform pg_temp.says('a set that is not an array', pg_temp.problems('roles', '{"enabled_roles": "student"}'), 'bad_value:enabled_roles');
  perform pg_temp.says('a colour that is not a colour', pg_temp.problems('branding', '{"accent_color": "red"}'), 'bad_value:accent_color');
  perform pg_temp.says('a run of card digits in a typed field',
    pg_temp.problems('branding', '{"display_name": "Pay 4111 1111 1111 1111"}'), 'bad_value:display_name');
  perform pg_temp.says('a blank name', pg_temp.problems('branding', '{"display_name": "   "}'), 'bad_value:display_name');
  perform pg_temp.says('the reporting floor cannot be lowered below the platform''s n = 10',
    pg_temp.problems('reporting', '{"min_cohort_size": 9}'), 'bad_value:min_cohort_size');
  perform pg_temp.counted('and can be raised', length(pg_temp.problems('reporting', '{"min_cohort_size": 25}')), 0);
  perform pg_temp.says('settings must be an object', pg_temp.problems('workflows', '[1]'), 'not_object');

  -- ── who may draft and see ──────────────────────────────────────────────
  perform pg_temp.runs_clean('an editor drafts', pg_temp.draft(editor, 'workflows', '{"approval_sla_days": 5}'));
  perform pg_temp.says('a registrar cannot draft', pg_temp.draft(publisher, 'ai', '{"ai_enabled": true}'), 'row-level security');
  perform pg_temp.says('nor a student', pg_temp.draft(student, 'ai', '{"ai_enabled": true}'), 'row-level security');
  perform pg_temp.says('nor an editor at another school',
    pg_temp.error_as(far_editor, $q$insert into public.school_config_versions (tenant_id, domain, settings) values ('cs-u', 'ai', '{}')$q$),
    'row-level security');
  perform pg_temp.says('a domain has one draft', pg_temp.draft(editor2, 'workflows', '{"approval_sla_days": 3}'), 'duplicate key');
  perform pg_temp.says('a draft with an unknown key is refused by the database',
    pg_temp.draft(editor, 'ai', '{"model_key": "sk-abc"}'), 'unknown_key:model_key');
  perform pg_temp.counted('the draft is stamped a draft with no version and its author',
    (select count(*) from public.school_config_versions where domain = 'workflows' and state = 'draft' and version is null and created_by = editor), 1);
  perform pg_temp.counted('the publisher reads it', pg_temp.seen(publisher, 'select * from public.school_config_versions'), 1);
  perform pg_temp.counted('the researcher reads it', pg_temp.seen(researcher, 'select * from public.school_config_versions'), 1);
  perform pg_temp.counted('a student reads none', pg_temp.seen(student, 'select * from public.school_config_versions'), 0);
  perform pg_temp.counted('an editor elsewhere reads none', pg_temp.seen(far_editor, 'select * from public.school_config_versions'), 0);
  perform pg_temp.counted('a draft is saved again by its author',
    pg_temp.touched(editor, $q$update public.school_config_versions set settings = '{"approval_sla_days": 4}'::jsonb where domain = 'workflows'$q$), 1);
  perform pg_temp.counted('the researcher cannot change one',
    pg_temp.touched(researcher, $q$update public.school_config_versions set note = 'x' where domain = 'workflows'$q$), 0);
  perform pg_temp.says('a draft does not change school',
    pg_temp.error_as(editor, $q$update public.school_config_versions set tenant_id = 'cs-other' where domain = 'workflows'$q$), 'stays with its school');
  perform pg_temp.says('an editor cannot publish, drafting or not',
    pg_temp.error_as(editor, $q$update public.school_config_versions set state = 'published' where domain = 'workflows'$q$), 'cannot publish');

  perform pg_temp.says('a publisher without the drafting role cannot rewrite a draft they are to review',
    pg_temp.error_as(publisher, $q$update public.school_config_versions set settings = '{"approval_sla_days": 60}'::jsonb where domain = 'workflows'$q$),
    'cannot change a draft');

  -- ── publishing ─────────────────────────────────────────────────────────
  perform pg_temp.says('an editor without the capability cannot publish another editor''s draft',
    pg_temp.publish(editor2, 'workflows'), 'cannot publish');
  perform pg_temp.says('a publisher cannot change the draft in the same breath',
    pg_temp.error_as(publisher, $q$update public.school_config_versions set state = 'published', settings = '{"approval_sla_days": 60}'::jsonb where domain = 'workflows'$q$),
    'published as it was reviewed');
  perform pg_temp.runs_clean('the registrar publishes it', pg_temp.publish(publisher, 'workflows'));
  perform pg_temp.counted('it is version 1, stamped by the publisher',
    (select count(*) from public.school_config_versions where domain = 'workflows' and state = 'published' and version = 1 and published_by = publisher), 1);
  perform pg_temp.counted('and the draft is gone into it',
    (select count(*) from public.school_config_versions where domain = 'workflows' and state = 'draft'), 0);
  perform pg_temp.counted('a published version is not edited',
    pg_temp.touched(editor, $q$update public.school_config_versions set settings = '{}'::jsonb where domain = 'workflows'$q$), 0);
  perform pg_temp.counted('not even by the publisher',
    pg_temp.touched(publisher, $q$update public.school_config_versions set note = 'x' where domain = 'workflows'$q$), 0);
  perform pg_temp.counted('nor deleted by an editor',
    pg_temp.touched(editor, $q$delete from public.school_config_versions where domain = 'workflows'$q$), 0);
  perform pg_temp.counted('nor by an admin',
    pg_temp.touched(admin, $q$delete from public.school_config_versions where domain = 'workflows'$q$), 0);

  -- ── the second-person rule, on a holder of both capabilities ───────────
  perform pg_temp.runs_clean('an admin (who holds both capabilities) drafts a change',
    pg_temp.error_as(admin, $q$insert into public.school_config_versions (tenant_id, domain, settings, based_on, note)
      values ('cs-u', 'workflows', '{"approval_sla_days": 10}', 1, 'slower')$q$));
  perform pg_temp.says('and does not publish their own draft',
    pg_temp.publish(admin, 'workflows'), 'does not publish it');
  perform pg_temp.runs_clean('the registrar publishes it', pg_temp.publish(publisher, 'workflows'));
  perform pg_temp.counted('as version 2', (select count(*) from public.school_config_versions where domain = 'workflows' and version = 2), 1);

  -- ── a rollback ─────────────────────────────────────────────────────────
  perform pg_temp.says('a draft cannot be based on a version that does not exist',
    pg_temp.error_as(editor, $q$insert into public.school_config_versions (tenant_id, domain, settings, based_on)
      values ('cs-u', 'workflows', '{}', 9)$q$), 'no published version 9');
  perform pg_temp.runs_clean('a rollback is a draft copied from version 1',
    pg_temp.error_as(editor, $q$insert into public.school_config_versions (tenant_id, domain, settings, based_on, note)
      values ('cs-u', 'workflows', '{"approval_sla_days": 4}', 1, 'back to version 1')$q$));
  perform pg_temp.runs_clean('and is published by the admin as version 3', pg_temp.publish(admin, 'workflows'));
  perform pg_temp.counted('history holds all three',
    (select count(*) from public.school_config_versions where domain = 'workflows' and state = 'published'), 3);
  perform pg_temp.counted('the current settings are version 3''s',
    (select count(*) from public.school_config_versions where domain = 'workflows'
        and version = (select max(version) from public.school_config_versions where domain = 'workflows')
        and settings = '{"approval_sla_days": 4}'::jsonb), 1);

  -- ── a draft is discarded by an editor, not a researcher ────────────────
  perform pg_temp.runs_clean('a second domain drafted', pg_temp.draft(editor, 'reporting', '{"min_cohort_size": 20}'));
  perform pg_temp.counted('a researcher cannot discard it',
    pg_temp.touched(researcher, $q$delete from public.school_config_versions where domain = 'reporting'$q$), 0);
  perform pg_temp.counted('an editor can', pg_temp.touched(editor, $q$delete from public.school_config_versions where domain = 'reporting'$q$), 1);

  -- ── a client cannot pass itself off as an account deletion ─────────────
  perform pg_temp.runs_clean('an editor drafts another domain to try it on', pg_temp.draft(admin, 'ai', '{"ai_enabled": true}'));
  perform pg_temp.says('a drafter cannot clear their own name from a draft, to then publish it',
    pg_temp.error_as(admin, $q$update public.school_config_versions set created_by = null where domain = 'ai'$q$),
    'is not changed');
  perform pg_temp.says('and so still cannot publish it', pg_temp.publish(admin, 'ai'), 'does not publish it');
  perform pg_temp.counted('their name is still on the draft',
    (select count(*) from public.school_config_versions where domain = 'ai' and created_by = admin), 1);
  perform pg_temp.counted('discarding it', pg_temp.touched(admin, $q$delete from public.school_config_versions where domain = 'ai'$q$), 1);

  -- ── editing a draft makes you its drafter ─────────────────────────────
  -- Whoever last changed what a draft says is the person who wrote it. An
  -- account holding both capabilities (an administrator) that rewrote someone
  -- else's draft used to leave the original name on it, and then publish it: a
  -- second person who had reviewed nothing of what they wrote.
  perform pg_temp.runs_clean('an editor drafts a domain', pg_temp.draft(editor, 'reporting', '{"min_cohort_size": 20}'));
  perform pg_temp.counted('the editor is its drafter',
    (select count(*) from public.school_config_versions where domain = 'reporting' and created_by = editor), 1);
  perform pg_temp.runs_clean('an admin (both capabilities) rewrites the editor''s draft',
    pg_temp.error_as(admin, $q$update public.school_config_versions set settings = '{"min_cohort_size": 25}'::jsonb where domain = 'reporting'$q$));
  perform pg_temp.counted('the rewrite makes the admin its drafter',
    (select count(*) from public.school_config_versions where domain = 'reporting' and created_by = admin), 1);
  perform pg_temp.says('so the admin cannot publish what they wrote',
    pg_temp.publish(admin, 'reporting'), 'does not publish it');
  perform pg_temp.runs_clean('saving the same content again is not authorship',
    pg_temp.error_as(editor2, $q$update public.school_config_versions set note = note where domain = 'reporting'$q$));
  perform pg_temp.counted('the admin is still its drafter',
    (select count(*) from public.school_config_versions where domain = 'reporting' and created_by = admin), 1);
  perform pg_temp.runs_clean('a change of note alone is a change of what the draft says',
    pg_temp.error_as(editor2, $q$update public.school_config_versions set note = 'reviewed differently' where domain = 'reporting'$q$));
  perform pg_temp.counted('and makes the editor2 its drafter',
    (select count(*) from public.school_config_versions where domain = 'reporting' and created_by = editor2), 1);
  perform pg_temp.counted('the draft is discarded', pg_temp.touched(editor, $q$delete from public.school_config_versions where domain = 'reporting'$q$), 1);

  -- ── the audit trail ────────────────────────────────────────────────────
  perform pg_temp.counted('a publish is recorded, draft to published, three times',
    (select count(*) from public.tenant_policy_audit_event e
      where e.tenant_id = 'cs-u' and e.entity_type = 'school_config_versions' and e.action = 'update'
        and e.old_data ->> 'state' = 'draft' and e.new_data ->> 'state' = 'published'
        and e.actor_grant_id is not null), 3);
  perform pg_temp.counted('and each discard is recorded, the editor’s, the admin’s and the authorship test’s',
    (select count(*) from public.tenant_policy_audit_event e
      where e.tenant_id = 'cs-u' and e.entity_type = 'school_config_versions' and e.action = 'delete'), 3);

  -- ── the trigger is a lock of its own, behind row-level security ────────
  -- The table's owner is not subject to the policies; the trigger still holds.
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
  begin
    update public.school_config_versions set settings = '{}'::jsonb where domain = 'workflows' and version = 1;
    raise exception 'FAILED: the owner edited a published version';
  exception when others then
    perform pg_temp.says('even the table''s owner cannot edit a published version', sqlerrm, 'is not edited');
  end;

  -- ── an account goes; the school's configuration stays ──────────────────
  gone := publisher;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = gone;
  perform pg_temp.counted('the versions stay with the school', (select count(*) from public.school_config_versions where tenant_id = 'cs-u'), 3);
  perform pg_temp.counted('no longer naming who published the first two',
    (select count(*) from public.school_config_versions where domain = 'workflows' and version in (1, 2) and published_by is null), 2);
end $$;

reset role;
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  perform count(*) from public.school_config_versions;
  raise exception 'FAILED: anon read the configuration';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read a school''s configuration';
end $$;
reset role;

rollback;
