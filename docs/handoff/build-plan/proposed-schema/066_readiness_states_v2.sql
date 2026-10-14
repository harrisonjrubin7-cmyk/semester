-- 066_readiness_states_v2.sql — PROPOSED. Extends 065 to the 11-state contract (contracts/readiness-workflow.yaml).
-- Adds evaluating / reconciling / cancelled / failed, terminal states, and a generation counter so a late worker
-- result can't revive a cancelled or superseded evaluation (INV-RDY-006).
alter type semester_core.readiness_state add value if not exists 'evaluating';
alter type semester_core.readiness_state add value if not exists 'reconciling';
alter type semester_core.readiness_state add value if not exists 'cancelled';
alter type semester_core.readiness_state add value if not exists 'failed';
commit;  -- new enum values must be committed before use

alter table semester_core.readiness_cases add column if not exists generation int not null default 1;

truncate semester_core.readiness_transitions;
insert into semester_core.readiness_transitions values
 ('unknown','evaluating'),
 ('evaluating','ready'),('evaluating','blocked'),('evaluating','needs_review'),('evaluating','stale'),('evaluating','failed'),
 ('stale','evaluating'),
 ('needs_review','referred'),('referred','resolved'),
 ('reconciling','evaluating'),
 ('ready','evaluating'),('blocked','evaluating'),('needs_review','evaluating');   -- re-evaluation when inputs change
-- any non-terminal state -> reconciling / cancelled
insert into semester_core.readiness_transitions
  select s, t from unnest(array['unknown','evaluating','ready','blocked','needs_review','referred','stale','reconciling']::semester_core.readiness_state[]) s,
                  unnest(array['reconciling','cancelled']::semester_core.readiness_state[]) t
  where s <> t on conflict do nothing;

create or replace function semester_core.readiness_guard() returns trigger language plpgsql as $$
begin
  if old.state in ('resolved','cancelled','failed') and new.state is distinct from old.state then
    raise exception 'readiness case % is terminal (%)', old.id, old.state using errcode = '23514';
  end if;
  if new.state is distinct from old.state then
    if not exists (select 1 from semester_core.readiness_transitions t where t.from_state = old.state and t.to_state = new.state) then
      raise exception 'illegal readiness transition % -> %', old.state, new.state using errcode = '23514';
    end if;
    new.generation := old.generation + 1;           -- every transition bumps the generation
  end if;
  new.updated_at := now();
  return new;
end $$;
-- INV-RDY-004: every transition writes an audit event with a correlation id
create or replace function semester_core.readiness_audit() returns trigger language plpgsql as $$
begin
  if new.state is distinct from old.state then
    insert into semester_core.audit_events (tenant_id, actor_account_id, event_type, entity_type, entity_id, correlation_id)
      values (new.tenant_id, new.updated_by_account_id, 'readiness.transitioned', 'readiness_case', new.id::text,
              coalesce(nullif(current_setting('semester.correlation_id', true), '')::uuid, gen_random_uuid()));
  end if;
  return new;
end $$;
drop trigger if exists readiness_audit on semester_core.readiness_cases;
create trigger readiness_audit after update on semester_core.readiness_cases for each row execute function semester_core.readiness_audit();
-- semester.correlation_id is read for traceability only — it never grants access.
