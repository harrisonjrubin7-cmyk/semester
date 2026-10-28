import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { holdsFor } from '../lib/holdServer';
import { requireAccess, first, ids, tenantScope, inSet } from '../lib/server';

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
    const now = Date.now();
    const asOf = new Date(now).toISOString();
    const open = tasks.filter((t) => t.status === 'Open' && !t.parentId);
    const actions = [
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
    ].sort((x, y) => x.priority - y.priority || x.title.localeCompare(y.title));
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
