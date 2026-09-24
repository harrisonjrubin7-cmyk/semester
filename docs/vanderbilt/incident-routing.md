# Vanderbilt incident routing

No production pilot should start while any owner below is unassigned. A repository username is not an operational on-call assignment.

| Signal | Initial owner | Acknowledge | Immediate containment | Recovery evidence |
| --- | --- | --- | --- | --- |
| SSO/SCIM authentication or deprovisioning | **Unassigned — Vanderbilt IAM owner required** | 15 minutes | Disable affected provider or tenant access; preserve audit metadata | Valid login, revoked-user refusal, role readback |
| Gateway readiness, elevated 5xx or latency | **Unassigned — Semester operations owner required** | 15 minutes | Stop promotion; roll back application; do not retry uncertain actions | Live/ready probes, error rate, representative action reconciliation |
| OpenAI provider, policy or budget | **Unassigned — Semester AI operations and Vanderbilt AI owner required** | 30 minutes | Disable tenant AI policy; preserve non-AI workflows | Policy readback, cited response, usage settlement, budget ceiling |
| Brightspace LTI launch or grade readback | **Unassigned — Vanderbilt LMS owner required** | 30 minutes | Disable affected deployment/write path; keep LMS authoritative | Signed launch, tenant/deployment scope, authoritative readback |
| Retention freshness | **Unassigned — privacy and database owners required** | 30 minutes | Mark gateway not ready; restore scheduler; never purge unresolved actions | Successful scheduled sweep and fresh retention probe |
| Suspected cross-tenant access | **Unassigned — security incident commander required** | Immediate | Disable affected tenant/system, preserve logs, revoke credentials | Isolation tests, credential rotation, reviewed incident record |
| Backup or restore failure | **Unassigned — Supabase/database owner required** | 30 minutes | Freeze destructive changes and promotion | Timestamped restore drill with integrity checks |
| Accessibility blocker | **Unassigned — accessibility owner required** | One business day; immediate for critical access | Provide accessible alternate path and stop affected cohort rollout | Reviewer retest on target assistive technology |

Alert destinations, paging schedules, escalation contacts and evidence URLs belong in the institution-approved private operations system, not this public repository. `SEMESTER_MONITORING_READY` must remain `0` until a test alert reaches the assigned people and its acknowledgement is recorded.
