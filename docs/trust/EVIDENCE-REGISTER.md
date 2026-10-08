# Security and compliance evidence register

<!-- Rendered from app/src/lib/trust/evidence-register.ts by evidence-register.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**No evidence has been produced.** This is the index the operating system
listed as missing: for every control a university reviewer will ask about,
the artifact that would prove it operates, who owns producing it, how often,
who may see it, and what the tree holds today — which is the control and its
test, never yet the proof that anybody ran it. The index closes the category
by existing. Each artifact lives under `docs/evidence/` once it exists, and the
word *produced* is refused by the test until a row cites one there. The
directory holds the AI drills of 29 September; neither is the artifact any
row here asks for, so none is produced.

| Supplied document | What it holds |
| --- | --- |
| [Higher-ed edtech audit scorecard: security evidence register, HECVAT mapping, sprint plan, retention policy](../expansion/Audit-Scorecard-Evidence-Register-and-Sprint-Plan.pdf) | The register schema, the initial evidence rows, the feature-to-HECVAT map, the twelve sprints and the retention policy draft. |
| [Build an edtech compliance matrix: HECVAT mapping table, dashboard API, release gate](../expansion/Compliance-Matrix-HECVAT-Mapping-and-Dashboard-API.pdf) | The control and evidence schemas, the release-manifest gate and the conditions that block a release, and the guardrails. |
| [University edtech audit: IT compliance approach and audit readiness](../expansion/University-EdTech-Audit-IT-Compliance-and-Faculty-Playbook.pdf) | The compliance operating model with named leads, the control-and-evidence register fields, the procurement room and the readiness checklists. |
| [HECVAT cloud infrastructure mapping](../expansion/HECVAT-vs-TrustEd-Apps-Compliance-Scorecard.pdf) | The twenty cloud areas, each with a control objective, an implementation, an evidence artifact and a validation cadence. |

## The operating model: seven leads, 5 held and 2 vacant

