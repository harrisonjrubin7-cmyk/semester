# Semester completion definition

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05 |
| **Owner** | Harrison Rubin |

## What "complete" means

Semester has every major domain represented in the architecture and product
roadmap, while the first deployable institutional workflow is complete enough to
be trusted, purchased, implemented, supported, measured and expanded.

The finish line is **not** "every possible university module is complete".

## The five-part rule

Nothing is called **complete** unless all five are present and each is cited:

| Part | Meaning | Not accepted as this part |
| --- | --- | --- |
| **Code** | Source at a path, merged to `main` | A branch, a mockup, a template, a migration that nothing calls |
| **Test** | An automated check that was seen to fail without the code | A test that has never failed; a test that passes against a faithful revert of the bug |
| **Evidence** | A dated artifact under `docs/evidence/` stating its own date and scope | A document saying it works; a register row without a cited file |
| **Owner** | A named seat, with a backup | `UNASSIGNED`; "the team" |
| **Operational support** | A route to a person, a severity, a runbook, a rollback and a monitor | "Support is the founder"; an alert nobody receives |

If any part is missing the honest word is the one from the
[classification list](#classification-vocabulary): implemented but untested,
implemented but not operationally supported, designed only, and so on.

## Seven conditions for "ready"

| # | Condition | Meaning | State 2026-10-05 |
| --- | --- | --- | --- |
| 1 | Product coherence | Every role experiences one connected system | **Not met.** One app with role-filtered language; no role has its own screens. [Audit](SEMESTER_PRODUCT_COHERENCE_AUDIT.md) |
| 2 | Technical truth | Every claimed feature has code, tests, data model, permissions, error state, monitoring, release evidence | **Partly met.** Code and tests are strong; monitoring and release evidence are thin. [Register](SEMESTER_RELEASE_READINESS_REGISTER.md) |
| 3 | Institutional trust | Security, privacy, accessibility, AI governance, data authority and implementation material are evidence-backed | **Not met.** Self-run evidence only; no independent assessment, no ACR, no signed DPA. |
| 4 | Commercial readiness | A narrow pilot can be priced, contracted, delivered, measured, converted, renewed, expanded | **Not met.** No approved price, no counsel, no customer. [Commercial](SEMESTER_COMMERCIAL_READINESS.md) |
| 5 | Operational readiness | Support, incident response, monitoring, releases, tenant rollout, billing, customer success, risk management work | **Not met.** One owner, no on-call, no alert delivery, `main` unprotected. [Support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md) |
| 6 | Migration readiness | Every integration and replacement domain can be introduced, reconciled, dual-run, rolled back, exported and made authoritative | **Not met.** Tooling exists and has never run on a real institution. [Migration](SEMESTER_MIGRATION_FACTORY.md) |
| 7 | Outcome proof | Verified value to students, staff and institutions | **Not met.** Outcome tables and templates exist; no outcome data. |

Seven conditions are the PDF's. None is met today. The second is the closest.

## Completion hierarchy

| Level | Name | Requirement | Today |
| --- | --- | --- | --- |
| 1 | Foundation complete | Identity, tenant isolation, permissions, data authority, audit, classification, retention, secrets, observability, release controls, support, accessibility, documentation | **Partial.** See the [security](SEMESTER_SECURITY_FINISH_LINE.md) table: 9 of 12 systems have tested controls; observability, support and release controls are the weak three. |
| 2 | Daily student OS complete | Identity → Today → Action Center → Calendar → Tasks → Path → Plan → Courses → Notes → Search → AI → Support, every item with source label, authority label, owner, due date or lifecycle state, accessible interaction, mobile behavior, error/empty/loading state, privacy boundary, analytics event, support fallback | **Partial.** Today and Action Center are the default surface. Source labels reach about 25 of 96 screens; analytics is three marks; per-screen error and empty handling is uneven. |
| 3 | Pilot workflow complete | The 18-step loop runs for a named institution | **Not met.** [Step map](SEMESTER_PILOT_DELIVERY_FACTORY.md). |
| 4 | Institution OS complete | Tenant config, SSO, roles, courses, policies, Course Studio, advising, registration readiness, integrations, communications, analytics, governance, trust | **Not met.** Built as preview tabs behind flags and grants; faculty-side operations are sandbox. |
| 5 | Domain replacement complete | A domain passes all applicable gates | **0 of 14 domains.** [Gates](SEMESTER_DOMAIN_AUTHORITY_GATES.md). |

Level 3 is the first finish line that matters commercially. It is the target of
the [90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md). Levels 4 and 5 are the
12-month and later direction.

## Classification vocabulary

Every capability in the [register](SEMESTER_RELEASE_READINESS_REGISTER.md)
carries one **primary class** and may carry **qualifiers**. The primary class is
the strongest honest statement.

| Class | Meaning |
| --- | --- |
| `verified` | Implemented and verified: code, test seen to fail without it, dated evidence |
| `untested` | Implemented but untested |
| `unsafe` | Implemented but unsafe: a known defect |
| `inaccessible` | Implemented but inaccessible: a known accessibility defect |
| `not-tenant-safe` | Implemented but not tenant-safe |
| `unsupported` | Implemented but not operationally supported |
| `integrated-only` | Integrated only: another product does the work |
| `mock` | Mock or demo only |
| `documented` | Documented only |
| `designed` | Designed only |
| `planned` | Planned |
| `duplicate` | Duplicate of another surface or model |
| `stale` | Stale: the document or row contradicts the code |
| `blocked` | Blocked on something outside the code |
| `deprecated` | Deprecated |
| `decision` | Requires a decision |
| `migration` | Requires migration |
| `customer-evidence` | Requires customer evidence |
| `ready-pilot` | Ready for pilot |
| `ready-production` | Ready for production |
| `ready-authoritative` | Ready to become authoritative |

Release status values: `not-released`, `flag-off`, `preview`, `pilot-ready`,
`production-ready`, `authoritative`.

## Promotion rules

- A row may be `pilot-ready` only with a cited evidence file and a named owner.
- A row may be `production-ready` or `authoritative` only with, in addition: a
  passing tenant-isolation check, an accessibility record, a security review, a
  privacy and retention review, a monitor and an SLO, a support path, a
  rollback, and a customer-facing claim review with a review date. The
  [evidence register](SEMESTER_EVIDENCE_REGISTER.md) states the guard that
  refuses a row that lacks these.
- A domain may be `authoritative` only when **every applicable** gate in the
  [domain gates](SEMESTER_DOMAIN_AUTHORITY_GATES.md) passes. "Not applicable" is
  a recorded decision with a reason, not a blank.
- A UI that exists never promotes anything.

## The thirteen questions

Every feature, domain, customer commitment and replacement claim must answer
these. A row in the register that cannot answer one is not above `designed`.

What is it? Who owns it? Who can use it? What data does it use? What source is
authoritative? What policy governs it? How is it tested? How is it monitored?
How is it supported? How is it secured? How is it made accessible? How is it
rolled back? How is success measured? What evidence proves it is ready?
