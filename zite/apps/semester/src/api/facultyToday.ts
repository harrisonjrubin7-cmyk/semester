import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureOgr } from '../lib/ogrServer';
import { widget } from '../lib/facultyTodayRules';
import { ACC_MIGRATION } from '../lib/accMigration';
import { DSA_MIGRATION } from '../lib/dsaMigration';

type Row = Record<string, unknown>;
let accReady: Promise<void> | null = null;
const ensureAccDsa = () => { if (!accReady) accReady = (async () => { for (const q of [...ACC_MIGRATION, ...DSA_MIGRATION]) await pg().query(q); })().catch((e) => { accReady = null; throw e; }); return accReady; };

// Faculty Today (S-79 §4, S-82 §7): the instructor's work, each source loaded and reported on its own. Scope is always
// "sections where you are an instructor of record in your current institution"; nothing here reads private student work.
export default createEndpoint({
  description: 'Faculty Today: next classes, work to grade, final grades to certify and accommodation notices, each with its own data state',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const a = await requireAccess(context.user.id);
    const me = a.userId, T = a.institutionId;
    const isFaculty = a.roles.includes('Faculty');
    const all = (await zite.sections.findAll({ limit: 2000 })).records.filter((s) => ids(s.instructors).includes(me));
    // Tenant scope: only sections that belong to the current institution (same helper every endpoint uses).
    const scope = await tenantScope(T);
    const mine = all.filter((s) => scope.sections.has(s.id));
    const secIds = mine.map((s) => s.id);
    const label = Object.fromEntries(mine.map((s) => [s.id, s.label ?? s.id]));

    const sections = await widget(async () => ({ count: mine.length, items: mine.map((s) => ({ id: s.id, label: s.label ?? '', times: s.meetingTimes ?? '', term: s.term ?? '' })) }));

    const toGrade = await widget(async () => {
      if (!secIds.length) return { count: 0, items: [] as { submissionId: string; sectionId: string; section: string; task: string; student: string }[] };
      // Per-section queries: Zite caps a read at 2000 records, so never scan whole tables.
      const tasks = (await Promise.all(secIds.map((sid) => zite.tasks.findAll({ filters: { section: sid, type: 'Assignment' }, limit: 2000 })))).flatMap((r) => r.records);
      const subs = (await Promise.all(tasks.map((t) => zite.submissions.findAll({ filters: { task: t.id, state: 'Submitted' }, limit: 2000 })))).flatMap((r) => r.records);
      const names = await userNames(subs.map((x) => first(x.student) ?? ''));
      return { count: subs.length, items: subs.slice(0, 8).map((x) => { const t = tasks.find((tt) => tt.id === first(x.task))!; const sid = first(t.section) ?? '';
        return { submissionId: x.id, sectionId: sid, section: label[sid] ?? '', task: t.title ?? '', student: names[first(x.student) ?? ''] ?? 'Student' }; }) };
    });

    const finalGrades = await widget(async () => {
      if (!secIds.length) return { count: 0, items: [] as { section: string; toPropose: number; toRelease: number; toCertify: number }[] };
      await ensureOgr();
      const enr = (await Promise.all(secIds.map((sid) => zite.enrollments.findAll({ filters: { section: sid }, limit: 2000 })))).flatMap((r) => r.records).filter((e) => ['Enrolled', 'Completed'].includes(String(e.status)));
      const props = (await pg().query(`SELECT enrollment_id, section_id, state, released FROM ogr_proposals WHERE tenant_id = $1 AND section_id = ANY($2)`, [T, secIds])) as Row[];
      const items = secIds.map((sid) => {
        const es = enr.filter((e) => first(e.section) === sid); const ps = props.filter((p) => p.section_id === sid);
        const of = (e: { id: string }) => ps.find((p) => p.enrollment_id === e.id);
        return { section: label[sid], toPropose: es.filter((e) => !of(e)).length, toRelease: es.filter((e) => of(e) && !of(e)!.released).length,
          toCertify: es.filter((e) => of(e)?.released && of(e)!.state === 'Draft').length };
      }).filter((x) => x.toPropose + x.toRelease + x.toCertify > 0);
      return { count: items.reduce((n, x) => n + x.toRelease + x.toCertify, 0), items };
    });

    const accommodations = await widget(async () => {
      if (!secIds.length) return { count: 0, items: [] as { section: string; arrangements: string[] }[] };
      await ensureAccDsa();
      const rows = (await pg().query(`SELECT l.request_id, l.section_id, l.arrangements FROM acc_instructor_letters($1, $2) l
        WHERE NOT EXISTS (SELECT 1 FROM dsa_acks k WHERE k.request_id = l.request_id AND k.section_id = l.section_id)`, [T, secIds])) as Row[];
      // Minimum necessary: the section and the arrangements to implement, never the student's evidence.
      return { count: rows.length, items: rows.map((r) => ({ section: label[String(r.section_id)] ?? '', arrangements: (r.arrangements as string[]) ?? [] })) };
    });

    return { isFaculty, institution: a.institutionName, sections, toGrade, finalGrades, accommodations };
  },
});
