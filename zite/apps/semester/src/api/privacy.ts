import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, forbid, audit, userNames, first } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureFam } from '../lib/famServer';
const today = () => new Date().toISOString().slice(0, 10);

export default createEndpoint({
  description: 'The member’s own consents, shares, access history, data export and deletion request',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setConsent'), id: z.string(), granted: z.boolean() }),
    z.object({ action: z.literal('revoke'), id: z.string() }),
    z.object({ action: z.literal('export') }),
    z.object({ action: z.literal('requestDeletion') }),
    z.object({ action: z.literal('shareFamily'), email: z.string().email(), categories: z.array(z.enum(['Grades', 'Holds', 'Calendar', 'Billing'])).min(1), expiresOn: z.string() }),
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
      // A family share ends in the delegation record too (that is what Semester Family reads).
      await ensureFam();
      const fi = ((await pg().query(`SELECT id FROM fam_invites WHERE consent_id = $1 AND student_id = $2 AND state IN ('Pending','Accepted')`, [c.id, uid])) as { id: number }[])[0];
      if (fi) { const r = String(((await pg().query(`SELECT fam_end($1,$2) AS r`, [uid, fi.id])) as { r: string }[])[0].r); if (r !== 'ok') forbid(r); }
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
      // An invitation, not access: nothing is visible until the account holding this email accepts in Semester Family.
      await ensureFam();
      const email = input.email.trim().toLowerCase();
      const me = String(((await zite.sql({ query: `SELECT "email" FROM "ziteUsers" WHERE "id" = $1`, params: [uid] })).rows[0] as { email?: string } | undefined)?.email ?? '').toLowerCase();
      const r = String(((await pg().query(`SELECT fam_invite($1,$2,$3,$4,$5::date,$6::date,NULL) AS r`, [uid, me, email, input.categories, input.expiresOn, today()])) as { r: string }[])[0].r);
      if (!r.startsWith('ok:')) forbid(r);
      const inviteId = Number(r.slice(3));
      const { records } = await zite.auth.findAllUsers({ filters: { email }, limit: 1 });
      const g = records[0];
      const c = await zite.consents.create({ record: { label: `Family: ${input.categories.join(', ')} → ${email}`, member: uid, consentType: 'Data Sharing', recipient: g?.id, granted: true, revoked: false, expiresOn: input.expiresOn } as never });
      await pg().query(`UPDATE fam_invites SET consent_id = $1 WHERE id = $2 AND student_id = $3`, [c.id, inviteId, uid]);
      // In-app only: Semester sends no outside email. Someone without an account sees the invitation when they first sign in.
      if (g) await zite.messages.create({ record: { body: 'A student invited you to see part of their record in Semester Family. Open Semester Family to accept or decline.', sender: uid, recipients: [g.id], isNotification: true, read: false } as never });
      await audit(a, 'Family invitation sent', `consent:${c.id}`, `${input.categories.join(', ')} until ${input.expiresOn}`, 'Owner');
      return { ok: true, notified: !!g };
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
    await ensureFam();
    const fam = (await pg().query(`SELECT consent_id, state, recipient_email FROM fam_invites WHERE student_id = $1`, [uid])) as { consent_id: string | null; state: string; recipient_email: string }[];
    const names = await userNames([...cons.records.map((c) => first(c.recipient) ?? ''), ...history.rows.map((r) => String(r.actor ?? '').replace(/[[\]"{}]/g, ''))]);
    return {
      consents: cons.records.map((c) => ({ id: c.id, label: c.label ?? '', type: c.consentType ?? '', granted: !!c.granted && !c.revoked, recipient: names[first(c.recipient) ?? ''] ?? fam.find((f) => f.consent_id === c.id)?.recipient_email ?? '', family: fam.find((f) => f.consent_id === c.id)?.state ?? null, expiresOn: c.expiresOn ?? null, recordedAt: c.recordedAt ?? null })),
      history: history.rows.map((r) => { const actor = String(r.actor ?? '').replace(/[[\]"{}]/g, ''); return { id: String(r.id), action: String(r.action ?? ''), actor: actor === uid ? 'You' : names[actor] ?? 'Staff', authority: String(r.authority ?? ''), at: String(r.occurredAt ?? '') }; }),
    };
  },
});
