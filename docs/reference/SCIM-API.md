# SCIM provisioning API

> **Type:** reference · **Audience:** partner-developers, institution-admins · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/gateway-reference.test.ts`

This page describes the SCIM 2.0 endpoints the gateway implements, what they accept, and what they do not implement. Stop reading if you are not connecting an identity provider to Semester.

**Status:** IMPLEMENTED_NOT_RELEASED. The [feature truth table](../FEATURE-TRUTH-TABLE.md) lists SCIM 2.0 with the gap "never run against a real IdP". The endpoints are off unless `SEMESTER_SCIM=on` on the Vercel runtime. `start.ts` does not mount SCIM. No SCIM credential can be created through the gateway. Treat everything here as the description of tested code, not of a service an institution can use today. The service design is in [`SCIM-LIFECYCLE-MANAGEMENT.md`](../SCIM-LIFECYCLE-MANAGEMENT.md); the comparison with other protocols is in [`SAML-OIDC-SCIM-COMPARISON.md`](../SAML-OIDC-SCIM-COMPARISON.md).

Related: [all routes](API-GATEWAY.md#routes), [error codes](ERRORS.md#scim-error-details), [OpenAPI file](openapi/institution-gateway.openapi.yaml).

## How the examples on this page were made

SCIM runs against Postgres in production (`postgres-scim.ts`). The examples were made by calling the real `createScimService` handler from `app/server/institution/scim.ts` with an in-memory repository written in the test file, so they show the service's routing, validation, status codes and response shapes, and not the Postgres repository's behaviour. The two refusals that belong to the repository, not the service (changing an `externalId`, and a group with no mapping), are written into the in-memory repository with the same sentences as `postgres-scim.ts`. Where the two differ the text says so. The clock is fixed at `2026-10-04T12:00:00.000Z` and random UUIDs are renumbered. The credential is shown as `$SCIM_CREDENTIAL` and the base address as `https://gateway.example/api/institution/scim/v2`, an address that does not exist.

## Where it is mounted

| Item | Value |
| --- | --- |
| Base path | `/scim/v2` on the gateway. On Vercel the full path is `/api/institution/scim/v2`. |
| Switch | `SEMESTER_SCIM=on`. Off, a request under `/scim/v2` goes to the gateway like any other path and gets its ordinary `404 not_found` envelope, so the endpoint's existence is not advertised. |
| Public address | `SEMESTER_SCIM_PUBLIC_URL` must be set when SCIM is on. Every `meta.location` is built from it, and the runtime refuses to start without it. It must be HTTPS, or `localhost` / `127.0.0.1`. |
| Entry point | The Vercel runtime only. `start.ts` does not mount SCIM. |

The test holds that `start.ts` does not mount SCIM, so a page that said it did would fail.

## Routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/scim/v2/ServiceProviderConfig` | SCIM credential | Discovery. |
| GET | `/scim/v2/Schemas` | SCIM credential | Discovery: the two schema ids. |
| GET | `/scim/v2/ResourceTypes` | SCIM credential | Discovery: User and Group. |
| GET | `/scim/v2/Users` | SCIM credential | List, optionally filtered. |
| POST | `/scim/v2/Users` | SCIM credential | Create a user. |
| GET | `/scim/v2/Users/{id}` | SCIM credential | Read a user. |
| PUT | `/scim/v2/Users/{id}` | SCIM credential | Replace a user. |
| PATCH | `/scim/v2/Users/{id}` | SCIM credential | Patch a user. |
| DELETE | `/scim/v2/Users/{id}` | SCIM credential | Deactivate a user. |
| GET | `/scim/v2/Groups` | SCIM credential | List, optionally filtered. |
| POST | `/scim/v2/Groups` | SCIM credential | Set the membership of a mapped group. |
| GET | `/scim/v2/Groups/{id}` | SCIM credential | Read a group. |
| PUT | `/scim/v2/Groups/{id}` | SCIM credential | Replace a group's membership. |
| PATCH | `/scim/v2/Groups/{id}` | SCIM credential | Patch a group. |
| DELETE | `/scim/v2/Groups/{id}` | SCIM credential | Empty a group's membership. |

Every response has `Content-Type: application/scim+json; charset=utf-8`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. The SCIM handler adds no `X-Request-Id` or `X-Correlation-Id`.

## Authentication

SCIM does not use the Supabase token the rest of the gateway uses. It has its own credential, a bearer token of the form

```text
Authorization: Bearer <credential id>.<secret>
```

