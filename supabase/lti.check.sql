-- The two tables an LTI launch runs on, and the four ways they are meant to
-- refuse.
--
-- Every other suite here is about what one account may read of another's. This
-- one is about forgery: `public.lti_platform` is the list of platforms this
-- tool believes, and `public.lti_nonce` is what stops a launch being replayed.
-- Neither is a table any client should touch in any way, so the assertions are
-- blunter than elsewhere — not "the right rows" but "no rows, and no call".
--
-- What this covers:
--
--   * A signed-out visitor and a signed-in account reach neither table, for
--     select, insert, update or delete. The publishable key is in the page
--     source of a static site, so `anon` is everybody.
--   * Neither function is callable by either role. `spend_lti_nonce` is the
--     replay guard; a client that could call it could spend somebody's launch.
--   * **The replay guard actually refuses a replay.** A state spends once and
--     returns the nonce; the second attempt returns nothing. This is the one
--     assertion in the file that would still matter if the grants were
--     perfect, and `CLAUDE.md` is the reason it is here rather than assumed: a
--     guard that has never been watched failing is not known to be a guard.
--   * Expiry and ignorance are refusals too, and they are separate rows in
--     this file because they are separate `and` clauses in the function and a
--     single test would pass with either one deleted.
--   * The deployment id is part of the key. One issuer with two deployments is
--     the ordinary case at a university with more than one Brightspace org,
--     and a tool that collapsed them would accept a launch from one into the
--     other's data.
--   * `https` on both URLs is a check constraint rather than a convention,
--     because these are the two addresses this tool redirects a student to and
--     fetches keys from.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', who::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

/*
 * Whether a role can do a thing at all, reported as a word rather than raised.
 *
 * A grant failure and a row-level-security refusal do not look alike: the
 * first raises `insufficient_privilege` and the second returns zero rows. Both
 * are passes here and the suite must not care which it got, or it would start
 * failing the day a policy is added to a table that is currently unreachable
 * for the other reason.
 */
create or replace function pg_temp.refused(sql text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  execute sql into n;
  return coalesce(n, 0) = 0;
exception when insufficient_privilege or undefined_table or undefined_function then
  return true;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- ── Seed, as the service role does ────────────────────────────────────────

insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url, name)
values
  ('https://brightspace.test.edu', 'client-one', 'deploy-a',
   'https://brightspace.test.edu/d2l/lti/authenticate',
   'https://brightspace.test.edu/d2l/.well-known/jwks', 'Test University'),
  ('https://brightspace.test.edu', 'client-one', 'deploy-b',
   'https://brightspace.test.edu/d2l/lti/authenticate',
   'https://brightspace.test.edu/d2l/.well-known/jwks', 'Test University — Law');

do $$
begin
  perform pg_temp.must(
    'one issuer and client can hold two deployments',
    (select count(*) from public.lti_platform
      where issuer = 'https://brightspace.test.edu' and client_id = 'client-one') = 2);
end $$;

-- ── http is refused by the database, not by the caller ────────────────────

do $$
declare took boolean := false;
begin
  begin
    insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url)
    values ('https://plain.test.edu', 'c', 'd',
            'http://plain.test.edu/auth', 'https://plain.test.edu/jwks');
    took := true;
  exception when check_violation then
    took := false;
  end;
  perform pg_temp.must('an http authentication URL is refused', not took);

  begin
    insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url)
    values ('https://plain.test.edu', 'c', 'd',
            'https://plain.test.edu/auth', 'http://plain.test.edu/jwks');
    took := true;
  exception when check_violation then
    took := false;
  end;
  perform pg_temp.must('an http JWKS URL is refused', not took);
end $$;

-- ── The token endpoint, which a launch does not need ──────────────────────

do $$
declare took boolean;
begin
  perform pg_temp.must(
    'a registration may have no token endpoint at all',
    (select token_url is null from public.lti_platform
      where issuer = 'https://brightspace.test.edu' and deployment_id = 'deploy-a'));

  update public.lti_platform
     set token_url = 'https://auth.brightspace.test/core/connect/token'
   where issuer = 'https://brightspace.test.edu' and deployment_id = 'deploy-a';

  perform pg_temp.must(
    'and an https one is recorded',
    (select token_url = 'https://auth.brightspace.test/core/connect/token'
       from public.lti_platform
      where issuer = 'https://brightspace.test.edu' and deployment_id = 'deploy-a'));

  /*
   * The sharpest of the three URL checks on this table. The other two are
   * places a student is sent or a public document is fetched; this is where a
   * *signed assertion* is posted, so a plain-http value would put the thing
   * that stands in for this tool's client secret on the wire in clear.
   */
  begin
    update public.lti_platform
       set token_url = 'http://auth.brightspace.test/core/connect/token'
     where issuer = 'https://brightspace.test.edu' and deployment_id = 'deploy-a';
    took := true;
  exception when check_violation then
    took := false;
  end;
  perform pg_temp.must('an http token endpoint is refused', not took);
