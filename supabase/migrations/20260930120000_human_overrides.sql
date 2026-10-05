-- One place where a person overrides what the system decided, and one way to
-- see whether they keep doing it.
--
-- Semester automates some decisions and lets a person overrule them: the
-- registrar's correction of a grade already on the record, and — as the other
-- domains are wired — a moderation ruling, a credential issued past its rules,
-- a permission granted outside the usual, an integration or migration
-- exception. Each of those already leaves *some* trace in its own table.
-- What nothing did was put them side by side, so nobody could ask the question
-- an override exists to raise: is this one person exercising judgement, or is
-- the rule wrong?
--
--   1. `human_overrides` is append-only. Every row names the domain, the rule
--      that was overridden, what the system had decided and what the person
--      decided instead, who, and why. The reason is required.
--   2. A row a student is entitled to understand carries a plain-language
--      explanation, and a row cannot be marked student-visible without one.
--      For the academic record the student reads their own ledger already;
--      this makes the same fact reachable from the one place overrides live.
--   3. `override_patterns` is the review: per school, domain and rule, how many
--      overrides, by how many people, and whether three or more in the last 90
--      days make it **recurring** — the signal that the rule, not the case, is
--      what needs looking at. It is visible to whoever holds `override:review`
--      and to no one else.
--   4. **What is wired today: the academic record here, and break-glass access
--      in 20260930160000_override_break_glass.sql.** A trigger logs every
--      ledger entry marked `override` (`private.log_record_override`), so the
--      log cannot be skipped by a client that forgets to call it. The other
--      domains have the direct path (`override:record`, not for the academic
--      record) and no producer, because no row in the schema is yet an override
--      in those domains; each is one trigger or one call away and is listed as
--      owed in `RETENTION.md` and the maturity register.
--
-- What this is not: an approval workflow (the console's two-person approvals
-- and the ledger's approver rule stay where they are), and not a judgement of
-- the person — the pattern view counts, it does not conclude.

-- ── 1. Who may do what ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('override:record', 'Record that a person overrode an automated decision in one school, outside the academic record, which logs its own. Never approves anything.'),
  ('override:review', 'Read every override logged in one school and the pattern view over them.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar',        'override:record'),
  ('registrar',        'override:review'),
  ('university_admin', 'override:review')
on conflict (role, capability) do nothing;

-- ── 2. The table ──────────────────────────────────────────────────────────

create table if not exists public.human_overrides (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null references public.schools(id) on delete cascade,
  domain            text        not null check (domain in (
                      'academic_record', 'moderation', 'credential', 'notification',
                      'permission', 'integration', 'migration', 'ai_output')),
  -- What was overridden, at the grain a pattern is worth counting at: a rule,
  -- a kind of decision. Not a person and not a case.
  rule_ref          text        not null check (rule_ref ~ '^[a-z0-9_.:-]{1,80}$'),
  -- The subject: a student reference for the academic record, an account id
  -- (as text) elsewhere. Opaque; nothing is derived from it here.
  subject_ref       text        not null check (length(trim(subject_ref)) between 1 and 200),
  automated_outcome text        not null check (length(automated_outcome) <= 300),
  final_outcome     text        not null check (length(trim(final_outcome)) between 1 and 300),
  reason            text        not null check (length(trim(reason)) between 3 and 1000),
  student_visible   boolean     not null default false,
  explanation       text        check (explanation is null or length(trim(explanation)) between 1 and 1000),
  -- The row this came from, when there is one: the ledger entry, the ruling.
  source_ref        text        check (source_ref is null or length(source_ref) <= 200),
  overridden_by     uuid        references auth.users(id) on delete set null,
  occurred_at       timestamptz not null default now(),
  -- Visible to a student only with words a student can read.
  constraint override_visible_is_explained check (not student_visible or explanation is not null)
);

create index if not exists human_overrides_by_tenant on public.human_overrides (tenant_id, domain, rule_ref, occurred_at desc);
create index if not exists human_overrides_by_person on public.human_overrides (overridden_by);

-- ── 3. Append-only, except for the person an account deletion clears ──────

create or replace function private.human_overrides_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'overridden_by') = (to_jsonb(old) - 'overridden_by')
     and new.overridden_by is null then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  raise exception 'An override is a record and is not edited or deleted.' using errcode = '42501';
end $$;

revoke all on function private.human_overrides_append_only() from public, anon, authenticated;

