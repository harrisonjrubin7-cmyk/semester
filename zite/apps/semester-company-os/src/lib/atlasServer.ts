import { pg } from './fin';
import { CO_ROLE_STATEMENTS } from './coRoles';
import { ATL_MIGRATION } from './atlMigration';

let ready: Promise<void> | null = null;
/** Applies co-roles then atl-001 once per instance (both idempotent). */
export function ensureAtlas() {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of [...CO_ROLE_STATEMENTS, ...ATL_MIGRATION]) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
}
