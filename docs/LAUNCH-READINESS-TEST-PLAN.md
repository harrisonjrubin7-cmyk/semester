# Launch Readiness Test Plan

The launch command's **Mandatory testing** section, row by row. Each row names
the suite that covers it today, or the phase that owes the suite. Every path in
the *Covered by* column exists on `origin/main` at `1dd79cd`. Rows marked
**owed** have no test yet, and nothing in this plan claims otherwise.

Every command runs from `app/`, as `CLAUDE.md` and
[`REGRESSION-CHECKLIST.md`](../REGRESSION-CHECKLIST.md) require:

```bash
cd app
npx tsc -b && npm run lint && npm test && npm run test:shuffle && npm run build
../supabase/check.sh          # every row-level security suite, against Postgres 17
npm run smoke:a11y            # six journeys, two viewports, real browser
npm run smoke:cold            # the build boots cold
```

## Phase 0 (this change)

| What | Suite |
| --- | --- |
| Every gate cites files that exist, with a control that a missing file is seen as missing | `app/src/lib/launchreadiness.test.ts` |
| No gate is met while a go-live line it depends on is unticked | same |
| The council document, this checklist and the data agree on seats, holders, statuses and verdict | same |
| `decide()` refuses each of: an unmet gate, no evidence, a vacant or unsigned seat, an open blocker, a P0/P1 waiver, a non-founder waiver, a waiver with no reason, disclosure or expiry, an expired waiver, and a waiver for a blocker that does not exist; a state whose only open items are valid waivers returns `go-with-conditions` and lists them. The control is a state that returns `go` | same |

Each guard in that file was checked by breaking the rule it protects: marking
a gate met, allowing P1 waivers, skipping the signature check, citing a missing
file, and letting any seat accept risk. Each break turned the matching test
red. The file was then restored.

## Existing app preservation

| Requirement | Covered by | State |
| --- | --- | --- |
| Routes, navigation, screens | `app/src/screens.test.ts`, the full `npm test` suite in file order and shuffled | Covered |
| RLS and tenant isolation | `supabase/check.sh` (every suite), including `tenancy`, `capabilities`, `grants` and `expansion` | Covered |
| Roles and capabilities | `supabase/capabilities.check.sql`, `supabase/grants.check.sql` | Covered |
| Deployment build | `npm run build` in CI | Covered |
| React roots unmounted between files | `app/src/rootunmount.test.ts` | Covered |

## Golden path and beta (Phase 1)

| Requirement | Covered by | State |
| --- | --- | --- |
| End-to-end student journey | `app/scripts/golden-path.mjs` (`npm run smoke:golden`, in CI): one student from a cold first run through an action made, Today, the Guide and Support, completion and resume, at a phone and a desktop viewport | Covered signed out. **Owed**: the same journey signed in; Path/Plan and adding a course from a syllabus |
| Cross-device continuity | `app/src/lib/merge.test.ts` (field-level merge); `app/scripts/golden-path.mjs` restores the backup file into a fresh browser context | File-carried resume covered. **Owed**: two-browser resume through an account |
| Poor-network continuity | `app/src/lib/offline.test.ts` | Unit only. **Owed**: throttled browser run |
| Feedback / exit / export | `supabase/feedback.check.sql`, `app/src/lib/export.test.ts` | Export covered. **Owed**: beta feedback and exit request |
| No irreversible transaction in beta | The gateway's adapter registry is empty by design (`app/server/institution/`) | Holds today by construction. **Owed**: an assertion that fails if a beta flag allows a write |

## SSO and identity (Phase 2)

