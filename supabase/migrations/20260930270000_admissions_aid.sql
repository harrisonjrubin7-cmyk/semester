-- Semester — admissions records and financial-aid records: a school's own
-- system of record for what happened, and nothing that decides anything.
--
-- D-151 says Semester runs beside a school's systems (Connect) and takes a
-- module over only when the school switches that module to Core. This file is
-- two of those modules, `admissions` and `financial_aid`, and it is the slice
-- of each that is a RECORD. Student accounts already exist (D-146,
-- `20260929220000_student_accounts.sql`) and are not rebuilt here; this file
-- only reads that ledger.
--
-- ## Admissions: what happened to an application, and who said so
--
--   * An APPLICANT is one row per school, application cycle and applicant
--     reference the school supplies, with the program applied to and a status
--     from a closed list: submitted, in_review, admitted, denied, waitlisted,
--     withdrawn, enrolled. The status is not typed in: it is the last row of an
--     append-only HISTORY that names who recorded each change, when, and a
--     reason. History rows are never edited or deleted, the owner included.
--   * A status never moves backwards. `private.adm_status_legal` is the only
--     forward table; anything else is refused. The one way back is an explicit
--     CORRECTION entry, which names the entry it corrects, carries a reason and
--     needs `admissions:decide`.
--   * An admit, a deny or a waitlist is a DECISION and needs `admissions:decide`
--     (registrar, dean). Everything else needs `admissions:record` (registrar).
--     Semester computes, scores, ranks and recommends nothing: there is no
--     column, function or view in this file that orders applicants by
--     anything, and `admissionsaid.test.ts` reads this file for the words.
--   * An applicant becomes a student only when the registrar LINKS the
--     applicant to a student reference (`admissions_applicant_links`, a separate
--     append-only row, one per applicant). Nothing creates a student, an
--     account, an academic-record subject or a ledger entry from here, and
--     `enrolled` is refused until the link exists.
--   * An applicant has no account and so no access: nobody but the staff who
--     hold `admissions:read` reads an applicant file, a linked student included.
--
-- ## Financial aid: an award, its history, and what was disbursed
--
--   * An AWARD is one row per student reference, aid year and fund, with a
--     closed award type (grant, scholarship, loan, work_study, waiver, other),
--     an amount in integer cents and a status: offered, accepted, declined,
--     disbursed, cancelled. The status is the last row of an append-only
--     history, as above; a correction needs `aid:approve_high`.
--   * An award at or above the school's high-value threshold needs a second
--     person: somebody holding `aid:approve_high`, who is never the person who
--     recorded it. Until then a high award cannot be accepted or disbursed, and
--     a student does not see it. The threshold is `student_account_settings.
--     high_value_cents` (D-146), with D-146's own default when a school has set
--     none: one number for aid and the ledger, not a second one.
--   * A DISBURSEMENT is recorded against an accepted award, never for more than
--     the award in all, and may be linked to a student-accounts ledger `aid_credit`
--     entry by that entry's id so the two reconcile. The link is checked: the
--     entry exists, is an aid credit, belongs to the same school and the same
--     student, is for the same amount, has not been reversed and is not already
--     linked to another disbursement. THIS FILE NEVER WRITES TO THE LEDGER; it
--     reads one entry and records its id.
--   * A student reads their own awards and disbursements through
--     `academic_record_subjects`, the one link the school's registrar makes
--     for the record and the account ledger both. They read neither the history
--     nor an applicant file.
--
-- ## What is refused at the field level
--
--   * A run of 13 to 19 digits (a card number), as D-146 refuses it.
--   * A nine-digit run, with or without dashes or spaces, in any text a person
--     types (reason, program, fund name, note, applicant reference): the shape
--     of a social security number. This is a net and not a promise: it does not
--     catch a number spelled out in words. Title IV and FAFSA data, tax data,
--     citizenship and any federal identifier have no column here at all.
--
-- ## Not for children
--
-- Applicants are not yet students and may be minors. This slice holds applicant
-- records and aid awards for post-secondary schools only and refuses a school
-- whose edition (`schools.edition`, D-139/D-140, `20260930233000_k12_guardians`)
-- is anything but `higher_ed`. Every doubt refuses.
--
-- ## Switched off until the school says so
--
-- Every mutation is refused unless the school has switched the module (`admissions`
-- for the first half, `financial_aid` for the second) to Core, and while the
-- module is frozen or `kill.core_modules` is engaged. Reading is not gated by
-- mode: what was recorded stays readable. Every doubt reads Connect.
--
-- ## No double writes
--
-- Every mutation takes an idempotency key. The same key and request from the
-- same caller answers as the first call did and writes nothing; the same key
-- for anything else is refused.
--
-- Not decided, and not defaulted: how long a school keeps an applicant who was
-- denied, how long it keeps an aid record, what its cycles are called, which
-- funds it has. Additive and safe to run again. NOT APPLIED to production;
-- applying it needs the owner's decision.

-- ── The capabilities ─────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('admissions:record',    'Add an applicant at one school, record the non-decision steps of their application, and link an admitted applicant to a student reference.'),
  ('admissions:decide',    'Record an admission decision (admit, deny, waitlist) at one school, and correct an earlier entry. Semester itself decides nothing.'),
  ('admissions:read',      'Read one school''s applicant files and their status history.'),
  ('aid:record',           'Record an aid award, its status steps and its disbursements at one school.'),
  ('aid:approve_high',     'Approve an aid award at or above the school''s high-value threshold, never one you recorded, and correct an earlier aid entry.'),
  ('aid:read',             'Read one school''s aid awards, their history, approvals and disbursements.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar',                'admissions:record'),
  ('registrar',                'admissions:decide'),
  ('registrar',                'admissions:read'),
  ('dean',                     'admissions:decide'),
  ('dean',                     'admissions:read'),
  ('financial_aid_officer',    'aid:record'),
  ('financial_aid_officer',    'aid:read'),
  ('business_admin',           'aid:approve_high'),
  ('business_admin',           'aid:read'),
  ('student_accounts_officer', 'aid:read')
on conflict (role, capability) do nothing;

-- ── The pure rules ───────────────────────────────────────────
--
-- Each is the SQL half of a pair: its TypeScript twin is in
-- app/src/lib/admissions/ or app/src/lib/aid/, and a fixtures file next to the
-- twin is what both must reproduce (`admissions-aid.check.sql`,
-- `admissionsaid.test.ts`).

