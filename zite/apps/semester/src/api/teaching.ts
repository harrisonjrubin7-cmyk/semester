import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames } from '../lib/server';

const ATT = z.enum(['Present', 'Late', 'Absent', 'Excused']);

export default createEndpoint({
  description: 'Faculty course operations: roster, assignment creation, attendance and course discussions',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('roster'), sectionId: z.string() }),
    z.object({ action: z.literal('createAssignment'), sectionId: z.string(), title: z.string().min(2), dueAt: z.string(), points: z.number().min(0), rubric: z.string() }),
    z.object({ action: z.literal('attendance'), sectionId: z.string(), date: z.string() }),
    z.object({ action: z.literal('saveAttendance'), sectionId: z.string(), date: z.string(), marks: z.array(z.object({ studentId: z.string(), status: ATT })) }),
    z.object({ action: z.literal('discussion'), sectionId: z.string() }),
    z.object({ action: z.literal('post'), sectionId: z.string(), body: z.string().min(1).max(4000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const s = await zite.sections.findOne({ id: input.sectionId });
    if (!s) forbid();
    const teaching = ids(s!.instructors).includes(uid);
    const { records: enr } = await zite.enrollments.findAll({ filters: { section: s!.id }, limit: 1000 });
    const students = [...new Set(enr.filter((e) => e.status === 'Enrolled').map((e) => first(e.student) ?? '').filter(Boolean))];
    const enrolled = students.includes(uid);
    if (!teaching && !enrolled) forbid('You are not enrolled in or teaching this section.');
    const needTeach = () => { if (!teaching) forbid('Only the instructor of record can do this.'); };

    if (input.action === 'roster') {
      needTeach();
      const names = await userNames(students);
      return { students: students.map((id) => ({ id, name: names[id] ?? 'Student' })) };
    }
    if (input.action === 'createAssignment') {
      needTeach();
      const due = new Date(input.dueAt);
      if (isNaN(due.getTime())) forbid('Choose a valid due date.');
      if (students.length === 0) forbid('No enrolled students to assign this to yet.');
      for (let i = 0; i < students.length; i += 100) {
        await zite.tasks.bulkCreate({ records: students.slice(i, i + 100).map((st) => ({ title: input.title, owner: st, type: 'Assignment', source: 'Official', section: s!.id, dueAt: due.toISOString(), points: input.points, rubric: input.rubric, status: 'Open' })) as never });
      }
      await zite.messages.create({ record: { body: `New assignment in ${s!.label}: ${input.title}`, sender: uid, recipients: students, isNotification: true, read: false } as never });
      await audit(a, 'Assignment published', `section:${s!.id}`, input.title, 'Instructor of record');
      return { ok: true, assigned: students.length };
    }
    if (input.action === 'attendance') {
      const { records } = await zite.attendance.findAll({ filters: { section: s!.id }, limit: 2000 });
      if (!teaching) {
        return { mine: records.filter((r) => ids(r.student).includes(uid)).map((r) => ({ date: r.sessionDate ?? '', status: r.status ?? '' })).sort((x, y) => y.date.localeCompare(x.date)) };
      }
      const day = records.filter((r) => (r.sessionDate ?? '').slice(0, 10) === input.date);
      const names = await userNames(students);
      return { rows: students.map((id) => ({ id, name: names[id] ?? 'Student', status: day.find((r) => ids(r.student).includes(id))?.status ?? null })) };
    }
    if (input.action === 'saveAttendance') {
      needTeach();
      const { records } = await zite.attendance.findAll({ filters: { section: s!.id }, limit: 2000 });
      const day = records.filter((r) => (r.sessionDate ?? '').slice(0, 10) === input.date);
      const creates: unknown[] = [];
      for (const m of input.marks) {
        if (!students.includes(m.studentId)) continue;
        const ex = day.find((r) => ids(r.student).includes(m.studentId));
        if (ex) await zite.attendance.update({ id: ex.id, record: { status: m.status, recordedBy: uid } as never });
        else creates.push({ label: `${s!.label} · ${input.date}`, section: s!.id, student: m.studentId, sessionDate: input.date, status: m.status, recordedBy: uid });
      }
      for (let i = 0; i < creates.length; i += 100) await zite.attendance.bulkCreate({ records: creates.slice(i, i + 100) as never });
      await audit(a, 'Attendance recorded', `section:${s!.id}`, `${input.date} · ${input.marks.length} marks`, 'Instructor of record');
      return { ok: true };
    }
    // discussion / post
    let g = (await zite.groups.findAll({ filters: { section: s!.id, kind: 'Course Discussion' }, limit: 1 })).records[0];
    if (!g && input.action === 'post') {
      const created = await zite.groups.create({ record: { name: `${s!.label} discussion`, kind: 'Course Discussion', section: s!.id, members: [...ids(s!.instructors), ...students] } as never });
      g = created as typeof g;
    }
    if (input.action === 'post') {
      await zite.messages.create({ record: { body: input.body, sender: uid, group: g!.id, recipients: [], isNotification: false, read: false } as never });
      return { ok: true };
    }
    if (!g) return { posts: [] };
    const { records: msgs } = await zite.messages.findAll({ filters: { group: g.id }, limit: 500 });
    const names = await userNames(msgs.map((m) => first(m.sender) ?? ''));
    const inst = ids(s!.instructors);
    return {
      posts: msgs.map((m) => ({ id: m.id, body: m.body ?? '', author: first(m.sender) === uid ? 'You' : names[first(m.sender) ?? ''] ?? 'Member', instructor: inst.includes(first(m.sender) ?? ''), at: (m as { sentAt?: string }).sentAt ?? null }))
        .sort((x, y) => (x.at ?? '').localeCompare(y.at ?? '')),
    };
  },
});
