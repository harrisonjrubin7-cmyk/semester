import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, tenantScope, first } from '../lib/server';
import { pg } from '../lib/pg';
import { whatIf, compare, Pathway } from '../lib/whatIfRules';

type Row = Record<string, unknown>;
const norm = (code: string) => code.replace(/ /g, '').toUpperCase();

// Major and minor exploration: what-if of the signed-in student's own completed and current courses against every program
// this institution has published (prg_programs, state 'published'). Read-only. Declaring or changing a program is an
// academic-record change made by the registrar; nothing here declares, requests or changes anything.
export default createEndpoint({
  description: 'Major and minor exploration: what-if of your own coursework against published programs (read-only)',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const a = await requireAccess(context.user.id);
    const T = a.institutionId, me = a.userId;
    const has = ((await pg().query(`SELECT to_regclass('prg_programs') IS NOT NULL AND to_regclass('cat_courses') IS NOT NULL AS ok`)) as { ok: boolean }[])[0].ok;
    if (!has) return { programs: [], note: 'This institution has not published any programs yet.' };
    const [rows, cat] = await Promise.all([
      pg().query(`SELECT code, name, credential, total_credits, term_cap, terms FROM prg_programs WHERE tenant_id = $1 AND state = 'published' ORDER BY code LIMIT 200`, [T]) as Promise<Row[]>,
      pg().query(`SELECT code, credits FROM prg_catalog($1)`, [T]) as Promise<Row[]>,
    ]);
    const credits = Object.fromEntries(cat.map((c) => [String(c.code), Number(c.credits)]));
    const scope = await tenantScope(T);
    const [courses, secs, enr] = await Promise.all([
      zite.courses.findAll({ limit: 2000 }), zite.sections.findAll({ limit: 2000 }), zite.enrollments.findAll({ filters: { student: me }, limit: 500 }),
    ]);
    const codeOf = Object.fromEntries(courses.records.filter((c) => scope.courses.has(c.id)).map((c) => [c.id, norm(c.code ?? '')]));
    const courseOf = Object.fromEntries(secs.records.filter((s) => scope.sections.has(s.id)).map((s) => [s.id, codeOf[first(s.course) ?? ''] ?? '']));
    const codes = (status: string, released?: boolean) => new Set(enr.records.filter((e) => e.status === status && (released === undefined || !!e.gradeReleased === released))
      .map((e) => courseOf[first(e.section) ?? '']).filter(Boolean));
    const done = codes('Completed', true), now = codes('Enrolled');
    const programs = compare(rows.map((r) => whatIf({ code: String(r.code), name: String(r.name), credential: String(r.credential), totalCredits: Number(r.total_credits),
      termCap: Number(r.term_cap), terms: (r.terms as string[][]) ?? [] } as Pathway, credits, done, now)));
    return { programs, completedCount: done.size, inProgressCount: now.size, note: rows.length ? null : 'This institution has not published any programs yet.' };
  },
});
