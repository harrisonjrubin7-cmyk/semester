# Semester operating system

<!-- Rendered from app/src/lib/ops/operatingsystem.ts by operatingsystem.test.ts. Edit the data, then run `npm run registers` from app/. -->

The one internal control document. For each thing the company runs on it
links **only the current authoritative version**, says who owns it, when it
was last reviewed and when it is next due, and what decisions it rests on.
Where no authoritative version exists it says so, rather than pointing at
the nearest thing and letting the nearest thing become the promise.

The repository holds several hundred pages. Most are audits of a moment or
plans that were overtaken, and they stay where they are: this page does not
delete or renumber anything (D-002). It says which page wins.

## Who holds the seats

Owner is a seat of the [launch readiness council](docs/LAUNCH-READINESS-COUNCIL.md),
never a person, and a seat is held only once somebody accepted it in writing.
**Every seat is vacant.** No document below has a person behind it yet; the owner column says which seat will.

## Where it stands

| Status | Meaning | Entries |
| --- | --- | ---: |
| current | Read on the review date, and stands | 30 |
| draft | The authoritative version, but not yet fit to act on | 2 |
| missing | No authoritative version exists; the gap says what would close it | 3 |
| **total** |  | **35** |

`version` counts reviews of the entry — the decision that this path is the
authoritative one and its content was read and stands — not the document’s
own revisions; git holds those. Registers that change with every merge are
reviewed monthly, the rest quarterly, and a next-review date that has passed
is a finding.

## The register

The nineteen categories the closing brief names, in its order.

| Category | Authoritative version | Status | Owner | Version | Last reviewed | Next review | Supersedes | Related decisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Company strategy | **none** | missing | `founder` | 1 | 2026-09-28 | 2026-12-28 | — | `DECISIONS §1`, `D-007` |
| Product vision | [`README.md`](README.md) | current | `product` | 1 | 2026-09-28 | 2026-12-28 | — | `D-003`, `D-006` |
| Master readiness register | [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](docs/MASTER-LAUNCH-READINESS-REGISTER.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Role launch register | [`docs/ROLE-LAUNCH-REGISTER.md`](docs/ROLE-LAUNCH-REGISTER.md) | current | `security` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Claims register | [`ops/claims/README.md`](ops/claims/README.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | `D-110` |
| Architecture decision records | [`docs/architecture/README.md`](docs/architecture/README.md) | current | `engineering` | 1 | 2026-09-28 | 2026-12-28 | — | `ADR-0001`, `ADR-0002`, `ADR-0003`, `ADR-0004`, `ADR-0005`, `ADR-0006` |
| Roadmap | [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md) | current | `product` | 1 | 2026-09-28 | 2026-12-28 | — | `D-002` |
| Risk register | [`docs/operating-model/RISK-GOVERNANCE.md`](docs/operating-model/RISK-GOVERNANCE.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Design system | [`docs/design/SEMESTER-UI-CONSTITUTION.md`](docs/design/SEMESTER-UI-CONSTITUTION.md) | current | `product` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Accessibility register | [`docs/WCAG-UI-AUDIT-SCORECARD.md`](docs/WCAG-UI-AUDIT-SCORECARD.md) | current | `accessibility` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Security/compliance evidence index | **none** | missing | `security` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Integration catalog | [`app/src/lib/integration/catalog.ts`](app/src/lib/integration/catalog.ts) | current | `data` | 1 | 2026-09-28 | 2026-12-28 | — | `D-007`, `ADR-0003` |
| Data inventory and lineage | [`RETENTION.md`](RETENTION.md) | current | `privacy` | 1 | 2026-09-28 | 2026-12-28 | — | `ADR-0001`, `ADR-0002` |
| Customer implementation method | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](docs/operating-model/PILOT-TO-PRODUCTION.md) | current | `success` | 1 | 2026-09-28 | 2026-12-28 | — | `DECISIONS §1` |
| Support/runbook library | [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md) | current | `engineering` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Commercial catalog | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](docs/operating-model/COMMERCIAL-GOVERNANCE.md) | draft | `founder` | 1 | 2026-09-28 | 2026-12-28 | — | `D-009` |
| Contract templates | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](docs/trust/PILOT-AGREEMENT-OUTLINE.md) | draft | `privacy` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Company site map | [`docs/PUBLIC-SITE.md`](docs/PUBLIC-SITE.md) | current | `product` | 1 | 2026-09-28 | 2026-12-28 | — | `D-011`, `D-031` |
| Operations Console map | **none** | missing | `engineering` | 1 | 2026-09-28 | 2026-12-28 | — | — |

