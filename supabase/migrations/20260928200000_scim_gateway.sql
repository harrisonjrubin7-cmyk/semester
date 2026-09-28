-- Semester — the four calls the SCIM endpoint needs, where the gateway can
-- reach them.
--
-- `20260924150142_institution_identity_provisioning.sql` built SCIM's data
-- layer: credentials stored as a salted hash, external identities, admin-
-- approved group mappings, an immutable audit, and two definer functions that
-- do every write. `app/server/institution/scim.ts` built the HTTP service over
-- it. Nothing joined them, because the functions live in `private` and
-- PostgREST publishes `public` only: a gateway holding the service key had no
-- route to call them, so the service had no production repository and no
-- mount. Launch-readiness Phase 2 audit, finding 4.
--
-- These are thin wrappers, nothing more. Every rule stays in the private
-- function it wraps — the credential must be active and belong to the tenant,
-- a request id is idempotent, a deactivation clears roles, a group that no
-- administrator has mapped changes nobody's roles. The wrappers add no
-- behaviour except the fourth: recording a *refused* request, which the
-- service does when it turns a call down and which had no writer at all.
--
-- ## Who may call them
--
-- `service_role` only. Revoked from PUBLIC first, then from `anon` and
-- `authenticated` by name, as `20260921002428_invites.sql` explains. A
-- signed-in account reaching any of these could provision a member of any
-- school, so `scim-gateway.check.sql` asserts every other role is refused.
--
-- ## Off until turned on
--
-- A wrapper existing mounts nothing. The endpoint answers only when the
-- gateway is started with `SEMESTER_SCIM=on`, and only to a bearer holding a
-- credential a tenant administrator issued. `docs/INSTITUTIONAL-SSO-LAUNCH-
-- READINESS.md` is the activation order.

-- A known credential comes back whether or not it is live, with `active`
-- saying which. The gateway refuses an inactive one exactly as it refuses a
-- stranger; what it gains is the tenant, so a revoked or expired secret still
-- in an IdP's configuration leaves a refusal in provisioning_audit_event
-- rather than nothing. Which credentials are live is still the private
-- function's rule: `active` is true only for a row it returned.
drop function if exists public.scim_gateway_credential(uuid);
create function public.scim_gateway_credential(want_id uuid)
returns table (credential_id uuid, tenant_id text, secret_salt bytea, secret_hash bytea, active boolean)
language sql stable security definer set search_path = '' as $$
  select m.credential_id, m.tenant_id, m.secret_salt, m.secret_hash, true
    from private.scim_credential_material(want_id) m
  union all
  select c.id, c.tenant_id, c.secret_salt, c.secret_hash, false
    from public.scim_credential c
   where c.id = want_id
     and not exists (select 1 from private.scim_credential_material(want_id));
$$;

create or replace function public.scim_gateway_provision_user(
  want_tenant text,
  want_credential uuid,
  want_request_id text,
  want_external_id text,
  want_user_name text,
  want_display_name text,
  want_active boolean
) returns uuid language sql volatile security definer set search_path = '' as $$
  select private.provision_scim_user(
    want_tenant, want_credential, want_request_id, want_external_id,
    want_user_name, want_display_name, want_active
  );
$$;

create or replace function public.scim_gateway_replace_group(
  want_tenant text,
  want_credential uuid,
  want_request_id text,
  want_external_group_id text,
  want_display_name text,
  want_member_external_ids text[]
) returns bigint language sql volatile security definer set search_path = '' as $$
  select private.replace_scim_group_members(
    want_tenant, want_credential, want_request_id, want_external_group_id,
    want_display_name, want_member_external_ids
  );
$$;

/*
 * A request the service refused, recorded once.
 *
 * The same request id may already hold an *accepted* event — the service
 * audits after the write, and a failure after that point still reaches its
 * catch — or a refused one from a retry. Either way the first record stands:
 * the audit table is immutable, and a second row for one request id would be
 * two accounts of one event. So a conflict is ignored, and the caller is told
 * whether this call wrote anything.
 *
 * The credential must still belong to the tenant it names. A refusal is
 * written by the gateway on behalf of a credential it has already verified,
 * and this is where that is checked rather than trusted.
 */
create or replace function public.scim_gateway_record_refusal(
  want_tenant text,
  want_credential uuid,
  want_request_id text,
  want_resource_type text,
  want_status integer,
  want_reason text
) returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare wrote integer;
begin
  if want_resource_type not in ('User', 'Group') then
    raise exception 'Only User and Group refusals are recorded.';
  end if;
  if length(trim(coalesce(want_request_id, ''))) not between 1 and 300 then
    raise exception 'A refusal needs a bounded request id.';
  end if;
  if not exists (
    select 1 from public.scim_credential c where c.id = want_credential and c.tenant_id = want_tenant
  ) then
    raise exception 'That credential does not belong to that tenant.';
  end if;
  insert into public.provisioning_audit_event
    (tenant_id, credential_id, request_id, resource_type, action, outcome, metadata)
  values (
    want_tenant, want_credential, want_request_id, want_resource_type, 'refused', 'refused',
    jsonb_build_object('status', want_status, 'reason', left(coalesce(want_reason, ''), 300))
  )
  on conflict (tenant_id, request_id) do nothing;
  get diagnostics wrote = row_count;
  return wrote = 1;
end $$;

revoke all on function public.scim_gateway_credential(uuid) from public, anon, authenticated;
revoke all on function public.scim_gateway_provision_user(text, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.scim_gateway_replace_group(text, uuid, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.scim_gateway_record_refusal(text, uuid, text, text, integer, text) from public, anon, authenticated;

grant execute on function public.scim_gateway_credential(uuid) to service_role;
grant execute on function public.scim_gateway_provision_user(text, uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.scim_gateway_replace_group(text, uuid, text, text, text, text[]) to service_role;
grant execute on function public.scim_gateway_record_refusal(text, uuid, text, text, integer, text) to service_role;
