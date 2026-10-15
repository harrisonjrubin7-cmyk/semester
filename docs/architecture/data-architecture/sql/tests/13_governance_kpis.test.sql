\set ON_ERROR_STOP on
begin;
-- Delta test: record the view, plant one of each thing, and require each column to move by exactly the planted amount.
create temp table before_k as select * from private.governance_kpis;
insert into public.schools(id,name) values ('zz-a','School A');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000f1'),('00000000-0000-0000-0000-0000000000f2');

insert into private.data_registry(table_schema,table_name,domain,record_class,review_state) values
  ('public','zz_kpi_orphan','academic','tenant_record','proposed');                                   -- +1 row, +1 orphan
insert into private.convention_exemption values
  ('public','zz_kpi_orphan','updated_at','kpi test live exemption with a reason', current_date + 10),   -- +1 live, +1 expiring
  ('public','zz_kpi_orphan','created_at','kpi test expired exemption with reason', current_date - 5);   -- +1 expired
insert into private.hold_exemption values ('public.zz_kpi_gap','kpi test: a known gap parked for ninety days','known_gap', current_date + 90);
insert into private.dq_rule(rule_id,table_schema,table_name,kind,params,severity,steward) values
  ('kpi.never_run','public','schools','row_count','{"min":0}','warn','Test steward'),
  ('kpi.runs_and_fails','public','schools','row_count','{"min":9999}','block','Test steward');
select private.dq_run_rule('kpi.runs_and_fails');                                                       -- +1 enabled run, +1 blocking failed
insert into public.legal_holds(subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant','zz-a','zz-a','kpi test hold','KPI-1','00000000-0000-0000-0000-0000000000f1');       -- +1 active hold
-- negative plants: a RELEASED hold and a RESOLVED overdue request must not count (otherwise the filter is untested)
insert into public.legal_holds(subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant','zz-a','zz-a','kpi released hold','KPI-0','00000000-0000-0000-0000-0000000000f1');
update public.legal_holds set released_by = '00000000-0000-0000-0000-0000000000f2', released_at = now(), release_reason = 'matter closed'
  where matter_ref = 'KPI-0';                                -- a release is recorded by update (an insert cannot arrive released)
insert into public.data_subject_request(subject, tenant_id, kind, requested_by, status, received_at, due_at, resolved_at, resolution)
  values ('00000000-0000-0000-0000-0000000000f1','zz-a','export','self','completed', now() - interval '50 days', now() - interval '20 days', now() - interval '25 days', 'done');
insert into public.data_subject_request(subject, tenant_id, kind, requested_by, status, received_at, due_at)
  values ('00000000-0000-0000-0000-0000000000f1','zz-a','erasure','self','received', now() - interval '40 days', now() - interval '10 days');   -- +1 overdue
insert into private.restore_event(kind, environment, restore_point, restored_at, sweeps_run_at, accounts_notified_at)
  values ('pitr','production', now() - interval '3 hours', now() - interval '2 hours', now(), now());   -- rpo = 1 hour
insert into private.domain_outbox_events(aggregate_type,aggregate_id,event_type,event_version,environment,producer,correlation_id,payload,data_classification,retention_class)
  values ('t','kpi-1','zz.probe',1,'staging','test','corr-kpi-0001','{}','internal','operational'),
         ('t','kpi-2','zz.probe',1,'staging','test','corr-kpi-0002','{}','internal','operational');
update private.domain_outbox_events set dead_lettered_at = now() where aggregate_id = 'kpi-2';        -- +1 pending, +1 parked

do $$ declare b private.governance_kpis%rowtype; a private.governance_kpis%rowtype; begin
  select * into b from before_k; select * into a from private.governance_kpis;
  if a.registry_rows - b.registry_rows <> 1 then raise exception 'FAIL registry_rows delta %', a.registry_rows - b.registry_rows; end if;
  if a.registry_orphans - b.registry_orphans <> 1 then raise exception 'FAIL registry_orphans delta'; end if;
  if a.exemptions_live - b.exemptions_live <> 1 or a.exemptions_expired - b.exemptions_expired <> 1
     or a.exemptions_expiring_30d - b.exemptions_expiring_30d <> 1 then raise exception 'FAIL exemption deltas'; end if;
  if a.hold_known_gaps - b.hold_known_gaps <> 1 then raise exception 'FAIL hold_known_gaps delta'; end if;
  if a.dq_rules_enabled - b.dq_rules_enabled <> 2 or a.dq_rules_never_run - b.dq_rules_never_run <> 1 then raise exception 'FAIL dq rule deltas'; end if;
  if a.dq_blocking_failed - b.dq_blocking_failed <> 1 then raise exception 'FAIL dq_blocking_failed delta'; end if;
  if a.legal_holds_active - b.legal_holds_active <> 1 then raise exception 'FAIL legal_holds_active delta'; end if;
  if a.rights_requests_overdue - b.rights_requests_overdue <> 1 then raise exception 'FAIL rights_requests_overdue delta'; end if;
  if a.last_measured_rpo is distinct from interval '1 hour' then raise exception 'FAIL measured rpo %', a.last_measured_rpo; end if;
  if a.outbox_pending - b.outbox_pending <> 1 or a.outbox_parked - b.outbox_parked <> 1 then raise exception 'FAIL outbox deltas'; end if;
  -- control: nothing that was not planted moved
  if a.tables_unregistered <> b.tables_unregistered or a.convention_violations <> b.convention_violations then
    raise exception 'FAIL an unplanted column moved'; end if;
end $$;
rollback;
\echo 13 OK
