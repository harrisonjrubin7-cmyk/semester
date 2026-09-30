-- supabase/dining.check.sql — who may order, give, move and read, in dining.
--
-- For 20260929330000_dining.sql. What it proves:
--
--   * a student with a plan orders on a swipe, on dining dollars and on campus
--     cash, priced from the menu, once per request key — a retry returns the
--     same order and charges nothing more;
--   * nothing is charged with the flag off, with either money switch engaged,
--     or with the card office anything but live — and cancelling still
--     refunds under all three;
--   * an order is refused at a closed or paused location, for an item not on
--     today's menu, past the location's capacity, past the week's swipes, past
--     the balance, and at another school's location;
--   * a swipe used last plan week does not count against this one, and a
--     refund lands in the week its debit did;
--   * only dining staff at the school move an order, one step at a time; a
--     student cancels only their own order and only until it is accepted;
--   * a gift needs consent to the current wording; a shared swipe draws from
--     the school's pool within its limit; nobody — the recipient, the donor,
--     staff — can read who gave to whom;
--   * each student reads only their own plan, ledger and orders; staff read
--     their school's open orders through the queue, which reports a shared
--     swipe as a swipe, and no order row, balance or plan; the other school
--     reads none of it; the ledger cannot be edited, even by its owner;
--   * disconnecting the card office needs integration:configure, and stops
--     charging at once.
--
-- The control: the order that works comes first, and each refusal changes
-- one thing about the same people.
--
--   How to run it: supabase/check.sh dining

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- The error a statement raises as `who`, or null when it ran.
create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