where the credential id is a UUID (36 characters) and the secret is at least 32 characters from `A-Z a-z 0-9 _ -`. The service looks the credential up by id, hashes the secret with its stored salt (SHA-256 of the salt followed by the secret) and compares in constant time. A credential belongs to one tenant, and the tenant for every query and write comes from the credential and never from the body. A missing, malformed, unknown, revoked, expired or wrong credential all answer the same `401` sentence, and an unknown id costs the same hash work as a known one.

How a credential is issued is not described here. The table that holds credentials stores a salt and a hash (`scim_credential` in migration `20260924150142_institution_identity_provisioning.sql`), and I found no endpoint or function in the repository that creates one. Treat issuance as unspecified.

<!-- example:scim-no-credential -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users'
```

**Response** `401`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "401",
  "detail": "A valid SCIM bearer credential is required."
}
```
<!-- /example -->

<!-- example:scim-bad-credential -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `401`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "401",
  "detail": "A valid SCIM bearer credential is required."
}
```
<!-- /example -->

### Rate limit

After authentication, each credential has its own bucket on the gateway's shared Postgres counter: the same default of 60 requests per 60 seconds as the rest of the gateway ([AUTH-AND-LIMITS.md](AUTH-AND-LIMITS.md#rate-limiting)). Over it: `429`. The bucket is keyed by the tenant and `scim:<credential id>`.

<!-- example:scim-rate-limited -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `429`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "429",
  "detail": "SCIM request rate limit exceeded."
}
```
<!-- /example -->

## Order of checks

1. The request is under the SCIM base, or `404 SCIM endpoint not found.`
2. The credential, or `401`.
3. The rate limit, or `429`.
4. Discovery, `GET` list and `GET` read routes answer.
5. Any other method needs an `Idempotency-Key` (`400` without one), even on a path that does not exist.
6. The body is read: at most 128,000 bytes (`413`), valid JSON (`400`). The content type is not checked.
7. The body is validated, then the repository writes.

## Idempotency

Every request that is not a `GET` needs an `Idempotency-Key` header of 1 to 300 characters. It is the request id the audit row is keyed on. The design document says every mutation is idempotent by tenant and request id ([`SCIM-LIFECYCLE-MANAGEMENT.md`](../SCIM-LIFECYCLE-MANAGEMENT.md)); that rule lives in the database functions, which this page did not exercise. Use a new key for each distinct change and the same key to retry the same one.

<!-- example:scim-no-idempotency-key -->
**Request**

```bash
curl -s -X POST 'https://gateway.example/api/institution/scim/v2/Users' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"externalId":"ext-1","userName":"Ada@Example.edu","displayName":"Ada L","active":true}'
```

**Response** `400`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "400",
  "detail": "A bounded Idempotency-Key is required for SCIM mutations."
}
```
<!-- /example -->

## Discovery

`ServiceProviderConfig` is fixed: patch is supported; bulk, sort, ETag and change password are not; filter is supported with `maxResults` 200. `Schemas` and `ResourceTypes` return a `ListResponse` of two entries each, and the entries are bare ids (`Schemas`) or id, endpoint and schema (`ResourceTypes`), not full schema documents.

<!-- example:scim-service-provider-config -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/ServiceProviderConfig' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"
  ],
  "patch": {
    "supported": true
  },
  "bulk": {
    "supported": false
  },
  "filter": {
    "supported": true,
    "maxResults": 200
  },
  "changePassword": {
    "supported": false
  },
  "sort": {
    "supported": false
  },
  "etag": {
    "supported": false
  }
}
```
<!-- /example -->

## Users

A user resource has `schemas`, `id`, `externalId`, `userName`, `displayName`, `active` and `meta` (`resourceType`, `created`, `lastModified`, `location`). The `id` is the membership id in the Postgres repository.

| Attribute | On write | Notes |
| --- | --- | --- |
| `schemas` | Required | Must contain `urn:ietf:params:scim:schemas:core:2.0:User`. |
| `userName` | Required | 1 to 300 characters. The repository stores it lower-cased. |
| `externalId` | Required in practice | Optional to the parser, but the Postgres repository refuses a user without one: it is how the university identifies the person. It cannot change afterwards. |
| `displayName` | Optional | 1 to 300 characters. |
| `active` | Optional | Must be a boolean. **Defaults to `true` when omitted**, including on `PUT`, so a `PUT` without `active` reactivates a deactivated user. |

Other attributes in the body (`name`, `emails`, `roles`, `groups`, the enterprise extension) are ignored, not rejected. The response never shows roles or groups.

