-- Semester — the roster desk can undo a binding, and finds the account to bind
-- by searching the school instead of a pasted id.
--
-- `20261021090000_roster_admin_desk.sql` left both out. Unbind, because
-- removing a binding would have left every grant it produced live: the
-- projection takes back a roster-owned grant only on an explicit inactive
-- status, or on absence with the school's switch on, and a person whose
-- binding is gone is neither. Search, because nothing else let an
-- administrator name an account. Three `public` definers, each checking
-- `roster:administer` over the school through the same
-- `private.roster_admin_require`; no new capability and no domain event.
--
-- What is decided here, and where:
--
--   * **An unbind takes back the access the binding produced, in the same
--     transaction.** Every course grant the roster *owns* for that account at
--     this school (`private.roster_grant.owned`: the roster created it or
--     re-activated it) is revoked with `revoked_at`, as the projection
--     revokes, so the `role_grants` audit trigger records each one. A grant
--     the roster only noted — one an administrator, an LTI launch or SCIM gave
--     first — is kept, as it is on every other roster path. Nothing is
--     silently left live. The `roster_grant` rows stay, so binding the person
--     again re-activates exactly those grants through the projection's own
--     revoked-grant branch.
--   * **Never yourself**, mirroring bind: the administrator cannot unbind the
--     binding that is their own account. A colleague can.
--   * **Optimistic.** `want_expect` is the account the administrator saw
--     bound. If the person is now bound to a different account, nothing is
--     written (`stale`). If nobody is bound any more, the answer is
--     `already-unbound` and nothing is written — the state asked for is the
--     state there is.
--   * **Any binding method.** A binding the service made from SCIM or an SSO
--     subject can be removed at the desk too; the next SCIM push may bind it
--     again, which is SCIM's to decide.
--   * **Idempotency** is the desk's ledger, `private.roster_admin_operation`,
--     with a third kind, `unbind`: the same caller, key and request return
--     the first answer; the same key for anything else is refused.
--   * **Audit.** `roster.identity_unbound`, pseudonymous, through
--     `private.record_audit`, with the method the binding had and how many
--     grants ended. Plus one `role_grants` audit row per grant revoked.
--   * **Search is the school, minimally.** `roster_admin_find_accounts`
--     answers only accounts whose profile is at this school — the same
--     population `roster_bind_identity` accepts — and never one already bound
--     here or the caller's own (neither could be bound). It matches the
--     display handle or the sign-in address, case-insensitively, as a literal
--     fragment of at least 3 characters; it answers at most 20, and for each:
--     the account id (which the binding needs), the handle, and the address
--     masked to its first character and domain. Never the full address,
--     never a name the account did not choose.
--   * **The bound list** (`roster_admin_bound`) is the unbound list's mirror,
--     so there is something to unbind from: sourcedId, roster role and
--     names, the account id and handle, the method, and when. At most 1000.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── 1. The ledger learns a third kind ─────────────────────────────────────

alter table private.roster_admin_operation drop constraint if exists roster_admin_operation_kind_check;
alter table private.roster_admin_operation
  add constraint roster_admin_operation_kind_check check (kind in ('bind', 'absence', 'unbind'));

-- ── 2. Who is bound ───────────────────────────────────────────────────────

