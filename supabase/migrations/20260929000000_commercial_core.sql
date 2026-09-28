-- Semester — the commercial core: catalog, billing, contracts, customer
-- success and the governance registers behind the company site.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- What already exists and is reused, not duplicated:
--   * `gtm_accounts`, `gtm_stakeholders`, `gtm_pilots`, `gtm_decision_log`:
--     the institutional pipeline before a contract.
--   * `trust_room_requests` / `trust_room_grants`: procurement documents.
--   * `tenant_plan`: the plan the entitlement order reads at launch. This
--     migration does not write it; the service that records a signed contract
--     keeps writing `tenant_plan` as it does today.
--
-- ## Four ideas kept apart (the billing rule)
--
--   plan          what is sold (Free, Plus, Department Launch, …)
--   subscription  a time-bound relationship between a billing account and a plan
--   entitlement   a right to use a feature, limit or service tier
--   authorization who may act on which tenant, object or record
--
-- A subscription grants entitlements. It never grants authorization: paying
-- for a feature does not let anyone read a record that RLS would refuse, and
-- nothing in this file is consulted by a policy on student data.
--
-- ## Who writes: the service role, almost always
--
-- Prices, invoices, contracts, payments and entitlements are commercial facts
-- recorded by Semester's own back office or by the payment provider's
-- verified webhook. There is no write policy on any of them. The one thing a
-- person can do from the API is cancel their own subscription
-- (`request_cancellation`), because cancelling must be as easy as signing up.
--
-- ## Who reads
--
--   * A student reads their own billing account, subscriptions, invoices.
--   * An institution's `billing_contact` reads its account's commercial
--     records. A `university_admin` does not get invoices by default, and a
--     billing contact does not get configuration: least privilege both ways.
--   * An institution's administrators and auditors read implementation and
--     success records for their school.
--   * Semester staff read through capabilities: `billing:operate`,
--     `success:manage`, `compliance:manage`, `content:manage`, and the
--     existing `account:manage`.
--   * Payment events are read by nobody through the API.
--
-- ## What is never stored
--
-- Card numbers, bank details, raw provider payloads and secrets. A payment
-- event keeps the provider's event id (for idempotency), the amount and a hash
-- of the payload, nothing more.

-- ── 1. Roles and capabilities ─────────────────────────────────────────────

