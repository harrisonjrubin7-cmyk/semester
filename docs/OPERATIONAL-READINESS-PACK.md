# Operational readiness pack

<!-- Rendered from app/src/lib/ops/readiness-pack.ts by readiness-pack.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

> A feature is not operational because it is deployed. It is operational only when it has a named owner, tested controls, observability, a support path, a recovery plan, evidence, and a signed go/no-go decision.

Two documents of 28 September 2026 say when a release, a pilot, an
integration or a module is operational, and this page is their structure
with each item pointed at what the repository holds. Every checklist item
rests on rows of the registers that already exist — the master, HECVAT,
FERPA/1EdTech and maturity registers, and the twelve launch gates of
[`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md) — and its level on the crosswalk’s 0–4 scale is
computed by the test, capped at 4 now that `docs/evidence/` holds the AI drills of 29 September. The launch
verdict is computed the same way. **Today it is NO-GO**, and the test
asserts that rather than letting the page decide.

| Supplied document | What it holds |
| --- | --- |
| [Semester Operational Readiness Pack](expansion/Semester-Operational-Readiness-Pack.pdf) | The master operating plan, the workstreams and decision owners, the seven pillars with their checklists, the dependency register, the runbook template and minimum runbooks, the launch gate, the sign-off record, the cadences and the first twelve initiatives. |
| [Build an operational readiness audit checklist: 7 pillars, unbuilt dependencies, recovery runbooks](expansion/Operational-Readiness-Audit-Checklist.pdf) | The summary the pack was written from: the plan fields, the five workstreams, the pillars, the mandatory gates and the runbook structure. |

## The five workstreams

Each accountable lead is a council seat; a seat is held only once somebody
accepted it in writing, and the holder is read from the code.

| Workstream | Mission | Seat | Held by | Cadence | Example initiatives |
| --- | --- | --- | --- | --- | --- |
| **Product & Engineering** | Deliver a coherent, accessible, reliable platform. | `engineering` | Founder, acting | Weekly delivery and reliability review | Shared object model, Today, the LMS, Study Studio, the grade ledger, integrations, performance. |
| **Trust & Compliance** | Prove and maintain security, privacy, accessibility, AI and interoperability controls. | `security` | *vacant* | Weekly risk triage; monthly control review | HECVAT, TrustEd Apps readiness, the data inventory, AI governance, the ACR/VPAT, the evidence register. |
| **Customer Delivery** | Configure, launch, train, support, measure, renew and offboard customers. | `success` | Founder, acting | Weekly customer health review | The implementation factory, the support service, success plans, pilot measurement, customer health. |
| **Commercial** | Build predictable demand and revenue. | `founder` | Founder | Weekly pipeline and forecast review | Positioning, pricing, CRM, pilots, proposals, contracts, partnerships, renewals. |
| **Corporate Operations** | Operate a durable company. | `founder` | Founder | Monthly close and operating review | Entity, IP, finance, insurance, people, vendors, board and advisor governance. |

### Cross-functional decision owners

Ordinary ownership apart from high-risk decision rights. A reviewer is never the accountable seat.

| Decision | Accountable | Required reviewers |
| --- | --- | --- |
| A new product feature | `product` | `engineering`, `accessibility`, `security`, `privacy`, `success` |
| A new AI model, provider or tool action | `product` | `security`, `privacy`, `engineering`, `accessibility` |
| A new integration or data flow | `data` | `security`, `privacy`, `product`, `success`, `champion` |
| A high-risk grading or assessment capability | `product` | `accessibility`, `security`, `privacy`, `champion` |
| A sensitive support or basic-needs workflow | `trust` | `privacy`, `security`, `accessibility`, `champion` |
| A production release | `engineering` | `product`, `security`, `accessibility`, `success` |
| A customer go-live | `success` | `champion`, `product`, `data`, `security`, `privacy` |
| A commercial exception or discount | `founder` | `privacy`, `success` |
| Risk acceptance | `founder` | `security`, `privacy`, `accessibility`, `product` |

### The minimum DRI rules

| Rule | Held by | Today |
| --- | --- | --- |
| Every production system has one accountable owner and one backup owner. | [`app/src/lib/ops/operatingsystem.ts`](../app/src/lib/ops/operatingsystem.ts) | Every authoritative document has an owner seat; no backup, and every held seat is held by the same person, acting. |
| Every customer implementation has one Semester owner and one customer owner. | [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) | The champion seat is the customer’s; the success seat is Semester’s. Neither is held. |
| Every integration has technical, data and operational owners. | [`app/src/lib/governance/data-contracts.ts`](../app/src/lib/governance/data-contracts.ts) | A contract is unstaffed until a named person holds the data owner, steward, integration owner and privacy owner roles. |
| Every data source has a source owner and a freshness SLA. | [`app/src/lib/integration/freshness.ts`](../app/src/lib/integration/freshness.ts) | Freshness classes exist per connector; a source owner is a stewardship assignment nobody holds. |
| Every runbook has an owner, a last-tested date, a review date and an escalation path. | **nothing** | No runbook carries a tested date (maturity DO-04 partial); the operating system dates the documents, not the drills. |
| No critical responsibility is held only in one person’s memory. | **nothing** | A single-member company: every responsibility is held by one person, and the page says so rather than inventing a backup. |

## The seven pillars of production safety

68 checklist items: 7 at 0, 47 at 1, 14 at 2, none above the ceiling. An item’s level is the
lower median of the rows it rests on; `gate:` rows are launch gates (unmet 0,
partial 1, met 2).

### Reliability and failure behaviour

*Does the service remain understandable, safe and recoverable when a dependency fails?* Required evidence: Critical-journey map, dependency inventory, SLO document, error-state tests, status-page test, runbooks. — 0 at 0, 7 at 1, 2 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Critical user journeys are documented. | gate:golden-path (1), SRE-001 (2) | 1 |
| Service tiers and SLOs are defined. | SRE-001 (2) | 2 |
| Dependencies are inventoried and classified by criticality. | EX-01 (2), SEC-010 (1) | 1 |
| Timeouts, retries, circuit breakers and graceful degradation are defined. | INT-014 (1), SRE-008 (1) | 1 |
| Error messages give the user a next action and a support route. | STU-012 (2), gate:known-limitations (2) | 2 |
| Maintenance windows and change freezes are defined for critical academic dates. | SRE-009 (1) | 1 |
| The status page and customer-communication process are operational. | SRE-010 (1), SEC-007 (1) | 1 |
| No unsupported claim of 24/7 or emergency response is made. | SUP-002 (1), PRG-002 (2) | 1 |
| Failure modes have user-visible source, scope and status states. | TRUST-002 (1), TRUST-004 (1) | 1 |

### Data integrity and recovery

*Can Semester prevent, detect, correct and recover from data loss, corruption, duplication or stale integration data?* Required evidence: Backup configuration, restore record, migration logs, reconciliation report, deletion and hold test, ledger tests. — 2 at 0, 8 at 1, 1 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Data classification and the authoritative-source map are current. | PRIV-1 (2), TRUST-001 (2) | 2 |
| Every important object has source, freshness, version, owner and audit metadata. | TRUST-001 (2), TRUST-002 (1), SEC-006 (1) | 1 |
| Database backups are encrypted, monitored and restore-tested. | SRE-004 (1), BCP-1 (0), gate:backup-restore (1) | 1 |
| RTO and RPO are defined for each service tier. | SRE-006 (1), BCP-1 (0) | 0 |
| The restore runbook is tested with recorded results. | SRE-005 (1), BCP-1 (0) | 0 |
| Migrations are versioned, reviewed, tested and have rollback or repair plans. | MIG-006 (1), SRE-008 (1) | 1 |
| Critical writes are idempotent or protected by a write ledger. | AI-009 (2), INT-005 (1) | 1 |
| Grade, payment, consent, share and integration writes are auditable and reconcilable. | LMS-013 (1), UOS-007 (2), INT-014 (1) | 1 |
| Deletion, retention, legal hold, export and backup-expiry behaviour is tested. | PRIV-2 (2), RM-02 (1), RM-08 (1) | 1 |
| A reconciliation dashboard exists for material integrations. | INT-014 (1) | 1 |
| Dead-letter queues and manual repair workflows exist for failed syncs. | INT-013 (1), INT-014 (1) | 1 |

### Observability and incident response

*Can the team detect, understand, communicate and resolve failures before they become prolonged customer harm?* Required evidence: Dashboard configuration, alert test, incident plan, tabletop report, corrective-action tracker. — 0 at 0, 8 at 1, 0 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Centralized logs, metrics, traces and audit events exist for production systems. | SEC-006 (1), SRE-002 (1), SRE-003 (1) | 1 |
| Monitoring covers availability, latency, errors, saturation and queue depth. | SRE-002 (1), MON-1 (1) | 1 |
| Alerts have thresholds, an owner, a severity, a runbook and an escalation path. | MON-1 (1), gate:escalation-owners (1) | 1 |
| Incident severity levels, an incident commander and a communications owner are defined. | SEC-007 (1), IR-1 (1) | 1 |
| The status page can be updated quickly by authorized staff. | SRE-010 (1) | 1 |
| Incident runbooks exist for outages, data incidents, identity failure and integration failure. | SEC-007 (1), AI-014 (1), SRE-006 (1) | 1 |
| Tabletop exercises occur at least annually and after major operational changes. | IR-1 (1) | 1 |
| Post-incident reviews produce assigned, tracked corrective actions. | SEC-007 (1), gate:operations-live (1) | 1 |

### Security, privacy and access control

*Are users, tenants, data, keys, staff access and production systems protected by enforceable controls?* Required evidence: Access review, IAM settings, authorization test suite, secrets scan, data map, vendor review, scan and remediation log. — 0 at 0, 6 at 1, 5 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Production and non-production environments are separate. | PRG-006 (1), gate:staging-parity (1) | 1 |
| Secrets are in managed storage and never bundled to clients or source. | SDLC-2 (2), PRG-008 (2) | 2 |
| MFA protects privileged accounts. | IAM-005 (1), IAM-1 (2) | 1 |
| SSO, session controls, account recovery, access review and offboarding are operational. | IAM-003 (1), IAM-011 (1), IAM-3 (0) | 1 |
| Tenant isolation and role authorization have automated positive and negative tests. | IAM-007 (2), IAM-008 (2), TEN-1 (1) | 2 |
| Private storage, signed URLs, upload validation and content access rules are enforced. | IAM-009 (2) | 2 |
| Encryption in transit and at rest is verified. | CRYPTO-1 (1) | 1 |
| Vulnerability, dependency, secrets and infrastructure scanning are enabled and triaged. | SEC-004 (1), VULN-1 (1), SDLC-2 (2) | 1 |
| Production-access grants are least privilege, time-bound, reason-coded and logged. | IAM-010 (2), IAM-2 (2) | 2 |
| The data map, retention schedule, deletion and export workflow and legal hold are current. | PRIV-1 (2), PRIV-2 (2), RM-02 (1) | 2 |
| Subprocessors and AI providers are inventoried and approved. | PRIV-5 (1), AI-002 (1), SEC-010 (1) | 1 |

### Performance, capacity and cost resilience

*Can Semester meet user needs at academic peak times without unacceptable cost, latency or failure?* Required evidence: Load-test report, performance dashboard, cost report, device and network test, capacity plan, budget alerts. — 3 at 0, 5 at 1, 2 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Performance budgets exist by critical page, API, device class and network condition. | UX-003 (2), SRE-007 (1) | 1 |
| Load tests cover start-of-term sign-in, deadlines, assessment autosave and grade release. | SRE-007 (1), SRE-009 (1) | 1 |
| Indexes, rate limits, queues, caching and storage lifecycle are in place. | SRE-008 (1), IAM-009 (2) | 1 |
| Large lists and tables are virtualized or paginated. | UX-003 (2) | 2 |
| Search is indexed, debounced, permission-aware and monitored. | STU-009 (1) | 1 |
| Media and file processing is queued with progress, failure and retry states. | INT-012 (1) | 1 |
| Low-bandwidth and lower-end-device testing is completed. | UX-003 (2), A11Y-004 (2) | 2 |
| Cost is allocated by tenant, module, environment, AI use, storage and integration. | FO-01 (0), FO-02 (1) | 0 |
| Budget alerts and cost-anomaly detection exist. | FO-03 (0), AI-003 (1) | 0 |
| Capacity and cost assumptions are reviewed before a major customer launch. | SRE-007 (1), FO-04 (0) | 0 |

### Release, change and dependency management

*Can Semester release safely, recover quickly and prevent changes from breaking customers or compliance commitments?* Required evidence: CI configuration, release manifest, feature-flag register, dependency register, change approvals, rollback exercise. — 1 at 0, 7 at 1, 2 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Protected branches, peer review, CI checks and deployment approval exist. | SDLC-1 (2), SEC-003 (1) | 1 |
| CI includes type, unit, integration and authorization tests and secrets and dependency scanning. | SDLC-1 (2), SDLC-2 (2) | 2 |
| Staging mirrors production behaviour without ordinary production student data. | PRG-006 (1), PRG-008 (2), gate:staging-parity (1) | 1 |
| Preview environments and synthetic test tenants exist. | PRG-006 (1), PRG-008 (2) | 1 |
| Every release has change scope, risk level, owner, rollback plan and customer impact. | SRE-008 (1), gate:flags-rollback (1) | 1 |
| Feature flags have owner, scope, expiry, rollout and rollback details. | PRG-007 (2) | 2 |
| Database migrations have validation and repair or rollback plans. | MIG-006 (1), SRE-008 (1) | 1 |
| Material changes trigger privacy, security, accessibility, AI, documentation and support review. | PRG-003 (1), AI-001 (1) | 1 |
| The dependency inventory includes health, contract, data, support and exit terms. | SEC-010 (1), EX-01 (2), EX-10 (0) | 1 |
| Certificate, domain, token, key and licence expiry are monitored. | DR-04 (0), SRE-002 (1) | 0 |

### User support, accessibility and operational ownership

*Can a student, staff member, institution or operator use the service, get help and understand what happens next?* Required evidence: Accessibility reports, support workflow, knowledge-base inventory, ticket SLA dashboard, training plan, ownership registry. — 1 at 0, 6 at 1, 2 at 2.

| Item | Rests on (level) | Level |
| --- | --- | ---: |
| Critical workflows pass keyboard, screen-reader, zoom, mobile and contrast testing. | A11Y-001 (2), A11Y-002 (2), A11Y-004 (2), A11Y-3 (0) | 2 |
| An accessibility feedback route with triage, remediation, workaround and communication exists. | A11Y-4 (0), A11Y-006 (1) | 0 |
| A help center, knowledge base, in-product support and customer-admin support exist. | SUP-001 (2), STU-012 (2) | 2 |
| Support cases have category, severity, owner, target response, escalation and closure. | SUP-1 (1), SUP-001 (2) | 1 |
| Student support is distinct from institutional technical support and security or privacy contact. | SUP-1 (1), VULN-1 (1) | 1 |
| Every user-facing domain displays source, scope, status and authority where material. | TRUST-001 (2), TRUST-003 (1) | 1 |
| Empty, loading, permission-denied, error, offline, stale-data and recovery states exist. | UX-001 (2), TRUST-002 (1) | 1 |
| Implementation, training, hypercare, adoption review and renewal handoff are defined. | IMP-001 (1), SUP-003 (1), gate:onboarding-support (1) | 1 |
| Every module has product, operational, support, data, accessibility and privacy owners. | PRG-001 (1), PRG-003 (1) | 1 |

## The dependency register

A dependency is not only external: an unbuilt internal service, a policy, a
person, a contract. 2 healthy, 4 at risk, 1 failed, 8 unknown of 15.
*Unknown* means never tested against a failure, which is every dependency
that could fail. Nothing has a last-tested date, and the page prints none.

| ID | Dependency | Type | Criticality | Owner | Used by | Failure mode | Detection | Fallback | Exit | Rests on | Status | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **DEP-01** | Cloud hosting and database (Supabase) | External vendor | critical | `engineering` | Every signed-in feature | Nothing syncs; the local-first app keeps working on the device. | [`app/scripts/production-smoke.mjs`](../app/scripts/production-smoke.mjs) | Local-first: the device holds the data (ADR 0001). | Migrations and functions are in the tree; the exit playbook is partial (EX-07). | [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md) | unknown | Never tested against a failure; the provider’s status is not polled. |
| **DEP-02** | Identity: Supabase Auth and the institution’s identity provider | External vendor and customer dependency | critical | `security` | Sign-in, SSO, SCIM | Nobody can sign in; signed-in devices keep working until the session ends. | **nothing** | Invite-only setup without SSO (the ninety-day programme’s identity step). | Accounts are Supabase’s; SAML metadata is the school’s. | [`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`](INSTITUTIONAL-SSO-ARCHITECTURE.md) | unknown | No real identity provider has been exchanged with. |
| **DEP-03** | Push delivery (web push through the push function) | Internal service on external browsers | moderate | `engineering` | Reminders | Reminders arrive late or not at all; the in-app list still shows them. | [`supabase/functions/push/index.ts`](../supabase/functions/push/index.ts) | The device’s own notifications when the app is open. | None needed; standard web push. | [`supabase/functions/push/index.ts`](../supabase/functions/push/index.ts) | unknown | A gone endpoint is retired only on the second failed run; delivery is not measured. |
| **DEP-04** | Payments processor | External vendor | low | `founder` | Nothing | Nothing: billing stays out (D-009). | **nothing** | Not applicable. | Not applicable. | [`docs/DECISION-LOG.md`](DECISION-LOG.md) | healthy | Held out by decision; listed so the category is not silently missing. |
| **DEP-05** | AI providers (Anthropic through the metered function; an institution-approved provider through the gateway) | External vendor | high | `product` | Study Studio, Ask Semester, course generation | Generation fails or is slow; nothing else does. | [`supabase/functions/_shared/killswitch.ts`](../supabase/functions/_shared/killswitch.ts) | Ask Semester answers without a gateway and says why when it cannot help; the kill switch stops generation cleanly. | Provider registry per institution; no retrieval index to migrate. | [`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) | unknown | Provider terms are recorded as published (docs/trust/PROVIDER-TERMS.md), none signed; no outage has been simulated. |
| **DEP-06** | File storage and malware scanning | External vendor (storage); nothing (scanning) | high | `engineering` | Community media, the trust room, attachments | Uploads fail; attachments stay on the device they were added on. | **nothing** | Attachments do not sync by design (known limitation). | Buckets exportable; no migration plan (EX-08). | [`supabase/community.check.sql`](../supabase/community.check.sql) | at-risk | No malware scan on any upload. |
| **DEP-07** | CDN, DNS, domain and certificates (GitHub Pages, Vercel) | External vendor | critical | `engineering` | Loading the app; the institutional gateway | The app does not load for new sessions; installed copies keep working offline. | [`app/scripts/production-smoke.mjs`](../app/scripts/production-smoke.mjs) | The installed app works offline. | No custom domain yet; no DNS or CDN transition plan (EX-09). | [`app/vercel.json`](../app/vercel.json) | unknown | Certificates are the hosts’; no expiry is monitored. |
| **DEP-08** | Monitoring, logging and error tracking | Internal service | high | `engineering` | Everything, invisibly | Failures are not noticed until a person reports them. | [`MONITORING.md`](../MONITORING.md) | The weekly look. | Not applicable. | [`MONITORING.md`](../MONITORING.md) | at-risk | Scheduled smoke tests and a status page; no error tracking and no alert that reaches a person (SRE-002, SRE-003). |
| **DEP-09** | Support, ticketing and the status page | Internal service | high | `success` | Every user who needs help | A request goes unanswered. | [`app/public/status.html`](../app/public/status.html) | The support screen’s directory routes to the school’s own offices. | Not applicable. | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) | at-risk | No ticket system, no support address a university can be given, no hours (SUP-1). |
| **DEP-10** | Analytics, CRM, billing and accounting | Internal (analytics); nothing (the rest) | moderate | `founder` | The three marks of ANALYTICS.md; no commercial system | Nothing is measured; nothing is invoiced because nothing is sold. | [`supabase/analytics.sql`](../supabase/analytics.sql) | Not applicable. | Not applicable. | [`ANALYTICS.md`](../ANALYTICS.md) | unknown | No CRM, billing or accounting system exists (COM-001). |
| **DEP-11** | LMS, SIS, OneRoster, LTI and SCIM integrations | Customer dependency through the gateway | high | `data` | Synced courses, grades and rosters, once connected | Records go stale; the freshness class says so on the record. | [`app/src/lib/integration/freshness.ts`](../app/src/lib/integration/freshness.ts) | Student-entered records with their own label. | Disconnect revokes credentials; sync state is the tree’s (RETENTION.md). | [`app/src/lib/integration/catalog.ts`](../app/src/lib/integration/catalog.ts) | unknown | The adapter registry is empty; no connector has synced a real institution. |
| **DEP-12** | Customer source-content owners and freshness commitments | Customer dependency | high | `champion` | Every institution_verified fact | Verified facts go stale with no owner to ask. | [`docs/launch/CONTENT-READINESS-REGISTER.md`](launch/CONTENT-READINESS-REGISTER.md) | The source label says imported or needs_review. | Not applicable. | [`docs/launch/CONTENT-READINESS-REGISTER.md`](launch/CONTENT-READINESS-REGISTER.md) | unknown | No institution has committed to a freshness SLA (PL-07 on the leadership page). |
| **DEP-13** | Security scanning and secrets management | External vendor (GitHub) | high | `security` | Every push and every deploy | A secret or a vulnerable dependency reaches main unnoticed. | [`.gitleaks.toml`](../.gitleaks.toml) | Review. | Not applicable. | [`.github/dependabot.yml`](../.github/dependabot.yml) | healthy | Runs on every push; dispositions are not recorded. |
| **DEP-14** | Legal: DPA, subprocessor terms and insurance | Legal | critical | `privacy` | Any contract | No institution can sign. | **nothing** | None. | Not applicable. | [`docs/trust/README.md`](trust/README.md) | failed | No DPA, no insurance, no counsel-reviewed terms (PRIV-4, LEGAL-2). The trust index lists what blocks a signature. |
| **DEP-15** | Key person and staffing | People | critical | `founder` | Everything | The one person who operates the platform is unavailable. | **nothing** | None. | Not applicable. | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) | at-risk | A single-member LLC by the owner’s attestation; the seats that are held are all held by the founder; no backup owner exists for anything. |

