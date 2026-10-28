// Server-only helpers for the career partnership tables (lib/crrMigration.ts).
import { pg } from './pg';
import { CRR_MIGRATION } from './crrMigration';

let ready: Promise<void> | null = null;
export const ensureCrr = () => { if (!ready) ready = (async () => { for (const q of CRR_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

/** Employers this institution has approved to reach its students. */
export async function approvedEmployers(tenantId: string): Promise<Set<string>> {
  await ensureCrr();
  const rows = (await pg().query(`SELECT employer_id FROM crr_partners WHERE tenant_id = $1 AND status = 'Approved'`, [tenantId])) as { employer_id: string }[];
  return new Set(rows.map((r) => r.employer_id));
}
