import { describe, expect, it } from 'vitest'
import { DDL, MIGRATIONS, openSequence, SCHEMA_VERSION } from './schema.ts'
import type { QueuePhase } from './status.ts'

const key = 'ab'.repeat(32)

describe('openSequence', () => {
  it('sets the key before anything else, as a raw 256-bit key, and then proves it', () => {
    const s = openSequence(key)
    expect(s[0]).toBe(`PRAGMA key = "x'${key}'"`)
    expect(s.at(-1)).toMatch(/sqlite_master/)
    expect(s).toContain('PRAGMA cipher_memory_security = ON')
    expect(s).toContain('PRAGMA secure_delete = ON')
  })
  it('refuses a key that is not 256 random bits', () => {
    for (const bad of ['', 'short', 'zz'.repeat(32), 'ab'.repeat(31), 'ab'.repeat(33)]) expect(() => openSequence(bad), bad).toThrow()
  })
  it('does not pick KDF or page-size values on its own — those wait for device benchmarks', () => {
    expect(openSequence(key).join('\n')).not.toMatch(/kdf_iter|cipher_page_size|cipher_compatibility/)
  })
})

describe('the schema', () => {
  it('allows exactly the queue phases the engine uses', () => {
    const entityPhases: QueuePhase[] = ['draft', 'queued', 'sent', 'pending_reconciliation', 'acknowledged', 'reconciled', 'rejected', 'conflict_requires_copy']
    const ddl = DDL.join('\n')
    for (const p of entityPhases) expect(ddl).toContain(`'${p}'`)
  })

  it('builds, and keeps the idempotency key unique, on a real SQLite', async () => {
    let sqlite: typeof import('node:sqlite') | undefined
    try { sqlite = await import('node:sqlite') } catch { return }
    const db = new sqlite.DatabaseSync(':memory:')
    for (const stmt of DDL) db.exec(stmt)
    expect((db.prepare("SELECT v FROM schema_meta WHERE k='schema_version'").get() as { v: string }).v).toBe(String(SCHEMA_VERSION))
    const ins = db.prepare(`INSERT INTO outbox (id, seq, tenant_id, user_id, device_id, data_class, entity_id, op, payload_json, hlc, policy_version, permission_epoch, created_at, expires_at, phase, next_attempt_at) VALUES (?, ?, 't','u','d','task','e','patch','{}','h','1',0,0,1,'queued',0)`)
    ins.run('k1', 1)
    expect(() => ins.run('k1', 2)).toThrow()
    expect(() => db.exec("UPDATE outbox SET phase='synced'")).toThrow()
    expect(() => db.exec("UPDATE outbox SET phase='acknowledged'")).toThrow() // an acknowledged row is deleted, never kept
    db.close()
  })

  it('keys attachment cleanup state by generation and persists retirement', () => {
    const ddl = DDL.join('\n')
    expect(ddl).toMatch(/attachments[\s\S]*blob_name TEXT PRIMARY KEY/)
    expect(ddl).toMatch(/attachments[\s\S]*retired INTEGER NOT NULL DEFAULT 0/)
    expect(MIGRATIONS[SCHEMA_VERSION]?.join('\n')).toMatch(/attachments_v1[\s\S]*retired/)
  })

  it('migrates a v1 attachment index without losing its cleanup identity', async () => {
    let sqlite: typeof import('node:sqlite') | undefined
    try { sqlite = await import('node:sqlite') } catch { return }
    const db = new sqlite.DatabaseSync(':memory:')
    db.exec("CREATE TABLE schema_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID")
    db.exec("INSERT INTO schema_meta VALUES ('schema_version', '1')")
    db.exec(`CREATE TABLE attachments (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data_class TEXT NOT NULL,
      owner_entity_id TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
      content_sha256 TEXT NOT NULL, scan TEXT NOT NULL, acl_epoch INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL, last_read_at INTEGER NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0, wrapped_key BLOB NOT NULL,
      blob_name TEXT NOT NULL
    ) WITHOUT ROWID`)
    db.exec("INSERT INTO attachments VALUES ('f','t','course_content','c','text/plain',1,'sha','clean',1,1,1,0,x'00','f.old')")
    for (const stmt of MIGRATIONS[2]!) db.exec(stmt)
    expect(db.prepare("SELECT blob_name, retired FROM attachments").get()).toEqual({ blob_name: 'f.old', retired: 0 })
    db.exec("INSERT INTO attachments VALUES ('f','t','course_content','c','text/plain',1,'sha','clean',1,1,1,0,x'00','f.new',1)")
    expect(db.prepare("SELECT count(*) AS n FROM attachments WHERE id='f'").get()).toEqual({ n: 2 })
    expect(db.prepare("SELECT v FROM schema_meta WHERE k='schema_version'").get()).toEqual({ v: '2' })
    db.close()
  })
})