Roles are not set through users. A person's roles are recomputed from their group membership and the administrator's group mappings ([`SCIM-LIFECYCLE-MANAGEMENT.md`](../SCIM-LIFECYCLE-MANAGEMENT.md)).

<!-- example:scim-create-user -->
**Request**

```bash
curl -s -X POST 'https://gateway.example/api/institution/scim/v2/Users' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0001' \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"externalId":"ext-1","userName":"Ada@Example.edu","displayName":"Ada L","active":true}'
```

**Response** `201` Created

```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:core:2.0:User"
  ],
  "id": "00000000-0000-4000-8000-000000000001",
  "externalId": "ext-1",
  "userName": "ada@example.edu",
  "displayName": "Ada L",
  "active": true,
  "meta": {
    "resourceType": "User",
    "created": "2026-10-04T12:00:00.000Z",
    "lastModified": "2026-10-04T12:00:00.000Z",
    "location": "https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001"
  }
}
```
<!-- /example -->

`DELETE` never removes a user. It writes the same user back with `active: false` and answers `204` with no body. That is the repository's deprovisioning: it clears the roles and keeps the identity so a replay finds the same person.

<!-- example:scim-get-user -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:core:2.0:User"
  ],
  "id": "00000000-0000-4000-8000-000000000001",
  "externalId": "ext-1",
  "userName": "ada@example.edu",
  "displayName": "Ada L",
  "active": true,
  "meta": {
    "resourceType": "User",
    "created": "2026-10-04T12:00:00.000Z",
    "lastModified": "2026-10-04T12:00:00.000Z",
    "location": "https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001"
  }
}
```
<!-- /example -->

<!-- example:scim-put-user -->
**Request**

```bash
curl -s -X PUT 'https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0005' \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"externalId":"ext-1","userName":"ada@example.edu","active":false}'
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:core:2.0:User"
  ],
  "id": "00000000-0000-4000-8000-000000000001",
  "externalId": "ext-1",
  "userName": "ada@example.edu",
  "active": false,
  "meta": {
    "resourceType": "User",
    "created": "2026-10-04T12:00:00.000Z",
    "lastModified": "2026-10-04T12:00:00.000Z",
    "location": "https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001"
  }
}
```
<!-- /example -->

<!-- example:scim-put-external-id -->
**Request**

```bash
curl -s -X PUT 'https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0004' \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"externalId":"ext-2","userName":"ada@example.edu"}'
```

**Response** `400`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "400",
  "detail": "A user’s externalId cannot change. Deactivate this user and create a new one."
}
```
<!-- /example -->

<!-- example:scim-delete-user -->
**Request**

```bash
curl -s -X DELETE 'https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Idempotency-Key: req-0006'
```

**Response** `204` No Content

No body.
<!-- /example -->

<!-- example:scim-user-not-found -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users/does-not-exist' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `404`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "404",
  "detail": "SCIM user not found."
}
```
<!-- /example -->

## Groups

A group is not something the identity provider creates. A tenant administrator maps an identity-provider group to roles in `scim_group_mapping`; SCIM then sets who is in that group. In the Postgres repository:

- A group's `id` is the mapping's id and its `externalId` is the mapped group id.
- `GET /Groups` lists the active mappings only.
- `POST /Groups` and `PUT /Groups/{id}` replace the membership of a mapped group and create no mapping. A group whose `externalId` is not mapped is refused with a `400` that names the administrator as the person who can fix it. The attempt is still recorded in the audit.
- Members are the `id` values of users of the same tenant. Anything else is a `400`.
- `DELETE` empties the membership. The mapping stays.
- `members` lists active identities only.

<!-- example:scim-list-groups -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Groups' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:ListResponse"
  ],
  "totalResults": 1,
  "startIndex": 1,
  "itemsPerPage": 1,
  "Resources": [
    {
      "schemas": [
        "urn:ietf:params:scim:schemas:core:2.0:Group"
      ],
      "id": "00000000-0000-4000-8000-000000000002",
      "externalId": "semester-students",
      "displayName": "Semester students",
      "members": [],
      "meta": {
        "resourceType": "Group",
        "created": "2026-10-04T12:00:00.000Z",
        "lastModified": "2026-10-04T12:00:00.000Z",
        "location": "https://gateway.example/api/institution/scim/v2/Groups/00000000-0000-4000-8000-000000000002"
      }
    }
  ]
}
```
<!-- /example -->

<!-- example:scim-put-group -->
**Request**