-- Why a typed text is refused, or null. A card is checked first.
create or replace function private.adm_aid_text_refused(given text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when given ~ '[0-9]([ -]?[0-9]){12,18}' then 'card'
    when given ~ '(^|[^0-9])[0-9]{3}[- ]?[0-9]{2}[- ]?[0-9]{4}([^0-9]|$)' then 'ssn'
  end;
$$;

-- Whether an application may move from one status to another going forward.
-- A correction is not this: it is its own entry and needs its own capability.
create or replace function private.adm_status_legal(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case from_status
    when 'submitted'  then to_status in ('in_review', 'withdrawn')
    when 'in_review'  then to_status in ('admitted', 'denied', 'waitlisted', 'withdrawn')
    when 'waitlisted' then to_status in ('admitted', 'denied', 'withdrawn')
    when 'admitted'   then to_status in ('enrolled', 'withdrawn')
    when 'enrolled'   then to_status in ('withdrawn')
    else false
  end, false);
$$;

-- Whether an award may move from one status to another going forward.
create or replace function private.aid_status_legal(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case from_status
    when 'offered'  then to_status in ('accepted', 'declined', 'cancelled')
    when 'accepted' then to_status in ('disbursed', 'declined', 'cancelled')
    else false
  end, false);
$$;

-- At or above the threshold; no row for the school reads D-146's default.
create or replace function private.aid_is_high(amount_cents bigint, threshold_cents bigint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select amount_cents >= coalesce(threshold_cents, 100000);
$$;

-- Why a second person's approval is refused, or null when it stands.
create or replace function private.aid_approval_problem(high boolean, recorder text, approver text, holds_capability boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when not high then 'not_high'
    when not holds_capability then 'no_capability'
    when recorder = approver then 'same_person'
  end;
$$;

-- What one more disbursement does to an award: over, partial or full.
create or replace function private.aid_disbursement_after(award_cents bigint, so_far_cents bigint, add_cents bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when add_cents <= 0 then 'invalid'
    when so_far_cents + add_cents > award_cents then 'over'
    when so_far_cents + add_cents = award_cents then 'full'
    else 'partial'
  end;
$$;

revoke all on function private.adm_aid_text_refused(text) from public, anon, authenticated;
revoke all on function private.adm_status_legal(text, text) from public, anon, authenticated;
revoke all on function private.aid_status_legal(text, text) from public, anon, authenticated;
revoke all on function private.aid_is_high(bigint, bigint) from public, anon, authenticated;
revoke all on function private.aid_approval_problem(boolean, text, text, boolean) from public, anon, authenticated;
revoke all on function private.aid_disbursement_after(bigint, bigint, bigint) from public, anon, authenticated;

-- ── Tables ─────────────────────────────────────────────────

-- The keys every mutation spends. `request` is what was asked, `result` what
-- was answered; a replay compares the first and returns the second.
create table if not exists public.admissions_aid_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in (
                    'applicant_add', 'status', 'correct', 'link', 'award', 'approve', 'aid_status', 'aid_correct', 'disburse')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

-- One application of one person to one program in one cycle, as the school
-- numbers it. `status` is the last history row and is changed by nothing else.
create table if not exists public.admissions_applicants (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  cycle         text        not null check (cycle ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$'),
  applicant_ref text        not null check (applicant_ref ~ '^[A-Za-z0-9._-]{1,64}$' and private.adm_aid_text_refused(applicant_ref) is null),
  program       text        not null check (length(btrim(program)) >= 1 and length(btrim(program)) <= 200 and private.adm_aid_text_refused(program) is null),
  status        text        not null default 'submitted' check (status in (
                  'submitted', 'in_review', 'admitted', 'denied', 'waitlisted', 'withdrawn', 'enrolled')),
  status_at     timestamptz not null default clock_timestamp(),
  created_by    uuid        references auth.users on delete set null,
  created_at    timestamptz not null default clock_timestamp(),
  operation     text        not null,
  unique (tenant_id, cycle, applicant_ref)
);

-- Every status an application has had. Append-only.
create table if not exists public.admissions_status_history (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  applicant_id uuid        not null references public.admissions_applicants(id) on delete cascade,
  seq          integer     not null check (seq >= 1),
  kind         text        not null check (kind in ('status', 'correction')),
  from_status  text        check (from_status in ('submitted', 'in_review', 'admitted', 'denied', 'waitlisted', 'withdrawn', 'enrolled')),
  to_status    text        not null check (to_status in ('submitted', 'in_review', 'admitted', 'denied', 'waitlisted', 'withdrawn', 'enrolled')),
  corrects_seq integer     check (corrects_seq >= 1),
  reason       text        not null check (length(btrim(reason)) >= 3 and length(btrim(reason)) <= 1000 and private.adm_aid_text_refused(reason) is null),
  recorded_by  uuid        references auth.users on delete set null,
  recorded_at  timestamptz not null default clock_timestamp(),
  operation    text        not null,
  unique (applicant_id, seq),
  constraint admissions_history_correction check ((kind = 'correction') = (corrects_seq is not null)),
  constraint admissions_history_first check ((seq = 1) = (from_status is null))
);

-- The registrar's link from an applicant to a student reference. One per
-- applicant, never changed, and the only way an applicant becomes a student.
create table if not exists public.admissions_applicant_links (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  applicant_id uuid        not null unique references public.admissions_applicants(id) on delete cascade,
  student_ref  text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  linked_by    uuid        references auth.users on delete set null,
  linked_at    timestamptz not null default clock_timestamp(),
  operation    text        not null
);

-- One aid award for one student in one aid year.
create table if not exists public.aid_awards (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  student_ref  text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  aid_year     text        not null check (aid_year ~ '^[0-9]{4}-[0-9]{4}$'),
  fund_name    text        not null check (length(btrim(fund_name)) >= 1 and length(btrim(fund_name)) <= 200 and private.adm_aid_text_refused(fund_name) is null),
  award_type   text        not null check (award_type in ('grant', 'scholarship', 'loan', 'work_study', 'waiver', 'other')),
  amount_cents bigint      not null check (amount_cents between 1 and 100000000000),
  status       text        not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'disbursed', 'cancelled')),
  status_at    timestamptz not null default clock_timestamp(),
  high_value   boolean     not null,
  -- Stamped when the second person's approval is written; what a student's
  -- read of a high award waits for, since a student cannot read the approval.
  approved_at  timestamptz,
  recorded_by  uuid        references auth.users on delete set null,
  recorded_at  timestamptz not null default clock_timestamp(),
  operation    text        not null
);

create table if not exists public.aid_award_history (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  award_id     uuid        not null references public.aid_awards(id) on delete cascade,
  seq          integer     not null check (seq >= 1),
  kind         text        not null check (kind in ('status', 'correction')),
  from_status  text        check (from_status in ('offered', 'accepted', 'declined', 'disbursed', 'cancelled')),
  to_status    text        not null check (to_status in ('offered', 'accepted', 'declined', 'disbursed', 'cancelled')),
  corrects_seq integer     check (corrects_seq >= 1),
  reason       text        not null check (length(btrim(reason)) >= 3 and length(btrim(reason)) <= 1000 and private.adm_aid_text_refused(reason) is null),
  recorded_by  uuid        references auth.users on delete set null,
  recorded_at  timestamptz not null default clock_timestamp(),
  operation    text        not null,
  unique (award_id, seq),
  constraint aid_history_correction check ((kind = 'correction') = (corrects_seq is not null)),
  constraint aid_history_first check ((seq = 1) = (from_status is null))
);

-- The second person's yes on a high award. One per award.
create table if not exists public.aid_award_approvals (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  award_id    uuid        not null unique references public.aid_awards(id) on delete cascade,
  approved_by uuid        references auth.users on delete set null,
  approved_at timestamptz not null default clock_timestamp(),
  note        text        not null default '' check (length(note) <= 1000 and private.adm_aid_text_refused(note) is null),
  operation   text        not null
);

-- Money the school says it paid out against an award. No money moves here.
create table if not exists public.aid_disbursements (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  award_id        uuid        not null references public.aid_awards(id) on delete cascade,
  student_ref     text        not null,
  amount_cents    bigint      not null check (amount_cents > 0),
  disbursed_on    date        not null,
  -- The student-accounts ledger entry this reconciles with, read and never written.
  ledger_entry_id uuid        unique references public.student_account_entries(id),
  recorded_by     uuid        references auth.users on delete set null,
  recorded_at     timestamptz not null default clock_timestamp(),
  operation       text        not null
);

-- Every foreign key covered (`indexes.check.sql`), each index by its lead column.
create index if not exists admissions_aid_operations_by_actor on public.admissions_aid_operations (actor);
create index if not exists admissions_applicants_by_creator on public.admissions_applicants (created_by);
create index if not exists admissions_applicants_by_status on public.admissions_applicants (tenant_id, cycle, status);
create index if not exists admissions_status_history_by_tenant on public.admissions_status_history (tenant_id);
create index if not exists admissions_status_history_by_recorder on public.admissions_status_history (recorded_by);
create index if not exists admissions_applicant_links_by_tenant on public.admissions_applicant_links (tenant_id, student_ref);
create index if not exists admissions_applicant_links_by_linker on public.admissions_applicant_links (linked_by);
create index if not exists aid_awards_by_student on public.aid_awards (tenant_id, student_ref, aid_year);
create index if not exists aid_awards_by_recorder on public.aid_awards (recorded_by);
-- One live award per student, year and fund; a declined or cancelled one makes way for a new offer.
create unique index if not exists aid_awards_one_live on public.aid_awards (tenant_id, student_ref, aid_year, lower(btrim(fund_name)))
  where status not in ('declined', 'cancelled');
create index if not exists aid_award_history_by_tenant on public.aid_award_history (tenant_id);
create index if not exists aid_award_history_by_recorder on public.aid_award_history (recorded_by);
create index if not exists aid_award_approvals_by_tenant on public.aid_award_approvals (tenant_id);
create index if not exists aid_award_approvals_by_approver on public.aid_award_approvals (approved_by);
create index if not exists aid_disbursements_by_award on public.aid_disbursements (award_id);
create index if not exists aid_disbursements_by_tenant on public.aid_disbursements (tenant_id, student_ref);
create index if not exists aid_disbursements_by_recorder on public.aid_disbursements (recorded_by);

comment on table public.admissions_aid_operations is 'Idempotency keys the admissions and aid mutations spent, with what each asked and answered.';
comment on table public.admissions_applicants is 'One application: school, cycle, the school''s own applicant reference, program, and current status (the last history row). Not a student and holds no account. Semester itself decides and suggests nothing.';
comment on table public.admissions_status_history is 'Every status an application has had, who recorded it, when and why. Append-only, for the owner too. A status moves backwards only by a correction entry.';
comment on table public.admissions_applicant_links is 'The registrar''s link from one applicant to a student reference; the only way an applicant becomes a student. Append-only. Semester never creates a student.';
comment on table public.aid_awards is 'One aid award: student reference, aid year, fund, closed type, integer cents, current status (the last history row) and whether it was at or above the school''s high-value threshold when recorded. No federal data, no identifiers.';
comment on table public.aid_award_history is 'Every status an aid award has had, who recorded it and why. Append-only.';
comment on table public.aid_award_approvals is 'The second person''s approval of a high-value award, never the person who recorded it. Append-only.';
comment on table public.aid_disbursements is 'What the school paid out against an award, optionally linked to the student-accounts ledger aid credit that reconciles with it. Append-only. Nothing here writes to that ledger and no money moves.';

-- ── What may change, for the owner too ───────────────────────

-- Append-only: only the clearing of a person reference by account deletion,
-- and the removal of a school, are not refused.
create or replace function private.adm_aid_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  people text[] := tg_argv::text[];
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - people) = (to_jsonb(old) - people)
     and not exists (select 1 from unnest(people) c
                      where (to_jsonb(new) ->> c) is not null and (to_jsonb(new) ->> c) is distinct from (to_jsonb(old) ->> c)) then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then return old; end if;
  raise exception 'semester: % is append-only; a correction is a new entry', tg_table_name using errcode = '42501';
end $$;

revoke all on function private.adm_aid_append_only() from public, anon, authenticated;

drop trigger if exists admissions_status_history_append_only on public.admissions_status_history;
create trigger admissions_status_history_append_only before update or delete on public.admissions_status_history
  for each row execute function private.adm_aid_append_only('recorded_by');
drop trigger if exists admissions_applicant_links_append_only on public.admissions_applicant_links;
create trigger admissions_applicant_links_append_only before update or delete on public.admissions_applicant_links
  for each row execute function private.adm_aid_append_only('linked_by');
drop trigger if exists aid_award_history_append_only on public.aid_award_history;
create trigger aid_award_history_append_only before update or delete on public.aid_award_history
  for each row execute function private.adm_aid_append_only('recorded_by');
drop trigger if exists aid_award_approvals_append_only on public.aid_award_approvals;
create trigger aid_award_approvals_append_only before update or delete on public.aid_award_approvals
  for each row execute function private.adm_aid_append_only('approved_by');
drop trigger if exists aid_disbursements_append_only on public.aid_disbursements;
create trigger aid_disbursements_append_only before update or delete on public.aid_disbursements
  for each row execute function private.adm_aid_append_only('recorded_by');

-- An applicant (or an award) never changes except for its status, and the
-- status is only ever what the last history row says.
create or replace function private.admissions_applicants_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  last_to text;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.schools s where s.id = old.tenant_id) then return old; end if;
    raise exception 'semester: an applicant is never deleted' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by')
     and (new.created_by is null or new.created_by = old.created_by) then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'status_at', 'created_by']) <> (to_jsonb(old) - array['status', 'status_at', 'created_by'])
     or new.created_by is distinct from old.created_by then
    raise exception 'semester: an applicant is not edited; only a status entry changes its status' using errcode = '42501';
  end if;
  select h.to_status into last_to from public.admissions_status_history h where h.applicant_id = old.id order by h.seq desc limit 1;
  if new.status is distinct from last_to then
    raise exception 'semester: an applicant''s status is the last entry of its history' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.admissions_applicants_guard() from public, anon, authenticated;
