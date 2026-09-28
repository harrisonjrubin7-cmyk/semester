-- Semester — the operations console's writes: approvals, the fail-closed
-- action, break-glass, and the commercial core.
--
-- The second of two console migrations. `20260929100000_console_control_plane.sql`
-- laid the control plane: capabilities, seats, `console_duty`, fresh-MFA and
-- party predicates, and the hash-chained audit table with its separate writer
-- role. This file is what those exist for, and serves these rows of the
-- console register (`app/src/lib/ops/console.ts`, CAPABILITIES):
--
--   6  fail-closed       `console_act` writes its audit event through
--                        `private.console_audit_write` before it touches
--                        anything, in one function body, and never catches.
--                        If the audit row cannot be written the whole call
--                        fails and no effect happens. `console-approvals.check.sql`
--                        proves it with the writer's INSERT revoked.
--   7  two-person        `approval_request` / `approval_decision`, decided
--                        by `decide_approval`: self-approval refused on the
--                        server, a two-person duty needs two distinct
--                        approvers, and each approver must hold one of the
--                        duty's approver parties.
--   8  commercial-core   `customer`, `customer_commitment`, `customer_contract`
--                        — tenant-scoped rows, read under a policy, written
--                        by nobody through the browser.
--  11  break-glass       `break_glass_grant`, opened only by `console_act` on
--                        the two-person `break-glass` duty, expiring within
--                        four hours, closed by its subject, reviewed by
--                        someone else, and an unreviewed overdue grant blocks
--                        the next one.
--   9  figures           `console_figures` is replaced with the control
--                        plane's rows kept and four added: approvals-open,
--                        break-glass-active, customers-active and
--                        contracts-expiring-90d.
--
-- ## The order inside a write, and why it is not negotiable
--
-- Every writer here does the same three things in the same order: check who
-- is asking, write the audit event, then do the thing. The audit write is
-- `private.console_audit_write`, which runs as `semester_audit_writer` — the
-- one role with INSERT on the event table — and raises rather than returning
-- when it cannot insert. Nothing here wraps it in an exception block. A
-- caught audit failure is an unaudited write with a log line about it, which
-- is the exact failure the fail-closed row exists to rule out.
--
-- ## Who writes what
--
-- The browser writes nothing to these tables directly. Every table below has
-- a SELECT policy and no INSERT, UPDATE or DELETE policy at all; the client
-- roles hold no write privilege either, so a policy that came back by
-- accident would still find nothing to permit. Requests, decisions, actions
-- and break-glass grants arrive through the definer functions; customers,
-- commitments and contracts are recorded by whoever operates Semester, with
-- the service key, the way `tenant_plan` is. The console shows them; it does
-- not edit them.
--
-- ## Demo separation
--
-- `public.schools.is_demo` marks the demo tenant. The three readers here
-- (`console_approvals`, `console_break_glass`, `console_customers`) leave demo
-- rows out unless `include_demo := true` is passed, so production never shows
-- an illustrative record by default. The figures do the same.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Approval requests ──────────────────────────────────────────────────

create table if not exists public.approval_request (
  id             uuid        primary key default gen_random_uuid(),
  duty_id        text        not null references public.console_duty (id),
  -- Cascade rather than set null: a request is the requester's own act, and
  -- the audit chain in `private.console_audit_event` keeps the event of it
  -- whatever happens to this row.
  requester      uuid        not null references auth.users (id) on delete cascade,
  tenant_id      text        references public.schools (id) on delete cascade,
  target         text        check (target is null or length(target) <= 400),
  detail         jsonb       not null default '{}'::jsonb,
  -- The duty's evidence requirement is not a suggestion: a request with no
  -- evidence is refused by the table, not by a screen.
  evidence       text        not null check (length(trim(evidence)) > 0),
  ticket         text        not null check (ticket ~ '^[A-Za-z0-9._:-]{3,80}$'),
  status         text        not null default 'pending'
                             check (status in ('pending', 'approved', 'rejected', 'executed', 'expired')),
  correlation_id text        check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '7 days',
  decided_at     timestamptz,
  executed_at    timestamptz
);

create index if not exists approval_request_by_duty on public.approval_request (duty_id);
create index if not exists approval_request_by_requester on public.approval_request (requester);
create index if not exists approval_request_by_tenant on public.approval_request (tenant_id);
create index if not exists approval_request_by_status on public.approval_request (status, created_at desc);

alter table public.approval_request enable row level security;
revoke all on table public.approval_request from public;
revoke all on table public.approval_request from anon, authenticated;
grant select on table public.approval_request to authenticated;

-- What was asked cannot be edited into something else after the fact. The
-- lifecycle columns (status, the two timestamps) move through the functions.
drop trigger if exists approval_request_pinned on public.approval_request;
create trigger approval_request_pinned before update on public.approval_request
  for each row execute function private.refuse_column_change(
    'id', 'duty_id', 'requester', 'tenant_id', 'target', 'detail', 'evidence',
    'ticket', 'correlation_id', 'created_at', 'expires_at');

-- ── 2. Decisions ──────────────────────────────────────────────────────────

