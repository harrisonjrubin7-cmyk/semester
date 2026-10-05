-- Signing the ledger chains, and running the check every night.
--
-- 20260930110000_ledger_chains.sql made a rewrite of the academic-record or
-- student-account ledger noticeable, and said plainly what it could not do:
-- it is a hash, not a signature, so someone who rewrites a ledger entry *and*
-- recomputes every later link in the chain is not caught by the chain alone,
-- and nothing ran the verifier on a schedule. This closes both, with the
-- console audit log's own pattern (20260929100000_console_control_plane.sql).
--
--   1. **A signing key** no API role can read (`private.ledger_chain_key`, 32
--      random bytes, generated once and kept on re-apply: a rotated key would
--      make every earlier manifest unverifiable, which is a decision taken on
--      purpose with a record, not one a redeploy takes).
--   2. **A daily manifest** per ledger and school: the day's first and last
--      link, how many, and the head hash, HMAC-signed under that key
--      (`private.ledger_chain_manifest`, insert-only). A day is sealed once;
--      sealing it again over different rows raises, which is the finding.
--   3. **`private.verify_ledger_seals`** re-checks every manifest of one chain:
--      the signature under the key, and that the day's links up to the sealed
--      one still have that count and that head. This is what an attacker who
--      recomputes the whole chain cannot satisfy without the key.
--   4. **A nightly job** (`ledger-chain-integrity`) seals yesterday, then walks
--      every chain with both the link check and the seal check, and records the
--      result (`private.ledger_chain_verification`, insert-only), so "when was
--      this last verified, and was it fine" is a row and not a memory.
--
-- What it still does not do, stated so it is not read as more: someone who can
-- read the key — the database owner or a superuser — can re-sign a manifest
-- over rewritten rows, and `ledger-seals.check.sql` says so by asserting it. An
-- external anchor (the head hash written somewhere the database owner does not
-- control) is what closes that, and is not built. A seal also does not exist
-- for a day the job did not run; `private.ledger_chain_seal(day)` backfills.

-- ── 1. The key ────────────────────────────────────────────────────────────

create table if not exists private.ledger_chain_key (
  id  boolean primary key default true check (id),
  key bytea   not null check (length(key) = 32)
);

alter table private.ledger_chain_key enable row level security;
revoke all on table private.ledger_chain_key from public, anon, authenticated, service_role;

insert into private.ledger_chain_key (id, key)
select true, gen_random_bytes(32)
 where not exists (select 1 from private.ledger_chain_key);

-- ── 2. The manifests ──────────────────────────────────────────────────────

create table if not exists private.ledger_chain_manifest (
  ledger     text        not null check (ledger in ('academic_record', 'student_account')),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  batch_day  date        not null,
  first_seq  bigint      not null,
  last_seq   bigint      not null,
  row_count  bigint      not null check (row_count > 0),
  head_hash  text        not null check (head_hash ~ '^[0-9a-f]{64}$'),
  signature  text        not null check (signature ~ '^[0-9a-f]{64}$'),
  sealed_at  timestamptz not null default now(),
  primary key (ledger, tenant_id, batch_day),
  check (last_seq >= first_seq)
);

alter table private.ledger_chain_manifest enable row level security;
revoke all on table private.ledger_chain_manifest from public, anon, authenticated, service_role;

-- Never edited, and removed only with the school: the chain's own rule.
drop trigger if exists ledger_chain_manifest_immutable on private.ledger_chain_manifest;
create trigger ledger_chain_manifest_immutable before update or delete on private.ledger_chain_manifest
  for each row execute function private.ledger_chain_immutable();

