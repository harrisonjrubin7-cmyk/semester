# Student-account command receipts

> **Type:** reference · **Audience:** engineering and finance operations · **Owner:** engineering · **Truth:** held · **Reviewed:** 2026-10-10 · **Held by:** `supabase/finance-command-receipts.check.sql`

`public.finance_command` is the retry-safe application path for creating,
approving, rejecting and withdrawing existing student-account requests, plus
asking for a payment plan. The caller supplies a command key. The database
binds it to the authenticated actor, tenant, student, action and canonical
payload hash, serializes concurrent use, and returns the same accepted receipt
for an identical replay.

The command does not implement accounting rules. It writes the existing
`student_account_requests` or `student_payment_plans` tables, whose guards still
enforce maker-checker separation, high-value approval, refund-originator rules,
closed-period and referenced-entry locks, current balances and immutable
history. An accepted decision, its existing audit row, one durable receipt and
one minimized outbox event share one transaction. Any failure rolls all of
them back. No provider charge, refund or reconciliation is in this command.

Decision commands expect version `1`, the proposed state. A request that has
already left that state returns an explicit conflict. An identical retry of an
already accepted decision returns its version `2` receipt before attempting a
second update, so it cannot write a second ledger entry.

The UI distinguishes pending, unknown, accepted, denied and conflict. After an
ambiguous transport failure it offers receipt recovery with the original key;
the unresolved key is retained across a refresh and blocks a fresh submission
until recovery gives a definitive answer. It does not automatically mint and
submit another command. Payment-plan
previews and all other student-authored financial estimates remain local
planning data, separate from this school-authored record.

The disposable database suite also runs two real PostgreSQL sessions against
one held command-key lock and requires byte-identical receipts plus one request
row. Its forced outbox failure verifies that a decision, ledger effect, audit,
receipt and event roll back together.

## Compatibility and rollout boundary

The historical direct `INSERT`/`UPDATE` grants and RLS policies remain during
this first slice. Old clients therefore continue to work under the original
guards, audit and ledger rules, but their writes have no command receipt or
command outbox event. This is an explicit compatibility bypass, not universal
command enforcement. Removing it requires client-version evidence and a
separately approved grant migration.

The migration is draft-only because merging SQL in this repository can apply
it automatically. Production permission changes, database application,
provider execution, credentials and real account changes are not authorized by
this work.
