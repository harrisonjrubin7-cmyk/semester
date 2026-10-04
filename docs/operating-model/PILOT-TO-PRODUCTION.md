# Pilot to production

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

How a school moves from a directory listing to a production tenant, what lets it move, and what must be true before anyone calls it live. The human copy of `app/src/lib/governance/rollout.ts`; `docs.test.ts` holds this file to that registry, and `supabase/migrations/20260928050000_tenant_rollout.sql` enforces the state machine.

**The rule over all of it.** Semester does not claim an official connection, a completed migration, an authoritative record or a successful writeback until the gates below are met. A directory listing is not a connection. A queued or sandbox action is not an official one. The official-system fallback stays until Semester has earned that authority.

## Lifecycle

```
directory
→ requested
→ claimed
→ security_review
→ sandbox_uat
→ pilot_read_only
→ pilot_write_enabled
→ production_limited
→ production_active
→ expansion

At any point in the rollout: → paused | suspended | offboarding
From offboarding only: → archived
```

| State | Seen as | Who has access | Data authority | Allowed | Exit gates |
|---|---|---|---|---|---|
| Directory | Student Access | Any Student Access user | public | Public campus profile and personal workspace | `institution_request` |
| Requested | Institution requested | Platform team and requester | none | Claim and discovery only | `sponsor_qualified` |
| Claimed | Setup in progress | Verified institutional contact | configuration | Branding, domain verification, stakeholder map, pilot planning | `security_kickoff` |
| Security review | Security review | Approved institution staff and Semester team | test | Trust review, DPA, architecture review, SSO and integration testing | `security_privacy_approval`, `dpa_executed` |
| Sandbox/UAT | Test environment | Authorized testers | test | Configured pilot workflows on sanitized data, no production authority | `uat_signoff`, `rls_isolation_passed`, `sso_login_verified` |
| Pilot read-only | Pilot | Pilot cohort | official_read | Courses, rosters, assignments and planning from approved sources, with source labels | `source_reconciliation_passed`, `accessibility_review_passed`, `data_quality_adoption` |
| Pilot write-enabled | Pilot | Pilot cohort | official_scoped_write | Booking, personal actions, and LMS writebacks that were separately approved | `workflow_reliability`, `cutover_checklist_complete`, `sponsor_go_live` |
| Production limited | — | Authorized population | official | Contracted modules for a selected cohort or campus | `expansion_decision` |
| Production active | — | All authorized users | official | Contracted tenant-wide feature set | `module_campus_approval` |
| Expansion | — | New department, campus or program | official | Additional modules and connectors by scope | — |
| Paused | Service temporarily limited | Admin and support | retained | Limited read, export, remediation | `remediation` |
| Suspended | Service temporarily limited | Admin and support only | retained | Support, export, remediation | `remediation` |
| Offboarding | Export available | Admin and export users | retained | Export, retention and deletion by contract | `completion_certificate` |
| Archived | Archived | Limited authorized archive access | retained | Historical access only | — |

### What the database refuses

`tenant_rollout` is written by the service role only; a school administrator cannot move their own school. The trigger refuses:

- a forward move of more than one step;
- a forward move whose exit gates have no evidence in `tenant_rollout_evidence` recorded **since the school entered its current state** — evidence from an earlier pass does not carry, so a school rolled back must earn the gate again;
- resuming a paused or suspended school anywhere but where it was held, or without `remediation` evidence;
- archiving from anywhere but offboarding, or without a `completion_certificate`;
- any move out of archived, and any transition without its own reason.

Stepping *down* the chain, holding and offboarding need no evidence: reducing a school’s authority is always allowed. Evidence and history are immutable, and `recorded_at` is stamped by the database clock, never supplied. `supabase/tenant-rollout.check.sql` walks all of it.

Not yet done: `feature_state` does not read the lifecycle. Whether every capability check should consult it is a separate decision with its own rollout.

## Phase plan

### Phase 0 — Commercial and governance readiness

