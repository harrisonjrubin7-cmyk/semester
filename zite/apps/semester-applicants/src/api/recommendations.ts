import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../../../semester/src/lib/pg';
import { RCM_MIGRATION } from '../../../semester/src/lib/rcmMigration';
import { putScanned, ensureFil } from '../../../semester/src/lib/filServer';
import { checkUpload, decodeBase64 } from '../../../semester/src/lib/fileRules';

type Row = Record<string, unknown>;
const ids = (v: string | string[] | undefined | null): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);
const first = (v: string | string[] | undefined | null) => ids(v)[0];
const no = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of RCM_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const ok = (r: unknown) => { const s = String(r ?? ''); if (!s.startsWith('ok')) no(s || 'Refused.'); return s; };

export default createEndpoint({
  description: 'Recommendations: applicants ask named recommenders; the recommender accepts and submits a private letter; applicants see status only',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine'), applicationId: z.string() }),
    z.object({ action: z.literal('request'), applicationId: z.string(), email: z.string().email().max(200), name: z.string().max(120), waived: z.boolean() }),
    z.object({ action: z.literal('withdraw'), id: z.number().int() }),
    z.object({ action: z.literal('inbox') }),
    z.object({ action: z.literal('respond'), id: z.number().int(), accept: z.boolean() }),
    z.object({ action: z.literal('submitLetter'), id: z.number().int(), name: z.string().max(200), mime: z.string().max(120), base64: z.string().max(5_600_000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    await ensure();
    const me = ((await zite.sql({ query: `SELECT "email","name" FROM "ziteUsers" WHERE "id" = $1`, params: [uid] })).rows[0] ?? {}) as { email?: string; name?: string };
    const myEmail = String(me.email ?? '').toLowerCase();
    const ownApp = async (id: string) => { const r = await zite.applications.findOne({ id }); if (!r || first(r.applicant) !== uid) no('That application isn’t yours.'); return r!; };

    if (input.action === 'request') {
      const r = await ownApp(input.applicationId);
      if (['Withdrawn', 'Admitted', 'Declined'].includes(r.status ?? '')) no('This application is closed.');
      const out = ok(((await pg().query(`SELECT rcm_request($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [uid, first(r.applicant), r.id, first(r.institution) ?? '', input.email, input.name, input.waived, myEmail])) as Row[])[0].r);
      // In-app only: Semester sends no outside email. If the recommender has no account yet, the applicant tells them to sign in.
      const target = (await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = $1 LIMIT 1`, params: [input.email.toLowerCase()] })).rows[0] as { id?: string } | undefined;
      if (target?.id) await zite.messages.create({ record: { body: `${me.name || 'An applicant'} asked you for a recommendation. Open Semester Applicants → Recommendations to write.`, sender: uid, recipients: [target.id], isNotification: true, read: false } as never });
      return { ok: true, id: Number(out.split(':')[1]), notified: !!target?.id };
    }
    if (input.action === 'withdraw') { ok(((await pg().query(`SELECT rcm_withdraw($1,$2) AS r`, [uid, input.id])) as Row[])[0].r); return { ok: true }; }
    if (input.action === 'mine') {
      await ownApp(input.applicationId);
      // Status only: never the letter, never the file.
      const rows = (await pg().query(`SELECT id, recommender_name, recommender_email, state, waived, requested_at, submitted_at FROM rcm_requests WHERE application_id = $1 AND applicant_id = $2 ORDER BY requested_at`, [input.applicationId, uid])) as Row[];
      return { requests: rows.map((x) => ({ id: Number(x.id), name: String(x.recommender_name), email: String(x.recommender_email), state: String(x.state), waived: !!x.waived,
        requestedAt: new Date(String(x.requested_at)).toISOString(), submittedAt: x.submitted_at ? new Date(String(x.submitted_at)).toISOString() : null })) };
    }
    if (input.action === 'inbox') {
      const rows = (await pg().query(`SELECT id, application_id, applicant_id, state, waived, requested_at FROM rcm_requests WHERE recommender_email = $1 AND state IN ('Requested','Accepted','Submitted') ORDER BY requested_at DESC`, [myEmail])) as Row[];
      const apps = await Promise.all(rows.map((x) => zite.applications.findOne({ id: String(x.application_id) })));
      const insts = rows.length ? (await zite.institutions.findAll({ limit: 500, fields: ['name'] })).records : [];
      const people = rows.length ? (await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [[...new Set(rows.map((x) => String(x.applicant_id)))]] })).rows as Row[] : [];
      return { requests: rows.map((x, i) => ({ id: Number(x.id), state: String(x.state), waived: !!x.waived, requestedAt: new Date(String(x.requested_at)).toISOString(),
        applicant: String(people.find((p) => p.id === x.applicant_id)?.name || 'Applicant'), program: apps[i]?.program ?? '', institution: insts.find((n) => n.id === first(apps[i]?.institution))?.name ?? 'Institution' })) };
    }
    if (input.action === 'respond') { ok(((await pg().query(`SELECT rcm_respond($1,$2,$3,$4) AS r`, [uid, myEmail, input.id, input.accept])) as Row[])[0].r); return { ok: true }; }
    // submitLetter
    const req = ((await pg().query(`SELECT tenant_id, recommender_id, state FROM rcm_requests WHERE id = $1`, [input.id])) as Row[])[0];
    if (!req || req.recommender_id !== uid) no('Request not found.');
    if (req!.state !== 'Accepted') no(req!.state === 'Submitted' ? 'This letter was already submitted.' : 'Accept the request before submitting a letter.');
    const bytes = decodeBase64(input.base64);
    if (!bytes) no('The file could not be read. Try again.');
    const bad = checkUpload(input.name, input.mime, bytes!.length);
    if (bad) no(bad);
    await ensureFil();
    const put = await putScanned(String(req!.tenant_id), uid, input.name, input.mime, 'evidence', bytes!);
    if ('blocked' in put) no(`This file was not accepted: ${put.blocked.join(' ')}`);
    ok(((await pg().query(`SELECT rcm_submit($1,$2,$3,$4) AS r`, [uid, input.id, (put as { id: string }).id, uid])) as Row[])[0].r);
    return { ok: true };
  },
});
