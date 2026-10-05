-- Semester — the commercial core's moving parts: checkout, the payment
-- webhook's writes, the dunning worker, contract → tenant, site lead intake
-- and the nightly account-health job.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `20260929070000_commercial_core.sql` is the schema and its rules. This file
-- is what writes to it, and every function here is the service role's alone:
-- the three Edge Functions (`billing-checkout`, `billing-webhook`,
-- `lead-intake`) call them with the service key after doing their own checks,
-- and `scheduler.sql` runs the two jobs. Nothing here is callable by a
-- signed-in account or a visitor.
--
-- Nothing charges anyone until `STRIPE_SECRET_KEY` and
-- `STRIPE_WEBHOOK_SECRET` are set on the functions; see docs/COMMERCIAL-CORE.md.

-- ── 1. The CTA routes the company site posts ──────────────────────────────
--
-- Two vocabularies widen: `anyone` for the two routes with no audience
-- (feedback and general contact), and `invite_queue` for the private beta's
-- invite requests, which are neither a signup nor a support ticket.

alter table public.cta_routes drop constraint if exists cta_routes_audience_check;
alter table public.cta_routes add constraint cta_routes_audience_check check (audience in (
  'student', 'department', 'institution', 'enterprise', 'security', 'candidate', 'partner', 'customer', 'anyone'));
alter table public.cta_routes drop constraint if exists cta_routes_destination_check;
alter table public.cta_routes add constraint cta_routes_destination_check check (destination in (
  'signup', 'tool', 'crm_lead', 'procurement_queue', 'ats', 'partner_crm', 'customer_portal', 'support', 'invite_queue'));

insert into public.cta_routes (key, audience, label, destination, owner_team, response_sla_hours) values
  ('request_invite',        'student',  'Request an invite',              'invite_queue', 'Growth',        72),
  ('accessibility_barrier', 'customer', 'Report an accessibility barrier', 'support',      'Accessibility', 48),
  ('site_feedback',         'anyone',   'Send feedback',                  'support',      'Product',       120),
  ('general_contact',       'anyone',   'Contact Semester',               'support',      'Founder',       48)
on conflict (key) do nothing;

-- ── 2. Provider references, for the webhook to find its rows ─────────────

alter table public.invoices add column if not exists provider_ref text
  check (provider_ref is null or length(provider_ref) <= 120);
create unique index if not exists invoices_one_per_provider_ref
  on public.invoices (provider_ref) where provider_ref is not null;

create unique index if not exists subscriptions_one_per_provider_ref
  on public.subscriptions (provider_ref) where provider_ref is not null;
-- The provider's event time of the last change applied, so an older event
-- delivered late never overwrites a newer one.
alter table public.subscriptions add column if not exists provider_event_at timestamptz;

-- ── 3. Checkout: consent recorded before the provider's page opens ───────
--
-- `billing-checkout` records the signed-in person's explicit consent (when,
-- and to which wording) here, then opens the provider's hosted page. No card
-- data touches Semester. The webhook's `checkout.session.completed` turns a
-- row into a subscription, copying the consent across — which the
-- subscription's own check constraint requires of every paid plan.

