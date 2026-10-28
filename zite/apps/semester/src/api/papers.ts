import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { PPR_MIGRATION } from '../lib/pprMigration';
import { SGD_MIGRATION } from '../lib/sgdMigration';

// Practice papers: attempts on a study guide you can read. Private to the student; a practice record, not a grade.
type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...SGD_MIGRATION, ...PPR_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

export default createEndpoint({
  description: 'Practice papers: record and list your own timed attempts on a study guide',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('record'), guideId: z.number().int(), seed: z.number().int(), minutes: z.number().int(), usedSeconds: z.number().int(),
      objective: z.number().int(), objectiveMax: z.number().int(), written: z.number().int().nullable(), writtenMax: z.number().int(), timedOut: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const T = (await requireAccess(me)).institutionId;
    if (input.action === 'record') {
      const g = ((await sql.query(`SELECT owner_id, section_id, published FROM sgd_guides WHERE id = $1 AND tenant_id = $2`, [input.guideId, T])) as Row[])[0];
      let can = false;
      if (g) {
        if (g.owner_id === me) can = true;
        else if (g.published && g.section_id) {
          const scope = await tenantScope(T);
          const s = String(g.section_id);
          const enrolled = (await zite.enrollments.findAll({ filters: { student: me }, limit: 500 })).records.some((e) => (e.status === 'Enrolled' || e.status === 'Completed') && first(e.section) === s);
          const teaching = scope.sections.has(s) && ids((await zite.sections.findOne({ id: s }))?.instructors).includes(me);
          can = enrolled || teaching;
        }
      }
      const r = String(((await sql.query(`SELECT ppr_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS r`,
        [me, T, input.guideId, can, input.seed, input.minutes, input.usedSeconds, input.objective, input.objectiveMax, input.written, input.writtenMax, input.timedOut])) as Row[])[0].r ?? '');
      if (!r.startsWith('ok:')) forbid(r);
    }
    const rows = (await sql.query(`SELECT id, guide_id, seed, minutes, used_seconds, objective, objective_max, written, written_max, timed_out, at FROM ppr_attempts WHERE tenant_id = $1 AND student_id = $2 ORDER BY at DESC LIMIT 200`, [T, me])) as Row[];
    return { attempts: rows.map((r) => ({ id: Number(r.id), guideId: Number(r.guide_id), seed: Number(r.seed), minutes: Number(r.minutes), usedSeconds: Number(r.used_seconds), objective: Number(r.objective), objectiveMax: Number(r.objective_max),
      written: r.written === null ? null : Number(r.written), writtenMax: Number(r.written_max), timedOut: !!r.timed_out, at: new Date(String(r.at)).toISOString() })) };
  },
});