-- What is signed: one function for the sealer and the verifier.
create or replace function private.ledger_chain_manifest_text(
  want_ledger text, want_tenant text, want_day date, want_first bigint, want_last bigint,
  want_count bigint, want_head text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws('|', want_ledger, want_tenant, want_day::text, want_first::text,
                   want_last::text, want_count::text, want_head);
$$;

revoke all on function private.ledger_chain_manifest_text(text, text, date, bigint, bigint, bigint, text)
  from public, anon, authenticated;

-- ── 3. Sealing a day ──────────────────────────────────────────────────────
--
-- Days are UTC days, because `chained_at` is read in UTC and a manifest has to
-- name the same links whoever reads it. Sealing a sealed day over the same
-- rows is a no-op, so the job can be re-run.

create or replace function private.ledger_chain_seal(want_day date default (current_date - 1))
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  day_start timestamptz := (want_day::timestamp at time zone 'UTC');
  day_end   timestamptz := ((want_day + 1)::timestamp at time zone 'UTC');
  chain record;
  v_first bigint;
  v_last  bigint;
  v_count bigint;
  v_head  text;
  v_key   bytea;
  existing private.ledger_chain_manifest;
  sealed integer := 0;
begin
  select k.key into v_key from private.ledger_chain_key k where k.id;
  if v_key is null then
    raise exception 'The ledger chain signing key is missing.';
  end if;

  for chain in
    select distinct c.ledger, c.tenant_id
      from private.ledger_chain c
     where c.chained_at >= day_start and c.chained_at < day_end
  loop
    select min(c.seq), max(c.seq), count(*)
      into v_first, v_last, v_count
      from private.ledger_chain c
     where c.ledger = chain.ledger and c.tenant_id = chain.tenant_id
       and c.chained_at >= day_start and c.chained_at < day_end;
    select c.hash into v_head
      from private.ledger_chain c
     where c.ledger = chain.ledger and c.tenant_id = chain.tenant_id and c.seq = v_last;

    select * into existing from private.ledger_chain_manifest m
     where m.ledger = chain.ledger and m.tenant_id = chain.tenant_id and m.batch_day = want_day;
    if found then
      if existing.head_hash <> v_head or existing.row_count <> v_count then
        raise exception '% chain for % on % is sealed with head % and % links; it now reads head % and % links. The sealed rows changed.',
          chain.ledger, chain.tenant_id, want_day, existing.head_hash, existing.row_count, v_head, v_count;
      end if;
      continue;
    end if;

    insert into private.ledger_chain_manifest
      (ledger, tenant_id, batch_day, first_seq, last_seq, row_count, head_hash, signature)
    values
      (chain.ledger, chain.tenant_id, want_day, v_first, v_last, v_count, v_head,
       private.console_audit_hmac(
         private.ledger_chain_manifest_text(chain.ledger, chain.tenant_id, want_day, v_first, v_last, v_count, v_head),
         v_key));
    sealed := sealed + 1;
  end loop;
  return sealed;
end $$;

revoke all on function private.ledger_chain_seal(date) from public, anon, authenticated;
grant execute on function private.ledger_chain_seal(date) to service_role;

-- ── 4. Checking the seals of one chain ────────────────────────────────────
--
-- The link check (`verify_ledger_chain`) says whether the chain is consistent
-- with itself; this says whether it is consistent with what was signed. An
-- attacker who recomputes the whole chain passes the first and fails this.

create or replace function private.verify_ledger_seals(want_ledger text, want_tenant text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  m record;
  v_key bytea;
  v_count bigint;
  v_head text;
  sealed integer := 0;
begin
  if want_ledger not in ('academic_record', 'student_account') then
    raise exception 'Unknown ledger %.', want_ledger using errcode = '22023';
  end if;
  select k.key into v_key from private.ledger_chain_key k where k.id;
  if v_key is null then
    raise exception 'The ledger chain signing key is missing.';
  end if;

  for m in
    select * from private.ledger_chain_manifest x
     where x.ledger = want_ledger and x.tenant_id = want_tenant
     order by x.batch_day
  loop
    sealed := sealed + 1;
    if m.signature <> private.console_audit_hmac(
         private.ledger_chain_manifest_text(m.ledger, m.tenant_id, m.batch_day, m.first_seq, m.last_seq, m.row_count, m.head_hash),
         v_key) then
      return jsonb_build_object('ok', false, 'sealed_days', sealed, 'break_day', m.batch_day, 'break_kind', 'bad_signature');
    end if;
    -- What a manifest asserts is the day's links up to its last seq: a link the
    -- chain took later the same day sits past it and contradicts nothing.
    select count(*) into v_count
      from private.ledger_chain c
     where c.ledger = m.ledger and c.tenant_id = m.tenant_id
       and c.chained_at >= (m.batch_day::timestamp at time zone 'UTC')
       and c.chained_at <  ((m.batch_day + 1)::timestamp at time zone 'UTC')
       and c.seq <= m.last_seq;
    select c.hash into v_head
      from private.ledger_chain c
     where c.ledger = m.ledger and c.tenant_id = m.tenant_id and c.seq = m.last_seq;
    if v_count <> m.row_count or v_head is distinct from m.head_hash then
      return jsonb_build_object('ok', false, 'sealed_days', sealed, 'break_day', m.batch_day, 'break_kind', 'sealed_rows_changed');
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'sealed_days', sealed, 'break_day', null, 'break_kind', null);
end $$;

revoke all on function private.verify_ledger_seals(text, text) from public;
revoke all on function private.verify_ledger_seals(text, text) from anon, authenticated;
grant execute on function private.verify_ledger_seals(text, text) to service_role;

-- ── 5. The nightly job, and its record ────────────────────────────────────

create table if not exists private.ledger_chain_verification (
  ran_at         timestamptz not null default now(),
  ok             boolean     not null,
  chains_checked integer     not null,
  sealed_today   integer     not null,
  first_break    jsonb
);

create index if not exists ledger_chain_verification_by_time
  on private.ledger_chain_verification (ran_at desc);

alter table private.ledger_chain_verification enable row level security;
revoke all on table private.ledger_chain_verification from public, anon, authenticated, service_role;

create or replace function private.refuse_ledger_chain_verification_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A ledger chain verification record is insert-only.' using errcode = '42501';
end $$;

revoke all on function private.refuse_ledger_chain_verification_change() from public, anon, authenticated;

drop trigger if exists ledger_chain_verification_immutable on private.ledger_chain_verification;
create trigger ledger_chain_verification_immutable before update or delete on private.ledger_chain_verification
  for each row execute function private.refuse_ledger_chain_verification_change();

-- Seal yesterday, then walk every chain that exists with both checks, and
-- record the run whether it was fine or not. The first break found is kept.
create or replace function private.ledger_chain_nightly()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  chain record;
  links jsonb;
  seals jsonb;
  n integer := 0;
  sealed integer;
  first_break jsonb;
begin
  sealed := private.ledger_chain_seal(current_date - 1);
  for chain in
    select distinct c.ledger, c.tenant_id from private.ledger_chain c order by 1, 2
  loop
    n := n + 1;
    links := private.verify_ledger_chain(chain.ledger, chain.tenant_id);
    seals := private.verify_ledger_seals(chain.ledger, chain.tenant_id);
    if first_break is null and not (links ->> 'ok')::boolean then
      first_break := jsonb_build_object('ledger', chain.ledger, 'tenant_id', chain.tenant_id, 'check', 'links', 'result', links);
    end if;
    if first_break is null and not (seals ->> 'ok')::boolean then
      first_break := jsonb_build_object('ledger', chain.ledger, 'tenant_id', chain.tenant_id, 'check', 'seals', 'result', seals);
    end if;
  end loop;
  insert into private.ledger_chain_verification (ok, chains_checked, sealed_today, first_break)
  values (first_break is null, n, sealed, first_break);
  return jsonb_build_object('ok', first_break is null, 'chains_checked', n, 'sealed', sealed, 'first_break', first_break);
end $$;

revoke all on function private.ledger_chain_nightly() from public, anon, authenticated;
grant execute on function private.ledger_chain_nightly() to service_role;

comment on table private.ledger_chain_manifest is
  'One HMAC-signed manifest per UTC day, ledger and school: bounds, count and head hash of the chain links. Insert-only; a day cannot be re-sealed differently.';
comment on table private.ledger_chain_verification is
  'Every run of private.ledger_chain_nightly(), good or bad. Insert-only.';

-- ── Rollback ──────────────────────────────────────────────────────────────
--
-- Additive; the chains and ledgers are untouched. To undo: unschedule
-- `ledger-chain-integrity`; drop the four functions above and the three
-- tables (key, manifest, verification) in `private`. Dropping the key makes
-- every manifest unverifiable, so do it only together with the manifests.
