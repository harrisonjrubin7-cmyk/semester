-- Semester — the procurement room (GTM plan §3.3, §5.2 step 4).
--
-- The trust packet's NDA tier (docs/SECURITY-ACCESSIBILITY-READINESS.md, #829)
-- is handed to a named institution's reviewers by the process that document
-- sets out. This migration makes each step of that process something the
-- database holds rather than something someone remembers:
--
--   1. A named person at the institution asks, in their role
--      → `trust_room_requests`, on the account in `gtm_accounts`.
--   2. The NDA is signed first
--      → an NDA-tier item cannot be granted to a request with no NDA on file.
--   3. The packet is generated from a named commit, so it can be reproduced
--      → every grant carries a 40-hex commit, and pins the exact artifact
--        versions it covers. Versions are append-only; a newer one published
--        later does not change what an existing grant opens.
--   4. It is shared by an expiring link, and who received it is recorded
--      → a grant expires within thirty days; the link's token is stored only
--        as its SHA-256, shown once when it is minted; every open is logged.
--   5. Nothing is edited for the audience
--      → a version cannot be updated, and a grant cannot be edited, only
--        revoked.
--
-- Also (§16.1): every artifact has an owner, and every version a version
-- string, a publish date and a review date. A version past its review date
-- cannot be put into a new grant.
--
-- The reviewer has no Semester account, and no function in `public` may be
-- callable by a signed-out visitor (grants.check.sql). So the link is opened
-- by a server function holding the service key, which calls
-- `trust_room_open` — executable by `service_role` alone. That server
-- function, and the private storage bucket the `storage_ref` paths point
-- into, are the next slice; until they exist nothing can be opened, which is
-- the safe way round. Engaging the global `kill.sharing` switch stops every
-- grant and every open at once.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Role and capability ────────────────────────────────────────────────