drop trigger if exists admissions_applicants_guard on public.admissions_applicants;
create trigger admissions_applicants_guard before update or delete on public.admissions_applicants
  for each row execute function private.admissions_applicants_guard();

create or replace function private.aid_awards_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  last_to text;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.schools s where s.id = old.tenant_id) then return old; end if;
    raise exception 'semester: an aid award is never deleted; cancel it' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'recorded_by') = (to_jsonb(old) - 'recorded_by')
     and (new.recorded_by is null or new.recorded_by = old.recorded_by) then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'status_at', 'approved_at', 'recorded_by']) <> (to_jsonb(old) - array['status', 'status_at', 'approved_at', 'recorded_by'])
     or new.recorded_by is distinct from old.recorded_by then
    raise exception 'semester: an aid award is not edited; a different amount is a new award' using errcode = '42501';
  end if;
  if new.approved_at is distinct from old.approved_at
     and (old.approved_at is not null
          or not exists (select 1 from public.aid_award_approvals p where p.award_id = old.id and p.approved_at = new.approved_at)) then
    raise exception 'semester: an award is approved by an approval entry, once' using errcode = '42501';
  end if;
  select h.to_status into last_to from public.aid_award_history h where h.award_id = old.id order by h.seq desc limit 1;
  if new.status is distinct from last_to then
    raise exception 'semester: an award''s status is the last entry of its history' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.aid_awards_guard() from public, anon, authenticated;
