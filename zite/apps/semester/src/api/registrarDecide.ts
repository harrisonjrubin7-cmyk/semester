import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { tenantSources } from '../lib/sourcesServer';
import { sisBlock } from '../lib/sources';
import { pg, ensureSchema, sha256, dispatchOutbox } from '../lib/pg';
import { zite } from 'zitejs/db';
import { requireAction, first, ids, forbid, audit, tenantScope } from '../lib/server';
import { decideRegistration, commitBlocker } from '../lib/registrarRules';
import { overlaps } from '../lib/changeRules';
import { maxCredits } from '../lib/calendarServer';

/**
 * Registrar commits or rejects a submitted registration request. Rules live in lib/registrarRules (unit-tested).
 * Commits run as one Postgres transaction (lib/pg.ts, migrations/001) with a row lock on capacity and an idempotency key.
 */
export default createEndpoint({
  description: 'Registrar commits or rejects a submitted registration request with capacity and version checks',
  authenticated: true,
  inputSchema: z.object({
    requestId: z.string(),
    decision: z.enum(['commit', 'reject']),
    expectedSectionVersion: z.number().int(),
    note: z.string().max(500).optional(),
  }),
  outputSchema: z.object({ state: z.string(), resultCode: z.string(), message: z.string() }),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'registration.request.decide');
    const tenant = await tenantScope(a.institutionId);
    const req = await zite.registrationRequests.findOne({ id: input.requestId });
    if (!req) forbid('That request is not in your institution.');
    const sectionId = first(req!.section) ?? '';
    const section = sectionId ? await zite.sections.findOne({ id: sectionId }) : null;
    const { rows } = await zite.sql({
      query: `SELECT COUNT(*)::int AS n FROM "Enrollments" e JOIN "EnrollmentsSections" l ON l."enrollmentsId" = e.id WHERE l."sectionsId" = $1 AND e."status" = 'Enrolled'`,
      params: [sectionId],
    });
    const version = section?.recordVersion ?? 1;
    const out = decideRegistration({
      decider: { id: a.userId, institutionId: a.institutionId },
      request: { studentId: first(req!.student) ?? '', institutionId: first(req!.institution) ?? '', state: req!.state ?? 'Submitted', sectionInTenant: tenant.sections.has(sectionId) },
      section: { version, state: section?.sectionState, capacity: section?.capacity ?? null, enrolled: Number((rows[0] as { n?: number })?.n ?? 0) },
      expectedVersion: input.expectedSectionVersion,
      decision: input.decision,
    });

    if (out.kind === 'deny') forbid(out.message);
    if (out.kind === 'noop') return { state: req!.state!, resultCode: req!.resultCode ?? 'OK', message: 'Already decided — no change made.' };
    if (out.kind === 'stale') return { state: req!.state ?? 'Submitted', resultCode: 'STALE_VERSION', message: 'The section changed since you opened it. Reload and review again.' };

    // Invariant-bearing write: command + seat + receipt + audit + outbox in ONE Postgres transaction (reg_decide).
    // Capacity is enforced there under a row lock, so concurrent commits cannot oversell a section.
    // Stale source feeds block consequential commands (contract). Rejections still go through.
    // REG-023: read the student's ledger version before the checks; the commit refuses if any seat of theirs changed since.
    await ensureSchema();
    const studentVersion = Number(((await pg().query(`SELECT reg_student_version($1,$2) AS v`, [a.institutionId, first(req!.student) ?? ''])) as { v: string }[])[0].v);
    if (out.kind !== 'reject') {
      const blocked = sisBlock(await tenantSources(a.institutionId));
      if (blocked) return { state: req!.state ?? 'Submitted', resultCode: 'SOURCE_STALE', message: blocked };
      // Re-check what may have changed since the student submitted (lib/registrarRules commitBlocker, unit-tested).
      const student = first(req!.student) ?? '';
      const [holds, mine, overrides, courses, secs] = await Promise.all([
        zite.studentHolds.findAll({ filters: { student, status: 'Active', blocksRegistration: true }, limit: 20 }),
        zite.enrollments.findAll({ filters: { student }, limit: 500 }),
        zite.tasks.findAll({ filters: { requestedBy: student, type: 'Approval Request', status: 'Approved', section: sectionId }, limit: 5 }),
        zite.courses.findAll({ limit: 2000 }),
        zite.sections.findAll({ limit: 2000 }),
      ]);
      const secById = Object.fromEntries(secs.records.map((x) => [x.id, x]));
      const courseById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
      const term = section?.term ?? '';
      const course = courseById[first(section?.course) ?? ''];
      const secOf = (e: (typeof mine.records)[0]) => secById[first(e.section) ?? ''];
      // Prerequisites count only work from other terms; a same-term section cannot satisfy one.
      const done = new Set(mine.records.filter((e) => (e.status === 'Completed' || e.status === 'Enrolled') && secOf(e)?.term !== term).map((e) => first(secOf(e)?.course)).filter(Boolean));
      const confirmed = mine.records.filter((e) => e.status === 'Enrolled' && secOf(e)?.term === term && first(e.section) !== sectionId);
      const why = commitBlocker({
        holds: holds.records.map((h) => h.studentFacingMessage || 'a hold blocks registration'),
        missingPrereqs: ids(course?.prerequisites).filter((p) => !done.has(p)).map((p) => courseById[p]?.code ?? 'a prerequisite'),
        overrideApproved: overrides.records.length > 0,
        enrolledCredits: confirmed.reduce((n, e) => n + Number(courseById[first(secOf(e)?.course) ?? '']?.credits ?? 0), 0),
        sectionCredits: Number(course?.credits ?? 0),
        maxCredits: await maxCredits(a.institutionId),
        clashesWith: confirmed.filter((e) => overlaps(section?.meetingTimes ?? '', secOf(e)?.meetingTimes ?? '')).map((e) => courseById[first(secOf(e)?.course) ?? '']?.code ?? 'a section'),
      });
      if (why) return { state: req!.state ?? 'Submitted', resultCode: 'NEEDS_REVIEW', message: `Not committed. ${why}` };
    }
    const studentId = first(req!.student) ?? '';
    const decision = out.kind === 'reject' ? 'reject' : 'commit';
    const note = out.kind === 'reject' ? (input.decision === 'reject' && input.note ? input.note : out.message) : input.note ?? '';
    const commandKey = `registrar:${req!.id}`;
    const hash = await sha256(JSON.stringify({ requestId: req!.id, decision, sectionId, studentId }));
    const res = (await pg().query(`SELECT reg_decide_serial($11,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`,
      [a.institutionId, commandKey, hash, a.userId, decision, sectionId, studentId, req!.id, section?.capacity ?? null, note, studentVersion])) as { r: { conflict?: boolean; studentChanged?: boolean; replay?: boolean; state: string; resultCode: string; message: string } }[];
    const r = res[0].r;
    if (r.studentChanged) return { state: req!.state ?? 'Submitted', resultCode: 'STUDENT_CHANGED', message: "Another decision changed this student's schedule while you were reviewing. Nothing was committed — decide again to re-check credits and time clashes." };
    if (r.conflict) throw new ZiteError('This request was already decided differently. Reload before deciding again.');
    if (!r.replay) {
      await audit(a, `Registration ${r.state.toLowerCase()}`, `registrationRequest:${req!.id}`, `${r.resultCode} · receipt ${commandKey}`, 'Registrar');
      if (r.state === 'Committed') await zite.sections.update({ id: sectionId, record: { recordVersion: version + 1 } as never });
    }
    // Side effect on Zite records: dispatched from the outbox. If it fails it stays pending until reconciled.
    const d = await dispatchOutbox(a.institutionId, commandKey);
    const suffix = d.failed ? ' Saved in the registrar ledger; the student record will update when reconciliation runs.' : '';
    return { state: r.state, resultCode: r.resultCode, message: r.message + suffix };
  },
});
