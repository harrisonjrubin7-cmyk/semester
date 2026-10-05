# ADR-0007 · A sensitive mutation commits its record, its audit row and its outbox event in one transaction

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Database owner (audit and events) |
| Deciders / reviewers | Founder; security owner; counsel (retention vs erasure) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (static check, inventory, gradebook/export/erase audit); Phase 2 (outbox producers) |
| Related | `docs/architecture/0008-event-envelope-and-outbox.md`; `docs/architecture/0010-correlation-ids-and-error-envelope.md`; `docs/platform/adr/commands-commit-record-audit-and-event-together.md`; `docs/platform/EVENTS-AND-OUTBOX.md`; `findings-database.md` #9, #10; `FITNESS_FUNCTIONS.md` #8; ADR-0003, ADR-0010 |
| Supersedes / superseded by | — (completes `0008`, whose catalog and tables exist with one producer) |

## Context
- Four audit stores with different shapes: `private.gateway_audit`, `public.audit_event` (via `private.record_audit`, 7 call sites), `role_grant_audit_event`, `moderation_audit_event`, and hash-chained `private.console_audit_event` (`tenant-boundary-map.md` §5; `20260924184500_gateway_action_journal.sql`, `20260930000000_audit_and_subject_requests.sql`, `20260924213000_role_grant_audit.sql`, `20260924223000_moderation_audit.sql`, `20260929100000_console_control_plane.sql`). No single query answers "all actions on school X".
- Sensitive mutations with no audit reference in their defining migration (`grep -ciE 'record_audit|audit_event|ledger_append|gateway_write_audit|_audit'` = 0): `20260929310000_gradebook.sql` (enter, release, `gradebook_export`), `20260929010000_account_erasure_and_export.sql` (`erase_account`, export), `20261004160000_export_withholds_guardian_restrictions.sql`. Gradebook keeps append-only history (`grade_entries`, `regrade_resolutions`), which is not an access or export audit.
- Outbox: `private.domain_outbox_events` has one producer, `20261004123000_productivity_commands.sql:351` (`grep -rn 'insert into private.domain_outbox_events' supabase/migrations`); `grep -rn "event_outbox" app/src app/server supabase/functions --include=*.ts -l` returns nothing. `docs/architecture/0008` itself says "no producer writes to the outbox yet". Registration, gradebook passback, dining and billing publish nothing.
- The only live outbox is `support_notification_outbox` (`20261002003000_support_notification_outbox.sql`; `supabase/functions/support-reply-notify/index.ts`).
- Gateway audit coverage in the AI path: 6 of about 22 outcomes, no correlation id (`findings-ai.md` #5). `delete-account` writes no audit row (`privileged-surface-map.md` §4).
- Checks that exist: `supabase/outbox.check.sql`, `ledger-chains.check.sql`, `ledger-seals.check.sql`, `audit-and-subject-requests.check.sql`, `gateway-journal.check.sql`, `moderation-audit.check.sql`, `share-audit.check.sql`. None asserts coverage.

## Problem
Which mutations must leave an audit row and an event, and how is "in the same transaction" guaranteed and checked?

## Decision drivers
1. A school can reconstruct who changed or exported a grade, record or permission.
2. Downstream systems (LMS passback, notifications) cannot diverge silently from the record.
3. Erasure rights and audit retention must be reconciled by counsel, not by omission.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Audit in application code only | Flexible | Misses direct RPC calls; 205 callable definers | Rejected |
| B. Generic row-change triggers on registered tables | Cannot be forgotten | Records change, not intent or access (reads, exports); noisy | Used as supplement for history tables only |
| C. Definer writes audit and outbox in the same transaction, registered per sensitive table, with a coverage check | Atomic; matches `0008` and platform ADR | Per-function work | Chosen |
| D. Logical decoding/CDC to a stream | No app change | New infrastructure for one operator | Rejected for now |

## Decision
**Recommended, unratified; no agent can accept it.**
1. Maintain a registry of sensitive tables/actions: grade enter/release/export, record amendment, account erasure and data export, role and capability change, finance mutation, bulk export, school offboarding.
2. Each registered mutation writes one `record_audit` row (actor, tenant, action, correlation id, reason code) and, where a downstream consumer exists, one `domain_outbox_events` row, in its transaction.
3. A tenant-queryable view unions the five stores by tenant and time; the stores stay separate (hash chain on console).
4. First two outbox domains: gradebook passback and registration.
5. Counsel (flagged): what survives `erase_account`, how long audit is kept, and whether the audit row itself holds personal data.

## Consequences
Positive: one answer for "what happened in school X". Negative: write amplification; migration rewrites of three definers. Harder: ad-hoc SQL edits to sensitive tables.

## Impact
- **Data / tenancy:** audit rows carry tenant text without FK by design (`public.audit_event`); view must filter by membership.
- **Security:** read access to audit is itself capability-gated.
- **Privacy:** audit may hold identifiers after erasure: counsel.
- **Accessibility:** none.
- **Operations (SLO, alert, runbook, support):** outbox lag and dead-letter need an alert (ADR-0012 `alert-delivery`).
- **Cost / commercial:** storage growth per tenant.

## Implementation
1. Inventory (no code). 2. `supabase/audit-coverage.check.sql`: a definer named in the registry that does not insert into an audit table fails. 3. Migrate `gradebook_export`, `erase_account`, bulk export. 4. Producer for gradebook passback; keep `supabase/outbox.check.sql` green. 5. Baseline `event_outbox` producers in `audit-outbox.mjs`.

## Tests and verification
- Call `gradebook_export` and assert one audit row with actor and tenant: fails today (0 audit references).
- Rollback test: force the function to raise after the audit insert; neither record nor audit nor event persists.
- Outbox: producing function raises; no event row. Control: the existing productivity command still writes its one event.
- Static: remove an audit insert from a registered definer; `audit-outbox` goes red.

## Fitness functions
- `audit-outbox` (`scripts/architecture/audit-outbox.mjs` + `supabase/audit-coverage.check.sql`): a sensitive definer without an audit insert; producer count below committed baseline; `build`.
- `tenant-boundaries`: audit view must not cross tenants.

## Rollback / reversal
Drop the audit insert (keeps records). Not cheap after consumers depend on outbox ordering or after audit rows are used as evidence.

## Open questions
- Which actions the school, not Semester, must be able to see (counsel).
- Whether one store should replace the four (no: this ADR keeps them).

## Addenda
(none)