insert into public.app_roles (role, global) values ('trust_officer', true)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('trust:publish', 'Register a trust-packet artifact and publish a new version of it. Versions are append-only; granting access to them is account:manage.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values ('trust_officer', 'trust:publish')
on conflict (role, capability) do nothing;

-- ── 2. The packet ─────────────────────────────────────────────────────────

create table if not exists public.trust_artifacts (
  key         text        primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key) <= 60),
  title       text        not null check (length(trim(title)) between 1 and 200),
  tier        text        not null check (tier in ('public', 'nda')),
  owner       text        not null check (length(trim(owner)) between 1 and 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.trust_artifact_versions (
  id             uuid        primary key default gen_random_uuid(),
  artifact_key   text        not null references public.trust_artifacts(key) on delete restrict,
  version        text        not null check (version ~ '^[0-9A-Za-z][0-9A-Za-z.+-]{0,39}$'),
  -- A path in the private trust-packet bucket, never the content and never a URL.
  storage_ref    text        not null check (storage_ref ~ '^trust-packet/[a-z0-9-]+/[A-Za-z0-9._+-]{1,120}$'),
  source_commit  text        check (source_commit ~ '^[0-9a-f]{40}$'),
  published_on   date        not null default current_date,
  review_on      date        not null,
  published_by   uuid        default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default clock_timestamp(),
  unique (artifact_key, version),
  constraint trust_version_reviewed_later check (review_on > published_on)
);
create index if not exists trust_versions_current on public.trust_artifact_versions (artifact_key, created_at desc);
create index if not exists trust_versions_by_publisher on public.trust_artifact_versions (published_by);

drop trigger if exists trust_versions_append_only on public.trust_artifact_versions;
create trigger trust_versions_append_only before update on public.trust_artifact_versions
  for each row execute function private.gtm_append_only('published_by');

-- ── 3. Requests, grants, what each grant covers, and every open ───────────

create table if not exists public.trust_room_requests (
  id               uuid        primary key default gen_random_uuid(),
  account_id       uuid        not null references public.gtm_accounts(id) on delete cascade,
  stakeholder_id   uuid        references public.gtm_stakeholders(id) on delete set null,
  requester_name   text        not null check (length(trim(requester_name)) between 1 and 200),
  requester_email  text        not null check (requester_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(requester_email) <= 320),
  requester_role   text        not null check (requester_role in (
                     'executive_sponsor', 'operational_owner', 'cio', 'ciso_privacy', 'accessibility',
                     'registrar_data_governance', 'procurement', 'legal', 'finance', 'champion')),
  reason           text        not null default '' check (length(reason) <= 2000),
  -- A pointer to the signed NDA in the company's document store, never the document.
  nda_signed_on    date,
  nda_reference    text        check (nda_reference ~ '^nda/[A-Za-z0-9._/-]{1,200}$'),
  status           text        not null default 'requested' check (status in ('requested', 'granted', 'declined', 'closed')),
  requested_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint trust_request_nda_whole check ((nda_signed_on is null) = (nda_reference is null))
);
create index if not exists trust_requests_by_account on public.trust_room_requests (account_id, status);
create index if not exists trust_requests_by_stakeholder on public.trust_room_requests (stakeholder_id);

create table if not exists public.trust_room_grants (
  id             uuid        primary key default gen_random_uuid(),
  request_id     uuid        not null references public.trust_room_requests(id) on delete cascade,
  token_sha256   text        not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  packet_commit  text        not null check (packet_commit ~ '^[0-9a-f]{40}$'),
  granted_by     uuid        references auth.users(id) on delete set null,
  granted_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  revoked_by     uuid        references auth.users(id) on delete set null,
  revoke_reason  text        check (length(trim(revoke_reason)) between 1 and 500),
  constraint trust_grant_expires check (expires_at > granted_at and expires_at <= granted_at + interval '30 days'),
  constraint trust_grant_revocation_whole check ((revoked_at is null) = (revoke_reason is null))
);
create index if not exists trust_grants_by_request on public.trust_room_grants (request_id);
create index if not exists trust_grants_by_granter on public.trust_room_grants (granted_by);
create index if not exists trust_grants_by_revoker on public.trust_room_grants (revoked_by);

create table if not exists public.trust_room_grant_items (
  grant_id    uuid not null references public.trust_room_grants(id) on delete cascade,
  version_id  uuid not null references public.trust_artifact_versions(id) on delete restrict,
  primary key (grant_id, version_id)
);
create index if not exists trust_grant_items_by_version on public.trust_room_grant_items (version_id);

create table if not exists public.trust_room_access_log (
  id           uuid        primary key default gen_random_uuid(),
  grant_id     uuid        not null references public.trust_room_grants(id) on delete cascade,
  -- Null when the reviewer opened the list of what the grant covers.
  version_id   uuid        references public.trust_artifact_versions(id) on delete restrict,
  accessed_at  timestamptz not null default clock_timestamp()
);
create index if not exists trust_access_by_grant on public.trust_room_access_log (grant_id, accessed_at desc);
create index if not exists trust_access_by_version on public.trust_room_access_log (version_id);

drop trigger if exists trust_access_append_only on public.trust_room_access_log;
create trigger trust_access_append_only before update on public.trust_room_access_log
  for each row execute function private.gtm_append_only();

-- A grant is never edited: it is revoked, once, through trust_room_revoke.
create or replace function private.trust_grant_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Account deletion clearing who granted or revoked it is not an edit.
  if to_jsonb(new) <> to_jsonb(old)
     and private.gtm_only_cleared(to_jsonb(old), to_jsonb(new), array['granted_by', 'revoked_by']) then
    return new;
  end if;
  if old.revoked_at is not null
     or (to_jsonb(new) - array['revoked_at', 'revoked_by', 'revoke_reason'])
        is distinct from (to_jsonb(old) - array['revoked_at', 'revoked_by', 'revoke_reason']) then
    raise exception 'A grant is not edited; revoke it and mint another' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trust_grant_guard on public.trust_room_grants;
create trigger trust_grant_guard before update on public.trust_room_grants
  for each row execute function private.trust_grant_guard();

-- Status `granted` is set by trust_room_grant alone.
create or replace function private.trust_request_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status <> 'requested' then
    raise exception 'A request is created as requested' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.status = 'granted' and old.status <> 'granted'
     and not exists (select 1 from public.trust_room_grants g where g.request_id = new.id) then
    raise exception 'A request is granted by minting a grant' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trust_request_guard on public.trust_room_requests;
create trigger trust_request_guard before insert or update on public.trust_room_requests
  for each row execute function private.trust_request_guard();

-- ── 4. Minting, revoking and opening ──────────────────────────────────────

-- SHA-256 of a token, through the helper 20260924213000_role_grant_audit.sql
-- already resolves across pgcrypto's two install schemas.
create or replace function private.trust_token_hash(token text)
returns text language sql immutable set search_path = '' as $$
  select private.role_audit_sha256(token);
$$;
revoke all on function private.trust_token_hash(text) from public, anon, authenticated;

-- Mint a grant. Returns the link token, the only time it exists outside the
-- caller's hands; the database keeps its hash.
create or replace function public.trust_room_grant(
  want_request uuid, want_artifacts text[], want_packet_commit text, want_days integer)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.trust_room_requests;
  k text;
  v public.trust_artifact_versions;
  a public.trust_artifacts;
  token text;
  new_grant uuid;
begin
  if not private.has_capability('account:manage', 'platform', '') then
    raise exception 'Only Semester''s account team grants procurement-room access' using errcode = '42501';
  end if;
  if public.kill_switch_engaged('kill.sharing', null) then
    raise exception 'kill.sharing is engaged; nothing is shared' using errcode = '42501';
  end if;
  select * into r from public.trust_room_requests where id = want_request for update;
  if not found then raise exception 'No such request' using errcode = '42501'; end if;
  if r.status <> 'requested' then
    raise exception 'This request is %; a grant answers an open request', r.status using errcode = '42501';
  end if;
  if want_days is null or want_days < 1 or want_days > 30 then
    raise exception 'A grant lasts one to thirty days' using errcode = '22023';
  end if;
  if want_packet_commit is null or want_packet_commit !~ '^[0-9a-f]{40}$' then
    raise exception 'A grant names the full commit the packet was generated from' using errcode = '22023';
  end if;
  if want_artifacts is null or cardinality(want_artifacts) = 0 then
    raise exception 'A grant covers at least one artifact' using errcode = '22023';
  end if;

  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.trust_room_grants (request_id, token_sha256, packet_commit, granted_by, expires_at)
  values (r.id, private.trust_token_hash(token), want_packet_commit, auth.uid(), now() + make_interval(days => want_days))
  returning id into new_grant;

  foreach k in array want_artifacts loop
    select * into a from public.trust_artifacts where key = k;
    if not found then raise exception 'No artifact %', k using errcode = '22023'; end if;
    if a.tier = 'nda' and r.nda_signed_on is null then
      raise exception '% is NDA-tier and this request has no signed NDA on file', k using errcode = '42501';
    end if;
    select * into v from public.trust_artifact_versions
     where artifact_key = k order by created_at desc, id desc limit 1;
    if not found then raise exception '% has no published version', k using errcode = '22023'; end if;
    if v.review_on < current_date then
      raise exception '% version % was due for review on %; publish a reviewed version first', k, v.version, v.review_on
        using errcode = '42501';
    end if;
    insert into public.trust_room_grant_items (grant_id, version_id) values (new_grant, v.id)
    on conflict do nothing;
  end loop;

  update public.trust_room_requests set status = 'granted' where id = r.id;
  return token;
end $$;
revoke all on function public.trust_room_grant(uuid, text[], text, integer) from public, anon;
grant execute on function public.trust_room_grant(uuid, text[], text, integer) to authenticated;

create or replace function public.trust_room_revoke(want_grant uuid, want_reason text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.has_capability('account:manage', 'platform', '') then
    raise exception 'Only Semester''s account team revokes procurement-room access' using errcode = '42501';
  end if;
  update public.trust_room_grants
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = want_reason
   where id = want_grant and revoked_at is null;
  if not found then raise exception 'No live grant %', want_grant using errcode = '42501'; end if;
end $$;
revoke all on function public.trust_room_revoke(uuid, text) from public, anon;
grant execute on function public.trust_room_revoke(uuid, text) to authenticated;

-- What a link opens. Called by the server function with the service key, never
-- by a browser. A refusal returns no rows and says nothing about why, so a
-- wrong token, an expired one and a revoked one look the same from outside.
-- With `want_artifact` null it lists what the grant covers.
create or replace function public.trust_room_open(want_token text, want_artifact text)
returns table (artifact_key text, title text, version text, storage_ref text, source_commit text,
               packet_commit text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare g public.trust_room_grants;
begin
  if want_token is null or want_token !~ '^[0-9a-f]{64}$' then return; end if;
  if public.kill_switch_engaged('kill.sharing', null) then return; end if;
  select * into g from public.trust_room_grants t
   where t.token_sha256 = private.trust_token_hash(want_token)
     and t.revoked_at is null and t.expires_at > now();
  if not found then return; end if;

  if want_artifact is null then
    insert into public.trust_room_access_log (grant_id, version_id) values (g.id, null);
  else
    insert into public.trust_room_access_log (grant_id, version_id)
    select g.id, v.id
      from public.trust_room_grant_items i
      join public.trust_artifact_versions v on v.id = i.version_id
     where i.grant_id = g.id and v.artifact_key = want_artifact;
    if not found then return; end if;
  end if;

  return query
    select v.artifact_key, a.title, v.version, v.storage_ref, v.source_commit, g.packet_commit, g.expires_at
      from public.trust_room_grant_items i
      join public.trust_artifact_versions v on v.id = i.version_id
      join public.trust_artifacts a on a.key = v.artifact_key
     where i.grant_id = g.id and (want_artifact is null or v.artifact_key = want_artifact)
     order by v.artifact_key;
end $$;
revoke all on function public.trust_room_open(text, text) from public, anon, authenticated;
grant execute on function public.trust_room_open(text, text) to service_role;

-- ── 5. Row-level security ─────────────────────────────────────────────────

alter table public.trust_artifacts          enable row level security;
alter table public.trust_artifact_versions  enable row level security;
alter table public.trust_room_requests      enable row level security;
alter table public.trust_room_grants        enable row level security;
alter table public.trust_room_grant_items   enable row level security;
alter table public.trust_room_access_log    enable row level security;

revoke all on table public.trust_artifacts, public.trust_artifact_versions, public.trust_room_requests,
                    public.trust_room_grants, public.trust_room_grant_items, public.trust_room_access_log
  from anon, authenticated;

grant select, insert, update on table public.trust_artifacts to authenticated;
grant select, insert on table public.trust_artifact_versions to authenticated;
grant select, insert, update on table public.trust_room_requests to authenticated;
-- The token hash is off the column grant: a hash of a long random token is not
-- a secret in itself, but nobody reading the room needs it.
grant select (id, request_id, packet_commit, granted_by, granted_at, expires_at, revoked_at, revoked_by, revoke_reason)
  on table public.trust_room_grants to authenticated;
grant select on table public.trust_room_grant_items, public.trust_room_access_log to authenticated;

create or replace function private.trust_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('account:manage', 'platform', '')
      or private.has_capability('trust:publish', 'platform', '');
$$;
revoke all on function private.trust_staff() from public, anon;
grant execute on function private.trust_staff() to authenticated;

-- A grant's account, for the school-side read of its own room.
create or replace function private.trust_grant_account(want_grant uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select r.account_id from public.trust_room_grants g
    join public.trust_room_requests r on r.id = g.request_id
   where g.id = want_grant;
$$;
revoke all on function private.trust_grant_account(uuid) from public, anon;
grant execute on function private.trust_grant_account(uuid) to authenticated;

drop policy if exists "trust staff read the packet" on public.trust_artifacts;
create policy "trust staff read the packet" on public.trust_artifacts
  for select to authenticated using (private.trust_staff());
drop policy if exists "trust officers register artifacts" on public.trust_artifacts;
create policy "trust officers register artifacts" on public.trust_artifacts
  for insert to authenticated with check (private.has_capability('trust:publish', 'platform', ''));
drop policy if exists "trust officers change artifacts" on public.trust_artifacts;
create policy "trust officers change artifacts" on public.trust_artifacts
  for update to authenticated
  using (private.has_capability('trust:publish', 'platform', ''))
  with check (private.has_capability('trust:publish', 'platform', ''));

drop policy if exists "trust staff read versions" on public.trust_artifact_versions;
create policy "trust staff read versions" on public.trust_artifact_versions
  for select to authenticated using (private.trust_staff());
drop policy if exists "trust officers publish versions" on public.trust_artifact_versions;
create policy "trust officers publish versions" on public.trust_artifact_versions
  for insert to authenticated
  with check (private.has_capability('trust:publish', 'platform', '') and published_by = (select auth.uid()));

-- Requests: the account team writes; the institution's own configurers read
-- their room (gtm_account_visible), which is how a school sees who asked.
drop policy if exists "the account's readers read its requests" on public.trust_room_requests;
create policy "the account's readers read its requests" on public.trust_room_requests
  for select to authenticated using (private.gtm_account_visible(account_id));
drop policy if exists "the account team logs requests" on public.trust_room_requests;
create policy "the account team logs requests" on public.trust_room_requests
  for insert to authenticated with check (private.has_capability('account:manage', 'platform', ''));
drop policy if exists "the account team changes requests" on public.trust_room_requests;
create policy "the account team changes requests" on public.trust_room_requests
  for update to authenticated
  using (private.has_capability('account:manage', 'platform', ''))
  with check (private.has_capability('account:manage', 'platform', ''));

drop policy if exists "the account's readers read its grants" on public.trust_room_grants;
create policy "the account's readers read its grants" on public.trust_room_grants
  for select to authenticated using (private.gtm_account_visible(private.trust_grant_account(id)));
drop policy if exists "the account's readers read what each grant covers" on public.trust_room_grant_items;
create policy "the account's readers read what each grant covers" on public.trust_room_grant_items
  for select to authenticated using (private.gtm_account_visible(private.trust_grant_account(grant_id)));
drop policy if exists "the account's readers read every open" on public.trust_room_access_log;
create policy "the account's readers read every open" on public.trust_room_access_log
  for select to authenticated using (private.gtm_account_visible(private.trust_grant_account(grant_id)));

-- ── 6. The private bucket the file server signs into ───────────────────────
--
-- `trust-packet` holds the documents `trust_artifact_versions.storage_ref`
-- points at. It is private: no storage policy grants anon or authenticated
-- anything on it, so the only way to a file is a one-minute URL signed by the
-- file server (supabase/functions/_shared/trustroom.ts) after
-- `trust_room_open` has said yes. If a bucket of that name already exists and
-- is public, it is made private rather than trusted.
--
-- Plain Postgres (supabase/check.sh, rehearse.sh) has no `storage` schema, so
-- the call below is skipped there; trust-room.check.sql builds a stand-in
-- `storage.buckets` and runs this same function against it.
create or replace function private.trust_packet_bucket_ensure()
returns void language plpgsql set search_path = '' as $$
begin
  execute $b$
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('trust-packet', 'trust-packet', false, 26214400,
            array['application/pdf', 'text/markdown', 'text/csv', 'text/plain'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
  $b$;
end $$;
revoke all on function private.trust_packet_bucket_ensure() from public, anon, authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    perform private.trust_packet_bucket_ensure();
  end if;
end $$;

-- ── 7. Descriptions ───────────────────────────────────────────────────────

comment on table public.trust_artifacts is
  'A trust-packet item (docs/SECURITY-ACCESSIBILITY-READINESS.md), its tier and its owner.';
comment on table public.trust_artifact_versions is
  'One published version of an artifact: version, publish and review dates, source commit, and a path in the private bucket. Append-only.';
comment on table public.trust_room_requests is
  'A named reviewer at an institution asking for the packet, in their role, and the NDA on file.';
comment on table public.trust_room_grants is
  'An expiring, revocable link to exact artifact versions, generated from a named commit. The token is stored only as its hash.';
comment on table public.trust_room_access_log is
  'Every open of a procurement-room link: which grant, which version, when.';
