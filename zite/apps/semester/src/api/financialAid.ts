import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { FA_MIGRATION } from '../lib/faMigration';

let ready: Promise<void> | null = null;
const ensureFa = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of FA_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);

// Financial aid checklists (lib/faMigration.ts). Students see only requirements that apply to them; the aid office sees status
// per requirement; administrators manage office staff. No aid documents, balances or awards are handled here.
export default createEndpoint({
  description: 'Financial aid requirement checklists: the aid office publishes official requirements, students mark them done, the office verifies',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('mark'), id: z.string(), done: z.boolean() }),
    z.object({ action: z.literal('publish'), id: z.string().min(8).max(80), term: z.string().min(3).max(40), title: z.string().min(3).max(160), instructions: z.string().min(10).max(2000),
      sourceUrl: z.string().url().max(800), dueOn: z.string(), audience: z.enum(['all_students', 'selected']), students: z.array(z.string()).max(500) }),
    z.object({ action: z.literal('review'), id: z.string(), studentId: z.string(), state: z.enum(['verified', 'needs_action', 'waived', 'todo']), note: z.string().max(500) }),
    z.object({ action: z.literal('setStaff'), userId: z.string(), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureFa();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const isAdmin = a.roles.includes('Administrator');
    const staff = ((await sql.query(`SELECT fa_is_staff($1,$2) AS ok`, [T, uid])) as { ok: boolean }[])[0].ok;
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    const one = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    const mems = (await zite.memberships.findAll({ filters: { institution: T }, limit: 500 })).records.filter((m) => m.status === 'Active');
    const students = mems.filter((m) => (m.roles ?? []).includes('Student')).map((m) => first(m.member)).filter(Boolean) as string[];
    const notify = (to: string[], body: string) => to.length ? zite.messages.create({ record: { body, sender: uid, recipients: to, isNotification: true } as never }).catch(() => undefined) : undefined;

    switch (input.action) {
      case 'mark': await one(`SELECT fa_mark($1,$2,$3,$4) AS e`, [uid, T, input.id, input.done]); break;
      case 'publish': {
        const chosen = input.audience === 'selected' ? input.students.filter((s) => students.includes(s)) : [];
        if (input.audience === 'selected' && chosen.length !== input.students.length) fail('Some selected people are not active students here.');
        await one(`SELECT fa_publish($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS e`, [uid, T, input.id, input.term, input.title, input.instructions, input.sourceUrl, input.dueOn, input.audience, chosen]);
        await notify(input.audience === 'selected' ? chosen : students, `New financial aid requirement: ${input.title}.`);
        await audit(a, 'Aid requirement published', `aidRequirement:${input.id}`, input.title, 'Financial aid office');
        break;
      }
      case 'review':
        await one(`SELECT fa_review($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.studentId, input.state, input.note]);
        if (input.state !== 'todo') await notify([input.studentId], `The aid office updated one of your requirements: ${input.state.replace('_', ' ')}.`);
        await audit(a, `Aid requirement ${input.state}`, `aidRequirement:${input.id}`, '', 'Financial aid office');
        break;
      case 'setStaff':
        if (!isAdmin) fail('Only institution administrators manage aid-office staff.');
        await one(`SELECT fa_set_staff($1,$2,$3,$4) AS e`, [uid, T, input.userId, input.on]);
        await audit(a, input.on ? 'Aid-office staff granted' : 'Aid-office staff revoked', `user:${input.userId}`, '', 'Administrator');
        break;
    }

    const mine = (await sql.query(`SELECT r.*, s.state, s.note, s.marked_at, s.reviewed_at FROM fa_requirements r LEFT JOIN fa_status s ON s.requirement_id = r.id AND s.student_id = $2
      WHERE r.tenant_id = $1 AND r.retired_at IS NULL AND fa_applies(r.id, $2) ORDER BY r.due_on`, [T, uid])) as Row[];
    const out: Record<string, unknown> = {
      isAdmin, staff,
      mine: mine.map((r) => ({ id: String(r.id), term: String(r.term), title: String(r.title), instructions: String(r.instructions), sourceUrl: String(r.source_url), dueOn: day(r.due_on),
        state: (r.state as string) ?? 'todo', note: (r.note as string) ?? '', overdue: !['verified', 'waived'].includes(String(r.state ?? 'todo')) && String(day(r.due_on)) < new Date().toISOString().slice(0, 10) })),
    };
    if (staff) {
      const reqs = (await sql.query(`SELECT * FROM fa_requirements WHERE tenant_id = $1 AND retired_at IS NULL ORDER BY due_on`, [T])) as Row[];
      const reqIds = reqs.map((r) => String(r.id));
      const [assign, status] = reqIds.length ? await Promise.all([
        sql.query(`SELECT * FROM fa_assign WHERE requirement_id = ANY($1)`, [reqIds]) as Promise<Row[]>,
        sql.query(`SELECT * FROM fa_status WHERE requirement_id = ANY($1)`, [reqIds]) as Promise<Row[]>,
      ]) : [[], []];
      const names = await userNames(students);
      out.requirements = reqs.map((r) => {
        const who = r.audience === 'all_students' ? students : assign.filter((x) => x.requirement_id === r.id).map((x) => String(x.student_id));
        const rows = who.map((sid) => { const st = status.find((x) => x.requirement_id === r.id && x.student_id === sid); return { studentId: sid, name: names[sid] ?? 'Student', state: (st?.state as string) ?? 'todo', note: (st?.note as string) ?? '', markedAt: iso(st?.marked_at), self: sid === uid }; });
        return { id: String(r.id), term: String(r.term), title: String(r.title), dueOn: day(r.due_on), audience: String(r.audience), sourceUrl: String(r.source_url),
          counts: { todo: rows.filter((x) => x.state === 'todo').length, marked: rows.filter((x) => x.state === 'marked_done').length, verified: rows.filter((x) => x.state === 'verified').length, needs: rows.filter((x) => x.state === 'needs_action').length, waived: rows.filter((x) => x.state === 'waived').length },
          // Review list: only students who marked it done or need action; untouched rows stay summarized as counts.
          toReview: rows.filter((x) => ['marked_done', 'needs_action'].includes(x.state)) };
      });
      out.students = students.filter((s) => s !== uid).map((id) => ({ id, name: names[id] ?? 'Student' }));
    }
    if (isAdmin) {
      const st = (await sql.query(`SELECT user_id FROM fa_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[];
      const idsList = st.map((x) => String(x.user_id));
      const n = await userNames([...idsList, ...mems.map((m) => first(m.member) ?? '')]);
      out.staffList = idsList.map((id) => ({ id, name: n[id] ?? 'Member' }));
      out.members = mems.map((m) => first(m.member)).filter((id): id is string => !!id && id !== uid && !idsList.includes(id)).map((id) => ({ id, name: n[id] ?? 'Member' }));
    }
    return out;
  },
});
