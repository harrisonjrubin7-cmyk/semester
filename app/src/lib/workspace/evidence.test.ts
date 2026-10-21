import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The evidence client's contract with `20261023120000_career_evidence.sql`:
 * each RPC and its argument names, what is read back, the five ways a call
 * fails, and the share checks the server makes again.
 */

interface Reply {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const calls: { name: string; args?: unknown }[] = [];
const replies = new Map<string, Reply>();

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: (name: string, args?: unknown) => {
      calls.push({ name, args });
      return Promise.resolve(replies.get(name) ?? { data: null, error: null });
    },
  }),
}));

import {
  addEvidence,
  loadPortfolio,
  readEvidence,
  revokeEmployer,
  shareProblem,
  shareWithEmployer,
  sharedWithMe,
  withdrawEvidence,
  type ShareRequest,
} from './evidence';
import { ObjectsError } from './objects';
import { settled } from '../attempt';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const NOW = new Date('2026-10-21T12:00:00Z');
const SHARE: ShareRequest = {
  employerEmail: 'hiring@acme.example',
  employerScope: 'acme',
  evidence: ['e-1', 'e-1', 'e-2'],
  sharedAs: 'Sam Student',
  purpose: 'Graduate analyst interview',
  expiresAt: '2026-11-20T12:00:00Z',
};

async function failure(p: Promise<unknown>): Promise<ObjectsError> {
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ObjectsError);
  return e as ObjectsError;
}

describe('the student', () => {
  it('loads the portfolio: revision, evidence and who has access', async () => {
    replies.set('career_evidence_mine', {
      data: {
        revision: 3,
        evidence: [{ evidence: 'e-1', object: 'o-1', version: 'v-2', label: 'Capstone', title: 'Report', version_number: 2, saved_at: 's', added_at: 'a' }],
        grants: [{ grant: 'g-1', employer_email: 'hiring@acme.example', employer_scope: 'acme', shared_as: 'Sam', purpose: 'Interview', granted_at: 'g', expires_at: 'x', employer_active: true, evidence: ['e-1'] }],
      },
    });
    expect(await loadPortfolio()).toEqual({
      revision: 3,
      evidence: [{ id: 'e-1', object: 'o-1', version: 'v-2', label: 'Capstone', title: 'Report', versionNumber: 2, savedAt: 's', addedAt: 'a' }],
      access: [{ grant: 'g-1', employerEmail: 'hiring@acme.example', employerScope: 'acme', sharedAs: 'Sam', purpose: 'Interview', grantedAt: 'g', expiresAt: 'x', employerActive: true, evidence: ['e-1'] }],
    });
  });

  it('an employer who lost the role reads as inactive, not active', async () => {
    replies.set('career_evidence_mine', { data: { revision: 1, evidence: [], grants: [{ grant: 'g-1', employer_active: false, evidence: [] }] } });
    expect((await loadPortfolio()).access[0].employerActive).toBe(false);
  });

  it('adds and withdraws on the revision it read', async () => {
    replies.set('career_evidence_add', { data: { evidence: 'e-1', revision: 1 } });
    expect(await addEvidence('v-2', 'Capstone', 0, 'add.key-1')).toEqual({ evidence: 'e-1', revision: 1 });
    replies.set('career_evidence_withdraw', { data: { evidence: 'e-1', withdrawn_at: 'w', revision: 2 } });
    expect(await withdrawEvidence('e-1', 1, 'withdraw.key-1')).toEqual({ evidence: 'e-1', withdrawnAt: 'w', revision: 2 });
    expect(calls).toEqual([
      { name: 'career_evidence_add', args: { want_version: 'v-2', want_label: 'Capstone', want_expected_revision: 0, want_key: 'add.key-1' } },
      { name: 'career_evidence_withdraw', args: { want_evidence: 'e-1', want_expected_revision: 1, want_key: 'withdraw.key-1' } },
    ]);
  });

  it('shares named evidence once each, with every argument named', async () => {
    replies.set('career_evidence_grant', { data: { grant: 'g-1', expires_at: 'x', revision: 4 } });
    expect(await shareWithEmployer(SHARE, 3, 'grant.key-1')).toEqual({ grant: 'g-1', expiresAt: 'x', revision: 4 });
    expect(calls[0]).toEqual({
      name: 'career_evidence_grant',
      args: {
        want_employer_email: 'hiring@acme.example',
        want_employer_scope: 'acme',
        want_evidence: ['e-1', 'e-2'],
        want_shared_as: 'Sam Student',
        want_purpose: 'Graduate analyst interview',
        want_expires_at: '2026-11-20T12:00:00Z',
        want_expected_revision: 3,
        want_key: 'grant.key-1',
      },
    });
  });

  it('revokes by grant id on the revision it read', async () => {
    replies.set('career_evidence_revoke', { data: { grant: 'g-1', revoked_at: 'r', revision: 5 } });
    expect(await revokeEmployer('g-1', 4, 'revoke.key-1')).toEqual({ grant: 'g-1', revokedAt: 'r', revision: 5 });
    expect(calls[0]).toEqual({ name: 'career_evidence_revoke', args: { want_grant: 'g-1', want_expected_revision: 4, want_key: 'revoke.key-1' } });
  });
});