```bash
curl -s -X PUT 'https://gateway.example/api/institution/scim/v2/Groups/00000000-0000-4000-8000-000000000002' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0007' \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:Group"],"displayName":"Semester students","members":[{"value":"00000000-0000-4000-8000-000000000001","display":"ada@example.edu"}]}'
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:core:2.0:Group"
  ],
  "id": "00000000-0000-4000-8000-000000000002",
  "externalId": "semester-students",
  "displayName": "Semester students",
  "members": [
    {
      "value": "00000000-0000-4000-8000-000000000001",
      "display": "ada@example.edu"
    }
  ],
  "meta": {
    "resourceType": "Group",
    "created": "2026-10-04T12:00:00.000Z",
    "lastModified": "2026-10-04T12:00:00.000Z",
    "location": "https://gateway.example/api/institution/scim/v2/Groups/00000000-0000-4000-8000-000000000002"
  }
}
```
<!-- /example -->

<!-- example:scim-group-unmapped -->
**Request**

```bash
curl -s -X POST 'https://gateway.example/api/institution/scim/v2/Groups' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0008' \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:Group"],"externalId":"unmapped","displayName":"Nope"}'
```

**Response** `400`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "400",
  "detail": "This group has not been mapped to any role by the university’s Semester administrator, so it grants nothing. Ask them to map it, then send it again."
}
```
<!-- /example -->

<!-- example:scim-delete-group -->
**Request**

```bash
curl -s -X DELETE 'https://gateway.example/api/institution/scim/v2/Groups/00000000-0000-4000-8000-000000000002' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Idempotency-Key: req-0009'
```

**Response** `204` No Content

No body.
<!-- /example -->

## Filtering and paging

`GET /Users` and `GET /Groups` accept `filter`, `startIndex` and `count`.

| Parameter | Accepted | Anything else |
| --- | --- | --- |
| `filter` | Exactly `userName eq "value"` or `externalId eq "value"`. The attribute name is case-insensitive, the operator is `eq` only, the value is in double quotes, at most 300 characters, and the whole filter at most 640. | `400 Invalid SCIM filter.` |
| `startIndex` | A positive integer, one-based. | An invalid value becomes 1. |
| `count` | An integer from 0, at most 200. | An invalid value becomes 100. Above 200 becomes 200. |

A `userName` filter matches case-insensitively; an `externalId` filter matches exactly. On groups only an `externalId` filter matches anything; a `userName` filter returns an empty list. The service reads every matching row and then slices the page, so `totalResults` is the full count.

<!-- example:scim-filter-user -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users?filter=userName%20eq%20%22ada%40example.edu%22' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:ListResponse"
  ],
  "totalResults": 1,
  "startIndex": 1,
  "itemsPerPage": 1,
  "Resources": [
    {
      "schemas": [
        "urn:ietf:params:scim:schemas:core:2.0:User"
      ],
      "id": "00000000-0000-4000-8000-000000000001",
      "externalId": "ext-1",
      "userName": "ada@example.edu",
      "displayName": "Ada L",
      "active": true,
      "meta": {
        "resourceType": "User",
        "created": "2026-10-04T12:00:00.000Z",
        "lastModified": "2026-10-04T12:00:00.000Z",
        "location": "https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001"
      }
    }
  ]
}
```
<!-- /example -->

<!-- example:scim-bad-filter -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users?filter=userName%20co%20%22ada%22' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `400`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "400",
  "detail": "Invalid SCIM filter."
}
```
<!-- /example -->

<!-- example:scim-count-zero -->
**Request**

```bash
curl -s 'https://gateway.example/api/institution/scim/v2/Users?startIndex=1&count=0' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL"
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:ListResponse"
  ],
  "totalResults": 1,
  "startIndex": 1,
  "itemsPerPage": 0,
  "Resources": []
}
```
<!-- /example -->

## PATCH

The body is `{"schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], "Operations": [...]}` with 1 to 100 operations. Each operation must have:

- `op`: `add`, `replace` or `remove`, in any letter case.
- `path`: a bare attribute name. For a user: `active`, `userName`, `displayName`, `externalId`. For a group: `displayName`, `externalId`, `members`.
- `value`: required unless `op` is `remove`. A boolean for `active`, a list of members for `members`, a string otherwise.

`add` and `replace` behave the same: both set the attribute. `remove` deletes the attribute from the resource before it is validated, so removing a required attribute (`userName` on a user, `displayName` on a group) is a `400`. The operations are applied in order to a copy of the current resource, the result is validated as a whole, and then written.

A user patch on `members` and a group patch on `active` or `userName` are `400`. **Operations without a `path`, or with a filter path such as `emails[type eq "work"].value`, are refused** (`Invalid SCIM patch operation.`). Several identity providers send `{"op": "replace", "value": {"active": false}}` with no path; this service refuses that form, so a provider has to be configured to send a path, or to deactivate with `DELETE` or `PUT`.

<!-- example:scim-patch-user -->
**Request**

```bash
curl -s -X PATCH 'https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0002' \
  -d '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],"Operations":[{"op":"replace","path":"displayName","value":"Ada Lovelace"}]}'
```

**Response** `200` OK

```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:core:2.0:User"
  ],
  "id": "00000000-0000-4000-8000-000000000001",
  "externalId": "ext-1",
  "userName": "ada@example.edu",
  "displayName": "Ada Lovelace",
  "active": true,
  "meta": {
    "resourceType": "User",
    "created": "2026-10-04T12:00:00.000Z",
    "lastModified": "2026-10-04T12:00:00.000Z",
    "location": "https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001"
  }
}
```
<!-- /example -->

<!-- example:scim-patch-without-path -->
**Request**

```bash
curl -s -X PATCH 'https://gateway.example/api/institution/scim/v2/Users/00000000-0000-4000-8000-000000000001' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0003' \
  -d '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],"Operations":[{"op":"replace","value":{"active":false}}]}'
```

**Response** `400`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "400",
  "detail": "Invalid SCIM patch operation."
}
```
<!-- /example -->

## Errors

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "status": "404",
  "detail": "SCIM user not found."
}
```

