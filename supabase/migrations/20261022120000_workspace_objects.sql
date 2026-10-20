-- Semester — a student's own document on the server, every saved version
-- kept exactly, and sharing that can name one version and nothing more.
--
-- The foundation for "work in a private Semester document → a submission
-- captures an exact version → the student chooses what to publish". Nothing
-- on main held a document server-side as a thing with versions:
--
--   * `notes` (20260901000700_records.sql) is one jsonb row per note, written
--     over in place by sync, with no version and no sharing. It is the
--     device's store mirrored, and stays that.
--   * `productivity_workspace` is one jsonb blob per account guarded by a
--     sequence number; it holds tasks and plans, not documents, and its
--     replace-the-blob write is the opposite of "never rewrite a version".
--   * `lib/document.ts` is the block editor's format and lives on the device;
--     `lib/draft.ts` is unsent text in localStorage and is explicitly never
--     synced. Both are left exactly as they are. A version saved here carries
--     `content_schema` so the editor's blocks can be stored as JSON without
--     this table knowing their shape.
--
-- So these are new tables, and they extend none of those. D-1661 records why.
--
-- What it decides:
--
--   * **A workspace owns objects.** `workspaces` has one kind today,
--     `personal`, owned by one account and made the first time that account
--     creates something. Institution workspaces are later work; the column is
--     there so they do not need a new table.
--   * **Tenant-safe by construction, not by convention.** Objects are
--     `unique (workspace_id, id)`; a version's `(workspace_id, object_id)`
--     references that pair, and versions are `unique (workspace_id,
--     object_id, id)`, so anything that pins a version pins all three
--     together. `workspace_objects.current_version_id` references that triple
--     with the object's own id in the middle: an object cannot name another
--     object's version as its current one, and a version cannot claim an
--     object in another workspace. Foreign keys, so no writer can get it
--     wrong — including this file's own functions.
--   * **A version never changes.** A trigger refuses UPDATE of anything but
--     `created_by` being cleared by an account deletion, and refuses DELETE
--     while the object it belongs to still exists — so the object's own
--     cascade (account deletion) can still take it, and nothing else can.
--     Retention and legal-hold deletion are deliberately not in this slice.
--   * **Saving is optimistic.** `workspace_objects.revision` goes up by one
--     per saved version. A save names the revision it read; any other revision
--     is SQLSTATE 40001, "changed since you read it", and writes nothing.
--   * **Idempotent, on a ledger of its own.** The gradebook's ledger is keyed
--     by school and references `schools`; a personal workspace has no school.
--     `workspace_object_operations` is the same shape keyed by workspace. The
--     request recorded is ids and the SHA-256 of the body, never the body.
--     The same key and request answers the first receipt and writes nothing;
--     the same key with anything else different is refused (23505).
--   * **Sharing is explicit and narrow.** A grant names one account. Its
--     target is the live object (`version_id` null) or one version. A pinned
--     grant reads that version and nothing else — not the object's row, not
--     its title as it is now, not any later version — and its target cannot be
--     changed after it is made, so it cannot become live access. A live grant
--     reads the object and its current version. `edit` exists only on a live
--     grant and lets the grantee save a new version; `comment` reads (there is
--     no comment store yet). Only the owner grants. Expired or revoked grants
--     give nothing. Nothing here grants by email domain, school or link: a
--     grant is a row naming the grantee or it is nothing.
--   * **Audited, pseudonymously.** Every create, save, grant, revoke and every
--     read by somebody other than the owner writes `private.record_audit`
--     (object id hashed, no content, no title). Tenant is null: a personal
--     workspace is nobody's school, so the event is service-readable only.
--   * **No domain event.** `private.emit_domain_event` needs an existing
--     tenant on every row, and the event registry
--     (`packages/institution/src/events.ts`) has no type for a personal
--     document. Inventing both is a decision for when something consumes it.
--   * **No capability.** Ownership is `auth.uid()` against
--     `workspaces.owner_id`; there is nothing for a role to hold.
--
-- Content is inline text — plain text, Markdown or JSON — with its byte
-- length, SHA-256, MIME type and content schema, at most 1 MiB per version.
-- Private storage keys for files are a later decision (D-1661).
--
-- Account deletion: `workspaces.owner_id` cascades from `auth.users`, and
-- everything else cascades from the workspace; a grant also goes with its
-- grantee. `created_by`, `granted_by`, `revoked_by` and the ledger's actor
-- are cleared.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── Workspaces ────────────────────────────────────────────────────────────

