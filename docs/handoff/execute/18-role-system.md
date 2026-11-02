# Stream 18 — Role system (execute the role-and-system map)

Source: `handoff/specifications/role-system-execution-prompt.pdf` (full text) and `handoff/specifications/depect-semester-flow-for-every-role.pdf`. Copy both, plus the earlier platform PDFs, into the repo at `docs/specifications/`.

## How to run

1. In an empty folder: `bash design/handoff/role-reconcile.sh` (clones, branches `audit/role-system-reconciliation`, installs, runs only the scripts that exist, extracts the role + capability vocabulary, stops).
2. Open Claude Code / Codex at the repo root and paste the prompt below.
3. Review the audit PR. Only then start branch 2.

## Paste this

> You are the complete Semester execution organization (CEO, COO, CPO, CTO, platform architect, frontend, backend, Supabase, SRE, security, privacy, accessibility, AI governance, registrar/SIS, learning, student success, student finance, campus services, growth/onboarding, sales/implementation/CS, finance/legal/people, developer platform, QA/release, PMO).
>
> Read `docs/specifications/*.pdf` completely, `design/docs/system/ROLE_SYSTEM_RECONCILIATION.md`, `design/docs/system/ROLE_LIFECYCLES.md`, `design/ui_kits/role-lifecycle/`, and `docs/role-reconciliation/*.txt`. Treat the repo, deployed config, Supabase schema, migrations, RLS, RPCs, Edge Functions, routes, tests and docs as **evidence to reconcile — not permission to invent duplicate systems.**
>
> Start with **only** branch `audit/role-system-reconciliation`. Do not write product features or migrations. Produce the 16 `docs/roles/*` documents below and return the 12-item first-task output. Stop for review.

## Known repo facts (from the design audit, 2026-10-05 — verify, don't assume)

- Canonical role model already exists: `public.app_roles` (68), `public.app_capabilities` (~96), `public.role_capabilities`, `public.role_grants` (subject, role, scope_kind, scope_id, expires_at, revoked_at), predicate `private.has_capability(capability, scope_kind, scope_id)`. **Extend this; never add a second one.**
- Tenant scope is `scope_kind = 'school'` + `scope_id`.
- Separation of duties is encoded in capability pairs (record:propose/approve, finance:request/approve, config:manage/publish, workflow:manage/publish, migration:manage/approve, hold:place/release).
- 185 migrations already cover course studio, gradebook, registration transaction, record ledger + chains, student accounts + payment plans, commercial core/billing, migration center, configuration studio, workflow builder, legal holds, human overrides, console approvals + break glass, integration control plane + SCIM, community + T&S, GTM, trust room, private beta, dining, K–12 guardians, AI policy/gateway/spend meter.
- 319 public tables, all RLS on, none forced; 33 public tables have RLS with no policy (deny-by-default); 32 tables grant `anon` some DML — review. 24 public + 12 private definer functions lack a regex-visible gate — unreviewed.
- `design/handoff/semester-platform/supabase/migrations/010–120` are **reference specs only — do not apply.**
- Known gaps: no developer role; guardian is `account_role = parent`, not an app role; no president/provost; student-success leader spread across three roles.

## Non-negotiable rules

1. No second app, parallel frontend or isolated admin app.
2. No static mockups, fake UI or demo data replacing working behavior.
3. No generic CRUD/table browsers for sensitive domains — controlled workflows with impact preview, validation, approval, audit, receipt, recovery.
4. Never duplicate identity, profiles, tenant/membership, roles/capabilities, consent, classification, policy, audit, workflow state, notifications, analytics, financial/academic records, tokens or navigation.
5. Never weaken RLS, tenant isolation, authorization, server-side policy, approvals, audit, CI/CD, secrets, accessibility, security, tests or rollback.
6. Client state, route params, storage, QR codes, invite/referral context and AI output are never authority.
7. Never expose service-role keys, payment data, SSO secrets, credentials, student records, support content, legal/HR data, tenant data, security evidence or unredacted audit logs.
8. No "admin can do everything".
9. Permission = identity + membership + role + capability + org scope + relationship + policy + consent + classification + entitlement + workflow state → allow / deny / step-up / approval.
10. AI never enrolls/drops, changes records, issues grades, confers credentials, approves money, makes disciplinary/clinical/safety/legal determinations, discloses protected data or overrides policy.
11. Never call a partial, mocked or integrated domain native-authoritative.
12. Never claim customers, pilots, outcomes, revenue, app-store presence, testimonials, certifications, conformance, integrations or approvals without evidence.
13. Everything tenant-isolated, capability-gated, policy- and consent-aware, accessible, auditable, tested, observable, supportable, documented, reversible when high-impact.

