-- 075_authority_guard.sql — PROPOSED. Enforces AUTH-001/003/005: a lower-authority source can't overwrite a higher one.
create or replace function semester_core.source_rank(s semester_core.source_type) returns int language sql immutable as $$
  select case s when 'institution_verified' then 6 when 'connected' then 5 when 'student_entered' then 4
                when 'estimated' then 3 when 'ai_assisted' then 2 when 'needs_review' then 1 end
$$;
create or replace function semester_core.authority_guard() returns trigger language plpgsql as $$
begin
  if semester_core.source_rank(new.source_type) < semester_core.source_rank(old.source_type) then
    insert into semester_core.audit_events (tenant_id, event_type, entity_type, entity_id, correlation_id)
      values (old.tenant_id, 'authority.conflict_blocked', tg_table_name, old.id::text, gen_random_uuid());
    raise exception 'AUTH-001: % cannot overwrite % on %', new.source_type, old.source_type, tg_table_name using errcode = '23514';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['students','courses','sections','enrollment_refs','holds','time_tickets','assignments'] loop
    execute format('drop trigger if exists authority_guard on semester_core.%I', t);
    execute format('create trigger authority_guard before update of source_type on semester_core.%I for each row execute function semester_core.authority_guard()', t);
  end loop; end $$;
-- Note: the raise rolls back the audit insert too. Adapters must catch 23514 and write a reconciliation_items row
-- (outside the failed transaction) so the conflict reaches needs_review — AUTH-005.
