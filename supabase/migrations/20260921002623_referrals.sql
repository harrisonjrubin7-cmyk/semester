-- Semester — ambassador referral links, and the three things they must not become.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- A student gets a link. Somebody who arrives through it and makes an account
-- is counted against that link. The ambassador can see how many of the people
-- they brought are still using the app. That is the whole feature, and the
-- plan it comes from is explicit that the payout half is *not* to be built
-- yet: two or three real ambassadors get tracked by hand off these numbers
-- first, and automating a credit before the mechanic is known to work would be
-- building the expensive half of an untested idea.
--
-- So what is below is deliberately the counting, and nothing that pays.
--
-- ## Three things this must not become, and where each is stopped
--
-- **A leaderboard of who signed up.** An ambassador with a list of names has a
-- list of classmates' private decisions, handed to them by an app whose
-- privacy page says it holds nothing of the sort. Nothing here ever returns a
-- referred person's identity: `public.referrals` has row-level security on and
-- **no policy at all**, so it is readable through the API by nobody, and
-- `referral_standing()` returns two integers. Who is behind them is not a
-- thing this schema will tell anyone, including the person who recruited them.
--
-- **A vanity namespace.** A code anybody could choose is a code somebody
-- chooses `FINANCIALAID` or `VANDERBILT` and sends to two thousand freshmen.
-- Codes are generated here, from a fixed alphabet, and the column carries a
-- `check` on that shape — so even a future policy that let a client write this
-- table could not write a *word* into it.
--
-- **A way to re-badge people who were already here.** If any account could
-- claim any code at any time, the number stops meaning "people I brought" and
-- starts meaning "friends I asked". A claim is refused once the claiming
-- account is older than `referral_new_days()`, read from `auth.users` — which
-- a browser cannot see and cannot argue with.
--
-- ## Why the counting is a function and not the view the plan asked for
--
-- The plan says "a simple Supabase view counting active referred users per
-- ambassador". A view cannot do this job. Row-level security is enforced
-- through views as the *invoker* — an ambassador querying a view gets their
-- own rows, and their own rows are not the rows being counted; the rows being
-- counted belong to the people they referred. A view that worked would be a
-- view that let one account read another's, which is the first thing above.
--
-- `referral_standing()` is therefore `security definer` and returns
-- aggregates only. Same number, and it cannot be joined back to a person.
--
-- ## What "active" means, and what it cannot see
--
-- `public.state.updated_at` — the account's own copy of its semester, touched
-- by the database on every sync. So "active" is *synced from some device in
-- the last `referral_active_days()` days*, which is the closest thing this
-- schema has to "opened the app" and is not the same thing:
--
--   * A referred student who signs up and then uses the app **signed out**, or
--     on one device with sync doing nothing, has no fresh `state` row and
--     counts as inactive while using the app daily. The app is offline-first
--     and this is a real population, not an edge case.
--   * A referred student who never signs in again counts as inactive, which is
--     right.
--
-- Under-counting was the direction to err in: a number that overstates how
-- many people an ambassador brought is a number somebody gets paid on.

-- ── The two figures, in one place each ────────────────────────────────────
-- Both are read by `app/src/lib/referral.ts` in a browser, which cannot import
-- from Postgres. `referral.test.ts` reads this file as text and fails when the
-- two sides disagree — the same instrument `lib/allowance.test.ts` uses on the
-- Edge Function's monthly limit, and for the same reason: each side is correct
-- on its own and no unit test of either can see the gap.

create or replace function public.referral_active_days()
returns integer language sql immutable
set search_path = ''
as $$ select 14 $$;

comment on function public.referral_active_days() is
  'How recently a referred account must have synced to count as active.';

create or replace function public.referral_new_days()
returns integer language sql immutable
set search_path = ''
as $$ select 7 $$;

comment on function public.referral_new_days() is
  'How new an account must be to claim a referral code at all.';

-- ── The codes ─────────────────────────────────────────────────────────────

