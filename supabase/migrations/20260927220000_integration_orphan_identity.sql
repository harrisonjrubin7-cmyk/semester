-- Semester — let two orphaned references share a source identity.
--
-- Found by the Codex review of #808. `canonical_entity_references_identity`
-- was created `nulls not distinct`, to keep rows whose connection had been
-- removed from multiplying. But the connection foreign key is
-- `on delete set null`, so two connections at one school that shared a record
-- id — the case #808 exists to allow — left two rows identical under the index
-- once both were removed, and the second removal failed. The runbook promises
-- that removing a connection keeps its references with the connection
-- cleared.
--
-- Nothing writes a reference without a connection: the worker and
-- `lti_record_context` always name one, so no upsert conflicts on a null.
-- The default, nulls distinct, is therefore all identity needs.
-- `integration-control-plane.check.sql` removes two such connections.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

drop index if exists public.canonical_entity_references_identity;
create unique index canonical_entity_references_identity
  on public.canonical_entity_references (tenant_id, connection_id, source_system, source_record_id, canonical_entity_type);
