# Parallel-run evidence

> **Type:** explanation · **Audience:** institution-admins, implementers · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page explains what evidence the repository requires before anyone may describe Semester as taking over a job from an existing system, and what the Migration Center records; stop reading if you only want Semester to run beside your systems, which needs none of it.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The Migration Center (dry run, parallel run, cutover, rollback, archive) is built, tested and off by default, and has never been used on a real migration. No domain has been run in parallel for any institution.

<!-- status: Migration Center (dry run, parallel run, cutover, rollback, archive) = IMPLEMENTED_NOT_RELEASED -->
<!-- capabilities: migration:manage, migration:approve, migration:view -->
<!-- roles: implementation_manager, integration_admin, registrar, university_admin, dean, institutional_researcher -->
<!-- labels: app/src/screens/University.tsx :: Migration -->
<!-- labels: app/src/lib/migration/center.ts :: Source inventory, Data classification, Field mapping, Cleaning rules, Transformation preview, Sample import, Validation, Reconciliation, Parallel run, Cutover, Legacy archive and export, Post-cutover monitoring -->
<!-- stages: inventory, classification, mapping, cleaning, preview, sample_import, validation, reconciliation, parallel_run, cutover, archive, monitoring -->
<!-- claim: CLM-006 PROHIBITED -->

## The wording rule

The public claims register rejects the claim that Semester takes over from your learning system, gradebook, student information system or registrar (CLM-006, PROHIBITED, in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)). The permitted position is that Semester works beside your existing systems in a bounded pilot (CLM-004, conditional). In this repository and in anything you write about Semester:

- Say "beside" or "alongside". Do not say Semester stands in for an official system.
- Official grade writes and system-of-record operations are high-risk activation. A flag or an entitlement is not enough.
- The official-system fallback stays until Semester has earned the authority, and it stays through the parallel run.

The activation ladder in [`ACTIVATION-CONTROL-PLANE.md`](../../ACTIVATION-CONTROL-PLANE.md) puts a parallel run at level L6 ("operates beside the authoritative system and reconciles outcomes") and a bounded system of record at L7. Both come after L5, one tenant with a current contract and accountable approvals. The register says "No tenant is activated by this register."

## What the Migration Center records

Twelve stages, in order. A stage may be left only when its gate is met, and evidence counts only if it was recorded in the current stage.

| Stage | What it asks for before the next one |
| --- | --- |
| `Source inventory` | The retiring system's name, its version and the person who owns its data |
| `Data classification` | Classifications, a retention statement and where history stops |
| `Field mapping` | A field map with at least one key field |
| `Cleaning rules` | A duplicate rule |
| `Transformation preview` | A preview run over a sample file |
| `Sample import` | A recorded run over a full sample export, with counts |
| `Validation` | A full-export run where every row maps and none fail |
| `Reconciliation` | A comparison with what Semester holds where nothing is missing, extra or differing |
| `Parallel run` | At least the required number of distinct passing periods, and the latest run passing |
| `Cutover` | A cutover date, a written rollback plan and an approval from each required area |
| `Legacy archive and export` | Where the legacy data was archived and exported to |
| `Post-cutover monitoring` | Each check recorded; this is the last stage |

The number of required parallel-run periods is set per migration. It defaults to 2 and the database accepts 1 to 52. A period counts once, by label, when the run passes. A run passes only when it had rows and recorded no missing, extra or differing records.

A migration may go back to an earlier stage until cutover has happened. Field maps change only up to the cleaning stage, because later evidence depends on them. Eleven domains can be migrated: LMS, registration, degree audit, advising, student accounts, housing, career, campus events, communications, catalog and other.

## What this evidence is not

- The counts are an attributed claim by the migration lead about an export read in their browser. The database cannot re-run them.
- Nothing runs a domain in shadow on its own schedule. The comparison is of exports the lead supplies, period by period.
- A passing parallel run is evidence for the cutover gate. It is not an approval, a contract or a security review.

## Evidence the pilot docs require before a pilot reads or writes official data

From the rollout ladder ([`PILOT-TO-PRODUCTION.md`](../../operating-model/PILOT-TO-PRODUCTION.md)):

| Step | Gates recorded before leaving it |
| --- | --- |
| `pilot_read_only` | `source_reconciliation_passed`, `accessibility_review_passed`, `data_quality_adoption` |
| `pilot_write_enabled` | `workflow_reliability`, `cutover_checklist_complete`, `sponsor_go_live` |

The migration acceptance criteria in the same page add: course, section and roster identifiers reconcile to the approved source, grade calculations reconcile before any passback, and the legacy LMS fallback remains available during the parallel run. No grade passback is enabled until faculty, registrar, privacy and integration owners approve.

## Who acts

| Who | Capability | Does |
| --- | --- | --- |
| Semester implementation staff (`implementation_manager`, `integration_admin`) | `migration:manage` | Run the stages and record runs |
| Your `registrar` or `university_admin` | `migration:approve` | Record the area approvals at cutover |
| `institutional_researcher`, `dean` | `migration:view` | Read |

## Before you rely on this

Ask for a rehearsal on a throwaway domain with synthetic data, file the output under `docs/evidence/`, and have a second person witness it. The Migration Center has not had one with an institution.
