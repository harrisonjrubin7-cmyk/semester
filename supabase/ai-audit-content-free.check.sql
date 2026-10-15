-- The AI audit tables hold no prompt and no answer.
--
-- "AI never receives student records" is a rule about what goes to a provider;
-- its companion is that what the platform *keeps* about an AI call is the fact
-- of it, not the content. `private.gateway_intelligence_audit` records who,
-- which category, which provider and model, how many tokens, what it cost and
-- what the policy decided. `private.gateway_audit` records who, which area and
-- which event. Neither has a column a prompt or an answer could go in, and
-- that is true today only because nobody has added one.
--
-- Nothing pinned it. A migration that added `prompt text` to the first, for
-- debugging, would have passed every suite here, and the table is retained and
-- exported like any audit row. This file pins the column sets, so adding a
-- column to either table is a decision made in this file, in the open, with the
-- reason beside it, rather than a line in a migration.
--
-- ## What it does not cover
--
--   * `private.gateway_intelligence_action` and `private.gateway_review` carry a
--     `sealed_body`: a sealed, expiring proposal waiting for a person to
--     confirm or refuse it. That is the action, not an audit row, and it is
--     deleted on expiry. What it may contain is the gateway's own tests' job;
--     it is named here so nobody reads this file as covering it.
--   * Whether the columns that exist hold only what their names say. They are
--     bounded text (`length(...) between ...` checks) in the migrations; this
--     file is about the shape, not the contents of a column.
--
-- ## The control
--
-- The comparison is run twice: once on the tables as they are, where it must
-- find nothing, and once with a `prompt` column added inside this transaction,
-- where it must find exactly that column. A check that answers "no difference"
-- for every table is indistinguishable from one that cannot see.
--
--   How to run it: supabase/check.sh ai-audit-content-free

begin;

-- Columns the table has that the list does not, then the list's that it lacks.
create or replace function pg_temp.drift(tbl text, expected text[])
returns text language sql as $$
  select coalesce(string_agg(d, ', ' order by d), '')
    from (
      select '+' || column_name::text as d
        from information_schema.columns
       where table_schema = 'private' and table_name = tbl
         and column_name <> all (expected)
      union all
      select '-' || e
        from unnest(expected) e
       where not exists (select 1 from information_schema.columns
                          where table_schema = 'private' and table_name = tbl and column_name = e)
    ) x
$$;

do $$
declare
  audit_cols constant text[] := array[
    'id', 'at', 'tenant_id', 'actor_id', 'category', 'provider', 'model',
    'input_tokens', 'output_tokens', 'cost_cents', 'policy_decision', 'action_id', 'confirmation'];
  event_cols constant text[] := array[
    'id', 'at', 'tenant_id', 'actor_id', 'area', 'event', 'review_id', 'correlation_id'];
  got text;
begin
  -- The control: both tables exist, so the comparison has something to read.
  if not exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'gateway_intelligence_audit')
     or not exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'gateway_audit') then
    raise exception 'FAILED: an audit table this file guards is gone or was renamed — move the guard with it';
  end if;

  got := pg_temp.drift('gateway_intelligence_audit', audit_cols);
  if got <> '' then
    raise exception 'FAILED: private.gateway_intelligence_audit changed shape (%). If a column is wanted, it is decided here — and it must not be able to hold a prompt or an answer.', got;
  end if;
  raise notice 'ok  private.gateway_intelligence_audit has exactly its % columns, none for content', cardinality(audit_cols);

  got := pg_temp.drift('gateway_audit', event_cols);
  if got <> '' then
    raise exception 'FAILED: private.gateway_audit changed shape (%). If a column is wanted, it is decided here — and it must not be able to hold a prompt or an answer.', got;
  end if;
  raise notice 'ok  private.gateway_audit has exactly its % columns, none for content', cardinality(event_cols);

  -- The control: add the column this exists to refuse, and the comparison must say so.
  execute 'alter table private.gateway_intelligence_audit add column prompt text';
  got := pg_temp.drift('gateway_intelligence_audit', audit_cols);
  if got <> '+prompt' then
    raise exception 'FAILED: with a prompt column added the comparison said "%", not "+prompt" — it cannot see', got;
  end if;
  raise notice 'ok  and it sees a prompt column when one is added (control)';
end $$;

rollback;
