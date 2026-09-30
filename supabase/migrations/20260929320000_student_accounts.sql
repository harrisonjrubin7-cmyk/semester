-- Semester — student accounts, payments and financial aid, for an institution.
--
-- The institution's side of the money a student owes it: one ledger per
-- student per term, the aid set against it, holds, payment plans, refunds of
-- credit balances, and payments through a provider. The pure rules are
-- `app/src/lib/studentaccount/` and this file makes the same decisions; the
-- vocabularies are held together by `studentaccount/studentaccount.schema.test.ts`.
--
-- Two things already exist and this is neither:
--
--   * `app/src/lib/bill.ts` reads a statement the *student* types in. Its four
--     rules hold here too: work-study is never disbursed to the account, so it
--     never lowers a balance; accepted aid not yet disbursed is anticipated and
--     outside the balance; a loan is reported as borrowed; plans are divided so
--     the parts add to the whole (derived in TS, never stored).
--   * `20260929070000_commercial_core.sql` is Semester selling Plus. Its
--     webhook pattern is reused — provider event id as the idempotency key, a
--     hash of the body and never the body, readable by nobody — but in a table
--     of its own: a school's tuition and Semester's subscription revenue never
--     share a row, a key or a function.
--
-- ## Off, until three things are true
--
-- `private.student_accounts_on(school)`: the school has `module.student_accounts`
-- in `tenant_feature_policy` not `off`, **and** has named a finance owner — an
-- account at the school holding `bursar:post` — in `student_account_settings`,
-- who still is one: a profile at the school and a live `bursar:post` grant
-- there, asked at every call, so revoking or expiring the owner's grant turns
-- the module off until a new owner is named or the grant is restored.
-- Every person's write asks it. (The third condition, Semester's own council
-- finance seat being held, is a launch condition with no row here; the TS gate
-- holds it.) A provider's payment event is applied even when the module has
-- since been switched off: the money moved, and refusing to record it would
-- lose it, not stop it.
--
-- ## What Semester never decides
--
-- Eligibility and amounts. An award, its amount, its verification status and
-- the student's academic-progress standing arrive from the institution's aid
-- system through `sync_aid_award`, which only the service role (the adapter)
-- may call. No client function takes an award amount. A disbursement is
-- recorded, not decided: it is refused only where Semester's own copy of what
-- the institution said contradicts it, so the copy is corrected at the source.
--
-- ## Append-only, and the balance is derived
--
-- `student_ledger_entries` and `student_payment_events` refuse UPDATE and
-- DELETE from any statement — the owner included. A wrong entry is answered by
-- a `reversal` entry naming it. The one path through is a foreign-key action
-- (`pg_trigger_depth() > 1`): deleting the student's account, or the school,
-- removes their rows by cascade, and deleting a bursar's account nulls
-- `posted_by`, which is how `erase_account` works everywhere else. No balance
-- column exists; `private.student_ledger_balance` sums the entries.
--
-- ## Who reads
--
--   * a student: their own entries, awards, holds (with the bursar's reason),
--     plans and payment starts, and nobody else's;
--   * `bursar:post` (student_accounts_officer): the school's ledger, awards,
--     holds, plans and payment starts;
--   * `aid:manage` (financial_aid_officer): the school's awards, and the ledger
--     entries that are aid;
--   * `hold:read` (registrar): nothing in any table. `student_hold_status`
--     answers whether a student at their school is held, and by which office —
--     its return type has no reason and no amount;
--   * provider events: nobody, through the API.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('bursar:post', 'Post charges, credits and counter payments to student accounts at one school; reverse entries, refund credit balances, place and release holds, make payment plans.'),
  ('aid:manage',  'Read one school''s aid awards and record disbursements its aid system made. Never sets an award amount.'),
  ('hold:read',   'Ask whether a student at one school is held by Student Accounts. Never the reason, never an amount.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('student_accounts_officer', 'bursar:post'),
  ('financial_aid_officer',    'aid:manage'),
  ('registrar',                'hold:read')
on conflict (role, capability) do nothing;

-- ── 2. Tables ─────────────────────────────────────────────────────────────

create table if not exists public.student_account_settings (
  tenant_id            text        primary key references public.schools (id) on delete cascade,
  -- The person at the school accountable for student accounts. Null is off.
  finance_owner        uuid        references auth.users (id) on delete set null,
  hold_threshold_cents bigint      not null default 0 check (hold_threshold_cents >= 0),
  late_grace_days      integer     not null default 10 check (late_grace_days between 0 and 60),
  updated_by           uuid        references auth.users (id) on delete set null,
  updated_at           timestamptz not null default now()
);
create index if not exists student_account_settings_by_owner on public.student_account_settings (finance_owner);
create index if not exists student_account_settings_by_updater on public.student_account_settings (updated_by);

create table if not exists public.student_aid_awards (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools (id) on delete cascade,
  student_id      uuid        not null references auth.users (id) on delete cascade,
  term            text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  -- The institution's own id for the award: the adapter's key.
  external_ref    text        not null check (length(btrim(external_ref)) between 1 and 200),
  -- `AidKind` in app/src/lib/bill.ts.
  kind            text        not null check (kind in ('grant', 'scholarship', 'loan', 'work', 'other')),
  what            text        not null check (length(btrim(what)) between 1 and 200),
  offered_cents   bigint      not null check (offered_cents >= 0),
  status          text        not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'cancelled')),
  verification    text        not null check (verification in ('not_selected', 'pending', 'complete')),
  sap             text        not null check (sap in ('meeting', 'warning', 'not_meeting', 'unknown')),
  source_version  integer     not null check (source_version >= 1),
  decided_at      timestamptz,
  synced_at       timestamptz not null default now(),
  unique (tenant_id, external_ref)
);
create index if not exists student_aid_awards_by_student on public.student_aid_awards (student_id, term);

