-- 070_readiness_read_models.sql — PROPOSED. Role-shaped projections the UI reads instead of workflow tables.
-- Correction vs. the PDF: it used a MATERIALIZED view. Materialized views do not apply RLS, so any authenticated
-- user could read every student's readiness at every institution. A plain view with security_invoker = true runs
-- with the caller's privileges, so the RLS on readiness_cases / readiness_receipts still applies.

create or replace view semester_core.student_readiness_summary with (security_invoker = true) as
select rc.tenant_id, rc.student_id, rc.term_code, rc.state, rc.reason_code, rc.source_freshness_state,
       rc.evaluated_at, rc.assigned_office,
       (select max(r.issued_at) from semester_core.readiness_receipts r where r.tenant_id = rc.tenant_id and r.case_id = rc.id) as latest_receipt_at,
       now() - rc.evaluated_at as age
from semester_core.readiness_cases rc
where rc.evaluation_version = (select max(x.evaluation_version) from semester_core.readiness_cases x
                               where x.tenant_id = rc.tenant_id and x.student_id = rc.student_id and x.term_code = rc.term_code);

-- Registrar queue: no student names; ids + state + freshness only. Names come from a separate, audited lookup.
create or replace view semester_core.registrar_readiness_queue with (security_invoker = true) as
select rc.tenant_id, rc.id as case_id, rc.student_id, rc.term_code, rc.state, rc.reason_code, rc.assigned_office,
       rc.source_freshness_state, rc.updated_at,
       (select count(*) from semester_core.readiness_checks k where k.tenant_id = rc.tenant_id and k.case_id = rc.id and k.state = 'blocked') as blocking_checks
from semester_core.readiness_cases rc
where rc.state in ('blocked','needs_review','stale','referred');

-- Operations: health only, no student content at all.
create or replace view semester_core.ops_readiness_health with (security_invoker = true) as
select tenant_id, state, source_freshness_state, count(*) as cases, max(updated_at) as last_change
from semester_core.readiness_cases group by tenant_id, state, source_freshness_state;

grant select on semester_core.student_readiness_summary, semester_core.registrar_readiness_queue, semester_core.ops_readiness_health to authenticated;
revoke all on semester_core.student_readiness_summary, semester_core.registrar_readiness_queue, semester_core.ops_readiness_health from anon;
-- ops_readiness_health still runs readiness_cases RLS as the caller; give operators a dedicated aggregate grant
-- (e.g. ops.readiness.health.read) and a policy that exposes only these aggregate columns via a security-definer
-- function if they must see counts without case-level access.
