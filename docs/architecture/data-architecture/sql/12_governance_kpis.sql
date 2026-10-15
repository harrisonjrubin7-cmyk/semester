-- PROPOSAL 12 · governance KPIs as one view
--
-- The operating model (12-governance-operating-model.md) names measures a weekly review reads. Each is
-- a count over an object this directory already defines, so "how is data governance going" is a SELECT,
-- not a meeting. Read-only; no new state. Requires 01, 09, 11 and (for the lifecycle columns) 03, 04.
create or replace view private.governance_kpis as
select
  (select count(*) from private.data_registry)                                                         as registry_rows,
  (select count(*) from private.data_registry where review_state = 'steward_confirmed')                as registry_confirmed,
  (select count(*) from private.data_registry_gaps where kind = 'unregistered')                        as tables_unregistered,
  (select count(*) from private.data_registry_gaps where kind = 'orphan_registry')                     as registry_orphans,
  (select count(*) from private.convention_violations)                                                  as convention_violations,
  (select count(*) from private.convention_exemption where review_by >= current_date)                  as exemptions_live,
  (select count(*) from private.convention_exemption where review_by < current_date)                   as exemptions_expired,
  (select count(*) from private.convention_exemption
    where review_by between current_date and current_date + 30)                                         as exemptions_expiring_30d,
  (select count(*) from private.hold_exemption where kind = 'known_gap')                               as hold_known_gaps,
  (select count(*) from private.sweeps_without_hold_awareness())                                        as hold_blind_sweeps,
  (select count(*) from private.dq_rule where enabled)                                                  as dq_rules_enabled,
  (select count(*) from private.dq_rule r
    where r.enabled and not exists (select 1 from private.dq_result x where x.rule_id = r.rule_id))    as dq_rules_never_run,
  (select count(*) from private.dq_blocking_failed)                                                     as dq_blocking_failed,
  (select count(*) from public.legal_holds where released_at is null)                                  as legal_holds_active,
  (select count(*) from public.data_subject_request where resolved_at is null and due_at < now())      as rights_requests_overdue,
  (select max(restored_at) from private.restore_event where environment = 'production')                as last_production_restore,
  (select measured_rpo from private.restore_event where environment = 'production'
    order by restored_at desc limit 1)                                                                  as last_measured_rpo,
  (select count(*) from private.domain_outbox_events where published_at is null and dead_lettered_at is null) as outbox_pending,
  (select count(*) from private.domain_outbox_events where dead_lettered_at is not null)               as outbox_parked;
revoke all on private.governance_kpis from public, anon, authenticated;
