-- Referral links: what an ambassador may learn, and what they may not.
--
-- The feature is two integers on a screen, and almost everything that can go
-- wrong with it is a privacy failure rather than an arithmetic one. So most of
-- what follows is about reading: who can see `public.referrals`, what
-- `referral_standing()` is willing to say, and whether one ambassador's
-- numbers can be made to include another's.
--
-- What this covers:
--
--   * A code is generated on first ask, is the same one on every ask after,
--     and matches the alphabet the column's `check` demands. Two accounts get
--     two different codes.
--   * `referral_codes` is readable by its owner and by nobody else, and is
--     writable through the API by nobody at all — including its owner, who
--     cannot choose their own code.
--   * `public.referrals` is readable by nobody: not the referred account, not
--     the ambassador who recruited them, not a signed-out visitor.
--   * Claiming works once, for a new account, on a code that exists and is not
--     your own — and each of those four refusals returns its own word.
--   * "Active" means synced inside the window, and the three populations that
--     are not active — stale, never-synced, and gone — each count as nought.
--   * One ambassador's standing never includes another's referrals.
--   * `signup_open` follows the pilot's invite gate, which is the difference
--     between a working link and a link that cannot make an account at all.
--   * None of the three functions is callable by a signed-out visitor.
--
-- ## What these checks are indifferent to, and why
--
-- Mutating the migration proves which line each check holds, and twenty were
-- run against this file as it stands. **Nineteen are caught:** dropping
-- row-level security on either table, widening or removing the arrival
-- table's select policy, widening or removing its delete policy, removing the
-- code table's delete policy, adding an insert or an update policy to the code
-- table, widening the code column's `check` to accept any text, removing the
-- self-referral refusal, removing the second-claim refusal, removing the age
-- guard, dropping `upper()` from the claim, counting every code's referrals in
-- `joined` or in `active`, dropping the activity window, hard-coding
-- `signup_open` true, and revoking the function grants from `anon` and
-- `authenticated` by name instead of from PUBLIC.
--
-- Two of those nineteen were misses on the first sweep, and both were one
-- fault rather than two: the block that meant to test "nobody may write a
-- code" wrote a *word* into a row that *already existed*, and accepted any
-- error as proof. What it proved was that a primary key stops a duplicate.
-- Both defences it named — the column's shape check and the absent insert
-- policy — could be deleted from the migration with this suite still green.
-- They are now two separate checks, each on an account with no code row, each
-- accepting only the one error that means what it says.
--
-- ## The one that is not caught, and why that is the true answer
--
-- **Widening the code table's delete policy to `using (true)` changes
-- nothing**, and that was measured rather than assumed: the mutation was run
-- and the suite stayed green with a check in it that deletes another account's
-- code and expects to remove nothing.
--
-- The reason is the same mechanism that decided the select policy two tables
-- up. A `DELETE ... WHERE` has to scan the rows it filters, and row-level
-- security applies the SELECT policy to that scan — so an account can only
-- delete code rows it can *read*, which is its own, whatever the delete policy
-- says. The confinement is the select policy, and the check is right to be
-- indifferent to a line that is not doing the work.
--
-- That cuts both ways and it is why it is written down here rather than left
-- as a quiet pass. On `public.referrals` the *absence* of a select policy did
-- not harden the delete — it broke it, silently, in the direction that
-- matters: the delete matched nothing, raised nothing, and `deleteEverything()`
-- would have told a student their account was gone over a row still sitting in
-- the table. Same rule, opposite consequence, and only one of the two is
-- visible without running it.
--
-- One further mutation is deliberately unstaged. **The collision loop's
-- `tries > 100` ceiling** needs a broken `random()` to reach, which no check
-- here can arrange without making the test about the arrangement.
--
--   How to run it: supabase/check.sh referrals

begin;

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
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

/**
 * An account, optionally one that has been here a while.
 *
 * `born` is the whole reason this exists rather than a plain insert: the age
 * guard in `claim_referral` reads `auth.users.created_at`, and a suite that
 * could only make accounts dated now could not test it at all.
 */
create or replace function pg_temp.newuser(address text, born timestamptz default now())
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), born, now());
  return who;
end $$;

/**
 * A synced copy of a semester, as of some moment.
 *
 * The trigger has to come off for the one statement, and finding that out is
 * why this is a function rather than two lines inline. `state_touch` fires
 * before insert *and* before update and sets `updated_at` to `now()`, which is
 * correct in production — sync decides which side is newer by comparing these,
 * and a device's clock may be wrong, so the database writes the time itself.
 * It also means a backdated row cannot be written through it at all: the first
 * version of this helper updated the column and the trigger quietly put it
 * back, so the account that had not synced for a fortnight read as active and
 * the suite agreed with a bug it was written to catch.
 */
