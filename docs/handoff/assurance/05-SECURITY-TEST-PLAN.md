# Security test plan

Security testing is layered; it isn't one scan.

| Layer | When | What |
|---|---|---|
| 1. Design | Before a high-risk build | Threat model, authorization rules, failure modes |
| 2. Code and supply chain | Every PR | Secrets, dependencies, SAST, configuration review, human review |
| 3. Database and authorization | Every migration and PR | pgTAP RLS tests (`membership_tests.sql`, `014_semester_read_policies_test.sql`, `rls_reference_tests.sql`, `all_table_rls_audit.sql`); direct calls to definer functions |
| 4. Runtime and adversarial | Staging before release, and after high-risk changes | See below |

## Layer 4 detail
- **API authorization:** object-level and function-level checks, mass assignment, enumeration, pagination leaks, rate limits, webhook signatures.
- **XSS by hand:** profile fields, comments, messages, rich text, imported content, search terms, URL previews, support and admin tools.
- **File uploads:** type spoofing, oversized files, scanning and quarantine, public/private access, download authorization, filenames.
- **Sessions:** logout invalidation, expired tokens, role changes mid-session, password reset, disabled accounts, cross-device control.
- **Business logic:** duplicate actions, price or credit manipulation, skipped workflow steps, stale approvals, races, replays.
- **Availability:** rate and size limits, dependency failure, retries, dead-lettering, rollback.
- **LTI:** the jose suite (`tests/jwt-signature.test.mjs.txt`), Canvas preservation (`tests/canvas-preservation.test.mjs.txt`), and sandbox acceptance in each LMS. The full launch-validator suite is **still missing**.
- **AI:** prompt injection, retrieval leakage, approval-to-execution binding, restricted-assessment refusal.

## Finding workflow
1. **Triage:** severity uses doc 09's deadlines.
2. **Assign an owner.**
3. **Fix**, with a regression test that fails before the fix and passes after it.
4. **Retest independently:** someone other than the person who fixed it.
5. **Verify the deployment** in staging, then production.
6. **Record closure evidence**, then close.

**Rule:** testing stays authorized and scoped to Semester's own systems. Production tests are non-destructive, scheduled, logged and reversible.