create table if not exists public.workspaces (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null default 'personal' check (kind in ('personal')),
  owner_id   uuid        not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists workspaces_one_personal on public.workspaces (owner_id) where kind = 'personal';
create index if not exists workspaces_by_owner on public.workspaces (owner_id);

comment on table public.workspaces is 'Where a person''s objects live. One personal workspace per account, made on first use. Owners read their own; nobody writes except the workspace_object_* functions.';

-- ── Objects and their versions ────────────────────────────────────────────

create table if not exists public.workspace_objects (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null references public.workspaces on delete cascade,
  kind               text        not null check (kind in ('document', 'note', 'spreadsheet', 'presentation', 'file')),
  title              text        not null check (length(btrim(title)) between 1 and 200),
  revision           bigint      not null default 0 check (revision >= 0),
  current_version_id uuid,
  created_by         uuid        references auth.users on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, id),
  check (current_version_id is not null or revision = 0)
);

create table if not exists public.workspace_object_versions (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces on delete cascade,
  object_id      uuid        not null,
  version_number integer     not null check (version_number > 0),
  title          text        not null check (length(btrim(title)) between 1 and 200),
  body           text        not null,
  mime_type      text        not null check (mime_type in ('text/plain', 'text/markdown', 'application/json')),
  content_schema text        not null check (content_schema ~ '^[a-z][a-z0-9._-]{0,60}/[0-9]{1,4}$'),
  byte_length    integer     not null check (byte_length between 0 and 1048576),
  content_sha256 text        not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_by     uuid        references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  unique (object_id, version_number),
  unique (workspace_id, object_id, id),
  foreign key (workspace_id, object_id) references public.workspace_objects (workspace_id, id) on delete cascade,
  check (byte_length = octet_length(body)),
  check (content_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex'))
);

alter table public.workspace_objects drop constraint if exists workspace_objects_current_version_is_its_own;
alter table public.workspace_objects add constraint workspace_objects_current_version_is_its_own
  foreign key (workspace_id, id, current_version_id)
  references public.workspace_object_versions (workspace_id, object_id, id);

create index if not exists workspace_objects_by_workspace on public.workspace_objects (workspace_id, updated_at desc);
create index if not exists workspace_objects_by_current_version on public.workspace_objects (workspace_id, id, current_version_id);
create index if not exists workspace_object_versions_by_creator on public.workspace_object_versions (created_by);
create index if not exists workspace_objects_by_creator on public.workspace_objects (created_by);

comment on table public.workspace_objects is 'A continuing document in a workspace. revision counts saved versions; current_version_id is always one of this object''s own versions.';
comment on table public.workspace_object_versions is 'One saved version of an object, never changed: content with its byte length and SHA-256. A new save is a new row.';

-- ── Sharing ───────────────────────────────────────────────────────────────

create table if not exists public.workspace_object_grants (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces on delete cascade,
  object_id    uuid        not null,
  -- Null: the live object. Set: that version and nothing else, for good.
  version_id   uuid,
  grantee      uuid        not null references auth.users on delete cascade,
  granted_by   uuid        references auth.users on delete set null,
  permission   text        not null check (permission in ('read', 'comment', 'edit')),
  purpose      text        not null check (length(btrim(purpose)) between 1 and 200),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  revoked_by   uuid        references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (workspace_id, object_id) references public.workspace_objects (workspace_id, id) on delete cascade,
  foreign key (workspace_id, object_id, version_id)
    references public.workspace_object_versions (workspace_id, object_id, id) on delete cascade,
  check (version_id is null or permission <> 'edit'),
  check (expires_at is null or expires_at > created_at)
);

create index if not exists workspace_object_grants_by_grantee on public.workspace_object_grants (grantee, object_id);
create index if not exists workspace_object_grants_by_target on public.workspace_object_grants (workspace_id, object_id, version_id);
create index if not exists workspace_object_grants_by_granter on public.workspace_object_grants (granted_by);
create index if not exists workspace_object_grants_by_revoker on public.workspace_object_grants (revoked_by);

comment on table public.workspace_object_grants is 'One account''s access to one object: the live object, or one pinned version. Only revocation changes a grant.';

-- ── The ledger ────────────────────────────────────────────────────────────

create table if not exists public.workspace_object_operations (
  workspace_id    uuid        not null references public.workspaces on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('create', 'save', 'grant')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (workspace_id, idempotency_key)
);

create index if not exists workspace_object_operations_by_actor on public.workspace_object_operations (actor);

comment on table public.workspace_object_operations is 'Idempotency keys the workspace_object_* functions spent, with what each asked (ids and hashes, never content) and answered. No client reads or writes it.';

-- ── A version never changes; a grant only gets revoked ────────────────────
-- Invokers: they run as whoever wrote the row, and only refuse.

create or replace function private.workspace_object_version_fixed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Account deletion cascades from the workspace, to the object and to
    -- this row; by the time it gets here one of the two is already gone.
    if exists (select 1 from public.workspace_objects o where o.id = old.object_id)
       and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
      raise exception 'semester: a saved version is never deleted' using errcode = '55000';
    end if;
    return old;
  end if;
  if (new.id, new.workspace_id, new.object_id, new.version_number, new.title, new.body, new.mime_type,
      new.content_schema, new.byte_length, new.content_sha256, new.created_at)
     is distinct from
     (old.id, old.workspace_id, old.object_id, old.version_number, old.title, old.body, old.mime_type,
      old.content_schema, old.byte_length, old.content_sha256, old.created_at)
     or (new.created_by is not null and new.created_by is distinct from old.created_by) then
    raise exception 'semester: a saved version never changes; save a new one' using errcode = '55000';
  end if;
  return new;
end $$;

revoke all on function private.workspace_object_version_fixed() from public, anon, authenticated;

drop trigger if exists workspace_object_version_fixed on public.workspace_object_versions;
create trigger workspace_object_version_fixed
  before update or delete on public.workspace_object_versions
  for each row execute function private.workspace_object_version_fixed();

create or replace function private.workspace_object_grant_fixed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.id, new.workspace_id, new.object_id, new.version_id, new.grantee, new.permission, new.purpose,
      new.expires_at, new.created_at)
     is distinct from
     (old.id, old.workspace_id, old.object_id, old.version_id, old.grantee, old.permission, old.purpose,
      old.expires_at, old.created_at)
     or (new.granted_by is not null and new.granted_by is distinct from old.granted_by)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'semester: a grant is only ever revoked, never changed' using errcode = '55000';
  end if;
  return new;
