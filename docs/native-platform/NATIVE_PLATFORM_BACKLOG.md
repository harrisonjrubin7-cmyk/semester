# Native platform backlog

**As of** 2026-10-05 · **Order** dependency order. Item *n* is unsafe to start while a blocker it names is open.

Nothing here authorises a production migration, a deploy, a billing change, or a public claim. Each implementation item is one branch, reviewed, with the gates in [NATIVE_EXECUTION_ROADMAP.md](NATIVE_EXECUTION_ROADMAP.md).

## First 25 tasks

| # | Task | Depends on | Done when |
| ---: | --- | --- | --- |
| 1 | Keep this reconciliation current when `origin/main` moves a domain | — | The row that changed cites the commit. This folder does not fork `docs/master` cards |
| 2 | Diff local `supabase/migrations` against `schema_migrations` on `lzrqvlugnawcgywkhqlz` by version, not just count | 1 | A written match or a named drift. No `db push` |
| 3 | Read anon RLS policies on the 32 GraphQL-exposed tables and record allow or deny | 1 | Done in `FOUNDATION_EXPOSURE_READING.md`. Owner-scoped tables deny anon. Public catalog, entitlements, open forms, and the school list allow reads |
| 4 | Classify the 207 definer functions: student, staff, operator, or revoke | 1 | Done. Live names match `definerregister.ts` (207, same MD5). No definer was revoked. Anon table DML is a separate change: D-1306 is in the repo and was not pushed |
| 5 | Re-test F-01 and either fix school isolation or record a compensating control | 4 | Done as a control, not a flip. 0 schools. `nativefoundation.test.ts` holds the default-false acknowledgement gate |
| 6 | Confirm Semester2 (`kpuulmnicidgdmwgfngv`) table set versus `semester` | 2 | Done. 19 public tables, 2 private tables with RLS off and no client grants. Not this repo's schema |
| 7 | Put source, authority, and freshness on Today, registration readiness, degree, and account | 5 | Done. `gradeSource` returns `sample` for a seeded grade, including when a caller also claims an institutional read. `PilotFactMark` is on Today, registration (off), degree, and account. A seeded grade renders “Sample” and “Update time not recorded”, never “Institution verified” |
| 8 | Registration readiness copy and empty states: unavailable hold, unavailable window, handoff link | 7 | Done for the off gate, which is every school today. Window, hold, and section each say unavailable. The plan button still hands off to `yes`. Enrolment copy stays with the school’s system. Not a live SIS read |
| 9 | Prove `registration_enroll` refuses a closed window, a hold, and a failed prerequisite | 4, 8 | Done. Already in `blocker` and in `registration_transaction.check.sql`. Removing the three returns failed 9 tests in `enrollment.test.ts`, including the order ladder from `706feed4`. `service.ts` restored |
| 10 | Attach approval and audit to `gradebook_release` and `registrar_decide` | 4 | A release without the capability and the approval does not write |
| 11 | State in the gradebook UI that the LMS is the record | 10 | Copy test. No "official transcript" string |
| 12 | One AI gateway predicate: identity, tenant, classification, consent, allowed tools | 5 | A test call without consent returns a refusal, not a completion |
| 13 | Citation and uncertainty on `ask` for registration and grade questions | 12 | The answer names its source and says it is not an enrolment or a grade |
| 14 | Support handoff from readiness and from the gradebook | 8 | Done. `ticketFromAsk` sends a category and only ticked app-context keys. Registration-off and the gradebook (off, and a student's released grades) note a fixed origin and open Help. A score, hold, section, seat count, or student id on the caller does not appear in the ticket (`supporthandoff.test.ts`) |
| 15 | Family grant: scope, expiry, revoke, audit, and a test that a revoked grant cannot read | 3, 5 | Unsafe flag stays off until privacy review |
| 16 | Projection consumer for `domain_outbox_events` with a watermark | 10 | A test event updates one read model and a dead letter stays dead |
| 17 | Console: tenant list and tenant 360 as a read model, capability-gated | 16 | No generic CRUD browser. No service-role key in the client |
| 18 | Incident: severity, commander, and a notice, or an honest "not staffed" state | 17 | Cannot show a green status with nobody assigned |
| 19 | Design pass on the six pilot screens using existing tokens and unity components | 7 | `design-system:check` clean. No new default palette. D-1293 stands |
| 20 | Accessibility pass on those six screens: keyboard, names, 320px, reduced motion | 19 | Existing a11y tests extended. Still no conformance claim |
| 21 | Kill switch and module flag for readiness, gradebook, family, community, dining | 5 | Held already: every flag in `flags.ts` defaults off (`flags.test.ts`). Dining and registration writeback are high-risk flags. No second flag set was added |
| 22 | Dual-run plan for one section: SIS enrols, Semester records a shadow receipt | 9, 21 | Done as a sandbox. `REGISTRATION_DUAL_RUN.md`, `shadowReceipt`, `node scripts/registration-shadow-receipt.mjs`. Authority stays the SIS. `wroteSeat` is false. No cutover |
| 23 | Advisor caseload only after a consent share exists for that student | 15 | No caseload query without a grant |
| 24 | Course assignment builder only after gradebook authority is explicit | 11 | An item is a graded item, not an official assignment, until the gate |
| 25 | Partner marketplace schema | 4, 21, and the D-1236 gates | Not started. This task is a hold, not a build |

## Explicitly later

Campus maintenance, alumni transition, employer verification, aid decisions, transcript issuance, revenue-share billing, regional residency, and board reporting. They are real PDF scope. They sit behind the blockers above.

## Owners

Seats, not named people: security (3–6), product (7–8, 19), registrar steward when one exists (9–11, 22), AI governance (12–13), privacy (14–15), platform (16–18, 21), accessibility (20). Unsigned seats stay unsigned in the doc. Do not invent staff.
