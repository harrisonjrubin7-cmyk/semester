import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { DIS_MIGRATION } from '../lib/disMigration';
import { validateBody, canModerate, threads, MAX_BODY } from '../lib/discussionRules';
import { courseRole } from '../lib/teamServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of DIS_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };

// Course discussion (Semester Faculty "discussions"). Section members only: enrolled students, instructors of record and live
// grading delegates. Threaded replies; course staff remove a post with a reason (and can restore it); every removal is logged.
// Bodies are Zite Messages on the section's "Course Discussion" group, with no recipients, so they never reach an inbox.
export default createEndpoint({
  description: 'Course discussion: threaded posts for section members, with staff moderation',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), sectionId: z.string() }),
    z.object({ action: z.literal('post'), sectionId: z.string(), body: z.string().max(MAX_BODY + 100), parentId: z.string().nullable() }),
    z.object({ action: z.literal('moderate'), sectionId: z.string(), messageId: z.string(), hide: z.boolean(), reason: z.string().max(300).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    if (!(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
    const s = await zite.sections.findOne({ id: input.sectionId });
    const staffRole = await courseRole(T, input.sectionId, me);
    const enr = (await zite.enrollments.findAll({ filters: { section: input.sectionId }, limit: 2000 })).records.filter((e) => e.status === 'Enrolled');
    const students = [...new Set(enr.map((e) => first(e.student) ?? '').filter(Boolean))];
    const role = staffRole ?? (students.includes(me) ? 'student' : null);
    if (!role) forbid('You are not enrolled in or teaching this section.');

    let g = (await zite.groups.findAll({ filters: { section: input.sectionId, kind: 'Course Discussion' }, limit: 1 })).records[0];
    if (input.action === 'post') {
      fail(validateBody(input.body));
      if (!g) g = (await zite.groups.create({ record: { name: `${s!.label} discussion`, kind: 'Course Discussion', section: input.sectionId, members: [...ids(s!.instructors), ...students] } as never })) as typeof g;
      const msg = await zite.messages.create({ record: { body: input.body.trim(), sender: me, group: g!.id, recipients: [], isNotification: false, read: false } as never });
      const err = ((await sql.query(`SELECT dis_add($1,$2,$3,$4,$5) AS e`, [T, input.sectionId, msg.id, me, input.parentId])) as { e: string | null }[])[0].e;
      if (err) { await zite.messages.delete({ id: msg.id }).catch(() => undefined); forbid(err); }
    }
    if (input.action === 'moderate') {
      if (!canModerate(role!)) forbid('Only course staff can remove or restore posts.');
      const m = await zite.messages.findOne({ id: input.messageId });
      if (!m || !g || first(m.group) !== g.id) forbid('Post not found in this course.');
      // Posts from before replies existed have no dis_posts row yet; register them as top posts first.
      await sql.query(`INSERT INTO dis_posts (message_id, tenant_id, section_id, author_id, parent_id) VALUES ($1,$2,$3,$4,NULL) ON CONFLICT (message_id) DO NOTHING`, [m!.id, T, input.sectionId, first(m!.sender) ?? '']);
      fail(((await sql.query(`SELECT dis_moderate($1,$2,$3,$4,$5,$6) AS e`, [T, input.sectionId, input.messageId, me, input.hide, input.reason])) as { e: string | null }[])[0].e);
      await audit(a, input.hide ? 'Discussion post removed' : 'Discussion post restored', `section:${input.sectionId}`, input.reason.trim(), role === 'instructor' ? 'Instructor of record' : 'Grading delegate');
      const author = first(m!.sender);
      if (input.hide && author && author !== me) await zite.messages.create({ record: { body: `Course staff removed one of your discussion posts: ${input.reason.trim()}`, sender: me, recipients: [author], isNotification: true } as never }).catch(() => undefined);
    }

    if (!g) return { role, staff: canModerate(role!), posts: [] };
    const { records: msgs } = await zite.messages.findAll({ filters: { group: g.id }, limit: 2000 });
    const meta = (await sql.query(`SELECT p.message_id, p.parent_id, h.hidden_by, h.reason FROM dis_posts p LEFT JOIN dis_hidden h ON h.message_id = p.message_id
      WHERE p.tenant_id = $1 AND p.section_id = $2`, [T, input.sectionId])) as Row[];
    const byId = new Map(meta.map((r) => [String(r.message_id), r]));
    const staff = canModerate(role!);
    const inst = ids(s!.instructors);
    const names = await userNames([...new Set(msgs.map((m) => first(m.sender) ?? '').filter(Boolean))]);
    const raw = msgs.map((m) => { const r = byId.get(m.id); return { id: m.id, parentId: r?.parent_id ? String(r.parent_id) : null, at: m.sentAt ?? '', authorId: first(m.sender) ?? '',
      hidden: r?.hidden_by ? { by: String(r.hidden_by), reason: String(r.reason) } : null }; });
    const body = new Map(msgs.map((m) => [m.id, m.body ?? '']));
    const shape = (p: ReturnType<typeof threads>[number]): unknown => ({
      id: p.id, at: p.at, mine: p.authorId === me, author: p.authorId === me ? 'You' : names[p.authorId] ?? 'Member', instructor: inst.includes(p.authorId),
      body: p.shownBody === 'full' ? body.get(p.id) ?? '' : null, removed: p.hidden ? { reason: p.hidden.reason } : null, replies: p.replies.map(shape),
    });
    return { role, staff, posts: threads(raw, me, staff).map(shape) };
  },
});
