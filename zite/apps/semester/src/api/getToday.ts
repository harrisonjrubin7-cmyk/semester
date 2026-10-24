import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
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
    approvals.records = approvals.records.filter((t) => inSet(t.requestedBy, tenant.members));
    const secLabel = Object.fromEntries(sections.records.map((s) => [s.id, (s.label ?? '').split(' · ').slice(0, 1).join('')]));
    const tasks = mine.records
      .filter((t) => t.type !== 'Approval Request')
      .map((t) => ({
        id: t.id, title: t.title ?? '', type: t.type ?? 'Personal', source: t.source ?? 'Yours', status: t.status ?? 'Open',
        dueAt: t.dueAt ?? null, course: secLabel[first(t.section) ?? ''] ?? '', parentId: first(t.parentTask) ?? null,
        owningOffice: t.owningOffice ?? '', points: t.points ?? null,
      }));
    const canApprove = a.roles.some((r) => ['Advisor', 'Administrator', 'Staff'].includes(r));
    const needs = approvals.records
      .filter((t) => ids(t.requestedBy).includes(uid) || (canApprove && !ids(t.requestedBy).includes(uid)))
      .map((t) => ({ id: t.id, title: t.title ?? '', mine: ids(t.requestedBy).includes(uid), office: t.owningOffice ?? '' }));
    return {
      tasks,
      approvals: needs,
      events: events.records.map((e) => ({ id: e.id, title: e.title ?? '', startsAt: e.startsAt ?? null, location: e.location ?? '' })),
      appointments: appts.records.map((x) => ({ id: x.id, label: x.label ?? '', startsAt: x.startsAt ?? null })),
    };
  },
});