describe('the employer', () => {
  it('lists what was shared, item by item', async () => {
    replies.set('career_evidence_shared_with_me', {
      data: [{ grant: 'g-1', shared_as: 'Sam', purpose: 'Interview', employer_scope: 'acme', granted_at: 'g', expires_at: 'x', evidence: [{ evidence: 'e-1', label: 'Capstone', title: 'Report', version_number: 2, saved_at: 's' }] }],
    });
    expect(await sharedWithMe()).toEqual([
      { grant: 'g-1', sharedAs: 'Sam', purpose: 'Interview', employerScope: 'acme', grantedAt: 'g', expiresAt: 'x', evidence: [{ id: 'e-1', label: 'Capstone', title: 'Report', versionNumber: 2, savedAt: 's' }] },
    ]);
  });

  it('reads one item by grant and evidence id', async () => {
    replies.set('career_evidence_read', {
      data: { grant: 'g-1', evidence: 'e-1', label: 'Capstone', title: 'Report', body: 'Final.', mime_type: 'text/plain', content_schema: 'semester.text/1', version_number: 2, byte_length: 6, content_sha256: 'a'.repeat(64), saved_at: 's' },
    });
    const c = await readEvidence('g-1', 'e-1');
    expect(calls[0]).toEqual({ name: 'career_evidence_read', args: { want_grant: 'g-1', want_evidence: 'e-1' } });
    expect(c).toMatchObject({ body: 'Final.', versionNumber: 2, contentType: 'text/plain' });
    expect(Object.keys(c)).not.toContain('object');
  });

  it('a revoked or expired grant is refused as not found', async () => {
    replies.set('career_evidence_read', { error: { message: 'semester: no such evidence here', code: '42501' } });
    const e = await failure(readEvidence('g-1', 'e-1'));
    expect(e.kind).toBe('refused');
    expect(e.message).toBe('No such evidence here.');
    expect(settled(e)).toBe(true);
  });
});

describe('the ways a call fails', () => {
  it('stale says to reload', async () => {
    replies.set('career_evidence_revoke', { error: { message: 'semester: your portfolio changed since you read it', code: '40001' } });
    const e = await failure(revokeEmployer('g-1', 1, 'revoke.key-2'));
    expect(e.kind).toBe('stale');
    expect(e.message).toMatch(/changed since you opened it.*Reload/);
  });

  it('a reused key is a conflict', async () => {
    replies.set('career_evidence_grant', { error: { message: 'semester: that idempotency key was already used', code: '23505' } });
    expect((await failure(shareWithEmployer(SHARE, 1, 'grant.key-2'))).kind).toBe('conflict');
  });

  it('a database without the migration is not set up', async () => {
    replies.set('career_evidence_mine', { error: { message: 'Could not find the function', code: 'PGRST202' } });
    expect((await failure(loadPortfolio())).kind).toBe('not-set-up');
  });

  it('a lost answer is unknown, so the retry keeps its key', async () => {
    replies.set('career_evidence_add', { error: { message: 'Failed to fetch' } });
    const e = await failure(addEvidence('v-1', 'x', 0, 'add.key-2'));
    expect(e.kind).toBe('unknown');
    expect(settled(e)).toBe(false);
  });
});

describe('what can be shared', () => {
  it('accepts a complete share', () => {
    expect(shareProblem(SHARE, NOW)).toBeNull();
  });

  it('refuses what the server refuses', () => {
    expect(shareProblem({ ...SHARE, evidence: [] }, NOW)).toMatch(/at least one/);
    expect(shareProblem({ ...SHARE, evidence: Array.from({ length: 21 }, (_, i) => `e-${i}`) }, NOW)).toMatch(/at most 20/);
    expect(shareProblem({ ...SHARE, employerEmail: ' ' }, NOW)).toMatch(/address/);
    expect(shareProblem({ ...SHARE, sharedAs: 'x'.repeat(81) }, NOW)).toMatch(/80 characters/);
    expect(shareProblem({ ...SHARE, expiresAt: '2026-10-20T12:00:00Z' }, NOW)).toMatch(/when the share ends/);
    expect(shareProblem({ ...SHARE, expiresAt: '2027-04-20T12:00:01Z' }, NOW)).toMatch(/180 days/);
    expect(shareProblem({ ...SHARE, expiresAt: '2027-04-19T12:00:00Z' }, NOW)).toBeNull();
  });
});
