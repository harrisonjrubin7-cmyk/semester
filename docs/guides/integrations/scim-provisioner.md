# Provision users over SCIM

> **Type:** how-to · **Audience:** implementers, partner-developers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

This page walks through an identity-provider-side SCIM 2.0 client that creates, updates and deactivates Semester accounts; stop reading if you want people to sign in, which is single sign-on and a separate protocol ([Which integration path do I want?](which-integration-path.md)).

**Status:** `IMPLEMENTED_NOT_RELEASED`. The service is built and tested, is off unless `SEMESTER_SCIM=on`, and has never run against a real identity provider ([`docs/FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md)). Off, a request under `/scim/v2` reaches the gateway and gets its ordinary 404. You can build and test a client today against the service running in-process, as the example's test does.

The code is [`examples/scim-provisioner/provisioner.ts`](../../../examples/scim-provisioner/provisioner.ts). Every code block below is copied from the repository byte for byte, and `app/src/lib/docs/examples.test.ts` fails if one drifts. The wire reference is [`docs/reference/SCIM-API.md`](../../reference/SCIM-API.md). The operating rules (what deprovisioning does to a student's work, how groups map to roles) are in [`docs/SCIM-LIFECYCLE-MANAGEMENT.md`](../../SCIM-LIFECYCLE-MANAGEMENT.md); this page does not repeat them.

## 1. Get a credential and a base URL

The school issues a bearer credential in the form `<credential id>.<secret>`, where the id is a UUID. Only a salted hash is stored. The base URL is the one the school configured as `SEMESTER_SCIM_PUBLIC_URL`, and the service is mounted under `/scim/v2`.

The tenant comes from the credential. A `tenantId` in a request body is ignored. The test sends one and finds the stored user in the credential's tenant.

## 2. Read what the service supports

`GET /ServiceProviderConfig` needs the credential like every other call. This is the document, as the service builds it:

<!-- from: app/server/institution/scim.ts -->
```ts
          patch: { supported: true }, bulk: { supported: false }, filter: { supported: true, maxResults: 200 },
          changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false },
```

`/Schemas` and `/ResourceTypes` list `User` at `/Users` and `Group` at `/Groups`.

## 3. Send each request the way the service expects

Every request carries the bearer credential. Every mutation (`POST`, `PUT`, `PATCH`, `DELETE`) also needs an `Idempotency-Key` header of up to 300 characters, and is refused with 400 without one. The key is how a retry is made safe: the service records the outcome per tenant and key, and a replay returns the first result with no second write.

The client does both in one place, and retries only a 429 or a 503, with the same key:

<!-- from: examples/scim-provisioner/provisioner.ts -->
```ts
  const call = async (method: string, path: string, body?: unknown, key?: string): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
      const response = await transport(
        new Request(options.baseUrl + path, {
          method,
          headers: {
            authorization: `Bearer ${options.credential}`,
            ...(key ? { 'idempotency-key': key } : {}),
            ...(body === undefined ? {} : { 'content-type': 'application/scim+json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
      if (response.ok || response.status === 404) return response;
      if ((response.status === 429 || response.status === 503) && attempt < maxAttempts) {
        await sleep(Math.min(250 * 2 ** (attempt - 1), 8000));
        continue;
      }
```

The service sends no `Retry-After`; the test reads a real 429 and finds none. The client uses its own backoff of 250, 500, 1000 milliseconds and so on, to a cap of 8000.

## 4. Create, replace, patch

A user needs `schemas`, a `userName`, and, in production, an `externalId`: the repository behind the live service refuses a user without one, and refuses a change to it ("Deactivate this user and create a new one"). `externalId` is the school's own identifier for the person. `active` defaults to true.

<!-- from: examples/scim-provisioner/provisioner.ts -->
```ts
  const userBody = (person: Person) => ({ schemas: [USER_SCHEMA], active: true, ...person });
```

A patch is a list of operations. The permitted paths on a user are `active`, `userName`, `displayName` and `externalId`, and the verbs are `add`, `replace` and `remove`. Anything else, including `members`, is a 400. At most 100 operations are accepted.

<!-- from: examples/scim-provisioner/provisioner.ts -->
```ts
export type PatchOp = { op: 'add' | 'replace' | 'remove'; path: 'active' | 'userName' | 'displayName' | 'externalId'; value?: boolean | string };
```

## 5. Deactivate, never delete

`DELETE /Users/{id}` sets `active` to false and answers 204. The user stays, and the id keeps resolving.

<!-- from: examples/scim-provisioner/provisioner.ts -->
```ts
    /** DELETE deactivates. The service never hard-deletes a user. */
    async deactivateUser(id: string, key: string = crypto.randomUUID()): Promise<boolean> {
      return (await call('DELETE', `/Users/${id}`, undefined, key)).status === 204;
    },
```

Reactivating is an explicit patch of `active` to true. Per the lifecycle runbook, reactivation does not restore old roles.

## 6. List with a filter

The filter grammar is one comparison. The service accepts exactly this shape:

<!-- from: packages/institution/src/provisioning.ts -->
```ts
  const match = /^(userName|externalId)\s+eq\s+"([^"]+)"$/i.exec(value.trim());
```

So `userName eq "ada@school.example"` works, and `userName co "ada"`, `and`, `or` and `pr` are 400. Pages use `startIndex` (from 1) and `count` (default 100, at most 200). The client walks them:

<!-- from: examples/scim-provisioner/provisioner.ts -->
```ts
    async listUsers(filter?: { attribute: 'userName' | 'externalId'; value: string }): Promise<ScimUser[]> {
      const users: ScimUser[] = [];
      for (let startIndex = 1; ; ) {
        const params = new URLSearchParams({ startIndex: String(startIndex), count: '100' });
        if (filter) params.set('filter', `${filter.attribute} eq "${filter.value}"`);
        const page = await (await call('GET', `/Users?${params}`)).json();
        users.push(...page.Resources);
        startIndex += page.itemsPerPage;
        if (page.itemsPerPage === 0 || startIndex > page.totalResults) return users;
      }
    },
```

The test creates 250 users and lists them in three requests, with `startIndex` 1, 101 and 201.

## 7. Push one person: the sync loop

An identity provider's push loop looks one person up by `externalId`, then acts. This is `sync`, and the test runs it through create, no change, update, deactivate, a second deactivate (no change), and reactivate:

<!-- from: examples/scim-provisioner/provisioner.ts -->
```ts
    async sync(person: Person): Promise<'created' | 'updated' | 'unchanged' | 'deactivated'> {
      const [found] = await client.listUsers({ attribute: 'externalId', value: person.externalId });
      const wantActive = person.active ?? true;
      if (!found) {
        if (!wantActive) return 'unchanged'; // nothing to remove, so create nothing
        await client.createUser(person);
        return 'created';
      }
      if (!wantActive) {
        if (!found.active) return 'unchanged';
        await client.deactivateUser(found.id);
        return 'deactivated';
      }
```

The first four results for the same person, with a display name change and then `active: false`:

<!-- output: scim-provisioner/sync -->
```json
[
  "created",
  "unchanged",
  "updated",
  "deactivated"
]
```

## 8. Errors

A failure is a SCIM error document, with `status` as a string:

<!-- from: app/server/institution/scim.ts -->
```ts
const errorResponse = (status: number, detail: string) => json({
  schemas: [SCIM_ERROR_SCHEMA],
  status: String(status),
  detail,
}, status);
```

| Status | When |
| --- | --- |
| 400 | Invalid JSON, schema, filter or patch; a mutation without `Idempotency-Key` |
| 401 | The credential is missing, malformed, revoked or wrong |
| 404 | Unknown user, or a path the service does not serve (`/Bulk`, a tenant-prefixed path) |
| 413 | A body over 128,000 bytes |
| 429 | The rate limit for this credential; retry with the same key |
| 503 | The repository failed; retry with the same key |

## What the service does not do

- **Bulk, sort, ETag and change password** are not supported.
- **Filters** other than `eq` on `userName` or `externalId`.
- **Role changes.** No SCIM field grants a role. Roles come from group membership against approved mappings, and the example does not touch groups. Groups are served (`/Groups`) and are covered by the runbook.
- **Hard deletion** of a user.

## Try it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "scim-provisioner"
```

## Next

- [`docs/SCIM-LIFECYCLE-MANAGEMENT.md`](../../SCIM-LIFECYCLE-MANAGEMENT.md): groups, roles, deprovisioning and the audit trail.
- [`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`](../../INSTITUTIONAL-SSO-ARCHITECTURE.md): how SCIM sits beside SAML and LTI.
- [`docs/reference/SCIM-API.md`](../../reference/SCIM-API.md) for the full wire reference.
