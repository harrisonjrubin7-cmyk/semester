-- The permission matrix, and the four things that make it a matrix rather than a ladder.
--
-- `public.role_capabilities` is item 299 as data: which named things each role
-- may do. `private.has_capability()` is the one question a policy asks. Between
-- them they replace `private.is_app_admin()` as the gate on anything that is not
-- the administrator dashboard itself.
--
-- What this covers:
--
--   * **Sets, not tiers.** `organization_member` carries `organization:read` and
--     **not** `member:manage`; `organization_admin` carries both. That is item
--     256 — "do not require every officer to receive full admin access" — held
--     by the seeded matrix rather than by a comment.
--   * **`platform_admin` is not a superuser.** It carries three capabilities and
--     not a fourth. A role that implicitly held everything would be the boolean
--     again under a longer name.
--   * **An `app_admins` row carries no capability at all.** That is the split,
--     stated as a measurement: the old flag no longer reaches the queue.
--   * The predicate is live-only and caller-scoped — revoked, expired, wrong
--     scope, wrong kind and somebody else's grant all answer false, and a live
--     one answers **true**, which is the control. A predicate that answers false
--     for everyone protects everything and is indistinguishable from broken.
--   * The three reference tables are readable by a signed-in account, unreadable
--     by a signed-out one, and writable by nobody — each lock read with the
--     other taken out of the way, because a client that could add one row to
--     `role_capabilities` could grant itself `platform:configure` without ever
--     touching `role_grants`.
--   * One vocabulary: every role in the matrix is in `app_roles`, and
--     `role_grants.role` points at the same table rather than at a second copy
--     of the list.
--
--   How to run it: supabase/check.sh capabilities

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
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

