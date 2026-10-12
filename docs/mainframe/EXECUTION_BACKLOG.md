# Execution backlog

Phases follow the mainframe PDF. The operations roadmap’s P0 line (safe delivery, not thirty-three consoles) still wins when the two disagree about what to build next.

## Done

- Phase 0 records in `docs/mainframe/`, traced to code and to `docs/operations/`.
- Device registration plan on first run, listed on the Term plan, labeled as not an enrollment.
- Readiness row `named`, separate from the cart’s primary schedule. A syllabus-sourced course is not counted as named.
- Ecosystem connection map in `ECOSYSTEM_CONNECTIONS.md`, from `docs/specifications/connected-ecosystem.pdf`.
- Source and freshness on the cart (first half). After a catalog import, each code the student named that no section in the file carries is listed on the `named` readiness row as unmatched, with the institution the catalog came from, until a later import carries it (`unmatchedNamed` in `app/src/lib/path-readiness.ts`, matched by code regardless of case and spacing). It changes no state: on the agenda is still ready, and the cart is untouched, so no seat is invented.
- Ecosystem coverage matrix (Phase 0 of `docs/handoff/execute/30-phased-build.md`): every prototype route (281) and design-registry capability (122) on the seven-level ladder from repository evidence, generated and held in step by `app/src/lib/docs/ecosystem.test.ts` (`docs/ecosystem/`, `docs/registry-status.json`). The production database's applied-migration list was compared to the repository by digest and matched; the production app was not probed.
- Advisor handoff without a caseload. From the readiness checklist, each named code is written as one agenda line on the student’s own meeting (`meetingWithNamedAgenda`). The meeting tab is Degree’s Advisor meeting, and only when `advisor_meeting_mode` is on. Screen `meet` is glossary overlap and is not this handoff. Notes, questions, and attachments stay untouched. Nothing is shared and no advisee grant is created.

## Next, in dependency order

0c. **Phase 4 remainder** (`docs/execute/34-phase-4-institutional-operation-report.md`): owner-only — define G01/O01/O02 and their approval reference; read the live project's backup tier, retention and PITR off the dashboard and decide the PITR add-on; authorize a timed restore of a real backup onto a non-production project with a witness; stand up staging (`infra-apply.yml` needs the state bucket) and rehearse a rollback on it; name support and on-call owners, backups and hours; sign or fill the council seats; apply branch protection; the BUILD.md §7 acts. Engineering, unblocked — an admin UI that calls `integration_approve_*`/`integration_revoke_*`; the SSO/SCIM admin screens once the prototype is re-supplied; history for `institution_identity_provider`; an outbox event for provisioning and deprovisioning; a map from the council's 12 gates to the plan's 11; NRPS; a per-domain system-of-record record; the stream 29 release register brought in from the prototype.
0d. **Phase 5 remainder** (`docs/execute/35-phase-5-enable-and-replace-report.md`): owner-only — define the ladder (eight stages and eight cutover items against the Migration Center's twelve, the rollout's ten and the module mode's two); decide whether Core may be enabled before a completed cutover and which module maps to which migration domain (`P5-R3`); a payment provider account and webhook secret (`P5-N13`); legal review of the site's draft pages; the `docs/system` PDFs and prototype files streams 27 and 29 cite; a mail domain and deliverability; a media hash provider. Engineering, unblocked — a reason field on a Migration Center back-move; a domain event for its stage changes; a usernames primitive with a reserved list (`P5-S33`); a consent column on `site_leads`; an attempt limit and revoker for `consume_handoff`; a forwarded-address rule for the lead-intake rate limit once the platform's header handling is known.
0b. **Phase 3 remainder** (`docs/execute/33-phase-3-cross-role-report.md`): decisions on submissions (A1), named help-request owners (C1), the coach role (D1), family grant history (E2); vendor access for Handshake and Big Interview (D3, D4); a mid-write failure test against a real database (F3); the cart's own view of catalog age (the headline now has it).
0a. **Phase 2 remainder** (`docs/execute/32-phase-2-daily-loop-report.md`, "What the next stream needs"): titles for S01–S04/F03–F05; a test for workspace content never entering an institution write; one injection-through-tool-selection test in `converse.ts`; onboarding resume across devices via `onboarding_step_progress`; one shared spreadsheet-cell guard.
0. **Phase 1 remainder** (`docs/execute/31-phase-1-foundation-report.md`, "What the next stream needs"): budgets decision; T01 storage sweep and the course-room switch; F02 AI-context and realtime post-revocation assertions and the deprovision trigger's scope; F01 audit-harness workflow (founder sees the CI change first).

1. **Source and freshness on the cart (second half).** The `named` row now says which codes are unmatched; the cart itself does not yet show a named code's catalog match or the import's age beside each selected section. Do not invent seats.
2. **Coverage matrix, next rows.** The 51 routes still at `specified` are concentrated in trust (docs-only items), social, studio and admissions; the 11 at `schema-present` have tables and no screen. Pick by the phased plan's Phase 1 and 2 exit gates, not by count.
3. **Security closure OP-01.** Only with explicit approval to add a migration and only against a non-production database the operator names. Do not infer a project id.

## Not in this backlog yet

Placeholder consoles, new domain tables for every engine, native iOS or Android, marketplace, authority transfer, and any charge or official grade.

## Stop conditions

Production mutation, remote migration, destructive git, a second permission model, or a policy choice the roadmap lists as an open decision (OD-1 through OD-9).
