-- A Migration Center stage move is told to the rest of the platform (P5-R6).
--
-- Until now a stage change left an audit row and nothing else: whatever should
-- react to a school passing cutover, or being sent back from validation, had to
-- poll `migration_projects`. The move now emits `migration.stage_changed`
-- through `private.emit_domain_event` in the same transaction, so the event
-- commits with the stage or not at all, and a refused move (which raises in
-- the before-trigger, ahead of this one) writes neither.
--
-- The payload says which project, which stages and which way, and the stage
-- clock it was entered at; it never carries the migration's name, the plan, the
-- dates or who moved it (the audit row has the actor, under its own policy).
-- The idempotency key is the move itself (from, to and the instant the new
-- stage was entered), so a retried statement cannot write it twice and a
-- second visit to the same stage is a second event.
--
-- `private.emit_domain_event` is not executable by a client role, so the
-- trigger function is a definer, like `audit_migration_change` beside it.
-- Nothing drains the outbox for this event yet; ADR 0008's first consumer is
-- still owed and is not claimed here.

create or replace function private.migration_stage_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  from_i integer := private.migration_stage_index(old.stage);
  to_i   integer := private.migration_stage_index(new.stage);
begin
  perform private.emit_domain_event(
    'migration_project', new.id::text, 'migration.stage_changed', 1,
    new.tenant_id, 'migration-center', 'migration:' || new.id::text,
    old.stage || '>' || new.stage || '@' || to_char(new.stage_entered_at at time zone 'UTC', 'YYYYMMDD"T"HH24MISSUS'),
    jsonb_build_object(
      'project', new.id, 'from', old.stage, 'to', new.stage,
      'direction', case when to_i > from_i then 'forward' else 'back' end,
      'entered_at', new.stage_entered_at),
    'internal', 'operational');
  return new;
end $$;
revoke all on function private.migration_stage_event() from public, anon, authenticated;

drop trigger if exists migration_projects_stage_event on public.migration_projects;
create trigger migration_projects_stage_event after update of stage on public.migration_projects
  for each row when (old.stage is distinct from new.stage)
  execute function private.migration_stage_event();
