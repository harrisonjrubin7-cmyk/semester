-- The operations console's control plane: preferences, seats, MFA, duties,
-- an audit chain, figures with provenance, and the demo flag.
--
-- `app/src/lib/ops/console.ts` holds the console's policy as data — its
-- duties, its context bar, the seven fields a figure must carry — and until
-- this file nothing in the database honoured any of it. The console prototype
-- listed thirteen capabilities it had faked; this migration is the schema for
-- six of them, and `20260929110000_console_approvals_and_break_glass.sql`
-- builds the rest on top of it.
--
-- ## Which of the thirteen console rows this file serves
--
--   1  saved-views        `public.operator_preference`: per-operator, server-
--                         side, owner-only. Never localStorage.
--   2  operator-identity  `private.mfa_fresh()` / `private.assert_fresh_mfa()`:
--                         "fresh MFA for privileged actions" read off the JWT
--                         the platform issued, not off a flag the client sent.
--   3  roles              `console:operate`, `approval:decide` and
--   4  authorization      `breakglass:request` as capabilities in the matrix;
--                         `public.council_seat_holder` and `private.holds_seat()`
--                         for approvals that are decided by seat rather than by
--                         role; `public.console_duty` as the duty matrix the
--                         server checks; `private.party_held()` as the one
--                         predicate that says whether the caller is a duty's
--                         party. Every one is checked here, in policies and
--                         definer functions, never in the screen.
--   5  audit-log          `private.console_audit_event` and everything after
--                         it: a separate writer role, insert-only, hash-chained,
--                         a signed daily manifest, a nightly verification, and
--                         a read path that logs the read.
--   9  figures            `public.console_figures()`: each figure from a real
--                         query with its source, window, owner seat, refresh,
--                         evidence and known limitation. Billing says "not
--                         applicable" and cites D-009 — never a number.
--  13  environment        `public.schools.is_demo`: a demo tenant is a row
--                         flagged as such, and every console read here leaves
--                         demo rows out unless asked for them by name.
--
-- Rows 6, 7, 8, 11 and 12 are migration B's and the app's; row 10 already
-- exists in `20260925103000_support_access.sql`.
--
-- Idempotent, like every file in this directory, and containing no
-- `begin`/`commit` of its own: `check.sh` applies it twice and requires the
-- schema and every row to come out identical.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Capabilities
--
-- Three new words in the vocabulary.
--
-- `console:operate` is what opens the console at all. Six roles carry it —
-- the roles the duty matrix names as requesters, plus the responders who
-- need the audit and figures views in an incident. It is *only* the door: it
-- reads the duty matrix, the seats, the figures and the audit status. Acting
-- on anything is a separate capability or a seat, checked at the action.
--
-- `audit:read` is deliberately *not* carried further. It exists since
-- `20260923210000_intelligence_policy.sql` as a school-scoped capability of
-- `university_admin` over a tenant's own audit events, and
-- `app/src/lib/rolelaunch.ts` classes it as a student-record capability that
-- no internal role may hold (its test refuses one). The console's own chain
-- is read with `console:operate`, below, and nothing else.
--
-- `approval:decide` is for deciding a request *as a role*. Most of the duty
-- matrix's approvers are seats, and a seat is held through
-- `council_seat_holder`, not through a role — so this capability is narrower
-- than it looks: it exists so that a `role:x` approver party can be expressed
-- in the same way as a seat, and `private.party_held()` is the one place that
-- reads both.
--
-- `breakglass:request` is who may open a break-glass request. Migration B
-- owns the request; this file owns the word.

