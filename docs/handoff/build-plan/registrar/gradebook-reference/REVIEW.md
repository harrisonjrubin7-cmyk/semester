# Review — gradebook / degree audit / transcript reference (uploaded)

Filed unchanged with the moderation wireframe. Not run (no Postgres here).

**Good:** draft → moderation → release kept separate from accepted final academic facts ("accepted final facts are not assessment releases"); overrides bound to an exact draft version with reason, approver grant and expiry; versioned requirement sets for degree audit runs; transcript requests separate from transcript snapshots; no client writes; audit events append-only.

## Findings → `gradebook_transcript_reference.review.sql`
| # | Finding | Fix |
|---|---|---|
| 1 | RLS enabled on 5 tables, not forced | forced |
| 2 | Duplicate drafts per student × section × assessment allowed | unique |
| 3 | A release only references `draft_id`; its student/section/assessment can disagree with the draft | composite FK to the draft's identity |
| 4 | Override use not checked at release: expiry, version and self-approval | trigger on release insert |
| 5 | Releases and final facts can be updated, deleted or truncated | append-only + truncate guards; one fact per record version |

Same pattern as the record-model and workspace references — map onto the repo's existing gradebook and registrar tables (`registration_*`, `academic_record_*`, `gradebook_*`) rather than adding a parallel schema. The registrar hardening patch already covers several of these for the repo's own tables.
