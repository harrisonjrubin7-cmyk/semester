# Data portability and offboarding

Part 13 of the expansion command. Phase 5. Much of the student half exists.

## What exists on main

- **Export** (`app/src/screens/Export.tsx`, nav id `export`) and
  `app/src/lib/export.ts`: CSV for deadlines and tasks, Markdown for notes and
  courses, ICS for deadlines, classes and appointments, with alarms.
  `app/src/lib/deliver.ts` zips, downloads, shares and sends to Drive/OneDrive.
- `app/src/lib/workspace-backup.ts` backs up and restores workspaces.
- `app/src/lib/subscribe.ts` is a live calendar feed.
- [`RETENTION.md`](../RETENTION.md) and its bidirectional tripwire
  `app/src/lib/retention.test.ts`.
- `public.data_requests` (`export` kind) for requests a person handles.
- **The server's half, self-serve**: *Download my account data* on the Privacy
  screen calls `public.export_my_data()`
  (`supabase/migrations/20260929010000_account_erasure_and_export.sql`), which
  returns every row naming the account — every foreign key to `auth.users`,
  and every row hanging off those by a cascade — plus the sign-in record, as
  one JSON file, and records the export in `data_requests`. It walks the same
  list `erase_account` deletes by (`private.account_data_map()`), so the two
  cannot drift; `app/src/lib/erasure.test.ts` and `supabase/deletion.check.sql`
  hold them to it. Three kinds of row are withheld as another person's record
  about the account, and the file names them.

## In flight

#767 changes `lib/workspace-backup.ts`; #788 adds AI-use declarations, which
belong in the export.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `export_requests` | **Reuse** `data_requests` | |
| `export_jobs`, `export_artifacts` | **Not tables** for the student export | It runs on the device. A server job only for institution offboarding |
| `export_formats` | **Documented in this file** and versioned in the export's manifest | |
| `retention_policies`, `retention_exceptions` | **`RETENTION.md`**, extended; a table only for per-school institutional records | |
| `institution_offboarding_requests`, `offboarding_exports`, `data_deletion_confirmations` | **New** | Nothing like them exists |

The student-facing gap is **one full-account export**: today each piece exports
separately. The addition is a single archive with a `manifest.json` (format
version, what each file is, its format) containing the pieces that already
export, plus sources and citations (BibTeX and CSL-JSON), portfolio, research
and data projects, AI-use declarations and consent records.

## Capabilities and flags

- Offboarding: `tenant:configure` (exists) to request, `platform:configure` to
  complete.
- The full export is not flagged: it only gathers exports that already exist.

## Hard boundaries

- **The retention promise in `app/src/lib/privacy.ts` does not change:** the
  student's work is kept until they delete it. Retention schedules apply to
  records *about* the work and to institution-sourced copies, never to the work.
- A legal hold stops deletion and says so to the person who asked; it does not
  silently succeed.
- Offboarding a school exports that school's institutional data to the school,
  gives each student their own export first, and ends with a deletion
  confirmation per data category.

## Tests

- The full export's manifest lists every file in the archive and nothing else.
- Round trip: export, erase device, import the workspace backup — equal state.
- ICS output validates against RFC 5545 line-length and escaping (extends the
  existing export tests).
- A deletion under legal hold is refused with a reason.
- Every new table from every phase has a `RETENTION.md` entry
  (`retention.test.ts` already enforces this).
