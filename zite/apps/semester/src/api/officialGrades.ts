import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, userNames, tenantScope, ids, first, audit } from '../lib/server';
import { pg } from '../lib/pg';
import { OGR_GRADES } from '../lib/ogrMigration';
import { ensureOgr, one, propose, isInstructorOfRecord, project, gradebookBasis, transcriptEntries } from '../lib/ogrServer';
import { buildTranscript, termOrder, policyProblems, DEFAULT_POLICY, type GradingPolicy } from '../lib/transcriptRules';
import { GPL_MIGRATION } from '../lib/gplMigration';

let gplReady: Promise<void> | null = null;
const ensureGpl = () => { if (!gplReady) gplReady = (async () => { for (const q of GPL_MIGRATION) await pg().query(q); })().catch((e) => { gplReady = null; throw e; }); return gplReady; };
const GRADE_KEY = z.string().trim().min(1).max(4).regex(/^[A-Z][A-Z+-]{0,3}$/, 'Grades are capital letters, + or -');
const POLICY = z.object({ scale: z.record(GRADE_KEY, z.number().min(0).max(5)), passing: z.array(GRADE_KEY).max(10), noCredit: z.array(GRADE_KEY).max(10),
  notAttempted: z.array(GRADE_KEY).max(10), incomplete: z.array(GRADE_KEY).max(10), repeat: z.enum(['latest', 'highest', 'all']) })
  .refine((p) => Object.keys(p.scale).length >= 2 && Object.keys(p.scale).length <= 30, 'The scale needs 2 to 30 grades');
/** The institution's approved policy, or the sample policy when none is approved. */
async function policyFor(T: string, institution: string): Promise<GradingPolicy & { version: number }> {
  await ensureGpl();
  const r = ((await pg().query(`SELECT version, policy FROM gpl_policies WHERE tenant_id = $1 AND status = 'Approved'`, [T])) as { version: number; policy: Omit<GradingPolicy, 'label' | 'source'> }[])[0];
  return r ? { ...r.policy, label: `${institution} grading policy, version ${r.version}`, source: 'institution', version: Number(r.version) } : { ...DEFAULT_POLICY, version: 0 };
}

// Course grade → released to the student → certified by the instructor of record → posted by the registrar as an
// append-only official revision (spec §16 first executable increment). Official projection is held in design mode.
type Row = Record<string, unknown>;
const GRADE = z.enum(OGR_GRADES as [string, ...string[]]);
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

