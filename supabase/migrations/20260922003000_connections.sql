-- A connection is a fact two people agreed on, and neither can assert alone.
--
-- `MVP-GAP.md` measured §48's launch standard against the app and found seven
-- of seventeen steps with no implementation at all, contiguous, steps 6–13.
-- Two of them are this file: *send a connection request* and *have another
-- account accept it*. Its first structural finding says why the gap matters
-- more than the count does:
--
--   > Today one student sees another **only** through a course room … A
--   > connection request and an acceptance are a different shape from a shared
--   > room, and the Campus Graph in §51 needs the edge to exist as a row.
--
-- §47.4 is what the row is for: a profile prints *"3 mutual connections"*, and
-- there is nothing to count until an edge exists.
--
-- ## Why one row and not two
--
-- A connection is symmetric — §47.5 offers *Connect* and *Remove connection*,
-- not follow and unfollow, and a mutual count is meaningless if the edge has a
-- direction. Two mirrored rows would make that symmetry something the writer
-- maintains, and the failure is the one that cannot be seen from either side:
-- a half-deleted pair where A is connected to B and B is not connected to A.
--
-- So it is one row, and *who asked* is kept because it is the only thing the
-- two ends do not share. `requester` and `addressee` are a direction through
-- the handshake, not through the friendship: once `state` is `accepted` every
-- read treats the pair as unordered, which is what {@link public.connected_with}
-- exists to make impossible to get wrong at a call site.
--
-- ## The reverse request is an acceptance, not a second row
--
-- If B has asked A and A then asks B, the ordinary shape is two pending rows
-- that each wait for the other. `request_connection` looks for the reverse
-- first and accepts it, because two people who have both asked have already
-- agreed — and because the alternative is a unique key on an unordered pair,
-- which cannot be written without losing who asked.
--
-- ## Blocking outranks it, in both directions
--
-- `20260901000200_classmates.sql` created `public.blocks`, and a block that
-- stopped messages but not connection requests would be a block that does not
-- work: a request is a notification with a name attached. Checked both ways
-- round, because a blocked account asking is the obvious case and the account
-- that did the blocking asking is the one that would otherwise reopen the
-- conversation it closed.
--
-- ## Nobody writes this table
--
-- Both API roles are revoked outright and there is no write policy, which is
-- the shape `public.app_admins` and `public.role_grants` use and for the
-- reason `20260921143455_forms.sql` paid for: Supabase's default privileges
-- grant ALL on every new relation in `public` to `anon` and `authenticated`,
-- so a table that merely omits a policy is a table with row-level security
-- deciding writes it should never have been offered.
--
-- The three definer functions below are the only way in. Each one is a rule
-- that cannot be expressed as a policy on a client INSERT: *the reverse of
-- this row may already exist*, *the other account may have blocked you*, *only
-- the addressee may accept*.

create table if not exists public.connections (
  requester    uuid        not null references auth.users on delete cascade,
  addressee    uuid        not null references auth.users on delete cascade,
  state        text        not null default 'pending'
                           check (state in ('pending', 'accepted')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester, addressee),
  constraint no_self_connection check (requester <> addressee),
  -- A pending row has not been answered and an accepted one has. Stated as a
  -- constraint because `responded_at` is what a roster would sort by, and a
  -- pending row carrying one would sort as though somebody had agreed.
  constraint responded_when_accepted check (
    (state = 'pending'   and responded_at is null) or
    (state = 'accepted'  and responded_at is not null)
  )
);

alter table public.connections enable row level security;

-- The outer lock. See the header: a new relation in `public` starts with ALL
-- granted to both API roles on a Supabase project, so this is the line that
-- makes the definer functions the only way in rather than the polite way in.
revoke all on table public.connections from anon, authenticated;

-- The inner lock. Reading is yours when you are one of the two ends; there is
-- no write policy at all, deliberately, so that removing the revoke above
-- fails the suite rather than silently opening the table.
drop policy if exists "a connection is readable by its two ends" on public.connections;
create policy "a connection is readable by its two ends" on public.connections
  for select
  using ((select auth.uid()) in (requester, addressee));

-- `requester` is the primary key's first column and is covered by it.
-- `addressee` is covered by nothing, and every read that matters —  your
-- pending requests, your roster, a mutual count — arrives from that side.
create index if not exists connections_addressee_idx
  on public.connections (addressee);

comment on table public.connections is
  'An agreed connection between two accounts, or a request for one. Written only through request_connection, accept_connection and remove_connection.';

/*
 * Are these two connected? The one question every caller actually has.
 *
 * Unordered on purpose: a caller that had to know which of the two asked
 * would be a caller that gets it wrong half the time, and every one of them
 * would have to write the same `or` around the pair.
 *
 * `security definer` because the policy above is scoped to the two ends, and
 * a mutual count asks about pairs the caller is not in.
 */
