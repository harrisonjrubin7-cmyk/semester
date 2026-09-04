-- Four people and two groups, without needing four people.
--
-- Everything in groups.sql that matters is a row-level policy, and a policy
-- can only be wrong in a way you notice when somebody else is involved: can a
-- classmate read a group's parts without joining, can a stranger to the class
-- see the group at all, can one member throw another out. Those questions
-- have never been answered because answering them meant four humans and an
-- afternoon.
--
-- Run classmates.sql and groups.sql first, then paste this file's CONTENTS
-- into the SQL Editor. It makes its own users, rolls everything back, and
-- leaves nothing behind.

begin;

do $$
declare
  ana  uuid := '11111111-1111-1111-1111-111111111111';
  ben  uuid := '22222222-2222-2222-2222-222222222222';
  cara uuid := '33333333-3333-3333-3333-333333333333';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (ana,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'g.ana.test@vanderbilt.edu',  now(), now(), now()),
    (ben,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'g.ben.test@vanderbilt.edu',  now(), now(), now()),
    (cara, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'g.cara.test@vanderbilt.edu', now(), now(), now())
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

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

-- Ana and Ben take BUS 1600. Cara takes something else.
do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ana')
    on conflict (user_id) do update set handle = 'ana';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'BUS 1600')
    on conflict do nothing;

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ben')
    on conflict (user_id) do update set handle = 'ben';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'BUS 1600')
    on conflict do nothing;

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'cara')
    on conflict (user_id) do update set handle = 'cara';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'ECON 1020')
    on conflict do nothing;
end $$;

-- ── Starting a group ──────────────────────────────────────────────────────

do $$
declare g uuid; n bigint;
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.groups (term, code, name, created_by)
  values ('2026FA', 'BUS 1600', 'Opera Philadelphia case', auth.uid())
  returning id into g;
  insert into public.group_members (group_id, user_id) values (g, auth.uid());

  select count(*) into n from public.groups;
  perform pg_temp.counted('you can start a group in a class you are in', n, 1);

  -- Ben is in the class, so he can see it exists and join it.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.groups;
  perform pg_temp.counted('a classmate can see the group exists', n, 1);

  -- Cara is not, so she cannot.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  select count(*) into n from public.groups;
  perform pg_temp.counted('somebody outside the class sees nothing', n, 0);
end $$;

do $$
begin
  -- Cara cannot start a group in a class she is not in either.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  begin
    insert into public.groups (term, code, name, created_by)
    values ('2026FA', 'BUS 1600', 'Sneaking in', auth.uid());
    raise exception 'FAILED: an outsider started a group in a class';
  exception
    when insufficient_privilege then
      raise notice 'ok  an outsider cannot start a group in a class';
  end;
end $$;

-- ── The parts need membership, not just the class ─────────────────────────

do $$
declare g uuid; n bigint;
begin
  -- Impersonate first, then read. `set local role` lasts for the transaction
  -- and this file is one transaction, so a block that reads before it becomes
  -- somebody is still reading as whoever the last block left behind.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select id into g from public.groups limit 1;

  insert into public.group_tasks (group_id, title, created_by)
  values (g, 'Market sizing', auth.uid()), (g, 'Financials', auth.uid());
  select count(*) into n from public.group_tasks;
  perform pg_temp.counted('a member sees the parts', n, 2);

  -- Ben is in the class and not in the group. The list is not his yet.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.group_tasks;
  perform pg_temp.counted('a classmate outside the group sees no parts', n, 0);

  begin
    insert into public.group_tasks (group_id, title, created_by)
    values (g, 'Uninvited', auth.uid());
    raise exception 'FAILED: a non-member added a part';
  exception
    when insufficient_privilege then
      raise notice 'ok  a non-member cannot add a part';
  end;

  -- Joining changes that, which is the whole point of a group being open to
  -- its class.
  insert into public.group_members (group_id, user_id) values (g, auth.uid());
  select count(*) into n from public.group_tasks;
  perform pg_temp.counted('joining makes the parts visible', n, 2);
end $$;

-- ── Any member may claim and tick; nobody may eject anybody ───────────────

do $$
declare g uuid; n bigint; who uuid;
begin
  -- Ben claims a part Ana wrote, which is what group work needs.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select id into g from public.groups limit 1;
  update public.group_tasks set owner = auth.uid() where group_id = g and title = 'Financials';
  select owner into who from public.group_tasks where title = 'Financials';
  perform pg_temp.counted('a member can claim a part somebody else wrote',
                          (case when who = '22222222-2222-2222-2222-222222222222' then 1 else 0 end), 1);

  update public.group_tasks set done = true where title = 'Financials';
  select count(*) into n from public.group_tasks where done;
  perform pg_temp.counted('and tick it', n, 1);

  -- Ben cannot remove Ana from the group.
  delete from public.group_members
   where group_id = g and user_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into n from public.group_members where group_id = g;
  perform pg_temp.counted('nobody can eject anybody from a group', n, 2);

  -- He can leave it himself.
  delete from public.group_members where group_id = g and user_id = auth.uid();
  select count(*) into n from public.group_members where group_id = g;
  perform pg_temp.counted('but you can leave one yourself', n, 1);

  -- And leaving takes the parts away again.
  select count(*) into n from public.group_tasks;
  perform pg_temp.counted('leaving closes the list behind you', n, 0);
end $$;

-- ── Only the starter may delete the group ─────────────────────────────────

do $$
declare g uuid; n bigint;
begin
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select id into g from public.groups limit 1;
  delete from public.groups where id = g;
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.groups where id = g;
  perform pg_temp.counted('somebody who did not start it cannot delete it', n, 1);

  delete from public.groups where id = g;
  select count(*) into n from public.groups where id = g;
  perform pg_temp.counted('the person who started it can', n, 0);
end $$;

reset role;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

rollback;
