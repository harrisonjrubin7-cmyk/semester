-- Does `20260922003000_connections.sql` do what it says?
--
-- Run this AFTER the migrations. Open the Supabase SQL Editor, paste this
-- file's CONTENTS — not its path — and run. It makes its own users and rolls
-- the whole thing back at the end, so it leaves nothing behind and is safe
-- against a project with real data.
--
-- What it covers:
--
--   * **Both locks, each with the other out of the way.** The table is revoked
--     from both API roles *and* has no write policy. A suite that only proved
--     the refusal would go green on the revoke alone and keep passing if the
--     missing write policy were replaced by a permissive one — the failure the
--     two-lock method exists to prevent, and the one `#703` recorded finding in
--     its own first draft.
--   * **Both shapes of refusal**, because they are not the same thing. Where
--     the privilege is missing the statement *raises* (`42501`). Where the
--     privilege is there and the policy matches no row it *succeeds and moves
--     nothing* — so those are asserted on `row_count`, not on an exception.
--   * The handshake: only the addressee accepts, a reverse request is an
--     acceptance rather than a second row, and a block refuses in both
--     directions.
--   * `connected_with` is unordered, and `mutual_connections` counts the
--     people two accounts share without listing anybody.

begin;

-- ── Four accounts ─────────────────────────────────────────────────────────

