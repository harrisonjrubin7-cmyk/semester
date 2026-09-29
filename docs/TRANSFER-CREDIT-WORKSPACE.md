# Transfer credit workspace: sprint E3

**Flag:** `transfer_credit` (`VITE_TRANSFER_CREDIT`). Off by default
(D-012). With it off, The degree has no Transfer credit tab.
`Degree({ transferCredit })` defaults to the flag, so tests can choose.

**Destination:** The degree → `degree` › **Transfer credit**.

**Server:** reads only. It adds no migration and makes no write.
`articulation_rules` and `transfer_evaluations` came in
`20260926150000_expansion_roles_and_features.sql`.

This is the workflow `lib/transferhub.ts` listed as missing: *"no screen lists
prior courses, maps them against a published pathway or assembles a packet."*

## What the student does

1. Lists each course they took elsewhere: school, code, title, credits, grade
   and term.
2. Sees what each might count as here, labelled one of four ways (below).
3. For a course with no published equivalency, types what they think it
   counts as, plus a note for the evaluator.
4. Optionally imports a pathway CSV (`from_institution, from_course,
   to_course, credits`), such as a state transfer guide.
5. Ticks the documents checklist: transcript, course descriptions, exam
   scores, JST and the evaluation deadline.
6. Downloads the packet as plain text. It lists every course with its label,
   the open questions and the documents.
7. Records the date they sent it. Unpublished matches then read as *Pending
   review*.

## The four labels (brief §14), and what each means

| Label | When | Meaning shown to the student |
|---|---|---|
| Published equivalency | An `approved` `articulation_rules` row at the student's own school names the same school and course | Your school has published this equivalency. Your official evaluation still confirms it for you |
| Estimated equivalent | The student's own guess, or a row from an imported file | Not checked by your school |
| Pending review | The student recorded that they sent the packet | Wait for the school's decision |
| Not evaluated | Nothing yet | Include a description or syllabus in your packet |

"Transfers", "guaranteed" and "approved for you" appear nowhere. A test checks
the packet for them.

## Boundaries, and the tests that hold them

| Boundary | Held by |
|---|---|
| Only `approved` rules are treated as published, both in the query and again in `fromPublished` | `transfer-credit.test.ts` |
| A stored row can never claim to be published. Published rules are read fresh and never saved | `readTransferCredit` refuses one. Tested |
| A course matches only a rule for the same school and course (codes and names normalised) | `transfer-credit.test.ts` |
| Writes to no table. The reader selects from `articulation_rules` and never inserts, updates or deletes | `transfer-credit.test.ts` reads both source files |
| Works with no account: device-only, with a sentence on how to see published rules | `TransferCredit.test.tsx` |
| Every control has a name | `TransferCredit.test.tsx`, and `npm run lint` (labels) |

## Storage

`semester.transfer-credit.v1` holds the prior courses, imported pathway rows,
guesses, the documents checklist and the sent date. The key sits under the
`semester.` prefix, so sign-out erasure (`lib/erase.ts`) removes it.

It writes nothing to `transfer_evaluations`. A student-side row would be a
second copy of a decision that only the institution makes. When a school
connects its evaluation system, that table is where the decision arrives,
through the service role.

## Files

| File | Purpose |
|---|---|
| `lib/transfer-credit.ts` | Validation, matching, labels, totals, pathway CSV, questions, packet |
| `lib/transfer-published.ts` | The one read of `articulation_rules` (approved only) |
| `components/TransferCredit.tsx` | The tab |
| `screens/Degree.tsx` | The tab, behind the flag |
