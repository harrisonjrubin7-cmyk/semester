import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { holdsFor } from '../../../semester/src/lib/holdServer';

const ids = (v: string | string[] | undefined | null): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);
const first = (v: string | string[] | undefined | null) => ids(v)[0];

export default createEndpoint({
  description: 'Shows a guardian only what each student has actively shared with them, and logs every view',
  authenticated: true,
  inputSchema: z.object({ studentId: z.string().optional(), note: z.string().min(1).max(1000).optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const { records } = await zite.consents.findAll({ filters: { recipient: uid, consentType: 'Data Sharing' }, limit: 200 });
    const live = records.filter((c) => c.granted && !c.revoked && (!c.expiresOn || c.expiresOn >= today) && (c.label ?? '').startsWith('Family:'));
    const studentIds = [...new Set(live.flatMap((c) => ids(c.member)))];
    const { rows } = studentIds.length ? await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [studentIds] }) : { rows: [] as Record<string, unknown>[] };
    const name = (id: string) => String(rows.find((r) => r.id === id)?.name || rows.find((r) => r.id === id)?.email || 'Student');
    const students = studentIds.map((s) => {
      const cs = live.filter((c) => first(c.member) === s);
      const cats = [...new Set(cs.flatMap((c) => (c.label ?? '').replace('Family:', '').split(',').map((x) => x.trim())))];
      const expires = cs.map((c) => c.expiresOn ?? '').sort().reverse()[0] ?? null;
      return { id: s, name: name(s), categories: cats, expiresOn: expires };
    });
    const sel = students.find((s) => s.id === input.studentId) ?? students[0];
    if (!sel) return { students, view: null };

    if (input.note) {
      if (input.studentId !== sel.id) return { students, view: null, sent: false };
      await zite.messages.create({ record: { body: `From your family contact: ${input.note}`, sender: uid, recipients: [sel.id], isNotification: true, read: false } as never });
      await zite.auditEvents.create({ record: { action: 'Family note sent', actor: uid, recordRef: `user:${sel.id}`, authority: 'Student share', details: '', viaAssistant: false, institution: null } as never });
      return { students, view: null, sent: true };
    }
    const can = (c: string) => sel.categories.includes(c);
    const [enr, holds, tasks, secs, courses] = await Promise.all([
      can('Grades') ? zite.enrollments.findAll({ filters: { student: sel.id }, limit: 300 }) : null,
      can('Holds') ? holdsFor(sel.id) : null,
      can('Calendar') ? zite.tasks.findAll({ filters: { owner: sel.id, type: 'Assignment' }, limit: 300 }) : null,
      can('Grades') ? zite.sections.findAll({ limit: 1000, fields: ['label', 'course', 'term'] }) : null,
      can('Grades') ? zite.courses.findAll({ limit: 1000, fields: ['code', 'title'] }) : null,
    ]);
    const sById = Object.fromEntries((secs?.records ?? []).map((s) => [s.id, s]));
    const cById = Object.fromEntries((courses?.records ?? []).map((c) => [c.id, c]));
    await zite.auditEvents.create({ record: { action: 'Family view', actor: uid, recordRef: `user:${sel.id}`, authority: 'Student share', details: sel.categories.join(', '), viaAssistant: false, institution: null } as never });
    const now = new Date().toISOString();
    return {
      students,
      view: {
        ...sel,
        grades: enr ? enr.records.filter((e) => e.gradeReleased).map((e) => { const s = sById[first(e.section) ?? '']; const c = cById[first(s?.course) ?? '']; return { id: e.id, code: c?.code ?? '', title: c?.title ?? '', term: s?.term ?? '', grade: e.finalGrade ?? '', source: e.source ?? 'Official' }; }) : null,
        holds: holds ? holds.map((h) => ({ id: h.id, title: h.title, office: h.office, source: 'Official' })) : null,
        upcoming: tasks ? tasks.records.filter((t) => (t.dueAt ?? '') >= now).sort((x, y) => (x.dueAt ?? '').localeCompare(y.dueAt ?? '')).slice(0, 15).map((t) => ({ id: t.id, title: t.title ?? '', dueAt: t.dueAt ?? null, done: t.status === 'Done', source: t.source ?? 'Official' })) : null,
      },
    };
  },
});
