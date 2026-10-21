-- The commercial core's moving parts (20260929080000_commercial_automation):
-- checkout, the webhook's writes, the dunning worker, contract → tenant, site
-- lead intake and the nightly account-health job.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * none of it is callable by a visitor or a signed-in account, and site
--     leads are readable by neither;
--   * the four new CTA routes exist, and the audience vocabulary took `anyone`;
--   * a lead is routed by `cta_routes`, rate-limited per IP hash (another
--     hash unaffected), refused for an unknown or inactive route, and an
--     institutional route needs an organization, reaches the GTM pipeline
--     once per account and person, and procurement queues a trust request;
--   * checkout records consent before a subscription exists, beginning it
--     again returns the same open checkout (one per person and price, the
--     table refuses a second), and completing it twice makes one
--     subscription carrying that consent;
--   * the dunning worker reminds, gives one final notice with the date, then
--     restricts paid entitlements and nothing else; running it twice at one
--     moment writes nothing the second time; a payment gives them back and
--     closes the restricted case as recovered; a failure reported for an
--     invoice already paid is recorded and changes nothing;
--   * signing an order form writes the tenant's plan, one implementation
--     project and one renewal at ends_at − 120 days, and signing it again
--     writes nothing; an MSA triggers nothing; a pilot needs an end date;
--   * a later order form cannot lower a current plan's tier or shorten its
--     end date (the signing is refused and the plan is untouched), a
--     legitimate upgrade goes through, and replaying an older order form
--     over that upgrade changes nothing;
--   * account health is written once a day per institution, from allowed
--     signals, and anything not healthy waits for a person.

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
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null'); end if;
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

