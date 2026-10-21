# System boundary and data classification

## Boundary
**In scope:**
- **Applications:** the Semester web app (Vercel), Supabase (Postgres, Auth, Storage, Edge Functions) and background workers.
- **Integrations:** LTI 1.3 with Brightspace, Canvas and Blackboard; SIS read and transactions (Banner/YES); Stripe (personal memberships only); email delivery; and AI model providers.

**Out of scope:** the institutions' own systems. Semester integrates with them and never administers them.

## Classifications
These match `record_classifications` in 011 and the `classification` column in the user DDL.

| Class | Examples | Handling |
|---|---|---|
| Directory | Name and photo where the institution designates them, subject to opt-out | Visible to members; opt-out respected |
| Education record | Enrollments, submissions, grades, holds, advising notes | School-official access only, with a relationship and purpose; audited |
| Financial | Charges, aid, wallets, payment references | Finance scope; amounts in minor units; corrections are reversals |
| Accommodation evidence | Disability documentation | Disability office only; elsewhere only placement or service instructions |
| Counseling, conduct | Case records | Named case staff only |
| Admissions review | Reviewer notes and scores, recommendation letters | Assigned reviewers only; never shown to the applicant by default |
| Personal | A student's own notes, tasks, study sessions and AI history | Owner only; never exposed through institutional licensing; never a risk profile by default |
| Secrets | Keys, tokens, client assertions | Secret manager only; never logged |

## Rules
- Every record carries its source, external id, last sync and authority mode.
- **Retention:** each class has a rule in the retention policy. Deletion is a command, never an ad hoc query.
- **Tokens and logs:** subject tokens in logs are still PII when they can be linked to a student.