drop trigger if exists human_overrides_append_only on public.human_overrides;
create trigger human_overrides_append_only before update or delete on public.human_overrides
  for each row execute function private.human_overrides_append_only();

-- ── 4. Row-level security ─────────────────────────────────────────────────

alter table public.human_overrides enable row level security;

-- Reviewers read the school's overrides; a student reads only the ones that
-- are theirs and were marked for them to understand.
drop policy if exists human_overrides_read on public.human_overrides;
create policy human_overrides_read on public.human_overrides for select to authenticated
  using (
    private.has_capability('override:review', 'school', tenant_id)
    or (
      student_visible
      and (
        (domain = 'academic_record' and exists (
          select 1 from public.academic_record_subjects s
           where s.tenant_id = human_overrides.tenant_id
             and s.student_ref = human_overrides.subject_ref
             and s.user_id = (select auth.uid())))
        or (domain <> 'academic_record' and subject_ref = (select auth.uid())::text)
      )
    )
  );

-- The direct path, for the domains that have no producer yet. Never for the
-- academic record, which logs its own by trigger and would otherwise be
-- countable twice or, worse, countable when nothing was overridden.
drop policy if exists human_overrides_record on public.human_overrides;
create policy human_overrides_record on public.human_overrides for insert to authenticated
  with check (
    domain <> 'academic_record'
    and overridden_by = (select auth.uid())
    and private.has_capability('override:record', 'school', tenant_id)
  );

revoke all on table public.human_overrides from public, anon, authenticated;
grant select, insert on table public.human_overrides to authenticated;

-- ── 5. The academic record logs its own ───────────────────────────────────

create or replace function private.log_record_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.human_overrides
    (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason,
     student_visible, explanation, source_ref, overridden_by, occurred_at)
  values
    (new.tenant_id, 'academic_record', new.kind, new.student_ref,
     coalesce(new.previous_value, ''),
     -- A void carries an empty value; what was decided is that it was removed.
     case when new.action = 'void' then 'removed from the record' else new.value end,
     new.reason,
     true,
     case when new.action = 'void' then
       format('A registrar removed the %s for %s (it was %s). The reason given: %s',
              replace(new.kind, '_', ' '), new.subject_key,
              coalesce(nullif(new.previous_value, ''), 'nothing on record'), new.reason)
     else
       format('A registrar corrected the %s for %s from %s to %s. The reason given: %s',
              replace(new.kind, '_', ' '), new.subject_key,
              coalesce(nullif(new.previous_value, ''), 'nothing on record'), new.value, new.reason)
     end,
     new.id::text, new.approved_by, new.recorded_at);
  return null;
end $$;

revoke all on function private.log_record_override() from public, anon, authenticated;

drop trigger if exists log_record_override on public.academic_record_entries;
create trigger log_record_override after insert on public.academic_record_entries
  for each row when (new.override) execute function private.log_record_override();

-- ── 6. The review ─────────────────────────────────────────────────────────
--
-- Whether an override is "recurring" is a count, not a verdict: three or more
-- in the last 90 days under one rule. The view answers only to whoever holds
-- `override:review` over the school, because a count of a person's overrides
-- is a thing to read with the context that reviewers have and no one else does.

create or replace view public.override_patterns with (security_invoker = true) as
select o.tenant_id,
       o.domain,
       o.rule_ref,
       count(*)                                        as overrides,
       count(distinct o.overridden_by)                 as people,
       min(o.occurred_at)                              as first_at,
       max(o.occurred_at)                              as last_at,
       count(*) filter (where o.occurred_at > now() - interval '90 days') as last_90_days,
       count(*) filter (where o.occurred_at > now() - interval '90 days') >= 3 as recurring
  from public.human_overrides o
 where private.has_capability('override:review', 'school', o.tenant_id)
 group by o.tenant_id, o.domain, o.rule_ref;

revoke all on table public.override_patterns from public, anon, authenticated;
grant select on table public.override_patterns to authenticated;

comment on table public.human_overrides is
  'Every time a person overrode an automated decision, and why. Append-only. The academic record logs its own by trigger; other domains use override:record until they have a producer. See 20260930120000_human_overrides.sql.';

-- ── Rollback ──────────────────────────────────────────────────────────────
--
-- Additive. To undo: drop view public.override_patterns; drop trigger
-- log_record_override on public.academic_record_entries; drop function
-- private.log_record_override(); drop table public.human_overrides (which
-- discards the log); delete the two capabilities.
