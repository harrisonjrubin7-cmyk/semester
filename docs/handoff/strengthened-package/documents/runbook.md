# Incident/operations runbook draft
Owner/version/review: [complete before operational use]
Trigger: suspected tenant isolation failure, record egress, corrupted projection or critical dependency outage.
Severity: map to canonical Sev1–4; no invented SLA or notification deadline.
First15minutes: incident commander; restrict affected capability; preserve correlation/log evidence; identify tenant/target; page approved security/privacy/support; no sensitive payloads in chat.
Diagnosis: SHA/config/grants/source time/outbox lag/event gap; distinguish confirmed transaction from late projection.
Fix: reviewed scoped remediation, object integrity and source reconciliation.
Rollback: verify schema/data compatibility; app rollback does not reverse committed records. Use accepted target-specific recovery plan.
Comms: audience-specific updates under privacy/counsel and institution authority.
Verification: authorization/isolation/currentness/affected journey/monitoring; retain dated witness record.
Escalation: named primary/backup/qualified reviewer/institution owner. Contacts and recovery objectives not supplied.
