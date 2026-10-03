-- Stripe can deliver invoice lifecycle events out of order. Keep the newest
-- snapshot within a lifecycle stage, and never let an earlier stage replace a
-- later one: finalization failure (0) < payment failure (1) < paid (2).
alter table public.invoices
  add column if not exists provider_snapshot_rank smallint not null default 0
    check (provider_snapshot_rank between 0 and 2),
  add column if not exists provider_snapshot_at timestamptz;

create or replace function public.apply_invoice_payment_event_v3(
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
  if want_snapshot_at is null or want_snapshot_rank not between 0 and 2 then
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
           provider_snapshot_at = want_snapshot_at
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
             provider_snapshot_at = want_snapshot_at
       where id = invoice_id;
    end if;
  end if;

  return public.apply_payment_event(
    want_provider, want_event_id, want_kind, invoice_id,
    want_amount_cents, want_payload_sha256, grace
  );
end $$;

revoke all on function public.apply_invoice_payment_event_v3(
  text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz,
  timestamptz, smallint, bigint, text, interval
) from public, anon, authenticated;
grant execute on function public.apply_invoice_payment_event_v3(
  text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz,
  timestamptz, smallint, bigint, text, interval
) to service_role;

comment on function public.apply_invoice_payment_event_v3(
  text, text, text, text, text, bigint, bigint, text, timestamptz, timestamptz,
  timestamptz, smallint, bigint, text, interval
) is 'Atomically records an invoice event while preventing stale or earlier-lifecycle snapshots from replacing newer financial amounts.';
