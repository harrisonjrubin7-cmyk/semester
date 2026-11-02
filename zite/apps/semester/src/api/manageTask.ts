import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit } from '../lib/server';

export default createEndpoint({
  description: 'Creates, updates, breaks down or deletes the member’s own tasks',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('create'), title: z.string().min(1), dueAt: z.string().nullable(), parentId: z.string().optional(), source: z.enum(['Yours', 'Made Here']).optional() }),
    z.object({ action: z.literal('bulkCreate'), items: z.array(z.object({ title: z.string().min(1), dueAt: z.string().nullable() })).max(50) }),
    z.object({ action: z.literal('update'), id: z.string(), title: z.string().optional(), dueAt: z.string().nullable().optional(), done: z.boolean().optional() }),
    z.object({ action: z.literal('breakdown'), id: z.string(), steps: z.array(z.string().min(1)).min(1).max(12) }),
    z.object({ action: z.literal('delete'), id: z.string() }),
  ]),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const own = async (id: string) => {
      const t = await zite.tasks.findOne({ id });
      if (!t || !ids(t.owner).includes(uid)) forbid();
      return t!;
    };
    if (input.action === 'create') {
      await zite.tasks.create({ record: { title: input.title, owner: uid, type: input.parentId ? 'Study Step' : 'Personal', source: input.source ?? 'Yours', status: 'Open', dueAt: input.dueAt, parentTask: input.parentId ?? null } as never });
    } else if (input.action === 'bulkCreate') {
      if (input.items.length) await zite.tasks.bulkCreate({ records: input.items.map((i) => ({ title: i.title, owner: uid, type: 'Assignment', source: 'Made Here', status: 'Open', dueAt: i.dueAt })) as never });
      await audit(a, 'Syllabus tasks created', `user:${uid}`, `${input.items.length} tasks`, 'Owner');
    } else if (input.action === 'update') {
      const t = await own(input.id);
      if (t.type === 'Hold') forbid('Holds can only be released by the office that owns them.');
      if (t.type === 'Approval Request') forbid('Requests are decided by an approver. Withdraw it instead if you no longer need it.');
      const rec: Record<string, unknown> = {};
      if (input.title !== undefined) rec.title = input.title;
      if (input.dueAt !== undefined) rec.dueAt = input.dueAt;
      if (input.done !== undefined) rec.status = input.done ? 'Done' : 'Open';
      const completing = input.done === true && t.status !== 'Done';
      const reopening = input.done === false && t.status === 'Done';
      // Audit the completion before applying it. Details carry the type only, never the task text (sensitive-field minimisation).
      if (completing || reopening) await audit(a, completing ? 'Task completed' : 'Task reopened', `task:${t.id}`, t.type ?? 'Personal', 'Owner');
      await zite.tasks.update({ id: input.id, record: rec as never });
      // When the last step of a broken-down task is done, tell the owner the parent is ready to close.
      const parentId = first(t.parentTask);
      if (completing && parentId) {
        const siblings = (await zite.tasks.findAll({ filters: { owner: uid, parentTask: parentId }, limit: 50, fields: ['status'] })).records;
        const parent = await zite.tasks.findOne({ id: parentId });
        if (parent && parent.status !== 'Done' && siblings.length && siblings.every((x) => x.id === t.id || x.status === 'Done')) {
          await zite.messages.create({ record: { body: `All steps are done for “${parent.title ?? 'your task'}”. Mark it done in Today when you’re ready.`, sender: uid, recipients: [uid], isNotification: true } as never });
        }
      }
    } else if (input.action === 'breakdown') {
      const t = await own(input.id);
      await zite.tasks.bulkCreate({ records: input.steps.map((s) => ({ title: s, owner: uid, type: 'Study Step', source: 'Yours', status: 'Open', parentTask: t.id, dueAt: t.dueAt ?? null })) as never });
    } else {
      const t = await own(input.id);
      if (t.source !== 'Yours' && t.source !== 'Made Here' && t.type !== 'Study Step') forbid('Only tasks you created can be deleted.');
      await zite.tasks.delete({ id: input.id });
    }
    return { ok: true };
  },
});
