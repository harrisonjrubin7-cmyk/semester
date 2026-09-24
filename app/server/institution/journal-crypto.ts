import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SavedReview } from './journal.ts';

export function assertJournalKey(key: Buffer): void {
  if (key.length !== 32) throw new Error('The journal needs a 32-byte encryption key.');
}

/** AES-256-GCM, with the IV and authentication tag carried before the body. */
export function sealJournalRow(key: Buffer, value: unknown): string {
  assertJournalKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function openJournalRow<T>(key: Buffer, text: string): T {
  assertJournalKey(key);
  const data = Buffer.from(text, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'),
  ) as T;
}

/** The identity of an operation, excluding editable field values. */
export function journalOperation(row: SavedReview): string {
  return createHash('sha256')
    .update(JSON.stringify([
      row.identity.institutionId,
      row.identity.userId,
      row.input.area,
      row.input.recordId,
      row.input.actionId,
    ]))
    .digest('hex');
}
