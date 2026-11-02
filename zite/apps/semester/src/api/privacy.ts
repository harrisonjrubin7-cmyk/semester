import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, forbid, audit, userNames, first } from '../lib/server';

export default createEndpoint({
  description: 'The member’s own consents, shares, access history, data export and deletion request',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setConsent'), id: z.string(), granted: z.boolean() }),
    z.object({ action: z.literal('revoke'), id: z.string() }),
    z.object({ action: z.literal('export') }),
    z.object({ action: z.literal('requestDeletion') }),
    z.object({ action: z.literal('shareFamily'), email: z.string().email(), categories: z.array(z.enum(['Grades', 'Holds', 'Calendar'])).min(1), expiresOn: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const own = async (id: string) => {
      const c = await zite.consents.findOne({ id });
      if (!c || !ids(c.member).includes(uid)) forbid();
      return c!;
    };
    if (input.action === 'setConsent') {
      const c = await own(input.id);
      if (c.consentType === 'Terms') forbid('Terms can only be changed by leaving the workspace.');
      if (c.consentType === 'AI Training' && input.granted) forbid('AI training is locked off by institution policy.');
      await zite.consents.update({ id: c.id, record: { granted: input.granted, revoked: !input.granted } as never });
      await audit(a, 'Consent changed', `consent:${c.id}`, `${c.label}: ${input.granted ? 'on' : 'off'}`, 'Owner');
      return { ok: true };
    }
    if (input.action === 'revoke') {
      const c = await own(input.id);
      await zite.consents.update({ id: c.id, record: { revoked: true, granted: false } as never });
      await audit(a, 'Share revoked', `consent:${c.id}`, c.label ?? '', 'Owner');
      return { ok: true };
    }
    if (input.action === 'export') {
      const [tasks, enr, res, ach, cons, cases] = await Promise.all([
        zite.tasks.findAll({ filters: { owner: uid }, limit: 2000 }), zite.enrollments.findAll({ filters: { student: uid }, limit: 2000 }),
        zite.resources.findAll({ filters: { owner: uid }, limit: 2000 }), zite.achievements.findAll({ filters: { owner: uid }, limit: 2000 }),
        zite.consents.findAll({ filters: { member: uid }, limit: 2000 }), zite.cases.findAll({ filters: { student: uid }, limit: 2000 }),
      ]);
      await audit(a, 'Data exported', `user:${uid}`, '', 'Owner');
      return { data: { exportedAt: new Date().toISOString(), email: context.user.email, tasks: tasks.records, enrollments: enr.records, resources: res.records, achievements: ach.records, consents: cons.records, cases: cases.records } };
    }
    if (input.action === 'shareFamily') {
      const { records } = await zite.auth.findAllUsers({ filters: { email: input.email.toLowerCase() }, limit: 1 });
      const g = records[0];
      if (!g) forbid('No one with that email has signed in to Semester Family yet. Ask them to sign in once, then share again.');
      if (g!.id === uid) forbid('You can’t share with yourself.');
      const c = await zite.consents.create({ record: { label: `Family: ${input.categories.join(', ')}`, member: uid, consentType: 'Data Sharing', recipient: g!.id, granted: true, revoked: false, expiresOn: input.expiresOn } as never });
      await audit(a, 'Shared with family', `consent:${c.id}`, `${input.categories.join(', ')} until ${input.expiresOn}`, 'Owner');
      return { ok: true };
    }
    if (input.action === 'requestDeletion') {
      const ref = 'DEL-' + Math.floor(1000 + Math.random() * 9000);
      await zite.cases.create({ record: { title: 'Data deletion request', student: uid, category: 'Service Request', status: 'Sent', reference: ref, notes: 'Delete personal notes, tasks, resources, achievements. Official academic records are kept per institution retention.' } as never });
      await audit(a, 'Deletion requested', `user:${uid}`, ref, 'Owner');
      return { ok: true, reference: ref };
    }
    const [cons, history] = await Promise.all([
      zite.consents.findAll({ filters: { member: uid }, limit: 200 }),
      zite.sql({ query: `SELECT "id","action","actor","recordRef","authority","occurredAt" FROM "AuditEvents" WHERE "recordRef" LIKE $1 OR "actor"::text LIKE $2 ORDER BY "occurredAt" DESC LIMIT 40`, params: [`%${uid}%`, `%${uid}%`] }),
    ]);
    const names = await userNames([...cons.records.map((c) => first(c.recipient) ?? ''), ...history.rows.map((r) => String(r.actor ?? '').replace(/[[\]"{}]/g, ''))]);
    return {
      consents: cons.records.map((c) => ({ id: c.id, label: c.label ?? '', type: c.consentType ?? '', granted: !!c.granted && !c.revoked, recipient: names[first(c.recipient) ?? ''] ?? '', expiresOn: c.expiresOn ?? null, recordedAt: c.recordedAt ?? null })),
      history: history.rows.map((r) => { const actor = String(r.actor ?? '').replace(/[[\]"{}]/g, ''); return { id: String(r.id), action: String(r.action ?? ''), actor: actor === uid ? 'You' : names[actor] ?? 'Staff', authority: String(r.authority ?? ''), at: String(r.occurredAt ?? '') }; }),
    };
  },
});