create table if not exists public.approval_decision (
  request_id uuid        not null references public.approval_request (id) on delete cascade,
  approver   uuid        not null references auth.users (id) on delete cascade,
  decision   text        not null check (decision in ('approve', 'reject')),
  -- Which of the duty's approver parties the approver held when they decided:
  -- a seat, or `role:<role>`. Recorded so the review can ask "as what?"
  as_party   text        not null,
  decided_at timestamptz not null default now(),
  -- One decision per person per request. A second attempt by the same
  -- approver is a primary-key violation, which is what stops one person
  -- approving twice to satisfy a two-person duty.
  primary key (request_id, approver)
);

create index if not exists approval_decision_by_approver on public.approval_decision (approver);

alter table public.approval_decision enable row level security;
revoke all on table public.approval_decision from public;
revoke all on table public.approval_decision from anon, authenticated;
grant select on table public.approval_decision to authenticated;

drop trigger if exists approval_decision_pinned on public.approval_decision;
create trigger approval_decision_pinned before update on public.approval_decision
  for each row execute function private.refuse_column_change(
    'request_id', 'approver', 'decision', 'as_party', 'decided_at');

-- ── 3. What an action left behind ─────────────────────────────────────────
--
-- Duties whose effect is not a row in another table (a release, a policy
-- change, an evidence release) leave one of these. It is the effect, not the
-- audit: the audit event was written first, in `private.console_audit_event`.

create table if not exists public.console_action_record (
  id         uuid        primary key default gen_random_uuid(),
  request_id uuid        not null references public.approval_request (id) on delete cascade,
  duty_id    text        not null references public.console_duty (id),
  -- Set null, not cascade: the record outlives the operator's account, with
  -- the operator no longer named. The audit chain still names them by id.
  actor      uuid        references auth.users (id) on delete set null,
  tenant_id  text        references public.schools (id) on delete cascade,
  target     text,
  detail     jsonb       not null default '{}'::jsonb,
  acted_at   timestamptz not null default now()
);

create index if not exists console_action_record_by_request on public.console_action_record (request_id);
create index if not exists console_action_record_by_duty on public.console_action_record (duty_id);
create index if not exists console_action_record_by_actor on public.console_action_record (actor);
create index if not exists console_action_record_by_tenant on public.console_action_record (tenant_id);

alter table public.console_action_record enable row level security;
revoke all on table public.console_action_record from public;
revoke all on table public.console_action_record from anon, authenticated;
grant select on table public.console_action_record to authenticated;

-- Append-only in the one way `erase_account` can still walk: every column is
-- pinned except `actor`, which may go null exactly once, for an account that
-- is leaving (`private.person_pinned_unless_leaving`). A trigger that refused
-- every UPDATE would make a staff account unerasable, which is the state the
-- four history tables in 20260929010000 are in and this one need not be.
drop trigger if exists console_action_record_pinned on public.console_action_record;
create trigger console_action_record_pinned before update on public.console_action_record
  for each row execute function private.refuse_column_change(
    'id', 'request_id', 'duty_id', 'tenant_id', 'target', 'detail', 'acted_at');
drop trigger if exists console_action_record_actor_pinned on public.console_action_record;
create trigger console_action_record_actor_pinned before update on public.console_action_record
  for each row execute function private.person_pinned_unless_leaving('actor');

-- ── 4. Break-glass grants ─────────────────────────────────────────────────

create table if not exists public.break_glass_grant (
  id          uuid        primary key default gen_random_uuid(),
  request_id  uuid        not null references public.approval_request (id) on delete cascade,
  subject     uuid        not null references auth.users (id) on delete cascade,
  tenant_id   text        not null references public.schools (id) on delete cascade,
  ticket      text        not null check (ticket ~ '^[A-Za-z0-9._:-]{3,80}$'),
  -- What the access is: the capabilities it confers over the tenant, as a
  -- space-separated list of `public.app_capabilities` names. Break-glass
  -- widens who, never what — the scope is what the two approvers approved,
  -- and `private.has_capability` grants exactly these, for exactly this
  -- tenant, while the grant is open. Free text here would be a grant of
  -- nothing (the fault the first version of this table had).
  scope       text        not null check (scope ~ '^[a-z_]+:[a-z_]+( [a-z_]+:[a-z_]+)*$' and length(scope) <= 400),
  opened_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  closed_at   timestamptz,
  review_due  timestamptz not null,
  reviewed_by uuid        references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text        check (review_note is null or length(review_note) <= 2000),
  -- Break-glass widens who, never for how long: four hours from opening, and
  -- the review is due no earlier than the access ends.
  constraint break_glass_expiry_within_four_hours check (expires_at <= opened_at + interval '4 hours'),
  constraint break_glass_expiry_after_opening check (expires_at > opened_at),
  constraint break_glass_review_after_expiry check (review_due >= expires_at),
  constraint break_glass_review_complete check ((reviewed_by is null) = (reviewed_at is null))
);

create index if not exists break_glass_grant_by_request on public.break_glass_grant (request_id);
create index if not exists break_glass_grant_by_subject on public.break_glass_grant (subject);
create index if not exists break_glass_grant_by_tenant on public.break_glass_grant (tenant_id);
create index if not exists break_glass_grant_by_reviewer on public.break_glass_grant (reviewed_by);