## Phase 0 deliverables (`docs/roles/`)

ROLE_SYSTEM_MASTER_MAP · ROLE_CATALOG · ROLE_LIFECYCLE_CATALOG · ROLE_WORKSPACE_CATALOG · ROLE_CAPABILITY_MATRIX · ROLE_TENANT_SCOPE_MATRIX · ROLE_CROSS_WORKFLOW_MAP · ROLE_ONBOARDING_CATALOG · ROLE_OFFBOARDING_CATALOG · ROLE_ROUTE_CATALOG · ROLE_DATA_ACCESS_MATRIX · ROLE_AI_POLICY_MATRIX · ROLE_SUPPORT_ESCALATION_MAP · ROLE_READINESS_SCORECARD · ROLE_SYSTEM_GAP_REGISTER · ROLE_SYSTEM_EXECUTION_BACKLOG

For every role: name · internal/external · tenant/org scope · provisioning source · workspace · routes · capabilities (repo names) · resource relationships · data classes · consent prerequisites · AI permissions · core and high-risk actions · approvals · step-up · audit events · notifications · support path · retention/offboarding · existing implementation · canonical tables/functions/components · missing pieces · risk · readiness · owner · tests · release gate.

Readiness labels: Native and verified · Native but incomplete · Integrated only · Transitional · Static prototype only · Designed/documented only · Planned · Not started · Duplicate/stale · Unsafe to activate · Needs accessibility review · Needs security/privacy review · Needs migration/reconciliation · Needs institutional approval · Ready for internal use · Ready for pilot · Ready for production · Ready to become authoritative.

## Role families to reconcile

- **A Learners:** self-serve student, institution-linked student, applicant, alumni, parent/guardian, peer mentor, community member, organization leader.
- **B Teaching:** faculty, TA, course designer, department chair, tutor, accessibility teaching support.
- **C Success and services:** advisor, success coach, success leader, support specialist, aid liaison, student accounts, housing, dining, library, recreation/events, campus services, moderator, safety operator, career, alumni staff, employer.
- **D Academic and institution admin:** registrar, registrar admin, academic affairs, curriculum admin, records specialist, graduation specialist, executive, institution admin, implementation lead, IT admin, identity admin, security, privacy, compliance, accessibility, finance/billing admin, procurement/legal liaison.
- **E Commercial and developer:** buyer, procurement/security evaluator, partner, marketplace partner, developer, developer-org admin.
- **F Semester company:** CEO, COO, CPO, CTO, product, PM, designer, researcher, engineer, platform, SRE, security, privacy/compliance, accessibility, AI governance, support, support lead, implementation, CSM, AE, sales lead, growth, finance, legal/vendor, people, partner manager, devrel, board, authorized investor viewer.

## Lifecycle, onboarding, routes, controlled actions, cross-role, AI, offboarding

Follow the full sections in the PDF. Summary:

- **Lifecycle (build it, not just diagram it):** discover/invite → identity → verification/SSO → tenant/membership/role → policy/consent/entitlement → onboarding → first action → workspace → controlled cross-role workflow → support → audit → role change/renewal/graduation/contract end/offboarding → portability/retention/deletion/archive.
- **Onboarding:** 12 initial journeys (self-serve student, linked student, applicant, faculty, TA, advisor, registrar, institution admin, buyer, implementation lead, partner/developer, Semester employee). Versioned, resumable across browser/PWA/native, measurable, supportable. Reconcile onboarding tables against what exists before creating any.
- **Routes:** `/app/t/:tenantSlug/{student,faculty,advisor,registrar,institution}/…` and `/app/ops/…` (full list in the PDF). Routes are not authority — enforce at UI boundary, server/API/RPC, RLS, storage, workflow command, export, and AI tool boundary.
- **Controlled action pattern** for registration, holds/overrides, grades, records, graduation, refunds, entitlements, policy, role grants, break-glass, SSO/SCIM/integrations, AI policy, export/deletion, cutover, rollout/kill switch, incidents: request → authenticate → resolve scope → evaluate → authoritative data → impact preview → step-up/approval → idempotent command → immutable audit → outbox → projections → notify → receipt → rollback path. Reuse the repo's console approvals + break-glass + human overrides.
- **Cross-role workflows:** student ↔ faculty, advisor, registrar, accounts, campus, career, family, community; institution ↔ Semester; Semester ↔ partner/developer.
- **AI:** one decision chain; per-role AI policy configurations (student, faculty, advisor, registrar, admin, support, developer, finance).
- **Offboarding:** graduation/leave/transfer, faculty/TA sunset, advisor reassignment, registrar/admin transfer, guardian expiry, institution cancellation, developer deprecation, employee offboarding, board expiry — each with trigger, owner, authority check, legal hold, ownership transfer, revocation, export, archive schedule, final audit, evidence.

