import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The workspace objects client's contract with
 * `20261022120000_workspace_objects.sql`: each RPC and its argument names, the
 * receipt read back, and the five ways a call can fail — stale (40001),
 * conflict (23505), not set up (the function is not there), refused in the
 * server's words, and unknown when no answer came back.
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

import { contentProblem, createObject, listMine, ObjectsError, readVersion, revoke, saveVersion, share } from './objects';
import { settled } from '../attempt';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const HASH = 'b'.repeat(64);
const TEXT = { title: 'Essay on Hume', body: 'First draft.', contentType: 'text/plain', contentSchema: 'semester.text/1' } as const;
const RECEIPT = { object: 'o-1', version: 'v-2', version_number: 2, revision: 2, content_sha256: HASH, byte_length: 12, saved_at: '2026-10-20T12:00:00Z' };

async function failure(p: Promise<unknown>): Promise<ObjectsError> {
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ObjectsError);
  return e as ObjectsError;
}

describe('making and saving', () => {
  it('creates through workspace_object_create with every argument named', async () => {
    replies.set('workspace_object_create', { data: { ...RECEIPT, version: 'v-1', version_number: 1, revision: 1 } });
    const r = await createObject('document', TEXT, 'create.key-1');
    expect(calls).toEqual([
      {
        name: 'workspace_object_create',
        args: { want_kind: 'document', want_title: 'Essay on Hume', want_body: 'First draft.', want_mime: 'text/plain', want_schema: 'semester.text/1', want_key: 'create.key-1' },
      },
    ]);
    expect(r).toEqual({ object: 'o-1', version: 'v-1', versionNumber: 1, revision: 1, sha256: HASH, byteLength: 12, savedAt: '2026-10-20T12:00:00Z' });
  });

  it('saves on the revision it read, and reads the receipt', async () => {
    replies.set('workspace_object_save', { data: RECEIPT });
    const r = await saveVersion('o-1', 1, TEXT, 'save.key-1');
    expect(calls[0]).toEqual({
      name: 'workspace_object_save',
      args: { want_object: 'o-1', want_expected_revision: 1, want_title: 'Essay on Hume', want_body: 'First draft.', want_mime: 'text/plain', want_schema: 'semester.text/1', want_key: 'save.key-1' },
    });
    expect(r.versionNumber).toBe(2);
    expect(r.revision).toBe(2);
  });
});

describe('the ways a call fails', () => {
  it('a stale revision says to reload, and is settled', async () => {
    replies.set('workspace_object_save', { error: { message: 'semester: this changed since you read it; reload it before saving', code: '40001' } });
    const e = await failure(saveVersion('o-1', 1, TEXT, 'save.key-2'));
    expect(e.kind).toBe('stale');
    expect(e.message).toMatch(/changed since you opened it.*Reload/);
    expect(settled(e)).toBe(true);
  });

  it('a reused key is a conflict', async () => {
    replies.set('workspace_object_save', { error: { message: 'semester: that idempotency key was already used for a different request', code: '23505' } });
    expect((await failure(saveVersion('o-1', 1, TEXT, 'save.key-3'))).kind).toBe('conflict');
  });

  it('a database without the migration reads as not set up, not as an error', async () => {
    for (const code of ['PGRST202', '42883', 'PGRST205']) {
      replies.set('workspace_objects_mine', { error: { message: 'Could not find the function', code } });
      const e = await failure(listMine());
      expect(e.kind, code).toBe('not-set-up');
      expect(e.message).toMatch(/not set up at your school yet.*still on this device/);
    }
  });

  it('a refusal keeps the server’s sentence', async () => {
    replies.set('workspace_object_read', { error: { message: 'semester: no such object here', code: '42501' } });
    const e = await failure(readVersion('o-1'));
    expect(e.kind).toBe('refused');
    expect(e.message).toBe('No such object here.');
    expect(settled(e)).toBe(true);
  });

  it('a lost answer is unknown, so the retry keeps its key', async () => {
    replies.set('workspace_object_create', { error: { message: 'Failed to fetch' } });
    const e = await failure(createObject('note', TEXT, 'create.key-2'));
    expect(e.kind).toBe('unknown');
    expect(settled(e)).toBe(false);
  });

  it('the control: a call that succeeds throws nothing', async () => {
    replies.set('workspace_objects_mine', { data: [] });
    await expect(listMine()).resolves.toEqual([]);
  });
});

