-- Roster import staging: staged not written, manifest-checked, held on a large
-- removal, idempotent, reversible, per school, and closed to every client.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is rolled back.

begin;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.hash(ent text, sid text, payload jsonb)
returns text language sql as $$
  select encode(sha256(convert_to(ent || ':' || sid || ':' || payload::text, 'UTF8')), 'hex')
$$;

-- A roster as a producer would build it: rows, then a manifest that digests them.
-- `users` are the ids present; `tag` changes every user's name so a batch can differ.
create or replace function pg_temp.roster(users int[], tag text default 'a')
returns jsonb language plpgsql as $$
declare
  rows jsonb := '[]'::jsonb;
  u int;
  files jsonb := '[]'::jsonb;
  ent text;
  digest text;
  n int;
begin
  rows := rows || jsonb_build_object('entity', 'orgs', 'sourcedId', 'org1', 'payload', jsonb_build_object('name', 'Main', 'type', 'school', 'status', 'active'));
  foreach u in array users loop
    rows := rows || jsonb_build_object('entity', 'users', 'sourcedId', 'u' || u,
      'payload', jsonb_build_object('status', 'active', 'role', 'student', 'givenName', tag || u, 'familyName', 'X', 'orgSourcedIds', jsonb_build_array('org1')));
    rows := rows || jsonb_build_object('entity', 'enrollments', 'sourcedId', 'e' || u,
      'payload', jsonb_build_object('userSourcedId', 'u' || u, 'classSourcedId', 'c1', 'role', 'student', 'status', 'active'));
  end loop;
  rows := rows || jsonb_build_object('entity', 'classes', 'sourcedId', 'c1', 'payload', jsonb_build_object('title', 'Econ', 'courseCode', 'ECON1', 'status', 'active'));
  rows := rows || jsonb_build_object('entity', 'classes', 'sourcedId', 'c2', 'payload', jsonb_build_object('title', 'Bus', 'courseCode', 'BUS1', 'status', 'active'));
  foreach ent in array array['orgs', 'users', 'classes', 'enrollments'] loop
    select count(*), encode(sha256(convert_to(coalesce(string_agg(pg_temp.hash(r ->> 'entity', r ->> 'sourcedId', r -> 'payload'), E'\n'
             order by pg_temp.hash(r ->> 'entity', r ->> 'sourcedId', r -> 'payload')), ''), 'UTF8')), 'hex')
      into n, digest from jsonb_array_elements(rows) r where r ->> 'entity' = ent;
    files := files || jsonb_build_object('entity', ent, 'rows', n, 'sha256', digest);
  end loop;
  return jsonb_build_object('manifest', jsonb_build_object('files', files, 'tag', tag, 'users', to_jsonb(users)), 'rows', rows);
end $$;

create or replace function pg_temp.stage(tenant text, r jsonb, by uuid default null)
returns uuid language sql as $$
  select private.roster_stage(tenant, 'csv', r -> 'manifest', r -> 'rows', by)
$$;

create or replace function pg_temp.live(tenant text)
returns bigint language sql as $$ select count(*) from private.roster_current where tenant_id = tenant $$;

