import { pg } from './pg';
import { PLT_MIGRATION } from './pltMigration';
import { OBX_MIGRATION } from './obxMigration';

// Shared platform helpers (backlog C3/C4): permission epochs and command receipts. Server-only.
let ready: Promise<void> | null = null;
export const ensurePlt = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of [...PLT_MIGRATION, ...OBX_MIGRATION]) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
export async function currentEpoch(tenant: string, user: string): Promise<number> {
  await ensurePlt();
  return Number(((await pg().query(`SELECT plt_epoch($1,$2) AS v`, [tenant, user])) as { v: number }[])[0].v);
}
/** Call whenever someone's membership or roles change: their open screens and queued commands stop working. */
export async function bumpEpoch(tenant: string, user: string, reason: string) {
  await ensurePlt();
  await pg().query(`SELECT plt_bump($1,$2,$3)`, [tenant, user, reason]);
}
/** Deliver pending outbox events for one institution (at-least-once, idempotent handlers). Best-effort when called inline. */
export async function processOutbox(tenant: string, limit = 50): Promise<{ delivered: number; retrying: number; dead: number }> {
  await ensurePlt();
  return ((await pg().query(`SELECT plt_process($1,$2) AS r`, [tenant, limit])) as { r: { delivered: number; retrying: number; dead: number } }[])[0].r;
}
