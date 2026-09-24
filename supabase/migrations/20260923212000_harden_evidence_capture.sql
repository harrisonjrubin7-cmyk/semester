-- Close the remaining authority and withdrawal gaps in evidence storage.

drop policy if exists "people own evidence references" on public.evidence_reference;

create policy "people read their evidence references" on public.evidence_reference
  for select to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id));
create policy "people add only personal evidence references" on public.evidence_reference
  for insert to authenticated
  with check (
    private.owns_evidence_scope(tenant_id, person_id)
    and created_by = (select auth.uid())
    and origin = 'student'
    and authority in ('confirmed', 'unverified')
  );
create policy "people update only personal evidence references" on public.evidence_reference
  for update to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id) and origin = 'student' and authority in ('confirmed', 'unverified'))
  with check (private.owns_evidence_scope(tenant_id, person_id) and origin = 'student' and authority in ('confirmed', 'unverified'));
create policy "people delete their evidence references" on public.evidence_reference
  for delete to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id));
create policy "source approvers manage authoritative evidence" on public.evidence_reference
  for all to authenticated
  using (private.has_capability('source:approve', 'school', tenant_id))
  with check (
    private.has_capability('source:approve', 'school', tenant_id)
    and origin in ('course', 'institution')
    and authority = 'authoritative'
  );

drop policy if exists "people own capture assets" on public.capture_asset;
create policy "people read active consented capture assets" on public.capture_asset
  for select to authenticated
  using (
    private.owns_evidence_scope(tenant_id, person_id)
    and state = 'active'
    and (retained_until is null or retained_until > now())
    and exists (
      select 1 from public.consent_record c
       where c.id = capture_asset.consent_id
         and c.tenant_id = capture_asset.tenant_id
         and c.subject_user_id = capture_asset.person_id
         and c.status = 'consented' and c.revoked_at is null
         and (c.expires_at is null or c.expires_at > now())
    )
  );
create policy "people add consented capture assets" on public.capture_asset
  for insert to authenticated
  with check (
    person_id = (select auth.uid())
    and tenant_id = (select p.school_id from public.profiles p where p.user_id = (select auth.uid()))
    and state = 'active'
  );
create policy "people remove their capture assets" on public.capture_asset
  for delete to authenticated
  using (private.owns_evidence_scope(tenant_id, person_id));

create or replace function private.expire_capture_assets()
returns bigint language plpgsql security definer set search_path = '' as $$
declare changed bigint;
begin
  update public.capture_asset a
     set state = 'removed'
   where a.state = 'active'
     and (
       (a.retained_until is not null and a.retained_until <= now())
       or not exists (
         select 1 from public.consent_record c
          where c.id = a.consent_id and c.tenant_id = a.tenant_id
            and c.subject_user_id = a.person_id and c.status = 'consented'
            and c.revoked_at is null and (c.expires_at is null or c.expires_at > now())
       )
     );
  get diagnostics changed = row_count;
  update public.capture_segment s set state = 'withdrawn'
   where s.state = 'active' and exists (
     select 1 from public.capture_asset a where a.id = s.capture_id and a.state = 'removed'
   );
  update public.capture_artifact d set state = 'withdrawn'
   where d.state <> 'withdrawn' and exists (
     select 1 from public.capture_asset a where a.id = d.capture_id and a.state = 'removed'
   );
  return changed;
end $$;
revoke all on function private.expire_capture_assets() from public, anon, authenticated;
grant execute on function private.expire_capture_assets() to service_role;

comment on function private.expire_capture_assets() is
  'Run by the deployment retention worker; makes expired originals and derivatives inaccessible. Storage objects named by storage_key require the same worker to purge the object after this transaction.';
