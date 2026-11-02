import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';
import { approvalEffect, approvalReason } from '../lib/approvalEffect';
import { ROLE_PERMISSIONS } from '../lib/authz';

export default createEndpoint({
  description: 'Approval queue: lists pending requests and records decisions (approver must differ from requester)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('decide'), id: z.string(), approve: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'approval.decide');
    const tenant = await tenantScope(a.institutionId);
    if (input.action === 'decide') {
      const t = await zite.tasks.findOne({ id: input.id });
      if (!t || t.type !== 'Approval Request' || t.status !== 'Pending Approval') forbid('This request is no longer pending.');
      if (!inSet(t!.requestedBy, tenant.members)) forbid('This request belongs to another institution.');
      if (ids(t!.requestedBy).includes(a.userId)) forbid('Two-person rule: you cannot approve your own request.');
      // Only the server-written reference at the start of the request counts (lib/approvalEffect.ts), and its target must be in this institution.
      const effect = approvalEffect(t!.title, t!.rubric);
      if (effect.kind === 'role') {
        if (!a.roles.includes('Administrator')) forbid('Only administrators can approve role changes.');
        if (!(effect.role in ROLE_PERMISSIONS)) forbid('That role does not exist.');
        const mem = await zite.memberships.findOne({ id: effect.membershipId });
        if (!mem || first(mem.institution) !== a.institutionId) forbid('This role change targets someone outside your institution.');
      }
      if (effect.kind === 'hold') {
        const h = await zite.tasks.findOne({ id: effect.holdId });
        if (!h || h.type !== 'Hold' || !inSet(h.owner, tenant.members)) forbid('This hold is not in your institution.');
      }
      // Audit is written before the change is applied.
      await audit(a, input.approve ? 'Request approved' : 'Request rejected', `task:${t!.id}`, t!.title ?? '', a.roles.join(', '));
      await zite.tasks.update({ id: t!.id, record: { status: input.approve ? 'Approved' : 'Rejected', approver: a.userId } as never });
      if (input.approve && effect.kind === 'role') {
        const mem = await zite.memberships.findOne({ id: effect.membershipId });
        if (mem) await zite.memberships.update({ id: mem.id, record: { roles: [...new Set([...(mem.roles ?? []), effect.role])] } as never });
      }
      if (input.approve && effect.kind === 'hold') await zite.tasks.update({ id: effect.holdId, record: { status: 'Done' } as never });
      return { ok: true };
    }
    const records = (await zite.tasks.findAll({ filters: { type: 'Approval Request' }, limit: 2000 })).records.filter((t) => inSet(t.requestedBy, tenant.members));
    const names = await userNames(records.flatMap((t) => [first(t.requestedBy) ?? '', first(t.approver) ?? '']));
    return {
      me: a.userId,
      items: records.map((t) => ({
        id: t.id, title: t.title ?? '', status: t.status ?? '', reason: approvalReason(t.title, t.rubric),
        requestedBy: names[first(t.requestedBy) ?? ''] ?? 'Member', requestedById: first(t.requestedBy) ?? '',
        approver: names[first(t.approver) ?? ''] ?? '', office: t.owningOffice ?? '',
      })),
    };
  },
});
