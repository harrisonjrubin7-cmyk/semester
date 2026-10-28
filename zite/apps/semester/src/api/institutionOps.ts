import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, first, forbid, audit, userNames, inSet, capabilities } from '../lib/server';
import { pg } from '../lib/pg';
import { HLD_MIGRATION } from '../lib/hldMigration';
import { releaseRefusal, releaseNotice, HOLD_OFFICES } from '../lib/holdRules';

let hldReady: Promise<void> | null = null;
const ensureHld = () => { if (!hldReady) hldReady = (async () => { for (const q of HLD_MIGRATION) await pg().query(q); })().catch((e) => { hldReady = null; throw e; }); return hldReady; };
import { suppress, toCsv, METRICS, MIN_CELL } from '../lib/analytics';

const OFFICES = HOLD_OFFICES;

export default createEndpoint({
  description: 'Institution workspace: analytics, and placing or lifting registration holds',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('analytics') }),
    z.object({ action: z.literal('export') }),
    z.object({ action: z.literal('access') }),
    z.object({ action: z.literal('holds') }),
    z.object({ action: z.literal('placeHold'), studentId: z.string(), office: z.enum(OFFICES), message: z.string().min(10).max(400) }),
    z.object({ action: z.literal('releaseHold'), holdId: z.string(), reason: z.string().min(5) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    if (input.action === 'access') {
      // What this screen may ask for (Institution overview). Each widget then calls its own authorized action.
      const c = await capabilities(uid, ['readiness.read', 'registration.request.decide', 'registrar.read', 'audit.read', 'member.manage', 'catalog.manage']);
      const inst = c.institutionId ? await zite.institutions.findOne({ id: c.institutionId }) : undefined;
      return { roles: c.roles, member: !!c.institutionId, institutionName: inst?.name ?? '', isSample: !!inst?.isSample, can: c.can };
    }

    if (input.action === 'analytics' || input.action === 'export') {
      const a = await requireAction(uid, 'readiness.read');
      const p = [a.institutionId];
      const q = (query: string) => zite.sql({ query, params: p }).then((r) => r.rows);
      const [members, enroll, reqs, holds, cases, plans] = await Promise.all([
        q(`SELECT r AS role, COUNT(*)::int AS n FROM "Memberships" m JOIN "InstitutionsMemberships" l ON l."membershipsId" = m.id,
             jsonb_array_elements_text(m."roles") r WHERE l."institutionsId" = $1 AND m."status" = 'Active' GROUP BY r`),
        q(`SELECT e."status" AS k, COUNT(*)::int AS n FROM "Enrollments" e JOIN "EnrollmentsSections" es ON es."enrollmentsId" = e.id
             JOIN "CoursesSections" cs ON cs."sectionsId" = es."sectionsId" JOIN "CoursesInstitutions" ci ON ci."coursesId" = cs."coursesId"
             WHERE ci."institutionsId" = $1 GROUP BY e."status"`),
        q(`SELECT r."state" AS k, COUNT(*)::int AS n FROM "RegistrationRequests" r JOIN "RegistrationRequestsInstitutions" l ON l."registrationRequestsId" = r.id
             WHERE l."institutionsId" = $1 GROUP BY r."state"`),
        q(`SELECT h."originatingOffice" AS k, COUNT(*)::int AS n FROM "StudentHolds" h JOIN "InstitutionsStudentHolds" l ON l."studentHoldsId" = h.id
             WHERE l."institutionsId" = $1 AND h."status" = 'Active' GROUP BY h."originatingOffice"`),
        q(`SELECT r."resultCode" AS k, COUNT(*)::int AS n FROM "RegistrationRequests" r JOIN "RegistrationRequestsInstitutions" l ON l."registrationRequestsId" = r.id
             WHERE l."institutionsId" = $1 AND r."state" = 'Rejected' GROUP BY r."resultCode"`),
        q(`SELECT p."status" AS k, COUNT(*)::int AS n FROM "PaymentPlanRequests" p JOIN "InstitutionsPaymentPlanRequests" l ON l."paymentPlanRequestsId" = p.id
             WHERE l."institutionsId" = $1 GROUP BY p."status"`),
      ]);
      const pairs = (rows: Record<string, unknown>[], key = 'k') => rows.map((r) => ({ label: String(r[key] ?? 'Unset'), value: Number(r.n) }));
      // Disclosure control (lib/analytics.ts): raw counts never leave the server; small cells are suppressed with a complement.
      const raw: Record<string, ReturnType<typeof pairs>> = { members_by_role: pairs(members, 'role'), enrollments_by_status: pairs(enroll), registration_requests: pairs(reqs),
        rejection_reasons: pairs(cases), holds_by_office: pairs(holds), payment_plans: pairs(plans) };
      const metrics = METRICS.map((m) => ({ ...m, ...suppress(raw[m.id] ?? []) }));
      if (input.action === 'export') {
        await audit(a, 'Aggregate analytics exported', `institution:${a.institutionId}`, `${metrics.length} metrics, cells under ${MIN_CELL} suppressed`, a.roles.join(', '));
        return { filename: `semester-aggregates-${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(metrics.map((m) => ({ metric: m.label, cells: m.cells, totalDisplay: m.totalDisplay })), a.institutionName ?? 'Institution', new Date().toISOString()) };
      }
      return { institution: a.institutionName, isSample: a.isSample, minCell: MIN_CELL, metrics };
    }

    const a = await requireAction(uid, 'registration.request.decide');

    if (input.action === 'placeHold') {
      const m = (await zite.memberships.findAll({ filters: { member: input.studentId }, limit: 20 })).records
        .find((r) => first(r.institution) === a.institutionId && (r.roles ?? []).includes('Student'));
      if (!m) forbid('That student is not in your institution.');
      if (input.studentId === uid) forbid('You cannot place a hold on yourself.');
      const h = await zite.studentHolds.create({ record: {
        label: `${input.office} hold`, student: input.studentId, institution: a.institutionId, originatingOffice: input.office,
        blocksRegistration: true, status: 'Active', studentFacingMessage: input.message, isSample: a.isSample,
      } as never });
      await audit(a, 'Registration hold placed', `studentHold:${h.id}`, input.message, a.roles.join(', '));
      return { ok: true };
    }

    const all = (await zite.studentHolds.findAll({ filters: { institution: a.institutionId }, limit: 2000 })).records;

    if (input.action === 'releaseHold') {
      const h = all.find((x) => x.id === input.holdId);
      if (!h) forbid('This hold is no longer active.');
      const student = first(h!.student)!;
      const office = h!.originatingOffice ?? '';
      if (student === uid) forbid('This hold is on your own record, so someone else has to lift it.');
      const placed = (await zite.auditEvents.findAll({ filters: { recordRef: `studentHold:${h!.id}`, action: 'Registration hold placed' }, limit: 5 })).records;
      if (placed.some((e) => inSet(e.actor, new Set([uid])))) forbid('You placed this hold, so someone else has to lift it.');
      const m = await zite.memberships.findOne({ id: a.membershipId });
      const refusal = releaseRefusal(a.roles, m?.roleTemplates ?? [], office);
      if (refusal) forbid(refusal);
      await ensureHld();
      // A hold that is already lifted only continues if this person's own earlier attempt did not finish.
      if (h!.status !== 'Active' && !(await pg().query(`SELECT 1 FROM hld_releases WHERE hold_id = $1 AND tenant_id = $2 AND actor_id = $3 AND NOT applied`, [h!.id, a.institutionId, uid])).length) forbid('This hold is no longer active.');
      const claim = String((await pg().query(`SELECT hld_claim($1,$2,$3,$4,$5,$6) AS r`, [uid, a.institutionId, h!.id, student, office, input.reason]))[0].r);
      if (!claim.startsWith('ok')) forbid(claim);
      if (claim !== 'ok:done') {
        await zite.studentHolds.update({ id: h!.id, record: { status: 'Released' } as never });
        await pg().query(`SELECT hld_applied($1,$2,$3)`, [a.institutionId, h!.id, uid]);
        await audit(a, 'Registration hold released', `studentHold:${h!.id}`, input.reason, a.roles.join(', '));
      }
      // Registration rechecks every hold on each submit; this count is what the student is told now.
      const remaining = (await zite.studentHolds.findAll({ filters: { student, status: 'Active', blocksRegistration: true }, limit: 50 })).records.filter((x) => x.id !== h!.id).length;
      let notified = (await pg().query(`SELECT notified FROM hld_releases WHERE hold_id = $1`, [h!.id]))[0]?.notified === true;
      if (!notified) {
        try {
          await zite.messages.create({ record: { body: releaseNotice(h!.label ?? '', office, remaining), sender: uid, recipients: [student], isNotification: true, read: false } as never });
          notified = true;
          await pg().query(`SELECT hld_noticed($1,$2,true,'')`, [a.institutionId, h!.id]);
        } catch (e) {
          await pg().query(`SELECT hld_noticed($1,$2,false,$3)`, [a.institutionId, h!.id, String((e as Error).message ?? e)]);
        }
      }
      return { ok: true, remainingBlocking: remaining, notified };
    }

    const studentMs = (await zite.memberships.findAll({ filters: { institution: a.institutionId }, limit: 2000 })).records
      .filter((m) => m.status === 'Active' && (m.roles ?? []).includes('Student'));
    const studentIds = studentMs.map((m) => first(m.member) ?? '').filter(Boolean);
    const names = await userNames([...studentIds, ...all.map((h) => first(h.student) ?? '')]);
    const placers = await Promise.all(all.map((h) => zite.auditEvents.findAll({ filters: { recordRef: `studentHold:${h.id}` }, limit: 1 })));
    return {
      students: studentIds.map((id) => ({ id, name: names[id] ?? 'Student' })).sort((x, y) => x.name.localeCompare(y.name)),
      holds: all.map((h, i) => ({
        id: h.id, student: names[first(h.student) ?? ''] ?? 'Student', office: h.originatingOffice ?? '', status: h.status ?? '',
        message: h.studentFacingMessage ?? '', blocks: !!h.blocksRegistration, isSample: !!h.isSample,
        mine: inSet(placers[i].records[0]?.actor, new Set([uid])),
      })).sort((x, y) => (x.status === 'Active' ? 0 : 1) - (y.status === 'Active' ? 0 : 1)),
    };
  },
});
