-- Semester — a later order form can raise a school's plan, never lower it.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; the function is `create or replace`.
--
-- `private.apply_signed_contract` (20260929080000_commercial_automation) upserted
-- `tenant_plan` comparing only against the incoming values, so "last signed
-- wins": a campus order form ending 2027-06-30, then a department pilot
-- ending 2026-12-31 signed later, replaced the campus tier and its end date
-- with the pilot's. The change was recorded in `tenant_plan_history`, but
-- nothing prevented it (docs/commercial/REVENUE-OPERATIONS-ARCHITECTURE.md,
-- finding 6).
--
-- ## The rule
--
-- A **current** plan is one that is not `ended` and has no `ends_at` in the
-- past. Signing an order form whose tier is lower than a current plan's, or
-- whose `ends_at` is earlier than its `ends_at` (a dated order against an
-- open-ended plan is earlier; an open-ended order is never earlier), is
-- **refused** with a check violation, so the signing fails as a whole and
-- the contract stays unsigned. The same tier on the same dates, a higher
-- tier, a longer term and a renewal all go through. A plan that has ended
-- or lapsed is replaced freely, because there is nothing left to lower.
--
-- Lowering a plan is a decision a person makes, not a side effect of
-- paperwork, so there is no automatic path: an `amendment` still triggers
-- nothing, and a deliberate downgrade is the service role writing
-- `tenant_plan` itself, which leaves its own history row and reason.
--
-- ## Idempotent
--
-- A contract already applied to a school is skipped for that school: its
-- history row carries `Order form <id> signed.`. Without that, re-running the
-- backfill, or setting `signed` again, would re-apply an older contract over
-- a later upgrade and then be refused by the rule above.

create or replace function private.apply_signed_contract(want_contract uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
  tier text;
  t text;
  any_tenant boolean := false;
  tiers constant text[] := array['pilot', 'department', 'campus', 'system'];
  why text;
  cur public.tenant_plan;
begin
  select * into c from public.contracts where id = want_contract;
  if not found or c.status <> 'signed' or c.kind <> 'order_form' then
    return;
  end if;

  select x.tier into tier from (
    select pl.tenant_tier as tier from public.quote_lines l
      join public.commercial_plans pl on pl.code = l.plan_code
     where c.quote_id is not null and l.quote_id = c.quote_id and pl.tenant_tier is not null
    union all
    select pl.tenant_tier from public.subscriptions s
      join public.commercial_plans pl on pl.code = s.plan_code
     where s.contract_id = c.id and pl.tenant_tier is not null
  ) x
  order by array_position(tiers, x.tier) desc
  limit 1;

  if tier = 'pilot' and c.ends_at is null then
    raise exception 'A pilot order form needs an end date before it is signed.' using errcode = '23514';
  end if;

  why := format('Order form %s signed.', c.id);

  for t in select bt.tenant_id from public.billing_account_tenants bt where bt.billing_account_id = c.billing_account_id loop
    any_tenant := true;
    if tier is not null
       and not exists (select 1 from public.tenant_plan_history h where h.tenant_id = t and h.reason = why) then
      select * into cur from public.tenant_plan p where p.tenant_id = t for update;
      if found and cur.status <> 'ended' and (cur.ends_at is null or cur.ends_at > now()) then
        if array_position(tiers, tier) < array_position(tiers, cur.tier) then
          raise exception 'Order form % would lower % from % to %. Record a downgrade as a deliberate plan change, not a signature.',
            c.id, t, cur.tier, tier using errcode = '23514';
        end if;
        if c.ends_at is not null and (cur.ends_at is null or c.ends_at < cur.ends_at) then
          raise exception 'Order form % would shorten the plan of % from % to %. Record a shorter term as a deliberate plan change, not a signature.',
            c.id, t, coalesce(cur.ends_at::text, 'open-ended'), c.ends_at using errcode = '23514';
        end if;
      end if;

      insert into public.tenant_plan (tenant_id, tier, status, starts_at, ends_at, reason, updated_by)
      values (t, tier, 'active', c.effective_at, c.ends_at, why, c.owner_id)
      on conflict (tenant_id) do update
        set tier = excluded.tier, status = excluded.status, starts_at = excluded.starts_at,
            ends_at = excluded.ends_at, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now()
        where (public.tenant_plan.tier, public.tenant_plan.status, public.tenant_plan.starts_at, public.tenant_plan.ends_at)
              is distinct from (excluded.tier, excluded.status, excluded.starts_at, excluded.ends_at);
    end if;
    insert into public.implementation_projects (billing_account_id, tenant_id, contract_id, owner_id)
    values (c.billing_account_id, t, c.id, c.owner_id)
    on conflict (contract_id, coalesce(tenant_id, '')) where contract_id is not null do nothing;
  end loop;

  if not any_tenant then
    insert into public.implementation_projects (billing_account_id, tenant_id, contract_id, owner_id)
    values (c.billing_account_id, null, c.id, c.owner_id)
    on conflict (contract_id, coalesce(tenant_id, '')) where contract_id is not null do nothing;
  end if;

  if c.ends_at is not null then
    insert into public.renewal_opportunities (contract_id, renewal_date, owner_id)
    values (c.id, ((c.ends_at at time zone 'UTC') - interval '120 days')::date, c.owner_id)
    on conflict (contract_id) do nothing;
  end if;
end $$;
revoke all on function private.apply_signed_contract(uuid) from public, anon, authenticated;
