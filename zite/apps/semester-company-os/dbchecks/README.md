# Company OS database checks

Same pattern as `apps/semester/dbchecks`: one rolled-back transaction per file, ending in `RESULT pass=N fails=M [...]`.
Company roles used by a check are inserted inside that transaction only; nothing is granted. Run on app `sbjuykr2qw`:
`import { run } from './dbchecks/migrations'; await run();` (one import per file).

Results (29 Oct): migrations 25/25 (mutants: rollback anytime, inventory after cutover, revoked role — all caught);
campaigns 24/24 (mutants: self-review stopped by the table constraint, approve unseen content, edit keeps approval — caught);
trustRoom 5/5 (table backstop; the decision rules are tests/trustRules.test.ts, whose self-decision mutant goes red).
