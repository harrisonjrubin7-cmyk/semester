-- Sending a migration back says why (P5-R5).
--
-- A migration may go back to any earlier stage until cutover, and doing so
-- restarts the evidence of every stage it re-enters. Until now a person could
-- do that with one click and nothing recorded why, so the audit trail showed a
-- migration moving back and the reader, months later, had no account of it.
--
-- A back-move now arrives with a reason of 10 to 500 characters, kept on the
-- migration as `stage_back_reason` and copied into the audit row with the rest
-- of the record. The reason must be new: the same words as the last back-move
-- explain nothing about this one. A forward move clears it, so the column
-- always answers "why was it last sent back" for the current run of stages;
-- earlier reasons live in the audit trail. A client cannot write the column
-- without moving back: any other update leaves it as it was. The past-cutover
-- refusal stays first, so a migration that cannot go back says that, not that
-- it lacks a reason.
--
-- The reason is free text a person wrote, so it stays out of the
-- `migration.stage_changed` event, which carries no words, only stages.
--
-- Everything else in `migration_project_guard` is unchanged from
-- 20260929200000.

alter table public.migration_projects
  add column if not exists stage_back_reason text;

alter table public.migration_projects
  drop constraint if exists migration_projects_back_reason_shape;
alter table public.migration_projects
  add constraint migration_projects_back_reason_shape
  check (stage_back_reason is null or length(btrim(stage_back_reason)) between 10 and 500);

create or replace function private.migration_project_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  owed text[];
  from_i int;
  to_i int;
begin
  -- Each area named once: ['it', 'it'] is one area, and the cutover gate needs two.
  if (select count(distinct a) from unnest(new.required_approvals) a) <> cardinality(new.required_approvals) then
    raise exception 'Each approval area is named once.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.stage := 'inventory';
    new.stage_entered_at := clock_timestamp();
    new.stage_back_reason := null;
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- Account deletion clearing the creator is not a change to the migration.
  if new.created_by is null and old.created_by is not null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'A migration stays with its school.' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Who created a migration is not changed.' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.stage is distinct from old.stage then
    from_i := private.migration_stage_index(old.stage);
    to_i := private.migration_stage_index(new.stage);
    if to_i = from_i + 1 then
      owed := private.migration_gate_failures(old);
      if cardinality(owed) > 0 then
        raise exception 'This migration cannot move to % yet: %', new.stage, array_to_string(owed, ', ')
          using errcode = '23514';
      end if;
      new.stage_back_reason := null;
    elsif to_i < from_i then
      if from_i > private.migration_stage_index('cutover') then
        raise exception 'A migration past cutover does not go back; roll back with the plan and open a new migration.'
          using errcode = '23514';
      end if;
      if new.stage_back_reason is null or btrim(new.stage_back_reason) = '' then
        raise exception 'A migration sent back needs a reason: say why it is going back to %.', new.stage
          using errcode = '23514';
      end if;
      new.stage_back_reason := btrim(new.stage_back_reason);
      if length(new.stage_back_reason) < 10 then
        raise exception 'The reason for going back is at least 10 characters.' using errcode = '23514';
      end if;
      if length(new.stage_back_reason) > 500 then
        raise exception 'The reason for going back is at most 500 characters.' using errcode = '23514';
      end if;
      if new.stage_back_reason is not distinct from old.stage_back_reason then
        raise exception 'Give a new reason: the last move back already said this.' using errcode = '23514';
      end if;
    else
      raise exception 'A migration moves forward one stage at a time.' using errcode = '23514';
    end if;
    new.stage_entered_at := clock_timestamp();
  else
    -- Not a move: the reason is the last move's, not the client's to rewrite.
    new.stage_back_reason := old.stage_back_reason;
    if (to_jsonb(new) - array['name', 'updated_at', 'stage_entered_at'])
       <> (to_jsonb(old) - array['name', 'updated_at', 'stage_entered_at']) then
      -- A material edit within a stage — a new cutover date, a different
      -- rollback plan — restarts the stage's clock: evidence and approvals
      -- recorded before it were about something else, and are recorded again.
      new.stage_entered_at := clock_timestamp();
    else
      new.stage_entered_at := old.stage_entered_at;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.migration_project_guard() from public, anon, authenticated;
