# School offboarding rehearsal on a hosted Supabase preview database — 30 September 2026

**What this is.** The offboarding procedure (`20260930200000_school_offboarding.sql`, D-1021, `docs/SCHOOL-OFFBOARDING.md`) walked end to end on Supabase's own hosted PostgreSQL, using **synthetic schools and synthetic accounts only**, inside one transaction that was rolled back. **What it is not:** a rehearsal by someone other than the author, a run against production, or the full 98-check suite.

## Where

A disposable Supabase preview database built from `main` by the Supabase GitHub integration for pull request #1044 (project ref `pmyuyvcygfwwmixwuybn`). Before the run it held **no rows of any kind** (0 schools, 0 accounts), so nothing real could be touched, and it already contained the three new migrations (`school_offboarding`, `school_membership_requests` and their functions existed). That is the first time these migrations ran on hosted Supabase; until now they had only run on a local PostgreSQL 17.

The pull request's own preview branch could not be used: its reset failed in Supabase's clean-up script with `out of shared memory`, and a new branch could not be created from this environment (the create call timed out twice and produced nothing).

## What was run

A compact version of `supabase/school-offboarding.check.sql`: two synthetic schools, eleven accounts, three operators, a connection and a roll-out per school, a real `legal_holds` row. It exercised, in this order:

1. deleting a school is refused, with and without dependents, and by a school administrator;
2. a stranger and another school's administrator cannot propose; one side cannot propose as the other; one open case per school;
3. approval before the inventory is refused, by the proposer is refused, by the same side is refused, and by the other side succeeds;
4. access disabled only after the student-notice date is on record, only by an operator: two grants revoked, one connection disconnected with its credential pointer cleared, the holders' sessions ended, a student's own session untouched, the roll-out suspended, nothing deleted, **the other school untouched in every particular**;
5. while the school is leaving: no new grant, no new member, no new or reactivated connection, with the same acts allowed at the other school;
6. steps cannot be skipped or repeated; an export is verified by a different operator; a stale export is refused; **an export that omits a table which gained its first row after the inventory is refused**; a complete one is verified;
7. archive needs at least 30 days; purge eligibility is refused inside the window, refused under a live legal hold, refused for the approver, and granted to a third person only after the window with no hold; the school row is still undeletable afterwards;
8. a second school's departure is restored by a different operator from the one who disabled access: the grant, the connection (status and credential pointer) and the roll-out come back exactly; the first school stays archived;
9. another school's administrator cannot read the case; the audit record holds the steps with no address or name in any detail.

## Result

Every assertion passed on the hosted database. The script ended with a deliberate `raise exception` so the whole transaction rolled back; the database reported exactly that error and, read back afterwards, still held **0 schools, 0 accounts, 0 cases, 0 holds and 0 audit events**. Nothing was left behind.

## What this does not settle

- It was run by the author, from this session, through the connector's SQL call. The restoration and approval rules are about *different people*; here they were different synthetic accounts, not different humans.
- The compact script omits some of the 98 local checks (for example the direct-API write refusals and the read-policy checks for students), which passed locally.
- At the time of this rehearsal, a read-only production query ended at `20260930173030` and the new tables did not exist. A later read on 30 September 2026 found the production migration ledger through `20260930232000`, including school offboarding. That proves the migration was recorded; it does **not** prove that an offboarding case was run, that the procedure works with production data, or that the second-person rehearsal happened.
- Release gate G3 stays PARTIAL: the purge is not built, the export file is generated elsewhere, and counsel has not set the retention window.
