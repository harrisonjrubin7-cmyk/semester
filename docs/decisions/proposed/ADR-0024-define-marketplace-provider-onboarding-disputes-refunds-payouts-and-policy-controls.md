# ADR-0024 · The marketplace opens only through a gated, class-limited design in which a licensed processor holds funds and fees never buy ranking

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Marketplace owner (unassigned; G-OWN not met) with a trust-and-safety lead (unassigned) |
| Deciders / reviewers | Founder; trust-and-safety lead; finance owner; counsel for marketplace role, provider terms, refunds, disputes, payouts, tax, sanctions and minors (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | No phase before the four D-1236 gates (G-OWN, G-DATA, G-TERMS, G-QUEUE) |
| Related | `docs/decisions/D-1236.md`; [`docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md`](../../commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md) §12; `docs/legal-drafts/MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md`; `docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md`; `docs/legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md`; ADR-0016, ADR-0017, ADR-0019, ADR-0020; legal rows Q-11, Q-12, Q-13, Q-15, Q-20, Q-21, Q-23 |
| Supersedes / superseded by | — (does not alter D-1236) |

> **Counsel required.** Facilitator vs agent vs seller characterisation, consumer protection, sanctions, money transmission and custody, refunds and chargebacks, tax, provider agreements, employer data sharing, minors, restricted material and moderation staffing: `LEGAL_REVIEW_QUEUE.md` Q-11, Q-12, Q-13, Q-15, Q-20, Q-21, Q-23. D-1236 states the funds-held structure's regulatory effect "is a question for counsel ... and is not answered here"; this ADR does not answer it either.

## Context
- Decided 2026-10-04 (`docs/decisions/D-1236.md`): marketplace, payments, payouts and provider access stay held until G-OWN, G-DATA, G-TERMS, G-QUEUE are met by evidence a named person verified; no paid ranking; five risk classes (A information, B tools and integrations, C transactional services, D opportunities, E held and restricted) with class E prohibited; a licensed processor holds the funds before any student pays (phase M4). Not decided: counsel and backup owners for the marketplace; the test the no-paid-ranking boundary needs; the held-boundary entry.
- Gates today: "none is met" on 4 Oct 2026; only the company-side owner is named (`MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md:492` G-OWN row; capability register `marketplace` `BLOCKED`, `docs/market-readiness/CAPABILITY-STATUS-REGISTRY.json`).
- Implementation: no marketplace tables, no payments, no take rate decided (`commercial/READINESS_GAP_MATRIX.md` Marketplace row `DOCUMENTED-UNIMPLEMENTED`). Take rate: 15% in `docs/finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`, a 12% illustration at `MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md:357`, D-1236 line 46 "not decided"; the program target is 12% (ADR-0016).
- Reusable pieces: individual billing via Stripe functions (`billing-checkout`, `billing-webhook`, `supabase/functions/_shared/billingwebhook.ts:107-108`), `apply_payment_event` idempotency, `run_dunning` (service-only), seven-year financial retention, hash-chained ledgers (`ledger-chains.check.sql`), moderation (`moderation-audit.check.sql`, `reports.check.sql`), `support_access_grant`.
- Sponsorship slot exists separately in `app/src/lib/gtm/sponsor.ts` and is "never a ranking input" per D-1236.
- Moderation capability `community:review` is platform-scoped (`20260928032000_community.sql`); no staffed review queue (G-QUEUE).
- Related drafts: refund/cancellation draft has `[DECIDE]` lines; 0 of 13 policy drafts in force (`LEGAL_REVIEW_QUEUE.md` §1).
- AI providers that would receive student data are class E (D-1236), tying to ADR-0014.

## Problem
Given the held state, what controls (onboarding evidence, class limits, dispute and refund flow, payout flow, policy enforcement, take-rate record) must exist as code and tests before the first listing opens, without choosing the commercial terms or answering the legal questions?

## Decision drivers
1. Every D-1236 gate is evidenced by a named person before anything opens.
2. Semester never custodies funds.
3. Ranking is provably invariant to fee, tier and sponsor status.
4. Provider onboarding, dispute and payout state machines are append-only and audited.
5. Class E and under-18 exclusions are enforced in schema, not only terms.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Directory only (Class A listings, no payments) first | Lowest risk; matches phase M1 | No revenue; still needs owners and review queue | **Recommended** first step |
| B. Build checkout and payouts now on Stripe Connect-style processor | Revenue sooner | Violates the held gates; counsel unanswered | Not chosen |
| C. Partner-referral links with off-platform payment | No custody | Weak control over quality and refunds; disclosure duties | Candidate for Class D with counsel |
| D. Not build a marketplace | No exposure | Abandons strategy | Owner's call |

## Decision
**Recommended, unratified.** (1) Sequence follows the strategy page: M1 directory of Class A listings for one campus unit after G-OWN, G-DATA, G-TERMS, G-QUEUE. (2) G-DATA means marketplace tables with RLS, history and a kill switch, a `listing_class` constraint that refuses class E and an under-18 audience, and a provider-onboarding state machine (applied, evidence submitted, reviewed by a person other than the submitter, approved, suspended, removed) with every transition audited. (3) Ranking: a test proves ordering is invariant to fee, tier and sponsor status (the test D-1236 says is owed). (4) Disputes and refunds: a dispute record references the order, evidence and a decision by a trust-and-safety reviewer; refund amounts and clocks come from approved terms (counsel required); the processor performs reversals; Semester records receipts. (5) Payouts: made only by the licensed processor; Semester stores payout references, never balances, until counsel confirms otherwise. (6) Policy controls: take rate, refund window and payout timing are rows in the price book (ADR-0016) with an approver, not constants; the 12% vs 15% conflict is resolved by an owner record, not by this ADR. (7) Marketplace kill switch reaches all listing, order and payout paths. Not ratified.

## Consequences
Positive: no commercial surface opens without evidence; the ranking boundary becomes a failing test. Negative: revenue deferred; G-OWN needs hires or contractors; staffed review queue cost. Harder: sponsored placement.

## Impact
- **Data / tenancy:** marketplace data tenant-scoped by campus unit; provider data is third-party personal data (counsel).
- **Security:** provider access held until reviewed; payment webhooks use signature plus idempotency (existing pattern).
- **Privacy:** provider and student data flows, employer sharing (Q-15), minors excluded; retention under ADR-0017.
- **Accessibility:** listing and checkout flows would need accessibility evidence; not assessed.
- **Operations (SLO, alert, runbook, support):** staffed review and dispute queue with backup (G-QUEUE); support access per ADR-0020; incident path per ADR-0018.
- **Cost / commercial:** take rate unsettled; processor fees; chargeback exposure (counsel/accountant).

## Implementation
1. Name owners and counsel (G-OWN, Q-00). 2. Draft marketplace schema with RLS, `listing_class` check, history and kill switch (new migrations). 3. Add the ranking-invariance test. 4. Provider onboarding state machine and audit. 5. Record a take-rate decision `D-<pr>`. 6. Staffed queue and runbook. 7. Only then design M2 with real tenants.

## Tests and verification
- `app/src/lib/gtm/ranking.invariance.test.ts` (proposed): same listing at fee 0 and fee 15%, tier A and B, sponsored and not: order unchanged; fails against a ranker that adds a fee term (prove red by adding one). Control: relevance change reorders.
- `supabase/marketplace.check.sql` (proposed): insert class E listing refused; under-18 audience refused; self-approval of provider refused.
- Dispute test: refund recorded without processor receipt stays `pending`.
- Kill-switch test: engaged switch refuses listing publish and payout reference creation.

## Fitness functions
- `tenant-boundaries` (#5): marketplace tables in the negative suite.
- `rls-coverage` (#3): new tables RLS-enabled.
- `audit-outbox` (#8): onboarding, dispute, refund, payout events audited.
- `public-claims-evidence` (#12): no marketplace claim while `BLOCKED`.
- `definer` (#4): payout and refund definers service-only.

## Rollback / reversal
Held state is the default and is restored by the kill switch. After money moves through a processor, refunds and tax records are not reversible by this system (counsel required).

## Open questions
Counsel and backup owners; marketplace role characterisation; take rate; which processor and whether it covers the intended payout model; Class D opportunities handling; sanctions screening.

## Addenda
None.
