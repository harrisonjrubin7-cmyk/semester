-- The commercial core: catalog, billing accounts, subscriptions, invoices,
-- dunning, cancellation, delivery records and the governance registers.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * anyone reads the active catalog, nothing inactive, and nobody writes it;
--   * a student reads their own billing records and nobody else's, and cannot
--     write a subscription, an invoice or a price;
--   * cancelling is one call by the owner, reason optional, and nobody else
--     can cancel it;
--   * a payment webhook applies once; a failure opens exactly one dunning
--     case and a later payment recovers it;
--   * an institution's billing contact reads invoices and not implementation;
--     its administrator reads implementation and not invoices; another
--     school reads neither;
--   * payment events are unreadable through the API and append-only;
--   * account health refuses student-level signals and needs a reason and an
--     action; unbacked claims and ungoverned content cannot be published.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

do $$
declare
  ana uuid; ben uuid; north_billing uuid; north_admin uuid; south_admin uuid; finance uuid;
  ana_acct uuid; ben_acct uuid; north_acct uuid; gtm uuid;
  plus_price uuid; ana_sub uuid; ben_sub uuid; inv uuid; north_inv uuid;
  n bigint; t text; ends timestamptz;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-com', 'North Commercial University', array['north-com.example']),
    ('south-com', 'South Commercial College', array['south-com.example']);
  ana := pg_temp.newuser('ana@north-com.example', 'north-com');
  ben := pg_temp.newuser('ben@north-com.example', 'north-com');
  north_billing := pg_temp.newuser('ap@north-com.example', 'north-com');
  north_admin := pg_temp.newuser('admin@north-com.example', 'north-com');
  south_admin := pg_temp.newuser('admin@south-com.example', 'south-com');
  finance := pg_temp.newuser('finance@semester.example', 'north-com');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (north_billing, 'billing_contact',  'school', 'north-com', 'institution'),
    (north_admin,   'university_admin', 'school', 'north-com', 'institution'),
    (south_admin,   'university_admin', 'school', 'south-com', 'institution'),
    (finance,       'finance_operator', 'platform', '', 'institution');

  -- ── Catalog ─────────────────────────────────────────────────────────────
  perform pg_temp.anon();
  select count(*) into n from public.commercial_prices where plan_code = 'plus';
  reset role;
  perform pg_temp.counted('a visitor reads both Plus prices', n, 2);

  update public.commercial_plans set active = false where code = 'pro';
  perform pg_temp.anon();
  select count(*) into n from public.commercial_plans where code = 'pro';
  reset role;
  perform pg_temp.counted('an inactive plan is not visible', n, 0);

  perform pg_temp.become(ana);
  if not pg_temp.refused($q$update public.commercial_prices set amount_cents = 1 where plan_code = 'plus'$q$) then
    raise exception 'FAILED: a student changed a price';
  end if;
  reset role;
  raise notice 'ok  nobody writes the catalog through the API';

  -- ── The service records two students' subscriptions ─────────────────────
  select id into plus_price from public.commercial_prices where plan_code = 'plus' and billing_interval = 'month';
  set local role service_role;
  insert into public.billing_accounts (kind, user_id, name) values ('individual', ana, 'Ana') returning id into ana_acct;
  insert into public.billing_accounts (kind, user_id, name) values ('individual', ben, 'Ben') returning id into ben_acct;
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_end, consent_at, consent_text_version)
  values (ana_acct, 'plus', plus_price, 'active', now() + interval '20 days', now(), 'plus-v1') returning id into ana_sub;
  insert into public.subscriptions (billing_account_id, plan_code, price_id, status, current_period_end, consent_at, consent_text_version)
  values (ben_acct, 'plus', plus_price, 'active', now() + interval '20 days', now(), 'plus-v1') returning id into ben_sub;
  insert into public.subscription_entitlements (subscription_id, entitlement_key, value)
  select ana_sub, entitlement_key, value from public.plan_entitlements where plan_code = 'plus';
  insert into public.invoices (billing_account_id, subscription_id, status, subtotal_cents, issued_at, due_at)
  values (ana_acct, ana_sub, 'open', 799, now(), now() + interval '7 days') returning id into inv;
  reset role;

  set local role service_role;
  if not pg_temp.refused(format($q$insert into public.subscriptions (billing_account_id, plan_code, status, current_period_end)
                                  values (%L, 'plus', 'active', now() + interval '1 month')$q$, ben_acct)) then
    raise exception 'FAILED: a paid subscription without consent or contract was accepted';
  end if;
  reset role;
  raise notice 'ok  a paid subscription needs recorded consent or a contract';

  -- ── Students read only their own ────────────────────────────────────────
  perform pg_temp.become(ana);
  select count(*) into n from public.subscriptions;
  reset role;
  perform pg_temp.counted('a student reads only their own subscription', n, 1);

  perform pg_temp.become(ben);
  select count(*) into n from public.invoices where id = inv;
  reset role;
  perform pg_temp.counted('another student reads none of her invoices', n, 0);

  perform pg_temp.become(ana);
  select count(*) into n from public.my_entitlements();
  if not pg_temp.refused(format($q$update public.subscriptions set current_period_end = now() + interval '10 years' where id = %L$q$, ana_sub)) then
    raise exception 'FAILED: a student extended their own subscription';
  end if;
  if not pg_temp.refused(format($q$update public.invoices set status = 'paid', paid_at = now() where id = %L$q$, inv)) then
    raise exception 'FAILED: a student marked their own invoice paid';
  end if;
  reset role;
  perform pg_temp.counted('a student sees their four Plus entitlements', n, 4);
  raise notice 'ok  a student cannot extend a subscription or pay an invoice by hand';

  -- ── Click to cancel ─────────────────────────────────────────────────────
  perform pg_temp.become(ben);
  if not pg_temp.refused(format($q$select public.request_cancellation(%L)$q$, ana_sub)) then
    raise exception 'FAILED: one student cancelled another''s subscription';
  end if;
  reset role;
  raise notice 'ok  nobody else can cancel a subscription';

  perform pg_temp.become(ana);
  select public.request_cancellation(ana_sub) into ends;
  reset role;
  perform pg_temp.answered('cancelling returns the end of the paid period',
    (ends = (select current_period_end from public.subscriptions where id = ana_sub))::text, 'true');
  select count(*) into n from public.cancellation_requests where subscription_id = ana_sub and reason_code is null;
  perform pg_temp.counted('one call, no reason required', n, 1);
  perform pg_temp.become(ana);
  perform public.request_cancellation(ana_sub, 'graduating');
  reset role;
  select count(*) into n from public.cancellation_requests where subscription_id = ana_sub;
  perform pg_temp.counted('cancelling twice does not create a second request', n, 1);

  -- ── Payments and dunning ────────────────────────────────────────────────
  set local role service_role;
  select public.apply_payment_event('stripe', 'evt_fail_1', 'payment_failed', inv, 799, repeat('a', 64)) into t;
  perform pg_temp.answered('a failed payment opens dunning', t, 'dunning');
  select public.apply_payment_event('stripe', 'evt_fail_1', 'payment_failed', inv, 799, repeat('a', 64)) into t;
  perform pg_temp.answered('the same webhook again is a no-op', t, 'duplicate');
  select public.apply_payment_event('stripe', 'evt_fail_2', 'payment_failed', inv, 799, repeat('b', 64)) into t;
  select count(*) into n from public.dunning_cases where subscription_id = ana_sub;
  perform pg_temp.counted('a second failure keeps one dunning case', n, 1);
  select count(*) into n from public.dunning_actions a join public.dunning_cases c on c.id = a.case_id where c.subscription_id = ana_sub;
  perform pg_temp.counted('and records two actions on it', n, 2);
  select public.apply_payment_event('stripe', 'evt_ok_1', 'payment_succeeded', inv, 799, repeat('c', 64)) into t;
  perform pg_temp.answered('a payment marks the invoice paid', (select status from public.invoices where id = inv), 'paid');
  perform pg_temp.answered('and recovers the dunning case',
    (select status from public.dunning_cases where subscription_id = ana_sub), 'recovered');
  perform pg_temp.answered('and the subscription is active again',
    (select status from public.subscriptions where id = ana_sub), 'active');
  if not pg_temp.refused($q$delete from public.payment_events$q$) then
    raise exception 'FAILED: a payment event was deleted';
  end if;
  reset role;
  raise notice 'ok  payment events are append-only';

  perform pg_temp.become(ana);
  if not pg_temp.refused($q$select count(*) from public.payment_events$q$) then
    raise exception 'FAILED: a signed-in user read payment events';
  end if;
  if not pg_temp.refused(format($q$select public.apply_payment_event('stripe', 'evt_x', 'payment_succeeded', %L, 1, %L)$q$, inv, repeat('d', 64))) then
    raise exception 'FAILED: a signed-in user applied a payment event';
  end if;
  reset role;
  raise notice 'ok  payment events are unreadable and unwritable through the API';

  -- ── Institutions: least privilege both ways ─────────────────────────────
  set local role service_role;
  insert into public.gtm_accounts (name, segment, tenant_id, status) values ('North Commercial University', 'research', 'north-com', 'customer')
  returning id into gtm;
  insert into public.billing_accounts (kind, gtm_account_id, name) values ('institution', gtm, 'North Commercial University')
  returning id into north_acct;
  insert into public.billing_account_tenants (billing_account_id, tenant_id) values (north_acct, 'north-com');
  insert into public.invoices (billing_account_id, status, subtotal_cents, po_reference, issued_at, due_at)
  values (north_acct, 'open', 400000, 'PO-55-2091', now(), now() + interval '30 days') returning id into north_inv;
  insert into public.implementation_projects (billing_account_id, tenant_id, stage) values (north_acct, 'north-com', 'launch');
  reset role;

  perform pg_temp.become(north_billing);
  select count(*) into n from public.invoices where id = north_inv;
  perform pg_temp.counted('the billing contact reads the school''s invoice', n, 1);
  select count(*) into n from public.implementation_projects;
  reset role;
  perform pg_temp.counted('but not its implementation project', n, 0);

  perform pg_temp.become(north_admin);
  select count(*) into n from public.implementation_projects;
  perform pg_temp.counted('the school administrator reads implementation', n, 1);
  select count(*) into n from public.invoices where id = north_inv;
  reset role;
  perform pg_temp.counted('but not invoices', n, 0);

  perform pg_temp.become(south_admin);
  select count(*) into n from public.implementation_projects;
  reset role;
  perform pg_temp.counted('another school reads no implementation', n, 0);

  perform pg_temp.become(finance);
  select count(*) into n from public.invoices;
  reset role;
  perform pg_temp.counted('Semester finance reads every invoice', n, 2);

  -- ── Governance ──────────────────────────────────────────────────────────
  set local role service_role;
  if not pg_temp.refused(format($q$insert into public.account_health_snapshots (billing_account_id, status, reason, next_action, signals)
                                  values (%L, 'needs_attention', 'Adoption dipped after launch week.', 'Book a check-in',
                                          '{"student_gpa_avg": 3.1}')$q$, north_acct)) then
    raise exception 'FAILED: account health accepted a student-level signal';
  end if;
  if not pg_temp.refused(format($q$insert into public.account_health_snapshots (billing_account_id, status, reason, next_action)
                                  values (%L, 'at_risk_commercial', '', '')$q$, north_acct)) then
    raise exception 'FAILED: account health accepted a status with no reason or action';
  end if;
  insert into public.account_health_snapshots (billing_account_id, status, reason, next_action, signals)
  values (north_acct, 'needs_attention', 'Catalog feed stale for 26 hours.', 'Ask IT to re-authorize the feed',
          '{"integration_freshness_hours": 26, "open_tickets": 1}');
  if not pg_temp.refused($q$insert into public.claims_register (claim, public_copy, scope, status)
                            values ('SOC 2 Type II', 'SOC 2 Type II report available', 'Platform', 'active')$q$) then
    raise exception 'FAILED: an unbacked claim went active';
  end if;
  if not pg_temp.refused($q$insert into public.content_register (slug, title, review_state, published_at)
                            values ('trust/security', 'Security', 'published', now())$q$) then
    raise exception 'FAILED: content with no owner, review date or source was published';
  end if;
  reset role;
  raise notice 'ok  health refuses student signals and unexplained statuses; claims and content need backing';

  perform pg_temp.become(north_admin);
  select count(*) into n from public.account_health_snapshots;
  reset role;
  perform pg_temp.counted('a customer never reads Semester''s health view of them', n, 0);

  raise notice 'commercial core: every check passed';
end $$;

rollback;
