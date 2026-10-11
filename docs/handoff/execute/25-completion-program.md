# Stream 25: Completion program

Source: two completion audits (Oct 2026), copied to `uploads/x-wf-a.pdf` and `uploads/x-wf-b.pdf`. Prototype: `#/os/completion` (`ui_kits/semester-app/Completion.jsx`).

## Rule
Catalogued, rendered, implemented, tested, deployed, institution-authorized and production-enabled are separate facts. Record each independently. Do not rebuild a screen only because an older register calls it missing; do not use the historical 84 / 302 / 419 counts as the backlog.

## Order
1. Reconcile: regenerate coverage and gap registers from current repo evidence.
2. Finish connected journeys: sign-in → context → Action Center → planning/registration → learning → help/referral → confirmation → return.
3. Deepen specialist packages with domain reviewers (admissions, graduate/research, aid, campus services, ERP scope).
4. Verify shared infrastructure once: identity, capabilities, action lifecycle, search boundary, consent, audit, recovery.
5. Activate by domain only after tests, drills, institutional authorization and reconciliation.

First after reconciliation: P07 assessment integrity, then P02/P04 lifecycle exceptions.

## Platform blockers (snapshot Oct 4, 2026 — re-verify before work)
- Security-definer functions owned by a bypass-RLS role
- Tenant AI policy not enforced at the model call
- Shared policy/command/audit/outbox modules not mounted on request paths
- Gateway policy coverage partial
- Productivity API not mounted
- No restore drill evidence
- Finance UI static; marketplace gated and unbuilt

## Packages
| # | Package | Workflows to finish | Owner | Starting point |
|---|---|---|---|---|
| P01 | Completion register | Reconcile role → job → workflow → screen → capability → command/read model → test → release; resolve duplicate names and conflicting statuses | Product + engineering | Deepen + reconcile |
| P02 | Identity and lifecycle | Signup, SSO, invitations, account linking, multiple memberships, student/TA/staff combinations, recovery, role switching, revocation across caches and workers | Identity/security | Deepen + reconcile |
| P03 | Authorization and control plane | Capabilities, relationship scope, delegation, policy evaluation, approvals, flags, audit; security-definer functions under a bypass-RLS owner | Platform/security | Deepen + reconcile |
| P04 | Student daily loop + Action Center | Action origin, dedupe, owner, priority, blocked, expiry, reopen, done; “student says done” vs “official source confirms” | Student product | Deepen + reconcile |
| P05 | Workspace and collaboration | Concurrent edits, comments, version restore, sharing changes, offline conflicts, import fidelity, export/exit | Workspace engineering | Deepen + reconcile |
| P06 | Academic planning and rules | Effective-dated requirements, catalog years, substitutions, repeats, transfer equivalency, exceptions, graduation clearance | Academic product + registrar | Deepen + reconcile |
| P07 | Learning and assessment integrity | Question versions, attempt start/resume, server timing, accommodations, autosave, disconnects, late submission, receipts, regrades | Learning product + faculty | Deepen + reconcile |
| P08 | Teaching lifecycle | Create → accessibility check → publish → roster changes → submissions → feedback → moderation → release → archive; course-copy loss | Learning product | Deepen + reconcile |
| P09 | Registration and records | Waitlists, overrides, add/drop, withdrawals, corrections, standing, graduation, transcripts, SIS reconciliation | Registrar domain lead | Deepen + reconcile |
| P10 | Admissions and applicant conversion | Application versions, document requests, recommendations, review assignment, decisions, deposits, deferrals, applicant → student identity merge | Admissions | Coverage question |
| P11 | Graduate and research education | Milestones, committees, candidacy, defenses, assistantships, supervisor changes, research training, handoff to research administration | Graduate school | Coverage question |
| P12 | Advising and referral closure | Referral acceptance, office ownership, appointments/no-shows, restricted notes, handoffs, overdue cases, disagreement, closure/reopen | Student-success lead | Deepen + reconcile |
| P13 | Student finance and aid | Charges, plans, refunds, disputes; aid documents, verification, award versions, acceptance, disbursement dependencies, appeals | Finance domain lead | Coverage question |
| P14 | Campus services | Library circulation, housing allocation and moves, work orders, room/equipment booking, dining exceptions, transport accessibility, appeals | Campus-services lead | Deepen + reconcile |
| P15 | Community, safety, career | Organizations, restricted cases, moderation, appeals; portfolios, employer verification, applications, mentoring, alumni transition | Student affairs + career | Deepen + reconcile |
| P16 | Family and delegated sharing | Invitation, scope, expiry, revocation, access history, changed relationships | Privacy + product | Deepen + reconcile |
| P17 | Governed AI | Source permissions, retrieval freshness, tool approval, cancellation, fallback, correction, budgets, model changes, incidents | AI governance + engineering | Deepen + reconcile |
| P18 | Integration, rollout and company ops | Developer app lifecycle; tenant setup, mapping, parallel run, cutover, rollback, legacy retirement, offboarding; institutional ERP scope | Implementation + company ops | Deepen + reconcile |

