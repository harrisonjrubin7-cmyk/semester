import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, userNames, audit } from '../lib/server';

export default createEndpoint({
  description: 'Notifications and in-app mail for the signed-in member',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('send'), to: z.array(z.string()).min(1), body: z.string().min(1).max(5000) }),
    z.object({ action: z.literal('read'), id: z.string(), read: z.boolean() }),
    z.object({ action: z.literal('readAll') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    if (input.action === 'send') {
      // Only people who share this institution can be messaged.
      const { records } = await zite.memberships.findAll({ filters: { institution: a.institutionId, status: 'Active' }, limit: 2000 });
      const allowed = new Set(records.flatMap((m) => ids(m.member)));
      const to = input.to.filter((t) => allowed.has(t) && t !== uid);
      if (!to.length) forbid('You can only message active members of your institution.');
      await zite.messages.create({ record: { body: input.body, sender: uid, recipients: to, isNotification: false, read: false } as never });
      await audit(a, 'Message sent', 'message', `${to.length} recipient(s)`);
      return { ok: true };
    }
    if (input.action === 'read') {
      const m = await zite.messages.findOne({ id: input.id });
      if (!m || !ids(m.recipients).includes(uid)) forbid();
      await zite.messages.update({ id: input.id, record: { read: input.read } as never });
      return { ok: true };
    }
    if (input.action === 'readAll') {
      const { records } = await zite.messages.findAll({ filters: { recipients: uid, read: false }, limit: 500 });
      for (const m of records) await zite.messages.update({ id: m.id, record: { read: true } as never });
      return { ok: true };
    }
    const [inbox, sent, mems] = await Promise.all([
      zite.messages.findAll({ filters: { recipients: uid }, limit: 500 }),
      zite.messages.findAll({ filters: { sender: uid }, limit: 300 }),
      zite.memberships.findAll({ filters: { institution: a.institutionId, status: 'Active' }, limit: 2000 }),
    ]);
    const people = [...new Set(mems.records.flatMap((m) => ids(m.member)))].filter((p) => p !== uid);
    const all = [...inbox.records, ...sent.records];
    const names = await userNames([...people, ...all.flatMap((m) => [...ids(m.sender), ...ids(m.recipients)])]);
    const map = (m: (typeof all)[0]) => ({
      id: m.id, body: m.body ?? '', read: !!m.read, isNotification: !!m.isNotification, sentAt: m.sentAt ?? null,
      from: names[first(m.sender) ?? ''] ?? (m.isNotification ? 'Semester' : 'Member'),
      to: ids(m.recipients).map((r) => names[r] ?? 'Member'),
    });
    const sort = (x: { sentAt: string | null }, y: { sentAt: string | null }) => (y.sentAt ?? '').localeCompare(x.sentAt ?? '');
    return {
      notifications: inbox.records.filter((m) => m.isNotification).map(map).sort(sort),
      mail: inbox.records.filter((m) => !m.isNotification && !first(m.group)).map(map).sort(sort),
      sent: sent.records.filter((m) => !first(m.group)).map(map).sort(sort),
      people: people.map((p) => ({ id: p, name: names[p] ?? 'Member' })).sort((x, y) => x.name.localeCompare(y.name)),
    };
  },
});
