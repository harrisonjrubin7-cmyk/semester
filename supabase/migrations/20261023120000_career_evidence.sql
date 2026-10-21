-- Semester — a student picks exact versions of their own work as portfolio
-- evidence, and an employer reads them only through a grant the student made,
-- named to them, scoped to those items, that ends when it expires or is
-- revoked. Backlog item B25, journey steps 9–10.
--
-- Stacks on 20261022120000_workspace_objects.sql (#1661). What it reuses:
--
--   * **The pinned version.** Evidence references
--     `workspace_object_versions (workspace_id, object_id, id)` — the same
--     tenant-safe triple a pinned workspace grant uses — so an evidence item can
--     only name a version in the student's own workspace, and that version can
--     never change after it is chosen (#1661's trigger). There is no way to
--     name the live object.
--   * **The ledger.** Idempotency keys go on `workspace_object_operations`
--     through `private.workspace_replay` and `private.workspace_spend`; this
--     file only widens its `kind` check. Same rule: the same key and request
--     replays the first receipt, the same key with anything else is 23505.
--   * **The grant shape.** One trigger, copied from `workspace_object_grant_fixed`:
--     a grant is only ever revoked, never changed or un-revoked.
--   * **Audit** through `private.record_audit`, pseudonymous, tenant null, no
--     content, as #1661 does.
--
-- Where #1661's grant does not fit, and so is not used for employers:
--
--   1. `workspace_object_grants` names an account. An employer here is an
--      account *acting for an employer*: it holds a live `employer` role grant
--      over `scope_kind = 'employer'` and one `scope_id`
--      (20260921223000_role_grants.sql, 20260926150000). That is the only
--      employer identity the schema has, and it is used as it is. A grant names
--      both, and the role is re-checked at every listing and every read, as
--      `support_shares` re-checks its role (20260928308000, D1): an employer
--      who loses the role loses the evidence without anybody revoking.
--   2. A workspace grantee reads versions straight from the table through RLS,
--      which nothing audits. Every employer read must be audited, so employers
--      get no policy on any table here or in #1661: they read through two
--      definer functions that write the audit row.
--   3. A workspace grant is one object or one version. A student shares a set
--      of items with an employer and revokes the set as one.
--
-- So an employer grant never appears in `private.workspace_object_access`, and
-- `workspace_object_read` and the workspace tables answer an employer exactly
-- as they answer a stranger.
--
-- Rules the server enforces:
--
--   * Only the workspace owner adds or withdraws evidence, grants or revokes.
--   * A grant names one employer account, found by address only among holders
--     of a live employer role at the named employer, and 1–20 evidence items.
--   * Every grant expires, at most 180 days out. A revoked grant, an expired
--     one, one whose employer lost the role, one whose student is not
--     age-cleared (D-139: minors are kept out of employer visibility), and an
--     item the student withdrew all answer "no such evidence here" — the same
--     as an id that never existed.
--   * Grades are not in this. Nothing here reads `grade_entries` or any
--     gradebook table, and no grant has a grade field. What an employer sees is
--     the text of a version the student chose, with its label.
--   * Every add, withdraw, grant and revoke is audited, idempotent, and names
--     the portfolio revision the student read (40001 when it moved). Every
--     employer listing and read is audited.
--
-- Account deletion: everything cascades from `workspaces` (the student) and a
-- grant also goes with its grantee (the employer's account).
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The shared ledger takes four more kinds ───────────────────────────────

alter table public.workspace_object_operations drop constraint if exists workspace_object_operations_kind_check;
alter table public.workspace_object_operations add constraint workspace_object_operations_kind_check
  check (kind in ('create', 'save', 'grant', 'evidence_add', 'evidence_withdraw', 'career_grant', 'career_revoke'));

-- ── The portfolio, and what is in it ──────────────────────────────────────

create table if not exists public.career_portfolios (
  workspace_id uuid        primary key references public.workspaces on delete cascade,
  -- Goes up by one with every add, withdraw, grant and revoke. Each names the
  -- revision it read.
  revision     bigint      not null default 0 check (revision >= 0),
  updated_at   timestamptz not null default now()
);

comment on table public.career_portfolios is 'One per workspace with career evidence: the revision a student''s add, withdraw, grant and revoke must name.';

create table if not exists public.career_evidence (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces on delete cascade,
  object_id    uuid        not null,
  version_id   uuid        not null,
  label        text        not null check (length(btrim(label)) between 1 and 120),
  added_at     timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, object_id, version_id)
    references public.workspace_object_versions (workspace_id, object_id, id) on delete cascade,
  check (withdrawn_at is null or withdrawn_at >= added_at)
);

create unique index if not exists career_evidence_one_live_per_version
  on public.career_evidence (workspace_id, version_id) where withdrawn_at is null;
create index if not exists career_evidence_by_version on public.career_evidence (workspace_id, object_id, version_id);

comment on table public.career_evidence is 'A version a student chose as portfolio evidence, with their label. Points at a version that never changes; only withdrawal changes a row.';

-- ── Grants to an employer ─────────────────────────────────────────────────

create table if not exists public.career_evidence_grants (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces on delete cascade,
  grantee        uuid        not null references auth.users on delete cascade,
  -- The `role_grants.scope_id` of the employer the grantee acts for.
  employer_scope text        not null check (length(btrim(employer_scope)) between 1 and 200),
  -- How the student is named to the employer: their choice, nothing looked up.
  shared_as      text        not null check (length(btrim(shared_as)) between 1 and 80),
  purpose        text        not null check (length(btrim(purpose)) between 1 and 200),
  granted_by     uuid        references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  revoked_by     uuid        references auth.users on delete set null,
  unique (workspace_id, id),
  check (expires_at > created_at and expires_at <= created_at + interval '180 days')
);

create index if not exists career_evidence_grants_by_grantee on public.career_evidence_grants (grantee, expires_at);
create index if not exists career_evidence_grants_by_granter on public.career_evidence_grants (granted_by);
create index if not exists career_evidence_grants_by_revoker on public.career_evidence_grants (revoked_by);

comment on table public.career_evidence_grants is 'One employer account''s access, for one employer, to named evidence, until it expires or is revoked. Only revocation changes a grant.';

create table if not exists public.career_evidence_grant_items (
  workspace_id uuid not null references public.workspaces on delete cascade,
  grant_id     uuid not null,
  evidence_id  uuid not null,
  primary key (grant_id, evidence_id),
  foreign key (workspace_id, grant_id) references public.career_evidence_grants (workspace_id, id) on delete cascade,
  foreign key (workspace_id, evidence_id) references public.career_evidence (workspace_id, id) on delete cascade
);

create index if not exists career_evidence_grant_items_by_grant on public.career_evidence_grant_items (workspace_id, grant_id);
create index if not exists career_evidence_grant_items_by_evidence on public.career_evidence_grant_items (workspace_id, evidence_id);

comment on table public.career_evidence_grant_items is 'Which evidence one grant names. Written with the grant, in the same transaction, and never after: a grant cannot be widened.';

-- ── Only withdrawal, revocation and the account's cascade change a row ────
-- Invokers: they run as whoever wrote the row, and only refuse.

create or replace function private.career_evidence_fixed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.workspace_object_versions v where v.id = old.version_id)
       and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
      raise exception 'semester: evidence is withdrawn, never deleted' using errcode = '55000';
    end if;
    return old;
  end if;
  if (new.id, new.workspace_id, new.object_id, new.version_id, new.label, new.added_at)
     is distinct from (old.id, old.workspace_id, old.object_id, old.version_id, old.label, old.added_at)
     or (old.withdrawn_at is not null and new.withdrawn_at is distinct from old.withdrawn_at) then
    raise exception 'semester: evidence is only ever withdrawn, never changed' using errcode = '55000';
  end if;
  return new;
end $$;

revoke all on function private.career_evidence_fixed() from public, anon, authenticated;

drop trigger if exists career_evidence_fixed on public.career_evidence;
create trigger career_evidence_fixed
  before update or delete on public.career_evidence
  for each row execute function private.career_evidence_fixed();

create or replace function private.career_evidence_grant_fixed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.id, new.workspace_id, new.grantee, new.employer_scope, new.shared_as, new.purpose,
      new.created_at, new.expires_at)
     is distinct from
     (old.id, old.workspace_id, old.grantee, old.employer_scope, old.shared_as, old.purpose,
      old.created_at, old.expires_at)
     or (new.granted_by is not null and new.granted_by is distinct from old.granted_by)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'semester: a grant is only ever revoked, never changed' using errcode = '55000';
  end if;
  return new;
