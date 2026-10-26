# Semester Company Operating System (operations layer)

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. Console dossiers: [`COMPANY_CONSOLE_CATALOG.md`](COMPANY_CONSOLE_CATALOG.md). Command surface: [`OPERATIONS_COMMAND_CENTER.md`](OPERATIONS_COMMAND_CENTER.md).

> **Same name, different file.** [`docs/master/SEMESTER_COMPANY_OPERATING_SYSTEM.md`](../master/SEMESTER_COMPANY_OPERATING_SYSTEM.md) is the Phase 0 map of the twenty-one company *functions* and where the company stands. This page is not a second copy of it: it specifies the **software** that function map runs on, and refers to the master page for every fact about the company. On any disagreement about the company's state, the master page and the register rows it cites win.

> **Claim ceiling.** The company has one person, no customer, no signed pilot and no revenue other than a live $7.99 Stripe test; every finance figure is a draft hypothesis with a $0 cash placeholder. This page describes consoles for functions that have no operating history. A console earns "operated" only after real records pass through it.

## 1. Why the company needs the same system

The brief's complaint is the repository's own risk register in miniature: spreadsheets, Slack threads, generic CRMs and undocumented approvals produce parallel truths. The company has already hit this once — more than a dozen register and plan documents each hold their own risk and roadmap rows ([`SEMESTER_RISK_REGISTER.md`](../master/SEMESTER_RISK_REGISTER.md): "source rows win"). The Company OS therefore applies the Institution OS rules to the company itself:

1. **One graph.** Customers, contracts, entitlements, tenants and releases are the *same rows* the product reads (`customer`, `customer_contract`, `tenant_plan`, `entitlements`, `tenant_rollout`). A CRM is not adopted as a second truth; an integration may *feed* these tables, never replace them.
2. **Capabilities.** Company roles are real roles in `app_roles` (`finance_operator`, `customer_success`, `compliance_owner`, `trust_officer`, `incident_responder`, `support_agent`, `implementation_manager`, `platform_admin`, `data_steward`, …). `console:operate` is a platform-wide read key and is **never** sufficient for a domain's amounts or content.
3. **No company role reads a student's rows.** This is held by `supabase/company-roles-student-data.check.sql` (every company role probed, with an exact exceptions list) and [D-1294](../decisions/D-1294.md). Every console below inherits it: a Semester operator reaches student content only by student consent (`support_access_grant`) or a break-glass grant.
4. **One evidence base.** Metrics come from the figures contract (source, window, environment, owner, last refresh, evidence, limitation). Billing says there is no billing until there is.

## 2. The nine company consoles

| Console | Functions it owns (master map) | Built today | Missing | Tier |
| --- | --- | --- | --- | --- |
| Corporate governance | entity, board, resolutions, calendar, insurance, IP | templates ([`docs/company/`](../company/)); Evidence and Approvals tabs | entity/ownership records, board pack, resolutions, obligation calendar | P1 (board), P2 (rest) |
| Product/engineering | roadmap, requirements, design system, flags, releases, tech debt, capacity | Releases and flags (read-only); `docs/program/`, registers; CI | rollout write path, delivery plans, capacity | **P0** (release/rollout), P1 |
| Trust/security/privacy/accessibility | security, privacy, controls, vendor risk, AI governance, trust centre, questionnaires, incident command | Trust room, evidence register, DSR/hold tables; `docs/trust/` | control-centre read models, incident tables, access reviews | P1 (P0: evidence + incident basics) |
| Revenue operations | ICP, accounts, opportunities, pipeline, forecast, quotes, procurement, renewals | `customer`, `customer_contract`, `customer_commitment` (0 rows); [`docs/commercial/`](../commercial/) data model | Account/Customer 360, pipeline, quotes | **P0** (360 + pilot), P1 |
| Customer implementation/success | pilot design, implementation, activation, migration, training, adoption, health, QBR | `tenant_rollout`, `success_plans`, `account_health_snapshots` tables; playbooks | Pilot/Implementation tabs, explainable health | **P0** |
| Finance operations | products/plans/prices, billing, quotes, subscriptions, invoices, collections, forecast, budget, cash, spend, AI cost | Stripe functions, `commercial_*`, `invoices`, `payment_events`; client-side Finance model tab; [`docs/finance/`](../finance/) | institutional billing, entitlement operations screen, reconciliation | **P0** (quotes, invoices, entitlements, renewals), P1, P2 advanced |
| Legal/vendor operations | contract lifecycle, DPA/security exhibit, vendors, subprocessors, holds, policy library, obligations | [`SUBPROCESSORS.md`](../SUBPROCESSORS.md), `legal_holds`, [`docs/legal-drafts/`](../legal-drafts/) | vendor inventory rows, obligation calendar | P1 |
| People operations | org chart, workforce plan, hiring, onboarding, **access lifecycle**, equipment, comp/equity, performance, offboarding | [`docs/finance/12-GATED-HIRING-SCHEDULE.md`](../finance/12-GATED-HIRING-SCHEDULE.md) | everything; one-person company | P1 (access lifecycle first), rest P2 |
| Operations Command Center | cross-domain work, approvals, health, incidents | Console: Command center, Approvals, Break-glass, Audit, Customers, Figures, Evidence, Support, Releases, Views | Inbox, My work, Tenant/Customer 360, projections | **P0** |

