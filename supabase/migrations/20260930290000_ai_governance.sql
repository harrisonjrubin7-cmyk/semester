-- AI across the operating system: one school-level answer, per Core module and
-- data class, to "may AI be used here at all", and a record of every answer.
--
-- Core prompt 13. What already existed, and is NOT redone here (D-1063 lists it):
-- `ai_policy` (providers, modes, budget, retention), `tenant_feature_policy`,
-- `data_classification_rules` (T0-T6 ceilings), the gateway's journal and
-- budget, `kill.ai_generation`, and the client-side `gate()` in
-- `lib/toolkit/classification.ts`. None of them says, for a given Core module,
-- whether AI may touch that module's data, and none keeps a log of decisions.
--
-- ## What the database refuses
--
-- - AI in any Core module, for any data class, until a school says so: no row
--   reads DENIED (`no_policy`).
-- - AI on grades or transcript content, admissions decisions, financial aid
--   amounts, disciplinary records or health data, in any school, whatever any
--   row says. The list is closed, in `private.ai_use_never_classes()`; a policy
--   row for one of them cannot be written (a CHECK, so not even the table's
--   owner can), and the decision function answers `never_class` before it
--   reads a policy. DO-NOT-BUILD rule 3 (nothing ranked or suggested that
--   nobody can explain) and D-147 are why: Semester is a calculator over facts
--   a school supplies, and an AI never decides.
-- - Turning AI ON for a module and class on one person's say: it needs a
--   second person with `ai_use:approve`, never the one who proposed it, within
--   seven days. Turning it OFF applies at once; reducing what AI may do never
--   waits for a second person.
-- - Editing or deleting a proposal, an approval or a log line.
-- - A decision that is not logged: `ai_use_permitted` writes its log row in
--   the same statement that answers. The log holds who, module, data class,
--   allowed or denied and why, the provider and model names the CALLER
--   supplied as text, and the time. It never holds a prompt or a response.
--
-- ## Who may call what
--
-- `ai_use_permitted` is for the server only (service_role): every AI entry
-- point that touches a Core module's data must call it first. Nothing in this
-- change calls it yet — see D-1063: no existing entry point handles Core
-- module data, so wiring one in would have been invented. Signed-in people
-- call `ai_use_propose`, `ai_use_approve` and `ai_use_policy`, each of which
-- checks a capability for the school it names.
--
-- Idempotent. No begin/commit: the runner opens the transaction.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('ai_use:propose', 'Propose, for one school, whether AI may be used on one Core module''s data class. Turning it off applies at once; turning it on needs a second person.'),
  ('ai_use:approve', 'Approve another person''s proposal to allow AI on one Core module''s data class at one school.'),
  ('ai_use:read',    'Read one school''s AI use policy and the log of every AI use decision made for it.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('university_admin', 'ai_use:propose'),
  ('university_admin', 'ai_use:approve'),
  ('university_admin', 'ai_use:read'),
  ('registrar',        'ai_use:read')
on conflict (role, capability) do nothing;

-- ── 2. The closed lists ───────────────────────────────────────────────────
--
-- `lib/aiuse/spec.ts` carries the same and `aiuse.test.ts` holds them equal.

create or replace function private.ai_use_never_classes()
returns text[] language sql immutable set search_path = '' as $$
  select array['grade_or_transcript', 'admissions_decision', 'aid_amount',
               'disciplinary', 'health']::text[]
$$;

create or replace function private.ai_use_permittable_classes()
returns text[] language sql immutable set search_path = '' as $$
  select array['catalog_public', 'schedule_structure', 'instructor_material',
               'requesters_own_work', 'deidentified_aggregate']::text[]
$$;

revoke all on function private.ai_use_never_classes() from public, anon, authenticated;
revoke all on function private.ai_use_permittable_classes() from public, anon, authenticated;

-- ── 3. What a school proposed, and who agreed ─────────────────────────────

create table if not exists public.ai_use_proposal (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools (id),
  module      text        not null check (module = any (public.core_modules())),
  -- By construction: a never class cannot be the subject of a row at all.
  data_class  text        not null check (data_class = any (private.ai_use_permittable_classes())),
  permitted   boolean     not null,
  reason      text        not null check (length(btrim(reason)) between 1 and 1000),
  proposed_by uuid        not null,
  proposed_at timestamptz not null default clock_timestamp(),
  expires_at  timestamptz not null default clock_timestamp() + interval '7 days'
);
create index if not exists ai_use_proposal_by_scope
  on public.ai_use_proposal (tenant_id, module, data_class, proposed_at desc);

create table if not exists public.ai_use_approval (
  id          uuid        primary key default gen_random_uuid(),
  proposal_id uuid        not null unique references public.ai_use_proposal (id),
  approver    uuid        not null,
  decided_at  timestamptz not null default clock_timestamp()
);

-- ── 4. Every decision, kept ───────────────────────────────────────────────

create table if not exists public.ai_use_log (
  id            bigint      generated always as identity primary key,
  at            timestamptz not null default clock_timestamp(),
  tenant_id     text        not null references public.schools (id),
  -- Text as asked, so a refused request for an unknown module is still on record.
  module        text        not null check (length(module) between 1 and 100),
  data_class    text        not null check (length(data_class) between 1 and 100),
  actor_id      uuid,
  allowed       boolean     not null,
  reason        text        not null check (reason in (
                  'never_class', 'unknown_module', 'unknown_class', 'kill_switch',
                  'no_policy', 'denied_by_school', 'permitted_by_school')),
  provider_name text        not null default '' check (length(provider_name) <= 100),
  model_name    text        not null default '' check (length(model_name) <= 200),
  -- A never class, an unknown module or an unknown class is never allowed.
  constraint ai_use_log_allowed_means_permitted check (not allowed or reason = 'permitted_by_school')
);
create index if not exists ai_use_log_by_tenant_time on public.ai_use_log (tenant_id, at desc);

-- ── 5. The rules ──────────────────────────────────────────────────────────

create or replace function private.refuse_ai_use_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'The AI use policy and its log are append-only.' using errcode = '42501';
end $$;
revoke all on function private.refuse_ai_use_change() from public, anon, authenticated;

drop trigger if exists ai_use_proposal_immutable on public.ai_use_proposal;
create trigger ai_use_proposal_immutable before update or delete on public.ai_use_proposal
  for each row execute function private.refuse_ai_use_change();
drop trigger if exists ai_use_approval_immutable on public.ai_use_approval;
create trigger ai_use_approval_immutable before update or delete on public.ai_use_approval
  for each row execute function private.refuse_ai_use_change();
drop trigger if exists ai_use_log_immutable on public.ai_use_log;
create trigger ai_use_log_immutable before update or delete on public.ai_use_log
  for each row execute function private.refuse_ai_use_change();

-- Two people to turn AI on; one to turn it off.
create or replace function private.guard_ai_use_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.ai_use_proposal%rowtype;
begin
  select * into p from public.ai_use_proposal where id = new.proposal_id;
  if p.permitted then
    if p.proposed_by = new.approver then
      raise exception 'The person who proposed allowing AI cannot approve it.' using errcode = '42501';
    end if;
    if p.expires_at <= clock_timestamp() then
      raise exception 'That proposal expired; make a new one.' using errcode = '23514';
    end if;
  elsif p.proposed_by <> new.approver then
    raise exception 'Turning AI off is applied by the person who asked, not approved by another.' using errcode = '23514';
  end if;
  new.decided_at := clock_timestamp();
  return new;
end $$;
revoke all on function private.guard_ai_use_approval() from public, anon, authenticated;
drop trigger if exists ai_use_approval_guarded on public.ai_use_approval;
create trigger ai_use_approval_guarded before insert on public.ai_use_approval
  for each row execute function private.guard_ai_use_approval();

-- ── 6. Access ─────────────────────────────────────────────────────────────

alter table public.ai_use_proposal enable row level security;
alter table public.ai_use_approval enable row level security;
alter table public.ai_use_log enable row level security;

revoke all on table public.ai_use_proposal from public, anon, authenticated;
revoke all on table public.ai_use_approval from public, anon, authenticated;
revoke all on table public.ai_use_log from public, anon, authenticated;
grant select on table public.ai_use_proposal to authenticated;
grant select on table public.ai_use_approval to authenticated;
grant select on table public.ai_use_log to authenticated;

drop policy if exists "ai use readers read proposals" on public.ai_use_proposal;
create policy "ai use readers read proposals" on public.ai_use_proposal
  for select to authenticated
  using (private.has_capability('ai_use:read', 'school', tenant_id)
         or private.has_capability('ai_use:propose', 'school', tenant_id)
         or private.has_capability('ai_use:approve', 'school', tenant_id));

drop policy if exists "ai use readers read approvals" on public.ai_use_approval;
create policy "ai use readers read approvals" on public.ai_use_approval
  for select to authenticated
  using (exists (select 1 from public.ai_use_proposal p
                  where p.id = proposal_id
                    and (private.has_capability('ai_use:read', 'school', p.tenant_id)
                         or private.has_capability('ai_use:approve', 'school', p.tenant_id))));

drop policy if exists "ai use readers read the log" on public.ai_use_log;
create policy "ai use readers read the log" on public.ai_use_log
  for select to authenticated
  using (private.has_capability('ai_use:read', 'school', tenant_id));

-- ── 7. Writing a proposal, approving one ──────────────────────────────────

create or replace function public.ai_use_propose(
  want_tenant text, want_module text, want_class text, want_permitted boolean, want_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  new_id uuid;
begin
  if who is null or not private.has_capability('ai_use:propose', 'school', want_tenant) then
    raise exception 'Your account cannot change the AI use policy at this school.' using errcode = '42501';
  end if;
  if want_class = any (private.ai_use_never_classes()) then
    raise exception 'AI is never permitted on % data, at any school.', want_class using errcode = '23514';
  end if;
  if exists (select 1 from public.ai_use_proposal p
              where p.tenant_id = want_tenant and p.module = want_module and p.data_class = want_class
                and not exists (select 1 from public.ai_use_approval a where a.proposal_id = p.id)
                and p.expires_at > clock_timestamp()
                and p.permitted) then
    raise exception 'A proposal for that module and class is already waiting for a second person.' using errcode = '23505';
  end if;
  insert into public.ai_use_proposal (tenant_id, module, data_class, permitted, reason, proposed_by)
  values (want_tenant, want_module, want_class, want_permitted, want_reason, who)
  returning id into new_id;
  -- Reducing what AI may do waits for nobody.
  if not want_permitted then
    insert into public.ai_use_approval (proposal_id, approver) values (new_id, who);
  end if;
  return new_id;
end $$;

create or replace function public.ai_use_approve(want_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.ai_use_proposal%rowtype;
begin
  select * into p from public.ai_use_proposal where id = want_proposal for update;
  if not found or (select auth.uid()) is null
     or not private.has_capability('ai_use:approve', 'school', p.tenant_id) then
    raise exception 'Your account cannot approve AI use proposals at this school.' using errcode = '42501';
  end if;
  if exists (select 1 from public.ai_use_approval a where a.proposal_id = p.id) then
    raise exception 'That proposal is already decided.' using errcode = '23505';
  end if;
  insert into public.ai_use_approval (proposal_id, approver) values (p.id, (select auth.uid()));
end $$;

-- What is in force at a school, for the readers who may see it: one row per
-- module and permittable class that has ever been decided, newest decision.
create or replace function public.ai_use_policy(want_tenant text)
returns table (module text, data_class text, permitted boolean, reason text,
               proposed_by uuid, approved_by uuid, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null
     or not (private.has_capability('ai_use:read', 'school', want_tenant)
             or private.has_capability('ai_use:propose', 'school', want_tenant)
             or private.has_capability('ai_use:approve', 'school', want_tenant)) then
    raise exception 'Your account cannot read the AI use policy at this school.' using errcode = '42501';
  end if;
  return query
    select distinct on (p.module, p.data_class)
           p.module, p.data_class, p.permitted, p.reason, p.proposed_by, a.approver, a.decided_at
      from public.ai_use_proposal p
      join public.ai_use_approval a on a.proposal_id = p.id
     where p.tenant_id = want_tenant
     order by p.module, p.data_class, a.decided_at desc;
end $$;

-- ── 8. The question every AI entry point asks ─────────────────────────────

create or replace function public.ai_use_permitted(
  want_tenant text, want_module text, want_class text,
  want_actor uuid default null, want_provider text default '', want_model text default ''
) returns table (allowed boolean, reason text)
language plpgsql security definer set search_path = '' as $$
declare
  m text := lower(btrim(coalesce(want_module, '')));
  c text := lower(btrim(coalesce(want_class, '')));
  verdict text;
  policy boolean;
begin
  if not exists (select 1 from public.schools s where s.id = want_tenant) then
    -- No school, so nothing to log against. Denied all the same.
    return query select false, 'no_policy'::text;
    return;
  end if;

  if c = any (private.ai_use_never_classes()) then
    verdict := 'never_class';
  elsif m = '' or not (m = any (public.core_modules())) then
    verdict := 'unknown_module';
  elsif not (c = any (private.ai_use_permittable_classes())) then
    verdict := 'unknown_class';
  elsif public.kill_switch_engaged('kill.ai_generation', want_tenant) then
    verdict := 'kill_switch';
  else
    select x.permitted into policy
      from (select distinct on (p.module, p.data_class) p.permitted
              from public.ai_use_proposal p
              join public.ai_use_approval a on a.proposal_id = p.id
             where p.tenant_id = want_tenant and p.module = m and p.data_class = c
             order by p.module, p.data_class, a.decided_at desc) x;
    verdict := case when policy is null then 'no_policy'
                    when policy then 'permitted_by_school'
                    else 'denied_by_school' end;
  end if;

  insert into public.ai_use_log (tenant_id, module, data_class, actor_id, allowed, reason, provider_name, model_name)
  values (want_tenant, left(m, 100), left(c, 100), want_actor, verdict = 'permitted_by_school', verdict,
          left(coalesce(want_provider, ''), 100), left(coalesce(want_model, ''), 200));

  return query select verdict = 'permitted_by_school', verdict;
end $$;

-- ── 9. Grants ─────────────────────────────────────────────────────────────

revoke all on function public.ai_use_propose(text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.ai_use_approve(uuid) from public, anon, authenticated;
revoke all on function public.ai_use_policy(text) from public, anon, authenticated;
revoke all on function public.ai_use_permitted(text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_use_propose(text, text, text, boolean, text) to authenticated;
grant execute on function public.ai_use_approve(uuid) to authenticated;
grant execute on function public.ai_use_policy(text) to authenticated;
grant execute on function public.ai_use_permitted(text, text, text, uuid, text, text) to service_role;
grant select on table public.ai_use_log to service_role;

comment on table public.ai_use_proposal is
  'A school administrator''s proposal to allow or stop AI on one Core module''s data class. Append-only. Never classes cannot appear.';
comment on table public.ai_use_approval is
  'The second person''s yes to an allow proposal; a stop proposal is approved by its author at once. Append-only.';
comment on table public.ai_use_log is
  'One row per AI use decision: who, module, data class, allowed or denied and why, provider and model names as text. Never a prompt or a response. Append-only; retention not decided.';