end $$;

revoke all on function private.career_evidence_grant_fixed() from public, anon, authenticated;

drop trigger if exists career_evidence_grant_fixed on public.career_evidence_grants;
create trigger career_evidence_grant_fixed
  before update on public.career_evidence_grants
  for each row execute function private.career_evidence_grant_fixed();

-- An item goes in with its grant, in the same transaction (`now()` is the
-- transaction's start, which is the grant's `created_at`), and never after.
create or replace function private.career_evidence_grant_item_fixed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.career_evidence_grants g
                    where g.id = new.grant_id and g.created_at = now() and g.revoked_at is null) then
      raise exception 'semester: a grant names its evidence when it is made, and is never widened' using errcode = '55000';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.career_evidence_grants g where g.id = old.grant_id)
       and exists (select 1 from public.career_evidence e where e.id = old.evidence_id) then
      raise exception 'semester: a grant''s evidence never changes; revoke the grant' using errcode = '55000';
    end if;
    return old;
  end if;
  raise exception 'semester: a grant''s evidence never changes; revoke the grant' using errcode = '55000';
end $$;

revoke all on function private.career_evidence_grant_item_fixed() from public, anon, authenticated;

drop trigger if exists career_evidence_grant_item_fixed on public.career_evidence_grant_items;
create trigger career_evidence_grant_item_fixed
  before insert or update or delete on public.career_evidence_grant_items
  for each row execute function private.career_evidence_grant_item_fixed();

