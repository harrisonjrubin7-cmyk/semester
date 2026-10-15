-- Extra pgTAP checks for the review patch. Append inside the uploaded test transaction (same fixtures), before rollback.
-- Assumes the fixture ids from university_rls_tests.sql; adjust names to match.
select ok((select relforcerowsecurity from pg_class where oid = 'public.education_records'::regclass), 'education_records forces RLS');
select throws_ok($$truncate private.audit_events$$, '55000', null, 'audit_events cannot be truncated');
select throws_ok($$insert into public.education_records(id,tenant_id,student_id,kind,body) values (gen_random_uuid(),'af29fc27-8fd0-4e8c-9e89-3e532bbf6de8',(select id from private.students limit 1),'advising','"x"'::jsonb)$$, '23514', null, 'body must be a JSON object');
-- Registrar with a tenant scope sees published grades in its tenant without per-record rows, but never restricted_support
-- and never another tenant: set the registrar's claims as the uploaded tests do, then
--   select ok(count(*) > 0) from public.education_records where kind = 'grade_published';
--   select is_empty($$select 1 from public.education_records where kind = 'restricted_support'$$);
--   select is_empty($$select 1 from public.education_records where tenant_id = '5a0df70b-402d-4414-9d2c-9e94d02571bd'$$);
