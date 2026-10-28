import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/hiring';
import { ensureHiringSchema, importOwn, dispatch } from '../lib/hiringServer';
import { ensureCrr } from '../../../semester/src/lib/crrServer';

const KIND = z.enum(['Internship', 'Job', 'Research', 'Mentorship']);
const deny = (m: string): never => { const e = new ZiteError(m); (e as unknown as { userFacingMessage: string }).userFacingMessage = m; throw e; };

export default createEndpoint({
  description: 'Employer portal: post and manage opportunities and decide on applicants, enforced in the hiring database',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('partners') }),
    z.object({ action: z.literal('requestPartner'), institutionId: z.string(), organization: z.string().min(2).max(120) }),
    z.object({ action: z.literal('save'), id: z.string().optional(), version: z.number().int().optional(), title: z.string().min(3), kind: KIND, employerName: z.string().min(2), description: z.string().max(5000).optional(), location: z.string().max(200).optional(), closesOn: z.string().nullable().optional() }),
    z.object({ action: z.literal('decide'), id: z.string(), applicant: z.string(), version: z.number().int(), decision: z.enum(['Shortlisted', 'Declined', 'Reset']) }),
    z.object({ action: z.literal('delete'), id: z.string(), version: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    await ensureHiringSchema();
    const sql = pg();
    const one = async (q: string, p: unknown[]) => { const r = (await sql.query(q, p)) as { e: string | null }[]; if (r[0].e) deny(r[0].e); };
    await ensureCrr();

    // Partnerships: an employer asks each institution separately; only that institution's staff can approve it.
    if (input.action === 'partners' || input.action === 'requestPartner') {
      const insts = (await zite.institutions.findAll({ limit: 500, fields: ['name'] })).records;
      if (input.action === 'requestPartner') {
        if (!insts.some((i) => i.id === input.institutionId)) deny('Institution not found.');
        const r = String(((await sql.query(`SELECT crr_request($1,$2,$3) AS r`, [uid, input.institutionId, input.organization])) as { r: string }[])[0].r);
        if (!r.startsWith('ok')) deny(r);
        return { ok: true };
      }
      const mine = (await sql.query(`SELECT tenant_id, status, note FROM crr_partners WHERE employer_id = $1`, [uid])) as { tenant_id: string; status: string; note: string }[];
      return { institutions: insts.map((i) => { const m = mine.find((x) => x.tenant_id === i.id); return { id: i.id, name: i.name ?? 'Institution', status: m?.status ?? 'Not requested', note: m?.status === 'Declined' ? m.note : '' }; }) };
    }

    if (input.action === 'save') {
      const id = input.id ?? `opp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await one(`SELECT emp_save($1,$2,$3,$4,$5,$6,$7,$8,$9) AS e`, [uid, id, input.title, input.kind, input.employerName, input.description ?? '', input.location ?? '', input.closesOn || null, input.version ?? 0]);
    } else if (input.action === 'decide') {
      await one(`SELECT emp_decide($1,$2,$3,$4,$5) AS e`, [uid, input.id, input.applicant, input.decision, input.version]);
    } else if (input.action === 'delete') {
      await one(`SELECT emp_delete($1,$2,$3) AS e`, [uid, input.id, input.version]);
    } else {
      await importOwn(uid);
    }
    await dispatch();
    if (input.action !== 'list') return { ok: true };

    const posts = (await sql.query(`SELECT * FROM emp_postings WHERE owner_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 200`, [uid])) as Record<string, unknown>[];
    const apps = posts.length ? (await sql.query(`SELECT posting_id, applicant_id, stage, version FROM emp_applications WHERE posting_id = ANY($1) ORDER BY applied_at`, [posts.map((p) => p.id)])) as Record<string, unknown>[] : [];
    const applicantIds = [...new Set(apps.map((a) => String(a.applicant_id)))];
    // Each applicant's share: the items they ticked and whether they shared their email. Nothing else is shown.
    const zids = posts.map((p) => String(p.zite_id ?? p.id));
    const shares = zids.length ? (await sql.query(`SELECT posting_ref, applicant_id, item_ids, share_contact FROM crr_shares WHERE employer_id = $1 AND posting_ref = ANY($2)`, [uid, zids])) as { posting_ref: string; applicant_id: string; item_ids: string[]; share_contact: boolean }[] : [];
    const sharedIds = [...new Set(shares.flatMap((x) => x.item_ids))];
    // Instructor verifications travel only with items the student shared.
    const hasVfy = ((await sql.query(`SELECT to_regclass('vfy_claims') IS NOT NULL AS ok`)) as { ok: boolean }[])[0].ok;
    const claims = hasVfy && sharedIds.length ? (await sql.query(`SELECT item_id, student_id, statement, instructor_id FROM vfy_claims WHERE state = 'Verified' AND item_id = ANY($1)`, [sharedIds])) as { item_id: string; student_id: string; statement: string; instructor_id: string }[] : [];
    const verifiers = claims.length ? (await zite.sql({ query: `SELECT "id","name" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [[...new Set(claims.map((c) => c.instructor_id))]] })).rows : [];
    const [users, portfolio] = await Promise.all([
      applicantIds.length ? zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [applicantIds] }) : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      sharedIds.length ? zite.resources.findAll({ filters: { kind: 'Portfolio Item' }, limit: 1000 }).then((r) => ({ records: r.records.filter((x) => sharedIds.includes(x.id)) })) : Promise.resolve({ records: [] as { id: string; owner?: string | string[]; title?: string; body?: string; files?: { url: string }[]; source?: string }[] }),
    ]);
    const owns = (v: string | string[] | undefined, id: string) => (Array.isArray(v) ? v : v ? [v] : []).includes(id);
    const person = (id: string, postingRef: string) => {
      const u = users.rows.find((r) => r.id === id);
      const sh = shares.find((x) => x.applicant_id === id && x.posting_ref === postingRef);
      return {
        id, name: String(u?.name || 'Applicant'), email: sh?.share_contact ? String(u?.email || '') : '',
        portfolio: portfolio.records.filter((p) => owns(p.owner, id) && !!sh?.item_ids.includes(p.id)).map((p) => ({ id: p.id, title: p.title ?? '', body: (p.body ?? '').slice(0, 400), file: p.files?.[0]?.url ?? null, source: p.source ?? 'Yours',
          verified: claims.filter((c) => c.item_id === p.id && c.student_id === id).map((c) => ({ statement: c.statement, by: String(verifiers.find((v) => v.id === c.instructor_id)?.name ?? 'Instructor') })) })),
      };
    };
    return {
      opportunities: posts.map((o) => ({
        id: String(o.id), version: Number(o.version), title: String(o.title), kind: String(o.kind), employerName: String(o.employer_name), description: String(o.description), location: String(o.location),
        closesOn: o.closes_on ? new Date(String(o.closes_on)).toISOString().slice(0, 10) : null,
        applicants: apps.filter((a) => a.posting_id === o.id).map((a) => ({ ...person(String(a.applicant_id), String(o.zite_id ?? o.id)), stage: String(a.stage), version: Number(a.version) })),
      })),
    };
  },
});
