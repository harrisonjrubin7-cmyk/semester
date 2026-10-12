# Stream 30 · Phase 5 — enable and replace by domain — first report

**Date** 2026-10-12 · **Branch** `claude/epic-galileo-aq26dg` · **Pull request** harrisonjrubin7-cmyk/semester#1475 · **Decision** [`D-1475`](../decisions/D-1475.md) §17–18 · **Plan** [`../handoff/execute/30-phased-build.md`](../handoff/execute/30-phased-build.md) Phase 5 · **Register** [`capability-register.csv`](capability-register.csv) rows `P5-R1`–`P5-N30`

## Verdict

**Phase 5's exit gate is not met, and it cannot be a build state.** The gate is institutional and per domain: Semester accepted as authoritative, capability rows `Enabled` for named users only. No domain can be authoritative today, because the ladder the plan names (eight stages, eight cutover items) does not exist as such in the code, and the nearest things that do (a twelve-stage Migration Center, a ten-state tenant rollout, a two-value module mode) are three unconnected state machines. `docs/DOMAIN-REPLACEMENT-REGISTER.md` still reports 0 of 14 domains replaceable, and nothing in this pass changes that sentence.

This pass did what a repository can do. Three read-only audits placed the phase's 78 clauses against the tree: the replacement ladder and cutover items (15), streams 11, 20, 27 and 29 (33), and streams 14, 15 and 17 (30). Two server-side holes the audits found were closed red-first. One stale generated file on the merged head was regenerated. Result: 15 clauses `tested`, 48 `partial`, 2 `untested`, 13 `absent`.

## Built this pass

- **Cutover needs two people (R2g).** The Migration Center's cutover gate asks for every required area to be approved, and refuses the migration's creator. It did not refuse one approver covering two areas, because the approval policy needs only `migration:approve`, not a capability per area: a registrar who also administers IT could sign "data owner" and "IT" alone and the two-area gate read as satisfied. `20261012060000_migration_approval_distinct_areas.sql` makes the stamp trigger refuse an approval when the same person has already approved a different area inside the current stage window (the window a changed rollback plan also resets). Re-deciding the same area stays allowed, and a rejection is never limited. `migration-center.check.sql` 85 → 86 checks. Red first: `the same person cannot approve the second area too … expected "does not approve two areas", got "<NULL>"`.
- **One provider reference is one money movement (N15).** Nothing stopped two requests under the same provider reference from being approved into the student ledger. A payment the provider reported twice, or a webhook replayed after a retry, could credit an account twice, and only the month's reconciliation could notice, and only if the person recording the provider total reported it honestly. `20261012070000_student_account_provider_ref_once.sql` adds a trigger that refuses the second entry in words and a partial unique index on (school, kind, reference) for payments, refunds and chargebacks that holds when two approvers act at the same instant, the pattern the one-reversal rule already uses. A preflight in the migration counts existing duplicates and stops with the number rather than dropping a ledger row. The same reference under another kind, or at another school, is another movement and stays allowed; a probe inside a rolled-back block proves both. `student-accounts.check.sql` 70 → 75 checks, and its audit tally moves 32 → 34 for the duplicate request and its rejection. Red first: `a second payment under the same provider reference is not approved … expected "already recorded", got "<NULL>"`.
- **The Edge Function copy of the access saga had a stale policy (found on the merged head).** `supabase/functions/_shared/access-saga/policy.ts` is generated from `packages/institution/src/policy.ts`, and a test refuses a copy that is not file-for-file what the generator writes. Phase 2's fix to `ai.retrieve_source` (a revoked or expired share no longer grounds retrieval) had changed the source after main generated the copy, so the deployed saga tick would have kept the old rule. `node scripts/edge-access-saga.ts` regenerated it; the test is green again.

## The surfaces, placed

| Surface | tested | partial | untested | absent | What only an owner or a vendor can close |
| --- | --- | --- | --- | --- | --- |
| R Ladder and the eight cutover items | | R2a–R2h, R2x, R4, R5, R6, R7 | | R1, R3 | define the ladder (eight stages against twelve, ten and two that exist); decide whether Core must wait on a completed cutover; name the source per domain |
| S Streams 11, 20, 27, 29 (site, social, executive, account and mail) | S3, S7, S8, S10–S13, S15, S31 | S1, S2, S4, S5, S9, S14, S18, S19, S21, S22, S24, S25, S28, S29, S33 | S6 | S16, S17, S20, S23, S26, S27, S30, S32 | the `docs/system` PDFs the plans cite, which are not in the tree; mail domain and deliverability; a media hash provider; legal review of the drafts |
| N Streams 14, 15, 17 (native platform, finance, web to app) | N3, N6, N8, N14, N17, N30 | N1, N2, N4, N7, N9–N12, N15, N16, N18, N19, N21–N28 | N20 | N5, N13, N29 | a payment provider account and webhook secret; the 16-item authority gate; accounting and legal engagement for the finance release gates |

