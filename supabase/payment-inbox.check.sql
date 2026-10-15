-- The payment-rail registry and the verified-event inbox
-- (20261006090000_payment_rails_and_event_inbox, D-1319).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * both tables are service-only: row level security on, no policy, and no
--     privilege for `public`, `anon` or `authenticated`;
--   * a rail holds no credential, and cannot be made to: its capabilities may
--     only use the adapter interface's own key names, so a secret cannot be
--     stored under any other name;
--   * a rail's provider, mode, status, kinds and currencies are the closed sets
--     the interface and the commercial tables use;
--   * an event is stored once per provider, as a hash and a bounded projection,
--     and a projection that holds a run of 13 to 19 digits is refused;
--   * a verified event is never rewritten: every identity column is fixed, the
--     status moves only along the listed steps, attempts only go up, an applied
--     row is final, and nothing is ever deleted;
--   * the probe is not broken: a statement that is allowed makes the "must be
--     refused" helper fail.

begin;

-- Runs `stmt` and demands it fail, with `want` somewhere in the error. Fails the
-- check, loudly, if the statement is allowed or fails for another reason.
create or replace function pg_temp.refuses(what text, stmt text, want text default null)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if want is not null and position(lower(want) in lower(sqlerrm)) = 0 then
      raise exception 'FAILED: % — refused for the wrong reason: %', what, sqlerrm;
    end if;
    raise notice 'ok  % (refused: %)', what, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FAILED: % — was allowed', what;
end $$;