insert into public.app_capabilities (capability, about) values
  ('console:operate',    'Open the operations console: read its duty matrix, council seats, figures and audit-chain status.'),
  ('approval:decide',    'Decide an approval request in the operations console as a role party; seat holders decide by seat.'),
  ('breakglass:request', 'Request break-glass access to a production tenant through the operations console.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('platform_admin',         'console:operate'),
  ('support_agent',          'console:operate'),
  ('implementation_manager', 'console:operate'),
  ('data_steward',           'console:operate'),
  ('incident_responder',     'console:operate'),
  ('trust_officer',          'console:operate'),
  ('platform_admin',         'approval:decide'),
  ('platform_admin',         'breakglass:request'),
  ('incident_responder',     'breakglass:request')
on conflict (role, capability) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Saved views and navigation state (row 1)
--
-- The prototype kept its table views in the browser. A preference that lives
-- in one browser is lost on the next machine and, worse, is a place the
-- console's *state* could quietly become its *authorization* — a saved filter
-- that hides a tenant is not a rule that the tenant is hidden. So preferences
-- are rows, keyed on the operator and a short key, holding JSON the app
-- interprets, and nothing here reads them for any decision.
--
-- Owner-only in every direction, and reached directly through PostgREST: a
-- row about one person's own display choices needs no function in front of
-- it. `updated_at` is stamped by trigger so a client cannot write a time.

create table if not exists public.operator_preference (
  subject    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null check (key ~ '^[a-z0-9_.-]{1,80}$'),
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (subject, key)
);

-- The primary key leads with `subject`, so it covers the foreign key.

alter table public.operator_preference enable row level security;
revoke all on table public.operator_preference from anon, authenticated;
grant select, insert, update, delete on table public.operator_preference to authenticated;

drop policy if exists "operators read their own preferences" on public.operator_preference;
create policy "operators read their own preferences" on public.operator_preference
  for select to authenticated using (subject = (select auth.uid()));
drop policy if exists "operators write their own preferences" on public.operator_preference;
create policy "operators write their own preferences" on public.operator_preference
  for insert to authenticated with check (subject = (select auth.uid()));
drop policy if exists "operators change their own preferences" on public.operator_preference;
create policy "operators change their own preferences" on public.operator_preference
  for update to authenticated
  using (subject = (select auth.uid())) with check (subject = (select auth.uid()));
drop policy if exists "operators remove their own preferences" on public.operator_preference;
create policy "operators remove their own preferences" on public.operator_preference
  for delete to authenticated using (subject = (select auth.uid()));

create or replace function private.stamp_operator_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke all on function private.stamp_operator_preference() from public, anon, authenticated;

create or replace trigger stamp_operator_preference
  before insert or update on public.operator_preference
  for each row execute function private.stamp_operator_preference();

comment on table public.operator_preference is
  'One operator''s own saved views and navigation state, as JSON under a short key. Owner-only; read by no policy and no decision.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Council seats (rows 3 and 4)
--
-- The duty matrix names its approvers as seats — `security`, `founder`,
-- `privacy` — because the launch command gave each of ten seats a person, and
-- an approval is a person's decision. A seat is not a role: a role is granted
-- by an institution or by the platform over a scope, and carries
-- capabilities; a seat is accepted by one person and carries the standing to
-- approve. Keeping them apart is what stops "who may approve a break-glass"
-- from being answerable by granting yourself a role.
--
-- Written by the service role only. There is no insert, update or delete
-- policy, and both API roles are off every write privilege, so the only way a
-- seat changes hands is an operation — which is what accepting a seat is.
-- Readable by the holder (so the console can show them their own standing)
-- and by anybody who may open the console (so an approver can be found).
--
-- `ended_at` rather than a delete: the row is the record that this person
-- held the seat over this period, and an approval they gave then has to be
-- explicable later.

create table if not exists public.council_seat_holder (
  seat        text        not null check (seat in (
                            'founder', 'product', 'engineering', 'security', 'privacy',
                            'accessibility', 'success', 'trust', 'data', 'champion')),
  subject     uuid        not null references auth.users (id) on delete cascade,
  accepted_at timestamptz not null default now(),
  ended_at    timestamptz,
  primary key (seat, subject),
  constraint council_seat_ended_after_accepted
    check (ended_at is null or ended_at >= accepted_at)
);

-- The primary key leads with `seat`, so the foreign key on `subject` needs
-- its own covering index (`indexes.check.sql`).
create index if not exists council_seat_holder_by_subject
  on public.council_seat_holder (subject);

alter table public.council_seat_holder enable row level security;
revoke all on table public.council_seat_holder from anon, authenticated;
grant select on table public.council_seat_holder to authenticated;

drop policy if exists "a seat holder and the console read seats" on public.council_seat_holder;
create policy "a seat holder and the console read seats" on public.council_seat_holder
  for select to authenticated
  using (subject = (select auth.uid()) or private.has_capability('console:operate'));

-- Whether the caller holds this seat right now. Liveness is inside the
-- predicate for the reason `private.holds_role()` gives: the call site that
-- forgets `ended_at` is the one nobody finds.
--
-- Not granted to any client role: no policy calls it, and a definer function
-- that a policy does not need is a definer function a client should not be
-- able to reach (`grants.check.sql` holds that rule). The definer functions
-- that do call it run as their owner.
create or replace function private.holds_seat(want_seat text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.council_seat_holder h
     where h.seat = want_seat
       and h.subject = (select auth.uid())
       and h.ended_at is null
  );
$$;

revoke all on function private.holds_seat(text) from public, anon, authenticated;

comment on table public.council_seat_holder is
  'Who holds which of the ten council seats, and since when. Written only by the service role; an ended seat keeps its row.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · Fresh MFA (row 2)
--
-- Supabase Auth puts the assurance level and the authentication methods into
-- the JWT: `aal` is `aal2` once a second factor has been verified in this
-- session, and `amr` lists each method with the epoch second it was
-- completed. A privileged action asks for *fresh* MFA — a second factor
-- verified within the last quarter of an hour — so a session that verified a
-- TOTP this morning and has been open on a desk since is not enough.
--
-- Read off `auth.jwt()` and nothing else. The client cannot forge a claim the
-- platform signed, and the app's own idea of its MFA level is not consulted:
-- the screen may say "MFA fresh" and be wrong, and the action will refuse.
--
-- The methods counted are the ones that are a second factor: `totp`,
-- `webauthn`, `phone`, and `mfa/totp` (the spelling some client versions
-- emit). A `password` entry in `amr` is the first factor and does not count.
-- A timestamp that is not a number does not count either.

create or replace function private.mfa_fresh(within interval default '15 minutes')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (j.claims ->> 'aal') = 'aal2'
       and exists (
         select 1
           from jsonb_array_elements(
                  case when jsonb_typeof(j.claims -> 'amr') = 'array'
                       then j.claims -> 'amr' else '[]'::jsonb end) as m
          where (m ->> 'method') in ('totp', 'webauthn', 'phone', 'mfa/totp')
            and (m ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$'
            and to_timestamp((m ->> 'timestamp')::double precision) >= now() - within
       )
      from (select auth.jwt() as claims) j
  ), false);
$$;

revoke all on function private.mfa_fresh(interval) from public, anon, authenticated;

-- `insufficient_privilege` (42501), so a client sees the same class of error a
-- missing capability raises, with a message it can act on: send the operator
-- to the MFA step and try again.
create or replace function private.assert_fresh_mfa()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.mfa_fresh() then
    raise exception using errcode = '42501', message = 'Fresh MFA required';
  end if;
end $$;

revoke all on function private.assert_fresh_mfa() from public, anon, authenticated;

comment on function private.mfa_fresh(interval) is
  'Whether the caller''s JWT says a second factor (totp, webauthn, phone) was verified within the interval. Read from auth.jwt(); the client''s own MFA state is never consulted.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · The duty matrix (rows 3 and 4)