-- ── Who counts ────────────────────────────────────────────────────────────

-- Does this account act for this employer, now? Exact scope, live grant.
create or replace function private.career_employer_holds(who uuid, employer text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_grants g
     where g.subject = who
       and g.role = 'employer'
       and g.scope_kind = 'employer'
       and g.scope_id = employer
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now()));
$$;

-- One predicate for listing and reading, so the two cannot disagree about
-- whether a grant still gives anything.
create or replace function private.career_grant_live(want_grant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.career_evidence_grants g
      join public.workspaces w on w.id = g.workspace_id
     where g.id = want_grant
       and g.revoked_at is null
       and g.expires_at > now()
       and private.career_employer_holds(g.grantee, g.employer_scope)
       and private.age_cleared(w.owner_id));
$$;

-- The portfolio revision moves by one, from the one the caller read, or
-- nothing is written (40001).
create or replace function private.career_bump(ws uuid, expected bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r bigint;
begin
  insert into public.career_portfolios (workspace_id) values (ws) on conflict (workspace_id) do nothing;
  select p.revision into r from public.career_portfolios p where p.workspace_id = ws for update;
  if expected is distinct from r then
    raise exception 'semester: your portfolio changed since you read it; reload it and try again'
      using errcode = '40001', detail = format('expected revision %s, it is at %s', expected, r);
  end if;
  update public.career_portfolios set revision = r + 1, updated_at = now() where workspace_id = ws;
  return r + 1;
end $$;

revoke all on function private.career_employer_holds(uuid, text) from public, anon, authenticated;
revoke all on function private.career_grant_live(uuid) from public, anon, authenticated;
revoke all on function private.career_bump(uuid, bigint) from public, anon, authenticated;

-- ── Row-level security ────────────────────────────────────────────────────
-- The student reads their own rows. Employers have no policy anywhere: they
-- list and read through the two audited functions at the end.

alter table public.career_portfolios           enable row level security;
alter table public.career_evidence             enable row level security;
alter table public.career_evidence_grants      enable row level security;
alter table public.career_evidence_grant_items enable row level security;

revoke all on table public.career_portfolios           from anon, authenticated;
revoke all on table public.career_evidence             from anon, authenticated;
revoke all on table public.career_evidence_grants      from anon, authenticated;
revoke all on table public.career_evidence_grant_items from anon, authenticated;
grant select on table public.career_portfolios           to authenticated;
grant select on table public.career_evidence             to authenticated;
grant select on table public.career_evidence_grants      to authenticated;
grant select on table public.career_evidence_grant_items to authenticated;

drop policy if exists "the student reads their portfolio" on public.career_portfolios;
create policy "the student reads their portfolio" on public.career_portfolios
  for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

drop policy if exists "the student reads their evidence" on public.career_evidence;
create policy "the student reads their evidence" on public.career_evidence
  for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

drop policy if exists "the student reads their grants" on public.career_evidence_grants;
create policy "the student reads their grants" on public.career_evidence_grants
  for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

drop policy if exists "the student reads what each grant names" on public.career_evidence_grant_items;
create policy "the student reads what each grant names" on public.career_evidence_grant_items
  for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

-- ── The student's commands ────────────────────────────────────────────────

create or replace function public.career_evidence_add(
  want_version uuid, want_label text, want_expected_revision bigint, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  v      public.workspace_object_versions;
  req    jsonb;
  prior  jsonb;
  rev    bigint;
  made   public.career_evidence;
  answer jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select x.* into v from public.workspace_object_versions x
    join public.workspaces w on w.id = x.workspace_id
   where x.id = want_version and w.owner_id = me;
  if not found then
    raise exception 'semester: no such version here' using errcode = '42501';
  end if;
  if want_label is null or length(btrim(want_label)) not between 1 and 120 then
    raise exception 'semester: name the evidence in up to 120 characters' using errcode = 'check_violation';
  end if;

  req := jsonb_build_object('version', want_version, 'expected_revision', want_expected_revision,
                            'label_sha256', encode(sha256(convert_to(btrim(want_label), 'UTF8')), 'hex'));
  prior := private.workspace_replay(v.workspace_id, want_key, 'evidence_add', req);
  if prior is not null then return prior; end if;

  rev := private.career_bump(v.workspace_id, want_expected_revision);
  if exists (select 1 from public.career_evidence e
              where e.workspace_id = v.workspace_id and e.version_id = v.id and e.withdrawn_at is null) then
    raise exception 'semester: that version is already in your portfolio' using errcode = 'check_violation';
  end if;

  insert into public.career_evidence (workspace_id, object_id, version_id, label)
  values (v.workspace_id, v.object_id, v.id, btrim(want_label))
  returning * into made;

  answer := jsonb_build_object('evidence', made.id, 'object', made.object_id, 'version', made.version_id,
                               'added_at', made.added_at, 'revision', rev);
  perform private.record_audit(null, 'career_evidence.added', 'career_evidence', made.id::text, 'allowed', null,
                               jsonb_build_object('version_number', v.version_number));
  perform private.workspace_spend(v.workspace_id, want_key, 'evidence_add', req, answer);
  return answer;
end $$;

-- Withdrawing ends every grant's access to the item. Withdrawing twice answers
-- the first withdrawal and writes nothing.
create or replace function public.career_evidence_withdraw(
  want_evidence uuid, want_expected_revision bigint, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  e      public.career_evidence;
  req    jsonb;
  prior  jsonb;
  rev    bigint;
  answer jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select x.* into e from public.career_evidence x
    join public.workspaces w on w.id = x.workspace_id
   where x.id = want_evidence and w.owner_id = me;
  if not found then
    raise exception 'semester: no such evidence here' using errcode = '42501';
  end if;

  req := jsonb_build_object('evidence', want_evidence, 'expected_revision', want_expected_revision);
  prior := private.workspace_replay(e.workspace_id, want_key, 'evidence_withdraw', req);
  if prior is not null then return prior; end if;

  select x.* into e from public.career_evidence x where x.id = want_evidence for update;
  if e.withdrawn_at is not null then
    return jsonb_build_object('evidence', e.id, 'withdrawn_at', e.withdrawn_at,
                              'revision', (select p.revision from public.career_portfolios p where p.workspace_id = e.workspace_id));
  end if;
  rev := private.career_bump(e.workspace_id, want_expected_revision);
  update public.career_evidence set withdrawn_at = now() where id = e.id returning * into e;

  answer := jsonb_build_object('evidence', e.id, 'withdrawn_at', e.withdrawn_at, 'revision', rev);
  perform private.record_audit(null, 'career_evidence.withdrawn', 'career_evidence', e.id::text, 'allowed');
  perform private.workspace_spend(e.workspace_id, want_key, 'evidence_withdraw', req, answer);
  return answer;
end $$;

create or replace function public.career_evidence_grant(
  want_employer_email text, want_employer_scope text, want_evidence uuid[], want_shared_as text,
  want_purpose text, want_expires_at timestamptz, want_expected_revision bigint, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  ws       uuid;
  scope    text := btrim(coalesce(want_employer_scope, ''));
  items    uuid[];
  employer uuid;
  req      jsonb;
  prior    jsonb;
  rev      bigint;
  made     public.career_evidence_grants;
  answer   jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select w.id into ws from public.workspaces w where w.owner_id = me and w.kind = 'personal';
  select coalesce(array_agg(distinct x order by x), '{}') into items from unnest(want_evidence) x where x is not null;
  if cardinality(items) not between 1 and 20 then
    raise exception 'semester: choose between 1 and 20 pieces of evidence' using errcode = 'check_violation';
  end if;
  -- Every item is the caller's own and still in the portfolio. A stranger's
  -- id reads exactly like one that does not exist.
  if ws is null or (select count(*) from public.career_evidence e
                     where e.workspace_id = ws and e.id = any (items) and e.withdrawn_at is null) <> cardinality(items) then
    raise exception 'semester: no such evidence here' using errcode = '42501';
  end if;
  -- D-139: minors are kept out of employer visibility.
  if not private.age_cleared(me) then
    raise exception 'semester: sharing with employers opens once your account says you are 18 or over' using errcode = '42501';
  end if;
  if length(scope) not between 1 and 200 then
    raise exception 'semester: name the employer' using errcode = 'check_violation';
  end if;
  if want_shared_as is null or length(btrim(want_shared_as)) not between 1 and 80 then
    raise exception 'semester: say in up to 80 characters how the employer should know you' using errcode = 'check_violation';
  end if;
  if want_purpose is null or length(btrim(want_purpose)) not between 1 and 200 then
    raise exception 'semester: say in up to 200 characters what it is shared for' using errcode = 'check_violation';
  end if;
  if want_expires_at is null or want_expires_at <= now() or want_expires_at > now() + interval '180 days' then
    raise exception 'semester: a share with an employer ends within 180 days' using errcode = 'check_violation';
  end if;

  req := jsonb_build_object('employer_sha256', encode(sha256(convert_to(lower(btrim(coalesce(want_employer_email, ''))), 'UTF8')), 'hex'),
                            'employer_scope', scope, 'evidence', to_jsonb(items),
                            'shared_as_sha256', encode(sha256(convert_to(btrim(want_shared_as), 'UTF8')), 'hex'),
                            'purpose_sha256', encode(sha256(convert_to(btrim(want_purpose), 'UTF8')), 'hex'),
                            'expires_at', want_expires_at, 'expected_revision', want_expected_revision);
  prior := private.workspace_replay(ws, want_key, 'career_grant', req);
  if prior is not null then return prior; end if;

  -- Found by address only among people who act for that employer now, so the
  -- answer says nothing about whether the address has an account.
  select u.id into employer
    from auth.users u
   where lower(u.email) = lower(btrim(coalesce(want_employer_email, '')))
     and u.id <> me
     and private.career_employer_holds(u.id, scope)
   limit 1;
  if employer is null then
    raise exception 'semester: nobody at that employer uses that address in Semester' using errcode = 'P0002';
  end if;

  rev := private.career_bump(ws, want_expected_revision);
  insert into public.career_evidence_grants
    (workspace_id, grantee, employer_scope, shared_as, purpose, granted_by, expires_at)
  values (ws, employer, scope, btrim(want_shared_as), btrim(want_purpose), me, want_expires_at)
  returning * into made;
  insert into public.career_evidence_grant_items (workspace_id, grant_id, evidence_id)
  select ws, made.id, x from unnest(items) x;

  answer := jsonb_build_object('grant', made.id, 'employer_scope', made.employer_scope, 'evidence', to_jsonb(items),
                               'expires_at', made.expires_at, 'granted_at', made.created_at, 'revision', rev);
  perform private.record_audit(null, 'career_evidence.granted', 'career_evidence_grant', made.id::text, 'allowed', null,
                               jsonb_build_object('items', cardinality(items),
                                                  'days', ceil(extract(epoch from made.expires_at - made.created_at) / 86400)));
  perform private.workspace_spend(ws, want_key, 'career_grant', req, answer);
  return answer;
end $$;

-- Revoking twice answers the first revocation and writes nothing.
create or replace function public.career_evidence_revoke(
  want_grant uuid, want_expected_revision bigint, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  g      public.career_evidence_grants;
  req    jsonb;
  prior  jsonb;
  rev    bigint;
  answer jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select x.* into g from public.career_evidence_grants x
    join public.workspaces w on w.id = x.workspace_id
   where x.id = want_grant and w.owner_id = me;
  if not found then
    raise exception 'semester: no such grant here' using errcode = '42501';
  end if;

  req := jsonb_build_object('grant', want_grant, 'expected_revision', want_expected_revision);
  prior := private.workspace_replay(g.workspace_id, want_key, 'career_revoke', req);
  if prior is not null then return prior; end if;

  select x.* into g from public.career_evidence_grants x where x.id = want_grant for update;
  if g.revoked_at is not null then
    return jsonb_build_object('grant', g.id, 'revoked_at', g.revoked_at,
                              'revision', (select p.revision from public.career_portfolios p where p.workspace_id = g.workspace_id));
  end if;
  rev := private.career_bump(g.workspace_id, want_expected_revision);
  update public.career_evidence_grants set revoked_at = now(), revoked_by = me where id = g.id returning * into g;

  answer := jsonb_build_object('grant', g.id, 'revoked_at', g.revoked_at, 'revision', rev);
  perform private.record_audit(null, 'career_evidence.revoked', 'career_evidence_grant', g.id::text, 'allowed');
  perform private.workspace_spend(g.workspace_id, want_key, 'career_revoke', req, answer);
  return answer;
end $$;

-- The student's portfolio: the revision to name, the evidence in it, and who
-- has access now — every grant not revoked and not expired, and whether its
-- employer still holds the role (if not, it gives nothing already).
create or replace function public.career_evidence_mine()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ws uuid;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select w.id into ws from public.workspaces w where w.owner_id = me and w.kind = 'personal';
  return jsonb_build_object(
    'revision', coalesce((select p.revision from public.career_portfolios p where p.workspace_id = ws), 0),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
               'evidence', e.id, 'object', e.object_id, 'version', e.version_id, 'label', e.label,
               'title', v.title, 'version_number', v.version_number, 'saved_at', v.created_at, 'added_at', e.added_at)
             order by e.added_at desc, e.id)
        from public.career_evidence e
        join public.workspace_object_versions v on v.id = e.version_id
       where e.workspace_id = ws and e.withdrawn_at is null), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'grant', g.id, 'employer_email', u.email, 'employer_scope', g.employer_scope,
               'shared_as', g.shared_as, 'purpose', g.purpose, 'granted_at', g.created_at, 'expires_at', g.expires_at,
               'employer_active', private.career_employer_holds(g.grantee, g.employer_scope),
               'evidence', (select coalesce(jsonb_agg(i.evidence_id order by i.evidence_id), '[]'::jsonb)
                              from public.career_evidence_grant_items i where i.grant_id = g.id))
             order by g.created_at desc, g.id)
        from public.career_evidence_grants g
        join auth.users u on u.id = g.grantee
       where g.workspace_id = ws and g.revoked_at is null and g.expires_at > now()), '[]'::jsonb));
