-- A legal hold reaching the last three sweeps that deleted without asking
-- (20261004150000_holds_reach_the_last_three_sweeps.sql): student tombstones,
-- individual subscribers' financial records, and the gateway journal.
--
-- For each one, a held twin and an unheld twin run through the SAME sweep, because
-- a sweep that deletes nothing passes a check that only looks for survivors:
--
--   * a school hold keeps that school's rows and no other school's;
--   * an account hold keeps that account's rows and no other account's, in a
--     school that is not itself held;
--   * a platform hold keeps everything, including a row no account can name;
--   * releasing a hold lets the NEXT sweep remove what it kept;
--   * the periods did not change: a young tombstone is still not removed.
--
-- Also held here, because the cast is the one new way these functions could fail:
-- the gateway's `actor_id` is text, and a non-UUID actor ('staff-7') must be kept or
-- removed by its school alone, never raise.
--
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh hold-blind-sweeps

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'u_' || replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

-- ── Tombstones ────────────────────────────────────────────────────────────

-- One long-deleted note and one long-deleted course for an account.
create or replace function pg_temp.old_tombstones(who uuid)
returns void language plpgsql as $$
begin
  insert into public.notes (user_id, id, data, deleted_at) values (who, 'old-note', '{}', now() - interval '200 days');
  insert into public.courses (user_id, id, data, deleted_at) values (who, 'old-course', '{}', now() - interval '200 days');
end $$;

create or replace function pg_temp.tombstones_of(who uuid)
returns bigint language sql as $$
  select (select count(*) from public.notes where user_id = who)
       + (select count(*) from public.courses where user_id = who);
$$;

-- ── Financial records ─────────────────────────────────────────────────────

-- An ended 2026 subscription with its checkout, and a standalone 2026 invoice with
-- a payment event and a credit: one row in each table the purge deletes from,
-- except billing_accounts, which is the account itself.
create or replace function pg_temp.old_billing(acct uuid)
returns void language plpgsql as $$
declare
  plus_price uuid; sub uuid; inv uuid;
begin
  select id into plus_price from public.commercial_prices where plan_code = 'plus' and billing_interval = 'month';
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_start, current_period_end,
                                    consent_at, consent_text_version, created_at)
  values (acct, 'plus', plus_price, 'ended', '2026-10-01', '2026-11-01', '2026-10-01', 'plus-v1', '2026-10-01')
  returning id into sub;
  insert into public.checkout_sessions (billing_account_id, price_id, plan_code, consent_at, consent_text_version,
                                        status, subscription_id, created_at, completed_at)
  values (acct, plus_price, 'plus', '2026-10-01', 'plus-v1', 'completed', sub, '2026-10-01', '2026-10-01');
  insert into public.invoices (billing_account_id, status, subtotal_cents, issued_at, due_at, paid_at, created_at)
  values (acct, 'paid', 399, '2026-10-01', '2026-10-01', '2026-10-01', '2026-10-01') returning id into inv;
  insert into public.invoice_lines (invoice_id, description, unit_amount_cents) values (inv, 'Semester Plus', 399);
  insert into public.payment_events (provider, provider_event_id, kind, invoice_id, amount_cents, payload_sha256, received_at)
  values ('stripe', 'evt_hb_' || acct::text, 'payment_succeeded', inv, 399, repeat('a', 64), '2026-10-01');
  insert into public.credits_refunds (billing_account_id, invoice_id, kind, amount_cents, reason, created_at)
  values (acct, inv, 'refund', 100, 'Partial refund for the hold check', '2026-10-15');
end $$;

-- Rows in the five tables an account's records live in (not the account itself).
create or replace function pg_temp.billing_rows(acct uuid)
returns bigint language sql as $$
  select (select count(*) from public.subscriptions where billing_account_id = acct)
       + (select count(*) from public.checkout_sessions where billing_account_id = acct)
       + (select count(*) from public.invoices where billing_account_id = acct)
       + (select count(*) from public.payment_events e join public.invoices i on i.id = e.invoice_id where i.billing_account_id = acct)
       + (select count(*) from public.credits_refunds where billing_account_id = acct);
$$;

create or replace function pg_temp.purged(as_of timestamptz)
returns bigint language sql as $$
  select coalesce(sum(removed), 0) from public.purge_financial_records(as_of);
$$;

-- ── Gateway journal ───────────────────────────────────────────────────────

-- One old row in each of the four journal tables, for a tenant and an actor.
create or replace function pg_temp.old_journal(school text, actor text)
returns void language plpgsql as $$
begin
  insert into private.gateway_audit (at, tenant_id, actor_id, area, event)
  values (now() - interval '400 days', school, actor, 'university', 'action.started');
  insert into private.gateway_intelligence_audit (at, tenant_id, actor_id, category, provider, model, input_tokens,
                                                  output_tokens, cost_cents, policy_decision)
  values (now() - interval '400 days', school, actor, 'respond', 'openai', 'm', 1, 1, 0, 'production:tutor:explain');
  insert into private.gateway_review (id, tenant_id, actor_id, expires_at, state, operation_sha256, sealed_body)
  values (gen_random_uuid(), school, actor, now() - interval '200 days', 'completed', repeat('b', 64), repeat('x', 60));
  insert into private.gateway_intelligence_action (id, tenant_id, actor_id, expires_at, state, sealed_body)
  values (gen_random_uuid(), school, actor, now() - interval '3 days', 'ready', repeat('x', 60));
