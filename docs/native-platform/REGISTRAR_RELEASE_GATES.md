# Registrar release gates

**As of** 2026-10-06 · **Status** measured, not a pilot. The LMS stays the grade record. The SIS stays the enrolment record. No transcript function is added.

## What already refuses a write

`public.gradebook_release` (`supabase/migrations/20260929310000_gradebook.sql`) and `release` in `app/src/lib/gradebook/ledger.ts` share one order:

1. `grades:release` (`private.gradebook_require` / `holds(actor, 'grades:release')`). A caller without it gets the same book back. No `grade_entries` row and no `gradebook_operations` row.
2. When the scheme's `moderation_required` is true, a draft that is not `moderated` is held. That moderation is the approval: a second person, not the grader. If nothing on the item clears it, the book is unchanged.
3. Only then does `private.gradebook_spend` / `keepOperation` record the release.

`public.registrar_decide` and `decide` in `app/src/lib/enrollment/service.ts`:

1. `private.registration_registrar()` raises unless the caller holds `registration:administer`. The pure model returns the same ledger when the caller is not in `ctx.registrars`.
2. A decision needs a reason, and an approval is re-checked against the blockers as of now.
3. Deny and approve each write `registration_audit` (the pure model writes one audit event: `denied`, or the resulting state). A refusal writes none.

`app/src/lib/registrargates.test.ts`, `gradebook.test.ts`, and `enrollment.test.ts` hold this. Deleting the capability return or the moderation hold fails those tests. The SQL check files (`supabase/gradebook.check.sql`, `supabase/registration_transaction.check.sql`) are the database copy and were not run here.

This is not a second approval table. When a scheme does not require moderation, `grades:release` is the only grade gate, which is the scheme the school stored.

## Still off

**Co-requisites.** The engine's order is window, hold, duplicate, prerequisite, clash, credit limit. There is no co-requisite rung and no `corequisite` override. Catalog text can name one (`app/src/lib/course-detail.ts`); that reading does not block a seat. N-4 in `docs/master/SEMESTER_NATIVE_PDF_DELTA.md` is still an open product decision. This pass does not add the rung and does not write a decision to add it.

**Time-ticket issuance.** `public.registration_time_tickets` is the student's own copy, and the registration migration says it cannot decide when somebody may enroll. The server enforces the term opening. `StudentFacts.ticketAt` delays a window only when a caller already passes a verified ticket. There is no registrar function that issues or staggers tickets. None is added here.

**Transcripts.** No `public` function in the gradebook or registration migrations is a transcript. Existing exports that say "Not an official transcript" stay as they are.