drop trigger if exists aid_awards_guard on public.aid_awards;
create trigger aid_awards_guard before update or delete on public.aid_awards
  for each row execute function private.aid_awards_guard();

-- A history entry: the next in sequence, from where the application is, and
-- legal going forward unless it is a correction. Assigned here, so a caller
-- cannot choose a sequence number or claim to start from somewhere else.
create or replace function private.admissions_history_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a public.admissions_applicants;
  last_seq integer;
begin
  select * into a from public.admissions_applicants x where x.id = new.applicant_id for update;
  if not found or a.tenant_id <> new.tenant_id then
    raise exception 'semester: no such applicant here' using errcode = 'check_violation';
  end if;
  select coalesce(max(h.seq), 0) into last_seq from public.admissions_status_history h where h.applicant_id = a.id;
  new.seq := last_seq + 1;
  new.from_status := case when last_seq = 0 then null else a.status end;
  if last_seq = 0 then
    if new.kind <> 'status' or new.to_status <> 'submitted' then
      raise exception 'semester: an application starts as submitted' using errcode = 'check_violation';
    end if;
  elsif new.kind = 'status' then
    if not private.adm_status_legal(a.status, new.to_status) then
      raise exception 'semester: an application does not move from % to %; a status does not go backwards except by a correction', a.status, new.to_status using errcode = 'check_violation';
    end if;
  else
    if new.to_status = a.status then
      raise exception 'semester: a correction changes the status' using errcode = 'check_violation';
    end if;
    if new.corrects_seq > last_seq then
      raise exception 'semester: a correction names an entry that exists' using errcode = 'check_violation';
    end if;
  end if;
  if new.to_status = 'enrolled' and not exists (select 1 from public.admissions_applicant_links l where l.applicant_id = a.id) then
    raise exception 'semester: an applicant is not enrolled until the registrar has linked them to a student reference' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function private.admissions_history_apply()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.admissions_applicants set status = new.to_status, status_at = new.recorded_at where id = new.applicant_id;
  return new;
end $$;

revoke all on function private.admissions_history_guard() from public, anon, authenticated;
revoke all on function private.admissions_history_apply() from public, anon, authenticated;
drop trigger if exists admissions_history_guard on public.admissions_status_history;
create trigger admissions_history_guard before insert on public.admissions_status_history
  for each row execute function private.admissions_history_guard();
drop trigger if exists admissions_history_apply on public.admissions_status_history;
create trigger admissions_history_apply after insert on public.admissions_status_history
  for each row execute function private.admissions_history_apply();

-- Only an admitted (or enrolled) applicant is linked to a student reference.
create or replace function private.admissions_links_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a public.admissions_applicants;
begin
  select * into a from public.admissions_applicants x where x.id = new.applicant_id;
  if not found or a.tenant_id <> new.tenant_id then
    raise exception 'semester: no such applicant here' using errcode = 'check_violation';
  end if;
  if a.status not in ('admitted', 'enrolled') then
    raise exception 'semester: only an admitted applicant is linked to a student reference; this one is %', a.status using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function private.admissions_links_guard() from public, anon, authenticated;
drop trigger if exists admissions_links_guard on public.admissions_applicant_links;
create trigger admissions_links_guard before insert on public.admissions_applicant_links
  for each row execute function private.admissions_links_guard();

create or replace function private.aid_history_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  w public.aid_awards;
  last_seq integer;
begin
  select * into w from public.aid_awards x where x.id = new.award_id for update;
  if not found or w.tenant_id <> new.tenant_id then
    raise exception 'semester: no such award here' using errcode = 'check_violation';
  end if;
  select coalesce(max(h.seq), 0) into last_seq from public.aid_award_history h where h.award_id = w.id;
  new.seq := last_seq + 1;
  new.from_status := case when last_seq = 0 then null else w.status end;
  if last_seq = 0 then
    if new.kind <> 'status' or new.to_status <> 'offered' then
      raise exception 'semester: an award starts as offered' using errcode = 'check_violation';
    end if;
  elsif new.kind = 'status' then
    if not private.aid_status_legal(w.status, new.to_status) then
      raise exception 'semester: an award does not move from % to %; a status does not go backwards except by a correction', w.status, new.to_status using errcode = 'check_violation';
    end if;
  else
    if new.to_status = w.status then
      raise exception 'semester: a correction changes the status' using errcode = 'check_violation';
    end if;
    if new.corrects_seq > last_seq then
      raise exception 'semester: a correction names an entry that exists' using errcode = 'check_violation';
    end if;
  end if;
  if w.high_value and new.to_status in ('accepted', 'disbursed')
     and not exists (select 1 from public.aid_award_approvals p where p.award_id = w.id) then
    raise exception 'semester: this award is at or above the high-value threshold and has not been approved by a second person' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function private.aid_history_apply()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.aid_awards set status = new.to_status, status_at = new.recorded_at where id = new.award_id;
  return new;
end $$;

revoke all on function private.aid_history_guard() from public, anon, authenticated;
revoke all on function private.aid_history_apply() from public, anon, authenticated;
drop trigger if exists aid_history_guard on public.aid_award_history;
create trigger aid_history_guard before insert on public.aid_award_history
  for each row execute function private.aid_history_guard();
drop trigger if exists aid_history_apply on public.aid_award_history;
create trigger aid_history_apply after insert on public.aid_award_history
  for each row execute function private.aid_history_apply();

-- The second person: the award is a high one, still open, and the approver
-- holds the capability and is not whoever recorded it. Held here, at the
-- table, so no caller can go round the function that normally writes it.
create or replace function private.aid_approvals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  w public.aid_awards;
  problem text;