Establish authority, scope, decision rights, policy ownership and a measurable pilot purpose before technical work begins.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Executive sponsor named | Institution | Sponsor acceptance | Sponsor attends kickoff |
| Operational champion named | Institution | Project charter | Owns day-to-day adoption |
| Technical owners named | Institution | RACI | LMS, SIS, identity and security contacts confirmed |
| DPA and security terms route confirmed | Legal/privacy | Contract tracker | Review path and dates agreed |
| Pilot workflow selected | Sponsor and Semester | Pilot hypothesis | One measurable workflow only |
| Pilot cohort selected | Institution | Cohort definition | Population, roles and count documented |
| Success metrics approved | Sponsor and data owner | Scorecard | Baselines and targets defined |
| Decision date agreed | Sponsor | Pilot agreement | Convert, expand, pause or stop date written |

### Phase 1 — Tenant and identity foundation

Provision a real tenant and validate identity, membership, roles, tenant isolation and administration.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Tenant provisioned | Semester | Tenant ID and subdomain | Correct branding and base policy loaded |
| Institution domains verified | Institution and Semester | DNS evidence | Tenant routing works |
| Admin accounts provisioned | Institution | Admin list | At least two institutional admins |
| SSO protocol selected | IT identity owner | OIDC or SAML design | Metadata and configuration approved |
| SSO configured in sandbox | IT and Semester | Login test | User identity and affiliation resolve |
| Role mapping defined | Institution and Semester | Role mapping matrix | Student, faculty, TA and admin mapping approved |
| SCIM decision documented | IT identity owner | Provisioning design | Manual, invite or SCIM model defined |
| RLS isolation tests passed | Semester | CI evidence | Cross-tenant and role attacks denied |
| Session and MFA policy configured | IT and security | Auth policy | Privileged-role controls verified |

### Phase 2 — LMS, SIS and source mapping

Connect approved sources read-only first and prove accuracy, freshness, ownership and fallback.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Terms mapped | Registrar/SIS owner | SIS API or OneRoster sync | Start and end dates match |
| Course catalog mapped | Registrar/SIS owner | SIS API or bulk import | Code, title and credit match |
| Sections and enrollments reconciled | Registrar/SIS owner | OneRoster, NRPS or API sync | Section, role and roster counts match |
| Course content links verified | LMS owner | LTI deep link or API | Links launch correctly |
| Assignments mapped | LMS owner | LMS API or LTI context | Due dates and types match |
| Grade line items read-only | LMS owner | AGS or API | No student grade exposed beyond approval |
| Calendar mapped | Student success/IT | API or ICS | Dates, time zones and duplicates checked |
| Services directory confirmed | Service owner | API or curated directory | Owner, eligibility and capacity confirmed |

### Phase 3 — Course migration and LMS interoperability

Import or connect representative courses and verify the complete student and faculty workflow.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Course shells and modules imported | Faculty and LMS owner | Common Cartridge, API or manual review | Module order and completion rules correct |
| Pages, files and media imported | Faculty/accessibility owner | Import and accessibility review | Captions or documented remediation |
| Assignments and rubrics validated | Faculty | API, import or manual validation | Dates, types and rubrics match |
| Question banks and assessments validated | Assessment owner | QTI conversion and item review | Items render and are reviewed |
| Grade ledger reconciled | Registrar/faculty | Reconciliation report | Totals reconcile before any passback |
| External tools catalogued | LMS owner | LTI 1.3 registrations | Each tool launches in context |

### Phase 4 — Pilot configuration and readiness

Prepare the workflow, people, support and controls a limited real-user launch needs.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Pilot feature flags set | Semester and institution | Entitlement record | Only approved modules, roles and cohorts enabled |
| AI policy configured | Academic affairs and faculty | Policy records | Course and assignment policy cards active |
| Accessibility review complete | Accessibility owner | Test report | P0/P1 issues resolved or mitigation approved |
| Faculty training complete | Faculty lead | Completion record | Course team can operate the workflow |
| Student onboarding prepared | Student success and Semester | Launch kit | SSO, first action and help route tested |
| Support runbook ready | Support owner | Runbook | Escalation and incident contacts confirmed |
| Communications approved | Institution communications | Templates | Student and staff messaging scheduled |
| Monitoring configured | Semester | Dashboards and alerts | Source, error, adoption and support monitoring active |
| Rollback and fallback approved | Technical owners | Rollback plan | Legacy LMS and official-system fallback tested |

