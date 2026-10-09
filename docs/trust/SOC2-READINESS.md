# SOC 2 Readiness: CC1, CC6 and Availability

**Status: `IN_PROGRESS`.** This is a gap assessment, and Semester is not SOC 2
audited. No auditor has been engaged and no report exists. Nothing on this
page should be read as a claim otherwise.

The structure is the AICPA 2017 Trust Services Criteria (with the revised 2022
points of focus). Security, the common criteria CC1 to CC9, is in every SOC 2
examination. Availability (A1.1 to A1.3), Processing Integrity,
Confidentiality and Privacy are added according to the service. Semester
handles student data, course workflows, integrations and AI, so the plan
covers all five. This file goes deepest on the three series a university
security reviewer asks about first:

- **CC1**, the control environment
- **CC6**, logical and physical access
- **A1**, availability

Where a control here overlaps a row in
`docs/market-readiness/HECVAT_READINESS.md`, the two carry the same status.
If they disagree, one of them is wrong.

## How this file is held true

`app/src/lib/trust.test.ts` parses the three checklist tables and fails when:

- a score is outside 0 to 4;
- a row cites a path, in backticks under **Repo evidence**, that does not exist;
- a row scores 1 or more and cites no path at all;
- a row scores 3 ("tested") without citing an automated check that runs on
  every change (a `*.test.ts`, a `*.check.sql` or a CI workflow);
- a row scores 4 ("audit-ready") without a file under `docs/evidence/`. Audit
  readiness means evidence retained across a period, reviewed by somebody
  independent. Code cannot produce that, and this file must never be where it
  gets invented;
- a row below 4 does not say what would move it.

Change a score and its evidence in the same commit.

## Maturity scale

| Score | Meaning |
| --- | --- |
| 0 | Absent: no control, no evidence |
| 1 | Designed: documented, but not consistently operating |
| 2 | Operating: in use, with some evidence retained |
| 3 | Tested: runs on every change, and failures are remediated before merge |
| 4 | Audit-ready: stable, repeatable, independently testable across an audit period |

## Readiness by area

The domain-level picture. The three detailed checklists follow.

| Area | What Semester's control is | Current | Target |
| --- | --- | --- | --- |
| CC1 Governance | Accountable owners, policies, risk review | 1 | 4 |
| CC2 Communication | Trust documents, policy distribution, training | 1 | 4 |
| CC3 Risk assessment | Risk register covering vendor, AI and tenant risk | 0 | 4 |
| CC4 Monitoring of controls | Control reviews, vulnerability tracking | 1 | 4 |
| CC5 Control activities | Approval workflows, change gates | 2 | 4 |
| CC6 Access control | SSO, capabilities, RLS, support access, secrets | 2 | 4 |
| CC7 Operations | Monitoring, alerting, incident response | 1 | 4 |
| CC8 Change management | Versioned code, CI gates, migration ordering, rollback | 3 | 4 |
| CC9 Vendor management | Subprocessor register, DPAs, AI provider review | 1 | 4 |
| A1 Availability | SLOs, backups, restore, DR, load tests | 1 | 4 |
| Processing integrity | Receipts, audit trails, idempotent writes, reconciliation | 1 | 4 |
| Confidentiality | Classification, least privilege, secure storage | 2 | 4 |
| Privacy | Notice, export, deletion, retention, minimization | 2 | 4 |
| AI governance (not a SOC 2 category) | Provider registry, policy, evaluation, kill switch | 1 | 4 |
| Accessibility (not a SOC 2 category) | ACR, testing, remediation | 1 | 4 |

## CC1: control environment

