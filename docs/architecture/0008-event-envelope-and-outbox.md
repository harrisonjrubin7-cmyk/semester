# 0008 · One event envelope, written through a transactional outbox

**Status:** Accepted and locally implemented for the envelope, catalog, tables,
bounded productivity/feature-policy/tenant-rollout producers, two private
projectors, and a dormant manually invoked worker. No publisher or scheduler is
active, and no deployment is inferred from repository state.

## Decision

An event between modules is a `SemesterEvent` (`packages/institution/src/
events.ts`): an id, a type from `EVENT_TYPES` with the version that catalog
stamps, a producer, the environment, the tenant, the actor and subject, a
correlation and causation id, an idempotency key, and a data classification
that may be raised above the type's floor but never lowered. A consumer
validates the envelope before it reads the payload and refuses an unknown type
or a wrong version.

An event is written in **the same database transaction** as the record that
made it true, into `private.domain_outbox_events`
(`20260928320000_audit_correlation_and_outbox.sql`). A publisher
(`drainOutbox`) sends pending rows, records each failure with its attempt
count and a bounded error, and parks a row after the fifth attempt for an
operator. A consumer records one receipt per (consumer, event) in
`private.domain_event_receipts`, whose primary key is what makes a second
delivery a no-op at the database; `processOnce` is that rule in code.

## Why

The integration pipeline already learned this the expensive way: retry with
backoff, a dead-letter after repeated failure, a replay an operator asks for,
all in `server/integration/`. The lesson was kept to one module. A grade that
posts needs the gradebook, the action centre, the notification queue, the
passback and the audit log to hear about it, and a chain of synchronous calls
does that until one fails halfway and a grade is posted that nobody was told
about. The specification's diagram of what never to do — write the record,
call several services, assume every call succeeded — is the shape most of this
repository's notifications currently have.

At-least-once delivery is the only delivery there is, so a consumer that is
not idempotent is wrong, not unlucky. The receipts table makes that a
constraint rather than a convention.

## How it is held

`events.test.ts` walks the drain through publish, fail, retry and park, and
proves a parked row is not offered again even after the bus recovers. It
holds the classification list and the type pattern in the migration equal to
the TypeScript. `outbox.check.sql` proves no signed-in account can reach
either table, that six mislabelled events are refused, that an event is
published or parked but never both, and that a consumer's second receipt for
one event is refused — each with a control that a valid row passes.

## What it was chosen over

- **A message broker now.** Deferred: the outbox is what makes a broker safe
  to add later, and Postgres plus a polling publisher is enough for one
  tenant's volume. Revisit at the first tenant whose event rate makes polling
  the bottleneck, with the measurement.
- **Database triggers that call services.** Rejected: a trigger that fails
  fails the transaction that carried the student's work.

## What this constrains

A producer adds its type to `EVENT_TYPES` in the same change as its first
consumer. A consumer is idempotent, verifies the tenant, records a receipt,
and never writes to an external system without an idempotency key of its
own. A retention sweep for both tables is owed before any producer writes to
them in production; `RETENTION.md` says so.