### Phase 5 — Limited pilot launch

Launch safely, monitor daily and correct friction without expanding scope early.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Daily source freshness check | Semester and IT | Integration health review | First ten business days reviewed |
| Daily support triage | Support owner | Prioritized issue queue | First ten business days reviewed |
| Weekly working group | Operational champion | Decision log and blocker list | Held every week |
| Midpoint pilot health review | All owners | Health review | Continue, revise or stop decided |

### Phase 6 — Pilot conversion decision

Decide on evidence: convert, expand, extend, pause or stop.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Outcome review held | Sponsor and Semester | KPI tracker at end of pilot | Every decision threshold assessed |
| Conversion recommendation approved | Executive sponsor | Steering decision | One decision option recorded |

### Phase 7 — Production expansion

Add programs, courses and campuses in waves; move from read to scoped writes only on evidence.

| Milestone | Owner | Evidence | Exit criteria |
|---|---|---|---|
| Expansion wave planned | Sponsor and Semester | Wave plan | Scope, owners and dates agreed |
| Writebacks approved one by one | Integration owner | Per-writeback approval | Reconciliation passed for each |
| Quarterly business review held | Customer success | QBR record | Renewal and product plan reviewed |

### Conversion decision options

- Convert to annual production
- Expand pilot scope
- Extend pilot with defined remediation
- Pause
- Terminate and export/offboard

`pilotVerdict` records four final verdicts: convert, expand, pause and stop. "Terminate and export/offboard" is `stop`. "Extend" is not a verdict: it is a new written term recorded by the renewal playbook as a non-final `pending` renewal opportunity (`docs/commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`), and it does not lengthen the 26-week pilot.

## Migration acceptance criteria

- Course, section and roster IDs reconcile to the approved source
- Module order and completion rules are correct
- Content links work in student, faculty, keyboard and mobile views
- Imported media has captions or transcripts, or documented remediation
- Assignment dates, time zones, availability, submission types and rubrics match
- Assessment items render correctly and are reviewed by the academic owner
- Grade calculations reconcile before any official passback
- Student and faculty roles are correct
- Source and freshness labels appear wherever external data is shown
- No protected data crosses a tenant boundary
- The legacy LMS fallback remains available during the parallel run

## LTI security requirements

- Register issuer, client ID, deployment ID, redirect URIs, JWKS and required scopes
- Validate OIDC state and nonce
- Validate ID token signature, issuer, audience, deployment ID, expiry and nonce
- Trust no role or context claim until JWT validation succeeds
- Keep platform credentials and secrets server-side
- Scope NRPS and AGS calls to the verified course and deployment
- Use idempotency keys for AGS writeback
- Log launch, roster sync, deep-link and grade-write audit events
- Enable no grade passback until faculty, registrar, privacy and integration owners approve

## Production cutover checklist

The `cutover_checklist_complete` gate is evidence that every item is met; `cutoverOpen` lists what is still open, in this order.

- Contract, DPA, security terms and implementation scope are executed
- Tenant is provisioned with correct branding, domains and admin ownership
- SSO authentication, membership mapping, role mapping and MFA rules pass UAT
- RLS and cross-tenant tests pass against a production-equivalent environment
- Source data contracts, field mappings, classification and freshness SLAs are approved
- SIS and LMS source reconciliation passes
- Source, freshness and fallback UI is visible and accurate
- No synthetic preview, demo persona selector or test fixture appears in production
- Accessibility review passes with no unresolved launch-blocking issue
- Support, incident, status-page and escalation contacts are live
- Monitoring, alerts, logs, backup and restore evidence are current
- Feature flags and rollback plans are documented
- Student, faculty and staff onboarding is complete
- Pilot KPIs and baseline are documented
- Launch avoids registration and finals windows unless readiness is explicit
- Executive sponsor approves go-live

## Risk log

