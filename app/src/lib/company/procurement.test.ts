import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Reply { data?: unknown; error?: { message: string } | null }

const calls: { kind: 'from' | 'rpc'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply[]>();
const auth = {
  getUser: vi.fn(async () => ({ data: { user: { id: 'account-team-1' } }, error: null })),
};

function take(key: string): Reply {
  const queue = replies.get(key) ?? [];
  return queue.shift() ?? { data: null, error: null };
}

function chain(kind: 'from' | 'rpc', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const self: Record<string, unknown> = {
    then: (ok: (reply: Reply) => unknown, bad?: (error: unknown) => unknown) =>
      Promise.resolve(take(`${kind}:${name}`)).then(ok, bad),
  };
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'range', 'maybeSingle']) {
    self[method] = (...values: unknown[]) => {
      call.chain.push(`${method}(${values.map((value) => JSON.stringify(value)).join(',')})`);
      return self;
    };
  }
  return self;
}

vi.mock('../cloud', () => ({
  cloud: async () => ({
    auth,
    from: (name: string) => chain('from', name),
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
  }),
}));

import {
  holdsCompanyAccess,
  loadCompanyAccounts,
  loadProcurementDetail,
  loadProcurementRequests,
  readProcurementGrant,
  revokeProcurementGrant,
  requireCompanySubject,
  validWithdrawalReason,
  withdrawWithReadback,
} from './procurement';

const accountRow = {
  id: 'account-1', public_id: 'acct_north', name: 'North College', segment: 'regional', tenant_id: 'north',
  status: 'engaged', owner_id: null, created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-10T09:00:00Z',
};

const requestRow = {
  id: 'request-1', account_id: 'account-1', stakeholder_id: 'stakeholder-1', requester_name: '<Procurement Reviewer>',
  requester_email: 'reviewer@example.edu', requester_role: 'procurement', reason: '<script>review</script>',
  nda_signed_on: '2026-10-02', status: 'granted', requested_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-04T10:00:00Z',
};

const grantRow = {
  id: 'grant-1', request_id: 'request-1', packet_commit: 'a'.repeat(40), granted_by: 'account-team-2',
  granted_at: '2026-10-04T10:00:00Z', expires_at: '2026-10-20T10:00:00Z', revoked_at: null,
  revoked_by: null, revoke_reason: null,
};

beforeEach(() => {
  calls.length = 0;
  replies.clear();
  vi.clearAllMocks();
});

describe('Company authorization', () => {
  const grant = (capability: string, scopeKind: string, scopeId = '') => ({ capability, scopeKind, scopeId });

  it('accepts only account:manage at the exact platform scope', () => {
    expect(holdsCompanyAccess([grant('account:manage', 'platform')])).toBe(true);
    expect(holdsCompanyAccess([grant('account:manage', 'school', 'north')])).toBe(false);
    expect(holdsCompanyAccess([grant('console:operate', 'platform')])).toBe(false);
    expect(holdsCompanyAccess([grant('trust:publish', 'platform')])).toBe(false);
  });

  it('fails distinctly when auth cannot verify the current subject', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'session unavailable' } } as never);
    await expect(requireCompanySubject('account-team-1')).rejects.toThrow('Could not verify your signed-in account.');

    auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'someone-else' } }, error: null } as never);
    await expect(requireCompanySubject('account-team-1')).rejects.toThrow('The signed-in account changed.');
  });
});

describe('bounded procurement reads', () => {
  it('lists a bounded account page with deterministic ordering and explicit columns', async () => {
    replies.set('from:gtm_accounts', [{ data: [accountRow], error: null }]);
    expect(await loadCompanyAccounts()).toEqual([{
      id: 'account-1', publicId: 'acct_north', name: 'North College', segment: 'regional', tenantId: 'north',
      status: 'engaged', ownerId: null, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-10T09:00:00Z',
    }]);
    expect(calls[0].chain).toEqual([
      'select("id, public_id, name, segment, tenant_id, status, owner_id, created_at, updated_at")',
      'order("updated_at",{"ascending":false})', 'order("id",{"ascending":true})', 'range(0,49)',
    ]);

    replies.set('from:gtm_accounts', [{ data: [], error: null }]);
    await loadCompanyAccounts(2);
    expect(calls[1].chain).toContain('range(100,149)');
  });

  it('loads requests only for the selected account and never turns a read error into empty', async () => {
    replies.set('from:trust_room_requests', [{ data: [requestRow], error: null }]);
    const rows = await loadProcurementRequests('account-1');
    expect(rows[0]).toMatchObject({ id: 'request-1', accountId: 'account-1', requesterName: '<Procurement Reviewer>' });
    expect(calls[0].chain).toEqual([
      'select("id, account_id, stakeholder_id, requester_name, requester_email, requester_role, reason, nda_signed_on, status, requested_at, updated_at")',
      'eq("account_id","account-1")', 'order("requested_at",{"ascending":false})',
      'order("id",{"ascending":true})', 'range(0,49)',
    ]);

    replies.set('from:trust_room_requests', [{ data: null, error: { message: 'disconnected' } }]);
    await expect(loadProcurementRequests('account-1')).rejects.toThrow('Could not load procurement requests.');
  });

  it('joins grants to their exact pinned versions without reading storage refs or token hashes', async () => {
    replies.set('from:trust_room_requests', [{ data: requestRow, error: null }]);
    replies.set('from:trust_room_grants', [{ data: [grantRow], error: null }]);
    replies.set('from:trust_room_grant_items', [{ data: [{ grant_id: 'grant-1', version_id: 'version-1' }], error: null }]);
    replies.set('from:trust_artifact_versions', [{ data: [{
      id: 'version-1', artifact_key: 'hecvat', version: '1.0', source_commit: null,
      published_on: '2026-09-01', review_on: '2027-09-01', created_at: '2026-09-01T00:00:00Z',
    }], error: null }]);
    replies.set('from:trust_artifacts', [{ data: [{ key: 'hecvat', title: 'HECVAT readiness register', tier: 'nda' }], error: null }]);
    replies.set('from:trust_room_access_log', [{ data: [{
      id: 'access-1', grant_id: 'grant-1', version_id: null, accessed_at: '2026-10-05T10:00:00Z',
    }], error: null }]);

    const detail = await loadProcurementDetail('account-1', 'request-1');
    expect(detail.grants[0].items[0]).toEqual({
      versionId: 'version-1', artifactKey: 'hecvat', title: 'HECVAT readiness register', tier: 'nda',
      version: '1.0', sourceCommit: null, publishedOn: '2026-09-01', reviewOn: '2027-09-01',
    });
    expect(detail.grants[0].accesses[0]).toEqual({
      id: 'access-1', versionId: null, accessedAt: '2026-10-05T10:00:00Z',
    });

    const selections = calls.flatMap((call) => call.chain.filter((entry) => entry.startsWith('select('))).join('\n');
    expect(selections).not.toContain('token_sha256');
    expect(selections).not.toContain('storage_ref');
    const versionCall = calls.find((call) => call.name === 'trust_artifact_versions')!;
    expect(versionCall.chain).toContain('in("id",["version-1"])');
    expect(versionCall.chain).not.toContain('order("created_at",{"ascending":false})');
  });
});