begin
  select * into w from public.aid_awards x where x.id = new.award_id;
  if not found or w.tenant_id <> new.tenant_id then
    raise exception 'semester: no such award here' using errcode = 'check_violation';
  end if;
  problem := private.aid_approval_problem(
    w.high_value, w.recorded_by::text, new.approved_by::text,
    auth.uid() is null or private.has_capability('aid:approve_high', 'school', w.tenant_id));
  if problem = 'not_high' then
    raise exception 'semester: only an award at or above the high-value threshold is approved by a second person' using errcode = 'check_violation';
  elsif problem = 'no_capability' then
    raise exception 'semester: that needs aid:approve_high at your school' using errcode = 'insufficient_privilege';
  elsif problem = 'same_person' then
    raise exception 'semester: the person who recorded an award does not approve it' using errcode = 'insufficient_privilege';
  end if;
  if w.status not in ('offered', 'accepted') then
    raise exception 'semester: this award is % and takes no approval', w.status using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function private.aid_approvals_apply()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.aid_awards set approved_at = new.approved_at where id = new.award_id;
  return new;
end $$;

revoke all on function private.aid_approvals_apply() from public, anon, authenticated;
revoke all on function private.aid_approvals_guard() from public, anon, authenticated;
drop trigger if exists aid_approvals_guard on public.aid_award_approvals;
create trigger aid_approvals_guard before insert on public.aid_award_approvals
  for each row execute function private.aid_approvals_guard();
drop trigger if exists aid_approvals_apply on public.aid_award_approvals;
create trigger aid_approvals_apply after insert on public.aid_award_approvals
  for each row execute function private.aid_approvals_apply();

-- A disbursement: an accepted, approved award; never more than the award in
-- all; and, if it names a ledger entry, an entry that is this student's aid
-- credit at this school, for this amount, not reversed and not used twice.
-- Reads the ledger; writes nothing to it.
create or replace function private.aid_disbursements_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  w public.aid_awards;
  e public.student_account_entries;
  so_far bigint;
begin
  select * into w from public.aid_awards x where x.id = new.award_id for update;
  if not found or w.tenant_id <> new.tenant_id or w.student_ref <> new.student_ref then
    raise exception 'semester: no such award here' using errcode = 'check_violation';
  end if;
  if w.status <> 'accepted' then
    raise exception 'semester: a disbursement is recorded against an accepted award; this one is %', w.status using errcode = 'check_violation';
  end if;
  if w.high_value and not exists (select 1 from public.aid_award_approvals p where p.award_id = w.id) then
    raise exception 'semester: this award is at or above the high-value threshold and has not been approved by a second person' using errcode = 'check_violation';
  end if;
  select coalesce(sum(d.amount_cents), 0) into so_far from public.aid_disbursements d where d.award_id = w.id;
  if private.aid_disbursement_after(w.amount_cents, so_far, new.amount_cents) = 'over' then
    raise exception 'semester: at most % cents of this award is left to disburse', w.amount_cents - so_far using errcode = 'check_violation';
  end if;
  if new.ledger_entry_id is not null then
    select * into e from public.student_account_entries x where x.id = new.ledger_entry_id;
    if not found or e.tenant_id <> w.tenant_id or e.student_ref <> w.student_ref or e.kind <> 'aid_credit' then
      raise exception 'semester: that ledger entry is not an aid credit on this student''s account at this school' using errcode = 'check_violation';
    end if;
    if -e.amount_cents <> new.amount_cents then
      raise exception 'semester: that aid credit is for % cents and this disbursement for % cents', -e.amount_cents, new.amount_cents using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.student_account_entries r where r.kind = 'reversal' and r.reference_entry_id = e.id) then
      raise exception 'semester: that aid credit has been reversed on the student account' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

-- When what was disbursed adds up to the award, the award is disbursed: one
-- more entry of its history, by the same person.
create or replace function private.aid_disbursements_apply()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  w public.aid_awards;
begin
  select * into w from public.aid_awards x where x.id = new.award_id;
  if (select coalesce(sum(d.amount_cents), 0) from public.aid_disbursements d where d.award_id = w.id) = w.amount_cents then
    insert into public.aid_award_history (tenant_id, award_id, kind, to_status, reason, recorded_by, operation)
    values (w.tenant_id, w.id, 'status', 'disbursed', 'The recorded disbursements add up to the whole award.', new.recorded_by, new.operation);
  end if;
  return new;
end $$;

revoke all on function private.aid_disbursements_guard() from public, anon, authenticated;
revoke all on function private.aid_disbursements_apply() from public, anon, authenticated;
drop trigger if exists aid_disbursements_guard on public.aid_disbursements;
create trigger aid_disbursements_guard before insert on public.aid_disbursements
  for each row execute function private.aid_disbursements_guard();
drop trigger if exists aid_disbursements_apply on public.aid_disbursements;
create trigger aid_disbursements_apply after insert on public.aid_disbursements
  for each row execute function private.aid_disbursements_apply();

-- ── Who reads ──────────────────────────────────────────────

alter table public.admissions_aid_operations enable row level security;
alter table public.admissions_applicants enable row level security;
alter table public.admissions_status_history enable row level security;
alter table public.admissions_applicant_links enable row level security;
alter table public.aid_awards enable row level security;
alter table public.aid_award_history enable row level security;
alter table public.aid_award_approvals enable row level security;
alter table public.aid_disbursements enable row level security;

revoke all on table public.admissions_aid_operations from anon, authenticated;
revoke all on table public.admissions_applicants from anon, authenticated;
revoke all on table public.admissions_status_history from anon, authenticated;
revoke all on table public.admissions_applicant_links from anon, authenticated;
revoke all on table public.aid_awards from anon, authenticated;
revoke all on table public.aid_award_history from anon, authenticated;
revoke all on table public.aid_award_approvals from anon, authenticated;
revoke all on table public.aid_disbursements from anon, authenticated;
grant select on table public.admissions_aid_operations to authenticated;
grant select on table public.admissions_applicants to authenticated;
grant select on table public.admissions_status_history to authenticated;
grant select on table public.admissions_applicant_links to authenticated;
grant select on table public.aid_awards to authenticated;
grant select on table public.aid_award_history to authenticated;
grant select on table public.aid_award_approvals to authenticated;
grant select on table public.aid_disbursements to authenticated;

drop policy if exists "callers read their own operations" on public.admissions_aid_operations;
create policy "callers read their own operations" on public.admissions_aid_operations
  for select to authenticated
  using (actor = (select auth.uid()));

-- An applicant file is read by admissions staff and by nobody else. There is no
-- policy for a student or an applicant: an applicant has no account here.
drop policy if exists "admissions staff read applicants" on public.admissions_applicants;
create policy "admissions staff read applicants" on public.admissions_applicants
  for select to authenticated
  using (private.has_capability('admissions:read', 'school', tenant_id));
drop policy if exists "admissions staff read the history" on public.admissions_status_history;
create policy "admissions staff read the history" on public.admissions_status_history
  for select to authenticated
  using (private.has_capability('admissions:read', 'school', tenant_id));
drop policy if exists "admissions staff read the links" on public.admissions_applicant_links;
create policy "admissions staff read the links" on public.admissions_applicant_links
  for select to authenticated
  using (private.has_capability('admissions:read', 'school', tenant_id));

