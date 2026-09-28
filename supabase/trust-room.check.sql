-- The procurement room: an NDA-gated, expiring, logged link to exact versions
-- of the trust packet. LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
--   supabase/check.sh trust-room
--
-- Every refusal names the error it expects (see gtm.check.sql for why).
--
-- What this covers, each as the account it is about:
--
--   * Nobody signed out can call anything here, and nobody signed in can call
--     the opener; the token's hash is off the column grant.
--   * Only a trust officer publishes a version; a version is never edited, is
--     reviewed after it is published, and points into the private bucket.
--   * Only the account team grants. A grant answers an open request, needs a
--     signed NDA for any NDA-tier item, lasts one to thirty days, names a full
--     commit, refuses a version past its review date, and refuses everything
--     while kill.sharing is engaged.
--   * The token is returned once and stored only as its hash.
--   * A link opens exactly the versions it was granted — not a newer one
--     published later, not an artifact outside it — and every open is logged.
--     A wrong, revoked or expired token opens nothing and says nothing.
--   * The institution's configurers read their own room; another school's
--     do not; a grant is revoked, never edited.

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

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.run(who uuid, statement text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  if who is null then execute 'set local role postgres'; else perform pg_temp.become(who); end if;
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.refused_with(what text, who uuid, statement text, pattern text)
returns void language plpgsql as $$
declare msg text;
begin
  begin
    if who is null then execute 'set local role postgres'; else perform pg_temp.become(who); end if;
    execute statement;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg ~* pattern then
      raise notice 'ok  % is refused', what;
      return;
    end if;
    raise exception 'FAILED: % — refused, but for the wrong reason: %', what, msg;
  end;
  raise exception 'FAILED: % — was allowed', what;
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

-- What the server function sees: it runs with the service key.
create or replace function pg_temp.opened(token text, artifact text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'set local role service_role';
  select count(*) into n from public.trust_room_open(token, artifact);
  execute 'reset role';
  return n;
end $$;

-- ── The outer lock ────────────────────────────────────────────────────────

do $$
declare f text;
begin
  foreach f in array array['public.trust_room_grant(uuid, text[], text, integer)',
                           'public.trust_room_revoke(uuid, text)', 'public.trust_room_open(text, text)'] loop
    perform pg_temp.said('a signed-out visitor cannot call ' || f,
      has_function_privilege('anon', f, 'execute')::text, 'false');
  end loop;
  perform pg_temp.said('a signed-in account cannot call the opener',
    has_function_privilege('authenticated', 'public.trust_room_open(text, text)', 'execute')::text, 'false');
  perform pg_temp.said('the service key can',
    has_function_privilege('service_role', 'public.trust_room_open(text, text)', 'execute')::text, 'true');
  perform pg_temp.said('the token hash is off the column grant',
    has_column_privilege('authenticated', 'public.trust_room_grants', 'token_sha256', 'select')::text, 'false');
  perform pg_temp.said('the column beside it is on it (the control)',
    has_column_privilege('authenticated', 'public.trust_room_grants', 'packet_commit', 'select')::text, 'true');
  perform pg_temp.said('nobody signed in inserts a grant directly',
    has_table_privilege('authenticated', 'public.trust_room_grants', 'insert')::text, 'false');
end $$;

-- ── The room ──────────────────────────────────────────────────────────────

create temporary table ids (name text primary key, id uuid, token text) on commit drop;

do $$
declare
  sales uuid; officer uuid; admin uuid; other_admin uuid; student uuid;
  acct uuid; req uuid; token text; token2 text; g uuid; n bigint;
  commit_sha constant text := 'e5fc11d979a962275044cc91393c6186c6b65285';
begin
  insert into public.schools (id, name, email_domains) values
    ('room-u', 'Room University', array['room-u.example']),
    ('room-other', 'Other University', array['room-other.example']);
  sales       := pg_temp.newuser('sales@semester.example', 'room-other');
  officer     := pg_temp.newuser('trust@semester.example', 'room-other');
  admin       := pg_temp.newuser('admin@room-u.example', 'room-u');
  other_admin := pg_temp.newuser('admin@room-other.example', 'room-other');
  student     := pg_temp.newuser('student@room-u.example', 'room-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (sales,       'account_executive', 'platform', '',          'institution'),
    (officer,     'trust_officer',     'platform', '',          'institution'),
    (admin,       'university_admin',  'school',   'room-u',    'institution'),
    (other_admin, 'university_admin',  'school',   'room-other','institution');

  -- The packet --------------------------------------------------------------
  perform pg_temp.refused_with('the account team publishing a version', sales,
    $q$insert into public.trust_artifacts (key, title, tier, owner) values ('hecvat', 'HECVAT readiness register', 'nda', 'Security lead')$q$,
    'row-level security');
  perform pg_temp.run(officer, $q$insert into public.trust_artifacts (key, title, tier, owner) values
    ('hecvat', 'HECVAT readiness register', 'nda', 'Security lead'),
    ('privacy-disclosure', 'Privacy disclosure', 'public', 'Privacy lead'),
    ('architecture', 'Architecture, data flows and retention', 'nda', 'Engineering lead')$q$);
  perform pg_temp.refused_with('a version reviewed before it is published', officer,
    $q$insert into public.trust_artifact_versions (artifact_key, version, storage_ref, published_on, review_on)
       values ('hecvat', '1.0', 'trust-packet/hecvat/hecvat-1.0.pdf', current_date, current_date - 1)$q$,
    'trust_version_reviewed_later');
  perform pg_temp.refused_with('a version that points at a URL rather than the bucket', officer,
    $q$insert into public.trust_artifact_versions (artifact_key, version, storage_ref, review_on)
       values ('hecvat', '1.0', 'https://example.com/hecvat.pdf', current_date + 90)$q$,
    'storage_ref_check');
  perform pg_temp.run(officer, format($q$insert into public.trust_artifact_versions
    (artifact_key, version, storage_ref, source_commit, review_on) values
    ('hecvat', '1.0', 'trust-packet/hecvat/hecvat-1.0.pdf', %L, current_date + 90),
    ('privacy-disclosure', '2026-09', 'trust-packet/privacy-disclosure/2026-09.pdf', %L, current_date + 90)$q$,
    commit_sha, commit_sha));
  -- Published last year and not reviewed since.
  perform pg_temp.run(officer, $q$insert into public.trust_artifact_versions
    (artifact_key, version, storage_ref, published_on, review_on) values
    ('architecture', '0.9', 'trust-packet/architecture/arch-0.9.pdf', current_date - 400, current_date - 35)$q$);
  perform pg_temp.refused_with('a published version edited', null,
    $q$update public.trust_artifact_versions set storage_ref = 'trust-packet/hecvat/other.pdf' where artifact_key = 'hecvat'$q$,
    'append-only');

  -- The request -------------------------------------------------------------
  perform pg_temp.run(sales, $q$insert into public.gtm_accounts (name, segment) values ('Room University', 'research')$q$);
  select id into acct from public.gtm_accounts where name = 'Room University';
  perform pg_temp.run(sales, format($q$insert into public.trust_room_requests
    (account_id, requester_name, requester_email, requester_role, reason)
    values (%L, 'Pat Reviewer', 'pat@room-u.example', 'ciso_privacy', 'Security review for the pilot')$q$, acct));
  select id into req from public.trust_room_requests where account_id = acct;
  perform pg_temp.refused_with('a request marked granted with no grant', sales,
    format($q$update public.trust_room_requests set status = 'granted' where id = %L$q$, req), 'by minting a grant');

  -- Minting: every refusal -------------------------------------------------
  perform pg_temp.refused_with('a student minting a grant', student,
    format($q$select public.trust_room_grant(%L, '{hecvat}', %L, 7)$q$, req, commit_sha), 'account team');
  perform pg_temp.refused_with('the institution''s own admin minting one', admin,
    format($q$select public.trust_room_grant(%L, '{hecvat}', %L, 7)$q$, req, commit_sha), 'account team');
  perform pg_temp.refused_with('an NDA-tier item with no NDA on file', sales,
    format($q$select public.trust_room_grant(%L, '{hecvat}', %L, 7)$q$, req, commit_sha), 'no signed NDA');
  perform pg_temp.refused_with('a thirty-one day grant', sales,
    format($q$select public.trust_room_grant(%L, '{privacy-disclosure}', %L, 31)$q$, req, commit_sha), 'one to thirty days');
  perform pg_temp.refused_with('a grant naming a short commit', sales,
    format($q$select public.trust_room_grant(%L, '{privacy-disclosure}', 'e5fc11d', 7)$q$, req), 'full commit');
  perform pg_temp.refused_with('a grant for an artifact that does not exist', sales,
    format($q$select public.trust_room_grant(%L, '{soc2}', %L, 7)$q$, req, commit_sha), 'No artifact soc2');
  perform pg_temp.run(sales, format($q$update public.trust_room_requests
    set nda_signed_on = current_date, nda_reference = 'nda/room-u/2026-09-27.pdf' where id = %L$q$, req));
  perform pg_temp.refused_with('a version past its review date', sales,
    format($q$select public.trust_room_grant(%L, '{hecvat,architecture}', %L, 7)$q$, req, commit_sha), 'due for review');
  select count(*) into n from public.trust_room_grants;
  perform pg_temp.counted('and a refused mint leaves no grant behind', n, 0);

  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values (null, 'kill.sharing', true, 'check');
  perform pg_temp.refused_with('minting while kill.sharing is engaged', sales,
    format($q$select public.trust_room_grant(%L, '{hecvat}', %L, 7)$q$, req, commit_sha), 'kill.sharing');
  update public.feature_kill_switch set engaged = false, reason = '' where tenant_id is null and switch_key = 'kill.sharing';

  -- Minting: success -------------------------------------------------------
  perform pg_temp.become(sales);
  token := public.trust_room_grant(req, array['hecvat', 'privacy-disclosure'], commit_sha, 7);
  execute 'reset role';
  perform pg_temp.said('the token is 64 hex characters', (token ~ '^[0-9a-f]{64}$')::text, 'true');
  select id into g from public.trust_room_grants where request_id = req;
  perform pg_temp.counted('the token itself is stored nowhere',
    (select count(*) from public.trust_room_grants where token_sha256 = token), 0);
  perform pg_temp.counted('only its hash',
    (select count(*) from public.trust_room_grants where token_sha256 = private.trust_token_hash(token)), 1);
  perform pg_temp.said('the request is now granted',
    (select status from public.trust_room_requests where id = req), 'granted');
  perform pg_temp.refused_with('a second grant on the same request', sales,
    format($q$select public.trust_room_grant(%L, '{hecvat}', %L, 7)$q$, req, commit_sha), 'This request is granted');
  insert into ids values ('g', g, token), ('acct', acct, null), ('sales', sales, null), ('officer', officer, null),
    ('admin', admin, null), ('other_admin', other_admin, null), ('student', student, null);
end $$;

-- ── Opening ───────────────────────────────────────────────────────────────

do $$
declare
  token text := (select token from ids where name = 'g');
  g uuid := (select id from ids where name = 'g');
  officer uuid := (select id from ids where name = 'officer');
  sales uuid := (select id from ids where name = 'sales');
  admin uuid := (select id from ids where name = 'admin');
  other_admin uuid := (select id from ids where name = 'other_admin');
  student uuid := (select id from ids where name = 'student');
  v text;
  wrong text := repeat('0', 64);
begin
  perform pg_temp.counted('the link lists the two artifacts it covers', pg_temp.opened(token, null), 2);
  perform pg_temp.counted('and opens the HECVAT register', pg_temp.opened(token, 'hecvat'), 1);
  perform pg_temp.counted('but not an artifact it does not cover', pg_temp.opened(token, 'architecture'), 0);
  perform pg_temp.counted('a wrong token opens nothing', pg_temp.opened(wrong, 'hecvat'), 0);
  perform pg_temp.counted('nor does a malformed one', pg_temp.opened('hecvat', 'hecvat'), 0);

  -- A newer version, published after the grant, is not what the link opens.
  perform pg_temp.run(officer, $q$insert into public.trust_artifact_versions
    (artifact_key, version, storage_ref, review_on) values ('hecvat', '1.1', 'trust-packet/hecvat/hecvat-1.1.pdf', current_date + 90)$q$);
  execute 'set local role service_role';
  select o.version into v from public.trust_room_open(token, 'hecvat') o;
  execute 'reset role';
  perform pg_temp.said('a version published later does not replace the one granted', v, '1.0');

  perform pg_temp.counted('every open that found something is logged, and nothing else',
    (select count(*) from public.trust_room_access_log where grant_id = g), 3);
  perform pg_temp.counted('the list is logged as a list',
    (select count(*) from public.trust_room_access_log where grant_id = g and version_id is null), 1);

  -- Who can see the room -----------------------------------------------------
  perform pg_temp.counted('before the account is linked to the school, its admin sees no request',
    pg_temp.seen(admin, 'select 1 from public.trust_room_requests'), 0);
  perform pg_temp.run(sales, format($q$update public.gtm_accounts set tenant_id = 'room-u' where id = %L$q$,
    (select id from ids where name = 'acct')));
  perform pg_temp.counted('after, they see who asked', pg_temp.seen(admin, 'select 1 from public.trust_room_requests'), 1);
  perform pg_temp.counted('what was granted', pg_temp.seen(admin, 'select 1 from public.trust_room_grant_items'), 2);
  perform pg_temp.counted('and every open', pg_temp.seen(admin, 'select 1 from public.trust_room_access_log'), 3);
  perform pg_temp.counted('another school''s admin sees none of it',
    pg_temp.seen(other_admin, 'select 1 from public.trust_room_access_log'), 0);
  perform pg_temp.counted('nor does a student', pg_temp.seen(student, 'select 1 from public.trust_room_requests'), 0);
  perform pg_temp.refused_with('reading the token hash', admin,
    'select token_sha256 from public.trust_room_grants', 'permission denied');

  -- Revoked, and expired -------------------------------------------------------
  perform pg_temp.refused_with('a grant edited to last longer', null,
    format($q$update public.trust_room_grants set expires_at = expires_at + interval '1 day' where id = %L$q$, g), 'not edited');
  perform pg_temp.refused_with('revoking with no reason', sales,
    format($q$select public.trust_room_revoke(%L, ' ')$q$, g), 'trust_room_grants_revoke_reason_check');
  perform pg_temp.refused_with('the institution''s admin revoking', admin,
    format($q$select public.trust_room_revoke(%L, 'x')$q$, g), 'account team');
  perform pg_temp.run(sales, format($q$select public.trust_room_revoke(%L, 'Reviewer left the institution')$q$, g));
  perform pg_temp.counted('a revoked link opens nothing', pg_temp.opened(token, 'hecvat'), 0);
  perform pg_temp.refused_with('revoking twice', sales,
    format($q$select public.trust_room_revoke(%L, 'again')$q$, g), 'No live grant');
end $$;

do $$
declare
  sales uuid := (select id from ids where name = 'sales');
  acct uuid := (select id from ids where name = 'acct');
  req uuid; token text; g uuid;
begin
  perform pg_temp.run(sales, format($q$insert into public.trust_room_requests
    (account_id, requester_name, requester_email, requester_role, nda_signed_on, nda_reference)
    values (%L, 'Sam Procurement', 'sam@room-u.example', 'procurement', current_date, 'nda/room-u/2026-09-27.pdf')$q$, acct));
  select id into req from public.trust_room_requests where requester_name = 'Sam Procurement';
  perform pg_temp.become(sales);
  token := public.trust_room_grant(req, array['privacy-disclosure'], 'e5fc11d979a962275044cc91393c6186c6b65285', 1);
  execute 'reset role';
  select id into g from public.trust_room_grants where request_id = req;
  perform pg_temp.counted('a fresh grant opens', pg_temp.opened(token, 'privacy-disclosure'), 1);

  -- Expiry, by moving the grant into the past (the guard refuses edits, so
  -- this goes around it the way only a superuser could).
  alter table public.trust_room_grants disable trigger trust_grant_guard;
  update public.trust_room_grants set granted_at = now() - interval '3 days', expires_at = now() - interval '2 days' where id = g;
  alter table public.trust_room_grants enable trigger trust_grant_guard;
  perform pg_temp.counted('an expired one does not', pg_temp.opened(token, 'privacy-disclosure'), 0);

  -- The global switch stops opening, too.
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values (null, 'kill.sharing', true, 'check')
  on conflict (coalesce(tenant_id, ''), switch_key) do update set engaged = true, reason = 'check';
  alter table public.trust_room_grants disable trigger trust_grant_guard;
  update public.trust_room_grants set granted_at = now(), expires_at = now() + interval '1 day' where id = g;
  alter table public.trust_room_grants enable trigger trust_grant_guard;
  perform pg_temp.counted('and kill.sharing stops a live one', pg_temp.opened(token, 'privacy-disclosure'), 0);
  update public.feature_kill_switch set engaged = false, reason = '' where tenant_id is null and switch_key = 'kill.sharing';
  perform pg_temp.counted('which opens again once it is released (the control)', pg_temp.opened(token, 'privacy-disclosure'), 1);
end $$;

-- ── The bucket ───────────────────────────────────────────────────────────
--
-- local.stub.sql stands in for the storage schema, so the migration made the
-- bucket. Then a bucket of the same name left public by hand, which must come
-- out private again.

do $$
declare b record;
begin
  perform pg_temp.counted('the migration made the bucket, private',
    (select count(*) from storage.buckets where id = 'trust-packet' and not public), 1);
  update storage.buckets set public = true, file_size_limit = null, allowed_mime_types = null
   where id = 'trust-packet';
  perform private.trust_packet_bucket_ensure();
  select * into b from storage.buckets where id = 'trust-packet';
  perform pg_temp.said('a public bucket of that name is made private', b.public::text, 'false');
  perform pg_temp.said('files are capped at 25 MB', b.file_size_limit::text, '26214400');
  perform pg_temp.said('and only documents may be stored',
    (b.allowed_mime_types = array['application/pdf', 'text/markdown', 'text/csv', 'text/plain'])::text, 'true');
  delete from storage.buckets where id = 'trust-packet';
  perform private.trust_packet_bucket_ensure();
  perform private.trust_packet_bucket_ensure();
  perform pg_temp.counted('with it gone it creates exactly one, and running it twice changes nothing',
    (select count(*) from storage.buckets where id = 'trust-packet' and not public), 1);
  perform pg_temp.said('nobody signed in or out can call it',
    (has_function_privilege('anon', 'private.trust_packet_bucket_ensure()', 'execute')
     or has_function_privilege('authenticated', 'private.trust_packet_bucket_ensure()', 'execute'))::text, 'false');
end $$;

-- ── The trust officer and the account team can still delete their accounts ─

do $$
declare who text;
begin
  foreach who in array array['officer', 'sales'] loop
    begin
      delete from auth.users where id = (select id from ids where name = who);
      raise notice 'ok  % can delete their account', who;
    exception when others then
      raise exception 'FAILED: deleting % was refused: %', who, sqlerrm;
    end;
  end loop;
  perform pg_temp.said('the published versions stay, unattributed',
    (select count(*)::text from public.trust_artifact_versions where published_by is null), '4');
  perform pg_temp.said('and so do the grants, revoked one included',
    (select count(*)::text from public.trust_room_grants where granted_by is null), '2');
end $$;

rollback;
