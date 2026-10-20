-- supabase/workspace-objects.check.sql — who may make, save, read and share a
-- workspace object, that a saved version never changes, and that a grant
-- pinned to one version never reaches the live object.
--
-- For 20261022120000_workspace_objects.sql. One school, wo-u: an owner, a
-- stranger at the same school and email domain, three grantees, an editor, and
-- a second owner whose workspace supplies the cross-workspace cases. What it
-- proves:
--
--   * the owner creates an object and gets a receipt; saves a second version;
--     reads both; the first is exactly what it was;
--   * a stranger — same school, same email domain — sees, reads, saves and
--     shares nothing: sharing is a row naming the grantee or it is nothing;
--   * nobody writes a table directly through the API, the owner included;
--   * even the table owner cannot change or delete a version, and cannot pair
--     an object with another object's version or a version with an object in
--     another workspace — the foreign keys refuse it;
--   * a save on a stale revision is 40001 and writes nothing; the same key and
--     input replays the receipt and writes nothing; the same key with other
--     input is refused;
--   * a grant pinned to version 1 reads version 1 and not the object, not its
--     current version, not a later one, and cannot be widened afterwards;
--   * a live grant reads the object and its current version and follows it;
--   * an edit grant saves; a read grant cannot; nobody but the owner shares;
--   * an expired grant and a revoked grant read nothing;
--   * every write and every non-owner read is audited, without content;
--   * the cascade an account deletion starts takes every row, versions
--     included, past the trigger that refuses any other delete.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh workspace-objects

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

-- The SQLSTATE and message a statement fails with as `who`, or null. `who`
-- null runs it as the table owner, past every grant and policy.
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