-- Aid staff read every award at their school. A student reads their own,
-- through the link the school made on the academic record, and not one still
-- waiting for its second person.
drop policy if exists "aid staff read awards, a student their own" on public.aid_awards;
create policy "aid staff read awards, a student their own" on public.aid_awards
  for select to authenticated
  using (private.has_capability('aid:read', 'school', tenant_id)
         or (exists (select 1 from public.academic_record_subjects s
                      where s.tenant_id = aid_awards.tenant_id
                        and s.student_ref = aid_awards.student_ref
                        and s.user_id = (select auth.uid()))
             and (not high_value or approved_at is not null)));
drop policy if exists "aid staff read the history" on public.aid_award_history;
create policy "aid staff read the history" on public.aid_award_history
  for select to authenticated
  using (private.has_capability('aid:read', 'school', tenant_id));
drop policy if exists "aid staff read the approvals" on public.aid_award_approvals;
create policy "aid staff read the approvals" on public.aid_award_approvals
  for select to authenticated
  using (private.has_capability('aid:read', 'school', tenant_id));
-- A disbursement reads as its award does: the award's own policy decides.
drop policy if exists "a disbursement reads as its award does" on public.aid_disbursements;
create policy "a disbursement reads as its award does" on public.aid_disbursements
  for select to authenticated
  using (exists (select 1 from public.aid_awards a where a.id = award_id));

-- ── The rules every mutation starts with ──────────────────────

create or replace function private.adm_aid_school()
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
  if school is null then
    raise exception 'semester: your account has no school' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;

create or replace function private.adm_aid_require(school text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'school', school) then
    raise exception 'semester: that needs % at your school', want_cap using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Raises unless the school is a post-secondary one that has switched this
-- module to Semester Core, and the module is neither frozen nor paused.
create or replace function private.adm_aid_require_core(school text, want_module text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m  record;
  ed text;
begin
  select s.edition into ed from public.schools s where s.id = school;
  if ed is distinct from 'higher_ed' then
    raise exception 'semester: applicant and aid records are held for post-secondary schools only; this slice refuses a K-12 school' using errcode = 'insufficient_privilege';
  end if;
  select e.mode, e.frozen, e.killed into m
    from public.effective_module_modes(school) e
   where e.module = want_module;
  if found and m.killed and exists (select 1 from public.tenant_module_mode t
                                     where t.tenant_id = school and t.module = want_module and t.mode = 'core') then
    raise exception 'semester: Core modules are paused for your school' using errcode = 'insufficient_privilege';
  end if;
  if not found or m.mode <> 'core' then
    raise exception 'semester: your school has not switched % to Semester Core', replace(want_module, '_', ' ') using errcode = 'insufficient_privilege';
  end if;
  if m.frozen then
    raise exception 'semester: % is frozen; what was recorded is kept and read-only', replace(want_module, '_', ' ') using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Null means go ahead; otherwise the first answer, to replay. Holds a lock on
-- the key until commit, so two calls with one key cannot both do the work.
create or replace function private.adm_aid_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.admissions_aid_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('admissions-aid-op:' || school || ':' || want_key));
  select * into op from public.admissions_aid_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;

create or replace function private.adm_aid_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.admissions_aid_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;