| ID | Criterion | Control requirement | Test procedure | Evidence required | Cadence | Score | Repo evidence | What moves it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CC1-01 | CC1.1 | Leadership assigns accountability for security, privacy, availability, accessibility, AI governance and compliance | Inspect org chart and written role assignments; interview owners | Org chart, RACI, approval record | Annual; on reorganization | 1 | `SECURITY.md`, `MONITORING.md` | One person owns everything and it is written down. Write a RACI naming an owner per area, even if the name repeats, with a review date |
| CC1-02 | CC1.1 | Leadership reviews security, privacy, reliability and material risk on a defined cadence | Sample meetings; verify risks, decisions, owners and due dates are recorded | Quarterly review minutes, risk register, action tracker | Quarterly | 0 | — | No risk register exists (HECVAT GOV-2). Start one from the gaps already written in `docs/market-readiness/` and hold the first review |
| CC1-03 | CC1.2 | Code of conduct, security, privacy and acceptable-use policies are maintained and communicated | Inspect policies and version history; sample acknowledgements | Policy register, acknowledgements, training records | Annual; onboarding | 1 | `SECURITY.md`, `SECRETS.md`, `RETENTION.md` | Operational policies exist. A privacy policy, acceptable-use policy and code of conduct do not. Write and version them, and keep acknowledgements once there is staff |
| CC1-04 | CC1.2 | Personnel can report security, privacy, accessibility or ethical issues without retaliation | Inspect reporting process; sample a report or tabletop | Escalation policy, ticket workflow, training material | Annual | 0 | — | There is no staff and no reporting channel beyond the owner's mailbox. Publish a security and accessibility contact (HECVAT VULN-1, A11Y-4) and a non-retaliation statement |
| CC1-05 | CC1.3 | Roles, authority, escalation and separation of duties are documented for production and customer-data access | Inspect RACI and access model; confirm nobody can approve and deploy a high-risk change alone without a compensating control | RACI, access matrix, deployment approval config, exception log | Quarterly | 1 | `docs/operating-model/CHANGE-MANAGEMENT.md`, `ROLLBACK.md` | A single owner can approve and deploy alone. Until there is a second person, record the compensating control, which is the CI gates every change must pass, as an explicit exception |
| CC1-06 | CC1.3 | Incident, support, security, legal and customer-communication escalation routes are documented and tested | Review escalation tree; sample an incident or tabletop | IR plan, on-call roster, tabletop report, customer templates | Quarterly | 1 | `docs/market-readiness/INCIDENT_RESPONSE.md`, `docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md` | Written but never exercised (HECVAT IR-1). Run a tabletop and file the record |
| CC1-07 | CC1.4 | Staff and contractors are trained before they get production or student-data access | Sample personnel records; confirm training precedes the access grant | Curriculum, completion log, access-request timestamps | Onboarding; annual | 0 | — | No staff yet. Write the curriculum before the first hire, not after, so that the first access grant has a training record to precede it |
| CC1-08 | CC1.4 | Privileged personnel are under confidentiality, IP, acceptable-use and lawful background controls | Inspect privileged-user files and signed agreements | Confidentiality/IP agreements, privileged access list | Onboarding; annual | 0 | — | No agreements exist. Counsel drafts a confidentiality and IP assignment agreement, and that includes one for the founder's own entity |
| CC1-09 | CC1.5 | Control owners are accountable for performance, evidence retention, exceptions and remediation | Sample controls; verify owner, evidence, review date and exception record | Control register, tickets, remediation tracker | Monthly or quarterly | 1 | `docs/market-readiness/HECVAT_READINESS.md`, `app/src/lib/hecvat-readiness.test.ts` | A test-enforced register exists, but it has no owner column and no review dates. Add both, here and there |
| CC1-10 | CC1.5 | Security and operational performance appear in management objectives and reviews | Review objectives and remediation reporting | Quarterly business review, security metrics, closed remediation | Quarterly | 0 | — | No objectives are set. Add security and reliability measures to the operating rhythm in `docs/operating-model/OPERATING-RHYTHM.md` |

## CC6: logical and physical access

CC6 is the core access series. For Semester, tenant isolation, integration
scopes, AI data boundaries and support access are CC6 risks in their own
right, not only login controls.

