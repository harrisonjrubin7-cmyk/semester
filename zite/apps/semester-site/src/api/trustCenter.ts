import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { pg } from '../lib/pg';
import { TRUST_MIGRATION } from '../lib/trustSeed';

let ready: Promise<void> | null = null;
const ensure = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of TRUST_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};

const STATUS = ['In place', 'Verified in test', 'In progress', 'Not yet in place'] as const;

export default createEndpoint({
  description: 'Public site: reads Trust Center controls, subprocessors and approved public incident notices',
  inputSchema: z.object({}),
  outputSchema: z.object({
    controls: z.array(z.object({ section: z.string(), control: z.string(), status: z.enum(STATUS), detail: z.string(), reviewedOn: z.string() })),
    subprocessors: z.array(z.object({ name: z.string(), purpose: z.string(), addedOn: z.string() })),
    notices: z.array(z.object({ title: z.string(), state: z.string(), body: z.string(), postedAt: z.string() })),
  }),
  execute: async () => {
    await ensure();
    const sql = pg();
    const [controls, subs, hasInc] = await Promise.all([
      sql.query(`SELECT section, control, status, detail, to_char(reviewed_on,'YYYY-MM-DD') AS "reviewedOn" FROM site_trust_controls ORDER BY sort, control`),
      sql.query(`SELECT name, purpose, to_char(added_on,'YYYY-MM-DD') AS "addedOn" FROM site_subprocessors WHERE active ORDER BY added_on, name`),
      sql.query(`SELECT to_regclass('inc_notices') IS NOT NULL AS ok`),
    ]);
    // Only notices Company OS approved (two people) for a public audience. Nothing internal is exposed.
    const notices = (hasInc as { ok: boolean }[])[0]?.ok
      ? await sql.query(`SELECT i.title, i.state, n.body, to_char(n.created_at,'YYYY-MM-DD') AS "postedAt"
          FROM inc_notices n JOIN inc_incidents i ON i.id = n.incident_id
          WHERE n.status = 'approved' AND n.audience ILIKE 'public%' AND n.created_at > now() - interval '90 days'
          ORDER BY n.created_at DESC LIMIT 20`)
      : [];
    return { controls, subprocessors: subs, notices } as never;
  },
});
