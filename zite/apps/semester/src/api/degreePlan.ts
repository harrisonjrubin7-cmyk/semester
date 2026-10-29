import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { DPL_MIGRATION } from '../lib/dplMigration';
import { checkPlan, cleanPlan, PlanCourse, PlanTerm } from '../lib/planRules';
import { adviseesSharing } from '../lib/advisees';
import { maxCredits } from '../lib/calendarServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of DPL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const termSchema = z.array(z.object({ term: z.string().max(60), courseIds: z.array(z.string().max(60)).max(10) })).max(12);

// Degree plans (dpl-001). A student drafts future terms; an advisor the student shared "Degree progress" or "Registration
// plan" with approves or asks for changes. The plan is checked against this institution's catalog and the student's own
// requirements, completed and in-progress work. It is advice only: nothing here registers anyone or changes a record.
async function studentView(T: string, studentId: string, scope: Awaited<ReturnType<typeof tenantScope>>, catalog: Record<string, PlanCourse & { title: string }>) {
  const [reqs, secs, enr] = await Promise.all([
    zite.requirements.findAll({ filters: { institution: T }, limit: 500 }), zite.sections.findAll({ limit: 2000 }), zite.enrollments.findAll({ filters: { student: studentId }, limit: 500 }),
  ]);
  const courseOfSection = Object.fromEntries(secs.records.filter((s) => scope.sections.has(s.id)).map((s) => [s.id, first(s.course) ?? '']));
  const done = enr.records.filter((e) => e.status === 'Completed' && e.gradeReleased).map((e) => courseOfSection[first(e.section) ?? '']).filter(Boolean);
  const now = enr.records.filter((e) => e.status === 'Enrolled').map((e) => courseOfSection[first(e.section) ?? '']).filter(Boolean);
  const credit = (list: string[], rid: string) => list.filter((c) => catalog[c]?.satisfies.includes(rid)).reduce((n, c) => n + (catalog[c]?.credits ?? 0), 0);
  const requirements = reqs.records.filter((r) => scope.requirements.has(r.id)).map((r) => {
    const required = r.creditsRequired ?? 0;
    return { id: r.id, name: r.name ?? '', required, earned: Math.min(required, credit(done, r.id)), pending: credit(now, r.id) };
  });
  const plan = ((await pg().query(`SELECT * FROM dpl_plans WHERE tenant_id = $1 AND student_id = $2`, [T, studentId])) as Row[])[0];
  const terms = (plan?.content as PlanTerm[] | undefined) ?? [];
  const check = checkPlan({ terms, courses: catalog, completed: new Set(done), inProgress: new Set(now), requirements, maxCredits: await maxCredits(T) });
  const approved = (plan?.approved_content as PlanTerm[] | null | undefined) ?? null;
  return {
    plan: plan ? { id: Number(plan.id), state: String(plan.state), version: Number(plan.version), reviewNote: String(plan.review_note), reviewedBy: plan.reviewed_by ? String(plan.reviewed_by) : null,
      approvedAt: iso(plan.approved_at), approvedBy: plan.approved_by ? String(plan.approved_by) : null, approvedTerms: approved, updatedAt: iso(plan.updated_at) } : null,
    terms, check,
  };
}

export default createEndpoint({
  description: 'Degree plans: a student plans future terms, checked against requirements; a shared advisor approves or asks for changes',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), studentId: z.string().optional() }),
    z.object({ action: z.literal('save'), terms: termSchema, version: z.number().int() }),
    z.object({ action: z.literal('step'), step: z.enum(['submit', 'recall', 'approve', 'changes']), id: z.number().int(), version: z.number().int(), note: z.string().max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const T = a.institutionId, me = a.userId;
    const scope = await tenantScope(T);
    const advisees = a.roles.includes('Advisor') ? await adviseesSharing(me, scope.members, ['Degree progress', 'Registration plan']) : [];
    const courses = (await zite.courses.findAll({ limit: 2000 })).records.filter((c) => scope.courses.has(c.id));
    const catalog: Record<string, PlanCourse & { title: string }> = Object.fromEntries(courses.map((c) => [c.id,
      { code: c.code ?? '', title: c.title ?? '', credits: c.credits ?? 0, satisfies: ids(c.satisfies), prerequisites: ids(c.prerequisites) }]));

    if (input.action === 'save') {
      const t = cleanPlan(input.terms);
      if (typeof t === 'string') forbid(t);
      const r = ((await pg().query(`SELECT dpl_save($1,$2,$3::jsonb,$4) AS r`, [T, me, JSON.stringify(t), input.version])) as { r: string }[])[0].r;
      if (!r.startsWith('ok:')) forbid(r);
      return { ok: true };
    }
    if (input.action === 'step') {
      const row = ((await pg().query(`SELECT student_id FROM dpl_plans WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!row) forbid('Plan not found.');
      const student = String(row.student_id);
      const r = ((await pg().query(`SELECT dpl_step($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, advisees.includes(student), input.step, input.id, input.version, input.note])) as { r: string }[])[0].r;
      if (!r.startsWith('ok:')) forbid(r);
      if (input.step === 'approve' || input.step === 'changes') {
        await audit(a, `Degree plan ${input.step === 'approve' ? 'approved' : 'changes requested'}`, `degree-plan:${input.id}`, input.note, 'Advisor');
        await zite.messages.create({ record: { body: input.step === 'approve' ? 'Your advisor approved your degree plan.' : 'Your advisor asked for changes to your degree plan.', sender: me, recipients: [student], isNotification: true, read: false } as never });
      }
      return { ok: true };
    }

    // get: your own plan, or one advisee's plan; plus the advisor's queue.
    const target = input.studentId && input.studentId !== me ? input.studentId : me;
    if (target !== me && !advisees.includes(target)) forbid('This student has not shared their plan with you.');
    const view = await studentView(T, target, scope, catalog);
    let queue: unknown[] = [];
    if (advisees.length) {
      const rows = (await pg().query(`SELECT id, student_id, state, updated_at FROM dpl_plans WHERE tenant_id = $1 AND student_id = ANY($2::text[]) ORDER BY state = 'submitted' DESC, updated_at DESC`, [T, advisees])) as Row[];
      const n = await userNames(advisees);
      const has = new Set(rows.map((r) => String(r.student_id)));
      queue = [...rows.map((r) => ({ studentId: String(r.student_id), name: n[String(r.student_id)] ?? 'Student', state: String(r.state), updatedAt: iso(r.updated_at) })),
        ...advisees.filter((s) => !has.has(s)).map((s) => ({ studentId: s, name: n[s] ?? 'Student', state: 'none', updatedAt: null }))];
    }
    const names = await userNames([target, view.plan?.reviewedBy ?? '', view.plan?.approvedBy ?? ''].filter(Boolean));
    return {
      me, target, own: target === me, studentName: target === me ? 'You' : names[target] ?? 'Student', isAdvisorFor: advisees.includes(target),
      ...view,
      plan: view.plan ? { ...view.plan, reviewedBy: view.plan.reviewedBy ? names[view.plan.reviewedBy] ?? 'Advisor' : null, approvedBy: view.plan.approvedBy ? names[view.plan.approvedBy] ?? 'Advisor' : null } : null,
      catalog: Object.entries(catalog).map(([id, c]) => ({ id, code: c.code, title: c.title, credits: c.credits })).sort((x, y) => x.code.localeCompare(y.code)),
      queue,
    };
  },
});