| ID | Criterion | Control requirement | Test procedure | Evidence required | Cadence | Score | Repo evidence | What moves it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CC6-01 | CC6.1 | Production access is authorized by role, least privilege and business need | Export privileged accounts; sample grants against approvals and the role matrix | IAM export, access requests, RBAC matrix | Quarterly | 1 | `SECURITY.md` | One owner holds every production credential, and no approval record exists because there is nobody to approve. Export the account lists for GitHub, Supabase and the AI consoles and date them |
| CC6-02 | CC6.1 | MFA is required for privileged accounts, admin consoles, cloud, source control and support tooling | Inspect enforcement settings; test a non-MFA sign-in in a controlled environment | MFA policy, IdP enforcement config, access report | Continuous; quarterly | 0 | — | The product requires aal2 for platform_admin and support_agent capabilities and role-based approval requests, challenges those accounts before mounting the signed-in app, and independently gates console reads. Nothing filed proves production Auth or GitHub, Supabase, Anthropic or OpenAI console enforcement; other staff roles, students, recovery and passkeys remain open. File dated console exports and extend the tested boundary before raising this score |
| CC6-03 | CC6.1 | Student, faculty, staff, admin, support and engineering roles have separate capability boundaries | Run automated authorization tests for critical routes and actions | Capability matrix, API and UI permission tests | Per release | 3 | `supabase/capabilities.check.sql`, `supabase/my-capabilities.check.sql`, `supabase/admins.check.sql`, `supabase/role-grant-audit.check.sql` | Product roles are capability-scoped and tested on every change. Internal engineering access is still the all-powerful service-role key, which has no boundary |
| CC6-04 | CC6.1 | Institution, campus, course, section and user boundaries are enforced server-side and in the database | Run cross-tenant tests with direct API and database requests; inspect RLS | RLS export, authorization middleware, isolation test results | Per release | 2 | `supabase/rls-coverage.check.sql`, `supabase/tenancy.check.sql`, `supabase/integration-rls-matrix.check.sql`, `app/src/lib/tablerls.test.ts` | Every public table has RLS and that is enforced schema-wide. Older product tables still key their policies to the user rather than the school (HECVAT TEN-1). Re-key them and this reaches 3 |
| CC6-05 | CC6.1 | Support access to student records is time-bound, approved, logged and minimized | Sample support-access sessions; verify consent, scope, expiry and audit event | Support-access policy, grant logs, audit events | Monthly | 3 | `supabase/support-access.check.sql`, `supabase/help-requests.check.sql`, `app/src/lib/help-routes.test.ts` | Consented, scoped, expiring and audited, and tested on every change. What is missing is a monthly sample review with its record kept |
| CC6-06 | CC6.2 | Joiner, mover and leaver processes provision, change and revoke access promptly | Compare HR and contractor events with IAM timestamps | HR records, provisioning tickets, deprovisioning logs | Quarterly | 2 | `supabase/identity-provisioning.check.sql`, `supabase/migrations/20260924150142_institution_identity_provisioning.sql` | SCIM lifecycle provisioning exists for institutional users. There is no leaver process for Semester's own staff, because there is no staff. Write one before the first hire |
| CC6-07 | CC6.2 | Privileged, cloud, database, CI, GitHub, support and vendor-console access is formally reviewed | Inspect signed review evidence; confirm stale access removed | Access-review report, remediation tickets, IAM exports | Quarterly | 0 | — | No review has been held (HECVAT IAM-3). Hold one quarterly over `role_grants` and every console account, and keep each export |
| CC6-08 | CC6.3 | API keys, OAuth tokens, LTI keys, database credentials and service secrets are vaulted, scoped, rotated and never client-side | Review secrets inventory, code scans, rotation records, CI config | Secret inventory, vault config, scan results, rotation log | Continuous; quarterly | 2 | `SECURITY.md`, `SECRETS.md`, `app/src/lib/security.test.ts` | Every secret is inventoried with its revocation path, and the test fails when a function reads an unknown one. No rotation has ever been performed or logged. Rotate each on a schedule and keep the log |
| CC6-09 | CC6.3 | Secrets cannot reach source control, logs, errors, browser bundles or support artifacts | Run secret scans; inspect builds and logs; sample PRs | CI scan reports, build analysis, log redaction config | Per deployment | 3 | `.gitleaks.toml`, `.github/workflows/ci.yml`, `app/src/lib/security.test.ts` | Secret scanning gates every change. Log redaction has not been verified. Sample the function logs for credential-shaped strings and record the result |
| CC6-10 | CC6.4 | Physical access to infrastructure is restricted through approved cloud providers and company-device practice | Obtain hosting provider assurance; inspect device policy | Provider SOC report, asset inventory, endpoint management | Annual | 1 | `docs/SUBPROCESSORS.md` | Physical controls are inherited from GitHub and Supabase. Their assurance reports have not been obtained, and there is no device policy. Request both SOC reports and write a device policy |
| CC6-11 | CC6.5 | Customer data is removed from retired devices, media, temporary stores and decommissioned environments | Sample disposal and deletion records; verify environment teardown | Disposal certificates, deletion records, environment inventory | Per event; quarterly | 2 | `app/src/lib/erase.ts`, `supabase/deletion.check.sql`, `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` | Account deletion is real and tested. Preview-branch databases and retired devices have no teardown record. Inventory the environments and record each teardown |
| CC6-12 | CC6.6 | The service detects and responds to malicious or anomalous activity | Inspect WAF and rate-limit config, detection rules and incident samples | Security dashboard, alert definitions, incident tickets | Continuous; quarterly | 1 | `app/server/institution/rate-limit.test.ts`, `supabase/functions/claude/index.ts` | Rate limits and a per-account AI cap exist. There is no WAF, no anomaly alert and no detection rule. Define the RLS-denial and auth-failure alerts in `docs/trust/APM-RUNBOOK.md` and wire them up |
| CC6-13 | CC6.7 | Web, API, SSO, LTI, LMS, SIS and webhook traffic is protected and authenticated | Inspect TLS, OAuth scopes, webhook signatures, LTI token-validation tests | TLS config, integration security spec, automated tests | Per release | 2 | `app/src/lib/lti.test.ts`, `supabase/lti.check.sql`, `app/src/lib/csp.test.ts`, `docs/INTEGRATION-THREAT-MODEL.md` | LTI launches are validated and tested, and the CSP is tested. The TLS configuration of each host is assumed rather than recorded. Record it and this reaches 3 |
| CC6-14 | CC6.8 | Unauthorized or failed access attempts are logged, retained, triaged and escalated | Sample alerts and follow-up; review retention and thresholds | Audit logs, alert rules, alert history, investigation tickets | Continuous; monthly | 1 | `SECURITY.md`, `supabase/role-grant-audit.check.sql` | Supabase keeps a month of logs and grant changes are audited. Nothing triages them. Add an alert on auth failures and RLS denials, with a named recipient |

