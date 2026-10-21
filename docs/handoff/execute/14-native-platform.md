# Stream 14 — Native platform (master command)

Source: uploads/provide prompt comand and code to excute and go al.pdf and uploads/now break down entire semester infstucture and sys.pdf. Copy both PDFs to `docs/specifications/` in the repo.

## Paste this

> You are the Semester platform execution team. Read design/handoff/BUILD.md, design/docs/native-platform/README.md and every PDF in docs/specifications/. Follow this file exactly. Start with Phase 0 on `audit/native-semester-master-reconciliation`. Do not write feature code until Phase 0 is complete. Stop at the end of every branch for review, and at every human-only step.

## Doctrine

Build native.
Integrate responsibly.
Replace by domain with proof.
Operate every domain as one system.

Integration is a controlled transition bridge, not the limit of the product.

## Non-negotiable rules

1. No separate frontend app. Extend `app/`.
2. No static mockups replacing working behavior. The design/ files are references, not code to ship.
3. No duplicate data models, navigation, permissions, tokens, source labels, audit or workflow engines.
4. Never weaken RLS, tenant isolation, capability checks, approvals, audit, release gates, tests or accessibility.
5. Client state is never the authority for sensitive actions.
6. Never expose service-role keys, secrets, vendor credentials, student records, financial data, security evidence or private support content.
7. No generic CRUD browsers for sensitive internal domains.
8. AI output is never an official decision by default.
9. Never replace official identity, grades, records, registration, payments or legal processes without migration, reconciliation, dual run, rollback, support readiness and approved cutover.
10. Never fabricate customers, pilots, revenue, outcomes, testimonials, certifications, compliance status or readiness.
11. A capability is not complete because a screen, table, migration, doc or prototype exists.
12. Small branches with tests and evidence. Run every quality gate after each phase.
13. Mark legal, tax, accounting, insurance, accessibility, privacy, compliance and security material for qualified human review.

## Phase 0 — master reconciliation (no feature code)

Read the repo (docs, code, migrations, routes, components, functions, tables, policies, integrations, company site, tests). Inspect Supabase (public + private schemas, RLS, roles, SECURITY DEFINER functions, RPCs, Edge Functions, storage, advisor findings) **read-only**. Inspect Vercel config, CI, environments, flags, tokens.

Create in the repo under docs/native-platform/: MASTER_CURRENT_STATE.md, PDF_TO_CODE_RECONCILIATION.md, NATIVE_PLATFORM_SOURCE_OF_TRUTH.md — and reconcile the generated catalogs from design/docs/native-platform/ (domain, screen, workflow, role, data authority, capability, gap register, backlog, roadmap) against real code. Replace every design-stage status with the true status.

For every capability record: name, domain, roles, routes, code paths, tables/RPCs, data authority, classification, tenant scope, capability, consent rule, AI policy, accessibility, security/privacy/retention, audit, integration and migration dependencies, support owner, SLO class, test evidence, release evidence, risk, priority, next action.

Phase 0 exit: native domain catalog, existing-vs-native capability matrix, source-of-truth matrix, design-token migration map, feature/screen/role/workflow traceability, security/RLS/function exposure classification, P0 launch blocker list, P0 pilot workflow definition, first 10 branches with acceptance criteria, first 25 tasks in dependency order.

## Phases 1–13

1. Foundation: identity/tenant, policy and governance (module modes off → shadow → assist → authoritative, two-person controls, break glass), data authority on every datum, design system in app/, reliability.
2. Student OS (A1). 3. Learning + Course Studio (B, B1, B2) — gradebook not authoritative until gate. 4. Academic operations (C, C1) via the command path. 5. Governed AI (F). 6. Success, finance, campus, community, career, family (D, H, G, J, I, K). 7. Control plane (L). 8. Integration and migration factory (M). 9. Trust (N). 10. Company OS (O). 11. Command Center (P) — request → evidence → approval → preview → execute → audit → outbox → projection → refresh → review. 12. Developer platform, marketplace, global (Q, U). 13. Finish line: docs/finish-line/* and evidence register.

## Branch order

1. `audit/native-semester-master-reconciliation` — Phase 0: current state, PDF-to-code reconciliation, catalogs, gap register (P0)
2. `feat/native-foundation-identity-policy-trust` — Identity, tenants, policy, data authority, audit, reliability (P0)
3. `design/live-semester-token-and-shell` — Tokens, AppShell, SideRail, source/status vocabulary in the real app (P0)
4. `feat/native-student-os-p0` — Today, Action Center, Calendar, Tasks, Privacy Center (P0)
5. `feat/native-plan-registration-p0` — Path, plan, registration readiness (pilot wedge) (P0)
6. `feat/native-course-studio-learning-p1` — Course Studio, assessments, gradebook (non-authoritative) (P1)
7. `feat/native-governed-ai-p1` — Gateway, policies, copilot, tutor, eval, red team (P1)
8. `feat/native-student-success-support-p1` — Caseloads, notes, support requests, escalation (P1)
9. `feat/native-registrar-academic-core-p2` — Catalog, sections, enrollment, record ledger (P2)
10. `feat/native-campus-community-career-p2` — Campus services, community, career (P2)
11. `feat/native-family-finance-p2` — Family consent, student account ledger (P2)
12. `feat/native-institution-control-plane` — Configuration studio, module modes, access reviews (P1)
13. `feat/native-integration-migration-factory` — Adapters, mapping studio, dual run, cutover (P1)
14. `feat/native-trust-security-compliance` — Trust platform, evidence, trust center (P1)
15. `feat/native-company-gmt-customer-success` — Company OS, CRM, billing, CS (P2)
16. `feat/native-ops-command-center` — Command Center with two-person approvals (P2)
17. `feat/native-developer-marketplace-global` — API, SDK, marketplace, i18n (P3)
18. `feat/native-finish-line-evidence` — Finish-line docs, evidence register, release checklist (P0 (ongoing))

## Quality gates (run and report each phase)

```
npm ci && npm run lint && npm run test && npm run build
# when defined in app/package.json
npm run typecheck; npm run test:a11y; npm run test:responsive; npm run test:design; npm run security; npm run secrets
```

## Supabase safety

```
supabase login
supabase link --project-ref lzrqvlugnawcgywkhqlz   # inspect only
supabase migration list
# Apply only to a development branch or non-production project first. Never db push to production without human approval.
```

## Authority gate (all 16 required)

Functional parity · Data authority · Accessibility · Security · Privacy · Tenant isolation · Auditability · Migration integrity · Reconciliation · Dual-run reliability · Institutional approval · Support readiness · Rollback · Exportability · Commercial readiness · Outcome proof

## Report after every phase

Work completed · code reused · native screens/workflows added · bridges · migrations · RPCs · roles/capabilities · tenant/security/privacy controls · accessibility · tests · commands run · lint/typecheck/test/build results · evidence · readiness · risks · human review items · next branch.