do $$
declare
  ana  uuid := 'c0000000-0000-0000-0000-000000000001';
  ben  uuid := 'c0000000-0000-0000-0000-000000000002';
  cara uuid := 'c0000000-0000-0000-0000-000000000003';
  dan  uuid := 'c0000000-0000-0000-0000-000000000004';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (ana,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c.ana.test@vanderbilt.edu',  now(), now(), now()),
    (ben,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c.ben.test@vanderbilt.edu',  now(), now(), now()),
    (cara, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c.cara.test@vanderbilt.edu', now(), now(), now()),
    (dan,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c.dan.test@vanderbilt.edu',  now(), now(), now())
  on conflict (id) do nothing;
end $$;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', null, true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- ── The outer lock: neither API role holds a privilege on the table ────────

do $$
begin
  set local role postgres;

  perform pg_temp.said('a signed-out visitor holds no select on connections',
    has_table_privilege('anon', 'public.connections', 'select')::text, 'false');
  perform pg_temp.said('nor any insert',
    has_table_privilege('anon', 'public.connections', 'insert')::text, 'false');

  perform pg_temp.said('an ordinary account holds no select either',
    has_table_privilege('authenticated', 'public.connections', 'select')::text, 'false');
  perform pg_temp.said('nor insert',
    has_table_privilege('authenticated', 'public.connections', 'insert')::text, 'false');
  perform pg_temp.said('nor update',
    has_table_privilege('authenticated', 'public.connections', 'update')::text, 'false');
  perform pg_temp.said('nor delete',
    has_table_privilege('authenticated', 'public.connections', 'delete')::text, 'false');
end $$;

-- ── The inner lock: no write policy, proved with the outer lock lifted ─────
--
-- The revoke above would hide a missing write policy for ever. So the grant is
-- put back inside this block, the write is attempted as an ordinary account,
-- and the row count is what is asserted — a policy that matches nothing lets
-- the statement succeed and move nothing, which no exception test can see.

do $$
declare
  ana uuid := 'c0000000-0000-0000-0000-000000000001';
  ben uuid := 'c0000000-0000-0000-0000-000000000002';
  n   bigint;
begin
  set local role postgres;
  insert into public.connections (requester, addressee) values (ana, ben);
  grant select, insert, update, delete on public.connections to authenticated;

  perform pg_temp.become(ana);

  update public.connections set state = 'accepted', responded_at = now()
   where requester = ana;
  get diagnostics n = row_count;
  perform pg_temp.counted('with the grant restored, no write policy matches an update', n, 0);

  delete from public.connections where requester = ana;
  get diagnostics n = row_count;
  perform pg_temp.counted('nor a delete', n, 0);

  begin
    insert into public.connections (requester, addressee) values (ana, ben);
    raise exception 'FAILED: an account inserted a connection directly';
  exception when insufficient_privilege then
    raise notice 'ok  an insert is refused by the missing policy even with the grant back';
  end;

  set local role postgres;
  revoke all on table public.connections from authenticated;
  delete from public.connections;
end $$;

-- ── Reading is yours when you are one of the two ends ──────────────────────

do $$
declare
  ana  uuid := 'c0000000-0000-0000-0000-000000000001';
  ben  uuid := 'c0000000-0000-0000-0000-000000000002';
  cara uuid := 'c0000000-0000-0000-0000-000000000003';
  n    bigint;
begin
  set local role postgres;
  insert into public.connections (requester, addressee) values (ana, ben);
  -- Granted to *both* roles on purpose. The outer lock is asserted above; this
  -- block is about the policy, and leaving `anon` without the grant would make
  -- its zero a fact about the privilege rather than about the `using` clause.
  grant select on public.connections to anon, authenticated;

  perform pg_temp.become(ana);
  select count(*) into n from public.connections;
  perform pg_temp.counted('the requester reads their own row', n, 1);

  perform pg_temp.become(ben);
  select count(*) into n from public.connections;
  perform pg_temp.counted('and so does the addressee', n, 1);

  -- The control. Without it every count above passes against `using (true)`.
  perform pg_temp.become(cara);
  select count(*) into n from public.connections;
  perform pg_temp.counted('and somebody who is neither reads none of it', n, 0);

  perform pg_temp.become_anon();
  select count(*) into n from public.connections;
  perform pg_temp.counted('nor does a signed-out visitor', n, 0);

  set local role postgres;
  revoke all on table public.connections from anon, authenticated;
  delete from public.connections;
end $$;

-- ── The handshake ─────────────────────────────────────────────────────────

do $$
declare
  ana  uuid := 'c0000000-0000-0000-0000-000000000001';
  ben  uuid := 'c0000000-0000-0000-0000-000000000002';
  cara uuid := 'c0000000-0000-0000-0000-000000000003';
  n    bigint;
  word text;
  did  boolean;
begin
  perform pg_temp.become(ana);
  select public.request_connection(ben) into word;
  perform pg_temp.said('asking somebody creates a request', word, 'requested');

  select public.connected_with(ben) into did;
  perform pg_temp.said('a pending request is not a connection', did::text, 'false');

  -- Only the addressee accepts. The requester accepting their own request is
  -- the shape that would make a connection a thing one person can assert.
  perform pg_temp.become(ana);
  select public.accept_connection(ben) into did;
  perform pg_temp.said('the requester cannot accept their own request', did::text, 'false');

  perform pg_temp.become(cara);
  select public.accept_connection(ana) into did;
  perform pg_temp.said('and a bystander cannot accept it either', did::text, 'false');

  perform pg_temp.become(ben);
  select public.accept_connection(ana) into did;
  perform pg_temp.said('the addressee can', did::text, 'true');

  select public.connected_with(ana) into did;
  perform pg_temp.said('and now they are connected', did::text, 'true');

  perform pg_temp.become(ana);
  select public.connected_with(ben) into did;
  perform pg_temp.said('read from the other end too, because it is unordered', did::text, 'true');

  set local role postgres;
  select count(*) into n from public.connections;
  perform pg_temp.counted('one agreement is one row', n, 1);

  delete from public.connections;
end $$;

-- ── A reverse request is an acceptance, not a second row ───────────────────

do $$
declare
  ana  uuid := 'c0000000-0000-0000-0000-000000000001';
  ben  uuid := 'c0000000-0000-0000-0000-000000000002';
  n    bigint;
  word text;
  did  boolean;
begin
  perform pg_temp.become(ben);
  perform public.request_connection(ana);

  perform pg_temp.become(ana);
  select public.request_connection(ben) into word;
  perform pg_temp.said('asking somebody who already asked you accepts it', word, 'accepted');

  select public.connected_with(ben) into did;
  perform pg_temp.said('and they are connected', did::text, 'true');

  set local role postgres;
  select count(*) into n from public.connections;
  perform pg_temp.counted('still one row, not two facing each other', n, 1);

  delete from public.connections;
end $$;

-- ── Asking twice, and asking somebody you are already connected to ─────────

do $$
declare
  ana  uuid := 'c0000000-0000-0000-0000-000000000001';
  ben  uuid := 'c0000000-0000-0000-0000-000000000002';
  n    bigint;
  word text;
begin
  perform pg_temp.become(ana);
  perform public.request_connection(ben);
  select public.request_connection(ben) into word;
  perform pg_temp.said('asking twice says so rather than raising', word, 'already');

  set local role postgres;
  select count(*) into n from public.connections;
  perform pg_temp.counted('and adds no row', n, 1);

  delete from public.connections;
end $$;

-- ── A block refuses a request, both ways round ────────────────────────────

do $$
declare
  ana uuid := 'c0000000-0000-0000-0000-000000000001';
  ben uuid := 'c0000000-0000-0000-0000-000000000002';
begin
  perform pg_temp.become(ben);
  insert into public.blocks (user_id, blocked) values (ben, ana);

  perform pg_temp.become(ana);
  begin
    perform public.request_connection(ben);
    raise exception 'FAILED: a blocked account sent a connection request';
  exception when insufficient_privilege then
    raise notice 'ok  somebody who has been blocked cannot ask';
  end;

  -- The other direction, which is the one that would otherwise let the account
  -- that closed the conversation reopen it.
  perform pg_temp.become(ben);
  begin
    perform public.request_connection(ana);
    raise exception 'FAILED: an account that blocked somebody asked them to connect';
  exception when insufficient_privilege then
    raise notice 'ok  and the account that did the blocking cannot ask either';
  end;

  set local role postgres;
  delete from public.blocks;
  delete from public.connections;
end $$;

-- ── Removing, from either end ─────────────────────────────────────────────

do $$
declare
  ana uuid := 'c0000000-0000-0000-0000-000000000001';
  ben uuid := 'c0000000-0000-0000-0000-000000000002';
  n   bigint;
  did boolean;
begin
  perform pg_temp.become(ana);
  perform public.request_connection(ben);
  perform pg_temp.become(ben);
  perform public.accept_connection(ana);

  -- The end that did not ask removes it, which is the harder of the two.
  perform pg_temp.become(ben);
  select public.remove_connection(ana) into did;
  perform pg_temp.said('either end can remove a connection', did::text, 'true');

  set local role postgres;
  select count(*) into n from public.connections;
  perform pg_temp.counted('and the row is gone', n, 0);

  -- Removing something that is not there is false rather than an exception:
  -- the caller learns nothing about whether it existed.
  perform pg_temp.become(ben);
  select public.remove_connection(ana) into did;
  perform pg_temp.said('removing nothing says so quietly', did::text, 'false');
end $$;

-- ── Mutual connections ────────────────────────────────────────────────────

do $$
declare
  ana  uuid := 'c0000000-0000-0000-0000-000000000001';
  ben  uuid := 'c0000000-0000-0000-0000-000000000002';
  cara uuid := 'c0000000-0000-0000-0000-000000000003';
  dan  uuid := 'c0000000-0000-0000-0000-000000000004';
  n    integer;
begin
  set local role postgres;
  insert into public.connections (requester, addressee, state, responded_at) values
    (ana,  cara, 'accepted', now()),
    (ben,  cara, 'accepted', now()),
    (ana,  dan,  'accepted', now()),
    (ben,  dan,  'accepted', now()),
    (ana,  ben,  'pending',  null);

  perform pg_temp.become(ana);
  select public.mutual_connections(ben) into n;
  perform pg_temp.counted('two people both connected to Cara and Dan share two', n::bigint, 2);

  -- The control: a pending edge is not a connection, so it cannot be mutual.
  set local role postgres;
  update public.connections set state = 'pending', responded_at = null
   where requester = ben and addressee = dan;

  perform pg_temp.become(ana);
  select public.mutual_connections(ben) into n;
  perform pg_temp.counted('and a pending edge counts for nobody', n::bigint, 1);

  set local role postgres;
  delete from public.connections;
end $$;

-- ── The shape of the row itself ───────────────────────────────────────────

do $$
declare
  ana uuid := 'c0000000-0000-0000-0000-000000000001';
begin
  set local role postgres;

  begin
    insert into public.connections (requester, addressee) values (ana, ana);
    raise exception 'FAILED: an account connected to itself';
  exception when check_violation then
    raise notice 'ok  an account cannot connect to itself';
  end;

  -- A pending row carrying a response time would sort as though somebody had
  -- agreed. See the constraint's own comment.
  begin
    insert into public.connections (requester, addressee, state, responded_at)
    values (ana, 'c0000000-0000-0000-0000-000000000002', 'pending', now());
    raise exception 'FAILED: a pending request recorded a response';
  exception when check_violation then
    raise notice 'ok  a pending request cannot carry a response time';
  end;

  begin
    insert into public.connections (requester, addressee, state)
    values (ana, 'c0000000-0000-0000-0000-000000000002', 'befriended');
    raise exception 'FAILED: an unknown state was accepted';
  exception when check_violation then
    raise notice 'ok  and the state vocabulary is closed';
  end;
end $$;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

rollback;