| ID | Risk | Likelihood | Impact | Early signal | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | SSO attribute mapping fails | Medium | High | Test users resolve to the wrong role or tenant | Sandbox claims matrix; invitation-login fallback | Identity owner |
| R-02 | Roster mismatch | Medium | High | Enrollment counts differ | Reconciliation report; source-of-truth policy; read-only first | SIS/LMS owner |
| R-03 | LMS source freshness delay | Medium | Medium | Assignments older than SLA | Freshness badge; retry queue; official LMS fallback | Integration owner |
| R-04 | Faculty workload resistance | High | High | Low training attendance or course activation | Course templates; migration concierge; faculty champions | Faculty lead |
| R-05 | Accessibility defect blocks launch | Medium | High | Keyboard or screen-reader failure | Early audit; remediation SLA; assistive-tech testing | Accessibility owner |
| R-06 | AI policy disagreement | Medium | High | Course policies absent or conflicting | Hierarchical policy model; faculty governance; default-safe modes | Academic affairs |
| R-07 | Student adoption low | Medium | High | Activation or first action below target | Orientation; LMS links; staff referrals; ambassadors | Student success |
| R-08 | Support capacity insufficient | Medium | High | Long queue or slow resolution | Office hours; escalation owner; pilot cohort limits | Support owner |
| R-09 | Grade passback discrepancy | Low | Critical | Grade total mismatch | No writeback in first pilot; reconciliation; rollback | Registrar/LMS owner |
| R-10 | Sensitive data overshared | Low | Critical | Unexpected fields in mapping or logs | Data minimization; DPA; classification gate; audit | Privacy owner |
| R-11 | Assessment outage | Low | Critical | Load or performance alerts | Autosave; receipts; fallback; exam-window on-call | Engineering lead |
| R-12 | Vendor or provider outage | Medium | Medium | API error or 429 surge | Circuit breaker; cached data; provider fallback; status messaging | Integration owner |

## RACI

| Workstream | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| Contract/DPA | Institutional sponsor | Procurement/legal | Security/privacy | Project team |
| Tenant configuration | Institution admin | Semester implementation | IT/security | Sponsor |
| SSO/identity | CIO/identity owner | Identity engineer | Semester engineering | Project team |
| SIS integration | Registrar/data owner | SIS integration owner | Privacy/security | Project team |
| LMS/LTI integration | LMS owner | LMS integration owner | Faculty, Semester engineering | Students |
| Course migration | Faculty lead | Faculty/course designer | Accessibility, instructional design | Students |
| AI policy | Academic affairs | Faculty/course owner | Privacy, library, accessibility | Students |
| Accessibility | Accessibility owner | Design, engineering and content authors | Student test panel | Sponsor |
| Student launch | Student success owner | Communications/ambassadors | Faculty/advising | Sponsor |
| Support | Support owner | Help desk/CS | IT/service owners | Users |
| Outcome measurement | Institutional research owner | Analytics lead | Sponsor, Semester CS | Governance group |
| Production decision | Executive sponsor | Steering committee | Semester leadership | All stakeholders |

## KPIs

Baselines and targets are set per school in Phase 0 and recorded with the tenant, not here.

| Metric | Source | Owner | Cadence |
|---|---|---|---|
| Eligible users | SIS/roster | Data owner | Weekly |
| Activation rate | Semester events | CS lead | Weekly |
| First meaningful action | Semester events | Product/CS | Weekly |
| Course workspace return | Semester events | Product | Weekly |
| Study/practice completion | Semester events | Product | Weekly |
| Service handoff completion | Referral system | Service owner | Biweekly |
| Source freshness SLA met | Integration health | IT owner | Daily/weekly |
| Accessibility defects open | A11y tracker | Accessibility owner | Weekly |
| Support contacts per active user | Support desk | Support owner | Weekly |
| Median support resolution | Support desk | Support owner | Weekly |
| Student usefulness/trust | Survey/interviews | Research lead | Midpoint/end |
| Faculty readiness | Training and survey | Faculty lead | Weekly |
| Pilot-to-production recommendation | Steering review | Sponsor | End |

## Weekly steering agenda

1. Decisions needed this week
2. Milestone status: green, amber, red
3. Integration health and data reconciliation
4. Security, privacy and accessibility issues
5. Faculty, student and support feedback
6. Adoption and workflow metrics
7. Risk-log updates
8. Change requests and feature-flag decisions
9. Next week’s owners and due dates