-- A typed text, trimmed and checked: its length, and that it is neither a card
-- number nor shaped like a social security number.
create or replace function private.adm_aid_clean(label text, given text, lo integer, hi integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := btrim(coalesce(given, ''));
  why text;
begin
  if length(t) not between lo and hi then
    raise exception 'semester: % is % to % characters', label, lo, hi using errcode = 'check_violation';
  end if;
  why := private.adm_aid_text_refused(t);
  if why = 'card' then
    raise exception 'semester: % looks like a card number; card numbers are never recorded here', label using errcode = 'check_violation';
  elsif why = 'ssn' then
    raise exception 'semester: % looks like a social security number; those are never recorded here', label using errcode = 'check_violation';
  end if;
  return t;
end $$;

revoke all on function private.adm_aid_school() from public, anon, authenticated;
revoke all on function private.adm_aid_require(text, text) from public, anon, authenticated;
revoke all on function private.adm_aid_require_core(text, text) from public, anon, authenticated;
revoke all on function private.adm_aid_replay(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.adm_aid_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.adm_aid_clean(text, text, integer, integer) from public, anon, authenticated;

-- ── Admissions ─────────────────────────────────────────────

-- Adds an applicant, as submitted. `want_reason` is how it arrived, in the
-- school's words ("Received through the school's own portal").
create or replace function public.admissions_applicant_add(
  want_cycle text, want_ref text, want_program text, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.adm_aid_school();
  cyc     text := btrim(coalesce(want_cycle, ''));
  aref    text := btrim(coalesce(want_ref, ''));
  req     jsonb;
  prior   jsonb;
  prog    text;
  why     text;
  made    uuid;
begin
  perform private.adm_aid_require(school, 'admissions:record');
  perform private.adm_aid_require_core(school, 'admissions');
  req := jsonb_build_object('cycle', cyc, 'ref', aref, 'program', btrim(coalesce(want_program, '')), 'reason', btrim(coalesce(want_reason, '')));
  prior := private.adm_aid_replay(school, want_key, 'applicant_add', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if cyc !~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$' then
    raise exception 'semester: a cycle is up to 40 letters, digits, spaces or . _ / -, such as Fall 2027' using errcode = 'check_violation';
  end if;
  if aref !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: an applicant reference is 1 to 64 letters, digits, dots, dashes or underscores' using errcode = 'check_violation';
  end if;
  why := private.adm_aid_text_refused(aref);
  if why is not null then
    raise exception 'semester: an applicant reference that looks like a % is refused; use the school''s own applicant reference', case why when 'ssn' then 'social security number' else 'card number' end using errcode = 'check_violation';
  end if;
  prog := private.adm_aid_clean('a program', want_program, 1, 200);
  if exists (select 1 from public.admissions_applicants a where a.tenant_id = school and a.cycle = cyc and a.applicant_ref = aref) then
    raise exception 'semester: that applicant is already recorded for this cycle' using errcode = 'unique_violation';
  end if;

  insert into public.admissions_applicants (tenant_id, cycle, applicant_ref, program, created_by, operation)
  values (school, cyc, aref, prog, me, want_key)
  returning id into made;
  insert into public.admissions_status_history (tenant_id, applicant_id, kind, to_status, reason, recorded_by, operation)
  values (school, made, 'status', 'submitted', private.adm_aid_clean('a reason', want_reason, 3, 1000), me, want_key);
  perform private.adm_aid_spend(school, want_key, 'applicant_add', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Records the next status of an application. An admit, a deny and a waitlist
-- are decisions and need `admissions:decide`; every other step `admissions:record`.
-- Semester proposes nothing: the person chooses the status and says why.
create or replace function public.admissions_status_record(
  want_applicant uuid, want_to text, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  a      public.admissions_applicants;
  req    jsonb;
  prior  jsonb;
  reason text;
  made   uuid;
begin
  select * into a from public.admissions_applicants x where x.id = want_applicant and x.tenant_id = school;
  if not found then raise exception 'semester: no such applicant here' using errcode = 'check_violation'; end if;
  if want_to is null or want_to not in ('submitted', 'in_review', 'admitted', 'denied', 'waitlisted', 'withdrawn', 'enrolled') then
    raise exception 'semester: that is not an admissions status' using errcode = 'check_violation';
  end if;
  perform private.adm_aid_require(school, case when want_to in ('admitted', 'denied', 'waitlisted') then 'admissions:decide' else 'admissions:record' end);
  perform private.adm_aid_require_core(school, 'admissions');
  req := jsonb_build_object('applicant', want_applicant, 'to', want_to, 'reason', btrim(coalesce(want_reason, '')));
  prior := private.adm_aid_replay(school, want_key, 'status', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  reason := private.adm_aid_clean('a reason', want_reason, 3, 1000);
  insert into public.admissions_status_history (tenant_id, applicant_id, kind, to_status, reason, recorded_by, operation)
  values (school, a.id, 'status', want_to, reason, me, want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'status', req, jsonb_build_object('id', made));
  return made;
end $$;

-- The one way back: an entry that names the entry it corrects and says why.
create or replace function public.admissions_status_correct(
  want_applicant uuid, want_to text, want_corrects integer, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  a      public.admissions_applicants;
  req    jsonb;
  prior  jsonb;
  reason text;
  made   uuid;
begin
  select * into a from public.admissions_applicants x where x.id = want_applicant and x.tenant_id = school;
  if not found then raise exception 'semester: no such applicant here' using errcode = 'check_violation'; end if;
  perform private.adm_aid_require(school, 'admissions:decide');
  perform private.adm_aid_require_core(school, 'admissions');
  req := jsonb_build_object('applicant', want_applicant, 'to', want_to, 'corrects', want_corrects, 'reason', btrim(coalesce(want_reason, '')));
  prior := private.adm_aid_replay(school, want_key, 'correct', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_to is null or want_to not in ('submitted', 'in_review', 'admitted', 'denied', 'waitlisted', 'withdrawn', 'enrolled') then
    raise exception 'semester: that is not an admissions status' using errcode = 'check_violation';
  end if;
  if want_corrects is null or want_corrects < 1 then
    raise exception 'semester: a correction names the entry it corrects' using errcode = 'check_violation';
  end if;
  reason := private.adm_aid_clean('a reason', want_reason, 3, 1000);
  insert into public.admissions_status_history (tenant_id, applicant_id, kind, to_status, corrects_seq, reason, recorded_by, operation)
  values (school, a.id, 'correction', want_to, want_corrects, reason, me, want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'correct', req, jsonb_build_object('id', made));
  return made;
end $$;

-- The registrar's link from an admitted applicant to a student reference.
-- Writes the link and nothing else: no student, no account, no record subject.
create or replace function public.admissions_applicant_link(want_applicant uuid, want_student_ref text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  a      public.admissions_applicants;
  sref   text := btrim(coalesce(want_student_ref, ''));
  req    jsonb;
  prior  jsonb;
  made   uuid;
begin
  select * into a from public.admissions_applicants x where x.id = want_applicant and x.tenant_id = school;
  if not found then raise exception 'semester: no such applicant here' using errcode = 'check_violation'; end if;
  perform private.adm_aid_require(school, 'admissions:record');
  perform private.adm_aid_require_core(school, 'admissions');
  req := jsonb_build_object('applicant', want_applicant, 'student', sref);
  prior := private.adm_aid_replay(school, want_key, 'link', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if sref !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: that is not a student reference' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.admissions_applicant_links l where l.applicant_id = a.id) then
    raise exception 'semester: this applicant is already linked to a student reference' using errcode = 'unique_violation';
  end if;
  insert into public.admissions_applicant_links (tenant_id, applicant_id, student_ref, linked_by, operation)
  values (school, a.id, sref, me, want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'link', req, jsonb_build_object('id', made));
  return made;
end $$;

-- ── Financial aid ───────────────────────────────────────────

-- Records an award, as offered. At or above the school's threshold it is a high
-- award and waits for a second person before it can be accepted or disbursed.
create or replace function public.aid_award_record(
  want_student_ref text, want_aid_year text, want_fund text, want_type text, want_amount_cents bigint,
  want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  sref   text := btrim(coalesce(want_student_ref, ''));
  year   text := btrim(coalesce(want_aid_year, ''));
  req    jsonb;
  prior  jsonb;
  fund   text;
  limit_ bigint;
  made   uuid;
begin
  perform private.adm_aid_require(school, 'aid:record');
  perform private.adm_aid_require_core(school, 'financial_aid');
  req := jsonb_build_object('student', sref, 'year', year, 'fund', btrim(coalesce(want_fund, '')), 'type', want_type,
                            'amount', want_amount_cents, 'reason', btrim(coalesce(want_reason, '')));
  prior := private.adm_aid_replay(school, want_key, 'award', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if sref !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: that is not a student reference' using errcode = 'check_violation';
  end if;
  if year !~ '^[0-9]{4}-[0-9]{4}$' or substr(year, 6, 4)::integer <> substr(year, 1, 4)::integer + 1 then
    raise exception 'semester: an aid year is two consecutive years, such as 2026-2027' using errcode = 'check_violation';
  end if;
  fund := private.adm_aid_clean('a fund name', want_fund, 1, 200);
  if want_type is null or want_type not in ('grant', 'scholarship', 'loan', 'work_study', 'waiver', 'other') then
    raise exception 'semester: an award is a grant, scholarship, loan, work_study, waiver or other' using errcode = 'check_violation';
  end if;
  if want_amount_cents is null or want_amount_cents < 1 or want_amount_cents > 100000000000 then
    raise exception 'semester: an amount is a whole number of cents, at least 1' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.aid_awards w
              where w.tenant_id = school and w.student_ref = sref and w.aid_year = year
                and lower(btrim(w.fund_name)) = lower(fund) and w.status not in ('declined', 'cancelled')) then
    raise exception 'semester: this student already has a live award from that fund this year' using errcode = 'unique_violation';
  end if;

  select s.high_value_cents into limit_ from public.student_account_settings s where s.tenant_id = school;
  insert into public.aid_awards (tenant_id, student_ref, aid_year, fund_name, award_type, amount_cents, high_value, recorded_by, operation)
  values (school, sref, year, fund, want_type, want_amount_cents, private.aid_is_high(want_amount_cents, limit_), me, want_key)
  returning id into made;
  insert into public.aid_award_history (tenant_id, award_id, kind, to_status, reason, recorded_by, operation)
  values (school, made, 'status', 'offered', private.adm_aid_clean('a reason', want_reason, 3, 1000), me, want_key);
  perform private.adm_aid_spend(school, want_key, 'award', req, jsonb_build_object('id', made));
  return made;
end $$;

-- The second person's approval of a high award.
create or replace function public.aid_award_approve(want_award uuid, want_note text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  w      public.aid_awards;
  req    jsonb;
  prior  jsonb;
  made   uuid;
begin
  select * into w from public.aid_awards x where x.id = want_award and x.tenant_id = school;
  if not found then raise exception 'semester: no such award here' using errcode = 'check_violation'; end if;
  perform private.adm_aid_require(school, 'aid:approve_high');
  perform private.adm_aid_require_core(school, 'financial_aid');
  req := jsonb_build_object('award', want_award, 'note', btrim(coalesce(want_note, '')));
  prior := private.adm_aid_replay(school, want_key, 'approve', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if exists (select 1 from public.aid_award_approvals p where p.award_id = w.id) then
    raise exception 'semester: this award has already been approved' using errcode = 'unique_violation';
  end if;
  insert into public.aid_award_approvals (tenant_id, award_id, approved_by, note, operation)
  values (school, w.id, me, private.adm_aid_clean('a note', want_note, 0, 1000), want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'approve', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Moves an award to its next status. Disbursed is reached by recording the
-- disbursements, not by saying so.
create or replace function public.aid_status_record(want_award uuid, want_to text, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  w      public.aid_awards;
  req    jsonb;
  prior  jsonb;
  made   uuid;
begin
  select * into w from public.aid_awards x where x.id = want_award and x.tenant_id = school;
  if not found then raise exception 'semester: no such award here' using errcode = 'check_violation'; end if;
  perform private.adm_aid_require(school, 'aid:record');
  perform private.adm_aid_require_core(school, 'financial_aid');
  req := jsonb_build_object('award', want_award, 'to', want_to, 'reason', btrim(coalesce(want_reason, '')));
  prior := private.adm_aid_replay(school, want_key, 'aid_status', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_to is null or want_to not in ('offered', 'accepted', 'declined', 'disbursed', 'cancelled') then
    raise exception 'semester: that is not an aid status' using errcode = 'check_violation';
  end if;
  if want_to = 'disbursed' then
    raise exception 'semester: an award is disbursed by recording its disbursements' using errcode = 'check_violation';
  end if;
  insert into public.aid_award_history (tenant_id, award_id, kind, to_status, reason, recorded_by, operation)
  values (school, w.id, 'status', want_to, private.adm_aid_clean('a reason', want_reason, 3, 1000), me, want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'aid_status', req, jsonb_build_object('id', made));
  return made;
end $$;

create or replace function public.aid_status_correct(want_award uuid, want_to text, want_corrects integer, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  w      public.aid_awards;
  req    jsonb;
  prior  jsonb;
  made   uuid;
begin
  select * into w from public.aid_awards x where x.id = want_award and x.tenant_id = school;
  if not found then raise exception 'semester: no such award here' using errcode = 'check_violation'; end if;
  perform private.adm_aid_require(school, 'aid:approve_high');
  perform private.adm_aid_require_core(school, 'financial_aid');
  req := jsonb_build_object('award', want_award, 'to', want_to, 'corrects', want_corrects, 'reason', btrim(coalesce(want_reason, '')));
  prior := private.adm_aid_replay(school, want_key, 'aid_correct', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_to is null or want_to not in ('offered', 'accepted', 'declined', 'disbursed', 'cancelled') then
    raise exception 'semester: that is not an aid status' using errcode = 'check_violation';
  end if;
  if want_corrects is null or want_corrects < 1 then
    raise exception 'semester: a correction names the entry it corrects' using errcode = 'check_violation';
  end if;
  insert into public.aid_award_history (tenant_id, award_id, kind, to_status, corrects_seq, reason, recorded_by, operation)
  values (school, w.id, 'correction', want_to, want_corrects, private.adm_aid_clean('a reason', want_reason, 3, 1000), me, want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'aid_correct', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Records a disbursement against an accepted award, optionally linked to the
-- student-accounts ledger's aid credit by its id. Reads that ledger; never
-- writes it.
create or replace function public.aid_disbursement_record(
  want_award uuid, want_amount_cents bigint, want_on date, want_ledger_entry uuid, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.adm_aid_school();
  w      public.aid_awards;
  req    jsonb;
  prior  jsonb;
  made   uuid;
begin
  select * into w from public.aid_awards x where x.id = want_award and x.tenant_id = school;
  if not found then raise exception 'semester: no such award here' using errcode = 'check_violation'; end if;
  perform private.adm_aid_require(school, 'aid:record');
  perform private.adm_aid_require_core(school, 'financial_aid');
  req := jsonb_build_object('award', want_award, 'amount', want_amount_cents, 'on', want_on, 'entry', want_ledger_entry);
  prior := private.adm_aid_replay(school, want_key, 'disburse', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_amount_cents is null or want_amount_cents < 1 then
    raise exception 'semester: a disbursement is a whole number of cents, at least 1' using errcode = 'check_violation';
  end if;
  if want_on is null or want_on > current_date + 1 or want_on < date '1900-01-01' then
    raise exception 'semester: a disbursement is dated today or earlier' using errcode = 'check_violation';
  end if;
  if want_ledger_entry is not null and exists (select 1 from public.aid_disbursements d where d.ledger_entry_id = want_ledger_entry) then
    raise exception 'semester: that ledger entry is already linked to a disbursement' using errcode = 'unique_violation';
  end if;
  insert into public.aid_disbursements (tenant_id, award_id, student_ref, amount_cents, disbursed_on, ledger_entry_id, recorded_by, operation)
  values (school, w.id, w.student_ref, want_amount_cents, want_on, want_ledger_entry, me, want_key)
  returning id into made;
  perform private.adm_aid_spend(school, want_key, 'disburse', req, jsonb_build_object('id', made));
  return made;
end $$;

revoke all on function public.admissions_applicant_add(text, text, text, text, text) from public, anon;
revoke all on function public.admissions_status_record(uuid, text, text, text) from public, anon;
revoke all on function public.admissions_status_correct(uuid, text, integer, text, text) from public, anon;
revoke all on function public.admissions_applicant_link(uuid, text, text) from public, anon;
revoke all on function public.aid_award_record(text, text, text, text, bigint, text, text) from public, anon;
revoke all on function public.aid_award_approve(uuid, text, text) from public, anon;
revoke all on function public.aid_status_record(uuid, text, text, text) from public, anon;
revoke all on function public.aid_status_correct(uuid, text, integer, text, text) from public, anon;
revoke all on function public.aid_disbursement_record(uuid, bigint, date, uuid, text) from public, anon;
grant execute on function public.admissions_applicant_add(text, text, text, text, text) to authenticated;
grant execute on function public.admissions_status_record(uuid, text, text, text) to authenticated;
grant execute on function public.admissions_status_correct(uuid, text, integer, text, text) to authenticated;
grant execute on function public.admissions_applicant_link(uuid, text, text) to authenticated;
grant execute on function public.aid_award_record(text, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.aid_award_approve(uuid, text, text) to authenticated;
grant execute on function public.aid_status_record(uuid, text, text, text) to authenticated;
grant execute on function public.aid_status_correct(uuid, text, integer, text, text) to authenticated;
grant execute on function public.aid_disbursement_record(uuid, bigint, date, uuid, text) to authenticated;
