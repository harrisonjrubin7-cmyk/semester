# Full-company launch simulations

Status: Phase A test charter. These simulations are required; this document does not claim they have run.

Every run records release SHA/environment, tenant/cohort, fixtures versus real systems, participants, timestamps, expected/actual results, audit/correlation references, screenshots/logs without sensitive content, severity, owner, remediation date and retest evidence. A failure is a launch blocker for the affected capability.

| # | Simulation | Minimum passing evidence |
| --- | --- | --- |
| 1 | Native student journey | Sign-up, manual classes/work, Today plan, study, progress, export/support and return value without institution data |
| 2 | Connected institution journey | Verified identity, labeled SIS/LMS data, freshness/reconciliation and safe provider outage |
| 3 | Offline/reconnect/conflict | Allowed data only, local durability, field-safe merge and honest rejected/queued states |
| 4 | LMS submission receipt | Draft/queued/uploaded remain incomplete until authoritative receipt; retry/idempotency proven |
| 5 | Guardian invite/consent/revocation | Verified relationship, exact preview, minimized projection and next-request/cache denial after revoke |
| 6 | Institution provisioning/SSO/integration health | Contracted tenant, roles/policy, SSO, connector mapping, alerts, rollback and offboarding |
| 7 | Faculty/advisor scope | Authorized cohort/course only; wrong purpose and cross-tenant access denied/audited |
| 8 | Partner/listing/application disclosure | Verification, moderation, eligibility, explicit fields, delivery receipt and retention deletion |
| 9 | JIT support access | User request, bounded grant, minimum view, expiry/revoke and complete audit without raw DB use |
| 10 | AI prohibited-action denial | Policy/context resolved, unsafe tool blocked, safe explanation/handoff and content-free audit |
| 11 | Incident response | Detection, severity, paging, status/customer communication, containment, recovery and postmortem |
| 12 | Export/deletion/retention | Identity proof, export integrity, holds/exceptions, erasure and local/session/cache invalidation |
| 13 | Backup/restore | Restorable target, integrity/reconciliation, measured RPO/RTO and access controls |
| 14 | Canary/rollback | Cohort release, metrics/stop rule, rollback, data compatibility and customer communication |
| 15 | Procurement/security evidence | Questionnaire answers trace to current exact-target evidence; gaps and approvals are explicit |
| 16 | Financial close/reconciliation | Entitlements, invoices, collections, refunds/chargebacks, revenue treatment and approvals reconcile |
| 17 | Pilot/implementation/adoption/renewal | Signed scope, setup, training, activation, support, outcomes, QBR and go/renew/stop decision |

## Severity and exit

P0: suspected disclosure, cross-tenant access, false official success or unsafe financial action—disable immediately. P1: critical journey or recovery failure—no affected launch. P2: bounded pilot-quality failure—owner and retest before expansion. P3: improvement with no correctness/trust impact—tracked with acceptance criteria. Only an independent retest closes P0/P1.

