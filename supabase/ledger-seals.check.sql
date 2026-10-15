-- Signing the ledger chains: that a day is sealed once, per ledger and school,
-- under a key no API role can read; that the seal check catches the attacker the
-- link check cannot (one who rewrites an entry and recomputes every later link);
-- that a forged signature is caught; that re-sealing a changed day raises; that
-- the nightly job seals, walks every chain with both checks and records the run;
-- and the limit stated out loud: someone who can read the key can re-sign. Every
-- tamper is attempted as the owner with the protecting triggers off, which is the
-- attacker this is for, and is rolled back so the next one starts clean.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh ledger-seals

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'u_' || replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
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

create or replace function pg_temp.error_as_role(r text, q text)
returns text language plpgsql as $$
begin
  execute 'set local role ' || r;
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- As the operator: no user, no impersonated role.
create or replace function pg_temp.op() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  reg uuid; prof uuid; off1 uuid; off2 uuid;
  r1 uuid; i integer;
  v jsonb; sealed integer; key_bytes bytea;
  entry jsonb; new_prev text; link record; ok_links jsonb; ok_seals jsonb; ran jsonb;
  m_count bigint; m_day date;
begin
  insert into public.schools (id, name, email_domains) values ('sl-u', 'Seal University', array['sl-u.example']);

  reg  := pg_temp.newuser('reg@sl-u.example', 'sl-u');
  prof := pg_temp.newuser('prof@sl-u.example', 'sl-u');
  off1 := pg_temp.newuser('off1@sl-u.example', 'sl-u');
  off2 := pg_temp.newuser('off2@sl-u.example', 'sl-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,  'registrar',                'school', 'sl-u', 'institution'),
    (prof, 'faculty',                  'school', 'sl-u', 'institution'),
    (off1, 'student_accounts_officer', 'school', 'sl-u', 'institution'),
    (off2, 'student_accounts_officer', 'school', 'sl-u', 'institution');

  -- Build both chains through the real flows.
  for i in 1..3 loop
    r1 := pg_temp.value_as(prof, format(
      $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source)
         values ('sl-u', 'S100', 'grade', %L, 'set', %L, '2026-12-18', 'Posted from the final grade roster.', 'faculty') returning id$q$,
      'PSCI 210' || i || ' · Fall 2026', (array['A', 'B+', 'B'])[i]))::uuid;
    perform pg_temp.error_as(reg, format($q$update public.academic_record_changes set status = 'approved' where id = %L$q$, r1));
  end loop;
  for i in 1..2 loop
    r1 := pg_temp.value_as(off1, format(
      $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
         values ('sl-u', 'S100', 'charge', 'tuition', %s, 'Fall 2026 charge', '2026-09-01') returning id$q$, 100000 * i))::uuid;
    perform pg_temp.error_as(off2, format($q$update public.student_account_requests set status = 'approved' where id = %L$q$, r1));
  end loop;
  perform pg_temp.op();

  -- ── sealing ────────────────────────────────────────────────────────────
  perform pg_temp.must('before anything is sealed there are no manifests', (select count(*) from private.ledger_chain_manifest) = 0);
  sealed := private.ledger_chain_seal(current_date);
  perform pg_temp.must('sealing today writes one manifest per ledger and school that chained something today', sealed = 2);
  perform pg_temp.must('each names its bounds, its count and its head',
    (select row_count = 3 and first_seq = 1 and last_seq = 3
       and head_hash = (select hash from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 3)
       from private.ledger_chain_manifest where ledger = 'academic_record')
    and (select row_count = 2 and first_seq = 1 and last_seq = 2 from private.ledger_chain_manifest where ledger = 'student_account'));
  select k.key into key_bytes from private.ledger_chain_key k;
  perform pg_temp.must('and its signature is the HMAC of that text under the key',
    (select count(*) from private.ledger_chain_manifest m
      where m.signature = private.console_audit_hmac(
        private.ledger_chain_manifest_text(m.ledger, m.tenant_id, m.batch_day, m.first_seq, m.last_seq, m.row_count, m.head_hash), key_bytes)) = 2);
  perform pg_temp.must('sealing the same day over the same rows is a no-op, so the job can be re-run',
    private.ledger_chain_seal(current_date) = 0 and (select count(*) from private.ledger_chain_manifest) = 2);

  v := private.verify_ledger_seals('academic_record', 'sl-u');
  perform pg_temp.must('the seals of an untouched chain verify, and it says how many days are sealed',
    (v ->> 'ok')::boolean and (v ->> 'sealed_days')::int = 1);

  -- ── the attack the unsigned chain could not catch ──────────────────────
  -- Rewrite the middle entry and recompute every later link so the chain is
  -- consistent with itself. The link check passes; the seal check does not.
  begin
    set local session_replication_role = replica;
    update public.academic_record_entries set value = 'A+'
     where id = (select entry_id from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 2);
    new_prev := (select hash from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 1);
    for link in select * from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq >= 2 order by seq loop
      select to_jsonb(e) into entry from public.academic_record_entries e where e.id = link.entry_id;
      update private.ledger_chain
         set prev_hash = new_prev, hash = private.ledger_entry_hash('academic_record', link.seq, new_prev, entry)
       where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = link.seq
       returning hash into new_prev;
    end loop;
    ok_links := private.verify_ledger_chain('academic_record', 'sl-u');
    ok_seals := private.verify_ledger_seals('academic_record', 'sl-u');
    ran := private.ledger_chain_nightly();
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('a chain rewritten consistently passes the link check: this is what the seals are for',
    (ok_links ->> 'ok')::boolean);
  perform pg_temp.must('and fails the seal check, as sealed_rows_changed',
    not (ok_seals ->> 'ok')::boolean and ok_seals ->> 'break_kind' = 'sealed_rows_changed');
  perform pg_temp.must('the nightly run reports it and names the check that caught it',
    not (ran ->> 'ok')::boolean and ran -> 'first_break' ->> 'check' = 'seals');

  -- ── forging the signature without the key ──────────────────────────────
  begin
    alter table private.ledger_chain_manifest disable trigger ledger_chain_manifest_immutable;
    update private.ledger_chain_manifest set head_hash = repeat('9', 64), signature = repeat('9', 64) where ledger = 'academic_record';
    ok_seals := private.verify_ledger_seals('academic_record', 'sl-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('a manifest rewritten with a made-up signature is caught as bad_signature',
    not (ok_seals ->> 'ok')::boolean and ok_seals ->> 'break_kind' = 'bad_signature');

  -- ── the limit, stated ──────────────────────────────────────────────────
  -- Someone who can read the key can rewrite the ledger, recompute the chain
  -- and re-sign the manifest, and nothing here catches it. That is asserted, so
  -- it cannot be mistaken for a claim: an external anchor is what closes it.
  begin
    set local session_replication_role = replica;
    update public.academic_record_entries set value = 'A+'
     where id = (select entry_id from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 3);
    select to_jsonb(e) into entry from public.academic_record_entries e
     where e.id = (select entry_id from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 3);
    update private.ledger_chain
       set hash = private.ledger_entry_hash('academic_record', 3, prev_hash, entry)
     where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 3;
    alter table private.ledger_chain_manifest disable trigger ledger_chain_manifest_immutable;
    update private.ledger_chain_manifest m
       set head_hash = (select hash from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 3),
           signature = private.console_audit_hmac(
             private.ledger_chain_manifest_text(m.ledger, m.tenant_id, m.batch_day, m.first_seq, m.last_seq, m.row_count,
               (select hash from private.ledger_chain where ledger = 'academic_record' and tenant_id = 'sl-u' and seq = 3)),
             key_bytes)
     where m.ledger = 'academic_record';
    ok_links := private.verify_ledger_chain('academic_record', 'sl-u');
    ok_seals := private.verify_ledger_seals('academic_record', 'sl-u');
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('THE LIMIT: an owner who reads the key, rewrites the ledger, recomputes the chain and re-signs is not caught',
    (ok_links ->> 'ok')::boolean and (ok_seals ->> 'ok')::boolean);

  -- ── re-sealing a changed day raises ────────────────────────────────────
  begin
    set local session_replication_role = replica;
    delete from private.ledger_chain where ledger = 'student_account' and tenant_id = 'sl-u' and seq = 2;
    perform private.ledger_chain_seal(current_date);
    raise exception 'FAILED: a sealed day was re-sealed over different rows';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    if sqlerrm not like '%The sealed rows changed%' then raise; end if;
  end;
  raise notice 'ok  sealing a sealed day over different rows raises, so it cannot be quietly replaced';

  -- ── the seals are only for what they name ──────────────────────────────
  -- A new entry approved after the day was sealed sits past the manifest's last
  -- link, and contradicts nothing: the seals name what they name.
  r1 := pg_temp.value_as(off1, $q$insert into public.student_account_requests (tenant_id, student_ref, kind, category, amount_cents, description, effective_on)
       values ('sl-u', 'S100', 'charge', 'fees', 30000, 'Late fee', '2026-09-15') returning id$q$)::uuid;
  perform pg_temp.error_as(off2, format($q$update public.student_account_requests set status = 'approved' where id = %L$q$, r1));
  perform pg_temp.op();
  perform pg_temp.must('a link chained after the day was sealed exists, and both checks still pass',
    (select count(*) from private.ledger_chain where ledger = 'student_account' and tenant_id = 'sl-u') = 3
    and (private.verify_ledger_seals('student_account', 'sl-u') ->> 'ok')::boolean
    and (private.verify_ledger_chain('student_account', 'sl-u') ->> 'ok')::boolean);

  -- ── yesterday, through the same code ───────────────────────────────────
  begin
    set local session_replication_role = replica;
    update private.ledger_chain set chained_at = now() - interval '1 day' where ledger = 'student_account' and tenant_id = 'sl-u' and seq = 1;
    delete from private.ledger_chain_manifest where ledger = 'student_account';
    ran := private.ledger_chain_nightly();
    select row_count, batch_day into m_count, m_day from private.ledger_chain_manifest where ledger = 'student_account';
    raise exception 'rollback the tamper';
  exception when others then
    if sqlerrm <> 'rollback the tamper' then raise; end if;
  end;
  perform pg_temp.must('the nightly job seals yesterday: a link chained yesterday gets a manifest for that day',
    (ran ->> 'sealed')::int = 1 and m_count = 1 and m_day = current_date - 1);

  -- ── the record of a run, good or bad ───────────────────────────────────
  ran := private.ledger_chain_nightly();
  perform pg_temp.must('a clean night is recorded as ok, with how many chains it walked',
    (ran ->> 'ok')::boolean and (ran ->> 'chains_checked')::int = 2
    and (select ok and chains_checked = 2 and first_break is null from private.ledger_chain_verification order by ran_at desc limit 1));
  begin
    update private.ledger_chain_verification set ok = false;
    raise exception 'FAILED: a verification record was edited';
  exception when sqlstate '42501' then
    raise notice 'ok  a verification record cannot be edited';
  end;
  begin
    delete from private.ledger_chain_verification;
    raise exception 'FAILED: a verification record was deleted';
  exception when sqlstate '42501' then
    raise notice 'ok  nor deleted';
  end;
  begin
    update private.ledger_chain_manifest set row_count = 99;
    raise exception 'FAILED: a manifest was edited';
  exception when sqlstate '42501' then
    raise notice 'ok  a manifest cannot be edited, even by the owner';
  end;

  -- ── nobody reaches the key, the manifests or the functions ─────────────
  perform pg_temp.must('a signed-in account cannot read the key',
    pg_temp.error_as(reg, 'select * from private.ledger_chain_key') like '%permission denied%');
  perform pg_temp.must('the service role cannot read the key either',
    pg_temp.error_as_role('service_role', 'select * from private.ledger_chain_key') like '%permission denied%');
  perform pg_temp.must('nor the manifests',
    pg_temp.error_as(reg, 'select * from private.ledger_chain_manifest') like '%permission denied%');
  perform pg_temp.must('a signed-in account cannot seal',
    pg_temp.error_as(reg, 'select private.ledger_chain_seal(current_date)') like '%permission denied%');
  perform pg_temp.must('nor run the nightly check',
    pg_temp.error_as(reg, 'select private.ledger_chain_nightly()') like '%permission denied%');
  perform pg_temp.must('a signed-out visitor cannot',
    pg_temp.error_as_role('anon', 'select private.ledger_chain_nightly()') like '%permission denied%');

  -- ── a school's removal takes its manifests with it ─────────────────────
  -- The delete guard of 20260930200000 is off for this one proof of the
  -- cascade, inside a transaction that is rolled back.
  alter table public.schools disable trigger refuse_school_delete;
  delete from public.schools where id = 'sl-u';
  alter table public.schools enable trigger refuse_school_delete;
  perform pg_temp.must('removing a school removes its chain, its manifests and nothing else',
    not exists (select 1 from private.ledger_chain_manifest where tenant_id = 'sl-u')
    and not exists (select 1 from private.ledger_chain where tenant_id = 'sl-u'));
end $$;

rollback;
