// An identity-provider-side SCIM 2.0 client for the Semester gateway. Node 22, no dependencies.
// Run through its test: cd app && npx vitest run src/lib/docs/examples.test.ts

// The three schema URNs the service checks. The test asserts they equal
// SCIM_USER_SCHEMA, SCIM_PATCH_SCHEMA and SCIM_GROUP_SCHEMA in packages/institution.
export const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';

export type Transport = (request: Request) => Promise<Response>;

/** What an identity provider knows about a person. `externalId` is the school's own id. */
export interface Person {
  externalId: string;
  userName: string;
  displayName?: string;
  active?: boolean;
}

export interface ScimUser {
  id: string;
  externalId?: string;
  userName: string;
  displayName?: string;
  active: boolean;
}

export type PatchOp = { op: 'add' | 'replace' | 'remove'; path: 'active' | 'userName' | 'displayName' | 'externalId'; value?: boolean | string };

/** A SCIM error body: { schemas, status: "404", detail }. */
export class ScimClientError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

export interface ScimClientOptions {
  /** Ends with /scim/v2, no trailing slash. */
  baseUrl: string;
  /** `<credential id>.<secret>`, issued to the identity provider by the school. */
  credential: string;
  transport?: Transport;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}

export function createScimClient(options: ScimClientOptions) {
  const transport: Transport = options.transport ?? ((request) => fetch(request));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = options.maxAttempts ?? 4;

  /**
   * One call. A 429 or 503 is tried again with the SAME Idempotency-Key, so a
   * request the service did process cannot be applied twice. Nothing else is retried.
   */
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
      const error = await response.json().catch(() => null);
      throw new ScimClientError(response.status, error?.detail ?? `HTTP ${response.status}`);
    }
  };

  const mutation = async (method: string, path: string, body: unknown, key: string = crypto.randomUUID()): Promise<ScimUser> => {
    const response = await call(method, path, body, key);
    if (response.status === 404) throw new ScimClientError(404, (await response.json()).detail);
    return (await response.json()) as ScimUser;
  };

  const userBody = (person: Person) => ({ schemas: [USER_SCHEMA], active: true, ...person });

  const client = {
    /** Patch yes, bulk no, filter yes (max 200), sort/etag/changePassword no. */
    serviceProviderConfig: async () => (await call('GET', '/ServiceProviderConfig')).json(),

    createUser: (person: Person, key?: string) => mutation('POST', '/Users', userBody(person), key),
    replaceUser: (id: string, person: Person, key?: string) => mutation('PUT', `/Users/${id}`, userBody(person), key),
    patchUser: (id: string, operations: PatchOp[], key?: string) =>
      mutation('PATCH', `/Users/${id}`, { schemas: [PATCH_SCHEMA], Operations: operations }, key),

    /** DELETE deactivates. The service never hard-deletes a user. */
    async deactivateUser(id: string, key: string = crypto.randomUUID()): Promise<boolean> {
      return (await call('DELETE', `/Users/${id}`, undefined, key)).status === 204;
    },

    async getUser(id: string): Promise<ScimUser | null> {
      const response = await call('GET', `/Users/${id}`);
      return response.status === 404 ? null : ((await response.json()) as ScimUser);
    },

    /** Only `eq` on userName or externalId. Pages of up to 200, 1-based startIndex. */
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

    /** What an IdP's push loop does for one person: find by externalId, then create, update or deactivate. */
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
      const operations: PatchOp[] = [];
      if (!found.active) operations.push({ op: 'replace', path: 'active', value: true });
      if (person.displayName && person.displayName !== found.displayName) {
        operations.push({ op: 'replace', path: 'displayName', value: person.displayName });
      }
      if (person.userName !== found.userName) operations.push({ op: 'replace', path: 'userName', value: person.userName });
      if (operations.length === 0) return 'unchanged';
      await client.patchUser(found.id, operations);
      return 'updated';
    },
  };
  return client;
}
