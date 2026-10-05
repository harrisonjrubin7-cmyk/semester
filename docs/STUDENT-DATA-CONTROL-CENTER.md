# Student data control centre

Part 3 of the expansion command. Phase 2. The single gathered screen is not
built; most of what it would gather already exists as separate screens, and a
student intake and tracking screen for rights requests exists on the Privacy
screen.

## What exists on main

This is the part where `main` has the most, spread across the `me` shelf:

- **Privacy** (`app/src/screens/Privacy.tsx`, nav id `privacy`): what leaves the
  device, account deletion through `deleteEverything()` in
  `app/src/lib/cloud.ts`, device erasure through `app/src/lib/erase.ts`, and
  consented support access (`app/src/components/SupportAccess.tsx`).
- `app/src/lib/privacy.ts`: `CLAIMS`, `SYNC_GROUPS`, `whatSyncs`,
  `NEVER_SYNCED`, `whatDeletionLeaves` — the statements the screen makes,
  already written as data.
- **Data** (`app/src/screens/Data.tsx`, nav id `data`): what is stored and how
  big it is (`app/src/lib/inventory.ts`).
- **Export** (`app/src/screens/Export.tsx`, nav id `export`).
- **Connect** (`app/src/screens/Connect.tsx`, nav id `connect`): the connected
  providers and `forget`.
- Access history: `readAccessLog(days)` in `app/src/lib/cloud.ts`, today shown
  only for calendar-feed reads in `app/src/components/Subscribe.tsx`.
- AI transparency: `app/src/intelligence/Disclosure.tsx` shows what an answer
  used; `app/src/lib/aiflags.ts` lets a school switch categories off.
- Requests: a student files and follows a rights request (export, erase,
  correct, restrict) in `app/src/components/DataRightsRequests.tsx` on the
  Privacy screen, over `app/src/lib/data-rights.ts` and `public.data_subject_request`
  (`received · verifying · in_progress · completed · refused`). **No answering
  surface exists and no one is named to answer** (see
  `DATA-RIGHTS-REQUEST-RUNBOOK.md`, a target procedure).
  `public.data_requests` (`received · in_progress · completed · rejected`) is the
  older table: it is written as the receipt of an erasure or export that
  already happened (`erase_account`, `export_my_data`), and the migration that
  added `data_subject_request` describes it as the queue `data_requests` never
  was. Its `data_steward` working policy and the `data_request:handle`
  capability remain in the schema with no screen. Which table is the queue and
  which is the receipt ledger is recorded in that migration's comments; a
  decision to retire or repurpose the older queue is open (Engineering and
  Privacy).

**So the build is one screen that gathers these, not new machinery.** The My
Data screen the command sketches is the `privacy` screen reorganized under the
headings Connected systems, What Semester uses, Not used, and the five actions.

## In flight

- #779 changes `screens/Privacy.tsx` and adds `integration_connections`, which
  is the "Connected systems" list for institutional sources.
- #791 edits `lib/privacy.ts`.
- #788 adds AI-use declarations, which belong in the export.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `student_data_connections` | **Reuse** `connect.ts` providers + `integration_connections` (#779) | Two sources, one list on screen |
| `student_data_access_summaries` | **View** over `access_log` + `support_access_event` + `accommodation_access_events` + `talent_profile_views` | These already record reads; the summary translates them |
| `student_privacy_preferences`, `student_recommendation_preferences`, `student_notification_preferences` | **One preferences object** in the synced state, plus `aiflags` | Three tables for one screen of toggles would be three things to keep consistent |
| `student_privacy_reset_requests` | **Not a table** | A reset is a local operation over preferences and derived data; it is recorded in the access summary |
| `student_data_exports`, `student_deletion_requests`, `student_correction_requests` | **Reuse** `data_subject_request` for requests; `data_requests` stays the receipt of completed erasures and exports | `data_subject_request` has the four kinds and the intake screen exists; answering is not built |
| `ai_feature_transparency_records` | **Static data** in the repository, one entry per AI feature | Provider category, data class allowed, grounding, retention, training posture, limits. It changes with code, so it lives with code |
| `privacy_commitments` | **Extend** `privacy.ts` `CLAIMS` | That is what `CLAIMS` is |

## Capabilities and flags

- Students need no capability for their own data. Working a request is not
  built: `data_request:handle` exists in the schema for the older
  `data_requests` table and no screen uses it.
- Flag `me.data_center`, `off` until the screen is built; the existing screens
  stay reachable throughout.

## Hard boundaries

- The **Not used** list is generated from the same source as the scoring
  module's import test in [actions](ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md):
  if the app starts using a category, the screen changes in the same commit, or
  the test fails.
- The access summary never shows IP addresses, user agents, internal ids or
  security events. It shows who (a role or named service), what, why, when, and
  what the student can do.
- A privacy reset keeps institutional records and says which ones and why.
- The public commitment — no surveillance, no secret score — is one sentence in
  `CLAIMS`, rendered on this screen and on the public site from the same string.

## Tests

- Every category in **Not used** is absent from the recommendation and ranking
  modules' imports (shared with the actions test).
- Revoke a connection → its data stops refreshing and is labelled with its last
  update, and the revocation appears in the access summary.
- The access summary for a fixture log contains no IP, no user agent, no uuid.
- Export, delete, correct and restrict requests create `data_subject_request`
  rows the student can read and nobody else at another school can
  (`supabase/audit-and-subject-requests.check.sql`).
- Privacy reset clears preferences and derived suggestions and leaves
  `institution_actions` untouched.