The documents ask for named leads rather than a folder of policies. Each is a
council seat from [`docs/LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md); a seat is held only once
somebody accepted it in writing, and the page reads the holder from the code.

| Lead | Seat | Held by | Owns |
| --- | --- | --- | --- |
| **Executive sponsor** | `founder` | Founder | Risk appetite, budget, major exceptions, customer trust. |
| **Security lead** | `security` | *vacant* | Security controls, the risk register, access reviews, incident readiness, vulnerability management, technical evidence. |
| **Privacy lead** | `privacy` | Outside counsel | Data inventory, legal and contractual data-use requirements, retention, student requests, subprocessors, FERPA and DPA alignment. |
| **Accessibility lead** | `accessibility` | Founder, acting | Accessibility acceptance criteria, testing, remediation, the ACR/VPAT, accessible-content processes. |
| **AI governance lead** | `product` | Founder, acting | AI inventory, provider approvals, evaluations, policy configuration, safety incidents, model and provider change review, transparency. |
| **Engineering lead** | `engineering` | Founder, acting | Secure development, architecture, environments, deployment controls, monitoring, backup and recovery, remediation. |
| **Customer trust owner** | `trust` | *vacant* | The procurement room, questionnaire responses, evidence freshness, customer-facing trust communication, contractual commitment mapping. |

## The schema

The fields the documents ask every row to carry, and where each is on this page.

| Field asked for | Here |
| --- | --- |
| Evidence ID | ID |
| Control ID and name | Control |
| Framework mappings (HECVAT, 1EdTech, master register) | Rests on |
| Risk addressed | Control (the clause after the dash) |
| Control owner | Owner (a council seat) |
| System or process in scope | What the tree holds |
| Control frequency | Frequency |
| Evidence description, type and collection method | Evidence |
| Evidence location, date, review and expiry date, reviewer, hash | Under docs/evidence/ when produced; a few dated files are there, but this register does not yet index them by control |
| Result or status | Status |
| Exception, remediation owner and target date | The risk register’s exception record, which is empty |
| Customer visibility and sensitivity | Visibility |

## The register

20 rows: 0 produced, 16 defined, 4 owed.
*Defined* means the control and its test exist, so the artifact can be
produced by running something the row names; *owed* means neither exists.
Visibility: **public** — On the public site or in a public document; **summary** — A summary to any prospective customer; the detail under NDA; **nda** — Only to a named reviewer through the trust room.
Levels in brackets are the rows’ standings on the crosswalk’s 0–4 scale.

| ID | Control — risk addressed | Rests on (level) | Evidence | Frequency | Owner | Visibility | Status | What the tree holds | To produce it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **SEC-IAM-001** | Privileged-access review — a stale grant nobody revoked | IAM-3 (0), IAM-011 (1), IAM-006 (2) | Export of privileged roles, reviewer sign-off, removal tickets. | Quarterly | `security` | nda | defined | [`supabase/role-grant-audit.check.sql`](../../supabase/role-grant-audit.check.sql) — every grant, revocation and scope change is an immutable audit row<br>[`supabase/rolegrants.check.sql`](../../supabase/rolegrants.check.sql) — grants carry scope, expiry and revocation | Run the role-grant export against production, have the security seat re-justify or revoke each grant, file the export and the sign-off. The proof calendar schedules it quarterly. |
| **SEC-IAM-002** | MFA enforcement — account takeover of an operator | IAM-005 (1), GOV-1 (1) | Identity-provider policy export or configuration screenshot; a test that a second factor is demanded. | Quarterly and on change | `security` | summary | owed | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](../market-readiness/HECVAT_DRAFT_RESPONSE.md) — the owner attests MFA is on for GitHub, Google and Supabase; an attestation, not evidence | A configuration export from each console, dated, filed; and MFA for privileged app roles once IAM-005 is designed. |
| **SEC-SDLC-001** | Secure code review — a change reaching main unreviewed | SDLC-1 (2), SEC-003 (1), SRE-008 (1) | Branch-protection configuration, a PR audit sample, the CI policy. | Continuous; a quarterly sample | `engineering` | summary | defined | [`app/src/lib/branchprotection.test.ts`](../../app/src/lib/branchprotection.test.ts) — the branch-protection rules main is held to, with the owner’s bypass recorded<br>[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — policy, type, lint and test gates on every change | Export the branch-protection settings and sample ten merged PRs for review evidence, quarterly. |
| **SEC-SDLC-002** | Dependency and secrets scanning — a leaked key or a known-vulnerable package | SDLC-2 (2), SEC-004 (1) | CI scan history, critical-remediation tickets, the exception list. | Continuous; monthly review | `engineering` | nda | defined | [`.gitleaks.toml`](../../.gitleaks.toml) — secret scanning on every push<br>[`.github/dependabot.yml`](../../.github/dependabot.yml) — dependency updates opened automatically<br>[`app/src/lib/supplychain.test.ts`](../../app/src/lib/supplychain.test.ts) — every licence and Action named; an SBOM of every deploy | A monthly export of open Dependabot alerts with age and disposition; nothing records dispositions today. |
| **SEC-VULN-001** | Vulnerability management — a finding with no owner and no deadline | VULN-1 (1), SEC-004 (1) | Scan report, a severity-to-SLA table, remediation evidence. | Continuous; monthly | `security` | summary | defined | [`SECURITY.md`](../../SECURITY.md) — how a report is made and handled, the four severities and the remediation target each is held to (2, 14, 60, 180 days), the clock starting at confirmation; the targets accepted unchanged on 29 September 2026 (D-124), no finding yet answered inside its clock<br>[`app/public/.well-known/security.txt`](../../app/public/.well-known/security.txt) — the published disclosure contact, RFC 9116 in form, served under the app's base path rather than an origin root<br>[`app/src/lib/security.test.ts`](../../app/src/lib/security.test.ts) — holds the contact to the privacy page and the site, and the severity table to PATCH_POLICY row for row | A monthly report of findings answered inside their clocks, which nothing records today; the targets themselves were accepted on 29 September 2026 (D-124). |
| **SEC-PENT-001** | Independent penetration test — the defect nobody inside would find | VULN-2 (0), SEC-005 (1) | Scope, executive summary, remediation tracker. | Annual and on major change | `security` | nda | owed | [`docs/trust/PENETRATION-TEST-PLAN.md`](PENETRATION-TEST-PLAN.md) — scope, rules of engagement and success criteria for a first test; none performed | Commission the test against the plan; file the executive summary and the tracker. |
| **SEC-DATA-001** | Data inventory and classification — a table nobody can explain to a reviewer | PRIV-1 (2), SEC-008 (1), RM-01 (1) | The data map with owner, purpose, classification, storage and retention per class. | Quarterly and on change | `privacy` | summary | defined | [`app/src/lib/retention.test.ts`](../../app/src/lib/retention.test.ts) — every table in the schema has a retention answer, and every answer names a table<br>[`RETENTION.md`](../../RETENTION.md) — the inventory, per table and per device store | Re-read RETENTION.md against production’s schema each quarter and file the diff; classify by data class rather than by table (RM-01). |
| **SEC-DATA-002** | Deletion and retention enforcement — data kept after the promise said it was gone | PRIV-2 (2), FERPA-6 (2), RM-04 (1) | Deletion job logs, a sample deletion traced end to end, backup-expiry validation. | Quarterly | `privacy` | summary | defined | [`supabase/deletion.check.sql`](../../supabase/deletion.check.sql) — account deletion empties every table it claims<br>[`app/src/lib/deleteaccount.test.ts`](../../app/src/lib/deleteaccount.test.ts) — the delete-account function, live in production<br>[`supabase/scheduler.sql`](../../supabase/scheduler.sql) — the sweeps that run the clocks | Run one test-account deletion in production, trace it through every table and the backups’ expiry, file the trace. A legal hold cannot yet be placed, so the hold half is owed (RM-02). |
| **SEC-BCP-001** | Backup restoration — a backup that has never been restored | BCP-1 (0), SRE-004 (1), SRE-005 (1) | Restore-exercise results, measured RTO and RPO, exceptions. | Quarterly | `engineering` | nda | defined | [`supabase/restore-drill.sh`](../../supabase/restore-drill.sh) — the drill, against a disposable project<br>[`RESTORE.md`](../../RESTORE.md) — the procedure and what to record<br>[`app/src/lib/ops/proofcalendar.test.ts`](../../app/src/lib/ops/proofcalendar.test.ts) — the drill is a scheduled proof, held to the rows it moves and the 90-day item it closes | Run the drill, time it, record row counts before and after; file it as the proof calendar’s month-one restore drill. Nothing has restored production data yet. |
| **SEC-IR-001** | Incident response — a plan nobody has walked through | IR-1 (1), SEC-007 (1), FERPA-10 (1) | Runbook, tabletop attendance, after-action corrective plan. | Annual and on major change | `security` | summary | defined | [`app/src/lib/governance/incident-comms.test.ts`](../../app/src/lib/governance/incident-comms.test.ts) — every audience gets a notice with the sections its policy requires<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](../market-readiness/INCIDENT_RESPONSE.md) — severity, flow and university-facing templates; never exercised | One P1 walked from first report to customer notice, with who did what and the gaps found; the proof calendar’s month-one tabletop. |
| **SEC-LOG-001** | Audit logging — an administrative action with no record | LOG-1 (2), SEC-006 (1), FERPA-4 (2) | Log architecture, sample audit events, retention configuration. | Quarterly | `engineering` | nda | defined | [`supabase/moderation-audit.check.sql`](../../supabase/moderation-audit.check.sql) — moderation decisions are immutable audit rows<br>[`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) — every support window and read is recorded and visible to the student<br>[`supabase/migrations/20260928320000_audit_correlation_and_outbox.sql`](../../supabase/migrations/20260928320000_audit_correlation_and_outbox.sql) — gateway audit rows carry a correlation id | A quarterly sample of audit events per class with the retention line each is under; no central security alerting exists to sample. |
| **SEC-VEND-001** | Subprocessor review — a vendor that changed terms while nobody looked | PRIV-5 (1), SEC-010 (1), FERPA-11 (2) | Vendor inventory, DPA, security review, renewal and change review. | Before use and annually | `privacy` | public | defined | [`app/src/lib/trust/subprocessors.test.ts`](../../app/src/lib/trust/subprocessors.test.ts) — the register is held to the CSP and the Edge Functions<br>[`app/src/lib/trust/vendorrisk.test.ts`](../../app/src/lib/trust/vendorrisk.test.ts) — one risk row per subprocessor; no row may claim a review that was not done | The first vendor assessment: obtain and read each vendor’s attestation, record the DPA on file, date the row. None has been done. |
| **SEC-AI-001** | AI provider and data-use review — a provider training on student prompts | AI-1 (2), AI-002 (1), FERPA-9 (2) | Model inventory, provider terms, retention and training review, approval record. | Before enablement and annually | `product` | summary | defined | [`supabase/intelligence-policy.check.sql`](../../supabase/intelligence-policy.check.sql) — a provider is usable only once the institution approves it and a budget<br>[`app/src/lib/trust/ai-training-policy.test.ts`](../../app/src/lib/trust/ai-training-policy.test.ts) — the no-training policy held to the privacy page’s promise | Put each provider’s terms on file with the retention and training position read and dated; the DPA checklist’s no-training clause stays unchecked until then. |
| **SEC-AI-002** | AI evaluation and misuse testing — an answer that cites nothing and nobody noticed | AI-2 (0), AI-010 (2), AI-011 (1) | Evaluation plan, red-team report, sign-off, issue tracker. | Per model or change | `product` | summary | owed | [`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md`](../AI-RECOMMENDATION-EVALUATION-HARNESS.md) — the harness design; no evaluation set from approved course sources and no recorded run<br>[`docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json`](../evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json) — the misuse half, once: the injection red-team on claude-opus-5, 21 cases, none followed (29 September 2026) | Build the evaluation set, run it, record the run with the model version; the proof calendar’s quarterly AI evaluation. The red-team transcript is one run on one model, not the evaluation this row asks for. |
| **ACC-001** | Accessibility release gate — a regression shipped to a screen-reader user | A11Y-1 (2), A11Y-001 (2), A11Y-002 (2), A11Y-003 (2), A11Y-004 (2) | Automated and manual test results, known issues, the remediation decision. | Per release | `accessibility` | summary | defined | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) — axe-core over the rendered app<br>[`app/scripts/accessibility-smoke.mjs`](../../app/scripts/accessibility-smoke.mjs) — critical journeys in a real browser at desktop and 320px<br>[`docs/WCAG-UI-AUDIT-SCORECARD.md`](../WCAG-UI-AUDIT-SCORECARD.md) — a per-component WCAG 2.2 scorecard, every score citing its test | The manual assistive-technology pass per docs/accessibility/AT-PASS-PROTOCOL.md, by a person, filed; then an ACR (A11Y-2). The automated pass is regression evidence, not conformance. |
| **INT-001** | LTI integration validation — a launch that works in the sandbox and not for the school | EDT-1 (2), EDT-2 (2), EDT-3 (2), INT-002 (2) | Launch, AGS and NRPS test logs, the data map, customer sign-off. | Per tenant and on change | `data` | summary | defined | [`app/src/lib/ltikey.test.ts`](../../app/src/lib/ltikey.test.ts) — signed-token verification, a single-use nonce, no roster requested<br>[`app/src/lib/ltiags.test.ts`](../../app/src/lib/ltiags.test.ts) — grade services gated per registration<br>[`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](../LTI-1.3-LAUNCH-RUNBOOK.md) — the per-tenant launch procedure | One launch from a real institution’s platform, logged end to end and signed by its champion; the proof calendar’s month-three SSO/integration test. |
| **PRIV-001** | FERPA disclosure and consent audit — a share nobody can trace to a consent | FERPA-5 (2), PRIV-6 (2), UOS-007 (2) | Consent record, disclosure log with recipient, purpose and scope, a revocation test. | Continuous; quarterly review | `privacy` | nda | defined | [`supabase/supportshares.check.sql`](../../supabase/supportshares.check.sql) — every read of a share is one event the student sees<br>[`supabase/advisor.check.sql`](../../supabase/advisor.check.sql) — only the student creates or revokes; a revoked share is not listed<br>[`app/src/lib/trust/ferpa-consent.test.ts`](../../app/src/lib/trust/ferpa-consent.test.ts) — the consent data model held field by field to the share tables | A quarterly sample of shares traced to their events; a purpose per share and a legal basis are not recorded, and the page that holds the model says so. |
| **GOV-001** | Governance and risk review — a risk register nobody reads on a schedule | GOV-1 (1), GOV-2 (0), PRG-001 (1) | Approved policy set, RACI, risk-review minutes, an exception record. | Quarterly; policies annually | `founder` | summary | defined | [`app/src/lib/governance/risk.test.ts`](../../app/src/lib/governance/risk.test.ts) — every risk has an owner, a tolerance and a control; exceptions expire and a P0 needs three approvers<br>[`app/src/lib/ops/operatingsystem.test.ts`](../../app/src/lib/ops/operatingsystem.test.ts) — every authoritative document has an owner seat and a next review date | The first quarterly review, minuted: each risk re-read, each seat still vacant named as vacant, each acting holder named as acting. |
| **RET-001** | Legal hold — a deletion that ran while a hold should have stopped it | RM-02 (1), RM-04 (1), RM-05 (1), RM-08 (1) | A hold placed, deletion refused, the hold released, deletion resumed — logged. | On each hold; the mechanism tested quarterly | `privacy` | nda | owed | [`docs/operating-model/OPERATIONAL-MATURITY.md`](../operating-model/OPERATIONAL-MATURITY.md) — the records-management area: no hold object, no placing role, no runbook | A hold table, a placing role, the check in the deletion path, a runbook; then the test that proves the sequence. |
| **SEC-STATUS-001** | Availability and status — an outage the customer learns of first | MON-1 (1), SRE-010 (1), SRE-001 (2) | Retained availability history, an alert that reached a person, the status-page record. | Continuous; monthly report | `engineering` | public | defined | [`.github/workflows/production-smoke.yml`](../../.github/workflows/production-smoke.yml) — synthetic checks of production on a schedule<br>[`app/src/lib/sla.test.ts`](../../app/src/lib/sla.test.ts) — the SLA figures held to code<br>[`app/public/status.html`](../../app/public/status.html) — a status page that checks from the reader’s browser | Retain the smoke history and route a failure to an accountable person; report availability monthly. No alert reaches a person today. |

## Features, mapped to HECVAT

Each feature with the data it carries, the HECVAT themes a reviewer will open,
the controls the feature needs and the master rows that carry it. The lowest
row is the feature’s standing.

| Feature | Primary data and risk | HECVAT themes | Required controls | Evidence | Master rows (level) | Lowest |
| --- | --- | --- | --- | --- | --- | ---: |
| **Student account and SSO** | Identity, authentication, account takeover | IAM, authentication, access control | SSO/OIDC/SAML, MFA for privileged roles, session controls, account recovery | IAM diagram, MFA configuration, access-review evidence | IAM-001 (2), IAM-002 (2), IAM-003 (1), IAM-005 (1) | 1 |
| **Personal Academic OS** | Plans, actions, calendar, personal notes | Privacy, data classification, application security | Private by default, tenant isolation, export and delete, audit, backup | Data map, privacy UX tests, authorization tests | STU-001 (2), STU-010 (2), STU-011 (2), IAM-008 (2) | 2 |
| **Native LMS and course workspace** | Course content, enrollment, submissions | Application security, privacy, integrations, accessibility | Role-based course access, rights controls, LTI validation, secure file handling | Threat model, integration tests, content-access logs | LMS-002 (2), LMS-003 (1), LMS-005 (1), LMS-016 (1) | 1 |
| **Study Studio and AI** | Prompts, course sources, generated content | AI, vendor management, privacy, security | Tenant-scoped retrieval, no general-model training by default, safety filters, provider review | AI inventory, evaluation report, provider DPA | AI-002 (1), AI-004 (1), AI-005 (1), AI-011 (1) | 1 |
| **Assessment and gradebook** | Grades, assessment responses, feedback | Privacy, integrity, audit, availability | Grade ledger, authorized graders, release controls, backup and recovery, no AI-only final grade | Grade change logs, calculation test suite, restore test | LMS-008 (1), LMS-011 (1), LMS-013 (1), AI-009 (2) | 1 |
| **Clubs and community** | Social data, harassment, moderation evidence | Privacy, social interactions, access, incident response | Role scope, block and report, moderation workflow, retention, appeal | Policy, case-audit sample, role matrix | UOS-003 (1), UOS-002 (1) | 1 |
| **Peer mentorship** | Private communications, sensitive context | Privacy, access control, safety | Opt-in, boundaries, limited coordinator view, escalation, data minimization | Consent flow, training record, access test | UOS-003 (1), UOS-007 (2) | 1 |
| **Basic-needs navigator** | Highly sensitive help-seeking | Privacy, data minimization, incident response | Private browsing, named referral, consented sharing, restricted case access | Resource policy, consent logs, authorization tests | STU-012 (2), UOS-007 (2) | 2 |
| **Career and opportunity network** | Portfolio, employer visibility, opportunity data | Privacy, third parties, access control | Student opt-in, artifact-level sharing, no academic-data sale, expiry and revoke | Sharing logs, employer terms, access audit | UOS-004 (1), UOS-005 (2), UOS-007 (2) | 1 |
| **Operations Console** | Production data, privileged actions | IAM, logging, change management, security | Least privilege, time-bound support access, approval, audit, break-glass review | Console access logs, approvals, access reviews | IAM-010 (2), IAM-011 (1), SEC-006 (1) | 1 |
| **Integrations gateway** | External credentials, roster and grade data | Third-party risk, encryption, APIs, monitoring | Secret vault, scoped OAuth, rate-limit handling, retry and reconciliation, tenant segregation | Data-flow map, secret policy, sync logs | INT-001 (1), INT-009 (1), INT-013 (1), INT-014 (1) | 1 |
| **Payments** | Financial and transaction data | Payment security, vendor risk, logging | A compliant processor, tokenization, no card data, reconciliation | Processor attestation, architecture diagram, access controls | COM-001 (1) | 1 |

## The cloud, area by area

Semester runs on Supabase, Vercel and GitHub Pages ([`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md)). For each
of the documents’ twenty cloud areas: the objective, what Semester actually
does, and where it is held. This is not the HECVAT 4 question set; a customer’s
questionnaire maps each area to its own identifiers.
**tree** (14) — Held in this repository, and the cited file shows it; **provider** (3) — Supabase, Vercel or GitHub operates it under their own attestations; the cited file says which and what Semester configures; **owed** (3) — Nobody holds it yet.

