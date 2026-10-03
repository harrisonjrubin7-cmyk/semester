-- Stripe can deliver invoice lifecycle events out of order. Keep the newest
-- snapshot within a lifecycle stage, and never let an earlier stage replace a
-- later one: finalization failure (0) < payment failure (1) < paid (2).
alter table public.invoices
  add column if not exists provider_snapshot_rank smallint not null default 0
    check (provider_snapshot_rank between 0 and 2),
  add column if not exists provider_snapshot_at timestamptz;

alter table public.subscriptions
  add column if not exists billing_issue text
    check (billing_issue is null or billing_issue = 'address_required'),
  add column if not exists billing_issue_invoice_id uuid
    references public.invoices (id) on delete set null;

create index if not exists subscriptions_by_billing_issue_invoice
  on public.subscriptions (billing_issue_invoice_id);

alter table public.payment_events drop constraint if exists payment_events_kind_check;
alter table public.payment_events add constraint payment_events_kind_check
  check (kind in ('payment_succeeded', 'payment_failed', 'address_required', 'refund', 'chargeback', 'other'));

-- Existing invoices can already contain a payment-stage event. Seed their
-- precedence before the v3 webhook is enabled so a delayed finalization
-- failure cannot overwrite the newer, finalized subtotal and tax snapshot.
-- `received_at` is the only historical event time retained by Semester; rank
-- remains authoritative across stages, while the timestamp orders peers.
with prior as (
  select
    invoice_id,
    max(received_at) as latest_received_at,
    case
      when bool_or(kind = 'payment_succeeded') then 2
      when bool_or(kind = 'payment_failed') then 1
      else 0
    end::smallint as snapshot_rank
  from public.payment_events
  where invoice_id is not null
  group by invoice_id
)
update public.invoices i
   set provider_snapshot_rank = greatest(i.provider_snapshot_rank, prior.snapshot_rank),
       provider_snapshot_at = case
         when i.provider_snapshot_at is null then prior.latest_received_at
         else greatest(i.provider_snapshot_at, prior.latest_received_at)
       end
  from prior
 where i.id = prior.invoice_id;

-- Missing tax location is customer action, not a declined payment. Preserve a
-- distinct issue for the Account screen without opening dunning or removing
-- entitlements. Only the affected invoice can clear that issue; an unrelated
-- success or failure must not hide it. Real payment failures still use dunning.
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

  if want_kind = 'address_required' and inv.subscription_id is not null and inv.status <> 'paid' then
    update public.subscriptions
       set billing_issue = 'address_required', billing_issue_invoice_id = inv.id, updated_at = now()
     where id = inv.subscription_id and status in ('trialing', 'active', 'past_due', 'grace');
    return 'address_required';
  elsif want_kind = 'payment_succeeded' then
    update public.invoices set status = 'paid', paid_at = now() where id = inv.id;
    if inv.subscription_id is not null then
      update public.subscriptions
         set status = case when status in ('past_due', 'grace') then 'active' else status end,
             billing_issue = case when billing_issue_invoice_id = inv.id then null else billing_issue end,
             billing_issue_invoice_id = case when billing_issue_invoice_id = inv.id then null else billing_issue_invoice_id end,
             updated_at = now()
       where id = inv.subscription_id;
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
    update public.subscriptions
       set status = case when status in ('active', 'trialing', 'grace') then 'past_due' else status end,
           billing_issue = case when billing_issue_invoice_id = inv.id then null else billing_issue end,
           billing_issue_invoice_id = case when billing_issue_invoice_id = inv.id then null else billing_issue_invoice_id end,
           updated_at = now()
     where id = inv.subscription_id and status in ('active', 'trialing', 'past_due', 'grace');
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

revoke all on function public.apply_payment_event(text, text, text, uuid, bigint, text, interval)
  from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, uuid, bigint, text, interval)
  to service_role;

create or replace function public.apply_invoice_payment_event_v3(
  want_provider text,
  want_event_id text,
  want_kind text,
  want_subscription_ref text,
  want_invoice_ref text,
  want_invoice_status text,
  want_subtotal_cents bigint,
  want_tax_cents bigint,
  want_currency text,
  want_issued_at timestamptz,
  want_due_at timestamptz,
  want_snapshot_at timestamptz,
  want_snapshot_rank smallint,
  want_amount_cents bigint,
  want_payload_sha256 text,
  grace interval default interval '14 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_id uuid;
  invoice_status text;
  snapshot_rank smallint;
  snapshot_at timestamptz;
  replace_snapshot boolean;
begin
  if want_snapshot_at is null or want_snapshot_rank not between 0 and 2 or
      want_invoice_status not in ('draft', 'open', 'paid') then
    raise exception 'invalid provider invoice snapshot precedence';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(want_invoice_ref, 0));

  select id, status, provider_snapshot_rank, provider_snapshot_at
    into invoice_id, invoice_status, snapshot_rank, snapshot_at
    from public.invoices
   where provider_ref = want_invoice_ref;

  if invoice_id is null then
    invoice_id := public.upsert_provider_invoice_v2(
      want_subscription_ref, want_invoice_ref, want_subtotal_cents,
      want_tax_cents, want_currency, want_issued_at, want_due_at
    );
    if invoice_id is null then
      return 'not_ready';
    end if;
    update public.invoices
       set provider_snapshot_rank = want_snapshot_rank,
           provider_snapshot_at = want_snapshot_at,
           status = case when want_invoice_status = 'paid' then status else want_invoice_status end
     where id = invoice_id;
  else
    replace_snapshot := invoice_status <> 'paid' and (
      want_snapshot_rank > snapshot_rank or
      (want_snapshot_rank = snapshot_rank and
       want_snapshot_at >= coalesce(snapshot_at, '-infinity'::timestamptz))
    );
    if replace_snapshot then
      perform public.upsert_provider_invoice_v2(
        want_subscription_ref, want_invoice_ref, want_subtotal_cents,
        want_tax_cents, want_currency, want_issued_at, want_due_at
      );
      update public.invoices
         set provider_snapshot_rank = want_snapshot_rank,
             provider_snapshot_at = want_snapshot_at,
             status = case when want_invoice_status = 'paid' then status else want_invoice_status end
       where id = invoice_id;
    end if;
  end if;

  return public.apply_payment_event(
    want_provider, want_event_id, want_kind, invoice_id,
    want_amount_cents, want_payload_sha256, grace
  );
end $$;

revoke all on function public.apply_invoice_payment_event_v3(
  text, text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz,
  timestamptz, smallint, bigint, text, interval
) from public, anon, authenticated;
grant execute on function public.apply_invoice_payment_event_v3(
  text, text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz,
  timestamptz, smallint, bigint, text, interval
) to service_role;

comment on function public.apply_invoice_payment_event_v3(
  text, text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz,
  timestamptz, smallint, bigint, text, interval
) is 'Atomically records an invoice event while preventing stale or earlier-lifecycle snapshots from replacing newer financial amounts.';
