# Stream 30 · Phase 2 — student daily loop — first report

**Date** 2026-10-12 · **Branch** `claude/epic-galileo-aq26dg` · **Pull request** harrisonjrubin7-cmyk/semester#1475 · **Decision** [`D-1475`](../decisions/D-1475.md) §11–12 · **Plan** [`../handoff/execute/30-phased-build.md`](../handoff/execute/30-phased-build.md) Phase 2 · **Register** [`capability-register.csv`](capability-register.csv) rows `P2-H1`–`P2-H8`, `P2-C1`–`P2-C11`

## Verdict

**Phase 2's exit gate is not met, and the two capability lists it names were not supplied, so this pass works from the plan's own two checklists instead.** The exit gate asks for S01–S04 and F03–F05 at `tested`; those IDs have no title in anything supplied (register, Phase 1 report). What the plan does spell out is eight hardening items and eleven closeout integration tests, "all 8 must have recorded test results". Two read-only audits placed each against the tree; this pass then fixed one security defect the audit found, made one hardening item true that was not, and added tests where a behaviour had code and no proof. Result: of the eight hardening items, seven are `tested` and one `partial`; of the eleven closeout tests, eight are `tested` and three `partial`. The prototype routes the plan names for this loop (`#/os/finish`, `#/student/closeout`, `#/os/backbone`, …) are not in the 281-route inventory; `SPEC-INDEX.md` maps them to prototype files built from PDFs that are not in the repository.

## Found and fixed

- **A revoked share still allowed AI retrieval.** `packages/institution/src/policy.ts`, rule `ai.retrieve_source`: the "shared" branch accepted any share grant to the actor for the source and never asked whether it was still live, while the neighbouring `task.read` rule did. A share the student had revoked, or that had expired, kept grounding the assistant on their material. The rule now requires `liveConsentGrant`, as `task.read` does. `policy.test.ts` gained the case; red first (`expected true to be false`), then 56 passed. This is closeout test 6's retrieval half; the export half is `gradebook.check.sql` from Phase 1.
- **Interrupted onboarding started over.** The onboarding step index (`onb`) lived in the ephemeral half of the state, so closing the app on step three and opening it again showed the welcome screen. It is now in the persisted half (`app/src/state/shape.ts`: interface, default, loader with a non-negative-integer check, `pickPersisted`). `storage.test.ts` gained three tests; red first (3 failed), then 33 passed, and the 42 state test files all pass. Three structural guards then failed, as they should: `export.test.ts`, `merge.test.ts` and `privacy.test.ts` each require every persisted field to be named in the backup, the merge table and the privacy page. The step is backed up, merges as `theirs` (so a second device resumes where the first stopped), and sits under the privacy page's set-up sentence. What is not done: the client still does not use the server-side `onboarding_step_progress` model.

## Tests added where there was code and no proof

- `app/src/state/reducer.test.ts`, describe "a calendar feed, refreshed and failed" (4 tests): a refresh with the same events twice keeps two events and the new title, another feed's events survive a refresh, a failed refresh records its status and leaves `feedEvents` the same reference. Red when the refresh was made to append (2 failed), green restored (117 passed). These are hardening items 2 and 4 at the reducer; the audit found `syncFeed`/`failFeed` had no test at all.

## The eight hardening items, placed

| # | Item | Status | Proof |
| --- | --- | --- | --- |
| 1 | interrupted onboarding resumes | tested (this pass) | `storage.test.ts`; previously false |
| 2 | failed imports create no deadlines | tested (this pass) | `reducer.test.ts` failFeed; `generate.test.ts`, `import-review.test.ts` |
| 3 | offline saved/pending states | tested | `syncstates.test.tsx`, `OfflineBanner*.test.tsx`, `offline-sync/engine.test.ts` |
| 4 | duplicate source events don't multiply tasks | tested (this pass) | `reducer.test.ts` syncFeed; school sync, ics, merge, tasks-transport, journal-idempotency tests |
| 5 | timezone/DST + changed deadlines reconcile | tested | `date`, `ics`, `intime`, `fromschool`, `reconcile` tests; CI runs the suite in Chicago and Kiritimati |
| 6 | missed week → manageable recovery plan | tested | `behind`, `plan-recovery`, `academic-recovery`, `Recovery` tests |
| 7 | student can override suggestions | tested | `actions`, `today`, `ActionCenter`, `fromschool`, `plan-recovery` tests |
| 8 | private work stays separate from official records | partial | backup, encryption-at-rest, ledger grants and export tests; nothing asserts workspace content never enters an institution write |

The eleven closeout tests are in the register with the same columns; the three `partial` ones are revocation-blocks-search (no server-side search exists to test), restore-and-rollback (no down migrations; production never restored), and untrusted-text-vs-tool-permissions (fencing and the allowlist are tested separately, never through tool selection together).

## Commands run

From `app/`.

```
$ npx vitest run ../packages/institution/src/policy.test.ts   → 1 failed (the new test), then 56 passed after the fix
$ npx vitest run src/state/reducer.test.ts                    → 117 passed; 2 failed with the refresh made to append; 117 after restore
$ npx vitest run src/state/storage.test.ts                    → 3 failed before the move; 33 passed after
$ npx tsc -b                                                  → exit 0
$ npx vitest run src/state                                    → 42 files, 556 tests passed
$ npx vitest run src/state/logindoor.test.tsx src/screens/Onboarding src/lib/cloud.test.ts src/lib/migrate src/components/OfflineBanner.test.tsx ../packages/institution/src/policy.test.ts → 6 files, 186 passed
$ npm run check:university                                    → exit 0
$ npm run ecosystem:build                                     → 12 passed
```

Then, on the whole head: `npx tsc -b && npm run lint && npm run check:university && npm run design-system:check && npm test` → exit 0; Test Files 1522 passed, 1 skipped (1523); Tests 24227 passed, 69 skipped (24296). The first whole-head run failed the three table guards named above; the second passed.

## CI evidence carried from Phase 1

Run `38185868815` on `0d1c2c11`: the ported `if: ${{ !cancelled() }}` let the PostgreSQL 17 install run after the budgets failure, so "Check the database policies" ran for the first time on this pull request and passed all 152 suites from `check-suites.txt`, `gradebook.check.sql` included (145 checks). Typecheck, lint, design-system gates, Test, Test in other timezones, Test in a different order and Build all passed. The one red step remains "Performance budgets", main's overrun (D-1475 §8).

## What the next stream needs

1. Titles and acceptance tests for S01–S04 and F03–F05 (the prototype register), or the founder's word that the eight hardening items and eleven closeout tests are the Phase 2 acceptance list.
2. Hardening item 8: a definition of the institution write paths student work must never enter, so a test can assert it.
3. Closeout 10: a restore drill on real infrastructure (founder-approved) and a position on schema rollback.
4. Closeout 11: one test that pushes injection-shaped course text through tool selection and acceptance in `converse.ts`.
5. Onboarding resume across devices: wire the client to `onboarding_step_progress`, which the DB already models and tests.
6. A shared spreadsheet-cell guard in place of the five implementations (closeout 8).