## Per-package completion record
| Field | Record |
|---|---|
| Scope | Included/excluded jobs, roles, institutional variants |
| Existing evidence | Exact design, code, schema, test, doc references |
| Workflow | Trigger, preconditions, states, branches, terminal outcomes |
| Screen specification | 14-layer screen contract below |
| Data contract | Owner, source, classification, freshness, retention, portability |
| Authority | Capability, policy, approval, consent, official-record boundary |
| Execution | Idempotency, concurrency, timeout, reconciliation, rollback |
| Dependencies | Shared services, external systems, institutional decisions |
| Ownership | One accountable owner; reviewer; institutional approver |
| Verification | Tests, usability, drills, release evidence |
| Activation | Environment, tenant, flag, scope, enablement authority |
| Status | Designed / Implemented / Tested / Deployed / Institution-authorized / Production-enabled — each separately |

## Completion register columns
Capability ID · Domain · Role · Workflow and step · Screen/function · Spec evidence · Code/schema evidence · Authority mode · Design · Implementation · Test · Deployment · Institution authorization · Production activation · Owner · Dependencies · Blocker · Next action · Acceptance evidence

## Screen contract (every consequential screen)
Entry · Data source per field · Visibility · Preconditions · Actions + capability · Validation · Consequence preview · State (pending sub-states, unknown outcome, partial) · Execution (idempotent, retry) · Outcome + receipt · Conflict · Recovery + appeal · Accessibility · Evidence

## Roles needing full journeys
Prospective student, applicant, online student, adult learner, graduate student, international student, student athlete, student worker, student parent/caregiver, program director, admissions staff, library staff, mentor.
Journey: entry → identity → membership → onboarding → first meaningful action → daily work → handoffs → exceptions → lifecycle transition → export/offboarding.

## Acceptance scenarios
Drop course, waitlist offer, group member leaves, graduation access change: every branch in `CPX_FLOWS` needs a specified screen state and a test.

## Ecosystem connection (from uploads/x-connect.pdf)
Do not build another ecosystem dashboard. Consolidate `ui_kits/ecosystem/`, the app prototype, capability registry, data-model views, governance backbone and role workspaces into one implementation map. Prototype tabs: Ecosystem, Connected journeys, Connection passport, Build order (`CompletionEco.jsx`).

### Seven “one” rules
1. One identity, many memberships
2. One shell, role-aware workspaces
3. One canonical definition per record type with a domain owner
4. One controlled-action pattern
5. One Action Center model fed by domain workflows
6. One search + AI access policy
7. One readiness register (six stages)

### Build order (dependency-gated)
1. Canonical implementation inventory
2. Identity and context reconciliation
3. Domain authority register
4. Shared shell and navigation contract
5. Policy and controlled-action layer
6. Shared workflow and Action Center
7. Event delivery and reconciliation
8. Search, projections, provenance
9. Learning and support journeys
10. Registration journey
11. AI gateway consolidation
12. Domain activation and replacement

### Connection passport (one per cross-domain connection)
Connection · User outcome · Producer · Consumer · Owner · Canonical record · Authoritative system · Scope · Classification/consent · Capability/relationship · Command · Approval · Confirmed event · Schema version · Dedup/ordering · Freshness · Timeout/unknown outcome · Reconciliation · Rollback · Search visibility · AI eligibility · Audit evidence · Accessibility · Monitoring · Six-stage readiness

### Release evidence per journey
Right person completes it · wrong person/tenant can’t · private stays private · official vs proposed distinguishable · no duplicate transactions · stale facts invalidate actions · timeouts reconcile · denials name reason and office · revocation works · keyboard/mobile/state paths · audit and receipts accurate · recovery rehearsed

### Open decisions
- Navigation: 5 destinations vs 7 areas vs prototype tabs. Choose one hierarchy.
- AI and student records: keep the strict rule until a broader policy is approved.
- Ask Semester (product) vs internal orchestrator naming; one gateway either way.
