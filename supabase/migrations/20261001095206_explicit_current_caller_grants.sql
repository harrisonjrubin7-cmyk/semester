-- Approved 2026-10-01 for the no-data PR #1028 preview.
-- Publish/apply only through the branch integration; no competing direct apply.
-- Target: PR #1028 no-data preview ibprwifagxqvowpanvel only.
-- Current-caller repair; RLS, triggers, ownership and existing column pins stay.
-- No production, defaults, function/sequence grants, or schema-only contracts.

grant select, delete on public.enrollments to authenticated;
grant insert (user_id, term, code), update (user_id, term, code) on public.enrollments to authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (user_id, blocked), update (user_id, blocked) on public.blocks to authenticated;
grant select, delete on public.messages to authenticated;
grant insert (user_id, term, code, body) on public.messages to authenticated;
grant select, delete on public.message_reactions to authenticated;
grant insert (message_id, user_id, emoji, term, code) on public.message_reactions to authenticated;
grant select on public.groups to authenticated;
grant insert (term, code, name, created_by), update (name, about, due) on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant insert (group_id, user_id) on public.group_members to authenticated;
grant select, delete on public.group_tasks to authenticated;
grant insert (group_id, title, created_by), update (title, owner, done, due) on public.group_tasks to authenticated;
grant select, delete on public.courses to authenticated;
grant insert (user_id, id, data), update (data) on public.courses to authenticated;
grant select on public.state to authenticated;
grant insert (user_id, data), update (data) on public.state to authenticated;
grant select, delete on public.push_devices to authenticated;
grant insert (endpoint, user_id, p256dh, auth, gone_at), update (endpoint, user_id, p256dh, auth, gone_at) on public.push_devices to authenticated;
grant select, delete on public.push_queue to authenticated;
grant insert (user_id, id, send_at, title, body, screen, item) on public.push_queue to authenticated;
grant select, update (revoked_at) on public.family_grants to authenticated;
grant select on public.organizations, public.organization_members to authenticated;
grant select on public.reports to authenticated;
grant insert (reporter, message_id, about, reason, copy) on public.reports to authenticated;
grant select on public.schools to authenticated, anon;

-- Actual service-key readers/worker; no speculative backoffice CRUD.
grant select (id, tenant_id, provider_identifier, status, domains),
      update (attribute_mapping) on public.institution_identity_provider to service_role;
grant select (auth_user_id, tenant_id, identity_provider_id, status, roles)
      on public.institution_membership to service_role;
grant select, insert, update on public.integration_sync_runs to service_role;