## Recovery runbooks

Every material incident scenario follows seven steps:

1. **Detect** — An alert, a dashboard, a customer report or a health check.
2. **Triage** — Scope, tenants affected, start time, user impact, data and security impact.
3. **Contain** — A feature flag, a disabled integration, a rate limit, an isolated tenant, a revoked credential, a write freeze or read-only mode.
4. **Communicate** — The internal channel, the incident commander, the executive and customer owner, the status page and customer templates.
5. **Recover** — Exact technical steps, validation checks, reconciliation, rollback or restore.
6. **Validate** — A user-journey test, an audit and reconciliation review, alert recovery, a data-integrity check, customer confirmation where needed.
7. **Close** — The incident record, root cause, corrective actions with owner and date, customer follow-up, evidence retention.

The pack’s eighteen minimum runbooks, and the document that stands in for each today: 13 have one, 5 have none.
None has an owner, a last-tested date or an escalation path in the pack’s sense; the index of what exists is [`docs/RUNBOOKS.md`](RUNBOOKS.md).

| Runbook | Stands in today | Note |
| --- | --- | --- |
| Authentication or SSO failure | [`docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md`](SSO-SECURITY-AND-SESSION-MANAGEMENT.md) | Session and security design; no failure procedure. |
| Database outage or corruption | [`RESTORE.md`](../RESTORE.md) | The restore procedure; never run against production data. |
| Backup restore | [`supabase/restore-drill.sh`](../supabase/restore-drill.sh) | Scripted; the proof calendar’s month-one drill. |
| Critical deployment rollback | [`ROLLBACK.md`](../ROLLBACK.md) | Who puts the code back and how long it takes. |
| Tenant-isolation or authorization concern | [`SECURITY.md`](../SECURITY.md) | Report handling; no containment procedure for a suspected isolation failure. |
| Data deletion or export failure | **nothing** | Deletion is tested; nothing says what to do when it fails. |
| LMS, SIS, LTI or OneRoster sync failure | [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) | Onboarding, health and stopping a connector. |
| Grade or write reconciliation failure | [`docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`](INTEGRATION-QUALITY-AND-RECONCILIATION.md) | The design; the reconciliation itself is building (INT-014). |
| Assessment autosave or submission failure | **nothing** | The practice paper is kept and resumed; no procedure for a failed submission. |
| AI provider outage or unsafe-output escalation | [`docs/market-readiness/AI_GOVERNANCE.md`](market-readiness/AI_GOVERNANCE.md) | The kill switch exists; the AI incident playbook is not started (AI-3). |
| Payment failure, refund or duplicate charge | **nothing** | No payments (D-009). |
| Email, SMS or push delivery outage | **nothing** | Push retires a gone endpoint on the second failed run; no outage procedure. |
| File upload or malware-scan failure | **nothing** | No malware scan exists to fail. |
| Security incident and suspected breach | [`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) | Severity, flow and templates; never exercised. |
| DDoS, abuse or rate-limit event | [`docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`](SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md) | What exists and what is owed. |
| Cloud region or provider outage | [`docs/market-readiness/DISASTER_RECOVERY.md`](market-readiness/DISASTER_RECOVERY.md) | Not started, and says so. |
| Critical vendor failure | [`docs/trust/VENDOR-RISK-REGISTER.md`](trust/VENDOR-RISK-REGISTER.md) | The review procedure; no failure procedure. |
| Customer-admin misconfiguration | [`docs/TENANT-MAPPING-CONFIGURATION.md`](TENANT-MAPPING-CONFIGURATION.md) | The configuration; no repair procedure. |

## The launch readiness gate

| Outcome | Meaning |
| --- | --- |
| **GO** | All mandatory controls pass. Known limitations are low risk, documented, owned and accurately communicated. |
| **GO WITH CONDITIONS** | No P0 risk remains. Time-bound P1 and P2 conditions have owners, target dates, mitigation, customer communication and executive acceptance. |
| **NO-GO** | A P0 or unresolved mandatory gate exists: security or privacy breach risk, a critical accessibility failure, data-loss or grade-integrity risk, an unsupported claim, an untested recovery path, or no accountable owner. |

Thirteen areas, each resting on rows and launch gates. **An area’s level is its lowest row**, not a median: one unmet control fails the area, because the pack says an unresolved mandatory gate is NO-GO. A required area at 0 is a failed mandatory gate; at 1 it is a condition. **Today: NO-GO** — 5 areas at 0, 8 at 1, 0 passing.

| Area | Gate | Required for GO | Rests on (level) | Lowest |
| --- | --- | --- | --- | ---: |
| **Scope** | Enabled and excluded features are explicit. | Yes | PRG-003 (1), PRG-007 (2), gate:known-limitations (2) | 1 |
| **Ownership** | Product, technical, operational, support, security, privacy and accessibility owners are assigned. | Yes | PRG-001 (1), gate:escalation-owners (1) | 1 |
| **Data** | Data map, permissions, retention, source and freshness, and export and deletion behaviour are documented. | Yes | PRIV-1 (2), PRIV-2 (2), TRUST-001 (2), gate:data-scope (0) | 0 |
| **Security** | Authentication, tenant isolation, secrets, logging, vulnerability gates and the incident route are tested. | Yes | IAM-008 (2), SDLC-2 (2), SEC-006 (1), VULN-1 (1), IR-1 (1) | 1 |
| **Accessibility** | Critical workflows are tested; no unresolved critical barrier; alternatives documented. | Yes | A11Y-001 (2), A11Y-3 (0), gate:no-blockers (0) | 0 |
| **Reliability** | SLOs, monitoring, alerting, status communications, dependency health and runbooks are ready. | Yes | SRE-001 (2), SRE-002 (1), SRE-010 (1), gate:operations-live (1) | 1 |
| **Recovery** | Backup restore, rollback, reconciliation and failure behaviour are tested. | Yes | SRE-005 (1), BCP-1 (0), gate:backup-restore (1), gate:flags-rollback (1) | 0 |
| **Performance** | Peak-load and capacity evidence meets the defined thresholds. | Yes | SRE-007 (1), SRE-009 (1) | 1 |
| **AI** | Provider, policy, data use, evaluation, monitoring and disable controls are approved. | If AI is enabled (it is) | AI-1 (2), AI-2 (0), AI-006 (1), AI-012 (3) | 0 |
| **Integration** | Sandbox validation, scopes, reconciliation, failure fallback and a customer owner are approved. | If integrations are enabled (they are) | INT-001 (1), INT-014 (1), INT-1 (1) | 1 |
| **Support** | Help, escalation, incident communication and the implementation and hypercare plan are ready. | Yes | SUP-001 (2), SUP-1 (1), IMP-001 (1), gate:onboarding-support (1) | 1 |
| **Commercial** | Entitlement, price, invoicing, contract, support tier and renewal and exit terms are ready. | Yes | COM-001 (1), COM-002 (1), LEG-002 (1), gate:terms-reviewed (1) | 1 |
| **Evidence** | All test results and sign-offs are stored; open exceptions are approved and time-bound. | Yes | SEC-011 (1), GOV-2 (0), gate:pilot-outcome (1) | 0 |

### The review packet

Twelve items, 10 with a document that would carry them today:

| Item | Carried by |
| --- | --- |
| Release, pilot or module scope and exclusions | [`docs/launch/KNOWN-LIMITATIONS.md`](launch/KNOWN-LIMITATIONS.md) |
| Customer, tenant or cohort and contractual entitlement | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) |
| Critical journeys and success metrics | [`app/scripts/golden-path.mjs`](../app/scripts/golden-path.mjs) |
| Data flow, classification, source owner, retention and integration map | [`RETENTION.md`](../RETENTION.md) |
| Security, privacy, accessibility and AI risk assessments | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) |
| Service tier, SLOs, RTO/RPO, monitoring, alerts and on-call owners | [`docs/operating-model/SLOS-AND-ERROR-BUDGETS.md`](operating-model/SLOS-AND-ERROR-BUDGETS.md) |
| Performance, capacity and load-test results | [`docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md`](PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md) |
| Backup restore, rollback, reconciliation and failure-test evidence | **nothing** |
| Support, escalation, training, documentation and hypercare plan | [`docs/launch/FIRST-DAY-CHECKLISTS.md`](launch/FIRST-DAY-CHECKLISTS.md) |
| Known limitations, customer communications and workaround plan | [`docs/launch/KNOWN-LIMITATIONS.md`](launch/KNOWN-LIMITATIONS.md) |
| Open findings and exceptions with approval and expiry | [`app/src/lib/governance/risk.ts`](../app/src/lib/governance/risk.ts) |
| Final approver names, date and the GO / GO WITH CONDITIONS / NO-GO record | **nothing** |

### The sign-off record

Each line is a council seat. 7 of 12 seats are held (`founder` — Founder, `product` — Founder, acting, `engineering` — Founder, acting, `privacy` — Outside counsel, `accessibility` — Founder, acting, `success` — Founder, acting, `operations` — Founder, acting), the rest vacant. Nothing is signed: holding a seat is not
signing, and `signoffs` in [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) is empty; the
master register’s ten executive sign-offs ([`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](MASTER-LAUNCH-READINESS-REGISTER.md)) are the same people by another name.