### Anything else

What the repository also runs on, and the brief’s list did not name.

| Category | Authoritative version | Status | Owner | Version | Last reviewed | Next review | Supersedes | Related decisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Decision log | [`docs/DECISION-LOG.md`](docs/DECISION-LOG.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | `D-001`, `D-002` |
| Do-not-build register | [`docs/DO-NOT-BUILD.md`](docs/DO-NOT-BUILD.md) | current | `product` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Strategic boundaries | [`ops/strategic-boundaries/README.md`](ops/strategic-boundaries/README.md) | current | `founder` | 1 | 2026-09-28 | 2026-12-28 | — | `D-029`, `D-034`, `D-045` |
| Customer commitment register | [`ops/customer-commitments/README.md`](ops/customer-commitments/README.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Operations console controls | [`ops/operations-console/README.md`](ops/operations-console/README.md) | current | `engineering` | 1 | 2026-09-28 | 2026-12-28 | — | `D-110` |
| Proof calendar | [`docs/PROOF-CALENDAR.md`](docs/PROOF-CALENDAR.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Launch war room | [`docs/LAUNCH-WAR-ROOM.md`](docs/LAUNCH-WAR-ROOM.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| First-year success measures | [`docs/FIRST-YEAR-SUCCESS.md`](docs/FIRST-YEAR-SUCCESS.md) | current | `founder` | 1 | 2026-09-28 | 2026-12-28 | — | `D-005`, `D-009` |
| Launch readiness council | [`docs/LAUNCH-READINESS-COUNCIL.md`](docs/LAUNCH-READINESS-COUNCIL.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | — |
| Operating rhythm | [`docs/operating-model/OPERATING-RHYTHM.md`](docs/operating-model/OPERATING-RHYTHM.md) | current | `founder` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Engineering gates | [`REGRESSION-CHECKLIST.md`](REGRESSION-CHECKLIST.md) | current | `engineering` | 1 | 2026-09-28 | 2026-12-28 | — | `D-010` |
| Product analytics | [`ANALYTICS.md`](ANALYTICS.md) | current | `founder` | 1 | 2026-09-28 | 2026-12-28 | — | `D-005` |
| Subprocessor register | [`docs/SUBPROCESSORS.md`](docs/SUBPROCESSORS.md) | current | `privacy` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Strategic expansion register | [`docs/STRATEGIC-EXPANSION-REGISTER.md`](docs/STRATEGIC-EXPANSION-REGISTER.md) | current | `founder` | 1 | 2026-09-28 | 2026-10-28 | — | `DECISIONS §1` |
| Supply-chain policy | [`docs/SUPPLY-CHAIN.md`](docs/SUPPLY-CHAIN.md) | current | `engineering` | 1 | 2026-09-28 | 2026-12-28 | — | — |
| Security policy | [`SECURITY.md`](SECURITY.md) | current | `security` | 1 | 2026-09-28 | 2026-12-28 | — | `ADR-0002` |

## Notes and gaps

- **Company strategy** — *missing.* The one-page strategy memo that docs/operating-model/OPERATING-RHYTHM.md schedules quarterly has not been written. MARKET-POSITION.md is a competitor review with an action plan and DEFENSIBILITY.md is the moat argument; neither states the strategy in one place a new hire could read first. Read next: [`MARKET-POSITION.md`](MARKET-POSITION.md), [`docs/operating-model/DEFENSIBILITY.md`](docs/operating-model/DEFENSIBILITY.md), [`docs/gtm/EXECUTION-PLAN.md`](docs/gtm/EXECUTION-PLAN.md).
- **Product vision** — The opening paragraph is the vision as it is sold today. SEMESTER-MASTER-COMMAND.md is the specification behind it, and says which of its sections were never supplied. Read next: [`SEMESTER-MASTER-COMMAND.md`](SEMESTER-MASTER-COMMAND.md), [`docs/launch/WHAT-IS-SEMESTER.md`](docs/launch/WHAT-IS-SEMESTER.md).
- **Master readiness register** — Rendered from app/src/lib/masterregister.ts; a test holds every row to the kind of file it cites. Nothing is above `tested` until docs/evidence/ exists. Read next: [`docs/LAUNCH-READINESS-COUNCIL.md`](docs/LAUNCH-READINESS-COUNCIL.md), [`docs/GO-NO-GO-CHECKLIST.md`](docs/GO-NO-GO-CHECKLIST.md).
- **Role launch register** — Rendered from app/src/lib/rolelaunch.ts, which reads the roles out of the migrations. All 63 roles are `modeled`; none is provisionable.
- **Claims register** — Rendered from app/src/lib/ops/claims.ts: every capability the public site asserts, the word it may carry, the master-register rows and tests behind it, and the pages it appears on. claims.test.ts reads the rendered site and refuses a word above its rows or a label the register does not know. It covers the public site; sales decks and RFP answers are not yet mapped (PRG-002). The capability inventory covers product promises, and ops/customer-commitments/ promises to a named customer. Read next: [`app/src/lib/rollout-capabilities.ts`](app/src/lib/rollout-capabilities.ts), [`docs/launch/CONTENT-READINESS-REGISTER.md`](docs/launch/CONTENT-READINESS-REGISTER.md), [`ops/customer-commitments/README.md`](ops/customer-commitments/README.md).
- **Architecture decision records** — Six records. Product decisions are not here: settled ones are in DECISIONS.md and the programme log is docs/DECISION-LOG.md.
- **Roadmap** — The unified-platform plan of record. The root-level plans it overtook (IMPLEMENTATION-PLAN.md, COMPLETION-PLAN.md, ACTION-PLAN.md) are not listed as superseded because none carries a redirect yet; D-002 makes that backlog item BL-0.3. Read next: [`docs/90-DAY-LAUNCH-PROGRAM.md`](docs/90-DAY-LAUNCH-PROGRAM.md), [`docs/LMS-LEARNING-ROADMAP.md`](docs/LMS-LEARNING-ROADMAP.md).
- **Risk register** — Rendered from app/src/lib/governance/risk.ts: seventeen risks with likelihood, impact, tolerance, controls that must exist, residual and an owner seat; the appetite tiers; the exception rules reviewException() enforces (no indefinite exception, 90 days at most, P0 needs executive, security and legal); sixteen game days, none held. Owners are seats, not people, and no exception has been approved. Read next: [`docs/LAUNCH-READINESS-COUNCIL.md`](docs/LAUNCH-READINESS-COUNCIL.md), [`docs/trust/SOC2-READINESS.md`](docs/trust/SOC2-READINESS.md), [`docs/EDGE-CASE-CATALOG.md`](docs/EDGE-CASE-CATALOG.md).
- **Design system** — The quality contract the pull-request template cites (§9). Tokens live in app/src/styles/, primitives in app/src/components/ui.tsx, and the style and label audits run in `npm run lint`. Read next: [`docs/design/README.md`](docs/design/README.md), [`docs/DO-NOT-BUILD.md`](docs/DO-NOT-BUILD.md).
- **Accessibility register** — A per-component WCAG 2.2 scorecard where every score cites its test. It is not yet a findings register with remediation dates; the VPAT/ACR (master register A11Y-007) is on the proof calendar. Read next: [`docs/market-readiness/ACCESSIBILITY_READINESS.md`](docs/market-readiness/ACCESSIBILITY_READINESS.md), [`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md`](docs/operating-model/ACCESSIBILITY-GOVERNANCE.md).
- **Security/compliance evidence index** — *missing.* docs/evidence/ does not exist, and the master register lets no row above `tested` until it does. The trust package (docs/trust/) is the set of documents a reviewer reads; the evidence that any of them is operated has not been produced. docs/PROOF-CALENDAR.md schedules it. Read next: [`docs/trust/README.md`](docs/trust/README.md), [`docs/market-readiness/HECVAT_READINESS.md`](docs/market-readiness/HECVAT_READINESS.md), [`SECURITY.md`](SECURITY.md).
- **Integration catalog** — Written as data: provider domains, canonical entities, freshness and sync classes, and what no connector ingests by default; catalog.test.ts holds it to the SQL constraints. docs/UNIVERSITY_CONNECTIONS.md is the human record of what is actually connected. Read next: [`docs/UNIVERSITY_CONNECTIONS.md`](docs/UNIVERSITY_CONNECTIONS.md), [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](docs/INTEGRATION-OPERATOR-RUNBOOK.md).
- **Data inventory and lineage** — The inventory: every store and the clock that runs on it. Lineage — which client holds which field of the contract — is docs/data-contract.md, and who decides what a field means is DATA-STEWARDSHIP.md. Read next: [`docs/data-contract.md`](docs/data-contract.md), [`docs/operating-model/DATA-STEWARDSHIP.md`](docs/operating-model/DATA-STEWARDSHIP.md), [`docs/SUBPROCESSORS.md`](docs/SUBPROCESSORS.md).
- **Customer implementation method** — The lifecycle from directory listing to production tenant, held by app/src/lib/governance/rollout.ts. PILOT_PLAYBOOK.md is how a pilot is run once signed. Read next: [`docs/market-readiness/PILOT_PLAYBOOK.md`](docs/market-readiness/PILOT_PLAYBOOK.md), [`docs/90-DAY-LAUNCH-PROGRAM.md`](docs/90-DAY-LAUNCH-PROGRAM.md).
- **Support/runbook library** — An index, written for this register: the runbooks were real and scattered. app/src/lib/runbooklinks.test.ts holds every link in the operational set to a file that exists. Read next: [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](docs/market-readiness/SUPPORT_PLAYBOOK.md).
- **Commercial catalog** — Pricing governance and the deal desk, not a price list. The four packages are named in docs/LAUNCH-DECISIONS.md step 3 and the student plans in app/src/lib/plans.ts; no institutional price exists, and D-009 keeps billing out of the app for now. Read next: [`app/src/lib/plans.ts`](app/src/lib/plans.ts), [`docs/LAUNCH-DECISIONS.md`](docs/LAUNCH-DECISIONS.md).
- **Contract templates** — Outlines for counsel, not agreement language: nothing in the repository may be signed. docs/LAUNCH-DECISIONS.md items 4 and 5 say what has to happen first. Read next: [`docs/trust/DPA-CHECKLIST.md`](docs/trust/DPA-CHECKLIST.md), [`docs/legal/TERMS-OF-SERVICE-DRAFT.md`](docs/legal/TERMS-OF-SERVICE-DRAFT.md), [`docs/legal/PRIVACY-POLICY-DRAFT.md`](docs/legal/PRIVACY-POLICY-DRAFT.md).
- **Company site map** — The routes are `ROUTES` in app/src/site/render.tsx: 21 content pages and 4 tools, prerendered to static HTML. Every capability a page names is printed from the claims register with its status word.
- **Operations Console map** — *missing.* There is no operations console and no /admin. Staff surfaces are tabs of app/src/screens/University.tsx behind build-time flags, and the operator runbook names functions and tables rather than screens. A map is written once there is a console to map. Read next: [`ops/operations-console/README.md`](ops/operations-console/README.md), [`docs/CURRENT-SEMESTER-ARTIFACT-INVENTORY.md`](docs/CURRENT-SEMESTER-ARTIFACT-INVENTORY.md), [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](docs/INTEGRATION-OPERATOR-RUNBOOK.md).
- **Decision log** — The programme log, numbered D-nnn; DECISIONS.md holds the two long-lived product decisions. Every `decisions` entry on this page resolves to one of them or to an ADR. Read next: [`DECISIONS.md`](DECISIONS.md).
- **Do-not-build register** — Product-level anti-patterns, with the test that holds each. The company-level lines are ops/strategic-boundaries/. Read next: [`ops/strategic-boundaries/README.md`](ops/strategic-boundaries/README.md).
- **Strategic boundaries** — The twelve things Semester will not build, whoever asks, and what holds each.
- **Customer commitment register** — Every promise made to a named customer, with its product dependency and its evidence. Empty until a customer exists, and the test says why.
- **Operations console controls** — The policy the console will read before it exists: segregation of duties, data classification, the context bar and access basis, evidence-freshness escalation, the production rules a browser prototype could not hold, and the five conversion steps. The Operations Console map above stays missing until there is a console to map. Read next: [`docs/operating-model/CHANGE-MANAGEMENT.md`](docs/operating-model/CHANGE-MANAGEMENT.md), [`docs/LAUNCH-WAR-ROOM.md`](docs/LAUNCH-WAR-ROOM.md).
- **Proof calendar** — The schedule for producing the evidence needed to sell: three months, then quarterly, each item naming the artifact it files and the register rows it moves.
- **Launch war room** — The daily board for the final weeks before launch: thirteen items, each with an owner and the document it is read from. Read next: [`docs/LAUNCH-READINESS-COUNCIL.md`](docs/LAUNCH-READINESS-COUNCIL.md).
- **First-year success measures** — What "lead the category" means in the first twelve months, as measures with sources. No target is set here; each is a founder decision recorded in the log. Read next: [`ANALYTICS.md`](ANALYTICS.md).
- **Launch readiness council** — The seats, the gates and `decide()`. Every owner on this page is one of its seats. Read next: [`docs/GO-NO-GO-CHECKLIST.md`](docs/GO-NO-GO-CHECKLIST.md), [`docs/LAUNCH-DECISIONS.md`](docs/LAUNCH-DECISIONS.md).
- **Operating rhythm** — Weekly, monthly, quarterly and annual reviews, each with a written output. The proof calendar’s quarterly items are rows of its quarterly table. Read next: [`docs/operating-model/README.md`](docs/operating-model/README.md).
- **Engineering gates** — The checks every change passes and the baseline figures. CLAUDE.md is the working agreement for agents; the pull-request template is what a reviewer sees. Read next: [`CLAUDE.md`](CLAUDE.md), [`.github/pull_request_template.md`](.github/pull_request_template.md).
- **Product analytics** — Three marks and nothing else; a fourth is a decision. Every first-year measure that needs a new mark lands the way D-005 says. Read next: [`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`](docs/PRODUCT-ANALYTICS-DATA-ETHICS.md).
- **Subprocessor register** — Every third party that touches data, and what it sees. The quarterly vendor review on the proof calendar reads it.
- **Strategic expansion register** — Rendered from app/src/lib/expansionregister.ts: the phased expansion, each phase gated. The plan of record says what is built next; this says what may be entered at all. Read next: [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md).
- **Supply-chain policy** — Rendered from app/src/lib/supplychain.ts and the lockfiles; the test fails on a licence or Action nobody has named, and every deploy carries an SBOM.
- **Security policy** — How a report is handled and what is disclosed; app/src/lib/security.test.ts holds it to the variables the Edge Functions read. Read next: [`SECRETS.md`](SECRETS.md), [`docs/trust/SECURITY-WHITEPAPER.md`](docs/trust/SECURITY-WHITEPAPER.md).

## What every controlled document displays

Each authoritative document above carries this line near its top, with the
link made relative to where it sits, and the test refuses one that does not:

```markdown
> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).
```

The values are not copied into the documents. A control block pasted into
thirty pages is thirty chances to drift; the line points here instead, and
here is held to the tree.

## The rule on scope

> No new module launches unless it replaces, improves, or connects an existing student or institution workflow with measurable value.

For every addition, before it is built, in the pull request that proposes it
(the questions are in [`.github/pull_request_template.md`](.github/pull_request_template.md),
and the portfolio council’s intake in
[`docs/operating-model/PORTFOLIO-GOVERNANCE.md`](docs/operating-model/PORTFOLIO-GOVERNANCE.md) asks the same):

1. What does this replace?
2. What student decision does it clarify?
3. What institution decision does it improve?
4. What data does it require?
5. Who owns it?
6. How is it supported?
7. How is it tested?
8. How does it fail?
9. How is it removed if it does not work?

The largest risk is not a lack of ambition. It is trying to operationalize
every good idea at once. The registers this page links are the discipline:
[`ops/strategic-boundaries/`](ops/strategic-boundaries/README.md) says what
is never built, [`ops/customer-commitments/`](ops/customer-commitments/README.md)
what has been promised, [`docs/PROOF-CALENDAR.md`](docs/PROOF-CALENDAR.md)
when the evidence is produced, [`docs/LAUNCH-WAR-ROOM.md`](docs/LAUNCH-WAR-ROOM.md)
who reports what each day before launch, and
[`docs/FIRST-YEAR-SUCCESS.md`](docs/FIRST-YEAR-SUCCESS.md) what success means.

## How this page is held

`app/src/lib/ops/operatingsystem.test.ts` fails when a cited file is missing
or archived, when a category calls itself missing while naming a path (or
the reverse), when a decision is not in the log, when a superseded document
carries no redirect, when an authoritative document does not display the
control line, when the scope questions are not in the pull-request template,
or when this page is stale. `npm run registers` from `app/` rewrites it.
