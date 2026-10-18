import { APPLICATION_EDGES, transition, type ApplicationState } from './lifecycle';

/**
 * The application registry: records, the authorization rules that guard them,
 * and the store they are read from and written to.
 *
 * Who is asking is a `Principal` the server builds from a verified token. It is
 * never read from the request body, which is why no function here accepts an
 * organization id from the caller.
 *
 * The rules come from docs/developer-portal/PROGRAM.md §3.3 and the
 * specification §4.4 and §5.4. A scope check here is a teaching model, not the
 * production policy: the permission matrix is still open (decision Q-5).
 */

export interface Principal {
  readonly id: string;
  /** The organization the principal acts for. This is the tenant boundary. */
  readonly orgId: string;
  readonly scopes: ReadonlySet<string>;
  /** False once the grant behind this session has been revoked (§5.7). */
  readonly grantActive: boolean;
}

export interface ApplicationRecord {
  readonly id: string;
  /** Publisher organization. Set from the principal, never from input. */
  readonly orgId: string;
  readonly name: string;
  readonly purpose: string;
  readonly state: ApplicationState;
  /** Incremented on every change; used for optimistic concurrency (§4.2). */
  readonly version: number;
}

export interface ApplicationStore {
  get(id: string): Promise<ApplicationRecord | undefined>;
  put(record: ApplicationRecord): Promise<void>;
  listByOrg(orgId: string): Promise<readonly ApplicationRecord[]>;
}

export type RegistryError =
  | { readonly code: 'GRANT_REVOKED' }
  | { readonly code: 'FORBIDDEN'; readonly scope: string }
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'CONFLICT' }
  | { readonly code: 'PRECONDITION_FAILED'; readonly currentVersion: number }
  | { readonly code: 'INVALID_TRANSITION'; readonly allowed: readonly ApplicationState[] }
  | { readonly code: 'EVIDENCE_REQUIRED'; readonly missing: readonly string[] };

export type RegistryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RegistryError };

const fail = <T>(error: RegistryError): RegistryResult<T> => ({ ok: false, error });

/**
 * Identity checks run before any record is read, so a revoked or unscoped
 * principal learns nothing about which records exist.
 */
function authorize(principal: Principal, scope: string): RegistryError | undefined {
  if (!principal.grantActive) return { code: 'GRANT_REVOKED' };
  if (!principal.scopes.has(scope)) return { code: 'FORBIDDEN', scope };
  return undefined;
}

export async function createApplication(
  store: ApplicationStore,
  principal: Principal,
  input: { readonly id: string; readonly name: string; readonly purpose: string },
): Promise<RegistryResult<ApplicationRecord>> {
  const denied = authorize(principal, 'apps:write');
  if (denied) return fail(denied);
  if (await store.get(input.id)) return fail({ code: 'CONFLICT' });

  const record: ApplicationRecord = {
    id: input.id,
    orgId: principal.orgId,
    name: input.name,
    purpose: input.purpose,
    state: 'draft',
    version: 1,
  };
  await store.put(record);
  return { ok: true, value: record };
}

/**
 * A record belonging to another organization is reported as absent, not as
 * forbidden. That keeps the existence of other tenants' records from leaking
 * (§4.1, status 404).
 */
export async function readApplication(
  store: ApplicationStore,
  principal: Principal,
  id: string,
): Promise<RegistryResult<ApplicationRecord>> {
  const denied = authorize(principal, 'apps:read');
  if (denied) return fail(denied);
  const record = await store.get(id);
  if (!record || record.orgId !== principal.orgId) return fail({ code: 'NOT_FOUND' });
  return { ok: true, value: record };
}

export async function listApplications(
  store: ApplicationStore,
  principal: Principal,
): Promise<RegistryResult<readonly ApplicationRecord[]>> {
  const denied = authorize(principal, 'apps:read');
  if (denied) return fail(denied);
  return { ok: true, value: await store.listByOrg(principal.orgId) };
}

export async function transitionApplication(
  store: ApplicationStore,
  principal: Principal,
  input: {
    readonly id: string;
    readonly to: ApplicationState;
    readonly evidence: ReadonlySet<string>;
    readonly expectedVersion: number;
  },
): Promise<RegistryResult<ApplicationRecord>> {
  const denied = authorize(principal, 'apps:write');
  if (denied) return fail(denied);

  const record = await store.get(input.id);
  if (!record || record.orgId !== principal.orgId) return fail({ code: 'NOT_FOUND' });
  if (record.version !== input.expectedVersion) {
    return fail({ code: 'PRECONDITION_FAILED', currentVersion: record.version });
  }

  const result = transition(APPLICATION_EDGES, record.state, input.to, input.evidence);
  if (!result.ok) {
    if (result.code === 'INVALID_TRANSITION') {
      return fail({ code: 'INVALID_TRANSITION', allowed: result.allowed });
    }
    return fail({ code: 'EVIDENCE_REQUIRED', missing: result.missing });
  }

  const updated: ApplicationRecord = { ...record, state: input.to, version: record.version + 1 };
  await store.put(updated);
  return { ok: true, value: updated };
}

/** An in-memory store, for tests and for running the registry without a database. */
export function createMemoryStore(): ApplicationStore {
  const records = new Map<string, ApplicationRecord>();
  return {
    async get(id: string): Promise<ApplicationRecord | undefined> {
      return records.get(id);
    },
    async put(record: ApplicationRecord): Promise<void> {
      records.set(record.id, record);
    },
    async listByOrg(orgId: string): Promise<readonly ApplicationRecord[]> {
      return [...records.values()].filter((record) => record.orgId === orgId);
    },
  };
}