end $$;

create or replace function pg_temp.journal_rows(school text, actor text)
returns bigint language sql as $$
  select (select count(*) from private.gateway_audit where tenant_id = school and actor_id = actor)
       + (select count(*) from private.gateway_intelligence_audit where tenant_id = school and actor_id = actor)
       + (select count(*) from private.gateway_review where tenant_id = school and actor_id = actor)
       + (select count(*) from private.gateway_intelligence_action where tenant_id = school and actor_id = actor);
$$;

do $$
declare
  a1 uuid; b1 uuid; b2 uuid; b3 uuid;
  school_hold uuid; account_hold uuid; platform_hold uuid;
  acct_b2 uuid; acct_b3 uuid; acct_orphan uuid;
  n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('hb-a', 'Held School', array['hb-a.example']),
    ('hb-b', 'Free School', array['hb-b.example']);
  a1 := pg_temp.newuser('a1@hb-a.example', 'hb-a');   -- in the held school
  b1 := pg_temp.newuser('b1@hb-b.example', 'hb-b');   -- nobody holds
  b2 := pg_temp.newuser('b2@hb-b.example', 'hb-b');   -- account-held, school free
  b3 := pg_temp.newuser('b3@hb-b.example', 'hb-b');   -- nobody holds (the account hold must not reach it)
  perform set_config('request.jwt.claims', '', true);

  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('tenant', 'hb-a', 'hb-a', 'The school is under preservation.', 'MATTER-900', b1) returning id into school_hold;
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('account', b2::text, 'hb-b', 'One account is under preservation.', 'MATTER-901', b1) returning id into account_hold;

  -- ══ 1. Student tombstones ═════════════════════════════════════════════
  perform pg_temp.old_tombstones(a1); perform pg_temp.old_tombstones(b1);
  perform pg_temp.old_tombstones(b2); perform pg_temp.old_tombstones(b3);
  -- A tombstone from last week is not old enough for anyone: the period did not change.
  insert into public.notes (user_id, id, data, deleted_at) values (b1, 'young-note', '{}', now() - interval '7 days');

  n := public.sweep_tombstones('90 days');
  perform pg_temp.counted('the sweep removed exactly the two unheld accounts'' old tombstones (2 each)', n, 4);
  perform pg_temp.counted('a held school keeps its student''s tombstones', pg_temp.tombstones_of(a1), 2);
  perform pg_temp.counted('a held account keeps its tombstones', pg_temp.tombstones_of(b2), 2);
  perform pg_temp.counted('an unheld account in the same free school loses its old tombstones', pg_temp.tombstones_of(b3), 0);
  perform pg_temp.counted('an unheld account in another school loses its old tombstones (the control)',
    (select count(*) from public.notes where user_id = b1 and id = 'old-note') + (select count(*) from public.courses where user_id = b1), 0);
  perform pg_temp.counted('a young tombstone is still not removed, held or not',
    (select count(*) from public.notes where user_id = b1 and id = 'young-note'), 1);

  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id in (school_hold, account_hold);
  n := public.sweep_tombstones('90 days');
  perform pg_temp.counted('after both holds are released the next sweep removes what they kept', n, 4);
  perform pg_temp.counted('...the held school''s student', pg_temp.tombstones_of(a1), 0);
  perform pg_temp.counted('...and the held account', pg_temp.tombstones_of(b2), 0);

  -- A platform hold keeps everyone's.
  perform pg_temp.old_tombstones(b1); perform pg_temp.old_tombstones(b3);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('platform', '', null, 'Preserve everything.', 'MATTER-902', b1) returning id into platform_hold;
  n := public.sweep_tombstones('90 days');
  perform pg_temp.counted('a platform hold stops the tombstone sweep', n, 0);
  perform pg_temp.counted('...and every account''s tombstones are still there (2 + 2, and b1''s young one)', pg_temp.tombstones_of(b1) + pg_temp.tombstones_of(b3), 5);
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = platform_hold;
  perform pg_temp.counted('releasing it lets the next sweep run', public.sweep_tombstones('90 days'), 4);

  -- Re-place the two holds for the sections below.
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('tenant', 'hb-a', 'hb-a', 'The school is under preservation.', 'MATTER-903', b1) returning id into school_hold;
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('account', b2::text, 'hb-b', 'One account is under preservation.', 'MATTER-904', b1) returning id into account_hold;

  -- ══ 2. Individual subscribers' financial records ═════════════════════
  insert into public.billing_accounts (kind, user_id, name, created_at) values ('individual', b2, 'Held subscriber', '2026-03-01') returning id into acct_b2;
  insert into public.billing_accounts (kind, user_id, name, created_at) values ('individual', b3, 'Free subscriber', '2026-03-01') returning id into acct_b3;
  insert into public.billing_accounts (kind, name, created_at) values ('individual', 'Owner erased', '2026-03-01') returning id into acct_orphan;
  perform pg_temp.old_billing(acct_b2); perform pg_temp.old_billing(acct_b3);
  perform pg_temp.counted('the fixture put five kinds of record on each subscriber', pg_temp.billing_rows(acct_b2), 5);

  n := pg_temp.purged('2034-01-01');
  perform pg_temp.counted('a held subscriber keeps every record', pg_temp.billing_rows(acct_b2), 5);
  perform pg_temp.counted('an unheld subscriber in the same school loses them all (the control)', pg_temp.billing_rows(acct_b3), 0);
  perform pg_temp.counted('the purge removed exactly the unheld subscriber''s five records and the ownerless account', n, 6);
  perform pg_temp.counted('a billing account with no owner left goes with a free platform',
    (select count(*) from public.billing_accounts where id = acct_orphan), 0);
  perform pg_temp.counted('the held subscriber''s account itself is still there',
    (select count(*) from public.billing_accounts where id = acct_b2), 1);

  -- A platform hold keeps what no account can name.
  insert into public.billing_accounts (kind, name, created_at) values ('individual', 'Owner erased, held', '2026-03-01') returning id into acct_orphan;
  perform pg_temp.old_billing(acct_b3);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('platform', '', null, 'Preserve everything.', 'MATTER-905', b1) returning id into platform_hold;
  n := pg_temp.purged('2034-01-01');
  perform pg_temp.counted('a platform hold stops the financial purge', n, 0);
  perform pg_temp.counted('...an unheld subscriber''s records stay', pg_temp.billing_rows(acct_b3), 5);
  perform pg_temp.counted('...and so does an account no account hold could name',
    (select count(*) from public.billing_accounts where id = acct_orphan), 1);
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = platform_hold;
  n := pg_temp.purged('2034-01-01');
  perform pg_temp.counted('releasing it lets the next purge remove the unheld records and the ownerless account', n, 6);

  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = account_hold;
  n := pg_temp.purged('2034-01-01');
  perform pg_temp.counted('releasing the account hold lets the next purge remove its records', n, 5);
  perform pg_temp.counted('...all of them', pg_temp.billing_rows(acct_b2), 0);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('account', b2::text, 'hb-b', 'One account is under preservation.', 'MATTER-906', b1) returning id into account_hold;

  -- ══ 3. The gateway journal ═══════════════════════════════════════════
  -- Four combinations: a held school; a held account in a free school; a free account;
  -- and a non-UUID actor in a free school (the cast must not run, and must not raise).
  perform pg_temp.old_journal('hb-a', 'staff-7');
  perform pg_temp.old_journal('hb-b', b2::text);
  perform pg_temp.old_journal('hb-b', b3::text);
  perform pg_temp.old_journal('hb-b', 'staff-7');
  -- One day of replay protection, even for a held school: not a record.
  insert into private.gateway_rate_limit (tenant_id, actor_id, window_start, count, updated_at)
    values ('hb-a', 'staff-7', now() - interval '3 days', 1, now() - interval '3 days');

  n := private.gateway_purge_journal();
  perform pg_temp.counted('the journal purge removed the two unheld combinations (4 rows each) and the rate-limit row', n, 9);
  perform pg_temp.counted('a held school keeps its journal rows, even for an actor that is not a UUID', pg_temp.journal_rows('hb-a', 'staff-7'), 4);
  perform pg_temp.counted('a held account keeps its journal rows in a free school', pg_temp.journal_rows('hb-b', b2::text), 4);
  perform pg_temp.counted('an unheld account loses its journal rows (the control)', pg_temp.journal_rows('hb-b', b3::text), 0);
  perform pg_temp.counted('a non-UUID actor in a free school loses its rows, without an error', pg_temp.journal_rows('hb-b', 'staff-7'), 0);
  perform pg_temp.counted('the rate-limit window is removed even under a school hold: it is replay protection, not a record',
    (select count(*) from private.gateway_rate_limit where tenant_id = 'hb-a'), 0);

  perform pg_temp.old_journal('hb-b', b3::text);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('platform', '', null, 'Preserve everything.', 'MATTER-907', b1) returning id into platform_hold;
  n := private.gateway_purge_journal();
  perform pg_temp.counted('a platform hold stops the journal purge', n, 0);
  perform pg_temp.counted('...an unheld account''s rows stay', pg_temp.journal_rows('hb-b', b3::text), 4);
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = platform_hold;
  perform pg_temp.counted('releasing it lets the next purge remove them', private.gateway_purge_journal(), 4);

  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id in (school_hold, account_hold);
  perform pg_temp.counted('with the school and account holds released, the purge removes what they kept (4 + 4)', private.gateway_purge_journal(), 8);

  raise notice 'all checks passed';
end $$;

rollback;