create or replace function pg_temp.synced(who uuid, whenish timestamptz)
returns void language plpgsql as $$
begin
  insert into public.state (user_id, data) values (who, '{}'::jsonb)
    on conflict (user_id) do nothing;
  alter table public.state disable trigger state_touch;
  update public.state set updated_at = whenish where user_id = who;
  alter table public.state enable trigger state_touch;
end $$;

-- ── A code is generated, and it is the same one tomorrow ──────────────────

do $$
declare amb uuid; first text; again text; other uuid; theirs text;
begin
  reset role;
  amb := pg_temp.newuser('ambassador.test@example.edu');
  other := pg_temp.newuser('second.ambassador.test@example.edu');

  perform pg_temp.become(amb);
  first := public.make_referral_code();
  if first !~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$' then
    raise exception 'FAILED: a generated code does not match the alphabet: %', first;
  end if;
  raise notice 'ok  a code is generated from the unambiguous alphabet (%)', first;

  again := public.make_referral_code();
  perform pg_temp.said('asking twice returns the same code', again, first);
  reset role;

  perform pg_temp.become(other);
  theirs := public.make_referral_code();
  if theirs = first then
    raise exception 'FAILED: two accounts were given the same code';
  end if;
  raise notice 'ok  a second account gets a different code';
  reset role;
end $$;

-- ── The code table: yours to read, nobody's to write ──────────────────────
--
-- Two different defences, and the first version of this block tested neither.
-- It tried to write `FREEFOOD` into the ambassador's own row, which already
-- existed, and accepted any error at all as proof — so what it actually proved
-- was that a primary key stops a second row for the same account. Adding an
-- insert policy to the migration left it green. Both halves below now use an
-- account with no code row and a string of the right shape, and each accepts
-- only the one error that means what the check says it means.

do $$
declare amb uuid; fresh uuid; n bigint;
begin
  reset role;
  select rc.user_id into amb from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';
  fresh := pg_temp.newuser('nocode.test@example.edu');

  -- The column, tested as the owner so that row-level security is explicitly
  -- not what is being asked about. This is the line that makes "codes are
  -- generated, never chosen" a property of the database rather than a property
  -- of the one function that happens to write here today — a code anybody
  -- could pick is a code somebody picks `FINANCIALAID` and sends to two
  -- thousand freshmen.
  begin
    insert into public.referral_codes (user_id, code) values (fresh, 'FREEFOOD');
    raise exception 'FAILED: a word was written into the code column';
  exception
    when check_violation then
      raise notice 'ok  the column itself refuses a code that is a word';
  end;

  perform pg_temp.become(amb);
  select count(*) into n from public.referral_codes;
  perform pg_temp.counted('an ambassador sees their own code row and no other', n, 1);
  reset role;

  -- And the policy. `QQQQQQQQ` is a shape the column accepts, on an account
  -- with no row, so the only thing left to refuse it is row-level security.
  perform pg_temp.become(fresh);
  begin
    insert into public.referral_codes (user_id, code) values (fresh, 'QQQQQQQQ');
    raise exception 'FAILED: an account wrote its own referral code';
  exception
    when insufficient_privilege then
      raise notice 'ok  an account cannot choose its own code';
  end;
  reset role;

  perform pg_temp.become(amb);
  update public.referral_codes set code = 'QQQQQQQQ' where user_id = amb;
  if found then
    raise exception 'FAILED: an account rewrote its own referral code';
  end if;
  raise notice 'ok  an account cannot rewrite its code';

  reset role;

  -- Another account's code is not yours to remove, and removing one would take
  -- that ambassador's whole record with it through the cascade.
  perform pg_temp.become(fresh);
  delete from public.referral_codes where user_id = amb;
  if found then
    raise exception 'FAILED: an account deleted another''s referral code';
  end if;
  raise notice 'ok  an account cannot delete another''s code';
  reset role;

  perform pg_temp.become_anon();
  select count(*) into n from public.referral_codes;
  perform pg_temp.counted('a signed-out visitor sees no codes', n, 0);
  reset role;
end $$;

-- ── Claiming ──────────────────────────────────────────────────────────────

do $$
declare amb uuid; code text; joiner uuid; got text;
begin
  reset role;
  select rc.user_id, rc.code into amb, code from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';

  -- The ambassador themselves.
  perform pg_temp.become(amb);
  got := public.claim_referral(code);
  perform pg_temp.said('referring yourself is refused', got, 'self');
  reset role;

  joiner := pg_temp.newuser('joiner.test@example.edu');
  perform pg_temp.become(joiner);

  got := public.claim_referral('ZZZZZZZZ');
  perform pg_temp.said('a code nobody holds is refused', got, 'unknown');

  got := public.claim_referral('');
  perform pg_temp.said('an empty code is refused', got, 'unknown');

  -- Lower case with spaces round it, which is what arrives from a group chat
  -- and a phone keyboard.
  got := public.claim_referral('  ' || lower(code) || ' ');
  perform pg_temp.said('a code typed in lower case still lands', got, 'ok');

  got := public.claim_referral(code);
  perform pg_temp.said('claiming a second time is refused', got, 'already');
  reset role;
