# Launch completeness

<!-- Rendered from app/src/lib/launchcompleteness.ts by launchcompleteness.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Three documents of 29 September 2026 ask what is still missing before Semester can
launch at a university: a HECVAT tracker with an owner on every row, registration
and LMS go-live checklists, a student-data migration playbook, a first pilot
agreement, an SLA and packaging matrix, a per-pilot command center, a company-wide
final gate, a claim register keyed on nine words, the pages the company site needs,
and one internal standard, rendered separately as [the Semester Definition of Done](DEFINITION-OF-DONE.md).
They are kept under `docs/expansion/` as supplied. This page holds each thing they
ask for to what the tree already has, under the rule of
[D-108](DECISION-LOG.md#d-108--the-modernization-blueprint-is-a-crosswalk-onto-the-master-register-not-a-second-register)
and [D-111](DECISION-LOG.md#d-111--five-research-documents-are-held-to-the-tree-as-crosswalks-and-the-pdfs-are-never-their-own-evidence):
a supplied PDF is never its own evidence, every cited file exists, and every
standing is held to the kind of file it cites. Standings were read at `origin/main` `ae4837c` on 2026-09-29.

**This is an operational planning crosswalk, not legal advice, a HECVAT completion,
a WCAG conformance claim, a FERPA determination or a contract.** Nothing here may be
signed; counsel, the institution’s privacy officer, security and accessibility
specialists and procurement come before any agreement or representation.

| Supplied document | What it holds |
| --- | --- |
| [Semester University Launch Readiness, HECVAT, Data Migration, and Pilot Contract Playbook](expansion/University-Launch-Readiness-HECVAT-Migration-and-Pilot-Contract-Playbook.pdf) | The go-live decision standard; the HECVAT preparation checklist in seven domains; the registration and LMS go-live checklists; the student-data migration playbook; the first pilot agreement outline; the SLA and packaging matrix; the go-live command center; the definition of done; ten next actions. |
| [University launch readiness audit: HECVAT compliance, WCAG 2.2 accessibility, and a go-live checklist](expansion/University-Launch-Readiness-Audit-Summary.pdf) | What the playbook includes, and the five most important next actions. |
| [Anything else missing or needing further refinement — the complete-company checklist](expansion/Complete-Company-Launch-Checklist.pdf) | Seven readiness areas; twelve core journeys and the states each needs; the launch acceptance rule; company foundation; fourteen public legal documents and eleven institutional ones; the Trust Room; the FERPA posture; onboarding, support and customer success; the claim register; the site pages and conversion points; operations, SLOs, revenue operations and contract boundaries; the thirty-one-line final gate; the Semester Definition of Done. |

## Standings

| Standing | Meaning |
| --- | --- |
| tested | An automated test or a database check holds the rule |
| building | Code carries some of it; the gap says what it does not |
| designed | A document says what it would be; nothing runs |
| not-started | Nothing in the tree beyond a document naming the gap |
| held | A decision already on main answers it differently, and holds until the owner reopens it |

Across the 210 items with a standing: tested 118 · building 40 · designed 41 · not-started 10 · held 1.

## The finding

Most of what the briefs ask for exists on main as a part, and the part is usually
held by a test. What does not exist is concentrated: customer data migration,
the MSA, counsel’s review of every public policy, a human accessibility pass, a
production restore, error tracking, and anything with an institution’s name on it.
Those are not code the repository can write; they are the owner’s, counsel’s and a
first customer’s. The one conflict with the code, the pilot’s length, the owner settled (D-134).

## 1. The go-live decision standard

A university launch is approved only when all eight are true. Today the weakest is **designed**.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-GO-01 | The defined student cohort can complete the core workflow end to end | building | [`docs/GOLDEN-PATH-TEST-SCRIPT.md`](GOLDEN-PATH-TEST-SCRIPT.md) — the student golden path, step by step<br>[`app/src/lib/registration-day.ts`](../app/src/lib/registration-day.ts) — the plan, backups, conflicts and checklist the workflow ends in | Scripted for the student path only, and never run with a real cohort. |
| LC-GO-02 | The institution approves the defined data scope and authorized purpose | building | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — dataPlan (minimum necessary, read-only first, source-labelled) and productionDataApproved on every pilot | No institution has approved one; the approval is a boolean, not a signed record of fields. |
| LC-GO-03 | Access, consent, tenant isolation and audit controls are tested | tested | [`supabase/tenancy.check.sql`](../supabase/tenancy.check.sql) — reads stay inside the school<br>[`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — every table under row-level security<br>[`supabase/support-access.check.sql`](../supabase/support-access.check.sql) — staff see a student only through a grant the student made<br>[`supabase/role-grant-audit.check.sql`](../supabase/role-grant-audit.check.sql) — role grants are audited | HECVAT TEN-1 is still in progress: the negatives cover the tables the suites name. |
| LC-GO-04 | Student-facing data shows source, freshness and limitation | tested | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — the five source labels are the database’s labels<br>[`app/src/components/SourceBadge.test.tsx`](../app/src/components/SourceBadge.test.tsx) — the label a fact prints | The source is on every fact; when it was last read is not. |
| LC-GO-05 | The product works with keyboard, screen readers, mobile reflow and error states | building | [`app/src/a11y/axe.test.tsx`](../app/src/a11y/axe.test.tsx) — an automated WCAG probe over the screens<br>[`app/src/a11y/focus.test.ts`](../app/src/a11y/focus.test.ts) — the focus ring<br>[`app/src/widthgate.test.ts`](../app/src/widthgate.test.ts) — the narrow-width gate<br>[`docs/accessibility/AT-PASS-PROTOCOL.md`](accessibility/AT-PASS-PROTOCOL.md) — the assistive-technology pass nobody has run | No human screen-reader or 400% zoom pass is recorded. |
| LC-GO-06 | Monitoring, support, incident response, backups and rollback are operational | building | [`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — the status page probes the project the app is built against<br>[`supabase/support-tickets.check.sql`](../supabase/support-tickets.check.sql) — the ticket queue<br>[`RESTORE.md`](../RESTORE.md) — the restore procedure<br>[`ROLLBACK.md`](../ROLLBACK.md) — the rollback procedure | No production restore has been timed, no alert reaches a person and nobody is on call. |
| LC-GO-07 | The institution has training, communication and escalation contacts | designed | [`docs/LAUNCH-CONTENT-AND-TRAINING.md`](LAUNCH-CONTENT-AND-TRAINING.md) — the training content<br>[`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) — the communications | No institution, so no contacts; the command center below names where they would go. |
| LC-GO-08 | The pilot has success measures, a review date and a documented expansion or exit decision | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilotReadiness refuses a kickoff without metrics, baselines, a midpoint review and a conversion date<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held | None beyond the pilot term below. |

## 2. The HECVAT tracker

Every row of the brief’s seven domains, with the council seat that owns it and the
control of [`docs/market-readiness/HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md) it moves. 40 of the 81 rows
have no readiness control today: those are what the brief adds to the thirty.
The due date is the seat’s to set; a date typed here on nobody’s behalf is a claim
nobody made.

All 81: tested 41 · building 8 · designed 27 · not-started 4 · held 1.

### 2.1 Company and governance

10 rows, the weakest not-started: tested 2 · building 0 · designed 5 · not-started 2 · held 1.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV1-01 | Legal entity and company ownership documented | `founder` | **none** | owner sets | held | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: the owner attested a single-member LLC | The formation documents are private and not indexed in the tree. |
| LC-HV1-02 | Security leadership assigned | `security` | `GOV-1` | owner sets | tested | [`SECURITY.md`](../SECURITY.md) — the security owner and the severity model<br>[`app/src/lib/security.test.ts`](../app/src/lib/security.test.ts) — names an owner, not a placeholder | The security seat is held by the founder until someone qualified accepts it. |
| LC-HV1-03 | Privacy leadership assigned | `privacy` | **none** | owner sets | designed | [`docs/operating-model/DATA-STEWARDSHIP.md`](operating-model/DATA-STEWARDSHIP.md) — the stewardship roles | No privacy governance charter naming a person. |
| LC-HV1-04 | Risk-management process defined | `founder` | `GOV-2` | owner sets | designed | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) — the risk register and its cadence | The register exists; no review on its cadence is recorded. |
| LC-HV1-05 | Vendor-management process defined | `security` | **none** | owner sets | designed | [`docs/trust/VENDOR-RISK-REGISTER.md`](trust/VENDOR-RISK-REGISTER.md) — the vendor inventory | No assessment template has been run on a vendor. |
| LC-HV1-06 | Security policy set maintained with revision dates | `security` | `GOV-1` | owner sets | tested | [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md) — every controlled document with its version and review dates<br>[`app/src/lib/ops/operatingsystem.test.ts`](../app/src/lib/ops/operatingsystem.test.ts) — held | No index labelled as the security policy set. |
| LC-HV1-07 | Employee and contractor confidentiality and IP terms exist | `founder` | **none** | owner sets | designed | [`IP.md`](../IP.md) — what the company owns and how | No agreement templates and no signed-record process. |
| LC-HV1-08 | Background checks or personnel controls documented | `operations` | **none** | owner sets | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — a one-person company answering the personnel rows | No personnel control is written. |
| LC-HV1-09 | Security training process exists | `security` | **none** | owner sets | not-started | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — the training rows unanswered | No training record or annual plan. |
| LC-HV1-10 | Incident response team and contacts defined | `security` | `IR-1` | owner sets | designed | [`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — the process and roles<br>[`docs/CRISIS-RESPONSE-RUNBOOK.md`](CRISIS-RESPONSE-RUNBOOK.md) — the crisis runbook | The contact tree is one person. |

### 2.2 Data privacy and FERPA posture

14 rows, the weakest designed: tested 8 · building 1 · designed 5 · not-started 0 · held 0.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV2-01 | Data inventory is complete | `privacy` | `PRIV-1` | owner sets | tested | [`RETENTION.md`](../RETENTION.md) — every table with its retention answer<br>[`app/src/lib/retention.test.ts`](../app/src/lib/retention.test.ts) — held | Table by table, not field by field. |
| LC-HV2-02 | Data classification is defined (Public / Internal / Student Private / Restricted) | `privacy` | **none** | owner sets | designed | [`docs/MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md) — privacy by module | The four-level standard is not written as one standard. |
| LC-HV2-03 | Data-flow map is complete | `engineering` | **none** | owner sets | designed | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — the architecture | No data-flow diagram a reviewer can read on its own. |
| LC-HV2-04 | Authorized purpose documented per institutional deployment | `privacy` | `PRIV-4` | owner sets | building | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — the pilot’s data plan | No DPA or SOW signed that states a purpose. |
| LC-HV2-05 | Minimum-necessary data rule is implemented | `data` | `PRIV-6` | owner sets | tested | [`app/src/lib/advisor-meeting.test.ts`](../app/src/lib/advisor-meeting.test.ts) — a share carries nothing the student did not tick<br>[`supabase/advisor.check.sql`](../supabase/advisor.check.sql) — advisors read only what was shared<br>[`app/server/integration/registry.test.ts`](../app/server/integration/registry.test.ts) — connector scopes declared per adapter | Integrations declare scopes; no field-mapping registry per institution. |
| LC-HV2-06 | No sale of student data, published | `privacy` | **none** | owner sets | tested | [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — the no-sale claim held to its evidence<br>[`docs/legal/PRIVACY-POLICY-DRAFT.md`](legal/PRIVACY-POLICY-DRAFT.md) — the promise in the policy draft | The privacy policy is a draft awaiting counsel. |
| LC-HV2-07 | No behavioral advertising on education records | `privacy` | **none** | owner sets | tested | [`app/src/donotbuild.test.ts`](../app/src/donotbuild.test.ts) — no advertising or tracking SDK loads<br>[`docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md`](legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md) — the policy, drafted | The policy is a draft awaiting counsel. |
| LC-HV2-08 | Subprocessor register is current | `privacy` | `PRIV-5` | owner sets | designed | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) — the subprocessors | Publication is in progress. |
| LC-HV2-09 | Retention schedule exists, with deletion jobs | `privacy` | `PRIV-1` | owner sets | tested | [`supabase/retention-sweeps.check.sql`](../supabase/retention-sweeps.check.sql) — the sweeps delete what the schedule says | None. |
| LC-HV2-10 | Export and deletion workflow exists | `privacy` | `PRIV-2` | owner sets | tested | [`app/src/lib/deleteaccount.test.ts`](../app/src/lib/deleteaccount.test.ts) — delete-account<br>[`supabase/deletion.check.sql`](../supabase/deletion.check.sql) — what deletion empties<br>[`app/src/lib/export.test.ts`](../app/src/lib/export.test.ts) — the export | Per student; no tenant-wide export and no deletion certificate. |
| LC-HV2-11 | Consent and sharing controls are explicit and revocable | `privacy` | `PRIV-6` | owner sets | tested | [`supabase/familyshare.check.sql`](../supabase/familyshare.check.sql) — family shares<br>[`supabase/supportshares.check.sql`](../supabase/supportshares.check.sql) — support shares | None for the share kinds that exist. |
| LC-HV2-12 | Education-record data is not redisclosed outside authorized purpose | `privacy` | `PRIV-4` | owner sets | designed | [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) — the redisclosure clause | A contract term; no DPA is signed. |
| LC-HV2-13 | Privacy request workflow exists | `privacy` | **none** | owner sets | designed | [`docs/STUDENT-DATA-CONTROL-CENTER.md`](STUDENT-DATA-CONTROL-CENTER.md) — the student’s own controls | No queue for requests an institution makes on a student’s behalf. |
| LC-HV2-14 | Incident notification obligations documented | `security` | `IR-1` | owner sets | tested | [`app/src/lib/security.test.ts`](../app/src/lib/security.test.ts) — commits to a clock for telling people | The contract clause waits on the DPA. |

### 2.3 Identity, access and authentication

9 rows, the weakest not-started: tested 6 · building 0 · designed 2 · not-started 1 · held 0.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV3-01 | SSO supported where the institution requires it | `engineering` | `IAM-1` | owner sets | tested | [`supabase/tenant-sso-policy.check.sql`](../supabase/tenant-sso-policy.check.sql) — a school’s SSO policy<br>[`docs/SAML-IMPLEMENTATION-RUNBOOK.md`](SAML-IMPLEMENTATION-RUNBOOK.md) — SAML | SAML only; no institution connected. |
| LC-HV3-02 | Administrator MFA enforced | `security` | **none** | owner sets | tested | [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — console approvals require aal2<br>[`app/src/components/MfaStep.test.tsx`](../app/src/components/MfaStep.test.tsx) — enrol and challenge | Enforced on console approvals, not on every administrative write. |
| LC-HV3-03 | High-risk actions require fresh authentication | `security` | **none** | owner sets | designed | [`docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md`](SSO-SECURITY-AND-SESSION-MANAGEMENT.md) — session management | No step-up check found in code. |
| LC-HV3-04 | RBAC/ABAC policy model documented | `security` | `IAM-2` | owner sets | tested | [`supabase/capabilities.check.sql`](../supabase/capabilities.check.sql) — capabilities, not role names<br>[`supabase/my-capabilities.check.sql`](../supabase/my-capabilities.check.sql) — what an account can do | None. |
| LC-HV3-05 | Object-level access controls tested | `engineering` | `TEN-1` | owner sets | tested | [`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — row-level security everywhere<br>[`supabase/access.check.sql`](../supabase/access.check.sql) — object access | None. |
| LC-HV3-06 | Tenant isolation tested | `engineering` | `TEN-1` | owner sets | tested | [`supabase/tenancy.check.sql`](../supabase/tenancy.check.sql) — reads inside the school<br>[`supabase/integration-rls-matrix.check.sql`](../supabase/integration-rls-matrix.check.sql) — integration rows by tenant | In progress in the readiness register. |
| LC-HV3-07 | Access reviews are scheduled | `security` | `IAM-3` | owner sets | not-started | [`docs/market-readiness/HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md) — IAM-3 not started | No procedure and no retained evidence. |
| LC-HV3-08 | Offboarding and deprovisioning supported | `engineering` | `IAM-1` | owner sets | tested | [`supabase/scim-gateway.check.sql`](../supabase/scim-gateway.check.sql) — SCIM deprovisioning<br>[`supabase/identity-provisioning.check.sql`](../supabase/identity-provisioning.check.sql) — provisioning | The institution gateway is not deployed. |
| LC-HV3-09 | Session timeout and recovery behavior documented | `security` | **none** | owner sets | designed | [`docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md`](SSO-SECURITY-AND-SESSION-MANAGEMENT.md) — sessions | No test holds a timeout. |

### 2.4 Application and database security

12 rows, the weakest designed: tested 8 · building 1 · designed 3 · not-started 0 · held 0.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV4-01 | Secure SDLC exists | `engineering` | `SDLC-1` | owner sets | building | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — every change runs the gates<br>[`REGRESSION-CHECKLIST.md`](../REGRESSION-CHECKLIST.md) — the gates and baselines | No written SDLC policy separate from the checklist. |
| LC-HV4-02 | Code review required | `engineering` | `SDLC-1` | owner sets | designed | [`docs/BRANCH-PROTECTION.md`](BRANCH-PROTECTION.md) — branch protection | A document of the setting, not a reading of it. |
| LC-HV4-03 | Dependency scanning runs in CI | `engineering` | `SDLC-2` | owner sets | tested | [`app/src/lib/supplychain.test.ts`](../app/src/lib/supplychain.test.ts) — the licence and dependency policy<br>[`docs/SUPPLY-CHAIN.md`](SUPPLY-CHAIN.md) — the procedure | None. |
| LC-HV4-04 | Secret scanning runs in CI | `engineering` | `SDLC-2` | owner sets | tested | [`app/src/lib/secrets.test.ts`](../app/src/lib/secrets.test.ts) — the inventory and rotation log<br>[`SECRETS.md`](../SECRETS.md) — the inventory | None. |
| LC-HV4-05 | SAST/DAST approach documented | `security` | `VULN-2` | owner sets | designed | [`docs/trust/PENETRATION-TEST-PLAN.md`](trust/PENETRATION-TEST-PLAN.md) — the test plan<br>[`.github/workflows/hawkscan.yml`](../.github/workflows/hawkscan.yml) — local-preview DAST | HawkScan is configured; the first run still requires the Actions secret and application-ID variable, and no independent test has occurred. |
| LC-HV4-06 | Threat modeling for high-risk features | `security` | **none** | owner sets | designed | [`docs/INTEGRATION-THREAT-MODEL.md`](INTEGRATION-THREAT-MODEL.md) — integrations | Integrations only; no template for other features. |
| LC-HV4-07 | RLS and database grants reviewed | `security` | `TEN-1` | owner sets | tested | [`supabase/grants.check.sql`](../supabase/grants.check.sql) — the grant allowlist<br>[`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — coverage | None. |
| LC-HV4-08 | SECURITY DEFINER functions inventoried and approved | `security` | **none** | owner sets | tested | [`app/src/lib/definerregister.test.ts`](../app/src/lib/definerregister.test.ts) — all 151 callable functions classified<br>[`supabase/definer-sweep.check.sql`](../supabase/definer-sweep.check.sql) — every one called by a stranger (DR-02, D-130)<br>[`docs/DEFINER-RLS-REGISTER.md`](DEFINER-RLS-REGISTER.md) — the register | DR-01 and DR-03 open, both low; the gtm_pilot_problems fix is live (D-129). |
| LC-HV4-09 | API input validation and rate limits exist | `engineering` | **none** | owner sets | tested | [`supabase/rate-limits.check.sql`](../supabase/rate-limits.check.sql) — the database rate limit<br>[`app/server/institution/rate-limit.test.ts`](../app/server/institution/rate-limit.test.ts) — the gateway’s | None. |
| LC-HV4-10 | Audit logs capture sensitive activity | `security` | `LOG-1` | owner sets | tested | [`supabase/role-grant-audit.check.sql`](../supabase/role-grant-audit.check.sql) — role grants<br>[`supabase/moderation-audit.check.sql`](../supabase/moderation-audit.check.sql) — moderation | None. |
| LC-HV4-11 | Security headers and transport encryption configured | `engineering` | `WEB-1` | owner sets | tested | [`app/src/lib/csp.test.ts`](../app/src/lib/csp.test.ts) — the content security policy<br>[`app/src/lib/hostheaders.test.ts`](../app/src/lib/hostheaders.test.ts) — the host’s headers | None. |
| LC-HV4-12 | Vulnerability remediation SLAs exist | `security` | `VULN-1` | owner sets | tested | [`app/src/lib/security.test.ts`](../app/src/lib/security.test.ts) — the severity model<br>[`SECURITY.md`](../SECURITY.md) — the SLAs | None. |

### 2.5 Infrastructure, resilience and operations

12 rows, the weakest not-started: tested 3 · building 1 · designed 7 · not-started 1 · held 0.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV5-01 | Production, staging, preview and local environments separated | `engineering` | **none** | owner sets | designed | [`STAGING.md`](../STAGING.md) — the environments | Described, not read from the providers. |
| LC-HV5-02 | Secrets managed server-side | `engineering` | **none** | owner sets | tested | [`app/src/lib/secrets.test.ts`](../app/src/lib/secrets.test.ts) — the four stores<br>[`SECRETS.md`](../SECRETS.md) — the inventory | None. |
| LC-HV5-03 | Backups configured | `operations` | `BCP-1` | owner sets | designed | [`RESTORE.md`](../RESTORE.md) — the provider’s backups | The tier’s documentation, not a dashboard reading. |
| LC-HV5-04 | Restore testing has occurred | `operations` | `BCP-1` | owner sets | designed | [`RESTORE.md`](../RESTORE.md) — the rehearsal against a throwaway database | No production restore performed and timed. |
| LC-HV5-05 | RTO/RPO objectives defined | `operations` | `BCP-1` | owner sets | designed | [`docs/market-readiness/DISASTER_RECOVERY.md`](market-readiness/DISASTER_RECOVERY.md) — the objectives | Not measured. |
| LC-HV5-06 | Monitoring and alerting active | `operations` | `MON-1` | owner sets | building | [`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — the synthetic probe<br>[`MONITORING.md`](../MONITORING.md) — the plan | No alert reaches a person. |
| LC-HV5-07 | Runtime-error tracking active | `engineering` | **none** | owner sets | not-started | [`MONITORING.md`](../MONITORING.md) — names it | No error tracker. |
| LC-HV5-08 | Integration health monitoring exists | `engineering` | `INT-1` | owner sets | tested | [`supabase/integration-control-plane.check.sql`](../supabase/integration-control-plane.check.sql) — connector state<br>[`app/src/lib/syncstatus.test.ts`](../app/src/lib/syncstatus.test.ts) — the sync words | None. |
| LC-HV5-09 | Incident-response runbooks exist, with a tabletop record | `security` | `IR-1` | owner sets | designed | [`docs/RUNBOOKS.md`](RUNBOOKS.md) — the runbooks<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — the plan | No tabletop record. |
| LC-HV5-10 | Status page and customer communication process exist | `operations` | `MON-1` | owner sets | tested | [`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — the status page<br>[`docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`](market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md) — the templates | None. |
| LC-HV5-11 | Rollback process is tested | `engineering` | **none** | owner sets | designed | [`ROLLBACK.md`](../ROLLBACK.md) — owner and time, held by rollback.test.ts | No rollback drill recorded. |
| LC-HV5-12 | Capacity and peak-period plan exists | `operations` | **none** | owner sets | designed | [`docs/REGISTRATION-DAY-MODE.md`](REGISTRATION-DAY-MODE.md) — the registration peak<br>[`docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md`](PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md) — performance | No load test. |

### 2.6 AI governance

12 rows, the weakest designed: tested 8 · building 3 · designed 1 · not-started 0 · held 0.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV6-01 | AI use is publicly disclosed | `trust` | `AI-1` | owner sets | tested | [`app/src/lib/trust/ai-training-policy.test.ts`](../app/src/lib/trust/ai-training-policy.test.ts) — the model-training and data-use policy held | No AI Use Policy as its own public document. |
| LC-HV6-02 | Approved AI providers and models inventoried | `trust` | `AI-1` | owner sets | tested | [`app/src/ai/providers/providers.test.ts`](../app/src/ai/providers/providers.test.ts) — the providers | None. |
| LC-HV6-03 | Provider data-use terms reviewed | `trust` | **none** | owner sets | designed | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) — providers as subprocessors | No recorded review of each provider’s terms. |
| LC-HV6-04 | No unauthorized model training on student or institution data | `trust` | **none** | owner sets | tested | [`app/src/lib/trust/ai-training-policy.test.ts`](../app/src/lib/trust/ai-training-policy.test.ts) — the policy | None. |
| LC-HV6-05 | Source permissions checked before retrieval | `engineering` | `AI-1` | owner sets | tested | [`app/src/lib/context.test.ts`](../app/src/lib/context.test.ts) — what leaves the device, and nothing else | None. |
| LC-HV6-06 | Source citations and limitations shown | `product` | **none** | owner sets | tested | [`app/src/ai/quality.test.ts`](../app/src/ai/quality.test.ts) — the line under every reply<br>[`app/src/components/StudyStudio.anchors.test.tsx`](../app/src/components/StudyStudio.anchors.test.tsx) — page and slide anchors | None. |
| LC-HV6-07 | Course and institution AI policy hierarchy exists | `trust` | `AI-1` | owner sets | tested | [`supabase/intelligence-policy.check.sql`](../supabase/intelligence-policy.check.sql) — the policy rows<br>[`app/src/lib/coursestudio.test.ts`](../app/src/lib/coursestudio.test.ts) — the course’s rules | None. |
| LC-HV6-08 | Prompt-injection defense tests exist | `security` | **none** | owner sets | tested | [`app/src/ai/injection.test.ts`](../app/src/ai/injection.test.ts) — the fence | The live red-team skips without a key and has not run. |
| LC-HV6-09 | High-impact actions require exact preview and confirmation | `product` | **none** | owner sets | tested | [`app/src/ai/threadactions.test.tsx`](../app/src/ai/threadactions.test.tsx) — proposed actions the student presses | None. |
| LC-HV6-10 | AI history and output deletion supported | `privacy` | **none** | owner sets | building | [`app/src/lib/threads.ts`](../app/src/lib/threads.ts) — conversations on the device | Server-side AI records follow RETENTION.md; no one-press delete of them. |
| LC-HV6-11 | AI quality, cost, latency and safety monitoring exist | `engineering` | `AI-2` | owner sets | building | [`app/src/ai/providers/money.test.ts`](../app/src/ai/providers/money.test.ts) — the metered budget | No evaluation set and no dashboard. |
| LC-HV6-12 | AI incident and feedback process exists | `trust` | `AI-3` | owner sets | building | [`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — the kill switch, global and per school | No AI incident playbook; the drill is unrun. |

### 2.7 Accessibility and WCAG 2.2

12 rows, the weakest designed: tested 6 · building 2 · designed 4 · not-started 0 · held 0.

| ID | Control | Owner | Readiness control | Due | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-HV7-01 | Accessibility statement published, with a reporting contact | `accessibility` | **none** | owner sets | building | [`app/src/site/render.tsx`](../app/src/site/render.tsx) — the /accessibility/ route<br>[`docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`](legal/ACCESSIBILITY-STATEMENT-DRAFT.md) — the dated statement, drafted | The statement is a draft; the page is not yet it. |
| LC-HV7-02 | WCAG 2.2 AA baseline adopted | `accessibility` | **none** | owner sets | tested | [`app/src/a11y/axe.test.tsx`](../app/src/a11y/axe.test.tsx) — the automated probe<br>[`docs/WCAG-UI-AUDIT-SCORECARD.md`](WCAG-UI-AUDIT-SCORECARD.md) — the scorecard | Automated only. |
| LC-HV7-03 | VPAT or dated VPAT plan exists | `accessibility` | **none** | owner sets | designed | [`docs/trust/HECVAT-VPAT-PLAN.md`](trust/HECVAT-VPAT-PLAN.md) — the plan | No VPAT. |
| LC-HV7-04 | Keyboard navigation tested | `accessibility` | **none** | owner sets | tested | [`app/src/screens/Calendar.keyboard.test.tsx`](../app/src/screens/Calendar.keyboard.test.tsx) — the calendar by keyboard | No manual test record across the core path. |
| LC-HV7-05 | Visible focus and focus order tested | `accessibility` | **none** | owner sets | tested | [`app/src/a11y/focus.test.ts`](../app/src/a11y/focus.test.ts) — the ring<br>[`app/src/a11y/modal.test.ts`](../app/src/a11y/modal.test.ts) — focus in dialogs | None. |
| LC-HV7-06 | Screen-reader paths tested | `accessibility` | **none** | owner sets | designed | [`docs/accessibility/AT-PASS-PROTOCOL.md`](accessibility/AT-PASS-PROTOCOL.md) — the protocol | No NVDA or VoiceOver record. |
| LC-HV7-07 | Contrast and non-color indicators tested | `accessibility` | **none** | owner sets | tested | [`app/src/lib/contrast.test.ts`](../app/src/lib/contrast.test.ts) — the whole ramp | None. |
| LC-HV7-08 | Zoom and reflow tested at 200–400% | `accessibility` | **none** | owner sets | building | [`app/src/widthgate.test.ts`](../app/src/widthgate.test.ts) — the narrow-width gate | No zoom QA result. |
| LC-HV7-09 | Reduced-motion support tested | `accessibility` | **none** | owner sets | tested | [`app/src/a11y/motion.test.ts`](../app/src/a11y/motion.test.ts) — jumps instead of gliding | None. |
| LC-HV7-10 | Captions and transcripts process exists | `accessibility` | **none** | owner sets | designed | [`docs/VIDEO_PODCAST_ROADMAP.md`](VIDEO_PODCAST_ROADMAP.md) — media | No publishing checklist. |
| LC-HV7-11 | Tables, charts, documents and exports accessible | `accessibility` | **none** | owner sets | tested | [`app/src/lib/exportqa.test.ts`](../app/src/lib/exportqa.test.ts) — the exports | Charts are not audited. |
| LC-HV7-12 | Accessibility issues have a support and remediation path | `accessibility` | **none** | owner sets | designed | [`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md`](operating-model/ACCESSIBILITY-GOVERNANCE.md) — governance | No ticket category or SLA for it. |

## 3. The registration go-live checklist

### Product and student experience

14 items, the weakest designed: tested 13 · building 0 · designed 1 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-REG1-01 | Student can create or sign in to an account securely | tested | [`app/src/components/MfaStep.test.tsx`](../app/src/components/MfaStep.test.tsx) — the second factor | SSO for students waits on an institution. |
| LC-REG1-02 | Student can choose a program or enter planning data | tested | [`app/src/components/PathSnapshotCard.test.tsx`](../app/src/components/PathSnapshotCard.test.tsx) — saves the student’s path and shows it back | None. |
| LC-REG1-03 | Path Snapshot labels verified, imported, student-entered and estimated data | tested | [`app/src/components/PathSnapshotCard.test.tsx`](../app/src/components/PathSnapshotCard.test.tsx) — says it is not official<br>[`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — the five labels | None. |
| LC-REG1-04 | Student can search and compare approved course options | tested | [`app/src/lib/registration.test.ts`](../app/src/lib/registration.test.ts) — the institution catalog, imported atomically | Compared in the plan, not side by side. |
| LC-REG1-05 | Student can create a term plan | tested | [`app/src/components/RegistrationDay.test.tsx`](../app/src/components/RegistrationDay.test.tsx) — the plan on the device | None. |
| LC-REG1-06 | Schedule conflict detection works and explains conflicts | tested | [`app/src/lib/registration-day.test.ts`](../app/src/lib/registration-day.test.ts) — counts a conflict<br>[`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) — proposes an action per conflict | None. |
| LC-REG1-07 | Student can add a primary option and ranked backups | tested | [`app/src/components/RegistrationDay.test.tsx`](../app/src/components/RegistrationDay.test.tsx) — adds a backup from the offered sections<br>[`app/src/lib/registration-day.test.ts`](../app/src/lib/registration-day.test.ts) — refuses too many backups | None. |
| LC-REG1-08 | Registration readiness checklist is available | tested | [`app/src/lib/registration-day.test.ts`](../app/src/lib/registration-day.test.ts) — complete only with every check, a backup each, no conflict and a time | None. |
| LC-REG1-09 | Student can create an advisor agenda | tested | [`app/src/components/AdvisorMeeting.test.tsx`](../app/src/components/AdvisorMeeting.test.tsx) — the agenda | None. |
| LC-REG1-10 | Agenda saved, exported or shared only with explicit confirmation | tested | [`app/src/lib/advisor-meeting.test.ts`](../app/src/lib/advisor-meeting.test.ts) — nothing the student did not tick | None. |
| LC-REG1-11 | Registration time and hold category shown only when source is current and approved | designed | [`docs/REGISTRATION-DAY-MODE.md`](REGISTRATION-DAY-MODE.md) — the mode | The time is student-entered; holds are not read from any system. |
| LC-REG1-12 | Official registration handoff with source and freshness state | tested | [`app/src/components/RegistrationDayCard.test.tsx`](../app/src/components/RegistrationDayCard.test.tsx) — opens the official system only after a confirmation<br>[`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) — https addresses only | Freshness is not shown on the handoff. |
| LC-REG1-13 | Semester never promises a seat or official eligibility | tested | [`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) — never says Semester registers anybody<br>[`app/src/components/RegistrationDay.test.tsx`](../app/src/components/RegistrationDay.test.tsx) — registers nobody, and names the seat source | None. |
| LC-REG1-14 | Student can report wrong data or request help | tested | [`app/src/components/GetHelp.test.tsx`](../app/src/components/GetHelp.test.tsx) — help<br>[`app/src/components/ActionCenter.help.test.tsx`](../app/src/components/ActionCenter.help.test.tsx) — help from an action | No “this is wrong” on a catalog fact itself. |

### Registrar and governance

9 items, the weakest not-started: tested 3 · building 4 · designed 0 · not-started 2 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-REG2-01 | Catalog and requirement data have named institutional owners | not-started | [`docs/REGISTRATION-DAY-MODE.md`](REGISTRATION-DAY-MODE.md) — names the catalog as the source | No owner field on a catalog or requirement. |
| LC-REG2-02 | Course and section content has source URL or system and last-reviewed date | building | [`app/src/lib/registration.ts`](../app/src/lib/registration.ts) — the imported catalog | No last-reviewed date on a section. |
| LC-REG2-03 | Registration rules have a documented source and effective date | not-started | [`docs/REGISTRATION-DAY-MODE.md`](REGISTRATION-DAY-MODE.md) — the rules the mode follows | No effective date on any rule. |
| LC-REG2-04 | Prerequisites, restrictions and capacity are source-labelled | building | [`app/src/lib/registration.ts`](../app/src/lib/registration.ts) — seats preserved on import | Prerequisites and restrictions are not imported. |
| LC-REG2-05 | Source refresh target and stale-data behavior configured | building | [`app/src/lib/syncstatus.ts`](../app/src/lib/syncstatus.ts) — what waits and what is lost | No refresh target per source. |
| LC-REG2-06 | Registrar can publish or approve registration windows through a controlled workflow | tested | [`app/src/lib/registrar.test.ts`](../app/src/lib/registrar.test.ts) — the registrar<br>[`app/src/lib/registrar.calendar.test.ts`](../app/src/lib/registrar.calendar.test.ts) — its calendar | No approval step before a window reaches students. |
| LC-REG2-07 | No client user can alter official registration, enrollment or hold state | tested | [`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) — never says Semester registers anybody | No write path to a student system exists; nothing refuses one being added. |
| LC-REG2-08 | Audit records capture administrative changes | tested | [`supabase/role-grant-audit.check.sql`](../supabase/role-grant-audit.check.sql) — role grants<br>[`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — console approvals | None. |
| LC-REG2-09 | Institution approves pilot scope and data fields | building | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — productionDataApproved | A boolean, not a list of fields. |

### Technical and resilience

9 items, the weakest not-started: tested 4 · building 3 · designed 0 · not-started 2 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-REG3-01 | Course search performance tested under expected peak load | not-started | [`docs/REGISTRATION-DAY-MODE.md`](REGISTRATION-DAY-MODE.md) — the peak | No load test. |
| LC-REG3-02 | Plan save is durable and idempotent | tested | [`app/src/lib/conflicts.test.ts`](../app/src/lib/conflicts.test.ts) — a record edited on both sides; the later kept<br>[`app/src/state/deletions.test.tsx`](../app/src/state/deletions.test.tsx) — a deletion made offline stays deleted after the app closes<br>[`supabase/sync.check.sql`](../supabase/sync.check.sql) — sync | Device-first; the server copy is the sync’s. |
| LC-REG3-03 | Conflict calculations have unit and end-to-end tests | building | [`app/src/lib/registration-day.test.ts`](../app/src/lib/registration-day.test.ts) — unit | No end-to-end test. |
| LC-REG3-04 | Stale SIS or catalog data visibly marked | building | [`app/src/lib/syncstatus.ts`](../app/src/lib/syncstatus.ts) — sync state | No SIS feed, so nothing to mark stale yet. |
| LC-REG3-05 | Integration failure has official fallback behavior | tested | [`app/src/components/GetHelp.test.tsx`](../app/src/components/GetHelp.test.tsx) — the official office<br>[`app/src/components/OfflineBanner.test.tsx`](../app/src/components/OfflineBanner.test.tsx) — offline | None. |
| LC-REG3-06 | Repeated or out-of-order events create no duplicate actions or plans | tested | [`supabase/outbox.check.sql`](../supabase/outbox.check.sql) — the outbox<br>[`app/src/lib/registration-day.test.ts`](../app/src/lib/registration-day.test.ts) — drops duplicate backups | No SIS event stream exists to reorder. |
| LC-REG3-07 | Registration Day Mode behind a flag that can be disabled per tenant | building | [`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) — follows the registration_day_mode flag | The flag is build-level, not per tenant. |
| LC-REG3-08 | Monitoring for plan save, course search, sync freshness and official handoff | not-started | [`MONITORING.md`](../MONITORING.md) — the plan | None of the four is monitored. |
| LC-REG3-09 | Registration notifications honor quiet hours and preferences | tested | [`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) — silenced by its toggle and by quiet hours | None. |

## 4. The LMS and Course Studio go-live checklist

### Learning experience

11 items, the weakest designed: tested 9 · building 1 · designed 1 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-LMS1-01 | Course context accurate, source-labelled and tenant-scoped | tested | [`supabase/lti-integration.check.sql`](../supabase/lti-integration.check.sql) — the launch’s course, inside its school | None. |
| LC-LMS1-02 | Student can access approved course materials according to permissions | tested | [`supabase/coursestudio.check.sql`](../supabase/coursestudio.check.sql) — published materials by course | None. |
| LC-LMS1-03 | Upload pipeline validates file type and scans untrusted files | building | [`app/src/lib/mediascan.test.ts`](../app/src/lib/mediascan.test.ts) — images by their bytes | Images only; no malware scan of documents. |
| LC-LMS1-04 | Extraction preserves page, slide, timestamp and file-version anchors | tested | [`app/src/components/StudyStudio.anchors.test.tsx`](../app/src/components/StudyStudio.anchors.test.tsx) — pages and slides | No timestamp or file-version anchor. |
| LC-LMS1-05 | Student reviews extracted syllabus dates before they create actions or calendar entries | designed | [`docs/STUDY-READINESS-AND-SOURCE-LOCKER.md`](STUDY-READINESS-AND-SOURCE-LOCKER.md) — the source locker | No review step in code. |
| LC-LMS1-06 | Study assets show citations and allow correction or deletion | tested | [`app/src/lib/studystudio.test.ts`](../app/src/lib/studystudio.test.ts) — the study studio | None. |
| LC-LMS1-07 | Course AI policy visible and enforced | tested | [`supabase/intelligence-policy.check.sql`](../supabase/intelligence-policy.check.sql) — the policy<br>[`app/src/lib/coursestudio.test.ts`](../app/src/lib/coursestudio.test.ts) — published rules | None. |
| LC-LMS1-08 | Active-assessment restrictions offer safe alternatives, not dead ends | tested | [`app/src/lib/coursestudio.test.ts`](../app/src/lib/coursestudio.test.ts) — never final answers without the instructor’s confirmation | The rule is held; no study alternative is offered in its place. |
| LC-LMS1-09 | Student can create study plans and use practice tools | tested | [`app/src/components/StudyStudio.test.tsx`](../app/src/components/StudyStudio.test.tsx) — practice | None. |
| LC-LMS1-10 | Student workspace files and drafts private by default | tested | [`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — every table under row-level security<br>[`app/src/lib/files.test.ts`](../app/src/lib/files.test.ts) — the drive | None. |
| LC-LMS1-11 | Any sharing is explicit, scoped, expiring where appropriate and auditable | tested | [`supabase/supportshares.check.sql`](../supabase/supportshares.check.sql) — support shares<br>[`supabase/familyshare.check.sql`](../supabase/familyshare.check.sql) — family shares | None. |

### Faculty experience

6 items, the weakest building: tested 4 · building 2 · designed 0 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-LMS2-01 | Faculty can create and approve course source packs | tested | [`app/src/components/StudyStudio.packs.test.tsx`](../app/src/components/StudyStudio.packs.test.tsx) — source packs | None. |
| LC-LMS2-02 | Faculty can publish course AI policy and allowed-use guidance | tested | [`app/src/lib/coursestudio.test.ts`](../app/src/lib/coursestudio.test.ts) — rules before they are published | None. |
| LC-LMS2-03 | Faculty can review how students see course materials | building | [`app/src/components/CourseStudio.test.tsx`](../app/src/components/CourseStudio.test.tsx) — the studio | No student-view preview. |
| LC-LMS2-04 | Faculty role does not reveal private student plans or notes | tested | [`supabase/coursestudio.check.sql`](../supabase/coursestudio.check.sql) — what faculty read<br>[`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — coverage | None. |
| LC-LMS2-05 | Assessment and gradebook features labelled practice, draft or official | building | [`app/src/screens/grades.test.tsx`](../app/src/screens/grades.test.tsx) — grades | No official label, because nothing official exists. |
| LC-LMS2-06 | Official-grade sync requires institution approval, audit and reconciliation | tested | [`app/src/lib/ltiags.test.ts`](../app/src/lib/ltiags.test.ts) — grade services refused without a graded link<br>[`supabase/ltiags.check.sql`](../supabase/ltiags.check.sql) — held | No reconciliation report. |

### Integration and standards

7 items, the weakest building: tested 5 · building 2 · designed 0 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-LMS3-01 | LTI 1.3 configuration documented and tested | tested | [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](LTI-1.3-LAUNCH-RUNBOOK.md) — the runbook<br>[`app/src/lib/lti.test.ts`](../app/src/lib/lti.test.ts) — the launch | None. |
| LC-LMS3-02 | Launches validate issuer, audience, deployment, nonce, state and signature | tested | [`supabase/lti.check.sql`](../supabase/lti.check.sql) — the nonce is single-use<br>[`app/src/lib/lti.test.ts`](../app/src/lib/lti.test.ts) — the claims | None. |
| LC-LMS3-03 | Deep links return students to authorized LMS destinations | tested | [`app/src/lib/ltideeplink.test.ts`](../app/src/lib/ltideeplink.test.ts) — the settings claim | The return is not tested end to end. |
| LC-LMS3-04 | Names and roles access restricted to the current course | building | [`app/src/lib/ltimembership.test.ts`](../app/src/lib/ltimembership.test.ts) — the membership join | NRPS is not implemented. |
| LC-LMS3-05 | Assignment and grade exchange disabled until approved and tested | tested | [`app/src/lib/ltiags.test.ts`](../app/src/lib/ltiags.test.ts) — refused without a graded link<br>[`supabase/ltiags.check.sql`](../supabase/ltiags.check.sql) — held | None. |
| LC-LMS3-06 | LMS connection status, scopes, last sync and disconnect visible | building | [`app/src/lib/syncstatus.ts`](../app/src/lib/syncstatus.ts) — sync words | No LMS connection panel. |
| LC-LMS3-07 | No unsupported claim that Semester replaces LMS grading | tested | [`app/src/screens/lmsclaims.test.ts`](../app/src/screens/lmsclaims.test.ts) — what the app says about grades and submissions | None. |

## 5. The student-data migration playbook

No production load path for customer data exists ([`docs/market-readiness/MIGRATION_PLAYBOOK.md`](market-readiness/MIGRATION_PLAYBOOK.md)); the Migration Center records evidence and roster staging is a foundation. This is its shape, for the first pilot, even one that uses only curated or manual data. The principle: migrate only data needed for the approved scope.

**Sequence:** Discover → Classify → Minimize → Map → Transform → Sample import → Validate → Reconcile → Parallel run → Cutover → Archive/export legacy data → Monitor and correct.

### The inventory

| Data domain | Pilot default | Expansion option | High-risk considerations | The tree today |
| --- | --- | --- | --- | --- |
| Identity | SSO identifier / local account | SCIM lifecycle | Avoid duplicate accounts; protect identifiers | Local accounts and SAML; SCIM gateway checked, not deployed. |
| Student profile | Student-entered minimum context | Approved program/term data | Do not import sensitive demographic data unnecessarily | Student-entered, labelled so. |
| Program/requirements | Curated or approved planning data | SIS/catalog feed | Clearly label estimates until verified | The path snapshot says it is not official. |
| Course catalog | Curated course list | Full catalog/section sync | Source freshness and effective dates | CSV/JSON import, atomic; no effective dates. |
| Enrollment | Manual or approved current-term list | SIS roster sync | Minimum field access and tenant scope | LTI membership per launch; no roster sync. |
| Plans | Student-created | Legacy plan import | Preserve owner and edit history | Student-created only. |
| Course materials | Student-selected/authorized files | Approved LMS content | Copyright, access, deletion, academic integrity | Student files and faculty source packs. |
| Grades | Exclude initially | Approved read-only summary or formal gradebook migration | High sensitivity; official-record controls | Student-entered only; grade passback gated. |
| Financial data | Exclude initially | High-level deadlines/holds; later authorized workflows | PCI, aid and account confidentiality | Excluded; no payment data is held. |
| Housing/health | Exclude initially | Narrow service workflows | Restricted data and special legal obligations | Excluded. |
| Support cases | Exclude initially | Migration only with explicit purpose/retention plan | Sensitive notes and confidentiality | Excluded. |

### The seventeen artifacts

8 carried by something, 9 by nothing.

| Artifact | Carried by | Note |
| --- | --- | --- |
| Migration charter | **none** | QTI has one (docs/QTI-3-ASSESSMENT-AND-MIGRATION.md); student data has none. |
| Source-system inventory | [`docs/INTEROPERABILITY-ROADMAP.md`](INTEROPERABILITY-ROADMAP.md) | The systems, not an institution’s instances of them. |
| Approved data scope | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) | The data plan on a pilot. |
| Data Processing Addendum / institutional agreement | [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) | A checklist, not an agreement. |
| Data classification map | **none** | See LC-HV2-02. |
| Field mapping specification | **none** | The template is on this page; no institution’s mapping exists. |
| Transformation rules | [`app/src/lib/registration.ts`](../app/src/lib/registration.ts) | The catalog import’s parsing, for courses only. |
| Data quality rules | [`app/src/lib/registration.ts`](../app/src/lib/registration.ts) | Rejects incomplete, duplicate and invalid rows atomically. |
| Duplicate and identity resolution rules | **none** | Account linking is by ticket (FERPA-IDENTITY-GUARDRAILS). |
| Sample data set and expected results | **none** | None. |
| Migration runbook | **none** | MIGRATION_PLAYBOOK: evidence path and roster staging exist; no production load path for any domain. |
| Rollback plan | **none** | ROLLBACK.md is for releases, not imports. |
| Reconciliation report | [`docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`](INTEGRATION-QUALITY-AND-RECONCILIATION.md) | For integrations, not a one-time import. |
| Exception register | **none** | None. |
| Cutover approval record | [`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql) | A school moves a state only with the leaving state’s exit evidence. |
| Archive/export plan | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](DATA-PORTABILITY-AND-OFFBOARDING.md) | Offboarding, not legacy archive. |
| Post-migration validation report | **none** | None. |

### The field-mapping template

| Source field | Semester field | Classification | Transformation | Owner | Retention | Validation | The tree today |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SIS student ID | `external_identity_id` | Student private | Tokenize/normalize if needed | Registrar | Contract-defined | Match active record | No such column; identities arrive by SAML or LTI subject. |
| Catalog course code | `course.code` | Internal/public | Normalize subject/number | Registrar | Institutional | Exists and unique | Course.code in app/src/lib/types.ts. |
| Course section time | `section.meeting_pattern` | Internal | Parse time zone/location | Registrar | Term lifecycle | No invalid overlaps | Meetings on the imported catalog (registration.ts). |
| Requirement rule | `requirement.rule` | Internal | Map to rule schema | Curriculum office | Curriculum lifecycle | Rule test suite | No requirement rule schema. |
| Student plan item | `plan_item` | Student private | Preserve owner/version | Student | Student retention | Count and owner match | Plans are the student’s own, on the device and in sync. |

### The parallel run

For any future authoritative replacement, in order:

1. Legacy system remains official
2. Semester imports/synchronizes approved data
3. Semester performs workflow in shadow mode
4. Differences are reconciled
5. Institution validates results
6. Cutover is approved by authorized owners
7. Semester becomes authoritative only for approved domain
8. Legacy data is archived/exported according to policy

Each forward move of a school is already one step with the leaving state’s exit evidence ([`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql)).

### The guardrails

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-MIG-01 | Never overwrite student-owned notes, drafts, plans or consent choices with imported data | tested | [`app/src/lib/conflicts.test.ts`](../app/src/lib/conflicts.test.ts) — says which side a merge kept, never silently | No import path exists yet to hold to it. |
| LC-MIG-02 | Never silently convert estimated data into institution-verified data | tested | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — the database refuses a label the app cannot name | None. |
| LC-MIG-03 | Never import restricted data into AI context by default | tested | [`app/src/lib/context.test.ts`](../app/src/lib/context.test.ts) — no note body, nobody else’s name | None. |
| LC-MIG-04 | Never use production student records in development or test without formal approval | building | [`app/src/lib/demosplit.test.ts`](../app/src/lib/demosplit.test.ts) — the demo is never the product, and wears its label<br>[`app/src/data/seed.test.ts`](../app/src/data/seed.test.ts) — the seed | No written approval process for an exception. |
| LC-MIG-05 | Never cut over without rollback, reconciliation, ownership and support plans | tested | [`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql) — each forward move needs exit-gate evidence | The evidence is whatever is filed; no template requires these four. |

## 6. The first pilot agreement

The brief’s first pilot is a **Registration and Path Pilot**. [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) carries the twenty-six sections; its sample is an LMS/course pilot. This is the second shape, held to the same code.

| Term | The brief | The tree |
| --- | --- | --- |
| Parties | Semester [legal entity]; Institution [full legal entity] | The entity is a single-member LLC (HECVAT COMP-01). |
| Purpose | A limited, time-bound pilot of planning, registration-readiness, advisor-agenda and related workflows | PilotPlan.workflow. |
| Cohort | 25–100 students | PilotPlan.cohort is free text; no bound is enforced. |
| Duration | 12–26 weeks | Exactly 26 weeks, which the code enforces (LC-PILOT-TERM, D-134). |
| Use case | Registration readiness and academic pathway planning | The outline’s sample is an LMS/course pilot; this is the second shape. |
| Authorized modules | Today, My Path, Plan, Action Center, advisor agenda, feedback/support | Today, My Path and Plan are three of the five destinations; the Action Center is behind today_action_center. |
| Optional scope | SSO; approved catalog/program data; selected calendar connection | SAML; the catalog import; calendar feeds. |

**LC-PILOT-TERM · tested.** Pilot duration: the brief says 12–26 weeks (84–182 days). None: the owner chose exactly 26 weeks (D-134), the top of the brief’s range. It was 60–120 days when these briefs arrived.

| Evidence | Shows |
| --- | --- |
| [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) | pilotReadiness refuses anything but exactly 26 weeks (PILOT_WEEKS) |
| [`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) | held |
| [`docs/PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md) | the length rule: exactly 26 weeks (D-134) |

### Explicit exclusions

8 already kept out by something in the tree; the rest by the contract alone.

| Exclusion | Kept out by | Note |
| --- | --- | --- |
| Official registration execution | [`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) | Never says Semester registers anybody. |
| Official degree certification or graduation decision | [`app/src/components/PathSnapshotCard.test.tsx`](../app/src/components/PathSnapshotCard.test.tsx) | Says it is not official. |
| Automatic add/drop/withdrawal | [`app/src/lib/registration-day.mode.test.ts`](../app/src/lib/registration-day.mode.test.ts) | No write path exists; nothing refuses one being added. |
| Production SIS write access | **none** | No SIS connector writes; a contract exclusion is needed to keep it so. |
| Official gradebook replacement | [`app/src/screens/lmsclaims.test.ts`](../app/src/screens/lmsclaims.test.ts) | The app does not say it. |
| Payment or financial-aid processing | [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) | The no-payment-data claim. |
| Housing, dining, health, emergency, or broad parent/supporter portals | **none** | Family sharing exists; a contract exclusion is needed. |
| Unrestricted AI agents | [`app/src/ai/threadactions.test.tsx`](../app/src/ai/threadactions.test.tsx) | Every action is proposed and pressed. |
| Public student social features | **none** | Community exists behind its flags; the pilot must switch it off. |
| Individual student surveillance or risk scoring | [`ops/strategic-boundaries/README.md`](../ops/strategic-boundaries/README.md) | Boundaries 1 and 4. |
| Grades, retention, graduation or employment promises | [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) | No causal claim without method. |

### Attachments

|  | Attachment | Nearest in the tree | Note |
| --- | --- | --- | --- |
| A | Pilot Statement of Work | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) | The SOW fields held to PilotPlan; no pilot-fee field. |
| B | Data Processing Addendum | [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) | A checklist for counsel. |
| C | Security Schedule | [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md) | The whitepaper; not a schedule. |
| D | Accessibility Statement / VPAT or plan | [`docs/trust/HECVAT-VPAT-PLAN.md`](trust/HECVAT-VPAT-PLAN.md) | A plan, not a VPAT. |
| E | AI Policy and Data-Use Schedule | [`docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) | The training policy. |
| F | Support and Escalation Policy | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) | No response targets. |
| G | Implementation Plan | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) | The playbook. |
| H | Approved Data Field List | **none** | No list; the field-mapping template above is its shape. |
| I | Subprocessor Register | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) | In progress. |
| J | Pricing Schedule | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) | The deal desk’s floors. |

### Success measures

The brief’s ten, which a PilotPlan’s metrics would carry, each with a baseline:

- account creation and onboarding
- Path Snapshot rate
- plan creation
- backup-course rate
- conflict resolution
- advisor agenda rate
- search-to-action success
- student clarity score
- advisor usefulness score
- support/friction themes

The agreement must not promise grades, retention, graduation, persistence or employment.

## 7. The SLA and packaging matrix

### Pilot support, against [`docs/trust/SLA.md`](trust/SLA.md)

Do not promise 24/7 or an uptime percentage until monitoring, on-call and staffing support it.

| Service level | Suggested pilot commitment | SLA.md today |
| --- | --- | --- |
| Support hours | Business hours, institution time zone | Not stated in SLA.md. |
| Critical acknowledgement | Within 4 business hours | Not stated. |
| High acknowledgement | Within 1 business day | Not stated. |
| Standard acknowledgement | Within 2 business days | Not stated. |
| Planned maintenance | Advance notice where practical | SLA.md excludes it from downtime. |
| Status communication | Status page / named contact | The status page exists. |
| Availability | Stated only after it is measured | SLA.md has uptime tiers; none is measured. |

### Packages

Each held to a plan in [`app/src/lib/plans.ts`](../app/src/lib/plans.ts) or a tier the deal desk prices ([`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts)).

| Package | Buyer | Scope | Support | Integrations | Commercial model | Plan | Deal tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Semester Free | Individual student | Personal planning basics | Self-service | Student-selected only | Free | `free` | **none** |
| Semester Plus | Individual student | Advanced planning, sharing, exports | Standard support | Calendar/files | Subscription | `plus` | **none** |
| Semester Pro | Individual student | Advanced scenarios, career, AI allowance | Priority self-service | Expanded personal connections | Subscription | `pro` | **none** |
| Registration Pilot | Department/institution | 25–100 cohort, planning and advisor workflow | Named implementation/support contact | Optional SSO/catalog read | Fixed pilot fee + implementation | **none** | `pilot` |
| Department | College/department | Configured academic/student-success workflow | Business-hours support | SSO, approved source feeds | Annual license + setup | `institution` | `department` |
| Campus | Institution | Multi-module student experience | Named customer-success lead | SSO, LMS/SIS read, content feeds | Enrollment-band annual license | `institution` | `campus` |
| Enterprise | System/multi-campus | Advanced governance, integrations, operations | Premium/negotiated | SCIM, advanced SIS/LMS, custom connectors | Multi-year agreement | `institution` | `system` |

### Pricing principles

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-PRICE-01 | Price product access separately from high-touch implementation | tested | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) — an implementation fee floor apart from the licence<br>[`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — refuses a fee under the floor | None. |
| LC-PRICE-02 | Price complex integrations separately from standard configuration | designed | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) — the pricing layers | No integration line in the deal desk. |
| LC-PRICE-03 | Use enrollment or active-user bands for institutional pricing | designed | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) — the bands | The deal desk has tier minimums, not bands. |
| LC-PRICE-04 | Do not paywall student export, deletion or access to student-owned plans | tested | [`app/src/lib/plans.test.ts`](../app/src/lib/plans.test.ts) — the plans<br>[`app/src/lib/deleteaccount.test.ts`](../app/src/lib/deleteaccount.test.ts) — deletion for every account | None. |
| LC-PRICE-05 | Include an AI allowance; meter unusually high use only after transparent notice | building | [`app/src/ai/providers/money.test.ts`](../app/src/ai/providers/money.test.ts) — the metered budget | No notice before metering. |
| LC-PRICE-06 | Offer pilot credits toward annual expansion | tested | [`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — a capped pilot credit | None. |
| LC-PRICE-07 | Do not discount away security, accessibility, support or implementation | tested | [`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — refuses a fee under the floor, whatever the discount | Only the implementation fee is held. |

## 8. The go-live command center

One page per pilot launch. 6 of its 23 fields are a `PilotPlan` field today ([`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts)); the rest would be added there, not to a spreadsheet. The launch-wide board is [`docs/LAUNCH-WAR-ROOM.md`](LAUNCH-WAR-ROOM.md).

| Field | PilotPlan field |
| --- | --- |
| Pilot name and cohort | `cohort` |
| Go-live date | `startDate` |
| Executive sponsor | `executiveSponsor` |
| Technical owner | **none** |
| Student-success owner | `operationalChampion` |
| Security/privacy owner | **none** |
| Accessibility owner | **none** |
| Content owner | **none** |
| Semester implementation owner | **none** |
| Current phase | **none** |
| Open blockers | **none** |
| Data scope approval | `productionDataApproved` |
| SSO status | **none** |
| Integration status | **none** |
| Content readiness | **none** |
| Accessibility review | **none** |
| Training completion | **none** |
| Student communication status | **none** |
| Support readiness | **none** |
| Monitoring status | **none** |
| Rollback readiness | **none** |
| Success-metric baseline | `baseline` |
| Launch decision | **none** |

### The go/no-go meeting

| # | Step | Answered by |
| --- | --- | --- |
| 1 | Confirm pilot scope and exclusions | 6. The first pilot agreement |
| 2 | Confirm approved data fields and retention schedule | 5. The student-data migration playbook |
| 3 | Confirm access/role/tenant isolation tests | 2. The HECVAT tracker |
| 4 | Confirm source freshness and official fallback behavior | 3. The registration go-live checklist |
| 5 | Confirm student, advisor and admin critical journeys | 9. The final launch gate |
| 6 | Confirm accessibility test outcomes and known limitations | 2. The HECVAT tracker |
| 7 | Confirm support, incident and escalation contacts | 8. The go-live command center |
| 8 | Confirm monitoring, backup, restore, feature flag and rollback readiness | 2. The HECVAT tracker |
| 9 | Confirm launch communications and training | 1. The go-live decision standard |
| 10 | Record go/no-go decision, approvers, risks and next review date | 8. The go-live command center |

The gates themselves are [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md).

## 9. The final launch gate

The brief’s thirty-one lines. A launch is go only when all are; today the weakest is **not-started**.

### Product

8 items, the weakest building: tested 3 · building 5 · designed 0 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-GATE1-01 | Core student journeys work end to end | building | [`docs/GOLDEN-PATH-TEST-SCRIPT.md`](GOLDEN-PATH-TEST-SCRIPT.md) — the script<br>[`app/src/lib/registration-day.ts`](../app/src/lib/registration-day.ts) — the registration path | See the journeys in the Definition of Done. |
| LC-GATE1-02 | Core staff and admin workflows work end to end | building | [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — the console | No scripted staff or admin path. |
| LC-GATE1-03 | Real auth and persistent data are live | building | [`app/src/lib/deleteaccount.test.ts`](../app/src/lib/deleteaccount.test.ts) — delete-account, live in production | Device-first by design; sync and accounts are live, institutional data is not. |
| LC-GATE1-04 | Mobile, keyboard, screen reader, error and loading states complete | building | [`app/src/a11y/axe.test.tsx`](../app/src/a11y/axe.test.tsx) — the probe<br>[`docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md`](EMPTY-LOADING-ERROR-SUCCESS-STATES.md) — the states | No human pass. |
| LC-GATE1-05 | Source labels and data freshness visible | tested | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — the labels | Freshness is not on every fact. |
| LC-GATE1-06 | Support and feedback paths exist | tested | [`supabase/support-tickets.check.sql`](../supabase/support-tickets.check.sql) — tickets<br>[`supabase/feedback.check.sql`](../supabase/feedback.check.sql) — feedback | No support address (DEP-09). |
| LC-GATE1-07 | Critical flows have tests and monitoring | building | [`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — the probe | Tests yes; monitoring of flows no. |
| LC-GATE1-08 | No demo data presented as verified production data | tested | [`app/src/lib/demosplit.test.ts`](../app/src/lib/demosplit.test.ts) — the demo wears its label, at its own address | None. |

### Trust

10 items, the weakest designed: tested 4 · building 2 · designed 4 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-GATE2-01 | Privacy and terms published | designed | [`docs/legal/PRIVACY-POLICY-DRAFT.md`](legal/PRIVACY-POLICY-DRAFT.md) — draft<br>[`docs/legal/TERMS-OF-SERVICE-DRAFT.md`](legal/TERMS-OF-SERVICE-DRAFT.md) — draft | Drafts awaiting counsel. |
| LC-GATE2-02 | Security controls reviewed | designed | [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md) — the controls | No independent review. |
| LC-GATE2-03 | RLS and authorization review complete | tested | [`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — coverage<br>[`supabase/grants.check.sql`](../supabase/grants.check.sql) — grants | None. |
| LC-GATE2-04 | SECURITY DEFINER function review complete | tested | [`app/src/lib/definerregister.test.ts`](../app/src/lib/definerregister.test.ts) — all 151<br>[`supabase/definer-sweep.check.sql`](../supabase/definer-sweep.check.sql) — each called by a stranger | DR-01 and DR-03 open, both low. |
| LC-GATE2-05 | Data inventory and retention schedule complete | tested | [`app/src/lib/retention.test.ts`](../app/src/lib/retention.test.ts) — the schedule | Table level. |
| LC-GATE2-06 | Export/deletion works | tested | [`app/src/lib/deleteaccount.test.ts`](../app/src/lib/deleteaccount.test.ts) — deletion<br>[`app/src/lib/export.test.ts`](../app/src/lib/export.test.ts) — export | Per student. |
| LC-GATE2-07 | AI policy and controls are live | building | [`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — the switch | No AI Use Policy. |
| LC-GATE2-08 | Accessibility statement and testing complete | building | [`app/src/a11y/axe.test.tsx`](../app/src/a11y/axe.test.tsx) — automated | No statement, no human pass. |
| LC-GATE2-09 | Incident and restore drills performed | designed | [`RESTORE.md`](../RESTORE.md) — the procedure<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — the plan | Neither performed on production. |
| LC-GATE2-10 | Subprocessor register published | designed | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) — the list | In progress. |

### Company

5 items, the weakest designed: tested 1 · building 2 · designed 2 · not-started 0 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-GATE3-01 | Entity, domain, banking, accounting, contracts, IP and insurance ready | designed | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) — the formation checklist and nine coverages | An LLC exists; the rest is tracked there, mostly not started. |
| LC-GATE3-02 | Support, billing, refund and cancellation processes ready | building | [`app/src/lib/billing/checkout.test.ts`](../app/src/lib/billing/checkout.test.ts) — checkout<br>[`app/src/lib/billing/cancel.test.ts`](../app/src/lib/billing/cancel.test.ts) — cancel reaches Stripe before it is recorded (D-132) | The refund policy is a draft; failed-payment reminders are recorded, not sent. |
| LC-GATE3-03 | Company email, contact, careers, security, privacy and accessibility channels active | building | [`app/src/site/render.tsx`](../app/src/site/render.tsx) — the contact, careers, security, privacy and accessibility routes | No support address (DEP-09). |
| LC-GATE3-04 | Sales materials, pricing, SOW, DPA, MSA and SLA ready | designed | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — the outline<br>[`docs/trust/SLA.md`](trust/SLA.md) — the SLA outline | No MSA. |
| LC-GATE3-05 | Trust Room and RFP response library ready | tested | [`supabase/trust-room.check.sql`](../supabase/trust-room.check.sql) — the NDA-gated procurement room<br>[`docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](HIGHER-ED-RFP-RESPONSE-LIBRARY.md) — the library | Not every Trust Room artifact exists; see the list. |

### Launch and market

8 items, the weakest not-started: tested 4 · building 0 · designed 2 · not-started 2 · held 0.

| ID | Item | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LC-GATE4-01 | Website explains current product and future vision honestly | tested | [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — every label on the site is the register’s | None. |
| LC-GATE4-02 | Pricing and CTA paths work | tested | [`app/src/site/site.test.tsx`](../app/src/site/site.test.tsx) — every route renders | Join the pilot and the advisory council have no path. |
| LC-GATE4-03 | Product analytics measure meaningful actions | designed | [`docs/ANALYTICS-EVENTS.md`](ANALYTICS-EVENTS.md) — the events | No “I understand what to do next” measure. |
| LC-GATE4-04 | Student advisory and pilot recruitment plan active | not-started | [`docs/PRIVATE-BETA-PROGRAM.md`](PRIVATE-BETA-PROGRAM.md) — the beta program | No advisory council. |
| LC-GATE4-05 | Customer-success and implementation plan ready | designed | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) — the playbook | No success-plan template with the fourteen fields. |
| LC-GATE4-06 | Initial launch cohort defined | not-started | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — where a cohort would be recorded | None defined. |
| LC-GATE4-07 | Feedback loop, bug triage and release process active | tested | [`supabase/feedback.check.sql`](../supabase/feedback.check.sql) — feedback<br>[`app/src/lib/flags.test.ts`](../app/src/lib/flags.test.ts) — every flag with an owner and a rollback | None. |
| LC-GATE4-08 | Public status and changelog available | tested | [`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — the status page<br>[`CHANGELOG.md`](../CHANGELOG.md) — the changelog | The changelog is not a site page. |

## 10. The claim register, keyed on nine words

Each word the brief says must not outrun its evidence, and the rows of [`ops/claims/README.md`](../ops/claims/README.md) it rests on. A word with no rows may not be said.

| Word | Evidence required | Claims | Note |
| --- | --- | --- | --- |
| “Secure” | Security controls, monitoring, incident process, evidence | `rls`, `secrets`, `mfa`, `audit-log`, `incident-notice`, `pen-test`, `soc2` | Say which control, never the adjective. |
| “Accessible” | WCAG testing, VPAT, known limitations, issue process | `a11y-site`, `a11y-app`, `a11y-human`, `vpat` | Automated testing is held; the human pass and VPAT are not. |
| “AI-powered” | Accurate description of AI functions, providers, controls, limitations | `ai-course-policy` | No row describes the providers and limits in one line. |
| “Integrated” | Real supported integration with documented scope and status | `sso`, `lti`, `sis`, `scim`, `oneroster`, `connector-health` | Each integration carries its own status. |
| “Replaces” | Native authoritative workflow, migration, support, continuity, institutional agreement | **none — may not be said** | No row; lmsclaims.test.ts keeps the app from saying it replaces LMS grading. |
| “Improves student success” | Responsible evidence and methodology | **none — may not be said** | No row; the proof policy refuses a causal claim without method. |
| “Trusted by” | Written permission and verified customer relationship | **none — may not be said** | No row; the proof policy refuses a logo without written permission. |
| “Enterprise-ready” | Contract, security, support, implementation, recovery and governance capability | `hecvat`, `dpa`, `soc2`, `restore-drill` | Every row it rests on is short of available. |
| “Compliant” | Defined legal or standards scope and external/legal validation | **none — may not be said** | No row; HECVAT and TrustEd are not certifications. |

## 11. Documents, the Trust Room and the site

### Public legal documents

14 of 14 have something in the tree; every one needs counsel before publication.

| Document | Nearest in the tree | Note |
| --- | --- | --- |
| Privacy Policy | [`docs/legal/PRIVACY-POLICY-DRAFT.md`](legal/PRIVACY-POLICY-DRAFT.md) | Draft. |
| Terms of Service | [`docs/legal/TERMS-OF-SERVICE-DRAFT.md`](legal/TERMS-OF-SERVICE-DRAFT.md) | Draft. |
| Acceptable Use Policy | [`docs/legal/ACCEPTABLE-USE-POLICY-DRAFT.md`](legal/ACCEPTABLE-USE-POLICY-DRAFT.md) | Draft. |
| Community Guidelines | [`docs/legal/COMMUNITY-GUIDELINES-DRAFT.md`](legal/COMMUNITY-GUIDELINES-DRAFT.md) | Draft; published only when a school turns Community on. |
| Copyright / DMCA process | [`docs/legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md`](legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md) | Draft; no designated agent is registered. |
| AI Policy | [`docs/legal/AI-USE-POLICY-DRAFT.md`](legal/AI-USE-POLICY-DRAFT.md) | Draft; the training policy prevails where they differ. |
| Cookie / analytics policy | [`docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md`](legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md) | Draft; no cookie is set, and the company site now says so. |
| Accessibility Statement | [`docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`](legal/ACCESSIBILITY-STATEMENT-DRAFT.md) | Draft; claims no conformance. |
| Security contact and responsible disclosure | [`SECURITY.md`](../SECURITY.md) | Published, with security.txt. |
| Subprocessor Register | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) | In progress. |
| Data Retention and Deletion Policy | [`docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md`](legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md) | Draft; RETENTION.md prevails. |
| Support Policy | [`docs/legal/SUPPORT-POLICY-DRAFT.md`](legal/SUPPORT-POLICY-DRAFT.md) | Draft; the company site’s /support-policy now matches it. |
| Incident Response Summary | [`docs/legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md`](legal/INCIDENT-RESPONSE-SUMMARY-DRAFT.md) | Draft; the procedure is unexercised. |
| Advertising and Sponsorship Policy | [`docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md`](legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md) | Draft. |

### Institutional documents

| Document | Nearest in the tree | Note |
| --- | --- | --- |
| Data Processing Addendum | [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) | Checklist. |
| FERPA / student-data privacy summary | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](FERPA-COPPA-1EDTECH-READINESS.md) | Readiness. |
| Pilot Statement of Work | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) | Fields only. |
| Master Subscription Agreement | **none** | None. |
| Service Level Agreement | [`docs/trust/SLA.md`](trust/SLA.md) | Outline. |
| Implementation Statement of Work | **none** | None. |
| Acceptable Use addendum | **none** | None. |
| AI and data-use addendum | [`docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) | A policy, not an addendum. |
| Security addendum | [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md) | A whitepaper. |
| Accessibility documentation / VPAT | [`docs/trust/HECVAT-VPAT-PLAN.md`](trust/HECVAT-VPAT-PLAN.md) | A plan. |
| Business continuity summary | [`docs/market-readiness/DISASTER_RECOVERY.md`](market-readiness/DISASTER_RECOVERY.md) | Internal. |

### The Trust Room

15 of 18 artifacts have a file to publish into the procurement room ([`supabase/trust-room.check.sql`](../supabase/trust-room.check.sql)).

| Artifact | Carried by |
| --- | --- |
| Executive product overview | [`docs/launch/WHAT-IS-SEMESTER.md`](launch/WHAT-IS-SEMESTER.md) |
| Architecture diagram | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) |
| Data-flow diagram | **none** |
| Data inventory | [`RETENTION.md`](../RETENTION.md) |
| Security overview | [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md) |
| HECVAT Lite and Full response | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) |
| Privacy and FERPA summary | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](FERPA-COPPA-1EDTECH-READINESS.md) |
| DPA | [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) |
| AI data-use and governance policy | [`docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) |
| Accessibility statement and VPAT | [`docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md`](legal/ACCESSIBILITY-STATEMENT-DRAFT.md) |
| Subprocessor register | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) |
| Incident-response summary | [`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) |
| Business-continuity summary | [`docs/market-readiness/DISASTER_RECOVERY.md`](market-readiness/DISASTER_RECOVERY.md) |
| Support SLA | [`docs/trust/SLA.md`](trust/SLA.md) |
| Integration guide | **none** |
| Implementation plan | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) |
| Pilot SOW | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) |
| Insurance certificates | **none** |