create table if not exists public.checkout_sessions (
  id                    uuid        primary key default gen_random_uuid(),
  billing_account_id    uuid        not null references public.billing_accounts (id) on delete cascade,
  price_id              uuid        not null references public.commercial_prices (id) on delete restrict,
  plan_code             text        not null references public.commercial_plans (code) on delete restrict,
  consent_at            timestamptz not null default now(),
  consent_text_version  text        not null check (consent_text_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  provider              text        not null default 'stripe' check (provider ~ '^[a-z][a-z0-9_]{1,29}$'),
  provider_session_id   text        unique check (provider_session_id is null or length(provider_session_id) <= 200),
  status                text        not null default 'open' check (status in ('open', 'completed', 'expired')),
  subscription_id       uuid        references public.subscriptions (id) on delete set null,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  constraint checkout_completed_has_subscription check (status <> 'completed' or subscription_id is not null)
);
create index if not exists checkout_sessions_by_account on public.checkout_sessions (billing_account_id);
create index if not exists checkout_sessions_by_price on public.checkout_sessions (price_id);
create index if not exists checkout_sessions_by_plan on public.checkout_sessions (plan_code);
create index if not exists checkout_sessions_by_subscription on public.checkout_sessions (subscription_id);
-- One open checkout per person and price. A second click, a second tab or
-- a retried request all come back to the same row, so however many hosted
-- pages the provider opens for it, `complete_checkout` makes one subscription.
create unique index if not exists checkout_sessions_one_open_per_price
  on public.checkout_sessions (billing_account_id, price_id) where status = 'open';

alter table public.checkout_sessions enable row level security;
revoke all on public.checkout_sessions from public, anon, authenticated;
grant select on public.checkout_sessions to authenticated;
drop policy if exists "billing readers read" on public.checkout_sessions;
create policy "billing readers read" on public.checkout_sessions for select to authenticated
  using (private.can_read_billing(billing_account_id));

-- Start a checkout for a person and one current, individually sold price.
-- Returns one row; `outcome` is 'ok', 'no_such_price' or 'already_subscribed'.
-- Beginning the same checkout again returns the open row it began, with the
-- consent re-stamped now, rather than a second row that could become a
-- second subscription.
create or replace function public.begin_checkout(want_user uuid, want_price uuid, want_consent_version text)
returns table (outcome text, checkout_id uuid, billing_account_id uuid, customer_ref text, email text,
               plan_name text, amount_cents integer, currency text, billing_interval text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  p record;
  who_email text;
  acct public.billing_accounts;
  started uuid;
begin
  select pr.id, pr.plan_code, pr.amount_cents, pr.currency, pr.billing_interval, pl.name
    into p
    from public.commercial_prices pr
    join public.commercial_plans pl on pl.code = pr.plan_code and pl.active
    join public.commercial_products pd on pd.code = pl.product_code and pd.active and pd.audience = 'individual'
   where pr.id = want_price
     and pr.active and pr.effective_from <= now() and (pr.effective_to is null or pr.effective_to > now())
     and pr.billing_interval in ('month', 'year')
     and pr.amount_cents > 0;
  select u.email into who_email from auth.users u where u.id = want_user;
  if p.id is null or who_email is null then
    return query select 'no_such_price'::text, null::uuid, null::uuid, null::text, null::text,
                        null::text, null::integer, null::text, null::text;
    return;
  end if;

  if exists (select 1 from public.billing_accounts a
               join public.subscriptions s on s.billing_account_id = a.id
              where a.user_id = want_user and s.plan_code <> 'free'
                and s.status in ('trialing', 'active', 'past_due', 'grace')
                and s.current_period_end > now()) then
    return query select 'already_subscribed'::text, null::uuid, null::uuid, null::text, null::text,
                        null::text, null::integer, null::text, null::text;
    return;
  end if;

  insert into public.billing_accounts (kind, user_id, name)
  values ('individual', want_user, 'Individual subscriber')
  on conflict (user_id) where user_id is not null do nothing;
  select * into acct from public.billing_accounts a where a.user_id = want_user;

  insert into public.checkout_sessions (billing_account_id, price_id, plan_code, consent_text_version)
  values (acct.id, p.id, p.plan_code, want_consent_version)
  on conflict (billing_account_id, price_id) where status = 'open'
  do update set consent_at = now(), consent_text_version = excluded.consent_text_version
  returning id into started;

  return query select 'ok'::text, started, acct.id, acct.provider_ref, who_email,
                      p.name::text, p.amount_cents, p.currency::text, p.billing_interval::text;
end $$;

-- The provider's page most recently opened for an open checkout. A reused
-- checkout gets a fresh page each time it is begun; the row names the latest.
create or replace function public.attach_checkout_session(want_checkout uuid, want_session text)
returns void language sql security definer set search_path = '' as $$
  update public.checkout_sessions set provider_session_id = want_session
   where id = want_checkout and status = 'open' and provider_session_id is distinct from want_session;
$$;

-- The provider confirmed the checkout: a subscription, active, with the
-- consent recorded when it began and the plan's entitlements. Idempotent: a
-- second call returns the same subscription.
create or replace function public.complete_checkout(
  want_checkout uuid, want_subscription_ref text, want_customer_ref text, want_period_end timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.checkout_sessions;
  pr public.commercial_prices;
  made uuid;
begin
  select * into c from public.checkout_sessions where id = want_checkout for update;
  if not found then
    return null;
  end if;
  if c.status = 'completed' then
    return c.subscription_id;
  end if;
  select * into pr from public.commercial_prices where id = c.price_id;

  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_start,
                                    current_period_end, consent_at, consent_text_version, provider_ref)
  values (c.billing_account_id, c.plan_code, c.price_id, 'active', now(),
          coalesce(want_period_end,
                   now() + case pr.billing_interval when 'year' then interval '1 year' else interval '1 month' end),
          c.consent_at, c.consent_text_version, nullif(want_subscription_ref, ''))
  returning id into made;

  insert into public.subscription_entitlements (subscription_id, entitlement_key, value, source)
  select made, e.entitlement_key, e.value, 'plan' from public.plan_entitlements e where e.plan_code = c.plan_code
  on conflict (subscription_id, entitlement_key) do nothing;

  update public.billing_accounts set provider_ref = coalesce(provider_ref, nullif(want_customer_ref, ''))
   where id = c.billing_account_id;
  update public.checkout_sessions set status = 'completed', completed_at = now(), subscription_id = made
   where id = c.id;
  return made;
end $$;

-- A provider's subscription changed (renewed, cancelled at period end,
-- ended). Applied only if the event is newer than the last one applied.
-- Returns 'unknown', 'stale' or 'updated'.
create or replace function public.sync_provider_subscription(
  want_ref text, want_status text, want_period_start timestamptz, want_period_end timestamptz,
  want_cancel_at_period_end boolean, want_event_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscriptions;
begin
  select * into s from public.subscriptions where provider_ref = want_ref for update;
  if not found then
    return 'unknown';
  end if;
  if s.provider_event_at is not null and want_event_at <= s.provider_event_at then
    return 'stale';
  end if;
  update public.subscriptions
     set status = want_status,
         current_period_start = coalesce(want_period_start, current_period_start),
         current_period_end = coalesce(want_period_end, current_period_end),
         cancel_at_period_end = coalesce(want_cancel_at_period_end, cancel_at_period_end),
         canceled_at = case when want_status in ('canceled', 'ended') then coalesce(canceled_at, now()) else canceled_at end,
         provider_event_at = want_event_at,
         updated_at = now()
   where id = s.id;
  -- An ended subscription entitles nothing it was paid for.
  if want_status in ('canceled', 'ended') then
    delete from public.subscription_entitlements where subscription_id = s.id and source in ('plan', 'contract');
  end if;
  return 'updated';
end $$;

-- A provider's invoice, recorded once against the subscription it bills.
-- Returns Semester's invoice id, or null when the subscription is unknown.
create or replace function public.upsert_provider_invoice(
  want_subscription_ref text, want_invoice_ref text, want_amount_cents bigint, want_currency text,
  want_issued_at timestamptz, want_due_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscriptions;
  found_id uuid;
begin
  select id into found_id from public.invoices where provider_ref = want_invoice_ref;
  if found_id is not null then
    return found_id;
  end if;
  select * into s from public.subscriptions where provider_ref = want_subscription_ref;
  if not found then
    return null;
  end if;
  insert into public.invoices (billing_account_id, subscription_id, status, currency, subtotal_cents,
                               issued_at, due_at, provider_ref)
  values (s.billing_account_id, s.id, 'open', coalesce(lower(want_currency), 'usd'), greatest(coalesce(want_amount_cents, 0), 0),
          coalesce(want_issued_at, now()), coalesce(want_due_at, want_issued_at, now()), want_invoice_ref)
  on conflict (provider_ref) where provider_ref is not null do nothing
  returning id into found_id;
  if found_id is null then
    select id into found_id from public.invoices where provider_ref = want_invoice_ref;
  end if;
  return found_id;
end $$;

-- `apply_payment_event`, once more, with three changes from 20260929070000:
-- a payment that clears a subscription gives back the paid features the
-- dunning worker restricted; it recovers every case still open *or*
-- restricted, not only an open one; and a failure reported for an invoice
-- that is already paid is recorded and otherwise ignored, so a late-delivered
-- or out-of-order failure never puts a paying subscription back into dunning.
create or replace function public.apply_payment_event(
  want_provider text, want_event_id text, want_kind text, want_invoice uuid,
  want_amount_cents bigint, want_payload_sha256 text, grace interval default interval '14 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  open_case uuid;
begin
  insert into public.payment_events (provider, provider_event_id, kind, invoice_id, amount_cents, payload_sha256)
  values (want_provider, want_event_id, want_kind, want_invoice, want_amount_cents, want_payload_sha256)
  on conflict (provider, provider_event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into inv from public.invoices where id = want_invoice;
  if not found then
    return 'recorded';
  end if;

  if want_kind = 'payment_succeeded' then
    update public.invoices set status = 'paid', paid_at = now() where id = inv.id;
    if inv.subscription_id is not null then
      update public.subscriptions set status = 'active', updated_at = now()
       where id = inv.subscription_id and status in ('past_due', 'grace');
      with recovered as (
        update public.dunning_cases set status = 'recovered', closed_at = now()
         where subscription_id = inv.subscription_id and status in ('open', 'restricted')
        returning id
      )
      insert into public.dunning_actions (case_id, action, detail)
      select id, 'recover', 'Payment received.' from recovered;
      insert into public.subscription_entitlements (subscription_id, entitlement_key, value, source)
      select inv.subscription_id, e.entitlement_key, e.value, 'plan'
        from public.subscriptions s join public.plan_entitlements e on e.plan_code = s.plan_code
       where s.id = inv.subscription_id and s.status in ('trialing', 'active')
      on conflict (subscription_id, entitlement_key) do nothing;
    end if;
    return 'paid';
  elsif want_kind = 'payment_failed' and inv.subscription_id is not null and inv.status <> 'paid' then
    update public.subscriptions set status = 'past_due', updated_at = now()
     where id = inv.subscription_id and status in ('active', 'trialing', 'grace');
    insert into public.dunning_cases (subscription_id, invoice_id, grace_ends_at)
    values (inv.subscription_id, inv.id, now() + grace)
    on conflict (subscription_id) where status = 'open' do nothing
    returning id into open_case;
    if open_case is null then
      select id into open_case from public.dunning_cases
       where subscription_id = inv.subscription_id and status = 'open';
      insert into public.dunning_actions (case_id, action, detail) values (open_case, 'retry', 'Another failed attempt.');
    else
      insert into public.dunning_actions (case_id, action, detail) values (open_case, 'notice', 'Payment failed; customer notified.');
    end if;
    return 'dunning';
  end if;
  return 'recorded';
end $$;

-- ── 4. The dunning worker ─────────────────────────────────────────────────
--
-- Hourly (scheduler.sql → `commercial-dunning`). For every open case:
--
--   grace has ended         → case `restricted`, action `restrict`, and the
--                             subscription's paid entitlements removed
--   within 3 days of that   → one `final_notice`, naming the exact date
--   quiet for 3 days        → a `reminder`
--
-- It writes the record of each reminder; the provider's own customer emails
-- (Stripe's, once it is connected) are what reach the person. It touches only
-- `dunning_cases`, `dunning_actions` and `subscription_entitlements` — never a
-- student's data, their export or their deletion, which are free on every
-- plan in every state. Running it twice at the same moment writes nothing the
-- second time. `want_at` is for the check suite; the job passes nothing.

create or replace function public.run_dunning(want_at timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.dunning_cases;
  reminders integer := 0;
  finals integer := 0;
  restricted integer := 0;
  last_at timestamptz;
begin
  for c in select * from public.dunning_cases where status = 'open' order by opened_at for update skip locked loop
    if want_at >= c.grace_ends_at then
      update public.dunning_cases set status = 'restricted', closed_at = want_at where id = c.id;
      insert into public.dunning_actions (case_id, action, detail, at)
      values (c.id, 'restrict', 'Grace period ended; paid features restricted. Data, export and deletion are unaffected.', want_at);
      delete from public.subscription_entitlements
       where subscription_id = c.subscription_id and source in ('plan', 'contract');
      restricted := restricted + 1;
    elsif want_at >= c.grace_ends_at - interval '3 days' then
      if not exists (select 1 from public.dunning_actions a where a.case_id = c.id and a.action = 'final_notice') then
        insert into public.dunning_actions (case_id, action, detail, at)
        values (c.id, 'final_notice',
                format('Paid features will be restricted on %s UTC unless payment succeeds.',
                       to_char(c.grace_ends_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')),
                want_at);
        finals := finals + 1;
      end if;
    else
      select max(a.at) into last_at from public.dunning_actions a where a.case_id = c.id;
      if last_at is null or last_at <= want_at - interval '3 days' then
        insert into public.dunning_actions (case_id, action, detail, at)
        values (c.id, 'reminder',
                format('Payment still outstanding; paid features continue until %s UTC.',
                       to_char(c.grace_ends_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')),
                want_at);
        reminders := reminders + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('reminders', reminders, 'final_notices', finals, 'restricted', restricted);
end $$;

-- ── 5. Contract → tenant ──────────────────────────────────────────────────
--
-- When an order form becomes `signed`: every tenant its billing account
-- funds gets the signed tier in `tenant_plan` (the one place the entitlement
-- order reads a plan; only the service role writes it, and this runs as the
-- service role's write of the contract), an `implementation_projects` row per
-- tenant, and one `renewal_opportunities` row dated `ends_at - 120 days`, the
-- day the renewal review opens. Idempotent: signing again, or running the
-- backfill below twice, changes nothing.
--
-- The tier is the highest `tenant_tier` among the plans on the contract's
-- quote lines, or on subscriptions tied to the contract. A contract naming no
-- institutional plan still gets its project and renewal; it writes no plan.
-- The MSA, DPA and SLA are terms, not an order, and trigger nothing.

create unique index if not exists implementation_projects_one_per_contract_tenant
  on public.implementation_projects (contract_id, coalesce(tenant_id, '')) where contract_id is not null;
drop index if exists public.renewal_opportunities_by_contract;
create unique index if not exists renewal_opportunities_one_per_contract
  on public.renewal_opportunities (contract_id);

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
  order by array_position(array['pilot', 'department', 'campus', 'system'], x.tier) desc
  limit 1;

  if tier = 'pilot' and c.ends_at is null then
    raise exception 'A pilot order form needs an end date before it is signed.' using errcode = '23514';
  end if;

  for t in select bt.tenant_id from public.billing_account_tenants bt where bt.billing_account_id = c.billing_account_id loop
    any_tenant := true;
    if tier is not null then
      insert into public.tenant_plan (tenant_id, tier, status, starts_at, ends_at, reason, updated_by)
      values (t, tier, 'active', c.effective_at, c.ends_at, format('Order form %s signed.', c.id), c.owner_id)
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

create or replace function private.contract_signed_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'signed' and new.kind = 'order_form'
     and (tg_op = 'INSERT' or old.status is distinct from 'signed') then
    perform private.apply_signed_contract(new.id);
  end if;
  return new;
end $$;
revoke all on function private.contract_signed_trigger() from public, anon, authenticated;

drop trigger if exists contract_signed_to_tenant on public.contracts;
create trigger contract_signed_to_tenant after insert or update of status on public.contracts
  for each row execute function private.contract_signed_trigger();

-- Any order form already signed before this trigger existed.
select private.apply_signed_contract(c.id) from public.contracts c where c.status = 'signed' and c.kind = 'order_form';

-- ── 6. Site leads ─────────────────────────────────────────────────────────
--
-- The company site's forms post to `lead-intake`, which validates, drops the
-- honeypot, hashes the caller's IP with a secret salt and calls
-- `submit_site_lead`. Every submission is kept here, whatever its route;
-- institutional routes also create or update the `gtm_accounts` /
-- `gtm_stakeholders` pipeline, and `procurement_queue` also queues a
-- `trust_room_requests` row for the trust officer.
--
-- Why not `gtm_conversion_events`: that table is a school's own campaign
-- funnel, keyed to a tenant and a `gtm_prospects` row (a student the school
-- may message). A visitor to Semester's site is neither, and filing them
-- there would put a stranger in a school's audience. The conversion is this
-- row: its route, its page, its time.
--
-- The table holds what a visitor typed, so it has row-level security on, no
-- policy and no grant: the service role reads it, and the owner reads the
-- notification email. The raw IP address is never stored; `site_lead_hits`
-- holds a salted hash for one day, for the rate limit.

create table if not exists public.site_leads (
  id                  uuid        primary key default gen_random_uuid(),
  reference           text        not null unique check (reference ~ '^SL-[0-9A-F]{10}$'),
  route_key           text        not null references public.cta_routes (key) on delete restrict,
  destination         text        not null,
  name                text        not null check (length(trim(name)) between 1 and 200),
  email               text        not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 320),
  organization        text        not null default '' check (length(organization) <= 200),
  role                text        not null default '' check (length(role) <= 120),
  message             text        not null default '' check (length(message) <= 5000),
  fields              jsonb       not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  page                text        not null default '' check (length(page) <= 500),
  status              text        not null default 'new' check (status in ('new', 'in_progress', 'answered', 'closed', 'spam')),
  respond_by          timestamptz,
  gtm_account_id      uuid        references public.gtm_accounts (id) on delete set null,
  gtm_stakeholder_id  uuid        references public.gtm_stakeholders (id) on delete set null,
  trust_request_id    uuid        references public.trust_room_requests (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists site_leads_by_route on public.site_leads (route_key, created_at desc);
create index if not exists site_leads_by_account on public.site_leads (gtm_account_id);
create index if not exists site_leads_by_stakeholder on public.site_leads (gtm_stakeholder_id);
create index if not exists site_leads_by_trust_request on public.site_leads (trust_request_id);

alter table public.site_leads enable row level security;
revoke all on public.site_leads from public, anon, authenticated;

create table if not exists private.site_lead_hits (
  ip_hash  text        not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  at       timestamptz not null default now()
);
create index if not exists site_lead_hits_by_hash on private.site_lead_hits (ip_hash, at);
alter table private.site_lead_hits enable row level security;
revoke all on private.site_lead_hits from public, anon, authenticated;

-- Five submissions an hour from one network. A person sends one; a school's
-- committee on one campus network might send three; a script is stopped at
-- five rather than filling the owner's inbox.
create or replace function public.submit_site_lead(
  want_route text, want_name text, want_email text, want_organization text, want_role text,
  want_committee_role text, want_message text, want_fields jsonb, want_page text, want_ip_hash text)
returns table (outcome text, reference text, destination text, label text, owner_team text, respond_by timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.cta_routes;
  institutional boolean;
  acct uuid;
  person uuid;
  request uuid;
  ref text := 'SL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  due timestamptz;
  org text := trim(coalesce(want_organization, ''));
begin
  if want_ip_hash is null or want_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'ip hash required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('site_lead:' || want_ip_hash));

  delete from private.site_lead_hits h
   where h.ctid in (select x.ctid from private.site_lead_hits x where x.at < now() - interval '1 day' limit 200);
  if (select count(*) from private.site_lead_hits h
       where h.ip_hash = want_ip_hash and h.at > now() - interval '1 hour') >= 5 then
    return query select 'rate_limited'::text, null::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;
  insert into private.site_lead_hits (ip_hash) values (want_ip_hash);

  select * into r from public.cta_routes c where c.key = want_route and c.active;
  if not found then
    return query select 'unknown_route'::text, null::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  institutional := r.destination in ('crm_lead', 'procurement_queue')
                   and r.audience in ('department', 'institution', 'enterprise', 'security');
  if institutional and org = '' then
    return query select 'organization_required'::text, null::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if institutional then
    select a.id into acct from public.gtm_accounts a
     where lower(a.name) = lower(org) order by a.created_at limit 1;
    if acct is null then
      insert into public.gtm_accounts (name, segment, status, owner_id)
      values (left(org, 200), 'other', 'engaged', null)
      returning id into acct;
    else
      update public.gtm_accounts set status = 'engaged', updated_at = now()
       where id = acct and status = 'target';
    end if;

    select s.id into person from public.gtm_stakeholders s
     where s.account_id = acct and lower(s.display_name) = lower(trim(want_name))
     order by s.created_at limit 1;
    if person is null then
      insert into public.gtm_stakeholders (account_id, committee_role, display_name, title)
      values (acct, want_committee_role, left(trim(want_name), 200), left(coalesce(want_role, ''), 200))
      returning id into person;
    end if;

    if r.destination = 'procurement_queue' then
      insert into public.trust_room_requests (account_id, stakeholder_id, requester_name, requester_email,
                                              requester_role, reason)
      values (acct, person, left(trim(want_name), 200), want_email, want_committee_role,
              left(coalesce(want_message, ''), 2000))
      returning id into request;
    end if;
  end if;

  due := case when r.response_sla_hours is null then null
              else now() + make_interval(hours => r.response_sla_hours) end;
  insert into public.site_leads (reference, route_key, destination, name, email, organization, role, message,
                                 fields, page, respond_by, gtm_account_id, gtm_stakeholder_id, trust_request_id)
  values (ref, r.key, r.destination, trim(want_name), want_email, org, coalesce(want_role, ''),
          coalesce(want_message, ''), coalesce(want_fields, '{}'::jsonb), coalesce(want_page, ''), due,
          acct, person, request);

  return query select 'ok'::text, ref, r.destination, r.label, r.owner_team, due;
end $$;

-- ── 7. Account health, nightly ────────────────────────────────────────────
--
-- One snapshot per institutional billing account per day
-- (scheduler.sql → `account-health`), from account-level signals only —
-- implementation stage, overdue invoices, days to renewal, a recent QBR —
-- which `private.health_signals_ok` already holds to its allowlist. Each names
-- a reason and a next action. Anything but `healthy` is written
-- `pending_review`: a person reads it and marks it reviewed or dismissed
-- before it drives any outreach. Nothing about a student is read.

alter table public.account_health_snapshots add column if not exists source text not null default 'manual'
  check (source in ('manual', 'nightly'));
alter table public.account_health_snapshots add column if not exists review_state text not null default 'pending_review'
  check (review_state in ('pending_review', 'reviewed', 'dismissed', 'not_needed'));
alter table public.account_health_snapshots add column if not exists reviewed_by uuid
  references auth.users (id) on delete set null;
alter table public.account_health_snapshots add column if not exists reviewed_at timestamptz;
create index if not exists account_health_by_reviewer on public.account_health_snapshots (reviewed_by);

create or replace function public.compute_account_health(want_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  impl_pct integer;
  blocked boolean;
  at_risk boolean;
  to_renewal integer;
  overdue integer;
  qbr boolean;
  st text;
  why text;
  next_step text;
  written integer := 0;
begin
  for a in select b.id, sp.owner_id from public.billing_accounts b
             left join public.success_plans sp on sp.billing_account_id = b.id
            where b.kind = 'institution'
              and not exists (select 1 from public.account_health_snapshots h
                               where h.billing_account_id = b.id and h.source = 'nightly'
                                 and h.taken_at >= date_trunc('day', want_at)
                                 and h.taken_at < date_trunc('day', want_at) + interval '1 day') loop
    select case when p.status = 'done' then 100
                else ((array_position(array['discover', 'configure', 'integrate', 'validate', 'train', 'launch',
                                            'hypercare', 'measure', 'expand'], p.stage) - 1) * 100 / 8) end
      into impl_pct
      from public.implementation_projects p where p.billing_account_id = a.id
     order by p.created_at desc limit 1;
    select coalesce(bool_or(p.status = 'blocked'), false), coalesce(bool_or(p.status = 'at_risk'), false)
      into blocked, at_risk
      from public.implementation_projects p where p.billing_account_id = a.id;
    -- Days to the end of the term being renewed; the review opens at 120.
    select min((c.ends_at at time zone 'UTC')::date - (want_at at time zone 'UTC')::date) into to_renewal
      from public.renewal_opportunities r join public.contracts c on c.id = r.contract_id
     where c.billing_account_id = a.id and r.outcome = 'pending' and c.ends_at is not null;
    select max(floor(extract(epoch from (want_at - i.due_at)) / 86400))::integer into overdue
      from public.invoices i
     where i.billing_account_id = a.id and i.status = 'open' and i.due_at < want_at;
    select exists (select 1 from public.qbrs q join public.success_plans sp on sp.id = q.success_plan_id
                    where sp.billing_account_id = a.id and q.held_on > (want_at - interval '120 days')::date)
      into qbr;

    if coalesce(overdue, 0) > 30 then
      st := 'at_risk_commercial';
      why := format('An invoice is %s days overdue.', overdue);
      next_step := 'Finance confirms the PO and contacts the billing contact';
    elsif blocked then
      st := 'implementation_blocked';
      why := 'An implementation project is blocked.';
      next_step := 'Customer success reviews the blocker with the project owner';
    elsif to_renewal is not null and to_renewal between 0 and 120 then
      st := 'renewal_planning';
      why := format('The term ends in %s days; the renewal review is open.', to_renewal);
      next_step := 'The account owner prepares the renewal review';
    elsif at_risk then
      st := 'needs_attention';
      why := 'An implementation project is at risk.';
      next_step := 'Customer success checks the plan with the school';
    elsif coalesce(overdue, 0) > 0 then
      st := 'needs_attention';
      why := format('An invoice is %s days overdue.', overdue);
      next_step := 'Finance sends a reminder to the billing contact';
    else
      st := 'healthy';
      why := 'No account-level signal needs attention.';
      next_step := 'None; reviewed again tomorrow night';
    end if;

    insert into public.account_health_snapshots (billing_account_id, status, reason, next_action, action_owner,
                                                 signals, taken_at, source, review_state)
    values (a.id, st, why, next_step, a.owner_id,
            jsonb_strip_nulls(jsonb_build_object(
              'implementation_pct', impl_pct,
              'days_to_renewal', to_renewal,
              'invoice_overdue_days', overdue,
              'qbr_done', qbr)),
            want_at, 'nightly', case when st = 'healthy' then 'not_needed' else 'pending_review' end);
    written := written + 1;
  end loop;
  return written;
end $$;

-- ── 8. Who may call any of it: the service role ───────────────────────────

do $$
declare f text;
begin
  foreach f in array array[
    'public.begin_checkout(uuid, uuid, text)',
    'public.attach_checkout_session(uuid, text)',
    'public.complete_checkout(uuid, text, text, timestamptz)',
    'public.sync_provider_subscription(text, text, timestamptz, timestamptz, boolean, timestamptz)',
    'public.upsert_provider_invoice(text, text, bigint, text, timestamptz, timestamptz)',
    'public.apply_payment_event(text, text, text, uuid, bigint, text, interval)',
    'public.run_dunning(timestamptz)',
    'public.submit_site_lead(text, text, text, text, text, text, text, jsonb, text, text)',
    'public.compute_account_health(timestamptz)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

comment on table public.checkout_sessions is
  'A checkout begun by a signed-in person: the price and the consent they gave (when, which wording) before the provider''s hosted page opened. Completed by the verified webhook into a subscription.';
comment on table public.site_leads is
  'Every company-site form submission, by route. RLS on, no policy, no grant: service role only. No raw IP address is stored.';
comment on function public.run_dunning(timestamptz) is
  'Service-only, hourly: reminders, one final notice with the exact date, and at grace end restricts paid entitlements. Never touches data, export or deletion.';
comment on function public.submit_site_lead(text, text, text, text, text, text, text, jsonb, text, text) is
  'Service-only: one company-site form submission. Rate-limited per salted IP hash; routes by cta_routes; institutional routes reach the GTM pipeline and procurement requests the trust room.';
comment on function public.compute_account_health(timestamptz) is
  'Service-only, nightly: one account-level health snapshot per institutional billing account, each with a reason and next action, pending human review unless healthy.';