end $$;

revoke all on function private.workspace_object_grant_fixed() from public, anon, authenticated;

drop trigger if exists workspace_object_grant_fixed on public.workspace_object_grants;
create trigger workspace_object_grant_fixed
  before update on public.workspace_object_grants
  for each row execute function private.workspace_object_grant_fixed();

-- ── Who may do what ───────────────────────────────────────────────────────
-- 'owner', or the strongest valid grant's permission, or null. `want_version`
-- null asks about the live object (its row, its current version); a version
-- id asks about that version. A pinned grant answers only for its own version.
-- Definer so the policies below can read grants without recursing; executable
-- by `authenticated` because the policies call it, as `gradebook_author` is.

create or replace function private.workspace_object_access(want_object uuid, want_version uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.workspace_objects o
        join public.workspaces w on w.id = o.workspace_id
       where o.id = want_object and w.owner_id = (select auth.uid())
         and (want_version is null or exists (
               select 1 from public.workspace_object_versions v
                where v.id = want_version and v.object_id = o.id)))
    then 'owner'
    else (
      select g.permission
        from public.workspace_object_grants g
        join public.workspace_objects o on o.id = g.object_id
       where g.object_id = want_object
         and g.grantee = (select auth.uid())
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at > now())
         and ((g.version_id is null and (want_version is null or want_version = o.current_version_id))
              or (g.version_id is not null and g.version_id = want_version))
       order by case g.permission when 'edit' then 1 when 'comment' then 2 else 3 end
       limit 1)
  end
$$;

revoke all on function private.workspace_object_access(uuid, uuid) from public, anon, authenticated;
grant execute on function private.workspace_object_access(uuid, uuid) to authenticated;

