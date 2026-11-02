import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, ids, first, forbid, audit, userNames } from '../lib/server';

export default createEndpoint({
  description: 'Alumni workspace: offer mentoring slots to students and see who booked them',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('addSlot'), startsAt: z.string(), topic: z.string().min(3).max(120) }),
    z.object({ action: z.literal('cancel'), id: z.string() }),
    z.object({ action: z.literal('complete'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'mentoring.offer');
    const uid = a.userId;
    if (input.action === 'addSlot') {
      if (new Date(input.startsAt).getTime() < Date.now()) forbid('Pick a time in the future.');
      await zite.appointments.create({ record: { label: `Mentoring · ${input.topic}`, kind: 'Mentoring', host: uid, startsAt: input.startsAt, status: 'Open Slot' } as never });
      await audit(a, 'Mentoring slot offered', 'appointment', input.topic, 'Alumni');
      return { ok: true };
    }
    if (input.action === 'cancel' || input.action === 'complete') {
      const s = await zite.appointments.findOne({ id: input.id });
      if (!s || first(s.host) !== uid) forbid('You can only change your own slots.');
      await zite.appointments.update({ id: s!.id, record: { status: input.action === 'cancel' ? 'Cancelled' : 'Completed' } as never });
      return { ok: true };
    }
    const { records } = await zite.appointments.findAll({ filters: { host: uid, kind: 'Mentoring' }, limit: 300 });
    const names = await userNames(records.flatMap((r) => ids(r.attendee)));
    return {
      slots: records.map((s) => ({ id: s.id, label: s.label ?? '', startsAt: s.startsAt ?? null, status: s.status ?? 'Open Slot', attendee: names[first(s.attendee) ?? ''] ?? null }))
        .sort((x, y) => (x.startsAt ?? '').localeCompare(y.startsAt ?? '')),
    };
  },
});
