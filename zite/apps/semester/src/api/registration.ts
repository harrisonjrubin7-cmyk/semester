import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, tenantScope } from '../lib/server';
import { computeReadiness, firstBlocker } from '../lib/readiness';
import { replayDecision } from '../lib/registrarRules';

const parse = (t: string) => {
  const m = t.match(/^([A-Za-z/]+)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return null;
  return { days: m[1].split('/'), start: +m[2] * 60 + +m[3], end: +m[4] * 60 + +m[5] };
};
const overlaps = (a: string, b: string) => {
  const x = parse(a), y = parse(b);
  if (!x || !y) return false;
  return x.days.some((d) => y.days.includes(d)) && x.start < y.end && y.start < x.end;
};

export default createEndpoint({
  description: 'Registration: draft with prerequisite and conflict checks, readiness, submission to the Registrar, status and override requests',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), term: z.string() }),
    z.object({ action: z.literal('add'), sectionId: z.string() }),
    z.object({ action: z.literal('remove'), enrollmentId: z.string() }),
    z.object({ action: z.literal('requestOverride'), sectionId: z.string(), reason: z.string().min(5) }),
    z.object({ action: z.literal('submit'), term: z.string(), requestKey: z.string().min(8).optional() }),
    z.object({ action: z.literal('withdrawRequest'), enrollmentId: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const tenant = await tenantScope(a.institutionId);

    if (input.action === 'add') {
      if (!tenant.sections.has(input.sectionId)) forbid('That section is not offered by your institution.');
      const dup = await zite.enrollments.findOne({ filters: { student: uid, section: input.sectionId } });
      if (dup && dup.status !== 'Dropped') return { ok: true };
      await zite.enrollments.create({ record: { label: 'Registration draft', student: uid, section: input.sectionId, status: 'Planned', source: 'Yours' } as never });
      return { ok: true };
    }
    if (input.action === 'remove') {
      const e = await zite.enrollments.findOne({ id: input.enrollmentId });
      if (!e || !ids(e.student).includes(uid) || e.status !== 'Planned') forbid('Only sections still in your draft can be removed.');
      await zite.enrollments.delete({ id: input.enrollmentId });
      return { ok: true };
    }
    if (input.action === 'withdrawRequest') {
      const e = await zite.enrollments.findOne({ id: input.enrollmentId });
      if (!e || !ids(e.student).includes(uid) || e.status !== 'Requested') forbid('Only a request the Registrar has not acted on can be withdrawn.');
      await zite.enrollments.update({ id: e!.id, record: { status: 'Planned', label: 'Registration draft' } as never });
      await audit(a, 'Registration request withdrawn', `enrollment:${e!.id}`, '', 'Student self-service');
      return { ok: true };
    }
    if (input.action === 'requestOverride') {
      const s = await zite.sections.findOne({ id: input.sectionId });
      if (!s || !tenant.sections.has(s.id)) forbid();
      const t = await zite.tasks.create({
        record: { title: `Prerequisite override · ${(s!.label ?? '').split(' · ')[0]}`, owner: uid, requestedBy: uid, type: 'Approval Request', source: 'Made Here', status: 'Pending Approval', section: s!.id, rubric: input.reason, owningOffice: 'Academic Advising' } as never,
      });
      await audit(a, 'Override requested', `task:${t.id}`, input.reason, 'Student self-service');
      return { ok: true };
    }

    // Build the term picture (used by get and, server-side, by submit).
    const term = input.term;
    const [secs, courses, mine, requests, holdsRes] = await Promise.all([
      zite.sections.findAll({ limit: 2000 }),
      zite.courses.findAll({ limit: 2000 }),
      zite.enrollments.findAll({ filters: { student: uid }, limit: 500 }),
      zite.tasks.findAll({ filters: { requestedBy: uid, type: 'Approval Request' }, limit: 200 }),
      zite.tasks.findAll({ filters: { owner: uid, type: 'Hold', status: 'Open' }, limit: 20 }),
    ]);
    const courseById = Object.fromEntries(courses.records.filter((c) => tenant.courses.has(c.id)).map((c) => [c.id, c]));
    const secById = Object.fromEntries(secs.records.filter((s) => tenant.sections.has(s.id)).map((s) => [s.id, s]));
    const completedCourses = new Set(
      mine.records.filter((e) => e.status === 'Completed' || e.status === 'Enrolled').map((e) => first(secById[first(e.section) ?? '']?.course)).filter(Boolean),
    );
    const inTerm = (e: (typeof mine.records)[0]) => secById[first(e.section) ?? '']?.term === term;
    const planned = mine.records.filter((e) => e.status === 'Planned' && inTerm(e));
    const approvedOverrides = new Set(requests.records.filter((r) => r.status === 'Approved').map((r) => first(r.section)));
    const pendingOverrides = new Set(requests.records.filter((r) => r.status === 'Pending Approval').map((r) => first(r.section)));
    const describe = (sid: string) => {
      const s = secById[sid]; const c = courseById[first(s?.course) ?? ''];
      const missing = ids(c?.prerequisites).filter((p) => !completedCourses.has(p)).map((p) => courseById[p]?.code ?? '');
      return { sectionId: sid, code: c?.code ?? '', title: c?.title ?? '', credits: c?.credits ?? 0, section: (s?.label ?? '').split(' · ')[1] ?? '', times: s?.meetingTimes ?? '', missing, approved: approvedOverrides.has(sid), pending: pendingOverrides.has(sid) };
    };
    const draft = planned.map((e) => {
      const d = describe(first(e.section)!);
      const conflicts = planned.filter((o) => o.id !== e.id && overlaps(d.times, secById[first(o.section)!]?.meetingTimes ?? '')).map((o) => describe(first(o.section)!).code);
      return { enrollmentId: e.id, ...d, conflicts };
    });
    const holds = holdsRes.records.map((h) => h.title ?? 'Hold');
    const readiness = computeReadiness(draft, holds);

    if (input.action === 'submit') {
      // Retry safety: the same request key returns the earlier result instead of submitting again.
      if (input.requestKey) {
        const prior = await zite.registrationRequests.findAll({ filters: { requestKey: input.requestKey }, limit: 50 });
        const verdict = replayDecision(prior.records.map((r) => ({ studentIds: ids(r.student), sectionId: first(r.section) ?? '' })), uid, planned.map((e) => first(e.section) ?? ''));
        if (verdict === 'forbidden') forbid();
        if (verdict === 'conflict') forbid('This request ID was already used for different sections. Reload and submit again.');
        if (verdict === 'replay') return { ok: true, submitted: prior.records.filter((r) => r.state === 'Submitted').length, replayed: true };
      }
      // Registrar-placed holds that block registration.
      const regHolds = await zite.studentHolds.findAll({ filters: { student: uid, status: 'Active', blocksRegistration: true }, limit: 20 });
      if (regHolds.records.length) forbid(`Not ready to submit: ${regHolds.records[0].studentFacingMessage || 'a hold blocks registration'}`);
      const blocker = firstBlocker(readiness);
      if (blocker) forbid(`Not ready to submit: ${blocker}`);
      // Audit first, then hand each planned section to the Registrar's enrollment queue.
      await audit(a, 'Registration request submitted', `user:${uid}`, `${term}: ${draft.map((d) => d.code).join(', ')} (${readiness.credits} credits)`, 'Student self-service');
      for (const e of planned) await zite.enrollments.update({ id: e.id, record: { status: 'Requested', label: `Registration request · ${term}` } as never });
      if (input.requestKey && planned.length) {
        await zite.registrationRequests.bulkCreate({
          records: planned.map((e) => ({
            requestKey: input.requestKey!, student: uid, section: first(e.section)!, institution: a.institutionId,
            action: 'Add', state: 'Submitted', resultCode: 'OK', enrollment: e.id,
            safeExplanation: 'Received. Enrollment is not confirmed until the Registrar commits it.',
          })) as never,
        });
      }
      return { ok: true, submitted: planned.length };
    }

    const plannedIds = new Set(planned.map((p) => first(p.section)));
    const takenIds = new Set(mine.records.filter((e) => e.status !== 'Dropped' && inTerm(e)).map((e) => first(e.section)));
    const catalog = Object.values(secById).filter((s) => s.term === term && !plannedIds.has(s.id) && !takenIds.has(s.id)).map((s) => describe(s.id));
    const status = mine.records.filter((e) => inTerm(e) && ['Requested', 'Enrolled', 'Waitlisted', 'Dropped'].includes(e.status ?? '')).map((e) => ({ enrollmentId: e.id, ...describe(first(e.section)!), status: e.status ?? '', source: e.source ?? '' }));
    return { draft, catalog, holds, readiness, status };
  },
});
