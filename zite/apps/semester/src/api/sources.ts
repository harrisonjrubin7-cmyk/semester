import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { RDG_MIGRATION } from '../lib/rdgMigration';
import { courseRole } from '../lib/teamServer';

// Sources: a student's readings (private), plus course reading lists that instructors publish to enrolled students.
type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of RDG_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const SRC = z.object({
  kind: z.enum(['article', 'book', 'chapter', 'web', 'report', 'other']), title: z.string().max(300), authors: z.array(z.string().max(200)).max(50),
  year: z.string().max(5), container: z.string().max(300), publisher: z.string().max(200), volume: z.string().max(20), issue: z.string().max(20),
  pages: z.string().max(40), doi: z.string().max(200), url: z.string().max(1000), accessed: z.string().max(20), purpose: z.string().max(1000), tags: z.array(z.string().max(40)).max(20),
});

export default createEndpoint({
  description: 'Sources: your readings with what each is for, course reading lists, BibTeX import and export',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), id: z.number().int().nullable().default(null), sectionId: z.string().nullable().default(null), data: SRC, expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('import'), list: z.array(SRC).min(1).max(500) }),
    z.object({ action: z.literal('publish'), id: z.number().int(), on: z.boolean() }),
    z.object({ action: z.literal('copy'), id: z.number().int() }),
    z.object({ action: z.literal('delete'), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const T = (await requireAccess(me)).institutionId;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out && !out.startsWith('ok:')) forbid(out); return out; };
    const scope = await tenantScope(T);
    const enr = (await zite.enrollments.findAll({ filters: { student: me }, limit: 500 })).records.filter((e) => e.status === 'Enrolled' || e.status === 'Completed');
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => scope.sections.has(s.id));
    const mine = new Set(enr.map((e) => first(e.section) ?? '').filter(Boolean));
    const teaching = new Set(secs.filter((s) => ids(s.instructors).includes(me)).map((s) => s.id));
    const label = (id: unknown) => secs.find((s) => s.id === String(id))?.label ?? '';
    const sectionOf = async (id: number) => String(((await sql.query(`SELECT section_id FROM rdg_sources WHERE id = $1 AND tenant_id = $2`, [id, T])) as Row[])[0]?.section_id ?? '');

    switch (input.action) {
      case 'save': {
        const can = !input.sectionId || mine.has(input.sectionId) || teaching.has(input.sectionId);
        fail(await one(`SELECT rdg_save($1,$2,$3,$4,$5,$6::jsonb,$7) AS r`, [me, T, input.id, input.sectionId, can, JSON.stringify(input.data), input.expectedVersion]));
        break;
      }
      case 'import': fail(await one(`SELECT rdg_import($1,$2,$3::jsonb) AS r`, [me, T, JSON.stringify(input.list)])); break;
      case 'publish': {
        const s = await sectionOf(input.id);
        const isInstructor = !!s && (await courseRole(T, s, me)) === 'instructor';
        fail(await one(`SELECT rdg_publish($1,$2,$3,$4,$5) AS r`, [me, T, input.id, isInstructor, input.on]));
        if (input.on && s) {
          const students = (await zite.enrollments.findAll({ filters: { section: s }, limit: 2000 })).records.filter((e) => e.status === 'Enrolled').map((e) => first(e.student)).filter(Boolean) as string[];
          if (students.length) await zite.messages.create({ record: { body: `A reading was added to the reading list for ${label(s)}. Open Sources in Semester.`, sender: me, recipients: students, isNotification: true } as never }).catch(() => undefined);
        }
        break;
      }
      case 'copy': { const s = await sectionOf(input.id); fail(await one(`SELECT rdg_copy($1,$2,$3,$4) AS r`, [me, T, input.id, !!s && (mine.has(s) || teaching.has(s))])); break; }
      case 'delete': fail(await one(`SELECT rdg_delete($1,$2,$3) AS r`, [me, T, input.id])); break;
    }

    const readable = [...new Set([...mine, ...teaching])];
    const rows = (await sql.query(`SELECT * FROM rdg_sources WHERE tenant_id = $1 AND (owner_id = $2 OR (published AND section_id = ANY($3))) ORDER BY updated_at DESC LIMIT 1000`, [T, me, readable])) as Row[];
    const nm = await userNames([...new Set(rows.filter((r) => r.owner_id !== me).map((r) => String(r.owner_id)))]);
    return {
      me,
      sections: readable.map((id) => ({ id, label: label(id), teaching: teaching.has(id) })),
      sources: rows.map((r) => ({ id: Number(r.id), data: r.data, sectionId: r.section_id ? String(r.section_id) : null, section: label(r.section_id), mine: r.owner_id === me,
        owner: r.owner_id === me ? 'You' : nm[String(r.owner_id)] ?? 'Instructor', published: !!r.published, copiedFrom: r.copied_from ? Number(r.copied_from) : null, version: Number(r.version), updatedAt: new Date(String(r.updated_at)).toISOString() })),
    };
  },
});
