-- Production-advisor reconciliation of 30 September 2026 (D-1026): the four
-- foreign keys with no covering index and the two tables with no primary key
-- that the live advisor reported on `lzrqvlugnawcgywkhqlz`.
--
-- Everything else the advisor reported was read against production and
-- against the register (`docs/ADVISOR-RECONCILIATION-2026-09-30.md`) and left
-- alone on purpose:
--
--   * 49 tables with row-level security and no policy. Every one has no
--     privilege of any kind for `anon` or `authenticated`, table or column.
--     That is the intended shape for a table only a definer function or the
--     service key reaches, and a permissive policy added to quiet the notice
--     would be the only way to make one of them reachable. None is added.
--   * 180 `security definer` functions a signed-in account can execute. All
--     180 are exactly the register's 180 rows; none is executable by `anon`
--     or PUBLIC; every `search_path` is pinned. This file changes no grant.
--
-- ## The four indexes
--
-- `private.domain_outbox_events`, `gateway_intelligence_action`,
-- `gateway_intelligence_audit` and `gateway_review` each reference
-- `public.schools(id) on delete cascade` from `tenant_id`, and none had an
-- index on it. Deleting a school therefore scanned each of them once per
-- school row. `supabase/indexes.check.sql` should have caught it and did not,
-- because it asked only about `public`; it asks about `private` now.
--
-- ## The primary keys
--
-- `private.site_lead_hits` (a rate-limit hit: a hashed address and a time) and
-- `private.console_audit_verification` (one row per audit-chain check) have no
-- natural key: two hits can share a hash and an instant, and two checks can
-- share a transaction's `now()`. Each gets a surrogate `id bigint generated
-- always as identity`. Both tables are tiny (0 and 2 rows on production), so
-- the rewrite this takes is instant. `private.ledger_chain_verification`
-- (#1012, merged after the advisor was read) is the same shape and gets the
-- same key; the stricter `indexes.check.sql` found it.
--
-- The audit-verification table is append-only through a trigger that refuses
-- UPDATE and DELETE. Adding a column is DDL and does not fire it; a check in
-- `advisor-reconciliation.check.sql` re-runs this file against a populated
-- table to show it.
--
-- The identity sequence is a new object with default privileges of its own,
-- so it is locked to every client role explicitly, as its table already is.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Covering indexes for the tenant foreign keys ───────────────────────

create index if not exists domain_outbox_events_by_tenant
  on private.domain_outbox_events (tenant_id);
create index if not exists gateway_intelligence_action_by_tenant
  on private.gateway_intelligence_action (tenant_id);
create index if not exists gateway_intelligence_audit_by_tenant
  on private.gateway_intelligence_audit (tenant_id);
create index if not exists gateway_review_by_tenant
  on private.gateway_review (tenant_id);

-- Found when `indexes.check.sql` began to look at `private`: two more tenant
-- keys, added by the ledger hash chains (#1012) after the advisor was read.
-- Their primary keys lead with `ledger`, so `tenant_id` is not a prefix.
-- Conditional, because those tables come from another migration and a branch
-- built without it (a preview that applies only new files) must not fail here.
do $$
begin
  if to_regclass('private.ledger_chain') is not null then
    create index if not exists ledger_chain_by_tenant on private.ledger_chain (tenant_id);
  end if;
  if to_regclass('private.ledger_chain_manifest') is not null then
    create index if not exists ledger_chain_manifest_by_tenant on private.ledger_chain_manifest (tenant_id);
  end if;
end $$;

-- ── 2. Primary keys ───────────────────────────────────────────────────────

do $$
declare
  t regclass;
  seq text;
begin
  foreach t in array array['private.site_lead_hits'::regclass, 'private.console_audit_verification'::regclass,
                         to_regclass('private.ledger_chain_verification')] loop
    continue when t is null;
    if not exists (select 1 from pg_index i where i.indrelid = t and i.indisprimary) then
      execute format('alter table %s add column if not exists id bigint generated always as identity', t);
      execute format('alter table %s add constraint %I primary key (id)',
                     t, (select c.relname from pg_class c where c.oid = t) || '_pkey');
    end if;
    -- A sequence made by the statement above is new: whatever default
    -- privileges the schema carries reach it, so name every client role.
    seq := pg_get_serial_sequence(t::text, 'id');
    if seq is not null then
      execute format('revoke all on sequence %s from public, anon, authenticated, service_role', seq);
    end if;
  end loop;
end $$;