`status` is the HTTP status as a string. There is no machine-readable code; the status and the `detail` sentence are the contract, and the sentences are listed in [ERRORS.md](ERRORS.md#scim-error-details). There is no `scimType` and no `WWW-Authenticate` header. An unexpected failure is always `503` with one fixed sentence, whatever was thrown.

An unknown path or method under the base is `404 SCIM endpoint not found.`, not `405`:

<!-- example:scim-bulk-not-implemented -->
**Request**

```bash
curl -s -X POST 'https://gateway.example/api/institution/scim/v2/Bulk' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0010' \
  -d '{}'
```

**Response** `404`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "404",
  "detail": "SCIM endpoint not found."
}
```
<!-- /example -->

<!-- example:scim-not-json -->
**Request**

```bash
curl -s -X POST 'https://gateway.example/api/institution/scim/v2/Users' \
  -H "Authorization: Bearer $SCIM_CREDENTIAL" \
  -H 'Content-Type: application/scim+json' \
  -H 'Idempotency-Key: req-0011' \
  -d '{nope'
```

**Response** `400`

```json
{
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:Error"
  ],
  "status": "400",
  "detail": "The SCIM request is not valid JSON."
}
```
<!-- /example -->

## Audit

Every accepted write and every refused write is audited by tenant, credential and `Idempotency-Key`. In the Postgres repository an accepted write is audited in the same transaction as the write, and a refusal on a User or Group path is recorded by the database function `scim_gateway_record_refusal`. A refusal on any other path (discovery or an unknown path) is not written to the audit table; the gateway's telemetry covers it. If a refusal cannot be written, a metadata-only line `institution.scim.audit_unrecorded` goes to the process log and the client still gets its `400`.

## What is not implemented

| Feature | What happens |
| --- | --- |
| Bulk (`/Bulk`) | `404`. `ServiceProviderConfig` says `bulk.supported: false`. |
| Sorting, ETags, change password | Not supported; `ServiceProviderConfig` says so. `sortBy` and `If-Match` are ignored. |
| `/Me`, `/.search` (POST search), `/Users/.search` | Not routed. |
| Filter operators other than `eq`; `and`, `or`, `not`; attributes other than `userName` and `externalId`; filters on `meta` | `400 Invalid SCIM filter.` |
| `attributes` and `excludedAttributes` parameters | Not read. Every resource is returned in full. |
| Pathless PATCH, filter paths, nested paths such as `name.givenName` | `400 Invalid SCIM patch operation.` |
| Patching `members` of a user, or `active` of a group | `400`. |
| Hard delete of a user | `DELETE` deactivates. |
| Creating or deleting a group mapping | The administrator does it in Semester; SCIM only sets membership. |
| User attributes beyond `externalId`, `userName`, `displayName`, `active` | Ignored. |
| Roles and groups on the User resource | Not returned. |
| A full schema document from `/Schemas` | Only the ids. |
| An issuing endpoint for credentials | None in the gateway. |
| A request content-type check | None; the body is parsed as JSON whatever the type. |
| `OPTIONS` and `HEAD` | Not handled specially. A request under `/scim/v2` goes to the SCIM service, not to the gateway's CORS handling, so a browser preflight without a credential gets `401`. |