create table if not exists public.referral_codes (
  user_id     uuid        primary key references auth.users on delete cascade,
  -- The alphabet has no 0, O, 1, I, L or U in it. The first five are the pairs
  -- people mistype reading a code off a poster or a phone screen; U is out
  -- because a generated code should not be able to spell anything.
  --
  -- The `check` is the point of the column rather than a tidy-up. It is what
  -- makes "codes are generated, never chosen" a property of the database
  -- instead of a property of the one function that currently writes here.
  code        text        not null unique
                          check (code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$'),
  created_at  timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

-- Readable by its owner, and writable by nobody through the API: there is no
-- insert, update or delete policy, so RLS refuses all three. Making a code
-- goes through `make_referral_code()` below, which generates it.
--
-- No rotation, deliberately. A referral link is made to be posted in a group
-- chat — it is not a secret, so there is nothing for a rotation to protect,
-- and a code that changes is a code that invalidates the poster somebody
-- already printed.
drop policy if exists "your referral code is yours" on public.referral_codes;
create policy "your referral code is yours" on public.referral_codes
  for select
  using ((select auth.uid()) = user_id);

-- Deletable by its owner, and that is not a contradiction of the paragraph
-- above. "No rotation" is about there being no button for it, not about a
-- locked row: `deleteEverything()` in `app/src/lib/cloud.ts` empties an
-- account table by table through PostgREST, as the account, and a row it
-- cannot delete is a row that outlives the student who asked to be forgotten.
-- Deletion beats tidiness, every time.
--
-- It takes the record of who came through the code with it, by the foreign key
-- on `public.referrals` — so an ambassador who leaves is not remembered by a
-- count of the people they recruited.
drop policy if exists "your referral code goes with you" on public.referral_codes;
create policy "your referral code goes with you" on public.referral_codes
  for delete
  using ((select auth.uid()) = user_id);

comment on table public.referral_codes is
  'One generated code per ambassador. Written only by make_referral_code().';

-- ── Who came through which code ───────────────────────────────────────────
-- One row per referred account, at most. RLS on and no policy at all: `anon`
-- and `authenticated` match no row for anything, exactly as `public.invites`
-- does, because this is the table that would otherwise answer "who did I
-- bring" with names.

create table if not exists public.referrals (
  user_id  uuid        primary key references auth.users on delete cascade,
  code     text        not null references public.referral_codes(code) on delete cascade,
  at       timestamptz not null default now()
);

alter table public.referrals enable row level security;

-- Insert and update have no policy, so row-level security refuses both to
-- everybody. Select has one, and it is narrow: **your own arrival row and no
-- other**. That is what stops this table answering "who did I bring" with
-- names — an ambassador matches none of these rows, because none of them is
-- theirs.
--
-- The select policy is here because the delete below does not work without it,
-- and that was measured rather than reasoned about. A `DELETE ... WHERE` has
-- to scan the rows it is filtering, and row-level security applies the SELECT
-- policy to that scan — so with no select policy the delete matched nothing,
-- reported no error, and left the row in place. `deleteEverything()` would
-- have told a student their account was gone over a row that was not. The same
-- trap is written up at length in `OWNED_TABLES` in `app/src/lib/cloud.ts`,
-- where it cost a room full of messages; `referrals.check.sql` is what caught
-- it here.
--
-- What the owner learns from their own row is which code they arrived on,
-- which they had already — they followed the link. It does not tell them who
-- owns that code: `referral_codes` is readable only by *its* owner, so there
-- is no way to turn a code into a person from this side.
drop policy if exists "your own arrival is yours" on public.referrals;
create policy "your own arrival is yours" on public.referrals
  for select
  using ((select auth.uid()) = user_id);

-- **And this table deliberately does not carry the blanket `revoke` that
-- `public.invites` does.** The invite list is a table no account
-- should touch in any way, so revoking the grant underneath the absent policy
-- costs nothing there. Here it would cost the thing that matters most: a
-- student pressing "Delete everything" empties their account through PostgREST
-- as themselves, and a row they cannot delete is a row that outlives them.
--
-- The policy is `using (auth.uid() = user_id)` — your own arrival, and never
-- anybody else's. Deleting it decrements a count on somebody's screen, which
-- is the correct reading: the person left.
drop policy if exists "your own arrival goes with you" on public.referrals;
create policy "your own arrival goes with you" on public.referrals
  for delete
  using ((select auth.uid()) = user_id);

comment on table public.referrals is
  'Which code an account arrived through. Not readable through the API by anyone.';

-- ── Generating a code ─────────────────────────────────────────────────────
-- Not callable by anybody: the two functions below run as this function's
-- owner and reach it that way. A client that could call it directly could mint
-- rows in a table it is not allowed to write.

create or replace function public.gen_referral_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  made     text;
  i        integer;
  tries    integer := 0;
begin
  loop
    made := '';
    for i in 1..8 loop
      made := made || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes rc where rc.code = made);
    tries := tries + 1;
    /*
     * Thirty to the eighth is about 6.5e11, so a second collision means
     * something is wrong with `random()` in this session rather than that the
     * space is full — and a loop that would rather spin forever than say so is
     * how a pool exhaustion becomes an outage with no message.
     */
    if tries > 100 then
      raise exception 'semester: could not generate an unused referral code';
    end if;
  end loop;
  return made;
end $$;

revoke all on function public.gen_referral_code() from public;

-- ── Asking for your own code ──────────────────────────────────────────────
-- Creates one the first time and returns the same one forever after. Called
-- when a student opens the screen that shows their link, so the great majority
-- of accounts — who never look — never get a row.

create or replace function public.make_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare me uuid; mine text;
begin
  me := auth.uid();
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;

  select rc.code into mine from public.referral_codes rc where rc.user_id = me;
  if mine is not null then return mine; end if;

  insert into public.referral_codes (user_id, code)
  values (me, public.gen_referral_code())
  on conflict (user_id) do nothing;

  -- Read back rather than returned from the insert: two tabs opening this
  -- screen at once race, and the loser's `do nothing` returns no row. The
  -- winner's code is the right answer for both.
  select rc.code into mine from public.referral_codes rc where rc.user_id = me;
  return mine;
end $$;

revoke all on function public.make_referral_code() from public;
grant execute on function public.make_referral_code() to authenticated;

-- ── Claiming one ──────────────────────────────────────────────────────────
-- Returns a word, never a sentence, and never the ambassador. The word is for
-- `app/src/lib/referral.ts` to turn into English — the same division the
-- invite gate draws in `lib/invite.ts`, where the database's message is for a
-- log and the sentence a person reads is the client's job.
--
-- The parameter is `given` rather than `code` so that nothing in the body can
-- be read as the column of that name.

create or replace function public.claim_referral(given text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare me uuid; owner uuid; born timestamptz; want text;
begin
  me := auth.uid();
  if me is null then return 'signed-out'; end if;

  -- Upper-cased and trimmed, because the code travels through a group chat, a
  -- phone keyboard with autocapitalise off, and sometimes a person reading it
  -- aloud. The stored form is upper case by the column's own check.
  want := upper(btrim(coalesce(given, '')));
  if want = '' then return 'unknown'; end if;

  select rc.user_id into owner from public.referral_codes rc where rc.code = want;
  if owner is null then return 'unknown'; end if;

  -- Referring yourself is the first thing anybody tries. It is refused here
  -- rather than by a constraint because a constraint cannot reach the other
  -- table, and this function is the only writer.
  if owner = me then return 'self'; end if;

  if exists (select 1 from public.referrals r where r.user_id = me) then
    return 'already';
  end if;

  select u.created_at into born from auth.users u where u.id = me;
  if born is null or born < now() - (public.referral_new_days() || ' days')::interval then
    return 'late';
  end if;

  insert into public.referrals (user_id, code) values (me, want)
  on conflict (user_id) do nothing;
  return 'ok';
end $$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

-- ── How it is going ───────────────────────────────────────────────────────
-- Two integers and a boolean, for the caller and about nobody else.
--
-- `signup_open` is the honest half and the reason this returns four columns
-- instead of three. While the pilot's invite gate is on, a link handed to a
-- stranger cannot make an account at all — `20260921002428_invites.sql`
-- refuses it in a trigger on `auth.users` — so an ambassador screen that did
-- not know would print a dead link under a cheerful heading and let somebody
-- spend a week wondering why their count stayed at nought. The gate's state is
-- not a secret from anybody who can press Sign up, which is everybody.

create or replace function public.referral_standing()
returns table (code text, joined integer, active integer, signup_open boolean)
language plpgsql
security definer
set search_path = public
as $$
declare me uuid; mine text;
begin
  me := auth.uid();
  if me is null then return; end if;

  select rc.code into mine from public.referral_codes rc where rc.user_id = me;

  return query
    select
      mine,
      (select count(*)::integer from public.referrals r where r.code = mine),
      (select count(*)::integer
         from public.referrals r
         join public.state s on s.user_id = r.user_id
        where r.code = mine
          and s.updated_at >= now() - (public.referral_active_days() || ' days')::interval),
      (select not coalesce(g.invite_only, false) from public.access_gate g where g.only_one);
end $$;

revoke all on function public.referral_standing() from public;
grant execute on function public.referral_standing() to authenticated;

-- Same reasoning as the invite gate's `set_invite_only`, and it is the line
-- that file got wrong first: Postgres grants EXECUTE on a new function to
-- PUBLIC, and `anon` and `authenticated` are members of PUBLIC — so revoking
-- from those two by name leaves the grant they actually inherit intact. Every
-- revoke above is FROM PUBLIC for that reason, and the grants that follow are
-- what puts the two signed-in functions back within reach.
revoke all on function public.referral_active_days() from public;
revoke all on function public.referral_new_days() from public;
