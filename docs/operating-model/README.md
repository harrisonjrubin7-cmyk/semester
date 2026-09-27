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
| — | Change management and adoption | [CHANGE-MANAGEMENT.md](CHANGE-MANAGEMENT.md) | Process |
| — | AI financial sustainability, ROI measurement | [COMMERCIAL-GOVERNANCE.md](COMMERCIAL-GOVERNANCE.md#ai-cost-controls) | Existing metered gateway (ADR 0004) |

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
