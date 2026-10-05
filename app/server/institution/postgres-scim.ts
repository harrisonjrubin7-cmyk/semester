import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ProvisioningResult,
  ScimFilter,
  ScimGroup,
  ScimMember,
  ScimUser,
  UniversityRole,
} from '../../../packages/institution/src/index.ts';
import {
  ScimError,
  type CredentialMaterial,
  type ScimAuditEvent,
  type ScimRepository,
  type StoredScimGroup,
} from './scim.ts';

/**
 * The production SCIM repository, over the tables and functions of
 * `20260924150142_institution_identity_provisioning.sql`.
 *
 * Every write goes through a definer function (reached by the service-role
 * wrappers in `20260928200000_scim_gateway.sql`), so every rule about a write
 * — tenant-bound credential, idempotent request id, a deactivation clearing
 * roles — lives in one place and is the one with a check suite. This file
 * translates between SCIM's shapes and that schema, and refuses in SCIM's
 * terms where the two disagree.
 *
 * ## Where SCIM and this schema disagree, and who wins
 *
 * **A user's `id` is the membership id, and its `externalId` is fixed.** The
 * private function keys a person on (tenant, externalId). A replacement that
 * changed the externalId would silently make a second membership rather than
 * edit the first, so it is refused with a 400.
 *
 * **A group is an administrator's mapping, not something the identity
 * provider creates.** `scim_group_mapping` holds which roles an IdP group
 * confers, and only a tenant administrator writes it. So a SCIM group's `id`
 * is the mapping's id, `POST /Groups` must name a mapped group by
 * `externalId`, and an unmapped one is refused with a 400 that says who can
 * fix it — after the private function has recorded it as `unknown_group`, so
 * the attempt is in the audit either way. Deleting a group empties its
 * membership; the mapping, which the IdP never owned, stays.
 *
 * **Accepted writes audit themselves.** The private functions insert the
 * accepted event in the same transaction as the write, so `audit()` for an
 * accepted event is the acknowledgement `ScimRepository` says it may be.
 * Refusals have no transaction of their own and go through
 * `scim_gateway_record_refusal`, which keeps the first event for a request id.
 */

export interface PostgresScimRepositoryOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  /** The public base URL SCIM clients use, e.g. https://…/api/institution/scim/v2 */
  publicBaseUrl: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

/** A list query not yet sent: `range` bounds it and returns the awaitable read. */
type Ranged = { range(from: number, to: number): PromiseLike<{ data: unknown; error: unknown }> };

/** Rows asked for per read. Supabase's default max-rows, so one read per page. */
const PAGE = 1000;
/** Values per `in`/`overlaps` filter: 100 UUIDs is under 4 KB of URL. */
const IN_CHUNK = 100;

/** PostgREST returns bytea as `\x` followed by hex. */
export function byteaToBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !/^\\x([0-9a-f]{2})*$/i.test(value)) {
    throw new Error('The SCIM credential material is not in the expected encoding.');
  }
  return Uint8Array.from(Buffer.from(value.slice(2), 'hex'));
}

function unavailable(operation: string, cause: unknown): never {
  throw new Error(`The SCIM repository could not ${operation}.`, { cause });
}

export class PostgresScimRepository implements ScimRepository {
  private client: SupabaseClient;
  private base: string;

