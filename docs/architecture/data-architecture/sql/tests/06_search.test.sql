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

insert into public.schools(id,name) values ('zz-a','School A'),('zz-b','School B');
select pg_temp.newuser('ann@a.test','zz-a') as ann \gset
select pg_temp.newuser('bo@a.test','zz-a') as bo \gset
select pg_temp.newuser('cy@a.test','zz-a') as cy \gset
select pg_temp.newuser('di@b.test','zz-b') as di \gset
insert into public.enrollments(user_id,term,code) values (:'ann','2026FA','zz-a/CS 101'),(:'cy','2026FA','zz-a/CS 101');
insert into private.account_ages(user_id, minor_until, under_minimum, source) values (:'ann',null,false,'statement'),(:'cy',null,false,'statement');
insert into public.role_grants(subject, role, scope_kind, scope_id, provenance) select (:'bo')::uuid, rc.role, 'school', 'zz-a', 'institution' from public.role_capabilities rc where rc.capability = 'review:moderate' limit 1;

insert into search.document(tenant_id,kind,source_id,owner_user_id,audience,audience_ref,classification,title,snippet_safe) values
 ('zz-a','event','e1',null,'tenant',null,'T0','Career fair','Tuesday in the union'),
 ('zz-a','course','c1',null,'course','2026FA/zz-a/CS 101','T1','Algorithms syllabus','Weekly problem sets'),
 ('zz-a','note','n1',(:'ann')::uuid,'owner',null,'T2','Ann private plan','only for ann'),
 ('zz-a','person','p-ann',(:'ann')::uuid,'person',null,'T1','Ann Example','shares CS101'),
 ('zz-a','review','r1',null,'capability','review:moderate','T1','Moderation queue item','pending'),
 ('zz-b','event','e2',null,'tenant',null,'T0','Career fair at B','other school');
-- T3 is refused at the table
do $$ begin
  begin insert into search.document(tenant_id,kind,source_id,audience,classification,title) values ('zz-a','grade','g1','tenant','T3','Final grade');
    raise exception 'FAIL T3 indexed'; exception when check_violation then null; end;
end $$;

-- helper: titles visible to a user for query 'a' style searches
create or replace function pg_temp.seen(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.become(who);
  select coalesce(string_agg(title, '|' order by title), '') into r from search.query(q);
  reset role; return r;
end $$;
select pg_temp.seen(:'ann','career') as a1 \gset
select pg_temp.seen(:'di','career')  as d1 \gset
select pg_temp.seen(:'ann','ann')    as a2 \gset
select pg_temp.seen(:'bo','ann')     as b2 \gset
select pg_temp.seen(:'cy','ann')     as c2 \gset
select pg_temp.seen(:'ann','algorithms') as a3 \gset
select pg_temp.seen(:'bo','algorithms')  as b3 \gset
select pg_temp.seen(:'bo','moderation')  as b4 \gset
select pg_temp.seen(:'ann','moderation') as a4 \gset
create temp table res(k text, v text);
insert into res values ('a1',:'a1'),('d1',:'d1'),('a2',:'a2'),('b2',:'b2'),('c2',:'c2'),('a3',:'a3'),('b3',:'b3'),('b4',:'b4'),('a4',:'a4');
do $$ declare function_ok boolean; begin
  if (select v from res where k='a1') <> 'Career fair'          then raise exception 'FAIL ann sees career: %', (select v from res where k='a1'); end if;
  if (select v from res where k='d1') <> 'Career fair at B'     then raise exception 'FAIL tenant isolation: di sees %', (select v from res where k='d1'); end if;
  if (select v from res where k='a2') <> 'Ann Example|Ann private plan' then raise exception 'FAIL ann sees own: %', (select v from res where k='a2'); end if;
  if (select v from res where k='b2') <> ''                     then raise exception 'FAIL bo (not a classmate) sees ann: %', (select v from res where k='b2'); end if;
  if (select v from res where k='c2') <> 'Ann Example'          then raise exception 'FAIL classmate sees person only: %', (select v from res where k='c2'); end if;
  if (select v from res where k='a3') <> 'Algorithms syllabus'  then raise exception 'FAIL enrolled sees course doc'; end if;
  if (select v from res where k='b3') <> ''                     then raise exception 'FAIL non-enrolled sees course doc'; end if;
  if (select v from res where k='b4') <> 'Moderation queue item' then raise exception 'FAIL capability holder cannot see'; end if;
  if (select v from res where k='a4') <> ''                     then raise exception 'FAIL non-holder sees capability doc'; end if;
end $$;

-- revocation is immediate: a block either way hides the person; withdrawing enrolment hides the course doc
insert into public.blocks(user_id, blocked) values ((:'cy')::uuid, (:'ann')::uuid);
select pg_temp.seen(:'cy','ann') as c3 \gset
delete from public.enrollments where user_id = (:'ann')::uuid;
select pg_temp.seen(:'ann','algorithms') as a5 \gset
-- minor: ann becomes a minor; classmates stop seeing her person document
delete from public.blocks;
insert into public.enrollments(user_id,term,code) values ((:'ann')::uuid,'2026FA','zz-a/CS 101');
select pg_temp.seen(:'cy','ann') as c3b \gset
update private.account_ages set minor_until = current_date + 365 where user_id = (:'ann')::uuid;
select pg_temp.seen(:'cy','ann') as c4 \gset
-- tombstone hides at once
select search.remove('zz-a','event','e1');
select pg_temp.seen(:'ann','career') as a6 \gset
create temp table res2(k text, v text);
insert into res2 values ('c3b',:'c3b'),('c3',:'c3'),('a5',:'a5'),('c4',:'c4'),('a6',:'a6');
do $$ begin
  if (select v from res2 where k='c3') <> '' then raise exception 'FAIL block did not hide person: %', (select v from res2 where k='c3'); end if;
  if (select v from res2 where k='a5') <> '' then raise exception 'FAIL dropped course still searchable'; end if;
  if (select v from res2 where k='c3b') <> 'Ann Example' then raise exception 'FAIL control: classmate cannot see an adult before the minor step: %', (select v from res2 where k='c3b'); end if;
  if (select v from res2 where k='c4') <> '' then raise exception 'FAIL minor visible to classmate'; end if;
  if (select v from res2 where k='a6') <> '' then raise exception 'FAIL tombstone did not hide'; end if;
end $$;

-- ranking tiers match the client: exact > prefix > word > substring
insert into search.document(tenant_id,kind,source_id,audience,classification,title) values
 ('zz-a','probe','x1','tenant','T0','math'),('zz-a','probe','x2','tenant','T0','mathematics'),('zz-a','probe','x3','tenant','T0','intro to math'),('zz-a','probe','x4','tenant','T0','pathmath');
select pg_temp.become((:'bo')::uuid);
do $$ declare r text; begin
  select string_agg(title || ':' || score, ',' order by score desc, title) into r from search.query('math', array['probe']);
  if r <> 'math:100,mathematics:80,intro to math:60,pathmath:40' then raise exception 'FAIL ranking tiers: %', r; end if;
  -- a wildcard in the query is literal
  if exists (select 1 from search.query('m%h', array['probe'])) then raise exception 'FAIL wildcard treated as pattern'; end if;
end $$;
reset role;
rollback;
\echo 06 OK