end $$;

-- ── The replay guard ──────────────────────────────────────────────────────

insert into public.lti_nonce (state, nonce, issuer, client_id, expires_at)
values
  ('state-live',    'nonce-live',    'https://brightspace.test.edu', 'client-one', now() + interval '5 minutes'),
  ('state-expired', 'nonce-expired', 'https://brightspace.test.edu', 'client-one', now() - interval '1 minute');

do $$
declare got text;
begin
  select n.nonce into got from public.spend_lti_nonce('state-live') n;
  perform pg_temp.must('a live state spends once and returns its nonce', got = 'nonce-live');

  got := null;
  select n.nonce into got from public.spend_lti_nonce('state-live') n;
  perform pg_temp.must('and the same state spends a second time for nobody', got is null);

  got := null;
  select n.nonce into got from public.spend_lti_nonce('state-expired') n;
  perform pg_temp.must('an expired state is refused', got is null);

  got := null;
  select n.nonce into got from public.spend_lti_nonce('state-never-issued') n;
  perform pg_temp.must('a state we never issued is refused', got is null);
end $$;

-- The registration comes back from the store rather than from the token, so
-- the caller cannot be talked into checking a token against a registration the
-- token itself chose.
insert into public.lti_nonce (state, nonce, issuer, client_id, expires_at)
values ('state-two', 'nonce-two', 'https://brightspace.test.edu', 'client-one', now() + interval '5 minutes');

do $$
declare who record;
begin
  select * into who from public.spend_lti_nonce('state-two');
  perform pg_temp.must(
    'spending a state says which registration the login started from',
    who.issuer = 'https://brightspace.test.edu' and who.client_id = 'client-one');
end $$;

-- ── The sweep takes only what is already refused ──────────────────────────

do $$
declare gone integer;
begin
  insert into public.lti_nonce (state, nonce, issuer, client_id, expires_at)
  values ('state-ancient', 'n', 'https://brightspace.test.edu', 'client-one', now() - interval '2 hours');

  gone := public.sweep_lti_nonce();
  perform pg_temp.must('the sweep removes a state two hours past expiry', gone = 1);
  perform pg_temp.must(
    'and leaves one that expired a minute ago, which spend_lti_nonce already refuses',
    exists (select 1 from public.lti_nonce where state = 'state-expired'));
end $$;

-- ── A signed-out visitor reaches nothing ──────────────────────────────────

do $$
begin
  perform pg_temp.become_anon();

  perform pg_temp.must('anon reads no platform',
    pg_temp.refused('select count(*) from public.lti_platform'));
  perform pg_temp.must('anon reads no launch in flight',
    pg_temp.refused('select count(*) from public.lti_nonce'));

  perform pg_temp.must('anon cannot register a platform', pg_temp.refused($q$
    with w as (
      insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url)
      values ('https://evil.test', 'c', 'd', 'https://evil.test/a', 'https://evil.test/j')
      returning 1)
    select count(*) from w $q$));

  perform pg_temp.must('anon cannot un-spend a nonce', pg_temp.refused($q$
    with w as (update public.lti_nonce set spent_at = null returning 1)
    select count(*) from w $q$));

  perform pg_temp.must('anon cannot delete a platform', pg_temp.refused($q$
    with w as (delete from public.lti_platform returning 1) select count(*) from w $q$));

  perform pg_temp.must('anon cannot spend a launch',
    pg_temp.refused($q$select count(*) from public.spend_lti_nonce('state-live')$q$));
  perform pg_temp.must('anon cannot sweep',
    pg_temp.refused('select public.sweep_lti_nonce()'));
end $$;

reset role;

-- ── And neither does a signed-in account ──────────────────────────────────
--
-- Separate from the block above rather than a loop over two roles, because the
-- two roles get their grants by different routes — `anon` and `authenticated`
-- are both granted by name at creation *and* both inherit PUBLIC's — and a
-- loop would hide which spelling of the revoke was doing the work.

do $$
declare someone uuid := '00000000-0000-4000-8000-00000000117a';
begin
  perform pg_temp.become(someone);

  perform pg_temp.must('a signed-in account reads no platform',
    pg_temp.refused('select count(*) from public.lti_platform'));
  perform pg_temp.must('a signed-in account reads no launch in flight',
    pg_temp.refused('select count(*) from public.lti_nonce'));

  perform pg_temp.must('a signed-in account cannot register a platform', pg_temp.refused($q$
    with w as (
      insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url)
      values ('https://evil2.test', 'c', 'd', 'https://evil2.test/a', 'https://evil2.test/j')
      returning 1)
    select count(*) from w $q$));

  perform pg_temp.must('a signed-in account cannot spend a launch',
    pg_temp.refused($q$select count(*) from public.spend_lti_nonce('state-two')$q$));
  perform pg_temp.must('a signed-in account cannot sweep',
    pg_temp.refused('select public.sweep_lti_nonce()'));
end $$;

reset role;

rollback;