### Site pages

Each held to a route of the app’s site ([`app/src/site/render.tsx`](../app/src/site/render.tsx)) and a path of the deployed company site ([`company-site/sitemap.xml`](../company-site/sitemap.xml)).

| Page | App site | Company site |
| --- | --- | --- |
| Homepage | `/` | `/` |
| Product overview | `/product/` | `/product` |
| How it works | `/product/` | **none** |
| For students | `/students/` | `/students` |
| For institutions | `/institutions/` | `/institutions` |
| For advisors and faculty | **none** | `/faculty` |
| For campus services | **none** | `/services` |
| Pricing | `/pricing/` | `/pricing` |
| Pilot program | **none** | **none** |
| Trust Center | **none** | `/trust` |
| Security | `/security/` | `/trust-security` |
| Privacy | `/privacy/` | `/trust-privacy` |
| Accessibility | `/accessibility/` | `/accessibility` |
| AI policy | `/trust/data-and-ai-transparency/` | `/trust-ai` |
| Integrations | `/platform/integrations/` | `/integrations` |
| Resources | `/resources/` | **none** |
| Help center | `/help/` | `/help` |
| Status page | **none** | `/status` |
| About | `/about/` | `/company` |
| Careers | `/careers/` | `/careers` |
| Contact | `/contact/` | `/contact` |
| Changelog | **none** | **none** |