end $$;

-- ── The employer's side ───────────────────────────────────────────────────
-- Both re-check the grant, the role and the student's age now, and both are
-- audited: listing shows labels and titles, so it is a read.

create or replace function public.career_evidence_shared_with_me()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  answer jsonb;
  g      uuid;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'grant', x.id, 'shared_as', x.shared_as, 'purpose', x.purpose, 'employer_scope', x.employer_scope,
           'granted_at', x.created_at, 'expires_at', x.expires_at,
           'evidence', (select coalesce(jsonb_agg(jsonb_build_object(
                                  'evidence', e.id, 'label', e.label, 'title', v.title,
                                  'version_number', v.version_number, 'saved_at', v.created_at)
                                order by e.added_at, e.id), '[]'::jsonb)
                          from public.career_evidence_grant_items i
                          join public.career_evidence e on e.id = i.evidence_id and e.withdrawn_at is null
                          join public.workspace_object_versions v on v.id = e.version_id
                         where i.grant_id = x.id))
         order by x.created_at desc, x.id), '[]'::jsonb)
    into answer
    from public.career_evidence_grants x
   where x.grantee = me and private.career_grant_live(x.id);
  for g in select (j ->> 'grant')::uuid from jsonb_array_elements(answer) j loop
    perform private.record_audit(null, 'career_evidence.listed', 'career_evidence_grant', g::text, 'allowed');
  end loop;
  return answer;
