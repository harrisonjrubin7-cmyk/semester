-- Semester — an invite list for the pilot, enforced where it cannot be skipped.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- ## Why this is a trigger on auth.users and not a check in the app
--
-- The obvious place to put an allow-list is in front of the sign-up form, and
-- it is worthless there. The key this app carries is publishable by design —
-- `20260901000100_schema.sql` opens by saying so — which means anybody who can
-- read the page can call the auth endpoint directly and never see the form at
-- all. A client-side allow-list keeps out people who were not trying to get
-- in.
--
-- So it lives on `auth.users`, before insert. That covers every way an account
-- can come into being at once: email and password, the confirmation link, and
-- Google, Apple and Microsoft — which is worth stating because the OAuth
-- routes are exactly the ones a client-side check forgets, since no form of
-- ours is involved in them.
--
-- ## Why it is off until somebody turns it on
--
-- `ROLLBACK.md` says every migration must leave the database readable by the
-- app version that was live before it, because the schema does not roll back.
-- A migration that switched invite-only on as it landed would break every new
-- sign-up the moment it was applied, and the only way out would be another
-- manual change to a live database during an incident.
--
-- The state is therefore explicit and starts off. It is deliberately *not*
-- inferred from the list being empty: "empty means everybody" makes an
-- accidental `delete from invites` silently disable the gate, and "empty means
-- nobody" makes applying this migration lock the world out. Neither should be
-- something that happens without a person deciding it.
--
--   select public.set_invite_only(true);   -- the pilot starts
--   select public.set_invite_only(false);  -- it opens up
--
-- ## What this does not do
--
-- It does not touch accounts that already exist. The trigger is `before
-- insert`, so everybody already signed in stays signed in, invited or not, and
-- turning the gate on mid-pilot does not evict anybody. Removing somebody's
-- access after the fact is a different operation on a different table and is
-- not this.

-- ── The list ──────────────────────────────────────────────────────────────
-- A list of people's email addresses, so it is readable by nobody through the
-- API. RLS is on and there is deliberately no policy at all: `anon` and
-- `authenticated` match no row, for select or anything else. The trigger below
-- reads it as `security definer`, and a human reads it in the dashboard.

create table if not exists public.invites (
  email       text        primary key,
  invited_at  timestamptz not null default now(),
  note        text
);

alter table public.invites enable row level security;

-- Belt and braces beside the absent policy. A future `grant all on all tables`
-- — which `check.sh` itself performs, imitating Supabase's defaults — would
-- otherwise hand this table to the anon role, and RLS with no policy is what
-- actually stops it. Both, because either alone is one edit from open.
revoke all on public.invites from anon, authenticated;

comment on table public.invites is
  'Who may create an account while invite-only is on. Lower-cased emails. Not readable through the API.';

-- ── The switch ────────────────────────────────────────────────────────────
-- One row, one boolean, and no policy — same reasoning as the list.

create table if not exists public.access_gate (
  only_one    boolean     primary key default true check (only_one),
  invite_only boolean     not null default false,
  changed_at  timestamptz not null default now()
);

alter table public.access_gate enable row level security;
revoke all on public.access_gate from anon, authenticated;

insert into public.access_gate (only_one, invite_only) values (true, false)
  on conflict (only_one) do nothing;

comment on table public.access_gate is
  'One row. Whether an account can only be created by somebody on the invite list.';

create or replace function public.set_invite_only(on_off boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into public.access_gate (only_one, invite_only, changed_at)
  values (true, on_off, now())
  on conflict (only_one) do update set invite_only = excluded.invite_only, changed_at = now()
  returning invite_only;
$$;

/*
 * From PUBLIC, and that is the whole of the fix rather than a tidier spelling.
 *
 * Postgres grants EXECUTE on a new function to PUBLIC by default, and `anon`
 * and `authenticated` are members of PUBLIC — so revoking from those two by
 * name left the grant they actually inherit completely intact. The first
 * version of this line did exactly that, and `invites.check.sql` caught it: a
 * signed-out visitor holding nothing but the publishable key could call this
 * and turn the gate off.
 *
 * It matters more here than almost anywhere else in this schema, because this
 * is a `security definer` function: it runs as its owner, so a caller who
 * reaches it is not stopped by any of the row-level security around it.
 */
revoke all on function public.set_invite_only(boolean) from public;

-- ── The gate ──────────────────────────────────────────────────────────────

create or replace function public.only_invited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare gated boolean;
begin
  select invite_only into gated from public.access_gate where only_one;
  if not coalesce(gated, false) then
    return new;
  end if;

  /*
   * Lower-cased on both sides. Addresses are handed to us by whatever the
   * person typed or whatever the identity provider sent, and a list that let
   * `Ada@example.edu` through while refusing `ada@example.edu` would be a gate
   * that appears to work and turns people away at random.
   */
  if exists (select 1 from public.invites where lower(email) = lower(new.email)) then
    return new;
  end if;

  /*
   * The message is for a log, not for a person: PostgREST turns this into an
   * opaque failure, so the sentence a person reads is the client's job. See
   * `app/src/lib/invite.ts`, which translates it — and note that the
   * translation is an *explanation* and never the enforcement. Deleting it
   * makes the refusal unreadable; it does not make it stop refusing.
   */
  raise exception 'semester: not on the invite list'
    using errcode = 'check_violation';
end $$;

-- Same reasoning, though calling a trigger function directly raises on its
-- own. Free, and one less thing to reason about.
revoke all on function public.only_invited() from public;

drop trigger if exists only_invited_users on auth.users;
create trigger only_invited_users
  before insert on auth.users
  for each row execute function public.only_invited();