-- Refused, and for the reason named — not for some other fault a broken
-- fixture could give.
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
  owner uuid; stranger uuid; pinned uuid; live uuid; editor uuid; expired uuid; revoked uuid; other uuid;
  obj uuid; v1 uuid; v2 uuid; v3 uuid; other_obj uuid; other_v uuid;
  pin_grant uuid; live_grant uuid; gone_grant uuid;
  r jsonb; r2 jsonb; ws uuid;
  make constant text := $q$select public.workspace_object_create(%L, %L, %L, %L, %L, %L)$q$;
  save constant text := $q$select public.workspace_object_save(%L::uuid, %s, %L, %L, %L, %L, %L)$q$;
  share constant text := $q$select public.workspace_object_grant(%L::uuid, %L::uuid, %L::uuid, %L, %L, %L::timestamptz, %L)$q$;
  rd constant text := $q$select public.workspace_object_read(%L::uuid, %L::uuid)$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('wo-u', 'Workspace University', array['wo-u.example']);

  owner    := pg_temp.newuser('owner@wo-u.example', 'wo-u');
  stranger := pg_temp.newuser('stranger@wo-u.example', 'wo-u');
  pinned   := pg_temp.newuser('pinned@wo-u.example', 'wo-u');
  live     := pg_temp.newuser('live@wo-u.example', 'wo-u');
  editor   := pg_temp.newuser('editor@wo-u.example', 'wo-u');
  expired  := pg_temp.newuser('expired@wo-u.example', 'wo-u');
  revoked  := pg_temp.newuser('revoked@wo-u.example', 'wo-u');
  other    := pg_temp.newuser('other@wo-u.example', 'wo-u');

  -- ── The owner makes and saves ─────────────────────────────────────────

  perform pg_temp.counted('a new account owns no workspace yet', (select count(*) from public.workspaces where owner_id = owner), 0);
  perform pg_temp.said('and reads as untouched', public.lti_account_untouched(owner)::text, 'true');

  r := pg_temp.ask(owner, format(make, 'document', 'Essay on Hume', 'First draft.', 'text/plain', 'semester.text/1', 'wo-create-0001'));
  obj := (r->>'object')::uuid; v1 := (r->>'version')::uuid;
  perform pg_temp.said('creating answers version 1', r->>'version_number', '1');
  perform pg_temp.said('at revision 1', r->>'revision', '1');
  perform pg_temp.said('with the SHA-256 of the body', r->>'content_sha256', encode(sha256(convert_to('First draft.', 'UTF8')), 'hex'));
  perform pg_temp.said('and its byte length', r->>'byte_length', '12');
  perform pg_temp.counted('the first object made the personal workspace', (select count(*) from public.workspaces where owner_id = owner), 1);
  perform pg_temp.said('and the account is no longer untouched', public.lti_account_untouched(owner)::text, 'false');

  r := pg_temp.ask(owner, format(save, obj, 1, 'Essay on Hume', 'Second draft — longer.', 'text/plain', 'semester.text/1', 'wo-save-0001'));
  v2 := (r->>'version')::uuid;
  perform pg_temp.said('saving at revision 1 answers version 2', r->>'version_number', '2');
  perform pg_temp.said('and moves the object to revision 2', (select revision::text from public.workspace_objects where id = obj), '2');
  perform pg_temp.said('whose current version is the new one', (select current_version_id::text from public.workspace_objects where id = obj), v2::text);
  perform pg_temp.said('version 1 still holds exactly what it held',
    (select body || '|' || content_sha256 from public.workspace_object_versions where id = v1),
    'First draft.|' || encode(sha256(convert_to('First draft.', 'UTF8')), 'hex'));

  perform pg_temp.counted('the owner sees the object', pg_temp.seen(owner, 'select * from public.workspace_objects'), 1);
  perform pg_temp.counted('and both versions', pg_temp.seen(owner, 'select * from public.workspace_object_versions'), 2);
  perform pg_temp.said('reading with no version gives the current one', pg_temp.ask(owner, format(rd, obj, null))->>'body', 'Second draft — longer.');
  perform pg_temp.said('and naming version 1 gives version 1', pg_temp.ask(owner, format(rd, obj, v1))->>'body', 'First draft.');
  perform pg_temp.counted('the owner lists one object', jsonb_array_length(pg_temp.ask(owner, 'select public.workspace_objects_mine()')), 1);

  -- ── Stale, replayed, and reused keys ──────────────────────────────────

  perform pg_temp.refused('saving on revision 1 after it moved to 2', owner,
    format(save, obj, 1, 'Essay on Hume', 'A rival edit.', 'text/plain', 'semester.text/1', 'wo-save-stale'),
    '40001 semester: this changed since you read it');
  perform pg_temp.counted('and the stale save wrote no version', (select count(*) from public.workspace_object_versions where object_id = obj), 2);
  perform pg_temp.said('nor moved the revision', (select revision::text from public.workspace_objects where id = obj), '2');
  perform pg_temp.counted('nor spent its key', (select count(*) from public.workspace_object_operations where idempotency_key = 'wo-save-stale'), 0);

  r2 := pg_temp.ask(owner, format(save, obj, 1, 'Essay on Hume', 'Second draft — longer.', 'text/plain', 'semester.text/1', 'wo-save-0001'));
  perform pg_temp.said('the same key and input answers the first receipt', r2::text, r::text);
  perform pg_temp.counted('and writes nothing', (select count(*) from public.workspace_object_versions where object_id = obj), 2);
  perform pg_temp.refused('the same key with other content', owner,
    format(save, obj, 1, 'Essay on Hume', 'Something else.', 'text/plain', 'semester.text/1', 'wo-save-0001'),
    '23505 semester: that idempotency key was already used for a different request');
  perform pg_temp.refused('the same create key with another title', owner,
    format(make, 'document', 'Another title', 'First draft.', 'text/plain', 'semester.text/1', 'wo-create-0001'),
    'already used for a different request');
  perform pg_temp.refused('JSON that is not JSON', owner,
    format(make, 'document', 'Blocks', '{not json', 'application/json', 'semester.document/1', 'wo-create-badjson'),
    'that is not JSON');
  perform pg_temp.refused('a version over 1 MiB', owner,
    format(make, 'document', 'Huge', repeat('x', 1048577), 'text/plain', 'semester.text/1', 'wo-create-huge'),
    'at most 1 MiB');

  -- ── A stranger, at the same school and on the same domain ─────────────

  perform pg_temp.counted('a stranger at the same school sees no object', pg_temp.seen(stranger, 'select * from public.workspace_objects'), 0);
  perform pg_temp.counted('nor any version', pg_temp.seen(stranger, 'select * from public.workspace_object_versions'), 0);
  perform pg_temp.counted('nor the workspace', pg_temp.seen(stranger, 'select * from public.workspaces'), 0);
  perform pg_temp.refused('a stranger reading it', stranger, format(rd, obj, null), '42501 semester: no such object here');
  perform pg_temp.refused('a stranger reading a named version', stranger, format(rd, obj, v1), 'no such object here');
  perform pg_temp.refused('a stranger saving it', stranger,
    format(save, obj, 2, 'Mine now', 'x', 'text/plain', 'semester.text/1', 'wo-stranger-save'), 'no such object here');
  perform pg_temp.refused('a stranger sharing it with themselves', stranger,
    format(share, obj, null, stranger, 'read', 'curious', null, 'wo-stranger-grant'), 'no such object here');
  perform pg_temp.counted('a stranger lists nothing', jsonb_array_length(pg_temp.ask(stranger, 'select public.workspace_objects_mine()')), 0);

  -- ── Nobody writes the tables directly ─────────────────────────────────

  perform pg_temp.refused('the owner inserting a version directly', owner,
    format($q$insert into public.workspace_object_versions (workspace_id, object_id, version_number, title, body, mime_type, content_schema, byte_length, content_sha256)
              select workspace_id, id, 9, 'x', '', 'text/plain', 'semester.text/1', 0, encode(sha256(''::bytea), 'hex') from public.workspace_objects where id = %L$q$, obj),
    'permission denied');
  perform pg_temp.refused('the owner updating a version directly', owner,
    format('update public.workspace_object_versions set body = %L where id = %L', 'rewritten', v1), 'permission denied');
  perform pg_temp.refused('the owner deleting a version directly', owner,
    format('delete from public.workspace_object_versions where id = %L', v1), 'permission denied');
  perform pg_temp.refused('the owner moving the revision directly', owner,
    format('update public.workspace_objects set revision = 99 where id = %L', obj), 'permission denied');
  perform pg_temp.refused('the owner writing a grant directly', owner,
    format($q$insert into public.workspace_object_grants (workspace_id, object_id, grantee, permission, purpose)
              select workspace_id, id, %L, 'read', 'x' from public.workspace_objects where id = %L$q$, stranger, obj),
    'permission denied');
  perform pg_temp.refused('the owner reading the ledger', owner, 'select * from public.workspace_object_operations', 'permission denied');

  -- ── Versions never change, even for the table owner ───────────────────

  perform pg_temp.refused('rewriting version 1 as the table owner', null,
    format('update public.workspace_object_versions set body = %L, byte_length = 9, content_sha256 = %L where id = %L',
           'rewritten', encode(sha256(convert_to('rewritten', 'UTF8')), 'hex'), v1),
    'a saved version never changes');
  perform pg_temp.refused('renumbering version 1 as the table owner', null,
    format('update public.workspace_object_versions set version_number = 7 where id = %L', v1), 'a saved version never changes');
  perform pg_temp.refused('deleting version 1 as the table owner', null,
    format('delete from public.workspace_object_versions where id = %L', v1), 'a saved version is never deleted');
  perform pg_temp.refused('a body whose hash does not match', null,
    format($q$insert into public.workspace_object_versions (workspace_id, object_id, version_number, title, body, mime_type, content_schema, byte_length, content_sha256)
              select workspace_id, id, 50, 'x', 'abc', 'text/plain', 'semester.text/1', 3, %L from public.workspace_objects where id = %L$q$,
           repeat('0', 64), obj),
    'violates check constraint');

  -- ── Tenant-safe references ────────────────────────────────────────────

  r := pg_temp.ask(other, format(make, 'note', 'Someone else''s note', 'Theirs.', 'text/plain', 'semester.text/1', 'wo-create-other'));
  other_obj := (r->>'object')::uuid; other_v := (r->>'version')::uuid;

  perform pg_temp.works('pointing an object at its own earlier version, as the table owner', null,
    format('update public.workspace_objects set current_version_id = %L where id = %L', v1, obj));
  perform pg_temp.refused('pointing an object at another object''s version', null,
    format('update public.workspace_objects set current_version_id = %L where id = %L', other_v, obj),
    'workspace_objects_current_version_is_its_own');
  update public.workspace_objects set current_version_id = v2 where id = obj;

  perform pg_temp.refused('a version claiming an object in another workspace', null,
    format($q$insert into public.workspace_object_versions (workspace_id, object_id, version_number, title, body, mime_type, content_schema, byte_length, content_sha256)
              values ((select workspace_id from public.workspace_objects where id = %L), %L, 9, 'x', '', 'text/plain', 'semester.text/1', 0, %L)$q$,
           other_obj, obj, encode(sha256(''::bytea), 'hex')),
    'violates foreign key constraint');
  perform pg_temp.refused('a grant pairing this object with another object''s version', null,
    format($q$insert into public.workspace_object_grants (workspace_id, object_id, version_id, grantee, permission, purpose)
              select workspace_id, id, %L, %L, 'read', 'x' from public.workspace_objects where id = %L$q$, other_v, pinned, obj),
    'violates foreign key constraint');
  perform pg_temp.refused('sharing another object''s version through the function', owner,
    format(share, obj, other_v, pinned, 'read', 'review', null, 'wo-grant-crossed'), 'that is not a version of this object');

  -- ── A grant pinned to version 1 ───────────────────────────────────────

  perform pg_temp.refused('the pinned grantee before any grant', pinned, format(rd, obj, v1), 'no such object here');
  perform pg_temp.refused('a pinned grant to edit', owner,
    format(share, obj, v1, pinned, 'edit', 'review', null, 'wo-grant-pin-edit'), 'can only be shared to read or comment');
  r := pg_temp.ask(owner, format(share, obj, v1, pinned, 'read', 'Show my tutor the first draft', null, 'wo-grant-pin'));
  pin_grant := (r->>'grant')::uuid;
  perform pg_temp.said('the pinned grant names version 1', r->>'version', v1::text);
  perform pg_temp.said('the pinned grantee reads version 1', pg_temp.ask(pinned, format(rd, obj, v1))->>'body', 'First draft.');
  perform pg_temp.said('and is told nothing of the live revision', pg_temp.ask(pinned, format(rd, obj, v1))->>'revision', null);
  perform pg_temp.refused('the pinned grantee reading the live object', pinned, format(rd, obj, null), 'no such object here');
  perform pg_temp.refused('the pinned grantee reading the current version by id', pinned, format(rd, obj, v2), 'no such object here');
  perform pg_temp.counted('the pinned grantee sees no object row', pg_temp.seen(pinned, 'select * from public.workspace_objects'), 0);
  perform pg_temp.counted('and exactly one version', pg_temp.seen(pinned, 'select * from public.workspace_object_versions'), 1);
  perform pg_temp.said('which is version 1', (pg_temp.ask(pinned, 'select to_jsonb(v.id) from public.workspace_object_versions v'))#>>'{}', v1::text);
  perform pg_temp.counted('and their own grant', pg_temp.seen(pinned, 'select * from public.workspace_object_grants'), 1);

  r := pg_temp.ask(owner, format(save, obj, 2, 'Essay on Hume (final)', 'Third draft.', 'text/plain', 'semester.text/1', 'wo-save-0002'));
  v3 := (r->>'version')::uuid;
  perform pg_temp.refused('the pinned grantee reading a version saved later', pinned, format(rd, obj, v3), 'no such object here');
  perform pg_temp.said('and still reads version 1 under its old title', pg_temp.ask(pinned, format(rd, obj, v1))->>'title', 'Essay on Hume');

  perform pg_temp.refused('widening the pinned grant to the live object, as the table owner', null,
    format('update public.workspace_object_grants set version_id = null where id = %L', pin_grant), 'only ever revoked');
  perform pg_temp.refused('moving the pinned grant to a later version', null,
    format('update public.workspace_object_grants set version_id = %L where id = %L', v3, pin_grant), 'only ever revoked');
  perform pg_temp.refused('raising its permission', null,
    format('update public.workspace_object_grants set permission = %L where id = %L', 'comment', pin_grant), 'only ever revoked');

  -- ── A live grant ──────────────────────────────────────────────────────

  r := pg_temp.ask(owner, format(share, obj, null, live, 'read', 'Study partner', null, 'wo-grant-live'));
  live_grant := (r->>'grant')::uuid;
  perform pg_temp.said('a live grantee reads the current version', pg_temp.ask(live, format(rd, obj, null))->>'body', 'Third draft.');
  perform pg_temp.said('and sees the live revision', pg_temp.ask(live, format(rd, obj, null))->>'revision', '3');
  perform pg_temp.counted('and the object row', pg_temp.seen(live, 'select * from public.workspace_objects'), 1);
  perform pg_temp.counted('and only the current version', pg_temp.seen(live, 'select * from public.workspace_object_versions'), 1);
  perform pg_temp.refused('a live grantee reading an earlier version', live, format(rd, obj, v1), 'no such object here');
  perform pg_temp.refused('a read grantee saving', live,
    format(save, obj, 3, 'Essay on Hume (final)', 'My edit.', 'text/plain', 'semester.text/1', 'wo-live-save'),
    'you can read this but not change it');
  perform pg_temp.counted('the live grantee lists none of their own', jsonb_array_length(pg_temp.ask(live, 'select public.workspace_objects_mine()')), 0);

  -- ── An edit grant ─────────────────────────────────────────────────────

  perform pg_temp.ask(owner, format(share, obj, null, editor, 'edit', 'Co-author', null, 'wo-grant-edit'));
  r := pg_temp.ask(editor, format(save, obj, 3, 'Essay on Hume (final)', 'Fourth draft, by the editor.', 'text/plain', 'semester.text/1', 'wo-edit-save'));
  perform pg_temp.said('an edit grantee saves version 4', r->>'version_number', '4');
  perform pg_temp.said('which the live grantee now reads', pg_temp.ask(live, format(rd, obj, null))->>'body', 'Fourth draft, by the editor.');
  perform pg_temp.said('and is recorded as the editor''s', (select created_by::text from public.workspace_object_versions where id = (r->>'version')::uuid), editor::text);

  -- ── Only the owner shares ─────────────────────────────────────────────

  perform pg_temp.refused('a read grantee sharing onward', live,
    format(share, obj, null, stranger, 'read', 'pass it on', null, 'wo-live-grant'), 'only the owner can share this');
  perform pg_temp.refused('an edit grantee sharing onward', editor,
    format(share, obj, null, stranger, 'read', 'pass it on', null, 'wo-edit-grant'), 'only the owner can share this');
  perform pg_temp.refused('a pinned grantee sharing their version onward', pinned,
    format(share, obj, v1, stranger, 'read', 'pass it on', null, 'wo-pin-grant'), 'no such object here');
  perform pg_temp.refused('a grantee revoking another grant', live,
    format('select public.workspace_object_revoke(%L)', pin_grant), 'no such grant here');
  perform pg_temp.refused('sharing with yourself', owner,
    format(share, obj, null, owner, 'read', 'me', null, 'wo-grant-self'), 'you already have this');
  perform pg_temp.refused('an expiry already past', owner,
    format(share, obj, null, expired, 'read', 'late', now() - interval '1 minute', 'wo-grant-past'), 'already passed');

  -- ── Expired and revoked grants ────────────────────────────────────────

  insert into public.workspace_object_grants (workspace_id, object_id, grantee, granted_by, permission, purpose, expires_at, created_at)
  select workspace_id, id, expired, owner, 'read', 'Last week''s review', now() - interval '1 day', now() - interval '8 days'
    from public.workspace_objects where id = obj;
  perform pg_temp.refused('an expired grant reading the object', expired, format(rd, obj, null), 'no such object here');
  perform pg_temp.counted('and it shows them no object', pg_temp.seen(expired, 'select * from public.workspace_objects'), 0);
  perform pg_temp.counted('nor any version', pg_temp.seen(expired, 'select * from public.workspace_object_versions'), 0);

  r := pg_temp.ask(owner, format(share, obj, null, revoked, 'read', 'For one evening', now() + interval '1 day', 'wo-grant-revoke'));
  gone_grant := (r->>'grant')::uuid;
  perform pg_temp.said('an unexpired grant reads, before it is revoked', pg_temp.ask(revoked, format(rd, obj, null))->>'version_number', '4');
  r := pg_temp.ask(owner, format('select public.workspace_object_revoke(%L)', gone_grant));
  perform pg_temp.refused('a revoked grant reading the object', revoked, format(rd, obj, null), 'no such object here');
  perform pg_temp.counted('and it shows them no object', pg_temp.seen(revoked, 'select * from public.workspace_objects'), 0);
  r2 := pg_temp.ask(owner, format('select public.workspace_object_revoke(%L)', gone_grant));
  perform pg_temp.said('revoking again answers the first revocation', r2::text, r::text);
  perform pg_temp.refused('un-revoking a grant, as the table owner', null,
    format('update public.workspace_object_grants set revoked_at = null where id = %L', gone_grant), 'only ever revoked');

  -- ── Audit ─────────────────────────────────────────────────────────────

  -- Two creates (owner, other), three saves (owner twice, the editor once),
  -- four grants made through the function, one revocation, and seven reads
  -- by grantees that answered.
  perform pg_temp.counted('creates audited', (select count(*) from public.audit_event where action = 'workspace_object.created' and occurred_at = now()), 2);
  perform pg_temp.counted('saves audited', (select count(*) from public.audit_event where action = 'workspace_object.version_saved' and occurred_at = now()), 3);
  perform pg_temp.counted('grants audited', (select count(*) from public.audit_event where action = 'workspace_object.shared' and occurred_at = now()), 4);
  perform pg_temp.counted('one revocation audited, not two', (select count(*) from public.audit_event where action = 'workspace_object.share_revoked' and occurred_at = now()), 1);
  perform pg_temp.counted('non-owner reads audited, owner reads not',
    (select count(*) from public.audit_event where action = 'workspace_object.read' and occurred_at = now()), 7);
  perform pg_temp.counted('no audit row names the object in the clear',
    (select count(*) from public.audit_event where action like 'workspace_object.%'
        and (object_sha256 = obj::text or detail::text like '%' || obj::text || '%' or detail::text like '%draft%')), 0);
  perform pg_temp.counted('and the ledger holds no content',
    (select count(*) from public.workspace_object_operations where request::text like '%draft%' or request::text like '%Hume%'), 0);

  -- ── Account deletion's cascade takes it all ───────────────────────────

  -- The auth delete clears `created_by` on versions an account saved
  -- elsewhere and cascades its workspace. Both halves, separately: Postgres
  -- rechecks a foreign key on an updated row that this same transaction
  -- inserted, so one `delete from auth.users` here trips over rows that in
  -- production were always written in an earlier transaction. (Run across two
  -- transactions by hand on 2026-10-20: the auth delete removed all of it.)
  perform pg_temp.works('clearing who saved a version, as an account deletion does', null,
    format('update public.workspace_object_versions set created_by = null where created_by = %L', editor));
  perform pg_temp.refused('but not naming somebody else instead', null,
    format('update public.workspace_object_versions set created_by = %L where id = %L', stranger, v1), 'a saved version never changes');
  ws := (select workspace_id from public.workspace_objects where id = obj);
  delete from public.workspaces where owner_id = owner;
  perform pg_temp.counted('deleting the owner takes the workspace', (select count(*) from public.workspaces where id = ws), 0);
  perform pg_temp.counted('its objects', (select count(*) from public.workspace_objects where workspace_id = ws), 0);
  perform pg_temp.counted('their versions, past the immutability trigger', (select count(*) from public.workspace_object_versions where workspace_id = ws), 0);
  perform pg_temp.counted('their grants', (select count(*) from public.workspace_object_grants where workspace_id = ws), 0);
  perform pg_temp.counted('and the ledger', (select count(*) from public.workspace_object_operations where workspace_id = ws), 0);
  perform pg_temp.counted('and leaves the other owner''s versions', (select count(*) from public.workspace_object_versions where object_id = other_obj), 1);
end $$;

rollback;
