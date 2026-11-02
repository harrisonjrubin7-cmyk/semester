import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'W', 'I'];

export default createEndpoint({
  description: 'Staff workspaces: faculty gradebook, TA grading queue, registrar desk, student accounts and student affairs',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('gradebook') }),
    z.object({ action: z.literal('setFinal'), enrollmentId: z.string(), grade: z.enum(GRADES as [string, ...string[]]) }),
    z.object({ action: z.literal('taQueue') }),
    z.object({ action: z.literal('registrar') }),
    z.object({ action: z.literal('setEnrollment'), enrollmentId: z.string(), status: z.enum(['Enrolled', 'Waitlisted', 'Dropped']) }),
    z.object({ action: z.literal('accounts') }),
    z.object({ action: z.literal('requestHoldRelease'), holdId: z.string(), reason: z.string().min(5) }),
    z.object({ action: z.literal('affairs') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;

    if (input.action === 'gradebook' || input.action === 'setFinal' || input.action === 'taQueue') {
      const a = await requireAction(uid, 'teaching.queue');
      const secs = (await zite.sections.findAll({ filters: { instructors: uid }, limit: 200 })).records;
      const secIds = new Set(secs.map((s) => s.id));
      if (input.action === 'setFinal') {
        const e = await zite.enrollments.findOne({ id: input.enrollmentId });
        if (!e || !secIds.has(first(e.section) ?? '')) forbid('You can only grade students in sections you teach.');
        if (!a.roles.includes('Faculty')) forbid('Only faculty set final grades.');
        if (e!.gradeReleased) forbid('This grade is already released. Changing it needs a regrade request to the Registrar.');
        await audit(a, 'Final grade set', `enrollment:${e!.id}`, input.grade, 'Faculty');
        await zite.enrollments.update({ id: e!.id, record: { finalGrade: input.grade } as never });
        return { ok: true };
      }
      const [enr, tasks] = await Promise.all([
        Promise.all(secs.map((s) => zite.enrollments.findAll({ filters: { section: s.id }, limit: 500 }))).then((r) => r.flatMap((x) => x.records)),
        Promise.all(secs.map((s) => zite.tasks.findAll({ filters: { section: s.id, type: 'Assignment' }, limit: 200 }))).then((r) => r.flatMap((x) => x.records)),
      ]);
      const subs = (await Promise.all(tasks.map((t) => zite.submissions.findAll({ filters: { task: t.id }, limit: 500 })))).flatMap((x) => x.records);
      const names = await userNames([...enr, ...subs].map((x) => first(x.student) ?? ''));
      if (input.action === 'taQueue') {
        const tTitle = Object.fromEntries(tasks.map((t) => [t.id, { title: t.title ?? '', points: t.points ?? 100, section: first(t.section) ?? '', due: t.dueAt ?? null }]));
        const sLabel = Object.fromEntries(secs.map((s) => [s.id, s.label ?? '']));
        return {
          queue: subs.filter((s) => s.state === 'Submitted').map((s) => { const t = tTitle[first(s.task) ?? '']; return { id: s.id, student: names[first(s.student) ?? ''] ?? 'Student', task: t?.title ?? '', points: t?.points ?? 100, section: sLabel[t?.section ?? ''] ?? '', due: t?.due ?? null, file: s.files?.[0]?.url ?? null }; }),
          graded: subs.filter((s) => s.state === 'Graded').length,
        };
      }
      return {
        grades: GRADES,
        sections: secs.map((s) => {
          const ts = tasks.filter((t) => first(t.section) === s.id);
          return {
            id: s.id, label: s.label ?? '', term: s.term ?? '',
            assignments: ts.map((t) => ({ id: t.id, title: t.title ?? '', points: t.points ?? 100 })),
            roster: enr.filter((e) => first(e.section) === s.id && e.status !== 'Dropped').map((e) => ({
              enrollmentId: e.id, student: names[first(e.student) ?? ''] ?? 'Student', status: e.status ?? '', finalGrade: e.finalGrade ?? '', released: !!e.gradeReleased,
              scores: Object.fromEntries(ts.map((t) => { const sub = subs.find((x) => first(x.task) === t.id && first(x.student) === first(e.student)); return [t.id, sub ? { score: sub.score ?? null, state: sub.state ?? '' } : null]; })),
            })),
          };
        }),
      };
    }

    if (input.action === 'registrar' || input.action === 'setEnrollment') {
      const a = await requireAction(uid, input.action === 'setEnrollment' ? 'registration.request.decide' : 'registrar.read');
      const tenant = await tenantScope(a.institutionId);
      if (input.action === 'setEnrollment') {
        const e = await zite.enrollments.findOne({ id: input.enrollmentId });
        if (!e || !inSet(e.section, tenant.sections)) forbid('Enrollment not found.');
        if (first(e!.student) === uid) forbid('You cannot change your own enrollment from the registrar desk.');
        await audit(a, `Enrollment set to ${input.status}`, `enrollment:${e!.id}`, e!.label ?? '', 'Registrar');
        // Recorded by the Registrar in Semester. The SIS stays the official record until a connector is authorized.
        await zite.enrollments.update({ id: e!.id, record: { status: input.status, source: 'Made Here' } as never });
        const student = first(e!.student);
        const secLabel = (await zite.sections.findOne({ id: first(e!.section) ?? '' }))?.label ?? 'a section';
        if (student) await zite.messages.create({ record: { body: `Registrar update: ${secLabel.split(' · ')[0]} is now ${input.status} (recorded by the Registrar in Semester; the student information system remains the official record).`, sender: uid, recipients: [student], isNotification: true } as never });
        return { ok: true };
      }
      const [wait, planned, reqs, secs] = await Promise.all([
        zite.enrollments.findAll({ filters: { status: { in: ['Requested', 'Waitlisted'] } }, limit: 2000 }),
        zite.enrollments.findAll({ filters: { status: 'Planned' }, limit: 2000 }),
        zite.tasks.findAll({ filters: { type: 'Approval Request' }, limit: 300 }),
        zite.sections.findAll({ limit: 1000, fields: ['label'] }),
      ]);
      const sl = Object.fromEntries(secs.records.map((s) => [s.id, s.label ?? '']));
      const all = [...wait.records, ...planned.records].filter((e) => inSet(e.section, tenant.sections));
      reqs.records = reqs.records.filter((t) => inSet(t.requestedBy, tenant.members));
      const names = await userNames([...all.map((e) => first(e.student) ?? ''), ...reqs.records.map((t) => first(t.requestedBy) ?? '')]);
      return {
        enrollments: all.sort((x, y) => (x.status === 'Requested' ? 0 : 1) - (y.status === 'Requested' ? 0 : 1)).map((e) => ({ id: e.id, student: names[first(e.student) ?? ''] ?? 'Student', section: sl[first(e.section) ?? ''] ?? '', status: e.status ?? '', source: e.source ?? '', self: first(e.student) === uid })),
        overrides: reqs.records.filter((t) => (t.title ?? '').toLowerCase().includes('override')).map((t) => ({ id: t.id, title: t.title ?? '', status: t.status ?? '', by: names[first(t.requestedBy) ?? ''] ?? 'Student' })),
      };
    }

    if (input.action === 'accounts' || input.action === 'requestHoldRelease') {
      const a = await requireAction(uid, 'accounts.read');
      const tenant = await tenantScope(a.institutionId);
      if (input.action === 'requestHoldRelease') {
        const h = await zite.tasks.findOne({ id: input.holdId });
        if (!h || h.type !== 'Hold' || h.status === 'Done' || !inSet(h.owner, tenant.members)) forbid('This hold is no longer active.');
        await audit(a, 'Hold release requested', `task:${h!.id}`, input.reason, a.roles.join(', '));
        await zite.tasks.create({ record: { title: `Release hold: ${h!.title}`, type: 'Approval Request', status: 'Pending Approval', requestedBy: uid, owningOffice: h!.owningOffice ?? 'Student Accounts', rubric: `hold:${h!.id} ${input.reason}`, source: 'Made Here' } as never });
        return { ok: true };
      }
      const records = (await zite.tasks.findAll({ filters: { type: 'Hold' }, limit: 2000 })).records.filter((h) => inSet(h.owner, tenant.members));
      const pend = (await zite.tasks.findAll({ filters: { type: 'Approval Request', status: 'Pending Approval' }, limit: 300 })).records;
      const names = await userNames(records.map((t) => first(t.owner) ?? ''));
      return {
        holds: records.map((h) => ({ id: h.id, title: h.title ?? '', student: names[first(h.owner) ?? ''] ?? 'Student', office: h.owningOffice ?? '', status: h.status ?? 'Open', source: h.source ?? '', releasePending: pend.some((p) => (p.rubric ?? '').includes(`hold:${h.id}`)) })),
      };
    }

    // Student affairs: service requests, referrals and moderation reports.
    const sa = await requireAction(uid, 'caseload.read');
    const tenant = await tenantScope(sa.institutionId);
    const records = (await zite.cases.findAll({ limit: 2000 })).records.filter((c) => inSet(c.student, tenant.members) || inSet(c.assignedTo, tenant.members));
    const names = await userNames(records.flatMap((c) => [first(c.student) ?? '', first(c.assignedTo) ?? '']));
    return {
      cases: records.map((c) => ({ id: c.id, title: c.title ?? '', category: c.category ?? '', status: c.status ?? '', reference: c.reference ?? '', student: names[first(c.student) ?? ''] ?? '—', assignedTo: names[first(c.assignedTo) ?? ''] ?? 'Unassigned', mine: ids(c.assignedTo).includes(uid), notes: ids(c.assignedTo).includes(uid) ? c.notes ?? '' : '' })),
    };
  },
});
