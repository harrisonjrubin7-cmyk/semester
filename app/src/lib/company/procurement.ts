import type { SupabaseClient } from '@supabase/supabase-js';
import { cloud } from '../cloud';
import type { Grant as CapabilityGrant } from '../capabilities';

const ACCOUNT_COLUMNS = 'id, public_id, name, segment, tenant_id, status, owner_id, created_at, updated_at';
const REQUEST_COLUMNS = 'id, account_id, stakeholder_id, requester_name, requester_email, requester_role, reason, nda_signed_on, status, requested_at, updated_at';
const GRANT_COLUMNS = 'id, request_id, packet_commit, granted_by, granted_at, expires_at, revoked_at, revoked_by, revoke_reason';
const ITEM_COLUMNS = 'grant_id, version_id';
const VERSION_COLUMNS = 'id, artifact_key, version, source_commit, published_on, review_on, created_at';
const ARTIFACT_COLUMNS = 'key, title, tier';
const ACCESS_COLUMNS = 'id, grant_id, version_id, accessed_at';
export const COMPANY_PAGE_SIZE = 50;

type Row = Record<string, unknown>;

export interface CompanyAccount {
  id: string;
  publicId: string;
  name: string;
  segment: string;
  tenantId: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementRequest {
  id: string;
  accountId: string;
  stakeholderId: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  reason: string;
  ndaSignedOn: string | null;
  status: string;
  requestedAt: string;
  updatedAt: string;
}

export interface ProcurementGrant {
  id: string;
  requestId: string;
  packetCommit: string;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

export interface PinnedVersion {
  versionId: string;
  artifactKey: string;
  title: string;
  tier: string;
  version: string;
  sourceCommit: string | null;
  publishedOn: string;
  reviewOn: string;
}

export interface GrantAccess {
  id: string;
  versionId: string | null;
  accessedAt: string;
}

export interface ProcurementGrantDetail extends ProcurementGrant {
  items: PinnedVersion[];
  accesses: GrantAccess[];
}

export interface ProcurementDetail {
  request: ProcurementRequest;
  grants: ProcurementGrantDetail[];
}

export type WithdrawalOutcome =
  | { kind: 'confirmed'; concurrent: boolean; grant: ProcurementGrant }
  | { kind: 'unknown'; visibilityLost: boolean; live: boolean | null };

function object(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(object).filter((row): row is Row => row !== null) : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function nullable(row: Row, key: string): string | null {
  return typeof row[key] === 'string' ? row[key] as string : null;
}

function account(row: Row): CompanyAccount {
  return {
    id: text(row, 'id'), publicId: text(row, 'public_id'), name: text(row, 'name'), segment: text(row, 'segment'),
    tenantId: nullable(row, 'tenant_id'), status: text(row, 'status'), ownerId: nullable(row, 'owner_id'),
    createdAt: text(row, 'created_at'), updatedAt: text(row, 'updated_at'),
  };
}

function request(row: Row): ProcurementRequest {
  return {
    id: text(row, 'id'), accountId: text(row, 'account_id'), stakeholderId: nullable(row, 'stakeholder_id'),
    requesterName: text(row, 'requester_name'), requesterEmail: text(row, 'requester_email'),
    requesterRole: text(row, 'requester_role'), reason: text(row, 'reason'), ndaSignedOn: nullable(row, 'nda_signed_on'),
    status: text(row, 'status'), requestedAt: text(row, 'requested_at'), updatedAt: text(row, 'updated_at'),
  };
}

function grant(row: Row): ProcurementGrant {
  return {
    id: text(row, 'id'), requestId: text(row, 'request_id'), packetCommit: text(row, 'packet_commit'),
    grantedBy: nullable(row, 'granted_by'), grantedAt: text(row, 'granted_at'), expiresAt: text(row, 'expires_at'),
    revokedAt: nullable(row, 'revoked_at'), revokedBy: nullable(row, 'revoked_by'), revokeReason: nullable(row, 'revoke_reason'),
  };
}

function fail(error: unknown, message: string): void {
  if (error) throw new Error(message);
}

export function holdsCompanyAccess(grants: readonly CapabilityGrant[]): boolean {
  return grants.some((item) => item.capability === 'account:manage' && item.scopeKind === 'platform' && item.scopeId === '');
}

/** Verify the authenticated subject immediately before any Company read or action. */
export async function requireCompanySubject(expected: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user?.id) throw new Error('Could not verify your signed-in account.');
  if (data.user.id !== expected) throw new Error('The signed-in account changed.');
  return data.user.id;
}

export async function loadCompanyAccounts(page = 0, db?: SupabaseClient): Promise<CompanyAccount[]> {
  const client = db ?? await cloud();
  const offset = Math.max(0, Math.floor(page)) * COMPANY_PAGE_SIZE;
  const { data, error } = await client.from('gtm_accounts')
    .select(ACCOUNT_COLUMNS)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + COMPANY_PAGE_SIZE - 1);
  fail(error, 'Could not load company accounts.');
  return rows(data).map(account);
}

export async function loadProcurementRequests(accountId: string, page = 0, db?: SupabaseClient): Promise<ProcurementRequest[]> {
  const client = db ?? await cloud();
  const offset = Math.max(0, Math.floor(page)) * COMPANY_PAGE_SIZE;
  const { data, error } = await client.from('trust_room_requests')
    .select(REQUEST_COLUMNS)
    .eq('account_id', accountId)
    .order('requested_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + COMPANY_PAGE_SIZE - 1);
  fail(error, 'Could not load procurement requests.');
  return rows(data).map(request);
}

export async function loadProcurementDetail(accountId: string, requestId: string, db?: SupabaseClient): Promise<ProcurementDetail> {
  const client = db ?? await cloud();
  const requestReply = await client.from('trust_room_requests')
    .select(REQUEST_COLUMNS)
    .eq('account_id', accountId)
    .eq('id', requestId)
    .maybeSingle();
  fail(requestReply.error, 'Could not load the procurement request.');
  const requestRow = object(requestReply.data);
  if (!requestRow) throw new Error('The procurement request is no longer visible.');

  const grantReply = await client.from('trust_room_grants')
    .select(GRANT_COLUMNS)
    .eq('request_id', requestId)
    .order('granted_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(50);
  fail(grantReply.error, 'Could not load access grants.');
  const grants = rows(grantReply.data).map(grant);
  if (grants.length === 0) return { request: request(requestRow), grants: [] };

  const grantIds = grants.map((item) => item.id);
  const itemReply = await client.from('trust_room_grant_items')
    .select(ITEM_COLUMNS)
    .in('grant_id', grantIds)
    .order('grant_id', { ascending: true })
    .order('version_id', { ascending: true })
    .limit(100);
  fail(itemReply.error, 'Could not load pinned document versions.');
  const itemRows = rows(itemReply.data);
  const versionIds = [...new Set(itemRows.map((item) => text(item, 'version_id')).filter(Boolean))];

  let versionRows: Row[] = [];
  let artifactRows: Row[] = [];
  if (versionIds.length > 0) {
    const versionReply = await client.from('trust_artifact_versions')
      .select(VERSION_COLUMNS)
      .in('id', versionIds)
      .order('id', { ascending: true })
      .limit(100);
    fail(versionReply.error, 'Could not load pinned document versions.');
    versionRows = rows(versionReply.data);
    const keys = [...new Set(versionRows.map((item) => text(item, 'artifact_key')).filter(Boolean))];
    if (keys.length > 0) {
      const artifactReply = await client.from('trust_artifacts')
        .select(ARTIFACT_COLUMNS)
        .in('key', keys)
        .order('key', { ascending: true })
        .limit(100);
      fail(artifactReply.error, 'Could not load document metadata.');
      artifactRows = rows(artifactReply.data);
    }
  }

  const accessReply = await client.from('trust_room_access_log')
    .select(ACCESS_COLUMNS)
    .in('grant_id', grantIds)
    .order('accessed_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(100);
  fail(accessReply.error, 'Could not load access history.');
  const accessRows = rows(accessReply.data);
  const versions = new Map(versionRows.map((item) => [text(item, 'id'), item]));
  const artifacts = new Map(artifactRows.map((item) => [text(item, 'key'), item]));

  const detailed = grants.map((base): ProcurementGrantDetail => ({
    ...base,
    items: itemRows.filter((item) => text(item, 'grant_id') === base.id).flatMap((item) => {
      const version = versions.get(text(item, 'version_id'));
      if (!version) return [];
      const artifactKey = text(version, 'artifact_key');
      const artifact = artifacts.get(artifactKey);
      return [{
        versionId: text(version, 'id'), artifactKey, title: artifact ? text(artifact, 'title') : artifactKey,
        tier: artifact ? text(artifact, 'tier') : 'unknown', version: text(version, 'version'),
        sourceCommit: nullable(version, 'source_commit'), publishedOn: text(version, 'published_on'), reviewOn: text(version, 'review_on'),
      }];
    }),
    accesses: accessRows.filter((item) => text(item, 'grant_id') === base.id).map((item) => ({
      id: text(item, 'id'), versionId: nullable(item, 'version_id'), accessedAt: text(item, 'accessed_at'),
    })),
  }));
  return { request: request(requestRow), grants: detailed };
}

export async function readProcurementGrant(grantId: string, db?: SupabaseClient): Promise<ProcurementGrant> {
  const client = db ?? await cloud();
  const { data, error } = await client.from('trust_room_grants')
    .select(GRANT_COLUMNS)
    .eq('id', grantId)
    .maybeSingle();
  fail(error, 'Could not read back the access grant.');
  const row = object(data);
  if (!row) throw new Error('The access grant is no longer visible.');
  return grant(row);
}

export async function revokeProcurementGrant(grantId: string, reason: string, db?: SupabaseClient): Promise<void> {
  if (!validWithdrawalReason(reason)) throw new Error('A withdrawal reason between 1 and 500 characters is required.');
  const client = db ?? await cloud();
  const { error } = await client.rpc('trust_room_revoke', { want_grant: grantId, want_reason: reason.trim() });
  if (error) throw new Error(error.message || 'Could not withdraw access.');
}

export function validWithdrawalReason(reason: string): boolean {
  const size = reason.trim().length;
  return size >= 1 && size <= 500;
}

async function within<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = globalThis.setTimeout(() => reject(new Error('outcome timeout')), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

export async function withdrawWithReadback(
  grantId: string,
  reason: string,
  subject: string,
  timeoutMs = 12_000,
  operations: {
    revoke: (grantId: string, reason: string) => Promise<void>;
    read: (grantId: string) => Promise<ProcurementGrant>;
  } = { revoke: revokeProcurementGrant, read: readProcurementGrant },
): Promise<WithdrawalOutcome> {
  try {
    await within(operations.revoke(grantId, reason.trim()), timeoutMs);
  } catch {
    // A compare-and-set refusal or a lost reply is reconciled below. Never retry the mutation.
  }
  let persisted: ProcurementGrant;
  try {
    persisted = await operations.read(grantId);
  } catch {
    return { kind: 'unknown', visibilityLost: true, live: null };
  }
  if (!persisted.revokedAt) return { kind: 'unknown', visibilityLost: false, live: true };
  return {
    kind: 'confirmed',
    concurrent: persisted.revokedBy !== subject || persisted.revokeReason !== reason.trim(),
    grant: persisted,
  };
}
