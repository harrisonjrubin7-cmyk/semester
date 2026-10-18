# Semester target architecture — CTO pack

Status: **proposed**, written 2026-10-04 against `origin/main` `7287ddc`.
Author role: Chief Technology Officer (acting). Nothing here is accepted until
its ADR is; see [03](03-TECHNOLOGY-DECISIONS.md) and [08 §5](08-ORGANIZATION-AND-MILESTONES.md).

Input: the external rebuild audit and prompt ("rebuild Semester the right way:
every capability native from inception, connected when available, governed
everywhere, operationally supported") plus a read-only survey of this
repository. Where the audit and the repository disagree, this pack says so.

## The answer in ten lines

1. **Modular monolith with enforced seams** (`services/core`), plus three
   separate deployables from day one: `ai-gateway`, `integration-hub`,
   `sync-gateway`. Extraction is triggered by written criteria, not taste.
2. **Spine first.** The policy decision point, event envelope/outbox and
   workflow machines already exist as libraries (ADRs 0007–0010) but cover
   3 policy actions and 0 outbox producers. Making them universal is wave 1.
3. **Postgres 17 stays the system of record**: pooled with `tenant_id` +
   RLS **and `FORCE`** (not present today), silo for enterprise ring.
4. **Native first is a build failure**, not a slogan: CI runs every journey with
   all adapters failing ([07 §9](07-ENGINEERING-STANDARDS.md)).
5. **Offline**: encrypted local store behind a port; CRDT only for authored
   text; server-authoritative commands for anything institutional.
6. **Mobile**: Capacitor shells first, behind a 30-day go/no-go spike; domain
   logic extracted so a native swap is not a rewrite.
7. **Rings**: tenant-level rings 0–4 over the existing activation control
   plane, with automatic canary analysis and a monthly-drilled kill switch.
8. **Conversion is a strangler**, not a rewrite: ~620 k lines and 1,219 test
   files are the specification of what must survive
   ([09](09-CONVERSION-PLAN.md)).
9. **People first**: one human holds every key today; the first two hires retire
   that risk before any new surface area ([08](08-ORGANIZATION-AND-MILESTONES.md)).
10. **No claim outruns evidence**: legal conclusions go to qualified counsel,
    "replacement" is claimed only after a parallel run and human approval.

## Contents

| Doc | Deliverable requested |
| --- | --- |
| [01 Target architecture](01-TARGET-ARCHITECTURE.md) | #1 diagrams: context, containers, request path, policy, data, events, integrations, AI, observability, operations; NFR targets |
| [02 Monorepo structure](02-MONOREPO-STRUCTURE.md) | #2 apps / services / packages / infrastructure / contracts / docs; boundary rules; CODEOWNERS; tooling templates |
| [03 Technology decisions](03-TECHNOLOGY-DECISIONS.md) | #3 criteria, alternatives, risks, 14 proposed ADRs |
| [04 Domain boundaries & ownership](04-DOMAIN-BOUNDARIES-AND-OWNERSHIP.md) | #4 module map, dependency DAG, extraction order, ownership roles, data control matrix |
| [05 Environments & rollout](05-ENVIRONMENTS-AND-ROLLOUT.md) | #5 local → preview → integration → staging → production, canary, tenant rings, promotion gates |
| [06 Delivery & operations](06-DELIVERY-AND-OPERATIONS.md) | #6 CI/CD, release, rollback, migrations, secrets, backup/DR, offline sync protocol, observability, on-call |
| [07 Engineering standards](07-ENGINEERING-STANDARDS.md) | #7 API contracts, events, idempotency, correlation, flags, ownership, dependencies, testing |
| [08 Organization & milestones](08-ORGANIZATION-AND-MILESTONES.md) | #8 team topology, staffing, milestones M0–M7, review process, tech debt |
| [09 Conversion plan](09-CONVERSION-PLAN.md) | #9 mapping of every existing area, waves C0–C7, data migrations, parity gate, first 10 PRs |

## How this relates to what already exists

This pack **indexes and extends**; it does not restate. Controlling documents
remain: [`PLATFORM-CONSTITUTION.md`](../PLATFORM-CONSTITUTION.md),
[`ARCHITECTURE.md`](../ARCHITECTURE.md), ADRs
[0001–0010](../architecture/README.md), [`DO-NOT-BUILD.md`](../DO-NOT-BUILD.md),
[`UNIVERSITY-OS-ARCHITECTURE.md`](../UNIVERSITY-OS-ARCHITECTURE.md),
[`engineering-operations/`](../engineering-operations/),
`ROLLBACK.md`, `RESTORE.md`, `SECRETS.md`, `SECURITY.md`.

Two deliberate tensions with accepted records, stated rather than hidden:

- **ADR 0003 ("no application server") and constitution §45 ("no
  microservices")** — this pack proposes one container-hosted `core` and three
  workers. That is the test ADR 0003 said Phases 6–15 would be; it does **not**
  propose microservices. Accepting P-02 supersedes 0003's *scope*, not its
  spirit, and must be recorded as its own decision.
- **The audit's information architecture** (Today / Plan / Learn / Create /
  Campus / Path / Money / Support / Assistant / Account) versus
  `DO-NOT-BUILD.md` rule 1 (seven roots: `home, courses, study, calendar,
  support, mine, me`, test-enforced). Architecture does not depend on either;
  this is a portfolio decision (Q1).

## Open questions that need a person, not an engineer

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| Q1 | Keep the seven-root navigation, or adopt the audit's ten-area IA? | Product / portfolio governance | design-system and `apps/*` shape (not the platform) |
| Q2 | Cloud, region and data-residency posture (P-12); first customer's constraints | CEO + counsel | wave C2 hosting choice; ring 1 |
| Q3 | Funding and start date for S1 hires; who is the second operator? | CEO/CFO | M0 timeline, ring 1 |
| Q4 | Buy vs build for enterprise SSO/SCIM (P-05) | CTO + first institution | first SSO onboarding |
| Q5 | Is GitHub Pages acceptable as production hosting for institutional use, or does the SPA move behind the target CDN? | CTO + counsel | C2 |
| Q6 | Which counsel approves contracts, DPAs, minors/guardian policy, accessibility claims? | CEO | ring 1 (external commitments) |

## What was and was not verified

- **Verified (read from the repository):** layout, sizes, workflow names,
  function names, ADR contents, the three `POLICY_ACTIONS`, the event
  envelope, scripts, CODEOWNERS, the DO-NOT-BUILD rules, the decision-numbering
  convention. Counts such as tables/policies are **static greps of the
  migration history**, not live-database counts.
- **Not verified:** any production metric (there is no production tenant data
  in the repository); vendor pricing; cloud service limits; the proposed SLO
  numbers; whether the configuration templates in [02 §6](02-MONOREPO-STRUCTURE.md)
  run unmodified (they are templates for wave C0 PR 1).
- **Not decided here:** legal conclusions (FERPA applicability, minors,
  cross-border transfer, accessibility conformance claims, marketplace
  consumer-protection and tax) — these require qualified human counsel and are
  routed to `LEGAL-REVIEW-QUEUE.md`.