--
-- `DUTIES` in `app/src/lib/ops/console.ts`, as rows the server reads. The
-- parties are written exactly as that file writes them — a seat by name, a
-- role as `role:university_admin`, and `student` — so that
-- `private.party_held()` below and the app's own rendering agree letter for
-- letter, and a vitest test holds this seed to that file.
--
-- `insert … on conflict (id) do update` rather than `do nothing`: a duty is a
-- policy, and a policy that changes in the TypeScript has to change here on
-- the next apply, not stay at whatever it was when the row was first made.
-- Re-applying with the same values rewrites nothing, so a second pass is
-- identical (`check.sh` measures that).
--
-- Readable by anybody who may open the console. Written by nobody: both API
-- roles are off every write privilege and there is no write policy, because
-- the matrix is a decision recorded in this repository, not a setting.

create table if not exists public.console_duty (
  id         text    primary key check (id ~ '^[a-z][a-z0-9-]{1,40}$'),
  action     text    not null check (length(trim(action)) between 1 and 200),
  requester  text    not null check (length(requester) between 1 and 80),
  approvers  text[]  not null check (cardinality(approvers) >= 1),
  two_person boolean not null,
  evidence   text    not null check (length(trim(evidence)) between 1 and 500)
);

insert into public.console_duty (id, action, requester, approvers, two_person, evidence) values
  ('break-glass',
   'Break-glass access to a production tenant',
   'engineering', array['security', 'founder'], true,
   'An incident or change ticket, fresh MFA, an expiry no later than the incident’s close, and a post-use review booked'),
  ('role-grant',
   'Grant or widen a privileged role',
   'role:university_admin', array['security'], false,
   'The access request, naming the person, the role, the tenant and the reason'),
  ('support-access',
   'Read a student’s record for support',
   'role:support_agent', array['student'], false,
   'A support ticket, the scope, a time limit, and the banner the student sees while the grant is open'),
  ('tenant-suspension',
   'Suspend a production tenant',
   'role:platform_admin', array['founder', 'security'], true,
   'A change ticket and the customer communication that goes with it'),
  ('tenant-policy',
   'Change a tenant’s policy or turn a feature on for it',
   'role:implementation_manager', array['engineering'], false,
   'A change record naming the flag or policy, the tenant, the rollback and who at the institution asked'),
  ('integration-config',
   'Configure, rotate or disable a connector to an official system',
   'role:integration_admin', array['data', 'security'], true,
   'The institution’s written approval, the data scope, the fallback while it is off, and the credential’s expiry'),
  ('release',
   'Release to production, or roll it back',
   'engineering', array['product'], false,
   'The release record: CI green on the commit, the golden path run, the rollback rehearsed'),
  ('data-deletion',
   'Delete an institution’s data, or a student’s on their behalf',
   'role:data_steward', array['privacy'], false,
   'The verified request, the retention class of each store touched, and the deletion certificate that will be issued'),
  ('ai-provider',
   'Change an AI provider, model or policy',
   'product', array['security', 'privacy'], true,
   'The evaluation evidence from the G0–G5 gates, and the subprocessor register updated in the same change'),
  ('evidence-release',
   'Release controlled evidence to a reviewer',
   'success', array['security', 'privacy'], false,
   'The signed NDA, the named reviewer, the commit the packet was generated from, and the expiring link'),
  ('refund',
   'Refund or credit above the threshold',
   'role:business_admin', array['founder'], false,
   'The billing record and the reason')
on conflict (id) do update
  set action     = excluded.action,
      requester  = excluded.requester,
      approvers  = excluded.approvers,
      two_person = excluded.two_person,
      evidence   = excluded.evidence;

alter table public.console_duty enable row level security;
revoke all on table public.console_duty from anon, authenticated;
grant select on table public.console_duty to authenticated;

drop policy if exists "the console reads the duty matrix" on public.console_duty;
create policy "the console reads the duty matrix" on public.console_duty
  for select to authenticated
  using (private.has_capability('console:operate'));

-- Whether the caller *is* this party, in the matrix's own spelling.
--
--   `student`   never. A student approves a support-access request by
--               creating the grant themselves (`support_access_grant`), never
--               through the console; a console approver who claimed to be
--               "the student" would be the impersonation the matrix exists
--               to refuse.
--   `role:x`    a live grant of role x over any scope — live meaning not
--               revoked and not expired, the predicate `holds_role` uses.
--               Any scope, because the duty's tenant is checked by the
--               request, not by the party.
--   a seat      `private.holds_seat()`.
create or replace function private.party_held(party text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when party = 'student' then false
    when party like 'role:%' then exists (
      select 1
        from public.role_grants g
       where g.subject = (select auth.uid())
         and g.role = substr(party, 6)
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at > now())
    )
    else private.holds_seat(party)
  end;
$$;

revoke all on function private.party_held(text) from public, anon, authenticated;

comment on table public.console_duty is
  'The duty matrix of app/src/lib/ops/console.ts as rows: who may request each high-risk action, who may approve it, and whether two must. Written only by migration.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · The audit chain (row 5)