end $$;

-- ── An account that has been here a while cannot be re-badged ─────────────

do $$
declare amb uuid; code text; oldtimer uuid; got text; n bigint;
begin
  reset role;
  select rc.code into code from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';

  oldtimer := pg_temp.newuser('oldtimer.test@example.edu',
                              now() - (public.referral_new_days() + 1 || ' days')::interval);
  perform pg_temp.become(oldtimer);
  got := public.claim_referral(code);
  perform pg_temp.said('an account older than the window is refused', got, 'late');
  reset role;

  select count(*) into n from public.referrals r where r.user_id = oldtimer;
  perform pg_temp.counted('and nothing was written for it', n, 0);
end $$;

-- ── Who came through is readable by nobody ────────────────────────────────

do $$
declare amb uuid; joiner uuid; n bigint;
begin
  reset role;
  select rc.user_id into amb from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';
  select id into joiner from auth.users where email = 'joiner.test@example.edu';

  -- The row exists. This is the control: every count below is nought, and a
  -- suite that never proved there was something to hide would pass just as
  -- well against a feature that never wrote anything down.
  select count(*) into n from public.referrals;
  perform pg_temp.counted('the claim was recorded', n, 1);

  perform pg_temp.become(amb);
  select count(*) into n from public.referrals;
  perform pg_temp.counted('the ambassador cannot read who they brought', n, 0);
  reset role;

  -- Its own row, and only ever that one. This is the narrowest read on the
  -- table and it exists because the delete below needs it; what it discloses
  -- is the code they followed, which they already had.
  perform pg_temp.become(joiner);
  select count(*) into n from public.referrals;
  perform pg_temp.counted('the referred account reads its own row and no other', n, 1);
  select count(*) into n from public.referrals r where r.user_id <> joiner;
  perform pg_temp.counted('and none of anybody else''s', n, 0);
  reset role;

  perform pg_temp.become_anon();
  select count(*) into n from public.referrals;
  perform pg_temp.counted('a signed-out visitor cannot read any of it', n, 0);
  reset role;
end $$;

-- ── The numbers ───────────────────────────────────────────────────────────

do $$
declare amb uuid; other uuid; joiner uuid; stale uuid; never uuid;
        code text; row_ record;
begin
  reset role;
  select rc.user_id, rc.code into amb, code from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';
  select id into joiner from auth.users where email = 'joiner.test@example.edu';
  select id into other from auth.users where email = 'second.ambassador.test@example.edu';

  -- One who synced yesterday, one who synced last term, one who never synced.
  perform pg_temp.synced(joiner, now() - interval '1 day');

  stale := pg_temp.newuser('stale.test@example.edu');
  perform pg_temp.become(stale);
  perform public.claim_referral(code);
  reset role;
  perform pg_temp.synced(stale, now() - (public.referral_active_days() + 1 || ' days')::interval);

  never := pg_temp.newuser('never.test@example.edu');
  perform pg_temp.become(never);
  perform public.claim_referral(code);
  reset role;

  perform pg_temp.become(amb);
  select * into row_ from public.referral_standing();
  perform pg_temp.said('standing names the ambassador''s own code', row_.code, code);
  perform pg_temp.counted('three accounts joined through it', row_.joined, 3);
  perform pg_temp.counted('one of them synced inside the window', row_.active, 1);
  reset role;

  -- The other ambassador has a code and nobody behind it. If this ever reads
  -- three, the counting has stopped being per-code.
  perform pg_temp.become(other);
  select * into row_ from public.referral_standing();
  perform pg_temp.counted('another ambassador''s standing counts none of it', row_.joined, 0);
  perform pg_temp.counted('and none of them active', row_.active, 0);
  reset role;

  -- An account that never asked for a code has no code and no numbers, rather
  -- than no row: a screen that got nothing back could not tell that apart from
  -- a failed request.
  perform pg_temp.become(joiner);
  select * into row_ from public.referral_standing();
  if row_.code is not null then
    raise exception 'FAILED: an account that never asked for a code has one';
  end if;
  perform pg_temp.counted('an account with no code still gets a standing', row_.joined, 0);
  reset role;
end $$;

