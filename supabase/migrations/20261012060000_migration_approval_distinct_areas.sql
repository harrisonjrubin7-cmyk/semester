-- Phase 5 (stream 11, migration center): cutover needs two people.
--
-- The cutover gate asks for every required area to be approved, and refuses
-- the migration's creator. It did not refuse one approver covering two
-- areas: the approval policy needs only the `migration:approve` capability,
-- not a capability per area, so a registrar who also administers IT could
-- sign "data owner" and "IT" alone and the two-area gate read as satisfied
-- by one person. Two areas exist so that two people look at the evidence.
--
-- Rule: within the current stage window (since `stage_entered_at`, which a
-- changed rollback plan or cutover date also resets), an approver who has
-- already approved one area does not approve another. Re-deciding the same
-- area stays allowed (a rejection followed by an approval is how a fix is
-- recorded). Rejections are not limited: refusing to sign is always allowed.
--
-- Not applied to production; see docs/execute/35-phase-5-enable-and-replace-report.md.

create or replace function private.migration_approval_stamp()
returns trigger language plpgsql set search_path = '' as $$
declare
  p public.migration_projects;
begin
  select * into p from public.migration_projects where id = new.project_id;
  if p.id is null or p.stage <> 'cutover' then
    raise exception 'Approvals are recorded at cutover, on the evidence as it stands then.' using errcode = '23514';
  end if;
  if p.created_by = auth.uid() then
    raise exception 'The person who created a migration does not approve its cutover.' using errcode = '42501';
  end if;
  if new.decision = 'approved' and exists (
       select 1 from public.migration_approvals a
        where a.project_id = new.project_id
          and a.approver_id = auth.uid()
          and a.decision = 'approved'
          and a.area <> new.area
          and a.recorded_at >= p.stage_entered_at) then
    raise exception 'One person does not approve two areas of the same cutover; another approver is needed for %.', new.area
      using errcode = '42501';
  end if;
  new.recorded_at := clock_timestamp();
  new.approver_id := auth.uid();
  return new;
end $$;
revoke all on function private.migration_approval_stamp() from public, anon, authenticated;