create table if not exists public.student_ledger_entries (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools (id) on delete cascade,
  student_id      uuid        not null references auth.users (id) on delete cascade,
  term            text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  kind            text        not null check (kind in ('charge', 'credit', 'aid_disbursement', 'payment', 'refund', 'reversal')),
  -- Positive integer cents; the kind carries the sign.
  cents           bigint      not null check (cents > 0),
  what            text        not null check (length(btrim(what)) between 1 and 200),
  idempotency_key text        not null check (length(idempotency_key) between 1 and 200),
  source          text        not null check (source in ('bursar', 'aid_office', 'aid_adapter', 'provider')),
  aid_award_id    uuid        references public.student_aid_awards (id) on delete cascade,
  reverses        uuid        references public.student_ledger_entries (id) on delete cascade,
  posted_by       uuid        references auth.users (id) on delete set null,
  posted_at       timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  constraint student_ledger_reversal_names_one check ((kind = 'reversal') = (reverses is not null)),
  constraint student_ledger_aid_names_award check (kind <> 'aid_disbursement' or aid_award_id is not null)
);
create index if not exists student_ledger_by_student on public.student_ledger_entries (student_id, term);
create index if not exists student_ledger_by_tenant on public.student_ledger_entries (tenant_id, student_id);
create index if not exists student_ledger_by_award on public.student_ledger_entries (aid_award_id);
create index if not exists student_ledger_by_reverses on public.student_ledger_entries (reverses);
create index if not exists student_ledger_by_poster on public.student_ledger_entries (posted_by);

create table if not exists public.student_account_holds (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools (id) on delete cascade,
  student_id      uuid        not null references auth.users (id) on delete cascade,
  -- The bursar's words. The student and the bursar read them; no other office.
  reason          text        not null check (length(btrim(reason)) between 1 and 500),
  balance_cents   bigint      not null,
  threshold_cents bigint      not null check (threshold_cents >= 0),
  placed_by       uuid        references auth.users (id) on delete set null,
  placed_at       timestamptz not null default now(),
  released_at     timestamptz,
  released_by     uuid        references auth.users (id) on delete set null,
  release_reason  text        check (release_reason is null or length(btrim(release_reason)) between 1 and 500),
  constraint student_hold_release_whole check ((released_at is null) = (release_reason is null))
);
create unique index if not exists student_account_holds_one_active
  on public.student_account_holds (tenant_id, student_id) where released_at is null;
create index if not exists student_account_holds_by_student on public.student_account_holds (student_id);
create index if not exists student_account_holds_by_tenant on public.student_account_holds (tenant_id, student_id);
create index if not exists student_account_holds_by_placer on public.student_account_holds (placed_by);
create index if not exists student_account_holds_by_releaser on public.student_account_holds (released_by);

-- Instalments are not stored: `planView` in studentaccount/ledger.ts derives
-- them with bill.ts's `split`, and the late state from the ledger.
create table if not exists public.student_payment_plans (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools (id) on delete cascade,
  student_id      uuid        not null references auth.users (id) on delete cascade,
  term            text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  total_cents     bigint      not null check (total_cents > 0),
  parts           integer     not null check (parts between 2 and 12),
  first_due       date        not null,
  every_months    integer     not null check (every_months between 1 and 3),
  idempotency_key text        not null check (length(idempotency_key) between 1 and 200),
  created_by      uuid        references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  unique (tenant_id, idempotency_key)
);
create unique index if not exists student_payment_plans_one_per_term
  on public.student_payment_plans (tenant_id, student_id, term) where cancelled_at is null;
create index if not exists student_payment_plans_by_student on public.student_payment_plans (student_id);
create index if not exists student_payment_plans_by_creator on public.student_payment_plans (created_by);

create table if not exists public.student_payment_intents (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null references public.schools (id) on delete cascade,
  student_id          uuid        not null references auth.users (id) on delete cascade,
  term                text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  cents               bigint      not null check (cents > 0),
  currency            text        not null default 'usd' check (currency = 'usd'),
  idempotency_key     text        not null check (length(idempotency_key) between 1 and 200),
  status              text        not null default 'open' check (status in ('open', 'paid', 'failed', 'refunded')),
  provider_payment_id text        check (provider_payment_id is null or length(provider_payment_id) between 1 and 200),
  created_at          timestamptz not null default now(),
  unique (tenant_id, student_id, idempotency_key)
);
create index if not exists student_payment_intents_by_student on public.student_payment_intents (student_id);