-- ── What "delete everything" can reach ────────────────────────────────────
--
-- `deleteEverything()` empties an account table by table through PostgREST, as
-- the account and under row-level security — it cannot delete the `auth.users`
-- row, so the cascades the block below relies on never fire on that path. Both
-- of these tables therefore have to be deletable by their owner, and the
-- question this block answers by measurement rather than by reasoning is
-- whether a delete works on a table its owner cannot *select* from.

do $$
declare joiner uuid; n bigint; amb uuid; mycode text;
begin
  reset role;
  select rc.user_id, rc.code into amb, mycode from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';
  select id into joiner from auth.users where email = 'joiner.test@example.edu';

  perform pg_temp.become(joiner);
  -- The check that sent the select policy into the migration. Without one this
  -- delete matched nothing and raised nothing: row-level security applies the
  -- SELECT policy to the scan a `DELETE ... WHERE` performs, so "delete
  -- everything" would have reported success over a row still sitting there.
  delete from public.referrals where user_id = joiner;
  if not found then
    raise exception 'FAILED: an account could not delete its own arrival row';
  end if;
  raise notice 'ok  an account can delete its own arrival row it cannot read';
  reset role;

  select count(*) into n from public.referrals r where r.user_id = joiner;
  perform pg_temp.counted('and it is gone', n, 0);

  -- Somebody else's arrival is not theirs to remove, and removing one would
  -- edit another student's count. An unfiltered delete is the shape that would
  -- do it, so that is the one to try.
  perform pg_temp.become(joiner);
  delete from public.referrals;
  reset role;
  select count(*) into n from public.referrals r where r.code = mycode;
  perform pg_temp.counted('and cannot delete anybody else''s', n, 2);

  perform pg_temp.become(amb);
  delete from public.referral_codes where user_id = amb;
  if not found then
    raise exception 'FAILED: an account could not delete its own referral code';
  end if;
  raise notice 'ok  an account can delete its own code';
  reset role;

  -- The cascade, on the path a student actually takes. Everyone who came
  -- through the code goes with it.
  select count(*) into n from public.referrals;
  perform pg_temp.counted('and the record of who came through goes with it', n, 0);

  -- Put it back for the block below, which deletes the account instead.
  perform pg_temp.become(amb);
  perform public.make_referral_code();
  reset role;
end $$;

-- ── Deleting an account takes its referrals with it ───────────────────────

do $$
declare amb uuid; n bigint;
begin
  reset role;
  select rc.user_id into amb from public.referral_codes rc
    join auth.users u on u.id = rc.user_id
   where u.email = 'ambassador.test@example.edu';

  delete from auth.users where id = amb;

  select count(*) into n from public.referral_codes where user_id = amb;
  perform pg_temp.counted('the code goes with the account', n, 0);

  -- Through the code's own foreign key rather than through the referred
  -- accounts, which still exist. An ambassador who leaves takes the record of
  -- who they recruited with them.
  select count(*) into n from public.referrals;
  perform pg_temp.counted('and so does the record of who came through it', n, 0);
end $$;

-- ── The gate the link depends on ──────────────────────────────────────────

do $$
declare who uuid; row_ record;
begin
  reset role;
  who := pg_temp.newuser('gatewatch.test@example.edu');
  perform pg_temp.become(who);
  perform public.make_referral_code();

  select * into row_ from public.referral_standing();
  if not row_.signup_open then
    raise exception 'FAILED: the gate is off and the link was reported as closed';
  end if;
  raise notice 'ok  with the pilot gate off, a link can make accounts';
  reset role;

  perform public.set_invite_only(true);
  perform pg_temp.become(who);
  select * into row_ from public.referral_standing();
  if row_.signup_open then
    raise exception 'FAILED: invite-only is on and the link was reported as working';
  end if;
  raise notice 'ok  with it on, the screen can say the link cannot make an account';
  reset role;
  perform public.set_invite_only(false);
end $$;

-- ── None of it is reachable signed out ────────────────────────────────────

do $$
declare got text;
begin
  reset role;
  perform pg_temp.become_anon();

  begin
    got := public.make_referral_code();
    raise exception 'FAILED: a signed-out visitor minted a referral code';
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor cannot mint a code';
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'FAILED:%' then raise; end if;
      raise notice 'ok  a signed-out visitor cannot mint a code (%)', sqlstate;
  end;

  begin
    got := public.claim_referral('ABCDEFGH');
    raise exception 'FAILED: a signed-out visitor claimed a referral';
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor cannot claim';
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'FAILED:%' then raise; end if;
      raise notice 'ok  a signed-out visitor cannot claim (%)', sqlstate;
  end;

  begin
    perform * from public.referral_standing();
    raise exception 'FAILED: a signed-out visitor read a standing';
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor cannot read a standing';
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'FAILED:%' then raise; end if;
      raise notice 'ok  a signed-out visitor cannot read a standing (%)', sqlstate;
  end;
  reset role;
end $$;

rollback;
