-- Break-glass access is an override, and now it is logged as one.
--
-- 20260930120000_human_overrides.sql made one place for "a person overrode what
-- the system decided" and wired one producer, the academic record. Of the other
-- domains, exactly one has a real event in the schema today: a break-glass grant
-- (20260929110000_console_approvals_and_break_glass.sql) is a person being given
-- access their roles do not give them, after two others approved it. That is the
-- permission model being overridden on purpose, for at most four hours, and it
-- belongs in the same log and the same review as a corrected grade: three
-- break-glass grants under one rule in ninety days is a pattern a reviewer should
-- see, whoever opened them.
--
-- The other domains — moderation, credential, notification, integration,
-- migration, AI output — have no row today that *is* an override, and inventing
-- one to have something to log would be a claim, not a control. They keep the
-- direct path (`override:record`) and no producer. The Migration Center, for one,
-- has approvals and refusals and no exception concept.
--
-- ## It must not be able to fail
--
-- This trigger fires inside the function that opens the grant, and an emergency
-- must not be blocked by its own paperwork. So every value it writes is built to
-- satisfy `human_overrides`' checks by construction, not by hope: the ticket is
-- at least three characters and the evidence at least one, so the reason is
-- never shorter than the table's floor; the free text is cut to the table's
-- ceilings; the rule and the domain are literals. `human-overrides.check.sql`
-- opens a grant with the shortest inputs the grant table allows and the longest
-- scope, and requires the log row to exist.
--
-- It is not shown to the person given access (`student_visible` is false): this
-- is a record for reviewers, and it names an account, not a student's record.

create or replace function private.log_break_glass_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.approval_request;
begin
  select * into req from public.approval_request r where r.id = new.request_id;
  insert into public.human_overrides
    (tenant_id, domain, rule_ref, subject_ref, automated_outcome, final_outcome, reason,
     student_visible, explanation, source_ref, overridden_by, occurred_at)
  values
    (new.tenant_id, 'permission', 'break_glass.access', new.subject::text,
     'no access outside the account''s roles',
     left('access for at most four hours: ' || new.scope, 300),
     left(new.ticket || ': ' || coalesce(nullif(trim(req.evidence), ''), 'emergency access'), 1000),
     false, null, new.id::text,
     coalesce((select auth.uid()), req.requester), new.opened_at);
  return null;
end $$;

revoke all on function private.log_break_glass_override() from public, anon, authenticated;

drop trigger if exists log_break_glass_override on public.break_glass_grant;
create trigger log_break_glass_override after insert on public.break_glass_grant
  for each row execute function private.log_break_glass_override();

-- ── Rollback ──────────────────────────────────────────────────────────────
--
-- Additive. To undo: drop trigger log_break_glass_override on
-- public.break_glass_grant; drop function private.log_break_glass_override().
-- The override rows already written stay; they are append-only.
