# Data retention, export and deletion

Full-beta Milestone 1. A synthesis of what the tree does, revalidated at `d246a348`, with each claim pointing at its source. The per-table schedule is [RETENTION.md](../RETENTION.md), which `retention.test.ts` holds to the migrations in both directions; this page does not restate it, and if the two disagree, RETENTION.md wins and this page is wrong.

## Repository validation — 2026-10-03

The P02 validation pass exercised consent, privacy, export, revocation, account deletion, deletion state, browser recovery, recovery drafts, academic recovery, plan recovery, incident recovery, FERPA consent, the call-consent screen, Trust Center and Advisor Meeting. The focused Vitest run passed **18 files and 397 tests**.

This is repository evidence, not proof of live account operation. The isolated two-device account-sync journey could not run on this host because neither the Supabase CLI nor Docker is installed. The focused deletion, subject-request and hold-aware database suites also could not run because the required PostgreSQL 17 server is absent; the checker exited 2 before creating a database or executing a suite. No production service or data was contacted.

Accordingly, this pass establishes the tested client and library behaviors only. It does **not** establish provider-backed cross-device sync, a live deletion execution, restoration of provider data, an operated rights-request response, institutional acceptance, or production activation. Those remain separate gates.

## The three promises

1. **Student work is never aged out.** Notes, courses, tasks and study material stay until the student deletes them.
2. **Export and deletion are free in every billing state.** Dunning and downgrade never restrict them (`commercial-automation.check.sql`).
3. **Deleting an account removes what the account owns**, in one transaction, all or nothing.

## Export

- **How:** the Privacy page calls `public.export_my_data()` for the signed-in account. It walks `private.account_data_map()`, which is derived from the catalog (every foreign key to `auth.users`), so a new table is included without anyone remembering to add it. Recording the request comes first, so the file contains the record of its own making (`20260929010000_account_erasure_and_export.sql`).
- **Audit:** since Milestone 1 each export also writes a pseudonymous `audit_event` (`privacy.export_completed`).
- **Proved by:** `deletion.check.sql`, `erasure.test.ts`, and the golden-path CI step.
- **Not covered:** files held only on the device (IndexedDB attachments, drafts) are outside the server's export by design. A single full-account file that includes them does not exist yet (`DATA-PORTABILITY-AND-OFFBOARDING.md`, gap G-05/G-01).

## Deletion

- **How:** the `delete-account` edge function verifies the caller's token and calls `erase_account(uuid)` (service role only). It runs every `forget_my_*` function, then the mapped rows, in a single transaction, and writes a non-identifying `data_requests` row. Then the auth user is deleted.
- **Kept on purpose:** messages in threads other people still read leave gaps rather than an unidentifiable author (`privacy.ts` says so). Financial records are kept seven years (`purge_financial_records`, D-132). `support_access_event` is kept with the education records it concerns (FERPA 99.32).
- **Known limitation:** four history tables refuse UPDATE, so a staff account that ever wrote to them cannot be erased; `erase_account` fails closed rather than half-deleting.
- **Proved by:** `deletion.check.sql` (846 lines), `erasure.test.ts`.

## Rights requests that are not self-service (new in Milestone 1)

`data_subject_request` records a request to export, erase, correct or restrict, its status and a due date (the column defaults to thirty days; that default is a database value, not a response time anyone has agreed to — **[COUNSEL REQUIRED]**, P-03). A person can raise one about themselves only, in its starting state only, and cannot answer, verify, extend or delete it (`audit-and-subject-requests.check.sql`). A school's auditor sees that school's requests. Deleting the account removes them.

**A student intake and tracking screen exists** (`components/DataRightsRequests.tsx` on the Privacy screen, over `lib/data-rights.ts`). **An answering surface does not, and no one is named to answer.** Nothing yet moves a request from received to answered, so no reply is promised: shipping a promise of a reply time before the owner decides who answers would be a promise nobody has agreed to keep. Guardian and institution requests exist as a value but must not be acted on until a person on the answering side has verified them (`verified_at`).

## Retention of audit evidence

| Table | Period | Mechanism |
| --- | --- | --- |
| `audit_event`, `role_grant_audit_event`, `moderation_audit_event`, `provisioning_audit_event` | 3 years | `private.sweep_audit_retention()`, daily `pg_cron` job `audit-retention`; immutability triggers allow a delete only past the period |
| `support_access_event` | as long as the student's records | not swept (FERPA) |
| `access_log` | 90 days | swept |
| `gateway_audit`, `gateway_intelligence_audit` | 180 days | `private.gateway_purge_journal()` |

A school whose agreement requires longer changes one interval in `sweep_audit_retention()` and one in `audit_purge_allowed()`; `retention-sweeps.check.sql` holds them together.

## Institutional data

Nothing flows in production (no production adapters). When one does, deletion at an institution's request and offboarding follow `DATA-PORTABILITY-AND-OFFBOARDING.md`; a per-source purge path ("remove everything synced from source X") is designed (`integration_retention_runs`) but its purge logic was not verified and is not claimed here.

## Owner decisions still open

- Assign the named privacy owner and build the trusted handling surface described in
  [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](DATA-RIGHTS-REQUEST-RUNBOOK.md); the student intake and tracking
  screen exists, but no answering surface exists and no response time has been decided (**[COUNSEL REQUIRED]**, P-03).
- Whether the D-124 "no deletion ledger" decision is reopened by counsel.
- A full-account export that includes device-held files.
- The legal retention wording in `docs/legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md` is a draft with open `[DECIDE]` items and needs counsel.
