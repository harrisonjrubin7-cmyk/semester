-- A published trust artifact cannot be moved from the NDA tier to the public one.
--
-- F-1 in docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md: `trust_artifacts` was
-- updatable by any `trust:publish` holder, `tier` included. `trust_room_grant`
-- refuses an NDA-tier artifact to a request with no signed NDA on file, but it
-- reads the tier as it stands at that moment. So one trust officer, alone and
-- with no record, could flip an NDA artifact to `public` and have the account
-- team grant it to a request that never signed — the NDA gate bypassed by an
-- UPDATE.
--
--   no version published yet     tier is still being settled: anything goes
--   a version exists             nda -> public is refused from the client roles
--   any state                    public -> nda, a new title, a new owner: as before
--
-- Raising to NDA is the safe way to be wrong, and a mistake the other way is
-- corrected by server code holding the service key, as for every other table.
-- This is a guard, not an approval duty: publishing stays one person's job
-- (`trust:publish`), it is only the loosening of an already-published
-- artifact's audience that is closed.
--
-- It binds the client roles only (`authenticated`, `anon`); an owner-run
-- statement passes. Idempotent. No begin/commit — the runner opens the
-- transaction.

create or replace function private.guard_trust_artifact_tier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.tier = 'nda' and new.tier = 'public'
     and exists (select 1 from public.trust_artifact_versions v where v.artifact_key = old.key) then
    raise exception 'A published NDA artifact cannot be made public.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.guard_trust_artifact_tier() from public, anon, authenticated;
drop trigger if exists trust_artifacts_tier_guard on public.trust_artifacts;
create trigger trust_artifacts_tier_guard
  before update on public.trust_artifacts
  for each row execute function private.guard_trust_artifact_tier();
