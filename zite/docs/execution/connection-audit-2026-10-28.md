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

## Built 28 Oct (second increment): employer partnerships and student-chosen sharing (C13, C14, C15)

Before this, every student saw every opportunity from any employer, and employers saw every applicant's public
portfolio and email. Now:
- An employer asks each institution separately (Employers → Institutions).
- Staff at that institution approve, decline or revoke the request (Institution → Employer partnerships). The table
  refuses an employer approving itself, and refuses a decision made on an out-of-date version.
- Students see opportunities only from employers their institution has approved. Applying directly by id is also
  refused.
- When applying, the student ticks the portfolio items to share and chooses whether to share their email. The employer
  sees the name and only what was ticked.

Evidence:
- `apps/semester/dbchecks/careerPartners.ts`: 19/19. Three mutants are caught: share without approval, approval treated
  as global, stale decision. Nothing is left behind.
- Real accounts, endpoint level, 9/9. The faculty account acted as the employer. The test posting and the request were
  removed afterwards.

| # | Step | Result |
|---|---|---|
| E1 | Employer posts an opportunity | PASS |
| E2 | Student does not see an employer their institution has not approved | PASS |
| E3 | Unverified sample listings are no longer shown | PASS |
| E4 | Applying directly by id is refused | PASS |
| E5 | Employer sees Northgate as not requested | PASS |
| E6 | The request is pending | PASS |
| E7 | An instructor cannot open employer partnerships | PASS |
| E8 | The student cannot approve the employer | PASS |
| E9 | A pending request still shows the student nothing | PASS |

**NOT RUN:** approval by a real staff account, and the approved application end to end. Both need the third account.

## Built 28 Oct (third increment): admissions review and public programs (C06, C07, C08, C23)

Before this, any staff member saw every application, and recording a decision showed it, with its note, to the applicant
at once. Now:
- An administrator assigns each application to a reviewer. A reviewer sees only the applications assigned to them.
- The reviewer drafts a decision with an internal note and a separate applicant message.
- Nothing reaches the applicant until the decision is released. Release is version-checked and happens once.
- Release activates the Student membership for an admit and sends an in-app notice.
- Catalog managers write public program listings in Institution → Public programs. Nothing is public until it is
  published, and an edit takes a listing back to draft.
- The public site's Programs page shows only published listings, with public fields only. Its Apply button opens
  Applicants with the institution and program prefilled.

Evidence:
- `apps/semester/dbchecks/admissions.ts`: 17/17. Three mutants are caught: any reviewer decides, release without a
  draft, release of an unreviewed version.
- `apps/semester/dbchecks/publicPrograms.ts`: 9/9. The "edit stays published" mutant is caught.
- Real accounts, endpoint level, 8/8:

| # | Step | Result |
|---|---|---|
| A1 | Signed out, the public site lists programs with only the public fields | PASS |
| A2 | An instructor cannot write a public program | PASS |
| A3 | A student cannot open public programs | PASS |
| A4 | A student cannot open the admissions queue | PASS |
| A5 | The applicant cannot decide their own application | PASS |
| A6 | The applicant cannot release a decision | PASS |
| A7 | The applicant sees Submitted and no decision text | PASS |
| A8 | Another person cannot touch the application | PASS |

The test application was marked submitted directly, standing in for a submit with an uploaded transcript, and was
deleted afterwards.

**NOT RUN:** assignment, drafting and release by real staff, publishing by a real catalog manager, and the Apply
redirect in a browser. The Applicants address is not set in the app directory yet.

## Built 28 Oct (fourth increment): verified evidence and the family billing view (C10, C12, C16)

- A student asks an instructor of a section they took to verify one of their own portfolio items (Career → Verified
  evidence). The instructor answers from Faculty → Today with a bounded statement or declines. The student can withdraw
  the claim. It reaches an employer only together with an item the student chooses to share.
- Family sharing gains a Billing category. It shows per-term balance and next due date only.

Evidence:
- `apps/semester/dbchecks/portfolioVerify.ts`: 12/12. Two mutants are caught: any instructor verifies, and the student
  asks an instructor of a section they did not take.
- `apps/semester/tests/billingRules.test.ts`: 2/2.
- Real accounts, 10/10. A test portfolio item was created and deleted afterwards. The family contact was the faculty
  account. The share was revoked by marking the consent record revoked, not through the privacy screen.

| # | Step | Result |
|---|---|---|
| P1 | The student can ask an instructor of ENG 201 | PASS |
| P2 | Someone else cannot ask about the student's item | PASS |
| P3 | The instructor sees the request in Faculty | PASS |
| P4 | The student cannot verify their own item | PASS |
| P5 | The student sees the verification | PASS |
| P6 | The student withdraws it | PASS |
| F1 | Before sharing, the family contact sees nothing | PASS |
| F2 | A Billing-only share shows balances and nothing else | PASS |
| F3 | Only term, balance and next due date are shown | PASS |
| F4 | After revocation the family contact sees nothing | PASS |

## Built 28 Oct (fifth increment): sanitised releases across the company and assurance boundaries (C19, C21, C22)

