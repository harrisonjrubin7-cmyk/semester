-- Semester — the two tables an LTI 1.3 launch needs, and why neither is
-- reachable from a browser.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `GRADESCOPE-TURNITIN.md` is where this comes from. Semester cannot submit
-- into Gradescope or Turnitin — no public API on one, a partner program on the
-- other, and underneath both, an assignment that exists only because a
-- professor configured it in their LMS. The direction that is open is the
-- opposite one: Brightspace launching Semester, over LTI 1.3, which is a
-- 1EdTech standard and not a vendor's product. There is no partner program.
-- There is a school administrator, a client id, and these two tables.
--
-- ## Neither table has a policy, and that is the design rather than an omission
--
-- Both have row-level security on and **no policy at all**, so `anon` and
-- `authenticated` match no row for select, insert, update or delete. The only
-- thing that reaches either is the Edge Function, holding the service role
-- key, which row-level security does not apply to.
--
-- `public.referrals` is the nearest precedent and the reasoning there was
-- privacy — a table that would otherwise answer "who did I bring" with names.
-- Here it is not privacy, it is forgery, and it is worse:
--
--   * **`lti_platform` is the list of platforms we believe.** An account that
--     could insert into it could register an issuer it controls, sign its own
--     `id_token` with its own key, and launch as any student at any school
--     already in the table. Every check in `_shared/lti.ts` is a comparison
--     against a row in here, so a writable row is not one broken rule, it is
--     all of them at once.
--   * **`lti_nonce` is what makes a launch single-use.** An account that could
--     read it could take a launch that is in flight and complete it; one that
--     could update it could un-spend a nonce and replay a token. Replay is the
--     attack this table exists to stop, so a policy that let anybody touch it
--     would leave the table doing nothing but costing a round trip.
--
-- So the grants are revoked as well as the policies withheld, which is belt
-- and braces on purpose: `20260921003500_referrals.sql` records the lesson
-- that a `security definer` function revoked from `anon` and `authenticated`
-- by name keeps the grant both inherit from PUBLIC. The same trap applies to
-- tables, and the same answer: revoke from PUBLIC.
--
-- ## What is deliberately not here
--
-- **No key material.** A launch is the platform proving who it is to us, and
-- it does that with its own private key, which we never hold. This tool needs
-- a key of its own only when it calls *back* into Brightspace — grade
-- passback over Assignment and Grade Services, or a deep-linking response —
-- and neither is built. A private key in a table before anything signs with it
-- is a secret with no use and a blast radius, so the column it would live in
-- is not here yet. The migration that adds AGS is the one that adds it, and it
-- should think hard about whether the database is where it goes.
--
-- **No link to `auth.users`.** A validated launch tells us the platform's own
-- id for a person, unique only within that issuer. Turning that into a
-- Semester account is a real decision — whether a launch may create one, and
-- what happens when the same human already has an account they made
-- themselves — and it is not made here. `lti_nonce` carries the launch far
-- enough to be trusted; where it lands is the next slice's question, and
-- writing a foreign key now would answer it by accident.

-- ── The platforms we believe ──────────────────────────────────────────────
--
-- One row per deployment, not per school. A university with separate
-- Brightspace orgs for its schools is the ordinary case, and the deployment id
-- is the only thing in a launch that tells them apart — which is why it is in
-- the primary key rather than a column beside it. A tool that keyed on the
-- issuer alone would accept a launch from the medical school's deployment
-- into the law school's.

create table if not exists public.lti_platform (
  issuer         text        not null,
  client_id      text        not null,
  deployment_id  text        not null,
  -- Where the OIDC authentication request goes, and where the platform's
  -- public keys are published. Both are `https` by a check rather than by
  -- convention: these are the two URLs this tool will fetch and redirect a
  -- student to, and a registration row that could name `http` is a
  -- registration row that could downgrade a launch.
  auth_login_url text        not null check (auth_login_url ~ '^https://'),
  jwks_url       text        not null check (jwks_url ~ '^https://'),
  -- What a person calls this school. Never matched on.
  name           text        not null default '',
  created_at     timestamptz not null default now(),
  primary key (issuer, client_id, deployment_id)
);

alter table public.lti_platform enable row level security;

-- Both spellings, and `20260921003600_function_grants.sql` is the file that
-- explains why at length. Supabase's default privileges grant every new object
-- in `public` to `anon` and `authenticated` **by name**, so a revoke aimed at
-- PUBLIC leaves `anon=arwdDxt/postgres` sitting there untouched. Row-level
-- security with no policy already refuses both roles every row; this is the
-- second lock, on the grant rather than on the rows, because the first one is
-- one `create policy` away from being opened by somebody who does not read
-- this far. `service_role` keeps its own grant and is what the Edge Function
-- holds.
revoke all on public.lti_platform from public;
revoke all on public.lti_platform from anon, authenticated;

comment on table public.lti_platform is
  'One row per Brightspace deployment of this tool. Written only with the service role; readable through the API by nobody.';

