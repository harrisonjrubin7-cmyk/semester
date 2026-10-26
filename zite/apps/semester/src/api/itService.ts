import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { ITS_MIGRATION } from '../lib/itsMigration';
import { ticketSteps, changeOutcome, overdue, nextChange, changeDone, Kind, TicketState, ChangeState, ChangeStep } from '../lib/itsmRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of ITS_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const NOTE = 'There is an update to your IT request in Semester. Open IT help to see it.';
const CSTEPS: ChangeStep[] = ['edit', 'approve', 'reject', 'implement', 'verify', 'roll_back', 'review'];

// IT Service Management (S-76 E15). Anyone in the institution opens requests and incidents and sees only their own.
// IT agents see the queue except security incidents; security staff see security incidents. Agents raise changes; the
// service owner (set by an administrator) approves the exact plan. Every rule is enforced in lib/itsMigration.ts.
export default createEndpoint({
  description: 'IT help: service catalog, requests, incidents, restricted security incidents and owner-approved changes',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), agent: z.boolean(), security: z.boolean() }),
    z.object({ action: z.literal('service'), id: z.number().int().nullable(), name: z.string().min(2).max(80), description: z.string().max(1000).default(''), ownerEmail: z.string().email().max(200), active: z.boolean() }),
    z.object({ action: z.literal('open'), requestKey: z.string().min(8).max(100), serviceId: z.number().int().nullable(), kind: z.enum(['request', 'incident', 'security_incident']), title: z.string().min(5).max(140), description: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('tstep'), id: z.number().int(), step: z.enum(['assign', 'fulfill', 'review', 'confirm', 'reopen', 'close', 'cancel', 'link']), expectedVersion: z.number().int(), note: z.string().max(4000).default(''), assigneeEmail: z.string().max(200).default(''), changeId: z.number().int().nullable().default(null) }),
    z.object({ action: z.literal('raise'), requestKey: z.string().min(8).max(100), serviceId: z.number().int(), title: z.string().min(5).max(140), plan: z.string().min(20).max(6000), rollback: z.string().min(10).max(3000), risk: z.enum(['low', 'medium', 'high']), emergency: z.boolean() }),
    z.object({ action: z.literal('cstep'), id: z.number().int(), step: z.enum(CSTEPS as [ChangeStep, ...ChangeStep[]]), expectedVersion: z.number().int(), note: z.string().max(3000).default(''), plan: z.string().max(6000).default(''), rollback: z.string().max(3000).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const userByEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid!;
    };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage IT access.');
      const uid = await userByEmail(input.email);
      fail(((await sql.query(`SELECT its_set_staff($1,$2,$3,$4,$5) AS e`, [me, T, uid, input.agent, input.security])) as { e: string | null }[])[0].e);
      await audit(a, 'IT access changed', `user:${uid}`, `${input.agent ? 'agent ' : ''}${input.security ? 'security' : ''}`.trim() || 'revoked', 'Administrator');
    }
    if (input.action === 'service') {
      const owner = await userByEmail(input.ownerEmail);
      const out = ((await sql.query(`SELECT its_service($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, me, isAdmin, input.id, input.name, input.description, owner, input.active])) as { r: string }[])[0].r;
      if (!out.startsWith('ok:')) forbid(out);
      await audit(a, 'IT service saved', `itService:${out.slice(3)}`, input.name, 'Administrator');
    }
    if (input.action === 'open') {
      const out = ((await sql.query(`SELECT its_open($1,$2,$3,$4,$5,$6,$7) AS r`, [T, input.requestKey, me, input.serviceId, input.kind, input.title, input.description])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, `IT ${input.kind.replace('_', ' ')} opened`, `itTicket:${id}`, input.kind === 'security_incident' ? 'restricted' : input.title, 'Requester');
    }
    if (input.action === 'tstep') {
      const before = ((await sql.query(`SELECT requester_id, kind FROM its_tickets WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Ticket not found.');
      const assignee = input.step === 'assign' && input.assigneeEmail.trim() ? await userByEmail(input.assigneeEmail) : null;
      fail(((await sql.query(`SELECT its_tstep($1,$2,$3,$4,$5,$6,$7,$8) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note, assignee, input.changeId])) as { e: string | null }[])[0].e);
      const self = String(before!.requester_id) === me;
      await audit(a, `IT ticket: ${input.step}`, `itTicket:${input.id}`, before!.kind === 'security_incident' ? 'restricted' : input.note.slice(0, 200), self ? 'Requester' : 'IT');
      if (!self) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(before!.requester_id)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'raise') {
      const out = ((await sql.query(`SELECT its_change_open($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, input.requestKey, me, input.serviceId, input.title, input.plan, input.rollback, input.risk, input.emergency])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, input.emergency ? 'Emergency change raised' : 'Change raised', `itChange:${id}`, input.title, 'IT');
    }
    if (input.action === 'cstep') {
      fail(((await sql.query(`SELECT its_cstep($1,$2,$3,$4,$5,$6,$7,$8) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note, input.plan, input.rollback])) as { e: string | null }[])[0].e);
      await audit(a, `Change: ${input.step.replace('_', ' ')}`, `itChange:${input.id}`, input.note.slice(0, 200), 'IT');
    }

    // Read model, scoped by who is asking.
    const mine = ((await sql.query(`SELECT agent, security FROM its_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[])[0];
    const agent = !!mine?.agent, security = !!mine?.security;
    const services = (await sql.query(`SELECT * FROM its_services WHERE tenant_id = $1 AND (active OR $2) ORDER BY name`, [T, isAdmin])) as Row[];
    const owned = new Set(services.filter((s) => s.owner_id === me).map((s) => String(s.id)));
    const tickets = (await sql.query(`SELECT * FROM its_tickets WHERE tenant_id = $1 AND (requester_id = $2
        OR (kind = 'security_incident' AND $4) OR (kind <> 'security_incident' AND ($3 OR $4)))
      ORDER BY (state IN ('closed','cancelled')), created_at DESC LIMIT 500`, [T, me, agent, security])) as Row[];
    const changes = agent || owned.size ? (await sql.query(`SELECT * FROM its_changes WHERE tenant_id = $1 AND ($2 OR service_id = ANY($3::bigint[]))
      ORDER BY updated_at DESC LIMIT 300`, [T, agent, [...owned].map(Number)])) as Row[] : [];
    const changeById = Object.fromEntries(changes.map((c) => [String(c.id), c]));
    const linkedIds = tickets.map((t) => t.change_id).filter((x) => x && !changeById[String(x)]).map(Number);
    const linked = linkedIds.length ? (await sql.query(`SELECT id, state FROM its_changes WHERE tenant_id = $1 AND id = ANY($2::bigint[])`, [T, linkedIds])) as Row[] : [];
    const changeState = Object.fromEntries([...changes, ...linked].map((c) => [String(c.id), String(c.state)]));
    const staff = isAdmin || agent || security ? (await sql.query(`SELECT user_id, agent, security FROM its_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...tickets.flatMap((t) => [String(t.requester_id), t.assignee_id ? String(t.assignee_id) : '']), ...changes.flatMap((c) => [String(c.raiser_id), c.approved_by ? String(c.approved_by) : '']), ...services.map((s) => String(s.owner_id)), ...staff.map((s) => String(s.user_id))].filter(Boolean))]);
    const svcName = Object.fromEntries(services.map((s) => [String(s.id), String(s.name)]));
    const now = new Date();

    return {
      result, isAdmin, agent, security, ownsServices: owned.size > 0,
      services: services.map((s) => ({ id: Number(s.id), name: String(s.name), description: String(s.description), owner: names[String(s.owner_id)] ?? 'Member', mine: s.owner_id === me, active: !!s.active })),
      tickets: tickets.map((t) => {
        const isReq = t.requester_id === me;
        const kind = String(t.kind) as Kind, state = String(t.state) as TicketState;
        return {
          id: Number(t.id), mine: isReq, kind, state, version: Number(t.version), title: String(t.title), description: String(t.description),
          service: t.service_id ? svcName[String(t.service_id)] ?? 'Service' : null, requester: names[String(t.requester_id)] ?? 'Member',
          assignee: t.assignee_id ? names[String(t.assignee_id)] ?? 'IT' : null, resolution: String(t.resolution), review: String(t.review), confirmed: !!t.confirmed,
          changeId: t.change_id ? Number(t.change_id) : null, changeOutcome: t.change_id && changeState[String(t.change_id)] ? changeOutcome(changeState[String(t.change_id)] as ChangeState) : null,
          overdue: overdue(kind, state, new Date(String(t.created_at)), now), createdAt: iso(t.created_at), updatedAt: iso(t.updated_at),
          steps: isReq ? ticketSteps(state, 'requester', kind, String(t.review).length >= 20) : [...ticketSteps(state, 'agent', kind), ...(state !== 'closed' && state !== 'cancelled' ? ['link'] : [])],
        };
      }),
      changes: changes.map((c) => {
        const who = { owner: owned.has(String(c.service_id)), raiser: c.raiser_id === me };
        const st = { state: String(c.state) as ChangeState, emergency: !!c.emergency, approved: !!c.approved_hash && c.approved_hash === c.plan_hash };
        return {
          id: Number(c.id), title: String(c.title), service: svcName[String(c.service_id)] ?? 'Service', raiser: names[String(c.raiser_id)] ?? 'IT', mine: who.raiser,
          plan: String(c.plan), rollback: String(c.rollback_plan), risk: String(c.risk), emergency: st.emergency, state: st.state, version: Number(c.version),
          approvedBy: c.approved_by ? names[String(c.approved_by)] ?? 'Owner' : null, approved: st.approved, outcomeNote: String(c.outcome_note), reviewNote: String(c.review_note),
          outcome: changeOutcome(st.state), done: changeDone(st), planHash: String(c.plan_hash).slice(0, 12), updatedAt: iso(c.updated_at),
          steps: CSTEPS.filter((s) => nextChange(st, s, who)),
        };
      }),
      staff: staff.map((s) => ({ name: names[String(s.user_id)] ?? 'Member', agent: !!s.agent, security: !!s.security })),
    };
  },
});
