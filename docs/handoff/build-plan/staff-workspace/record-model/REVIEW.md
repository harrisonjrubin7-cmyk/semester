# Review — record-oriented RLS reference (uploaded)

Filed unchanged with your 73-assertion pgTAP suite. Not run here (no Postgres).

**Model:** one `education_records` table, one sensitivity category per row, read rules per role × kind, and access through a per-record assignment on the active grant — plus a seventh **Student** self-service role (own published grades and finance only). The JWT workspace claim is re-checked against live grants on every query. Disclosure records require parties, legitimate interest, legal basis and fields, and a health/safety-emergency disclosure must name the threat. This is a stronger design than the multi-table reference: restricted support notes are separate rows that need their own assignment.

## Findings → `university_rls_migration.review.sql` + `university_rls_review.tests.sql`
| # | Finding | Fix |
|---|---|---|
| 1 | RLS enabled, not forced | force on `education_records` |
| 2 | Registrar/Finance need one assignment row per record | `grant_tenant_scope` (approved, with reason); never widens to `restricted_support` or other roles |
| 3 | Evidence triggers don't stop TRUNCATE | statement-level truncate triggers |
| 4 | `body` can be any JSON | must be an object; per-kind allowlists stay server-side |

## Which reference to build from
Two uploaded references now exist (multi-table in `../workspace-source/`, record-oriented here). **Recommend the record-oriented one** for the repo mapping: fewer tables, one read path, and per-row sensitivity. Either way it's a pattern to map onto the repo's existing tables, not a migration to add beside them.

To run: copy migration + review patch into `supabase/migrations`, tests into `supabase/tests/database`, `supabase db reset && supabase test db` on a local project only.

## Audit logging (from the explainer PDF)
- **RLS doesn't log reads, on purpose.** Policy functions decide row access; they're the wrong place to write disclosure records. The suite checks that an allowed read leaves the audit count unchanged.
- **Two evidence stores:** `audit_events` (operational: release, correction, referral, export, grant changes) and `disclosure_records` (the § 99.32 record: requesting/receiving parties and their legitimate interests, kept with the student's records). Disclosures to the student, qualifying school officials and parties with written consent are among the exceptions — so "log every internal read" is not what FERPA requires.
- **If a read must be audited** (an export, an external disclosure), route it through an audited server command and remove direct client SELECT for that path. Commit the change and its audit event in one transaction; track external delivery as pending / succeeded / failed separately.
- **Append-only is not tamper-proof:** owners and superusers can still bypass. Production needs separate evidence-writer, reviewer and admin roles, and possibly external immutable storage. The review patch adds the missing TRUNCATE guard.
- **Out of scope for these tests:** consent, annual notices, access and amendment rights, vendor conditions, retention, and FERPA compliance as a whole — institutional policy decides who is a school official and what counts as legitimate educational interest.
