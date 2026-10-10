import { describe, expect, it } from 'vitest';
import { AttachmentCache, memoryBlobs, memoryStore, newKey, purgeDisallowedOfflineData, type CachedFile } from '@semester/offline-sync';
import { createAttachmentPolicyPurge, openOfflineAttachmentRuntime } from './attachments-runtime';

const NOW = 1_800_000_000_000;
const entity = (dataClass: string, id: string, value: unknown) => ({ dataClass, id, value, version: 1, phase: 'reconciled', fetchedAt: NOW });

describe('attachment policy cleanup integration', () => {
  it('rejects an invalid encryption key before opening persistence', async () => {
    let opens = 0;
    const factory = { open: () => { opens += 1; throw new Error('storage opened'); } } as unknown as IDBFactory;
    await expect(openOfflineAttachmentRuntime({
      enabled: true,
      identity: { tenantId: 't', userId: 'u', deviceId: 'd' },
      factory,
      dek: {} as CryptoKey,
      now: () => NOW,
    })).rejects.toThrow(/encryption key/);
    expect(opens).toBe(0);
  });

  it('rejects a genuine non-AES wrapping key before opening persistence', async () => {
    let opens = 0;
    const factory = { open: () => { opens += 1; throw new Error('storage opened'); } } as unknown as IDBFactory;
    const hmac = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    await expect(openOfflineAttachmentRuntime({
      enabled: true,
      identity: { tenantId: 't', userId: 'u', deviceId: 'd' },
      factory,
      dek: hmac,
      now: () => NOW,
    })).rejects.toThrow(/AES-GCM wrapping/);
    expect(opens).toBe(0);
  });

  it('removes only the exact source-class owner and preserves authored collisions and pending drafts', async () => {
    let files: CachedFile[] = [];
    const index = {
      load: async () => structuredClone(files),
      update: async <T>(change: (rows: CachedFile[]) => { rows: CachedFile[]; value: T }) => {
        const next = change(structuredClone(files)); files = structuredClone(next.rows); return next.value;
      },
    };
    const cache = new AttachmentCache({ dek: await newKey(), blobs: memoryBlobs(), index, now: () => NOW, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } });
    const put = (id: string, dataClass: 'grade' | 'personal_plan' | 'assignment_draft', ownerEntityId = 'shared-id') => cache.put({ id, tenantId: 't', dataClass, ownerEntityId, mime: 'text/plain', scan: 'clean', aclEpoch: 1, pinned: false }, new TextEncoder().encode(id));
    // Seed a prohibited legacy generation directly: current admission rightly
    // refuses creating a new official-grade attachment.
    const authored = await put('authored-file', 'personal_plan');
    await put('draft-file', 'assignment_draft', 'draft');
    files.unshift({ ...authored, id: 'issued-file', dataClass: 'grade', blobName: 'issued-generation' });

    const draft = { ...entity('assignment_draft', 'draft', { body: 'student work' }), phase: 'queued', commandId: 'legacy-command' };
    const plan = entity('personal_plan', 'shared-id', { budget: 'student plan' });
    const store = memoryStore({ initial: {
      entities: [entity('grade', 'shared-id', { score: 90 }), draft, plan] as never,
      outbox: [{ id: 'legacy-command', tenantId: 't', userId: 'u', deviceId: 'd', dataClass: 'assignment_draft', entityId: 'draft', op: 'patch', payload: {}, baseVersion: 1, hlc: { wall: NOW, counter: 0, node: 'd' }, policyVersion: '1', permissionEpoch: 0, createdAt: NOW, expiresAt: NOW + 1, seq: 1, phase: 'queued', attempts: 0, nextAttemptAt: NOW }] as never,
      cursors: {},
    } });
    await purgeDisallowedOfflineData(store, undefined, createAttachmentPolicyPurge(cache));

    expect(files.map((row) => row.id)).toEqual(['draft-file', 'authored-file']);
    expect(await store.entities.get('personal_plan', 'shared-id')).toMatchObject({ value: { budget: 'student plan' } });
    expect(await store.entities.get('assignment_draft', 'draft')).toMatchObject({ value: { body: 'student work' }, phase: 'draft' });
  });
});
