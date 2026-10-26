\pset footer off
\echo '== 2.1 RLS / FORCE'
select n.nspname as schema, c.relname as tbl, pg_get_userbyid(c.relowner) as owner,
  case when not c.relrowsecurity then 'BLOCKER: RLS disabled' when not c.relforcerowsecurity then 'REVIEW: FORCE missing' else 'CHECKED' end as finding
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('iam','app','registrar','student_accounts','platform') and c.relkind in ('r','p') order by 1,2;
\echo '== 2.2 role attributes'
select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolcanlogin from pg_roles
where rolname in ('semester_owner','semester_api','semester_runtime_login') order by 1;
\echo '== 2.3 roles reachable by runtime login'
select r.rolname, r.rolsuper, r.rolbypassrls from pg_roles r where pg_has_role('semester_runtime_login', r.oid, 'MEMBER') order by 1;
\echo '== 2.4 tables owned by a role the runtime can reach (expect none)'
select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('iam','app','registrar','student_accounts','platform') and c.relkind in ('r','p') and pg_has_role('semester_runtime_login', c.relowner, 'MEMBER');
\echo '== 2.5 policies (permissive, roles, cmd)'
select tablename, policyname, permissive, roles, cmd from pg_policies where schemaname in ('iam','app','registrar','student_accounts','platform') order by 1,2;
\echo '== 2.5b policies with USING/WITH CHECK true (expect none)'
select tablename, policyname from pg_policies where schemaname in ('iam','app','registrar','student_accounts','platform') and (qual = 'true' or with_check = 'true');
\echo '== 2.6 SECURITY DEFINER functions (expect none)'
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('iam','app','registrar','student_accounts','platform') and p.prosecdef;
\echo '== 2.7 views (expect none)'
select n.nspname, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('iam','app','registrar','student_accounts','platform') and c.relkind in ('v','m');
\echo '== 2.7b table grants to semester_api / PUBLIC'
select grantee, table_schema||'.'||table_name as tbl, string_agg(privilege_type, ',' order by privilege_type) as privs
from information_schema.table_privileges where table_schema in ('iam','app','registrar','student_accounts','platform') and grantee in ('semester_api','PUBLIC')
group by 1,2 order by 1,2;
\echo '== 2.7c column grants to semester_api'
select table_name, column_name, privilege_type from information_schema.column_privileges
where table_schema='app' and grantee='semester_api' and privilege_type='UPDATE' order by 1,2;