| Sign-off | Seat | Held by | Signed |
| --- | --- | --- | --- |
| Decision chair | `founder` | Founder | — |
| Product | `product` | Founder, acting | — |
| Engineering | `engineering` | Founder, acting | — |
| Security | `security` | *vacant* | — |
| Privacy and legal | `privacy` | Outside counsel | — |
| Accessibility | `accessibility` | Founder, acting | — |
| AI governance | `product` | Founder, acting | — |
| Operations and support | `success` | Founder, acting | — |
| Customer implementation | `champion` | *vacant* | — |
| Commercial and contract | `founder` | Founder | — |

## Operating cadences

The pack’s cadences beside the operating rhythm already kept ([`docs/operating-model/OPERATING-RHYTHM.md`](operating-model/OPERATING-RHYTHM.md)), which has no daily line.

| Cadence | Required review |
| --- | --- |
| **Daily** | Uptime, the error and alert queue, security events, the support queue, integration health, critical customer issues. |
| **Weekly** | Delivery and release review, risk triage, pipeline, customer health, support themes, vulnerability triage, cost anomalies. |
| **Monthly** | Financial close, access review, evidence freshness, data-retention jobs, SLO and performance review, vendor review, plan review. |
| **Quarterly** | Backup restore, incident tabletop, AI evaluation, accessibility review, risk-register review, customer value review, board or advisor update. |
| **Annually** | Penetration test or independent security review, policy review, insurance renewal, full DR exercise, subprocessor review, accessibility documentation refresh. |