-- Refused, and for the stated reason: `refused` alone would also pass on a typo.
create or replace function pg_temp.refused_for(statement text, reason text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlerrm like '%' || reason || '%';
end $$;

do $$
declare
  ana uuid; ben uuid;
  ip1 text := repeat('1', 64); ip2 text := repeat('2', 64);
  lead record; o text; n bigint; t text; j jsonb;
  plus_price uuid; quote_price uuid; co record; ana_sub uuid; again uuid; inv uuid; inv2 uuid;
  gtm uuid; acct uuid; q uuid; k uuid; msa uuid; pilot uuid; ends timestamptz;
  lower_k uuid; short_k uuid; up_k uuid; before_plan text;
  base timestamptz := now();
begin
  insert into public.schools (id, name, email_domains) values
    ('north-auto', 'North Automation University', array['north-auto.example']);
  ana := pg_temp.newuser('ana@north-auto.example', 'north-auto');
  ben := pg_temp.newuser('ben@north-auto.example', 'north-auto');

  -- ── Closed to the API ───────────────────────────────────────────────────
  perform pg_temp.become(ana);
  if not pg_temp.refused($q$select * from public.submit_site_lead('general_contact', 'A', 'a@b.co', '', '', 'champion', '', '{}', '', repeat('1', 64))$q$)
     or not pg_temp.refused($q$select public.run_dunning()$q$)
     or not pg_temp.refused($q$select public.compute_account_health()$q$)
     or not pg_temp.refused($q$select * from public.begin_checkout(gen_random_uuid(), gen_random_uuid(), 'plus-v1')$q$)
     or not pg_temp.refused($q$select public.complete_checkout(gen_random_uuid(), 'sub_x', 'cus_x', null)$q$)
     or not pg_temp.refused($q$select public.upsert_provider_invoice('sub_x', 'in_x', 1, 'usd', now(), now())$q$)
     or not pg_temp.refused($q$select public.upsert_provider_invoice_v2('sub_x', 'in_x', 1, 0, 'usd', now(), now())$q$)
     or not pg_temp.refused($q$select public.apply_invoice_payment_event_v2('stripe', 'evt_x', 'other', 'sub_x', 'in_x', 1, 0, 'usd', now(), now(), 1, repeat('a', 64))$q$)
     or not pg_temp.refused($q$select public.apply_invoice_payment_event_v3('stripe', 'evt_x', 'other', 'sub_x', 'in_x', 'draft', 1, 0, 'usd', now(), now(), now(), 0::smallint, 1, repeat('a', 64))$q$)
     or not pg_temp.refused($q$select public.sync_provider_subscription('sub_x', 'active', null, null, false, now())$q$) then
    raise exception 'FAILED: a signed-in account called a service-only commercial function';
  end if;
  if not pg_temp.refused($q$select count(*) from public.site_leads$q$)
     or not pg_temp.refused($q$select count(*) from private.site_lead_hits$q$) then
    raise exception 'FAILED: a signed-in account read site leads or their rate-limit hits';
  end if;
  reset role;
  perform pg_temp.anon();
  if not pg_temp.refused($q$select * from public.submit_site_lead('general_contact', 'A', 'a@b.co', '', '', 'champion', '', '{}', '', repeat('1', 64))$q$)
     or not pg_temp.refused($q$select count(*) from public.site_leads$q$) then
    raise exception 'FAILED: a visitor reached site leads directly';
  end if;
  reset role;
  raise notice 'ok  nothing here is callable or readable through the API';

  -- ── The routes ──────────────────────────────────────────────────────────
  select count(*) into n from public.cta_routes where
    (key, audience, label, destination, owner_team, response_sla_hours) in (
      ('request_invite', 'student', 'Request an invite', 'invite_queue', 'Growth', 72),
      ('accessibility_barrier', 'customer', 'Report an accessibility barrier', 'support', 'Accessibility', 48),
      ('site_feedback', 'anyone', 'Send feedback', 'support', 'Product', 120),
      ('general_contact', 'anyone', 'Contact Semester', 'support', 'Founder', 48));
  perform pg_temp.counted('the four new CTA routes, exactly as the site expects', n, 4);
  if not pg_temp.refused($q$insert into public.cta_routes (key, audience, label, destination, owner_team)
                            values ('bogus_route', 'everyone', 'X', 'support', 'X')$q$) then
    raise exception 'FAILED: the audience vocabulary accepted an unknown value';
  end if;
  raise notice 'ok  and the audience vocabulary is still closed';

  -- ── Site leads ──────────────────────────────────────────────────────────
  set local role service_role;
  select * into lead from public.submit_site_lead('general_contact', 'Dana Visitor', 'dana@example.org', '', '', 'champion',
                                                  'Hello there.', '{"topic": "press"}', '/contact', ip1);
  perform pg_temp.answered('a contact form is accepted', lead.outcome, 'ok');
  perform pg_temp.answered('with a reference in the published shape', (lead.reference ~ '^SL-[0-9A-F]{10}$')::text, 'true');
  perform pg_temp.answered('routed where cta_routes says', lead.destination, 'support');
  perform pg_temp.answered('and due within its SLA',
    (lead.respond_by = now() + interval '48 hours')::text, 'true');
  select count(*) into n from public.site_leads where reference = lead.reference and gtm_account_id is null;
  perform pg_temp.counted('kept, and a non-institutional lead touches no pipeline', n, 1);

  select outcome into o from public.submit_site_lead('no_such_route', 'X', 'x@example.org', '', '', 'champion', '', '{}', '', ip2);
  perform pg_temp.answered('an unknown route is refused', o, 'unknown_route');
  update public.cta_routes set active = false where key = 'site_feedback';
  select outcome into o from public.submit_site_lead('site_feedback', 'X', 'x@example.org', '', '', 'champion', '', '{}', '', ip2);
  perform pg_temp.answered('so is an inactive one', o, 'unknown_route');
  update public.cta_routes set active = true where key = 'site_feedback';

  select outcome into o from public.submit_site_lead('plan_institution_launch', 'Pat Provost', 'pat@state.example', '  ',
                                                     'Provost', 'executive_sponsor', '', '{}', '', ip2);
  perform pg_temp.answered('an institutional route needs an organization', o, 'organization_required');

  select * into lead from public.submit_site_lead('plan_institution_launch', 'Pat Provost', 'pat@state.example',
                                                  'State University', 'Provost', 'executive_sponsor', 'Fall launch?',
                                                  '{"requested_domain":"state.example","requested_system":"lms","requested_provider":"Campus LMS","requested_product":"semester_institutional","data_mode":"connected","desired_launch_window":"next_term"}',
                                                  '/institutions', ip2);
  perform pg_temp.answered('an institutional lead is accepted', lead.outcome, 'ok');
  select fields into j from public.site_leads where reference = lead.reference;
  perform pg_temp.answered('and keeps the bounded setup request as discovery metadata',
    (j = '{"requested_domain":"state.example","requested_system":"lms","requested_provider":"Campus LMS","requested_product":"semester_institutional","data_mode":"connected","desired_launch_window":"next_term"}'::jsonb)::text,
    'true');
  select count(*) into n from public.gtm_accounts where name = 'State University' and status = 'engaged';
  perform pg_temp.counted('and opens an engaged account in the pipeline', n, 1);
  select count(*) into n from public.gtm_stakeholders s join public.gtm_accounts a on a.id = s.account_id
   where a.name = 'State University' and s.committee_role = 'executive_sponsor';
  perform pg_temp.counted('with the sender as a stakeholder', n, 1);
  select count(*) into n from public.schools where name = 'State University';
  perform pg_temp.counted('the request creates no school or tenant authority', n, 0);
  select count(*) into n from public.tenant_rollout r join public.schools s on s.id = r.tenant_id
   where s.name = 'State University';
  perform pg_temp.counted('and advances no tenant rollout', n, 0);
  select count(*) into n from public.integration_connections c join public.schools s on s.id = c.tenant_id
   where s.name = 'State University';
  perform pg_temp.counted('and creates no provider connection', n, 0);

  select * into lead from public.submit_site_lead('request_procurement', 'pat provost', 'pat@state.example',
                                                  'state university', 'Provost', 'executive_sponsor', 'HECVAT please', '{}', '/trust', repeat('3', 64));
  select count(*) into n from public.gtm_accounts where lower(name) = 'state university';
  perform pg_temp.counted('a second lead from the same school reuses the account', n, 1);
  select count(*) into n from public.gtm_stakeholders s join public.gtm_accounts a on a.id = s.account_id
   where lower(a.name) = 'state university';
  perform pg_temp.counted('and the same person', n, 1);
  select count(*) into n from public.trust_room_requests r join public.site_leads l on l.trust_request_id = r.id
   where l.reference = lead.reference and r.status = 'requested' and r.requester_email = 'pat@state.example';
  perform pg_temp.counted('a procurement request queues one trust-room request', n, 1);

  -- ip1 has one hit; four more reach the limit, the sixth is refused.
  for i in 1..4 loop
    select outcome into o from public.submit_site_lead('general_contact', 'Dana', 'dana@example.org', '', '', 'champion', '', '{}', '', ip1);
  end loop;
  perform pg_temp.answered('the fifth submission in an hour from one network is accepted', o, 'ok');
  select outcome into o from public.submit_site_lead('general_contact', 'Dana', 'dana@example.org', '', '', 'champion', '', '{}', '', ip1);
  perform pg_temp.answered('the sixth is rate-limited', o, 'rate_limited');
  select count(*) into n from public.site_leads where email = 'dana@example.org';
  perform pg_temp.counted('and not kept', n, 5);
  select outcome into o from public.submit_site_lead('general_contact', 'Eli', 'eli@example.org', '', '', 'champion', '', '{}', '', repeat('4', 64));
  perform pg_temp.answered('another network is unaffected', o, 'ok');
  reset role;
  select count(*) into n from private.site_lead_hits where ip_hash !~ '^[0-9a-f]{64}$';
  perform pg_temp.counted('the rate limit keeps hashes, never an address', n, 0);

  -- ── Checkout ────────────────────────────────────────────────────────────
  -- Plus is $7.99 a month or $59 a year (20260929131000_plus_price): one current
  -- row each, and the seed's 399 and 2999 retired, never deleted.
  select string_agg(amount_cents::text || ' ' || billing_interval, ', ' order by billing_interval) into o
    from public.commercial_prices
   where plan_code = 'plus' and active and effective_from <= now() and (effective_to is null or effective_to > now());
  perform pg_temp.answered('the catalog sells Plus at $7.99 a month or $59 a year', o, '799 month, 5900 year');
  select count(*) into n from public.commercial_prices where plan_code = 'plus' and amount_cents in (399, 2999) and not active;
  perform pg_temp.counted('the old Plus prices are retired, not deleted', n, 2);
  select id into plus_price from public.commercial_prices where plan_code = 'plus' and billing_interval = 'month' and amount_cents = 399;
  set local role service_role;
  select * into co from public.begin_checkout(ana, plus_price, 'plus-v1');
  perform pg_temp.answered('a retired price cannot be checked out', co.outcome, 'no_such_price');
  reset role;
  select id into plus_price from public.commercial_prices where plan_code = 'plus' and billing_interval = 'month' and active;
  select id into quote_price from public.commercial_prices where plan_code = 'department_launch';
  set local role service_role;
  select * into co from public.begin_checkout(ana, quote_price, 'plus-v1');
  perform pg_temp.answered('a price sold by quote cannot be checked out', co.outcome, 'no_such_price');
  select * into co from public.begin_checkout(ana, plus_price, 'plus-v1');
  perform pg_temp.answered('a student begins a Plus checkout', co.outcome, 'ok');
  perform pg_temp.answered('priced from the catalog', co.amount_cents::text || ' ' || co.billing_interval, '799 month');
  select count(*) into n from public.checkout_sessions where id = co.checkout_id and consent_at is not null and consent_text_version = 'plus-v1';
  perform pg_temp.counted('consent is recorded before any subscription exists', n, 1);
  select count(*) into n from public.subscriptions s join public.billing_accounts a on a.id = s.billing_account_id where a.user_id = ana;
  perform pg_temp.counted('and there is none yet', n, 0);
  if not pg_temp.refused(format($q$select * from public.begin_checkout(%L, %L, 'Not A Version!')$q$, ana, plus_price)) then
    raise exception 'FAILED: a malformed consent version was accepted';
  end if;
  again := co.checkout_id;
  select * into co from public.begin_checkout(ana, plus_price, 'plus-v2');
  perform pg_temp.answered('beginning the same checkout again returns the open one', (co.checkout_id = again)::text, 'true');
  perform pg_temp.answered('with the consent re-stamped',
    (select consent_text_version from public.checkout_sessions where id = again), 'plus-v2');
  select count(*) into n from public.checkout_sessions c join public.billing_accounts a on a.id = c.billing_account_id
   where a.user_id = ana and c.status = 'open';
  perform pg_temp.counted('one open checkout per person and price', n, 1);
  if not pg_temp.refused(format($q$insert into public.checkout_sessions (billing_account_id, price_id, plan_code, consent_text_version)
      select billing_account_id, price_id, plan_code, 'plus-v1' from public.checkout_sessions where id = %L$q$, again)) then
    raise exception 'FAILED: a second open checkout for the same person and price was inserted';
  end if;
  select * into co from public.begin_checkout(ana, plus_price, 'plus-v1');
  perform public.attach_checkout_session(co.checkout_id, 'cs_test_0');
  perform public.attach_checkout_session(co.checkout_id, 'cs_test_1');
  perform pg_temp.answered('a checkout begun again names the latest page opened for it',
    (select provider_session_id from public.checkout_sessions where id = co.checkout_id), 'cs_test_1');

  select public.complete_checkout(co.checkout_id, 'sub_test_1', 'cus_test_1', null) into ana_sub;
  select public.complete_checkout(co.checkout_id, 'sub_test_1', 'cus_test_1', null) into again;
  perform pg_temp.answered('completing a checkout twice makes one subscription', (ana_sub = again)::text, 'true');
  select count(*) into n from public.subscriptions s join public.checkout_sessions c on c.subscription_id = s.id
   where s.id = ana_sub and s.status = 'active' and s.consent_at = c.consent_at and s.consent_text_version = 'plus-v1';
  perform pg_temp.counted('active, carrying the consent given at checkout', n, 1);
  select count(*) into n from public.subscription_entitlements where subscription_id = ana_sub;
  perform pg_temp.counted('with the four Plus entitlements', n, 4);
  select * into co from public.begin_checkout(ana, plus_price, 'plus-v1');
  perform pg_temp.answered('a second paid subscription is refused', co.outcome, 'already_subscribed');

  -- ── Provider sync ───────────────────────────────────────────────────────
  select public.sync_provider_subscription('sub_test_1', 'active', null, base + interval '40 days', false, base) into t;
  perform pg_temp.answered('a provider update is applied', t, 'updated');
  select public.sync_provider_subscription('sub_test_1', 'canceled', null, null, true, base - interval '1 hour') into t;
  perform pg_temp.answered('an older event delivered late is not', t, 'stale');
  select public.sync_provider_subscription('sub_nobody', 'active', null, null, false, base) into t;
  perform pg_temp.answered('an unknown subscription is reported, not invented', t, 'unknown');

  select public.upsert_provider_invoice_v2('sub_test_1', 'in_test_1', 799, 65, 'USD', base, base) into inv;
  select public.upsert_provider_invoice_v2('sub_test_1', 'in_test_1', 825, 75, 'USD', base, base) into inv2;
  perform pg_temp.answered('a provider invoice is recorded once', (inv = inv2)::text, 'true');
  perform pg_temp.answered('a recovered provider invoice refreshes subtotal and tax separately',
    (select subtotal_cents || ':' || tax_cents from public.invoices where id = inv), '825:75');
  select public.apply_invoice_payment_event_v3('stripe', 'evt_snapshot_new', 'other', 'sub_test_1', 'in_test_1',
    'open', 900, 90, 'USD', base, base, base + interval '2 minutes', 1::smallint, 990, repeat('7', 64)) into t;
  select public.apply_invoice_payment_event_v3('stripe', 'evt_snapshot_late_old', 'other', 'sub_test_1', 'in_test_1',
    'draft', 1, 0, 'USD', base, base, base + interval '3 minutes', 0::smallint, 1, repeat('8', 64)) into t;
  perform pg_temp.answered('a late finalization snapshot cannot replace a newer payment-stage snapshot',
    (select subtotal_cents || ':' || tax_cents from public.invoices where id = inv), '900:90');
  select public.apply_invoice_payment_event_v3('stripe', 'evt_draft_status', 'other', 'sub_test_1', 'in_status_test',
    'draft', 799, 0, 'USD', base, base, base, 0::smallint, 799, repeat('3', 64)) into t;
  perform pg_temp.answered('a failed-finalization snapshot remains a draft',
    (select status from public.invoices where provider_ref = 'in_status_test'), 'draft');
  select public.apply_invoice_payment_event_v3('stripe', 'evt_open_status', 'other', 'sub_test_1', 'in_status_test',
    'open', 799, 0, 'USD', base, base, base + interval '1 minute', 1::smallint, 799, repeat('4', 64)) into t;
  perform pg_temp.answered('a later provider snapshot advances the draft to open',
    (select status from public.invoices where provider_ref = 'in_status_test'), 'open');
  select public.apply_invoice_payment_event_v3('stripe', 'evt_paid_status', 'payment_succeeded', 'sub_test_1', 'in_paid_status',
    'paid', 799, 65, 'USD', base, base, base + interval '2 minutes', 2::smallint, 864, repeat('5', 64)) into t;
  perform pg_temp.answered('a paid snapshot advances with its paid date atomically',
    (select (status = 'paid' and paid_at is not null)::text from public.invoices where provider_ref = 'in_paid_status'), 'true');
  select public.upsert_provider_invoice_v2('sub_nobody', 'in_test_2', 799, 0, 'usd', base, base) into inv2;
  perform pg_temp.answered('and one for an unknown subscription is not recorded', inv2::text, null);

  -- ── Dunning ─────────────────────────────────────────────────────────────
  select public.upsert_provider_invoice_v2('sub_test_1', 'in_address_needed', 864, 65, 'usd', base, base) into inv2;
  select public.apply_payment_event('stripe', 'evt_auto_fail', 'payment_failed', inv, 864, repeat('e', 64)) into t;
  perform pg_temp.answered('a failed renewal opens dunning', t, 'dunning');
  select public.apply_payment_event('stripe', 'evt_address_needed', 'address_required', inv2, 864, repeat('a', 64)) into t;
  perform pg_temp.answered('a later missing tax location has its own remediation state', t, 'address_required');
  perform pg_temp.answered('and is shown alongside the earlier card failure',
    (select status || ':' || billing_issue from public.subscriptions where id = ana_sub), 'past_due:address_required');
  perform pg_temp.counted('without opening a second dunning case',
    (select count(*) from public.dunning_cases where subscription_id = ana_sub and status = 'open'), 1);
  select public.run_dunning(base + interval '1 day') into j;
  perform pg_temp.answered('a day later, nothing is due', j::text, '{"reminders": 0, "restricted": 0, "final_notices": 0}');
  select public.run_dunning(base + interval '4 days') into j;
  perform pg_temp.answered('three quiet days bring a reminder', (j ->> 'reminders'), '1');
  select public.run_dunning(base + interval '4 days') into j;
  perform pg_temp.answered('and running again at that moment writes nothing', (j ->> 'reminders'), '0');
  select public.run_dunning(base + interval '11 days' + interval '12 hours') into j;
  perform pg_temp.answered('three days from the end, a final notice', (j ->> 'final_notices'), '1');
  select a.detail into t from public.dunning_actions a join public.dunning_cases c on c.id = a.case_id
   where c.subscription_id = ana_sub and a.action = 'final_notice';
  perform pg_temp.answered('naming the exact restriction date',
    (position(to_char((select grace_ends_at from public.dunning_cases where subscription_id = ana_sub) at time zone 'UTC',
                      'YYYY-MM-DD HH24:MI') in t) > 0)::text, 'true');
  select public.run_dunning(base + interval '12 days') into j;
  perform pg_temp.answered('only one final notice', (j ->> 'final_notices'), '0');
  perform pg_temp.answered('paid features still work during grace',
    (select count(*) from public.subscription_entitlements where subscription_id = ana_sub)::text, '4');

  select public.run_dunning(base + interval '15 days') into j;
  perform pg_temp.answered('at grace end the case is restricted', (j ->> 'restricted'), '1');
  select count(*) into n from public.subscription_entitlements where subscription_id = ana_sub;
  perform pg_temp.counted('and the paid entitlements are gone', n, 0);
  select count(*) into n from public.profiles where user_id = ana;
  perform pg_temp.counted('while the student''s own data is untouched', n, 1);
  select count(*) into n from public.dunning_cases where subscription_id = ana_sub and status = 'restricted';
  perform pg_temp.counted('one restricted case', n, 1);
  select public.run_dunning(base + interval '16 days') into j;
  perform pg_temp.answered('and a restricted case is not worked again', j::text, '{"reminders": 0, "restricted": 0, "final_notices": 0}');

  select public.apply_payment_event('stripe', 'evt_auto_ok', 'payment_succeeded', inv, 799, repeat('f', 64)) into t;
  select count(*) into n from public.subscription_entitlements where subscription_id = ana_sub;
  perform pg_temp.counted('a payment afterwards gives the paid features back', n, 4);
  select count(*) into n from public.dunning_cases where subscription_id = ana_sub and status = 'restricted';
  perform pg_temp.counted('and the restricted case is closed', n, 0);
  select count(*) into n from public.dunning_cases c join public.dunning_actions a on a.case_id = c.id
   where c.subscription_id = ana_sub and c.status = 'recovered' and c.closed_at is not null and a.action = 'recover';
  perform pg_temp.counted('as recovered, with the recovery on record', n, 1);
  perform pg_temp.answered('and the subscription is active again',
    (select status from public.subscriptions where id = ana_sub), 'active');
  perform pg_temp.answered('while a different invoice still needs an address',
    (select billing_issue from public.subscriptions where id = ana_sub), 'address_required');
  select public.apply_payment_event('stripe', 'evt_address_ok', 'payment_succeeded', inv2, 864, repeat('6', 64)) into t;
  perform pg_temp.answered('paying the affected invoice clears its address issue',
    (select billing_issue from public.subscriptions where id = ana_sub), null);

  select public.apply_payment_event('stripe', 'evt_auto_late_fail', 'payment_failed', inv, 799, repeat('9', 64)) into t;
  perform pg_temp.answered('a failure reported for an invoice already paid is only recorded', t, 'recorded');
  perform pg_temp.answered('the subscription stays active',
    (select status from public.subscriptions where id = ana_sub), 'active');
  select count(*) into n from public.dunning_cases where subscription_id = ana_sub and status = 'open';
  perform pg_temp.counted('and no dunning case is opened', n, 0);
  perform pg_temp.answered('while the invoice stays paid',
    (select status from public.invoices where id = inv), 'paid');

  select public.sync_provider_subscription('sub_test_1', 'ended', null, null, false, base + interval '20 days') into t;
  select count(*) into n from public.subscription_entitlements where subscription_id = ana_sub;
  perform pg_temp.counted('an ended subscription entitles nothing', n, 0);
  reset role;

  -- ── Contract → tenant ───────────────────────────────────────────────────
  set local role service_role;
  insert into public.gtm_accounts (name, segment, tenant_id, status) values ('North Automation University', 'research', 'north-auto', 'customer')
  returning id into gtm;
  insert into public.billing_accounts (kind, gtm_account_id, name) values ('institution', gtm, 'North Automation University')
  returning id into acct;
  insert into public.billing_account_tenants (billing_account_id, tenant_id) values (acct, 'north-auto');
  insert into public.quotes (billing_account_id, status, exclusions) values (acct, 'accepted', 'No custom integrations.')
  returning id into q;
  insert into public.quote_lines (quote_id, plan_code, description, unit_amount_cents)
  values (q, 'department_launch', 'Department Launch, one year', 1500000);
  ends := date_trunc('day', base) + interval '365 days';
  insert into public.contracts (billing_account_id, quote_id, kind, status, ends_at)
  values (acct, q, 'order_form', 'out_for_signature', ends) returning id into k;
  select count(*) into n from public.tenant_plan where tenant_id = 'north-auto';
  perform pg_temp.counted('an unsigned order form writes no plan', n, 0);

  update public.contracts set status = 'signed', signed_at = base, effective_at = base where id = k;
  perform pg_temp.answered('signing writes the tenant''s plan at the signed tier',
    (select tier || '/' || status from public.tenant_plan where tenant_id = 'north-auto'), 'department/active');
  perform pg_temp.answered('with the contract''s end date', ((select ends_at from public.tenant_plan where tenant_id = 'north-auto') = ends)::text, 'true');
  select count(*) into n from public.implementation_projects where contract_id = k and tenant_id = 'north-auto';
  perform pg_temp.counted('one implementation project for the tenant', n, 1);
  perform pg_temp.answered('and a renewal dated 120 days before the end',
    (select renewal_date::text from public.renewal_opportunities where contract_id = k),
    (((ends at time zone 'UTC') - interval '120 days')::date)::text);

  select count(*) into n from public.tenant_plan_history where tenant_id = 'north-auto';
  update public.contracts set status = 'signed' where id = k;
  reset role;
  perform private.apply_signed_contract(k);
  set local role service_role;
  select count(*) - n into n from public.tenant_plan_history where tenant_id = 'north-auto';
  perform pg_temp.counted('signing again changes no plan', n, 0);
  select count(*) into n from public.implementation_projects where contract_id = k;
  perform pg_temp.counted('makes no second project', n, 1);
  select count(*) into n from public.renewal_opportunities where contract_id = k;
  perform pg_temp.counted('and no second renewal', n, 1);

  insert into public.contracts (billing_account_id, kind, status, signed_at, effective_at)
  values (acct, 'msa', 'signed', base, base) returning id into msa;
  select count(*) into n from public.implementation_projects where contract_id = msa;
  perform pg_temp.counted('a signed MSA is terms, and starts no project', n, 0);

  insert into public.quotes (billing_account_id, version, status, exclusions) values (acct, 2, 'accepted', 'Pilot only.')
  returning id into q;
  insert into public.quote_lines (quote_id, plan_code, description, unit_amount_cents)
  values (q, 'registration_pilot', 'Pilot', 0);
  insert into public.contracts (billing_account_id, quote_id, kind, status) values (acct, q, 'order_form', 'draft')
  returning id into pilot;
  if not pg_temp.refused(format($q$update public.contracts set status = 'signed', signed_at = now(), effective_at = now() where id = %L$q$, pilot)) then
    raise exception 'FAILED: a pilot order form was signed with no end date';
  end if;
  reset role;
  raise notice 'ok  a pilot order form needs an end date before it is signed';

  -- ── A later order form never lowers a current plan ─────────────────────
  -- north-auto is department, ending `ends` (base + 365 days).
  set local role service_role;
  select tier || '/' || ends_at into before_plan from public.tenant_plan where tenant_id = 'north-auto';
  select count(*) into n from public.tenant_plan_history where tenant_id = 'north-auto';

  insert into public.quotes (billing_account_id, version, status, exclusions) values (acct, 3, 'accepted', 'Lower tier, longer.')
  returning id into q;
  insert into public.quote_lines (quote_id, plan_code, description, unit_amount_cents) values (q, 'registration_pilot', 'Pilot', 0);
  insert into public.contracts (billing_account_id, quote_id, kind, status, ends_at)
  values (acct, q, 'order_form', 'draft', base + interval '800 days') returning id into lower_k;
  if not pg_temp.refused_for(format($q$update public.contracts set status = 'signed', signed_at = now(), effective_at = now() where id = %L$q$, lower_k),
                             'would lower') then
    raise exception 'FAILED: a pilot order form lowered a department plan, or was refused for another reason';
  end if;
  perform pg_temp.answered('a lower-tier later order is refused, and the plan is untouched',
    (select tier || '/' || ends_at from public.tenant_plan where tenant_id = 'north-auto'), before_plan);
  perform pg_temp.answered('the refused contract stays unsigned',
    (select status from public.contracts where id = lower_k), 'draft');

  insert into public.quotes (billing_account_id, version, status, exclusions) values (acct, 4, 'accepted', 'Same tier, shorter.')
  returning id into q;
  insert into public.quote_lines (quote_id, plan_code, description, unit_amount_cents) values (q, 'department_launch', 'Department Launch', 1500000);
  insert into public.contracts (billing_account_id, quote_id, kind, status, ends_at)
  values (acct, q, 'order_form', 'draft', base + interval '100 days') returning id into short_k;
  if not pg_temp.refused_for(format($q$update public.contracts set status = 'signed', signed_at = now(), effective_at = now() where id = %L$q$, short_k),
                             'would shorten') then
    raise exception 'FAILED: a shorter order form cut a plan''s end date, or was refused for another reason';
  end if;
  perform pg_temp.answered('a shorter later order is refused, and the plan is untouched',
    (select tier || '/' || ends_at from public.tenant_plan where tenant_id = 'north-auto'), before_plan);
  select count(*) into n from public.tenant_plan_history where tenant_id = 'north-auto' and reason = format('Order form %s signed.', short_k);
  perform pg_temp.counted('and wrote no history row', n, 0);

  insert into public.quotes (billing_account_id, version, status, exclusions) values (acct, 5, 'accepted', 'Upgrade.')
  returning id into q;
  insert into public.quote_lines (quote_id, plan_code, description, unit_amount_cents) values (q, 'semester_access', 'Semester Access', 5000000);
  insert into public.contracts (billing_account_id, quote_id, kind, status, ends_at)
  values (acct, q, 'order_form', 'draft', base + interval '730 days') returning id into up_k;
  update public.contracts set status = 'signed', signed_at = now(), effective_at = now() where id = up_k;
  perform pg_temp.answered('a legitimate upgrade is applied: higher tier, longer term',
    (select tier || '/' || (ends_at = base + interval '730 days')::text from public.tenant_plan where tenant_id = 'north-auto'), 'campus/true');

  -- Replaying the older order form over the upgrade must neither lower the
  -- plan nor raise: it was applied once and is skipped.
  reset role;
  perform private.apply_signed_contract(k);
  perform pg_temp.answered('replaying the first order form leaves the upgrade in place',
    (select tier || '/' || (ends_at = base + interval '730 days')::text from public.tenant_plan where tenant_id = 'north-auto'), 'campus/true');
  raise notice 'ok  a later order form raises a plan, never lowers it';

  -- ── Account health ──────────────────────────────────────────────────────
  set local role service_role;
  insert into public.invoices (billing_account_id, status, subtotal_cents, issued_at, due_at)
  values (acct, 'open', 1500000, base - interval '60 days', base - interval '45 days');
  select public.compute_account_health(base) into n;
  perform pg_temp.counted('one snapshot per institution', n, 1);
  select public.compute_account_health(base) into n;
  perform pg_temp.counted('and none more the same day', n, 0);
  perform pg_temp.answered('a 45-day overdue invoice reads as a commercial risk',
    (select status || '/' || review_state from public.account_health_snapshots
      where billing_account_id = acct and source = 'nightly'), 'at_risk_commercial/pending_review');
  select count(*) into n from public.account_health_snapshots
   where billing_account_id = acct and source = 'nightly' and length(reason) >= 10 and length(next_action) >= 5
     and private.health_signals_ok(signals) and signals ? 'invoice_overdue_days' and signals ? 'implementation_pct';
  perform pg_temp.counted('with a reason, a next action and only allowed signals', n, 1);
  update public.invoices set status = 'paid', paid_at = base where billing_account_id = acct;
  update public.renewal_opportunities set stage = 'decided', outcome = 'renewed' where contract_id = k;
  select public.compute_account_health(base + interval '1 day') into n;
  perform pg_temp.answered('a healthy account needs no review',
    (select status || '/' || review_state from public.account_health_snapshots
      where billing_account_id = acct and source = 'nightly' order by taken_at desc limit 1), 'healthy/not_needed');
  reset role;

  perform pg_temp.become(ben);
  select count(*) into n from public.checkout_sessions;
  reset role;
  perform pg_temp.counted('another student reads none of her checkouts', n, 0);
  perform pg_temp.become(ana);
  select count(*) into n from public.checkout_sessions;
  reset role;
  perform pg_temp.counted('she reads her own', n, 1);

  raise notice 'commercial automation: every check passed';
end $$;

rollback;
