\set ON_ERROR_STOP on
begin;
-- add_provenance + the connected-row completeness rule, with a control row that passes
create table public.zz_t (id int primary key, v text);
select private.add_provenance('public.zz_t');
insert into public.zz_t(id,v,source_kind,source_ref,source_observed_at,ingested_at) values (1,'ok','connected_institutional','sis:123',now(),now());   -- control: passes
insert into public.zz_t(id,v,source_kind) values (2,'ok','user_entered');                                                                         -- passes
do $$ begin
  begin insert into public.zz_t(id,v,source_kind) values (3,'bad','connected_institutional'); raise exception 'FAIL: incomplete connected row accepted';
  exception when check_violation then null; end;
  begin insert into public.zz_t(id,v,source_kind) values (4,'bad','scraped'); raise exception 'FAIL: unknown source kind accepted';
  exception when invalid_text_representation or check_violation then null; end;
end $$;

-- lineage: a -> b -> c, plus a cycle c -> a, must terminate and report depth
insert into public.schools(id,name) values ('zz-school','ZZ School');
insert into public.lineage_edge(tenant_id,derived_kind,derived_id,input_kind,input_id,derivation,derivation_version) values
 ('zz-school','assignment','b','enrollment','a','due_rollup',1),
 ('zz-school','today_action','c','assignment','b','action_from_deadline',1),
 ('zz-school','enrollment','a','today_action','c','cycle_probe',1);
do $$ declare n int; d int; begin
  select count(*), max(depth) into n, d from private.downstream_of('zz-school','enrollment','a');
  if n <> 3 or d <> 3 then raise exception 'FAIL: downstream_of returned % rows, max depth % (want 3,3)', n, d; end if;
  select count(*) into n from private.downstream_of('other','enrollment','a');
  if n <> 0 then raise exception 'FAIL: lineage crossed tenants (% rows)', n; end if;
end $$;

-- precedence: platform floor, tenant override replaces wholesale, student-owned flag present
do $$ declare w text; begin
  w := private.winning_source('zz-school','assignment','due_date', array['user_entered','derived']::private.source_kind[]);
  if w <> 'derived' then raise exception 'FAIL: want derived over user_entered, got %', w; end if;
  insert into private.source_precedence(tenant_id,entity_type,field_group,rank,source_kind) values
    ('zz-school','assignment','due_date',1,'user_entered');
  w := private.winning_source('zz-school','assignment','due_date', array['user_entered','derived']::private.source_kind[]);
  if w <> 'user_entered' then raise exception 'FAIL: tenant override ignored, got %', w; end if;
  w := private.winning_source('zz-school','assignment','due_date', array['connected_institutional']::private.source_kind[]);
  if w is not null then raise exception 'FAIL: partial override leaked a platform row, got %', w; end if;
end $$;

-- enrollment reconciliation: four students, four situations, and the control that a plain declared row is unverified
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000e1'),('00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000e3'),('00000000-0000-0000-0000-0000000000e4');
insert into public.registration_terms(tenant_id, term, opens_at, add_drop_ends_at, withdraw_ends_at, max_credits)
  values ('zz-school','2026FA', now() - interval '30 days', now() + interval '30 days', now() + interval '60 days', 18);
insert into public.registration_sections(tenant_id, term, course_code, section, title, credits, capacity, waitlist_capacity, meetings)
  values ('zz-school','2026FA','CS 101','001','Algorithms',3,30,5,'[]');
insert into public.enrollments(user_id, term, code) values
  ('00000000-0000-0000-0000-0000000000e1','2026FA','zz-school/CS 101'),      -- e1: declared only
  ('00000000-0000-0000-0000-0000000000e2','2026FA','zz-school/CS 101'),      -- e2: declared and registrar enrolled
  ('00000000-0000-0000-0000-0000000000e3','2026FA','zz-school/CS 101');      -- e3: declared, registrar says dropped
insert into public.registration_enrollments(tenant_id, section_id, student, state)
  select 'zz-school', s.id, u.id, u.st from public.registration_sections s,
   (values ('00000000-0000-0000-0000-0000000000e2'::uuid,'enrolled'),
           ('00000000-0000-0000-0000-0000000000e3'::uuid,'dropped')) u(id, st)
   where s.tenant_id = 'zz-school' and s.course_code = 'CS 101';
insert into public.registration_enrollments(tenant_id, section_id, student, state, wait_seq)
  select 'zz-school', s.id, '00000000-0000-0000-0000-0000000000e4', 'waitlisted', 1 from public.registration_sections s
   where s.tenant_id = 'zz-school' and s.course_code = 'CS 101';
do $$ declare r text; begin
  select string_agg(right(user_id::text,2) || ':' || status || ':' || conflict::text || ':' || coalesce(winning_source,'-'), ' ' order by user_id)
    into r from private.enrollment_reconciled where tenant_id = 'zz-school';
  if r <> 'e1:unverified:false:user_entered e2:official_enrolled:false:connected_institutional e3:official_not_enrolled:true:connected_institutional e4:official_pending:false:connected_institutional'
  then raise exception 'FAIL enrollment reconciliation: %', r; end if;
end $$;

-- vocabulary crosswalk: complete against the live CHECK constraints (control), and drift is caught
do $$ declare n int; begin
  select count(*) into n from private.source_vocabulary_gaps();
  if n <> 0 then raise exception 'FAIL crosswalk misses live values: %', (select string_agg(vocabulary || ':' || value, ',') from private.source_vocabulary_gaps()); end if;
  -- the detector is not blind: a value removed from the crosswalk is reported
  delete from private.source_vocabulary where vocabulary = 'source_type' and value = 'external_link';
  if (select string_agg(vocabulary || ':' || value, ',') from private.source_vocabulary_gaps()) is distinct from 'source_type:external_link'
  then raise exception 'FAIL gap not reported for a removed crosswalk row'; end if;
  -- and a NEW value in a live CHECK is reported (planted on a scratch table that uses the real column name)
  insert into private.source_vocabulary values ('source_type','external_link','link','external_link', null);
  create table public.zz_vocab (source_label text check (source_label in ('student_entered','scraped_from_web')));
  if (select string_agg(vocabulary || ':' || value, ',') from private.source_vocabulary_gaps()) is distinct from 'source_label:scraped_from_web'
  then raise exception 'FAIL new vocabulary value not reported: %', (select string_agg(vocabulary || ':' || value, ',') from private.source_vocabulary_gaps()); end if;
end $$;
rollback;
\echo 02 OK