-- Refused, and for the named reason: a refusal for the wrong reason is a
-- check passing by accident.
create or replace function pg_temp.refused(what text, who uuid, statement text, because text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || because || '%' then
    raise exception 'FAILED: % — refused, but for "%" rather than %', what, e, because;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.scalar(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

-- The swipe balance of one account, summed as the service sums it.
create or replace function pg_temp.bal(who uuid, want_kind text)
returns bigint language sql as $$
  select coalesce(sum(delta), 0) from public.dining_ledger where student = who and kind = want_kind;
$$;


-- Swipes the caller has left now, as the app reads them.
create or replace function pg_temp.left_for(who uuid)
returns bigint language plpgsql as $$
begin
  return pg_temp.scalar(who, 'select swipes_left from public.my_dining_balances()')::bigint;
end $$;

do $$
declare
  ana uuid; bo uuid; cy uuid; staff uuid; clerk uuid; cfg uuid; outsider uuid; far_staff uuid;
  rand uuid; kissam uuid; far uuid;
  bowl uuid; soup uuid; cake uuid; gone uuid; tomorrow uuid; far_bowl uuid;
  today date := (now() at time zone 'America/Chicago')::date;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; old uuid; p1 uuid;
  place constant text := $q$select public.dining_place_order(%L, array[%L]::uuid[], %L, %L)$q$;
  advance constant text := $q$select public.dining_advance_order(%L, %L)$q$;
  cancel constant text := $q$select public.dining_cancel_order(%L, %L)$q$;
  give constant text := $q$select public.dining_donate_swipes(%s, %L, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('dn-u', 'Dining University', array['dn-u.example']),
    ('dn-other', 'Other University', array['dn-other.example']);

  ana       := pg_temp.newuser('ana@dn-u.example', 'dn-u');
  bo        := pg_temp.newuser('bo@dn-u.example', 'dn-u');
  cy        := pg_temp.newuser('cy@dn-u.example', 'dn-u');       -- no meal plan
  staff     := pg_temp.newuser('staff@dn-u.example', 'dn-u');    -- dining_staff
  clerk     := pg_temp.newuser('clerk@dn-u.example', 'dn-u');    -- university_staff: no dining:operate
  cfg       := pg_temp.newuser('cfg@dn-u.example', 'dn-u');      -- integration_admin
  outsider  := pg_temp.newuser('dee@dn-other.example', 'dn-other');
  far_staff := pg_temp.newuser('staff@dn-other.example', 'dn-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (staff,     'dining_staff',      'school', 'dn-u',     'institution'),
    (clerk,     'university_staff',  'school', 'dn-u',     'institution'),
    (cfg,       'integration_admin', 'school', 'dn-u',     'institution'),
    (far_staff, 'dining_staff',      'school', 'dn-other', 'institution');

  -- What the card-office adapter writes with the service key.
  insert into public.dining_partner_connections (tenant_id, vendor, status, last_success_at) values
    ('dn-u', 'Mock card office', 'live', now()),
    ('dn-other', 'Mock card office', 'live', now());
  insert into public.dining_locations (tenant_id, name, time_zone, capacity, source_label, source_updated_at)
    values ('dn-u', 'Rand', 'America/Chicago', 3, 'imported', now()) returning id into rand;
  insert into public.dining_locations (tenant_id, name, time_zone, capacity, source_label, source_updated_at)
    values ('dn-u', 'Kissam', 'America/Chicago', 10, 'imported', now()) returning id into kissam;
  insert into public.dining_locations (tenant_id, name, time_zone, capacity, source_label, source_updated_at)
    values ('dn-other', 'Far', 'America/Chicago', 10, 'imported', now()) returning id into far;
  -- Rand and Far are open all day every day. Kissam has no hours, so it is closed now.
  insert into public.dining_hours (location_id, weekday, opens_min, closes_min)
    select l, d, 0, 1440 from unnest(array[rand, far]) l, generate_series(0, 6) d;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (rand, today, 'all_day', 'Grain bowl', 895, true, true, 'imported') returning id into bowl;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (rand, today, 'all_day', 'Soup', 450, true, true, 'imported') returning id into soup;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (rand, today, 'all_day', 'Cake', 375, false, true, 'imported') returning id into cake;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (rand, today, 'all_day', 'Sold out', 100, true, false, 'imported') returning id into gone;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (rand, today + 1, 'all_day', 'Tomorrow''s bowl', 895, true, true, 'imported') returning id into tomorrow;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (far, today, 'all_day', 'Far bowl', 895, true, true, 'imported') returning id into far_bowl;

  -- Two swipes a plan week, the week starting on today's weekday, so eight
  -- days ago is last week.
  insert into public.dining_plans (tenant_id, student, term, starts_on, ends_on, time_zone, week_starts, swipe_kind,
                                   swipes_per_week, source_label, source_updated_at)
  select 'dn-u', s, '2026FA', today - 30, today + 60, 'America/Chicago',
         extract(dow from today)::int, 'weekly', 2, 'institution_verified', now()
    from unnest(array[ana, bo]) s;
  insert into public.dining_plans (tenant_id, student, term, starts_on, ends_on, time_zone, swipe_kind, swipes_per_week, source_label)
    values ('dn-other', outsider, '2026FA', today - 30, today + 60, 'America/Chicago', 'weekly', 2, 'institution_verified');
  insert into public.dining_ledger (tenant_id, student, term, kind, delta, applies_at, reason, idempotency_key, source_label) values
    ('dn-u', ana, '2026FA', 'dining_cents', 1000, now() - interval '20 days', 'partner_sync', 'vendor-0001', 'institution_verified'),
    ('dn-u', ana, 'card', 'campus_cents', 500, now() - interval '20 days', 'partner_sync', 'vendor-0002', 'institution_verified'),
    ('dn-u', ana, '2026FA', 'swipe', -2, now() - interval '8 days', 'partner_sync', 'vendor-0003', 'institution_verified');

  -- ── Off until the school turns it on ─────────────────────────────────────
  perform pg_temp.refused('an order with dining off at the school', ana,
    format(place, rand, bowl, 'swipe', 'order-ana-0001'), 'dining: flag_off');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('dn-u', 'module.dining', 'preview');
  perform pg_temp.refused('an order with dining only in preview', ana,
    format(place, rand, bowl, 'swipe', 'order-ana-0001'), 'dining: flag_off');
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'dn-u' and capability = 'module.dining';
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('dn-other', 'module.dining', 'production');
  perform pg_temp.counted('and nothing was charged while it was off', (select count(*) from public.dining_ledger where reason = 'order'), 0);

  -- ── The order that works, once ───────────────────────────────────────────
  perform pg_temp.counted('last week''s two swipes do not count against this week', pg_temp.left_for(ana), 2);
  perform pg_temp.counted('a student with a plan orders on a swipe',
    (pg_temp.err(ana, format(place, rand, bowl, 'swipe', 'order-ana-0001')) is null)::int, 1);
  select id into o1 from public.dining_orders where student = ana and idempotency_key = 'order-ana-0001';
  perform pg_temp.counted('charged one swipe to this week', pg_temp.left_for(ana), 1);
  perform pg_temp.counted('the same request again returns the same order',
    (pg_temp.scalar(ana, format(place, rand, bowl, 'swipe', 'order-ana-0001')) = o1::text)::int, 1);
  perform pg_temp.counted('and charges nothing more', pg_temp.left_for(ana), 1);
  perform pg_temp.counted('one order, one history row, one debit',
    (select count(*) from public.dining_orders where student = ana)
    + (select count(*) from public.dining_order_events where order_id = o1)
    + (select count(*) from public.dining_ledger where order_id = o1), 3);
  perform pg_temp.refused('the same key for a different order', ana,
    format(place, rand, soup, 'swipe', 'order-ana-0001'), 'dining: idempotency_conflict');

  -- ── Where and what ───────────────────────────────────────────────────────
  perform pg_temp.refused('an order at a closed location', ana,
    format(place, kissam, bowl, 'swipe', 'order-ana-0002'), 'dining: closed');
  perform pg_temp.refused('an order at another school''s location', ana,
    format(place, far, far_bowl, 'swipe', 'order-ana-0002'), 'dining: not_found');
  perform pg_temp.refused('an item not served today', ana,
    format(place, rand, tomorrow, 'swipe', 'order-ana-0002'), 'dining: item_unavailable');
  perform pg_temp.refused('an item sold out', ana,
    format(place, rand, gone, 'swipe', 'order-ana-0002'), 'dining: item_unavailable');
  perform pg_temp.refused('a student pausing a location', ana,
    format($q$select public.dining_set_ordering(%L, false)$q$, rand), 'dining: not_allowed');
  perform pg_temp.counted('dining staff pause Rand',
    (pg_temp.err(staff, format($q$select public.dining_set_ordering(%L, false)$q$, rand)) is null)::int, 1);
  perform pg_temp.refused('an order where ordering is paused', ana,
    format(place, rand, soup, 'swipe', 'order-ana-0002'), 'dining: ordering_paused');
  perform pg_temp.counted('and resume it',
    (pg_temp.err(staff, format($q$select public.dining_set_ordering(%L, true)$q$, rand)) is null)::int, 1);

  -- ── Payment ──────────────────────────────────────────────────────────────
  perform pg_temp.counted('the second swipe of the week',
    (pg_temp.err(ana, format(place, rand, soup, 'swipe', 'order-ana-0002')) is null)::int, 1);
  select id into o2 from public.dining_orders where student = ana and idempotency_key = 'order-ana-0002';
  perform pg_temp.refused('a third swipe in a two-swipe week', ana,
    format(place, rand, soup, 'swipe', 'order-ana-0003'), 'dining: swipes_exhausted');
  perform pg_temp.refused('a swipe for an item a swipe does not cover', bo,
    format(place, rand, cake, 'swipe', 'order-bo-00001'), 'dining: invalid');
  perform pg_temp.refused('dining dollars the balance does not cover', bo,
    format(place, rand, bowl, 'dining_cents', 'order-bo-00002'), 'dining: insufficient_funds');
  perform pg_temp.refused('a swipe with no meal plan', cy,
    format(place, rand, bowl, 'swipe', 'order-cy-00001'), 'dining: no_plan');
  perform pg_temp.counted('dining dollars, priced from the menu',
    (pg_temp.err(ana, format(place, rand, cake, 'dining_cents', 'order-ana-0004')) is null)::int, 1);
  select id into o3 from public.dining_orders where student = ana and idempotency_key = 'order-ana-0004';
  perform pg_temp.counted('charged 375 cents, not a figure the client sent', pg_temp.bal(ana, 'dining_cents'), 625);
  -- Rand takes three open orders and has three.
  perform pg_temp.refused('an order past the location''s capacity', ana,
    format(place, rand, soup, 'campus_cents', 'order-ana-0005'), 'dining: at_capacity');

  -- ── Moving orders: dining staff at the school, one step at a time ────────
  perform pg_temp.refused('a student moving an order', ana, format(advance, o1, 'accepted'), 'dining: not_allowed');
  perform pg_temp.refused('school staff without dining:operate', clerk, format(advance, o1, 'accepted'), 'dining: not_allowed');
  perform pg_temp.refused('dining staff at the other school', far_staff, format(advance, o1, 'accepted'), 'dining: not_found');
  perform pg_temp.refused('skipping a step', staff, format(advance, o1, 'ready'), 'dining: bad_transition');
  perform pg_temp.refused('cancelling by way of advance', staff, format(advance, o1, 'cancelled'), 'dining: invalid');
  perform pg_temp.counted('dining staff accept', (pg_temp.err(staff, format(advance, o1, 'accepted')) is null)::int, 1);
  perform pg_temp.counted('ready', (pg_temp.err(staff, format(advance, o1, 'ready')) is null)::int, 1);
  perform pg_temp.counted('and hand over', (pg_temp.err(staff, format(advance, o1, 'picked_up')) is null)::int, 1);
  perform pg_temp.counted('a repeated move writes no second history row',
    (pg_temp.err(staff, format(advance, o1, 'picked_up')) is null)::int
    + (select count(*) from public.dining_order_events where order_id = o1), 5);
  perform pg_temp.refused('moving a picked-up order back', staff, format(advance, o1, 'ready'), 'dining: bad_transition');
  perform pg_temp.refused('cancelling a picked-up order', staff, format(cancel, o1, ''), 'dining: bad_transition');
  perform pg_temp.counted('a handed-over order frees its place: campus cash',
    (pg_temp.err(ana, format(place, rand, soup, 'campus_cents', 'order-ana-0005')) is null)::int, 1);
  select id into o4 from public.dining_orders where student = ana and idempotency_key = 'order-ana-0005';
  perform pg_temp.counted('charged to the card', pg_temp.bal(ana, 'campus_cents'), 50);
  -- The adapter raises Rand's limit, so the rest of the file is not about capacity.
  update public.dining_locations set capacity = 50 where id = rand;

  -- ── Cancelling ───────────────────────────────────────────────────────────
  perform pg_temp.refused('another student cancelling Ana''s order', bo, format(cancel, o2, ''), 'dining: not_found');
  perform pg_temp.counted('Ana cancels her placed order', (pg_temp.err(ana, format(cancel, o2, 'Changed my mind')) is null)::int, 1);
  perform pg_temp.counted('and the swipe comes back', pg_temp.left_for(ana), 1);
  perform pg_temp.counted('cancelling again refunds nothing more',
    (pg_temp.err(ana, format(cancel, o2, '')) is null)::int
    + (select count(*) from public.dining_ledger where order_id = o2 and reason = 'refund'), 2);
  perform pg_temp.counted('dining staff accept the dining-dollars order',
    (pg_temp.err(staff, format(advance, o3, 'accepted')) is null)::int, 1);
  perform pg_temp.refused('the student cancelling once it is accepted', ana, format(cancel, o3, ''), 'dining: not_allowed');
  perform pg_temp.counted('staff cancel it', (pg_temp.err(staff, format(cancel, o3, 'Out of cake')) is null)::int, 1);
  perform pg_temp.counted('and it is refunded to the cent', pg_temp.bal(ana, 'dining_cents'), 1000);

  -- A swipe charged last plan week, for an order cancelled now, goes back to
  -- last week — not to this one, where it would be a meal nobody paid for.
  insert into public.dining_orders (tenant_id, location_id, student, idempotency_key, pay, amount, items, term)
    values ('dn-u', rand, bo, 'order-bo-older', 'swipe', 1, array[bowl], '2026FA') returning id into old;
  insert into public.dining_ledger (tenant_id, student, term, kind, delta, applies_at, reason, idempotency_key, source_label, order_id)
    values ('dn-u', bo, '2026FA', 'swipe', -1, now() - interval '8 days', 'order', 'o.order-bo-older', 'estimated', old);
  perform pg_temp.counted('Bo has this week''s two', pg_temp.left_for(bo), 2);
  perform pg_temp.counted('Bo cancels last week''s order', (pg_temp.err(bo, format(cancel, old, '')) is null)::int, 1);
  perform pg_temp.counted('and still has two this week, not three', pg_temp.left_for(bo), 2);
  perform pg_temp.counted('the refund counts in the week of its debit',
    (select count(*) from public.dining_ledger where order_id = old and reason = 'refund' and applies_at < now() - interval '7 days'), 1);

  -- ── The switches, and the card office ────────────────────────────────────
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('dn-u', 'kill.writeback', true, 'check');
  perform pg_temp.refused('an order with kill.writeback engaged', bo,
    format(place, rand, bowl, 'swipe', 'order-bo-00003'), 'dining: kill_switch');
  perform pg_temp.counted('a cancellation still refunds under it', (pg_temp.err(ana, format(cancel, o4, '')) is null)::int, 1);
  perform pg_temp.counted('to the cent', pg_temp.bal(ana, 'campus_cents'), 500);
  update public.feature_kill_switch set engaged = false, reason = '' where tenant_id = 'dn-u';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values (null, 'kill.integration_sync', true, 'check');
  perform pg_temp.refused('an order with kill.integration_sync engaged everywhere', bo,
    format(place, rand, bowl, 'swipe', 'order-bo-00003'), 'dining: kill_switch');
  update public.feature_kill_switch set engaged = false, reason = '' where tenant_id is null;
  update public.dining_partner_connections set status = 'degraded' where tenant_id = 'dn-u';
  perform pg_temp.refused('an order with the card office degraded', bo,
    format(place, rand, bowl, 'swipe', 'order-bo-00003'), 'dining: partner_unavailable');
  perform pg_temp.refused('a gift with the card office degraded', bo,
    format(give, 1, 'dining-share-v1', 'gift-bo-0001'), 'dining: partner_unavailable');
  update public.dining_partner_connections set status = 'live' where tenant_id = 'dn-u';

  -- ── Sharing ──────────────────────────────────────────────────────────────
  perform pg_temp.refused('a gift without consent to the current wording', bo,
    format(give, 1, 'dining-share-v0', 'gift-bo-0001'), 'dining: consent_required');
  perform pg_temp.refused('a gift of more than the week has left', bo,
    format(give, 3, 'dining-share-v1', 'gift-bo-0001'), 'dining: swipes_exhausted');
  perform pg_temp.refused('a gift from a student with no plan', cy,
    format(give, 1, 'dining-share-v1', 'gift-cy-0001'), 'dining: no_plan');
  perform pg_temp.counted('Bo gives two', (pg_temp.err(bo, format(give, 2, 'dining-share-v1', 'gift-bo-0001')) is null)::int, 1);
  perform pg_temp.counted('from his week', pg_temp.left_for(bo), 0);
  perform pg_temp.counted('giving again with the same key gives nothing more',
    (pg_temp.err(bo, format(give, 2, 'dining-share-v1', 'gift-bo-0001')) is null)::int
    + (select count(*) from public.dining_pool_donations), 2);
  perform pg_temp.refused('the same key for a different gift', bo,
    format(give, 1, 'dining-share-v1', 'gift-bo-0001'), 'dining: idempotency_conflict');
  perform pg_temp.counted('Cy, with no plan, eats on a shared swipe',
    (pg_temp.err(cy, format(place, rand, bowl, 'pool_swipe', 'order-cy-00002')) is null)::int, 1);
  select id into p1 from public.dining_orders where student = cy and idempotency_key = 'order-cy-00002';
  perform pg_temp.counted('and a second', (pg_temp.err(cy, format(place, rand, soup, 'pool_swipe', 'order-cy-00003')) is null)::int, 1);
  perform pg_temp.refused('a shared swipe from an empty pool', cy,
    format(place, rand, bowl, 'pool_swipe', 'order-cy-00004'), 'dining: pool_empty');
  perform pg_temp.counted('Ana gives her last one', (pg_temp.err(ana, format(give, 1, 'dining-share-v1', 'gift-ana-0001')) is null)::int, 1);
  perform pg_temp.refused('a third shared swipe in seven days', cy,
    format(place, rand, bowl, 'pool_swipe', 'order-cy-00004'), 'dining: claim_limit');
  perform pg_temp.counted('a cancelled shared swipe goes back to the pool', (pg_temp.err(cy, format(cancel, p1, '')) is null)::int, 1);

  -- Nobody can say whose swipe it was.
  perform pg_temp.counted('the recipient reads no gift', pg_temp.seen(cy, 'select * from public.dining_pool_donations'), 0);
  perform pg_temp.counted('only their own draws', pg_temp.seen(cy, 'select * from public.dining_pool_claims'), 3);
  perform pg_temp.counted('a donor reads their own gift', pg_temp.seen(bo, 'select * from public.dining_pool_donations'), 1);
  perform pg_temp.counted('and no draw', pg_temp.seen(bo, 'select * from public.dining_pool_claims'), 0);
  perform pg_temp.counted('dining staff read neither',
    pg_temp.seen(staff, 'select * from public.dining_pool_donations') + pg_temp.seen(staff, 'select * from public.dining_pool_claims'), 0);
  perform pg_temp.counted('staff read three totals: 3 given, 1 drawn, 2 left',
    (pg_temp.scalar(staff, 'select donated || ''/'' || drawn || ''/'' || available from public.dining_pool_summary()') = '3/1/2')::int, 1);
  perform pg_temp.refused('a student asking for the pool summary', cy, 'select * from public.dining_pool_summary()', 'dining: not_allowed');
  perform pg_temp.counted('no gift column names a recipient, no draw column a donor',
    (select count(*) from information_schema.columns
      where table_schema = 'public'
        and ((table_name = 'dining_pool_donations' and column_name ~ 'recipient|claim|order')
          or (table_name = 'dining_pool_claims' and column_name ~ 'donor|donation|gift'))), 0);

  -- ── Who reads what ───────────────────────────────────────────────────────
  perform pg_temp.counted('a student reads their own plan', pg_temp.seen(ana, 'select * from public.dining_plans'), 1);
  perform pg_temp.counted('their own ledger, and nobody else''s',
    pg_temp.seen(ana, format('select * from public.dining_ledger where student <> %L', ana)), 0);
  perform pg_temp.counted('their own orders only', pg_temp.seen(ana, format('select * from public.dining_orders where student <> %L', ana)), 0);
  perform pg_temp.counted('and the history of their own orders only',
    pg_temp.seen(ana, format('select * from public.dining_order_events e join public.dining_orders o on o.id = e.order_id where o.student <> %L', ana)), 0);
  perform pg_temp.counted('dining staff read no order row directly', pg_temp.seen(staff, 'select * from public.dining_orders'), 0);
  perform pg_temp.counted('they read the school''s open orders through the queue',
    pg_temp.seen(staff, 'select * from public.dining_order_queue()'),
    (select count(*) from public.dining_orders where tenant_id = 'dn-u' and status in ('placed', 'accepted', 'ready')));
  -- The control: Cy's second shared-swipe order is still open, so the queue
  -- holds one a shared swipe paid for, and says only that it is paid.
  perform pg_temp.counted('an open order a shared swipe paid for is in the queue',
    (select count(*) from public.dining_orders where tenant_id = 'dn-u' and pay = 'pool_swipe' and status = 'placed'), 1);
  perform pg_temp.counted('and the queue does not say so',
    pg_temp.seen(staff, $q$select * from public.dining_order_queue() where paid_with not in ('swipe', 'dining_cents', 'campus_cents')$q$), 0);
  perform pg_temp.refused('staff without dining:operate asking for the queue', clerk,
    'select * from public.dining_order_queue()', 'dining: not_allowed');
  perform pg_temp.refused('a student asking for the queue', ana,
    'select * from public.dining_order_queue()', 'dining: not_allowed');
  perform pg_temp.counted('dining staff at the other school read none of this school''s queue',
    pg_temp.seen(far_staff, format('select * from public.dining_order_queue() where location_id = %L', rand)), 0);
  perform pg_temp.counted('and no plan and no ledger',
    pg_temp.seen(staff, 'select * from public.dining_plans') + pg_temp.seen(staff, 'select * from public.dining_ledger'), 0);
  perform pg_temp.counted('staff without dining:operate read no order', pg_temp.seen(clerk, 'select * from public.dining_orders'), 0);
  perform pg_temp.counted('dining staff at the other school read none of this school''s',
    pg_temp.seen(far_staff, 'select * from public.dining_orders'), 0);
  perform pg_temp.counted('the other school reads none of the locations, hours or menus',
    pg_temp.seen(outsider, $q$select id from public.dining_locations where tenant_id = 'dn-u'$q$)
    + pg_temp.seen(outsider, format('select * from public.dining_hours where location_id = %L', rand))
    + pg_temp.seen(outsider, format('select * from public.dining_menu_items where location_id = %L', rand)), 0);
  perform pg_temp.counted('a member reads their school''s locations and today''s menu',
    pg_temp.seen(cy, 'select * from public.dining_locations') + pg_temp.seen(cy, format('select * from public.dining_menu_items where location_id = %L', rand)), 2 + 5);
  perform pg_temp.counted('and whether the card office is live',
    (pg_temp.scalar(cy, 'select status from public.dining_partner_connections') = 'live')::int, 1);
  perform pg_temp.counted('Ana''s balances come back summed, with the connection''s status',
    (pg_temp.scalar(ana, 'select plan_term || ''/'' || dining_cents || ''/'' || campus_cents || ''/'' || partner_status from public.my_dining_balances()')
      = '2026FA/1000/500/live')::int, 1);

  -- ── Nobody writes directly; nobody edits the ledger ──────────────────────
  perform pg_temp.refused('a student inserting an order directly', ana,
    format($q$insert into public.dining_orders (tenant_id, location_id, student, idempotency_key, pay, amount, items) values ('dn-u', %L, %L, 'direct-0001', 'swipe', 1, array[%L]::uuid[])$q$, rand, ana, bowl),
    'permission denied');
  perform pg_temp.refused('a student crediting their own ledger', ana,
    format($q$insert into public.dining_ledger (tenant_id, student, term, kind, delta, applies_at, reason, idempotency_key, source_label) values ('dn-u', %L, '2026FA', 'dining_cents', 100000, now(), 'adjustment', 'free-money-01', 'estimated')$q$, ana),
    'permission denied');
  perform pg_temp.refused('a student editing their ledger', ana, 'update public.dining_ledger set delta = 100000', 'permission denied');
  perform pg_temp.refused('a student deleting a debit', ana, 'delete from public.dining_ledger', 'permission denied');
  perform pg_temp.refused('a student marking their order picked up', ana, 'update public.dining_orders set status = ''picked_up''', 'permission denied');
  perform pg_temp.refused('a student adding to the pool directly', ana,
    $q$insert into public.dining_pool_donations (tenant_id, swipes, consent_version, idempotency_key) values ('dn-u', 5, 'dining-share-v1', 'direct-0002')$q$,
    'permission denied');
  begin
    update public.dining_ledger set delta = delta where student = ana;
    raise exception 'FAILED: the ledger''s owner edited an entry';
  exception when insufficient_privilege then
    raise notice 'ok  not even the owner edits a ledger entry (%)', sqlerrm;
  end;

  -- ── Disconnecting ────────────────────────────────────────────────────────
  perform pg_temp.refused('a student disconnecting the card office', ana,
    'select public.dining_disconnect_partner()', 'dining: not_allowed');
  perform pg_temp.refused('dining staff disconnecting it', staff,
    'select public.dining_disconnect_partner()', 'dining: not_allowed');
  perform pg_temp.counted('integration:configure disconnects it',
    (pg_temp.err(cfg, 'select public.dining_disconnect_partner()') is null)::int, 1);
  perform pg_temp.counted('this school''s only',
    (select count(*) from public.dining_partner_connections where status = 'disconnected'), 1);
  perform pg_temp.refused('and from then nothing charges', ana,
    format(place, rand, soup, 'dining_cents', 'order-ana-0006'), 'dining: partner_unavailable');

  -- ── A donor's account goes; their gift stays ─────────────────────────────
  delete from auth.users where id = bo;
  perform pg_temp.counted('the pool keeps a deleted donor''s gift, with the donor cleared',
    (select count(*) from public.dining_pool_donations where donor is null and swipes = 2), 1);
  perform pg_temp.counted('and the deleted student''s ledger goes with them',
    (select count(*) from public.dining_ledger where student = bo), 0);
end $$;

-- ── The flag's narrowing holds at the database ─────────────────────────────
--
-- 20260929370000_feature_policy_narrowing.sql. A school that limits
-- module.dining to a role or a release cohort has limited the charge, not
-- only the screen: the RPCs refuse a caller the narrowing leaves out. The
-- control comes first — with both lists empty, the same people order and
-- give — so each refusal below is the list that changed, not the setup.
do $$
declare
  sam uuid; tia uuid; mo uuid; hall uuid; meal uuid;
  today date := (now() at time zone 'America/Chicago')::date;
  place constant text := $q$select public.dining_place_order(%L, array[%L]::uuid[], %L, %L)$q$;
  give constant text := $q$select public.dining_donate_swipes(%s, %L, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('dn-n', 'Narrow University', array['dn-n.example']);
  sam := pg_temp.newuser('sam@dn-n.example', 'dn-n');   -- a student, in no cohort
  tia := pg_temp.newuser('tia@dn-n.example', 'dn-n');   -- university_staff, with a meal plan
  mo  := pg_temp.newuser('mo@dn-n.example', 'dn-n');    -- a student in the pilot cohort
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (sam, 'undergraduate_student', 'school', 'dn-n', 'institution'),
    (mo,  'undergraduate_student', 'school', 'dn-n', 'institution'),
    (tia, 'university_staff',      'school', 'dn-n', 'institution'),
    -- Staff somewhere else is not staff here.
    (sam, 'university_staff',      'school', 'dn-u', 'institution');
  insert into public.dining_partner_connections (tenant_id, vendor, status, last_success_at)
    values ('dn-n', 'Mock card office', 'live', now());
  insert into public.dining_locations (tenant_id, name, time_zone, capacity, source_label, source_updated_at)
    values ('dn-n', 'Hall', 'America/Chicago', 100, 'imported', now()) returning id into hall;
  insert into public.dining_hours (location_id, weekday, opens_min, closes_min)
    select hall, d, 0, 1440 from generate_series(0, 6) d;
  insert into public.dining_menu_items (location_id, served_on, meal, name, price_cents, swipe_eligible, available, source_label)
    values (hall, today, 'all_day', 'Plate', 700, true, true, 'imported') returning id into meal;
  insert into public.dining_plans (tenant_id, student, term, starts_on, ends_on, time_zone, week_starts, swipe_kind,
                                   swipes_per_week, source_label, source_updated_at)
  select 'dn-n', s, '2026FA', today - 30, today + 60, 'America/Chicago',
         extract(dow from today)::int, 'weekly', 20, 'institution_verified', now()
    from unnest(array[sam, tia, mo]) s;

  -- The control: both lists empty admit everybody the state admits.
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('dn-n', 'module.dining', 'production');
  perform pg_temp.counted('with no narrowing, a student orders',
    (pg_temp.err(sam, format(place, hall, meal, 'swipe', 'narrow-sam-0001')) is null)::int, 1);
  perform pg_temp.counted('and gives a swipe',
    (pg_temp.err(sam, format(give, 1, 'dining-share-v1', 'narrow-gift-sam-1')) is null)::int, 1);

  -- A staff-only preview: the school names university_staff.
  update public.tenant_feature_policy set permitted_roles = array['university_staff']
   where tenant_id = 'dn-n' and capability = 'module.dining';
  perform pg_temp.refused('a student''s order in a staff-only preview', sam,
    format(place, hall, meal, 'swipe', 'narrow-sam-0002'), 'dining: flag_off');
  perform pg_temp.refused('a student''s swipe gift in a staff-only preview', sam,
    format(give, 1, 'dining-share-v1', 'narrow-gift-sam-2'), 'dining: flag_off');
  perform pg_temp.counted('and nothing was charged or given for the refusals',
    (select count(*) from public.dining_orders where student = sam)
    + (select count(*) from public.dining_pool_donations where donor = sam), 2);
  perform pg_temp.counted('staff at the school order in it',
    (pg_temp.err(tia, format(place, hall, meal, 'swipe', 'narrow-tia-0001')) is null)::int, 1);
  perform pg_temp.counted('and give in it',
    (pg_temp.err(tia, format(give, 1, 'dining-share-v1', 'narrow-gift-tia-1')) is null)::int, 1);
  update public.role_grants set revoked_at = now() where subject = tia and scope_id = 'dn-n';
  perform pg_temp.refused('staff whose grant was revoked', tia,
    format(place, hall, meal, 'swipe', 'narrow-tia-0002'), 'dining: flag_off');
  update public.role_grants set revoked_at = null, expires_at = now() - interval '1 minute' where subject = tia and scope_id = 'dn-n';
  perform pg_temp.refused('staff whose grant has expired', tia,
    format(place, hall, meal, 'swipe', 'narrow-tia-0002'), 'dining: flag_off');
  update public.role_grants set expires_at = null where subject = tia and scope_id = 'dn-n';

  -- A pilot cohort, and no role list.
  update public.tenant_feature_policy set permitted_roles = '{}', permitted_cohorts = array['dining-pilot']
   where tenant_id = 'dn-n' and capability = 'module.dining';
  insert into public.feature_cohort_members (tenant_id, cohort, user_id) values ('dn-n', 'dining-pilot', mo);
  -- A membership in another cohort admits nothing.
  insert into public.feature_cohort_members (tenant_id, cohort, user_id) values ('dn-n', 'other-pilot', sam);
  perform pg_temp.refused('a student outside the cohort ordering', sam,
    format(place, hall, meal, 'swipe', 'narrow-sam-0003'), 'dining: flag_off');
  perform pg_temp.refused('a student outside the cohort giving', sam,
    format(give, 1, 'dining-share-v1', 'narrow-gift-sam-3'), 'dining: flag_off');
  perform pg_temp.refused('staff outside the cohort ordering', tia,
    format(place, hall, meal, 'swipe', 'narrow-tia-0003'), 'dining: flag_off');
  perform pg_temp.counted('a member of the cohort orders',
    (pg_temp.err(mo, format(place, hall, meal, 'swipe', 'narrow-mo-00001')) is null)::int, 1);
  perform pg_temp.counted('and gives',
    (pg_temp.err(mo, format(give, 1, 'dining-share-v1', 'narrow-gift-mo-01')) is null)::int, 1);
  -- What the client reads (`lib/featurepolicy.ts`) is the same answer, under
  -- the caller's own row-level security.
  perform pg_temp.counted('the client read: a non-member holds no named cohort',
    pg_temp.seen(sam, $q$select * from public.feature_narrowing('module.dining', 'dn-n') where permitted_cohorts = array['dining-pilot'] and cohorts = '{}'$q$), 1);
  perform pg_temp.counted('a member reads their own cohort back, and only the named one',
    pg_temp.seen(mo, $q$select * from public.feature_narrowing('module.dining', 'dn-n') where cohorts = array['dining-pilot']$q$), 1);
  perform pg_temp.counted('a member of another school reads no row for this one',
    pg_temp.seen((select user_id from public.profiles where school_id = 'dn-u' limit 1),
      $q$select * from public.feature_narrowing('module.dining', 'dn-n')$q$), 0);
  update public.feature_cohort_members set removed_at = now() where user_id = mo and cohort = 'dining-pilot';
  perform pg_temp.refused('a member removed from the cohort', mo,
    format(place, hall, meal, 'swipe', 'narrow-mo-00002'), 'dining: flag_off');

  -- Both lists: the caller needs both.
  update public.tenant_feature_policy set permitted_roles = array['university_staff'], permitted_cohorts = array['dining-pilot']
   where tenant_id = 'dn-n' and capability = 'module.dining';
  insert into public.feature_cohort_members (tenant_id, cohort, user_id) values ('dn-n', 'dining-pilot', sam);
  perform pg_temp.refused('a cohort member without the role', sam,
    format(place, hall, meal, 'swipe', 'narrow-sam-0004'), 'dining: flag_off');
  insert into public.feature_cohort_members (tenant_id, cohort, user_id) values ('dn-n', 'dining-pilot', tia);
  perform pg_temp.counted('staff in the cohort order',
    (pg_temp.err(tia, format(place, hall, meal, 'swipe', 'narrow-tia-0004')) is null)::int, 1);

  -- Cancelling is not behind the narrowing, as it is not behind the flag:
  -- narrowing a feature must never trap money already taken.
  update public.tenant_feature_policy set permitted_roles = array['university_staff'], permitted_cohorts = '{}'
   where tenant_id = 'dn-n' and capability = 'module.dining';
  perform pg_temp.counted('a student left out still cancels their own order',
    (pg_temp.err(sam, format($q$select public.dining_cancel_order(%L, '')$q$,
      (select id from public.dining_orders where student = sam and idempotency_key = 'narrow-sam-0001'))) is null)::int, 1);
end $$;

set local role anon;
do $$
begin
  perform count(*) from public.dining_locations;
  raise exception 'FAILED: a signed-out visitor read dining locations';
exception when insufficient_privilege then
  raise notice 'ok  a signed-out visitor cannot read dining locations';
end $$;
do $$
begin
  perform public.dining_place_order(gen_random_uuid(), array[gen_random_uuid()], 'swipe', 'anon-order-01');
  raise exception 'FAILED: a signed-out visitor placed an order';
exception when insufficient_privilege then
  raise notice 'ok  or place an order';
end $$;
reset role;

rollback;