create or replace function pg_temp.allows(what text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok  % (allowed)', what;
exception when others then
  raise exception 'FAILED: % — was refused: %', what, sqlerrm;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  t text;
  p text;
  ev uuid;
  n bigint;
  sha text := repeat('a', 64);
begin
  -- ── The control: the probe itself ─────────────────────────────────────
  begin
    perform pg_temp.refuses('control: an allowed statement', 'select 1');
    raise exception 'probe broken: an allowed statement passed as refused';
  exception when others then
    if sqlerrm not like 'FAILED: control: an allowed statement%' then raise; end if;
    raise notice 'ok  control: the refusal probe fails on an allowed statement';
  end;

  -- ── Service-only ──────────────────────────────────────────────────────
  foreach t in array array['payment_rails', 'provider_event_inbox'] loop
    perform pg_temp.counted(t || ' has row level security on',
      (select relrowsecurity::int from pg_class where oid = ('public.' || t)::regclass), 1);
    perform pg_temp.counted(t || ' has no policy',
      (select count(*) from pg_policies where schemaname = 'public' and tablename = t), 0);
    foreach p in array array['select', 'insert', 'update', 'delete', 'references', 'trigger', 'truncate'] loop
      perform pg_temp.counted(t || ': anon holds no ' || p,
        has_table_privilege('anon', 'public.' || t, p)::int, 0);
      perform pg_temp.counted(t || ': authenticated holds no ' || p,
        has_table_privilege('authenticated', 'public.' || t, p)::int, 0);
    end loop;
  end loop;
  perform pg_temp.counted('the guard function is not callable by a client',
    (has_function_privilege('authenticated', 'private.provider_event_inbox_guard()', 'execute')
     or has_function_privilege('anon', 'private.provider_event_inbox_guard()', 'execute'))::int, 0);

  -- ── payment_rails: what may be stored ─────────────────────────────────
  perform pg_temp.allows('a rail with every interface capability',
    $s$insert into public.payment_rails (id, provider, mode, status, kinds, currencies, capabilities) values
       ('stripe-test', 'stripe', 'test', 'enabled', array['card'], array['usd'],
        '{"hostedCollection":false,"authorize":false,"capture":false,"refund":false,"partialRefund":false,"recurring":true,"offSessionCharge":false,"installments":false,"tax":true,"disputes":false,"disputeEvidenceApi":false,"settlementReport":false,"webhookSigning":"hmac_sha256_timestamped"}')$s$);
  perform pg_temp.allows('a bare draft rail takes the defaults',
    $s$insert into public.payment_rails (id, provider, mode) values ('mock-test', 'mock', 'test')$s$);

  perform pg_temp.refuses('a rail id in capitals', $s$insert into public.payment_rails (id, provider, mode) values ('Stripe', 'stripe', 'live')$s$);
  perform pg_temp.refuses('a provider that is not an identifier', $s$insert into public.payment_rails (id, provider, mode) values ('x-live', 'Stripe!', 'live')$s$);
  perform pg_temp.refuses('a mode that is neither live nor test', $s$insert into public.payment_rails (id, provider, mode) values ('x-staging', 'stripe', 'staging')$s$);
  perform pg_temp.refuses('a status outside the list', $s$insert into public.payment_rails (id, provider, mode, status) values ('x-live', 'stripe', 'live', 'on')$s$);
  perform pg_temp.refuses('a kind outside the list', $s$insert into public.payment_rails (id, provider, mode, kinds) values ('x-live', 'stripe', 'live', array['crypto'])$s$);
  perform pg_temp.refuses('a currency in capitals', $s$insert into public.payment_rails (id, provider, mode, currencies) values ('x-live', 'stripe', 'live', array['USD'])$s$);
  perform pg_temp.refuses('a currency that is not three letters', $s$insert into public.payment_rails (id, provider, mode, currencies) values ('x-live', 'stripe', 'live', array['us'])$s$);
  perform pg_temp.refuses('no currencies at all', $s$insert into public.payment_rails (id, provider, mode, currencies) values ('x-live', 'stripe', 'live', '{}')$s$);
  perform pg_temp.refuses('capabilities that are not an object', $s$insert into public.payment_rails (id, provider, mode, capabilities) values ('x-live', 'stripe', 'live', '[]')$s$);

  -- A credential cannot be stored: not as a named secret, not as a key under any name.
  perform pg_temp.refuses('a secret stored in capabilities', $s$insert into public.payment_rails (id, provider, mode, capabilities) values ('x-live', 'stripe', 'live', '{"api_key":"sk_live_abc"}')$s$);
  perform pg_temp.refuses('a webhook secret stored in capabilities', $s$insert into public.payment_rails (id, provider, mode, capabilities) values ('x-live', 'stripe', 'live', '{"webhookSecret":"whsec_abc"}')$s$);
  perform pg_temp.refuses('a legitimate key beside a smuggled one', $s$insert into public.payment_rails (id, provider, mode, capabilities) values ('x-live', 'stripe', 'live', '{"tax":true,"token":"x"}')$s$);
  perform pg_temp.refuses('the same smuggling by update', $s$update public.payment_rails set capabilities = '{"password":"x"}' where id = 'mock-test'$s$);
  perform pg_temp.refuses('a duplicate rail id', $s$insert into public.payment_rails (id, provider, mode) values ('mock-test', 'mock', 'test')$s$);

  -- ── provider_event_inbox: what may be stored ──────────────────────────
  perform pg_temp.allows('a verified event with a projection',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256, projection)
       values ('stripe', 'evt_1', 'invoice.paid', '2026-10-05 12:00+00', false, %L,
               '{"invoiceRef":"in_1","subscriptionRef":"sub_1","amountCents":799,"currency":"usd","issuedAt":"2026-10-05T12:00:00.000Z"}')$s$, sha));
  perform pg_temp.allows('a second event under the same provider',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256)
       values ('stripe', 'evt_2', 'charge.refunded', now(), false, %L)$s$, sha));

  perform pg_temp.refuses('the same provider event twice',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256)
       values ('stripe', 'evt_1', 'invoice.paid', now(), false, %L)$s$, sha), 'provider_event_inbox_once');
  perform pg_temp.allows('the same event id under another provider',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256)
       values ('mock', 'evt_1', 'mock.payment.captured', now(), false, %L)$s$, sha));
  perform pg_temp.refuses('a hash that is not 64 hex characters',
    $s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256)
       values ('stripe', 'evt_bad1', 'x', now(), false, 'abc')$s$);
  perform pg_temp.refuses('an upper-case hash',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256)
       values ('stripe', 'evt_bad2', 'x', now(), false, %L)$s$, repeat('A', 64)));
  perform pg_temp.refuses('an empty event id',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256)
       values ('stripe', '', 'x', now(), false, %L)$s$, sha));

  perform pg_temp.refuses('a projection that is not an object',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256, projection)
       values ('stripe', 'evt_p1', 'x', now(), false, %L, '[1]')$s$, sha));
  perform pg_temp.refuses('a projection holding a card number',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256, projection)
       values ('stripe', 'evt_p2', 'x', now(), false, %L, '{"note":"4242 4242 4242 4242"}')$s$, sha));
  perform pg_temp.refuses('a card number run together',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256, projection)
       values ('stripe', 'evt_p3', 'x', now(), false, %L, '{"ref":"4242424242424242"}')$s$, sha));
  perform pg_temp.refuses('a projection over the size bound',
    format($s$insert into public.provider_event_inbox (provider, provider_event_id, event_type, occurred_at, livemode, payload_sha256, projection)
       values ('stripe', 'evt_p4', 'x', now(), false, %L, jsonb_build_object('blob', repeat(md5('x'), 400)))$s$, sha));

  perform pg_temp.refuses('an error code that is a sentence',
    $s$update public.provider_event_inbox set status = 'failed', last_error_code = 'The card ending 4242 was declined' where provider_event_id = 'evt_2' and provider = 'stripe'$s$);
  perform pg_temp.refuses('applied with no applied time',
    $s$update public.provider_event_inbox set status = 'applied' where provider_event_id = 'evt_2' and provider = 'stripe'$s$);
  perform pg_temp.refuses('parked with no retry time',
    $s$update public.provider_event_inbox set status = 'parked' where provider_event_id = 'evt_2' and provider = 'stripe'$s$);

  -- ── A verified event is never rewritten ───────────────────────────────
  foreach p in array array[
    'provider = ''mock2''', 'provider_event_id = ''evt_changed''', 'event_type = ''other''',
    'occurred_at = occurred_at + interval ''1 day''', 'received_at = received_at + interval ''1 day''',
    'verified_at = verified_at + interval ''1 day''', 'livemode = true',
    'payload_sha256 = repeat(''b'', 64)', 'projection = ''{"x":1}''::jsonb'] loop
    perform pg_temp.refuses('rewriting an identity column: ' || p,
      'update public.provider_event_inbox set ' || p || ' where provider = ''stripe'' and provider_event_id = ''evt_2''', 'cannot be rewritten');
  end loop;

  -- ── Status moves along the listed steps ───────────────────────────────
  -- received → parked → failed? no: parked → dead_letter → received (replay) → failed → applied
  perform pg_temp.allows('received → parked, with a retry time',
    $s$update public.provider_event_inbox set status = 'parked', next_attempt_at = now() + interval '5 minutes', attempts = 1, last_error_code = 'subscription_not_ready' where provider = 'stripe' and provider_event_id = 'evt_2'$s$);
  perform pg_temp.allows('parked → parked (a retry that parks it again)',
    $s$update public.provider_event_inbox set next_attempt_at = now() + interval '10 minutes', attempts = 2 where provider = 'stripe' and provider_event_id = 'evt_2'$s$);
  perform pg_temp.refuses('parked → received',
    $s$update public.provider_event_inbox set status = 'received', next_attempt_at = null where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'cannot move from parked to received');
  perform pg_temp.refuses('attempts going down',
    $s$update public.provider_event_inbox set attempts = 1 where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'only go up');
  perform pg_temp.allows('parked → dead_letter',
    $s$update public.provider_event_inbox set status = 'dead_letter', next_attempt_at = null, attempts = 5, last_error_code = 'retries_exhausted' where provider = 'stripe' and provider_event_id = 'evt_2'$s$);
  perform pg_temp.refuses('dead_letter → applied (a replay goes through received)',
    $s$update public.provider_event_inbox set status = 'applied', applied_at = now() where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'cannot move from dead_letter to applied');
  perform pg_temp.allows('dead_letter → received (a replay)',
    $s$update public.provider_event_inbox set status = 'received' where provider = 'stripe' and provider_event_id = 'evt_2'$s$);
  perform pg_temp.refuses('received → dead_letter (it must fail or park first)',
    $s$update public.provider_event_inbox set status = 'dead_letter' where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'cannot move from received to dead_letter');
  perform pg_temp.allows('received → failed',
    $s$update public.provider_event_inbox set status = 'failed', attempts = 6, last_error_code = 'apply_failed' where provider = 'stripe' and provider_event_id = 'evt_2'$s$);
  perform pg_temp.allows('failed → applied, with its time',
    $s$update public.provider_event_inbox set status = 'applied', applied_at = now(), last_error_code = null where provider = 'stripe' and provider_event_id = 'evt_2'$s$);

  -- Applied is final.
  perform pg_temp.refuses('an applied event moving anywhere',
    $s$update public.provider_event_inbox set status = 'received', applied_at = null where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'final');
  perform pg_temp.refuses('an applied event gaining an error code',
    $s$update public.provider_event_inbox set last_error_code = 'late_error' where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'final');
  perform pg_temp.refuses('an applied event’s attempts changing',
    $s$update public.provider_event_inbox set attempts = attempts + 1 where provider = 'stripe' and provider_event_id = 'evt_2'$s$, 'final');

  -- received → applied directly is the common path.
  perform pg_temp.allows('received → applied',
    $s$update public.provider_event_inbox set status = 'applied', applied_at = now() where provider = 'stripe' and provider_event_id = 'evt_1'$s$);

  -- ── Nothing is deleted ────────────────────────────────────────────────
  perform pg_temp.refuses('deleting an applied event', $s$delete from public.provider_event_inbox where provider = 'stripe' and provider_event_id = 'evt_1'$s$, 'retention');
  perform pg_temp.refuses('deleting an unapplied event', $s$delete from public.provider_event_inbox where provider = 'mock'$s$, 'retention');
  select count(*) into n from public.provider_event_inbox;
  perform pg_temp.counted('every event is still there', n, 3);

  raise notice 'payment-inbox: every check passed';
end $$;

rollback;
