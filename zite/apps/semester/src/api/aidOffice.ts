import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { FA_MIGRATION } from '../lib/faMigration';
import { FA_OFFICE_MIGRATION } from '../lib/faOfficeMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...FA_MIGRATION, ...FA_OFFICE_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const TERM = z.string().min(2).max(20);
const KIND = z.enum(['tax_return', 'verification_worksheet', 'identity', 'dependency', 'other']);

// Financial aid office work (Financial Aid Officer app), extending the requirement checklists in api/financialAid.ts:
// document tracking by aid-system reference only, eligibility and academic progress, awards with two-officer approval against
// need and fund budgets, student acceptance, appeals decided by someone other than the original decider, and reconciliation.
// The aid system stays the system of record and nothing is disbursed here. Rules: lib/faOfficeMigration.ts.
export default createEndpoint({
  description: 'Financial aid office: document tracking by reference, eligibility and academic progress, award proposals and approvals, student acceptance, appeals and reconciliation',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('requestDoc'), email: z.string().email().max(200), term: TERM, kind: KIND, required: z.boolean() }),
    z.object({ action: z.literal('docStep'), docId: z.number().int(), step: z.enum(['received', 'accept', 'reject']), reference: z.string().max(120).default(''), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('eligibility'), studentId: z.string(), term: TERM, coa: z.number().int().min(0), sai: z.number().int().min(-150000), enrollment: z.enum(['full', 'three_quarter', 'half', 'less_than_half']), reference: z.string().min(3).max(120), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('sap'), studentId: z.string(), term: TERM, sap: z.enum(['good', 'warning', 'probation', 'ineligible']), note: z.string().min(5).max(1000) }),
    z.object({ action: z.literal('fund'), code: z.string().regex(/^[A-Za-z0-9-]{2,20}$/), name: z.string().min(2).max(120), needBased: z.boolean(), budget: z.number().int().min(0) }),
    z.object({ action: z.literal('propose'), studentId: z.string(), term: TERM, fund: z.string().min(2).max(20), amount: z.number().int().positive(), requestKey: z.string().min(8).max(80) }),
    z.object({ action: z.literal('awardStep'), awardId: z.number().int(), step: z.enum(['approve', 'offer', 'cancel', 'accept', 'decline']), reference: z.string().max(120).default(''), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('appeal'), term: TERM, kind: z.enum(['sap', 'award', 'cost_of_attendance']), reason: z.string().min(20).max(4000) }),
    z.object({ action: z.literal('decideAppeal'), appealId: z.number().int(), grant: z.boolean(), decision: z.string().min(10).max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const staff = !!((await sql.query(`SELECT fa_is_staff($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out || !(out.startsWith('ok:') || out.startsWith('replay:'))) forbid(out ?? 'Failed.'); return Number(out!.split(':')[1]); };
    const scope = await tenantScope(T);
    const inTenant = (uid: string) => { if (!scope.members.has(uid)) forbid('That student is not a member of your institution.'); return uid; };
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    let result: unknown = null;

    switch (input.action) {
      case 'requestDoc': {
        const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
        const uid = inTenant(rows[0] ? String((rows[0] as Row).id) : '');
        fail(await one(`SELECT fa_doc_request($1,$2,$3,$4,$5,$6) AS r`, [me, T, uid, input.term, input.kind, input.required]));
        await notify(uid, `The financial aid office needs a ${input.kind.replace('_', ' ')} for ${input.term}. Submit it in the aid portal, then record its reference in Financial aid.`);
        break;
      }
      case 'docStep': {
        fail(await one(`SELECT fa_doc_step($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.docId, input.step, input.reference, input.note]));
        if (input.step === 'reject') { const d = ((await sql.query(`SELECT student_id, kind FROM fa_docs WHERE id = $1`, [input.docId])) as Row[])[0]; if (d) await notify(String(d.student_id), `Your ${String(d.kind).replace('_', ' ')} needs attention: ${input.note}`); }
        break;
      }
      case 'eligibility': fail(await one(`SELECT fa_set_eligibility($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [me, T, inTenant(input.studentId), input.term, input.coa, input.sai, input.enrollment, input.reference, input.expectedVersion])); break;
      case 'sap': fail(await one(`SELECT fa_sap($1,$2,$3,$4,$5,$6) AS r`, [me, T, inTenant(input.studentId), input.term, input.sap, input.note])); await notify(input.studentId, `Your academic progress status for aid in ${input.term} is now ${input.sap}.`); break;
      case 'fund':
        if (!isAdmin) forbid('Only administrators set aid fund budgets.');
        fail(await one(`SELECT fa_set_fund($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.code, input.name, input.needBased, input.budget]));
        await audit(a, 'Aid fund budget set', `fa_fund:${input.code}`, String(input.budget), 'Administrator');
        break;
      case 'propose': result = { awardId: ok(await one(`SELECT fa_award_propose($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, inTenant(input.studentId), input.term, input.fund, input.amount, input.requestKey])) }; break;
      case 'awardStep': {
        fail(await one(`SELECT fa_award_step($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.awardId, input.step, input.reference, input.note]));
        if (input.step === 'offer') { const w = ((await sql.query(`SELECT student_id FROM fa_awards WHERE id = $1`, [input.awardId])) as Row[])[0]; if (w) await notify(String(w.student_id), 'You have a financial aid award to accept or decline.'); }
        break;
      }
      case 'appeal': result = { appealId: ok(await one(`SELECT fa_appeal($1,$2,$3,$4,$5) AS r`, [me, T, input.term, input.kind, input.reason])) }; break;
      case 'decideAppeal': {
        fail(await one(`SELECT fa_appeal_decide($1,$2,$3,$4,$5) AS r`, [me, T, input.appealId, input.grant, input.decision]));
        const ap = ((await sql.query(`SELECT student_id FROM fa_appeals WHERE id = $1`, [input.appealId])) as Row[])[0];
        if (ap) await notify(String(ap.student_id), `Your financial aid appeal was ${input.grant ? 'granted' : 'denied'}: ${input.decision}`);
        break;
      }
      default: break;
    }

    // Reads: a student sees only their own rows; aid staff see the office queue and reconciliation.
    const who = staff ? null : me;
    const docs = (await sql.query(`SELECT * FROM fa_docs WHERE tenant_id = $1 AND ($2::text IS NULL OR student_id = $2) ORDER BY term DESC, id LIMIT 1000`, [T, who])) as Row[];
    const elig = (await sql.query(`SELECT e.*, fa_need_left(e.tenant_id, e.student_id, e.term) AS need_left FROM fa_eligibility e WHERE tenant_id = $1 AND ($2::text IS NULL OR student_id = $2) ORDER BY term DESC LIMIT 1000`, [T, who])) as Row[];
    const awards = (await sql.query(`SELECT * FROM fa_awards WHERE tenant_id = $1 AND ($2::text IS NULL OR student_id = $2) AND ($3 OR state IN ('offered','accepted','declined')) ORDER BY created_at DESC LIMIT 1000`, [T, who, staff])) as Row[];
    const appeals = (await sql.query(`SELECT * FROM fa_appeals WHERE tenant_id = $1 AND ($2::text IS NULL OR student_id = $2) ORDER BY created_at DESC LIMIT 500`, [T, who])) as Row[];
    const funds = staff || isAdmin ? (await sql.query(`SELECT f.*, fa_fund_used(f.tenant_id, f.code) AS used FROM fa_funds f WHERE tenant_id = $1 ORDER BY code`, [T])) as Row[] : [];
    const exceptions = staff ? (await sql.query(`SELECT a.id, a.student_id, a.term, a.fund, a.amount FROM fa_awards a JOIN fa_eligibility e ON e.tenant_id = a.tenant_id AND e.student_id = a.student_id AND e.term = a.term
      WHERE a.tenant_id = $1 AND a.state IN ('approved','offered','accepted') AND e.sap = 'ineligible'`, [T])) as Row[] : [];
    const names = staff ? await userNames([...new Set([...docs, ...elig, ...awards, ...appeals, ...exceptions].map((r) => String(r.student_id)))]) : {};
    const nm = (v: unknown) => (staff ? names[String(v)] ?? 'Student' : 'You');
    return {
      result, staff, isAdmin,
      docs: docs.map((d) => ({ id: Number(d.id), student: nm(d.student_id), studentId: staff ? String(d.student_id) : null, mine: d.student_id === me, term: String(d.term), kind: String(d.kind), required: !!d.required, reference: String(d.aid_ref), state: String(d.state), note: String(d.note) })),
      eligibility: elig.map((e) => ({ student: nm(e.student_id), studentId: staff ? String(e.student_id) : null, term: String(e.term), coa: Number(e.coa), sai: Number(e.sai), enrollment: String(e.enrollment), sap: String(e.sap), sapNote: String(e.sap_note), reference: String(e.aid_ref), needLeft: Number(e.need_left), version: Number(e.version) })),
      awards: awards.map((w) => ({ id: Number(w.id), student: nm(w.student_id), mine: w.student_id === me, term: String(w.term), fund: String(w.fund), amount: Number(w.amount), state: String(w.state), proposedByMe: w.proposed_by === me, reference: String(w.aid_ref), note: String(w.note) })),
      appeals: appeals.map((p) => ({ id: Number(p.id), student: nm(p.student_id), mine: p.student_id === me, term: String(p.term), kind: String(p.kind), reason: String(p.reason), state: String(p.state), decision: String(p.decision), originalIsMe: p.original_by === me })),
      funds: funds.map((f) => ({ code: String(f.code), name: String(f.name), needBased: !!f.need_based, budget: Number(f.budget), used: Number(f.used) })),
      reconciliation: { overCommitted: funds.filter((f) => Number(f.used) > Number(f.budget)).map((f) => String(f.code)), ineligibleWithAwards: exceptions.map((x) => ({ id: Number(x.id), student: nm(x.student_id), term: String(x.term), fund: String(x.fund), amount: Number(x.amount) })) },
    };
  },
});
