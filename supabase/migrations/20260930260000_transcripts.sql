-- Semester — transcripts: issuing a transcript from the academic-record ledger, checking one, and logging every release.
--
-- D-151 says Semester runs beside a school's systems (Connect) and takes a
-- module over only when the school switches that module to Core. This is the
-- module `records` (the registry's "Records and transcripts"). The academic-
-- record ledger (D-145, `20260929210000_academic_record_ledger.sql`) is the
-- record a registrar keeps, and says plainly that issuing a transcript is not
-- done there. This file does the next step and only that step:
--
--   1. ISSUING. A registrar (`transcript:issue`) issues a transcript for one
--      student reference as of a date. The database reads the ledger as of
--      that date (the entry in effect for each key; a void entry means the key
--      is absent), builds one canonical text from it, and keeps one
--      append-only row in `transcripts`: a serial that rises by one for each
--      school, who issued it, the as-of date, the text and its SHA-256. A
--      transcript is never edited. A corrected record is a new issue that
--      names the one it replaces; the earlier one is then marked superseded by
--      a separate append-only row in `transcript_supersessions`, and is itself
--      untouched. Nothing is written to the academic ledger.
--   2. CHECKING. Anybody signed in who holds a transcript's serial and hash can
--      ask `transcript_verify`, which answers valid, superseded or unknown, the
--      issuing school and the issue date, and never the text or the student.
--   3. THE DISCLOSURE LOG. Every release of a transcript, to the student or to
--      a named outside recipient, is one append-only row in
--      `transcript_disclosures`: who released it, to whom (a name and a kind,
--      in the registrar's own words), why, which transcript, when. Nobody
--      updates or deletes one. Semester sends nothing: the row is the
--      registrar's record that a release happened, written by the registrar.
--
-- ## What a transcript here is, and is not
--
-- It is the ledger as of a date, in a fixed text, with a fingerprint. It is NOT
-- signed. A SHA-256 shows that the text has not changed since it was issued; it
-- does not show who issued it, and anybody can make a hash of anything. Signing
-- needs a decision about who holds a key and what happens when it is lost, and
-- the owner has not made it. So nothing here is called signed, and the text
-- itself says so (`notice` in the body).
--
-- ## Gated, like every Core module
--
-- Writing needs the school to have switched `records` to Core
-- (`effective_module_modes`), and is refused while the module is frozen or
-- `kill.core_modules` is engaged. Every doubt reads Connect. Reading is not
-- gated by mode: what was issued stays readable. No school has switched it.
--
-- ## The canonical text, which is the part that has to be exactly right
--
-- The hash is of a text, so the text has to be a function of the body alone. It
-- is defined here, once, and `app/src/lib/transcripts/canonical.ts` is its twin
-- in TypeScript, held equal by one fixtures file that both
-- `transcripts.test.ts` and `transcripts.check.sql` must reproduce:
--
--   * A body holds only objects, arrays and strings. No numbers, booleans or
--     nulls, so there is no number formatting to disagree about. A missing value
--     is the empty string, which the ledger never holds for a `set` entry.
--   * An object's keys are sorted by their UTF-8 bytes (collation "C"), each as
--     a JSON string, then `:`, then the value, joined by `,` inside `{}`.
--     An array keeps its order. No whitespace anywhere.
--   * A string is JSON-escaped exactly as `jsonb` writes a string: `"` and `\`
--     escaped; backspace, form feed, newline, return and tab as `\b \f \n \r \t`;
--     every other character below U+0020 as `\u00xx` in lower case; everything
--     else, including DEL, U+2028 and characters outside the basic plane, as
--     itself. JavaScript's `JSON.stringify` writes the same.
--   * No normalisation of any kind: a string is the bytes the ledger holds.
--   * The hash is SHA-256 of the UTF-8 bytes of that text, in lower-case hex.
--
-- The body names the school and the student reference, the serial, the as-of
-- date and the kinds it read. Courses are grouped under the term the ledger's
-- own key names (`<course> · <term>`, split at the first " · " and never
-- parsed further) and the terms are in byte order, not calendar order: the
-- ledger holds no calendar. Grades, credit and enrolment are the ledger's text
-- as it is. `requirement` entries are not read. A body that included the issue
-- time would make two issues of one record differ for a reason that is not the
-- record, so the time is a column and not part of the text.
--
-- ## What this is not
--
-- Not signed, not delivered, not a PDF, not an e-transcript network, not
-- HEDS or PESC, not a fee. Not a hold on release: whether a financial hold
-- blocks a transcript is a policy the school must decide, and none is invented
-- here. A superseded transcript can still be released and logged; the log says
-- which it was by pointing at the serial. How long a school keeps a transcript
-- or its disclosure log is not decided.
--
-- Account deletion: a person who issued, superseded or released is set null, as
-- `erasure.test.ts` requires of every column naming an account, and the row
-- stays, because a transcript and its log belong to the school.
--
-- Additive and safe to run again. NOT APPLIED to production; applying it needs
-- owner approval.

-- ── The capabilities ─────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('transcript:issue', 'Issue a transcript for one student of one school as of a date, mark an earlier one superseded, and log each release of one.'),
  ('transcript:read',  'Read every transcript one school issued and the log of every release of one.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar', 'transcript:issue'),
  ('registrar', 'transcript:read'),
  ('dean',      'transcript:read')
on conflict do nothing;

-- ── Tables ─────────────────────────────────────────────────

-- The keys every mutation spends. `request` is what was asked, `result` what
-- was answered; a replay compares the first and returns the second.
create table if not exists public.transcript_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('issue', 'disclose')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

-- One issued transcript. Nothing here is ever changed.
create table if not exists public.transcripts (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  -- Rises by one for each school, with no gaps: it is taken under a lock inside
  -- the transaction that writes the row, so a refused issue spends none.
  serial      bigint      not null check (serial >= 1),
  student_ref text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  as_of       date        not null,
  issued_by   uuid        references auth.users on delete set null,
  issued_at   timestamptz not null default clock_timestamp(),
  -- The body, and the canonical text of it that the hash is of. The two are held
  -- equal by the checks below, so neither can be changed without the other.
  body        jsonb       not null,
  body_text   text        not null,
  body_sha256 text        not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  operation   text        not null,
  unique (tenant_id, serial),
  unique (tenant_id, serial, student_ref),
  unique (body_sha256),
  constraint transcripts_hash_is_of_text check (body_sha256 = encode(sha256(convert_to(body_text, 'UTF8')), 'hex')),
  constraint transcripts_text_is_body check (body_text::jsonb = body)
);

-- The earlier transcript a later issue replaced. A separate row so the earlier
-- one is never touched. Each transcript is superseded at most once and
-- supersedes at most one.
create table if not exists public.transcript_supersessions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  transcript_id uuid        not null unique references public.transcripts(id),
  by_transcript uuid        not null unique references public.transcripts(id),
  reason        text        not null check (length(btrim(reason)) between 1 and 500),
  recorded_by   uuid        references auth.users on delete set null,
  recorded_at   timestamptz not null default clock_timestamp(),
  operation     text        not null,
  constraint transcript_supersessions_two check (transcript_id <> by_transcript)
);

-- One release of one transcript. The recipient is the registrar's own words:
-- Semester names no categories, because a school's are not Semester's to choose.
create table if not exists public.transcript_disclosures (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null references public.schools(id) on delete cascade,
  transcript_serial bigint      not null,
  student_ref       text        not null,
  released_by       uuid        references auth.users on delete set null,
  released_at       timestamptz not null default clock_timestamp(),
  recipient_name    text        not null check (length(btrim(recipient_name)) between 1 and 200),
  recipient_kind    text        not null check (length(btrim(recipient_kind)) between 1 and 80),
  purpose           text        not null check (length(btrim(purpose)) between 1 and 500),
  operation         text        not null,
  -- The student reference is the transcript's own, so a disclosure is read by
  -- the same student the transcript is.
  foreign key (tenant_id, transcript_serial, student_ref) references public.transcripts (tenant_id, serial, student_ref)
);

-- Every foreign key covered (`indexes.check.sql`), each index by its lead column.
create index if not exists transcript_operations_by_actor on public.transcript_operations (actor);
create index if not exists transcripts_by_student on public.transcripts (tenant_id, student_ref, serial);
create index if not exists transcripts_by_issuer on public.transcripts (issued_by);
create index if not exists transcript_supersessions_by_tenant on public.transcript_supersessions (tenant_id);
create index if not exists transcript_supersessions_by_recorder on public.transcript_supersessions (recorded_by);
create index if not exists transcript_disclosures_by_transcript on public.transcript_disclosures (tenant_id, transcript_serial, student_ref);
create index if not exists transcript_disclosures_by_student on public.transcript_disclosures (tenant_id, student_ref, released_at);
create index if not exists transcript_disclosures_by_releaser on public.transcript_disclosures (released_by);

comment on table public.transcript_operations is 'Idempotency keys the transcript mutations spent, with what each asked and answered. Append-only.';
comment on table public.transcripts is 'One transcript issued from the academic-record ledger as of a date: the canonical text, its SHA-256, a serial per school, who issued it. Append-only. Not signed. Nothing here is written to the academic ledger.';
comment on table public.transcript_supersessions is 'A later transcript replacing an earlier one, with the reason. Append-only; the earlier transcript is not edited.';
comment on table public.transcript_disclosures is 'Every release of a transcript, to the student or to a named outside recipient, with the purpose and who released it. Append-only: no role updates or deletes a row. Semester sends nothing; the row is the registrar''s record of a release.';

-- ── The pure functions ───────────────────────────────────────

-- The canonical text of a body: sorted keys, no whitespace, strings escaped as
-- jsonb writes them. Only objects, arrays and strings are allowed, so a caller
-- that put a number in a body is told rather than left to disagree about how a
-- number is written. The twin is `canonicalize` in
-- app/src/lib/transcripts/canonical.ts.
create or replace function private.transcript_canonical(given jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := jsonb_typeof(given);
begin
  if t = 'object' then
    return '{' || coalesce((select string_agg(to_jsonb(e.key)::text || ':' || private.transcript_canonical(e.value), ',' order by e.key collate "C")
                              from jsonb_each(given) e), '') || '}';
  elsif t = 'array' then
    return '[' || coalesce((select string_agg(private.transcript_canonical(e.value), ',' order by e.ord)
                              from jsonb_array_elements(given) with ordinality e(value, ord)), '') || ']';
  elsif t = 'string' then
    return given::text;
  end if;
  raise exception 'semester: a transcript body holds only text, lists and objects' using errcode = 'check_violation';
end $$;

revoke all on function private.transcript_canonical(jsonb) from public, anon, authenticated;

create or replace function private.transcript_sha256(given text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(given, 'UTF8')), 'hex');
$$;

revoke all on function private.transcript_sha256(text) from public, anon, authenticated;

-- The body, from two documents and nothing else.
--
--   want_head:  { serial, school_id, school_name, student_ref, as_of }, all text
--   want_lines: [{ kind, key, value, effective_on }], the entry in effect for
--               each (kind, key) on the as-of date, voids already dropped, at
--               most one line per (kind, key), all text.
--
-- It reads no table, so `transcript_issue` calls it on the ledger and a test
-- calls it on a fixture. The twin is `buildBody` in
-- app/src/lib/transcripts/body.ts.
create or replace function private.transcript_build(want_head jsonb, want_lines jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  terms jsonb;
  moved jsonb;
  stands jsonb;
  conf jsonb;
  sep constant text := ' · ';
begin
  if exists (select 1 from jsonb_array_elements(want_lines) l group by l->>'kind', l->>'key' having count(*) > 1) then
    raise exception 'semester: a transcript reads one ledger line for each kind and key' using errcode = 'check_violation';
  end if;

  with ln as (
    select l->>'kind' as kind, l->>'key' as key, l->>'value' as value, l->>'effective_on' as eff
      from jsonb_array_elements(want_lines) l
  ),
  inst as (
    select k.key,
           case when strpos(k.key, sep) > 0 then left(k.key, strpos(k.key, sep) - 1) else k.key end as course,
           case when strpos(k.key, sep) > 0 then substr(k.key, strpos(k.key, sep) + length(sep)) else '' end as term,
           coalesce((select e.value from ln e where e.kind = 'enrollment' and e.key = k.key), '') as enrollment,
           coalesce((select g.value from ln g where g.kind = 'grade' and g.key = k.key), '') as grade,
           coalesce((select c.value from ln c where c.kind = 'credit' and c.key = k.key), '') as credit
      from (select distinct key from ln where kind in ('enrollment', 'grade', 'credit')) k
  )
  select coalesce(jsonb_agg(jsonb_build_object('term', t.term, 'courses', t.courses) order by t.term collate "C"), '[]'::jsonb)
    into terms
    from (select i.term,
                 jsonb_agg(jsonb_build_object('course', i.course, 'key', i.key, 'enrollment', i.enrollment, 'grade', i.grade, 'credit', i.credit)
                           order by i.key collate "C") as courses
            from inst i group by i.term) t;

  select coalesce(jsonb_agg(jsonb_build_object('key', l->>'key', 'value', l->>'value', 'effective_on', l->>'effective_on') order by (l->>'key') collate "C"), '[]'::jsonb)
    into moved from jsonb_array_elements(want_lines) l where l->>'kind' = 'transfer_credit';
  select coalesce(jsonb_agg(jsonb_build_object('key', l->>'key', 'value', l->>'value', 'effective_on', l->>'effective_on') order by (l->>'key') collate "C"), '[]'::jsonb)
    into stands from jsonb_array_elements(want_lines) l where l->>'kind' = 'standing';
  select coalesce(jsonb_agg(jsonb_build_object('key', l->>'key', 'value', l->>'value', 'effective_on', l->>'effective_on') order by (l->>'key') collate "C"), '[]'::jsonb)
    into conf from jsonb_array_elements(want_lines) l where l->>'kind' = 'conferral';

  return jsonb_build_object(
    'format', 'semester-transcript-body-1',
    'notice', 'This text is not signed. Its SHA-256 shows that it has not changed since it was issued; it does not show who issued it.',
    'serial', want_head->>'serial',
    'school', jsonb_build_object('id', want_head->>'school_id', 'name', want_head->>'school_name'),
    'student_ref', want_head->>'student_ref',
    'as_of', want_head->>'as_of',
    'includes', jsonb_build_array('enrollment', 'grade', 'credit', 'transfer_credit', 'standing', 'conferral'),
    'terms', terms,
    'transfer_credit', moved,
    'standing', stands,
    'conferrals', conf);
end $$;

revoke all on function private.transcript_build(jsonb, jsonb) from public, anon, authenticated;

-- ── What may change, for the owner too ───────────────────────

-- Account deletion clears a person reference; that is not a change to the row.
-- Anything else is refused, and so is every delete except the one a school's
-- own removal makes. One function for the three tables, told which columns name
-- a person by the trigger's argument.
create or replace function private.transcript_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  person text := tg_argv[0];
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - person) = (to_jsonb(old) - person)
     and (to_jsonb(new) ->> person is null or to_jsonb(new) ->> person = to_jsonb(old) ->> person) then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  raise exception 'semester: % is kept as it was written; a correction is a new row', tg_table_name using errcode = '42501';
end $$;

revoke all on function private.transcript_append_only() from public, anon, authenticated;

drop trigger if exists transcripts_append_only on public.transcripts;
create trigger transcripts_append_only before update or delete on public.transcripts
  for each row execute function private.transcript_append_only('issued_by');
drop trigger if exists transcript_supersessions_append_only on public.transcript_supersessions;
create trigger transcript_supersessions_append_only before update or delete on public.transcript_supersessions
  for each row execute function private.transcript_append_only('recorded_by');
drop trigger if exists transcript_disclosures_append_only on public.transcript_disclosures;
create trigger transcript_disclosures_append_only before update or delete on public.transcript_disclosures
  for each row execute function private.transcript_append_only('released_by');

-- ── Who reads ──────────────────────────────────────────────

alter table public.transcript_operations enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_supersessions enable row level security;
alter table public.transcript_disclosures enable row level security;

revoke all on table public.transcript_operations from anon, authenticated;
revoke all on table public.transcripts from anon, authenticated;
revoke all on table public.transcript_supersessions from anon, authenticated;
revoke all on table public.transcript_disclosures from anon, authenticated;
grant select on table public.transcript_operations to authenticated;
grant select on table public.transcripts to authenticated;
grant select on table public.transcript_supersessions to authenticated;
grant select on table public.transcript_disclosures to authenticated;

drop policy if exists "callers read their own operations" on public.transcript_operations;
create policy "callers read their own operations" on public.transcript_operations
  for select to authenticated
  using (actor = (select auth.uid()));

-- Whoever holds transcript:read at the school reads every transcript there; a
-- student reads the transcripts of the record the school linked to their
-- account, through academic_record_subjects, and no other.
drop policy if exists "readers read all, a student their own record's" on public.transcripts;
create policy "readers read all, a student their own record's" on public.transcripts
  for select to authenticated
  using (private.has_capability('transcript:read', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = transcripts.tenant_id
                       and s.student_ref = transcripts.student_ref
                       and s.user_id = (select auth.uid())));

-- A supersession is readable exactly when the transcript it replaced is.
drop policy if exists "a supersession reads as its transcript does" on public.transcript_supersessions;
create policy "a supersession reads as its transcript does" on public.transcript_supersessions
  for select to authenticated
  using (exists (select 1 from public.transcripts t where t.id = transcript_id));

drop policy if exists "readers read all, a student their own record's log" on public.transcript_disclosures;
create policy "readers read all, a student their own record's log" on public.transcript_disclosures
  for select to authenticated
  using (private.has_capability('transcript:read', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = transcript_disclosures.tenant_id
                       and s.student_ref = transcript_disclosures.student_ref
                       and s.user_id = (select auth.uid())));

-- ── The rules every mutation starts with ──────────────────────

create or replace function private.transcript_school()
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

create or replace function private.transcript_require(school text, want_cap text)
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

-- Raises unless this school has switched `records` to Semester Core, and the
-- module is neither frozen nor paused by the kill switch. A school in Connect
-- never reaches a write here: its transcripts are in its own system.
create or replace function private.transcript_require_core(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select e.mode, e.frozen, e.killed into m
    from public.effective_module_modes(school) e
   where e.module = 'records';
  -- While the kill switch is engaged every module reads Connect, so a school
  -- that really is in Core has to be recognised from its own row to be told
  -- the truth: paused, not "never switched".
  if found and m.killed and exists (select 1 from public.tenant_module_mode t
                                     where t.tenant_id = school and t.module = 'records' and t.mode = 'core') then
    raise exception 'semester: Core modules are paused for your school' using errcode = 'insufficient_privilege';
  end if;
  if not found or m.mode <> 'core' then
    raise exception 'semester: your school has not switched records and transcripts to Semester Core' using errcode = 'insufficient_privilege';
  end if;
  if m.frozen then
    raise exception 'semester: records and transcripts are frozen; what was issued is kept and read-only' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- The key check every mutation starts with. Null means go ahead; otherwise it
-- is the first answer to replay. Holds a lock on the key until commit, so two
-- calls with one key cannot both do the work.
create or replace function private.transcript_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.transcript_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('transcript-op:' || school || ':' || want_key));
  select * into op from public.transcript_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;

create or replace function private.transcript_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.transcript_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;

-- ── Issuing ────────────────────────────────────────────────

-- Issues a transcript for one student reference as of a date and keeps it.
-- Returns the transcript's id; a replay of the same key returns the same id and
-- writes nothing. Reads the ledger and writes nothing to it.
--
-- `want_supersedes` is the serial of an earlier transcript of the same student
-- at this school that this one replaces, with `want_reason`; both or neither.
-- A transcript is never superseded implicitly: two issues as of different dates
-- are two transcripts, and only the registrar says that one corrects another.
--
-- The as-of date may not be later than tomorrow by the server's clock (a day's
-- slack for a caller east of UTC): a transcript "as of" a date that has not
-- happened would count entries not yet in effect.
create or replace function public.transcript_issue(
  want_student_ref text, want_as_of date, want_supersedes bigint, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.transcript_school();
  req     jsonb := jsonb_build_object('student', want_student_ref, 'as_of', want_as_of, 'supersedes', want_supersedes,
                                      'reason', nullif(btrim(coalesce(want_reason, '')), ''));
  prior   jsonb;
  school_name text;
  earlier public.transcripts;
  lines   jsonb;
  head    jsonb;
  body    jsonb;
  text_   text;
  next_serial bigint;
  made    uuid;
begin
  perform private.transcript_require(school, 'transcript:issue');
  perform private.transcript_require_core(school);
  prior := private.transcript_replay(school, want_key, 'issue', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_student_ref is null or want_student_ref !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: that is not a student reference' using errcode = 'check_violation';
  end if;
  if want_as_of is null or want_as_of > current_date + 1 then
    raise exception 'semester: a transcript is as of today or an earlier date, never a later one' using errcode = 'check_violation';
  end if;
  if want_as_of < date '1900-01-01' then
    raise exception 'semester: that is not a date a transcript can be as of' using errcode = 'check_violation';
  end if;
  if (want_supersedes is null) <> (nullif(btrim(coalesce(want_reason, '')), '') is null) then
    raise exception 'semester: replacing a transcript takes its serial and a reason, and a reason goes with a replacement' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_reason, ''))) > 500 then
    raise exception 'semester: a reason is up to 500 characters' using errcode = 'check_violation';
  end if;

  if want_supersedes is not null then
    select * into earlier from public.transcripts t where t.tenant_id = school and t.serial = want_supersedes;
    if not found then
      raise exception 'semester: no transcript with that serial at your school' using errcode = 'check_violation';
    end if;
    if earlier.student_ref <> want_student_ref then
      raise exception 'semester: a transcript is replaced only by one for the same student reference' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.transcript_supersessions x where x.transcript_id = earlier.id) then
      raise exception 'semester: that transcript has already been replaced' using errcode = 'check_violation';
    end if;
  end if;

  -- The record as it stood on the date: for each key the entry in effect, in
  -- the ledger's own order (effective date, then when it was recorded, then
  -- id), and a void entry means the key is absent.
  select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'key', l.subject_key, 'value', l.value,
                                               'effective_on', to_char(l.effective_on, 'YYYY-MM-DD'))
                            order by l.kind collate "C", l.subject_key collate "C"), '[]'::jsonb)
    into lines
    from (select distinct on (e.kind, e.subject_key) e.*
            from public.academic_record_entries e
           where e.tenant_id = school and e.student_ref = want_student_ref
             and e.kind in ('enrollment', 'grade', 'credit', 'transfer_credit', 'standing', 'conferral')
             and e.effective_on <= want_as_of
           order by e.kind, e.subject_key, e.effective_on desc, e.recorded_at desc, e.id desc) l
   where l.action = 'set';
  if jsonb_array_length(lines) = 0 then
    raise exception 'semester: there is nothing on that student''s record as of that date to issue' using errcode = 'check_violation';
  end if;

  -- One serial at a time per school; the lock is held to the end of this
  -- transaction, so a refusal below spends nothing and leaves no gap.
  perform pg_advisory_xact_lock(hashtext('transcript-serial:' || school));
  select coalesce(max(t.serial), 0) + 1 into next_serial from public.transcripts t where t.tenant_id = school;
  select s.name into school_name from public.schools s where s.id = school;

  head := jsonb_build_object('serial', next_serial::text, 'school_id', school, 'school_name', school_name,
                             'student_ref', want_student_ref, 'as_of', to_char(want_as_of, 'YYYY-MM-DD'));
  body := private.transcript_build(head, lines);
  text_ := private.transcript_canonical(body);

  insert into public.transcripts (tenant_id, serial, student_ref, as_of, issued_by, body, body_text, body_sha256, operation)
  values (school, next_serial, want_student_ref, want_as_of, me, body, text_, private.transcript_sha256(text_), want_key)
  returning id into made;

  if earlier.id is not null then
    insert into public.transcript_supersessions (tenant_id, transcript_id, by_transcript, reason, recorded_by, operation)
    values (school, earlier.id, made, btrim(want_reason), me, want_key);
  end if;
  perform private.transcript_spend(school, want_key, 'issue', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Records that a transcript was released, to the student or to somebody else.
-- Semester sends nothing: this is the registrar's record that a release
-- happened, written at the time it is recorded. Returns the log row's id.
create or replace function public.transcript_disclose(
  want_serial bigint, want_recipient_name text, want_recipient_kind text, want_purpose text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.transcript_school();
  req     jsonb := jsonb_build_object('serial', want_serial, 'name', btrim(coalesce(want_recipient_name, '')),
                                      'kind', btrim(coalesce(want_recipient_kind, '')), 'purpose', btrim(coalesce(want_purpose, '')));
  prior   jsonb;
  t       public.transcripts;
  made    uuid;
begin
  perform private.transcript_require(school, 'transcript:issue');
  perform private.transcript_require_core(school);
  prior := private.transcript_replay(school, want_key, 'disclose', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if length(btrim(coalesce(want_recipient_name, ''))) not between 1 and 200 then
    raise exception 'semester: say who it was released to, in up to 200 characters' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_recipient_kind, ''))) not between 1 and 80 then
    raise exception 'semester: say what kind of recipient that is, in up to 80 characters' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_purpose, ''))) not between 1 and 500 then
    raise exception 'semester: say why it was released, in up to 500 characters' using errcode = 'check_violation';
  end if;
  select * into t from public.transcripts x where x.tenant_id = school and x.serial = want_serial;
  if not found then
    raise exception 'semester: no transcript with that serial at your school' using errcode = 'check_violation';
  end if;

  insert into public.transcript_disclosures
    (tenant_id, transcript_serial, student_ref, released_by, recipient_name, recipient_kind, purpose, operation)
  values (school, t.serial, t.student_ref, me, btrim(want_recipient_name), btrim(want_recipient_kind), btrim(want_purpose), want_key)
  returning id into made;
  perform private.transcript_spend(school, want_key, 'disclose', req, jsonb_build_object('id', made));
  return made;
end $$;

-- ── Checking ───────────────────────────────────────────────

-- Anybody signed in who holds a transcript's serial and hash can ask whether
-- the two belong together. The answer is one of three words, the school that
-- issued it and the day it was issued, and nothing else: never the text, never
-- the student reference, never who issued it.
--
-- Signed in, and not anonymous, on purpose. The repository's rate limit
-- (`private.take_direct_rate_limit`) counts a hit against an account or a form
-- and has nothing for a signed-out caller, who has no key to count against. So
-- a public check would be one nothing limits, and this is not one: it needs an
-- account, and each call counts against that account, 120 an hour. A serial is
-- small and guessable; the 256-bit hash is what has to be held, and the limit
-- stops anybody trying to walk it.
--
-- The answer to "wrong serial", "wrong hash" and "not a hash" is the same:
-- unknown. A superseded transcript is still a transcript the school issued, so
-- it is answered as superseded, not as unknown.
create or replace function public.transcript_verify(want_serial bigint, want_hash text)
returns table (status text, school_id text, school_name text, issued_on date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  h    text := lower(btrim(coalesce(want_hash, '')));
  t    public.transcripts;
begin
  if me is null then
    raise exception 'semester: sign in to check a transcript' using errcode = 'insufficient_privilege';
  end if;
  perform private.take_direct_rate_limit(me, null, 'transcript_verify', 120, 3600);

  if want_serial is not null and h ~ '^[0-9a-f]{64}$' then
    select * into t from public.transcripts x where x.serial = want_serial and x.body_sha256 = h;
  end if;
  if t.id is null then
    return query select 'unknown'::text, null::text, null::text, null::date;
    return;
  end if;
  return query
    select case when exists (select 1 from public.transcript_supersessions s where s.transcript_id = t.id) then 'superseded' else 'valid' end,
           t.tenant_id,
           (select sc.name from public.schools sc where sc.id = t.tenant_id),
           (t.issued_at at time zone 'UTC')::date;
end $$;

revoke all on function public.transcript_issue(text, date, bigint, text, text) from public, anon;
revoke all on function public.transcript_disclose(bigint, text, text, text, text) from public, anon;
revoke all on function public.transcript_verify(bigint, text) from public, anon;
grant execute on function public.transcript_issue(text, date, bigint, text, text) to authenticated;
grant execute on function public.transcript_disclose(bigint, text, text, text, text) to authenticated;
grant execute on function public.transcript_verify(bigint, text) to authenticated;

revoke all on function private.transcript_school() from public, anon, authenticated;
revoke all on function private.transcript_require(text, text) from public, anon, authenticated;
revoke all on function private.transcript_require_core(text) from public, anon, authenticated;
revoke all on function private.transcript_replay(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.transcript_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;
