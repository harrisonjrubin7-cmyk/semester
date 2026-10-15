# Milestones 1 and 2 — evidence, manual QA and rollback

Written 30 Sep 2026 and refreshed against `main` after the M1/M2 verification run. The audit envelope, rights-request queue, account security, generated matrices, school-membership enforcement, advisor-share audit, offboarding, configuration studio and workflow builder are in the repository. Deployment, tenant activation, production restore, human accessibility review and pilot completion remain separate evidence states.

## What is on the branch (files, by kind)

| Kind | Items |
| --- | --- |
| **Migrations (2, both additive)** | `20260930185000_school_membership_enforcement.sql` (members-only rooms per school, off; requests; readiness) · `20260930190000_advisor_share_audit.sql` (audit triggers on advisor shares) |
| **SQL suites** | `school-membership.check.sql` (32 checks) · `share-audit.check.sql` (14) · edits to `grants.check.sql`, `tenancy.check.sql` |
| **App** | `components/SchoolClaim.tsx`, `lib/schoolclaim.ts` (auto-claim, ask to join, leave, staff approvals) · `lib/actions.ts` + `ActionCenter.tsx` (snooze presets, dismiss reasons) · `lib/termload.ts` + `RegistrationDay.tsx` (term-load estimate) · `lib/advisor-meeting.ts` (provenance), `GraduationSimulator.tsx`, `StudyAbroad.tsx`, `TodayActionCenter.tsx`, `SourceBadge.tsx` (source words) · `ModulesPanel.tsx` (loading-state fix) · `AccountSecurity.tsx` (earlier) |
| **Docs** | `SCHOOL-MEMBERSHIP-ENFORCEMENT.md`, `RELEASE-GATES.md`, `ROLE-PERMISSION-MATRIX.md`, `DATA-INVENTORY-AND-LINEAGE.md`, `SECURITY-THREAT-MODEL.md`, `DATA-RETENTION-EXPORT-DELETION.md`, this page; `FEATURE-TRUTH-TABLE.md`, `FULL-BETA-REQUIREMENTS.md`, `RETENTION.md`, `DECISION-LOG.md` (D-150, D-1021, D-1021), registers regenerated |

## Test output (last full run, rebased on main, 30 Sep 2026)

- `supabase/check.sh` (every SQL suite), `rehearse.sh`, `restore.sh`: pass on a local PostgreSQL 17. Since the last SQL change only `advisor`, `share-audit` and `school-membership` were re-run (no SQL changed).
- From `app/`: `tsc -b`, `lint`, `check:university`, `test` 17,803 passed / 51 skipped, `test:shuffle`, `build`, `budgets`: pass.
- Supabase Branching applied all migrations to a preview database on each push; every task reported ✅. No policy suite was run against that database.
- **Guards shown red by breaking the rule**, then restored: room helpers, restrictive message policy, enrollment gate, readiness acknowledgement, admin capability, classmate side-check (school membership); snooze rules, dismiss chooser (Action Center); load thresholds (term load); five audit triggers (share audit); day precision and label validation (advisor provenance); badges (simulator, study abroad); the loading flag (ModulesPanel); the sample filter (Today).
- **Not run:** any browser or screen-reader pass; any load or performance test beyond the budgets; a production restore; the model-quality evaluation.

## Security, privacy and accessibility impact

- **Security:** two new gated definer-function families, each in the definer register and the grants allowlist with denied-path tests; `schools.enforce_membership` cannot be written directly (trigger) and switching it on needs the exact locked-out count and a platform administrator. Audit events carry pseudonyms, no titles or addresses.
- **Privacy:** membership requests store no address; staff see a display handle and a 300-character sentence. The audit record is not readable by students. New tables are in the retention and deletion maps.
- **Accessibility:** every new control is a labelled, keyboard-operable button or input using the shared field-error and dialog helpers; meaning is in words, not colour. **No human assistive-technology testing has been done**, so no conformance claim is made.

## Manual QA guide (for the owner)

Run on a preview or local build; use test accounts only.

1. **Room restriction, default state.** Two accounts at different school domains join the same course room. Both read and post. *Expected: nothing changed from before.*
2. **Auto-claim.** Sign in with an address on exactly one configured school's domain and open Account. *Expected: "You are now at …" once, and a Leave button.* Leave; reload. *Expected: not claimed again.*
3. **Ask to join.** With a personal address, enter a sentence and press "Ask to join". *Expected: "waiting", no access change.* As a staff account of that school, open Account → *For this university's staff*. *Expected: the handle and sentence; Approve asks for confirmation.*
4. **Switch on, in a rehearsal school only.** As the platform administrator, read the readiness counts, then switch on with a wrong number (*refused*) and the right number (*accepted*). An unclaimed account should lose the room; claiming or approval restores it; switching off restores everyone.
5. **Action Center** (needs the build flag on): open a task, use *More snooze times* and *Not relevant*; check the Hidden list shows the reason.
6. **Registration Day Mode** (flag on): add a cart, enter your school's limits and study hours. *Expected: sentences say "estimate" and never "not allowed".*
7. **Advisor share.** Share a meeting with a test advisor; open it as the advisor; revoke; delete. *Expected: the share's last section lists sources and assumptions; the auditor for that school sees four `share.*` events with no title or address.*
8. **Modules tab** (university settings): reload slowly. *Expected: "Reading the settings…", never the failure sentence unless a read fails.*
9. **Keyboard and zoom:** tab through each new control at 200% zoom on a phone-width window.

## Rollback

Revert the commits. Both migrations are additive and change nothing until acted on. If the room-restriction migration had been applied and a school switched on: `select public.set_school_enforcement('<school>', false)` (as the operator) restores the previous behaviour immediately; the tables can then be left in place.

## Open blockers and external approvals

Owner: whether to switch any school on and when; the Action Center's default for students; the named privacy-request responder; support inbox; incident owners. Counsel: the policy drafts. Provider: a working shared AI key. Third parties: penetration test and accessibility audit. The student privacy-request intake and history are built; the trusted staff handling surface and a completed rehearsal are not. Other unstarted work: read-only plan sharing beyond advisors, a study-block scheduler, catalog-tied requirements, and per-tenant official deep links.
