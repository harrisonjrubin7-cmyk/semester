-- The advisor-share lifecycle on the common audit record (20260930190000).
-- LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
-- What must hold:
--   * creating, reading, revoking and deleting a share each write exactly one
--     event, by the person who did it, for the share's school
--   * the event names nothing: no title, no address, no payload text
--   * a school's auditor reads its own school's share events and not another's;
--     a student cannot read them, and cannot write one
--   * an attempt that is refused writes no event and changes nothing
--   * the share's own rules (who may share, expiry) are unchanged

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
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
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
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

do $$
declare
  student uuid; advisor uuid; other_student uuid; auditor uuid; other_auditor uuid;
  share uuid; n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-shr', 'North Share University', array['north-shr.example']),
    ('south-shr', 'South Share College', array['south-shr.example']);
  student       := pg_temp.newuser('stu.dent@north-shr.example', 'north-shr');
  other_student := pg_temp.newuser('oth.er@north-shr.example', 'north-shr');
  advisor       := pg_temp.newuser('ad.visor@north-shr.example', 'north-shr');
  auditor       := pg_temp.newuser('au.ditor@north-shr.example', 'north-shr');
  other_auditor := pg_temp.newuser('au.ditor@south-shr.example', 'south-shr');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (advisor, 'academic_advisor', 'school', 'north-shr', 'institution'),
    (auditor, 'university_admin', 'school', 'north-shr', 'institution'),
    (other_auditor, 'university_admin', 'school', 'south-shr', 'institution');

  -- ── Creating ─────────────────────────────────────────────────────────────
  perform pg_temp.become(student);
  share := public.share_with_advisor('ad.visor@north-shr.example', 'My private plan title', '{"note":"secret detail"}'::jsonb, now() + interval '30 days');
  reset role;
  select count(*) into n from public.audit_event where action = 'share.created' and tenant_id = 'north-shr';
  perform pg_temp.counted('sharing writes one event for the share''s school', n, 1);
  select count(*) into n from public.audit_event
   where action = 'share.created' and detail = '{"audience":"advisor","days":30}'::jsonb and actor_kind = 'authenticated';
  perform pg_temp.counted('with the audience and the number of days, by the student', n, 1);

  -- ── Reading ──────────────────────────────────────────────────────────────
  perform pg_temp.become(advisor);
  perform * from public.read_advisor_share(share);
  reset role;
  select count(*) into n from public.audit_event where action = 'share.read';
  perform pg_temp.counted('the advisor reading it writes one event', n, 1);
  select count(*) into n from public.audit_event
   where action = 'share.read' and actor_sha256 = private.role_audit_sha256(advisor::text);
  perform pg_temp.counted('by the advisor, not the student', n, 1);

  -- A refused read writes nothing.
  perform pg_temp.become(other_student);
  if not pg_temp.refused(format($q$select * from public.read_advisor_share(%L)$q$, share)) then
    raise exception 'FAILED: somebody else read the share';
  end if;
  reset role;
  select count(*) into n from public.audit_event where action = 'share.read';
  perform pg_temp.counted('a refused read leaves no event', n, 1);

  -- ── Revoking, then deleting ──────────────────────────────────────────────
  perform pg_temp.become(student);
  update public.advisor_shares set revoked_at = now() where id = share;
  reset role;
  select count(*) into n from public.audit_event where action = 'share.revoked';
  perform pg_temp.counted('revoking writes one event', n, 1);
  -- Touching a revoked share again is not a second revocation.
  perform pg_temp.become(student);
  update public.advisor_shares set revoked_at = revoked_at where id = share;
  reset role;
  select count(*) into n from public.audit_event where action = 'share.revoked';
  perform pg_temp.counted('and a write that changes nothing writes no second event', n, 1);

  perform pg_temp.become(advisor);
  if not pg_temp.refused(format($q$select * from public.read_advisor_share(%L)$q$, share)) then
    raise exception 'FAILED: the advisor read a revoked share';
  end if;
  reset role;

  perform pg_temp.become(student);
  delete from public.advisor_shares where id = share;
  reset role;
  select count(*) into n from public.audit_event where action = 'share.deleted';
  perform pg_temp.counted('deleting writes one event', n, 1);

  -- ── The events name nothing ──────────────────────────────────────────────
  select count(*) into n from public.audit_event
   where action like 'share.%'
     and (detail::text ~* 'private|secret|ad\.visor|stu\.dent|north-shr\.example' or object_sha256 = share::text);
  perform pg_temp.counted('no event carries a title, an address, a payload word or the raw id', n, 0);
  select count(*) into n from public.audit_event where action like 'share.%' and object_sha256 = private.role_audit_sha256(share::text);
  perform pg_temp.counted('all four are about the same share, as a pseudonym', n, 4);

  -- ── Who can read them ────────────────────────────────────────────────────
  perform pg_temp.become(auditor);
  select count(*) into n from public.audit_event where action like 'share.%';
  reset role;
  perform pg_temp.counted('the school''s auditor reads its four', n, 4);
  perform pg_temp.become(other_auditor);
  select count(*) into n from public.audit_event where action like 'share.%';
  reset role;
  perform pg_temp.counted('another school''s auditor reads none', n, 0);
  perform pg_temp.become(student);
  select count(*) into n from public.audit_event;
  if not pg_temp.refused($q$insert into public.audit_event (action, object_kind, outcome, actor_kind) values ('share.read', 'advisor_share', 'allowed', 'authenticated')$q$) then
    raise exception 'FAILED: a student wrote an audit event';
  end if;
  reset role;
  perform pg_temp.counted('a student reads none and cannot write one', n, 0);

  -- ── The share''s own rules are unchanged ─────────────────────────────────
  perform pg_temp.become(student);
  if not pg_temp.refused($q$select public.share_with_advisor('nobody@north-shr.example', 't', '{}'::jsonb, now() + interval '5 days')$q$) then
    raise exception 'FAILED: shared with an address that is not an advisor';
  end if;
  if not pg_temp.refused($q$select public.share_with_advisor('ad.visor@north-shr.example', 't', '{}'::jsonb, now() + interval '400 days')$q$) then
    raise exception 'FAILED: shared past the 120-day cap';
  end if;
  reset role;
  select count(*) into n from public.audit_event where action = 'share.created';
  perform pg_temp.counted('and a refused share leaves no event', n, 1);
end $$;

rollback;