## A1: availability

| ID | Criterion | Control requirement | Test procedure | Evidence required | Cadence | Score | Repo evidence | What moves it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AV-01 | A1.1 | Capacity is monitored for app, database, queue, storage, AI providers and integration throughput | Inspect dashboards and alerts; sample capacity decisions | APM dashboard, thresholds, capacity plan, review notes | Continuous; monthly | 1 | `supabase/health.sql`, `MONITORING.md` | A health query and a weekly ten-minute look exist. There are no thresholds and no alerts. Wire the thresholds in `docs/trust/APM-RUNBOOK.md` |
| AV-02 | A1.1 | Peak conditions are modeled and tested: registration, midterms, finals, deadlines, large releases | Run load tests; compare results to SLOs; document remediation | Load-test script and report, capacity model | Before each term; quarterly | 0 | — | No load test has been run. Script a submission-deadline profile against a preview branch and file the result |
| AV-03 | A1.2 | Critical dependencies and single points of failure are identified, monitored and have fallbacks | Inspect dependency map; simulate a dependency failure | Dependency inventory, architecture, fallback runbooks, game-day report | Quarterly | 1 | `docs/market-readiness/INFRASTRUCTURE_READINESS.md`, `app/src/lib/openai.ts` | The architecture is mapped and AI has a second provider. The gateway journal is a single-host file with no backup. Run a game day that removes a dependency |
| AV-04 | A1.2 | Infrastructure has environmental protections through cloud providers and architecture | Review provider assurance and architecture | Provider SOC documentation, vendor-risk review | Annual | 1 | `docs/SUBPROCESSORS.md` | Inherited from the providers, but no assurance documents have been collected. Obtain them and file them under `docs/evidence/` |
| AV-05 | A1.3 | Critical services have approved RTO and RPO | Review service tiering; verify objectives are approved | BCDR plan, service catalog, approval record | Annual | 0 | — | There is deliberately no RTO or RPO, because a recovery objective is a measurement of a procedure that has been run (`docs/market-readiness/DISASTER_RECOVERY.md`). Measure a restore, then state it |
| AV-06 | A1.3 | Backups run, are monitored, protected, retained and tested | Sample backup jobs; inspect failures; restore representative data | Backup logs, alert history, retention config, restore report | Daily; quarterly restore | 1 | `docs/market-readiness/DISASTER_RECOVERY.md` | Supabase backs up on the plan's schedule. Nothing monitors it, and the gateway journal has no backup at all. Back up the journal first |
| AV-07 | A1.3 | Restore is demonstrated within RTO and RPO, and restored data is validated | Run a time-bound restore drill and reconcile | DR exercise report, timestamps, validation checklist, sign-off | Quarterly or semiannual | 0 | — | No restore has ever been performed (HECVAT BCP-1). Follow `RESTORE.md` into a scratch project, time it, and run `supabase/check.sh` against the result |
| AV-08 | A1.3 | Rollback, feature flags, emergency disablement and incident communication mitigate failures quickly | Run a game day; sample a rollback and a status update | Runbooks, flag registry, incident log, deployment records | Quarterly | 2 | `ROLLBACK.md`, `docs/FEATURE-FLAG-REGISTRY.md`, `supabase/invites.check.sql` | A rollback has been performed for real and the invite-only lever is tested. There is no status page. Publish one and drill a rollback |
| AV-09 | A1.3 | Reliability incidents produce postmortems and verified corrective actions | Sample incidents; verify cause, impact, owners and closure | Postmortems, corrective-action tracker | Per P0/P1; monthly | 1 | `MONITORING.md`, `ROLLBACK.md` | Past failures are written up as narrative in these files, but there is no postmortem template or action tracker. Adopt the runbook in `docs/trust/APM-RUNBOOK.md` |

