# ADR-0006 · Modules run in Connect mode by default and become Core, per school and per module, only through a two-person switch with a kill switch behind it

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Product owner (module scope) with platform architect |
| Deciders / reviewers | Founder; security owner; counsel for any module that holds institutional records |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (define eligibility); Phase 2 (first Core module) |
| Related | `supabase/migrations/20260930010000_module_mode.sql`; `supabase/module_mode.check.sql`; `app/src/lib/modulemode.test.ts`; `docs/architecture/0011-modular-monolith-before-services.md`; `docs/architecture/0012-legacy-only-through-anti-corruption-layers.md`; D-151; D-1236; `findings-commercial.md` #14; ADR-0007, ADR-0010, ADR-0011, ADR-0012 |
| Supersedes / superseded by | — |

## Context
- D-151 (cited in `20260930010000_module_mode.sql` header): Semester runs beside a school's systems (Connect, the default) and takes a module over only when the school switches it to Core. The migration builds the switch, not a module.
- What the database refuses (same header): a module with no row reads Connect; Core on one person's say; Core while `kill.core_modules` is engaged for the school or globally; a second pending request; an approval after seven days; any edit or deletion of history. Approval needs two other holders of `tenant:configure`, never the requester.
- The kill key list includes `kill.integration_sync`, `kill.ai_generation`, `kill.data_upload`, `kill.code_execution`, `kill.sharing`, `kill.writeback`, `kill.core_modules` (`20260930010000_module_mode.sql:46-47`).
- The only AI-side reference to module is `module_mode.sql:46` listing `kill.ai_generation`; the AI policy has no module dimension (`ai-policy-enforcement-map.md` §3).
- `docs/architecture/0011` fixes the shape: one deployable, bounded domains, extraction only on a stated trigger. `0012`: new code reaches legacy only through adapters.
- Commercial: entitlement resolver is shadow-only and enforces nothing (`docs/ENTITLEMENT-RESOLUTION.md` status line); the site refuses "replace" claims (`company-site/index.html:515-520`) and states no customers (`index.html:445`); marketplace held by D-1236.
- Gateway and registry state: integration adapter registry "holds mocks only" (`definerregister.ts` BRIEF A06); gateway not evidenced as deployed (`findings-database.md` #7).

## Problem
What does "native-first" mean for the product's module strategy, and under what conditions may Semester become a school's system of record for a module?

## Decision drivers
1. A school's existing systems stay authoritative until the school, by a two-person act, says otherwise.
2. Core for a module needs the controls of ADR-0007 (audit), ADR-0010 (dual control) and ADR-0012 (staged release) first.
3. No public claim of replacement or readiness (`CLAUDE.md`; `claims.ts`).

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Adapter-only forever (never Core) | No system-of-record liability | Cannot serve a school without an SIS/LMS for a module | Rejected as a ceiling, kept as default |
| B. Core by default at pilot school | Simpler product | Contradicts D-151; no audit/outbox for most modules (`findings-database.md` #9, #10) | Rejected |
| C. Connect default; per-module Core by dual approval; "native-first" = each new module is designed with a Semester-native model that Connect reflects and Core can own | Matches shipped switch; fits `0011` bounded domains | Native model effort per module | Chosen |
| D. Per-school fork of the app | Isolation | Unmaintainable for one operator | Rejected |

## Decision
**Recommended, unratified; no agent can accept it. "Native-first" here is this ADR's interpretation of the program term; the owner should confirm it.**
1. Connect remains the default; a module with no row is Connect (as today).
2. A module is **eligible** for Core only when it has: a native domain model under `domains/` with an anti-corruption adapter per `0012`; tenant-keyed RLS tests (ADR-0002); audit and outbox for its sensitive mutations (ADR-0007); a dual-control rule for its high-risk acts (ADR-0010); a kill-switch row and a release gate (ADR-0012); a rollback note.
3. The Core switch keeps the existing two-approver rule; eligibility is checked at request time, not only documented.
4. Connect never writes back to a school system unless `kill.writeback` is clear and the write is on the approved class list (ADR-0011).
5. Entitlement (plan) does not substitute for mode: a paid plan never switches a module to Core.

## Consequences
Positive: no module silently becomes a record of authority. Negative: slower first Core module. Harder: selling "replacement"; the site correctly refuses it.

## Impact
- **Data / tenancy:** Core data is tenant-scoped records with retention and export duties (counsel).
- **Security:** `kill.core_modules` can retreat all schools to Connect.
- **Privacy:** system-of-record status changes the school/vendor role under FERPA-style analysis: a question for counsel, not stated here.
- **Accessibility:** a Core module is in scope of ADR-0013 release blocking.
- **Operations (SLO, alert, runbook, support):** runbook for "switch back to Connect" must be exercised.
- **Cost / commercial:** entitlements and overage metering are not built (`findings-commercial.md` #13, #14).

## Implementation
1. Add an eligibility table `module_core_eligibility` (module, evidence links) read by the request function. 2. Extend `supabase/module_mode.check.sql`. 3. List eligible modules in `docs/` with owner. 4. Do not build a module under this ADR.

## Tests and verification
- Existing: Core with one approver, requester-approves, expired approval, engaged kill switch must each fail (`module_mode.check.sql`; `modulemode.test.ts`).
- New: a Core request for a module with no eligibility row is refused; a module marked eligible with no audit coverage fails `audit-outbox`.
- Control: a school with no rows reads Connect for every module.

## Fitness functions
- `release-evidence` (`scripts/architecture/release-evidence.mjs`): gate asserted with expired or missing evidence.
- `audit-outbox` (`scripts/architecture/audit-outbox.mjs`): Core-eligible module's mutating definer without audit.
- `public-claims-evidence` (`scripts/architecture/public-claims-evidence.mjs`): site or app copy implying replacement without a register row.

## Rollback / reversal
Engage `kill.core_modules`; modules read Connect. Not cheap once a school has authored records only Core holds.

## Open questions
- Which modules, if any, the pilot school would switch (founder/school decision).
- Definition of "native-first" to confirm.

## Addenda
(none)