-- A provider's webhook, recorded once. No student id: it points at the
-- intent, and loses even that when the student's account is deleted.
create table if not exists public.student_payment_events (
  id                  uuid        primary key default gen_random_uuid(),
  provider            text        not null check (provider ~ '^[a-z][a-z0-9_]{1,29}$'),
  provider_event_id   text        not null check (length(provider_event_id) between 1 and 200),
  kind                text        not null check (kind in ('payment_succeeded', 'payment_failed', 'payment_refunded')),
  intent_id           uuid        references public.student_payment_intents (id) on delete set null,
  provider_payment_id text        not null check (length(provider_payment_id) between 1 and 200),
  amount_cents        bigint      not null check (amount_cents > 0),
  currency            text        not null check (currency ~ '^[a-z]{3}$'),
  payload_sha256      text        not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at         timestamptz not null,
  -- `ApplyOutcome` in studentaccount/payments.ts, less the two that record nothing.
  outcome             text        not null check (outcome in ('unknown_intent', 'currency_mismatch', 'amount_mismatch',
                                    'posted', 'already_posted', 'failed', 'ignored_after_success',
                                    'waiting_for_payment', 'reversed', 'posted_and_reversed')),
  received_at         timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index if not exists student_payment_events_by_intent on public.student_payment_events (intent_id);

comment on table public.student_ledger_entries is
  'A school''s student account ledger: append-only entries in integer cents, the kind carrying the sign. No balance is stored; private.student_ledger_balance sums them.';
comment on table public.student_aid_awards is
  'Aid awards as the institution''s aid system reports them, through sync_aid_award (service role). Semester never sets an amount; the student accepts or declines.';
comment on table public.student_account_holds is
  'Holds Student Accounts placed on a balance over the school''s threshold. The reason is read by the student and bursar only; other offices ask student_hold_status.';
comment on table public.student_payment_events is
  'Verified payment-provider webhooks for student accounts, once each. No raw payload, no card data, no student id. Readable by nobody through the API.';

-- ── 3. Append-only ────────────────────────────────────────────────────────
--
-- Depth 1 is a statement aimed at the table, from anybody. Depth 2 or more is
-- a foreign-key action firing it: an account or a school being deleted.
create or replace function private.refuse_student_ledger_rewrite()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception 'semester: % is append-only; post a reversal instead', tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.refuse_student_ledger_rewrite() from public, anon, authenticated;

drop trigger if exists student_ledger_entries_append_only on public.student_ledger_entries;
create trigger student_ledger_entries_append_only before update or delete on public.student_ledger_entries
  for each row execute function private.refuse_student_ledger_rewrite();
drop trigger if exists student_payment_events_append_only on public.student_payment_events;
create trigger student_payment_events_append_only before update or delete on public.student_payment_events
  for each row execute function private.refuse_student_ledger_rewrite();

-- ── 4. Helpers ────────────────────────────────────────────────────────────

-- On means the module is not off **and** the named finance owner is still a
-- finance owner: an account with a profile at this school and a live grant
-- carrying `bursar:post` over it. `configure_student_accounts` checks both when
-- the owner is named, but a grant is revoked or expires afterwards without
-- touching this table, and a module whose accountable owner has left the
-- bursar's office is a module nobody is accountable for. So the question is
-- asked again at every write rather than trusted from the day it was named —
-- `subject_has_capability` is the same liveness test `has_capability` makes
-- (not revoked, not expired), about the owner instead of the caller.
create or replace function private.student_accounts_on(want_school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.feature_state('module.student_accounts', want_school) <> 'off'
     and exists (select 1
                   from public.student_account_settings s
                   join public.profiles p on p.user_id = s.finance_owner and p.school_id = want_school
                  where s.tenant_id = want_school
                    and private.subject_has_capability(s.finance_owner, 'bursar:post', 'school', want_school));
$$;
revoke all on function private.student_accounts_on(text) from public, anon, authenticated;

-- The caller's school, if they hold the capability there and the module is on.
-- Raises otherwise: one place decides, so the functions cannot disagree.
create or replace function private.student_accounts_staff(want_capability text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null or not private.has_capability(want_capability, 'school', school) then
    raise exception 'semester: that needs % at your school', want_capability using errcode = 'insufficient_privilege';
  end if;
  if not private.student_accounts_on(school) then
    raise exception 'semester: student accounts are off at your school (the module is off, or no finance owner holding bursar:post is named)'
      using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;
revoke all on function private.student_accounts_staff(text) from public, anon, authenticated;

create or replace function private.student_at_school(want_student uuid, want_school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.user_id = want_student and p.school_id = want_school) then
    raise exception 'semester: no such student at your school' using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.student_at_school(uuid, text) from public, anon, authenticated;

-- The balance: positive owed, negative a credit. Over one term, or all when null.
create or replace function private.student_ledger_balance(want_tenant text, want_student uuid, want_term text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case
           when e.kind in ('charge', 'refund') then e.cents
           when e.kind in ('credit', 'aid_disbursement', 'payment') then -e.cents
           when o.kind in ('charge', 'refund') then -e.cents
           when o.kind is not null then e.cents
           else 0
         end), 0)::bigint
    from public.student_ledger_entries e
    left join public.student_ledger_entries o on o.id = e.reverses
   where e.tenant_id = want_tenant and e.student_id = want_student
     and (want_term is null or e.term = want_term);
$$;
revoke all on function private.student_ledger_balance(text, uuid, text) from public, anon, authenticated;

create or replace function private.student_ledger_lock(want_tenant text, want_student uuid)
returns void language sql volatile set search_path = '' as $$
  select pg_advisory_xact_lock(hashtext('student_ledger:' || want_tenant || '/' || want_student::text));
$$;
revoke all on function private.student_ledger_lock(text, uuid) from public, anon, authenticated;

-- Whether a key was already used at this school.
create or replace function private.student_ledger_key_used(want_tenant text, want_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.student_ledger_entries e where e.tenant_id = want_tenant and e.idempotency_key = want_key);
$$;
revoke all on function private.student_ledger_key_used(text, text) from public, anon, authenticated;

-- Post one entry, idempotently: the same key and the same entry return the
-- first id; the same key and a different entry raise. Every money path ends
-- here, so there is one place a key is honoured.
create or replace function private.student_ledger_post(
  want_tenant text, want_student uuid, want_term text, want_kind text, want_cents bigint,
  want_what text, want_key text, want_source text, want_award uuid, want_reverses uuid, want_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior public.student_ledger_entries;
  made  uuid;
begin
  select * into prior from public.student_ledger_entries e
   where e.tenant_id = want_tenant and e.idempotency_key = want_key;
  if found then
    if prior.student_id = want_student and prior.term = want_term and prior.kind = want_kind
       and prior.cents = want_cents and prior.source = want_source
       and prior.aid_award_id is not distinct from want_award
       and prior.reverses is not distinct from want_reverses then
      return prior.id;
    end if;
    raise exception 'semester: that idempotency key was used for a different entry' using errcode = 'unique_violation';
  end if;
  insert into public.student_ledger_entries
    (tenant_id, student_id, term, kind, cents, what, idempotency_key, source, aid_award_id, reverses, posted_by)
  values (want_tenant, want_student, want_term, want_kind, want_cents, btrim(want_what), want_key, want_source,
          want_award, want_reverses, want_actor)
  returning id into made;
  return made;
end $$;
revoke all on function private.student_ledger_post(text, uuid, text, text, bigint, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;

-- A key a person may use: the two system prefixes are the provider's and the
-- adapter's, so nobody can pre-empt a payment by posting under its key.
create or replace function private.student_ledger_person_key(want_key text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if want_key is null or length(btrim(want_key)) = 0 or length(want_key) > 200
     or want_key like 'provider:%' or want_key like 'aid:%' then
    raise exception 'semester: an idempotency key is 1 to 200 characters and not a system key' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.student_ledger_person_key(text) from public, anon, authenticated;

-- ── 5. Configuring: the school names its finance owner ────────────────────

create or replace function public.configure_student_accounts(
  want_finance_owner uuid, want_threshold_cents bigint, want_grace_days integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null or not private.has_capability('tenant:configure', 'school', school) then
    raise exception 'semester: configuring student accounts needs tenant:configure at your school' using errcode = 'insufficient_privilege';
  end if;
  if want_finance_owner is not null and (
       not exists (select 1 from public.profiles p where p.user_id = want_finance_owner and p.school_id = school)
       or not private.subject_has_capability(want_finance_owner, 'bursar:post', 'school', school)) then
    raise exception 'semester: the finance owner must be at your school and hold bursar:post there' using errcode = 'check_violation';
  end if;
  insert into public.student_account_settings (tenant_id, finance_owner, hold_threshold_cents, late_grace_days, updated_by, updated_at)
  values (school, want_finance_owner, coalesce(want_threshold_cents, 0), coalesce(want_grace_days, 10), me, now())
  on conflict (tenant_id) do update
     set finance_owner = excluded.finance_owner,
         hold_threshold_cents = excluded.hold_threshold_cents,
         late_grace_days = excluded.late_grace_days,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at;
  return case when want_finance_owner is null then 'off: no finance owner' else 'configured' end;
end $$;

-- ── 6. The bursar ─────────────────────────────────────────────────────────

create or replace function public.post_student_ledger_entry(
  want_student uuid, want_term text, want_kind text, want_cents bigint, want_what text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.student_accounts_staff('bursar:post');
begin
  perform private.student_at_school(want_student, school);
  if want_kind is null or want_kind not in ('charge', 'credit', 'payment') then
    raise exception 'semester: a % is not posted by hand; it has its own path', coalesce(want_kind, 'null') using errcode = 'check_violation';
  end if;
  perform private.student_ledger_person_key(want_key);
  perform private.student_ledger_lock(school, want_student);
  return private.student_ledger_post(school, want_student, want_term, want_kind, want_cents, want_what, want_key,
                                     'bursar', null, null, (select auth.uid()));
end $$;

-- An aid disbursement is reversed by the aid office; everything else by the bursar.
create or replace function public.reverse_student_ledger_entry(
  want_entry uuid, want_cents bigint, want_what text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  school   text;
  original public.student_ledger_entries;
  cap      text;
  left_c   bigint;
  amount   bigint;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  select * into original from public.student_ledger_entries e where e.id = want_entry and e.tenant_id = school;
  if not found then
    raise exception 'semester: no such entry at your school' using errcode = 'insufficient_privilege';
  end if;
  cap := case when original.kind = 'aid_disbursement' then 'aid:manage' else 'bursar:post' end;
  perform private.student_accounts_staff(cap);
  if original.kind = 'reversal' then
    raise exception 'semester: a reversal is not reversed; post the entry again instead' using errcode = 'check_violation';
  end if;
  perform private.student_ledger_person_key(want_key);
  perform private.student_ledger_lock(school, original.student_id);
  select original.cents - coalesce(sum(r.cents), 0) into left_c
    from public.student_ledger_entries r where r.reverses = original.id;
  amount := coalesce(want_cents, left_c);
  if not private.student_ledger_key_used(school, want_key) and amount > left_c then
    raise exception 'semester: only % cents of that entry are left to reverse', left_c using errcode = 'check_violation';
  end if;
  return private.student_ledger_post(school, original.student_id, original.term, 'reversal', amount,
           coalesce(nullif(btrim(want_what), ''), 'Reverses ' || original.what), want_key,
           case when original.kind = 'aid_disbursement' then 'aid_office' else 'bursar' end,
           original.aid_award_id, original.id, me);
end $$;

-- Never more than the term's credit balance as posted; anticipated aid is not a credit.
create or replace function public.refund_student_credit(want_student uuid, want_term text, want_cents bigint, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.student_accounts_staff('bursar:post');
  credit bigint;
begin
  perform private.student_at_school(want_student, school);
  perform private.student_ledger_person_key(want_key);
  perform private.student_ledger_lock(school, want_student);
  credit := -private.student_ledger_balance(school, want_student, want_term);
  if not private.student_ledger_key_used(school, want_key) and (want_cents is null or want_cents > credit) then
    raise exception 'semester: the credit balance for % is % cents; a refund cannot exceed it', want_term, greatest(credit, 0)
      using errcode = 'check_violation';
  end if;
  return private.student_ledger_post(school, want_student, want_term, 'refund', want_cents, 'Refund of credit balance',
                                     want_key, 'bursar', null, null, (select auth.uid()));
end $$;

create or replace function public.place_student_hold(want_student uuid, want_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school    text := private.student_accounts_staff('bursar:post');
  threshold bigint;
  owed      bigint;
  held      uuid;
begin
  perform private.student_at_school(want_student, school);
  perform private.student_ledger_lock(school, want_student);
  select h.id into held from public.student_account_holds h
   where h.tenant_id = school and h.student_id = want_student and h.released_at is null;
  if held is not null then
    return held;
  end if;
  select s.hold_threshold_cents into threshold from public.student_account_settings s where s.tenant_id = school;
  owed := private.student_ledger_balance(school, want_student, null);
  if owed <= threshold then
    raise exception 'semester: the balance is % cents, not over the threshold of %', owed, threshold using errcode = 'check_violation';
  end if;
  insert into public.student_account_holds (tenant_id, student_id, reason, balance_cents, threshold_cents, placed_by)
  values (school, want_student, btrim(coalesce(want_reason, '')), owed, threshold, (select auth.uid()))
  returning id into held;
  return held;
end $$;

create or replace function public.release_student_hold(want_hold uuid, want_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.student_accounts_staff('bursar:post');
begin
  update public.student_account_holds h
     set released_at = now(), released_by = (select auth.uid()), release_reason = btrim(coalesce(want_reason, ''))
   where h.id = want_hold and h.tenant_id = school and h.released_at is null;
  if not found then
    raise exception 'semester: no open hold with that id at your school' using errcode = 'check_violation';
  end if;
  return want_hold;
end $$;

create or replace function public.create_student_payment_plan(
  want_student uuid, want_term text, want_parts integer, want_first date, want_every_months integer, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.student_accounts_staff('bursar:post');
  prior  public.student_payment_plans;
  owed   bigint;
  made   uuid;
begin
  perform private.student_at_school(want_student, school);
  perform private.student_ledger_person_key(want_key);
  perform private.student_ledger_lock(school, want_student);
  select * into prior from public.student_payment_plans p where p.tenant_id = school and p.idempotency_key = want_key;
  if found then
    if prior.student_id = want_student and prior.term = want_term and prior.parts = want_parts
       and prior.first_due = want_first and prior.every_months = want_every_months then
      return prior.id;
    end if;
    raise exception 'semester: that idempotency key was used for a different plan' using errcode = 'unique_violation';
  end if;
  if exists (select 1 from public.student_payment_plans p
              where p.tenant_id = school and p.student_id = want_student and p.term = want_term and p.cancelled_at is null) then
    raise exception 'semester: % already has a plan', want_term using errcode = 'check_violation';
  end if;
  owed := private.student_ledger_balance(school, want_student, want_term);
  if owed <= 0 then
    raise exception 'semester: % owes nothing, so there is nothing to divide', want_term using errcode = 'check_violation';
  end if;
  insert into public.student_payment_plans
    (tenant_id, student_id, term, total_cents, parts, first_due, every_months, idempotency_key, created_by)
  values (school, want_student, want_term, owed, want_parts, want_first, want_every_months, want_key, (select auth.uid()))
  returning id into made;
  return made;
end $$;

-- What the registrar and any office holding hold:read may know: whether, and
-- whose. The return type has no reason and no amount, so none can leak.
create or replace function public.student_hold_status(want_student uuid)
returns table (held boolean, office text, since timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if want_student is distinct from me then
    if school is null or not (private.has_capability('hold:read', 'school', school)
                              or private.has_capability('bursar:post', 'school', school)) then
      raise exception 'semester: hold status is for the student and offices holding hold:read' using errcode = 'insufficient_privilege';
    end if;
    perform private.student_at_school(want_student, school);
  end if;
  return query
    select h.id is not null, case when h.id is null then null else 'student_accounts' end, h.placed_at
      from (select 1) one
      left join public.student_account_holds h
        on h.student_id = want_student and h.tenant_id = school and h.released_at is null;
end $$;

-- ── 7. Financial aid ──────────────────────────────────────────────────────

-- The student accepts or declines their own offered award, once.
create or replace function public.respond_to_aid_award(want_award uuid, want_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  a    public.student_aid_awards;
  want text := case when want_accept then 'accepted' else 'declined' end;
begin
  if me is null or want_accept is null then
    raise exception 'semester: not signed in, or no answer' using errcode = 'insufficient_privilege';
  end if;
  select * into a from public.student_aid_awards w where w.id = want_award and w.student_id = me for update;
  if not found then
    raise exception 'semester: no award of yours with that id' using errcode = 'insufficient_privilege';
  end if;
  if not private.student_accounts_on(a.tenant_id) then
    raise exception 'semester: student accounts are off at your school' using errcode = 'insufficient_privilege';
  end if;
  if a.status = want then
    return want;
  end if;
  if a.status <> 'offered' then
    raise exception 'semester: the award is %; the financial aid office changes it from here', a.status using errcode = 'check_violation';
  end if;
  update public.student_aid_awards set status = want, decided_at = now() where id = a.id;
  return want;
end $$;

-- The one disbursement rule, for both the aid office and the adapter.
create or replace function private.disburse_aid(
  want_award uuid, want_cents bigint, want_key text, want_source text, want_actor uuid, want_school text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a    public.student_aid_awards;
  left_c bigint;
begin
  select * into a from public.student_aid_awards w where w.id = want_award and w.tenant_id = want_school;
  if not found then
    raise exception 'semester: no such award at this school' using errcode = 'check_violation';
  end if;
  perform private.student_ledger_lock(a.tenant_id, a.student_id);
  if not private.student_ledger_key_used(a.tenant_id, want_key) then
    if a.kind = 'work' then
      raise exception 'semester: work-study is paid to the student for hours worked and is never disbursed to the account'
        using errcode = 'check_violation';
    end if;
    if a.status <> 'accepted' or a.verification = 'pending' or a.sap in ('not_meeting', 'unknown') then
      raise exception 'semester: not disbursable on the record held (status %, verification %, progress %)', a.status, a.verification, a.sap
        using errcode = 'check_violation';
    end if;
    select a.offered_cents - coalesce(sum(case when e.kind = 'aid_disbursement' then e.cents else -e.cents end), 0) into left_c
      from public.student_ledger_entries e where e.aid_award_id = a.id;
    if want_cents is null or want_cents > left_c then
      raise exception 'semester: only % cents of the % offered are left to disburse', left_c, a.offered_cents using errcode = 'check_violation';
    end if;
  end if;
  return private.student_ledger_post(a.tenant_id, a.student_id, a.term, 'aid_disbursement', want_cents, a.what, want_key,
                                     want_source, a.id, null, want_actor);
end $$;
revoke all on function private.disburse_aid(uuid, bigint, text, text, uuid, text) from public, anon, authenticated;

create or replace function public.record_aid_disbursement(want_award uuid, want_cents bigint, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.student_accounts_staff('aid:manage');
begin
  perform private.student_ledger_person_key(want_key);
  return private.disburse_aid(want_award, want_cents, want_key, 'aid_office', (select auth.uid()), school);
end $$;

-- The adapter: the institution's aid system says what an award is. Service
-- role only. A version older than the one held is dropped, so a batch that
-- arrives late cannot roll an award back.
create or replace function public.sync_aid_award(
  want_tenant text, want_student uuid, want_external_ref text, want_term text, want_kind text, want_what text,
  want_offered_cents bigint, want_verification text, want_sap text, want_source_version integer, want_cancelled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  held public.student_aid_awards;
begin
  if not private.student_accounts_on(want_tenant) then
    raise exception 'semester: student accounts are off at %', want_tenant using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = want_student and p.school_id = want_tenant) then
    raise exception 'semester: no such student at %', want_tenant using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('student_aid:' || want_tenant || '/' || coalesce(want_external_ref, '')));
  select * into held from public.student_aid_awards w where w.tenant_id = want_tenant and w.external_ref = want_external_ref;
  if found then
    if held.student_id <> want_student or held.term <> want_term then
      raise exception 'semester: an award does not move between students or terms' using errcode = 'check_violation';
    end if;
    if want_source_version < held.source_version then
      return 'stale';
    end if;
    if want_source_version = held.source_version then
      return 'duplicate';
    end if;
    update public.student_aid_awards
       set kind = want_kind, what = btrim(want_what), offered_cents = want_offered_cents,
           verification = want_verification, sap = want_sap, source_version = want_source_version,
           status = case when coalesce(want_cancelled, false) then 'cancelled' else status end,
           synced_at = now()
     where id = held.id;
    return 'updated';
  end if;
  insert into public.student_aid_awards
    (tenant_id, student_id, term, external_ref, kind, what, offered_cents, status, verification, sap, source_version)
  values (want_tenant, want_student, want_term, want_external_ref, want_kind, btrim(want_what), want_offered_cents,
          case when coalesce(want_cancelled, false) then 'cancelled' else 'offered' end,
          want_verification, want_sap, want_source_version);
  return 'offered';
end $$;

create or replace function public.apply_aid_disbursement(want_tenant text, want_external_ref text, want_cents bigint, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  award uuid;
begin
  if not private.student_accounts_on(want_tenant) then
    raise exception 'semester: student accounts are off at %', want_tenant using errcode = 'insufficient_privilege';
  end if;
  select w.id into award from public.student_aid_awards w where w.tenant_id = want_tenant and w.external_ref = want_external_ref;
  return private.disburse_aid(award, want_cents, 'aid:' || want_key, 'aid_adapter', null, want_tenant);
end $$;

-- ── 8. Paying ─────────────────────────────────────────────────────────────

-- The student starts paying their own account. Nothing is charged here; the
-- provider's page takes the card, and its events settle this intent.
create or replace function public.start_student_payment(want_term text, want_cents bigint, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
  prior  public.student_payment_intents;
  owed   bigint;
  made   uuid;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null or not private.student_accounts_on(school) then
    raise exception 'semester: student accounts are off at your school' using errcode = 'insufficient_privilege';
  end if;
  perform private.student_ledger_person_key(want_key);
  perform private.student_ledger_lock(school, me);
  select * into prior from public.student_payment_intents i
   where i.tenant_id = school and i.student_id = me and i.idempotency_key = want_key;
  if found then
    if prior.term = want_term and prior.cents = want_cents then
      return prior.id;
    end if;
    raise exception 'semester: that idempotency key was used for a different payment' using errcode = 'unique_violation';
  end if;
  owed := private.student_ledger_balance(school, me, want_term);
  if want_cents is null or want_cents <= 0 or want_cents > owed then
    raise exception 'semester: % owes % cents; a payment is more than nothing and no more than that', want_term, greatest(owed, 0)
      using errcode = 'check_violation';
  end if;
  insert into public.student_payment_intents (tenant_id, student_id, term, cents, idempotency_key)
  values (school, me, want_term, want_cents, want_key)
  returning id into made;
  return made;
end $$;

-- A verified provider webhook, applied once. Service role only: the Edge
-- Function that calls it has checked the provider's signature over the raw
-- body. The same rules as `applyProviderEvent` in studentaccount/payments.ts.
create or replace function public.apply_student_payment_event(
  want_provider text, want_event_id text, want_kind text, want_intent uuid, want_provider_payment_id text,
  want_amount_cents bigint, want_currency text, want_payload_sha256 text, want_occurred_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  seen     public.student_payment_events;
  intent   public.student_payment_intents;
  payment  public.student_ledger_entries;
  pkey     text := 'provider:' || want_provider || ':' || want_provider_payment_id;
  outcome  text;
  left_c   bigint;
  w        public.student_payment_events;
  fresh    boolean;
begin
  perform pg_advisory_xact_lock(hashtext('student_payment_event:' || want_provider || '/' || want_event_id));
  select * into seen from public.student_payment_events e where e.provider = want_provider and e.provider_event_id = want_event_id;
  if found then
    return case when seen.payload_sha256 = want_payload_sha256 then 'duplicate' else 'replay_conflict' end;
  end if;

  select * into intent from public.student_payment_intents i where i.id = want_intent;
  if not found then
    outcome := 'unknown_intent';
  elsif lower(want_currency) <> intent.currency then
    outcome := 'currency_mismatch';
  else
    perform private.student_ledger_lock(intent.tenant_id, intent.student_id);
    select * into payment from public.student_ledger_entries e where e.tenant_id = intent.tenant_id and e.idempotency_key = pkey;

    if want_kind = 'payment_failed' then
      if intent.status in ('paid', 'refunded') or payment.id is not null then
        outcome := 'ignored_after_success';
      else
        update public.student_payment_intents set status = 'failed', provider_payment_id = want_provider_payment_id where id = intent.id;
        outcome := 'failed';
      end if;

    elsif want_kind = 'payment_refunded' then
      if payment.id is null then
        outcome := 'waiting_for_payment';
      else
        select payment.cents - coalesce(sum(r.cents), 0) into left_c from public.student_ledger_entries r where r.reverses = payment.id;
        if want_amount_cents > left_c then
          outcome := 'amount_mismatch';
        else
          perform private.student_ledger_post(intent.tenant_id, intent.student_id, intent.term, 'reversal', want_amount_cents,
                    'Refunded by the payment provider', 'provider:' || want_provider || ':refund:' || want_event_id,
                    'provider', null, payment.id, null);
          if left_c = want_amount_cents then
            update public.student_payment_intents set status = 'refunded' where id = intent.id;
          end if;
          outcome := 'reversed';
        end if;
      end if;

    elsif want_kind = 'payment_succeeded' then
      if want_amount_cents <> intent.cents then
        outcome := 'amount_mismatch';
      else
        fresh := payment.id is null;
        perform private.student_ledger_post(intent.tenant_id, intent.student_id, intent.term, 'payment', want_amount_cents,
                  'Payment through ' || want_provider, pkey, 'provider', null, null, null);
        update public.student_payment_intents set status = 'paid', provider_payment_id = want_provider_payment_id where id = intent.id;
        outcome := case when fresh then 'posted' else 'already_posted' end;
        select * into payment from public.student_ledger_entries e where e.tenant_id = intent.tenant_id and e.idempotency_key = pkey;
        -- Refunds that arrived before this payment, applied now.
        for w in select * from public.student_payment_events e
                  where e.intent_id = intent.id and e.kind = 'payment_refunded' and e.outcome = 'waiting_for_payment'
                  order by e.received_at loop
          select payment.cents - coalesce(sum(r.cents), 0) into left_c from public.student_ledger_entries r where r.reverses = payment.id;
          if w.amount_cents <= left_c then
            perform private.student_ledger_post(intent.tenant_id, intent.student_id, intent.term, 'reversal', w.amount_cents,
                      'Refunded by the payment provider', 'provider:' || want_provider || ':refund:' || w.provider_event_id,
                      'provider', null, payment.id, null);
            if fresh then outcome := 'posted_and_reversed'; end if;
            if left_c = w.amount_cents then
              update public.student_payment_intents set status = 'refunded' where id = intent.id;
            end if;
          end if;
        end loop;
      end if;
    else
      raise exception 'semester: unknown event kind %', want_kind using errcode = 'check_violation';
    end if;
  end if;

  insert into public.student_payment_events
    (provider, provider_event_id, kind, intent_id, provider_payment_id, amount_cents, currency, payload_sha256, occurred_at, outcome)
  values (want_provider, want_event_id, want_kind, case when intent.id is null then null else want_intent end,
          want_provider_payment_id, want_amount_cents, lower(want_currency), want_payload_sha256, want_occurred_at, outcome);
  return outcome;
end $$;

-- ── 9. Who reads, and that nobody writes directly ─────────────────────────

alter table public.student_account_settings enable row level security;
alter table public.student_aid_awards enable row level security;
alter table public.student_ledger_entries enable row level security;
alter table public.student_account_holds enable row level security;
alter table public.student_payment_plans enable row level security;
alter table public.student_payment_intents enable row level security;
alter table public.student_payment_events enable row level security;

revoke all on table public.student_account_settings from public, anon, authenticated;
revoke all on table public.student_aid_awards from public, anon, authenticated;
revoke all on table public.student_ledger_entries from public, anon, authenticated;
revoke all on table public.student_account_holds from public, anon, authenticated;
revoke all on table public.student_payment_plans from public, anon, authenticated;
revoke all on table public.student_payment_intents from public, anon, authenticated;
revoke all on table public.student_payment_events from public, anon, authenticated;
grant select on table public.student_account_settings to authenticated;
grant select on table public.student_aid_awards to authenticated;
grant select on table public.student_ledger_entries to authenticated;
grant select on table public.student_account_holds to authenticated;
grant select on table public.student_payment_plans to authenticated;
grant select on table public.student_payment_intents to authenticated;
-- student_payment_events: no grant at all. Nobody reads a webhook through the API.

drop policy if exists "school finance staff read settings" on public.student_account_settings;
create policy "school finance staff read settings" on public.student_account_settings
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('bursar:post', 'school', tenant_id)
         or private.has_capability('aid:manage', 'school', tenant_id));

drop policy if exists "students, bursars and aid read awards" on public.student_aid_awards;
create policy "students, bursars and aid read awards" on public.student_aid_awards
  for select to authenticated
  using (student_id = (select auth.uid())
         or private.has_capability('aid:manage', 'school', tenant_id)
         or private.has_capability('bursar:post', 'school', tenant_id));

drop policy if exists "students and bursars read the ledger, aid reads aid" on public.student_ledger_entries;
create policy "students and bursars read the ledger, aid reads aid" on public.student_ledger_entries
  for select to authenticated
  using (student_id = (select auth.uid())
         or private.has_capability('bursar:post', 'school', tenant_id)
         or (aid_award_id is not null and private.has_capability('aid:manage', 'school', tenant_id)));

drop policy if exists "students and bursars read holds" on public.student_account_holds;
create policy "students and bursars read holds" on public.student_account_holds
  for select to authenticated
  using (student_id = (select auth.uid()) or private.has_capability('bursar:post', 'school', tenant_id));

drop policy if exists "students and bursars read plans" on public.student_payment_plans;
create policy "students and bursars read plans" on public.student_payment_plans
  for select to authenticated
  using (student_id = (select auth.uid()) or private.has_capability('bursar:post', 'school', tenant_id));

drop policy if exists "students and bursars read payment starts" on public.student_payment_intents;
create policy "students and bursars read payment starts" on public.student_payment_intents
  for select to authenticated
  using (student_id = (select auth.uid()) or private.has_capability('bursar:post', 'school', tenant_id));

-- ── 10. Who may call what ─────────────────────────────────────────────────

revoke all on function public.configure_student_accounts(uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.post_student_ledger_entry(uuid, text, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.reverse_student_ledger_entry(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.refund_student_credit(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.place_student_hold(uuid, text) from public, anon, authenticated;
revoke all on function public.release_student_hold(uuid, text) from public, anon, authenticated;
revoke all on function public.create_student_payment_plan(uuid, text, integer, date, integer, text) from public, anon, authenticated;
revoke all on function public.student_hold_status(uuid) from public, anon, authenticated;
revoke all on function public.respond_to_aid_award(uuid, boolean) from public, anon, authenticated;
revoke all on function public.record_aid_disbursement(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.start_student_payment(text, bigint, text) from public, anon, authenticated;
revoke all on function public.sync_aid_award(text, uuid, text, text, text, text, bigint, text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.apply_aid_disbursement(text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.apply_student_payment_event(text, text, text, uuid, text, bigint, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.configure_student_accounts(uuid, bigint, integer) to authenticated;
grant execute on function public.post_student_ledger_entry(uuid, text, text, bigint, text, text) to authenticated;
grant execute on function public.reverse_student_ledger_entry(uuid, bigint, text, text) to authenticated;
grant execute on function public.refund_student_credit(uuid, text, bigint, text) to authenticated;
grant execute on function public.place_student_hold(uuid, text) to authenticated;
grant execute on function public.release_student_hold(uuid, text) to authenticated;
grant execute on function public.create_student_payment_plan(uuid, text, integer, date, integer, text) to authenticated;
grant execute on function public.student_hold_status(uuid) to authenticated;
grant execute on function public.respond_to_aid_award(uuid, boolean) to authenticated;
grant execute on function public.record_aid_disbursement(uuid, bigint, text) to authenticated;
grant execute on function public.start_student_payment(text, bigint, text) to authenticated;
-- The adapter's and the webhook's: the service role only.
grant execute on function public.sync_aid_award(text, uuid, text, text, text, text, bigint, text, text, integer, boolean) to service_role;
grant execute on function public.apply_aid_disbursement(text, text, bigint, text) to service_role;
grant execute on function public.apply_student_payment_event(text, text, text, uuid, text, bigint, text, text, timestamptz) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.apply_student_payment_event(text, text, text, uuid, text, bigint, text, text, timestamptz);
--   drop function if exists public.start_student_payment(text, bigint, text);
--   drop function if exists public.apply_aid_disbursement(text, text, bigint, text);
--   drop function if exists public.sync_aid_award(text, uuid, text, text, text, text, bigint, text, text, integer, boolean);
--   drop function if exists public.record_aid_disbursement(uuid, bigint, text);
--   drop function if exists private.disburse_aid(uuid, bigint, text, text, uuid, text);
--   drop function if exists public.respond_to_aid_award(uuid, boolean);
--   drop function if exists public.student_hold_status(uuid);
--   drop function if exists public.create_student_payment_plan(uuid, text, integer, date, integer, text);
--   drop function if exists public.release_student_hold(uuid, text);
--   drop function if exists public.place_student_hold(uuid, text);
--   drop function if exists public.refund_student_credit(uuid, text, bigint, text);
--   drop function if exists public.reverse_student_ledger_entry(uuid, bigint, text, text);
--   drop function if exists public.post_student_ledger_entry(uuid, text, text, bigint, text, text);
--   drop function if exists public.configure_student_accounts(uuid, bigint, integer);
--   drop table if exists public.student_payment_events, public.student_payment_intents, public.student_payment_plans,
--     public.student_account_holds, public.student_ledger_entries, public.student_aid_awards, public.student_account_settings;
--   drop function if exists private.student_ledger_person_key(text);
--   drop function if exists private.student_ledger_post(text, uuid, text, text, bigint, text, text, text, uuid, uuid, uuid);
--   drop function if exists private.student_ledger_key_used(text, text);
--   drop function if exists private.student_ledger_lock(text, uuid);
--   drop function if exists private.student_ledger_balance(text, uuid, text);
--   drop function if exists private.student_at_school(uuid, text);
--   drop function if exists private.student_accounts_staff(text);
--   drop function if exists private.student_accounts_on(text);
--   drop function if exists private.refuse_student_ledger_rewrite();
--   delete from public.role_capabilities where capability in ('bursar:post', 'aid:manage', 'hold:read');
--   delete from public.app_capabilities where capability in ('bursar:post', 'aid:manage', 'hold:read');
--   commit;
