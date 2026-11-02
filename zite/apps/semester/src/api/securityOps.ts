import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, first, userNames } from '../lib/server';

const SENSITIVE = /role|hold|grade|suspend|sample|retention|authoriz|rollback|deletion|export|verified|override/i;

export default createEndpoint({
  description: 'Institution security operations: sensitive actions, actor activity and member access state',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const a = await requireAction(context.user.id, 'security.manage');
    const [ev, mems] = await Promise.all([
      zite.auditEvents.findAll({ filters: { institution: a.institutionId }, limit: 2000 }),
      zite.memberships.findAll({ filters: { institution: a.institutionId }, limit: 2000 }),
    ]);
    const events = ev.records.sort((x, y) => (y.occurredAt ?? '').localeCompare(x.occurredAt ?? ''));
    const names = await userNames(events.map((e) => first(e.actor) ?? ''));
    const weekAgo = Date.now() - 7 * 864e5;
    const recent = events.filter((e) => e.occurredAt && new Date(e.occurredAt).getTime() > weekAgo);
    const byActor: Record<string, number> = {};
    recent.forEach((e) => { const n = names[first(e.actor) ?? ''] ?? 'Member'; byActor[n] = (byActor[n] ?? 0) + 1; });
    return {
      totals: {
        week: recent.length,
        sensitive: recent.filter((e) => SENSITIVE.test(e.action ?? '')).length,
        assistant: recent.filter((e) => e.viaAssistant).length,
        suspended: mems.records.filter((m) => m.status === 'Suspended').length,
        pending: mems.records.filter((m) => m.status === 'Pending').length,
        admins: mems.records.filter((m) => (m.roles ?? []).includes('Administrator') && m.status === 'Active').length,
      },
      actors: Object.entries(byActor).map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count).slice(0, 10),
      sensitive: events.filter((e) => SENSITIVE.test(e.action ?? '')).slice(0, 50).map((e) => ({ id: e.id, action: e.action ?? '', actor: names[first(e.actor) ?? ''] ?? 'Member', when: e.occurredAt ?? null, ref: e.recordRef ?? '', authority: e.authority ?? '', viaAssistant: !!e.viaAssistant })),
    };
  },
});