There is one mechanism, `lib/releaseRules.ts`, and it copies an explicit allowlist of fields.
- An institution administrator chooses to share readiness check states with Semester (Institution → Access &
  connections). No detail text, counts of people or records are shared. Sharing can be stopped.
- A Security lead releases a capability's coverage, meaning which stages have evidence and in which environments, to
  Company OS and to institution administrators (Security Lab → Evidence releases). Summaries, references and reviewers
  never leave the lab, and any production evidence blocks a release.
- Company OS reads only these released snapshots (Customers → Readiness & assurance).

Evidence:
- `apps/semester/tests/releaseRules.test.ts`: 3/3.
- Real accounts, 11/11:
  - The instructor is refused all four entry points (lab releases, Company OS evidence, readiness sharing, assurance
    evidence).
  - The student-role account is refused readiness sharing and assurance evidence.
  - Run over all 131 real capabilities and 22 evidence rows, the sanitiser produced only the six allowed fields, and none
    of the 44 evidence texts appeared in any snapshot.
  - The founder account reads the release list and the company snapshots, and a withdrawal of something never released
    is refused.
- Note: the account used as "the student" in these runs is also the founder account, which holds 12 company roles. That
  is why it was correctly allowed into the lab and Company OS.

**NOT RUN:** a real readiness share (needs an institution administrator), and a real assurance release. A release
publishes evidence to institutions, so it waits for your approval.

## Sixth increment, 28 Oct: developer platform and company support access (C17, C18, C20)

**Found and fixed:** the Developers app showed "the developer platform update hasn't reached the database yet" for
every developer. Its tables were created only when an institution administrator opened Developer apps in Semester. Its
`sandbox` and `platform` endpoints now create the tables themselves (the same idempotent migration).

Real accounts, 17/17. The faculty account acted as the developer, and the founder account as company reviewer and
support agent. All data was synthetic, in the sandbox tenant. The test app was left suspended with its token revoked,
and the support request was revoked.

| # | Step | Result |
|---|---|---|
| D0 | The Developers app sets up its own tables | PASS |
| D1 | A developer registers a sandbox app | PASS |
| D2 | A forbidden scope (grades:read) cannot be requested | PASS |
| D3 | A sandbox token is minted; only its hash is stored | PASS |
| D4 | Nobody else can mint tokens for the app | PASS |
| D5 | A call with the granted scope returns synthetic data | PASS |
| D6 | A scope that was not granted is refused (403) | PASS |
| D7 | A forged token is refused (401) | PASS |
| D8 | A developer without the reviewer role sees no other apps | PASS |
| D9 | When company review suspends the app, its next call fails | PASS |
| D10 | A revoked token fails on its next call | PASS |
| D11 | An instructor cannot install an app for the institution | PASS |
| D12 | A student-role member cannot install an app for the institution | PASS |
| S1 | A support agent requests time-limited, scoped access | PASS |
| S2 | Before an administrator approves, the agent sees nothing, and the attempt is logged | PASS |
| S3 | An instructor cannot approve support access | PASS |
| S4 | The requesting agent, who has no administrator role, cannot approve | PASS |

**NOT RUN:** an institution install by an administrator, and approval of support access followed by the time-limited
view. Both need an administrator account.

## Seventh increment, 28 Oct: multiple submission attempts (C04)

The assignment editor already offered "Attempts allowed", but submission refused any second attempt. Now:
- `sbm_submit` reads the allowance from the current published version, serialises a student's attempts on a task, and
  refuses once they are used up.
- Each receipt is numbered. A retry replays the same attempt rather than creating a new one.
- A task with no linked assignment keeps one attempt, as before.
- The student sees "Start attempt N of M" while attempts remain, and the instructor sees every attempt to grade.

Evidence:
- `apps/semester/dbchecks/attempts.ts`: 8/8. The unlimited-attempts mutant is caught.
- Submissions still 27/27 and assignments still 16/16. The assignment check's receipt mutant was updated to match the
  new insert, and it is caught again.
- Real accounts, 7/7. The test assignment "Lab report (attempts check)" and its two receipts stay in the sample
  institution, because receipts cannot be deleted.

## Eighth increment, 28 Oct: Employers and Family on the shared Semester shell (owner source S-89)

S-89 asks that Employers and Family be role-specific Semester experiences, not separate-looking portals. Its first
milestone is the shared shell plus one complete workflow in each. Now:
- Both apps use `components/AppShell.tsx`, the same shell as Semester, Faculty and Institution. That gives the same
  sidebar, search (⌘K), notifications, account menu and app switcher. Their Tailwind builds now include the shared
  components.
- **Employers.** Today is the landing page. It shows the next action, live opportunities and new applications,
  institution approvals, and a setup checklist, all counted from this account's own postings and requests. The sidebar
  has Recruit → Opportunities & applicants, Connect → Institutions, and Fund → Scholarships.
- **Family.** Today shows the sharing summary with its end date, an "ending within a week" notice, the next shared
  event, holds, and balance due. Each appears only for categories the student shared. The sidebar has Shared record and
  Sharing & access history; the latter shows the recipient's own views. The empty state explains how sharing works and
  never offers a way to find or pressure a student.
