import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, first } from '../lib/server';
import { pg } from '../lib/pg';
import { bumpEpoch } from '../lib/platform';
import { HRM_MIGRATION } from '../lib/hrmMigration';
import { rolesAfterProvision, rolesAfterOffboard, reconcile } from '../lib/hrRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of HRM_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Human resources (S-76 E05). HR officers and approvers (granted by an administrator) own employment facts; an administrator
// executes the resulting access change on the person's membership; pay is out of scope. Ending employment removes only the
// role that job granted — a student stays a student (lib/hrRules.ts rolesAfterOffboard). Reconciliation lists drift between
// HR facts and memberships. Personnel documents are references shown to HR staff and the employee only; views are logged.
export default createEndpoint({
  description: 'Human resources: positions, appointments with two-person approval, access provisioning and removal, onboarding and offboarding checklists, leave, personnel document references',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), role: z.enum(['officer', 'approver']), on: z.boolean() }),
    z.object({ action: z.literal('position'), code: z.string().min(2).max(20), title: z.string().min(3).max(200), department: z.string().max(120).default(''), grantsRole: z.enum(['Staff', 'Faculty', 'Tutor', 'Advisor']), fte: z.number().gt(0).max(1) }),
    z.object({ action: z.literal('propose'), positionId: z.number().int(), email: z.string().email().max(200), start: DATE }),
    z.object({ action: z.literal('decide'), employmentId: z.number().int(), approve: z.boolean(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('access'), employmentId: z.number().int() }),
    z.object({ action: z.literal('end'), employmentId: z.number().int(), end: DATE, reason: z.string().min(5).max(1000), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('task'), taskId: z.number().int() }),
    z.object({ action: z.literal('leave'), employmentId: z.number().int(), kind: z.enum(['vacation', 'sick', 'parental', 'unpaid', 'other']), from: DATE, to: DATE, reason: z.string().max(1000).default('') }),
    z.object({ action: z.literal('decideLeave'), leaveId: z.number().int(), approve: z.boolean(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('doc'), employmentId: z.number().int(), title: z.string().min(3).max(200), ref: z.string().min(3).max(500) }),
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
    const roles = ((await sql.query(`SELECT role FROM hrm_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role));
    const hrStaff = roles.length > 0;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.'); return Number(out!.slice(3)); };
    const scope = await tenantScope(T);
    const member = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !scope.members.has(uid)) forbid('That person is not a member of your institution.');
      return uid;
    };
    const membershipOf = async (uid: string) => (await zite.memberships.findAll({ filters: { member: uid }, limit: 20 })).records.find((m) => first(m.institution) === T);
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage HR roles.');
      const uid = await member(input.email);
      fail(await one(`SELECT hrm_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
      await audit(a, `HR role ${input.on ? 'granted' : 'revoked'}`, `hrm_staff:${uid}`, input.role, 'Administrator');
    }
    if (input.action === 'position') result = { positionId: ok(await one(`SELECT hrm_position($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.code, input.title, input.department, input.grantsRole, input.fte])) };
    if (input.action === 'propose') {
      const uid = await member(input.email);
      result = { employmentId: ok(await one(`SELECT hrm_propose($1,$2,$3,$4,$5) AS r`, [me, T, input.positionId, uid, input.start])) };
    }
    if (input.action === 'decide') fail(await one(`SELECT hrm_decide($1,$2,$3,$4,$5) AS r`, [me, T, input.employmentId, input.approve, input.expectedVersion]));
    if (input.action === 'access') {
      // Identity executes: record first, then change the membership. If the membership write fails, reconciliation shows the drift.
      const e = ((await sql.query(`SELECT e.*, p.grants_role, p.title FROM hrm_employments e JOIN hrm_positions p ON p.id = e.position_id WHERE e.id = $1 AND e.tenant_id = $2`, [input.employmentId, T])) as Row[])[0];
      if (!e) forbid('Appointment not found.');
      const step = e.access_state === 'requested' ? 'provisioned' : e.access_state === 'removal_requested' ? 'removed' : null;
      if (!step) forbid('No access change is waiting for this appointment.');
      fail(await one(`SELECT hrm_access($1,$2,$3,$4,$5) AS r`, [me, T, input.employmentId, step, isAdmin]));
      const person = String(e.person_id);
      const m = await membershipOf(person);
      if (!m) forbid('Recorded, but the person has no membership here; reconcile manually.');
      const others = ((await sql.query(`SELECT p.grants_role FROM hrm_employments e JOIN hrm_positions p ON p.id = e.position_id WHERE e.tenant_id = $1 AND e.person_id = $2 AND e.state = 'active' AND e.id <> $3`, [T, person, input.employmentId])) as Row[]).map((r) => String(r.grants_role));
      const next = step === 'provisioned' ? rolesAfterProvision(m!.roles ?? [], String(e.grants_role)) : rolesAfterOffboard(m!.roles ?? [], String(e.grants_role), others);
      await zite.memberships.update({ id: m!.id, record: { roles: next } as never });
      await bumpEpoch(T, person, `hr ${step}`);
      await audit(a, step === 'provisioned' ? 'Employee access provisioned' : 'Employee access removed', `membership:${m!.id}`, `${e.grants_role} · ${e.title}`, 'Administrator (identity)');
      await notify(person, step === 'provisioned' ? `Your ${e.title} access is active.` : `Your ${e.title} access has been removed. Your other access, including as a student, is unchanged.`);
    }
    if (input.action === 'end') {
      fail(await one(`SELECT hrm_end($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.employmentId, input.end, input.reason, input.expectedVersion]));
      await audit(a, 'Employment ended', `hrm_employment:${input.employmentId}`, input.reason, 'HR officer');
    }
    if (input.action === 'task') fail(await one(`SELECT hrm_task($1,$2,$3) AS r`, [me, T, input.taskId]));
    if (input.action === 'leave') result = { leaveId: ok(await one(`SELECT hrm_leave_request($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.employmentId, input.kind, input.from, input.to, input.reason])) };
    if (input.action === 'decideLeave') {
      fail(await one(`SELECT hrm_leave_decide($1,$2,$3,$4,$5) AS r`, [me, T, input.leaveId, input.approve, input.note]));
      const l = ((await sql.query(`SELECT requested_by FROM hrm_leave WHERE id = $1`, [input.leaveId])) as Row[])[0];
      if (l) await notify(String(l.requested_by), `Your leave request was ${input.approve ? 'approved' : 'declined'}${input.note ? `: ${input.note}` : ''}.`);
    }
    if (input.action === 'doc') ok(await one(`SELECT hrm_doc_add($1,$2,$3,$4,$5) AS r`, [me, T, input.employmentId, input.title, input.ref]));

    // Reads. Employees see their own records; HR staff see the tenant; administrators see the access queue and drift only.
    const emps = (await sql.query(`SELECT e.*, p.code, p.title, p.department, p.grants_role, hrm_on_leave(e.id, current_date) AS on_leave FROM hrm_employments e JOIN hrm_positions p ON p.id = e.position_id
      WHERE e.tenant_id = $1 AND ($2 OR e.person_id = $3 OR ($4 AND e.access_state IN ('requested','removal_requested','provisioned','removed'))) ORDER BY e.created_at DESC LIMIT 500`, [T, hrStaff, me, isAdmin])) as Row[];
    const eids = emps.map((e) => Number(e.id));
    const visible = (e: Row) => hrStaff || e.person_id === me;
    const tasks = eids.length ? (await sql.query(`SELECT * FROM hrm_tasks WHERE employment_id = ANY($1::bigint[]) ORDER BY id`, [eids])) as Row[] : [];
    const leave = eids.length ? (await sql.query(`SELECT * FROM hrm_leave WHERE employment_id = ANY($1::bigint[]) ORDER BY from_date DESC`, [eids])) as Row[] : [];
    const docIds = emps.filter(visible).map((e) => Number(e.id));
    const docs = docIds.length ? (await sql.query(`SELECT * FROM hrm_docs WHERE employment_id = ANY($1::bigint[]) ORDER BY added_at DESC`, [docIds])) as Row[] : [];
    if (docs.length && input.action === 'get') await sql.query(`INSERT INTO hrm_events (tenant_id, subject, step, actor_id, note) VALUES ($1, 'document', 'view', $2, $3)`, [T, me, docs.map((d) => d.id).join(',')]);
    const positions = hrStaff ? (await sql.query(`SELECT * FROM hrm_positions WHERE tenant_id = $1 ORDER BY code`, [T])) as Row[] : [];
    const staff = isAdmin ? (await sql.query(`SELECT user_id, role FROM hrm_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    let drift: { person: string; missing: string[]; lingering: string[] }[] = [];
    if (isAdmin) {
      const people = [...new Set(emps.filter((e) => ['provisioned', 'removed'].includes(String(e.access_state))).map((e) => String(e.person_id)))];
      for (const pid of people) {
        const m = await membershipOf(pid);
        const r = reconcile(m?.roles ?? [], emps.filter((e) => e.person_id === pid).map((e) => ({ grants: String(e.grants_role), access: String(e.access_state), state: String(e.state) })));
        if (r.missing.length || r.lingering.length) drift.push({ person: pid, ...r });
      }
    }
    const names = await userNames([...emps.flatMap((e) => [e.person_id, e.proposed_by, e.approved_by, e.access_by, e.ended_by]), ...leave.map((l) => l.decided_by), ...staff.map((s) => s.user_id), ...drift.map((d) => d.person)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    drift = drift.map((d) => ({ ...d, person: nm(d.person)! }));

    return {
      result, roles, isAdmin, today: new Date().toISOString().slice(0, 10),
      positions: positions.map((p) => ({ id: Number(p.id), code: String(p.code), title: String(p.title), department: String(p.department), grantsRole: String(p.grants_role), fte: Number(p.fte), state: String(p.state) })),
      employments: emps.map((e) => {
        const full = visible(e);
        return { id: Number(e.id), person: nm(e.person_id), mine: e.person_id === me, position: `${e.code} ${e.title}`, grantsRole: String(e.grants_role), state: String(e.state), access: String(e.access_state),
          start: day(e.start_date), end: day(e.end_date), onLeave: !!e.on_leave, version: Number(e.version), proposedByMe: e.proposed_by === me,
          proposedBy: full ? nm(e.proposed_by) : null, approvedBy: full ? nm(e.approved_by) : null, accessBy: nm(e.access_by), endReason: full ? String(e.end_reason) : '',
          tasks: full ? tasks.filter((t) => String(t.employment_id) === String(e.id)).map((t) => ({ id: Number(t.id), kind: String(t.kind), item: String(t.item), done: !!t.done_at, doneBy: nm(t.done_by) })) : [],
          leave: full ? leave.filter((l) => String(l.employment_id) === String(e.id)).map((l) => ({ id: Number(l.id), kind: String(l.kind), from: day(l.from_date), to: day(l.to_date), reason: String(l.reason), state: String(l.state), decidedBy: nm(l.decided_by), note: String(l.decision_note), mine: l.requested_by === me })) : [],
          docs: full ? docs.filter((d) => String(d.employment_id) === String(e.id)).map((d) => ({ title: String(d.title), ref: String(d.ref), at: iso(d.added_at) })) : [] };
      }),
      staff: staff.map((s) => ({ name: nm(s.user_id), role: String(s.role) })), drift,
    };
  },
});
