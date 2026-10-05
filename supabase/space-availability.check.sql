-- Room availability is a mapping target, and only one check guards the list.
--
-- 20260928041700 replaces integration_mappings' canonical_entity_type check by
-- name. If the name had been wrong, `drop constraint if exists` would have
-- done nothing silently and the old check would still refuse
-- 'space_availability' beside the new one. So this counts the checks rather
-- than trusting the name.
--
--   How to run it: supabase/check.sh space-availability

begin;

do $$
declare n bigint; def text;
begin
  select count(*) into n from pg_constraint
   where conrelid = 'public.integration_mappings'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%canonical_entity_type%';
  if n <> 1 then raise exception 'FAILED: % checks on canonical_entity_type, expected exactly one', n; end if;
  raise notice 'ok  exactly one check guards canonical_entity_type';

  select pg_get_constraintdef(oid) into def from pg_constraint
   where conrelid = 'public.integration_mappings'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%canonical_entity_type%';
  if def not like '%''space_availability''%' then raise exception 'FAILED: space_availability is not an allowed mapping target'; end if;
  raise notice 'ok  space_availability is an allowed mapping target';
  -- The control: a list that allowed anything would pass the line above.
  if def not like '%''lms_context''%' or def like '%''booked_by''%' then raise exception 'FAILED: the list lost an entity or gained a person'; end if;
  raise notice 'ok  and the list is still closed — THE CONTROL';
end $$;

rollback;
