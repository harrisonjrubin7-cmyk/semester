import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, first, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ADM_MIGRATION, ADM_DECISIONS } from '../lib/admMigration';
import { APK_MIGRATION } from '../lib/apkMigration';
import { RCM_MIGRATION } from '../lib/rcmMigration';
import { ensureFil } from '../lib/filServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...ADM_MIGRATION, ...APK_MIGRATION, ...RCM_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const call = async (q: string, p: unknown[]) => { const r = String(((await pg().query(q, p)) as Row[])[0].r); if (!r.startsWith('ok')) forbid(r); return r; };

export default createEndpoint({
  description: 'Admissions: an administrator assigns each application to a reviewer; the reviewer drafts a decision; nothing reaches the applicant until it is released',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('assign'), id: z.string(), reviewerId: z.string() }),
    z.object({ action: z.literal('draft'), id: z.string(), decision: z.enum(ADM_DECISIONS), internalNote: z.string().max(4000), message: z.string().max(2000), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('release'), id: z.string(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('openDocument'), id: z.string(), fileId: z.string().uuid() }),
    z.object({ action: z.literal('openLetter'), id: z.string(), requestId: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'admission.decide');
    const isAdmin = a.roles.includes('Administrator');
    const T = a.institutionId;
    await ensure();
    const app = async (id: string) => {
      const r = await zite.applications.findOne({ id });
      if (!r || first(r.institution) !== T) forbid('That application isn’t for your institution.');
      if (['Draft', 'Withdrawn'].includes(r!.status ?? '')) forbid('Only submitted applications can be reviewed.');
      return r!;
    };
    const review = async (id: string) => ((await pg().query(`SELECT * FROM adm_reviews WHERE application_id = $1 AND tenant_id = $2`, [id, T])) as Row[])[0];

    if (input.action === 'openLetter') {
      const r = await app(input.id);
      const rv = await review(r.id);
      if (!isAdmin && rv?.reviewer_id !== a.userId) forbid('Only the assigned reviewer or an administrator can open this letter.');
      const q = ((await pg().query(`SELECT letter_file, recommender_id FROM rcm_requests WHERE id = $1 AND application_id = $2 AND tenant_id = $3 AND state = 'Submitted'`, [input.requestId, r.id, T])) as Row[])[0];
      if (!q) forbid('That letter isn’t on this application.');
      await ensureFil();
      const f = ((await pg().query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM fil_read($1,$2,$3)`, [T, String(q.letter_file), String(q.recommender_id)])) as Row[])[0];
      if (!f) forbid('This letter is not available.');
      await audit(a, 'Recommendation letter opened', `application:${r.id}`, `request ${input.requestId}`, a.roles.join(', '));
      return { name: String(f.name), mime: String(f.mime), base64: String(f.b64).replace(/\n/g, '') };
    }
    if (input.action === 'openDocument') {
      // Same visibility as the queue: an administrator, or the reviewer assigned to this submitted application.
      const r = await app(input.id);
      const rv = await review(r.id);
      if (!isAdmin && rv?.reviewer_id !== a.userId) forbid('Only the assigned reviewer or an administrator can open this document.');
      const d = ((await pg().query(`SELECT owner_id FROM apk_documents WHERE application_id = $1 AND file_id = $2 AND tenant_id = $3`, [r.id, input.fileId, T])) as Row[])[0];
      if (!d) forbid('That document isn’t on this application.');
      await ensureFil();
      // The file store authorises its owner; the check above is what lets staff read it, and the read is logged.
      const f = ((await pg().query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM fil_read($1,$2,$3)`, [T, input.fileId, String(d.owner_id)])) as Row[])[0];
      if (!f) forbid('This file is not available.');
      await audit(a, 'Application document opened', `application:${r.id}`, String(f.name), a.roles.join(', '));
      return { name: String(f.name), mime: String(f.mime), base64: String(f.b64).replace(/\n/g, '') };
    }
    if (input.action === 'assign') {
      const r = await app(input.id);
      const reviewer = (await zite.memberships.findAll({ filters: { member: input.reviewerId }, limit: 20 })).records
        .find((m) => first(m.institution) === T && m.status === 'Active' && (m.roles ?? []).some((x) => x === 'Staff' || x === 'Administrator'));
      if (!reviewer) forbid('The reviewer must be active staff at your institution.');
      await call(`SELECT adm_assign($1,$2,$3,$4,$5,$6) AS r`, [a.userId, T, isAdmin, r.id, first(r.applicant), input.reviewerId]);
      await zite.applications.update({ id: r.id, record: { status: 'Under Review' } as never });
      await audit(a, 'Admissions reviewer assigned', r.id, '', a.roles.join(', '));
      return { ok: true };
    }
    if (input.action === 'draft') {
      const r = await app(input.id);
      const out = await call(`SELECT adm_draft($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [a.userId, T, isAdmin, r.id, input.decision, input.internalNote, input.message, input.expectedVersion]);
      await audit(a, `Admissions decision drafted: ${input.decision}`, r.id, '', a.roles.join(', '));
      return { ok: true, version: Number(out.split(':')[1]) };
    }
    if (input.action === 'release') {
      const r = await app(input.id);
      const before = await review(r.id);
      const res = String(((await pg().query(`SELECT adm_release($1,$2,$3,$4,$5) AS r`, [a.userId, T, isAdmin, r.id, input.expectedVersion])) as Row[])[0].r);
      // A release that committed but did not finish updating the applicant's record is completed by retrying.
      const resume = res === 'The decision is already released.' && before?.state === 'Released' && r.status !== before.decision;
      if (!res.startsWith('ok') && !resume) forbid(res);
      const rv = await review(r.id);
      const decision = String(rv.decision);
      await zite.applications.update({ id: r.id, record: { status: decision, decisionNote: String(rv.applicant_message), decidedBy: String(rv.drafted_by) } as never });
      const applicant = first(r.applicant)!;
      if (decision === 'Admitted') {
        const { records: mine } = await zite.memberships.findAll({ filters: { member: applicant }, limit: 50 });
        const here = mine.find((m) => first(m.institution) === T);
        if (here) await zite.memberships.update({ id: here.id, record: { roles: Array.from(new Set([...((here.roles as string[] | undefined) ?? []), 'Student'])), status: 'Active' } as never });
        else await zite.memberships.create({ record: { label: `Admitted · ${r.program ?? 'Student'}`, member: applicant, institution: T, roles: ['Student'], status: 'Active' } as never });
        await audit(a, 'Student membership created from admission', r.id, r.program ?? '', 'Staff');
      }
      await zite.messages.create({ record: { body: `Your application to ${a.institutionName} has a decision. Open Semester Applicants to read it.`, sender: a.userId, recipients: [applicant], isNotification: true, read: false } as never });
      await audit(a, `Admissions decision released: ${decision}`, r.id, '', a.roles.join(', '));
      return { ok: true, decision, membershipCreated: decision === 'Admitted' };
    }

    // Administrators see every submitted application; a reviewer sees only the ones assigned to them.
    const { records } = await zite.applications.findAll({ filters: { institution: T }, limit: 500 });
    const reviews = (await pg().query(`SELECT * FROM adm_reviews WHERE tenant_id = $1`, [T])) as Row[];
    const rv = (id: string) => reviews.find((x) => x.application_id === id);
    const pdocs = (await pg().query(`SELECT application_id, file_id, filename FROM apk_documents WHERE tenant_id = $1`, [T])) as Row[];
    const recs = (await pg().query(`SELECT id, application_id, recommender_name, state, waived FROM rcm_requests WHERE tenant_id = $1 AND state IN ('Requested','Accepted','Submitted')`, [T])) as Row[];
    const live = records.filter((r) => !['Draft'].includes(r.status ?? '')).filter((r) => isAdmin || rv(r.id)?.reviewer_id === a.userId);
    const staff = isAdmin ? (await zite.memberships.findAll({ filters: { institution: T }, limit: 500 })).records
      .filter((m) => m.status === 'Active' && (m.roles ?? []).some((x) => x === 'Staff' || x === 'Administrator')).map((m) => first(m.member)!).filter(Boolean) : [];
    const names = await userNames([...live.map((r) => first(r.applicant) ?? ''), ...reviews.map((x) => String(x.reviewer_id)), ...staff]);
    return {
      isAdmin,
      reviewers: staff.map((id) => ({ id, name: names[id] ?? 'Staff' })),
      items: live.map((r) => {
        const x = rv(r.id);
        return {
          id: r.id, applicant: names[first(r.applicant) ?? ''] ?? 'Applicant', applicantId: first(r.applicant) ?? '', program: r.program ?? '', entryTerm: r.entryTerm ?? '', status: r.status ?? '',
          statement: r.statement ?? '', documents: pdocs.filter((d) => d.application_id === r.id).map((d) => ({ fileId: String(d.file_id), filename: String(d.filename) })), recommendations: recs.filter((x) => x.application_id === r.id).map((x) => ({ id: Number(x.id), name: String(x.recommender_name), state: String(x.state), waived: !!x.waived })), submittedAt: r.submittedAt ?? null,
          review: x ? { reviewer: names[String(x.reviewer_id)] ?? 'Staff', mine: x.reviewer_id === a.userId, state: String(x.state), version: Number(x.version),
            decision: x.decision ? String(x.decision) : null, internalNote: String(x.internal_note ?? ''), message: String(x.applicant_message ?? '') } : null,
        };
      }).sort((x, y) => (y.submittedAt ?? '').localeCompare(x.submittedAt ?? '')),
    };
  },
});
