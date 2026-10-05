-- The operations console's control plane: preferences, seats, fresh MFA, the
-- duty matrix, the audit chain, figures with provenance, and the demo flag.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What `20260929100000_console_control_plane.sql` claims, attempted as the
-- account that should be refused, and measured rather than read:
--
--   * a preference is its owner's alone, in every verb;
--   * a seat is written by nobody but the service role, read by its holder
--     and the console, and `holds_seat` answers only for a live seat;
--   * `mfa_fresh` is true for a recent second factor in the JWT and false for
--     no second factor, a stale one, and a first factor spelled as one;
--   * the duty matrix has its eleven rows and is read only with
--     `console:operate`; `party_held` reads a seat, a role, and never a
--     student;
--   * the audit chain: the service role cannot insert directly, a signed-in
--     account cannot call the writer or read the table, the chain links and
--     the hashes recompute, updates and deletes are refused, the retention
--     sweep leaves the rows, reading logs the read, a day seals once and
--     refuses to seal differently, verification passes — and, planted
--     tampering with the trigger disabled, verification names the row and
--     the manifest;
--   * figures come with all their provenance, billing says not applicable,
--     and a demo tenant is out of the count unless asked for.
--
-- The MFA claims are set the way the harness's `auth.jwt()` reads them:
-- `local.stub.sql` reads `request.jwt.claims`, and a real project's
-- `auth.jwt()` reads the same setting from the JWT PostgREST verified.
--
--   How to run it: supabase/check.sh console-control-plane

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

/** Become `who` with the assurance level and `amr` a real session would carry. */
create or replace function pg_temp.become_mfa(who uuid, aal text, method text, verified_at timestamptz)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object(
      'sub', who::text, 'role', 'authenticated', 'aal', aal,
      'amr', json_build_array(
        json_build_object('method', 'password', 'timestamp', extract(epoch from now() - interval '2 hours')::bigint),
        json_build_object('method', method, 'timestamp', extract(epoch from verified_at)::bigint)
      ))::text, true);
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

/** The same, as a database role rather than a signed-in account. */
create or replace function pg_temp.refused_as(role_name text, statement text)
returns boolean language plpgsql as $$
begin
  execute format('set local role %I', role_name);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

