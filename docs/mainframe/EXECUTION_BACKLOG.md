# Execution backlog

Phases follow the mainframe PDF. The operations roadmap’s P0 line (safe delivery, not thirty-three consoles) still wins when the two disagree about what to build next.

## Done

- Phase 0 records in `docs/mainframe/`, traced to code and to `docs/operations/`.
- Device registration plan on first run, listed on the Term plan, labeled as not an enrollment.
- Readiness row `named`, separate from the cart’s primary schedule. A syllabus-sourced course is not counted as named.
- Ecosystem connection map in `ECOSYSTEM_CONNECTIONS.md`, from `docs/specifications/connected-ecosystem.pdf`.
- Advisor handoff without a caseload. From the readiness checklist, each named code is written as one agenda line on the student’s own meeting (`meetingWithNamedAgenda`). The meeting tab is Degree’s Advisor meeting, and only when `advisor_meeting_mode` is on. Screen `meet` is glossary overlap and is not this handoff. Notes, questions, and attachments stay untouched. Nothing is shared and no advisee grant is created.

- Source and freshness on the cart (11 October 2026). After a catalog import, each named code is held against the file (`matchNamed` in `path-readiness.ts`): a matched code shows its section count and a way to find them, an unmatched one stays listed as unmatched, and the import message counts them. Nothing is added to the cart and no seat is implied. Matching is by code, ignoring case and spacing; the typed term is shown, not enforced.

- Advisor check-ins on a share (11 October 2026, D-1448). An advisor on a live share records a note and up to five next steps; a retry with the same draft key records one check-in; the student adds steps to their own actions and may delete a check-in. The migration is not applied to any hosted database.

## Next, in dependency order

1. **Hold-release notice** (Student finance #12): through `push` and `support-reply-notify`.
2. **A standalone success plan** (Advising & student success #6, the rest of it), on the same share grant as the check-ins. No staff caseload store until scope question Q1 in `docs/master/SEMESTER_ECOSYSTEM_INVENTORY.md` is answered.
3. **Security closure OP-01.** Only with explicit approval to add a migration and only against a non-production database the operator names. Do not infer a project id.

## Not in this backlog yet

Placeholder consoles, new domain tables for every engine, native iOS or Android, marketplace, authority transfer, and any charge or official grade.

## Stop conditions

Production mutation, remote migration, destructive git, a second permission model, or a policy choice the roadmap lists as an open decision (OD-1 through OD-9).