--
-- What the prototype faked was an audit log. What production needs is listed
-- in the console's own policy, and each item is a separate mechanism here,
-- because each one closes a different way of lying:
--
--   * **a separate writer role** — `semester_audit_writer`, which holds the
--     only INSERT on the table. The service role, which bypasses row-level
--     security, does *not* bypass privileges, and so cannot append a row
--     except through the one function below. A key that can do anything else
--     on this project still cannot write history directly.
--   * **insert-only** — a trigger refuses every update and delete, for
--     everybody including the owner. The retention sweep in
--     `20260929030000_retention_sweeps.sql` does not name this table and
--     must never: it is the console's protected archive, kept for as long
--     as the project is, and the check suite asserts the sweep leaves it.
--   * **a hash chain** — each row carries the previous row's hash and its
--     own, computed over a canonical rendering of the row by trigger. A row
--     removed or rewritten from underneath (a superuser with the trigger
--     disabled, a restored backup with a gap) breaks the chain at that seq.
--   * **a signed batch manifest** — each day is sealed once: the first and
--     last seq, the count and the head hash, HMAC-signed with a key nobody
--     reads through the API. A rewritten day cannot be re-sealed to match.
--   * **a nightly integrity job** — `console-audit-integrity` in
--     `scheduler.sql` seals yesterday and re-verifies the whole chain and
--     every manifest, recording the result where the console can show it.
--   * **audit-read logging** — the only read path from a client writes an
--     `audit.read` event before it returns rows, so reading the log is in
--     the log.
--
-- `actor` is deliberately not a foreign key. An account is deleted; what it
-- did is not, and a cascade here would be the delete-my-account path quietly
-- removing evidence of a privileged action.

-- ── The writer role ───────────────────────────────────────────────────────
--
-- `nologin`: it is a privilege boundary, not a connection. `postgres` — the
-- role every definer function here is owned by — is made a member so that a
-- definer function can call the writer's function; on this project
-- `postgres` is not a superuser, so the membership is what carries the
-- EXECUTE. The grant is guarded on inherited privilege (`USAGE`) rather than
-- on the existence of a membership row, because on Postgres 16 and later a
-- CREATEROLE user is given ADMIN OPTION on a role it creates — a membership
-- row that inherits nothing, which is not the membership needed.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'semester_audit_writer') then
    create role semester_audit_writer nologin;
  end if;
  if not pg_has_role('postgres', 'semester_audit_writer', 'USAGE') then
    grant semester_audit_writer to postgres;
  end if;
end $$;

-- USAGE lets the writer reach the schema; CREATE is what lets it *own* a
-- function there. `alter function … owner to` requires the new owner to hold
-- CREATE on the function's schema, and the Supabase preview branch for this
-- change refused the ownership step below with "permission denied for schema
-- private" until this grant existed. The harness never noticed, because its
-- `postgres` is a superuser and a superuser owns anything anywhere; on the
-- live project `postgres` is not. The widening is small — a nologin role that
-- nothing connects as may create objects in `private` — and is the price of
-- the writer owning its own function, which is the whole point of the role.
grant usage, create on schema private to semester_audit_writer;

-- ── sha256 and HMAC, resolved once ────────────────────────────────────────
--
-- Supabase installs pgcrypto in `extensions`; the disposable harness installs
-- it in `public`. The same trick `private.role_audit_sha256` uses: decide at
-- migration time which schema has it, and write the function against that
-- schema, so the production function keeps its empty search_path.

do $$
declare
  ns text;
begin
  if to_regprocedure('extensions.digest(text,text)') is not null then
    ns := 'extensions';
  elsif to_regprocedure('public.digest(text,text)') is not null then
    ns := 'public';
  else
    raise exception 'pgcrypto digest(text,text) and hmac(bytea,bytea,text) are required for the console audit chain.';
  end if;
  execute format($fn$
    create or replace function private.console_audit_sha256(value text)
    returns text language sql immutable security invoker set search_path = ''
    as 'select encode(%I.digest(value, ''sha256''), ''hex'')'
  $fn$, ns);
  execute format($fn$
    create or replace function private.console_audit_hmac(value text, key bytea)
    returns text language sql immutable security invoker set search_path = ''
    as 'select encode(%I.hmac(convert_to(value, ''UTF8''), key, ''sha256''), ''hex'')'
  $fn$, ns);
end $$;

revoke all on function private.console_audit_sha256(text) from public, anon, authenticated;
revoke all on function private.console_audit_hmac(text, bytea) from public, anon, authenticated;

-- ── The table ─────────────────────────────────────────────────────────────

create table if not exists private.console_audit_event (
  seq            bigint      generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor          uuid,
  actor_kind     text        not null check (actor_kind in ('authenticated', 'service', 'system')),
  tenant_id      text,
  action         text        not null check (action ~ '^[a-z0-9_.:-]{1,80}$'),
  target         text,
  detail         jsonb       not null default '{}'::jsonb,
  correlation_id text        check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  prev_hash      text        not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  hash           text        not null check (hash ~ '^[0-9a-f]{64}$')
);

create index if not exists console_audit_event_by_time
  on private.console_audit_event (occurred_at, seq);

-- ── The canonical rendering a hash is taken over ──────────────────────────
--
-- One function, used by the chaining trigger and by the verifier, so the two
-- cannot disagree about what a row's text is. A JSON object rather than a
-- concatenation: keys are sorted by jsonb, null is spelled `null` and not
-- confused with an empty string, and nested `detail` is rendered the way
-- jsonb always renders it. `occurred_at` is written in UTC to the
-- microsecond, because `timestamptz::text` depends on the session's time
-- zone and a hash that depends on who is asking is not a hash.

