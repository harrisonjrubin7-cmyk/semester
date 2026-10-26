import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';
import { ADVISOR_CATEGORIES, liveShares, shareBlocker, shareLabel, ConsentRow } from '../lib/shares';

const today = () => new Date().toISOString().slice(0, 10);
const row = (c: { id: string; member?: string | string[] | null; recipient?: string | string[] | null; label?: string | null; consentType?: string | null; granted?: boolean | null; revoked?: boolean | null; expiresOn?: string | null }): ConsentRow => ({
  id: c.id, member: ids(c.member), recipient: ids(c.recipient), label: c.label ?? '', consentType: c.consentType ?? '', granted: !!c.granted, revoked: !!c.revoked, expiresOn: c.expiresOn ?? null,
});

export default createEndpoint({
  description: 'Advisor sharing: a student shares chosen parts of their record with one advisor until a date; the advisor sees only that, and every view is logged',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('advisors') }),
    z.object({ action: z.literal('share'), advisorId: z.string(), categories: z.array(z.enum(ADVISOR_CATEGORIES)).min(1), expiresOn: z.string() }),
    z.object({ action: z.literal('students') }),
    z.object({ action: z.literal('view'), studentId: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const activeAdvisors = async () => {
      const { records } = await zite.memberships.findAll({ filters: { institution: a.institutionId }, limit: 2000 });
      return records.filter((m) => m.status === 'Active' && (m.roles ?? []).includes('Advisor')).map((m) => first(m.member) ?? '').filter((x) => x && x !== uid);
    };

    if (input.action === 'advisors') {
      const list = await activeAdvisors();
      const names = await userNames(list);
      return { advisors: list.map((id) => ({ id, name: names[id] ?? 'Advisor' })), categories: ADVISOR_CATEGORIES };
    }

    if (input.action === 'share') {
      const advisors = await activeAdvisors();
      const blocker = shareBlocker({ studentId: uid, advisorId: input.advisorId, advisorIsActiveAdvisorHere: advisors.includes(input.advisorId), categories: input.categories, expiresOn: input.expiresOn, today: today() });
      if (blocker) forbid(blocker);
      const c = await zite.consents.create({ record: { label: shareLabel('Advisor', input.categories), member: uid, consentType: 'Data Sharing', recipient: input.advisorId, granted: true, revoked: false, expiresOn: input.expiresOn } as never });
      const names = await userNames([input.advisorId]);
      await audit(a, 'Shared with advisor', `consent:${c.id}`, `${names[input.advisorId] ?? 'Advisor'}: ${input.categories.join(', ')} until ${input.expiresOn}`, 'Owner');
      await zite.messages.create({ record: { body: `A student shared ${input.categories.join(', ').toLowerCase()} with you until ${input.expiresOn}. Open Shared with me.`, sender: uid, recipients: [input.advisorId], isNotification: true } as never });
      return { ok: true };
    }

    // Advisor side.
    if (!a.roles.includes('Advisor')) forbid('Only advisors can see what students share with them.');
    const tenant = await tenantScope(a.institutionId);
    const consents = (await zite.consents.findAll({ filters: { recipient: uid, consentType: 'Data Sharing' }, limit: 2000 })).records.map(row);
    const shares = liveShares(consents, uid, 'Advisor', today()).filter((s) => tenant.members.has(s.studentId));

    if (input.action === 'students') {
      const names = await userNames(shares.map((s) => s.studentId));
      return { students: shares.map((s) => ({ id: s.studentId, name: names[s.studentId] ?? 'Student', categories: s.categories, expiresOn: s.expiresOn })) };
    }

    const share = shares.find((s) => s.studentId === input.studentId);
    if (!share) forbid('This student is not sharing anything with you right now.');
    const can = (cat: string) => share!.categories.includes(cat);
    const sid = share!.studentId;
    const [enr, holds, agenda, secs, courses] = await Promise.all([
      can('Degree progress') || can('Registration plan') ? zite.enrollments.findAll({ filters: { student: sid }, limit: 500 }) : null,
      can('Holds') ? zite.tasks.findAll({ filters: { owner: sid, type: 'Hold' }, limit: 50 }) : null,
      can('Advising agenda') ? zite.resources.findOne({ filters: { owner: sid, title: 'Advising agenda' } }) : null,
      zite.sections.findAll({ limit: 2000, fields: ['label', 'course', 'term'] }),
      zite.courses.findAll({ limit: 2000, fields: ['code', 'title', 'credits'] }),
    ]);
    const sById = Object.fromEntries(secs.records.filter((s) => tenant.sections.has(s.id)).map((s) => [s.id, s]));
    const cById = Object.fromEntries(courses.records.filter((c) => tenant.courses.has(c.id)).map((c) => [c.id, c]));
    const course = (e: { section?: string | string[] | null }) => cById[first(sById[first(e.section) ?? '']?.course) ?? ''];
    const mine = (enr?.records ?? []).filter((e) => inSet(e.section, tenant.sections));
    // Audit before returning anything: the student sees this in Access history.
    await audit(a, 'Advisor view', `user:${sid}`, share!.categories.join(', '), 'Student share');
    const names = await userNames([sid]);
    const done = mine.filter((e) => e.status === 'Completed' && e.gradeReleased);
    return {
      student: { id: sid, name: names[sid] ?? 'Student', categories: share!.categories, expiresOn: share!.expiresOn },
      degree: can('Degree progress') ? {
        creditsEarned: done.reduce((n, e) => n + (course(e)?.credits ?? 0), 0),
        completed: done.map((e) => ({ id: e.id, code: course(e)?.code ?? '', title: course(e)?.title ?? '', grade: e.finalGrade ?? '', term: sById[first(e.section) ?? '']?.term ?? '', source: e.source ?? '' })),
      } : null,
      plan: can('Registration plan') ? mine.filter((e) => ['Planned', 'Requested', 'Enrolled', 'Waitlisted'].includes(e.status ?? '')).map((e) => ({ id: e.id, code: course(e)?.code ?? '', title: course(e)?.title ?? '', term: sById[first(e.section) ?? '']?.term ?? '', status: e.status ?? '' })) : null,
      holds: holds ? holds.records.filter((h) => h.status === 'Open').map((h) => ({ id: h.id, title: h.title ?? '', office: h.owningOffice ?? '', source: h.source ?? '' })) : null,
      agenda: can('Advising agenda') ? (agenda && agenda.visibility !== 'Only Me' ? { body: agenda.body ?? '', updated: null } : { body: null, updated: null }) : null,
    };
  },
});
