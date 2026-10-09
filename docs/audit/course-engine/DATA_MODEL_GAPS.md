# Data model gaps

## Present

`courses`, `source_documents`, `source_chunks`, `citations`, `course_units`, `concepts`, `readings`, `assignments`, `calendar_events`, `conflicts`, `review_items`, `study_assets`, `study_exports`, `study_sessions`, `learner_progress`, and `background_jobs` are coded. Ownership is scoped through course/user relationships, and consequential records carry review status or citations.

## Open gaps

| Gap | Required before | State |
|---|---|---|
| Explicit authority/freshness fields on every consequential record | institutional pilot | designed |
| Durable audit log for edits, approvals, corrections, and exports | production | documented |
| Institution/tenant and course-membership model beyond single-owner courses | multi-user pilot | documented |
| Row-level Postgres policies for the standalone course schema | production | documented |
| Retention, legal hold, and verified deletion receipts for originals/exports | production | documented |
| Exact PDF bounding boxes and OCR review annotations | high-fidelity source viewer | prototyped by nullable fields |
| Calendar connection cursor/reconciliation records | live Google/Outlook sync | documented |
| AI policy decision and disclosure records per generation | governed generation | documented |

No institutional authority is inferred from a student upload or a `confirmed` review state.
