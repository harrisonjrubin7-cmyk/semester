-- Disposable/local database only, after applying the source-scope migration.
-- Constraint coverage; existing source:approve RLS is unchanged.
begin;

insert into public.schools (id, name, email_domains)
values ('source-scope-check', 'Source Scope Check', array['source-scope-check.example']);
insert into public.approved_source (tenant_id, course_id, title, origin, authority)
values ('source-scope-check', 'econ', 'Scope fixture', 'course', 'authoritative');

create function pg_temp.invalid_scope(label text, scope text, code text, term text, source_origin text default 'course')
returns void language plpgsql as $$
begin
  begin
    update public.approved_source
       set policy_scope = scope, policy_course_code = code, policy_term = term, origin = source_origin
     where tenant_id = 'source-scope-check';
  exception when check_violation then
    raise notice 'ok: % refused', label;
    return;
  end;
  raise exception 'FAIL: % was accepted', label;
end $$;

select pg_temp.invalid_scope('null scope with code', null, 'ECON 101', null);
select pg_temp.invalid_scope('course without code', 'course', null, '2026FA');
select pg_temp.invalid_scope('course without term', 'course', 'ECON 101', null);
select pg_temp.invalid_scope('course without either field', 'course', null, null);
select pg_temp.invalid_scope('opaque course code', 'course', 'econ', '2026FA');
select pg_temp.invalid_scope('invalid term', 'course', 'ECON 101', 'autumn');
select pg_temp.invalid_scope('term unsupported by course policy', 'course', 'ECON 101', '2026WI');
select pg_temp.invalid_scope('unknown scope', 'other', null, null);
select pg_temp.invalid_scope('academic source classified institution', 'institution', null, null);
select pg_temp.invalid_scope('institution scope with course', 'institution', 'ECON 101', null, 'institution');
select pg_temp.invalid_scope('institution scope with term', 'institution', null, '2026FA', 'library');

update public.approved_source set policy_scope = 'course', policy_course_code = 'ECON 101', policy_term = '2026FA'
where tenant_id = 'source-scope-check';
do $$ begin
  if not exists (select 1 from public.approved_source where tenant_id = 'source-scope-check'
    and course_id = 'econ' and policy_course_code = 'ECON 101' and policy_term = '2026FA') then
    raise exception 'FAIL: canonical binding did not preserve the opaque source ID';
  end if;
  raise notice 'ok: canonical binding preserves the opaque source ID';
end $$;

update public.approved_source set origin = 'institution', policy_scope = 'institution', policy_course_code = null, policy_term = null
where tenant_id = 'source-scope-check';
update public.approved_source set policy_scope = null where tenant_id = 'source-scope-check';

-- Valid binding, explicit non-course scope, and legacy
-- null state must remain storable. Generation separately refuses that last state.
rollback;