-- ── Launches in flight ────────────────────────────────────────────────────
--
-- A row is written when we redirect a student into Brightspace to authenticate
-- and read back when Brightspace posts the `id_token` to us. It holds the two
-- values that tie those halves together and nothing about the person.
--
-- **The obvious place for this is a cookie, and a cookie is wrong here.** An
-- LTI launch renders inside an iframe on the LMS's own page, so the tool's
-- cookie is a third-party cookie — the thing browsers have spent years
-- learning to drop. A tool that keeps `state` in a cookie works for whoever
-- built it and fails for a student in Safari, and it fails by *losing the
-- launch*, which reads as the tool being broken rather than as a cookie
-- policy. So it goes in a table, and the table is the reason this migration
-- exists at all.

create table if not exists public.lti_nonce (
  -- `state` is ours, opaque to the platform, and comes back verbatim. It is
  -- the key because the launch POST is what looks a row up.
  state       text        primary key,
  -- Spent exactly once, by the launch that we issued it for.
  nonce       text        not null,
  -- Which registration this flight belongs to, so a token cannot be checked
  -- against a registration other than the one the login started from.
  issuer      text        not null,
  client_id   text        not null,
  created_at  timestamptz not null default now(),
  -- Short. The gap between the redirect and the POST back is one round trip
  -- through a page the student is already signed in to; anything longer than
  -- a few minutes is not a slow network, it is a replay.
  expires_at  timestamptz not null,
  -- Set on the launch that spends it. Present means used, and a second POST
  -- carrying the same state finds it set and is refused.
  spent_at    timestamptz
);

alter table public.lti_nonce enable row level security;

revoke all on public.lti_nonce from public;
revoke all on public.lti_nonce from anon, authenticated;

-- Expiry is enforced by the function below rather than by this index; the
-- index is here because the sweep is the only query that is not a primary-key
-- lookup, and without it the sweep gets slower exactly as the table gets
-- bigger, which is when it matters.
create index if not exists lti_nonce_expires_at_idx on public.lti_nonce (expires_at);

comment on table public.lti_nonce is
  'State and nonce for LTI launches in flight. Not a cookie, because an LTI launch is in an iframe. Readable through the API by nobody.';

-- ── Spending one ──────────────────────────────────────────────────────────
--
-- The check and the spend are one statement, and that is the whole point of
-- this function existing rather than the Edge Function doing a select and then
-- an update. Two statements race: two POSTs carrying the same `state` can both
-- read `spent_at` as null before either writes it, and both launches proceed.
-- That is the replay this table is for, reintroduced by the code that reads
-- it.
--
-- `update ... where spent_at is null returning` is atomic. The second caller
-- updates no rows and gets nothing back, which is the refusal.
--
-- Returns the nonce and the registration the flight started from, so the
-- caller checks the token against that registration rather than against
-- whichever one the token itself names.

create or replace function public.spend_lti_nonce(want_state text)
returns table (nonce text, issuer text, client_id text)
language sql
volatile
security definer
set search_path = ''
as $$
  update public.lti_nonce n
     set spent_at = now()
   where n.state = want_state
     and n.spent_at is null
     and n.expires_at > now()
  returning n.nonce, n.issuer, n.client_id
$$;

-- Callable by nobody through the API. The Edge Function reaches it with the
-- service role, which is not a member of PUBLIC's grant path.
--
-- **Both spellings, and neither is redundant.** This is the one place in this
-- schema where two opposite-looking lessons meet, and the first draft of this
-- file got it wrong in the direction that ships:
--
--   * Postgres grants EXECUTE on a new function to PUBLIC, and `anon` and
--     `authenticated` are members — so revoking the two names alone leaves the
--     grant they inherit. `20260921003500_referrals.sql` records that one.
--   * Supabase *also* grants every new function in `public` to those two roles
--     explicitly, by name, through default privileges — so revoking PUBLIC
--     alone leaves `anon=X/postgres` behind. `20260921003600_function_grants.sql`
--     records that one, and it is the one this file was missing.
--
-- `grants.check.sql` is what caught it, on the first run, by asserting that no
-- function in `public` is callable by `anon` at all.
revoke all on function public.spend_lti_nonce(text) from public;
revoke all on function public.spend_lti_nonce(text) from anon, authenticated;

comment on function public.spend_lti_nonce(text) is
  'Atomically spend a launch state. Returns nothing if it is unknown, expired, or already spent.';

-- ── Sweeping the dead ones ────────────────────────────────────────────────
--
-- Rows are small and short-lived, but a launch that is started and abandoned
-- leaves one behind and nothing else ever deletes it. Called from the same
-- place the rest of this project's housekeeping is called from; safe to call
-- at any time and from anywhere, because it only ever removes rows that are
-- past their expiry and therefore already refused by `spend_lti_nonce`.

create or replace function public.sweep_lti_nonce()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare gone integer;
begin
  delete from public.lti_nonce where expires_at < now() - interval '1 hour';
  get diagnostics gone = row_count;
  return gone;
end $$;

revoke all on function public.sweep_lti_nonce() from public;
revoke all on function public.sweep_lti_nonce() from anon, authenticated;

comment on function public.sweep_lti_nonce() is
  'Delete launch states an hour past expiry. Removes only rows spend_lti_nonce already refuses.';