  constructor(options: PostgresScimRepositoryOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for SCIM.');
    }
    const base = new URL(options.publicBaseUrl);
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
      throw new Error('The public SCIM base URL must be HTTPS.');
    }
    this.base = base.href.replace(/\/$/, '');
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  private async rpc<T>(name: string, args: Row, operation: string): Promise<T> {
    const { data, error } = await this.client.rpc(name, args) as { data: T; error: unknown };
    if (error) unavailable(operation, error);
    return data;
  }

  private async rows(query: PromiseLike<{ data: unknown; error: unknown }>, operation: string): Promise<Row[]> {
    const { data, error } = await query;
    if (error) unavailable(operation, error);
    return (data ?? []) as Row[];
  }

  /**
   * Every row a list query matches. PostgREST caps each response at the
   * project's max-rows (1,000 on Supabase) and says nothing when it does, so a
   * single read of a university directory silently stops at the cap. `build`
   * makes a fresh query per page, which must carry a total order; this reads
   * until a page comes back empty rather than short, so a smaller cap than
   * PAGE cannot end it early.
   */
  private async all(build: () => Ranged, operation: string): Promise<Row[]> {
    const out: Row[] = [];
    for (;;) {
      const page = await this.rows(build().range(out.length, out.length + PAGE - 1), operation);
      if (page.length === 0) return out;
      out.push(...page);
    }
  }

  /** An `in` filter is a URL, so a long list is asked for in pieces. */
  private async allIn(values: string[], build: (chunk: string[]) => Ranged, operation: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let k = 0; k < values.length; k += IN_CHUNK) {
      const chunk = values.slice(k, k + IN_CHUNK);
      out.push(...await this.all(() => build(chunk), operation));
    }
    return out;
  }

  async credential(id: string): Promise<CredentialMaterial | null> {
    if (!UUID.test(id)) return null;
    const found = await this.rpc<Row[]>('scim_gateway_credential', { want_id: id }, 'read a credential');
    const row = found?.[0];
    if (!row) return null;
    return {
      id: String(row.credential_id),
      tenantId: String(row.tenant_id),
      salt: byteaToBytes(row.secret_salt),
      hash: byteaToBytes(row.secret_hash),
      // Known but revoked or expired comes back too, so a refusal can be
      // recorded against its tenant; the service refuses anything not active.
      status: row.active === true ? 'active' : 'revoked',
    };
  }

  // ── Users ─────────────────────────────────────────────────────────────

  private async users(tenantId: string, where: { column: string; value: string } | null): Promise<ProvisioningResult[]> {
    const identities = await this.all(() => {
      let query = this.client.from('scim_external_identity')
        .select('membership_id, external_id, user_name, display_name, active, group_external_ids, created_at, updated_at')
        .eq('tenant_id', tenantId);
      if (where) query = query.eq(where.column, where.value);
      return query.order('created_at').order('membership_id');
    }, 'list users');
    if (identities.length === 0) return [];
    const memberships = await this.allIn(
      identities.map((i) => String(i.membership_id)),
      (ids) => this.client.from('institution_membership').select('id, roles')
        .eq('tenant_id', tenantId).in('id', ids).order('id'),
      'read memberships',
    );
    const roles = new Map(memberships.map((m) => [String(m.id), (m.roles ?? []) as UniversityRole[]]));
    return identities.map((i) => ({
      tenantId,
      userId: String(i.membership_id),
      externalId: String(i.external_id),
      userName: String(i.user_name),
      ...(i.display_name == null ? {} : { displayName: String(i.display_name) }),
      active: i.active === true,
      roles: roles.get(String(i.membership_id)) ?? [],
      groupIds: ((i.group_external_ids ?? []) as string[]).map(String),
      auditId: '',
      createdAt: new Date(String(i.created_at)).toISOString(),
      updatedAt: new Date(String(i.updated_at)).toISOString(),
      location: `${this.base}/Users/${String(i.membership_id)}`,
    }));
  }

  async listUsers(tenantId: string, filter: ScimFilter | null): Promise<ProvisioningResult[]> {
    if (!filter) return this.users(tenantId, null);
    // User names are stored lower-cased by the provisioning function.
    return filter.attribute === 'userName'
      ? this.users(tenantId, { column: 'user_name', value: filter.value.trim().toLowerCase() })
      : this.users(tenantId, { column: 'external_id', value: filter.value });
  }

  async getUser(tenantId: string, id: string): Promise<ProvisioningResult | null> {
    if (!UUID.test(id)) return null;
    return (await this.users(tenantId, { column: 'membership_id', value: id }))[0] ?? null;
  }

  async putUser(tenantId: string, id: string | null, input: ScimUser, requestId: string, credentialId: string): Promise<ProvisioningResult> {
    let externalId = input.externalId;
    if (id) {
      const current = await this.getUser(tenantId, id);
      if (!current) throw new ScimError(404, 'SCIM user not found.');
      if (externalId !== undefined && externalId !== current.externalId) {
        throw new ScimError(400, 'A user’s externalId cannot change. Deactivate this user and create a new one.');
      }
      externalId = current.externalId;
    }
    if (!externalId) throw new ScimError(400, 'A SCIM user needs an externalId: it is how the university identifies the person.');
    const membership = await this.rpc<string>('scim_gateway_provision_user', {
      want_tenant: tenantId,
      want_credential: credentialId,
      want_request_id: requestId,
      want_external_id: externalId,
      want_user_name: input.userName,
      want_display_name: input.displayName ?? null,
      want_active: input.active,
    }, 'provision a user');
    const saved = await this.getUser(tenantId, String(membership));
    if (!saved) unavailable('read back a provisioned user', null);
    return saved;
  }

  // ── Groups ────────────────────────────────────────────────────────────

  private async groups(tenantId: string, where: { column: string; value: string } | null): Promise<StoredScimGroup[]> {
    const mappings = await this.all(() => {
      let query = this.client.from('scim_group_mapping')
        .select('id, external_group_id, display_name, updated_at')
        .eq('tenant_id', tenantId).eq('active', true);
      if (where) query = query.eq(where.column, where.value);
      return query.order('display_name').order('id');
    }, 'list groups');
    if (mappings.length === 0) return [];
    const members = await this.allIn(
      mappings.map((m) => String(m.external_group_id)),
      (groups) => this.client.from('scim_external_identity')
        .select('membership_id, user_name, group_external_ids, created_at')
        .eq('tenant_id', tenantId).eq('active', true)
        .overlaps('group_external_ids', groups).order('membership_id'),
      'list group members',
    );
    // A person in two groups that fell in different chunks came back twice.
    const seen = new Set<string>();
    const unique = members.filter((i) => !seen.has(String(i.membership_id)) && seen.add(String(i.membership_id)));
    return mappings.map((m) => {
      const external = String(m.external_group_id);
      const inGroup: ScimMember[] = unique
        .filter((i) => ((i.group_external_ids ?? []) as string[]).includes(external))
        .map((i) => ({ value: String(i.membership_id), display: String(i.user_name) }));
      const updated = new Date(String(m.updated_at)).toISOString();
      return {
        tenantId,
        groupId: String(m.id),
        externalId: external,
        displayName: String(m.display_name),
        members: inGroup,
        // A mapping records when it last changed, not when it was made.
        createdAt: updated,
        updatedAt: updated,
        location: `${this.base}/Groups/${String(m.id)}`,
      };
    });
  }

  async listGroups(tenantId: string, filter: ScimFilter | null): Promise<StoredScimGroup[]> {
    if (!filter) return this.groups(tenantId, null);
    // A group has no userName; only externalId filters mean anything.
    return filter.attribute === 'externalId'
      ? this.groups(tenantId, { column: 'external_group_id', value: filter.value })
      : [];
  }

  async getGroup(tenantId: string, id: string): Promise<StoredScimGroup | null> {
    if (!UUID.test(id)) return null;
    return (await this.groups(tenantId, { column: 'id', value: id }))[0] ?? null;
  }

  /** Member ids (membership ids) → external ids, in this tenant only. */
  private async memberExternalIds(tenantId: string, members: ScimMember[]): Promise<string[]> {
    const ids = [...new Set(members.map((m) => m.value))];
    if (ids.length === 0) return [];
    if (!ids.every((v) => UUID.test(v))) throw new ScimError(400, 'A group member is not a SCIM user of this university.');
    const found = await this.allIn(
      ids,
      (chunk) => this.client.from('scim_external_identity').select('membership_id, external_id')
        .eq('tenant_id', tenantId).in('membership_id', chunk).order('membership_id'),
      'resolve group members',
    );
    if (found.length !== ids.length) throw new ScimError(400, 'A group member is not a SCIM user of this university.');
    return found.map((r) => String(r.external_id));
  }

  async putGroup(tenantId: string, id: string | null, input: ScimGroup, requestId: string, credentialId: string): Promise<StoredScimGroup> {
    let external = input.externalId;
    if (id) {
      const current = await this.getGroup(tenantId, id);
      if (!current) throw new ScimError(404, 'SCIM group not found.');
      if (external !== undefined && external !== current.externalId) {
        throw new ScimError(400, 'A group’s externalId cannot change.');
      }
      external = current.externalId;
    }
    if (!external) throw new ScimError(400, 'A SCIM group needs the externalId the university administrator mapped.');
    const memberIds = await this.memberExternalIds(tenantId, input.members);
    await this.rpc<number>('scim_gateway_replace_group', {
      want_tenant: tenantId,
      want_credential: credentialId,
      want_request_id: requestId,
      want_external_group_id: external,
      want_display_name: input.displayName,
      want_member_external_ids: memberIds,
    }, 'replace group members');
    const saved = (await this.groups(tenantId, { column: 'external_group_id', value: external }))[0];
    if (!saved) {
      // Recorded as `unknown_group` by the function above; nobody's roles moved.
      throw new ScimError(400, 'This group has not been mapped to any role by the university’s Semester administrator, so it grants nothing. Ask them to map it, then send it again.');
    }
    return saved;
  }

  async deleteGroup(tenantId: string, id: string, requestId: string, credentialId: string): Promise<void> {
    const current = await this.getGroup(tenantId, id);
    if (!current) throw new ScimError(404, 'SCIM group not found.');
    await this.rpc<number>('scim_gateway_replace_group', {
      want_tenant: tenantId,
      want_credential: credentialId,
      want_request_id: requestId,
      want_external_group_id: current.externalId,
      want_display_name: current.displayName,
      want_member_external_ids: [],
    }, 'empty a group');
  }

  async audit(event: ScimAuditEvent): Promise<void> {
    // Accepted writes were audited in their own transaction.
    if (event.outcome === 'accepted') return;
    // A refused call to an endpoint that is neither Users nor Groups has no
    // resource the audit table can name; the gateway's telemetry records it.
    if (event.resourceType !== 'User' && event.resourceType !== 'Group') return;
    // Called from the service's error path. A refusal that could not be
    // written must not turn the client's 400 into an unhandled failure, so it
    // goes to server telemetry instead — metadata only, as the table holds.
    try {
      await this.rpc<boolean>('scim_gateway_record_refusal', {
        want_tenant: event.tenantId,
        want_credential: event.credentialId,
        want_request_id: event.requestId,
        want_resource_type: event.resourceType,
        want_status: event.status,
        want_reason: event.reason,
      }, 'record a refusal');
    } catch {
      console.error(JSON.stringify({
        event: 'institution.scim.audit_unrecorded',
        tenantId: event.tenantId,
        credentialId: event.credentialId,
        status: event.status,
      }));
    }
  }
}