## The first operating-plan initiatives

The pack’s twelve initiatives, each on the rows it would move. The level is
the lower median of those rows; none is above 2, because nothing is.

| ID | Initiative | Workstream | Priority | Mandatory evidence | Rests on (level) | Level |
| --- | --- | --- | --- | --- | --- | ---: |
| **INIT-OPS-001** | Shared identity, tenant context, RBAC, audit events | Product & Engineering | P0 | Authorization test suite, access review, audit samples | IAM-006 (2), IAM-008 (2), IAM-011 (1), SEC-006 (1) | 1 |
| **INIT-OPS-002** | Data inventory, retention, deletion, legal-hold engine | Trust & Compliance | P0 | Data map, deletion, hold and export tests | PRIV-1 (2), PRIV-2 (2), RM-02 (1) | 2 |
| **INIT-OPS-003** | Observability, alerts, incident response, status communications | Product & Engineering | P0 | Dashboards, alert test, incident tabletop | SRE-002 (1), SEC-007 (1), SRE-010 (1), IR-1 (1) | 1 |
| **INIT-OPS-004** | Backup and restore, DR, rollback, migration repair | Product & Engineering | P0 | Restore exercise, rollback record, RTO/RPO | SRE-005 (1), SRE-006 (1), SRE-008 (1), BCP-1 (0) | 1 |
| **INIT-OPS-005** | Accessibility design system and release gate | Trust & Compliance | P0 | Manual and automated evidence, issue register | PRG-004 (2), A11Y-001 (2), A11Y-3 (0), A11Y-4 (0) | 0 |
| **INIT-OPS-006** | AI gateway, provider inventory, policy and evaluation controls | Trust & Compliance | P0 | AI inventory, provider review, evaluations | AI-002 (1), AI-006 (1), AI-011 (1), AI-2 (0) | 1 |
| **INIT-OPS-007** | Integration gateway, reconciliation, schema drift, contract tests | Product & Engineering | P0 | Sandbox results, reconciliation dashboard, fallback tests | INT-001 (1), INT-014 (1), INT-1 (1) | 1 |
| **INIT-OPS-008** | Support and implementation service and knowledge base | Customer Delivery | P1 | SLA and workflow, training plan, support dashboard | SUP-001 (2), SUP-003 (1), SUP-1 (1) | 1 |
| **INIT-OPS-009** | Procurement room, contracts, evidence vault, HECVAT and TrustEd crosswalk | Trust & Compliance | P1 | Current artifacts, a completed assessment, the evidence register | COM-003 (1), SEC-011 (1), LEG-002 (1), EDT-7 (0) | 1 |
| **INIT-OPS-010** | Pricing, CRM, billing, collections, forecasting | Commercial | P1 | Price book, quote and order process, monthly forecast | COM-001 (1), COM-002 (1), COM-004 (1) | 1 |
| **INIT-OPS-011** | Corporate entity, IP, bank, accounting, insurance, hiring controls | Corporate Operations | P0 | Formation records, policies, insurance certificates | LEG-001 (1), LEGAL-2 (0), GOV-1 (1) | 1 |
| **INIT-OPS-012** | Pilot-to-platform implementation factory | Customer Delivery | P1 | Readiness workbook, SOW, launch checklist, value review | IMP-001 (1), SUP-003 (1), COM-002 (1) | 1 |

