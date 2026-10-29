import { ZiteError } from 'zitejs/backend';
import { pg } from './pg';
import { SREQ_MIGRATION } from './sreqMigration';
import { TCP_MIGRATION, TCP_MODULES } from './tcpMigration';

export type TcpModule = (typeof TCP_MODULES)[number];
let ready: Promise<void> | null = null;
export const ensureTcpSchema = () => { if (!ready) ready = (async () => { for (const q of [...SREQ_MIGRATION, ...TCP_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

/** Asks the control plane whether a module is on for this institution and these roles (tcp_gate), and with consume:true
 *  counts one call against the daily quota (tcp_consume). Refuses with the plain reason. Fails closed if the check cannot run.
 *  External audiences (e.g. research partners) pass roles [] and need the module rolled out to everyone. */
export async function requireModule(tenantId: string, module: TcpModule, roles: string[], opts: { consume?: boolean } = {}) {
  let why: string | null;
  try {
    await ensureTcpSchema();
    const sql = pg();
    why = ((await sql.query(`SELECT tcp_gate($1,$2,$3::text[]) AS r`, [tenantId, module, roles])) as { r: string | null }[])[0].r;
    if (!why && opts.consume) why = ((await sql.query(`SELECT tcp_consume($1,$2) AS r`, [tenantId, module])) as { r: string | null }[])[0].r;
  } catch {
    why = 'This feature is unavailable right now. Try again in a moment.';
  }
  if (why) throw new ZiteError({ code: 'FORBIDDEN', message: `module:${module}:off`, userFacingMessage: why });
}

/** Non-throwing variant for filtering lists by institution. */
export async function moduleOn(tenantId: string, module: TcpModule, roles: string[]) {
  try { await ensureTcpSchema(); return ((await pg().query(`SELECT tcp_gate($1,$2,$3::text[]) AS r`, [tenantId, module, roles])) as { r: string | null }[])[0].r === null; }
  catch { return false; }
}
