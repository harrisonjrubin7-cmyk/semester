# Semester migration factory

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin |
| **Status of the tooling** | Built. **Never run against a real institution** (`docs/migration/README.md`). |

The principle: every integration and replacement domain can be introduced,
reconciled, dual-run, rolled back, exported and only then made authoritative.
"Replace only with proof."

## The factory line

Scope → source inventory → contract → adapter → synthetic rehearsal →
stage → validate → reconcile → exceptions signed → dual run → cutover decision →
rollback readiness → authoritative → exit/export.

| Stage | What exists | What is missing |
| --- | --- | --- |
| Scope and source inventory | `docs/institutional-implementation/MIGRATION-WORKBOOK.md`; ten domain specs and workbooks in `docs/migration/workbooks/`; `scripts/institution-migration.ts` (`init`, `validate`, `queue`, `exception`, `sign`, `signoffs`, `plan`, `verify`) | a real source |
| Contract | `lib/governance/data-contracts.ts` names an external record-holder per domain | institution-signed contracts |
| Adapter | `app/server/integration/registry.ts` `ADAPTERS = []`; `app/server/institution/adapters.ts` `adapters = []`; mocks `mock-sis.ts`, `mock-campus.ts`; LTI 1.3 and the student's own tokens are the only live external paths | **zero real connectors; no live inbound webhook endpoint** (`webhook-ingress.ts` has only its test) |
| Stage / validate | `private.roster_stage/validate/reconcile/promote/rollback` (`20260930220000_roster_import_staging.sql`); `roster-import.check.sql` (98 assertions) | EXECUTE is `service_role` only; **no app code calls it and no screen exists** |
| Reconcile | `integration_reconciliation_runs`, `_discrepancies`; `lib/integration/reconcile.ts`; `integration-quality.check.sql`; Migration Center semantic checks | synthetic data only |
| Dual run | `lib/integration/parallel-run.ts`, `lib/migration/observations.ts`, `rehearsal.ts`; `migration-center.check.sql` refuses cutover until enough distinct periods pass | nothing runs in shadow automatically |
| Cutover and rollback | rehearsal readiness logic (`rollbackExercised`) | no data rollback exercised |
| Export / exit | student exports (CSV, Markdown, ICS, DOCX, PDF, BibTeX/RIS, `export_my_data()` JSON, `semester.backup.v1`); gradebook registrar JSON; `school_offboarding` workflow (98 checks, hosted-preview rehearsal 2026-09-30) | **tenant bulk export, OneRoster, QTI, Common Cartridge: not found**; offboarding export manifest is verified by hash and counts but **no export job generates it and no screen exists** |

## Stale material

- `docs/DATA-MIGRATION-PLAN.md` is about Semester's own device store and
  Postgres schema (`lib/migrate.ts` SCHEMA 6) and says "59 migrations" against
  182 on disk. It is not an institutional migration plan.
- `docs/target-architecture/` is proposed, not accepted; `services/` does not
  exist.

## Readiness by integration class

| Class | Needed for the pilot? | State | Fallback |
| --- | --- | --- | --- |
| SSO (SAML) | no, if invitation-only | mechanism only, no IdP round trip | invitation codes (`public.invites`) |
| SCIM | no | built, tested on synthetic | manual roster |
| Roster / cohort | yes | staging RPCs only | CSV through an operator screen (to build) |
| SIS read (terms, sections, holds) | wanted | no connector | **mark unavailable** on every screen, with a manual term sheet entered by the operator |
| LMS (LTI) | optional | launch built and tested; no real LMS | skip |
| Degree audit | no | mock | student-entered, labelled estimate |
| Bursar / aid | no | mock | out of scope |

For the first pilot the honest path is **manual data with explicit
"unavailable" labels**, not a half-built connector (the brief's step 7 allows
"synced or explicitly marked unavailable").

## Gates for a connector

A connector may move from mock to real only when:

1. a contract names the field set, freshness target and the record-holder;
2. a contract test passes against the real source in a non-production
   environment;
3. mappings are in `docs/migration/workbooks/` and signed by the institution's
   data steward;
4. a reconciliation run with real data has zero unexplained differences, or
   each is a signed exception;
5. the kill switch (`feature_kill_switch`) is exercised for the adapter;
6. a degraded-mode entry exists in `docs/DEGRADED-MODE-MAP.md` and the screen
   shows it;
7. monitoring pages a person on freshness breach.

## Gates for a migration

| Gate | Evidence filed under `docs/evidence/migration/` |
| --- | --- |
| M-1 rehearsal on synthetic | exists as tooling and tests; file one dated run |
| M-2 rehearsal on a copy of real data | none |
| M-3 reconciliation | none |
| M-4 exceptions signed | none |
| M-5 dual run over N distinct periods | none |
| M-6 rollback exercised | none |
| M-7 export of the tenant verified by a second person | none |

## Build order

1. Operator screen over the roster staging RPCs for a synthetic tenant (also
   unblocks pilot step 6).
2. A tenant export job that produces the offboarding manifest the verifier
   already checks.
3. One real inbound path, chosen with the first customer.
4. Update `docs/DATA-MIGRATION-PLAN.md` to say what it covers, and write the
   institutional plan as a separate document.
5. Rehearse M-1 and file it.

## Evidence the factory must produce per institution

Source inventory, signed contract, mapping workbook, staging report, validation
report, reconciliation report, exception register, dual-run observations,
rollback exercise record, export verification. The `institution-migration.ts`
`verify` command is the place these are asserted; it has never been run for a
real tenant.
