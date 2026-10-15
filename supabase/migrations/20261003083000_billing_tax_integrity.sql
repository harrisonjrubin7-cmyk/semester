-- Preserve Stripe's pre-tax subtotal and calculated tax separately. The v1
-- RPC accepted only one amount and therefore could not represent a taxed
-- invoice without putting the final charge into subtotal_cents.
create or replace function public.upsert_provider_invoice_v2(
  want_subscription_ref text,
  want_invoice_ref text,
  want_subtotal_cents bigint,
  want_tax_cents bigint,
  want_currency text,
  want_issued_at timestamptz,
  want_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscriptions;
  found_id uuid;
  found_status text;
begin
  select id, status into found_id, found_status from public.invoices where provider_ref = want_invoice_ref;
  if found_id is not null then
    -- Provider events may arrive out of order. Once the paid snapshot has won,
    -- a late finalization-failure snapshot must not replace its amounts.
    if found_status = 'paid' then
      return found_id;
    end if;
    -- A failed automatic-tax finalization can create the draft first. When
    -- Stripe later succeeds, refresh that same row from the newer invoice
    -- snapshot rather than preserving the draft's incomplete amounts.
    update public.invoices
       set subtotal_cents = greatest(coalesce(want_subtotal_cents, 0), 0),
           tax_cents = greatest(coalesce(want_tax_cents, 0), 0),
           currency = coalesce(lower(want_currency), currency),
           issued_at = coalesce(want_issued_at, issued_at),
           due_at = coalesce(want_due_at, due_at)
     where id = found_id;
    return found_id;
  end if;

  select * into s from public.subscriptions where provider_ref = want_subscription_ref;
  if not found then
    return null;
  end if;

  insert into public.invoices (
    billing_account_id, subscription_id, status, currency,
    subtotal_cents, tax_cents, issued_at, due_at, provider_ref
  )
  values (
    s.billing_account_id, s.id, 'open', coalesce(lower(want_currency), 'usd'),
    greatest(coalesce(want_subtotal_cents, 0), 0),
    greatest(coalesce(want_tax_cents, 0), 0),
    coalesce(want_issued_at, now()),
    coalesce(want_due_at, want_issued_at, now()),
    want_invoice_ref
  )
  on conflict (provider_ref) where provider_ref is not null do nothing
  returning id into found_id;

  if found_id is null then
    select id into found_id from public.invoices where provider_ref = want_invoice_ref;
  end if;
  return found_id;
end $$;

revoke all on function public.upsert_provider_invoice_v2(text, text, bigint, bigint, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.upsert_provider_invoice_v2(text, text, bigint, bigint, text, timestamptz, timestamptz)
  to service_role;

comment on function public.upsert_provider_invoice_v2(text, text, bigint, bigint, text, timestamptz, timestamptz) is
  'Idempotently records a provider invoice with pre-tax subtotal and calculated tax kept in separate columns.';

-- Record an invoice snapshot and apply its payment event in one transaction.
-- The advisory lock also serializes the first two deliveries for an invoice,
-- before either delivery has created a row that could be locked. Without this,
-- a finalization failure and a paid event can interleave between the snapshot
-- upsert and apply_payment_event, leaving paid status paired with stale draft
-- amounts or briefly reopening dunning after payment.
create or replace function public.apply_invoice_payment_event_v2(
  want_provider text,
  want_event_id text,
  want_kind text,
  want_subscription_ref text,
  want_invoice_ref text,
  want_subtotal_cents bigint,
  want_tax_cents bigint,
  want_currency text,
  want_issued_at timestamptz,
  want_due_at timestamptz,
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
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(want_invoice_ref, 0));

  invoice_id := public.upsert_provider_invoice_v2(
    want_subscription_ref,
    want_invoice_ref,
    want_subtotal_cents,
    want_tax_cents,
    want_currency,
    want_issued_at,
    want_due_at
  );
  if invoice_id is null then
    return 'not_ready';
  end if;

  return public.apply_payment_event(
    want_provider,
    want_event_id,
    want_kind,
    invoice_id,
    want_amount_cents,
    want_payload_sha256,
    grace
  );
end $$;

revoke all on function public.apply_invoice_payment_event_v2(
  text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz, bigint, text, interval
) from public, anon, authenticated;
grant execute on function public.apply_invoice_payment_event_v2(
  text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz, bigint, text, interval
) to service_role;

comment on function public.apply_invoice_payment_event_v2(
  text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz, bigint, text, interval
) is 'Atomically serializes an invoice snapshot with its idempotent payment event so paid state and amounts cannot diverge.';