export default createEndpoint({
  description: 'Final grades: propose, release and certify (instructor of record); post and correct official grades (registrar); see your own (student)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('teaching') }),
    z.object({ action: z.literal('propose'), enrollmentId: z.string(), grade: GRADE, expectedVersion: z.number().int() }),
    z.object({ action: z.literal('release'), enrollmentId: z.string(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('certify'), enrollmentId: z.string(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('queue') }),
    z.object({ action: z.literal('post'), enrollmentId: z.string(), expectedVersion: z.number().int(), requestKey: z.string().min(8).max(80) }),
    z.object({ action: z.literal('correct'), enrollmentId: z.string(), grade: GRADE, reason: z.string().max(1000), requestKey: z.string().min(8).max(80) }),
    z.object({ action: z.literal('reconcile') }),
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('transcript') }),
    z.object({ action: z.literal('transcriptFor'), studentId: z.string() }),
    z.object({ action: z.literal('policy') }),
    z.object({ action: z.literal('proposePolicy'), policy: POLICY, note: z.string().max(1000), expectedVersion: z.number().int().min(0) }),
    z.object({ action: z.literal('decidePolicy'), id: z.number().int(), approve: z.boolean(), note: z.string().max(1000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureOgr();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    const mode = String((await one(`SELECT aum_mode($1,'records') AS r`, [T])) ?? 'design');
    const enrollmentIn = async (id: string) => { const e = await zite.enrollments.findOne({ id }); if (!e || !(await tenantScope(T)).sections.has(first(e.section) ?? '')) forbid('Enrollment not found.'); return e!; };
    const fail = (r: string | null) => { if (r && !r.startsWith('ok:')) forbid(r); return r; };

    // ---------------- instructor of record ----------------
    if (input.action === 'propose') {
      await enrollmentIn(input.enrollmentId);
      fail(await propose(T, me, a.roles, input.enrollmentId, input.grade, input.expectedVersion));
      await audit(a, 'Course grade proposed', `enrollment:${input.enrollmentId}`, input.grade, 'Faculty');
    }
    if (input.action === 'release' || input.action === 'certify') {
      const e = await enrollmentIn(input.enrollmentId);
      const ok = await isInstructorOfRecord(first(e.section) ?? '', me, a.roles);
      fail(await one(`SELECT ogr_${input.action}($1,$2,$3,$4,$5) AS r`, [me, T, input.enrollmentId, ok, input.expectedVersion]));
      await audit(a, input.action === 'release' ? 'Course grade released' : 'Final grade certified', `enrollment:${input.enrollmentId}`, '', 'Faculty');
    }
    if (input.action === 'teaching' || input.action === 'propose' || input.action === 'release' || input.action === 'certify') {
      const secs = (await zite.sections.findAll({ filters: { instructors: me }, limit: 200 })).records.filter((s) => ids(s.instructors).includes(me));
      const enr = (await Promise.all(secs.map((s) => zite.enrollments.findAll({ filters: { section: s.id }, limit: 500 })))).flatMap((x) => x.records).filter((e) => e.status === 'Enrolled' || e.status === 'Completed');
      const props = enr.length ? (await sql.query(`SELECT * FROM ogr_proposals WHERE tenant_id = $1 AND enrollment_id = ANY($2)`, [T, enr.map((e) => e.id)])) as Row[] : [];
      const names = await userNames(enr.map((e) => first(e.student) ?? ''));
      const basisOf = async (e: typeof enr[number]) => gradebookBasis(first(e.section) ?? '', first(e.student) ?? '');
      return {
        mode, grades: OGR_GRADES, isFaculty: a.roles.includes('Faculty'),
        sections: await Promise.all(secs.map(async (s) => ({ id: s.id, label: s.label ?? '', students: await Promise.all(enr.filter((e) => first(e.section) === s.id).map(async (e) => {
          const p = props.find((x) => x.enrollment_id === e.id);
          return { enrollmentId: e.id, name: names[first(e.student) ?? ''] ?? 'Student', live: await basisOf(e),
            proposal: p ? { grade: String(p.grade), version: Number(p.version), state: String(p.state), released: !!p.released, certifiedVersion: p.certified_version === null ? null : Number(p.certified_version), basis: p.basis } : null };
        })) }))),
      };
    }

    // ---------------- transcripts (official revisions only) ----------------
    if (input.action === 'transcript' || input.action === 'transcriptFor') {
      let student = me;
      if (input.action === 'transcriptFor') {
        await requireAction(me, 'registrar.read');
        const has = ((await sql.query(`SELECT 1 FROM ogr_entries WHERE tenant_id = $1 AND student_id = $2 LIMIT 1`, [T, input.studentId])) as Row[]).length;
        if (!has) forbid('No official grades for that student in your institution.');
        student = input.studentId;
        await audit(a, 'Transcript viewed', `student:${student}`, '', 'Registrar');
      }
      const entries = (await transcriptEntries(T, student)).map((e) => ({ ...e, termOrder: termOrder(e.term) }));
      const name = (await userNames([student]))[student] ?? 'Student';
      return { student: name, institution: a.institutionName, mode, generatedAt: new Date().toISOString(), transcript: buildTranscript(entries, await policyFor(T, a.institutionName)) };
    }

    // ---------------- grading policy (registrar proposes, a different registrar approves) ----------------
    if (input.action === 'policy' || input.action === 'proposePolicy' || input.action === 'decidePolicy') {
      await requireAction(me, 'registrar.read'); await requireAction(me, 'registration.request.decide');
      await ensureGpl();
      if (input.action === 'proposePolicy') {
        const p = { ...input.policy, label: '', source: 'institution' as const };
        const problems = policyProblems(p);
        if (problems.length) forbid(problems.join(' '));
        const r = String(await one(`SELECT gpl_propose($1,$2,$3,$4::jsonb,$5,$6,$7) AS r`, [me, T, true, JSON.stringify(input.policy), true, input.note, input.expectedVersion]) ?? '');
        if (!r.startsWith('ok:')) forbid(r);
        await audit(a, 'Grading policy proposed', `grading-policy:${r.split(':')[1]}`, `version ${r.split(':')[2]}`, 'Registrar');
        return { ok: true, version: Number(r.split(':')[2]) };
      }
      if (input.action === 'decidePolicy') {
        const r = String(await one(`SELECT gpl_decide($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, true, input.approve, input.note]) ?? '');
        if (r !== 'ok') forbid(r);
        await audit(a, input.approve ? 'Grading policy approved' : 'Grading policy rejected', `grading-policy:${input.id}`, input.note, 'Registrar');
        return { ok: true };
      }
      const rows = (await sql.query(`SELECT id, version, policy, note, status, proposed_by, proposed_at, decided_by, decided_at, decision_note FROM gpl_policies WHERE tenant_id = $1 ORDER BY version DESC LIMIT 20`, [T])) as Row[];
      const names = await userNames(rows.flatMap((r) => [String(r.proposed_by), r.decided_by ? String(r.decided_by) : '']).filter(Boolean));
      const cur = await policyFor(T, a.institutionName);
      return {
        current: { ...cur, problems: policyProblems(cur) }, sample: DEFAULT_POLICY, me,
        history: rows.map((r) => ({ id: Number(r.id), version: Number(r.version), policy: r.policy, note: String(r.note), status: String(r.status),
          proposedBy: names[String(r.proposed_by)] ?? 'Registrar', mine: r.proposed_by === me, proposedAt: new Date(String(r.proposed_at)).toISOString(),
          decidedBy: r.decided_by ? names[String(r.decided_by)] ?? 'Registrar' : null, decidedAt: r.decided_at ? new Date(String(r.decided_at)).toISOString() : null, decisionNote: String(r.decision_note ?? '') })),
      };
    }

    // ---------------- registrar ----------------
    // Registrar gate: both registrar actions, through the unified deny-by-default authorizer (each decision is logged).
    if (['queue', 'post', 'correct', 'reconcile'].includes(input.action)) { await requireAction(me, 'registrar.read'); await requireAction(me, 'registration.request.decide'); }
    let receipt: unknown = null;
    if (input.action === 'post') {
      await enrollmentIn(input.enrollmentId);
      const r = fail(await one(`SELECT ogr_post($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.enrollmentId, true, input.requestKey, input.expectedVersion]))!;
      const [, entry, rev, replay] = r.split(':');
      const projected = await project(T, a.isSample, Number(entry), me);
      await audit(a, 'Official grade posted', `enrollment:${input.enrollmentId}`, `revision ${rev} · ${mode} · ${projected}`, 'Registrar');
      receipt = { entry: Number(entry), revision: Number(rev), replay: !!replay, mode, projected };
    }
    if (input.action === 'correct') {
      await enrollmentIn(input.enrollmentId);
      const r = fail(await one(`SELECT ogr_correct($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.enrollmentId, true, input.grade, input.reason, input.requestKey]))!;
      const [, entry, rev, replay] = r.split(':');
      const projected = await project(T, a.isSample, Number(entry), me);
      await audit(a, 'Official grade corrected', `enrollment:${input.enrollmentId}`, `revision ${rev} · ${input.reason.slice(0, 80)}`, 'Registrar');
      receipt = { entry: Number(entry), revision: Number(rev), replay: !!replay, mode, projected };
    }
    if (input.action === 'reconcile') {
      const pending = (await sql.query(`SELECT id FROM ogr_entries e WHERE tenant_id = $1 AND NOT EXISTS (SELECT 1 FROM ogr_projections p WHERE p.entry_id = e.id) ORDER BY id LIMIT 200`, [T])) as Row[];
      const out = { projected: 0, held: 0, failed: 0 };
      for (const p of pending) out[await project(T, a.isSample, Number(p.id), me)]++;
      receipt = out;
    }
    if (input.action === 'queue' || input.action === 'post' || input.action === 'correct' || input.action === 'reconcile') {
      const ready = (await sql.query(`SELECT * FROM ogr_proposals WHERE tenant_id = $1 AND state = 'Certified' ORDER BY certified_at LIMIT 300`, [T])) as Row[];
      const entries = (await sql.query(`SELECT e.*, EXISTS (SELECT 1 FROM ogr_projections p WHERE p.entry_id = e.id) AS projected FROM ogr_entries e WHERE tenant_id = $1 ORDER BY at DESC LIMIT 300`, [T])) as Row[];
      const people = [...ready.map((r) => String(r.student_id)), ...ready.map((r) => String(r.certified_by)), ...entries.map((e) => String(e.student_id)), ...entries.map((e) => String(e.posted_by))];
      const nm = await userNames([...new Set(people)]);
      const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label'] })).records;
      const label = (id: unknown) => secs.find((s) => s.id === String(id))?.label ?? '';
      return {
        mode, isSample: a.isSample, receipt,
        ready: ready.map((r) => ({ enrollmentId: String(r.enrollment_id), student: nm[String(r.student_id)] ?? 'Student', section: label(r.section_id), grade: String(r.grade), version: Number(r.version), certifiedBy: nm[String(r.certified_by)] ?? 'Instructor', certifiedAt: iso(r.certified_at), mineToPost: r.certified_by !== me })),
        entries: entries.map((e) => ({ id: Number(e.id), studentId: String(e.student_id), enrollmentId: String(e.enrollment_id), student: nm[String(e.student_id)] ?? 'Student', section: label(e.section_id), revision: Number(e.revision), grade: String(e.grade), previous: e.previous_grade ? String(e.previous_grade) : null,
          kind: String(e.kind), reason: String(e.reason ?? ''), postedBy: nm[String(e.posted_by)] ?? 'Registrar', authority: String(e.authority), projected: !!e.projected, at: iso(e.at) })),
      };
    }

    // ---------------- student ----------------
    const mine = (await zite.enrollments.findAll({ filters: { student: me }, limit: 500 })).records;
    const ids2 = mine.map((e) => e.id);
    const props = ids2.length ? (await sql.query(`SELECT enrollment_id, grade, released, state FROM ogr_proposals WHERE tenant_id = $1 AND enrollment_id = ANY($2) AND released`, [T, ids2])) as Row[] : [];
    const offs = ids2.length ? (await sql.query(`SELECT DISTINCT ON (enrollment_id) enrollment_id, grade, revision, authority, at FROM ogr_entries WHERE tenant_id = $1 AND enrollment_id = ANY($2) ORDER BY enrollment_id, revision DESC`, [T, ids2])) as Row[] : [];
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label'] })).records;
    return {
      mode,
      grades: mine.map((e) => {
        const p = props.find((x) => x.enrollment_id === e.id); const o = offs.find((x) => x.enrollment_id === e.id);
        return { enrollmentId: e.id, section: secs.find((s) => s.id === first(e.section))?.label ?? '', courseGrade: p ? String(p.grade) : null,
          official: o ? { grade: String(o.grade), revision: Number(o.revision), authority: String(o.authority), at: iso(o.at) } : null };
      }).filter((g) => g.courseGrade || g.official),
    };
  },
});