/** Whether a statement raises for whoever is running the suite (postgres). */
create or replace function pg_temp.raises(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

-- ── The capabilities, and the roles that carry them ───────────────────────

do $$
declare n bigint;
begin
  select count(*) into n from public.role_capabilities where capability = 'console:operate';
  perform pg_temp.counted('six roles carry console:operate', n, 6);
  select count(*) into n from public.role_capabilities
   where capability = 'console:operate'
     and role in ('platform_admin', 'support_agent', 'implementation_manager',
                  'data_steward', 'incident_responder', 'trust_officer');
  perform pg_temp.counted('and they are the six the console names', n, 6);
  select count(*) into n from public.role_capabilities rc
   join public.app_roles r on r.role = rc.role
   where rc.capability = 'audit:read' and r.global;
  perform pg_temp.counted('audit:read stays a tenant word: no global role carries it', n, 0);
  select count(*) into n from public.role_capabilities where capability = 'approval:decide';
  perform pg_temp.counted('approval:decide is platform_admin''s alone', n, 1);
  select count(*) into n from public.role_capabilities
   where capability = 'breakglass:request' and role in ('platform_admin', 'incident_responder');
  perform pg_temp.counted('breakglass:request is platform_admin''s and incident_responder''s', n, 2);
end $$;

-- ── Everything else, as the people involved ───────────────────────────────

do $$
declare
  operator   uuid;   -- platform_admin: console:operate, approval:decide
  seatholder uuid;   -- holds the security seat, no role
  stranger   uuid;   -- a signed-in account with nothing
  student    uuid;   -- a student at the demo tenant
  demo_staff uuid;   -- university_staff at the demo tenant
  n          bigint;
  b          boolean;
  seq1       bigint;
  seq2       bigint;
  seq_read   bigint;
  seq_tamper bigint;
  r          record;
  v_ok       boolean;
  v_rows     bigint;
  v_bad      bigint;
  v_note     text;
  key_bytes  bytea;
  got        text;
  total      bigint;
  audit_rows bigint;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('console-check', 'Console Check University', array['console-check.example'], false),
    ('console-demo',  'Console Demo University',  array['console-demo.example'],  true);

  operator   := pg_temp.newuser('operator@console-check.example',   'console-check');
  seatholder := pg_temp.newuser('security@console-check.example',   'console-check');
  stranger   := pg_temp.newuser('stranger@console-check.example',   'console-check');
  student    := pg_temp.newuser('student@console-demo.example',     'console-demo');
  demo_staff := pg_temp.newuser('staff@console-demo.example',       'console-demo');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator,   'platform_admin',   'platform', '',             'platform'),
    (demo_staff, 'university_staff', 'school',   'console-demo', 'institution');

  -- ── Preferences (row 1) ─────────────────────────────────────────────────

  perform pg_temp.become(operator);
  insert into public.operator_preference (subject, key, value)
  values (operator, 'views.approvals', '{"sort":"created_at","filter":"pending"}'),
         (operator, 'nav.last-tab',    '"audit"');
  select count(*) into n from public.operator_preference;
  reset role;
  perform pg_temp.counted('an operator reads the preferences they saved', n, 2);

  perform pg_temp.become(stranger);
  select count(*) into n from public.operator_preference;
  reset role;
  perform pg_temp.counted('another account sees no preference of theirs', n, 0);

  perform pg_temp.become(stranger);
  update public.operator_preference set value = '"stolen"' where subject = operator;
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.counted('another account''s update reaches none of them', n, 0);

  perform pg_temp.become(stranger);
  delete from public.operator_preference where subject = operator;
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.counted('nor does their delete', n, 0);

  if not pg_temp.refused(stranger, format(
    'insert into public.operator_preference (subject, key, value) values (%L, %L, %L)',
    operator, 'nav.last-tab', '"planted"')) then
    raise exception 'FAILED: an account saved a preference under somebody else''s id';
  end if;
  raise notice 'ok  a preference cannot be saved under somebody else''s id';

  if not pg_temp.refused(operator, format(
    'insert into public.operator_preference (subject, key, value) values (%L, %L, %L)',
    operator, 'Not A Key!', '1')) then
    raise exception 'FAILED: a preference key outside the pattern was accepted';
  end if;
  raise notice 'ok  a preference key is held to its pattern';

  perform pg_temp.become(operator);
  update public.operator_preference set value = '"figures"', updated_at = '2000-01-01'
   where subject = operator and key = 'nav.last-tab';
  select count(*) into n from public.operator_preference
   where key = 'nav.last-tab' and value = '"figures"' and updated_at > now() - interval '1 minute';
  reset role;
  perform pg_temp.counted('an update takes the value and stamps its own time', n, 1);

  -- ── Seats (rows 3 and 4) ────────────────────────────────────────────────

  if not pg_temp.refused(seatholder, format(
    'insert into public.council_seat_holder (seat, subject) values (%L, %L)', 'security', seatholder)) then
    raise exception 'FAILED: a signed-in account gave itself a seat';
  end if;
  raise notice 'ok  a signed-in account cannot give itself a seat';

  set local role service_role;
  insert into public.council_seat_holder (seat, subject) values ('security', seatholder);
  reset role;

  perform pg_temp.become(seatholder);
  select count(*) into n from public.council_seat_holder;
  reset role;
  perform pg_temp.counted('a seat holder reads their own seat', n, 1);

  perform pg_temp.become(operator);
  select count(*) into n from public.council_seat_holder;
  reset role;
  perform pg_temp.counted('console:operate reads the seats', n, 1);

  perform pg_temp.become(stranger);
  select count(*) into n from public.council_seat_holder;
  reset role;
  perform pg_temp.counted('an account with neither reads no seat', n, 0);

  if not pg_temp.refused(seatholder, format(
    'update public.council_seat_holder set ended_at = null, seat = %L where subject = %L', 'founder', seatholder)) then
    raise exception 'FAILED: a seat holder changed their own seat';
  end if;
  raise notice 'ok  a seat holder cannot change their own row';

  perform set_config('request.jwt.claims', json_build_object('sub', seatholder::text)::text, true);
  b := private.holds_seat('security');
  if not b then raise exception 'FAILED: holds_seat is false for a live seat'; end if;
  b := private.holds_seat('founder');
  if b then raise exception 'FAILED: holds_seat is true for a seat not held'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger::text)::text, true);
  b := private.holds_seat('security');
  if b then raise exception 'FAILED: holds_seat is true for somebody else''s seat'; end if;
  raise notice 'ok  holds_seat answers for the holder, the seat, and nobody else';

  if not pg_temp.refused(seatholder, 'select private.holds_seat(''security'')') then
    raise exception 'FAILED: a signed-in account can call private.holds_seat directly';
  end if;
  raise notice 'ok  holds_seat is not callable by a signed-in account';

  -- ── Fresh MFA (row 2) ───────────────────────────────────────────────────

  perform pg_temp.become_mfa(operator, 'aal2', 'totp', now() - interval '3 minutes');
  reset role;
  if not private.mfa_fresh() then raise exception 'FAILED: a TOTP verified three minutes ago is not fresh'; end if;
  perform pg_temp.become_mfa(operator, 'aal2', 'webauthn', now() - interval '14 minutes');
  reset role;
  if not private.mfa_fresh() then raise exception 'FAILED: a WebAuthn assertion fourteen minutes ago is not fresh'; end if;
  perform pg_temp.become_mfa(operator, 'aal2', 'totp', now() - interval '16 minutes');
  reset role;
  if private.mfa_fresh() then raise exception 'FAILED: a TOTP verified sixteen minutes ago counted as fresh'; end if;
  perform pg_temp.become_mfa(operator, 'aal1', 'totp', now() - interval '1 minute');
  reset role;
  if private.mfa_fresh() then raise exception 'FAILED: aal1 counted as fresh MFA'; end if;
  perform pg_temp.become_mfa(operator, 'aal2', 'password', now());
  reset role;
  if private.mfa_fresh() then raise exception 'FAILED: a first factor in amr counted as a second'; end if;
  perform pg_temp.become(operator);
  reset role;
  if private.mfa_fresh() then raise exception 'FAILED: a session with no aal and no amr counted as fresh'; end if;
  perform pg_temp.become_mfa(operator, 'aal2', 'totp', now() - interval '40 minutes');
  reset role;
  if not private.mfa_fresh('1 hour') then raise exception 'FAILED: the window argument is ignored'; end if;
  raise notice 'ok  mfa_fresh: recent totp/webauthn on aal2 is fresh; stale, aal1, a first factor and no claims are not';

  perform pg_temp.become_mfa(operator, 'aal2', 'totp', now() - interval '1 minute');
  reset role;
  perform private.assert_fresh_mfa();
  perform pg_temp.become(operator);
  reset role;
  begin
    perform private.assert_fresh_mfa();
    raise exception 'FAILED: assert_fresh_mfa did not raise without MFA';
  exception when insufficient_privilege then
    if sqlerrm <> 'Fresh MFA required' then
      raise exception 'FAILED: assert_fresh_mfa raised the wrong message: %', sqlerrm;
    end if;
  end;
  raise notice 'ok  assert_fresh_mfa passes fresh MFA and raises insufficient_privilege "Fresh MFA required" without';

  -- ── The duty matrix (rows 3 and 4) ──────────────────────────────────────

  select count(*) into n from public.console_duty;
  perform pg_temp.counted('the duty matrix has its eleven rows', n, 11);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_duty;
  reset role;
  perform pg_temp.counted('console:operate reads all eleven', n, 11);

  perform pg_temp.become(stranger);
  select count(*) into n from public.console_duty;
  reset role;
  perform pg_temp.counted('an account without it reads none', n, 0);

  select count(*) into n from public.console_duty d
   where (d.id = 'break-glass' and d.requester = 'engineering'
          and d.approvers = array['security', 'founder'] and d.two_person)
      or (d.id = 'role-grant' and d.requester = 'role:university_admin'
          and d.approvers = array['security'] and not d.two_person)
      or (d.id = 'support-access' and d.requester = 'role:support_agent'
          and d.approvers = array['student'] and not d.two_person)
      or (d.id = 'refund' and d.requester = 'role:business_admin'
          and d.approvers = array['founder'] and not d.two_person);
  perform pg_temp.counted('the parties are spelled as console.ts spells them', n, 4);

  if not pg_temp.refused(operator, 'update public.console_duty set two_person = false where id = ''break-glass''') then
    raise exception 'FAILED: a signed-in account rewrote the duty matrix';
  end if;
  raise notice 'ok  the duty matrix cannot be rewritten through the API';

  perform set_config('request.jwt.claims', json_build_object('sub', operator::text)::text, true);
  if not private.party_held('role:platform_admin') then raise exception 'FAILED: party_held misses a live role'; end if;
  if private.party_held('role:university_admin') then raise exception 'FAILED: party_held claims a role not held'; end if;
  if private.party_held('security') then raise exception 'FAILED: party_held gives the operator a seat'; end if;
  if private.party_held('student') then raise exception 'FAILED: party_held says somebody is the student'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', seatholder::text)::text, true);
  if not private.party_held('security') then raise exception 'FAILED: party_held misses a held seat'; end if;
  if private.party_held('role:platform_admin') then raise exception 'FAILED: party_held gives the seat holder a role'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', student::text)::text, true);
  if private.party_held('student') then raise exception 'FAILED: a student is a console party'; end if;
  raise notice 'ok  party_held: a live role, a held seat, and never student';

  -- ── The audit chain (row 5): who can write ──────────────────────────────

  if not pg_temp.refused_as('service_role',
    'insert into private.console_audit_event (actor_kind, action, prev_hash, hash) '
    'values (''service'', ''direct.insert'', repeat(''0'', 64), repeat(''0'', 64))') then
    raise exception 'FAILED: the service role inserted an audit row directly, around the writer';
  end if;
  raise notice 'ok  the service role cannot insert into the audit table directly';

  if not pg_temp.refused(operator,
    format('select private.console_audit_write(%L, ''authenticated'', null, ''forged'', null, ''{}'', null)', operator)) then
    raise exception 'FAILED: a signed-in account called the audit writer';
  end if;
  raise notice 'ok  a signed-in account cannot call the audit writer';

  if not pg_temp.refused(operator, 'select count(*) from private.console_audit_event') then
    raise exception 'FAILED: a signed-in account read the audit table directly';
  end if;
  raise notice 'ok  a signed-in account cannot read the audit table directly';

  set local role service_role;
  seq1 := private.console_audit_write(null, 'service', 'console-check', 'seat.accepted',
                                      'security', jsonb_build_object('subject', seatholder), 'ticket-0001-console');
  seq2 := private.console_audit_write(operator, 'authenticated', null, 'console.opened',
                                      null, '{}'::jsonb, null);
  reset role;
  if seq2 <> seq1 + 1 then raise exception 'FAILED: seqs are not consecutive (% then %)', seq1, seq2; end if;
  raise notice 'ok  the service role writes through the writer and gets consecutive seqs';

  -- ── The chain links, and every hash recomputes ──────────────────────────

  select e.prev_hash into got from private.console_audit_event e where e.seq = seq1;
  if got <> repeat('0', 64) then raise exception 'FAILED: the first row''s prev_hash is not the zero hash'; end if;
  select count(*) into n
    from private.console_audit_event a join private.console_audit_event b on b.seq = a.seq + 1
   where a.seq = seq1 and b.prev_hash = a.hash;
  perform pg_temp.counted('the second row''s prev_hash is the first row''s hash', n, 1);

  select count(*) into n from private.console_audit_event e
   where e.hash = private.console_audit_sha256(private.console_audit_canonical(
           e.seq, e.occurred_at, e.actor, e.actor_kind, e.tenant_id,
           e.action, e.target, e.detail, e.correlation_id, e.prev_hash))
     and e.seq is not null;
  perform pg_temp.counted('every row''s hash recomputes from its canonical text, seq included', n, 2);

  if not pg_temp.raises(format('update private.console_audit_event set action = ''rewritten'' where seq = %s', seq1)) then
    raise exception 'FAILED: an audit row was updated';
  end if;
  if not pg_temp.raises(format('delete from private.console_audit_event where seq = %s', seq1)) then
    raise exception 'FAILED: an audit row was deleted';
  end if;
  raise notice 'ok  audit rows refuse update and delete, even for the owner';

  select count(*) into n from private.console_audit_event;
  perform private.sweep_audit_retention();
  select count(*) - n into n from private.console_audit_event;
  perform pg_temp.counted('the audit-retention sweep leaves the console archive alone (rows lost)', n, 0);

  -- ── Reading logs the read ───────────────────────────────────────────────

  if not pg_temp.refused(stranger, 'select * from public.console_audit_read()') then
    raise exception 'FAILED: an account without console:operate read the chain';
  end if;
  raise notice 'ok  an account without console:operate cannot read the chain';

  -- A tenant auditor holds audit:read over their school and nothing about
  -- the console; that word does not open the console's own chain.
  set local role service_role;
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (stranger, 'university_admin', 'school', 'console-check', 'institution');
  reset role;
  if not pg_temp.refused(stranger, 'select * from public.console_audit_read()') then
    raise exception 'FAILED: a tenant''s audit:read read the console chain';
  end if;
  raise notice 'ok  a tenant auditor''s audit:read does not open the console chain';

  perform pg_temp.become(operator);
  select count(*), max(seq) into n, seq_read from public.console_audit_read();
  reset role;
  perform pg_temp.counted('the operator reads the two events and the record of reading them', n, 3);
  select count(*) into n from private.console_audit_event e
   where e.seq = seq_read and e.action = 'audit.read' and e.actor = operator
     and e.actor_kind = 'authenticated' and (e.detail ->> 'limit') = '200'
     and e.detail ? 'since';
  perform pg_temp.counted('the read wrote an audit.read event naming the reader, since and limit', n, 1);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_audit_read(now() - interval '1 second', 1);
  reset role;
  perform pg_temp.counted('since and limit narrow the read (limit 1)', n, 1);

  -- ── Sealing a day, once ─────────────────────────────────────────────────

  perform private.console_audit_seal(current_date);
  select count(*) into n from private.console_audit_manifest m
   where m.batch_day = current_date and m.first_seq = seq1 and m.row_count >= 4
     and m.head_hash = (select e.hash from private.console_audit_event e order by e.seq desc limit 1);
  perform pg_temp.counted('today is sealed with its bounds, its count and the head hash', n, 1);

  select k.key into key_bytes from private.console_audit_key k;
  select count(*) into n from private.console_audit_manifest m
   where m.batch_day = current_date
     and m.signature = private.console_audit_hmac(
       private.console_audit_manifest_text(m.batch_day, m.first_seq, m.last_seq, m.row_count, m.head_hash),
       key_bytes);
  perform pg_temp.counted('the manifest signature verifies under the key', n, 1);

  perform private.console_audit_seal(current_date);
  select count(*) into n from private.console_audit_manifest;
  perform pg_temp.counted('sealing the same day again is a no-op (manifests)', n, 1);

  set local role service_role;
  perform private.console_audit_write(null, 'service', null, 'after.seal', null, '{}'::jsonb, null);
  reset role;
  if not pg_temp.raises('select private.console_audit_seal(current_date)') then
    raise exception 'FAILED: a day whose rows changed was re-sealed';
  end if;
  raise notice 'ok  a day whose rows changed after sealing cannot be sealed again';

  if not pg_temp.raises('update private.console_audit_manifest set row_count = 0') then
    raise exception 'FAILED: a manifest was rewritten';
  end if;
  if not pg_temp.raises('delete from private.console_audit_manifest') then
    raise exception 'FAILED: a manifest was deleted';
  end if;
  raise notice 'ok  manifests refuse update and delete';

  -- ── Verification, and the tampering it has to see ───────────────────────

  select * into v_ok, v_rows, v_bad from private.console_audit_verify();
  if not v_ok or v_bad is not null then
    raise exception 'FAILED: verification of an untouched chain reports ok=% bad=%', v_ok, v_bad;
  end if;
  perform pg_temp.counted('verification walks every row and finds the chain intact', v_rows,
                          (select count(*) from private.console_audit_event));
  select count(*) into n from private.console_audit_verification v where v.ok;
  perform pg_temp.counted('and records the run', n, 1);

  -- The control: a rewritten row, with the immutability trigger disabled by
  -- the owner, must be named. Rolled back by the deliberate raise, so the
  -- chain is intact again afterwards; plpgsql keeps the variables.
  seq_tamper := seq2;
  begin
    alter table private.console_audit_event disable trigger keep_console_audit_event_immutable;
    update private.console_audit_event set detail = '{"rewritten": true}' where seq = seq_tamper;
    alter table private.console_audit_event enable trigger keep_console_audit_event_immutable;
    select * into v_ok, v_rows, v_bad from private.console_audit_verify();
    raise exception using errcode = 'P0001', message = 'control';
  exception when raise_exception then
    if sqlerrm <> 'control' then raise; end if;
  end;
  if v_ok or v_bad <> seq_tamper then
    raise exception 'FAILED: a rewritten row was not named (ok=% bad=%, wanted %)', v_ok, v_bad, seq_tamper;
  end if;
  raise notice 'ok  a rewritten row breaks verification at its seq (%)', seq_tamper;

  begin
    alter table private.console_audit_event disable trigger keep_console_audit_event_immutable;
    delete from private.console_audit_event where seq = seq_tamper;
    alter table private.console_audit_event enable trigger keep_console_audit_event_immutable;
    select * into v_ok, v_rows, v_bad from private.console_audit_verify();
    raise exception using errcode = 'P0001', message = 'control';
  exception when raise_exception then
    if sqlerrm <> 'control' then raise; end if;
  end;
  if v_ok or v_bad <> seq_tamper + 1 then
    raise exception 'FAILED: a removed row was not seen at the next link (ok=% bad=%)', v_ok, v_bad;
  end if;
  raise notice 'ok  a removed row breaks the link at the row after it (%)', v_bad;

  begin
    alter table private.console_audit_manifest disable trigger keep_console_audit_manifest_immutable;
    update private.console_audit_manifest set signature = repeat('f', 64);
    alter table private.console_audit_manifest enable trigger keep_console_audit_manifest_immutable;
    select * into v_ok, v_rows, v_bad from private.console_audit_verify();
    raise exception using errcode = 'P0001', message = 'control';
  exception when raise_exception then
    if sqlerrm <> 'control' then raise; end if;
  end;
  if v_ok then
    raise exception 'FAILED: a manifest with a wrong signature verified';
  end if;
  raise notice 'ok  a manifest whose signature does not verify fails verification';

  select * into v_ok, v_rows, v_bad from private.console_audit_verify();
  if not v_ok then raise exception 'FAILED: the chain is not intact after the controls rolled back'; end if;
  raise notice 'ok  the controls rolled back and the chain verifies again';

  -- ── The status the console shows ────────────────────────────────────────

  if not pg_temp.refused(stranger, 'select * from public.console_audit_status()') then
    raise exception 'FAILED: an account without console:operate read the audit status';
  end if;
  perform pg_temp.become(operator);
  select * into r from public.console_audit_status();
  reset role;
  if r.rows <> (select count(*) from private.console_audit_event)
     or r.last_seq <> (select max(seq) from private.console_audit_event)
     or r.head_hash <> (select hash from private.console_audit_event order by seq desc limit 1)
     or r.last_sealed <> current_date
     or not r.last_verified_ok
     or r.last_verified_at < now() - interval '1 minute' then
    raise exception 'FAILED: console_audit_status disagrees with the tables: %', r;
  end if;
  raise notice 'ok  console_audit_status reports the length, head, last seal and last verification';

  -- ── Figures (row 9) and the demo flag (row 13) ──────────────────────────

  if not pg_temp.refused(stranger, 'select * from public.console_figures()') then
    raise exception 'FAILED: an account without console:operate read the figures';
  end if;
  raise notice 'ok  figures need console:operate';

  -- Migration B replaces console_figures with its own rows added, so the
  -- total is not fixed here; what is fixed is that A's eight rows are there
  -- verbatim and that no row, whoever added it, lacks a provenance field.
  perform pg_temp.become(operator);
  select count(*) into total from public.console_figures();
  select count(*) into n from public.console_figures() f
   where f.source is not null and f.time_window is not null and f.owner_seat is not null
     and f.refreshed_at is not null and f.evidence is not null and f.limitation is not null
     and f.value is not null;
  reset role;
  if total < 8 then raise exception 'FAILED: console_figures returns % rows; A alone contributes 8', total; end if;
  perform pg_temp.counted('every figure carries every provenance field (of ' || total || ')', n, total);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_figures() f
   where f.owner_seat in ('founder', 'product', 'engineering', 'security', 'privacy',
                          'accessibility', 'success', 'trust', 'data', 'champion');
  reset role;
  perform pg_temp.counted('every figure''s owner is one of the ten seats', n, total);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_figures() f
   where f.figure in ('audit-events', 'audit-verified', 'role-grants-live', 'seat-holders',
                      'support-grants-active', 'schools', 'gateway-health', 'billing');
  reset role;
  perform pg_temp.counted('the eight figures this migration contributes are all there', n, 8);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_figures() f
   where f.figure = 'billing' and f.value = 'not applicable'
     and f.source = 'docs/DECISION-LOG.md D-009'
     and f.limitation = 'Semester takes no payments; no payment provider exists to read from';
  reset role;
  perform pg_temp.counted('billing is "not applicable" with D-009 as its source, never a number', n, 1);

  select count(*) into audit_rows from private.console_audit_event;
  perform pg_temp.become(operator);
  select count(*) into n from public.console_figures() f
   where (f.figure = 'audit-events' and f.value = audit_rows::text)
      or (f.figure = 'audit-verified' and f.value like 'ok at %')
      or (f.figure = 'seat-holders' and f.value = '1')
      or (f.figure = 'gateway-health' and f.value = 'never');
  reset role;
  perform pg_temp.counted('the audit, seat and gateway figures read their tables', n, 4);

  perform pg_temp.become(operator);
  select (select f.value::bigint from public.console_figures(false) f where f.figure = 'schools')
       - (select f.value::bigint from public.console_figures(true)  f where f.figure = 'schools')
    into n;
  reset role;
  perform pg_temp.counted('the demo school is out of the schools figure unless asked for (difference)', n, -1);

  perform pg_temp.become(operator);
  select (select f.value::bigint from public.console_figures(true)  f where f.figure = 'role-grants-live')
       - (select f.value::bigint from public.console_figures(false) f where f.figure = 'role-grants-live')
    into n;
  reset role;
  perform pg_temp.counted('a grant over the demo tenant is out of role-grants-live unless asked for (difference)', n, 1);

  select count(*) into n from public.schools where id = 'console-check' and not is_demo;
  perform pg_temp.counted('a school is not a demo unless flagged', n, 1);

  perform pg_temp.become(operator);
  update public.schools set is_demo = true where id = 'console-check';
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.counted('the demo flag cannot be set through the API (rows a client''s update reaches)', n, 0);

  -- Appends are serialized. Two writers reading the same tail would both
  -- chain to it and the verifier would find a fork, so the chaining trigger
  -- takes a transaction advisory lock before it reads. A single session
  -- cannot stage the race, so what is held here is the lock's presence in
  -- the trigger, before the read.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'private' and p.proname = 'console_audit_chain'
     and position('pg_advisory_xact_lock' in p.prosrc) > 0
     and position('pg_advisory_xact_lock' in p.prosrc) < position('order by e.seq desc' in p.prosrc);
  perform pg_temp.counted('the chaining trigger takes an advisory lock before it reads the tail', n, 1);

  raise notice 'console control plane: every check passed';
end $$;

rollback;