-- The caller's personal workspace, made on first use.
create or replace function private.workspace_mine()
returns uuid
language plpgsql
volatile
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
  if ws is null then
    insert into public.workspaces (kind, owner_id) values ('personal', me)
    on conflict (owner_id) where kind = 'personal' do nothing
    returning id into ws;
    if ws is null then
      select w.id into ws from public.workspaces w where w.owner_id = me and w.kind = 'personal';
    end if;
  end if;
  return ws;
end $$;

-- Why this content cannot be saved, or null when it can.
create or replace function private.workspace_content_problem(want_title text, want_body text, want_mime text, want_schema text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when want_title is null or length(btrim(want_title)) = 0 then 'a title is needed'
    when length(btrim(want_title)) > 200 then 'a title is at most 200 characters'
    when want_body is null then 'there is no content'
    when octet_length(want_body) > 1048576 then 'a version is at most 1 MiB'
    when want_mime is null or want_mime not in ('text/plain', 'text/markdown', 'application/json')
      then 'content is plain text, Markdown or JSON'
    when want_schema is null or want_schema !~ '^[a-z][a-z0-9._-]{0,60}/[0-9]{1,4}$'
      then 'the content schema is a name and a version, like semester.document/1'
    when want_mime = 'application/json' and not pg_catalog.pg_input_is_valid(want_body, 'jsonb')
      then 'that is not JSON'
  end
$$;

create or replace function private.workspace_replay(ws uuid, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.workspace_object_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('workspace-op:' || ws::text || ':' || want_key));
  select * into op from public.workspace_object_operations o where o.workspace_id = ws and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;

create or replace function private.workspace_spend(ws uuid, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.workspace_object_operations (workspace_id, idempotency_key, actor, kind, request, result)
  values (ws, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;

revoke all on function private.workspace_mine() from public, anon, authenticated;
revoke all on function private.workspace_content_problem(text, text, text, text) from public, anon, authenticated;
revoke all on function private.workspace_replay(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.workspace_spend(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;

-- ── Row-level security ────────────────────────────────────────────────────
-- Reads only. Every write is one of the functions below.

alter table public.workspaces                  enable row level security;
alter table public.workspace_objects           enable row level security;
alter table public.workspace_object_versions   enable row level security;
alter table public.workspace_object_grants     enable row level security;
alter table public.workspace_object_operations enable row level security;

revoke all on table public.workspaces                  from anon, authenticated;
revoke all on table public.workspace_objects           from anon, authenticated;
revoke all on table public.workspace_object_versions   from anon, authenticated;
revoke all on table public.workspace_object_grants     from anon, authenticated;
revoke all on table public.workspace_object_operations from anon, authenticated;
grant select on table public.workspaces                to authenticated;
grant select on table public.workspace_objects         to authenticated;
grant select on table public.workspace_object_versions to authenticated;
grant select on table public.workspace_object_grants   to authenticated;

drop policy if exists "owners read their workspace" on public.workspaces;
create policy "owners read their workspace" on public.workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "owners and live grantees read the object" on public.workspace_objects;
create policy "owners and live grantees read the object" on public.workspace_objects
  for select to authenticated
  using (private.workspace_object_access(id, null) is not null);

drop policy if exists "owners and grantees read the versions granted" on public.workspace_object_versions;
create policy "owners and grantees read the versions granted" on public.workspace_object_versions
  for select to authenticated
  using (private.workspace_object_access(object_id, id) is not null);

drop policy if exists "owners read their grants, grantees their own" on public.workspace_object_grants;
create policy "owners read their grants, grantees their own" on public.workspace_object_grants
  for select to authenticated
  using (grantee = (select auth.uid())
         or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

-- ── Commands ──────────────────────────────────────────────────────────────
-- Each answers a receipt. A stranger is told "no such object here" whether or
-- not it exists, so a refusal is not a way to learn that it does.

create or replace function public.workspace_object_create(
  want_kind text, want_title text, want_body text, want_mime text, want_schema text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  ws      uuid;
  problem text;
  hash    text;
  req     jsonb;
  prior   jsonb;
  obj     uuid;
  ver     public.workspace_object_versions;
  answer  jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  if want_kind is null or want_kind not in ('document', 'note', 'spreadsheet', 'presentation', 'file') then
    raise exception 'semester: that is not a kind of object' using errcode = 'check_violation';
  end if;
  problem := private.workspace_content_problem(want_title, want_body, want_mime, want_schema);
  if problem is not null then
    raise exception 'semester: %', problem using errcode = 'check_violation';
  end if;

  ws := private.workspace_mine();
  hash := encode(sha256(convert_to(want_body, 'UTF8')), 'hex');
  req := jsonb_build_object('kind', want_kind, 'title_sha256', encode(sha256(convert_to(btrim(want_title), 'UTF8')), 'hex'),
                            'content_sha256', hash, 'mime', want_mime, 'schema', want_schema);
  prior := private.workspace_replay(ws, want_key, 'create', req);
  if prior is not null then return prior; end if;

  insert into public.workspace_objects (workspace_id, kind, title, created_by)
  values (ws, want_kind, btrim(want_title), me)
  returning id into obj;

  insert into public.workspace_object_versions
    (workspace_id, object_id, version_number, title, body, mime_type, content_schema, byte_length, content_sha256, created_by)
  values (ws, obj, 1, btrim(want_title), want_body, want_mime, want_schema, octet_length(want_body), hash, me)
  returning * into ver;

  update public.workspace_objects
     set current_version_id = ver.id, revision = 1, updated_at = ver.created_at
   where id = obj;

  answer := jsonb_build_object('object', obj, 'version', ver.id, 'version_number', 1, 'revision', 1,
                               'content_sha256', hash, 'byte_length', ver.byte_length, 'saved_at', ver.created_at);

  perform private.record_audit(null, 'workspace_object.created', 'workspace_object', obj::text, 'allowed', null,
                               jsonb_build_object('kind', want_kind, 'version_number', 1));
  perform private.workspace_spend(ws, want_key, 'create', req, answer);
  return answer;
end $$;

create or replace function public.workspace_object_save(
  want_object uuid, want_expected_revision bigint, want_title text, want_body text,
  want_mime text, want_schema text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  access  text := private.workspace_object_access(want_object, null);
  o       public.workspace_objects;
  problem text;
  hash    text;
  req     jsonb;
  prior   jsonb;
  ver     public.workspace_object_versions;
  answer  jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  if access is null then
    raise exception 'semester: no such object here' using errcode = '42501';
  end if;
  if access not in ('owner', 'edit') then
    raise exception 'semester: you can read this but not change it' using errcode = '42501';
  end if;
  problem := private.workspace_content_problem(want_title, want_body, want_mime, want_schema);
  if problem is not null then
    raise exception 'semester: %', problem using errcode = 'check_violation';
  end if;

  select * into o from public.workspace_objects x where x.id = want_object;
  hash := encode(sha256(convert_to(want_body, 'UTF8')), 'hex');
  req := jsonb_build_object('object', want_object, 'expected_revision', want_expected_revision,
                            'title_sha256', encode(sha256(convert_to(btrim(want_title), 'UTF8')), 'hex'),
                            'content_sha256', hash, 'mime', want_mime, 'schema', want_schema);
  prior := private.workspace_replay(o.workspace_id, want_key, 'save', req);
  if prior is not null then return prior; end if;

  select * into o from public.workspace_objects x where x.id = want_object for update;
  if want_expected_revision is distinct from o.revision then
    raise exception 'semester: this changed since you read it; reload it before saving'
      using errcode = '40001', detail = format('expected revision %s, it is at %s', want_expected_revision, o.revision);
  end if;

  insert into public.workspace_object_versions
    (workspace_id, object_id, version_number, title, body, mime_type, content_schema, byte_length, content_sha256, created_by)
  values (o.workspace_id, o.id, o.revision + 1, btrim(want_title), want_body, want_mime, want_schema,
          octet_length(want_body), hash, me)
  returning * into ver;

  update public.workspace_objects
     set current_version_id = ver.id, revision = o.revision + 1, title = btrim(want_title), updated_at = ver.created_at
   where id = o.id;

  answer := jsonb_build_object('object', o.id, 'version', ver.id, 'version_number', ver.version_number,
                               'revision', o.revision + 1, 'content_sha256', hash,
                               'byte_length', ver.byte_length, 'saved_at', ver.created_at);

  perform private.record_audit(null, 'workspace_object.version_saved', 'workspace_object', o.id::text, 'allowed', null,
                               jsonb_build_object('version_number', ver.version_number, 'as', access));
  perform private.workspace_spend(o.workspace_id, want_key, 'save', req, answer);
  return answer;
end $$;

create or replace function public.workspace_object_grant(
  want_object uuid, want_version uuid, want_grantee uuid, want_permission text,
  want_purpose text, want_expires_at timestamptz, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  access text := private.workspace_object_access(want_object, null);
  o      public.workspace_objects;
  req    jsonb;
  prior  jsonb;
  made   public.workspace_object_grants;
  answer jsonb;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  if access is null then
    raise exception 'semester: no such object here' using errcode = '42501';
  end if;
  -- Nobody grants more than they hold, and in this slice only an owner holds
  -- the right to share at all.
  if access <> 'owner' then
    raise exception 'semester: only the owner can share this' using errcode = '42501';
  end if;
  if want_permission is null or want_permission not in ('read', 'comment', 'edit') then
    raise exception 'semester: a grant is read, comment or edit' using errcode = 'check_violation';
  end if;
  if want_version is not null and want_permission = 'edit' then
    raise exception 'semester: a saved version cannot be edited, so it can only be shared to read or comment' using errcode = 'check_violation';
  end if;
  if want_grantee is null or not exists (select 1 from auth.users u where u.id = want_grantee) then
    raise exception 'semester: no such person' using errcode = 'check_violation';
  end if;
  if want_grantee = me then
    raise exception 'semester: you already have this' using errcode = 'check_violation';
  end if;
  if want_purpose is null or length(btrim(want_purpose)) not between 1 and 200 then
    raise exception 'semester: say in up to 200 characters what it is shared for' using errcode = 'check_violation';
  end if;
  if want_expires_at is not null and want_expires_at <= now() then
    raise exception 'semester: that expiry has already passed' using errcode = 'check_violation';
  end if;

  select * into o from public.workspace_objects x where x.id = want_object;
  if want_version is not null and not exists (
       select 1 from public.workspace_object_versions v where v.id = want_version and v.object_id = o.id) then
    raise exception 'semester: that is not a version of this object' using errcode = 'check_violation';
  end if;

  req := jsonb_build_object('object', want_object, 'version', want_version, 'grantee', want_grantee,
                            'permission', want_permission, 'purpose_sha256', encode(sha256(convert_to(btrim(want_purpose), 'UTF8')), 'hex'),
                            'expires_at', want_expires_at);
  prior := private.workspace_replay(o.workspace_id, want_key, 'grant', req);
  if prior is not null then return prior; end if;

  insert into public.workspace_object_grants
    (workspace_id, object_id, version_id, grantee, granted_by, permission, purpose, expires_at)
  values (o.workspace_id, o.id, want_version, want_grantee, me, want_permission, btrim(want_purpose), want_expires_at)
  returning * into made;

  answer := jsonb_build_object('grant', made.id, 'object', o.id, 'version', made.version_id,
                               'permission', made.permission, 'expires_at', made.expires_at, 'granted_at', made.created_at);

  perform private.record_audit(null, 'workspace_object.shared', 'workspace_object_grant', made.id::text, 'allowed', null,
                               jsonb_build_object('permission', made.permission, 'pinned', made.version_id is not null,
                                                  'expires', made.expires_at is not null));
  perform private.workspace_spend(o.workspace_id, want_key, 'grant', req, answer);
  return answer;
end $$;

-- Revoking twice answers the first revocation and writes nothing.
create or replace function public.workspace_object_revoke(want_grant uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  g  public.workspace_object_grants;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  select * into g from public.workspace_object_grants x where x.id = want_grant for update;
  if not found or private.workspace_object_access(g.object_id, null) is distinct from 'owner' then
    raise exception 'semester: no such grant here' using errcode = '42501';
  end if;
  if g.revoked_at is null then
    update public.workspace_object_grants set revoked_at = now(), revoked_by = me where id = g.id
    returning * into g;
    perform private.record_audit(null, 'workspace_object.share_revoked', 'workspace_object_grant', g.id::text, 'allowed');
  end if;
  return jsonb_build_object('grant', g.id, 'revoked_at', g.revoked_at);
end $$;

-- The caller's own objects, most recently saved first. Not what was shared
-- with them: that is what `workspace_object_grants` shows a grantee.
create or replace function public.workspace_objects_mine()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'object', o.id, 'kind', o.kind, 'title', o.title, 'revision', o.revision,
             'version', o.current_version_id, 'updated_at', o.updated_at)
           order by o.updated_at desc, o.id)
      from public.workspace_objects o
      join public.workspaces w on w.id = o.workspace_id
     where w.owner_id = me), '[]'::jsonb);
end $$;

-- One version's content: the current one when `want_version` is null. A
-- pinned grantee must name their version, and is told nothing about the
-- live object — not its revision, not its title as it is now.
create or replace function public.workspace_object_read(want_object uuid, want_version uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  access text;
  o      public.workspace_objects;
  v      public.workspace_object_versions;
  live   boolean;
begin
  if me is null then
    raise exception 'semester: sign in to keep work in Semester' using errcode = '42501';
  end if;
  access := private.workspace_object_access(want_object, want_version);
  if access is null then
    raise exception 'semester: no such object here' using errcode = '42501';
  end if;
  -- Whether the caller may see the live object, not only this version.
  live := private.workspace_object_access(want_object, null) is not null;
  select * into o from public.workspace_objects x where x.id = want_object;
  select * into v from public.workspace_object_versions x
   where x.object_id = want_object and x.id = coalesce(want_version, o.current_version_id);
  if access <> 'owner' then
    perform private.record_audit(null, 'workspace_object.read', 'workspace_object_version', v.id::text, 'allowed', null,
                                 jsonb_build_object('as', access));
  end if;
  return jsonb_build_object(
    'object', o.id, 'kind', o.kind, 'version', v.id, 'version_number', v.version_number,
    'title', v.title, 'body', v.body, 'mime_type', v.mime_type, 'content_schema', v.content_schema,
    'byte_length', v.byte_length, 'content_sha256', v.content_sha256, 'saved_at', v.created_at,
    'access', access,
    'revision', case when live then o.revision end,
    'current', case when live then v.id = o.current_version_id end);
end $$;

revoke all on function public.workspace_object_create(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.workspace_object_save(uuid, bigint, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.workspace_object_grant(uuid, uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.workspace_object_revoke(uuid) from public, anon, authenticated;
revoke all on function public.workspace_objects_mine() from public, anon, authenticated;
revoke all on function public.workspace_object_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.workspace_object_create(text, text, text, text, text, text) to authenticated;
grant execute on function public.workspace_object_save(uuid, bigint, text, text, text, text, text) to authenticated;
grant execute on function public.workspace_object_grant(uuid, uuid, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.workspace_object_revoke(uuid) to authenticated;
grant execute on function public.workspace_objects_mine() to authenticated;
grant execute on function public.workspace_object_read(uuid, uuid) to authenticated;

-- ── A workspace is something a person made ────────────────────────────────
-- `lti_account_untouched` decides whether an account may be linked away as
-- empty. A personal workspace exists only once its owner created something in
-- it, so an account holding one is not untouched. Unchanged from
-- 20261004181000 except for the last row.

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
      ('public.workspaces',           'owner_id')
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
--   -- First re-run lti_account_untouched from 20261004181000, which drops the
--   -- workspaces row.
--   drop function if exists public.workspace_object_read(uuid, uuid);
--   drop function if exists public.workspace_objects_mine();
--   drop function if exists public.workspace_object_revoke(uuid);
--   drop function if exists public.workspace_object_grant(uuid, uuid, uuid, text, text, timestamptz, text);
--   drop function if exists public.workspace_object_save(uuid, bigint, text, text, text, text, text);
--   drop function if exists public.workspace_object_create(text, text, text, text, text, text);
--   drop table if exists public.workspace_object_operations;
--   drop table if exists public.workspace_object_grants;
--   alter table public.workspace_objects drop constraint if exists workspace_objects_current_version_is_its_own;
--   drop table if exists public.workspace_object_versions;
--   drop table if exists public.workspace_objects;
--   drop table if exists public.workspaces;
--   drop function if exists private.workspace_spend(uuid, text, text, jsonb, jsonb);
--   drop function if exists private.workspace_replay(uuid, text, text, jsonb);
--   drop function if exists private.workspace_content_problem(text, text, text, text);
--   drop function if exists private.workspace_mine();
--   drop function if exists private.workspace_object_access(uuid, uuid);
--   drop function if exists private.workspace_object_grant_fixed();
--   drop function if exists private.workspace_object_version_fixed();
--   commit;
