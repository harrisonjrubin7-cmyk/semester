import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, forbid } from '../lib/server';
import { pg } from '../lib/pg';
import { GTR_MIGRATION } from '../lib/gtrMigration';
import { STATUSES } from '../lib/gradeCalc';
import { policyFor } from '../lib/gplServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of GTR_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const num = z.number().finite();
const CourseDoc = z.object({
  credits: num.min(0).max(12), mode: z.enum(['weighted', 'points']), missingPolicy: z.enum(['exclude', 'zero']), extraCredit: z.boolean(),
  thresholds: z.array(z.object({ letter: z.string().min(1).max(4), min: num.min(0).max(200) })).max(20),
  categories: z.array(z.object({ id: z.string().min(1).max(40), name: z.string().min(1).max(80), weight: num.min(0).max(100).nullable() })).max(20),
  assignments: z.array(z.object({ id: z.string().min(1).max(40), name: z.string().min(1).max(120), category: z.string().max(40), status: z.enum(STATUSES),
    earned: num.nullable(), possible: num, whatIf: num.nullable().optional() })).max(300),
  unsupportedRules: z.array(z.string().min(1).max(200)).max(20),
});
const GpaDoc = z.object({
  prior: z.union([z.object({ mode: z.literal('exact'), qualityPoints: num.min(0), credits: num.min(0) }), z.object({ mode: z.literal('approx'), gpa: num.min(0).max(5), credits: num.min(0) }), z.null()]),
  courses: z.array(z.object({ name: z.string().min(1).max(120), credits: num.min(0).max(12), grade: z.string().max(4), basis: z.enum(['graded', 'pass_fail', 'excluded']) })).max(40),
});

// Student grade tracker and GPA simulator (S-72). Private planning data for the signed-in student only. Official released
// grades are shown beside it read-only and are never changed from here. Calculations live in lib/gradeCalc.ts.
export default createEndpoint({
  description: 'Grade tracker and GPA simulator: private planning plans with transparent calculations; official grades read-only',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('saveCourse'), id: z.number().int().nullable(), name: z.string().min(1).max(120), doc: CourseDoc, expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('saveGpa'), id: z.number().int().nullable(), name: z.string().min(1).max(120), doc: GpaDoc, expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('delete'), id: z.number().int(), expectedVersion: z.number().int(), restore: z.boolean().default(false) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let result: unknown = null;
    if (input.action === 'saveCourse' || input.action === 'saveGpa') {
      const out = ((await sql.query(`SELECT gtr_save($1,$2,$3,$4,$5,$6::jsonb,$7) AS r`, [T, me, input.id, input.action === 'saveCourse' ? 'course' : 'gpa', input.name, JSON.stringify(input.doc), input.expectedVersion])) as { r: string }[])[0].r;
      if (!out.startsWith('ok:')) forbid(out);
      result = { id: Number(out.split(':')[1]) };
    }
    if (input.action === 'delete') {
      const e = ((await sql.query(`SELECT gtr_delete($1,$2,$3,$4,$5) AS e`, [T, me, input.id, input.expectedVersion, input.restore])) as { e: string | null }[])[0].e;
      if (e) forbid(e);
      result = { id: input.id, restored: input.restore };
    }

    const plans = (await sql.query(`SELECT id, kind, name, doc, version, updated_at FROM gtr_plans WHERE tenant_id = $1 AND student_id = $2 AND deleted_at IS NULL ORDER BY kind, name`, [T, me])) as Row[];
    // Official, read-only: released grades (exact prior quality points) and current enrollments.
    const [courses, secs, enr] = await Promise.all([zite.courses.findAll({ limit: 2000 }), zite.sections.findAll({ limit: 2000 }), zite.enrollments.findAll({ filters: { student: me }, limit: 500 })]);
    const cById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
    const sById = Object.fromEntries(secs.records.map((s) => [s.id, s]));
    const courseOf = (e: (typeof enr.records)[0]) => cById[first(sById[first(e.section) ?? '']?.course) ?? ''];
    const released = enr.records.filter((e) => e.status === 'Completed' && e.gradeReleased);
    // The institution's approved grading policy (or the sample policy), the same one transcripts use.
    const policy = await policyFor(T, a.institutionName);
    let qp = 0, cr = 0;
    const official = released.map((e) => {
      const c = courseOf(e); const p = policy.scale[e.finalGrade ?? '']; const credits = c?.credits ?? 0;
      if (p !== undefined && credits > 0) { qp += p * credits; cr += credits; }
      return { code: c?.code ?? '', title: c?.title ?? '', credits, grade: e.finalGrade ?? '', gpaBearing: p !== undefined, term: sById[first(e.section) ?? '']?.term ?? '' };
    });
    const current = enr.records.filter((e) => e.status === 'Enrolled').map((e) => { const c = courseOf(e); return { code: c?.code ?? '', title: c?.title ?? '', credits: c?.credits ?? 0 }; });
    return {
      result,
      plans: plans.map((p) => ({ id: Number(p.id), kind: String(p.kind), name: String(p.name), doc: p.doc, version: Number(p.version), updatedAt: iso(p.updated_at) })),
      official, current, priorExact: { qualityPoints: Math.round(qp * 1000) / 1000, credits: cr }, scale: policy.scale, policyLabel: policy.label, policySource: policy.source,
    };
  },
});
