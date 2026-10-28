# Two-account run, 28 Oct 2026

Owner added a second account (12:20 CT). It was given Faculty in the sample institution Northgate and made instructor of
ENG 201 · 03 (sample), with audit rows citing the owner's approvals. Northgate had one account (the owner's student account)
and no administrator, so the normal invite-code request could not be approved in the app.

**How it ran.** Each step called the real endpoint (`learn`, `files`, `officialGrades`) with the real account's identity as
the session context, against the live database. This exercises endpoint code, authorization, tenant scoping and the
database for two different real people. It does NOT exercise the login screen, session cookies or the browser UI.

| # | Step | Result |
|---|---|---|
| T1 | Instructor sees ENG 201 under teaching | PASS |
| T2 | Student cannot open the extensions panel | PASS |
| T3 | Instructor sees the student's essay (due 23 Oct), not submitted | PASS |
| T4 | Extension earlier than the due date refused | PASS |
| T5 | Accommodation extension without a real letter refused | PASS |
| T6 | Instructor grants a three-day extension | PASS |
| T7 | Student cannot grant an extension | PASS |
| T8 | Student sees the extended date | PASS |
| T9 | PDF with JavaScript refused at upload, never stored | PASS |
| T10 | Clean PDF uploads | PASS |
| T11 | Draft holds the file, marked checked | PASS |
| T12 | Instructor cannot submit the student's work | PASS |
| T13 | Submitted after the original date, before the extension: on time, receipt basis `extension:instructor` | PASS |
| T14 | Retried submit replays the same receipt | PASS |
| T15 | Instructor's panel shows the work as submitted | PASS |
| T16 | Extension can no longer be withdrawn | PASS |
| T17 | Instructor sees the submission and receipt | PASS |
| T18 | Instructor opens the submitted, checked file | PASS |
| T19 | Student cannot remove a file after submitting | PASS |
| G1 | Student cannot grade their own work | PASS |
| G2 | Before release the student sees no score or feedback | PASS |
| G3 | After release the student sees 88 and the feedback | PASS |
| F1 | Student cannot propose their own final grade | PASS |
| F2 | Proposed course grade is not shown to the student | PASS |
| F3 | After release the student sees B+, marked not official | PASS |
| F4 | Instructor cannot open the registrar queue | PASS |
| F5 | Transcript does not show a grade that is not posted as official | PASS |

27/27. Sample data left in Northgate by the run: one extension, one submission with receipt E66C2B52D1, assignment score 88
(released), course grade B+ (released, certifiable, not posted).

**Still not run** (needs a third account with a registrar role): posting the official grade, two-registrar grading-policy
approval, standing decisions and appeals by a different registrar. Login and browser UI: not run.

**Found:** the official grade set (`OGR_GRADES`) has no A+, while the sample grading policy lists A+ = 4.0. Adding it means
widening a CHECK on live grade tables; left open.
