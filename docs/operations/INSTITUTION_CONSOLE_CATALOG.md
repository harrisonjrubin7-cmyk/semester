# Institution console catalog

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. Overview: [`INSTITUTION_OPERATING_SYSTEM.md`](INSTITUTION_OPERATING_SYSTEM.md). Role mapping: [`ROLE_CAPABILITY_MATRIX.md`](ROLE_CAPABILITY_MATRIX.md). Workflows: [`OPERATIONS_WORKFLOW_CATALOG.md`](OPERATIONS_WORKFLOW_CATALOG.md).

Each dossier answers the brief's nineteen dimensions in eight lines. **⊕** marks a capability or event that is proposed and unverified against `app_capabilities`; other capability names come from [`OPERATIONS_CONSOLE_PERMISSION_MATRIX.md`](../ops/OPERATIONS_CONSOLE_PERMISSION_MATRIX.md). Screens are views in `University` (`#/university/<view>`); a screen's states always include loading, empty, error-with-a-way-back, disabled, permission and long content, using `EmptyState`, `Notice`, `ErrorState`, `LoadingState`, `PermissionNotice` (`components/ui.tsx`, `components/unity/States.tsx`). Operating owner is the **institution role** that runs the console and, in brackets, the **Semester seat** accountable for the software; every Semester seat is the founder or `UNASSIGNED` today.

**Shared screen pattern** (reused by all thirteen, so none is a bespoke layout): Page header with context bar → filter/scope bar → table or board with source/authority/freshness chips (`SourceBadge`, status glyph + word per `lib/status.ts`) → detail drawer → controlled-action panel (preview, approval state, receipt). Reuse before building: `components/ui.tsx`, `components/Page.tsx`, `components/unity/`, `components/institutional/*`; a new shared component needs the case in `docs/design/GOVERNANCE.md` §2. Responsive per `lib/media.ts` (600/840/1200/1600); primary action survives at 320 px; nothing depends on hover; touch target `--target-primary`.

---

## 1. Executive
- **Model/Data/Screens:** read model over verified figures only: enrolment, retention, persistence, risk, initiative status, service performance. Views: Overview, Initiatives, Service performance. Nothing is computed in the browser.
- **Roles/Isolation:** `outcomes:read` (school) for institution leaders; Semester staff need `console:operate` + `success:manage`. Cohort cells under a minimum size are suppressed server-side.
- **Workflows/Approvals/Policy/Consent:** export of a board pack (one approval, content-free of student rows); no student-level data on this console, so no consent surface.
- **Audit/SAF:** `executive.metric_viewed` (sensitive-read), `executive.pack_exported`. Every metric: source, window, authority, last refresh, known limitation (the Figures tab contract in the console map). A metric with no source is `unknown`.
- **Review/SLO/Support:** privacy review of small-cell suppression; accessibility of charts ([`DATA-VISUALIZATION-SYSTEM.md`](../DATA-VISUALIZATION-SYSTEM.md): colour never the only signal). Freshness class "daily".
- **Rollback/Tests/Gate:** no mutations. Tests: scope (A≠B), small-cell, `unknown` rendering. Gates T, E, X.
- **Owner/Commercial:** president/provost office [product]. The renewal conversation starts here; a verified metric is the strongest sales proof, an unverified one is the strongest risk.
- **Tier:** P0 (verified, labelled metrics only).

## 2. Academic operations
- **Model/Data/Screens:** catalog, courses, terms, sections, capacity, prerequisites, enrolment, grading windows, degree progress, graduation. Views: Catalog, Terms, Sections, Requirements, Graduation. Existing: `Academic record`, `Configuration`, `Workflows`.
- **Roles/Isolation:** ⊕`academic:manage`, `tenant:configure`; department admins scoped to their `org_unit`. SIS is authoritative for the offering; Semester holds the working copy with provenance.
- **Workflows/Approvals/Policy/Consent:** change a requirement rule (two-person: registrar + academic affairs), open/close section, curricular approval. Policy = academic policy configuration versions. No consent surface (institutional records).
- **Audit/SAF:** `requirement.version_published`, `section.capacity_changed`. Authority S (SIS) / S+X where Semester adds planning data ([`SEMESTER_DATA_AUTHORITY_MATRIX.md`](../master/SEMESTER_DATA_AUTHORITY_MATRIX.md)).
- **Review/SLO/Support:** impact preview must list students whose audit changes; freshness per source, `unknown` blocks "live".
- **Rollback/Tests/Gate:** prior config version restorable; students' recomputed results are flagged, not silently changed. Tests: preview count equals post-publish delta; two-person. Gates T, P, W.
- **Owner/Commercial:** academic affairs [product]. Degree-rule accuracy is the trust test with advisors; implementation cost scales with rule complexity.
- **Tier:** P1.

