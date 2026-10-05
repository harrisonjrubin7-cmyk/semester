-- Semester — Plus costs $7.99 a month or $59 a year (D-134).
--
-- Safe to run again; each statement changes nothing once it has run.
--
-- ## Why
--
-- `plans.ts` has said $7.99 and $59 since the pricing page was written, and
-- the briefs of 29 September ask for the same figures. The commercial core
-- (`20260929070000_commercial_core.sql`) seeded the catalog at 399 and 2999
-- cents instead, and since #964 `begin_checkout` charges the catalog's price,
-- so the Account screen sold Plus at $3.99 while the pricing page said $7.99.
-- The owner chose $7.99 and $59 everywhere.
--
-- ## How
--
-- A price is never edited in place: `checkout_sessions` and `subscriptions`
-- point at the row they were sold on, and a receipt must keep meaning what it
-- said. The old rows are retired — inactive, with their window closed — and
-- two new rows open. `begin_checkout` and the public read policy both take
-- only an active row inside its window, so the old price can no longer be
-- bought or seen, and anything already sold on it still names it.
--
-- The window's end is kept strictly after its start, which the
-- `commercial_prices_window` constraint requires: applied from empty, the seed
-- row and this one can share a transaction, and `now()` with it.
--
-- Nothing here reaches Stripe. Checkout sends the catalog's amount as
-- `price_data`, so the next checkout charges the new price; a subscription
-- Stripe already holds keeps its own until it is changed there.

update public.commercial_prices
   set active = false,
       effective_to = greatest(now(), effective_from + interval '1 second')
 where plan_code = 'plus'
   and active
   and ((billing_interval = 'month' and amount_cents is distinct from 799)
     or (billing_interval = 'year'  and amount_cents is distinct from 5900));

insert into public.commercial_prices (plan_code, amount_cents, billing_interval)
select v.plan_code, v.amount_cents, v.billing_interval
from (values
  ('plus', 799,  'month'),
  ('plus', 5900, 'year')
) as v(plan_code, amount_cents, billing_interval)
where not exists (
  select 1 from public.commercial_prices p
  where p.plan_code = v.plan_code
    and p.billing_interval = v.billing_interval
    and p.amount_cents = v.amount_cents
    and p.active
);