alter table public.break_glass_grant enable row level security;
revoke all on table public.break_glass_grant from public;
revoke all on table public.break_glass_grant from anon, authenticated;
grant select on table public.break_glass_grant to authenticated;

-- What was opened, for whom, on what, and until when, cannot be edited
-- afterwards; closing and reviewing are the only changes, through the two
-- functions below.
drop trigger if exists break_glass_grant_pinned on public.break_glass_grant;
create trigger break_glass_grant_pinned before update on public.break_glass_grant
  for each row execute function private.refuse_column_change(
    'id', 'request_id', 'subject', 'tenant_id', 'ticket', 'scope', 'opened_at',
    'expires_at', 'review_due');

-- ── 5. The commercial core ────────────────────────────────────────────────
--
-- One customer per tenant; what was promised to it and what was signed with
-- it. `commitment_id` is the id of a row in `app/src/lib/ops/commitments.ts`,
-- kept as text: the register is the vocabulary and this table is the fact.

create table if not exists public.customer (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null unique references public.schools (id) on delete cascade,
  legal_name text        check (legal_name is null or length(trim(legal_name)) between 1 and 200),
  status     text        not null default 'prospect'
                         check (status in ('prospect', 'pilot', 'active', 'suspended', 'ended')),
  owner_seat text        check (owner_seat is null or owner_seat in (
                           'founder', 'product', 'engineering', 'security', 'privacy',
                           'accessibility', 'success', 'trust', 'data', 'champion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_commitment (
  id            uuid        primary key default gen_random_uuid(),
  customer_id   uuid        not null references public.customer (id) on delete cascade,
  commitment_id text        not null check (length(trim(commitment_id)) between 1 and 120),
  status        text        not null default 'promised'
                            check (status in ('promised', 'met', 'missed', 'withdrawn')),
  due_on        date,
  evidence      text        check (evidence is null or length(evidence) <= 1000),
  updated_at    timestamptz not null default now()
);

create table if not exists public.customer_contract (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customer (id) on delete cascade,
  kind         text not null check (kind in ('pilot-agreement', 'order-form', 'dpa', 'sla', 'nda')),
  signed_on    date,
  starts_on    date,
  ends_on      date,
  document_ref text check (document_ref is null or length(document_ref) <= 400),
  constraint customer_contract_ends_after_start
    check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- `customer.tenant_id` is covered by its unique constraint; the children need
-- one each (`indexes.check.sql`).
create index if not exists customer_commitment_by_customer on public.customer_commitment (customer_id);
create index if not exists customer_contract_by_customer on public.customer_contract (customer_id);
create index if not exists customer_contract_by_end on public.customer_contract (ends_on);

alter table public.customer enable row level security;
alter table public.customer_commitment enable row level security;
alter table public.customer_contract enable row level security;
revoke all on table public.customer, public.customer_commitment, public.customer_contract from public;
revoke all on table public.customer, public.customer_commitment, public.customer_contract from anon, authenticated;
grant select on table public.customer, public.customer_commitment, public.customer_contract to authenticated;

-- Written by the service role only. There is deliberately no insert, update
-- or delete policy on any of the three: a school administrator holding
-- `tenant:configure` can read the record of their own institution and cannot
-- promote it to `active`, extend a contract or mark a commitment met.

-- ── 6. Predicates ─────────────────────────────────────────────────────────

-- The first of a duty's approver parties the caller holds, or null. `private`
-- because the read policies below call it and a client must not be able to
-- ask it about arbitrary duties from a URL; a policy is evaluated as the
-- querying role, so `authenticated` may execute it and nobody else.
create or replace function private.approver_party(want_duty text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p
    from public.console_duty d
    cross join unnest(d.approvers) with ordinality as a(p, ord)
   where d.id = want_duty
     and private.party_held(p)
   order by a.ord
   limit 1;
$$;
revoke all on function private.approver_party(text) from public, anon;
grant execute on function private.approver_party(text) to authenticated;

-- Opened, not closed, not expired.
create or replace function private.break_glass_active(want_subject uuid, want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.break_glass_grant g
     where g.subject = want_subject
       and g.tenant_id = want_tenant
       and g.closed_at is null
       and g.expires_at > now()
  );
$$;
revoke all on function private.break_glass_active(uuid, text) from public, anon, authenticated;

-- A break-glass scope names capabilities, every one of them real. Checked at
-- request time (so the refusal reaches the requester before an approver
-- spends time) and again when the grant is opened.
create or replace function private.assert_break_glass_scope(want_scope text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing text;
begin
  if want_scope is null or want_scope !~ '^[a-z_]+:[a-z_]+( [a-z_]+:[a-z_]+)*$' then
    raise exception 'Break-glass needs a scope (detail.scope): the capabilities it confers, space-separated, such as tenant:configure integration:view.';
  end if;
  select string_agg(c, ', ') into missing
    from unnest(string_to_array(want_scope, ' ')) as c
   where not exists (select 1 from public.app_capabilities a where a.capability = c);
  if missing is not null then
    raise exception 'Break-glass scope names capabilities that do not exist: %.', missing;
  end if;
end $$;
revoke all on function private.assert_break_glass_scope(text) from public, anon, authenticated;

-- ── What a break-glass grant does ──────────────────────────────────────────
--
-- `private.has_capability` is the one predicate every tenant policy asks, so
-- it is where a break-glass grant has to be heard, or the grant is a row the
-- console reports and nothing obeys. Redefined here, after the table exists,
-- with the original path from 20260922012000_capabilities.sql unchanged and
-- one more: an open, unexpired grant held by the caller over this tenant
-- whose scope names the wanted capability. School scope only — break-glass
-- is access to a production tenant, never to the platform — and never a
-- capability the scope does not name: the widening is who, not what.
create or replace function private.has_capability(
  want_capability text,
  want_scope_kind text default 'platform',
  want_scope_id   text default ''
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
     where g.subject = (select auth.uid())
       and rc.capability = want_capability
       and g.scope_kind = want_scope_kind
       and g.scope_id = want_scope_id
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  )
  or (
    want_scope_kind = 'school'
    and exists (
      select 1
        from public.break_glass_grant b
       where b.subject = (select auth.uid())
         and b.tenant_id = want_scope_id
         and b.closed_at is null
         and b.expires_at > now()
         and want_capability = any (string_to_array(b.scope, ' '))
    )
  );
$$;

-- A grant whose review is overdue and has not happened. While one exists for
-- a person, no new break-glass request of theirs can be approved: the review
-- is the price of the last one.
create or replace function private.break_glass_review_overdue(want_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.break_glass_grant g
     where g.subject = want_subject
       and g.reviewed_at is null
       and g.review_due < now()
  );
$$;
revoke all on function private.break_glass_review_overdue(uuid) from public, anon, authenticated;

-- ── 7. Who reads what ─────────────────────────────────────────────────────

drop policy if exists "operators, requesters and approvers read requests" on public.approval_request;
create policy "operators, requesters and approvers read requests" on public.approval_request
  for select to authenticated
  using (
    private.has_capability('console:operate')
    or requester = (select auth.uid())
    or private.approver_party(duty_id) is not null
  );

drop policy if exists "operators, requesters and approvers read decisions" on public.approval_decision;
create policy "operators, requesters and approvers read decisions" on public.approval_decision
  for select to authenticated
  using (
    private.has_capability('console:operate')
    or approver = (select auth.uid())
    or exists (
      select 1 from public.approval_request r
       where r.id = request_id
         and (r.requester = (select auth.uid()) or private.approver_party(r.duty_id) is not null)
    )
  );

drop policy if exists "operators and actors read action records" on public.console_action_record;
create policy "operators and actors read action records" on public.console_action_record
  for select to authenticated
  using (private.has_capability('console:operate') or actor = (select auth.uid()));

drop policy if exists "operators and subjects read break-glass grants" on public.break_glass_grant;
create policy "operators and subjects read break-glass grants" on public.break_glass_grant
  for select to authenticated
  using (private.has_capability('console:operate') or subject = (select auth.uid()));

-- Platform operators read every customer; a school's own administrator reads
-- their own. Nobody else sees that a school is a customer at all.
drop policy if exists "operators and the tenant read the customer" on public.customer;
create policy "operators and the tenant read the customer" on public.customer
  for select to authenticated
  using (
    private.has_capability('console:operate')
    or private.has_capability('tenant:configure', 'school', tenant_id)
  );

drop policy if exists "operators and the tenant read commitments" on public.customer_commitment;
create policy "operators and the tenant read commitments" on public.customer_commitment
  for select to authenticated
  using (
    private.has_capability('console:operate')
    or exists (
      select 1 from public.customer c
       where c.id = customer_id
         and private.has_capability('tenant:configure', 'school', c.tenant_id)
    )
  );

drop policy if exists "operators and the tenant read contracts" on public.customer_contract;
create policy "operators and the tenant read contracts" on public.customer_contract
  for select to authenticated
  using (
    private.has_capability('console:operate')
    or exists (
      select 1 from public.customer c
       where c.id = customer_id
         and private.has_capability('tenant:configure', 'school', c.tenant_id)
    )
  );

-- ── 8. Requesting ─────────────────────────────────────────────────────────

create or replace function public.request_approval(
  want_duty        text,
  want_tenant      text,
  want_target      text,
  want_detail      jsonb,
  want_evidence    text,
  want_ticket      text,
  want_correlation text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  duty   public.console_duty%rowtype;
  made   uuid := gen_random_uuid();
  detail jsonb := coalesce(want_detail, '{}'::jsonb);
  until  timestamptz;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into duty from public.console_duty d where d.id = want_duty;
  if not found then
    raise exception 'No such duty: %', want_duty;
  end if;
  -- The duty says who may ask. `student` is never held through the console
  -- (`private.party_held`), so a student-approved duty cannot be requested
  -- here at all: that path is the student's own grant, not an operator's.
  if not private.party_held(duty.requester) then
    raise exception 'You do not hold the party that requests "%": %.', duty.id, duty.requester
      using errcode = '42501';
  end if;
  if coalesce(length(trim(want_evidence)), 0) = 0 then
    raise exception 'Evidence is required: %', duty.evidence;
  end if;
  if want_ticket is null or want_ticket !~ '^[A-Za-z0-9._:-]{3,80}$' then
    raise exception 'A ticket reference is required.';
  end if;
  if want_tenant is not null and not exists (select 1 from public.schools s where s.id = want_tenant) then
    raise exception 'No such tenant: %', want_tenant;
  end if;
  if duty.id in ('tenant-suspension', 'break-glass') and want_tenant is null then
    raise exception 'Name the tenant.';
  end if;
  if duty.id = 'break-glass' then
    -- Requesting break-glass is itself a capability (`breakglass:request`),
    -- on top of the engineering seat the duty names.
    if not private.has_capability('breakglass:request') then
      raise exception 'You cannot request break-glass access.' using errcode = '42501';
    end if;
    -- The expiry is checked at request time as well as by the table, so the
    -- refusal reaches the requester before an approver spends time on it.
    until := (detail ->> 'expires_at')::timestamptz;
    if until is null then
      raise exception 'Break-glass needs an expiry (detail.expires_at), no later than four hours from now.';
    end if;
    if until > now() + interval '4 hours' then
      raise exception 'Break-glass access cannot last more than four hours.';
    end if;
    if until <= now() then
      raise exception 'The break-glass expiry is already past.';
    end if;
    -- The scope is the capabilities the access confers, and every one must
    -- exist, so that what the approvers read is what the grant will do.
    perform private.assert_break_glass_scope(detail ->> 'scope');
  end if;

  -- The audit event first. If this raises, nothing below runs.
  perform private.console_audit_write(
    me, 'authenticated', want_tenant, 'approval.requested', made::text,
    jsonb_build_object('duty', duty.id, 'ticket', want_ticket, 'target', want_target,
                       'two_person', duty.two_person),
    want_correlation);

  insert into public.approval_request
    (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, correlation_id)
  values
    (made, duty.id, me, want_tenant, want_target, detail, trim(want_evidence), want_ticket, want_correlation);
  return made;
end;
$$;
revoke all on function public.request_approval(text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.request_approval(text, text, text, jsonb, text, text, text) to authenticated;

-- ── 9. Deciding ───────────────────────────────────────────────────────────

create or replace function public.decide_approval(want_request uuid, want_decision text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := auth.uid();
  req       public.approval_request%rowtype;
  duty      public.console_duty%rowtype;
  party     text;
  approvals integer;
  becomes   text;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  if want_decision not in ('approve', 'reject') then
    raise exception 'A decision is approve or reject.';
  end if;
  select * into req from public.approval_request r where r.id = want_request for update;
  if not found then
    raise exception 'No such request.' using errcode = '42501';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request is already %.', req.status;
  end if;
  if req.expires_at <= now() then
    raise exception 'This request expired on % and cannot be decided.', req.expires_at;
  end if;
  -- The rule the office action feed already has (20260928302000): nobody
  -- approves their own. Checked before the party, so a requester who also
  -- holds an approver seat hears this and not a permission message.
  if req.requester = me then
    raise exception 'Self-approval is refused.' using errcode = '42501';
  end if;
  select * into duty from public.console_duty d where d.id = req.duty_id;
  party := private.approver_party(duty.id);
  if party is null then
    raise exception 'You hold none of the parties that approve "%": %.', duty.id,
      array_to_string(duty.approvers, ', ') using errcode = '42501';
  end if;
  if duty.id = 'break-glass' and want_decision = 'approve'
     and private.break_glass_review_overdue(req.requester) then
    raise exception 'The requester has a break-glass grant whose post-use review is overdue. Review it first.'
      using errcode = '42501';
  end if;

  perform private.console_audit_write(
    me, 'authenticated', req.tenant_id, 'approval.decided', req.id::text,
    jsonb_build_object('duty', duty.id, 'decision', want_decision, 'as_party', party,
                       'ticket', req.ticket),
    req.correlation_id);

  -- A second decision by the same approver is refused by the primary key.
  insert into public.approval_decision (request_id, approver, decision, as_party)
  values (req.id, me, want_decision, party);

  if want_decision = 'reject' then
    becomes := 'rejected';
  else
    select count(distinct d.approver) into approvals
      from public.approval_decision d
     where d.request_id = req.id and d.decision = 'approve';
    becomes := case when approvals >= (case when duty.two_person then 2 else 1 end)
                    then 'approved' else 'pending' end;
  end if;

  if becomes <> 'pending' then
    update public.approval_request
       set status = becomes, decided_at = now()
     where id = req.id;
  end if;
  return becomes;
end;
$$;
revoke all on function public.decide_approval(uuid, text) from public, anon;
grant execute on function public.decide_approval(uuid, text) to authenticated;

-- ── 10. The fail-closed action ────────────────────────────────────────────
--
-- One function body, three steps, no exception handler:
--
--   1. the audit event `console.act`, through the writer role. A raise here
--      is the end of the call;
--   2. the duty's effect — a role grant, a tenant suspension, a break-glass
--      grant, or an action record;
--   3. the request marked executed.
--
-- The caller must hold `console:operate`, have fresh MFA, and be the
-- requester or one of the approvers of an approved, unexpired request.

create or replace function public.console_act(want_request uuid, want_correlation text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := auth.uid();
  req       public.approval_request%rowtype;
  duty      public.console_duty%rowtype;
  seq       bigint;
  effect    jsonb;
  grant_id  uuid;
  record_id uuid;
  until     timestamptz;
  due       timestamptz;
begin
  if me is null or not private.has_capability('console:operate') then
    raise exception 'The operations console is not open to you.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  select * into req from public.approval_request r where r.id = want_request for update;
  if not found then
    raise exception 'No such request.' using errcode = '42501';
  end if;
  if req.status <> 'approved' then
    raise exception 'This request is %, not approved.', req.status;
  end if;
  if req.expires_at <= now() then
    raise exception 'This approval expired on %.', req.expires_at;
  end if;
  if req.requester <> me and not exists (
       select 1 from public.approval_decision d
        where d.request_id = req.id and d.approver = me and d.decision = 'approve') then
    raise exception 'Only the requester or an approver may act on this request.' using errcode = '42501';
  end if;
  select * into duty from public.console_duty d where d.id = req.duty_id;

  -- (1) The audit event. Not wrapped, not caught, not optional.
  seq := private.console_audit_write(
    me, 'authenticated', req.tenant_id, 'console.act', req.id::text,
    jsonb_build_object('duty', duty.id, 'ticket', req.ticket, 'target', req.target,
                       'detail', req.detail),
    coalesce(want_correlation, req.correlation_id));

  -- (2) The effect.
  if duty.id = 'role-grant' then
    if req.detail ->> 'subject' is null or req.detail ->> 'role' is null
       or req.detail ->> 'scope_kind' is null then
      raise exception 'A role grant names a subject, a role and a scope.';
    end if;
    insert into public.role_grants
      (subject, role, scope_kind, scope_id, provenance, granted_by, expires_at)
    values
      ((req.detail ->> 'subject')::uuid, req.detail ->> 'role', req.detail ->> 'scope_kind',
       coalesce(req.detail ->> 'scope_id', ''), 'platform', req.requester,
       (req.detail ->> 'expires_at')::timestamptz)
    on conflict on constraint role_grants_one_per_scope do update
      set revoked_at = null,
          expires_at = excluded.expires_at,
          granted_by = excluded.granted_by,
          granted_at = now(),
          provenance = 'platform'
    returning id into grant_id;
    effect := jsonb_build_object('role_grant', grant_id);

  elsif duty.id = 'tenant-suspension' then
    update public.tenant_plan
       set status = 'suspended',
           updated_by = me,
           updated_at = now(),
           reason = left(format('Suspended by console request %s (%s)', req.id, req.ticket), 1000)
     where tenant_id = req.tenant_id;
    if not found then
      raise exception 'No plan is recorded for %, so there is nothing to suspend.', req.tenant_id;
    end if;
    effect := jsonb_build_object('tenant_plan', req.tenant_id, 'status', 'suspended');

  elsif duty.id = 'break-glass' then
    until := (req.detail ->> 'expires_at')::timestamptz;
    due := coalesce((req.detail ->> 'review_due')::timestamptz, until + interval '1 day');
    grant_id := gen_random_uuid();
    -- Opening is audited in its own right, before the row exists.
    perform private.console_audit_write(
      req.requester, 'authenticated', req.tenant_id, 'breakglass.opened', grant_id::text,
      jsonb_build_object('request', req.id, 'ticket', req.ticket, 'expires_at', until,
                         'review_due', due, 'opened_by', me),
      coalesce(want_correlation, req.correlation_id));
    perform private.assert_break_glass_scope(req.detail ->> 'scope');
    insert into public.break_glass_grant
      (id, request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
    values
      (grant_id, req.id, req.requester, req.tenant_id, req.ticket,
       req.detail ->> 'scope', until, due);
    effect := jsonb_build_object('break_glass_grant', grant_id, 'expires_at', until);

  else
    insert into public.console_action_record
      (request_id, duty_id, actor, tenant_id, target, detail)
    values
      (req.id, duty.id, me, req.tenant_id, req.target, req.detail)
    returning id into record_id;
    effect := jsonb_build_object('action_record', record_id);
  end if;

  -- (3) Done.
  update public.approval_request
     set status = 'executed', executed_at = now()
   where id = req.id;

  return jsonb_build_object(
    'request', req.id, 'duty', duty.id, 'status', 'executed',
    'audit_seq', seq, 'effect', effect);
end;
$$;
revoke all on function public.console_act(uuid, text) from public, anon;
grant execute on function public.console_act(uuid, text) to authenticated;

-- ── 11. Closing and reviewing break-glass ─────────────────────────────────

create or replace function public.close_break_glass(want_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g  public.break_glass_grant%rowtype;
begin
  select * into g from public.break_glass_grant b where b.id = want_id for update;
  if not found or g.subject is distinct from me then
    raise exception 'No break-glass grant of yours with that id.' using errcode = '42501';
  end if;
  if g.closed_at is not null then
    raise exception 'This grant was closed on %.', g.closed_at;
  end if;
  perform private.console_audit_write(
    me, 'authenticated', g.tenant_id, 'breakglass.closed', g.id::text,
    jsonb_build_object('request', g.request_id, 'ticket', g.ticket), null);
  update public.break_glass_grant set closed_at = now() where id = g.id;
  return now();
end;
$$;
revoke all on function public.close_break_glass(uuid) from public, anon;
grant execute on function public.close_break_glass(uuid) to authenticated;

-- Post-use review: after the access has ended, by someone other than the
-- subject, holding the security or founder seat.
create or replace function public.review_break_glass(want_id uuid, want_note text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g  public.break_glass_grant%rowtype;
begin
  select * into g from public.break_glass_grant b where b.id = want_id for update;
  if not found or me is null then
    raise exception 'No such break-glass grant.' using errcode = '42501';
  end if;
  -- Own use first, so the subject hears the rule that applies to them and
  -- not the seat they may well hold.
  if g.subject = me then
    raise exception 'You cannot review your own break-glass use.' using errcode = '42501';
  end if;
  if not (private.holds_seat('security') or private.holds_seat('founder')) then
    raise exception 'Break-glass review is for the security or founder seat.' using errcode = '42501';
  end if;
  if g.reviewed_at is not null then
    raise exception 'This grant was reviewed on %.', g.reviewed_at;
  end if;
  if g.closed_at is null and g.expires_at > now() then
    raise exception 'The review is post-use: this grant is still open.';
  end if;
  if coalesce(length(trim(want_note)), 0) = 0 then
    raise exception 'Say what the review found.';
  end if;
  perform private.console_audit_write(
    me, 'authenticated', g.tenant_id, 'breakglass.reviewed', g.id::text,
    jsonb_build_object('request', g.request_id, 'ticket', g.ticket, 'subject', g.subject), null);
  update public.break_glass_grant
     set reviewed_by = me, reviewed_at = now(), review_note = left(trim(want_note), 2000)
   where id = g.id;
  return now();
end;
$$;
revoke all on function public.review_break_glass(uuid, text) from public, anon;
grant execute on function public.review_break_glass(uuid, text) to authenticated;

-- ── 12. Readers ───────────────────────────────────────────────────────────
--
-- `security invoker`, deliberately: the policies above are the one statement
-- of who may read a row, and a definer reader would be a second one to keep
-- in step. What the functions add is the shape the console draws and the
-- demo exclusion.

create or replace function public.console_approvals(include_demo boolean default false)
returns table (
  id uuid, duty_id text, requester uuid, tenant_id text, tenant_name text, is_demo boolean,
  target text, detail jsonb, evidence text, ticket text, status text, correlation_id text,
  created_at timestamptz, expires_at timestamptz, decided_at timestamptz, executed_at timestamptz,
  approvals integer, rejections integer, mine boolean, decided_by_me boolean, can_decide boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.duty_id, r.requester, r.tenant_id, s.name, coalesce(s.is_demo, false),
         r.target, r.detail, r.evidence, r.ticket,
         -- Nothing rewrites a stored status when its expiry passes, so the
         -- reader says `expired` for an elapsed request that was still
         -- pending or approved: the console must not offer an action the
         -- server will refuse for lateness, nor sort a dead request to the top.
         case when r.status in ('pending', 'approved') and r.expires_at <= now() then 'expired' else r.status end,
         r.correlation_id,
         r.created_at, r.expires_at, r.decided_at, r.executed_at,
         (select count(*)::integer from public.approval_decision d
           where d.request_id = r.id and d.decision = 'approve'),
         (select count(*)::integer from public.approval_decision d
           where d.request_id = r.id and d.decision = 'reject'),
         r.requester = (select auth.uid()),
         exists (select 1 from public.approval_decision d
                  where d.request_id = r.id and d.approver = (select auth.uid())),
         r.status = 'pending' and r.expires_at > now()
           and r.requester <> (select auth.uid())
           and private.approver_party(r.duty_id) is not null
    from public.approval_request r
    left join public.schools s on s.id = r.tenant_id
   where include_demo or not coalesce(s.is_demo, false)
   order by (r.status = 'pending') desc, r.created_at desc
   limit 500;
$$;
revoke all on function public.console_approvals(boolean) from public, anon;
grant execute on function public.console_approvals(boolean) to authenticated;

create or replace function public.console_break_glass(include_demo boolean default false)
returns table (
  id uuid, request_id uuid, subject uuid, tenant_id text, tenant_name text, is_demo boolean,
  ticket text, scope text, opened_at timestamptz, expires_at timestamptz, closed_at timestamptz,
  review_due timestamptz, reviewed_by uuid, reviewed_at timestamptz, review_note text,
  active boolean, review_overdue boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.request_id, g.subject, g.tenant_id, s.name, s.is_demo,
         g.ticket, g.scope, g.opened_at, g.expires_at, g.closed_at,
         g.review_due, g.reviewed_by, g.reviewed_at, g.review_note,
         g.closed_at is null and g.expires_at > now(),
         g.reviewed_at is null and g.review_due < now()
    from public.break_glass_grant g
    join public.schools s on s.id = g.tenant_id
   where include_demo or not s.is_demo
   order by g.opened_at desc
   limit 500;
$$;
revoke all on function public.console_break_glass(boolean) from public, anon;
grant execute on function public.console_break_glass(boolean) to authenticated;

create or replace function public.console_customers(include_demo boolean default false)
returns table (
  id uuid, tenant_id text, school_name text, is_demo boolean, legal_name text, status text,
  owner_seat text, created_at timestamptz, updated_at timestamptz,
  commitments jsonb, contracts jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.tenant_id, s.name, s.is_demo, c.legal_name, c.status,
         c.owner_seat, c.created_at, c.updated_at,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', m.id, 'commitment_id', m.commitment_id, 'status', m.status,
                     'due_on', m.due_on, 'evidence', m.evidence, 'updated_at', m.updated_at)
                     order by m.due_on nulls last, m.commitment_id)
                     from public.customer_commitment m where m.customer_id = c.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', k.id, 'kind', k.kind, 'signed_on', k.signed_on, 'starts_on', k.starts_on,
                     'ends_on', k.ends_on, 'document_ref', k.document_ref)
                     order by k.ends_on nulls last, k.kind)
                     from public.customer_contract k where k.customer_id = c.id), '[]'::jsonb)
    from public.customer c
    join public.schools s on s.id = c.tenant_id
   where include_demo or not s.is_demo
   order by s.name
   limit 500;
$$;
revoke all on function public.console_customers(boolean) from public, anon;
grant execute on function public.console_customers(boolean) to authenticated;

-- ── 13. Figures, with this file's rows added ─────────────────────────────
--
-- `create or replace` over the control plane's function. Its rows are
-- repeated here verbatim — this file cannot append to a function body, so it
-- restates the whole and adds four. Each figure names its source, window,
-- owner, refresh time, evidence and known limitation, because a number with
-- no provenance is a claim, and the console makes none.

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
  -- ── The control plane's rows (20260929100000), verbatim ─────────────────
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
         'Semester takes no payments; no payment provider exists to read from'
  -- ── This file's rows ────────────────────────────────────────────────────
  union all
  select 'approvals-open',
         (select count(*) from public.approval_request r
           where r.status = 'pending' and r.expires_at > now()
             and (include_demo or not exists (
               select 1 from public.schools s where s.is_demo and s.id = r.tenant_id)))::text,
         'public.approval_request',
         'now', 'security', refreshed,
         'supabase/console-approvals.check.sql',
         'Pending and not yet expired; a request nobody decides expires after seven days and stops counting'
  union all
  select 'break-glass-active',
         (select count(*) from public.break_glass_grant g
           where g.closed_at is null and g.expires_at > now()
             and (include_demo or not exists (
               select 1 from public.schools s where s.is_demo and s.id = g.tenant_id)))::text,
         'public.break_glass_grant',
         'now', 'security', refreshed,
         'supabase/console-approvals.check.sql',
         'Open grants only; a grant past its review date with no review blocks its holder''s next, and is not counted here'
  union all
  select 'customers-active',
         (select count(*) from public.customer c
           where c.status = 'active'
             and (include_demo or not exists (
               select 1 from public.schools s where s.is_demo and s.id = c.tenant_id)))::text,
         'public.customer',
         'now', 'success', refreshed,
         'supabase/console-approvals.check.sql',
         'Recorded by operations with the service key; a school with no customer row is not a customer, whatever is enrolled'
  union all
  select 'contracts-expiring-90d',
         (select count(*) from public.customer_contract k
           join public.customer c on c.id = k.customer_id
          where k.ends_on is not null
            and k.ends_on between current_date and current_date + 90
            and (include_demo or not exists (
              select 1 from public.schools s where s.is_demo and s.id = c.tenant_id)))::text,
         'public.customer_contract',
         'today to today + 90 days', 'founder', refreshed,
         'supabase/console-approvals.check.sql',
         'Contracts with an end date only; an open-ended order form never appears here';
end $$;

revoke all on function public.console_figures(boolean) from public, anon;
grant execute on function public.console_figures(boolean) to authenticated;

-- ── 14. Comments ──────────────────────────────────────────────────────────

comment on table public.approval_request is
  'A request to perform one console duty, with its evidence and ticket. Written only by request_approval; decided by decide_approval; executed by console_act.';
comment on table public.approval_decision is
  'One approver''s decision on one request, as the party they held. One per approver per request.';
comment on table public.console_action_record is
  'What a console action left behind when its duty has no table of its own. The audit event came first.';
comment on table public.break_glass_grant is
  'Break-glass access to one tenant, at most four hours, closed by its subject and reviewed by someone else.';
comment on table public.customer is
  'One customer per tenant. Written only by the service role; read by operators and the tenant''s own administrators.';
comment on table public.customer_commitment is
  'A commitment made to a customer, by the id in app/src/lib/ops/commitments.ts. Service-role writes only.';
comment on table public.customer_contract is
  'A signed document with a customer. Service-role writes only.';
comment on function public.console_act(uuid, text) is
  'The fail-closed high-risk write: audit event first through the writer role, then the duty''s effect, then the request marked executed. Nothing is caught.';