/** Refused outright — a missing privilege or a policy that permits nothing. */
create or replace function pg_temp.refused(what text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED: % — the statement was allowed', what;
exception
  when insufficient_privilege then
    raise notice 'ok  % (refused outright)', what;
end $$;

/**
 * Allowed to run, and must change nothing.
 *
 * The distinction `rolegrants.check.sql` exists to record: with the privilege
 * granted and no policy, INSERT raises but UPDATE and DELETE succeed against no
 * row. Writing all three as `refused` passes for the wrong reason.
 */
create or replace function pg_temp.untouched(what text, stmt text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAILED: % — it changed % row(s)', what, n;
  end if;
  raise notice 'ok  % (ran, changed nothing)', what;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

do $$
declare
  member uuid;
  boss   uuid;
  mod    uuid;
  flagged uuid;
  n      bigint;
  a      boolean;
begin
  member  := pg_temp.newuser('member@capabilities.test');
  boss    := pg_temp.newuser('boss@capabilities.test');
  mod     := pg_temp.newuser('mod@capabilities.test');
  flagged := pg_temp.newuser('flagged@capabilities.test');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (member, 'organization_member', 'organization', 'finance-club', 'self'),
    (boss,   'organization_admin',  'organization', 'finance-club', 'platform'),
    (mod,    'moderator',           'platform',     '',             'platform');

  -- The old flag, on an account holding no grant at all.
  insert into public.app_admins (user_id, note) values (flagged, 'capabilities check');

  -- ── Sets, not tiers ────────────────────────────────────────────────────

  perform pg_temp.become(member);
  select private.has_capability('organization:read', 'organization', 'finance-club') into a;
  perform pg_temp.answered('a member may read the organization — THE CONTROL', a, true);
  select private.has_capability('member:manage', 'organization', 'finance-club') into a;
  perform pg_temp.answered('and may not admit or remove anybody', a, false);
  select private.has_capability('event:create', 'organization', 'finance-club') into a;
  perform pg_temp.answered('nor create its events', a, false);

  perform pg_temp.become(boss);
  select private.has_capability('organization:read', 'organization', 'finance-club') into a;
  perform pg_temp.answered('an admin of the same club may read it', a, true);
  select private.has_capability('member:manage', 'organization', 'finance-club') into a;
  perform pg_temp.answered('and may manage its members', a, true);
  select private.has_capability('application:manage', 'organization', 'finance-club') into a;
  perform pg_temp.answered('and decide its applications', a, true);

  -- The pair above is the whole of item 256: two roles over one resource, one
  -- capability apart, and neither is a rung of the other.

  -- ── Scope ──────────────────────────────────────────────────────────────

  select private.has_capability('member:manage', 'organization', 'consulting-club') into a;
  perform pg_temp.answered('but not over the club somebody else runs', a, false);
  select private.has_capability('member:manage', 'course', 'finance-club') into a;
  perform pg_temp.answered('nor the same id read as a different kind of thing', a, false);
  select private.has_capability('member:manage') into a;
  perform pg_temp.answered('nor at the platform, which is the default scope', a, false);

  -- ── The moderator, and what platform_admin is not ──────────────────────

  perform pg_temp.become(mod);
  select private.has_capability('report:read') into a;
  perform pg_temp.answered('a moderator may read the queue', a, true);
  select private.has_capability('moderation:action') into a;
  perform pg_temp.answered('and act on a report', a, true);
  select private.has_capability('platform:configure') into a;
  perform pg_temp.answered('and may not configure the platform', a, false);

  -- `platform_admin` carries three capabilities and not this one. Asserted out
  -- of the matrix rather than by granting it, because the claim is about what
  -- the seeded rows say.
  set local role postgres;
  select count(*) into n from public.role_capabilities
   where role = 'platform_admin' and capability = 'member:manage';
  perform pg_temp.counted('platform_admin does not implicitly hold member:manage', n, 0);
  select count(*) into n from public.role_capabilities where role = 'platform_admin';
  perform pg_temp.counted('it holds exactly the three it was given', n, 3);

  -- ── The split, as a measurement ────────────────────────────────────────
  --
  -- The point of the whole migration: an `app_admins` row is not a capability.
  perform pg_temp.become(flagged);
  select private.has_capability('report:read') into a;
  perform pg_temp.answered('an app_admins row carries no report:read', a, false);
  select private.has_capability('platform:configure') into a;
  perform pg_temp.answered('nor platform:configure', a, false);

  -- ── Live only, and whose ───────────────────────────────────────────────

  set local role postgres;
  update public.role_grants set revoked_at = now()
   where subject = member and role = 'organization_member';
  perform pg_temp.become(member);
  select private.has_capability('organization:read', 'organization', 'finance-club') into a;
  perform pg_temp.answered('a revoked grant carries nothing', a, false);

  set local role postgres;
  update public.role_grants set revoked_at = null, expires_at = now() - interval '1 day'
   where subject = member and role = 'organization_member';
  perform pg_temp.become(member);
  select private.has_capability('organization:read', 'organization', 'finance-club') into a;
  perform pg_temp.answered('and an expired one carries nothing', a, false);

  set local role postgres;
  update public.role_grants set expires_at = null
   where subject = member and role = 'organization_member';

  perform pg_temp.become_anon();
  select private.has_capability('organization:read', 'organization', 'finance-club') into a;
  perform pg_temp.answered('a signed-out visitor holds nothing', a, false);

  select private.has_capability('nobody:holds:this') into a;
  perform pg_temp.answered('and a capability that is not in the vocabulary is not held', a, false);

  -- ── The reference tables: read ─────────────────────────────────────────

  perform pg_temp.become(member);
  select count(*) into n from public.app_roles;
  perform pg_temp.counted('a signed-in account reads the twenty roles', n, 20);
  select count(*) into n from public.role_capabilities;
  perform pg_temp.counted('and the whole matrix', n, 15);

  perform pg_temp.become_anon();
  perform pg_temp.refused('a signed-out visitor cannot read the matrix',
                          'select count(*) from public.role_capabilities');
  perform pg_temp.refused('nor the role vocabulary',
                          'select count(*) from public.app_roles');

  -- ── The reference tables: write, both locks ────────────────────────────

  perform pg_temp.become(member);
  perform pg_temp.refused('a member cannot give their role a capability',
    $f$insert into public.role_capabilities (role, capability)
       values ('organization_member', 'platform:configure')$f$);
  perform pg_temp.refused('nor invent a role',
    $f$insert into public.app_roles (role) values ('superuser')$f$);

  -- Hand back the privileges the migration revoked; the absence of a write
  -- policy has to carry it alone.
  set local role postgres;
  grant insert, update, delete on public.role_capabilities to authenticated;
  grant insert, update, delete on public.app_roles to authenticated;

  perform pg_temp.become(member);
  perform pg_temp.refused('granted the insert, row-level security still refuses it',
    $f$insert into public.role_capabilities (role, capability)
       values ('organization_member', 'platform:configure')$f$);
  perform pg_temp.untouched('granted the update, it matches no row',
    $f$update public.role_capabilities set capability = 'platform:configure'$f$);
  perform pg_temp.untouched('granted the delete, it matches no row',
    $f$delete from public.role_capabilities$f$);

  set local role postgres;
  revoke insert, update, delete on public.role_capabilities from authenticated;
  revoke insert, update, delete on public.app_roles from authenticated;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('app_roles', 'app_capabilities', 'role_capabilities')
     and cmd <> 'SELECT';
  perform pg_temp.counted('no write policy on any of the three', n, 0);

  -- ── One vocabulary ─────────────────────────────────────────────────────
  --
  -- The fault this forecloses is a second list of the twenty roles. Both tables
  -- point at `app_roles`, so a role can be wrong in one place only by being
  -- absent from it, which a foreign key refuses.
  select count(*) into n from public.role_capabilities rc
   where not exists (select 1 from public.app_roles r where r.role = rc.role);
  perform pg_temp.counted('every role in the matrix is in the vocabulary', n, 0);

  select count(*) into n from pg_constraint
   where conrelid = 'public.role_grants'::regclass
     and contype = 'f'
     and confrelid = 'public.app_roles'::regclass;
  perform pg_temp.counted('role_grants points at the same vocabulary', n, 1);

  select count(*) into n from pg_constraint
   where conrelid = 'public.role_grants'::regclass and conname = 'role_grants_role_check';
  perform pg_temp.counted('and the old check constraint is gone, not doubled up', n, 0);

  -- ── Where the predicate lives ──────────────────────────────────────────

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'private' and p.proname = 'has_capability'
     and p.prosecdef
     and p.proconfig is not null
     and 'search_path=' = any (select left(c, 12) from unnest(p.proconfig) c);
  perform pg_temp.counted('has_capability is private, definer, path pinned', n, 1);

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'has_capability';
  perform pg_temp.counted('and has no twin in public, which PostgREST would publish', n, 0);

  raise notice 'capabilities: every check passed';
end $$;

rollback;
