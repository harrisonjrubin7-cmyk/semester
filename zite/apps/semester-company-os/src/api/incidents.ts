import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, sha256 } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { INC_MIGRATION } from '../lib/incMigration';

let ready: Promise<void> | null = null;
const ensureInc = () => {
  if (!ready) ready = (async () => { await ensureCoRoles(); const sql = pg(); for (const s of INC_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  return ready;
};

const ACTIONS = ['report', 'triage', 'declare', 'assign', 'update', 'mitigate', 'resolve', 'privacy_review', 'postmortem', 'followup', 'draft_notice', 'approve_notice', 'close'] as const;

// Incident response (book workflow "Incident response"). Anyone in Company OS can report; everything else is decided inside
// inc_cmd() from server-held roles. The incident list is visible to the incident team only.
export default createEndpoint({
  description: 'Incident response: list incidents for the incident team, and run one incident step atomically',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('run'), commandKey: z.string().min(8).max(80), action: z.enum(ACTIONS), incidentId: z.string().optional(),
      version: z.number().int().optional(), title: z.string().max(140).optional(), summary: z.string().max(2000).optional(), note: z.string().max(4000).optional(),
      severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).optional(), studentData: z.boolean().optional(), techLead: z.string().optional(), commsLead: z.string().optional(),
      owner: z.string().optional(), due: z.string().optional(), audience: z.string().max(120).optional(), body: z.string().max(4000).optional(), noticeId: z.number().int().optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureInc();
    const sql = pg();
    const me = context.user.id;
    const roles = await rolesOf(me);
    const team = roles.some((r) => r === 'incident_responder' || r === 'incident_exec' || r === 'privacy_officer');

    if (input.op === 'run') {
      const { commandKey, action, incidentId, ...p } = input;
      if (action !== 'report' && !incidentId) throw new ZiteError('Choose an incident.');
      const hash = await sha256(JSON.stringify({ action, incidentId, ...p }));
      const rows = (await sql.query(`SELECT inc_cmd($1,$2,$3,$4,$5,$6::jsonb) AS r`, [me, commandKey, hash, action, incidentId ?? null, JSON.stringify(p)])) as { r: { id: string | null; resultCode: string; message: string; replay?: boolean } }[];
      const r = rows[0].r;
      return { id: r.id ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
    }

    const { records: users } = await zite.auth.findAllUsers({ limit: 200 });
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    const roster = ((await sql.query(`SELECT user_id, array_agg(role ORDER BY role) AS roles FROM co_roles WHERE tenant_id = 'semester-company' AND revoked_at IS NULL GROUP BY user_id`)) as { user_id: string; roles: string[] }[])
      .map((x) => ({ id: x.user_id, name: name(x.user_id), roles: x.roles }));
    if (!team) {
      const mine = (await sql.query(`SELECT id, number, title, state, created_at FROM inc_incidents WHERE reported_by = $1 ORDER BY number DESC LIMIT 20`, [me])) as Record<string, unknown>[];
      return { me, roles, team: false, roster: [], incidents: mine.map((i) => ({ id: String(i.id), number: Number(i.number), title: String(i.title), state: String(i.state), createdAt: new Date(String(i.created_at)).toISOString() })) };
    }
    const inc = (await sql.query(`SELECT * FROM inc_incidents ORDER BY (state = 'closed'), number DESC LIMIT 100`)) as Record<string, unknown>[];
    const ids = inc.map((i) => String(i.id));
    const [tl, fu, no] = ids.length ? await Promise.all([
      sql.query(`SELECT incident_id, actor_id, action, detail, at FROM inc_timeline WHERE incident_id = ANY($1) ORDER BY id`, [ids]),
      sql.query(`SELECT incident_id, title, owner_id, due FROM inc_followups WHERE incident_id = ANY($1) ORDER BY id`, [ids]),
      sql.query(`SELECT id, incident_id, audience, body, drafted_by, approved_by, status, sending FROM inc_notices WHERE incident_id = ANY($1) ORDER BY id`, [ids]),
    ]) as Record<string, unknown>[][] : [[], [], []];
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      me, roles, team: true, roster,
      incidents: inc.map((i) => ({
        id: String(i.id), number: Number(i.number), title: String(i.title), summary: String(i.summary ?? ''), state: String(i.state), severity: (i.severity as string) ?? null,
        studentData: !!i.student_data_possible, version: Number(i.version), reportedBy: name(i.reported_by), declaredBy: name(i.declared_by),
        techLead: name(i.tech_lead), techLeadId: (i.tech_lead as string) ?? '', commsLead: name(i.comms_lead), commsLeadId: (i.comms_lead as string) ?? '',
        mitigation: (i.mitigation as string) ?? '', privacyReviewedBy: name(i.privacy_reviewed_by), privacyNote: (i.privacy_note as string) ?? '',
        postmortem: (i.postmortem as string) ?? '', createdAt: iso(i.created_at), resolvedAt: iso(i.resolved_at), closedAt: iso(i.closed_at),
        timeline: tl.filter((t) => t.incident_id === i.id).map((t) => ({ actor: name(t.actor_id), action: String(t.action), detail: String(t.detail), at: iso(t.at) })),
        followups: fu.filter((f) => f.incident_id === i.id).map((f) => ({ title: String(f.title), owner: name(f.owner_id), due: f.due ? String(f.due).slice(0, 10) : null })),
        notices: no.filter((n) => n.incident_id === i.id).map((n) => ({ id: Number(n.id), audience: String(n.audience), body: String(n.body), draftedBy: name(n.drafted_by), draftedById: String(n.drafted_by), approvedBy: name(n.approved_by), status: String(n.status) })),
      })),
    };
  },
});
