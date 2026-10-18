# Semester product universe

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** This describes what Semester is meant to become and what the repository holds today, side by side. No row is evidence of an activated tenant or a customer. Nothing here may be quoted publicly; public claims are held by [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (no unrestricted campaign approved; 0 of 40 machine-register claims are `available`).

## The thesis, and the discipline that keeps it honest

Semester is the AI-native operating system for education: one connected, governed, human-centred platform in place of the fragmented stack of learning, academic life, student support, campus services, institutional operations, productivity and AI.

**Build everything natively. Integrate responsibly. Replace only with proof. Operate every domain as one system.**

The thesis is not narrowed here. It is held to proof. Two rules follow, and they decide every row below:

1. A native replacement may not be claimed until it is implemented, tested, accessible, secure, governed, migrated, approved and supportable. That sequence is the [replacement gates](SEMESTER_DOMAIN_REPLACEMENT_GATES.md). Today **0 of 14** institutional domains are replaceable (`docs/DOMAIN-REPLACEMENT-REGISTER.md`).
2. Official records, identity, registration, grades, financial accounts, legal processes and high-stakes decisions are never replaced without institutional authority, migration, reconciliation, audit, rollback and operational readiness.

## The fifteen things Semester must become

Mapped to the forty domains in the [domain catalog](SEMESTER_DOMAIN_CATALOG.md) and to the repository as it is.

| # | Semester becomes | Domains | Native today (repository reading) | Gap that decides it |
| ---: | --- | --- | --- | --- |
| 1 | Student OS | D01, D03, D07 | Today/Action Center, plan, calendar, search run on device state with a seeded sample | Institution-verified data; server-side sync; accessibility evaluation |
| 2 | Productivity suite | D02 | Calendar, tasks, notes, Write/Sheet/Deck, office-format import/export; a real productivity service exists, off by default | Files never leave the device; mail is draft-only; service not mounted in any deployment |
| 3 | Learning OS | D04, D05 | Course Studio rules and guidance; gradebook ledger (off); QTI 3 library | No course shell, roster, submission store, question bank, rubric levels |
| 4 | Course Studio | D04, D08 | Authoring of guidance and AI rules for designated faculty | Faculty research; LMS parity |
| 5 | AI intelligence platform | D06, D07 | Metered edge proxy, institutional gateway routes, kill switch, policy layers, red-team set | Shared key blocked; BYOK bypasses the kill switch (F-04); evals thin |
| 6 | Registrar and academic OS | D10, D11, D12 | Record ledger, registration transaction, holds/overrides tables; all closed | No SIS adapter; no authority; no parallel run |
| 7 | Student success OS | D09, D15, D36 | Advisor shares, meeting mode, action feed, support tickets | No advisor screen in the router; sandbox-backed |
| 8 | Campus super-app | D15 to D19, D22 | Maps, dining service, housing and events UI, community foundation | Real data waits on school feeds |
| 9 | Financial and account OS | D13, D14, D32 | Student-accounts ledger, plans, Stripe individual billing (one live test) | No payment-provider link for institutions; refunds, disputes, tax unexercised |
| 10 | Career and lifelong-learning OS | D23 | Skills/portfolio, career tracker, credential-wallet design | No employer surface; no credential standard in code |
| 11 | Family and guardian consent platform | D24 | Grants, invites, guardian links, access events | Counsel review; high-risk activation profile |
| 12 | Institutional operating system | D25 to D31 | Governance, config, workflow builder, integration plane, console | Platform engines have 0 importers from the app; tenant isolation off |
| 13 | Developer platform | D34 | One OpenAPI contract (productivity v1), four examples | OAuth app model, webhooks, SDKs, sandbox tenants |
| 14 | Marketplace | D35 | Governance documents | Do not build (see backlog X-17) |
| 15 | Company operating system | D32, D33, D37 to D39 | Council seats, registers, finance model, GTM docs | One person; $0 evidenced cash; no customer |

## The twelve systems and the spine they share

From the brief: Education Experience, Learning and Assessment, Academic Records and Registrar, Student Success and Support, Productivity and Collaboration, Governed AI, Campus Life and Commerce, Career and Lifelong Learning, Identity/Trust/Privacy/Governance, Institutional Operations and Intelligence, Platform/Developer/Partner Ecosystem, and the Semester Company Operating System. They are the same forty domains grouped by who they serve.

Every system runs on one spine, and a feature that does not attach to it does not ship:

```
Identity → Tenant → Role → Capability → Policy → Data classification → Consent
        → Source authority → Workflow → Audit → Evidence → Outcome
```

| Spine element | Where it lives today | Honest state |
| --- | --- | --- |
| Identity | Supabase Auth; `institution_membership`; gateway `auth.ts` | Roles come from current database membership, not metadata; no real IdP connected |
| Tenant | `public.schools` (text slug); `tenant_id` on about 170 tables | Three tenant column spellings (`tenant_id`, `school_id`, `institution_id`); ADR-0002 would unify |
| Role | `app_roles` (about 69), `role_grants` with scope kinds | Defined; none `launch-approved` |
| Capability | `has_capability(capability, scope_kind, scope_id)`; 84 capabilities | RBAC only; attribute rules sit in policies |
| Policy | `packages/platform` policy engine; per-tenant AI/feature policy | Engines have 0 importers from `app/`; one non-test caller |
| Classification | `data_classification` T0 to T6, `data_classification_rules` | Per-table classes rule-derived, unreviewed |
| Consent | `consent_record`, `demand_consents`, guardian and family grants | Built; counsel review open |
| Source authority | Seven source states; precedence label | A label, not a rule |
| Workflow | `workflow_versions`, approvals, two-person controls | Built, preview only |
| Audit | `audit_event` and domain audit tables, hash-chained ledgers | Not tamper-evident everywhere (F-10) |
| Evidence | `docs/evidence/` and registers | A handful of repo-scoped items; none external |
| Outcome | `outcome_aggregates`, pilot scorecard | No baseline (EXT-015 blocked) |

## Experience requirements for every role surface

Held by `docs/DO-NOT-BUILD.md` (13 rules, several enforced by `app/src/donotbuild.test.ts`) and `docs/product-design/PRODUCT-QUALITY-BAR.md`. Every role-specific surface carries:

- A clear primary job and role-aware navigation.
- The correct tenant scope and the minimum necessary information.
- A **source label** and a **freshness state** on every fact.
- Accessibility support, a human escalation path, and an audit trail for sensitive actions.
- Mobile and desktop behaviour (widths gated by `app/src/widthgate.test.ts`).
- A visible distinction between **official record, guidance, recommendation, student-owned content, institutional content, external source, AI-generated content and community-generated content** (see the authority matrix).
- No unexplained score, risk label or recommendation; no AI output presented as official institutional information; no notification without an owner, a preference and a cap.

## Role surfaces

Ten roles have captured screen inventories (commit 8e3dd8f, 2026-10-05). The full role model is the [role catalog](SEMESTER_ROLE_CATALOG.md).

| Role | Semester surface | Daily value | State |
| --- | --- | --- | --- |
| Student | Student OS (five-destination journey navigation, default) | Know status, decide, act, learn, get support | Built on device state; seeded sample by default |
| Faculty | Course Studio | Teach, publish guidance, assess, govern AI use | Thin; flag off; no faculty discovery recorded |
| Advisor | Student success workspace | Student path, actions, referrals | UI plus sandbox |
| Registrar | Academic operations | Terms, catalog, holds, records, graduation | Closed at every school |
| Institution leader | Institutional intelligence | Aggregate outcomes, risk, adoption, bottlenecks | Staff studio on pasted data only |
| Family/guardian | Consent-based support portal | Only what the student authorised, time-bound | Built; not activated |
| Employer | Talent and opportunity portal | Verified, consented evidence | Not built |
| Partner | Integration and marketplace portal | Governed integrations and extensions | Not built |
| Semester operator | Operations Command Center | Tenants, pilots, support, security, billing, releases | Built; one operator |

## Navigation and screen map

There is **no URL router**. Navigation is `state.screen`, a `Screen` union rendered through `SCREENS` in `app/src/screens.tsx`; a screen missing from the table fails compilation. About 100 screens: shell (search, directory, university, career, family, pathway, support, privacy, data, help); courses and calendar; personal workspace (mine, note, work, mail, export); study (study, guide, drill, quiz, exam, proof); AI and tools (ask, draw, solve, write, sheet, deck, slides, essay, sources); course and people (classmates, groupwork, meet, call, announce); community (community, moderation, console, volunteers, agreements); campus (maps, dining, meals, housing, activities); records and money (degree, costs, registrar, registration, gradebook, account, connect). Staff studios live in `app/src/components/institutional/` and mount from the University screen; the Console is `screens/Console.tsx`.

Consequence for a product expansion: **a new screen is a new union member plus a table entry plus a test**, and `docs/DO-NOT-BUILD.md` rule 1 forbids a new top-level destination without portfolio approval. The implementation plan below stays inside that rule.

## What "one system" means in practice

Five connected objects carry a student's day. A to-do item is connected to a course, a deadline, a learning objective, a support office, an academic requirement and a workload. A calendar event connects to a course, term, assessment, registration window, appointment, campus event and action. A note connects to a course, reading, objective, assignment, AI citation and study resource. A file connects to its owner, course, privacy policy, retention, sharing and integrity rules. Search is permission-aware across personal, course, institutional and approved public sources. The repository's connected-object code is `app/src/lib/context-graph.ts` and the typed `Action` shape in `app/src/lib/actions.ts`; neither yet links across every one of these.

## The expansion programme, as the repository can carry it

The brief's ten phases map to the [12-month plan](SEMESTER_12_MONTH_EXECUTION_PLAN.md). Two constraints shape it that the brief does not state:

- **The critical path is outside the engineering team.** The repository's own computation (`docs/program/02-DEPENDENCIES-AND-CRITICAL-PATH.md`) finds that no engineering work sets the launch date; every path begins at an unsized node (candidate freeze, target environment, a named institution, entity facts) and runs through outside parties (qualified accessibility evaluator, counsel).
- **The first buyer decides the second domain.** Of the forty domains, 15 have no customer asking for them. The plan therefore builds the Phase 1 foundation first, then the one or two domains a named design partner chooses, and defers the rest.

## The first six hundred hours, by evidence value

If capacity were the only constraint, this is the order that raises the ceiling on every later claim:

1. Recovery and release hygiene (X-01, X-02): everything else is unprovable until `main` is green and a restore is measured.
2. Tenant isolation negatives and grant reduction (X-03, X-04): without them no institutional data should enter the system.
3. Alerting and a second person (X-05, X-06): an unmonitored system run by one person is not an operating system for anyone's institution.
4. Claim and counsel clean-up (X-07, X-08): the cheapest way to avoid a trust failure.
5. One design partner, one read-only adapter, one course (D27, D04): the first real data path.

## Related

[`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md) · [`docs/ONE-OPERATING-SYSTEM.md`](../ONE-OPERATING-SYSTEM.md) · [`docs/UNIVERSITY-OS-ARCHITECTURE.md`](../UNIVERSITY-OS-ARCHITECTURE.md) · [`docs/target-architecture/`](../target-architecture/README.md) · [`docs/strategy/`](../strategy/README.md)
