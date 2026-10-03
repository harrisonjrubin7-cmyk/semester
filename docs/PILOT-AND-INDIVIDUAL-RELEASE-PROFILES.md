# Pilot and individual release profiles

<!-- Rendered from app/src/lib/governance/release-profiles.ts by release-profiles.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

These executable profiles define the next honest release targets: broad individual use and a bounded institutional pilot.
They do not rename repository completion as deployment, tenant approval, certification, or live operation.

## Repository snapshot decision (2026-10-02)

| Profile | Technical candidate | Rollout | Still required |
| --- | --- | --- | --- |
| individual-scale | not-ready | held | build-and-regression, real-account-lifecycle, tenant-isolation-negative-authorization, critical-accessibility-journeys, source-freshness-and-fallback, privacy-export-deletion, observability-and-support, rollback-and-restore-rehearsal, kill-switch-and-degraded-mode, claim-and-scope-review, deployed-exact-sha, production-smoke, support-route-live, rollback-current, kill-switch-clear, dependency:CAP-003, dependency:CAP-013, dependency:CAP-034, dependency:CAP-035, dependency:CAP-036, dependency:CAP-037, dependency:external:approved catalog and degree-audit data, dependency:external:provider credentials and institution approval |
| institutional-pilot | not-ready | held | build-and-regression, real-account-lifecycle, tenant-isolation-negative-authorization, critical-accessibility-journeys, source-freshness-and-fallback, privacy-export-deletion, observability-and-support, rollback-and-restore-rehearsal, kill-switch-and-degraded-mode, claim-and-scope-review, deployed-exact-sha, production-smoke, support-route-live, rollback-current, kill-switch-clear, named-tenant-agreement, named-data-owner, tenant-accessibility-review, tenant-security-privacy-review, approved-data-scope, pilot-cohort-consent, pilot-support-roster, pilot-outcome-agreed, canonical-launch-decision, dependency:CAP-013, dependency:CAP-043, dependency:external:approved catalog and degree-audit data, dependency:external:approved read-only SIS registration-readiness adapter, dependency:external:authoritative registrar calendar feed, dependency:external:institution agreement and approved service adapters, dependency:external:provider credentials and institution approval |

This historical source snapshot lists the technical evidence contract, but source references are not exact-SHA run records.
Both profiles therefore remain not ready in this evaluator until current run evidence names the evaluated commit. Rollout also
requires deployment and, for a pilot, named-tenant activation records that do not live in source code.

## Scope and boundaries

### individual-scale

**Audience:** Individuals using device-first or self-service accounts without institutional activation

**Default:** available after production release gates

**Capabilities:** `CAP-001`, `CAP-004`, `CAP-005`, `CAP-006`, `CAP-007`, `CAP-008`, `CAP-009`, `CAP-010`, `CAP-011`, `CAP-014`, `CAP-015`, `CAP-016`, `CAP-017`, `CAP-019`, `CAP-020`, `CAP-021`, `CAP-022`, `CAP-023`, `CAP-024`, `CAP-025`, `CAP-028`, `CAP-031`, `CAP-040`, `CAP-044`, `CAP-049`, `CAP-053`, `CAP-054`, `CAP-055`

**Unsatisfied capability dependencies:** `CAP-003`, `CAP-013`, `CAP-034`, `CAP-035`, `CAP-036`, `CAP-037`, `external:approved catalog and degree-audit data`, `external:provider credentials and institution approval`

**Allowed:** personal planning; source-aware course organization; study and creation; export; account deletion

**Forbidden:** official registration; official grading; institutional record writes; financial aid; payments; payroll; general ledger

**Claim boundary:** Ready for broad individual use only after exact-SHA deployment and production gates pass; no institutional connection, certification, or system-of-record claim.

**Fallback:** Continue device-first use, preserve export, and disable unavailable cloud or provider-dependent surfaces.

### institutional-pilot

