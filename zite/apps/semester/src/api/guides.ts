import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { SGD_MIGRATION } from '../lib/sgdMigration';
import { courseRole } from '../lib/teamServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of SGD_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Course study guides: private guides a student writes, and guides an instructor publishes to a section. Study modes are rendered
// in the browser from the guide text (lib/guideRules.ts); the server stores the text, card reviews and quiz attempts.
export default createEndpoint({
  description: 'Study guides: write or copy a guide, publish to a section (instructors), card reviews and quiz attempts',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('save'), id: z.number().int().nullable().default(null), title: z.string().min(2).max(120), source: z.string().max(100000), sectionId: z.string().nullable().default(null), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('publish'), id: z.number().int(), on: z.boolean() }),
    z.object({ action: z.literal('copy'), id: z.number().int() }),
    z.object({ action: z.literal('delete'), id: z.number().int() }),
    z.object({ action: z.literal('review'), id: z.number().int(), card: z.string().max(300), box: z.number().int().min(1).max(5), inDays: z.number().int().min(0).max(30) }),
    z.object({ action: z.literal('attempt'), id: z.number().int(), seed: z.number().int(), score: z.number().int().min(0), total: z.number().int().min(1).max(100) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out && !out.startsWith('ok:')) forbid(out); return out; };
    const scope = await tenantScope(T);
    const enr = (await zite.enrollments.findAll({ filters: { student: me }, limit: 500 })).records.filter((e) => e.status === 'Enrolled' || e.status === 'Completed');
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => scope.sections.has(s.id));
    const mine = new Set(enr.map((e) => first(e.section) ?? '').filter(Boolean));
    const teaching = new Set(secs.filter((s) => ids(s.instructors).includes(me)).map((s) => s.id));
    const label = (id: unknown) => secs.find((s) => s.id === String(id))?.label ?? '';
    const guideSection = async (id: number) => String(((await sql.query(`SELECT section_id FROM sgd_guides WHERE id = $1 AND tenant_id = $2`, [id, T])) as Row[])[0]?.section_id ?? '');
    const canRead = async (id: number) => { const s = await guideSection(id); return !!s && (mine.has(s) || teaching.has(s)); };
    let result: unknown = null;

    switch (input.action) {
      case 'save': {
        if (input.sectionId && !mine.has(input.sectionId) && !teaching.has(input.sectionId)) forbid('Choose one of your own sections.');
        result = fail(await one(`SELECT sgd_save($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.id, input.title, input.source, input.sectionId, input.expectedVersion]));
        break;
      }
      case 'publish': {
        const s = await guideSection(input.id);
        const isInstructor = !!s && (await courseRole(T, s, me)) === 'instructor';
        fail(await one(`SELECT sgd_publish($1,$2,$3,$4,$5) AS r`, [me, T, input.id, isInstructor, input.on]));
        if (input.on && s) {
          const students = (await zite.enrollments.findAll({ filters: { section: s }, limit: 2000 })).records.filter((e) => e.status === 'Enrolled').map((e) => first(e.student)).filter(Boolean) as string[];
          if (students.length) await zite.messages.create({ record: { body: `A study guide was published for ${label(s)}. Open Study guides in Semester.`, sender: me, recipients: students, isNotification: true } as never }).catch(() => undefined);
        }
        break;
      }
      case 'copy': result = fail(await one(`SELECT sgd_copy($1,$2,$3,$4) AS r`, [me, T, input.id, await canRead(input.id)])); break;
      case 'delete': fail(await one(`SELECT sgd_delete($1,$2,$3) AS r`, [me, T, input.id])); break;
      case 'review': fail(await one(`SELECT sgd_review($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.id, await canRead(input.id), input.card, input.box, input.inDays])); break;
      case 'attempt': fail(await one(`SELECT sgd_attempt($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.id, await canRead(input.id), input.seed, input.score, input.total])); break;
      case 'get': break;
    }

    const readable = [...new Set([...mine, ...teaching])];
    const guides = (await sql.query(`SELECT * FROM sgd_guides WHERE tenant_id = $1 AND (owner_id = $2 OR (published AND section_id = ANY($3))) ORDER BY updated_at DESC LIMIT 200`, [T, me, readable])) as Row[];
    const gids = guides.map((g) => Number(g.id));
    const reviews = gids.length ? (await sql.query(`SELECT guide_id, card_key, box, due FROM sgd_reviews WHERE student_id = $1 AND guide_id = ANY($2)`, [me, gids])) as Row[] : [];
    const attempts = gids.length ? (await sql.query(`SELECT guide_id, score, total, at FROM sgd_attempts WHERE student_id = $1 AND guide_id = ANY($2) ORDER BY at DESC`, [me, gids])) as Row[] : [];
    const nm = await userNames([...new Set(guides.map((g) => String(g.owner_id)))]);
    return {
      result, me,
      sections: readable.map((id) => ({ id, label: label(id), teaching: teaching.has(id) })),
      guides: guides.map((g) => ({ id: Number(g.id), title: String(g.title), source: String(g.source), sectionId: g.section_id ? String(g.section_id) : null, section: label(g.section_id),
        mine: g.owner_id === me, owner: nm[String(g.owner_id)] ?? 'Instructor', published: !!g.published, version: Number(g.version), updatedAt: iso(g.updated_at),
        reviews: reviews.filter((r) => String(r.guide_id) === String(g.id)).map((r) => ({ card: String(r.card_key), box: Number(r.box), due: String(r.due).slice(0, 10) })),
        attempts: attempts.filter((t) => String(t.guide_id) === String(g.id)).slice(0, 5).map((t) => ({ score: Number(t.score), total: Number(t.total), at: iso(t.at) })) })),
    };
  },
});
