import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';

const POINTS: Record<string, number> = { 'A': 4, 'A-': 3.7, 'B+': 3.3, 'B': 3, 'B-': 2.7, 'C+': 2.3, 'C': 2, 'C-': 1.7, 'D': 1, 'F': 0 };

export default createEndpoint({
  description: 'Degree audit from released grades, estimated GPA, and achievements with verification',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('addAchievement'), title: z.string().min(2), evidenceUrl: z.string().url().optional(), evidenceName: z.string().optional() }),
    z.object({ action: z.literal('verify'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const isStaff = a.roles.some((r) => ['Staff', 'Administrator', 'Advisor'].includes(r));
    if (input.action === 'addAchievement') {
      // Evidence uploads are disabled until a private file store exists (founder decision 23 Oct 2026).
      if (input.evidenceUrl) throw new Error('Evidence uploads are turned off until private storage is in place.');
      await zite.achievements.create({ record: { title: input.title, owner: uid, verification: 'Student Entered' } as never });
      return { ok: true };
    }
    if (input.action === 'verify') {
      if (!isStaff) forbid('Only staff can verify achievements.');
      const ach = await zite.achievements.findOne({ id: input.id });
      if (!ach || ids(ach.owner).includes(uid)) forbid('You cannot verify your own achievement.');
      if (!inSet(ach!.owner, (await tenantScope(a.institutionId)).members)) forbid('That student is not in your institution.');
      await audit(a, 'Achievement verified', `achievement:${ach!.id}`, ach!.title ?? '', a.roles.join(', '));
      await zite.achievements.update({ id: ach!.id, record: { verification: 'Institution Verified', verifiedBy: uid, verifiedOn: new Date().toISOString().slice(0, 10) } as never });
      return { ok: true };
    }
    const [reqs, courses, secs, enr, ach] = await Promise.all([
      zite.requirements.findAll({ filters: { institution: a.institutionId }, limit: 500 }), zite.courses.findAll({ limit: 1000 }), zite.sections.findAll({ limit: 1000 }),
      zite.enrollments.findAll({ filters: { student: uid }, limit: 500 }), zite.achievements.findAll({ filters: { owner: uid }, limit: 200 }),
    ]);
    const cById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
    const sById = Object.fromEntries(secs.records.map((s) => [s.id, s]));
    const done = enr.records.filter((e) => e.status === 'Completed' && e.gradeReleased);
    const inProgress = enr.records.filter((e) => e.status === 'Enrolled');
    const courseOf = (e: (typeof enr.records)[0]) => cById[first(sById[first(e.section) ?? '']?.course) ?? ''];
    const requirements = reqs.records.map((r) => {
      const earned = done.filter((e) => ids(courseOf(e)?.satisfies).includes(r.id)).reduce((n, e) => n + (courseOf(e)?.credits ?? 0), 0);
      const pending = inProgress.filter((e) => ids(courseOf(e)?.satisfies).includes(r.id)).reduce((n, e) => n + (courseOf(e)?.credits ?? 0), 0);
      return { id: r.id, name: r.name ?? '', required: r.creditsRequired ?? 0, earned: Math.min(earned, r.creditsRequired ?? 0), pending };
    });
    const totalReq = requirements.reduce((n, r) => n + r.required, 0);
    const totalEarned = requirements.reduce((n, r) => n + r.earned, 0);
    let qp = 0, cr = 0;
    done.forEach((e) => { const g = POINTS[e.finalGrade ?? '']; const c = courseOf(e)?.credits ?? 0; if (g !== undefined) { qp += g * c; cr += c; } });
    const verifierNames = await userNames(ach.records.map((x) => first(x.verifiedBy) ?? ''));
    let review: unknown[] = [];
    if (isStaff) {
      const all = await zite.achievements.findAll({ filters: { verification: 'Needs Review' }, limit: 100 });
      const n = await userNames(all.records.map((x) => first(x.owner) ?? ''));
      review = all.records.filter((x) => !ids(x.owner).includes(uid)).map((x) => ({ id: x.id, title: x.title ?? '', owner: n[first(x.owner) ?? ''] ?? 'Member', evidence: x.evidence?.[0]?.url ?? null }));
    }
    return {
      requirements, totalReq, totalEarned, gpa: cr ? Math.round((qp / cr) * 100) / 100 : null,
      grades: done.map((e) => ({ id: e.id, code: courseOf(e)?.code ?? '', title: courseOf(e)?.title ?? '', grade: e.finalGrade ?? '', term: sById[first(e.section) ?? '']?.term ?? '', source: e.source ?? 'Official' })),
      achievements: ach.records.map((x) => ({ id: x.id, title: x.title ?? '', verification: x.verification ?? 'Student Entered', verifiedBy: verifierNames[first(x.verifiedBy) ?? ''] ?? (x.verification === 'Institution Verified' ? 'Registrar (sample)' : ''), verifiedOn: x.verifiedOn ?? null, evidence: x.evidence?.[0]?.url ?? null })),
      review, isStaff,
    };
  },
});
