# Stream 30 · Phase 3 — cross-role workflows — first report

**Date** 2026-10-12 · **Branch** `claude/epic-galileo-aq26dg` · **Pull request** harrisonjrubin7-cmyk/semester#1475 · **Decision** [`D-1475`](../decisions/D-1475.md) §13–14 · **Plan** [`../handoff/execute/30-phased-build.md`](../handoff/execute/30-phased-build.md) Phase 3 · **Register** [`capability-register.csv`](capability-register.csv) rows `P3-A1`–`P3-F3`

## Verdict

**Phase 3's exit gate is not met.** It asks for each of six domains' completion proof to have evidence and for L01, R01–R03, A01, C01–C02, E01–E02 and M01 at `tested`; those IDs still have no titles in anything supplied, so this pass works the six proof rows the plan itself spells out, split into 21 clauses. Two read-only audits placed each clause against the tree. This pass then made one clause true that was absent (publication and its outbox event in one transaction), closed one real gap in another (a stale catalog can no longer produce "Ready"), and added the proof two more clauses lacked (the acknowledge step; a refused finance write leaves the ledger as it was). Result: 12 clauses `tested`, 7 `partial`, 2 `absent`. The two absent clauses and most of the partial ones are not test gaps but unbuilt product (student submissions and archive; the Handshake review queue and STAR grading; a named owner for help requests; a coach share for career practice), each needing a decision or vendor access recorded in the register's blockers column.

## Built this pass

- **Release emits its outbox event in the same transaction (A3).** `supabase/migrations/20261012010000_gradebook_release_emits_event.sql` redefines `gradebook_release` to call `private.emit_domain_event` (`gradebook.grades_released`, keyed by the release's own idempotency key, payload = item and counts, no student) before it returns. A refused release raises before the rows; a release of nothing raises after them; either way the event rolls back with them. `gradebook.check.sql` gained three checks (148 total): a refused release writes no event, the release writes exactly one and the replay none, the payload carries the counts and names no student. Red first: with the emit removed, `expected 1, got 0`. The release in the suite now uses the contract's longest key (200 characters): the first cut copied the key into the outbox's correlation id, whose constraint stops at 128, so a valid key aborted the release; the id is now derived (`gb:` + md5) when the key is longer than 128, and the whole key is kept as the idempotency key.
- **A stale catalog cannot say Ready (B1).** `app/src/lib/path-readiness.ts`: `readinessFacts` now carries `catalogAgeDays`, and `overallReadiness` answers "Information unavailable" when the import is older than `CATALOG_FRESH_DAYS` (30), naming the age and the limit. Exactly at the limit is fresh; no date or an unparseable one says nothing about age. `RegistrationReadiness.tsx` passes the plan's `importedAt`. Red first (1 failed), then 22 passed across the two files. This also closes the "import's age" half of the cart-freshness backlog item at the headline.
- **The office acknowledges, and the student reads it (C2).** `help-requests.check.sql` now drives sent → acknowledged positively: the student sees the status, reads the event with the advisor as actor, a second acknowledge is refused, and scheduling proceeds from acknowledged (76 checks).
- **A refused finance write leaves the ledger unchanged (F3).** `student-accounts.check.sql` counts the ledger before and after the refused second reversal and finds them equal (70 checks).

## The six domains, placed

| Domain | tested | partial | absent | What is unbuilt |
| --- | --- | --- | --- | --- |
| A Learning / faculty | A3 | A1, A2, A4 | A5 | student submissions and archive; acceptance and activity dimensions; a progress-only AGS post |
| B Planning / registration | B1, B2, B3 | | | |
| C Advising / support | C2, C3 | C1 | | a named, accountable owner and a claim step |
| D Career / employer / alumni | | D1, D2 | D3, D4 | coach share and revoke; Handshake review queue; STAR grading and verbal metrics |
| E Campus / family | E1, E2, E3 | | | one-way revoke of a family grant and a grant history (recorded as gaps on E2) |
| F Accounts / finance | F1, F2 | F3 | | a mid-write failure against a real database; the inbox drain job |

Each clause's evidence, gap and blocker is a register row.

## Commands run

From `app/` unless noted.

```
$ npx vitest run src/lib/path-readiness.test.ts                      → 1 failed (new), then 21 passed
$ npx tsc -b; npx vitest run src/lib/path-readiness.test.ts src/components/RegistrationReadiness → exit 0; 2 files, 22 passed
$ SEMESTER_CHECK_PG_ANY=1 supabase/check.sh gradebook help-requests student-accounts
                                                                     → ✓ 148, ✓ 76, ✓ 70 checks (PostgreSQL 16, local)
$ (emit removed) SEMESTER_CHECK_PG_ANY=1 supabase/check.sh gradebook → ✗ FAILED: the release wrote one outbox event, and the replay none — expected 1, got 0
$ REGISTERS=write npx vitest run src/lib/docs/trust-docs.test.ts     → 38 passed; CONTROL-FACTS.md: 237 migration files
$ npm run ecosystem:build                                            → 12 passed
```

Then, on the whole head: `npx tsc -b && npm run lint && npm run check:university && npm run design-system:check && npm test` → exit 0; Test Files 1522 passed, 2 skipped (1524); Tests 24232 passed, 76 skipped (24308). The first whole-head run was red in four files because the new migration's version collided with main's `20261012000000_ops_projection_dashboard.sql` and because the definer register, the EVENTS producer list and the migration-order guard each noticed a redefined definer function and a new outbox producer. The migration is now `20261012010000`; `definerregister.ts` gained a `redefines` flag so a redefinition is held to its winning file without being counted as a new production function; the three generated registers were rebuilt; the producer list names the new file and why.

## Also in this push

Main moved under the pull request twice. The second merge brought main's budget rebaseline (`33f7b9e4`: Export 85 KB, Recovery 83 KB), which should end the `build` job's budgets failure (D-1475 §8). It also tripped two of this branch's own guards, both correctly: main carried its own copy of the two isolation-list entries, so the merge listed them twice; and main added `ops-projection-dashboard.check.sql` without naming it in `check-suites.txt`. Both repaired in `bad5bd9e`.

## What the next stream needs

1. Titles for L01, R01–R03, A01, C01–C02, E01–E02, M01, or the founder's word that the six proof rows are the Phase 3 acceptance list.
2. Product decisions: a student submissions model (A1), office-level or person-level accountability for help requests (C1), the coach role for career shares (D1), whether family grant history must be tamper-proof against the student (E2).
3. Vendor access for Handshake and Big Interview and an institution namespace before any of D3/D4 can be built.
4. The new migration is in the repository and applied to the throwaway database by CI; applying it to production is a separate, approved step and is not done.
