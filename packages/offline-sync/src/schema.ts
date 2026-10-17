/**
 * The on-device database. SQLCipher on iOS and Android; the web client keeps
 * the same shape behind an encrypted IndexedDB adapter and is labelled a
 * lower-assurance store until security review approves it as equivalent.
 *
 * One database per environment + tenant + person + device installation. The
 * file is never copied between devices and never backed up: exclude it from
 * iCloud and Android auto-backup, or the key's hardware binding means nothing.
 */

/**
 * Applied in this order, on the connection, before any other statement.
 *
 * The key is a random 256-bit value unwrapped from the hardware KEK, given as a
 * raw key so no password KDF is in the path. KDF and page-size settings are
 * deliberately not set here: the contract requires starting from SQLCipher's
 * supported defaults and recording measured unlock latency on the slowest
 * supported physical devices before changing any of them.
 */
export function openSequence(rawKeyHex: string): string[] {
  if (!/^[0-9a-f]{64}$/i.test(rawKeyHex)) throw new RangeError('key must be 64 hex characters (256 bits)')
  return [
    `PRAGMA key = "x'${rawKeyHex}'"`,
    'PRAGMA cipher_memory_security = ON',
    'PRAGMA journal_mode = WAL',
    'PRAGMA secure_delete = ON',
    'PRAGMA foreign_keys = ON',
    // Fails with "file is not a database" on a wrong key, before anything is trusted.
    'SELECT count(*) FROM sqlite_master',
  ]
}

export const SCHEMA_VERSION = 2

export const DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS schema_meta (
     k TEXT PRIMARY KEY, v TEXT NOT NULL
   ) WITHOUT ROWID`,

  // One row per record the device holds. `phase` is the queue phase; the screen derives its label from it.
  `CREATE TABLE IF NOT EXISTS entities (
     data_class TEXT NOT NULL,
     id TEXT NOT NULL,
     value_json TEXT,
     confirmed_json TEXT,
     version INTEGER,
     phase TEXT NOT NULL CHECK (phase IN ('draft','queued','sent','pending_reconciliation','acknowledged','reconciled','rejected','conflict_requires_copy')),
     fetched_at INTEGER NOT NULL,
     command_id TEXT,
     evidence_json TEXT,
     PRIMARY KEY (data_class, id)
   ) WITHOUT ROWID`,

  // The command queue. `id` is the idempotency key and survives every retry.
  `CREATE TABLE IF NOT EXISTS outbox (
     id TEXT PRIMARY KEY,
     seq INTEGER NOT NULL UNIQUE,
     tenant_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     device_id TEXT NOT NULL,
     data_class TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     op TEXT NOT NULL CHECK (op IN ('create','patch','delete','submit')),
     payload_json TEXT NOT NULL,
     base_version INTEGER,
     hlc TEXT NOT NULL,
     policy_version TEXT NOT NULL,
     permission_epoch INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     phase TEXT NOT NULL CHECK (phase IN ('draft','queued','sent','pending_reconciliation','rejected','conflict_requires_copy')),
     attempts INTEGER NOT NULL DEFAULT 0,
     next_attempt_at INTEGER NOT NULL,
     confirmed_at INTEGER,
     reject_reason TEXT,
     detail TEXT,
     conflict_json TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS outbox_due ON outbox (phase, next_attempt_at)`,
  `CREATE INDEX IF NOT EXISTS outbox_entity ON outbox (data_class, entity_id)`,

  `CREATE TABLE IF NOT EXISTS cursors (
     scope TEXT PRIMARY KEY, cursor TEXT NOT NULL
   ) WITHOUT ROWID`,

  // Collaborative documents: the append-only update log and the last verified snapshot.
  `CREATE TABLE IF NOT EXISTS crdt_updates (
     doc_id TEXT NOT NULL,
     update_id TEXT NOT NULL,
     payload BLOB NOT NULL,
     sent INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (doc_id, update_id)
   ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS crdt_snapshots (
     doc_id TEXT PRIMARY KEY,
     state_vector_json TEXT NOT NULL,
     snapshot BLOB NOT NULL,
     taken_at INTEGER NOT NULL
   ) WITHOUT ROWID`,

  // Cached files: ciphertext lives in the files directory; only the wrapped key and facts live here.
  `CREATE TABLE IF NOT EXISTS attachments (
     id TEXT NOT NULL,
     tenant_id TEXT NOT NULL,
     data_class TEXT NOT NULL,
     owner_entity_id TEXT NOT NULL,
     mime TEXT NOT NULL,
     size INTEGER NOT NULL,
     content_sha256 TEXT NOT NULL,
     scan TEXT NOT NULL CHECK (scan IN ('clean','pending','infected','unscannable')),
     acl_epoch INTEGER NOT NULL,
     fetched_at INTEGER NOT NULL,
     last_read_at INTEGER NOT NULL,
     pinned INTEGER NOT NULL DEFAULT 0,
     wrapped_key BLOB NOT NULL,
     blob_name TEXT PRIMARY KEY,
     retired INTEGER NOT NULL DEFAULT 0
   ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS attachments_owner ON attachments (owner_entity_id)`,

  `INSERT OR IGNORE INTO schema_meta (k, v) VALUES ('schema_version', '${SCHEMA_VERSION}')`,
]

/**
 * Upgrades are forward-only and run in one transaction, after a backup of the
 * encrypted file is *not* taken (a plaintext-adjacent copy is a leak). A
 * failed migration therefore must leave the old schema intact, and the queue
 * must be drained or carried across: no command may be lost to an upgrade.
 */
export const MIGRATIONS: Record<number, readonly string[]> = {
  2: [
    `ALTER TABLE attachments RENAME TO attachments_v1`,
    `CREATE TABLE attachments (
       id TEXT NOT NULL,
       tenant_id TEXT NOT NULL,
       data_class TEXT NOT NULL,
       owner_entity_id TEXT NOT NULL,
       mime TEXT NOT NULL,
       size INTEGER NOT NULL,
       content_sha256 TEXT NOT NULL,
       scan TEXT NOT NULL CHECK (scan IN ('clean','pending','infected','unscannable')),
       acl_epoch INTEGER NOT NULL,
       fetched_at INTEGER NOT NULL,
       last_read_at INTEGER NOT NULL,
       pinned INTEGER NOT NULL DEFAULT 0,
       wrapped_key BLOB NOT NULL,
       blob_name TEXT PRIMARY KEY,
       retired INTEGER NOT NULL DEFAULT 0
     ) WITHOUT ROWID`,
    `INSERT INTO attachments (
       id, tenant_id, data_class, owner_entity_id, mime, size,
       content_sha256, scan, acl_epoch, fetched_at, last_read_at,
       pinned, wrapped_key, blob_name, retired
     )
     SELECT id, tenant_id, data_class, owner_entity_id, mime, size,
       content_sha256, scan, acl_epoch, fetched_at, last_read_at,
       pinned, wrapped_key, blob_name, 0
     FROM attachments_v1`,
    `DROP TABLE attachments_v1`,
    `CREATE INDEX IF NOT EXISTS attachments_owner ON attachments (owner_entity_id)`,
    `UPDATE schema_meta SET v = '2' WHERE k = 'schema_version'`,
  ],
}
