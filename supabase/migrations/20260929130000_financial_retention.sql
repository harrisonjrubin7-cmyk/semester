-- Financial records are kept seven years after the end of the year they were
-- made, then removed (DECISION-LOG D-132, RETENTION.md).
--
-- Until this, RETENTION.md said "no time-based purge yet — the period
-- (typically seven years) must be set before the first charge". The owner set
-- it: seven years, counted from the end of the calendar year, which is the
-- IRS's longest ordinary look-back (six years) with a year's margin. A record
-- made in 2026 is kept through 31 December 2033 and is eligible on
-- 1 January 2034.
--
-- What it removes, and only for **individual** billing accounts — a person
-- who bought Plus. An institution's contracts, quotes and invoices are
-- governed by the contract's own terms and are not age-purged here.
--
--   1. checkouts made before the cutoff, unless they point at a subscription
--      that stays — first, because a completed checkout must name its
--      subscription and would block removing it;
--   2. subscriptions that are over (canceled or ended) and whose last period
--      ended before the cutoff. Their entitlements, dunning cases, dunning
--      actions and cancellation requests go with them (on delete cascade);
--   3. payment events received before the cutoff whose individual invoice
--      is going too — the provider's event id and a hash, never a payload.
--      An event with no invoice cannot be placed and stays;
--   4. invoices dated before the cutoff that no longer point at a
--      subscription and that no remaining event names, with their lines
--      (cascade) — an invoice with a late event waits for it;
--   5. credits and refunds made before the cutoff;
--   6. finally, an individual billing account whose owner deleted their
--      account (user_id is null) and which has nothing left.
--
-- A live subscription is never removed, however old. Nothing about a
-- student's semester is in any of these tables.
--
-- Returns what it removed, by kind, so the scheduler's run history is the
-- record that the promise is being kept. The service role's alone.

-- Payment events and dunning actions refuse every update and delete: they are
-- records of what happened (20260929070000_commercial_core). The one
-- exception is this purge, which marks its own transaction and may *delete*
-- rows past their retention. An update is still refused for everybody, and
-- the mark is transaction-local, set and cleared inside the function.
create or replace function private.refuse_commercial_rewrite()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('semester.financial_retention', true) = 'on' then
    return old;
  end if;
  raise exception '% is append-only.', tg_table_name;
end $$;
revoke all on function private.refuse_commercial_rewrite() from public, anon, authenticated;

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
                        and s.current_period_end < cutoff));
  get diagnostics n = row_count;
  kind := 'checkout_sessions'; removed := n; return next;

  delete from public.subscriptions s
   using public.billing_accounts a
   where a.id = s.billing_account_id
     and a.kind = 'individual'
     and s.status in ('canceled', 'ended')
     and s.current_period_end < cutoff;
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
                    and coalesce(i.paid_at, i.issued_at, i.created_at) < cutoff);
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
     and not exists (select 1 from public.payment_events e where e.invoice_id = i.id);
  get diagnostics n = row_count;
  kind := 'invoices'; removed := n; return next;

  delete from public.credits_refunds r
   using public.billing_accounts a
   where a.id = r.billing_account_id
     and a.kind = 'individual'
     and r.created_at < cutoff;
  get diagnostics n = row_count;
  kind := 'credits_refunds'; removed := n; return next;

  delete from public.billing_accounts a
   where a.kind = 'individual'
     and a.user_id is null
     and a.created_at < cutoff
     and not exists (select 1 from public.subscriptions s where s.billing_account_id = a.id)
     and not exists (select 1 from public.invoices i where i.billing_account_id = a.id)
     and not exists (select 1 from public.checkout_sessions c where c.billing_account_id = a.id)
     and not exists (select 1 from public.credits_refunds r where r.billing_account_id = a.id);
  get diagnostics n = row_count;
  kind := 'billing_accounts'; removed := n; return next;

  perform set_config('semester.financial_retention', 'off', true);
end $$;

revoke all on function public.purge_financial_records(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_financial_records(timestamptz) to service_role;
