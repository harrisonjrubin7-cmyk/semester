import { pg } from './pg';
import { CAL_MIGRATION } from './calMigration';
import { CAT_MIGRATION } from './catMigration';

let ready: Promise<void> | null = null;
export const ensureCal = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of [...CAL_MIGRATION, ...CAT_MIGRATION]) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
export type Window = 'none' | 'not_yet' | 'open' | 'closed';
export async function registrationWindow(tenant: string, term: string): Promise<Window> {
  await ensureCal();
  return String(((await pg().query(`SELECT cal_window($1,$2) AS w`, [tenant, term])) as { w: string }[])[0].w) as Window;
}
/** Approved per-term credit limit, or null when no registration rules are approved (no limit). */
export async function maxCredits(tenant: string): Promise<number | null> {
  await ensureCal();
  const v = ((await pg().query(`SELECT cat_max_credits($1) AS m`, [tenant])) as { m: string | null }[])[0].m;
  return v == null ? null : Number(v);
}