describe('withdrawal reconciliation', () => {
  it('requires a non-blank reason no longer than the database contract', () => {
    expect(validWithdrawalReason('  unsupported evidence  ')).toBe(true);
    expect(validWithdrawalReason('   ')).toBe(false);
    expect(validWithdrawalReason('x'.repeat(501))).toBe(false);
  });

  it('refuses an invalid reason before the protected RPC boundary', async () => {
    await expect(revokeProcurementGrant('grant-1', '   ')).rejects.toThrow('reason');
    await expect(revokeProcurementGrant('grant-1', 'x'.repeat(501))).rejects.toThrow('reason');
    expect(calls.filter((call) => call.kind === 'rpc')).toHaveLength(0);
  });

  it('calls the protected RPC once and confirms the persisted actor, time and reason by readback', async () => {
    replies.set('rpc:trust_room_revoke', [{ data: null, error: null }]);
    replies.set('from:trust_room_grants', [{ data: {
      ...grantRow, revoked_at: '2026-10-11T22:00:00Z', revoked_by: 'account-team-1', revoke_reason: 'Evidence superseded',
    }, error: null }]);

    const outcome = await withdrawWithReadback('grant-1', 'Evidence superseded', 'account-team-1', 100);
    expect(outcome).toMatchObject({ kind: 'confirmed', concurrent: false, grant: {
      revokedAt: '2026-10-11T22:00:00Z', revokedBy: 'account-team-1', revokeReason: 'Evidence superseded',
    } });
    expect(calls.filter((call) => call.kind === 'rpc')).toEqual([{
      kind: 'rpc', name: 'trust_room_revoke',
      args: { want_grant: 'grant-1', want_reason: 'Evidence superseded' }, chain: [],
    }]);
  });

  it('recognizes another operator and never retries after a dropped mutation response', async () => {
    replies.set('from:trust_room_grants', [{ data: {
      ...grantRow, revoked_at: '2026-10-11T22:01:00Z', revoked_by: 'account-team-2', revoke_reason: 'Review expired',
    }, error: null }]);
    const never = new Promise<never>(() => {});
    const outcome = await withdrawWithReadback(
      'grant-1', 'Evidence superseded', 'account-team-1', 1,
      { revoke: () => never, read: readProcurementGrant },
    );
    expect(outcome).toMatchObject({ kind: 'confirmed', concurrent: true });
    expect(calls.filter((call) => call.kind === 'rpc')).toHaveLength(0);
  });

  it('keeps the outcome unknown when the grant is still live or visibility is lost', async () => {
    const live = { ...grantRow };
    const outcome = await withdrawWithReadback('grant-1', 'Evidence superseded', 'account-team-1', 100, {
      revoke: async () => { throw new Error('connection lost'); },
      read: async () => ({
        id: live.id, requestId: live.request_id, packetCommit: live.packet_commit, grantedBy: live.granted_by,
        grantedAt: live.granted_at, expiresAt: live.expires_at, revokedAt: null, revokedBy: null, revokeReason: null,
      }),
    });
    expect(outcome).toEqual({ kind: 'unknown', visibilityLost: false, live: true });

    const hidden = await withdrawWithReadback('grant-1', 'Evidence superseded', 'account-team-1', 100, {
      revoke: async () => { throw new Error('connection lost'); },
      read: async () => { throw new Error('not visible'); },
    });
    expect(hidden).toEqual({ kind: 'unknown', visibilityLost: true, live: null });
  });
});
