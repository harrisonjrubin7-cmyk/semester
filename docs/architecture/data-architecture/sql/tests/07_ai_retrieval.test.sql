\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.become(who uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.newuser(address text, school text) returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values (who, split_part(address,'@',1), school);
  return who;
end $$;
create or replace function pg_temp.got(who uuid, purpose text, q text, course text default null) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.become(who);
  select coalesce(string_agg(title, '|' order by title), '') into r from ai.retrieve(purpose, q, course);
  reset role; return r;
end $$;

insert into public.schools(id,name) values ('zz-a','School A'),('zz-b','School B');
select pg_temp.newuser('ann@a.test','zz-a') as ann \gset
select pg_temp.newuser('bo@a.test','zz-a') as bo \gset
select pg_temp.newuser('kid@a.test','zz-a') as kid \gset
select pg_temp.newuser('di@b.test','zz-b') as di \gset
insert into private.account_ages(user_id, minor_until, under_minimum, source) values
  ((:'ann')::uuid,null,false,'statement'),((:'bo')::uuid,null,false,'statement'),((:'di')::uuid,null,false,'statement'),
  ((:'kid')::uuid, current_date + 800, false, 'statement');
insert into public.enrollments(user_id,term,code) values ((:'ann')::uuid,'2026FA','zz-a/CS 101');
insert into public.tenant_feature_policy(tenant_id, capability, state, permitted_roles, reason, permitted_cohorts)
  values ('zz-a','semester_intelligence','production','{}','proposal test','{}'),('zz-b','semester_intelligence','off','{}','proposal test','{}');

insert into ai.purpose(purpose,max_tier,allowed_audiences,allows_minor,requires_course,status) values
  ('study_coach','T2',array['owner','course','tenant'],false,false,'approved'),
  ('course_tutor','T1',array['course','tenant'],false,true,'approved'),
  ('kid_safe_help','T1',array['tenant'],true,false,'approved'),
  ('unapproved_x','T2',array['owner'],false,false,'draft');

insert into search.document(id,tenant_id,kind,source_id,owner_user_id,audience,audience_ref,classification,title) values
 ('00000000-0000-0000-0000-00000000d001','zz-a','note','n1',(:'ann')::uuid,'owner',null,'T2','Ann study note'),
 ('00000000-0000-0000-0000-00000000d002','zz-a','course','c1',null,'course','2026FA/zz-a/CS 101','T1','CS101 reading'),
 ('00000000-0000-0000-0000-00000000d003','zz-a','event','e1',null,'tenant',null,'T0','Orientation info'),
 ('00000000-0000-0000-0000-00000000d004','zz-a','note','n2',(:'ann')::uuid,'owner',null,'T2','Ann private ineligible'),
 ('00000000-0000-0000-0000-00000000d005','zz-a','note','n3',(:'ann')::uuid,'owner',null,'T2','Ann T2 note for tutor'),
 ('00000000-0000-0000-0000-00000000d006','zz-a','faq','f1',null,'tenant',null,'T2','Tenant T2 record-ish page');
insert into ai.chunk(document_id,chunk_ix,content,content_sha256,ai_eligible) values
 ('00000000-0000-0000-0000-00000000d001',0,'photosynthesis needs light',repeat('a',64),true),
 ('00000000-0000-0000-0000-00000000d002',0,'photosynthesis chapter in the course reading',repeat('b',64),true),
 ('00000000-0000-0000-0000-00000000d003',0,'photosynthesis workshop at orientation',repeat('c',64),true),
 ('00000000-0000-0000-0000-00000000d004',0,'photosynthesis secret diary',repeat('d',64),false),
 ('00000000-0000-0000-0000-00000000d005',0,'photosynthesis mnemonic',repeat('e',64),true),
 ('00000000-0000-0000-0000-00000000d006',0,'photosynthesis page classified T2',repeat('f',64),true);

create temp table r(k text, v text);
insert into r select 'ann_study', pg_temp.got((:'ann')::uuid,'study_coach','photosynthesis');
insert into r select 'bo_study',  pg_temp.got((:'bo')::uuid,'study_coach','photosynthesis');
insert into r select 'ann_tutor_nocourse', pg_temp.got((:'ann')::uuid,'course_tutor','photosynthesis');
insert into r select 'ann_tutor', pg_temp.got((:'ann')::uuid,'course_tutor','photosynthesis','2026FA/zz-a/CS 101');
insert into r select 'bo_tutor',  pg_temp.got((:'bo')::uuid,'course_tutor','photosynthesis','2026FA/zz-a/CS 101');
insert into r select 'kid_study', pg_temp.got((:'kid')::uuid,'study_coach','photosynthesis');
insert into r select 'kid_safe',  pg_temp.got((:'kid')::uuid,'kid_safe_help','photosynthesis');
insert into r select 'di_off',    pg_temp.got((:'di')::uuid,'study_coach','photosynthesis');
insert into r select 'ann_draft', pg_temp.got((:'ann')::uuid,'unapproved_x','photosynthesis');
do $$ begin
  if (select v from r where k='ann_study') <> 'Ann T2 note for tutor|Ann study note|CS101 reading|Orientation info|Tenant T2 record-ish page'
    then raise exception 'FAIL ann study_coach: %', (select v from r where k='ann_study'); end if;                 -- ineligible chunk absent
  if (select v from r where k='bo_study') <> 'Orientation info|Tenant T2 record-ish page'
    then raise exception 'FAIL bo sees another student''s notes or course doc: %', (select v from r where k='bo_study'); end if;
  if (select v from r where k='ann_tutor_nocourse') <> '' then raise exception 'FAIL requires_course not enforced'; end if;
  if (select v from r where k='ann_tutor') <> 'CS101 reading|Orientation info'
    then raise exception 'FAIL tutor must exclude every T2 row, including a tenant-audience one (max T1): %', (select v from r where k='ann_tutor'); end if;
  if (select v from r where k='bo_tutor') <> 'Orientation info'
    then raise exception 'FAIL non-enrolled saw course material: %', (select v from r where k='bo_tutor'); end if;
  if (select v from r where k='kid_study') <> '' then raise exception 'FAIL minor served a purpose that does not allow minors'; end if;
  if (select v from r where k='kid_safe') <> 'Orientation info' then raise exception 'FAIL minor-safe purpose: %', (select v from r where k='kid_safe'); end if;
  if (select v from r where k='di_off') <> '' then raise exception 'FAIL tenant with policy off retrieved'; end if;
  if (select v from r where k='ann_draft') <> '' then raise exception 'FAIL draft purpose served'; end if;
end $$;

-- gate reasons are specific
select pg_temp.become((:'di')::uuid);
select reason as why_di from ai.retrieval_gate('study_coach') \gset
reset role;
select pg_temp.become((:'kid')::uuid);
select reason as why_kid from ai.retrieval_gate('study_coach') \gset
reset role;
-- kill switch: engage globally, ann is refused with the right reason; then release and she is served again
insert into public.feature_kill_switch(tenant_id, switch_key, engaged, reason, engaged_at) values (null,'kill.ai_generation',true,'proposal test',now());
select pg_temp.got((:'ann')::uuid,'study_coach','photosynthesis') as killed \gset
select pg_temp.become((:'ann')::uuid);
select reason as why_killed from ai.retrieval_gate('study_coach') \gset
reset role;
update public.feature_kill_switch set engaged = false, engaged_at = null where switch_key = 'kill.ai_generation';
select pg_temp.got((:'ann')::uuid,'study_coach','photosynthesis') as released \gset
create temp table why(k text, v text);
insert into why values ('di',:'why_di'),('kid',:'why_kid'),('killed',:'why_killed'),('killed_result',:'killed'),('released',:'released');
do $$ begin
  if (select v from why where k='di') <> 'policy_off' then raise exception 'FAIL di reason %', (select v from why where k='di'); end if;
  if (select v from why where k='kid') <> 'age_not_cleared' then raise exception 'FAIL kid reason %', (select v from why where k='kid'); end if;
  if (select v from why where k='killed') <> 'kill_switch' then raise exception 'FAIL kill reason %', (select v from why where k='killed'); end if;
  if (select v from why where k='killed_result') <> '' then raise exception 'FAIL kill switch still served'; end if;
  if (select v from why where k='released') = '' then raise exception 'FAIL released switch did not restore service (control)'; end if;
end $$;

-- the log is service-only
select pg_temp.become((:'ann')::uuid);
do $$ begin
  begin insert into ai.retrieval_log(tenant_id,request_id,actor_sha256,purpose,gate_reason,chunks_returned)
        values ('zz-a','req-00000001',repeat('0',64),'study_coach','ok',1);
    raise exception 'FAIL a signed-in user wrote the retrieval log';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from ai.retrieval_log; raise exception 'FAIL a signed-in user read the retrieval log';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
insert into ai.retrieval_log(tenant_id,request_id,actor_sha256,purpose,gate_reason,chunks_returned,max_tier_returned,kinds_returned)
  values ('zz-a','req-00000001',repeat('0',64),'study_coach','ok',2,'T2',array['note','event']);   -- control: service may
reset role;
rollback;
\echo 07 OK
