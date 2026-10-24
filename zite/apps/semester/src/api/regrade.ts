import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';
import { GRADES, requestBlocker, decideBlocker, decisionBlocker } from '../lib/regradeRules';

const err = (msg: string | null) => { if (msg) forbid(msg); };

export default createEndpoint({
  description: 'Regrades: students ask for a review of a released grade; the instructor or Registrar decides, and the change is audited',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('request'), enrollmentId: z.string(), reason: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('withdraw'), id: z.string() }),
    z.object({ action: z.literal('queue') }),
    z.object({ action: z.literal('decide'), id: z.string(), outcome: z.enum(['Grade Changed', 'Grade Upheld']), newGrade: z.string().optional(), note: z.string().max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const sectionLabel = async (sid?: string) => (sid ? (await zite.sections.findOne({ id: sid }))?.label ?? '' : '');

    if (input.action === 'request') {
      const e = await zite.enrollments.findOne({ id: input.enrollmentId });
      if (!e) forbid();
      const open = await zite.regradeRequests.findOne({ filters: { enrollment: e!.id, status: 'Pending' } });
      err(requestBlocker({ studentId: first(e!.student) ?? null, released: !!e!.gradeReleased, grade: e!.finalGrade ?? '' }, uid, !!open));
      const sid = first(e!.section);
      const label = `Regrade · ${(await sectionLabel(sid)).split(' · ')[0]}`;
      const r = await zite.regradeRequests.create({ record: { label, enrollment: e!.id, section: sid ?? null, student: uid, reason: input.reason, gradeAtRequest: e!.finalGrade ?? '', status: 'Pending' } as never });
      await audit(a, 'Regrade requested', `regrade:${r.id}`, `${label}: ${e!.finalGrade}`, 'Student');
      const sec = sid ? await zite.sections.findOne({ id: sid }) : undefined;
      const instructors = ids(sec?.instructors);
      if (instructors.length) await zite.messages.create({ record: { body: `New regrade request: ${label}. Review it in Regrade queue.`, sender: uid, recipients: instructors, isNotification: true } as never });
      return { ok: true, id: r.id };
    }

    if (input.action === 'withdraw') {
      const r = await zite.regradeRequests.findOne({ id: input.id });
      if (!r || first(r.student) !== uid || r.status !== 'Pending') forbid('Only your own pending request can be withdrawn.');
      await zite.regradeRequests.update({ id: r!.id, record: { status: 'Withdrawn' } as never });
      await audit(a, 'Regrade withdrawn', `regrade:${r!.id}`, r!.label ?? '', 'Student');
      return { ok: true };
    }

    if (input.action === 'mine') {
      const { records } = await zite.regradeRequests.findAll({ filters: { student: uid }, limit: 200 });
      return {
        items: records.map((r) => ({ id: r.id, label: r.label ?? '', enrollmentId: first(r.enrollment) ?? '', status: r.status ?? 'Pending', gradeAtRequest: r.gradeAtRequest ?? '', newGrade: r.newGrade ?? '', note: r.decisionNote ?? '', decidedAt: r.decidedAt ?? null, requestedAt: r.requestedAt ?? null }))
          .sort((x, y) => String(y.requestedAt ?? '').localeCompare(String(x.requestedAt ?? ''))), // newest first
      };
    }

    // Staff side: instructors of the section, or registrar staff, inside the caller's institution.
    const tenant = await tenantScope(a.institutionId);
    const registrar = a.roles.includes('Staff') || a.roles.includes('Administrator');
    if (!registrar && !a.roles.includes('Faculty')) forbid('Only instructors and the Registrar can see the regrade queue.');
    const teaching = new Set((await zite.sections.findAll({ filters: { instructors: uid }, limit: 500, fields: ['label'] })).records.map((s) => s.id));

    if (input.action === 'decide') {
      const r = await zite.regradeRequests.findOne({ id: input.id });
      if (!r || !inSet(r.section, tenant.sections)) forbid();
      err(decideBlocker({ deciderId: uid, studentId: first(r!.student) ?? null, isInstructor: teaching.has(first(r!.section) ?? ''), roles: a.roles, status: r!.status ?? '' }));
      const e = await zite.enrollments.findOne({ id: first(r!.enrollment) ?? '' });
      if (!e) forbid('The enrollment for this request no longer exists.');
      err(decisionBlocker(input.outcome, e!.finalGrade ?? '', input.newGrade, input.note));
      // Audit before the change is applied.
      await audit(a, `Regrade decided: ${input.outcome}`, `regrade:${r!.id}`, `${r!.label}: ${e!.finalGrade}${input.outcome === 'Grade Changed' ? ` → ${input.newGrade}` : ' kept'}. ${input.note}`, registrar ? 'Registrar' : 'Instructor');
      if (input.outcome === 'Grade Changed') await zite.enrollments.update({ id: e!.id, record: { finalGrade: input.newGrade } as never });
      await zite.regradeRequests.update({ id: r!.id, record: { status: input.outcome, newGrade: input.outcome === 'Grade Changed' ? input.newGrade : '', decidedBy: uid, decisionNote: input.note, decidedAt: new Date().toISOString() } as never });
      const student = first(r!.student);
      if (student) await zite.messages.create({ record: { body: `Your regrade request (${r!.label}) was decided: ${input.outcome === 'Grade Changed' ? `grade changed to ${input.newGrade}` : 'original grade kept'}. ${input.note}`, sender: uid, recipients: [student], isNotification: true } as never });
      return { ok: true };
    }

    const all = (await zite.regradeRequests.findAll({ limit: 2000 })).records
      .filter((r) => inSet(r.section, tenant.sections) && (registrar || teaching.has(first(r.section) ?? '')));
    const names = await userNames(all.flatMap((r) => [first(r.student) ?? '', first(r.decidedBy) ?? '']));
    return {
      grades: GRADES, me: uid, registrar,
      items: all.map((r) => ({
        id: r.id, label: r.label ?? '', status: r.status ?? 'Pending', reason: r.reason ?? '', gradeAtRequest: r.gradeAtRequest ?? '', newGrade: r.newGrade ?? '',
        student: names[first(r.student) ?? ''] ?? 'Student', self: first(r.student) === uid, decidedBy: names[first(r.decidedBy) ?? ''] ?? '', note: r.decisionNote ?? '',
        requestedAt: r.requestedAt ?? null, decidedAt: r.decidedAt ?? null,
      })).sort((x, y) => (x.status === 'Pending' ? 0 : 1) - (y.status === 'Pending' ? 0 : 1) || String(y.requestedAt).localeCompare(String(x.requestedAt))),
    };
  },
});
