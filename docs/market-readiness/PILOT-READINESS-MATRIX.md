# Pilot readiness matrix

**Current decision:** `NO-GO`. The matrix is an operating checklist, not an approval.

| Workflow | Current | Begin/success/error/empty/recovery/support | Auth/tenant/audit/data rights | A11y/metrics/owner/config | Evidence needed to reach PILOT READY |
| --- | --- | --- | --- | --- | --- |
| Account creation/sign-in | DESIGN PARTNER | implemented; target acceptance open | implemented controls; production proof open | automation exists; owner/support open | auth/recovery/abuse/UAT report |
| School identification | DESIGN PARTNER | explicit non-connection language | relationship ceiling prevents overclaim | configurable; named approval absent | institution mapping sign-off |
| Notices/consent | DESIGN PARTNER | structured copy and revoke patterns | data-use drafts and logs exist | comprehension and counsel review open | approved notice + consent test |
| Student onboarding | DESIGN PARTNER | first-run and manual paths exist | student-owned setup | field accessibility/activation open | representative UAT record |
| Course/schedule setup | DESIGN PARTNER | manual/import/recovery paths exist | local-first and scoped cloud storage | target data map/support open | cohort acceptance run |
| Calendar sync/import | DESIGN PARTNER | degraded/read-only behavior designed | provider scope and source labels exist | live connection not approved | provider acceptance + reconciliation |
| Tasks/workload/Today | DESIGN PARTNER | mature day/week planning and recovery | student-scoped data | field metrics and AT test open | workflow completion + AT report |
| Notifications | DESIGN PARTNER | preference controls exist | permission and audit controls | delivery operations not evidenced | opt-in/out delivery test |
| Help/support | INTERNAL | routes/runbooks exist | support access is scoped/audited | staffed queue absent | named rota + response drill |
| Export/deletion | DESIGN PARTNER | controls and back-end lifecycle exist | retention/erasure machinery exists | end-to-end target proof open | dated export/delete acceptance |
| Admin setup | DESIGN PARTNER | configuration/activation structures exist | capabilities and tenant policies | training and live operator absent | tenant setup acceptance |
| Cohort configuration | DESIGN PARTNER | pilot data model and rules exist | minimum-necessary/read-only first | named cohort absent | signed charter + config export |
| Roles/access | DESIGN PARTNER | role/capability system and tests exist | scope/expiry/revocation/audit | production access review absent | target role review |
| Reporting | DESIGN PARTNER | aggregate/privacy-threshold design exists | no individual risk profiling | measures not customer-approved | approved scorecard + sample review |
| Audit trails | DESIGN PARTNER | sensitive database/gateway events covered | immutable/audited patterns | production evidence export absent | reviewer-signed audit sample |
| Failure/recovery | DESIGN PARTNER | read-only, degraded, rollback controls exist | safe-failure patterns | production drill absent | incident/rollback exercise |
| Offboarding | DESIGN PARTNER | export/delete/offboarding plans exist | legal hold and retention modeled | target rehearsal absent | offboarding rehearsal |

## Launch packet required for every cohort

- signed charter and agreement;
- one tenant and one cohort identifier;
- approved feature list and disabled-feature list;
- data-flow/minimization map;
- role/capability export;
- support and escalation roster;
- golden-path and recovery UAT;
- accessibility and security acceptance;
- metric baseline and decision thresholds;
- incident, rollback, offboarding, export, and deletion evidence;
- launch-council decision.
