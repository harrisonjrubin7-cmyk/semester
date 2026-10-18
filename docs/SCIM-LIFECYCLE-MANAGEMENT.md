# SCIM lifecycle management

Status: **BUILT.** Service: `app/server/institution/scim.ts`. Contracts:
`packages/institution/src/provisioning.ts`. Storage and invariants:
`supabase/migrations/20260924150142_institution_identity_provisioning.sql`.
Checks: `supabase/identity-provisioning.check.sql`, `scim.test.ts`.

## Endpoints

| Method and path | Behaviour |
| --- | --- |
| `GET /ServiceProviderConfig`, `/Schemas`, `/ResourceTypes` | Discovery. Patch yes, bulk no, filter yes (max 200) |
| `GET /Users?filter=userName eq "…"` | Only `eq` on `userName` or `externalId` |
| `POST /Users`, `PUT /Users/{id}`, `PATCH /Users/{id}` | Create or update. `Idempotency-Key` header required |
| `DELETE /Users/{id}` | **Deactivates.** Never hard-deletes |
| `POST/PUT/PATCH/DELETE /Groups…` | Group membership. Roles derive from approved mappings |

## Rules the service enforces

- **Tenant comes from the credential, never the body.** The bearer token is
  `<credential id>.<secret>`. Only a salted hash is stored and it is compared
  in constant time.
- **Every mutation is idempotent** by `(tenant_id, request_id)`, and every
  mutation, accepted or refused, writes an **immutable**
  `provisioning_audit_event`.
- **Unknown groups grant nothing.** `replace_scim_group_members` records
  `unknown_group` and changes no roles.
- **Roles are recomputed** from current group membership × active mappings, so
  removing someone from a group removes the role.
- **Deactivation** sets the membership `deprovisioned`, clears its roles and
  stamps `deprovisioned_at`. The constraint `institution_membership_deprovisioned_state`
  makes a deprovisioned row with roles impossible.
- **Reactivation** is explicit and does not restore old roles. Group
  membership must grant them again.

## Group mapping is a candidate, not a grant

`semester-students → student` in `scim_group_mapping` puts `student` in
`institution_membership.roles`. What `student` may do is still decided by
`private.has_capability` and row-level security. A mapping to `admin` is written
by a tenant administrator (`tenant:configure`) and carries `approved_by`.

## Deprovisioning and student work

Deprovisioning removes institutional access. It does not delete the account or
anything the student wrote. Personal data follows the account's own retention
([RETENTION.md](../RETENTION.md)). The SCIM external identity is kept so a
replayed or reactivating request resolves to the same person.

**Gaps.** There is no offboarding notification or export prompt when a
membership is deprovisioned. There is no admin health view of SCIM traffic;
auditors read `provisioning_audit_event` directly (policy: `audit:read`).