end $$;

-- One item's content: the pinned version it names, never the live object.
create or replace function public.career_evidence_read(want_grant uuid, want_evidence uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e  public.career_evidence;
  v  public.workspace_object_versions;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select x.* into e
    from public.career_evidence x
    join public.career_evidence_grant_items i on i.evidence_id = x.id and i.workspace_id = x.workspace_id
    join public.career_evidence_grants g on g.id = i.grant_id and g.workspace_id = i.workspace_id
   where g.id = want_grant and x.id = want_evidence
     and g.grantee = me
     and x.withdrawn_at is null
     and private.career_grant_live(g.id);
  -- Revoked, expired, role lost, a minor's, withdrawn, somebody else's, or
  -- never there: one answer.
  if not found then
    raise exception 'semester: no such evidence here' using errcode = '42501';
  end if;
  select x.* into v from public.workspace_object_versions x
   where x.id = e.version_id and x.object_id = e.object_id and x.workspace_id = e.workspace_id;
  perform private.record_audit(null, 'career_evidence.read', 'career_evidence', e.id::text, 'allowed');
  return jsonb_build_object(
    'grant', want_grant, 'evidence', e.id, 'label', e.label,
    'title', v.title, 'body', v.body, 'mime_type', v.mime_type, 'content_schema', v.content_schema,
    'version_number', v.version_number, 'byte_length', v.byte_length, 'content_sha256', v.content_sha256,
    'saved_at', v.created_at);
end $$;

revoke all on function public.career_evidence_add(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.career_evidence_withdraw(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.career_evidence_grant(text, text, uuid[], text, text, timestamptz, bigint, text) from public, anon, authenticated;
revoke all on function public.career_evidence_revoke(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.career_evidence_mine() from public, anon, authenticated;
revoke all on function public.career_evidence_shared_with_me() from public, anon, authenticated;
revoke all on function public.career_evidence_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.career_evidence_add(uuid, text, bigint, text) to authenticated;
grant execute on function public.career_evidence_withdraw(uuid, bigint, text) to authenticated;
grant execute on function public.career_evidence_grant(text, text, uuid[], text, text, timestamptz, bigint, text) to authenticated;
grant execute on function public.career_evidence_revoke(uuid, bigint, text) to authenticated;
grant execute on function public.career_evidence_mine() to authenticated;
grant execute on function public.career_evidence_shared_with_me() to authenticated;
grant execute on function public.career_evidence_read(uuid, uuid) to authenticated;

-- ── An account that received evidence is not untouched ────────────────────
-- The student's side is already covered by `workspaces`. Unchanged from
-- 20261022120000 except for the last row.

create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id'),
      ('public.help_requests',        'student_id'),
      ('public.mentor_requests',      'requester'),
      ('public.mentor_requests',      'recipient'),
      ('public.peer_mentor_offers',   'user_id'),
      ('public.alumni_mentor_offers', 'user_id'),
      ('public.community_posts',      'author_id'),
      ('public.community_sessions',   'host_id'),
      ('public.community_session_participants', 'user_id'),
      ('public.community_mutes',      'user_id'),
      ('public.community_members',    'user_id'),
      ('public.community_aliases',    'user_id'),
      ('public.community_volunteers', 'user_id'),
      ('public.community_media',      'uploader_id'),
      ('public.graduation_scenarios', 'user_id'),
      ('public.productivity_workspace', 'user_id'),
      ('public.productivity_task',      'owner_id'),
      ('public.productivity_event',     'owner_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id'),
      ('public.family_invites',       'student_id'),
      ('public.family_shared_items',  'student_id'),
      ('public.family_access_events', 'student_id'),
      ('public.support_shares',       'student_id'),
      ('public.support_shares',       'staff_id'),
      -- 20260929360000: what a person did in three school domains.
      ('public.registration_enrollments', 'student'),
      ('public.regrade_requests',     'student_id'),
      ('public.dining_orders',        'student'),
      -- 20261022120000: a person's own documents.
      ('public.workspaces',           'owner_id'),
      -- 20261023120000: evidence a student shared with this account.
      ('public.career_evidence_grants', 'grantee')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.lti_account_untouched(uuid) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   -- First re-run lti_account_untouched from 20261022120000, which drops the
--   -- career_evidence_grants row.
--   drop function if exists public.career_evidence_read(uuid, uuid);
--   drop function if exists public.career_evidence_shared_with_me();
--   drop function if exists public.career_evidence_mine();
--   drop function if exists public.career_evidence_revoke(uuid, bigint, text);
--   drop function if exists public.career_evidence_grant(text, text, uuid[], text, text, timestamptz, bigint, text);
--   drop function if exists public.career_evidence_withdraw(uuid, bigint, text);
--   drop function if exists public.career_evidence_add(uuid, text, bigint, text);
--   drop table if exists public.career_evidence_grant_items;
--   drop table if exists public.career_evidence_grants;
--   drop table if exists public.career_evidence;
--   drop table if exists public.career_portfolios;
--   drop function if exists private.career_bump(uuid, bigint);
--   drop function if exists private.career_grant_live(uuid);
--   drop function if exists private.career_employer_holds(uuid, text);
--   drop function if exists private.career_evidence_grant_item_fixed();
--   drop function if exists private.career_evidence_grant_fixed();
--   drop function if exists private.career_evidence_fixed();
--   delete from public.workspace_object_operations
--    where kind in ('evidence_add', 'evidence_withdraw', 'career_grant', 'career_revoke');
--   alter table public.workspace_object_operations drop constraint if exists workspace_object_operations_kind_check;
--   alter table public.workspace_object_operations add constraint workspace_object_operations_kind_check
--     check (kind in ('create', 'save', 'grant'));
--   commit;
