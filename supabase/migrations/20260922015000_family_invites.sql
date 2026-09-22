-- Semester — the code a student hands to a parent, and what claiming it makes.
--
-- Run this after schema.sql, in the Supabase dashboard: SQL Editor → New
-- query → paste → Run. It is safe to run again; every statement is guarded.
--
-- ## The gap this closes
--
-- `20260921161500_roles.sql` created `public.family_grants` — `FamilyGrant`
-- from `packages/institution`, column for column, with the live test from
-- `allowsFamilyRequest` as its row policy. Nothing has been able to write one
-- since, and nothing reads it: `grep family_grants app/src` finds one line, in
-- `OWNED_TABLES`, saying where its rows would go if there were any.
--
-- The reason is a chicken and egg in the column list. A grant names its
-- `recipient_id`, `not null references auth.users`, and a student wanting to
-- share a bill with a parent does not know their parent's account id — the
-- parent usually has no account at all yet. Somebody has to go first, and the
-- grant row cannot be it.
--
-- So: a code goes first. The student chooses the categories, gets eight
-- characters, and sends them however they like. The grant comes into being
-- when the code is claimed, by whoever claims it, and not before.
--
-- ## Why the invite is its own table and not a nullable column
--
-- Making `family_grants.recipient_id` nullable would have been fewer lines and
-- would have put a row in that table meaning "nobody yet". Every policy on it
-- reads that column, `allowsFamilyRequest` requires it, and the check
-- constraint `student_id <> recipient_id` has nothing to compare — so each of
-- those would need a null branch, and a null branch in an authorization
-- predicate is the half-computed answer that file refuses to have.
--
-- An unclaimed invite is a different thing from an unaccepted grant, and this
-- keeps them different. `family_grants` still means what it meant: two named
-- accounts, and a consent field.
--
-- ## Claiming is accepting
--
-- `family_grants.accepted_at` is null until the recipient accepts, because a
-- grant nobody accepted is not one. A claimed code is that acceptance: the
-- student consented when they chose the categories and generated it, and the
-- parent consented by entering it. There is nothing left to ask either of
-- them, so `claim_family_invite` writes `accepted_at` and the grant is live.
--
-- What is *pending*, and what the student's screen lists, is the invite that
-- has not been claimed yet — not a grant in a waiting state.

-- ── The invites ───────────────────────────────────────────────────────────

