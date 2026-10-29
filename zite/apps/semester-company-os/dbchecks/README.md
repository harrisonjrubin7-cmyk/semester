# Company OS database checks

Same pattern as `apps/semester/dbchecks`: one rolled-back transaction per file, ending in `RESULT pass=N fails=M [...]`.
Company roles used by a check are inserted inside that transaction only; nothing is granted. Run on app `sbjuykr2qw`:
`import { run } from './dbchecks/migrations'; await run();` (one import per file).

Results (29 Oct): migrations 25/25 (mutants: rollback anytime, inventory after cutover, revoked role — all caught);
campaigns 24/24 (mutants: self-review stopped by the table constraint, approve unseen content, edit keeps approval — caught);
trustRoom 5/5 (table backstop; the decision rules are tests/trustRules.test.ts, whose self-decision mutant goes red).
helpArticles (29 Oct) 18/18 (mutants: self-publish stopped by constraint, unseen text, claim without source stopped by constraint, edit after publish — all caught).
disputes (29 Oct) 18/18 (mutants: self-decision stopped by constraint, unseen dispute, workspace isolation — all caught).
campaignClaims (29 Oct) 30/30; campaigns re-run 24/24 after mkt-002. Mutants: expired source counted (7 red), revoke keeps approvals (2 red),
self-approved source (stopped by the table constraint), approve-unsourced check removed (stays 30/30 because the approval trigger refuses it — C30 accepts either refusal, which is the backstop working).
marketingAdmin (29 Oct) 30/30. Mutants: withdrawals ignored in segments (4 red), paused channel submits (2 red), hash ignores segment (1 red),
self-approved template (stopped by the table constraint). campaignClaims now sets an email sender name before its clean launch check (still 30/30).
