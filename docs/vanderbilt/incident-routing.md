# Vanderbilt incident routing

Harrison Rubin is the named Semester incident commander and support owner.
No production pilot should start until the institution-side owners below are
assigned and the real contact route is exercised. A repository username alone
is not the institution's operational on-call assignment.

| Signal | Initial owner | Acknowledge | Immediate containment | Recovery evidence |
| --- | --- | --- | --- | --- |
| SSO/SCIM authentication or deprovisioning | **Harrison Rubin (Semester); Vanderbilt IAM owner unassigned** | 15 minutes | Disable affected provider or tenant access; preserve audit metadata | Valid login, revoked-user refusal, role readback |
| Gateway readiness, elevated 5xx or latency | **Harrison Rubin** | 15 minutes | Stop promotion; roll back application; do not retry uncertain actions | Live/ready probes, error rate, representative action reconciliation |
| OpenAI provider, policy or budget | **Harrison Rubin (Semester); Vanderbilt AI owner unassigned** | 30 minutes | Disable tenant AI policy; preserve non-AI workflows | Policy readback, cited response, usage settlement, budget ceiling |
| Brightspace LTI launch or grade readback | **Harrison Rubin (Semester); Vanderbilt LMS owner unassigned** | 30 minutes | Disable affected deployment/write path; keep LMS authoritative | Signed launch, tenant/deployment scope, authoritative readback |
| Retention freshness | **Harrison Rubin** | 30 minutes | Mark gateway not ready; restore scheduler; never purge unresolved actions | Successful scheduled sweep and fresh retention probe |
| Suspected cross-tenant access | **Harrison Rubin** | Immediate | Disable affected tenant/system, preserve logs, revoke credentials | Isolation tests, credential rotation, reviewed incident record |
| Backup or restore failure | **Harrison Rubin** | 30 minutes | Freeze destructive changes and promotion | Timestamped restore drill with integrity checks |
| Accessibility blocker | **Harrison Rubin** | One business day; immediate for critical access | Provide accessible alternate path and stop affected cohort rollout | Reviewer retest on target assistive technology |

Alert destinations, paging schedules, escalation contacts and evidence URLs belong in the institution-approved private operations system, not this public repository. `SEMESTER_MONITORING_READY` must remain `0` until a test alert reaches the assigned people and its acknowledgement is recorded.
