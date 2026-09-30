-- Tamper evidence for the two ledgers that hold the most: the academic record
-- (D-145) and student accounts (D-146).
--
-- The console's audit log already has a hash chain, a signed daily manifest and
-- a nightly verifier (20260929100000_console_control_plane.sql). These two
-- ledgers are append-only for everybody including the owner, but nothing would
-- notice if someone with the power to disable a trigger rewrote an entry, or
-- removed one, and then re-enabled it. This makes that noticeable.
--
--   1. Every entry appended to either ledger is chained, per ledger and per
--      school, to the one before it: `hash = sha256(canonical(entry, seq,
--      prev_hash))`. The chain lives in `private.ledger_chain`, a side table,
--      so the immutable ledgers themselves are not altered and no existing row
--      has to be rewritten.
--   2. `private.verify_ledger_chain(ledger, school)` recomputes every link from
--      the ledger's own rows and says where the first break is and what kind:
--      a rewritten entry, a removed entry, a removed link, a reordered link, or
--      an entry appended with the trigger off.
--   3. What is hashed excludes the person columns (`proposed_by`, `approved_by`,
--      `requested_by`). Account deletion legitimately nulls them, and the ledger
--      says so (`academic_record_entries_append_only`); a chain that broke every
--      time a clerk left would be noise. Everything that says what happened,
--      when, for whom and how much is in the hash.
--   4. The hash is taken with the time zone pinned to UTC, so it does not depend
--      on who asks. The chain is per school and appends are serialized per chain
--      with an advisory lock, for the reason the console's is.
--
-- What this is not: a signature. There is no key here, so someone who can
-- rewrite the ledger *and* the side table together, and recompute every hash
-- after the change, is not caught by this alone. The console's HMAC-signed
-- manifest is the pattern that closes that; it is not applied to these ledgers
-- yet, and nothing runs the verifier on a schedule yet. Entries appended before
-- this migration are not chained (`ledger_chain_start`): they are counted, not
-- covered.

-- ── 1. The side table ─────────────────────────────────────────────────────

create table if not exists private.ledger_chain_start (
  ledger     text        primary key check (ledger in ('academic_record', 'student_account')),
  started_at timestamptz not null default now()
);

insert into private.ledger_chain_start (ledger) values ('academic_record'), ('student_account')
on conflict (ledger) do nothing;

create table if not exists private.ledger_chain (
  ledger     text        not null check (ledger in ('academic_record', 'student_account')),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  seq        bigint      not null check (seq >= 1),
  entry_id   uuid        not null,
  prev_hash  text        not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  hash       text        not null check (hash ~ '^[0-9a-f]{64}$'),
  chained_at timestamptz not null default now(),
  primary key (ledger, tenant_id, seq),
  unique (ledger, entry_id)
);

alter table private.ledger_chain enable row level security;
alter table private.ledger_chain_start enable row level security;
revoke all on table private.ledger_chain from public, anon, authenticated;
revoke all on table private.ledger_chain_start from public, anon, authenticated;

-- Like the ledgers: never edited, and removed only with the school.
create or replace function private.ledger_chain_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  raise exception 'The ledger chain is append-only.' using errcode = '42501';
end $$;

revoke all on function private.ledger_chain_immutable() from public, anon, authenticated;

drop trigger if exists ledger_chain_immutable on private.ledger_chain;
create trigger ledger_chain_immutable before update or delete on private.ledger_chain
  for each row execute function private.ledger_chain_immutable();

-- ── 2. What a hash is taken over ──────────────────────────────────────────
--
-- One function for the appender and the verifier, so they cannot disagree.
-- `set timezone` makes `to_jsonb(timestamptz)` render in UTC whatever the
-- session says; without it the same row hashes differently for two people.

create or replace function private.ledger_entry_hash(
  want_ledger text, want_seq bigint, want_prev text, want_entry jsonb
)
returns text
language sql
immutable
set search_path = ''
set timezone = 'UTC'
as $$
  select private.console_audit_sha256(
    jsonb_build_object(
      'ledger',    want_ledger,
      'seq',       want_seq,
      'prev_hash', want_prev,
      'entry',     want_entry - 'proposed_by' - 'approved_by' - 'requested_by'
    )::text
  );
$$;

revoke all on function private.ledger_entry_hash(text, bigint, text, jsonb) from public, anon, authenticated;

-- ── 3. The appender ───────────────────────────────────────────────────────

create or replace function private.ledger_chain_append()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  which text := tg_argv[0];
  last_seq bigint;
  last_hash text;
  entry jsonb := to_jsonb(new);
  next_seq bigint;
  prev text;
