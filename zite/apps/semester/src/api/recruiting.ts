import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { RCR_MIGRATION } from '../lib/rcrMigration';
import { seesConfidential } from '../lib/recruitRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of RCR_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Recruiting and appointments (S-76 E06). Hiring authorities approve requisitions and selections and name committees;
// appointment authorities approve offers as exact versions; committees see only their own search; recusal hides an applicant's
// references and evaluations from that member; applicants (any signed-in person) see only their own application and offer.
// Nothing is decided automatically. Accepting notifies HR officers to propose the appointment. Rules: lib/rcrMigration.ts.
export default createEndpoint({
  description: 'Recruiting: requisitions, committees, applications, recusal, confidential references, evaluations, selection approval, versioned offers and HR handoff',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), role: z.enum(['hiring', 'appointment']), on: z.boolean() }),
    z.object({ action: z.literal('requisition'), title: z.string().min(3).max(200), description: z.string().max(6000).default(''), justification: z.string().min(10).max(2000), positionCode: z.string().max(20).default('') }),
    z.object({ action: z.literal('reqStep'), reqId: z.number().int(), step: z.enum(['approve', 'reject', 'publish', 'close']), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('committee'), reqId: z.number().int(), email: z.string().email().max(200), chair: z.boolean(), on: z.boolean() }),
    z.object({ action: z.literal('apply'), reqId: z.number().int(), statement: z.string().min(20).max(6000) }),
    z.object({ action: z.literal('withdraw'), appId: z.number().int() }),
    z.object({ action: z.literal('conflict'), appId: z.number().int(), reason: z.string().min(5).max(500) }),
    z.object({ action: z.literal('reference'), appId: z.number().int(), referee: z.string().min(3).max(200), body: z.string().min(10).max(8000) }),
    z.object({ action: z.literal('evaluate'), appId: z.number().int(), score: z.number().int().min(1).max(5), notes: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('select'), reqId: z.number().int(), appId: z.number().int().nullable(), step: z.enum(['propose', 'approve', 'return']), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('offer'), reqId: z.number().int(), terms: z.string().min(20).max(8000) }),
    z.object({ action: z.literal('approveOffer'), offerId: z.number().int(), hash: z.string().regex(/^[0-9a-f]{64}$/) }),
    z.object({ action: z.literal('respond'), offerId: z.number().int(), hash: z.string().regex(/^[0-9a-f]{64}$/), accept: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    let a: Awaited<ReturnType<typeof requireAccess>> | null = null;
    try { a = await requireAccess(me); } catch { a = null; }
    const T = a?.institutionId ?? '';
    let isAdmin = false;
    if (a) { try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ } }
    const roles = T ? ((await sql.query(`SELECT role FROM rcr_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role)) : [];
    const hiring = roles.includes('hiring'), appointment = roles.includes('appointment');
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.'); return Number(out!.slice(3)); };
    const needT = () => { if (!a) forbid('You need an active institution workspace for this.'); return T; };
    const member = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(needT())).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid;
    };
    const notify = (to: string[], body: string) => to.length ? zite.messages.create({ record: { body, sender: me, recipients: to, isNotification: true } as never }).catch(() => undefined) : Promise.resolve();
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage hiring and appointment authorities.');
      const uid = await member(input.email);
      fail(await one(`SELECT rcr_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
      await audit(a!, `Recruiting authority ${input.on ? 'granted' : 'revoked'}`, `rcr_staff:${uid}`, input.role, 'Administrator');
    }
    if (input.action === 'requisition') {
      needT();
      result = { reqId: ok(await one(`SELECT rcr_requisition($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.title, input.description, input.justification, input.positionCode])) };
    }
    if (input.action === 'reqStep') fail(await one(`SELECT rcr_req_step($1,$2,$3,$4,$5,$6) AS r`, [me, needT(), input.reqId, input.step, input.note, input.expectedVersion]));
    if (input.action === 'committee') {
      const uid = await member(input.email);
      fail(await one(`SELECT rcr_committee_set($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.reqId, uid, input.chair, input.on]));
      if (input.on) await notify([uid], `You were added to a search committee${input.chair ? ' as chair' : ''}. Open Recruiting.`);
    }
    if (input.action === 'apply') result = { appId: ok(await one(`SELECT rcr_apply($1,$2,$3) AS r`, [me, input.reqId, input.statement])) };
    if (input.action === 'withdraw') fail(await one(`SELECT rcr_withdraw($1,$2) AS r`, [me, input.appId]));
    if (input.action === 'conflict') fail(await one(`SELECT rcr_conflict($1,$2,$3) AS r`, [me, input.appId, input.reason]));
    if (input.action === 'reference') fail(await one(`SELECT rcr_reference($1,$2,$3,$4,$5) AS r`, [me, needT(), input.appId, input.referee, input.body]));
    if (input.action === 'evaluate') fail(await one(`SELECT rcr_evaluate($1,$2,$3,$4) AS r`, [me, input.appId, input.score, input.notes]));
    if (input.action === 'select') fail(await one(`SELECT rcr_select($1,$2,$3,$4,$5,$6) AS r`, [me, needT(), input.reqId, input.appId, input.step, input.expectedVersion]));
    if (input.action === 'offer') result = { offerId: ok(await one(`SELECT rcr_offer_draft($1,$2,$3,$4) AS r`, [me, needT(), input.reqId, input.terms])) };
    if (input.action === 'approveOffer') {
      fail(await one(`SELECT rcr_offer_approve($1,$2,$3,$4) AS r`, [me, needT(), input.offerId, input.hash]));
      const o = ((await sql.query(`SELECT a.applicant_id FROM rcr_offers o JOIN rcr_applications a ON a.id = o.app_id WHERE o.id = $1`, [input.offerId])) as Row[])[0];
      if (o) await notify([String(o.applicant_id)], 'You have a job offer to review in Recruiting.');
    }
    if (input.action === 'respond') {
      fail(await one(`SELECT rcr_offer_respond($1,$2,$3,$4) AS r`, [me, input.offerId, input.hash, input.accept]));
      const r = ((await sql.query(`SELECT r.* FROM rcr_offers o JOIN rcr_requisitions r ON r.id = o.req_id WHERE o.id = $1`, [input.offerId])) as Row[])[0];
      const staffIds = ((await sql.query(`SELECT user_id FROM rcr_staff WHERE tenant_id = $1 AND revoked_at IS NULL UNION SELECT user_id FROM rcr_committee WHERE req_id = $2 AND chair`, [r.tenant_id, r.id])) as Row[]).map((x) => String(x.user_id));
      await notify(staffIds, `The selected candidate ${input.accept ? 'accepted' : 'declined'} the offer for ${r.title}.`);
      if (input.accept) {
        const hr = ((await sql.query(`SELECT user_id FROM hrm_staff WHERE tenant_id = $1 AND role = 'officer' AND revoked_at IS NULL`, [r.tenant_id]).catch(() => [])) as Row[]).map((x) => String(x.user_id));
        await notify(hr, `Hiring handoff: an offer for ${r.title}${r.position_code ? ` (position ${r.position_code})` : ''} was accepted. Propose the appointment in Work and HR.`);
      }
    }

    // Reads
    const reqs = (await sql.query(`SELECT r.*, EXISTS (SELECT 1 FROM rcr_committee c WHERE c.req_id = r.id AND c.user_id = $2 AND c.removed_at IS NULL) AS on_committee FROM rcr_requisitions r
      WHERE (r.tenant_id = $1 AND ($3 OR r.requested_by = $2 OR EXISTS (SELECT 1 FROM rcr_committee c WHERE c.req_id = r.id AND c.user_id = $2 AND c.removed_at IS NULL)))
         OR r.state = 'open' OR EXISTS (SELECT 1 FROM rcr_applications x WHERE x.req_id = r.id AND x.applicant_id = $2) ORDER BY r.created_at DESC LIMIT 200`, [T, me, hiring || appointment])) as Row[];
    const rids = reqs.map((r) => Number(r.id));
    const inside = (r: Row) => String(r.tenant_id) === T && (hiring || appointment || !!r.on_committee);
    const committee = rids.length ? (await sql.query(`SELECT * FROM rcr_committee WHERE req_id = ANY($1::bigint[]) AND removed_at IS NULL`, [rids])) as Row[] : [];
    const apps = rids.length ? (await sql.query(`SELECT * FROM rcr_applications WHERE req_id = ANY($1::bigint[]) ORDER BY created_at`, [rids])) as Row[] : [];
    const aids = apps.map((x) => Number(x.id));
    const conflicts = aids.length ? (await sql.query(`SELECT * FROM rcr_conflicts WHERE app_id = ANY($1::bigint[])`, [aids])) as Row[] : [];
    const refs = aids.length ? (await sql.query(`SELECT * FROM rcr_references WHERE app_id = ANY($1::bigint[]) ORDER BY added_at`, [aids])) as Row[] : [];
    const evals = aids.length ? (await sql.query(`SELECT * FROM rcr_evaluations WHERE app_id = ANY($1::bigint[])`, [aids])) as Row[] : [];
    const offers = rids.length ? (await sql.query(`SELECT * FROM rcr_offers WHERE req_id = ANY($1::bigint[]) ORDER BY rev`, [rids])) as Row[] : [];
    const team = isAdmin ? (await sql.query(`SELECT user_id, role FROM rcr_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...reqs.flatMap((r) => [r.requested_by, r.approved_by, r.selection_by, r.selection_approved_by]), ...committee.map((c) => c.user_id), ...apps.map((x) => x.applicant_id),
      ...evals.map((e) => e.member_id), ...offers.flatMap((o) => [o.drafted_by, o.approved_by]), ...team.map((t) => t.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const instName: Record<string, string> = {};
    for (const id of [...new Set(reqs.map((r) => String(r.tenant_id)))]) instName[id] = (await zite.institutions.findOne({ id }).catch(() => null))?.name ?? 'Institution';

    return {
      result, roles, isAdmin, hasInstitution: !!a, team: team.map((t) => ({ name: nm(t.user_id), role: String(t.role) })),
      searches: reqs.map((r) => {
        const inner = inside(r);
        const myApp = apps.find((x) => String(x.req_id) === String(r.id) && x.applicant_id === me && x.state !== 'withdrawn');
        return { id: Number(r.id), institution: instName[String(r.tenant_id)], title: String(r.title), description: String(r.description), state: String(r.state), version: Number(r.version), inside: inner,
          justification: inner ? String(r.justification) : null, positionCode: String(r.position_code), requestedBy: inner ? nm(r.requested_by) : null, requestedByMe: r.requested_by === me, approvedBy: inner ? nm(r.approved_by) : null,
          closeReason: String(r.close_reason), chairIsMe: committee.some((c) => String(c.req_id) === String(r.id) && c.user_id === me && c.chair), onCommittee: !!r.on_committee,
          selectionByMe: r.selection_by === me, selectedApp: r.selected_app ? Number(r.selected_app) : null,
          committee: inner ? committee.filter((c) => String(c.req_id) === String(r.id)).map((c) => ({ name: nm(c.user_id), chair: !!c.chair })) : [],
          myApplication: myApp ? { id: Number(myApp.id), state: String(myApp.state), statement: String(myApp.statement),
            offer: (() => { const o = offers.filter((x) => String(x.app_id) === String(myApp.id) && ['approved', 'accepted', 'declined'].includes(String(x.state))).pop(); return o ? { id: Number(o.id), terms: String(o.terms), sha256: String(o.sha256), state: String(o.state) } : null; })() } : null,
          applications: inner ? apps.filter((x) => String(x.req_id) === String(r.id)).map((x) => {
            const recused = conflicts.some((c) => String(c.app_id) === String(x.id) && c.member_id === me);
            const conf = seesConfidential({ authority: hiring || appointment, member: !!r.on_committee, recused, applicant: x.applicant_id === me });
            return { id: Number(x.id), applicant: nm(x.applicant_id), state: String(x.state), statement: String(x.statement), recused, recusals: conflicts.filter((c) => String(c.app_id) === String(x.id)).length,
              myEvaluation: (() => { const e = evals.find((y) => String(y.app_id) === String(x.id) && y.member_id === me); return e ? { score: Number(e.score), notes: String(e.notes) } : null; })(),
              references: conf ? refs.filter((f) => String(f.app_id) === String(x.id)).map((f) => ({ referee: String(f.referee), body: String(f.body), at: iso(f.added_at) })) : [],
              evaluations: conf ? evals.filter((y) => String(y.app_id) === String(x.id)).map((y) => ({ member: nm(y.member_id), score: Number(y.score), notes: String(y.notes) })) : [] };
          }) : [],
          offers: inner ? offers.filter((o) => String(o.req_id) === String(r.id)).map((o) => ({ id: Number(o.id), rev: Number(o.rev), terms: String(o.terms), sha256: String(o.sha256), state: String(o.state),
            draftedBy: nm(o.drafted_by), draftedByMe: o.drafted_by === me, approvedBy: nm(o.approved_by) })) : [] };
      }),
    };
  },
});