## Priority

- **P0 (pilot):** canonical account/tenant/role/capability model; server-side policy/consent/classification; audit standard + explorer; tenant-aware AppShell + role nav + states; student self-serve + linked flows; SSO/invite/linking; student onboarding to first action; advisor basics; registrar readiness; institution admin config; ops inbox/work/approvals/tenant 360/customer 360/pilots/support; integration registry + freshness + reconciliation; rollout/flags/kill switches + incident runbook; activation analytics without record content; docs, tests, gates, support.
- **P1:** Course Studio, success leadership, student accounts ops, campus, career, family, community, governance consoles, implementation/migration, growth/sales/CS/finance consoles, AI governance, PWA/native continuity.
- **P2:** authoritative registrar cutover, native finance progression, marketplace at scale, global, multi-institution network, evaluated AI agents, regulated payments only after full readiness.

## Branches (in order)

1. audit/role-system-reconciliation
2. feat/canonical-identity-membership-capabilities
3. feat/policy-consent-classification-audit-foundation
4. design/role-aware-appshell-navigation
5. feat/student-onboarding-and-first-value
6. feat/institution-sso-invites-account-linking
7. feat/advisor-student-success-p0
8. feat/registrar-registration-readiness-p0
9. feat/institution-control-plane-p0
10. feat/semester-ops-command-center-p0
11. feat/integration-source-status-reconciliation-p0
12. feat/release-rollout-incident-controls-p0
13. feat/faculty-course-studio-p1
14. feat/student-finance-campus-career-family-community-p1
15. feat/trust-privacy-security-accessibility-consoles-p1
16. feat/company-os-growth-revenue-success-finance-people-p1
17. feat/developer-partner-marketplace-p2
18. feat/role-system-finish-line-evidence

Merge only when canonical models are used, RLS/policy checks exist, tests pass, accessibility review is done, audit/monitoring present, docs updated, rollback defined, readiness honestly marked.

## Quality gates

Inspect package scripts first; run only those that exist: `npm ci · lint · test · build · typecheck · test:a11y · test:integration · test:rls · test:e2e · security · secrets`. Supabase: `supabase login`, `supabase link --project-ref lzrqvlugnawcgywkhqlz`, `supabase migration list` — **read-only**. Never apply broad production migrations; use a branch/staging environment with RLS tests, backup validation and rollback prepared.

## Response after each phase (exactly)

1 Phase and branch · 2 Objective · 3 Current-state findings · 4 Canonical systems reused · 5 Duplicates found · 6 Files changed · 7 Routes/screens · 8 DB migrations/RPCs/policies · 9 Role/capability/policy controls · 10 Audit/evidence · 11 Onboarding/lifecycle · 12 AI governance · 13 Security/privacy/tenant isolation · 14 Accessibility/responsive · 15 Integrations/bridges · 16 Tests and exact results · 17 Build/lint/typecheck · 18 Readiness · 19 Risks and human review · 20 Rollback · 21 Next actions. Never say "complete" without evidence.

## First task output (branch 1 only)

1 Existing role/identity/tenant/capability systems · 2 Routes and role workspaces · 3 Tables, RLS policies, functions involved · 4 Duplicate/conflicting permission models · 5 Current student, faculty, advisor, registrar, institution-admin and operator flows · 6 Missing P0 pilot workflows · 7 Security/RLS/high-risk gaps · 8 Accessibility and mobile gaps · 9 Exact P0 sequence · 10 First 25 tasks · 11 First 10 branches with acceptance criteria · 12 Documentation list and locations.

## Don't accept "the role system is implemented" until

- [ ] One canonical account/profile model
- [ ] One canonical tenant/membership model
- [ ] One role/capability/scope evaluation model
- [ ] Server-side enforcement plus RLS enforcement
- [ ] Capability matrix for every P0 role
- [ ] Role-aware routing and navigation
- [ ] Student, advisor, registrar, institution-admin and operator first-value journeys
- [ ] P0 cross-role workflow map
- [ ] Audit and approval patterns for sensitive actions
- [ ] Onboarding progress that survives browser/PWA/native transitions
- [ ] Support/escalation and offboarding flows
- [ ] Accessibility, mobile, security and testing evidence
- [ ] Honest readiness labels for every domain

**Do not build many dashboards. Build one native Semester system with role workspaces over one governed, authoritative platform.**