Each clause's evidence, gap and blocker is a register row.

## Contradictions the audits found, recorded and not resolved here

- Phase 5 names an eight-stage ladder with eight cutover items. The code has a twelve-stage Migration Center, a ten-state tenant rollout, a connect/core module mode and 21 authority gates. Nothing counts "eight".
- Stream 14 describes modes off, shadow, assist, authoritative; the code has connect and core only.
- Stream 15 asks for a balanced ledger. The student ledger is single-entry and signed with a hash chain; the billing ledger with a balance trigger does not exist. "Finance release gates 1 and 2 pass in CI" cannot be a CI check: they are owner and professional engagements.
- The plans cite files that are not there (`design/handoff/BUILD.md`, `lib/payments/*`, `api.claim_preview`, migrations 090, 110 and 120 as live SQL). The real equivalents are listed in the register rows.
- "Handoff" means three things in the tree: the outbound registration smoke test, the classmate course-pack export, and stream 17's web to app handoff, which is built and tested in SQL and has no caller.
- Streams 27 and 29 cite `docs/system/*` and prototype files that are not in the tree, so their clause lists come from the plan text only.

## Security gaps found and deliberately not fixed here

Each needs a product decision or a larger change than a red-first fix, and each is a register row.

- **Core is not coupled to cutover.** A tenant administrator can set a module to Core, or enable a native write gate through the feature policy, with no migration evidence at all; the people who approve are the school's own administrators. This is the single most valuable next gap, and it needs a decision on which module maps to which migration domain (R3).
- **Parallel-run periods are free text.** Two labels recorded minutes apart satisfy a requirement of two distinct periods, and the fourteen-day, 200-sample, 99% policy lives only in TypeScript no screen imports (R2b).
- **The lead-intake rate limit trusts the first forwarded address.** If the platform appends rather than replaces that header, a caller can vary it per request. Not verified against the platform (S3).
- **Handles are not unique and have no reserved list.** A handle such as "semester support" is possible today and handles are shown to classmates (S33). A usernames primitive is the audit's recommended fix for stream 29.
- **Intake stores no consent record, and holds are derived in the browser.** An unpaid-balance hold does not block enrollment on the server (N19, N26).
- **`consume_handoff` has no attempt limit and no revoker** for the `revoked` status (N28).

## Commands run

From the repository root unless noted.

```
$ SEMESTER_CHECK_PG_ANY=1 supabase/check.sh migration-center
    before the migration   → ✗ expected "does not approve two areas", got "<NULL>"
    after                  → ✓ 86 checks (PostgreSQL 16, local)
$ SEMESTER_CHECK_PG_ANY=1 supabase/check.sh student-accounts
    before the migration   → ✗ expected "already recorded", got "<NULL>"
    after                  → ✓ 75 checks
$ (app) node scripts/edge-access-saga.ts                                → policy.ts rewritten; scripts/edge-access-saga.test.ts green
$ (app) REGISTERS=write vitest definerregister, trust-docs               → CONTROL-FACTS.md regenerated (242 migration files)
```

The whole-head gates for this push are recorded in [`../mainframe/TEST_AND_RELEASE_GATES.md`](../mainframe/TEST_AND_RELEASE_GATES.md).

## What the next stream needs

1. A definition of the ladder: the eight stages and eight cutover items the plan names, mapped to the twelve, ten and two that exist, or the founder's word that the Migration Center's twelve are the acceptance list.
2. The Core-requires-cutover decision (R3): which module belongs to which migration domain, and whether a school with no migration may enable native writes at all.
3. Engineering that is unblocked now: a reason field on a Migration Center back-move (R5); a domain event for Migration Center stage changes (R6); a usernames primitive with a reserved list (S33); a consent column on site leads (N26); an attempt limit and revoker for the handoff (N28); a server-side check that a rail's settlement ingest, once a provider exists, carries its own counts.
4. A payment provider account and webhook secret before any of stream 15's provider clauses (N13) can move off `absent`.
5. The two migrations this pull request adds in this pass (`20261012060000`, `20261012070000`) are applied by CI to the throwaway database; applying them to production is a separate, approved step and is not done. The second stops with a count if a school's ledger already holds a repeated reference, so read that count first.
