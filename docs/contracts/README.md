# Shared contract registry

The registration-readiness pilot is described in seven machine-readable files.
Each file owns one kind of thing, and every reference between them must resolve.

| File | Holds |
| --- | --- |
| `capabilities.yaml` | The unit of release: actors, routes, records, commands, events, audits, status |
| `records.yaml` | Record passports: schema, owner, sensitivity, foreign keys, role scopes, write paths, retention |
| `events.yaml` | The domain events the save RPC emits, and the envelope it writes |
| `audit-events.yaml` | Stable audit keys and their required fields |
| `routes.yaml` | Routes, their screens, build status, and the capabilities that authorize them |
| `workflows.yaml` | Commands, the eight-state machine, the 14-step authorization chain, and failure drills |
| `release-evidence.yaml` | The release decision record and its approvers |

## Source of truth

The backend already exists on `main`. The contracts describe it; they do not replace it.

- Store: `private.registration_readiness_evaluations`, `_tasks` and `_receipts`, from
  `supabase/migrations/20261009160000_registration_readiness_store.sql`, with later
  changes in `20261010000000` and `20261010140000`. RLS is on, and grants go to `service_role` only.
- Save and read: `public.registration_readiness_save` and `public.registration_readiness_get`,
  called from `app/server/institution/readiness-repository.ts`.
- Workflow: `packages/institution/src/readiness-workflow.ts` holds the eight canonical states,
  their edges, and the three event types.
- Outbox: `private.domain_outbox_events`, appended in the same transaction.

Nothing user-facing is built. Every route is `not_built` or `proposed`. The store has no
caller from an HTTP route or worker yet.

## States

The store enforces eight canonical states: `requested`, `evaluating`, `ready`, `blocked`,
`needs_review`, `unknown`, `stale`, `reconciling`.

The five outcomes confirmed for the pilot are a **display vocabulary**: `unknown`, `stale`,
`blocked`, `needs_review`, `resolved`. Each maps onto one canonical state; `resolved` is
`ready`. The three transitional states are shown to a student as "updating" and are not a readiness outcome.

The mapping is in `workflows.yaml` under `readiness_states.display`. Confirm it before any
screen ships, because it decides what a student is told.

## How it is checked

`app/src/contracts/contracts.test.ts` parses all seven files and runs in the normal suite,
so CI enforces it. To run only this check:

```bash
cd app && npx vitest run src/contracts
```

It enforces, among other things:

- every key, actor, route, record, command, event and audit reference resolves;
- routes and capabilities list each other in both directions;
- every record has a complete passport, and every foreign key targets an `id` column that exists;
- operations never has a scope over student records;
- a record's `write_path` and the commands that write it agree in both directions;
- a command that publishes an event writes `domain_outbox_events` in the same transaction;
- every write also writes `gateway_audit`;
- every event's producers equal the commands that publish it;
- every edge and guard uses a canonical state, and each display outcome maps onto one;
- the authorization chain has the fourteen steps from the brief;
- a capability cannot be `deployed` unless an approved release lists it.

Each rule was checked by breaking the contract on purpose and confirming the test went red,
then restoring the file.

## What changed when the contracts were integrated

The first version was written from the brief alone and described tables that did not exist.
The integrated version describes the store on `main`:

- Tables are the three `private.registration_readiness_*` tables, not `readiness_cases`
  and `readiness_checks`. Tenant is `public.schools`; the subject is `subject_id` text.
- Events are the three types the workflow emits (`registration.readiness_requested`,
  `_evaluated`, `_reconciliation_requested`), not `receipt.created` or `readiness.case_routed`.
- Commands are `readiness.start` and `readiness.transition`. `readiness.refresh` is a
  transition from a completed state back to `evaluating`, so it is not separate.
- Advisor and institution-admin capabilities are added, as confirmed.
- `readiness.case.route` and `referral.create` are removed: the store has no routing,
  office assignment or referral. They are open items below.

## Open items

- **Display mapping.** The five-to-eight mapping above is proposed, not confirmed.
- **Payloads.** The event payloads are not documented in code, so `payload_status` is `unverified`.
- **Audit key.** `registration.readiness_transition` is provisional. The save RPC's audit
  call must be read to confirm the exact key and the audit table, which I have not verified.
- **Read audit.** `registration.readiness_viewed` is the key docs/operations W-31 names for
  sensitive reads. Nothing emits it yet.
- **Routing and referral.** Office routing and referrals appear in the brief but not in
  the store. No capability covers them until they are designed.
- **Routes.** `/advisor/readiness` and `/institution/readiness/audit` are proposed paths. Confirm them against the nav model.
- **Screens and backend wiring.** No screen, route handler or worker calls the store yet.
- **Migrations.** None are written. The brief's `060`/`080` plan would duplicate the existing store.
- **Failure drills** are recorded as data; nothing executes them.
- **Not deployed.** The release decision is `pending`, and every capability is `specified`.
