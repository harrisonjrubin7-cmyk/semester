// Server-only: community setup rules (lib/cmyMigration.ts) are created once per process.
import { pg } from './pg';
import { CMY_MIGRATION } from './cmyMigration';

let ready: Promise<void> | null = null;
export function ensureCmy() {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of CMY_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
}
