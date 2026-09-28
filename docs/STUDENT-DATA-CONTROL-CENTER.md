# Student data control centre

Part 3 of the expansion command. Phase 2. Nothing here is built yet, and most
of it already exists as separate screens.

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
- Requests: `public.data_requests` (export, delete, correct, restrict), worked by
  `data_request:handle`.

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
| `student_data_exports`, `student_deletion_requests`, `student_correction_requests` | **Reuse** `data_requests` | It already has all three kinds |
| `ai_feature_transparency_records` | **Static data** in the repository, one entry per AI feature | Provider category, data class allowed, grounding, retention, training posture, limits. It changes with code, so it lives with code |
| `privacy_commitments` | **Extend** `privacy.ts` `CLAIMS` | That is what `CLAIMS` is |

## Capabilities and flags

- Students need no capability for their own data. `data_request:handle`
  (exists) works requests.
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
- Export, delete and correct requests create `data_requests` rows the student
  can read and nobody else at another school can (`.check.sql`).
- Privacy reset clears preferences and derived suggestions and leaves
  `institution_actions` untouched.