## 3. Registrar
- **Model/Data/Screens:** registration windows, holds, waitlists, add/drop, overrides, record changes, graduation workflow. **P0 slice: Registration readiness** (windows, holds visibility, section capacity/waitlist pressure, readiness gaps by cohort, exception queue). Existing student side: `Registration.tsx`, `Registrar.tsx`; operator side missing.
- **Roles/Isolation:** `registrar` role at school scope; `registrar_grant_override` exists as a definer RPC and is on the sensitive-18 list (each must authorise in-body). A faculty or advisor never sees the whole cohort.
- **Workflows/Approvals/Policy/Consent:** registration override (registrar + reason), hold placement (an authority the registrar holds, not Semester), term-date change (two-person). Policy: override reasons are enumerated. Student consent not required for institutional operation; **sharing with a supporter or family** is consent-gated.
- **Audit/SAF:** `registration_audit_event` exists; add `registration.readiness_viewed` (sensitive-read), `registration.override_granted`. Authority SIS; every figure states "as of" and which feed.
- **Review/SLO/Support:** registration-day load is the SLO driver ([`REGISTRATION-DAY-MODE.md`](../REGISTRATION-DAY-MODE.md), [`LOAD-AND-SOAK.md`](../LOAD-AND-SOAK.md)); read freshness ≤ 5 min on registration day (proposed). Support: war-room mode in the launch war room.
- **Rollback/Tests/Gate:** an override is reversed by a second override with reason; term-date changes revert to the prior version. Tests: scope, override audit-before-effect, stale-feed banner. Gates T, E, D (load).
- **Owner/Commercial:** registrar [operations seat]. This is the first console a pilot buys; its success metric is time-to-first-readiness-report.
- **Tier:** **P0**. Authoritative cutover tooling is P2.

## 4. Faculty/teaching
- **Model/Data/Screens:** courses, rosters, learning objectives, accommodations, assessment workflows, workload, course outcomes. Views: My courses, Roster and accommodations, Assessment, Outcomes, Grade release. Existing: `Gradebook.tsx`, faculty course studio design.
- **Roles/Isolation:** `faculty` scoped to assigned sections via the section relationship (resource relationship in the permission formula), not school-wide.
- **Workflows/Approvals/Policy/Consent:** grade release (⊕`grade-release`: faculty + department rule), accommodation application. Accommodation detail is sensitive: minimum necessary, only what the instructor must act on.
- **Audit/SAF:** `grade.released`, `accommodation.viewed`. Gradebook authority is the LMS/SIS until a gate; Semester shows source and time.
- **Review/SLO/Support:** privacy + accessibility review of accommodation display; integrity statements per [`learning-integrity`](../learning-integrity/).
- **Rollback/Tests/Gate:** grade release is **compensable** (correction record), never silent; tests: cannot release other sections, release notification list matches roster. Gates T, P.
- **Owner/Commercial:** faculty/chairs [product]. Faculty adoption decides campus adoption; keep the console short.
- **Tier:** P1.