### Conversion points

| Point | Route |
| --- | --- |
| Start free | `/start/` |
| Join the pilot | **none** |
| Request a demo | `/demo/` |
| Explore for institutions | `/institutions/` |
| Download security overview | **none** |
| Use a free planning tool | `/tools/` |
| Join student advisory council | **none** |
| Become a campus ambassador | `/community/ambassadors/` |
| Contact partnerships | `/community/partners/` |
| Contact support | `/help/` |

### Held elsewhere

The complete-company brief also covers these; each already has a register, and is not held twice.

| Area | Held by |
| --- | --- |
| Company foundation (entity, EIN, banking, domain, email, IP, trademark, insurance, cap table, board) | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) |
| Revenue operations (billing, refunds, CRM, pipeline, renewal, CAC, margin) | [`docs/OPERATIONAL-REALITY-REGISTER.md`](OPERATIONAL-REALITY-REGISTER.md) |
| Service-level objectives | [`docs/operating-model/SLOS-AND-ERROR-BUDGETS.md`](operating-model/SLOS-AND-ERROR-BUDGETS.md) |
| Production operations checklist | [`docs/OPERATIONAL-READINESS-PACK.md`](OPERATIONAL-READINESS-PACK.md) |
| FERPA operating posture | [`docs/FERPA-IDENTITY-GUARDRAILS.md`](FERPA-IDENTITY-GUARDRAILS.md) |
| Contract boundaries | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) |
| Customer success | [`docs/PILOT-TO-ANNUAL-CONVERSION.md`](PILOT-TO-ANNUAL-CONVERSION.md) |
| Help and support | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) |

