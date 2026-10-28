import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureFil, attachmentsFor, readAttached, ensureScanned } from '../lib/filServer';

const POINTS: Record<string, number> = { 'A': 4, 'A-': 3.7, 'B+': 3.3, 'B': 3, 'B-': 2.7, 'C+': 2.3, 'C': 2, 'C-': 1.7, 'D': 1, 'F': 0 };

export default createEndpoint({
  description: 'Degree audit from released grades, estimated GPA, and achievements with verification',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('addAchievement'), title: z.string().min(2).max(200), evidenceFileId: z.string().uuid().optional() }),
    z.object({ action: z.literal('openEvidence'), achievementId: z.string(), fileId: z.string().uuid() }),
    z.object({ action: z.literal('verify'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const isStaff = a.roles.some((r) => ['Staff', 'Administrator', 'Advisor'].includes(r));
    if (input.action === 'addAchievement') {
      // Evidence is a file from the private store (decision D2). Evidence makes the entry reviewable by staff.
      const x = await zite.achievements.create({ record: { title: input.title, owner: uid, verification: input.evidenceFileId ? 'Needs Review' : 'Student Entered' } as never });
      if (input.evidenceFileId) {
        await ensureFil();
        const e = ((await pg().query(`SELECT fil_attach($1,$2,$3,'achievement',$4) AS e`, [a.institutionId, uid, input.evidenceFileId, x.id])) as { e: string | null }[])[0].e;
        if (e) { await zite.achievements.update({ id: x.id, record: { verification: 'Student Entered' } as never }); forbid(e); }
      }
      return { ok: true };
    }
    if (input.action === 'openEvidence') {
      const ach = await zite.achievements.findOne({ id: input.achievementId });
      if (!ach) forbid('You do not have access to this file.');
      const own = ids(ach!.owner).includes(uid);
      if (!own && !(isStaff && inSet(ach!.owner, (await tenantScope(a.institutionId)).members))) forbid('You do not have access to this file.');
      await ensureScanned(a.institutionId, [input.fileId]);
      const f = await readAttached(a.institutionId, input.fileId, uid, 'achievement', ach!.id);
      if (!f) forbid('You do not have access to this file.');
      return f!;
    }
    if (input.action === 'verify') {
      if (!isStaff) forbid('Only staff can verify achievements.');
      const ach = await zite.achievements.findOne({ id: input.id });
      if (!ach || ids(ach.owner).includes(uid)) forbid('You cannot verify your own achievement.');
      if (!inSet(ach!.owner, (await tenantScope(a.institutionId)).members)) forbid('That student is not in your institution.');
      await audit(a, 'Achievement verified', `achievement:${ach!.id}`, ach!.title ?? '', a.roles.join(', '));
      await zite.achievements.update({ id: ach!.id, record: { verification: 'Institution Verified', verifiedBy: uid, verifiedOn: new Date().toISOString().slice(0, 10) } as never });
      await ensureFil();
      await pg().query(`SELECT fil_lock($1,'achievement',$2)`, [a.institutionId, ach!.id]);
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
      // Only this institution's members (the review list was previously not tenant-filtered).
      const members = (await tenantScope(a.institutionId)).members;
      const all = (await zite.achievements.findAll({ filters: { verification: 'Needs Review' }, limit: 200 })).records.filter((x) => inSet(x.owner, members) && !ids(x.owner).includes(uid));
      const n = await userNames(all.map((x) => first(x.owner) ?? ''));
      const ev = await attachmentsFor(a.institutionId, 'achievement', all.map((x) => x.id));
      review = all.map((x) => ({ id: x.id, title: x.title ?? '', owner: n[first(x.owner) ?? ''] ?? 'Member', evidence: x.evidence?.[0]?.url ?? null, files: (ev[x.id] ?? []).map((f) => ({ fileId: f.fileId, name: f.name })) }));
    }
    const myEv = await attachmentsFor(a.institutionId, 'achievement', ach.records.map((x) => x.id));
    return {
      requirements, totalReq, totalEarned, gpa: cr ? Math.round((qp / cr) * 100) / 100 : null,
      grades: done.map((e) => ({ id: e.id, code: courseOf(e)?.code ?? '', title: courseOf(e)?.title ?? '', grade: e.finalGrade ?? '', term: sById[first(e.section) ?? '']?.term ?? '', source: e.source ?? 'Official' })),
      achievements: ach.records.map((x) => ({ id: x.id, title: x.title ?? '', verification: x.verification ?? 'Student Entered', verifiedBy: verifierNames[first(x.verifiedBy) ?? ''] ?? (x.verification === 'Institution Verified' ? 'Registrar (sample)' : ''), verifiedOn: x.verifiedOn ?? null, evidence: x.evidence?.[0]?.url ?? null, files: (myEv[x.id] ?? []).map((f) => ({ fileId: f.fileId, name: f.name })) })),
      review, isStaff,
    };
  },
});