create table if not exists public.family_invites (
  -- The same alphabet as `referral_codes`, and for the same reason: no 0, O,
  -- 1, I, L or U, because these are read down a phone. The check is the point
  -- of the column rather than a tidy-up — it makes "codes are generated, never
  -- chosen" a property of the database instead of of the one function that
  -- writes here.
  code           text        primary key
                             check (code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$'),
  student_id     uuid        not null references auth.users on delete cascade,
  institution_id text        not null check (length(trim(institution_id)) between 1 and 120),
  -- What the code is worth once claimed. One invite can carry several
  -- categories, and becomes one grant row per category — the shape
  -- `family_grants` is in, where a grant is per category.
  --
  -- Non-empty, because the spec has every scope box off by default and an
  -- invite granting nothing is a code that does nothing when claimed. The
  -- student has to tick something before there is anything to send.
  categories     text[]      not null check (
                               cardinality(categories) between 1 and 10
                               and categories <@ array[
                                 'finances', 'aid', 'housing', 'calendar', 'academic',
                                 'emergency', 'travel', 'health-admin', 'career',
                                 'communication']::text[]),
  access         text        not null check (access in ('selected', 'view', 'payment')),
  -- A category alone grants nothing, so the named things travel with the code.
  resource_ids   text[]      not null default '{}',
  -- What the *grant* will expire at, carried so the student sets it once.
  grant_expires_at timestamptz not null,
  -- What the *code* expires at, which is a different and much shorter thing.
  -- An unclaimed code is a bearer token sitting in somebody's messages; a
  -- grant is a relationship. Defaulted rather than asked for, because nobody
  -- opening this screen has an opinion about it and the safe answer is short.
  expires_at     timestamptz not null default now() + interval '14 days',
  created_at     timestamptz not null default now(),
  -- Set when claimed. A code is single use: the second claim finds this
  -- already set and is refused.
  claimed_at     timestamptz,
  claimed_by     uuid        references auth.users on delete set null,
  revoked_at     timestamptz,

  -- Claimed means both, never one. A row with a claimant and no time on it,
  -- or a time and no claimant, is a half-written claim and nothing should
  -- have to decide what it means.
  constraint family_invites_claim_is_whole
    check ((claimed_at is null) = (claimed_by is null))
);

alter table public.family_invites enable row level security;

create index if not exists family_invites_by_student on public.family_invites (student_id);
-- `claimed_by` is a foreign key the cascade will follow — deleting an account
-- has to prove no invite names it — and `supabase/indexes.check.sql` is the
-- guard that said so within a minute of this table existing. Null for every
-- unclaimed row, which is most of them, so the index stays small.
create index if not exists family_invites_by_claimant on public.family_invites (claimed_by);

comment on table public.family_invites is
  'A code a student generates to share chosen categories. Becomes family_grants rows when claimed.';

-- The student's own invites, in whatever state. This is the "pending links"
-- list and the thing a one-click revoke acts on, so a revoked and a claimed
-- one both have to stay readable — a code somebody cannot see is one they
-- cannot tell they revoked.
drop policy if exists "your invites are yours" on public.family_invites;
create policy "your invites are yours" on public.family_invites
  for select
  using ((select auth.uid()) = student_id);

-- Revoking, and nothing else. No insert policy: a code is minted by
-- `make_family_invite` below, never written by a client, which is what keeps
-- the alphabet check from being the only thing standing between a student and
-- a code of their own choosing.
drop policy if exists "you call off your own invites" on public.family_invites;
create policy "you call off your own invites" on public.family_invites
  for update
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- `deleteEverything()` in `app/src/lib/cloud.ts` empties an account table by
-- table through PostgREST, as the account, so a row it cannot delete is a row
-- that outlives the student who asked to be forgotten.
drop policy if exists "your invites go with you" on public.family_invites;
create policy "your invites go with you" on public.family_invites
  for delete
  using ((select auth.uid()) = student_id);

-- **No select policy for the claimant, deliberately.** A person holding a code
-- learns what it is worth by claiming it, through the function below, which
-- tells them. Letting them read the row first would turn an eight-character
-- code into a lookup for somebody else's chosen categories, their resource
-- ids and which student issued it — readable by anybody who can guess eight
-- characters, without ever claiming and so without leaving a `claimed_by`.

-- ── Minting one ───────────────────────────────────────────────────────────
-- `private`, not callable from a client: the two functions below reach it as
-- their owner. A client that could call it directly could mint rows in a table
-- with no insert policy.

create or replace function private.gen_family_code()
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
    exit when not exists (select 1 from public.family_invites fi where fi.code = made);
    tries := tries + 1;
    -- Thirty to the eighth is about 6.5e11. A hundred collisions means
    -- `random()` is wrong in this session, not that the space is full, and a
    -- loop that spins forever rather than saying so is how that becomes an
    -- outage with no message.
    if tries > 100 then
      raise exception 'semester: could not generate an unused family code';
    end if;
  end loop;
  return made;
end $$;

revoke all on function private.gen_family_code() from public, anon, authenticated;

create or replace function public.make_family_invite(
  want_categories text[],
  want_access text,
  want_resources text[] default '{}',
  want_days integer default 90
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  made text;
  home text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  -- The same gate the insert policy on `family_grants` applies, applied here
  -- because this function is what will be writing those rows later.
  if not private.verified_student() then
    raise exception 'semester: not a confirmed account' using errcode = 'insufficient_privilege';
  end if;
  if want_categories is null or cardinality(want_categories) = 0 then
    raise exception 'semester: choose at least one thing to share'
      using errcode = 'check_violation';
  end if;
  if want_days is null or want_days < 1 or want_days > 400 then
    raise exception 'semester: an expiry between 1 and 400 days'
      using errcode = 'check_violation';
  end if;

  -- The student's own school, read here rather than taken from the caller: an
  -- institution id that arrived from a browser is a request, never an
  -- authority. Falls back to the default the profile row carries.
  select coalesce(p.school_id, 'vanderbilt') into home
    from public.profiles p where p.user_id = me;

  made := private.gen_family_code();
  insert into public.family_invites
    (code, student_id, institution_id, categories, access, resource_ids, grant_expires_at)
  values (made, me, coalesce(home, 'vanderbilt'), want_categories, want_access,
          coalesce(want_resources, '{}'), now() + make_interval(days => want_days));
  return made;
end $$;

revoke all on function public.make_family_invite(text[], text, text[], integer)
  from public, anon, authenticated;
grant execute on function public.make_family_invite(text[], text, text[], integer) to authenticated;

comment on function public.make_family_invite(text[], text, text[], integer) is
  'Mint a share code for the chosen categories. The only way a family_invites row is created.';

-- ── Claiming one ──────────────────────────────────────────────────────────
--
-- Returns a word, never a sentence: `claimed`, `unknown`, `expired`, `taken`,
-- `yourself`, or `revoked`. The same division `claim_referral` draws — the
-- database's word is for a log, and the sentence a person reads is the
-- client's job.
--
-- **`unknown` covers a code that does not exist, one that has lapsed and one
-- that was called off**, and that is deliberate on the second and third: a
-- distinct answer for "that code was real" is an oracle for guessing eight
-- characters, told to somebody who by definition holds no valid code.

create or replace function public.claim_family_invite(given text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  inv public.family_invites%rowtype;
  cat text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into inv from public.family_invites fi
   where fi.code = upper(btrim(given)) for update;

  if not found then return 'unknown'; end if;
  if inv.revoked_at is not null then return 'unknown'; end if;
  if inv.expires_at <= now() then return 'unknown'; end if;
  if inv.claimed_at is not null then return 'taken'; end if;
  -- A student claiming their own code would make a grant from somebody to
  -- themselves, which `family_grants_two_parties` refuses anyway — answered
  -- here so the refusal is a word rather than an exception.
  if inv.student_id = me then return 'yourself'; end if;

  update public.family_invites
     set claimed_at = now(), claimed_by = me
   where code = inv.code;

  -- One grant per category, born accepted: the student consented by choosing
  -- the categories and minting the code, and the claimant consented by
  -- entering it. There is nobody left to ask, which is why this writes
  -- `accepted_at` where the insert policy on `family_grants` forbids it — that
  -- policy governs a student writing a row about somebody who has not agreed,
  -- and this is the other case.
  foreach cat in array inv.categories loop
    insert into public.family_grants
      (institution_id, student_id, recipient_id, category, access,
       resource_ids, accepted_at, expires_at)
    values (inv.institution_id, inv.student_id, me, cat, inv.access,
            inv.resource_ids, now(), inv.grant_expires_at);
  end loop;

  return 'claimed';
end $$;

revoke all on function public.claim_family_invite(text) from public, anon, authenticated;
grant execute on function public.claim_family_invite(text) to authenticated;

comment on function public.claim_family_invite(text) is
  'Claim a share code. Writes one accepted family_grants row per category it carries.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.claim_family_invite(text);
--   drop function if exists public.make_family_invite(text[], text, text[], integer);
--   drop function if exists private.gen_family_code();
--   drop table if exists public.family_invites;
--   commit;
--
-- Grants already written are left alone on purpose: they are consented
-- relationships between two accounts and do not stop being that because the
-- table that introduced them is gone.