| Area | Objective | Semester implementation | Where | Shown by | Cadence |
| --- | --- | --- | --- | --- | --- |
| **Account hierarchy** | Separate production, staging, development and shared services | One production Supabase project and a second for restore drills; preview deploys per pull request; no staging project | tree | [`STAGING.md`](../../STAGING.md) | Quarterly and on change |
| **Network segmentation** | Limit service-to-service and public exposure | The database is reachable only through PostgREST and Edge Functions under RLS; no direct database connection from any browser or gateway | provider | [`docs/architecture/0002-rls-is-the-authorization-boundary.md`](../architecture/0002-rls-is-the-authorization-boundary.md) | Continuous |
| **Edge protection** | Protect web and API endpoints from abuse | TLS and headers from the hosts; per-account rate limits at the gateway and on direct writes | tree | [`supabase/migrations/20260928230000_direct_rate_limits.sql`](../../supabase/migrations/20260928230000_direct_rate_limits.sql) | Continuous |
| **Identity** | Prevent unauthorized cloud and admin access | Owner MFA on GitHub, Google and Supabase by attestation; no just-in-time privilege, no break-glass workflow | owed | — | Quarterly |
| **Secrets** | Protect credentials, keys and integration tokens | Secrets in the hosts’ managed stores; gitleaks on every push; the service role never in a browser | tree | [`SECRETS.md`](../../SECRETS.md) | Continuous; monthly |
| **Encryption** | Protect data in transit and at rest | TLS everywhere; provider encryption at rest; gateway action bodies encrypted before storage | provider | [`app/server/institution/journal-crypto.ts`](../../app/server/institution/journal-crypto.ts) | Quarterly |
| **Key management** | Control key ownership and use | Provider-managed keys; the journal key is an environment secret; no rotation record and no key-location statement | owed | — | Quarterly |
| **Compute hardening** | Minimize the exploitable surface | Static build on GitHub Pages; Edge Functions and Vercel functions with pinned runtimes; nothing long-running | provider | [`supabase/config.toml`](../../supabase/config.toml) | Per build |
| **CI/CD security** | Prevent insecure or unauthorized deployment | Protected main, CI gates, deploy workflows from main only; the owner may bypass review, recorded | tree | [`docs/BRANCH-PROTECTION.md`](../BRANCH-PROTECTION.md) | Every release |
| **Infrastructure as code** | Make configuration reviewable and reproducible | Migrations, Edge Function config, host headers and workflows are in the tree; the hosts’ dashboards are not | tree | [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md) | Every change |
| **Database security** | Restrict and monitor access to student data | RLS on every table by event trigger; policy checks in CI; access log on reads around RLS | tree | [`supabase/tenancy.check.sql`](../../supabase/tenancy.check.sql) | Quarterly |
| **Object and file storage** | Secure submissions, content and exports | Private buckets under storage RLS; signed time-limited URLs; no malware scanning | tree | [`supabase/community.check.sql`](../../supabase/community.check.sql) | Quarterly |
| **Backups** | Recover from deletion, corruption or outage | Provider daily backups; a scripted restore drill; never yet run against production data | tree | [`supabase/restore-drill.sh`](../../supabase/restore-drill.sh) | Quarterly |
| **Monitoring** | Detect infrastructure and application threats | Scheduled production smoke tests and a status page; no alert reaches a person, no detection rules | tree | [`MONITORING.md`](../../MONITORING.md) | Continuous |
| **Vulnerability management** | Find and remediate weaknesses | Dependabot and gitleaks; no image, container or external scan; no severity SLA | tree | [`.github/dependabot.yml`](../../.github/dependabot.yml) | Continuous; monthly |
| **Audit trails** | Support investigations and accountability | Immutable audit rows for grants, moderation, provisioning and support access; gateway audit with correlation ids | tree | [`supabase/role-grant-audit.check.sql`](../../supabase/role-grant-audit.check.sql) | Quarterly |
| **Availability** | Maintain service through component failure | Static app that works offline; the SLA formula and the journeys’ SLOs are defined; no failover exercise | tree | [`docs/trust/SLA.md`](SLA.md) | Quarterly |
| **Regional and residency** | Meet location obligations | One region, chosen by the provider’s default; subprocessor locations partly named; no customer selection | owed | — | Onboarding and change |
| **Secure disposal** | Remove data and infrastructure securely | Account deletion empties the tables it claims; backups expire on the provider’s schedule; no key destruction record | tree | [`supabase/deletion.check.sql`](../../supabase/deletion.check.sql) | Quarterly |
| **Third-party cloud risk** | Control provider dependencies | Provider inventory and exit posture written; no assessment read, no contract on file | tree | [`docs/trust/VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md) | Annual and on change |

## What blocks a release

The documents’ automated release gate: a release is blocked while any of these
is true. Nothing computes the gate yet; each line says what would hold it today.

| Condition | Held today by | How |
| --- | --- | --- |
| A P0 or P1 release-blocking finding is open. | [`app/src/lib/governance/release-readiness.ts`](../../app/src/lib/governance/release-readiness.ts) | A promotion needs the readiness total above the stage threshold and no dimension under the floor; a finding is not yet an object the score reads. |
| A required control has no current evidence. | **nothing** | Nothing reads evidence freshness: the few dated files under docs/evidence/ carry no expiry that anything checks; the operations-console controls define the freshness ladder a console would apply. |
| A data-flow change lacks privacy approval. | [`app/src/lib/governance/config-tiers.ts`](../../app/src/lib/governance/config-tiers.ts) | A configuration request is classified by tier and the privacy reviewer is required at the tiers that touch data; a code change to a data flow is reviewed by the pull-request template’s questions, not a gate. |
| An AI, provider, model or tool change lacks evaluation approval. | [`app/src/lib/governance/ai-lifecycle.ts`](../../app/src/lib/governance/ai-lifecycle.ts) | G3 requires every AI_RELEASE_GATE item; the gate is data a reviewer reads, not a check CI runs. |
| A critical accessibility regression is unresolved. | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | axe-core and the accessibility smoke fail the build on a regression they can see; a manual finding has no register to block from. |
| A high-risk exception is expired or unapproved. | [`app/src/lib/governance/risk.ts`](../../app/src/lib/governance/risk.ts) | reviewException() refuses an expired exception and a P0 without executive, security and legal approval; EXCEPTIONS is empty. |
| A grade or integration write workflow lacks reconciliation evidence. | [`packages/institution/src/workflow.ts`](../../packages/institution/src/workflow.ts) | The grade-passback machine cannot leave ambiguous except through reconciliation_required; the journal never retries an uncertain action. |

## Retention, by data class

[`RETENTION.md`](../../RETENTION.md) is the retention schedule, and it is organised by table. The
documents’ draft policy is organised by data class and asks for customer
configuration, backup lifecycle and a legal hold. This table reads the schedule
into the classes: what the draft asks for, and what the schedule says today. The
test checks every table or sweep a row names is one the schedule names.

**Not legal advice, and not a duration commitment.** FERPA prescribes no
general retention period; institutions have duties under other law, contracts
and their own records schedules, and Semester will not claim a universal one.
Durations are published only after counsel and a customer have approved a
schedule; today nothing is customer-configurable and no legal hold exists.

| Data class | Examples | The draft’s default approach | What the schedule says today | Named in the schedule | Customer-configurable |
| --- | --- | --- | --- | --- | --- |
| **Account and identity** | Name, email, SSO identifiers, authentication records | Active account plus a defined post-termination period; delete or anonymize unless retention is required | Until the student deletes the account; abandoned sign-ups swept after 30 days | `sweep_abandoned_signups` | no |
| **Student private workspace** | Plans, actions, notes, preferences, eligible AI history | While the account or feature is active; honour deletion; preserve only under a hold | Until the student deletes it — the promise on the privacy screen; tombstones swept after 90 days | `notes`, `tasks`, `sweep_tombstones` | no |
| **Course content** | Instructor materials, source documents, syllabus data | Customer-controlled course lifecycle plus a configured archive period | Until the student deletes it; no institutional archive period exists | `courses` | no |
| **Assessment, submission and grade records** | Submissions, feedback, grade ledger, audit history | The institution’s records schedule; never deleted contrary to academic-record requirements | Until the student deletes it; no records schedule can be configured | `sittings` | no |
| **Community and club content** | Profiles, posts, memberships, event activity | Active lifecycle plus a configured archive period; moderation evidence only as needed | Until deleted; moderation audit events kept three years | `moderation_audit_event` | no |
| **Support data** | Tickets, diagnostic logs, support-access records | A defined support and security period; minimal attachments | The identity-free ticket queue is built and capability-gated; support access is time-limited and every read is logged. Per-ticket email notices are off by default, contain no reply text, and use a durable delivery outbox only after student opt-in. | `support_access`, `support_tickets`, `support_ticket_messages`, `support_notification_outbox` | no |
| **Basic-needs and referral metadata** | Consent, recipient, status, limited referral record | Minimum necessary; sensitive intake stays with the official service | Nothing is taken in: the navigator is a directory and stores no referral | `help_request` | no |
| **AI data** | Prompts, outputs, policy decisions, evaluation samples | Minimum period for operation, safety and support; production usage apart from de-identified evaluation | Gateway intelligence audit metadata 180 days, never prompts or prose; unconfirmed actions one day after expiry | `gateway_intelligence_audit`, `gateway_intelligence_action` | no |
| **Security and audit logs** | Authentication, access, administrative actions, security events | Per security and contractual requirements; access restricted | Access log 90 days; activity 400 days; grant, moderation and provisioning audit 3 years | `access_log`, `activity`, `role_grant_audit_event` | no |
| **Integration data** | Sync state, external ids, error records, reconciliation logs | Active connection plus a troubleshooting period; credentials removed on disconnect | Gateway audit 180 days; rate-limit counters one day; LTI nonces an hour past expiry | `gateway_audit`, `lti_nonce` | no |
| **Billing and contract records** | Invoices, contracts, tax and payment records | As law, accounting and contract require | None exist; billing stays out (D-009), and RETENTION.md names no such class | — | no |
| **Backups** | Encrypted point-in-time copies | A short documented lifecycle; rolling expiry; never the primary store | The provider’s daily backups, each expiring 7 days after it is taken per the plan tier’s documentation — not yet read off the dashboard on a date; PITR unconfirmed; no process reads one, and a deleted row outlives its deletion by at most that period except after a restore, which must re-apply the deletions (RETENTION.md, *Backups*; RESTORE.md) | — | no |

The draft’s principles: purpose limitation; data minimization; tenant-specific configuration; student and customer data agency; secure deletion; backup lifecycle management; preservation for valid legal holds; access restriction during retention; documented exceptions; transparent communication.

When deletion is requested or a period expires, the draft’s steps — the ones
the account-deletion function performs today are the third, fourth and
seventh; the second and sixth wait on a hold object and a stated backup lifecycle:

1. Verify authority and scope.
2. Identify active shares, dependencies and legal holds.
3. Delete or de-identify eligible primary data.
4. Revoke applicable access and integration tokens.
5. Queue deletion of derived indexes, caches and eligible AI retrieval representations.
6. Allow encrypted backups to expire through their documented lifecycle.
7. Record completion and exceptions in an audit log.
8. Confirm to the authorized requester where appropriate.

## The twelve sprints

The documents’ engineering plan, each sprint pointed at the rows it would move.
The lowest row is where the sprint stands; none is finished, because none of
the rows is above 2 and most are at 1.

| Sprint | Objective | Evidence output | Customer value | Rows (level) | Lowest |
| ---: | --- | --- | --- | --- | ---: |
| 1 | Tenant isolation and shared identity foundation | Authorization test suite, tenant-bound audit events | A safe multi-institution foundation | IAM-007 (2), IAM-008 (2), UOS-009 (2), TEN-1 (1) | 1 |
| 2 | Data inventory and classification service | Data map and field-classification registry | Clear privacy and procurement answers | PRIV-1 (2), SEC-008 (1), RM-01 (1) | 1 |
| 3 | Consent, share and revoke engine | Consent and disclosure logs, revocation tests | Student data agency | UOS-007 (2), FERPA-5 (2), PRIV-6 (2) | 2 |
| 4 | Central audit log and evidence service | Immutable audit-event schema and access logs | Traceable operations | SEC-006 (1), LOG-1 (2), FERPA-4 (2) | 1 |
| 5 | Secrets, CI security and SDLC gates | Scan reports, branch protection, deployment evidence | A security baseline | SEC-003 (1), SDLC-1 (2), SDLC-2 (2) | 1 |
| 6 | Backup, restore and incident readiness | Restore test, RTO/RPO record, incident tabletop | Reliability confidence | SRE-005 (1), BCP-1 (0), IR-1 (1), SEC-007 (1) | 0 |
| 7 | Accessibility design system and release gate | Component test suite, accessibility backlog | An inclusive experience and the ACR foundation | A11Y-001 (2), A11Y-1 (2), A11Y-2 (0), PRG-004 (2) | 0 |
| 8 | AI policy and provider control plane | AI inventory, policy decisions, provider review | A governed AI posture | AI-001 (1), AI-002 (1), AI-006 (1), AI-1 (2) | 1 |
| 9 | Source, scope and status metadata service | Trust-payload API and the user-facing component | An honest, understandable product | TRUST-001 (2), TRUST-002 (1), TRUST-003 (1), TRUST-004 (1) | 1 |
| 10 | LTI and OneRoster integration gateway and sandbox | Conformance test logs, integration data maps | Interoperability readiness | INT-002 (2), INT-005 (1), INT-006 (0), INT-1 (1) | 0 |
| 11 | Gradebook ledger and assessment audit controls | Grade calculation tests, release and change audit | Trustworthy grading | LMS-011 (1), LMS-012 (1), LMS-013 (1) | 1 |
| 12 | Procurement room and evidence export | HECVAT response library, customer trust dashboard | Faster enterprise evaluation | COM-003 (1), SEC-011 (1), SEC-013 (1) | 1 |

## The backlog, by priority

- **P0** — Before enterprise pilots: security, privacy, data-loss, critical accessibility, grade integrity, or misleading AI or official-information risk.
- **P1** — Before broad institutional rollout: blocks procurement, integration, adoption, support or core student value.
- **P2** — Benchmark differentiation.

**Built** when every row it rests on is at 2; **partly** when the lowest is 1; **open** otherwise.

| Priority | Capability | Rows (level) | Standing |
| --- | --- | --- | --- |
| P0 | Tenant isolation and authorization test suite | IAM-007 (2), IAM-008 (2), TEN-1 (1) | partly |
| P0 | SSO, MFA and privileged-access review | IAM-003 (1), IAM-005 (1), IAM-011 (1), IAM-3 (0) | open |
| P0 | Encryption, secrets vault, secure logging, backups and a restore test | CRYPTO-1 (1), SEC-006 (1), SRE-005 (1), BCP-1 (0) | open |
| P0 | Data inventory, DPA, subprocessor inventory, retention, legal hold and deletion controls | PRIV-1 (2), PRIV-4 (0), PRIV-5 (1), RM-02 (1) | open |
| P0 | Accessibility design system and critical-path manual testing | PRG-004 (2), A11Y-3 (0) | open |
| P0 | AI provider inventory, no-training default, policy engine, evaluation baseline | AI-002 (1), AI-006 (1), AI-011 (1), AI-2 (0) | open |
| P0 | Incident response and customer-notification runbooks | SEC-007 (1), IR-1 (1) | partly |
| P0 | LTI 1.3 integration test harness and scoped token and key controls | INT-002 (2), EDT-1 (2) | built |
| P0 | HECVAT evidence library and a secure procurement room | SEC-011 (1), COM-003 (1) | partly |
| P0 | A current ACR/VPAT and an accessibility remediation process | A11Y-007 (1), A11Y-2 (0), A11Y-4 (0) | open |
| P1 | Automated CI/CD security and accessibility release gates | SEC-003 (1), SRE-008 (1), A11Y-1 (2) | partly |
| P1 | Customer trust evidence dashboard | SEC-013 (1) | partly |
| P1 | Integration health, reconciliation and offboarding and export tools | INT-014 (1), LEG-004 (1), FERPA-7 (1) | partly |
| P1 | A formal vulnerability disclosure and annual penetration-test programme | VULN-1 (1), VULN-2 (0), SEC-005 (1) | open |
| P1 | Faculty and admin change-management and training evidence | SUP-003 (1), IMP-001 (1), AD-03 (1) | partly |
| P1 | Continuous compliance-control monitoring | GOV-2 (0), SEC-001 (1) | open |
| P1 | Automated evidence freshness and expiry alerts | DO-03 (2), SEC-013 (1) | partly |
| P1 | A tenant-specific policy and data-map dashboard | SEC-013 (1), IMP-001 (1) | partly |
| P2 | Public transparency and accessibility and AI change logs | PRG-002 (2), LW-06 (0) | open |
| P2 | The 1EdTech interoperability conformance and certification path | EDT-5 (0), EDT-7 (0) | open |
| P2 | The Semester Standard annual evidence report | PRG-002 (2), SEC-012 (1), LEGAL-1 (0) | open |
| P2 | Cross-region and data-residency controls | DR-02 (0), DR-07 (0) | open |
| P2 | An independent assurance programme, such as SOC 2, if commercially appropriate | SEC-012 (1), LEGAL-1 (0) | open |

## How this register is worked

An audit finding becomes work, and work becomes a claim, in this order and no other:

1. An audit finding is mapped to a risk and to the framework controls it touches.
2. A product or control owner is identified — a seat, until the seat is held.
3. Measurable acceptance criteria are defined.
4. An engineering story and its evidence artifact are created together.
5. It is implemented and tested.
6. Security, privacy and accessibility review it.
7. The evidence is stored under docs/evidence/ with its date and reviewer.
8. The control’s status is updated in the register that owns it.
9. It is validated in staging and production.
10. The customer-facing claim changes only after the evidence exists.

And four guardrails the documents insist on, held here as rules of the page:

- Never store a sensitive audit artifact in a broadly readable place: store the reference, hash, classification, owner, expiry and access policy, and keep the original in the trust room.
- Never mark a control effective because a policy exists; require evidence of implementation and of operation.
- Never hardcode a HECVAT question number as universal; question ids and applicability differ by version and by customer.
- Keep six things apart: implementation status, evidence freshness, test effectiveness, risk acceptance, customer-specific applicability, and public-claim eligibility.

The scores the register rests on are on [`docs/trust/COMPLIANCE-CROSSWALK.md`](COMPLIANCE-CROSSWALK.md); the
first artifacts are scheduled on [`docs/PROOF-CALENDAR.md`](../PROOF-CALENDAR.md); the NDA room that
will carry the *nda* rows is [`app/src/screens/TrustRoom.tsx`](../../app/src/screens/TrustRoom.tsx).