**Audience:** A named, bounded student cohort using Path and registration-readiness planning

**Default:** off

**Capabilities:** `CAP-001`, `CAP-003`, `CAP-010`, `CAP-011`, `CAP-014`, `CAP-015`, `CAP-016`, `CAP-017`, `CAP-019`, `CAP-020`, `CAP-021`, `CAP-022`, `CAP-023`, `CAP-024`, `CAP-044`, `CAP-045`, `CAP-050`

**Unsatisfied capability dependencies:** `CAP-013`, `CAP-043`, `external:approved catalog and degree-audit data`, `external:approved read-only SIS registration-readiness adapter`, `external:authoritative registrar calendar feed`, `external:institution agreement and approved service adapters`, `external:provider credentials and institution approval`

**Allowed:** Path planning; term planning; schedule comparison; conflict validation; advisor agenda; official-system handoff

**Forbidden:** enroll; waitlist; drop; withdraw; write to SIS; certify degree progress; act as system of record

**Claim boundary:** Technically prepared for a controlled pilot; activation still requires the named tenant, cohort, data scope, reviews, support roster, agreed outcomes and exit criteria, deployment, and approval records.

**Fallback:** Disable the pilot entitlement and all institutional reads; retain device-first planning and links to official systems.

## Technical evidence contract

| Gate | Repository reference | Checked | Expires |
| --- | --- | --- | --- |
| build-and-regression | repo:.github/workflows/ci.yml | 2026-10-02 | 2026-11-01 |
| real-account-lifecycle | repo:app/scripts/account-sync.mjs | 2026-10-02 | 2026-11-01 |
| tenant-isolation-negative-authorization | repo:supabase/rls-coverage.check.sql | 2026-10-02 | 2026-11-01 |
| critical-accessibility-journeys | repo:app/scripts/accessibility-smoke.mjs | 2026-10-02 | 2026-11-01 |
| source-freshness-and-fallback | repo:app/src/lib/integration/quality.test.ts | 2026-10-02 | 2026-11-01 |
| privacy-export-deletion | repo:supabase/deletion.check.sql | 2026-10-02 | 2026-11-01 |
| observability-and-support | repo:docs/RUNBOOKS.md | 2026-10-02 | 2026-11-01 |
| rollback-and-restore-rehearsal | repo:supabase/restore.sh | 2026-10-02 | 2026-11-01 |
| kill-switch-and-degraded-mode | repo:app/scripts/killswitch-drill.mjs | 2026-10-02 | 2026-11-01 |
| claim-and-scope-review | repo:docs/PRODUCT-STATUS-MAP.md | 2026-10-02 | 2026-11-01 |

## Activation boundary

- Individual scale still needs an exact deployed SHA, production smoke, a live support route, current rollback evidence, and a current target-bound kill-switch-clear record.
- An institutional pilot additionally needs a named agreement, data owner, approved data scope, cohort consent, tenant accessibility/security/privacy reviews, a staffed support roster, agreed baseline, success, review, expansion and exit criteria, and a current target-bound `go` or `go-with-conditions` record re-derived from the canonical launch-readiness council evaluator.
- Activation and dependency decisions count only when a secure trust-room, vault or ticket artifact names every required approval function; arbitrary strings cannot authorize rollout.
- Every technical record must name the exact 40-character source SHA exercised by that gate; repository file references alone are not run evidence.
- Every activation and dependency record must match one environment, deployed SHA, configuration version and, for a pilot, one tenant and cohort. Mixed-target evidence fails closed.
- Canonical external and out-of-scope capability dependencies are activation requirements; green generic gates cannot bypass them.
- CAP-050 is admitted only for search, comparison, validation, and official-system handoff. Enrollment, waitlist, drop, withdrawal, and SIS writes remain prohibited.
- No profile activates financial aid, payments, payroll, general ledger, official grading, certification, or system-of-record authority.