create or replace function public.connected_with(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
     where c.state = 'accepted'
       and ((c.requester = (select auth.uid()) and c.addressee = who)
         or (c.requester = who and c.addressee = (select auth.uid())))
  );
$$;

/*
 * How many people you are both connected to — §47.4's "3 mutual connections".
 *
 * Counted rather than listed, because the line on a profile is a count and a
 * list would be the other account's roster leaking through a function that
 * only owes a number.
 */
create or replace function public.mutual_connections(who uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with ours as (
    select case when c.requester = (select auth.uid()) then c.addressee else c.requester end as other
      from public.connections c
     where c.state = 'accepted'
       and (select auth.uid()) in (c.requester, c.addressee)
  ), theirs as (
    select case when c.requester = who then c.addressee else c.requester end as other
      from public.connections c
     where c.state = 'accepted'
       and who in (c.requester, c.addressee)
  )
  select count(*)::integer
    from ours
    join theirs using (other)
   where ours.other not in ((select auth.uid()), who);
$$;

/*
 * Ask somebody to connect.
 *
 * Every refusal here is a rule a policy on an INSERT could not have expressed,
 * which is the argument for the table being closed and this being the door.
 */
create or replace function public.request_connection(who uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'sign in to connect' using errcode = 'insufficient_privilege';
  end if;

  if who is null or who = me then
    raise exception 'a connection needs two accounts' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from auth.users u where u.id = who) then
    raise exception 'no such account' using errcode = 'foreign_key_violation';
  end if;

  -- Both ways round. See the header: the account that did the blocking asking
  -- is the case that would otherwise reopen the conversation it closed.
  if exists (
    select 1 from public.blocks b
     where (b.user_id = me and b.blocked = who)
        or (b.user_id = who and b.blocked = me)
  ) then
    raise exception 'that account cannot be connected to' using errcode = 'insufficient_privilege';
  end if;

  -- They asked first: two people who have both asked have already agreed.
  update public.connections
     set state = 'accepted', responded_at = now()
   where requester = who and addressee = me and state = 'pending';
  if found then
    return 'accepted';
  end if;

  if exists (
    select 1 from public.connections c
     where (c.requester = me and c.addressee = who)
        or (c.requester = who and c.addressee = me)
  ) then
    return 'already';
  end if;

  insert into public.connections (requester, addressee) values (me, who);
  return 'requested';
end;
$$;

/*
 * Accept a request somebody sent you. Only the addressee may.
 *
 * The rule the name carries: `where addressee = me` is the whole authorization,
 * and it is inside the statement rather than in a branch above it so that a
 * request you did not receive matches no row instead of raising — the caller
 * gets `false` and learns nothing about whether it exists.
 */
create or replace function public.accept_connection(who uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'sign in to connect' using errcode = 'insufficient_privilege';
  end if;

  update public.connections
     set state = 'accepted', responded_at = now()
   where requester = who and addressee = me and state = 'pending';

  return found;
end;
$$;

/*
 * Remove a connection, or withdraw a request, or refuse one.
 *
 * One function for all three because they are one row and the difference is
 * only which end you are and what state it is in — and because a student who
 * wants somebody gone should not have to know which of the three words the app
 * used when it drew the button.
 */
create or replace function public.remove_connection(who uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'sign in to connect' using errcode = 'insufficient_privilege';
  end if;

  delete from public.connections
   where (requester = me and addressee = who)
      or (requester = who and addressee = me);

  return found;
end;
$$;

-- ── Who may call these ────────────────────────────────────────────────────
--
-- `20260921144011_function_grants.sql` carries the reasoning and
-- `grants.check.sql` enforces it: Supabase's default privileges grant EXECUTE
-- on every new function in `public` to `anon` and `authenticated`, so a
-- `security definer` function that says nothing about grants is a definer
-- function every visitor to the site can call — and `anon` is the role the
-- publishable key maps to, which is in the page source of a static site.
--
-- All five are signed-in operations. A signed-out visitor has no `auth.uid()`
-- to be one end of a connection, so there is nothing here for `anon` to be
-- refused politely: it is refused by not holding the grant.
revoke all on function public.connected_with(uuid)      from public, anon;
revoke all on function public.mutual_connections(uuid)  from public, anon;
revoke all on function public.request_connection(uuid)  from public, anon;
revoke all on function public.accept_connection(uuid)   from public, anon;
revoke all on function public.remove_connection(uuid)   from public, anon;

grant execute on function public.connected_with(uuid)     to authenticated;
grant execute on function public.mutual_connections(uuid) to authenticated;
grant execute on function public.request_connection(uuid) to authenticated;
grant execute on function public.accept_connection(uuid)  to authenticated;
grant execute on function public.remove_connection(uuid)  to authenticated;
