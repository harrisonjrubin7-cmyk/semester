-- Financial records kept seven years after the end of their year, then
-- removed (20260929130000_financial_retention, D-132).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * neither a visitor nor a signed-in account can run the purge;
--   * on 31 December 2033 nothing made in 2026 is removed; on 1 January 2034
--     an individual's finished 2026 subscription goes, with its checkout,
--     invoice, lines, payment event, credit, cancellation request and
--     entitlements;
--   * a subscription that ended in 2027 stays, a live subscription from 2026
--     stays however old, and an institution's 2026 invoice stays;
--   * an individual billing account goes only once its owner has deleted
--     their account and nothing of it is left; one whose owner is still here
--     stays;
--   * a payment event received after the cutoff (a late refund on an old
--     invoice) keeps its invoice until it ages out too, and never aborts the
--     run — an event is never updated, and its invoice's removal would;
--   * a payment event with no invoice cannot be placed (it may be an
--     institution's) and stays, however old;
--   * running it twice at one moment removes nothing the second time.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

do $$
declare
  plus_price uuid;
  gone uuid := pg_temp.newuser('gone-retention@example.edu');
  here uuid := pg_temp.newuser('here-retention@example.edu');
  gone_acct uuid; here_acct uuid; inst_acct uuid;
  old_sub uuid; recent_sub uuid; live_sub uuid;
  old_inv uuid; inst_inv uuid;
  late_sub uuid; late_inv uuid;
  n bigint;
  total bigint;
begin
  -- ── Who may run it ─────────────────────────────────────────────────────
  perform pg_temp.counted('a signed-in account cannot run the purge',
    (has_function_privilege('authenticated', 'public.purge_financial_records(timestamptz)', 'execute'))::int, 0);
  perform pg_temp.counted('nor can a visitor',
    (has_function_privilege('anon', 'public.purge_financial_records(timestamptz)', 'execute'))::int, 0);
  perform pg_temp.counted('the service role can',
    (has_function_privilege('service_role', 'public.purge_financial_records(timestamptz)', 'execute'))::int, 1);

  select id into plus_price from public.commercial_prices where plan_code = 'plus' and billing_interval = 'month';

  -- ── The records ─────────────────────────────────────────────────────────
  insert into public.billing_accounts (kind, user_id, name, created_at)
  values ('individual', gone, 'Individual subscriber', '2026-03-01') returning id into gone_acct;
  insert into public.billing_accounts (kind, user_id, name, created_at)
  values ('individual', here, 'Individual subscriber', '2026-03-01') returning id into here_acct;
  insert into public.billing_accounts (kind, name, created_at)
  values ('institution', 'Retention Test University', '2026-03-01') returning id into inst_acct;

  -- Finished in 2026: eligible on 1 January 2034.
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_start, current_period_end,
                                    consent_at, consent_text_version, created_at)
  values (gone_acct, 'plus', plus_price, 'ended', '2026-10-01', '2026-11-01', '2026-10-01', 'plus-v1', '2026-10-01')
  returning id into old_sub;
  insert into public.subscription_entitlements (subscription_id, entitlement_key, value)
  select old_sub, entitlement_key, value from public.plan_entitlements where plan_code = 'plus';
  insert into public.cancellation_requests (subscription_id, requested_by, effective_at)
  values (old_sub, gone, '2026-11-01');
  insert into public.checkout_sessions (billing_account_id, price_id, plan_code, consent_at, consent_text_version,
                                        status, subscription_id, created_at, completed_at)
  values (gone_acct, plus_price, 'plus', '2026-10-01', 'plus-v1', 'completed', old_sub, '2026-10-01', '2026-10-01');
  insert into public.invoices (billing_account_id, subscription_id, status, subtotal_cents, issued_at, due_at, paid_at, created_at)
  values (gone_acct, old_sub, 'paid', 399, '2026-10-01', '2026-10-01', '2026-10-01', '2026-10-01') returning id into old_inv;
  insert into public.invoice_lines (invoice_id, description, unit_amount_cents) values (old_inv, 'Semester Plus', 399);
  insert into public.payment_events (provider, provider_event_id, kind, invoice_id, amount_cents, payload_sha256, received_at)
  values ('stripe', 'evt_retention_old', 'payment_succeeded', old_inv, 399, repeat('a', 64), '2026-10-01');
  insert into public.credits_refunds (billing_account_id, invoice_id, kind, amount_cents, reason, created_at)
  values (gone_acct, old_inv, 'refund', 100, 'Partial refund for the retention check', '2026-10-15');

  -- Finished in 2026 too, but refunded in February 2027: the event is late.
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_start, current_period_end,
                                    consent_at, consent_text_version, created_at)
  values (here_acct, 'plus', plus_price, 'canceled', '2026-06-01', '2026-07-01', '2026-06-01', 'plus-v1', '2026-06-01')
  returning id into late_sub;
  insert into public.invoices (billing_account_id, subscription_id, status, subtotal_cents, issued_at, due_at, paid_at, created_at)
  values (here_acct, late_sub, 'paid', 399, '2026-06-01', '2026-06-01', '2026-06-01', '2026-06-01') returning id into late_inv;
  insert into public.payment_events (provider, provider_event_id, kind, invoice_id, amount_cents, payload_sha256, received_at)
  values ('stripe', 'evt_retention_paid', 'payment_succeeded', late_inv, 399, repeat('b', 64), '2026-06-01'),
         ('stripe', 'evt_retention_late', 'refund', late_inv, 399, repeat('c', 64), '2027-02-10');

  -- An event with no invoice: a subscription update, say. Nobody can tell
  -- whose, so it is never age-purged.
  insert into public.payment_events (provider, provider_event_id, kind, amount_cents, payload_sha256, received_at)
  values ('stripe', 'evt_retention_unplaced', 'other', null, repeat('d', 64), '2026-04-01');

  -- Ended in 2027: kept through 2034.
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_start, current_period_end,
                                    consent_at, consent_text_version, created_at)
  values (here_acct, 'plus', plus_price, 'ended', '2026-12-15', '2027-01-15', '2026-12-15', 'plus-v1', '2026-12-15')
  returning id into recent_sub;

  -- Live since 2026: never age-purged.
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_start, current_period_end,
                                    consent_at, consent_text_version, created_at)
  values (here_acct, 'plus', plus_price, 'active', '2033-12-01', '2034-01-01 12:00', '2026-03-01', 'plus-v1', '2026-03-01')
  returning id into live_sub;

  -- An institution's 2026 invoice: its contract governs it, not this job.
  insert into public.invoices (billing_account_id, status, subtotal_cents, issued_at, due_at, paid_at, created_at)
  values (inst_acct, 'paid', 1500000, '2026-05-01', '2026-06-01', '2026-05-20', '2026-05-01') returning id into inst_inv;

  -- The owner of the first account deletes theirs.
  delete from auth.users where id = gone;
  perform pg_temp.counted('a deleted owner leaves the billing account unlinked',
    (select count(*) from public.billing_accounts where id = gone_acct and user_id is null), 1);

  -- ── The last day of the seventh year ───────────────────────────────────
  set local role service_role;
  select coalesce(sum(removed), 0) into total from public.purge_financial_records('2033-12-31 23:59:59+00');
  reset role;
  perform pg_temp.counted('on 31 December 2033 nothing made in 2026 is removed', total, 0);

  -- ── The first day after it ─────────────────────────────────────────────
  set local role service_role;
  select coalesce(sum(removed), 0) into total from public.purge_financial_records('2034-01-01 00:00:00+00');
  reset role;
  perform pg_temp.counted('the finished 2026 subscription is gone', (select count(*) from public.subscriptions where id = old_sub), 0);
  perform pg_temp.counted('with its entitlements', (select count(*) from public.subscription_entitlements where subscription_id = old_sub), 0);
  perform pg_temp.counted('and its cancellation request', (select count(*) from public.cancellation_requests where subscription_id = old_sub), 0);
  perform pg_temp.counted('its checkout', (select count(*) from public.checkout_sessions where billing_account_id = gone_acct), 0);
  perform pg_temp.counted('its invoice', (select count(*) from public.invoices where id = old_inv), 0);
  perform pg_temp.counted('and the invoice lines', (select count(*) from public.invoice_lines where invoice_id = old_inv), 0);
  perform pg_temp.counted('its payment event', (select count(*) from public.payment_events where provider_event_id = 'evt_retention_old'), 0);
  perform pg_temp.counted('its refund', (select count(*) from public.credits_refunds where billing_account_id = gone_acct), 0);
  perform pg_temp.counted('and the emptied account of a deleted owner', (select count(*) from public.billing_accounts where id = gone_acct), 0);

  perform pg_temp.counted('an invoice with a 2027 event stays', (select count(*) from public.invoices where id = late_inv), 1);
  perform pg_temp.counted('and so does that late event', (select count(*) from public.payment_events where provider_event_id = 'evt_retention_late'), 1);
  perform pg_temp.counted('while its 2026 event goes', (select count(*) from public.payment_events where provider_event_id = 'evt_retention_paid'), 0);
  perform pg_temp.counted('an event with no invoice stays', (select count(*) from public.payment_events where provider_event_id = 'evt_retention_unplaced'), 1);
  perform pg_temp.counted('a subscription that ended in 2027 stays', (select count(*) from public.subscriptions where id = recent_sub), 1);
  perform pg_temp.counted('a live subscription stays however old', (select count(*) from public.subscriptions where id = live_sub), 1);
  perform pg_temp.counted('an account whose owner is here stays', (select count(*) from public.billing_accounts where id = here_acct), 1);
  perform pg_temp.counted('an institution''s 2026 invoice stays', (select count(*) from public.invoices where id = inst_inv), 1);

  -- ── Twice at one moment ─────────────────────────────────────────────────
  set local role service_role;
  select coalesce(sum(removed), 0) into n from public.purge_financial_records('2034-01-01 00:00:00+00');
  reset role;
  perform pg_temp.counted('run again, it removes nothing', n, 0);

  -- ── A year later, the late event and its invoice go together ───────────
  set local role service_role;
  perform public.purge_financial_records('2035-01-01 00:00:00+00');
  reset role;
  perform pg_temp.counted('in 2035 the invoice with the 2027 event goes', (select count(*) from public.invoices where id = late_inv), 0);
  perform pg_temp.counted('with its late event', (select count(*) from public.payment_events where provider_event_id = 'evt_retention_late'), 0);

  raise notice 'financial retention: every check passed';
end $$;

rollback;
