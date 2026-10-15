-- Read-only catalog inventory. Run against a database to regenerate the figures in
-- database/*.md. Writes nothing. Do not add DDL here.
-- 1. Per-schema object posture
with t as (
 select n.nspname sch, c.relname tbl, c.relkind, c.relrowsecurity rls, c.relforcerowsecurity frls,
  (select count(*) from pg_policy p where p.polrelid=c.oid) pol,
  exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname in ('school_id','tenant_id','institution_id') and not a.attisdropped) has_tenant_col,
  has_table_privilege('anon',c.oid,'select,insert,update,delete') anon_any,
  has_table_privilege('authenticated',c.oid,'select') auth_sel,
  has_table_privilege('authenticated',c.oid,'insert,update,delete') auth_write
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind in ('r','p','v','m'))
select sch, relkind, count(*) n, count(*) filter (where rls) rls_on, count(*) filter (where frls) forced,
 count(*) filter (where pol=0 and rls) rls_nopolicy, count(*) filter (where has_tenant_col) tenant_col,
 count(*) filter (where anon_any) anon_any, count(*) filter (where auth_sel) auth_select,
 count(*) filter (where auth_write) auth_write
from t group by 1,2 order by 1,2;

-- 2. Tables anon can touch, with the policies that apply to PUBLIC. Note: a null USING on an
-- INSERT policy is not "true" -- do not coalesce it (that misread cost a false alarm once).
select c.relname, c.relkind::text,
 array(select privilege_type from information_schema.role_table_grants g
        where g.table_schema='public' and g.table_name=c.relname and g.grantee='anon' order by 1) anon_privs,
 c.reloptions::text
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m')
  and (has_table_privilege('anon',c.oid,'select,insert,update,delete') or c.relkind='v') order by 1;

-- 3. Insert/update policies with no WITH CHECK or a literal-true one, on anon-insertable tables.
select c.relname, p.polname, p.polcmd::text, p.polpermissive, pg_get_expr(p.polwithcheck,p.polrelid) wc
from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and p.polcmd in ('a','*','w') and has_table_privilege('anon',c.oid,'insert')
  and (p.polwithcheck is null or pg_get_expr(p.polwithcheck,p.polrelid)='true' or not p.polpermissive);

-- 4. SECURITY DEFINER posture. "no_visible_gate" is a REVIEW QUEUE, not a finding: the gate may be
-- a helper this regex does not name. Each row needs a human read of the body.
select n.nspname sch, count(*) fns, count(*) filter (where p.prosecdef) definer,
 count(*) filter (where p.prosecdef and has_function_privilege('anon',p.oid,'execute')) definer_anon_exec,
 count(*) filter (where p.prosecdef and has_function_privilege('authenticated',p.oid,'execute')) definer_auth_exec,
 count(*) filter (where p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')) definer_no_searchpath,
 count(*) filter (where p.prosecdef and exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')) definer_public_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f' group by 1 order by 1;

-- 5. Authenticated-executable definers with no regex-visible gate (the review queue).
select n.nspname||'.'||p.proname fn,
 pg_get_functiondef(p.oid) ~* 'raise exception|not authorized|insufficient' raises
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prokind='f' and p.prosecdef and n.nspname in ('public','private')
 and has_function_privilege('authenticated',p.oid,'execute')
 and pg_get_functiondef(p.oid) !~* 'auth\.uid\(\)|private\.(has_capability|holds_role|is_app_admin|org_can|in_org|in_class|in_group|verified_[a-z]+|school_of|same_school|mentors|classmate)\('
order by 1;

-- 6. Authenticated-writable tables with no tenant or owner-like column (needs a per-table read).
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and has_table_privilege('authenticated',c.oid,'insert,update,delete')
 and not exists(select 1 from pg_attribute a where a.attrelid=c.oid
   and a.attname in ('school_id','tenant_id','institution_id','user_id','student_id','owner','person_id') and not a.attisdropped)
order by 1;

-- 7. The rule-based classification behind schema/table-classification.json. Heuristic: the 19 objects
-- it labels 'needs-review' were resolved by reading their policies. Re-run, diff against the register,
-- and read any new 'needs-review' before adding it.
with t as (
 select n.nspname sch, c.relname tbl, c.relkind::text kind,
  coalesce((select string_agg(a.attname,',') from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attname in ('school_id','tenant_id','institution_id')),'') tc,
  coalesce((select string_agg(a.attname,',') from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attname in ('user_id','student_id','owner','person_id','account_id','created_by','recipient_id')),'') oc,
  (select count(*) from pg_policy p where p.polrelid=c.oid) pol,
  exists(select 1 from pg_policy p where p.polrelid=c.oid and coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ 'auth\.uid') uid_pol,
  exists(select 1 from pg_policy p where p.polrelid=c.oid and coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ 'private\.|_can\(|has_capability') helper_pol,
  exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polcmd='r' and pg_get_expr(p.polqual,p.polrelid)='true') read_true,
  has_table_privilege('anon',c.oid,'select') anon_sel,
  has_table_privilege('authenticated',c.oid,'select,insert,update,delete') auth_any
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private') and c.relkind in ('r','p','v','m'))
select case when kind in ('v','m') then 'view'
 when not anon_sel and not auth_any then 'service-only'
 when tc<>'' and pol>0 then 'tenant-scoped'
 when anon_sel and read_true then 'global-public'
 when oc<>'' and uid_pol then 'person-private'
 when helper_pol then 'relationship-scoped'
 else 'needs-review' end cls, count(*) n, string_agg(sch||'.'||tbl, ',' order by sch, tbl) names
from t group by 1 order by 1;