| Requirement | Covered by | State |
| --- | --- | --- |
| SAML validation | None in the repository. Supabase validates the SAML assertion | **Owed**: test SP configuration and certificate rotation |
| OIDC validation | `app/server/institution/auth.test.ts` (gateway token verification) | Partial. No institutional OIDC IdP support exists |
| SCIM lifecycle / group mapping | `app/server/institution/scim.test.ts`, `supabase/identity-provisioning.check.sql` | Service covered. **Owed**: the service is not yet mounted on any route |
| LTI launch / minimum claims | `supabase/lti.check.sql`, `supabase/ltiidentity.check.sql`, `app/src/lib/ltikey.test.ts` (roster scope refused) | Covered |
| Grade passback off by default | `supabase/lti-integration.check.sql`, `app/src/lib/ltigate.test.ts`: `kill.writeback` stops every registration, and a bound registration needs `writeback.lms_grade_passback` (off by default) | Covered for bound registrations. **Owed**: unbound registrations answer `allowed-unbound` |
| Account link / unlink | `supabase/ltiidentity.check.sql` (link via ticket) | Link covered. **Owed**: unlink does not exist |
| Entitlement ordering | `app/src/lib/flags.test.ts` (kill switch → environment → tenant entitlement → connection → scope → capability → … ) | Partial. **Owed**: the plan, sponsored-access and usage-allowance steps the launch command adds |

## GTM and pilot (Phase 3)

| Requirement | State |
| --- | --- |
| Internal role isolation; no student data in sales views; pilot outcome access | **Owed**. No GTM, prospect or pilot table exists. Each table needs its own `.check.sql` that tries to read it as a student and as another tenant's administrator |

## Compliance (Phase 4)

| Requirement | Covered by | State |
| --- | --- | --- |
| No unsupported compliance claim | `app/src/lib/marketreadiness.test.ts` (scorecard absences are probed), `app/src/lib/privacy.test.ts` (disclosure matches code) | Partial. **Owed**: a claim register that rejects `available` without evidence |
| Accessibility across core flows | `app/scripts/accessibility-smoke.mjs` in CI, and `app/src/a11y/` | Automated only. A formal audit is **owed** and cannot be automated |
| Evidence access / redaction; consent / classification / retention | `app/src/lib/retention.test.ts` | Partial |

## Reliability and fraud (Phase 5)

| Requirement | Covered by | State |
| --- | --- | --- |
| Synthetic monitoring | `.github/workflows/production-smoke.yml` (hourly) | Covered for public paths |
| Incident / degraded / read-only / kill switch | `app/src/lib/flags.test.ts`, `supabase/integration-hardening.check.sql` (kill switches); `app/src/lib/rollback.test.ts` (runbook preconditions) | Kill switches covered. **Owed**: no degraded banner or read-only mode exists |
| Support ticket with consented context | `supabase/support-access.check.sql` (consented, aggregate-only, 7-day, revocable access); `supabase/support-tickets.check.sql` (tickets, off by default, 24 h / 72 h targets by category) | Access and tickets covered. **Owed**: a ticket does not yet attach a consented context grant, and nobody owns the queue |
| Backup / restore and load test | `supabase/restore.sh` (in CI, `.github/workflows/ci.yml` “Rehearse a backup and restore”: dump, restore into an empty database, compare six ways); `supabase/load.sh` (in CI, “Load and concurrency scenarios”: registration-week and everyday-sync paths against latency budgets, then invariants) | Rehearsal and database load covered. **Owed**: production has never been restored, so no RTO or RPO can be stated, and nothing loads PostgREST, GoTrue or the edge functions |

## Analytics and content (Phases 5–6)

| Requirement | State |
| --- | --- |
| Privacy-safe event capture, cohort thresholds | **Owed** with the analytics work. The minimum cohort size must be a tested constant, not a convention |
| Source / freshness / expiry / correction | Partial: `app/src/lib/integration/freshness.ts` for integration data. **Owed** for launch content |
| Training / content accessibility | **Owed** |

## Rules for anyone extending this plan

- A row moves to *Covered* in the same commit that adds the suite, and the
  suite must first be seen failing against a revert of the thing it guards.
- A clean run is a claim about the probe as well as the code. Include a
  control.
- Green consecutive shuffle runs are weak evidence about timing faults.
  `rootunmount.test.ts` is the structural guard for those.
