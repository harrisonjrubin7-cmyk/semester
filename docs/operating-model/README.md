# Semester operating model

Semester is no longer short of product categories. The gap now is the discipline that keeps a platform this broad
coherent, so that it runs as a repeatable institutional operating model and not just as a very broad application.
Higher-ed digital transformation works when governance, data quality, people, processes, training, funding and
technology change together. Treating it as a software install is a common way for it to fail.

This directory is that operating model. Each part is labelled by how it is enforced:

- **Code** is enforced by a function and a test under `app/src/lib/governance/`.
- **Registry** is data the code checks, such as flags, contracts and charters.
- **Process** is a human practice with named roles and a cadence. The repository can write it down but cannot make it
  happen.

The central rule, stated once:

> If a university request cannot be configured, audited, tested, supported, rolled back, and reused, it should not
> become permanent core product code.

## Map

| # | Area | Document | Enforced by |
| --- | --- | --- | --- |
| 1 | Product portfolio governance, charters, sunset | [PORTFOLIO-GOVERNANCE.md](PORTFOLIO-GOVERNANCE.md) | Code: `scorecard.ts`, `charters.ts` |
| 2 | Configurability without fragmentation, extensions | [CONFIGURATION-TIERS.md](CONFIGURATION-TIERS.md) | Code: `config-tiers.ts`; registry: `flags.ts` |
| 3 | Multi-campus, multi-brand, consortium | [MULTI-CAMPUS.md](MULTI-CAMPUS.md) | Code: `hierarchy.ts`; ADR 0005 |
| 4 | Data stewardship and contract registry | [DATA-STEWARDSHIP.md](DATA-STEWARDSHIP.md) | Code: `data-contracts.ts` |
| 5 | Continuous user research | [RESEARCH-AND-SERVICE-DESIGN.md](RESEARCH-AND-SERVICE-DESIGN.md) | Process |
| 6 | Service design | [RESEARCH-AND-SERVICE-DESIGN.md](RESEARCH-AND-SERVICE-DESIGN.md#service-design) | Process; `workflow.service_routing` limit |
| 7 | Quality-management system | [QUALITY-MANAGEMENT.md](QUALITY-MANAGEMENT.md) | Code: `quality-gates.ts` |
| 8 | Incident communications by audience | [INCIDENT-COMMUNICATIONS.md](INCIDENT-COMMUNICATIONS.md) | Code: `incident-comms.ts` |
| 9 | Pricing governance and deal desk | [COMMERCIAL-GOVERNANCE.md](COMMERCIAL-GOVERNANCE.md) | Code: `deal-desk.ts` |
| 10 | Brand protection and crisis reputation | [TRUST-BRAND-AND-LEGAL.md](TRUST-BRAND-AND-LEGAL.md) | Process |
| 11 | Legal and regulatory horizon scanning | [TRUST-BRAND-AND-LEGAL.md](TRUST-BRAND-AND-LEGAL.md#horizon-scanning) | Process, quarterly |
| 12 | Financial controls and auditability | [COMMERCIAL-GOVERNANCE.md](COMMERCIAL-GOVERNANCE.md#financial-controls) | Process |
| 13 | Accessibility governance | [ACCESSIBILITY-GOVERNANCE.md](ACCESSIBILITY-GOVERNANCE.md) | Process, plus existing a11y tests |
| 14 | Ethical AI governance board | [AI-GOVERNANCE-BOARD.md](AI-GOVERNANCE-BOARD.md) | Process; classification and kill switches in code |
| 15 | Strategic defensibility | [DEFENSIBILITY.md](DEFENSIBILITY.md) | Process |
| 16 | Founding-team operating rhythm | [OPERATING-RHYTHM.md](OPERATING-RHYTHM.md) | Process |
| 17 | Pilot-to-production lifecycle, migration tracker | [PILOT-TO-PRODUCTION.md](PILOT-TO-PRODUCTION.md) | Code: `rollout.ts`; database: `tenant_rollout` trigger |
| 18 | SLOs, error budgets and the release rules they impose | [SLOS-AND-ERROR-BUDGETS.md](SLOS-AND-ERROR-BUDGETS.md) | Code: `error-budgets.ts` |
| 19 | AI lifecycle gates G0–G5 (NIST AI RMF) | [AI-LIFECYCLE-GATES.md](AI-LIFECYCLE-GATES.md) | Code: `ai-lifecycle.ts` |
| 20 | Release readiness score, proof before scale | [QUALITY-MANAGEMENT.md](QUALITY-MANAGEMENT.md#release-readiness) | Code: `release-readiness.ts` |
| 21 | Risk register, appetite, exceptions, game days, the maturity crosswalk | [RISK-GOVERNANCE.md](RISK-GOVERNANCE.md) | Code: `risk.ts`; rendered by its test |
| 22 | Edge-case catalog: which cases have a guard, which are owed | [../EDGE-CASE-CATALOG.md](../EDGE-CASE-CATALOG.md) | Code: `edgecases.ts`; rendered by its test |
| 23 | Operational maturity: records holds, content rights, analytics ethics, minors, cost, exit, residency, disaster scenarios and twelve more, control by control | [OPERATIONAL-MATURITY.md](OPERATIONAL-MATURITY.md) | Code: `maturity.ts`; rendered by its test |
| 24 | Operations Console checks: customer promises kept, release impact, on-call workload | `app/src/lib/governance/consolechecks.ts` | Code: `consolechecks.ts`; held by its test. The console’s own controls are `lib/ops/console.ts` (D-110); no console screen exists yet |
| 25 | AI assurance: the NIST AI RMF audit matrix, the AI 800-1 misuse-risk checklist, the evaluation risk tiers, the artifact set, the release gate held to `AI_RELEASE_GATE` | [AI-ASSURANCE.md](AI-ASSURANCE.md) | Code: `ai-assurance.ts`; rendered by its test |
| 26 | Privacy by module: what each module holds by default, the role matrix held to `app_roles`, the share screen, the liability controls, the twelve launch gates, the council | [../MODULE-PRIVACY-MODEL.md](../MODULE-PRIVACY-MODEL.md) | Code: `module-privacy.ts`; rendered by its test |
| 27 | The benchmark register: the strategy brief’s six commitments and twenty-five initiatives, item by item | [BENCHMARK.md](BENCHMARK.md) | Code: `benchmark.ts`; rendered by its test |
| 28 | The four-pillar audit: website, app and console, operations, funnels — 45 controls scored 0–4, the priority formula, the leak detector | [FOUR-PILLAR-AUDIT.md](FOUR-PILLAR-AUDIT.md) | Code: `audit.ts`; rendered by its test; `scripts/audit-workbook.py` fills the workbook from it |
| 29 | The interoperability roadmap: standards in priority order, each with the claims register’s word | [../INTEROPERABILITY-ROADMAP.md](../INTEROPERABILITY-ROADMAP.md) | Code: `interop.ts`; rendered by its test; printed at `/platform/integrations/` |
| 30 | The policy simulator: who sees a change, workflows, alternatives, support content, the audit event; retention classes, exports, deletions, contracts | `app/src/lib/governance/policysim.ts` | Code: `policysim.ts`; held by its test; drawn in the control plane |
| 31 | AI in grading and integrity: the three products without a single accuracy number, the evaluation that compares them, the procurement rules, the AI roles at their lifecycle gates, the fairness controls | [AI-GRADING-AND-INTEGRITY.md](AI-GRADING-AND-INTEGRITY.md) | Code: `grading-ai.ts`; rendered by its test |
| 32 | The SaaS launch kit: entity, insurance, the pilot agreement, module pricing, the GTM plan, the council charter, each held to the rules and outlines the tree already has | [../SAAS-LAUNCH-KIT.md](../SAAS-LAUNCH-KIT.md) | Code: `launchkit.ts`; rendered by its test |
| 33 | Operational reality: workstreams, service tiers, production checks and their guards, failure scenarios held to the registers, support, implementation, revenue operations, the go-live dossier, the final checklist | [../OPERATIONAL-REALITY-REGISTER.md](../OPERATIONAL-REALITY-REGISTER.md) | Code: `operationalreality.ts`; rendered by its test |
| 34 | Privacy impact assessment: the eleven questions, seven surfaces answered against the tree with held and written answers told apart, six owed, the pull-request gate | [PRIVACY-IMPACT-ASSESSMENT.md](PRIVACY-IMPACT-ASSESSMENT.md) | Code: `pia.ts`; rendered by its test; the gate line held in `.github/pull_request_template.md` |
| 35 | The 2026 AI integration playbook: ten agentic workflows with ROI scorecards, the human-confirmation matrix, data classes against the classification gate, the vendor scorecard as code, onboarding against FirstGoal, the definition of done against `AI_RELEASE_GATE` | [AI-INTEGRATION-PLAYBOOK.md](AI-INTEGRATION-PLAYBOOK.md) | Code: `ai-playbook.ts`; rendered by its test |
| 36 | Release certification: every domain on one ladder from designed to enterprise-ready, the production-certified GO gate, the council that signs it, and the NOT GO decision computed from all three | [RELEASE-CERTIFICATION.md](RELEASE-CERTIFICATION.md) | Code: `certification.ts`; rendered by its test |
| — | Change management and adoption | [CHANGE-MANAGEMENT.md](CHANGE-MANAGEMENT.md) | Process |
| — | AI financial sustainability, ROI measurement | [COMMERCIAL-GOVERNANCE.md](COMMERCIAL-GOVERNANCE.md#ai-cost-controls) | Existing metered gateway (ADR 0004) |

## Where the records live

The rules are code; what a school or the company *did* under them is a row in one of five tables, added by
[`20260927235000_governance_registries.sql`](../../supabase/migrations/20260927235000_governance_registries.sql) and walked account by account in
[`supabase/governance.check.sql`](../../supabase/governance.check.sql):

| Table | Holds | Who writes it |
| --- | --- | --- |
| `governance_policy_nodes` | The system → campus → school → program → course hierarchy | The platform (systems, and attaching a campus); a school's `tenant:configure` holders (their own nodes) |
| `governance_steward_assignments` | The named person in each stewardship role, per school and connector | A school's `tenant:configure` holders; revoked, never edited |
| `governance_decisions` | The portfolio council's decision log; total and route computed by the database | `governance:decide` (the `portfolio_council` role). Append-only |
| `governance_config_requests` | A school's configuration request and the approval steps it has passed | Requested by `tenant:configure`; advanced by `tenant:implement` |
| `governance_incident_notices` | Every incident notice as sent | `incident:communicate` (the `incident_responder` role). Append-only |

Charters, the settings list, contract definitions and the deal desk stay in code, not in tables: they define what
Semester *is*, the same way `flags.ts` defines a flag while `tenant_feature_policy` holds its state. Deals belong in
the sales and finance systems, not in the product's database.

`app/src/lib/governance/schema.test.ts` holds each list the tables enforce (settings and tiers, audiences and what each
must say, criteria, steps, levels, connectors, roles) to the TypeScript registry it copies.

## What is still missing, and it isn't code

Every "Process" row needs a named person, and the repository cannot hire one. The registries mark their gaps openly
instead of filling them with placeholders:

- `data-contracts.ts` names the *institutional role* that owns each domain. `readiness()` reports a tenant's contract as
  **unstaffed** until a named person holds the data owner, data steward, integration owner and privacy owner roles.
- `deal-desk.ts` carries **proposed** thresholds. No institutional price book exists in this repository, and finance
  sets the real ones.
- The AI governance board, portfolio council, accessibility panel and customer advisory board have charters here and
  no members yet.

## Ten priorities before adding more modules

1. Portfolio governance: decide whether to build, partner, integrate, defer or sunset.
2. Tenant configuration discipline: flexible but safe and reusable.
3. Data contracts and stewardship: a person accountable for every critical source.
4. Change management: adoption is a product and a service, not an email.
5. AI financial sustainability: cost, capacity, routing, quality and fallback.
6. Outcome and ROI measurement: direct evidence instead of vague retention claims.
7. Quality gates: ready, done, release, rollback.
8. Incident communications: clear, calm, timely and specific to each role.
9. Company operating cadence: weekly, monthly and quarterly decisions.
10. Strategic defensibility: integration quality, trust, accessibility, workflow context, outcomes and implementation
    expertise.
