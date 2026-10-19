# How to add an event type

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for adding a type to the domain event catalogue in `packages/institution/src/events.ts`; stop reading if you want analytics events, which are a different thing documented in [`docs/ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md).

**Status:** PARTIAL. The catalogue, envelope, outbox and receipt ledger are implemented and tested. The productivity command path and tenant feature-policy trigger produce bounded events. One manually invoked, 25-event projector endpoint exists for `entitlement.changed`, but it is dormant without its dedicated secret and has no scheduler; no publisher runs. [`docs/architecture/0008-event-envelope-and-outbox.md`](../architecture/0008-event-envelope-and-outbox.md) is the accepted design record, while [`docs/reference/EVENTS.md`](../reference/EVENTS.md) is the generated current-state scan.

Every domain event type is a key of `EVENT_TYPES` in [`packages/institution/src/events.ts`](../../packages/institution/src/events.ts). The file's own comment is the rule: a producer that wants a new type adds it in the same change as the first consumer, and a consumer refuses a type that is not listed.

1. Check main for the type.
2. Name it `domain.verb_past`. The pattern is `EVENT_TYPE_PATTERN`, `^[a-z_]+\.[a-z_]+$`: lower-case letters and underscores, one dot, no digits.
3. Add a line to `EVENT_TYPES` with `spec(version, classification, retention)` under the right group comment.
   - `version` starts at 1.
   - `classification` is one of `RESOURCE_CLASSIFICATIONS` in `packages/institution/src/policy.ts`. A producer may raise it later and may not lower it.
   - `retention` is one of `operational`, `student_record`, `audit`, `commercial`. The durations are policy in [`RETENTION.md`](../../RETENTION.md), not code.
4. If a policy action promises an audit event, that event must be in the catalogue. The test `carries the audit event every policy action promises` checks the `auditEvent` of every entry in `POLICY_ACTIONS`.
5. Write the first consumer in the same change, and run it through `processOnce`, so a second delivery is a no-op. Delivery is at least once.
6. Do not put free text a student wrote into the payload unless the type's classification allows it.
7. Run, from `app/`:

   ```bash
   npx vitest run ../packages/institution/src/events.test.ts
   npm run check:university
   ```

## What fails if you get it wrong

These were followed in a scratch copy on 2026-10-04.

| Change | Result |
| --- | --- |
| Added `'scratch.demo_ran': spec(1, 'internal', 'operational')` | All 8 test files and 101 tests under `packages/institution` passed, and `npm run check:university` exited 0. A well-formed type needs no other file to change. |
| Named it `'scratch.demo2'` | `events.test.ts`, `names every type as domain.name, and every classification and retention class is a known one`: the name did not match the pattern. |

Nothing enforces step 5. The catalogue test cannot tell whether a type has a consumer.

The database holds the same shapes. `20260928320000_audit_correlation_and_outbox.sql` has a check constraint on the type pattern and on the classification list, and the test `holds the same classification list and type shape as the outbox constraint` fails if the TypeScript and the SQL differ. If you add a classification, add it to a migration as well; see [`HOW-TO-ADD-A-MIGRATION.md`](HOW-TO-ADD-A-MIGRATION.md).
