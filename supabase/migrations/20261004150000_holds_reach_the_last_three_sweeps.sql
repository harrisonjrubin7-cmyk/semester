-- A legal hold now reaches the last three sweeps that deleted without asking.
--
-- 20260930100000_legal_holds.sql made six sweeps skip what a live hold covers,
-- 20260930140000_erase_respects_holds.sql put the same question in front of
-- account erasure, and 20260930170000_hold_aware_sweeps.sql finished the AI-runtime
-- and Community sweeps. Three functions that delete were never reached by any of
-- them, because each was defined before holds existed and nothing said a new
-- hold had to be asked about:
--
--   * `public.sweep_tombstones`       — a student's own deleted work, 90 days after
--                                        they deleted it (20260901000700_records.sql)
--   * `public.purge_financial_records` — an individual subscriber's finished payment
--                                        records, seven years on (20260929130000)
--   * `private.gateway_purge_journal`   — the gateway's audit rows and the sealed
--                                        two-phase action state (20260924184500)
--
-- Found by reading every function that says `delete from` and is named like a
-- sweep, a purge or an erasure, and asking of each whether its source mentions a
-- hold: of 22, six did, eleven are reached only through the erase wrapper that
-- already checks, two are one-hour replay windows that hold no evidence, and
-- these three were none of those. `RETENTION.md` said of the financial purge that
-- "there is none to gate"; the function was added the day before the holds were.
--
-- What a hold now keeps, per function. A platform hold keeps everything below;
-- `private.account_is_held` and `private.tenant_is_held` already include it.
--
--   * Tombstones: the rows of an account that is held, directly or because its
--     school is. They stay tombstoned and are removed by the first sweep after the
--     hold is released. The student's deletion is not undone; only the physical
--     removal waits.
--   * Financial records: everything of an individual subscriber's billing account
--     while the account that owns it is held. A billing account with no owner left
--     (`user_id is null`, the owner having erased theirs) cannot be named by an
--     account hold — an erased account cannot be held, the delete trigger refuses —
--     so it follows the platform hold only.
--   * Gateway journal: the review, audit, intelligence-audit and action rows of a
--     held school, and of a held account when `actor_id` is that account's id. The
--     actor is text, not a foreign key, so it is cast only when it reads as a UUID;
--     anything else is a school-scoped row and is kept by the school's hold alone.
--     The one-day rate-limit window (`gateway_rate_limit`) is replay protection, not
--     a record, and is left unconditional.
--
-- Each function is the original of its earlier migration restated whole — Postgres
-- replaces a function whole — with one clause added per delete and nothing else
-- changed: the same periods, the same joins, the same return types, the same
-- security attribute and search path. `retention.test.ts` reads the LAST
-- definition of each, the one that runs, and holds it to these clauses, so a
-- later edit that drops one fails there instead of quietly dropping a hold.
-- `supabase/hold-blind-sweeps.check.sql` runs each against a held and an unheld
-- twin, because a sweep that deletes nothing passes a check that only looks for
-- survivors.
--
-- Not covered, by lack of a subject, as before: escalation deliveries and the
-- volunteer programme's events; on-device deletion; and provider backups.

-- ── 1. Student tombstones ────────────────────────────────────────────────

create or replace function public.sweep_tombstones(older_than interval default '90 days')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t text;
  n integer := 0;
  hit integer;
begin
  foreach t in array array['notes', 'tasks', 'appointments', 'sittings', 'courses']
  loop
    execute format(
      'delete from public.%1$s where deleted_at is not null and deleted_at < now() - $1'
      -- A legal hold keeps the row of a held account, or of one in a held school.
      || ' and not private.account_is_held(user_id)', t)
      using older_than;
    get diagnostics hit = row_count;
    n := n + hit;
  end loop;
  return n;
end;
$$;

revoke all on function public.sweep_tombstones(interval) from public, anon, authenticated;

-- ── 2. Individual subscribers' financial records ─────────────────────────

