# Shared contract registry

The registration-readiness pilot is described in seven machine-readable files.
Each file owns one kind of thing, and every reference between them must resolve.

| File | Holds |
| --- | --- |
| `capabilities.yaml` | The unit of release: actors, routes, records, commands, events, audits, status |
| `records.yaml` | Record passports: owner, authority, sensitivity, foreign keys, role scopes, write paths, retention |
| `events.yaml` | The domain event envelope, the event catalogue, and worked examples |
| `audit-events.yaml` | Stable audit keys and their required fields |
| `routes.yaml` | Routes, their screens, and the capabilities that authorize them |
| `workflows.yaml` | Commands, the 14-step authorization chain, and the failure drills |
| `release-evidence.yaml` | The release decision record and its approvers |

## How it is checked

`app/src/contracts/contracts.test.ts` parses all seven files and runs in the
normal suite, so CI enforces it. To run only this check:

```bash
cd app && npx vitest run src/contracts
```

It enforces, among other things:

- every key, actor, route, record, command, event and audit reference resolves;
- routes and capabilities list each other in both directions;
- every record has a complete passport, and every foreign key targets an `id` column that exists;
- operations never has a scope over student records;
- a record's `write_path` and the commands that write it agree in both directions;
- a command that publishes an event writes `outbox_events` in the same transaction;
- every event's producers equal the commands that publish it;
- each event example matches its envelope and payload definition;
- the authorization chain has the fourteen steps from the brief;
- a capability cannot be `deployed` unless an approved release lists it.

Each rule was checked by breaking the contract on purpose and confirming the test
went red, then restoring the file.

## Deviations from the continuation brief

These are decisions taken while writing the files. Each can be reversed.

1. `readiness_cases` named `readiness.case.refresh`; the brief's capabilities and
   receipts use `readiness.refresh`. The one name is used everywhere.
2. The brief's audit block had broken indentation, and `readiness.case_viewed` was
   referenced by a capability but never defined. It is defined here, with actor `registrar`.
3. Every audit event carries `tenant_id`, `actor_account_id`, `entity_id` and
   `correlation_id`. The brief omitted `correlation_id` from two events.
4. `student.readiness.read` listed actors `advisor` and `registrar` and the registrar
   routes. It is narrowed to `student` and `/app/registration`, so a student
   capability does not authorize registrar pages. Advisor and registrar access is an open item below.
5. `readiness.refresh`, `readiness.case.route` and `referral.create` are named by the
   brief but not specified. They are marked `provisional: true` in `workflows.yaml`.
6. The payloads of `receipt.created` and `readiness.case_routed` are `payload_status: provisional`.
7. `yaml@2.9.1` was added as an exact-version devDependency of `app/`. No YAML parser
   was in the lockfile. It was published 2026-09-11, more than two weeks before this change.

## Open items

These are not decided and are not implemented:

- **Six states or five.** The brief's product check says "six_state_coverage", but
  the command defines five readiness states (`unknown`, `stale`, `blocked`,
  `needs_review`, `resolved`). The sixth is not named anywhere in the brief.
- **Advisor and institution-admin access.** `readiness_cases` allows `advisor`
  (assigned caseload) and `institution_admin` (audited read), but no pilot capability grants either.
- **Case detail for registrars.** `/registrar/readiness/:caseId` is backed only by
  the routing capability. No capability reads the case detail.
- **Registrar queue audit.** `registrar.readiness.queue.read` has no audit key. The brief defines none.
- **Twenty capabilities.** The brief's first artifact lists twenty pilot capabilities.
  Only the four in the release decision are specified here.
- **Not started:** the `060_students_calendar.sql` and `080_academic_ops.sql` migrations
  with their RLS tests, the registration-readiness route package, the incident runbook,
  and the pilot metrics file.
- **Failure drills** are recorded as data. Nothing executes them yet.
- **Not deployed.** The release decision is `pending`, and every capability is `specified`.