do $$
declare
  stager uuid; approver uuid;
  b1 uuid; b1_again uuid; b2 uuid; b3 uuid; bad uuid; nb uuid; bcross uuid; b4 uuid;
  r jsonb;
  st text;
  before_rows bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-roster', 'North Roster University', array['north-roster.example']),
    ('cedar-roster', 'Cedar Roster College', array['cedar-roster.example']);
  stager := pg_temp.newuser('stager@north-roster.example');
  approver := pg_temp.newuser('approver@north-roster.example');

  -- ── The control: a good roster flows through ───────────────────────────
  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10]);
  b1 := pg_temp.stage('north-roster', r, stager);
  perform pg_temp.answered('CONTROL: a good batch stages as staged', (select status from private.roster_import_batch where id = b1), 'staged');
  perform pg_temp.answered('staged, not written: the live roster is still empty', pg_temp.live('north-roster')::text, '0');
  perform pg_temp.answered('CONTROL: it validates', private.roster_validate(b1), 'validated');
  perform pg_temp.answered('validated, still not written', pg_temp.live('north-roster')::text, '0');
  perform pg_temp.answered('CONTROL: the first roster promotes with nothing to remove', private.roster_promote(b1), 'promoted');
  perform pg_temp.answered('the live roster is the batch (1 org, 10 users, 2 classes, 10 enrollments)', pg_temp.live('north-roster')::text, '23');

  -- ── Idempotency ────────────────────────────────────────────────────────
  before_rows := (select count(*) from private.roster_staged_row);
  b1_again := pg_temp.stage('north-roster', r, stager);
  perform pg_temp.answered('the same manifest returns the first batch', (b1_again = b1)::text, 'true');
  perform pg_temp.answered('and stages nothing again', ((select count(*) from private.roster_staged_row) = before_rows)::text, 'true');
  perform pg_temp.answered('promoting a promoted batch does nothing', private.roster_promote(b1), 'already-promoted');
  perform pg_temp.answered('validating a promoted batch does not change it', private.roster_validate(b1), 'promoted');

  -- ── The closed row shape ───────────────────────────────────────────────
  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10], 'bad');
  r := jsonb_set(r, '{rows,1,payload}', (r #> '{rows,1,payload}') || '{"email":"x@y.example"}');
  bad := pg_temp.stage('north-roster', r);
  perform pg_temp.answered('a key outside the allowlist rejects the batch', (select status from private.roster_import_batch where id = bad), 'rejected');
  perform pg_temp.answered('and the problem names the key', ((select problems::text from private.roster_import_batch where id = bad) like '%email%')::text, 'true');
  perform pg_temp.answered('a rejected batch cannot be promoted', pg_temp.refused(format('select private.roster_promote(%L)', bad))::text, 'true');
  perform pg_temp.answered('the live roster is untouched', pg_temp.live('north-roster')::text, '23');

  -- ── The manifest ───────────────────────────────────────────────────────
  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10], 'count');
  r := jsonb_set(r, '{manifest,files,1,rows}', '999');
  bad := pg_temp.stage('north-roster', r);
  perform pg_temp.answered('a row count that differs from the manifest is rejected', private.roster_validate(bad), 'rejected');

  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10], 'digest');
  r := jsonb_set(r, '{manifest,files,1,sha256}', to_jsonb(repeat('0', 64)));
  bad := pg_temp.stage('north-roster', r);
  perform pg_temp.answered('a content digest that differs from the manifest is rejected', private.roster_validate(bad), 'rejected');

  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10], 'unlisted');
  r := jsonb_set(r, '{manifest,files}', (r #> '{manifest,files}') - 3);
  bad := pg_temp.stage('north-roster', r);
  perform pg_temp.answered('rows for an entity the manifest does not list are rejected', private.roster_validate(bad), 'rejected');

  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10], 'orphan');
  r := jsonb_set(r, '{rows}', (select jsonb_agg(x) from jsonb_array_elements(r -> 'rows') x where x ->> 'sourcedId' <> 'u3'));
  -- rebuild the manifest so counts and digests agree: only the orphan rule can reject it
  bad := pg_temp.stage('north-roster', jsonb_build_object(
    'manifest', (pg_temp.roster(array[1,2,4,5,6,7,8,9,10], 'orphan') -> 'manifest') || '{"orphan": true}',
    'rows', (r -> 'rows')));
  perform pg_temp.answered('a manifest that does not describe the rows is rejected', private.roster_validate(bad), 'rejected');

  -- an enrollment for a user who is not in the batch, with an honest manifest
  r := pg_temp.roster(array[1,2,3,4,5,6,7,8,9,10], 'orphan2');
  r := jsonb_set(r, '{rows}', (r -> 'rows') || jsonb_build_object('entity', 'enrollments', 'sourcedId', 'e99',
        'payload', jsonb_build_object('userSourcedId', 'u99', 'classSourcedId', 'c1', 'role', 'student', 'status', 'active')));
  r := jsonb_build_object('manifest', (
        select jsonb_build_object('files', jsonb_agg(jsonb_build_object('entity', ent, 'rows', n,
                 'sha256', encode(sha256(convert_to(coalesce(h, ''), 'UTF8')), 'hex'))), 'tag', 'orphan2')
          from (select ent, count(*) n, string_agg(pg_temp.hash(ent, sid, pl), E'\n' order by pg_temp.hash(ent, sid, pl)) h
                  from (select x ->> 'entity' ent, x ->> 'sourcedId' sid, x -> 'payload' pl from jsonb_array_elements(r -> 'rows') x) q
                 group by ent) g),
        'rows', r -> 'rows');
  bad := pg_temp.stage('north-roster', r);
  perform pg_temp.answered('an enrollment naming a user outside the batch is rejected', private.roster_validate(bad), 'rejected');
  perform pg_temp.answered('and the problem says which rule', ((select problems::text from private.roster_import_batch where id = bad) like '%not in the batch%')::text, 'true');

  -- ── The delta threshold ────────────────────────────────────────────────
  -- Dropping three users drops their three enrollments too: 6 of 23 rows, 26%.
  r := pg_temp.roster(array[1,2,3,4,5,6,7], 'a');
  b2 := pg_temp.stage('north-roster', r, stager);
  perform pg_temp.answered('a large removal validates', private.roster_validate(b2), 'validated');
  perform pg_temp.answered('and is held, not promoted', private.roster_promote(b2), 'held');
  perform pg_temp.answered('the live roster is unchanged while held', pg_temp.live('north-roster')::text, '23');
  perform pg_temp.answered('the hold says why', ((select held_reason from private.roster_import_batch where id = b2) like '%26%')::text, 'true');
  perform pg_temp.answered('the reconciliation counts the removals', (private.roster_reconcile(b2) ->> 'removed'), '6');
  perform pg_temp.answered('the person who staged it cannot approve it', pg_temp.refused(format('select private.roster_promote(%L, %L)', b2, stager))::text, 'true');
  perform pg_temp.answered('still held after the refused approval', (select status from private.roster_import_batch where id = b2), 'held');
  perform pg_temp.answered('another person can approve it', private.roster_promote(b2, approver), 'promoted');
  perform pg_temp.answered('and the approver is recorded', ((select approved_by from private.roster_import_batch where id = b2) = approver)::text, 'true');
  perform pg_temp.answered('the live roster is the smaller one', pg_temp.live('north-roster')::text, '17');

  -- A small change is not held.
  r := pg_temp.roster(array[1,2,3,4,5,6,7], 'renamed');
  b3 := pg_temp.stage('north-roster', r, stager);
  perform private.roster_validate(b3);
  perform pg_temp.answered('a rename of every user removes nothing, so it promotes without an approver', private.roster_promote(b3), 'promoted');
  perform pg_temp.answered('and the report shows the changes', (private.roster_reconcile(b3) ->> 'changed'), '0');

  -- The configured limit is honoured.
  insert into private.roster_import_config (tenant_id, source_kind, max_removal_pct) values ('north-roster', 'csv', 60);
  r := pg_temp.roster(array[1,2,3], 'a');
  b4 := pg_temp.stage('north-roster', r, stager);
  perform private.roster_validate(b4);
  perform pg_temp.answered('with a 60% limit the same shape of removal promotes', private.roster_promote(b4), 'promoted');

  -- ── Rollback ───────────────────────────────────────────────────────────
  perform pg_temp.answered('an older promotion cannot be rolled back over a newer one', pg_temp.refused(format('select private.roster_rollback(%L)', b3))::text, 'true');
  perform pg_temp.answered('the newest promotion rolls back', private.roster_rollback(b4), 'rolled-back');
  perform pg_temp.answered('the last known good is back', pg_temp.live('north-roster')::text, '17');
  perform pg_temp.answered('rolling back twice does nothing', private.roster_rollback(b4), 'already-rolled-back');
  perform pg_temp.answered('restored rows point at a batch that exists (no orphan)', (select count(*) from private.roster_current c
       where not exists (select 1 from private.roster_import_batch b where b.id = c.batch_id))::text, '0');
  perform pg_temp.answered('a never-promoted batch cannot be rolled back', pg_temp.refused(format('select private.roster_rollback(%L)', bad))::text, 'true');

  -- ── Cross-tenant ───────────────────────────────────────────────────────
  -- The same sourced ids, the same manifest, another school.
  r := pg_temp.roster(array[1,2,3,4,5,6,7], 'renamed');
  bcross := pg_temp.stage('cedar-roster', r);
  perform pg_temp.answered('the same manifest under another school is a different batch', (bcross <> b3)::text, 'true');
  perform pg_temp.answered('staging for cedar left the north live roster alone', pg_temp.live('north-roster')::text, '17');
  perform pg_temp.answered('and its rows belong to cedar', (select count(*) from private.roster_staged_row where batch_id = bcross and tenant_id <> 'cedar-roster')::text, '0');
  perform private.roster_validate(bcross);
  perform pg_temp.answered('cedar reconciliation sees an empty roster, not the north one', (private.roster_reconcile(bcross) ->> 'current_rows'), '0');
  perform pg_temp.answered('the first cedar roster promotes', private.roster_promote(bcross), 'promoted');
  perform pg_temp.answered('the north roster is unchanged by it', pg_temp.live('north-roster')::text, '17');
  perform pg_temp.answered('the cedar rollback restores the cedar empty roster, not the north one', private.roster_rollback(bcross), 'rolled-back');
  perform pg_temp.answered('cedar is empty again', pg_temp.live('cedar-roster')::text, '0');
  perform pg_temp.answered('north still has its own', pg_temp.live('north-roster')::text, '17');
  perform pg_temp.answered('a batch cannot be staged for a school that does not exist', pg_temp.refused(format('select private.roster_stage(%L, %L, %L::jsonb, %L::jsonb)', 'no-such-school', 'csv', '{"files":[]}', '[]'))::text, 'true');
  perform pg_temp.answered('a live row cannot name another school''s batch', pg_temp.refused(format(
    'insert into private.roster_current (tenant_id, entity, sourced_id, payload, row_hash, batch_id) values (%L, ''users'', ''x'', ''{}'', %L, %L)',
    'cedar-roster', repeat('0', 64), b3))::text, 'true');

  -- ── A REST batch needs a configured source for this school ─────────────
  perform pg_temp.answered('a REST batch with no configured source is refused',
    pg_temp.refused(format('select private.roster_stage(%L, %L, %L::jsonb, %L::jsonb)',
      'cedar-roster', 'rest', '{"files":[]}', '[]'))::text, 'true');
  insert into private.roster_import_config (tenant_id, source_kind, credentials_reference)
    values ('cedar-roster', 'rest', 'vault:cedar/oneroster-x') on conflict (tenant_id) do update
    set source_kind = 'rest', credentials_reference = 'vault:cedar/oneroster-x';
  perform pg_temp.answered('with a REST source and a pointer for cedar, cedar can stage a REST batch',
    (private.roster_stage('cedar-roster', 'rest', '{"files":[],"via":"rest"}', '[]') is not null)::text, 'true');
  perform pg_temp.answered('but the same pointer does not let north stage one (north is configured for csv)',
    pg_temp.refused(format('select private.roster_stage(%L, %L, %L::jsonb, %L::jsonb)',
      'north-roster', 'rest', '{"files":[],"via":"rest-north"}', '[]'))::text, 'true');
  perform pg_temp.answered('a CSV batch needs no credential',
    (private.roster_stage('cedar-roster', 'csv', '{"files":[],"via":"csv"}', '[]') is not null)::text, 'true');
  delete from private.roster_import_config where tenant_id = 'cedar-roster';

  -- ── Credentials are a pointer, per school ──────────────────────────────
  perform pg_temp.answered('a raw secret is refused', pg_temp.refused($q$insert into private.roster_import_config (tenant_id, source_kind, credentials_reference) values ('cedar-roster', 'rest', 'sk_live_abcdef')$q$)::text, 'true');
  perform pg_temp.answered('a REST source with no reference is refused', pg_temp.refused($q$insert into private.roster_import_config (tenant_id, source_kind) values ('cedar-roster', 'rest')$q$)::text, 'true');
  insert into private.roster_import_config (tenant_id, source_kind, credentials_reference) values ('cedar-roster', 'rest', 'vault:cedar/oneroster');
  perform pg_temp.answered('a vault pointer is accepted', (select credentials_reference from private.roster_import_config where tenant_id = 'cedar-roster'), 'vault:cedar/oneroster');

  -- ── Legal holds ────────────────────────────────────────────────────────
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', 'north-roster', 'north-roster', 'preservation notice', 'MATTER-1', stager);

  perform pg_temp.answered('under a hold, a snapshot cannot be deleted', pg_temp.refused('delete from private.roster_snapshot where tenant_id = ''north-roster''')::text, 'true');
  perform pg_temp.answered('nor staged rows', pg_temp.refused('delete from private.roster_staged_row where tenant_id = ''north-roster''')::text, 'true');
  perform pg_temp.answered('nor a batch', pg_temp.refused('delete from private.roster_import_batch where tenant_id = ''north-roster''')::text, 'true');
  perform pg_temp.answered('the hold is on north only: cedar staged rows can still be deleted', pg_temp.refused('delete from private.roster_staged_row where tenant_id = ''cedar-roster''')::text, 'false');

  -- Promotion under a hold destroys nothing: the replaced roster is in the snapshot.
  r := pg_temp.roster(array[1,2,3,4,5,6,7], 'held');
  nb := pg_temp.stage('north-roster', r, stager);
  perform private.roster_validate(nb);
  perform pg_temp.answered('a promotion under a hold still works', private.roster_promote(nb), 'promoted');
  perform pg_temp.answered('and keeps every replaced row in the snapshot', (select count(*) from private.roster_snapshot where batch_id = nb)::text, '17');
  perform pg_temp.answered('rollback under a hold works and deletes no record', private.roster_rollback(nb), 'rolled-back');
  perform pg_temp.answered('the promoted batch is still there', (select count(*) from private.roster_staged_row where batch_id = nb)::text, '17');

  update public.legal_holds set released_by = approver, released_at = now(), release_reason = 'matter closed'
   where tenant_id = 'north-roster';
  perform pg_temp.answered('after release, the guard steps aside', pg_temp.refused('delete from private.roster_snapshot where batch_id = ''' || nb || '''')::text, 'false');

  raise notice 'roster-import: state checks passed';
end $$;

-- ── Nothing here is a client's ────────────────────────────────────────────
do $$
declare
  t text;
  f text;
  n bigint;
begin
  foreach t in array array['roster_import_config', 'roster_import_batch', 'roster_staged_row', 'roster_current', 'roster_snapshot'] loop
    perform pg_temp.answered('RLS is on for ' || t, (select relrowsecurity::text from pg_class where oid = ('private.' || t)::regclass), 'true');
    perform pg_temp.answered('no policy on ' || t, (select count(*)::text from pg_policy where polrelid = ('private.' || t)::regclass), '0');
    perform pg_temp.answered('anon has no privilege on ' || t,
      has_table_privilege('anon', 'private.' || t, 'select,insert,update,delete,truncate,references,trigger')::text, 'false');
    perform pg_temp.answered('authenticated has no privilege on ' || t,
      has_table_privilege('authenticated', 'private.' || t, 'select,insert,update,delete,truncate,references,trigger')::text, 'false');
    perform pg_temp.answered('authenticated has no column privilege on ' || t,
      has_any_column_privilege('authenticated', 'private.' || t, 'select,insert,update,references')::text, 'false');
  end loop;

  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'private' and p.proname like 'roster\_%' loop
    perform pg_temp.answered(f || ' is not executable by anon', has_function_privilege('anon', f::regprocedure, 'execute')::text, 'false');
    perform pg_temp.answered(f || ' is not executable by authenticated', has_function_privilege('authenticated', f::regprocedure, 'execute')::text, 'false');
  end loop;

  -- the worker holds the service key, so it must be able to call the entry points
  foreach f in array array['private.roster_stage(text,text,jsonb,jsonb,uuid)', 'private.roster_validate(uuid)',
                           'private.roster_reconcile(uuid)', 'private.roster_promote(uuid,uuid)', 'private.roster_rollback(uuid)'] loop
    perform pg_temp.answered(f || ' is executable by service_role', has_function_privilege('service_role', f::regprocedure, 'execute')::text, 'true');
  end loop;
  perform pg_temp.answered('service_role can reach the private schema', has_schema_privilege('service_role', 'private', 'usage')::text, 'true');

  -- the definer functions pin their search_path
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'private' and p.proname like 'roster\_%' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  perform pg_temp.answered('every roster definer function pins search_path', n::text, '0');
  raise notice 'roster-import: permission checks passed';
end $$;

-- ── Re-applying the migration over a populated schema loses nothing ───────
select count(*) as rows_before from private.roster_current \gset
select count(*) as batches_before from private.roster_import_batch \gset
select count(*) as staged_before from private.roster_staged_row \gset
\ir migrations/20260930220000_roster_import_staging.sql
select pg_temp.answered('re-applying the migration keeps the live roster', (select count(*)::text from private.roster_current), :'rows_before');
select pg_temp.answered('and keeps the batches', (select count(*)::text from private.roster_import_batch), :'batches_before');
select pg_temp.answered('and keeps the staged rows', (select count(*)::text from private.roster_staged_row), :'staged_before');

rollback;