describe('reading', () => {
  it('lists your objects', async () => {
    replies.set('workspace_objects_mine', {
      data: [{ object: 'o-1', kind: 'document', title: 'Essay', revision: 3, version: 'v-3', updated_at: '2026-10-20T12:00:00Z' }],
    });
    expect(await listMine()).toEqual([{ id: 'o-1', kind: 'document', title: 'Essay', revision: 3, version: 'v-3', updatedAt: '2026-10-20T12:00:00Z' }]);
  });

  it('reads the current version when none is named', async () => {
    replies.set('workspace_object_read', {
      data: { object: 'o-1', kind: 'document', version: 'v-3', version_number: 3, title: 'Essay', body: 'Text', mime_type: 'text/plain', content_schema: 'semester.text/1', byte_length: 4, content_sha256: HASH, saved_at: 't', access: 'owner', revision: 3, current: true },
    });
    const v = await readVersion('o-1');
    expect(calls[0]).toEqual({ name: 'workspace_object_read', args: { want_object: 'o-1', want_version: null } });
    expect(v).toMatchObject({ versionNumber: 3, body: 'Text', access: 'owner', revision: 3, current: true });
  });

  it('a pinned version says nothing about the live object', async () => {
    replies.set('workspace_object_read', {
      data: { object: 'o-1', kind: 'document', version: 'v-1', version_number: 1, title: 'Essay', body: 'Old', mime_type: 'text/plain', content_schema: 'semester.text/1', byte_length: 3, content_sha256: HASH, saved_at: 't', access: 'read', revision: null, current: null },
    });
    const v = await readVersion('o-1', 'v-1');
    expect(v.revision).toBeNull();
    expect(v.current).toBeNull();
  });
});

describe('sharing', () => {
  it('shares one version with one person', async () => {
    replies.set('workspace_object_grant', { data: { grant: 'g-1', object: 'o-1', version: 'v-1', permission: 'read', expires_at: null, granted_at: 't' } });
    const g = await share({ objectId: 'o-1', versionId: 'v-1', grantee: 'u-2', permission: 'read', purpose: 'Tutor review', expiresAt: null }, 'grant.key-1');
    expect(calls[0]).toEqual({
      name: 'workspace_object_grant',
      args: { want_object: 'o-1', want_version: 'v-1', want_grantee: 'u-2', want_permission: 'read', want_purpose: 'Tutor review', want_expires_at: null, want_key: 'grant.key-1' },
    });
    expect(g).toEqual({ grant: 'g-1', object: 'o-1', version: 'v-1', permission: 'read', expiresAt: null, grantedAt: 't' });
  });

  it('revokes by grant id', async () => {
    replies.set('workspace_object_revoke', { data: { grant: 'g-1', revoked_at: 't' } });
    expect(await revoke('g-1')).toEqual({ grant: 'g-1', revokedAt: 't' });
    expect(calls[0]).toEqual({ name: 'workspace_object_revoke', args: { want_grant: 'g-1' } });
  });
});

describe('what can be saved', () => {
  it('accepts a titled plain-text version', () => {
    expect(contentProblem(TEXT)).toBeNull();
  });

  it('refuses what the server refuses', () => {
    expect(contentProblem({ ...TEXT, title: '  ' })).toMatch(/title/);
    expect(contentProblem({ ...TEXT, contentSchema: 'Semester Doc' })).toMatch(/schema/);
    expect(contentProblem({ ...TEXT, contentType: 'application/json', body: '{nope' })).toMatch(/not JSON/);
    expect(contentProblem({ ...TEXT, body: 'x'.repeat(1_048_577) })).toMatch(/1 MB/);
    // Bytes, not characters: 349,526 three-byte characters are over a mebibyte.
    expect(contentProblem({ ...TEXT, body: '€'.repeat(349_526) })).toMatch(/1 MB/);
    expect(contentProblem({ ...TEXT, body: '€'.repeat(349_525) })).toBeNull();
  });
});
