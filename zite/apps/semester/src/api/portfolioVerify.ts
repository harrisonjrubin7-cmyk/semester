import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { VFY_MIGRATION } from '../lib/vfyMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of VFY_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const TOOK = ['Enrolled', 'Completed'];

export default createEndpoint({
  description: 'Verified portfolio evidence: a student asks an instructor of a section they took to verify a portfolio item; the instructor confirms or declines',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('request'), itemId: z.string(), sectionId: z.string() }),
    z.object({ action: z.literal('withdraw'), id: z.number().int() }),
    z.object({ action: z.literal('queue') }),
    z.object({ action: z.literal('decide'), id: z.number().int(), verify: z.boolean(), statement: z.string().max(300) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const me = a.userId, T = a.institutionId;
    await ensure();
    const call = async (q: string, p: unknown[]) => { const r = String(((await pg().query(q, p)) as Row[])[0].r); if (!r.startsWith('ok')) forbid(r); return r; };

    if (input.action === 'request') {
      const item = await zite.resources.findOne({ id: input.itemId });
      const owns = !!item && item.kind === 'Portfolio Item' && ids(item.owner).includes(me);
      const sec = await zite.sections.findOne({ id: input.sectionId });
      const took = !!sec && (await zite.enrollments.findAll({ filters: { student: me, section: input.sectionId }, limit: 5 })).records.some((e) => TOOK.includes(e.status ?? ''));
      const instructor = first(sec?.instructors) ?? '';
      await call(`SELECT vfy_request($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.itemId, owns, input.sectionId, instructor, took && !!instructor]);
      await zite.messages.create({ record: { body: `A student asked you to verify a portfolio item from ${(sec?.label ?? 'your section').split(' · ')[0]}. Open Semester Faculty → Today to answer.`, sender: me, recipients: [instructor], isNotification: true, read: false } as never });
      return { ok: true };
    }
    if (input.action === 'withdraw') { await call(`SELECT vfy_withdraw($1,$2,$3) AS r`, [me, T, input.id]); return { ok: true }; }
    if (input.action === 'decide') {
      if (!a.roles.includes('Faculty')) forbid('Only instructors verify portfolio evidence.');
      const r = ((await pg().query(`SELECT student_id FROM vfy_claims WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      await call(`SELECT vfy_decide($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.verify, input.statement]);
      await audit(a, input.verify ? 'Portfolio evidence verified' : 'Portfolio verification declined', `vfy:${input.id}`, '', 'Instructor');
      if (r) await zite.messages.create({ record: { body: input.verify ? 'An instructor verified one of your portfolio items. You decide whether to share it.' : 'An instructor declined to verify one of your portfolio items.', sender: me, recipients: [String(r.student_id)], isNotification: true, read: false } as never });
      return { ok: true };
    }
    if (input.action === 'queue') {
      if (!a.roles.includes('Faculty')) forbid('Only instructors verify portfolio evidence.');
      const rows = (await pg().query(`SELECT * FROM vfy_claims WHERE tenant_id = $1 AND instructor_id = $2 AND state = 'Requested' ORDER BY requested_at`, [T, me])) as Row[];
      const items = await Promise.all(rows.map((r) => zite.resources.findOne({ id: String(r.item_id) })));
      const secs = await Promise.all(rows.map((r) => zite.sections.findOne({ id: String(r.section_id) })));
      const names = await userNames(rows.map((r) => String(r.student_id)));
      return { requests: rows.map((r, i) => ({ id: Number(r.id), student: names[String(r.student_id)] ?? 'Student', section: (secs[i]?.label ?? '').split(' · ')[0],
        item: { title: items[i]?.title ?? 'Item', body: (items[i]?.body ?? '').slice(0, 2000) } })) };
    }
    // The student's own items, their claims, and the instructors they may ask (sections they took).
    const [items, enr] = await Promise.all([
      zite.resources.findAll({ filters: { owner: me, kind: 'Portfolio Item' }, limit: 200 }),
      zite.enrollments.findAll({ filters: { student: me }, limit: 300 }),
    ]);
    const took = enr.records.filter((e) => TOOK.includes(e.status ?? '')).map((e) => first(e.section)!).filter(Boolean);
    const secs = (await Promise.all([...new Set(took)].map((id) => zite.sections.findOne({ id })))).filter((s): s is NonNullable<typeof s> => !!s && ids(s.instructors).length > 0);
    const claims = (await pg().query(`SELECT * FROM vfy_claims WHERE tenant_id = $1 AND student_id = $2 ORDER BY requested_at DESC`, [T, me])) as Row[];
    const names = await userNames(claims.map((c) => String(c.instructor_id)));
    return {
      items: items.records.map((r) => ({ id: r.id, title: r.title ?? 'Untitled' })),
      sections: secs.map((s) => ({ id: s.id, label: (s.label ?? '').split(' · ')[0] })),
      claims: claims.map((c) => ({ id: Number(c.id), itemId: String(c.item_id), state: String(c.state), statement: String(c.statement), instructor: names[String(c.instructor_id)] ?? 'Instructor' })),
    };
  },
});