### The master operating plan, against the master register

The pack asks for one master register with twenty fields per row. [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](MASTER-LAUNCH-READINESS-REGISTER.md) is that register; 13 of the twenty fields have a column or a place, and the rest are named so the gap is visible. Rejected: a second register (D-108’s reason).

| Field the pack asks for | Carried by |
| --- | --- |
| Initiative ID | id |
| Initiative | capability |
| Workstream | domain (seventeen, not five) |
| Strategic outcome | requirement |
| Scope | **nothing** |
| Customer, module or tenant impact | **nothing** |
| Accountable owner (DRI) | a gate’s owner seat; a row has none |
| Backup owner | **nothing** |
| Contributors | **nothing** |
| Priority | severity (P0–P2) |
| Risk tier | **nothing** |
| Dependencies | **nothing** |
| Budget | **nothing** |
| Target date | the proof calendar’s month, for a proof |
| Launch gate | the eight gates, by row |
| Evidence required | validation |
| Success metric | a first-year measure, where one exists |
| Status | status (nine states) |
| Risks and exceptions | the risk register, by id |
| Next review | the operating system, per document |

## The final standard

- Build it.
- Test it.
- Secure it.
- Observe it.
- Recover it.
- Support it.
- Document it.
- Sell it honestly.
- Implement it repeatedly.
- Measure the outcome.

Semester becomes operational when these are repeatable, evidenced routines
rather than aspirations. This page names rows and never changes them; the
registers that own the rows say what moves each.