## Evidence a reviewer should be able to inspect

What an auditor or university security team will ask for, and where it is.
**Absent** means absent. It does not mean "available on request".

| Evidence | Where |
| --- | --- |
| Production architecture and data flow | `docs/market-readiness/INFRASTRUCTURE_READINESS.md` (architecture); data-flow diagram absent |
| Tenant boundary and RLS test report | `supabase/rls-coverage.check.sql` and the other `supabase/*.check.sql` suites, run in CI |
| SSO, SAML and OIDC configuration standard | `docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`, `docs/OIDC-IMPLEMENTATION-RUNBOOK.md` |
| MFA enforcement export | Absent |
| Quarterly privileged-access review | Absent |
| Secrets inventory and rotation log | Inventory in `SECURITY.md`; rotation log absent |
| PR approvals and deployment log | GitHub pull requests and Actions history |
| Dependency, secret-scan and vulnerability reports | `.github/dependabot.yml`, `.gitleaks.toml` in CI; HawkScan local-preview DAST configured, with first-run evidence pending Actions credentials |
| Penetration-test summary | Absent (HECVAT VULN-2) |
| Incident response policy and tabletop | Policy in `docs/market-readiness/INCIDENT_RESPONSE.md`; tabletop absent |
| APM dashboards and alert definitions | Definitions in `docs/trust/APM-RUNBOOK.md`; wiring absent |
| Backup history and restore-drill report | Absent |
| Load-test report | Absent |
| Subprocessor register and DPAs | `docs/SUBPROCESSORS.md`; DPAs not reviewed |
| Retention and deletion records | `RETENTION.md`, `supabase/deletion.check.sql` |
| VPAT/ACR and remediation register | Absent (HECVAT A11Y-2) |
| AI provider inventory and policy decision log | `docs/market-readiness/AI_GOVERNANCE.md`, `supabase/intelligence-policy.check.sql` |

## HECVAT v4 to SOC 2 mapping

HECVAT is a higher-ed vendor questionnaire, not a certification. Map exact
question IDs from the current licensed workbook when it is filled in. This is
the domain-level bridge, so that one piece of evidence answers both.