create or replace function public.roster_admin_bound(want_tenant text)
returns table (sourced_id text, role text, given_name text, family_name text,
               account uuid, handle text, method text, bound_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.roster_admin_require(want_tenant);
  return query
    select i.sourced_id,
           u.payload ->> 'role',
           u.payload ->> 'givenName',
           u.payload ->> 'familyName',
           i.subject,
           p.handle,
           i.method,
           i.bound_at
      from private.roster_identity i
      left join private.roster_current u
        on u.tenant_id = i.tenant_id and u.entity = 'users' and u.sourced_id = i.sourced_id
      left join public.profiles p on p.user_id = i.subject
     where i.tenant_id = want_tenant
     order by lower(coalesce(u.payload ->> 'familyName', '')), lower(coalesce(u.payload ->> 'givenName', '')), i.sourced_id
     limit 1000;
end $$;

-- ── 3. Unbind ─────────────────────────────────────────────────────────────

-- Remove one roster person's binding at this school and end the course access
-- the roster gave that account. Answers {outcome: unbound | already-unbound,
-- method, revoked: [{role, scope}], replayed}.
create or replace function public.roster_admin_unbind(want_tenant text, want_sourced_id text, want_expect uuid, want_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me      uuid := private.roster_admin_require(want_tenant);
  req     jsonb := jsonb_build_object('sourced_id', want_sourced_id, 'expect', want_expect);
  prior   jsonb;
  was     private.roster_identity;
  ended   jsonb;
  answer  jsonb;
begin
  if coalesce(want_sourced_id, '') = '' or want_expect is null then
    raise exception 'semester: an unbind names a roster person and the account you saw bound' using errcode = 'check_violation';
  end if;

  prior := private.roster_admin_replay(want_tenant, want_key, 'unbind', req);
  if prior is not null then return prior; end if;

  -- The same locks, in the same order, as roster_bind_identity and the
  -- projection: a bind or a promotion for this school waits for us.
  perform pg_advisory_xact_lock(hashtext('roster-identity:' || want_tenant));
  perform pg_advisory_xact_lock(hashtext('roster-grants:' || want_tenant));

  select * into was from private.roster_identity
   where tenant_id = want_tenant and sourced_id = want_sourced_id
   for update;

  if not found then
    answer := jsonb_build_object('outcome', 'already-unbound', 'method', null, 'revoked', '[]'::jsonb, 'replayed', false);
  else
    if was.subject = me then
      raise exception 'semester: you cannot unbind your own account; another administrator at your school can' using errcode = 'insufficient_privilege';
    end if;
    if was.subject is distinct from want_expect then
      raise exception 'semester: stale: this person was bound to a different account since you looked; nothing was changed' using errcode = 'serialization_failure';
    end if;

    delete from private.roster_identity where tenant_id = want_tenant and sourced_id = want_sourced_id;

    -- The roster's own grants for that account, at this school: ended now.
    with gone as (
      update public.role_grants r
         set revoked_at = now()
        from private.roster_grant rg
       where rg.grant_id = r.id and rg.tenant_id = want_tenant and rg.owned
         and r.subject = was.subject and r.revoked_at is null
      returning r.role, r.scope_id
    )
    select coalesce(jsonb_agg(jsonb_build_object('role', role, 'scope', scope_id) order by scope_id, role), '[]'::jsonb)
      into ended from gone;

    perform private.record_audit(want_tenant, 'roster.identity_unbound', 'roster_identity', want_sourced_id, 'allowed',
      left(want_key, 100), jsonb_build_object('method', was.method, 'revoked', jsonb_array_length(ended)));

    answer := jsonb_build_object('outcome', 'unbound', 'method', was.method, 'revoked', ended, 'replayed', false);
  end if;

  insert into private.roster_admin_operation (tenant_id, idempotency_key, actor, kind, request, result)
  values (want_tenant, want_key, me, 'unbind', req, answer);
  return answer;
end $$;

-- ── 4. Find the account to bind ───────────────────────────────────────────

create or replace function public.roster_admin_find_accounts(want_tenant text, want_query text)
returns table (account uuid, handle text, email_hint text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.roster_admin_require(want_tenant);
  q  text := lower(btrim(coalesce(want_query, '')));
  pattern text;
begin
  if length(q) < 3 then
    raise exception 'semester: type at least 3 characters of a handle or address' using errcode = 'check_violation';
  end if;
  if length(q) > 100 then
    raise exception 'semester: a search is at most 100 characters' using errcode = 'check_violation';
  end if;
  -- A literal fragment: % and _ match themselves.
  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select p.user_id,
           p.handle,
           case when u.email is null or position('@' in u.email) < 2 then null
                else left(u.email, 1) || '•••@' || split_part(u.email, '@', 2) end
      from public.profiles p
      join auth.users u on u.id = p.user_id
     where p.school_id = want_tenant
       and p.user_id <> me
       and not exists (select 1 from private.roster_identity i
                        where i.tenant_id = want_tenant and i.subject = p.user_id)
       and (lower(p.handle) like pattern or lower(coalesce(u.email, '')) like pattern)
     order by lower(p.handle), p.user_id
     limit 20;
end $$;

-- ── 5. Who may call what ──────────────────────────────────────────────────

revoke all on function public.roster_admin_bound(text) from public, anon, authenticated;
revoke all on function public.roster_admin_unbind(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.roster_admin_find_accounts(text, text) from public, anon, authenticated;
grant execute on function public.roster_admin_bound(text) to authenticated;
grant execute on function public.roster_admin_unbind(text, text, uuid, text) to authenticated;
grant execute on function public.roster_admin_find_accounts(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.roster_admin_find_accounts(text, text);
--   drop function if exists public.roster_admin_unbind(text, text, uuid, text);
--   drop function if exists public.roster_admin_bound(text);
--   delete from private.roster_admin_operation where kind = 'unbind';
--   alter table private.roster_admin_operation drop constraint if exists roster_admin_operation_kind_check;
--   alter table private.roster_admin_operation
--     add constraint roster_admin_operation_kind_check check (kind in ('bind', 'absence'));
--   commit;
--
-- Unbindings already made stay made, and the grants they ended stay ended;
-- binding the person again at the desk re-activates them.
