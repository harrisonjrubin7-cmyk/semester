# Example: SCIM provisioner

> **Type:** reference · **Audience:** implementers, partner-developers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

An identity-provider-side SCIM 2.0 client for Semester's SCIM service, for people who push accounts from an identity system; stop reading if you want single sign-on, which is a different protocol.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The SCIM service is off unless `SEMESTER_SCIM=on` and has never run against a real identity provider ([`docs/FEATURE-TRUTH-TABLE.md`](../../docs/FEATURE-TRUTH-TABLE.md)). This client runs in the test against the real service on an in-memory repository.

## What is here

| File | Purpose |
| --- | --- |
| [`provisioner.ts`](provisioner.ts) | `createScimClient`: discovery, create, replace, patch, deactivate, get, list with a filter, and `sync` for one person. |

## What the service supports, as implemented

| Feature | Supported |
| --- | --- |
| Users: create, read, replace (`PUT`), patch, list | Yes |
| `DELETE` a user | Deactivates. The user is never removed |
| Filter | Only `userName eq "..."` or `externalId eq "..."` |
| Patch paths on a user | `active`, `userName`, `displayName`, `externalId` |
| Patch operations | `add`, `replace`, `remove` |
| Page size | `count` up to 200 (default 100), `startIndex` from 1 |
| Bulk, sort, ETag, change password | No (`ServiceProviderConfig` says so) |
| Groups | Served, but not used by this example. Group names map to roles only through mappings a school administrator approves |

Every mutation needs an `Idempotency-Key` header. The bearer credential is `<credential id>.<secret>`, issued by the school; the tenant comes from the credential and never from the request body.

## Run it and read it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "scim-provisioner"
```

Walk-through: [Provision users over SCIM](../../docs/guides/integrations/scim-provisioner.md). Operational rules: [`docs/SCIM-LIFECYCLE-MANAGEMENT.md`](../../docs/SCIM-LIFECYCLE-MANAGEMENT.md).
