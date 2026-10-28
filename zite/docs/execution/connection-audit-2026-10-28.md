# Ten-app connection audit (owner sources S-83 to S-88, 28 Oct 2026)

The owner's registry and register (S-83, S-85) list 23 connections, all `not_assessed`, with app ids left blank. This
audit maps each one to the actual build. The machine-checked version is `apps/semester/src/lib/connectionRegister.ts`;
`apps/semester/tests/connectionRegister.test.ts` fails if a cited file is missing or a status outruns its evidence.

## Result

| Status | Count | Connections |
|---|---|---|
| Observed passing | 3 | C01 teaching assignment, C03 published learning and released feedback, C04 submission attempt |
| Partial | 8 | C02 enrollment and holds, C05 final grades, C07 submitted application, C08 published decision, C12 family projection, C13 employer opportunity, C14 student application to employer, C21 lab → company evidence |
| Built, not yet exercised | 5 | C09 applicant → student, C10 student → family grant, C17 and C18 developer integration, C20 company support access |
| Missing | 7 | C06 site → applicants, C11 family payer, C15 institution employer approval, C16 faculty-verified portfolio evidence, C19 institution → company readiness, C22 lab → institution evidence, C23 institution → site publication |
| Failing | 0 | |

Readiness dimensions are kept apart, as S-88 §11 asks. **Deployed: not assessed** (no app was published from this
session). **Institution-authorised: no** (the only tenant is the sample institution Northgate). **Production-enabled: no.**

## Found and fixed in this increment: the hold-release journey (S-86 §3, S-88 §6)

The Institution app lifted the hold in the Student Holds record, which registration enforces on submit. But the student's
Today, Help and registration panel, the advisor share and the family view all read holds from a different store (tasks of
type Hold). So a hold lifted by staff did not change what the student saw, and a hold placed by staff did not appear until
submit refused. The one task-type hold in the data, "Advising hold blocks registration", blocked nothing.

Now:
- All five student-facing readers use `lib/holdServer.ts holdsFor`, which returns only active Student Holds and only
  student-facing fields (`lib/holdRules.ts holdView`). Student accounts staff list and request releases against the same
  record.
- Releasing needs the owning office's approved role template, or an administrator (`releaseRefusal`). The plain Staff
  role and instructors cannot.
- One release per hold (`lib/hldMigration.ts hld_claim`): the first claim wins, the same person's retry resumes, anyone
  else is told it is already lifted.
- The student gets an in-app notice that reports the outcome and how many other holds still block registration. It never
  promises registration. If the notice fails, the release stands and the failure is recorded.
- Registration still re-reads every active blocking hold on each submit.

Evidence, 28 Oct:
- `apps/semester/dbchecks/holds.ts`: 13/13. Three mutants are caught: second releaser wins (4 fails), cross-tenant resume
  (1 fail), self-release (the table CHECK refuses it). Nothing is left behind.
- `apps/semester/tests/holdRules.test.ts`: 7/7.
- Real accounts, endpoint level, 7/7, with one sample Bursar hold placed on the sample student and deleted afterwards:

| # | Step | Result |
|---|---|---|
| R1 | Legacy task holds no longer show as holds on Today | PASS |
| R2 | The real hold is first on the student's Today, with its student-facing message | PASS |
| R3 | Help lists the same hold | PASS |
| R4 | Registration readiness shows the same hold | PASS |
| R5 | The instructor cannot lift it | PASS |
| R6 | The student cannot lift it | PASS |
| R7 | The refused attempts changed nothing | PASS |

**NOT RUN:** a permitted release by a real registrar, the notice reaching the student, and the duplicate-release race over
HTTP. Each needs a third account holding an approved registrar template. The database check covers the race.

## Also observed today: assignment publication (C03, S-87 workflow 1)

Two real accounts, 11/11. The student cannot create an assignment and does not see the draft. A publish that does not match
the previewed version is refused. Version 1 is published to the one enrolled student, and the student sees version 1. An
unpublished revision does not reach the student. Version 2 updates the same student task and says what changed. History
keeps version 1 exactly as published. The student cannot read drafts or history.

## S-87's eight workflows against the build

| # | Workflow | Status |
|---|---|---|
| 1 | Faculty publishes → enrolled student sees it | Observed 28 Oct (above) |
| 2 | Student submits → assigned instructor sees the exact attempt | Observed (signed-in run T10–T18) |
| 3 | Draft grade hidden from the student | Observed (G2, F2) |
| 4 | Released feedback visible | Observed (G3, F3) |
| 5 | Institution assigns instructor → Faculty access | Observed for the current instructor (T1, dbchecks/sectionRequests 21/21); dated expiry not modelled |
| 6 | Confirmed enrollment → schedule and roster agree | Not run with separate accounts in this audit |
| 7 | Hold release → record, student view, notice, eligibility | Fixed today; permitted release NOT RUN (needs the third account) |
| 8 | Final grade → Institution applies → student sees the official result | Proposal, release and certification observed; registrar posting NOT RUN (needs the third account) |
