import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid } from '../lib/server';

const vis = z.enum(['Only Me', 'Course', 'Selected Collaborators', 'Public Portfolio']);
const kind = z.enum(['Note', 'Flashcard Deck', 'Quiz', 'Study Plan', 'Portfolio Item']);

export default createEndpoint({
  description: 'Study tools: the member’s notes, flashcards, quizzes, study plans and portfolio items',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), id: z.string().optional(), title: z.string().min(1), kind, visibility: vis, body: z.string() }),
    z.object({ action: z.literal('delete'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    if (input.action === 'list') {
      const [{ records }, secs] = await Promise.all([
        zite.resources.findAll({ filters: { owner: uid }, limit: 500 }),
        zite.sections.findAll({ limit: 1000, fields: ['label'] }),
      ]);
      const sl = Object.fromEntries(secs.records.map((s) => [s.id, (s.label ?? '').split(' · ')[0]]));
      return {
        items: records.map((r) => ({ id: r.id, title: r.title ?? '', kind: r.kind ?? 'Note', visibility: r.visibility ?? 'Only Me', source: r.source ?? 'Yours', body: r.body ?? '', course: sl[first(r.section) ?? ''] ?? '' })),
      };
    }
    if (input.action === 'save') {
      if (input.id) {
        const r = await zite.resources.findOne({ id: input.id });
        if (!r || !ids(r.owner).includes(uid)) forbid();
        await zite.resources.update({ id: input.id, record: { title: input.title, kind: input.kind, visibility: input.visibility, body: input.body } as never });
      } else {
        await zite.resources.create({ record: { title: input.title, kind: input.kind, visibility: input.visibility, body: input.body, owner: uid, source: 'Yours' } as never });
      }
      return { ok: true };
    }
    const r = await zite.resources.findOne({ id: input.id });
    if (!r || !ids(r.owner).includes(uid)) forbid();
    await zite.resources.delete({ id: input.id });
    return { ok: true };
  },
});