## 12. Next actions

| From | Action | Where it stands |
| --- | --- | --- |
| playbook | Convert the HECVAT checklist into an owner-based tracker with evidence links and due dates | Section 2: every row has a seat, a standing and evidence; due dates are the seats’ to set. |
| playbook | Complete the RLS and SECURITY DEFINER remediation register | docs/DEFINER-RLS-REGISTER.md (D-127, D-130); its fix is live (D-129); DR-01 and DR-03 open, both low. |
| playbook | Build the Migration Center artifacts for the first pilot | Section 5 lists the seventeen and the template; most carry nothing. |
| playbook | Have counsel convert the outline into an MSA, Pilot SOW and DPA | Owed to counsel; the repository cannot do it. |
| playbook | Complete the Registration and LMS checklists with actual test evidence | Sections 3 and 4: every row cites a test or says what is missing. |
| playbook | Run an accessibility review of the core path, plan, agenda and support flow | Owed: docs/accessibility/AT-PASS-PROTOCOL.md, unrun. |
| playbook | Run an incident-response and backup-restore tabletop | Owed: LC-HV5-04 and LC-HV5-09. |
| playbook | Prepare the Trust Room and HECVAT response library | Section 11: fifteen of eighteen artifacts carried; the procurement room is checked. |
| playbook | Select one cohort, one sponsor, one workflow and one date | Owed: LC-GATE4-06. |
| playbook | Conduct the formal go/no-go meeting and document the decision | Section 8 holds the agenda; docs/GO-NO-GO-CHECKLIST.md holds the gates. |
| summary | Assign an owner, status, due date and evidence link to each HECVAT row | Section 2. |
| summary | Complete the RLS and SECURITY DEFINER register before connecting broad institutional records | docs/DEFINER-RLS-REGISTER.md. |
| summary | Use the pilot outline for attorney-reviewed MSA, Pilot SOW and DPA | Owed to counsel. |
| summary | Select one pilot cohort and complete the registration and LMS checklists | Sections 3 and 4; the cohort is owed. |
| summary | Run a formal go/no-go review | Section 8. |