begin
  -- One writer at a time per chain: two transactions inserting at once would
  -- read the same tail and fork the chain.
  perform pg_advisory_xact_lock(hashtext('ledger_chain:' || which || ':' || new.tenant_id));
  select c.seq, c.hash into last_seq, last_hash
    from private.ledger_chain c
   where c.ledger = which and c.tenant_id = new.tenant_id
   order by c.seq desc
   limit 1;
  next_seq := coalesce(last_seq, 0) + 1;
  prev := coalesce(last_hash, repeat('0', 64));
  insert into private.ledger_chain (ledger, tenant_id, seq, entry_id, prev_hash, hash)
  values (which, new.tenant_id, next_seq, new.id, prev,
          private.ledger_entry_hash(which, next_seq, prev, entry));
  return null;
end $$;

revoke all on function private.ledger_chain_append() from public, anon, authenticated;

drop trigger if exists chain_academic_record_entries on public.academic_record_entries;
create trigger chain_academic_record_entries after insert on public.academic_record_entries
  for each row execute function private.ledger_chain_append('academic_record');

drop trigger if exists chain_student_account_entries on public.student_account_entries;
create trigger chain_student_account_entries after insert on public.student_account_entries
  for each row execute function private.ledger_chain_append('student_account');

-- ── 4. The verifier ───────────────────────────────────────────────────────
--
-- Returns one object: ok, how many links it checked, the first break (its seq
-- and its kind) if there is one, how many entries came before the chain
-- existed, and how many were appended after it started without being chained.
--
-- Kinds of break, in the order they are looked for on each link:
--   removed_link    the next link's seq is not the previous one plus one
--   reordered_link  its prev_hash is not the previous link's hash
--   removed_entry   the entry the link names is not in the ledger
--   rewritten_entry the ledger's row no longer hashes to the stored hash
--
-- It reads the ledger by name, in a `case`, and never builds SQL from the
-- argument.

create or replace function private.verify_ledger_chain(want_ledger text, want_tenant text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  link record;
  entry jsonb;
  expect_seq bigint := 1;
  expect_prev text := repeat('0', 64);
  checked integer := 0;
  bad_seq bigint;
  bad_kind text;
  before_chain integer;
  unchained integer;
  started timestamptz;
begin
  if want_ledger not in ('academic_record', 'student_account') then
    raise exception 'Unknown ledger %.', want_ledger using errcode = '22023';
  end if;
  select s.started_at into started from private.ledger_chain_start s where s.ledger = want_ledger;

  for link in
    select * from private.ledger_chain c
     where c.ledger = want_ledger and c.tenant_id = want_tenant
     order by c.seq
  loop
    checked := checked + 1;
    if link.seq <> expect_seq then
      bad_seq := expect_seq; bad_kind := 'removed_link'; exit;
    end if;
    if link.prev_hash <> expect_prev then
      bad_seq := link.seq; bad_kind := 'reordered_link'; exit;
    end if;
    entry := case want_ledger
      when 'academic_record' then (select to_jsonb(e) from public.academic_record_entries e where e.id = link.entry_id)
      else (select to_jsonb(e) from public.student_account_entries e where e.id = link.entry_id)
    end;
    if entry is null then
      bad_seq := link.seq; bad_kind := 'removed_entry'; exit;
    end if;
    if private.ledger_entry_hash(want_ledger, link.seq, link.prev_hash, entry) <> link.hash then
      bad_seq := link.seq; bad_kind := 'rewritten_entry'; exit;
    end if;
    expect_seq := link.seq + 1;
    expect_prev := link.hash;
  end loop;

  if want_ledger = 'academic_record' then
    select count(*) filter (where e.recorded_at < started),
           count(*) filter (where e.recorded_at >= started
                            and not exists (select 1 from private.ledger_chain c where c.ledger = want_ledger and c.entry_id = e.id))
      into before_chain, unchained
      from public.academic_record_entries e where e.tenant_id = want_tenant;
  else
    select count(*) filter (where e.recorded_at < started),
           count(*) filter (where e.recorded_at >= started
                            and not exists (select 1 from private.ledger_chain c where c.ledger = want_ledger and c.entry_id = e.id))
      into before_chain, unchained
      from public.student_account_entries e where e.tenant_id = want_tenant;
  end if;

  if bad_kind is null and unchained > 0 then
    bad_kind := 'unchained_entry';
  end if;

  return jsonb_build_object(
    'ok', bad_kind is null,
    'checked', checked,
    'first_break_seq', bad_seq,
    'first_break_kind', bad_kind,
    'before_chain', before_chain,
    'unchained', unchained
  );
end $$;

revoke all on function private.verify_ledger_chain(text, text) from public;
revoke all on function private.verify_ledger_chain(text, text) from anon, authenticated;
grant execute on function private.verify_ledger_chain(text, text) to service_role;

comment on table private.ledger_chain is
  'A hash chain over the academic-record and student-account ledgers, per ledger and school. Verified by private.verify_ledger_chain; see 20260930110000_ledger_chains.sql for what it does and does not prove.';

-- ── Rollback ──────────────────────────────────────────────────────────────
--
-- Additive; the ledgers are untouched. To undo: drop the two triggers
-- (chain_academic_record_entries, chain_student_account_entries), the four
-- functions above, and the two tables in `private`.
