import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { holdsFor } from '../lib/holdServer';
import { requireAccess, requireAction, first, ids, tenantScope, inSet } from '../lib/server';
import { pg } from '../lib/pg';
import { adviseesSharing } from '../lib/advisees';
import { Action, rankActions, ownOverrideActions, deskOverrideActions, planActions, offerActions, OvrRow, DplRow, GasRow } from '../lib/actionRules';

/** Rows from a register that may not exist yet in this database (registers create their tables on first use). */
async function rowsIf<T>(table: string, query: string, params: unknown[]): Promise<T[]> {
  const ok = ((await pg().query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [table])) as { ok: boolean }[])[0].ok;
  return ok ? ((await pg().query(query, params)) as T[]) : [];
}

/** What the registers (overrides, degree plans, assistantship offers) have waiting on this person. */
async function registerActions(a: { userId: string; institutionId: string; roles: string[] }, members: Set<string>): Promise<Action[]> {
  const T = a.institutionId, me = a.userId;
  let registrar = false;
  try { await requireAction(me, 'registration.request.decide'); registrar = true; } catch { /* not a registrar */ }
  const isAdvisor = a.roles.includes('Advisor');
  const [ovrAdv, dplAdv] = isAdvisor ? await Promise.all([adviseesSharing(me, members, ['Registration plan']), adviseesSharing(me, members, ['Degree progress', 'Registration plan'])]) : [[], []];
  const [ownOvr, deskOvr, ownPlan, advPlans, offers] = await Promise.all([
    rowsIf<OvrRow>('ovr_requests', `SELECT id, kind, term, state, expires_at, student_id FROM ovr_requests WHERE tenant_id = $1 AND student_id = $2 AND state IN ('requested', 'endorsed', 'approved')`, [T, me]),
    registrar || ovrAdv.length ? rowsIf<OvrRow>('ovr_requests', `SELECT id, kind, term, state, expires_at, student_id FROM ovr_requests WHERE tenant_id = $1 AND student_id <> $2 AND state IN ('requested', 'endorsed') ORDER BY id LIMIT 300`, [T, me]) : Promise.resolve([]),
    rowsIf<DplRow>('dpl_plans', `SELECT id, state, student_id, review_note FROM dpl_plans WHERE tenant_id = $1 AND student_id = $2`, [T, me]),
    dplAdv.length ? rowsIf<DplRow>('dpl_plans', `SELECT id, state, student_id FROM dpl_plans WHERE tenant_id = $1 AND student_id = ANY($2::text[]) AND state = 'submitted'`, [T, dplAdv]) : Promise.resolve([]),
    rowsIf<GasRow>('gas_applications', `SELECT a.id, p.title, a.state FROM gas_applications a JOIN gas_postings p ON p.id = a.posting_id WHERE p.tenant_id = $1 AND a.student_id = $2 AND a.state = 'offered'`, [T, me]),
  ]);
  const now = Date.now();
  return [...ownOverrideActions(ownOvr.map((r) => ({ ...r, id: Number(r.id), expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null })), now),
    ...deskOverrideActions(deskOvr.map((r) => ({ ...r, id: Number(r.id) })), me, new Set(ovrAdv), registrar),
    ...planActions(ownPlan[0] ? { ...ownPlan[0], id: Number(ownPlan[0].id) } : null, advPlans.map((r) => ({ ...r, id: Number(r.id) }))),
    ...offerActions(offers.map((r) => ({ ...r, id: Number(r.id) })))];
}