| HECVAT v4 domain | SOC 2 criteria | Semester controls | Evidence |
| --- | --- | --- | --- |
| Governance, organization, policy | CC1 to CC5 | CC1-01 to CC1-10 | RACI, policies, risk review |
| Asset and data inventory | CC2, CC3, C1, P | Retention inventory | `RETENTION.md` |
| Identity and access | CC6.1 to CC6.3 | CC6-01 to CC6-09 | Capability and RLS suites |
| Physical and environmental | CC6.4, CC6.5, A1.2 | CC6-10, CC6-11, AV-04 | Provider assurance |
| Encryption and data transfer | CC6.7, C1 | CC6-13 | LTI and CSP tests |
| Logging, detection, incident response | CC6.6, CC6.8, CC7 | CC6-12, CC6-14 | Incident runbooks |
| Secure development and change | CC7, CC8 | CI gates, migration ordering | `.github/workflows/ci.yml` |
| Vulnerability management | CC7 | Dependabot, secret scanning | Pen test absent |
| Business continuity and DR | A1.1 to A1.3, CC9.1 | AV-01 to AV-09 | Restore drill absent |
| Vendor and subprocessor risk | CC9.2 | Vendor register | `docs/SUBPROCESSORS.md` |
| Privacy and student data | P series, C1, CC6 | Export, erase, retention | `docs/trust/DPA-CHECKLIST.md` |
| Accessibility | Outside SOC 2 | CI journey audits | ACR absent |
| AI/ML governance | CC3, CC6, CC7, CC9, P | Provider policy, metering | `docs/market-readiness/AI_GOVERNANCE.md` |
| Integration security | CC6, CC7, CC8 | LTI validation, gateway | `docs/INTEGRATION-THREAT-MODEL.md` |
| Offboarding and disposal | CC6.5, CC9, P | Export and deletion | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md` |

A SOC 2 report is not a FERPA answer. It can show security controls, but it
does not establish the institution's direct control over education records or
the permitted uses. The DPA does that; see [`DPA-CHECKLIST.md`](DPA-CHECKLIST.md).

## Twelve-month path to a Type I, then Type II

| Months | Work |
| --- | --- |
| 0 to 2 | Name owners; risk register; MFA on every console; re-key legacy RLS (CC6-04); secrets rotation log; vendor register with DPAs |
| 2 to 4 | Alerts wired with a named recipient; journal backup; first restore drill; quarterly access review; security training curriculum |
| 4 to 6 | Internal gap re-assessment against this file; penetration test; incident and DR tabletop; accessibility audit; AI red-team |
| 6 to 9 | Close gaps; operate controls with retained evidence; engage an auditor for Type I |
| 9 to 12 | Operate over the audit period; Type II readiness |

The first two rows need no auditor and no money beyond the tools already used.
None of it needs code that does not yet exist. What it needs is somebody doing
the recurring work and keeping the record.

## The compliance tracker, when this outgrows a file

The brief this package was built from asks for the tracker as a database, so that
one control can answer SOC 2, HECVAT, ISO 27001 and customer questionnaires.
That is right once there are several people and several frameworks. For one
owner and one register, a test-enforced Markdown table does the same job and
cannot drift silently, so the move is deferred until it pays. The schema,
when it comes:

| Table | Holds |
| --- | --- |
| `frameworks` | SOC 2 2017 TSC, HECVAT v4, ISO/IEC 27001, SIG, CAIQ, with version and licence note |
| `requirements` | One row per criterion or question, with its framework and source reference |
| `controls` | This file's rows: statement, scope, owner, frequency, automation level, score, next due |
| `requirement_control_map` | Which control answers which requirement, how strongly, and who reviewed the mapping |
| `evidence` | Per control: type, secure URL, period covered, collector, reviewer, hash, retention |
| `tests` | Method, sample, tester, result, exceptions, workpaper |
| `findings` | Severity, root cause, owner, due date, closure evidence |
| `vendors` | `docs/SUBPROCESSORS.md`'s rows, plus DPA and assurance status |
| `questionnaire_answers` | Canonical answer, owner, evidence links, last review, customer-specific variance |

These rules make it worth being a database:

- **A control past `next_due_at`** is marked overdue and notifies its owner.
- **Expired evidence** marks every mapped requirement at risk and flags the
  questionnaire answers built on it.
- **An open P0 or P1 incident** creates an evidence record linked to CC7, A1.3
  and HECVAT incident response, and it cannot close without a postmortem.
- **A new subprocessor** creates a vendor assessment and requires DPA review.
- **A high-severity finding past due** escalates to the executive owner and
  flags every answer it touches.

Row-level security applies to this tracker like any other table. Evidence
links can point at confidential reports.
