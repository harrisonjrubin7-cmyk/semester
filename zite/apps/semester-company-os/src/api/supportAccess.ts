import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { SUP_MIGRATION } from '../lib/supMigration';

let ready: Promise<void> | null = null;
const ensureSup = () => {
  if (!ready) ready = (async () => { await ensureCoRoles(); const sql = pg(); for (const s of SUP_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  return ready;
};
const SCOPES = ['configuration', 'integration_status', 'course_catalog'] as const;
const no = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };

// Support Operations (APP-025): agents get no standing access to any institution. They request scoped, expiring access
// for one ticket; the institution approves it in its own console; every view re-checks the grant and is logged.
// The scoped views never return student records.
export default createEndpoint({
  description: 'Support access: request time-limited, institution-approved access for a ticket, and view only the approved, non-student scopes',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('request'), requestId: z.string().min(8).max(80), tenantId: z.string(), ticketRef: z.string().min(1).max(80), purpose: z.string().min(20).max(1000),
      scopes: z.array(z.enum(SCOPES)).min(1), hours: z.number().int().min(1).max(8) }),
    z.object({ op: z.literal('revoke'), id: z.string() }),
    z.object({ op: z.literal('view'), tenantId: z.string(), scope: z.enum(SCOPES) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureSup();
    const sql = pg();
    const me = context.user.id;
    if (!(await rolesOf(me)).includes('support_agent')) no('You don’t have the support agent role.');

    if (input.op === 'request') {
      const inst = await zite.institutions.findOne({ id: input.tenantId });
      if (!inst) no('Choose an institution.');
      const r = (await sql.query(`SELECT sup_request($1,$2,$3,$4,$5,$6,$7,$8) AS e`, [me, input.requestId, input.tenantId, inst!.name ?? '', input.ticketRef, input.purpose, input.scopes, input.hours])) as { e: string | null }[];
      if (r[0].e) no(r[0].e);
      return { ok: true, message: 'Requested. The institution’s administrator approves or denies it in their Semester console.' };
    }
    if (input.op === 'revoke') {
      const r = (await sql.query(`SELECT sup_revoke($1, NULL, $2) AS e`, [me, input.id])) as { e: string | null }[];
      if (r[0].e) no(r[0].e);
      return { ok: true, message: 'Done.' };
    }
    if (input.op === 'view') {
      const r = (await sql.query(`SELECT sup_check($1,$2,$3) AS e`, [me, input.tenantId, input.scope])) as { e: string | null }[];
      if (r[0].e) no(`Access denied: ${r[0].e}. This attempt was logged.`);
      const T = [input.tenantId];
      if (input.scope === 'configuration') {
        const i = await zite.institutions.findOne({ id: input.tenantId });
        return { scope: input.scope, rows: i ? [{ name: i.name ?? '', retentionDays: i.retentionDays ?? null, aiPolicy: i.aiPolicy ?? '', sampleData: !!i.isSample }] : [] };
      }
      if (input.scope === 'integration_status') {
        const { rows } = await zite.sql({ query: `SELECT i."connector", i."enabled", i."syncStatus", i."lastSyncedAt" FROM "Integrations" i JOIN "InstitutionsIntegrations" l ON l."integrationsId" = i.id WHERE l."institutionsId" = $1`, params: T });
        return { scope: input.scope, rows };
      }
      const { rows } = await zite.sql({ query: `SELECT c."code", c."title", c."credits" FROM "Courses" c JOIN "CoursesInstitutions" l ON l."coursesId" = c.id WHERE l."institutionsId" = $1 ORDER BY c."code" LIMIT 200`, params: T });
      return { scope: input.scope, rows };
    }

    const [reqs, events, insts] = await Promise.all([
      sql.query(`SELECT *, (state = 'approved' AND expires_at > now()) AS active FROM sup_requests WHERE agent_id = $1 ORDER BY number DESC LIMIT 50`, [me]) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT e.* FROM sup_events e JOIN sup_requests r ON r.id = e.request_id WHERE r.agent_id = $1 ORDER BY e.id`, [me]) as Promise<Record<string, unknown>[]>,
      zite.institutions.findAll({ limit: 200 }),
    ]);
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      scopes: SCOPES,
      institutions: insts.records.map((i) => ({ id: i.id, name: i.name ?? '', sample: !!i.isSample })),
      requests: reqs.map((r) => ({ id: String(r.id), number: Number(r.number), tenantId: String(r.tenant_id), tenant: String(r.tenant_name), ticket: String(r.ticket_ref), purpose: String(r.purpose),
        scopes: r.scopes as string[], hours: Number(r.hours), state: String(r.state), active: !!r.active, expiresAt: iso(r.expires_at), note: (r.decision_note as string) ?? '',
        events: events.filter((e) => e.request_id === r.id).map((e) => ({ action: String(e.action), detail: String(e.detail), at: iso(e.at) })) })),
    };
  },
});
