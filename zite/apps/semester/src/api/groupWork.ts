import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, userNames, tenantScope, ids } from '../lib/server';
import { pg } from '../lib/pg';
import { GRP_MIGRATION } from '../lib/grpMigration';
import { GWK_MIGRATION } from '../lib/gwkMigration';

// Group work: the shared part list for each course group you are in; read-only for instructors of that section.
type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...GRP_MIGRATION, ...GWK_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const STATUS = z.enum(['To do', 'In progress', 'Needs review', 'Done']);

export default createEndpoint({
  description: 'Group work: shared part lists for your course groups (owners, status, due dates, change log)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), groupId: z.number().int(), id: z.number().int().nullable().default(null), title: z.string().max(200), ownerId: z.string().nullable(),
      status: STATUS, due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), note: z.string().max(2000).default(''), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('delete'), groupId: z.number().int(), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const T = (await requireAccess(me)).institutionId;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    if (input.action === 'save') {
      const r = String((await one(`SELECT gwk_save($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10) AS r`, [me, T, input.groupId, input.id, input.title, input.ownerId, input.status, input.due, input.note, input.expectedVersion])) ?? '');
      if (!r.startsWith('ok:')) forbid(r);
    }
    if (input.action === 'delete') { const r = await one(`SELECT gwk_delete($1,$2,$3,$4) AS r`, [me, T, input.groupId, input.id]); if (r) forbid(r); }

    const scope = await tenantScope(T);
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => scope.sections.has(s.id));
    const teaching = secs.filter((s) => ids(s.instructors).includes(me)).map((s) => s.id);
    const label = (id: unknown) => secs.find((s) => s.id === String(id))?.label ?? '';
    const groups = (await sql.query(`SELECT g.id, g.name, s.name AS set_name, s.section_id, EXISTS (SELECT 1 FROM grp_members m WHERE m.group_id = g.id AND m.student_id = $2) AS member
       FROM grp_groups g JOIN grp_sets s ON s.id = g.set_id WHERE s.tenant_id = $1 AND (EXISTS (SELECT 1 FROM grp_members m WHERE m.group_id = g.id AND m.student_id = $2) OR s.section_id = ANY($3))
       ORDER BY s.section_id, s.name, g.name LIMIT 300`, [T, me, teaching])) as Row[];
    const gids = groups.map((g) => Number(g.id));
    const [members, parts, log] = gids.length ? await Promise.all([
      sql.query(`SELECT group_id, student_id FROM grp_members WHERE group_id = ANY($1)`, [gids]),
      sql.query(`SELECT * FROM gwk_parts WHERE tenant_id = $1 AND group_id = ANY($2) ORDER BY (status = 'Done'), due NULLS LAST, id`, [T, gids]),
      sql.query(`SELECT * FROM (SELECT *, row_number() OVER (PARTITION BY group_id ORDER BY at DESC) AS n FROM gwk_log WHERE tenant_id = $1 AND group_id = ANY($2)) x WHERE n <= 30 ORDER BY at DESC`, [T, gids]),
    ]) as Row[][] : [[], [], []];
    const people = [...new Set([...members.map((m) => String(m.student_id)), ...log.map((l) => String(l.actor))])];
    const nm = await userNames(people);
    const who = (id: unknown) => (id ? (id === me ? 'You' : nm[String(id)] ?? 'A member') : null);
    // The log stores user ids; show names. Longest ids first so one id never matches inside another.
    const named = (t: string) => [...people].sort((a, b) => b.length - a.length).reduce((acc, id) => acc.split(id).join(who(id) ?? 'a member'), t);
    return {
      me,
      groups: groups.map((g) => {
        const gid = Number(g.id);
        return { id: gid, name: String(g.name), set: String(g.set_name), section: label(g.section_id), member: !!g.member, readOnly: !g.member,
          members: members.filter((m) => Number(m.group_id) === gid).map((m) => ({ id: String(m.student_id), name: who(m.student_id) })),
          parts: parts.filter((p) => Number(p.group_id) === gid).map((p) => ({ id: Number(p.id), title: String(p.title), ownerId: p.owner_id ? String(p.owner_id) : null, owner: who(p.owner_id), status: String(p.status),
            due: p.due ? new Date(String(p.due)).toISOString().slice(0, 10) : null, note: String(p.note ?? ''), mineToRemove: p.created_by === me, version: Number(p.version), updatedBy: who(p.updated_by), updatedAt: new Date(String(p.updated_at)).toISOString() })),
          log: log.filter((l) => Number(l.group_id) === gid).map((l) => ({ who: who(l.actor), what: named(String(l.what)), at: new Date(String(l.at)).toISOString() })),
        };
      }),
    };
  },
});
