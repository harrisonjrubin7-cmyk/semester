import { neon } from '@neondatabase/serverless';
import { zite } from 'zitejs/db';
import { MIGRATION_001 } from './pgMigration';
import { SER_MIGRATION } from './serMigration';
import { DEV_MIGRATION } from './devMigration';

// Controlled backend for invariant-bearing writes. Server-only: the connection string never reaches the browser.
let ready: Promise<void> | null = null;

export function pg() {
  return neon(process.env.ZITE_POSTGRES_URL as string);
}

export function ensureSchema() {
  if (!ready) {
    const sql = pg();
    ready = (async () => { for (const stmt of [...MIGRATION_001, ...SER_MIGRATION]) await sql.query(stmt); })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Row = { id: number; tenant_id: string; command_key: string; topic: string; payload: { requestId: string; state: string; resultCode: string; message: string; student?: string; section?: string; drop?: string; add?: string | null } };

async function setSeat(student: string, section: string, status: 'Enrolled' | 'Dropped') {
  const found = await zite.enrollments.findAll({ filters: { student, section }, limit: 5 });
  const live = found.records.find((e) => e.status !== 'Dropped') ?? found.records[0];
  if (live) await zite.enrollments.update({ id: live.id, record: { status, ...(status === 'Enrolled' ? { source: 'Official' } : {}) } as never });
  else if (status === 'Enrolled') await zite.enrollments.create({ record: { label: 'Registrar ledger', student, section, status, source: 'Official' } as never });
}

/** Applies one outbox entry to Zite. Idempotent: re-running writes the same values. */
async function apply(row: Row) {
  if (row.topic === 'reg.seat') {
    // Drop/swap/waitlist promotion (lib/wlMigration.ts). Idempotent: sets the same status again.
    const p = row.payload;
    if (p.drop) await setSeat(p.student!, p.drop, 'Dropped');
    if (p.add) await setSeat(p.student!, p.add, 'Enrolled');
    if (p.section) await setSeat(p.student!, p.section, 'Enrolled');
    return;
  }
  const { requestId, state, resultCode, message } = row.payload;
  const req = await zite.registrationRequests.findOne({ id: requestId });
  if (!req) throw new Error('Request not found in Zite');
  await zite.registrationRequests.update({ id: requestId, record: { state, resultCode, safeExplanation: message } as never });
  const enrollment = Array.isArray(req.enrollment) ? req.enrollment[0] : req.enrollment;
  if (state === 'Committed' && enrollment) await zite.enrollments.update({ id: enrollment, record: { status: 'Enrolled', source: 'Official' } as never });
}

/** Dispatches pending outbox rows. Failures stay pending with the error recorded, for reconciliation. */
export async function dispatchOutbox(tenantId: string, commandKey?: string) {
  const sql = pg();
  const rows = (commandKey
    ? await sql.query(`SELECT id, tenant_id, command_key, topic, payload FROM reg_outbox WHERE status = 'pending' AND tenant_id = $1 AND command_key = $2`, [tenantId, commandKey])
    : await sql.query(`SELECT id, tenant_id, command_key, topic, payload FROM reg_outbox WHERE status = 'pending' AND tenant_id = $1 ORDER BY id LIMIT 50`, [tenantId])) as Row[];
  let dispatched = 0, failed = 0;
  for (const row of rows) {
    try {
      await apply(row);
      await sql.query(`UPDATE reg_outbox SET status = 'dispatched', dispatched_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1`, [row.id]);
      dispatched++;
    } catch (e) {
      await sql.query(`UPDATE reg_outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1`, [row.id, String(e instanceof Error ? e.message : e).slice(0, 300)]);
      failed++;
    }
  }
  return { dispatched, failed };
}

let devReady: Promise<void> | null = null;
export function ensureDevSchema() {
  if (!devReady) {
    const sql = pg();
    devReady = (async () => { for (const s of DEV_MIGRATION) await sql.query(s); })().catch((e) => { devReady = null; throw e; });
  }
  return devReady;
}