export default createEndpoint({
  description: 'Gathers what needs the member today: tasks, holds, approvals, events and appointments',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const [mine, approvals, sections, events, appts] = await Promise.all([
      zite.tasks.findAll({ filters: { owner: uid }, limit: 500 }),
      zite.tasks.findAll({ filters: { type: 'Approval Request', status: 'Pending Approval' }, limit: 200 }),
      zite.sections.findAll({ limit: 500, fields: ['label'] }),
      zite.events.findAll({ filters: { attendees: uid }, limit: 100 }),
      zite.appointments.findAll({ filters: { attendee: uid, status: 'Booked' }, limit: 50 }),
    ]);
    const tenant = await tenantScope(a.institutionId);
    // Holds come from the Student Holds record (what registration enforces), never from tasks.
    const holdViews = await holdsFor(uid);
    approvals.records = approvals.records.filter((t) => inSet(t.requestedBy, tenant.members));
    const secLabel = Object.fromEntries(sections.records.map((s) => [s.id, (s.label ?? '').split(' · ').slice(0, 1).join('')]));
    const tasks = mine.records
      .filter((t) => t.type !== 'Approval Request' && t.type !== 'Hold')
      .map((t) => ({
        id: t.id, title: t.title ?? '', type: t.type ?? 'Personal', source: t.source ?? 'Yours', status: t.status ?? 'Open',
        dueAt: t.dueAt ?? null, course: secLabel[first(t.section) ?? ''] ?? '', parentId: first(t.parentTask) ?? null,
        owningOffice: t.owningOffice ?? '', points: t.points ?? null,
      }));
    const canApprove = a.roles.some((r) => ['Advisor', 'Administrator', 'Staff'].includes(r));
    const needs = approvals.records
      .filter((t) => ids(t.requestedBy).includes(uid) || (canApprove && !ids(t.requestedBy).includes(uid)))
      .map((t) => ({ id: t.id, title: t.title ?? '', mine: ids(t.requestedBy).includes(uid), office: t.owningOffice ?? '' }));
    // Action Center: fixed priority rules, no scoring. 1 holds (block registration),
    // 2 approvals waiting on this member, 3 overdue work, 4 work due within 48h, 5 own requests in flight.
    // Registers (overrides, degree plans, assistantship offers) add their items through lib/actionRules.ts.
    const now = Date.now();
    const asOf = new Date(now).toISOString();
    const open = tasks.filter((t) => t.status === 'Open' && !t.parentId);
    const taskActions = [
      ...holdViews.map((h) => ({
        id: h.id, priority: 1, title: h.title, state: 'Blocked',
        reason: h.message || (h.blocksRegistration ? 'This hold blocks registration.' : 'A hold can stop official requests.'),
        source: h.office, handoff: true,
        permittedAction: 'Contact the owning office', link: '/help',
        recovery: 'Only the owning office can clear a hold. Semester shows it cleared once the office confirms.',
      })),
      ...needs.filter((n) => !n.mine).map((n) => ({
        id: n.id, priority: 2, title: n.title, state: 'Waiting on you',
        reason: 'A request is pending your decision.', source: n.office || 'Semester', handoff: false,
        permittedAction: 'Review and decide', link: '/staff/registrar',
        recovery: 'You cannot approve your own request; another approver can pick it up.',
      })),
      ...open.filter((t) => t.type !== 'Hold' && t.dueAt).flatMap((t) => {
        const ms = Date.parse(t.dueAt!) - now;
        if (ms > 48 * 3600e3) return [];
        const overdue = ms < 0;
        return [{
          id: t.id, priority: overdue ? 3 : 4, title: t.title, state: overdue ? 'Overdue' : 'Due soon',
          reason: overdue ? 'The due date has passed.' : 'Due within 48 hours.',
          source: t.source, handoff: false, permittedAction: 'Open your work', link: '/today',
          recovery: overdue ? 'Ask your instructor about late work; the course policy decides.' : 'Mark it done when submitted.',
        }];
      }),
      ...needs.filter((n) => n.mine).map((n) => ({
        id: n.id, priority: 5, title: n.title, state: 'Waiting on ' + (n.office || 'approver'),
        reason: 'Your request is not complete until the approver confirms.', source: n.office || 'Semester', handoff: true,
        permittedAction: 'Check status', link: '/plan/registration',
        recovery: 'If it stalls, contact the office through Help.',
      })),
    ] as Action[];
    const actions = rankActions([...taskActions, ...(await registerActions(a, tenant.members))]);
    return {
      asOf,
      actions,
      tasks,
      approvals: needs,
      events: events.records.map((e) => ({ id: e.id, title: e.title ?? '', startsAt: e.startsAt ?? null, location: e.location ?? '' })),
      appointments: appts.records.map((x) => ({ id: x.id, label: x.label ?? '', startsAt: x.startsAt ?? null })),
    };
  },
});