create or replace function public.purge_financial_records(as_of timestamptz default now())
returns table (kind text, removed bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- The start of the year seven years before this one: everything made
  -- before it has had seven full years after the end of its own year.
  cutoff constant timestamptz := date_trunc('year', as_of) - interval '7 years';
  n bigint;
begin
  perform set_config('semester.financial_retention', 'on', true);

  -- Checkouts first: a completed one must point at its subscription (the
  -- table's own check), so removing the subscription under it would fail.
  delete from public.checkout_sessions c
   using public.billing_accounts a
   where a.id = c.billing_account_id
     and a.kind = 'individual'
     and c.created_at < cutoff
     and (c.subscription_id is null
          or exists (select 1 from public.subscriptions s
                      where s.id = c.subscription_id
                        and s.status in ('canceled', 'ended')
                        and s.current_period_end < cutoff))
     -- A legal hold keeps everything of a subscriber while their account is held.
     and not private.account_is_held(a.user_id);
  get diagnostics n = row_count;
  kind := 'checkout_sessions'; removed := n; return next;

  delete from public.subscriptions s
   using public.billing_accounts a
   where a.id = s.billing_account_id
     and a.kind = 'individual'
     and s.status in ('canceled', 'ended')
     and s.current_period_end < cutoff
     and not private.account_is_held(a.user_id);
  get diagnostics n = row_count;
  kind := 'subscriptions'; removed := n; return next;

  -- Payment events before their invoices: removing an invoice would try to
  -- clear the event's link, and an event is never updated. Only an event
  -- whose invoice shows it is an individual's is removed. One with no
  -- invoice (a subscription update, a dispute) cannot be placed, and may be
  -- an institution's, so it stays.
  delete from public.payment_events e
   where e.received_at < cutoff
     and exists (select 1 from public.invoices i
                   join public.billing_accounts a on a.id = i.billing_account_id
                  where i.id = e.invoice_id
                    and a.kind = 'individual'
                    and i.subscription_id is null
                    and coalesce(i.paid_at, i.issued_at, i.created_at) < cutoff
                    and not private.account_is_held(a.user_id));
  get diagnostics n = row_count;
  kind := 'payment_events'; removed := n; return next;

  delete from public.invoices i
   using public.billing_accounts a
   where a.id = i.billing_account_id
     and a.kind = 'individual'
     and i.subscription_id is null
     and coalesce(i.paid_at, i.issued_at, i.created_at) < cutoff
     -- Not while an event still names it: one received after the cutoff (a
     -- late refund on an old invoice) would have its link cleared, which is
     -- an update, and the run would abort. The invoice waits for its last
     -- event to age out, and they go together.
     and not exists (select 1 from public.payment_events e where e.invoice_id = i.id)
     and not private.account_is_held(a.user_id);
  get diagnostics n = row_count;
  kind := 'invoices'; removed := n; return next;

  delete from public.credits_refunds r
   using public.billing_accounts a
   where a.id = r.billing_account_id
     and a.kind = 'individual'
     and r.created_at < cutoff
     and not private.account_is_held(a.user_id);
  get diagnostics n = row_count;
  kind := 'credits_refunds'; removed := n; return next;

  -- An account with no owner left cannot be named by an account hold (an
  -- erased account cannot be held), so only a platform hold keeps it.
  delete from public.billing_accounts a
   where a.kind = 'individual'
     and a.user_id is null
     and a.created_at < cutoff
     and not exists (select 1 from public.subscriptions s where s.billing_account_id = a.id)
     and not exists (select 1 from public.invoices i where i.billing_account_id = a.id)
     and not exists (select 1 from public.checkout_sessions c where c.billing_account_id = a.id)
     and not exists (select 1 from public.credits_refunds r where r.billing_account_id = a.id)
     and not private.platform_is_held();
  get diagnostics n = row_count;
  kind := 'billing_accounts'; removed := n; return next;

  perform set_config('semester.financial_retention', 'off', true);
end $$;

revoke all on function public.purge_financial_records(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_financial_records(timestamptz) to service_role;

-- ── 3. The gateway journal ───────────────────────────────────────────────

create or replace function private.gateway_purge_journal()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed bigint := 0;
  affected bigint := 0;
begin
  -- A legal hold keeps a held school's rows, and a held account's when the
  -- actor is that account's id. `actor_id` is text, so it is cast only when it
  -- reads as a UUID; a school hold is what keeps every other row.
  delete from private.gateway_review r
   where ((r.state = 'ready' and r.expires_at < now() - interval '1 day')
       or (r.state in ('completed', 'refused') and r.expires_at < now() - interval '90 days'))
     and not private.tenant_is_held(r.tenant_id)
     and not (case when r.actor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   then private.account_is_held(r.actor_id::uuid) else false end);
  get diagnostics removed = row_count;
  delete from private.gateway_audit a
   where a.at < now() - interval '180 days'
     and not private.tenant_is_held(a.tenant_id)
     and not (case when a.actor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   then private.account_is_held(a.actor_id::uuid) else false end);
  get diagnostics affected = row_count;
  removed := removed + affected;
  delete from private.gateway_intelligence_audit a
   where a.at < now() - interval '180 days'
     and not private.tenant_is_held(a.tenant_id)
     and not (case when a.actor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   then private.account_is_held(a.actor_id::uuid) else false end);
  get diagnostics affected = row_count;
  removed := removed + affected;
  -- One day of replay protection, not a record: left unconditional.
  delete from private.gateway_rate_limit where updated_at < now() - interval '1 day';
  get diagnostics affected = row_count;
  removed := removed + affected;
  delete from private.gateway_intelligence_action x
   where ((x.state = 'ready' and x.expires_at < now() - interval '1 day')
       or (x.state = 'processing' and x.updated_at < now() - interval '90 days'))
     and not private.tenant_is_held(x.tenant_id)
     and not (case when x.actor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   then private.account_is_held(x.actor_id::uuid) else false end);
  get diagnostics affected = row_count;
  return removed + affected;
end $$;

revoke all on function private.gateway_purge_journal() from public, anon, authenticated;
