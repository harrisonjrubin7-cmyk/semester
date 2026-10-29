import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { holdsFor } from '../lib/holdServer';
import { responseBlocker, responseNotice } from '../lib/holdRules';
import { requireAccess, ids, first, forbid, audit, tenantScope } from '../lib/server';
import { computeReadiness, firstBlocker } from '../lib/readiness';
import { submitOutcome } from '../lib/registrarRules';
import { pg } from '../lib/pg';
import { SUB_MIGRATION } from '../lib/subMigration';

let subReady: Promise<void> | null = null;
const ensureSub = () => { if (!subReady) subReady = (async () => { for (const q of SUB_MIGRATION) await pg().query(q); })().catch((e) => { subReady = null; throw e; }); return subReady; };
import { HLD_MIGRATION } from '../lib/hldMigration';
let hldReady: Promise<void> | null = null;
const ensureHld = () => { if (!hldReady) hldReady = (async () => { for (const q of HLD_MIGRATION) await pg().query(q); })().catch((e) => { hldReady = null; throw e; }); return hldReady; };
type Reservation = { forbidden?: boolean; created?: boolean; sections: string[]; state: 'reserved' | 'done'; term: string };
import { registrationWindow, maxCredits } from '../lib/calendarServer';
import { OVR_MIGRATION } from '../lib/ovrMigration';
let ovrReady: Promise<void> | null = null;
const ensureOvr = () => { if (!ovrReady) ovrReady = (async () => { for (const q of OVR_MIGRATION) await pg().query(q); })().catch((e) => { ovrReady = null; throw e; }); return ovrReady; };

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
    z.object({ action: z.literal('requestException'), kind: z.enum(['credit_overload', 'late_registration']), term: z.string().max(40), sectionId: z.string().optional(), credits: z.number().min(1).max(40).optional(), reason: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('respondToHold'), holdId: z.string(), body: z.string().min(1).max(2000) }),
    z.object({ action: z.literal('submit'), term: z.string(), requestKey: z.string().min(8).max(100) }),
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
      // Close the Registrar's copy too, so a withdrawn request cannot be committed later.
      const open = await zite.registrationRequests.findAll({ filters: { enrollment: e!.id, state: { in: ['Submitted', 'Evaluating', 'Needs Review'] } }, limit: 10 });
      for (const r of open.records) await zite.registrationRequests.update({ id: r.id, record: { state: 'Rejected', resultCode: 'POLICY_RESTRICTION', safeExplanation: 'Withdrawn by the student before the Registrar acted.' } as never });
      await zite.enrollments.update({ id: e!.id, record: { status: 'Planned', label: 'Registration draft' } as never });
      await audit(a, 'Registration request withdrawn', `enrollment:${e!.id}`, '', 'Student self-service');
      return { ok: true };
    }
    if (input.action === 'requestOverride' || input.action === 'requestException') {
      // Overrides and exceptions (ovr-001): one register; registrars decide, advisors endorse overloads and late registration.
      await ensureOvr();
      const sid = input.action === 'requestOverride' ? input.sectionId : input.sectionId;
      let term = input.action === 'requestException' ? input.term : '';
      if (sid) { const s = await zite.sections.findOne({ id: sid }); if (!s || !tenant.sections.has(s.id)) forbid(); if (!term) term = s!.term ?? ''; }
      const p = input.action === 'requestOverride' ? { kind: 'prerequisite', term, sectionId: sid, reason: input.reason.length >= 10 ? input.reason : `${input.reason} (prerequisite)` }
        : { kind: input.kind, term, sectionId: sid, credits: input.credits, reason: input.reason };
      const r = ((await pg().query(`SELECT ovr_request($1,$2,$3,$4::jsonb) AS r`, [a.institutionId, uid, a.roles.includes('Student'), JSON.stringify(p)])) as { r: string }[])[0].r;
      if (!r.startsWith('ok:')) forbid(r);
      await audit(a, input.action === 'requestOverride' ? 'Override requested' : 'Exception requested', `override:${r.slice(3)}`, p.reason, 'Student self-service');
      return { ok: true };
    }

    if (input.action === 'respondToHold') {
      const h = await zite.studentHolds.findOne({ id: input.holdId });
      if (!h || first(h.student) !== uid || first(h.institution) !== a.institutionId) forbid('That hold is not on your record.');
      const blocked = responseBlocker(h!.status, input.body);
      if (blocked) forbid(blocked);
      await ensureHld();
      const out = String(((await pg().query(`SELECT hld_respond($1,$2,$3,$4,$5) AS r`, [a.institutionId, h!.id, uid, h!.status, input.body])) as { r: string }[])[0].r);
      if (out !== 'ok') forbid(out);
      await audit(a, 'Hold response sent', `studentHold:${h!.id}`, '', 'Student self-service');
      // Tell the person who placed the hold. The notice names the hold only; the response is read in the holds desk.
      const placed = (await zite.auditEvents.findAll({ filters: { recordRef: `studentHold:${h!.id}`, action: 'Registration hold placed' }, limit: 5 })).records;
      const placer = first(placed[0]?.actor);
      if (placer && placer !== uid) await zite.messages.create({ record: { body: responseNotice(h!.label ?? '', h!.originatingOffice ?? ''), sender: uid, recipients: [placer], isNotification: true, read: false } as never }).catch(() => undefined);
      return { ok: true };
    }

    // Build the term picture (used by get and, server-side, by submit).
    const term = input.term;
    const [secs, courses, mine, requests, holdsRes] = await Promise.all([
      zite.sections.findAll({ limit: 2000 }),
      zite.courses.findAll({ limit: 2000 }),
      zite.enrollments.findAll({ filters: { student: uid }, limit: 500 }),
      zite.tasks.findAll({ filters: { requestedBy: uid, type: 'Approval Request' }, limit: 200 }),
      holdsFor(uid),
    ]);
    const courseById = Object.fromEntries(courses.records.filter((c) => tenant.courses.has(c.id)).map((c) => [c.id, c]));
    const secById = Object.fromEntries(secs.records.filter((s) => tenant.sections.has(s.id)).map((s) => [s.id, s]));
    const completedCourses = new Set(
      mine.records.filter((e) => e.status === 'Completed' || e.status === 'Enrolled').map((e) => first(secById[first(e.section) ?? '']?.course)).filter(Boolean),
    );
    const inTerm = (e: (typeof mine.records)[0]) => secById[first(e.section) ?? '']?.term === term;
    const planned = mine.records.filter((e) => e.status === 'Planned' && inTerm(e));
    // Older overrides were approval tasks; new ones are ovr-001 requests. Both count; only ovr approvals are single use.
    await ensureOvr();
    const ovr = (await pg().query(`SELECT id, kind, section_id, credits_requested, state, expires_at FROM ovr_requests WHERE tenant_id = $1 AND student_id = $2 AND lower(term) = lower($3)`, [a.institutionId, uid, term])) as { id: number; kind: string; section_id: string | null; credits_requested: string | null; state: string; expires_at: string | null }[];
    const live = ovr.filter((o) => o.state === 'approved' && o.expires_at && new Date(o.expires_at).getTime() > Date.now());
    const approvedOverrides = new Set([...requests.records.filter((r) => r.status === 'Approved').map((r) => first(r.section)), ...live.filter((o) => o.kind === 'prerequisite').map((o) => o.section_id)]);
    const pendingOverrides = new Set([...requests.records.filter((r) => r.status === 'Pending Approval').map((r) => first(r.section)),
      ...ovr.filter((o) => o.kind === 'prerequisite' && ['requested'].includes(o.state)).map((o) => o.section_id)]);
    const relied: number[] = [];
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
    const holds = holdsRes.filter((h) => h.blocksRegistration).map((h) => h.title);
    const readiness = computeReadiness(draft, holds);

    if (input.action === 'submit') {
      // Idempotency first: a finished submit replays, a half-finished one resumes without re-validating.
      await ensureSub();
      const plannedSections = planned.map((e) => first(e.section)!).filter(Boolean);
      const prior = ((await pg().query(`SELECT student_id, sections, state, term FROM reg_submit_keys WHERE tenant_id = $1 AND request_key = $2`, [a.institutionId, input.requestKey])) as { student_id: string; sections: string[]; state: 'reserved' | 'done'; term: string }[])[0];
      if (prior && prior.student_id !== uid) forbid();
      let outcome = submitOutcome(prior ? { sections: prior.sections, state: prior.state } : null, plannedSections);
      if (outcome === 'conflict') forbid('This request ID was already used for different sections. Reload and submit again.');
      if (outcome === 'replay') return { ok: true, submitted: prior!.sections.length, replayed: true };
      if (outcome === 'new') {
      // Registration window (approved academic calendar). Terms without an approved calendar behave as before.
      const win = await registrationWindow(a.institutionId, input.term);
      if (win === 'not_yet') forbid(`Registration for ${input.term} has not opened yet.`);
      if (win === 'closed') {
        const late = live.filter((o) => o.kind === 'late_registration');
        const uncovered = planned.map((e) => first(e.section)!).filter((sid) => !late.some((o) => o.section_id === sid));
        if (uncovered.length) forbid(`Registration for ${input.term} is closed. Ask for a late-registration exception (your advisor endorses it, the registrar decides).`);
        relied.push(...late.filter((o) => planned.some((e) => first(e.section) === o.section_id)).map((o) => Number(o.id)));
      }
      // Approved registration rules: credit limit across what is planned now and already requested/enrolled this term.
      const cap = await maxCredits(a.institutionId);
      if (cap != null) {
        const held = mine.records.filter((e) => inTerm(e) && ['Requested', 'Enrolled', 'Waitlisted'].includes(e.status ?? '')).reduce((n, e) => n + Number(describe(first(e.section)!).credits || 0), 0);
        const total = held + draft.reduce((n, d) => n + Number(d.credits || 0), 0);
        const overload = live.filter((o) => o.kind === 'credit_overload' && Number(o.credits_requested) >= total).sort((x, y) => Number(x.credits_requested) - Number(y.credits_requested))[0];
        if (total > cap && !overload) forbid(`That would be ${total} credits this term; the limit is ${cap}. Remove a course or request a credit overload (your advisor endorses it, the registrar decides).`);
        if (total > cap && overload) relied.push(Number(overload.id));
      }
      // Registrar-placed holds that block registration.
      const regHolds = await zite.studentHolds.findAll({ filters: { student: uid, status: 'Active', blocksRegistration: true }, limit: 20 });
      if (regHolds.records.length) forbid(`Not ready to submit: ${regHolds.records[0].studentFacingMessage || 'a hold blocks registration'}`);
      const blocker = firstBlocker(readiness);
      if (blocker) forbid(`Not ready to submit: ${blocker}`);
      if (!plannedSections.length) forbid('Add at least one section before submitting.');
      // Reserve the key before any write. A concurrent submit with the same key gets the same reservation.
      const r = ((await pg().query(`SELECT reg_submit_reserve($1,$2,$3,$4,$5) AS r`, [a.institutionId, input.requestKey, uid, term, plannedSections])) as { r: Reservation }[])[0].r;
      if (r.forbidden) forbid();
      if (!r.created) {
        outcome = submitOutcome({ sections: r.sections, state: r.state }, plannedSections);
        if (outcome === 'conflict') forbid('This request ID was already used for different sections. Reload and submit again.');
        if (outcome === 'replay') return { ok: true, submitted: r.sections.length, replayed: true };
      }
      relied.push(...live.filter((o) => o.kind === 'prerequisite' && plannedSections.includes(String(o.section_id)) && (describe(String(o.section_id)).missing.length > 0)).map((o) => Number(o.id)));
      if (relied.length) await pg().query(`SELECT ovr_use($1,$2,$3::bigint[])`, [a.institutionId, uid, [...new Set(relied)]]);
      await audit(a, 'Registration request submitted', `user:${uid}`, `${term}: ${draft.map((d) => d.code).join(', ')} (${readiness.credits} credits) · key ${input.requestKey.slice(0, 8)}`, 'Student self-service');
      }
      // Write (or finish writing) exactly the reserved sections. Each step is safe to repeat.
      const reserved = ((await pg().query(`SELECT sections FROM reg_submit_keys WHERE tenant_id = $1 AND request_key = $2`, [a.institutionId, input.requestKey])) as { sections: string[] }[])[0].sections;
      const existing = await zite.registrationRequests.findAll({ filters: { requestKey: input.requestKey }, limit: 50 });
      const haveRow = new Set(existing.records.map((x) => first(x.section)));
      for (const sid of reserved) {
        const e = mine.records.find((m) => first(m.section) === sid && m.status !== 'Dropped');
        if (!e) continue;
        if (e.status === 'Planned') await zite.enrollments.update({ id: e.id, record: { status: 'Requested', label: `Registration request · ${term}` } as never });
        if (!haveRow.has(sid)) await zite.registrationRequests.create({ record: {
          requestKey: input.requestKey, student: uid, section: sid, institution: a.institutionId,
          action: 'Add', state: 'Submitted', resultCode: 'OK', enrollment: e.id,
          safeExplanation: 'Received. Enrollment is not confirmed until the Registrar commits it.',
        } as never });
      }
      await pg().query(`SELECT reg_submit_done($1,$2)`, [a.institutionId, input.requestKey]);
      return { ok: true, submitted: reserved.length, resumed: outcome === 'resume' };
    }

    await ensureHld();
    const respRows = holdsRes.length ? ((await pg().query(`SELECT hold_id, body, at FROM hld_responses WHERE tenant_id = $1 AND student_id = $2 AND hold_id = ANY($3::text[]) ORDER BY at`, [a.institutionId, uid, holdsRes.map((h) => h.id)])) as { hold_id: string; body: string; at: unknown }[]) : [];
    const holdViews = holdsRes.map((v) => ({ ...v, responses: respRows.filter((r) => r.hold_id === v.id).map((r) => ({ body: r.body, at: r.at ? new Date(String(r.at)).toISOString() : null })) }));
    const plannedIds = new Set(planned.map((p) => first(p.section)));
    const takenIds = new Set(mine.records.filter((e) => e.status !== 'Dropped' && inTerm(e)).map((e) => first(e.section)));
    const catalog = Object.values(secById).filter((s) => s.term === term && !plannedIds.has(s.id) && !takenIds.has(s.id)).map((s) => describe(s.id));
    const status = mine.records.filter((e) => inTerm(e) && ['Requested', 'Enrolled', 'Waitlisted', 'Dropped'].includes(e.status ?? '')).map((e) => ({ enrollmentId: e.id, ...describe(first(e.section)!), status: e.status ?? '', source: e.source ?? '' }));
    return { draft, catalog, holds, holdViews, readiness, status, window: await registrationWindow(a.institutionId, term) };
  },
});