insert into public.app_roles (role, global) values
  ('finance_operator', true),
  ('customer_success', true),
  ('compliance_owner', true),
  ('content_owner',    true),
  ('billing_contact',  false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('billing:operate',   'Semester''s back office: read every billing account, subscription, invoice, contract and dunning case. Writes still go through the service role.'),
  ('billing:read',      'Read one school''s commercial records: contracts, invoices, subscriptions, renewal dates. Never configuration or student data.'),
  ('success:manage',    'Semester customer success: read implementation projects, success plans, QBRs, renewals and account health.'),
  ('compliance:manage', 'Read and maintain the compliance control register, evidence index and public claims register.'),
  ('content:manage',    'Read and maintain the content register and CTA routing table behind the company site.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('finance_operator',  'billing:operate'),
  ('customer_success',  'success:manage'),
  ('account_executive', 'success:manage'),
  ('compliance_owner',  'compliance:manage'),
  ('content_owner',     'content:manage'),
  ('billing_contact',   'billing:read')
on conflict (role, capability) do nothing;

create or replace function private.commercial_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('billing:operate', 'platform', '')
      or private.has_capability('account:manage', 'platform', '')
      or private.has_capability('success:manage', 'platform', '');
$$;
revoke all on function private.commercial_staff() from public, anon;
grant execute on function private.commercial_staff() to authenticated;

-- ── 2. Catalog: products, plans, prices, entitlements ─────────────────────

create table if not exists public.commercial_products (
  code        text        primary key check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name        text        not null check (length(trim(name)) between 1 and 120),
  audience    text        not null check (audience in ('individual', 'institution', 'service')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.commercial_plans (
  code          text        primary key check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  product_code  text        not null references public.commercial_products (code) on delete restrict,
  name          text        not null check (length(trim(name)) between 1 and 120),
  -- The deal desk's tier for institutional plans, so a signed plan maps onto
  -- `tenant_plan.tier` without translation. Null for individual plans.
  tenant_tier   text        check (tenant_tier in ('pilot', 'department', 'campus', 'system')),
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists commercial_plans_by_product on public.commercial_plans (product_code);

create table if not exists public.commercial_prices (
  id              uuid        primary key default gen_random_uuid(),
  plan_code       text        not null references public.commercial_plans (code) on delete restrict,
  currency        text        not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  -- Null is "priced by quote": institutional plans are sold on an order form.
  amount_cents    integer     check (amount_cents is null or amount_cents >= 0),
  billing_interval text       not null check (billing_interval in ('month', 'year', 'one_time', 'quote')),
  active          boolean     not null default true,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  constraint commercial_prices_quote_has_no_amount
    check ((billing_interval = 'quote') = (amount_cents is null)),
  constraint commercial_prices_window check (effective_to is null or effective_to > effective_from)
);
create index if not exists commercial_prices_by_plan on public.commercial_prices (plan_code);

create table if not exists public.entitlement_definitions (
  key         text        primary key check (key ~ '^[a-z][a-z0-9_.:]{2,79}$'),
  kind        text        not null check (kind in ('feature', 'limit', 'service_tier')),
  about       text        not null check (length(trim(about)) between 1 and 400)
);

create table if not exists public.plan_entitlements (
  plan_code        text  not null references public.commercial_plans (code) on delete cascade,
  entitlement_key  text  not null references public.entitlement_definitions (key) on delete restrict,
  -- true for a feature, a number for a limit, a tier name for a service tier.
  value            jsonb not null default 'true'::jsonb,
  primary key (plan_code, entitlement_key)
);
create index if not exists plan_entitlements_by_key on public.plan_entitlements (entitlement_key);

-- The catalog is public: the pricing page reads it, signed in or not. Only
-- active rows are visible; nobody writes through the API.
alter table public.commercial_products enable row level security;
alter table public.commercial_plans enable row level security;
alter table public.commercial_prices enable row level security;
alter table public.entitlement_definitions enable row level security;
alter table public.plan_entitlements enable row level security;
do $$
declare t text;
begin
  foreach t in array array['commercial_products', 'commercial_plans', 'commercial_prices',
                           'entitlement_definitions', 'plan_entitlements'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

drop policy if exists "anyone reads active products" on public.commercial_products;
create policy "anyone reads active products" on public.commercial_products
  for select to anon, authenticated using (active);
drop policy if exists "anyone reads active plans" on public.commercial_plans;
create policy "anyone reads active plans" on public.commercial_plans
  for select to anon, authenticated using (active);
drop policy if exists "anyone reads current prices" on public.commercial_prices;
create policy "anyone reads current prices" on public.commercial_prices
  for select to anon, authenticated
  using (active and effective_from <= now() and (effective_to is null or effective_to > now()));
drop policy if exists "anyone reads entitlement definitions" on public.entitlement_definitions;
create policy "anyone reads entitlement definitions" on public.entitlement_definitions
  for select to anon, authenticated using (true);
drop policy if exists "anyone reads plan entitlements" on public.plan_entitlements;
create policy "anyone reads plan entitlements" on public.plan_entitlements
  for select to anon, authenticated using (true);

-- The catalog the company site describes. Individual prices are the planning
-- figures in the financial model; checkout is not live until a payment
-- provider is connected.
insert into public.commercial_products (code, name, audience) values
  ('semester_individual', 'Semester for students', 'individual'),
  ('semester_institution', 'Semester for institutions', 'institution'),
  ('professional_services', 'Professional services', 'service')
on conflict (code) do nothing;

insert into public.commercial_plans (code, product_code, name, tenant_tier) values
  ('free',                'semester_individual',   'Free',                       null),
  ('plus',                'semester_individual',   'Plus',                       null),
  ('pro',                 'semester_individual',   'Pro',                        null),
  ('department_launch',   'semester_institution',  'Department Launch',          'department'),
  ('registration_pilot',  'semester_institution',  'Registration & Path Pilot',  'pilot'),
  ('semester_access',     'semester_institution',  'Semester Access',            'campus'),
  ('native_lms',          'semester_institution',  'Native LMS',                 'campus'),
  ('university_os',       'semester_institution',  'University OS',              'system'),
  ('implementation',      'professional_services', 'Implementation services',    null)
on conflict (code) do nothing;

insert into public.commercial_prices (plan_code, amount_cents, billing_interval)
select v.plan_code, v.amount_cents, v.billing_interval
from (values
  ('free',   0,    'month'),
  ('plus',   399,  'month'),
  ('plus',   2999, 'year'),
  ('department_launch',  null, 'quote'),
  ('registration_pilot', null, 'quote'),
  ('semester_access',    null, 'quote'),
  ('native_lms',         null, 'quote'),
  ('university_os',      null, 'quote'),
  ('implementation',     null, 'quote')
) as v(plan_code, amount_cents, billing_interval)
where not exists (
  select 1 from public.commercial_prices p
  where p.plan_code = v.plan_code and p.billing_interval = v.billing_interval
);

insert into public.entitlement_definitions (key, kind, about) values
  ('plan.multiple',        'feature',      'More than one term plan, with comparison.'),
  ('calendar.sync',        'feature',      'Two-way calendar connection.'),
  ('export.formats',       'feature',      'Additional export formats. Data export itself is never paywalled.'),
  ('reminders.expanded',   'feature',      'Expanded reminders and sharing.'),
  ('tenant.sso',           'feature',      'Institution single sign-on.'),
  ('tenant.cohorts',       'limit',        'Number of cohorts a tenant may run.'),
  ('support.tier',         'service_tier', 'standard | extended | critical_24x7')
on conflict (key) do nothing;

insert into public.plan_entitlements (plan_code, entitlement_key, value) values
  ('plus', 'plan.multiple', 'true'), ('plus', 'calendar.sync', 'true'),
  ('plus', 'export.formats', 'true'), ('plus', 'reminders.expanded', 'true'),
  ('department_launch', 'tenant.cohorts', '1'), ('department_launch', 'support.tier', '"standard"'),
  ('registration_pilot', 'tenant.cohorts', '1'), ('registration_pilot', 'support.tier', '"standard"'),
  ('semester_access', 'tenant.sso', 'true'), ('semester_access', 'support.tier', '"extended"'),
  ('university_os', 'tenant.sso', 'true'), ('university_os', 'support.tier', '"critical_24x7"')
on conflict (plan_code, entitlement_key) do nothing;

-- ── 3. Billing accounts ───────────────────────────────────────────────────
--
-- One billing account is either a person or an institution, never both. An
-- institutional account may fund several tenants (a system paying for three
-- campuses), and a tenant's commercial history may span several contracts.

create table if not exists public.billing_accounts (
  id               uuid        primary key default gen_random_uuid(),
  kind             text        not null check (kind in ('individual', 'institution')),
  user_id          uuid        references auth.users (id) on delete set null,
  gtm_account_id   uuid        references public.gtm_accounts (id) on delete set null,
  name             text        not null check (length(trim(name)) between 1 and 200),
  currency         text        not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  -- The payment provider's customer id: an opaque reference, never a secret.
  provider_ref     text        check (provider_ref is null or length(provider_ref) <= 120),
  created_at       timestamptz not null default now(),
  constraint billing_accounts_one_owner check (
    (kind = 'individual'  and gtm_account_id is null) or
    (kind = 'institution' and user_id is null)
  )
);
create unique index if not exists billing_accounts_one_per_person
  on public.billing_accounts (user_id) where user_id is not null;
-- A partial index does not cover the foreign key; this one does.
create index if not exists billing_accounts_by_user on public.billing_accounts (user_id);
create index if not exists billing_accounts_by_gtm on public.billing_accounts (gtm_account_id);

create table if not exists public.billing_account_tenants (
  billing_account_id uuid not null references public.billing_accounts (id) on delete cascade,
  tenant_id          text not null references public.schools (id) on delete cascade,
  primary key (billing_account_id, tenant_id)
);
create index if not exists billing_account_tenants_by_tenant on public.billing_account_tenants (tenant_id);

-- Who may read a billing account's commercial records.
create or replace function private.can_read_billing(want_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('billing:operate', 'platform', '')
      or exists (select 1 from public.billing_accounts a
                  where a.id = want_account and a.user_id = (select auth.uid()))
      or exists (select 1 from public.billing_account_tenants t
                  where t.billing_account_id = want_account
                    and private.has_capability('billing:read', 'school', t.tenant_id));
$$;
revoke all on function private.can_read_billing(uuid) from public, anon;
grant execute on function private.can_read_billing(uuid) to authenticated;

-- Who may read a billing account's delivery records (implementation,
-- success, renewals): the school's administrators and auditors, and staff.
create or replace function private.can_read_delivery(want_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.commercial_staff()
      or exists (select 1 from public.billing_account_tenants t
                  where t.billing_account_id = want_account
                    and (private.has_capability('tenant:configure', 'school', t.tenant_id)
                         or private.has_capability('audit:read', 'school', t.tenant_id)));
$$;
revoke all on function private.can_read_delivery(uuid) from public, anon;
grant execute on function private.can_read_delivery(uuid) to authenticated;

-- ── 4. Quotes and contracts ───────────────────────────────────────────────

create table if not exists public.quotes (
  id                 uuid        primary key default gen_random_uuid(),
  billing_account_id uuid        not null references public.billing_accounts (id) on delete cascade,
  version            integer     not null default 1 check (version >= 1),
  status             text        not null default 'draft'
                     check (status in ('draft', 'sent', 'accepted', 'expired', 'withdrawn')),
  currency           text        not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  scope              text        not null default '' check (length(scope) <= 4000),
  exclusions         text        not null default '' check (length(exclusions) <= 4000),
  valid_until        date,
  created_by         uuid        references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (billing_account_id, version),
  -- A quote that leaves the building says what it does not include.
  constraint quotes_sent_names_exclusions check (status = 'draft' or length(trim(exclusions)) > 0)
);
create index if not exists quotes_by_creator on public.quotes (created_by);

create table if not exists public.quote_lines (
  id                 uuid    primary key default gen_random_uuid(),
  quote_id           uuid    not null references public.quotes (id) on delete cascade,
  plan_code          text    references public.commercial_plans (code) on delete restrict,
  description        text    not null check (length(trim(description)) between 1 and 400),
  quantity           numeric not null default 1 check (quantity > 0),
  unit_amount_cents  integer not null check (unit_amount_cents >= 0),
  line_total_cents   bigint  generated always as (round(quantity * unit_amount_cents)::bigint) stored
);
create index if not exists quote_lines_by_quote on public.quote_lines (quote_id);
create index if not exists quote_lines_by_plan on public.quote_lines (plan_code);

create table if not exists public.contracts (
  id                   uuid        primary key default gen_random_uuid(),
  billing_account_id   uuid        not null references public.billing_accounts (id) on delete cascade,
  quote_id             uuid        references public.quotes (id) on delete set null,
  kind                 text        not null check (kind in ('msa', 'order_form', 'dpa', 'sla', 'amendment')),
  version              integer     not null default 1 check (version >= 1),
  status               text        not null default 'draft'
                       check (status in ('draft', 'legal_review', 'out_for_signature', 'signed', 'superseded', 'terminated')),
  signed_at            timestamptz,
  effective_at         timestamptz,
  ends_at              timestamptz,
  renewal_notice_days  integer     check (renewal_notice_days is null or renewal_notice_days between 0 and 365),
  auto_renews          boolean     not null default false,
  -- Where the approved document lives (the trust room artifact or the
  -- e-signature provider's envelope id). Metadata only; never the file.
  document_ref         text        check (document_ref is null or length(document_ref) <= 300),
  owner_id             uuid        references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint contracts_signed_has_dates check (status not in ('signed', 'superseded', 'terminated')
                                               or (signed_at is not null and effective_at is not null)),
  constraint contracts_window check (ends_at is null or effective_at is null or ends_at > effective_at)
);
create index if not exists contracts_by_account on public.contracts (billing_account_id);
create index if not exists contracts_by_quote on public.contracts (quote_id);
create index if not exists contracts_by_owner on public.contracts (owner_id);

-- ── 5. Subscriptions and entitlements ─────────────────────────────────────

create table if not exists public.subscriptions (
  id                    uuid        primary key default gen_random_uuid(),
  billing_account_id    uuid        not null references public.billing_accounts (id) on delete cascade,
  plan_code             text        not null references public.commercial_plans (code) on delete restrict,
  price_id              uuid        references public.commercial_prices (id) on delete restrict,
  contract_id           uuid        references public.contracts (id) on delete set null,
  status                text        not null
                        check (status in ('trialing', 'active', 'past_due', 'grace', 'canceled', 'ended')),
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz not null,
  cancel_at_period_end  boolean     not null default false,
  canceled_at           timestamptz,
  -- Explicit consent before a recurring charge: when, and to which wording.
  consent_at            timestamptz,
  consent_text_version  text        check (consent_text_version is null or length(consent_text_version) <= 40),
  provider_ref          text        check (provider_ref is null or length(provider_ref) <= 120),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint subscriptions_period check (current_period_end > current_period_start),
  constraint subscriptions_paid_needs_consent_or_contract check (
    plan_code = 'free' or contract_id is not null or (consent_at is not null and consent_text_version is not null)
  )
);
create index if not exists subscriptions_by_account on public.subscriptions (billing_account_id);
create index if not exists subscriptions_by_plan on public.subscriptions (plan_code);
create index if not exists subscriptions_by_price on public.subscriptions (price_id);
create index if not exists subscriptions_by_contract on public.subscriptions (contract_id);

-- What a subscription currently entitles. Written by the service when a
-- subscription starts, changes or ends; read by the app to show paid
-- features. Never read by an RLS policy on student data.
create table if not exists public.subscription_entitlements (
  subscription_id  uuid        not null references public.subscriptions (id) on delete cascade,
  entitlement_key  text        not null references public.entitlement_definitions (key) on delete restrict,
  value            jsonb       not null,
  source           text        not null default 'plan' check (source in ('plan', 'contract', 'grant')),
  granted_at       timestamptz not null default now(),
  primary key (subscription_id, entitlement_key)
);
create index if not exists subscription_entitlements_by_key on public.subscription_entitlements (entitlement_key);

-- ── 6. Invoices, payments, credits ────────────────────────────────────────

create sequence if not exists public.invoice_number_seq;
revoke all on sequence public.invoice_number_seq from public, anon, authenticated;
grant usage on sequence public.invoice_number_seq to service_role;

create table if not exists public.invoices (
  id                 uuid        primary key default gen_random_uuid(),
  number             text        not null unique
                     default ('SEM-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  billing_account_id uuid        not null references public.billing_accounts (id) on delete cascade,
  subscription_id    uuid        references public.subscriptions (id) on delete set null,
  contract_id        uuid        references public.contracts (id) on delete set null,
  status             text        not null default 'draft'
                     check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  currency           text        not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  subtotal_cents     bigint      not null default 0 check (subtotal_cents >= 0),
  tax_cents          bigint      not null default 0 check (tax_cents >= 0),
  total_cents        bigint      generated always as (subtotal_cents + tax_cents) stored,
  po_reference       text        check (po_reference is null or length(po_reference) <= 80),
  issued_at          timestamptz,
  due_at             timestamptz,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  constraint invoices_paid_has_date check (status <> 'paid' or paid_at is not null),
  constraint invoices_open_has_dates check (status not in ('open', 'paid') or (issued_at is not null and due_at is not null))
);
create index if not exists invoices_by_account on public.invoices (billing_account_id);
create index if not exists invoices_by_subscription on public.invoices (subscription_id);
create index if not exists invoices_by_contract on public.invoices (contract_id);

create table if not exists public.invoice_lines (
  id                 uuid    primary key default gen_random_uuid(),
  invoice_id         uuid    not null references public.invoices (id) on delete cascade,
  description        text    not null check (length(trim(description)) between 1 and 400),
  quantity           numeric not null default 1 check (quantity > 0),
  unit_amount_cents  integer not null check (unit_amount_cents >= 0),
  line_total_cents   bigint  generated always as (round(quantity * unit_amount_cents)::bigint) stored
);
create index if not exists invoice_lines_by_invoice on public.invoice_lines (invoice_id);

-- A payment provider's webhook, recorded once. `provider_event_id` is the
-- idempotency key: the verified webhook inserts, and a replay is a no-op.
-- The raw payload is not kept; its hash is, for reconciliation.
create table if not exists public.payment_events (
  id                 uuid        primary key default gen_random_uuid(),
  provider           text        not null check (provider ~ '^[a-z][a-z0-9_]{1,29}$'),
  provider_event_id  text        not null check (length(provider_event_id) between 1 and 200),
  kind               text        not null check (kind in ('payment_succeeded', 'payment_failed', 'refund', 'chargeback', 'other')),
  invoice_id         uuid        references public.invoices (id) on delete set null,
  amount_cents       bigint      check (amount_cents is null or amount_cents >= 0),
  payload_sha256     text        not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  received_at        timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index if not exists payment_events_by_invoice on public.payment_events (invoice_id);

create table if not exists public.credits_refunds (
  id                 uuid        primary key default gen_random_uuid(),
  billing_account_id uuid        not null references public.billing_accounts (id) on delete cascade,
  invoice_id         uuid        references public.invoices (id) on delete set null,
  kind               text        not null check (kind in ('credit', 'refund', 'service_credit')),
  amount_cents       bigint      not null check (amount_cents > 0),
  reason             text        not null check (length(trim(reason)) between 1 and 1000),
  status             text        not null default 'pending' check (status in ('pending', 'issued', 'declined')),
  created_at         timestamptz not null default now()
);
create index if not exists credits_refunds_by_account on public.credits_refunds (billing_account_id);
create index if not exists credits_refunds_by_invoice on public.credits_refunds (invoice_id);

-- ── 7. Dunning and cancellation ───────────────────────────────────────────
--
-- Payment fails → notice → retry → grace → final notice with the exact date
-- → paid features restricted. A restriction never touches data, export or
-- deletion: those are free on every plan.

create table if not exists public.dunning_cases (
  id               uuid        primary key default gen_random_uuid(),
  subscription_id  uuid        not null references public.subscriptions (id) on delete cascade,
  invoice_id       uuid        references public.invoices (id) on delete set null,
  status           text        not null default 'open' check (status in ('open', 'recovered', 'restricted', 'canceled')),
  opened_at        timestamptz not null default now(),
  grace_ends_at    timestamptz not null,
  closed_at        timestamptz,
  constraint dunning_grace_after_open check (grace_ends_at > opened_at),
  constraint dunning_closed_has_date check (status = 'open' or closed_at is not null)
);
create unique index if not exists dunning_one_open_per_subscription
  on public.dunning_cases (subscription_id) where status = 'open';
create index if not exists dunning_cases_by_subscription on public.dunning_cases (subscription_id);
create index if not exists dunning_cases_by_invoice on public.dunning_cases (invoice_id);

create table if not exists public.dunning_actions (
  id         uuid        primary key default gen_random_uuid(),
  case_id    uuid        not null references public.dunning_cases (id) on delete cascade,
  action     text        not null check (action in ('notice', 'retry', 'reminder', 'final_notice', 'restrict', 'recover', 'cancel')),
  detail     text        not null default '' check (length(detail) <= 1000),
  at         timestamptz not null default now()
);
create index if not exists dunning_actions_by_case on public.dunning_actions (case_id, at);

create table if not exists public.cancellation_requests (
  id               uuid        primary key default gen_random_uuid(),
  subscription_id  uuid        not null references public.subscriptions (id) on delete cascade,
  requested_by     uuid        references auth.users (id) on delete set null,
  requested_at     timestamptz not null default now(),
  effective_at     timestamptz not null,
  -- Optional, always: asking why must never stand between a person and
  -- cancelling.
  reason_code      text        check (reason_code is null or reason_code in (
                     'too_expensive', 'not_using', 'missing_feature', 'school_provides', 'graduating', 'other')),
  status           text        not null default 'scheduled' check (status in ('scheduled', 'completed', 'reverted')),
  channel          text        not null default 'self_serve' check (channel in ('self_serve', 'support', 'dunning'))
);
create index if not exists cancellation_requests_by_subscription on public.cancellation_requests (subscription_id);
create index if not exists cancellation_requests_by_requester on public.cancellation_requests (requested_by);

-- ── 8. Delivery: implementation, success, renewals, account health ────────

create table if not exists public.implementation_projects (
  id                 uuid        primary key default gen_random_uuid(),
  billing_account_id uuid        not null references public.billing_accounts (id) on delete cascade,
  tenant_id          text        references public.schools (id) on delete set null,
  contract_id        uuid        references public.contracts (id) on delete set null,
  -- The nine stages the company site publishes.
  stage              text        not null default 'discover' check (stage in (
                       'discover', 'configure', 'integrate', 'validate', 'train', 'launch', 'hypercare', 'measure', 'expand')),
  status             text        not null default 'on_track' check (status in ('on_track', 'at_risk', 'blocked', 'done')),
  kickoff_at         timestamptz,
  go_live_at         timestamptz,
  owner_id           uuid        references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists implementation_projects_by_account on public.implementation_projects (billing_account_id);
create index if not exists implementation_projects_by_tenant on public.implementation_projects (tenant_id);
create index if not exists implementation_projects_by_contract on public.implementation_projects (contract_id);
create index if not exists implementation_projects_by_owner on public.implementation_projects (owner_id);

create table if not exists public.implementation_milestones (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.implementation_projects (id) on delete cascade,
  name        text        not null check (length(trim(name)) between 1 and 200),
  owner_role  text        not null default '' check (length(owner_role) <= 80),
  due_at      date,
  done_at     timestamptz
);
create index if not exists implementation_milestones_by_project on public.implementation_milestones (project_id);

create table if not exists public.success_plans (
  id                 uuid        primary key default gen_random_uuid(),
  billing_account_id uuid        not null unique references public.billing_accounts (id) on delete cascade,
  goals              text        not null default '' check (length(goals) <= 4000),
  risks              text        not null default '' check (length(risks) <= 4000),
  next_qbr_at        date,
  owner_id           uuid        references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now()
);
create index if not exists success_plans_by_owner on public.success_plans (owner_id);

create table if not exists public.qbrs (
  id               uuid        primary key default gen_random_uuid(),
  success_plan_id  uuid        not null references public.success_plans (id) on delete cascade,
  held_on          date        not null,
  summary          text        not null check (length(trim(summary)) between 1 and 4000)
);
create index if not exists qbrs_by_plan on public.qbrs (success_plan_id, held_on desc);

create table if not exists public.renewal_opportunities (
  id            uuid        primary key default gen_random_uuid(),
  contract_id   uuid        not null references public.contracts (id) on delete cascade,
  renewal_date  date        not null,
  -- 120/90/60/30 days out, then decided.
  stage         text        not null default 'review_120' check (stage in (
                  'review_120', 'exec_90', 'proposal_60', 'signature_30', 'decided')),
  outcome       text        not null default 'pending' check (outcome in (
                  'pending', 'renewed', 'expanded', 'downgraded', 'churned')),
  decision_on   date,
  owner_id      uuid        references auth.users (id) on delete set null,
  constraint renewals_decided_has_outcome check ((stage = 'decided') = (outcome <> 'pending'))
);
create index if not exists renewal_opportunities_by_contract on public.renewal_opportunities (contract_id);
create index if not exists renewal_opportunities_by_owner on public.renewal_opportunities (owner_id);

-- Account health, from account-level signals only. The site promises
-- institutions that no student's behaviour, grade, note or protected trait
-- feeds a vendor's view of them; the allowed keys below are that promise in
-- code, and a snapshot must say why and what a person will do about it.
create or replace function private.health_signals_ok(signals jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(signals) = 'object'
     and not exists (
       select 1 from jsonb_object_keys(signals) k
       where k not in ('implementation_pct', 'sso_healthy', 'integration_freshness_hours', 'open_tickets',
                       'p1_incidents_90d', 'training_completion_pct', 'admin_logins_30d', 'features_enabled',
                       'days_to_renewal', 'documents_expiring', 'invoice_overdue_days', 'activation_pct',
                       'qbr_done')
     );
$$;

create table if not exists public.account_health_snapshots (
  id                 uuid        primary key default gen_random_uuid(),
  billing_account_id uuid        not null references public.billing_accounts (id) on delete cascade,
  status             text        not null check (status in (
                       'healthy', 'needs_attention', 'at_risk_commercial', 'implementation_blocked',
                       'compliance_action', 'renewal_planning', 'expansion')),
  reason             text        not null check (length(trim(reason)) between 10 and 1000),
  next_action        text        not null check (length(trim(next_action)) between 5 and 400),
  action_owner       uuid        references auth.users (id) on delete set null,
  signals            jsonb       not null default '{}'::jsonb check (private.health_signals_ok(signals)),
  taken_at           timestamptz not null default now()
);
create index if not exists account_health_by_account on public.account_health_snapshots (billing_account_id, taken_at desc);
create index if not exists account_health_by_owner on public.account_health_snapshots (action_owner);

-- ── 9. Governance registers ───────────────────────────────────────────────

create table if not exists public.compliance_frameworks (
  code     text primary key check (code ~ '^[a-z][a-z0-9_]{1,29}$'),
  name     text not null,
  version  text not null default ''
);

create table if not exists public.compliance_controls (
  id              uuid        primary key default gen_random_uuid(),
  framework_code  text        not null references public.compliance_frameworks (code) on delete cascade,
  ref             text        not null check (length(trim(ref)) between 1 and 40),
  title           text        not null check (length(trim(title)) between 1 and 300),
  owner_role      text        not null default '' check (length(owner_role) <= 80),
  -- Ready means implemented, tested, evidenced and reviewed; anything less
  -- is said as it is.
  status          text        not null default 'missing' check (status in ('implemented', 'partial', 'documented', 'missing')),
  reviewed_at     timestamptz,
  unique (framework_code, ref)
);

create table if not exists public.control_evidence (
  id           uuid        primary key default gen_random_uuid(),
  control_id   uuid        not null references public.compliance_controls (id) on delete cascade,
  title        text        not null check (length(trim(title)) between 1 and 300),
  -- A repo path, CI run or document id: where to look, never the secret.
  location     text        not null check (length(trim(location)) between 1 and 500),
  collected_at timestamptz not null default now(),
  expires_at   timestamptz
);
create index if not exists control_evidence_by_control on public.control_evidence (control_id);

-- The badge and claims register: a public claim needs evidence, an owner, a
-- scope and a review date, or it is not active.
create table if not exists public.claims_register (
  id                uuid        primary key default gen_random_uuid(),
  claim             text        not null unique check (length(trim(claim)) between 1 and 200),
  public_copy       text        not null check (length(trim(public_copy)) between 1 and 1000),
  scope             text        not null check (length(trim(scope)) between 1 and 300),
  control_id        uuid        references public.compliance_controls (id) on delete set null,
  status            text        not null default 'planned' check (status in ('active', 'expired', 'retired', 'planned')),
  review_by         date,
  approved_by       uuid        references auth.users (id) on delete set null,
  constraint claims_active_is_backed check (
    status <> 'active' or (control_id is not null and review_by is not null and approved_by is not null)
  )
);
create index if not exists claims_register_by_control on public.claims_register (control_id);
create index if not exists claims_register_by_approver on public.claims_register (approved_by);

-- The content register: no owner, no review date, no source basis → not
-- published.
create table if not exists public.content_register (
  slug             text        primary key check (slug ~ '^[a-z0-9][a-z0-9/-]{0,119}$'),
  title            text        not null check (length(trim(title)) between 1 and 200),
  audience         text        not null default '' check (length(audience) <= 120),
  owner_id         uuid        references auth.users (id) on delete set null,
  reviewer_id      uuid        references auth.users (id) on delete set null,
  review_state     text        not null default 'draft' check (review_state in ('draft', 'review', 'published', 'superseded', 'archived')),
  source_basis     text        not null default '' check (length(source_basis) <= 1000),
  claim_id         uuid        references public.claims_register (id) on delete set null,
  published_at     timestamptz,
  last_reviewed_at timestamptz,
  next_review_at   date,
  constraint content_published_is_governed check (
    review_state <> 'published'
    or (owner_id is not null and next_review_at is not null and length(trim(source_basis)) > 0 and published_at is not null)
  )
);
create index if not exists content_register_by_owner on public.content_register (owner_id);
create index if not exists content_register_by_reviewer on public.content_register (reviewer_id);
create index if not exists content_register_by_claim on public.content_register (claim_id);

-- Every CTA on the site, where it routes and who answers it.
create table if not exists public.cta_routes (
  key                 text    primary key check (key ~ '^[a-z][a-z0-9_]{1,59}$'),
  audience            text    not null check (audience in ('student', 'department', 'institution', 'enterprise', 'security', 'candidate', 'partner', 'customer')),
  label               text    not null check (length(trim(label)) between 1 and 80),
  destination         text    not null check (destination in ('signup', 'tool', 'crm_lead', 'procurement_queue', 'ats', 'partner_crm', 'customer_portal', 'support')),
  owner_team          text    not null check (length(trim(owner_team)) between 1 and 80),
  response_sla_hours  integer check (response_sla_hours is null or response_sla_hours between 1 and 720),
  active              boolean not null default true
);

insert into public.cta_routes (key, audience, label, destination, owner_team, response_sla_hours) values
  ('start_planning_free',     'student',     'Start planning free',            'signup',            'Growth',        null),
  ('build_my_semester',       'student',     'Build my semester',              'tool',              'Growth',        null),
  ('plan_department_launch',  'department',  'Plan a department launch',       'crm_lead',          'Sales',         48),
  ('plan_institution_launch', 'institution', 'Plan an institutional launch',   'crm_lead',          'Sales',         24),
  ('request_procurement',     'security',    'Request procurement package',    'procurement_queue', 'Security',      48),
  ('request_enterprise',      'enterprise',  'Request enterprise briefing',    'crm_lead',          'Sales',         24),
  ('apply_role',              'candidate',   'Send an introduction',           'ats',               'Founder',       120),
  ('explore_partnership',     'partner',     'Apply to partner',               'partner_crm',       'Partnerships',  72),
  ('customer_help',           'customer',    'Get help',                       'support',           'Support',       24)
on conflict (key) do nothing;

insert into public.compliance_frameworks (code, name, version) values
  ('hecvat',   'Higher Education Community Vendor Assessment Toolkit', 'Full'),
  ('soc2',     'SOC 2 Trust Services Criteria', '2017 (rev. 2022)'),
  ('vpat',     'VPAT / Accessibility Conformance Report', '2.5 WCAG'),
  ('iso27001', 'ISO/IEC 27001', '2022')
on conflict (code) do nothing;

-- ── 10. RLS for everything above that is not the public catalog ───────────
--
-- Stated per table, not left to the `ensure_rls` event trigger
-- (app/src/lib/tablerls.test.ts says why).

alter table public.billing_accounts enable row level security;
alter table public.billing_account_tenants enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.contracts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payment_events enable row level security;
alter table public.credits_refunds enable row level security;
alter table public.dunning_cases enable row level security;
alter table public.dunning_actions enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.implementation_projects enable row level security;
alter table public.implementation_milestones enable row level security;
alter table public.success_plans enable row level security;
alter table public.qbrs enable row level security;
alter table public.renewal_opportunities enable row level security;
alter table public.account_health_snapshots enable row level security;
alter table public.compliance_frameworks enable row level security;
alter table public.compliance_controls enable row level security;
alter table public.control_evidence enable row level security;
alter table public.claims_register enable row level security;
alter table public.content_register enable row level security;
alter table public.cta_routes enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'billing_accounts', 'billing_account_tenants', 'quotes', 'quote_lines', 'contracts',
    'subscriptions', 'subscription_entitlements', 'invoices', 'invoice_lines', 'payment_events',
    'credits_refunds', 'dunning_cases', 'dunning_actions', 'cancellation_requests',
    'implementation_projects', 'implementation_milestones', 'success_plans', 'qbrs',
    'renewal_opportunities', 'account_health_snapshots', 'compliance_frameworks',
    'compliance_controls', 'control_evidence', 'claims_register', 'content_register', 'cta_routes'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- Reads only. Every write is the service role's.
grant select on public.billing_accounts, public.billing_account_tenants, public.quotes, public.quote_lines,
                public.contracts, public.subscriptions, public.subscription_entitlements, public.invoices,
                public.invoice_lines, public.credits_refunds, public.dunning_cases, public.dunning_actions,
                public.cancellation_requests, public.implementation_projects, public.implementation_milestones,
                public.success_plans, public.qbrs, public.renewal_opportunities, public.account_health_snapshots,
                public.compliance_frameworks, public.compliance_controls, public.control_evidence,
                public.claims_register, public.content_register, public.cta_routes
  to authenticated;
-- payment_events: no grant at all. Nobody reads a webhook through the API.

drop policy if exists "billing readers read the account" on public.billing_accounts;
create policy "billing readers read the account" on public.billing_accounts
  for select to authenticated using (private.can_read_billing(id));
drop policy if exists "billing readers read funded tenants" on public.billing_account_tenants;
create policy "billing readers read funded tenants" on public.billing_account_tenants
  for select to authenticated using (private.can_read_billing(billing_account_id));

do $$
declare t text;
begin
  -- Tables that carry billing_account_id and are commercial.
  foreach t in array array['quotes', 'contracts', 'subscriptions', 'invoices', 'credits_refunds'] loop
    execute format('drop policy if exists "billing readers read" on public.%I', t);
    execute format('create policy "billing readers read" on public.%I for select to authenticated
                    using (private.can_read_billing(billing_account_id))', t);
  end loop;
  -- Tables that carry billing_account_id and are delivery.
  foreach t in array array['implementation_projects', 'success_plans'] loop
    execute format('drop policy if exists "delivery readers read" on public.%I', t);
    execute format('create policy "delivery readers read" on public.%I for select to authenticated
                    using (private.can_read_delivery(billing_account_id))', t);
  end loop;
  -- Governance registers: their own staff capability.
  foreach t in array array['compliance_frameworks', 'compliance_controls', 'control_evidence', 'claims_register'] loop
    execute format('drop policy if exists "compliance staff read" on public.%I', t);
    execute format('create policy "compliance staff read" on public.%I for select to authenticated
                    using (private.has_capability(''compliance:manage'', ''platform'', ''''))', t);
  end loop;
  foreach t in array array['content_register', 'cta_routes'] loop
    execute format('drop policy if exists "content staff read" on public.%I', t);
    execute format('create policy "content staff read" on public.%I for select to authenticated
                    using (private.has_capability(''content:manage'', ''platform'', ''''))', t);
  end loop;
end $$;

drop policy if exists "billing readers read" on public.quote_lines;
create policy "billing readers read" on public.quote_lines for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and private.can_read_billing(q.billing_account_id)));
drop policy if exists "billing readers read" on public.invoice_lines;
create policy "billing readers read" on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and private.can_read_billing(i.billing_account_id)));
drop policy if exists "billing readers read" on public.subscription_entitlements;
create policy "billing readers read" on public.subscription_entitlements for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id and private.can_read_billing(s.billing_account_id)));
drop policy if exists "billing readers read" on public.cancellation_requests;
create policy "billing readers read" on public.cancellation_requests for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id and private.can_read_billing(s.billing_account_id)));
drop policy if exists "billing staff read" on public.dunning_cases;
create policy "billing staff read" on public.dunning_cases for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id and private.can_read_billing(s.billing_account_id)));
drop policy if exists "billing staff read" on public.dunning_actions;
create policy "billing staff read" on public.dunning_actions for select to authenticated
  using (exists (select 1 from public.dunning_cases c join public.subscriptions s on s.id = c.subscription_id
                 where c.id = case_id and private.can_read_billing(s.billing_account_id)));
drop policy if exists "delivery readers read" on public.implementation_milestones;
create policy "delivery readers read" on public.implementation_milestones for select to authenticated
  using (exists (select 1 from public.implementation_projects p where p.id = project_id and private.can_read_delivery(p.billing_account_id)));
drop policy if exists "delivery readers read" on public.qbrs;
create policy "delivery readers read" on public.qbrs for select to authenticated
  using (exists (select 1 from public.success_plans p where p.id = success_plan_id and private.can_read_delivery(p.billing_account_id)));
drop policy if exists "delivery readers read" on public.renewal_opportunities;
create policy "delivery readers read" on public.renewal_opportunities for select to authenticated
  using (private.commercial_staff()
         or exists (select 1 from public.contracts c where c.id = contract_id and private.can_read_billing(c.billing_account_id)));
-- Account health is Semester's internal view of a customer: staff only.
drop policy if exists "success staff read" on public.account_health_snapshots;
create policy "success staff read" on public.account_health_snapshots for select to authenticated
  using (private.commercial_staff());

-- ── 11. Behaviour: cancel, entitlements, payments ─────────────────────────

-- Click to cancel. The owner of an individual subscription cancels it at the
-- end of the paid period in one call; the reason is optional. Returns the
-- date Plus ends. Data, export and deletion are unaffected.
create or replace function public.request_cancellation(want_subscription uuid, want_reason text default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscriptions;
begin
  select sub.* into s
  from public.subscriptions sub
  join public.billing_accounts a on a.id = sub.billing_account_id
  where sub.id = want_subscription
    and a.kind = 'individual'
    and a.user_id = (select auth.uid());
  if not found then
    raise exception 'No subscription of yours with that id.' using errcode = '42501';
  end if;
  if s.status in ('canceled', 'ended') or s.cancel_at_period_end then
    return s.current_period_end;
  end if;

  update public.subscriptions
     set cancel_at_period_end = true, canceled_at = now(), updated_at = now()
   where id = s.id;
  insert into public.cancellation_requests (subscription_id, requested_by, effective_at, reason_code)
  values (s.id, (select auth.uid()), s.current_period_end, nullif(want_reason, ''));
  return s.current_period_end;
end $$;
revoke all on function public.request_cancellation(uuid, text) from public, anon;
grant execute on function public.request_cancellation(uuid, text) to authenticated;

-- The signed-in person's current entitlements, for showing paid features.
-- Presentation only: an entitlement is never an authorization.
create or replace function public.my_entitlements()
returns table (entitlement_key text, value jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.entitlement_key, e.value
  from public.billing_accounts a
  join public.subscriptions s on s.billing_account_id = a.id
  join public.subscription_entitlements e on e.subscription_id = s.id
  where a.user_id = (select auth.uid())
    and s.status in ('trialing', 'active', 'past_due', 'grace')
    and s.current_period_end > now();
$$;
revoke all on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- A verified webhook, applied once. Service role only; the Edge Function that
-- calls this has already checked the provider's signature.
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
      select id into open_case from public.dunning_cases
       where subscription_id = inv.subscription_id and status = 'open';
      if open_case is not null then
        update public.dunning_cases set status = 'recovered', closed_at = now() where id = open_case;
        insert into public.dunning_actions (case_id, action, detail) values (open_case, 'recover', 'Payment received.');
      end if;
    end if;
    return 'paid';
  elsif want_kind = 'payment_failed' and inv.subscription_id is not null then
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
revoke all on function public.apply_payment_event(text, text, text, uuid, bigint, text, interval) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, uuid, bigint, text, interval) to service_role;

-- Commercial history is immutable where it has to be: a payment event and a
-- dunning action are records of what happened.
create or replace function private.refuse_commercial_rewrite()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only.', tg_table_name;
end $$;
revoke all on function private.refuse_commercial_rewrite() from public, anon, authenticated;

drop trigger if exists payment_events_append_only on public.payment_events;
create trigger payment_events_append_only before update or delete on public.payment_events
  for each row execute function private.refuse_commercial_rewrite();
drop trigger if exists dunning_actions_append_only on public.dunning_actions;
create trigger dunning_actions_append_only before update or delete on public.dunning_actions
  for each row execute function private.refuse_commercial_rewrite();

comment on table public.subscriptions is
  'A billing account''s time-bound relationship with a plan. Grants entitlements, never authorization. Written by the service role; the owner may cancel via request_cancellation.';
comment on table public.payment_events is
  'Verified payment-provider webhooks, once each (provider_event_id is the idempotency key). No raw payload, no card data. Readable by nobody through the API.';
comment on table public.account_health_snapshots is
  'Semester''s internal view of a customer account, from account-level signals only (private.health_signals_ok). Each snapshot names a reason and a next action.';
comment on function public.request_cancellation(uuid, text) is
  'Click-to-cancel for an individual subscription: ends it at the period end, reason optional, returns that date.';
comment on function public.apply_payment_event(text, text, text, uuid, bigint, text, interval) is
  'Service-only: apply one verified webhook idempotently; marks invoices paid, opens or recovers dunning.';
