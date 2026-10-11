import { describe, expect, it } from 'vitest';
import { openAttachmentPersistence } from './attachments-idb';

const identity = { tenantId: 'synthetic-tenant', userId: 'synthetic-user', deviceId: 'synthetic-device' };

describe('offline attachment adapter activation', () => {
  it('is inert unless explicitly enabled', async () => {
    let opens = 0;
    const factory = { open: () => { opens += 1; throw new Error('storage opened'); } } as unknown as IDBFactory;
    await expect(openAttachmentPersistence({ enabled: false, factory })).resolves.toBeUndefined();
    expect(opens).toBe(0);
  });

  it('rejects a missing current identity before opening storage', async () => {
    let opens = 0;
    const factory = { open: () => { opens += 1; throw new Error('storage opened'); } } as unknown as IDBFactory;
    await expect(openAttachmentPersistence({ enabled: true, identity: { ...identity, userId: '' }, factory })).rejects.toThrow(/current identity scope/);
    expect(opens).toBe(0);
  });
});