## 5. Student success
- **Model/Data/Screens:** caseloads, student plans, alerts, referrals, appointments, outreach, support quality, persistence signals. Views: Caseload, Alerts, Outreach, Appointments, Referrals. Existing: `CampaignManager`, advisor meeting mode.
- **Roles/Isolation:** `academic_advisor` scoped to an assigned caseload (relationship), never institution-wide; coach/support similarly.
- **Workflows/Approvals/Policy/Consent:** outreach campaign (approval by lead; **consent and notification rules checked per recipient**, quiet hours, [`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md)), referral, permitted notes. Alerts are explainable: each names its inputs; no opaque score, no autonomous student-facing action.
- **Audit/SAF:** `caseload.student_viewed`, `outreach.sent`, `referral.created`. Authority: advisor notes S (Semester); enrolment facts from SIS with freshness.
- **Review/SLO/Support:** equity review of alert rules ([`EQUITY-REVIEW.md`](../EQUITY-REVIEW.md)); outreach send latency; unsubscribe honoured immediately.
- **Rollback/Tests/Gate:** a sent message cannot be recalled → **irreversible**, hence preview shows recipients and suppressed recipients with reasons. Tests: caseload scope, suppression, consent. Gates T, P, Q (equity).
- **Owner/Commercial:** student success office [success seat]. Retention outcomes are the ROI claim; claims need evidence per the claims register.
- **Tier:** P0 slice (advisor intervention + outreach for the pilot), full P1.

## 6. Student accounts
- **Model/Data/Screens:** charges, credits, statements, payment plans, holds, refunds, reconciliation, financial-aid handoffs. Views: Accounts, Plans, Holds, Refunds, Reconciliation. Existing: `StudentAccounts`.
- **Roles/Isolation:** ⊕`accounts:operate` at school scope; an operator sees an account only through a case or a search that is itself audited.
- **Workflows/Approvals/Policy/Consent:** create charge/credit, enrol payment plan, refund. Refund and credit above a threshold: two-person (OD-4). **Semester does not move funds**; bank rails do. Policy: the institution's, versioned.
- **Audit/SAF:** `account.charge_created`, `account.refund_requested`; authority is the bursar system; Semester's ledger entry carries `source` and reconciliation status.
- **Review/SLO/Support:** legal and payments review before any funds-adjacent feature (brief: "if justified"); reconciliation freshness daily.
- **Rollback/Tests/Gate:** **compensable** via reversing entry; ledger append-only; tests: no update/delete path, threshold approval, reconciliation delta. Gates T, F (financial), P.
- **Owner/Commercial:** bursar/student accounts [finance seat]. Highest-liability console; ship read-only visibility first.
- **Tier:** P1 (read first); advanced native finance P2.

## 7. Campus services
- **Model/Data/Screens:** service catalog, eligibility, capacity, bookings, cases, events, demand. Views: Catalog, Cases, Bookings, Demand. Existing: `Services` tab.
- **Roles/Isolation:** ⊕`services:operate` scoped to the operating unit (housing, dining, library, recreation).
- **Workflows/Approvals/Policy/Consent:** open/close capacity, eligibility rule change (one approval), communication to bookers (consent-aware). Vendor events (campus card) are observed, not authoritative.
- **Audit/SAF:** `service.capacity_changed`, `case.closed`; source = vendor for events with freshness.
- **Review/SLO/Support:** basic-needs cases are sensitive: minimum necessary, no visibility to unrelated staff ([`BASIC-NEEDS-NAVIGATOR.md`](../BASIC-NEEDS-NAVIGATOR.md)).
- **Rollback/Tests/Gate:** capacity change reversible; cases follow retention. Tests: unit scoping, case redaction. Gates T, P.
- **Owner/Commercial:** campus services directors [operations seat]. Demand data supports the "campus value" narrative.
- **Tier:** P1.

## 8. Community/safety
- **Model/Data/Screens:** communities, events, moderation queue, reports, appeals, escalations, access restrictions. Views: Queue, Reports, Appeals, Escalations, Restrictions. Existing: `Moderation.tsx`, [`CAMPUS-MODERATION-SOP.md`](../CAMPUS-MODERATION-SOP.md), [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md).
- **Roles/Isolation:** `moderator` scoped to community or school; `trust_safety_reviewer` for appeals (different person from the original moderator).
- **Workflows/Approvals/Policy/Consent:** remove content, restrict access (appealable; second reviewer for suspensions), escalate to safety. Policy: escalation policy ([`CAMPUS-ESCALATION-POLICY.md`](../CAMPUS-ESCALATION-POLICY.md)). Pseudonymity rules per [`PSEUDONYMITY-POLICY.md`](../PSEUDONYMITY-POLICY.md): re-identification is a controlled action.
- **Audit/SAF:** `moderation_audit_event` exists; add re-identification and restriction events.
- **Review/SLO/Support:** time-to-first-review SLO by severity; safety escalation staffed or labelled unstaffed; media safety review.
- **Rollback/Tests/Gate:** restriction lift; content restore within retention. Tests: appeal independence, re-identification approval. Gates T, P, S.
- **Owner/Commercial:** dean of students/campus safety [trust seat]. Unstaffed escalation is the largest liability; the console must show coverage hours truthfully.
- **Tier:** P1.

## 9. Career/alumni/employer
- **Model/Data/Screens:** jobs, internships, employer accounts, applications, mentoring, outcomes, alumni engagement. Views: Postings, Employers, Applications, Outcomes, Alumni.
- **Roles/Isolation:** ⊕`career:operate`; employers are external accounts with **no** tenant student data beyond what a student shares.
- **Workflows/Approvals/Policy/Consent:** employer verification (one approval), posting review, student-initiated sharing of a credential/profile with an employer (consent per share, revocable). Alumni outreach consent-aware.
- **Audit/SAF:** `employer.verified`, `application.shared`; outcomes carry survey source and response rate.
- **Review/SLO/Support:** fair-treatment review of recommendation logic; employer abuse handling.
- **Rollback/Tests/Gate:** posting removal; shared-profile revocation. Tests: employer cannot read non-shared fields. Gates T, P, Q.
- **Owner/Commercial:** career office [success seat]. Employer revenue is a separate P2 motion.
- **Tier:** P1 career, P2 alumni network.

## 10. IT/identity
- **Model/Data/Screens:** SSO, SCIM, memberships, roles, device/session rules, integrations, access reviews, provisioning. Views: SSO, Provisioning, Access, Sessions, Integrations. Existing: `Control`, `Connections`, `Integrations`.
- **Roles/Isolation:** ⊕`identity:manage` at school scope; delegated admin only for capabilities the delegator holds. Break-glass local account is documented, not default.
- **Workflows/Approvals/Policy/Consent:** SSO onboarding, SCIM cutover, claim mapping change, access review (⊕`access:review`). Policy: SSO policy versions; claim minimisation.
- **Audit/SAF:** `tenant_sso_policy_history`, `provisioning_audit_event`. IdP authoritative for attributes.
- **Review/SLO/Support:** security review of session and replay handling; sign-in success SLO.
- **Rollback/Tests/Gate:** prior policy restorable; SCIM deprovision reversible within a window. Tests: SCIM isolation, policy history. Gates T, S.
- **Owner/Commercial:** CIO/IT [security seat]. SSO/SCIM is the procurement gate; HTTP SCIM absent is a stated gap.
- **Tier:** P0 slice (SSO/SCIM/integration visibility), access review P1.

## 11. Governance/trust
- **Model/Data/Screens:** data classification, consent, retention, legal holds, subject requests, AI policy, controls, incidents, evidence. Views: Privacy, Holds, Requests, AI policy, Controls, Evidence. Existing: `Trust` tab, `TrustDashboard`, trust room.
- **Roles/Isolation:** privacy/security/compliance officers; `data_request:handle`, `hold:read`, `compliance:manage`.
- **Workflows/Approvals/Policy/Consent:** handle a DSR, place/release a hold, change a retention policy (two-person + counsel), release evidence (trust-room grant, time-limited).
- **Audit/SAF:** DSR lifecycle, hold events, `trust_room_access_log`. Evidence rows carry expiry and the claims that rest on them.
- **Review/SLO/Support:** counsel review (not engaged); DSR clock visible.
- **Rollback/Tests/Gate:** hold release logged; purge irreversible. Tests: hold blocks sweep, evidence expiry. Gates T, P.
- **Owner/Commercial:** privacy/security officer [privacy seat]. This is the console the buyer's security team looks at first.
- **Tier:** P1 (P0: read-only evidence/trust room for the pilot's security review).

## 12. Implementation
- **Model/Data/Screens:** tenant activation, migration status, data quality, configuration, training, launch gate, adoption. Views: Plan, Migration, Configuration, Training, Launch gate. Existing: `Modules`, `Migration`, `Configuration`, [`INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK`](../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md), [`coo/02`](coo/02-implementation-methodology.md), [`coo/10`](coo/10-tenant-launch-risk-and-readiness.md).
- **Roles/Isolation:** institution project team (school scope) + Semester `tenant:implement` (platform, tenant-bound by assignment).
- **Workflows/Approvals/Policy/Consent:** activation checklist, field-mapping approval (institution steward signs), go/no-go gate (two-person), dual-run start.
- **Audit/SAF:** mapping versions, launch-gate decisions; data quality shown with rows checked and exceptions.
- **Review/SLO/Support:** launch gate is the release gate for a tenant (gate L).
- **Rollback/Tests/Gate:** back to observation mode; tenant rollout history. Tests: gate cannot pass with an open P0 exception.
- **Owner/Commercial:** institution project lead + [success seat]. Same data as the company Implementation tab — one record, two scoped views.
- **Tier:** **P0**.

## 13. Institutional command center
- **Model/Data/Screens:** the institution's own cross-domain work queue, approvals, exceptions, incidents, risk, service health. Views: Inbox, My work, Approvals, Exceptions, Service health. **Does not exist.**
- **Roles/Isolation:** any operator sees only items their capabilities cover; items from other tenants cannot exist in the read model.
- **Workflows/Approvals/Policy/Consent:** the same `work_item` and approval entities as the company side, filtered by tenant and capability (no second inbox implementation).
- **Audit/SAF:** every item names its source, freshness, owner, due date, next safe step. Green only when the scoped queue is empty (the console-map rule).
- **Review/SLO/Support:** inbox read-model freshness class "operational".
- **Rollback/Tests/Gate:** acknowledge/assign are the only optimistic actions. Tests: scope, no cross-tenant leakage. Gates T, X.
- **Owner/Commercial:** institution operations lead [operations seat]. The thing a provost can open daily.
- **Tier:** **P0** (reuses the company inbox read model; not a second build).