create or replace function private.console_audit_canonical(
  want_seq bigint, want_occurred timestamptz, want_actor uuid, want_actor_kind text,
  want_tenant text, want_action text, want_target text, want_detail jsonb,
  want_correlation text, want_prev_hash text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'seq',            want_seq,
    'occurred_at',    to_char(want_occurred at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor',          want_actor::text,
    'actor_kind',     want_actor_kind,
    'tenant_id',      want_tenant,
    'action',         want_action,
    'target',         want_target,
    'detail',         want_detail,
    'correlation_id', want_correlation,
    'prev_hash',      want_prev_hash
  )::text;
$$;

revoke all on function private.console_audit_canonical(bigint, timestamptz, uuid, text, text, text, text, jsonb, text, text)
  from public, anon, authenticated;

-- The chaining trigger. Runs as its owner (`security definer`) because the
-- writer role holds INSERT and nothing else, and the previous row's hash has
-- to be read. The caller's values for `prev_hash` and `hash` are ignored:
-- the chain is computed, never supplied.
create or replace function private.console_audit_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_hash text;
begin
  -- Appends are serialized. Two transactions inserting at once would each
  -- read the same committed tail (neither can see the other's uncommitted
  -- row), both would chain to it, and the verifier would find a fork: two
  -- rows with one prev_hash, and a chain that reads as tampered when it was
  -- merely concurrent. A transaction-scoped advisory lock on the table's
  -- name makes the second writer wait for the first to commit, so it then
  -- reads that row as its tail. The lock is released at commit or rollback,
  -- and costs nothing while writes do not overlap.
  perform pg_advisory_xact_lock(hashtext('private.console_audit_event'));
  select e.hash into last_hash
    from private.console_audit_event e
   order by e.seq desc
   limit 1;
  new.prev_hash := coalesce(last_hash, repeat('0', 64));
  new.hash := private.console_audit_sha256(private.console_audit_canonical(
    new.seq, new.occurred_at, new.actor, new.actor_kind, new.tenant_id,
    new.action, new.target, new.detail, new.correlation_id, new.prev_hash
  ));
  return new;
end $$;

create or replace function private.refuse_console_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Console audit records are immutable (%).', tg_table_name;
end $$;

revoke all on function private.console_audit_chain() from public, anon, authenticated;
revoke all on function private.refuse_console_audit_change() from public, anon, authenticated;

create or replace trigger chain_console_audit_event
  before insert on private.console_audit_event
  for each row execute function private.console_audit_chain();

create or replace trigger keep_console_audit_event_immutable
  before update or delete on private.console_audit_event
  for each row execute function private.refuse_console_audit_change();

-- ── Who may touch the table: the writer, to append; nobody else ───────────
--
-- Revoked by name from both API roles *and* from the service role. The
-- service role is `bypassrls`, which is why row-level security alone would
-- not keep it out; the privilege does. RLS is on regardless, with one policy
-- letting the writer role append, so that the table's safety is not a fact
-- about the privilege alone.

alter table private.console_audit_event enable row level security;
revoke all on table private.console_audit_event from public, anon, authenticated, service_role;
grant insert on table private.console_audit_event to semester_audit_writer;
-- `insert … returning seq` needs SELECT on the column returned, so the writer
-- may read exactly that column and no other: the seq it has just written,
-- never an actor, an action or a detail.
grant select (seq) on table private.console_audit_event to semester_audit_writer;

drop policy if exists "the audit writer appends" on private.console_audit_event;
create policy "the audit writer appends" on private.console_audit_event
  for insert to semester_audit_writer with check (true);
-- `returning` is checked against the SELECT policies as well as the column
-- privilege, so the writer needs a row policy to read back the seq it wrote.
-- The column grant above is what keeps that read to `seq`.
drop policy if exists "the audit writer reads back the seq it wrote" on private.console_audit_event;
create policy "the audit writer reads back the seq it wrote" on private.console_audit_event
  for select to semester_audit_writer using (true);

-- ── The one way in ────────────────────────────────────────────────────────
--
-- Owned by the writer role, so that when it runs it *is* the writer and the
-- INSERT privilege applies. It never catches an exception: a caller that
-- cannot record what it is about to do must not do it, and the way that
-- rule reaches the caller is the exception reaching the caller. Migration
-- B's `console_act` is written on that.
--
-- Callable by the service role (an operation recording what it did) and by
-- the definer functions in this file and in B, which run as `postgres`, a
-- member of the writer. Not by a signed-in account: the suite proves an
-- authenticated session is refused.

create or replace function private.console_audit_write(
  want_actor       uuid,
  want_actor_kind  text,
  want_tenant      text,
  want_action      text,
  want_target      text,
  want_detail      jsonb,
  want_correlation text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_seq bigint;
begin
  insert into private.console_audit_event
    (actor, actor_kind, tenant_id, action, target, detail, correlation_id, prev_hash, hash)
  values
    (want_actor, want_actor_kind, want_tenant, want_action, want_target,
     coalesce(want_detail, '{}'::jsonb), want_correlation, repeat('0', 64), repeat('0', 64))
  returning seq into new_seq;
  return new_seq;
end $$;

alter function private.console_audit_write(uuid, text, text, text, text, jsonb, text)
  owner to semester_audit_writer;
revoke all on function private.console_audit_write(uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function private.console_audit_write(uuid, text, text, text, text, jsonb, text)
  to service_role;

comment on function private.console_audit_write(uuid, text, text, text, text, jsonb, text) is
  'The only way a console audit event is written. Runs as semester_audit_writer; never swallows an exception, so a caller that cannot record its action fails before acting.';

-- ── The signing key ───────────────────────────────────────────────────────
--
-- Thirty-two random bytes, generated once and never read by anything a
-- client can reach: no grant to any API role, and the only reader is the
-- sealer and the verifier, both owned by `postgres`. Seeded with
-- `where not exists` so a second apply keeps the key — a rotated key would
-- make every earlier manifest unverifiable, which is a decision somebody
-- takes on purpose, with a rotation record, not one a re-deploy takes.

create table if not exists private.console_audit_key (
  id  boolean primary key default true check (id),
  key bytea   not null check (length(key) = 32)
);

alter table private.console_audit_key enable row level security;
revoke all on table private.console_audit_key from public, anon, authenticated, service_role;

insert into private.console_audit_key (id, key)
select true, gen_random_bytes(32)
 where not exists (select 1 from private.console_audit_key);

-- ── The daily manifest ────────────────────────────────────────────────────

create table if not exists private.console_audit_manifest (
  batch_day  date        primary key,
  first_seq  bigint,
  last_seq   bigint,
  row_count  bigint      not null check (row_count >= 0),
  head_hash  text        not null check (head_hash ~ '^[0-9a-f]{64}$'),
  signature  text        not null check (signature ~ '^[0-9a-f]{64}$'),
  sealed_at  timestamptz not null default now(),
  constraint console_audit_manifest_bounds check (
    (row_count = 0 and first_seq is null and last_seq is null)
    or (row_count > 0 and first_seq is not null and last_seq >= first_seq)
  )
);

alter table private.console_audit_manifest enable row level security;
revoke all on table private.console_audit_manifest from public, anon, authenticated, service_role;

create or replace trigger keep_console_audit_manifest_immutable
  before update or delete on private.console_audit_manifest
  for each row execute function private.refuse_console_audit_change();

-- What is signed. One function for the sealer and the verifier, for the
-- reason the canonical row rendering is one function.
create or replace function private.console_audit_manifest_text(
  want_day date, want_first bigint, want_last bigint, want_count bigint, want_head text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select concat_ws('|', want_day::text, coalesce(want_first::text, ''),
                   coalesce(want_last::text, ''), want_count::text, want_head);
$$;

revoke all on function private.console_audit_manifest_text(date, bigint, bigint, bigint, text)
  from public, anon, authenticated;

-- Seal one day: by default yesterday, which is the day that is complete when
-- the nightly job runs. Days are UTC days, because `occurred_at` is hashed
-- in UTC and a manifest has to name the same rows whoever reads it.
--
-- Sealing an already-sealed day with the same head is a no-op, so the job
-- can be re-run. Sealing it with a different head raises: that is a day
-- whose rows changed after it was sealed, which is the finding, and a
-- manifest that could be quietly replaced would hide it.
create or replace function private.console_audit_seal(want_day date default (current_date - 1))
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  day_start timestamptz := (want_day::timestamp at time zone 'UTC');
  day_end   timestamptz := ((want_day + 1)::timestamp at time zone 'UTC');
  v_first bigint;
  v_last  bigint;
  v_count bigint;
  v_head  text;
  v_key   bytea;
  existing private.console_audit_manifest;
begin
  select min(e.seq), max(e.seq), count(*)
    into v_first, v_last, v_count
    from private.console_audit_event e
   where e.occurred_at >= day_start and e.occurred_at < day_end;

  if v_count = 0 then
    v_head := repeat('0', 64);
  else
    select e.hash into v_head from private.console_audit_event e where e.seq = v_last;
  end if;

  select * into existing from private.console_audit_manifest m where m.batch_day = want_day;
  if found then
    if existing.head_hash <> v_head or existing.row_count <> v_count then
      raise exception 'Console audit day % is sealed with head % and % rows; it now reads head % and % rows. The sealed rows changed.',
        want_day, existing.head_hash, existing.row_count, v_head, v_count;
    end if;
    return;
  end if;

  select k.key into v_key from private.console_audit_key k where k.id;
  if v_key is null then
    raise exception 'The console audit signing key is missing.';
  end if;

  insert into private.console_audit_manifest
    (batch_day, first_seq, last_seq, row_count, head_hash, signature)
  values
    (want_day, v_first, v_last, v_count, v_head,
     private.console_audit_hmac(
       private.console_audit_manifest_text(want_day, v_first, v_last, v_count, v_head), v_key));
end $$;

revoke all on function private.console_audit_seal(date) from public, anon, authenticated;
grant execute on function private.console_audit_seal(date) to service_role;

-- ── Verification ──────────────────────────────────────────────────────────
--
-- Walks every row in seq order and recomputes both links — that `prev_hash`
-- is the previous row's `hash` (or the zero hash at the head), and that
-- `hash` is the sha256 of the row's canonical text — then re-checks every
-- manifest: its signature under the key, and that the rows it names — the
-- day's rows up to its `last_seq` — still have that count and that head. The
-- first bad seq is reported; a bad manifest reports its `last_seq` (or 0 for
-- an empty day, which asserts only its signature).
--
-- Every run is recorded, good or bad, so "when was this last verified, and
-- was it fine" is a row and not a memory. The record table is insert-only
-- like the rest of the chain.

create table if not exists private.console_audit_verification (
  ran_at        timestamptz not null default now(),
  ok            boolean     not null,
  rows_checked  bigint      not null,
  first_bad_seq bigint,
  note          text
);

create index if not exists console_audit_verification_by_time
  on private.console_audit_verification (ran_at desc);

alter table private.console_audit_verification enable row level security;
revoke all on table private.console_audit_verification from public, anon, authenticated, service_role;

create or replace trigger keep_console_audit_verification_immutable
  before update or delete on private.console_audit_verification
  for each row execute function private.refuse_console_audit_change();

create or replace function private.console_audit_verify()
returns table (ok boolean, rows_checked bigint, first_bad_seq bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r         record;
  m         record;
  expected  text := repeat('0', 64);
  n         bigint := 0;
  bad       bigint;
  v_note    text;
  v_key     bytea;
  v_count   bigint;
  v_head    text;
begin
  for r in
    select e.* from private.console_audit_event e order by e.seq
  loop
    n := n + 1;
    if r.prev_hash <> expected then
      bad := r.seq; v_note := 'prev_hash does not link to the previous row'; exit;
    end if;
    if r.hash <> private.console_audit_sha256(private.console_audit_canonical(
         r.seq, r.occurred_at, r.actor, r.actor_kind, r.tenant_id,
         r.action, r.target, r.detail, r.correlation_id, r.prev_hash)) then
      bad := r.seq; v_note := 'hash does not match the row'; exit;
    end if;
    expected := r.hash;
  end loop;

  if bad is null then
    select k.key into v_key from private.console_audit_key k where k.id;
    for m in
      select * from private.console_audit_manifest order by batch_day
    loop
      if m.signature <> private.console_audit_hmac(
           private.console_audit_manifest_text(m.batch_day, m.first_seq, m.last_seq, m.row_count, m.head_hash),
           v_key) then
        bad := coalesce(m.last_seq, 0); v_note := 'manifest signature does not verify for ' || m.batch_day; exit;
      end if;
      -- What a manifest asserts is the day *up to its last seq*: a row the
      -- chain took later the same day (only possible when today is sealed,
      -- which the job never does and the suite does on purpose) sits past
      -- `last_seq` and contradicts nothing. An empty day asserts only its
      -- signature.
      if m.row_count > 0 then
        select count(*) into v_count
          from private.console_audit_event e
         where e.occurred_at >= (m.batch_day::timestamp at time zone 'UTC')
           and e.occurred_at <  ((m.batch_day + 1)::timestamp at time zone 'UTC')
           and e.seq <= m.last_seq;
        if v_count <> m.row_count then
          bad := m.last_seq; v_note := 'manifest row count differs for ' || m.batch_day; exit;
        end if;
        select e.hash into v_head from private.console_audit_event e where e.seq = m.last_seq;
        if v_head is distinct from m.head_hash then
          bad := m.last_seq; v_note := 'manifest head hash differs for ' || m.batch_day; exit;
        end if;
      end if;
    end loop;
  end if;

  insert into private.console_audit_verification (ok, rows_checked, first_bad_seq, note)
  values (bad is null, n, bad, v_note);

  return query select (bad is null), n, bad;
end $$;

revoke all on function private.console_audit_verify() from public, anon, authenticated;
grant execute on function private.console_audit_verify() to service_role;

comment on table private.console_audit_event is
  'The operations console''s append-only, hash-chained audit archive. Written only through private.console_audit_write() as semester_audit_writer; never swept.';
comment on table private.console_audit_manifest is
  'One HMAC-signed manifest per UTC day of console audit events: bounds, count and head hash. Insert-only; a day cannot be re-sealed differently.';
comment on table private.console_audit_verification is
  'Every run of private.console_audit_verify(), good or bad. Insert-only.';

-- ── Reading the chain, and logging the read ───────────────────────────────
--
-- The only path from a client to the rows. It requires `console:operate`
-- (not `audit:read`, which is a tenant's word for its own events — see
-- section 1), and before returning anything it
-- writes an `audit.read` event naming the caller and what they asked for —
-- through `console_audit_write`, so if the read cannot be recorded it cannot
-- happen. The recording is the newest row, so it is in the result the
-- caller sees: reading the log shows you reading the log.

create or replace function public.console_audit_read(
  since      timestamptz default (now() - interval '30 days'),
  want_limit int         default 200
)
returns table (
  seq bigint, occurred_at timestamptz, actor uuid, actor_kind text, tenant_id text,
  action text, target text, detail jsonb, correlation_id text, hash text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  n int := least(greatest(coalesce(want_limit, 200), 1), 1000);
begin
  if caller is null or not private.has_capability('console:operate') then
    raise exception using errcode = '42501', message = 'console:operate is required.';
  end if;

  perform private.console_audit_write(
    caller, 'authenticated', null, 'audit.read', null,
    jsonb_build_object('since', since, 'limit', n), null);

  return query
    select e.seq, e.occurred_at, e.actor, e.actor_kind, e.tenant_id,
           e.action, e.target, e.detail, e.correlation_id, e.hash
      from private.console_audit_event e
     where e.occurred_at >= since
     order by e.seq desc
     limit n;
end $$;

revoke all on function public.console_audit_read(timestamptz, int) from public, anon;
grant execute on function public.console_audit_read(timestamptz, int) to authenticated;

-- The chain's state, for the console's Audit view: how long it is, its
-- head, when it was last sealed, and when it was last verified and whether
-- that was fine. Six numbers and no rows, for anybody who may open the
-- console; the rows themselves take the read above.
create or replace function public.console_audit_status()
returns table (
  rows bigint, last_seq bigint, head_hash text, last_sealed date,
  last_verified_at timestamptz, last_verified_ok boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_capability('console:operate') then
    raise exception using errcode = '42501', message = 'console:operate is required.';
  end if;
  return query
    select (select count(*) from private.console_audit_event),
           (select max(e.seq) from private.console_audit_event e),
           (select e.hash from private.console_audit_event e order by e.seq desc limit 1),
           (select max(m.batch_day) from private.console_audit_manifest m),
           (select v.ran_at from private.console_audit_verification v order by v.ran_at desc limit 1),
           (select v.ok from private.console_audit_verification v order by v.ran_at desc limit 1);
end $$;

revoke all on function public.console_audit_status() from public, anon;
grant execute on function public.console_audit_status() to authenticated;

comment on function public.console_audit_read(timestamptz, int) is
  'The console''s audit rows, newest first, for console:operate. Writes an audit.read event before returning, so every read is in the chain.';
comment on function public.console_audit_status() is
  'Length, head, last seal and last verification of the console audit chain, for console:operate.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · Demo separation (row 13)
--
-- A demo tenant is a school flagged as one. The console's read functions —
-- the figures below, `console_customers` and the approval readers in B —
-- leave demo rows out unless `include_demo := true` is passed, so a
-- production screen never shows an illustrative record beside a real one.
-- The flag is set by the service role only: there is no write policy on
-- `schools`, so a client cannot flip it.

alter table public.schools add column if not exists is_demo boolean not null default false;

comment on column public.schools.is_demo is
  'A demo tenant holding synthetic data. Every console read leaves its rows out unless asked for them with include_demo := true.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 8 · Figures with provenance (row 9)
--
-- The prototype showed numbers. A number on an operations console is a claim,
-- and a claim without its source, window, owner, refresh time, evidence and
-- known limitation is one nobody can check — which on a console is the same
-- as one nobody should act on. So each figure is a row carrying all of them,
-- and each `value` is the result of a real query against the table it
-- names. `value` is text so that "none" and "not applicable" are honest
-- answers rather than zeros.
--
-- Billing is the row that must not be a number. Semester takes no payments
-- (D-009); there is no payment provider to read from, and a figure that
-- pretended otherwise would be the console faking exactly what the
-- prototype faked. It says so, with its source.
--
-- Migration B replaces this function (`create or replace`) to add its own
-- rows — open approvals, active break-glass, customers, expiring contracts —
-- and copies the rows below verbatim. A's file cannot reference B's tables.
--
-- `owner_seat` is one of the ten council seats, so a figure that is wrong
-- has a person whose figure it is.

create or replace function public.console_figures(include_demo boolean default false)
returns table (
  figure text, value text, source text, time_window text, owner_seat text,
  refreshed_at timestamptz, evidence text, limitation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  refreshed timestamptz := now();
begin
  if auth.uid() is null or not private.has_capability('console:operate') then
    raise exception using errcode = '42501', message = 'console:operate is required.';
  end if;

  return query
  select 'audit-events'::text,
         (select count(*) from private.console_audit_event)::text,
         'private.console_audit_event'::text,
         'all time'::text, 'security'::text, refreshed,
         'supabase/console-control-plane.check.sql'::text,
         'A length, not an integrity check; audit-verified is the figure that says the chain holds'::text
  union all
  select 'audit-verified',
         coalesce((select case when v.ok then 'ok' else 'BROKEN at seq ' || coalesce(v.first_bad_seq::text, '?') end
                          || ' at ' || to_char(v.ran_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
                     from private.console_audit_verification v order by v.ran_at desc limit 1), 'never'),
         'private.console_audit_verification',
         'last run', 'security', refreshed,
         'supabase/console-control-plane.check.sql',
         'Verified nightly by the console-audit-integrity job; between runs a break is not yet known'
  union all
  select 'role-grants-live',
         (select count(*) from public.role_grants g
           where g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
             and (include_demo or not exists (
               select 1 from public.schools s where s.is_demo and g.scope_kind = 'school' and g.scope_id = s.id)))::text,
         'public.role_grants',
         'now', 'security', refreshed,
         'supabase/role-grant-audit.check.sql',
         'Every scope and every provenance; a grant over a demo tenant is left out unless include_demo'
  union all
  select 'seat-holders',
         (select count(*) from public.council_seat_holder h where h.ended_at is null)::text,
         'public.council_seat_holder',
         'now', 'founder', refreshed,
         'supabase/console-control-plane.check.sql',
         'People holding a seat, not seats filled: one person may hold two'
  union all
  select 'support-grants-active',
         (select count(*) from public.support_access_grant g
           where g.revoked_at is null and g.expires_at > now()
             and (include_demo or not exists (
               select 1 from public.schools s where s.is_demo and s.id = g.tenant_id)))::text,
         'public.support_access_grant',
         'now', 'privacy', refreshed,
         'supabase/support-access.check.sql',
         'Grants a student has opened and not revoked; whether the supporter still holds support:read is checked at each read, not here'
  union all
  select 'schools',
         (select count(*) from public.schools s where include_demo or not s.is_demo)::text,
         'public.schools',
         'now', 'success', refreshed,
         'supabase/schools.check.sql',
         'The directory, not the customers: a school listed here may have nobody enrolled'
  union all
  select 'gateway-health',
         coalesce((select to_char(p.touched_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC'
                     from private.gateway_health_probe p), 'never'),
         'private.gateway_health_probe',
         'last write', 'engineering', refreshed,
         'supabase/gateway-journal.check.sql',
         'When the gateway last proved it could write; not uptime, and not the status page'
  union all
  select 'billing',
         'not applicable',
         'docs/DECISION-LOG.md D-009',
         'not applicable', 'founder', refreshed,
         'docs/DECISION-LOG.md',
         'Semester takes no payments; no payment provider exists to read from';
end $$;

revoke all on function public.console_figures(boolean) from public, anon;
grant execute on function public.console_figures(boolean) to authenticated;

comment on function public.console_figures(boolean) is
  'The console''s figures, each from a real query with source, window, owner seat, refresh time, evidence and known limitation. Demo tenants are left out unless include_demo. Billing is not applicable (D-009).';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Nothing here changes a table that carries a student's work; the one
-- column added to `schools` defaults false and is read only by these
-- functions. The audit tables are the part to think about: dropping them
-- destroys the archive, which is the thing this file exists to protect, so a
-- rollback keeps them and removes only what reads and writes them.
--
--   begin;
--   drop function if exists public.console_figures(boolean);
--   drop function if exists public.console_audit_status();
--   drop function if exists public.console_audit_read(timestamptz, int);
--   drop function if exists private.console_audit_verify();
--   drop function if exists private.console_audit_seal(date);
--   drop function if exists private.console_audit_write(uuid, text, text, text, text, jsonb, text);
--   -- private.console_audit_event, _key, _manifest and _verification stay.
--   drop function if exists private.party_held(text);
--   drop table if exists public.console_duty;
--   drop function if exists private.assert_fresh_mfa();
--   drop function if exists private.mfa_fresh(interval);
--   drop function if exists private.holds_seat(text);
--   drop table if exists public.council_seat_holder;
--   drop table if exists public.operator_preference;
--   alter table public.schools drop column if exists is_demo;
--   delete from public.role_capabilities where capability in ('console:operate', 'approval:decide', 'breakglass:request');
--   delete from public.app_capabilities where capability in ('console:operate', 'approval:decide', 'breakglass:request');
--   commit;