## 3. Principles that apply to every company console

- **Read-only until a controlled action exists.** The first release of any console reads; writes arrive one duty at a time, each with its sheet from [`CONTROLLED_ACTION_PATTERNS.md`](CONTROLLED_ACTION_PATTERNS.md).
- **Honest empties.** With no customer, a revenue console shows an empty state that says so, not a placeholder row and not a demo. The existing Console has no demo mode; keep it that way.
- **Self-review is labelled.** Where one person holds both seats of a two-person duty, the duty cannot complete; where a review is performed by the same person it is recorded "self-review" and not counted as independent evidence ([master map](../master/SEMESTER_COMPANY_OPERATING_SYSTEM.md#operating-cadence)).
- **Sensitive reads are audited.** A support content view, a billing amount view, an audit export, an evidence release — each writes a sensitive-read audit event, and the screen says so (the Audit tab already does for itself).
- **Existing registers stay the source for plans.** Plan documents (`docs/finance/`, `docs/commercial/`) stay hypotheses until a console row has a real source; the console shows the hypothesis *labelled* as one.

## 4. Segregation of duties

The seat model (12 council seats, [`DECISION-RIGHTS.md`](../DECISION-RIGHTS.md), [`coo/03`](coo/03-raci-and-decision-rights.md) 64 decisions) is the approval source. The minimum separations the software should enforce, regardless of staffing:

| Duty pair | Rule |
| --- | --- |
| Request vs approve | never the same operator (enforced in `decide_approval`) |
| Quote vs discount approval | quoter cannot approve their own discount above the floor (OD-4) |
| Refund/credit request vs issue | two-person above threshold |
| Access grant vs access review | the reviewer is not the grantee or the granter |
| Evidence author vs evidence attester | different people; one-person company records "self-attested" |
| Break-glass subject vs reviewer | enforced (`review_break_glass`) |
| Release author vs rollout approver | for high-risk flags |

With one person, these rules **block** rather than bend. The product's behaviour then is a visible, truthful "waiting for a second person", and OD-5 (an external approver or advisor seat) is the owner's decision, not the console's.

## 5. Company-side metric contract

Reuses the Figures contract. A metric is defined once in a registry with: name, definition, formula, source table(s), authority, freshness class, owner seat, limitation, claim ceiling. Any figure shown without all of these is `unknown`. Operating metrics that need no customer (build health, gate status, time-to-restore in drills, evidence ageing, open P0 exceptions) are the first real ones; customer metrics (health, adoption, renewal, ARR) stay `unknown` until a tenant exists. The first-year measures are in [`COMPANY-FIRST-YEAR-MEASURES.md`](../COMPANY-FIRST-YEAR-MEASURES.md); the metric dictionary is [`coo/09`](coo/09-dashboards-and-indicators.md).

## 6. Commercial and customer-success impact

Company consoles are not revenue by themselves; they are what makes a first paid pilot *safe to sign*. The sequence the brief gives is the right one: be able to quote, provision a tenant, set entitlements, deliver the pilot, support it, release safely, and prove the outcome, before building the board and people consoles. Anything on this page that does not shorten that path is P1 or later.