- The two complete workflows already exist and were run earlier today: employer posting → student application (E1–E9),
  and student share → family view → revocation (F1–F4).

Evidence:
- All 10 apps type-check.
- Real accounts, 3/3: the recipient sees their own view history with three fields only, another account sees only its
  own, and after revocation the recipient's Today has nothing shared.

**NOT RUN:** browser screenshots of the new shells.

**Not built from S-89 yet:**
- Employers: interviews, offers, talent network, events, projects, mentoring, team roles (recruiter, interviewer and so
  on), and per-posting re-review.
- Family: shared tasks and documents, and the invitation-acceptance step (sharing is currently by email match).

## Ninth increment, 28 Oct: Applicants on the shared shell, with versioned submission packages (owner source S-90)

S-90 asks for Applicants to be the admissions and enrollment-entry experience inside Semester. Its first milestone is a
real journey: start, complete the requirements, preview the exact package, submit, get an authoritative receipt, and
see the checklist update.

Now:
- **Shell.** Applicants uses the shared AppShell, with Today, Explore → Programs and Apply → Applications.
- **Today.** It names the next action and why (for example, "Still missing: transcript"), shows draft and received
  counts, and lists recent decisions.
- **Programs.** It lists only programs that institutions published, and "Start an application" prefills the choice.
- **Operating modes (S-90 §2).**
  - An institution with a published, accepting program takes applications through Semester ("native").
  - Any other institution is "planning": the copy says to submit through its own channel, and submit is refused.
- **Submit.**
  - "Review & submit" shows exactly what the institution receives and requires an attestation.
  - `apk_submit` accepts only a package whose hash matches the preview, once per request key, and once per
    application.
  - The package is append-only. In native mode the package row is the institution's receipt, so the receipt is recorded
    in the same transaction.
- **Status.** Each application shows four separate dimensions: preparation, delivery, processing and decision.
  "Received" appears only with a receipt.

Evidence:
- `apps/semester/dbchecks/applicationPackages.ts`: 11/11. Two mutants are caught: submitting an unpreviewed package,
  and a planning-mode institution receiving a submission.
- `apps/semester/tests/applicationRules.test.ts`: 4/4.
- Real accounts, 6/6. The test application was deleted afterwards. In that run, the forged-preview submit was refused
  for the missing transcript first, so the preview match is proven by the database check.

**NOT RUN:** a real native submission end to end, which needs a catalog manager to publish a program at Northgate, and
browser screenshots.

**Fixed the same day (it was against a standing rule):** application documents no longer upload to public-by-link
storage.
- They are screened and stored in the private file store (`fil_*`), linked to the application in `apk_documents`.
- The package references file ids, not links.
- The applicant opens their own documents. Staff open them through admissions only as an administrator or the assigned
  reviewer, and each read is logged.
- Earlier public-link uploads are listed as legacy and never sent.

Real accounts, 10/10:

| # | Step | Result |
|---|---|---|
| P1 | A PDF with JavaScript is refused and never stored | PASS |
| P2 | A clean transcript is stored in the private file store | PASS |
| P3 | It is screened and marked clean | PASS |
| P4 | The applicant opens their own document | PASS |
| P5 | Another person cannot open it | PASS |
| P6 | An instructor cannot open it through admissions | PASS |
| P7 | The application lists the document (no link) and the checklist is complete | PASS |
| P8 | The package references the private file id | PASS |
| P9 | With a valid preview, a planning-mode institution still cannot receive it | PASS |
| P10 | A forged preview hash is refused | PASS |

In P10 the planning-mode refusal came first, so the forged-hash rule rests on the database check (K4). The test file
and application were deleted afterwards.

**Not built from S-90 yet:**
- recommendations;
- the writing workspace with version history;
- costs and fees;
- offer response and enrollment conditions;
- applicant-scoped family sharing;
- connected-admissions connectors.

## Tenth increment, 28 Oct: recommendations (C07, owner source S-90 §5F)

The applicant names a recommender and an email. Only the signed-in account holding that email can accept, which binds the request to that account; it then uploads one PDF letter into the private, screened file store under its own ownership. The applicant sees verified status only (requested, accepted, declined, submitted, withdrawn) and never the letter. Semester sends no outside email: a recommender without an account is told to sign in to Semester Applicants. Admissions opens a letter only as an administrator or the reviewer assigned to that submitted application, and every read is logged. Every step is written to an append-only log.

- Database check `dbchecks/recommendations.ts`: 22/22. Mutant "any account accepts" fails 8 checks (R7 among them); mutant "letter owned by someone else" fails R13 and R14. Nothing left behind.
- Live, through the real endpoints (faculty account as applicant, the second account as recommender): 13/13. Another account cannot ask on the application or accept the request; the inbox shows it only to the invited email; accept → submit works; a second letter is refused; the applicant's view carries no letter; both accounts are refused by admissions `openLetter` because neither holds an admissions role. The test draft was withdrawn afterwards; its request and letter record remain because the log is append-only.
- NOT RUN: a reviewer or administrator opening a letter (needs the third account); browser screenshots.
