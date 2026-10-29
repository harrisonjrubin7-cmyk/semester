import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { MKT_MIGRATION } from '../lib/mktMigration';
import { MKA_MIGRATION } from '../lib/mkaMigration';
import { SITE_MIGRATION } from '../../../semester-site/src/lib/pg';
import { funnel, attribution, cohorts, Lead } from '../lib/marketingReports';

type Row = Record<string, unknown>;
const forbid = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureCoRoles(); for (const q of [...SITE_MIGRATION, ...MKT_MIGRATION, ...MKA_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Marketing analytics and consent: funnel, attribution, cohorts (aggregates only), the consent ledger, experiments between two
// approved campaigns, and exports approved by a second person. Reads business inquiries only — never student records.
export default createEndpoint({
  description: 'Marketing analytics: funnel, attribution, cohorts, consent ledger, experiments and approved aggregate exports',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('consent'), email: z.string().email().max(200), kind: z.enum(['given', 'withdrawn']), source: z.enum(['contact_request', 'event_signup', 'other']), note: z.string().max(500).optional() }),
    z.object({ action: z.literal('experiment'), step: z.enum(['start', 'decide', 'abandon']), id: z.number().int().nullable(), name: z.string().max(120).optional(), hypothesis: z.string().max(2000).optional(),
      armA: z.string().max(80).optional(), armB: z.string().max(80).optional(), minPerArm: z.number().int().optional(), decision: z.enum(['a', 'b', 'no_clear_difference']).optional(), note: z.string().max(2000).optional() }),
    z.object({ action: z.literal('export'), step: z.enum(['request', 'approve', 'reject', 'download']), id: z.number().int().nullable(), report: z.enum(['funnel', 'attribution', 'cohorts']).optional(),
      purpose: z.string().max(500).optional(), seen: z.string().max(64).optional(), note: z.string().max(1000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await ensure();
    const roles = await rolesOf(me);
    const analyst = roles.includes('marketing_analyst'), approver = roles.includes('marketing_approver');
    const consentRole = roles.some((r) => ['marketer', 'marketing_approver', 'privacy_officer'].includes(r));
    if (!analyst && !approver && !consentRole) forbid('Marketing analytics needs a marketing or privacy role.');
    const sql = pg();
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    // Leads: site requests with their inbox status; keyed by a hash so no address leaves this function.
    const site = (await sql.query(`SELECT md5(lower(trim(email))) AS key, kind, created_at, utm_source, utm_campaign, zite_record_id FROM site_inbound_requests ORDER BY created_at`)) as Row[];
    const inbox = (await zite.inboundRequests.findAll({ fields: ['status'], limit: 2000 })).records;
    const status = new Map(inbox.map((r) => [r.id, String(r.status ?? 'New')]));
    const leads: Lead[] = site.map((r) => ({ key: String(r.key), kind: String(r.kind), createdAt: String(iso(r.created_at)), status: status.get(String(r.zite_record_id ?? '')) ?? 'New', source: r.utm_source ? String(r.utm_source) : null, campaign: r.utm_campaign ? String(r.utm_campaign) : null }));
    const reports = { funnel: funnel(leads), attribution: attribution(leads), cohorts: cohorts(leads) };

    let downloaded: unknown = null;
    if (input.action === 'consent') { const r = await one(`SELECT mka_consent($1,$2,$3,$4,$5,$6) AS r`, [me, consentRole, input.email, input.kind, input.source, input.note ?? null]); if (r) forbid(r); }
    if (input.action === 'experiment') {
      const r = await one(`SELECT mka_experiment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS r`, [me, analyst, input.step, input.id, input.name ?? null, input.hypothesis ?? null, input.armA ?? null, input.armB ?? null, input.minPerArm ?? null, input.decision ?? null, input.note ?? null]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
    }
    if (input.action === 'export') {
      const snapshot = input.step === 'request' && input.report ? { report: input.report, generatedAt: new Date().toISOString(), rows: reports[input.report] } : null;
      const r = await one(`SELECT mka_export($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) AS r`, [me, analyst, approver, input.step, input.id, input.report ?? null, snapshot ? JSON.stringify(snapshot) : null, input.purpose ?? null, input.seen ?? null, input.note ?? null]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
      if (input.step === 'download') downloaded = ((await sql.query(`SELECT snapshot FROM mka_exports WHERE id = $1`, [input.id])) as Row[])[0]?.snapshot ?? null;
    }

    const [audience, campaigns, experiments, exports, withdrawals] = await Promise.all([
      sql.query(`SELECT mka_audience() AS n`) as Promise<Row[]>,
      sql.query(`SELECT id, number, name, state FROM mkt_campaigns ORDER BY number DESC LIMIT 100`) as Promise<Row[]>,
      sql.query(`SELECT * FROM mka_experiments ORDER BY started_at DESC LIMIT 50`) as Promise<Row[]>,
      sql.query(`SELECT id, report, snapshot, snapshot_hash, purpose, state, requested_by, decided_by, decision_note, decided_at, downloads, created_at FROM mka_exports ORDER BY created_at DESC LIMIT 50`) as Promise<Row[]>,
      sql.query(`SELECT count(*)::int AS n FROM (SELECT DISTINCT ON (contact_key) kind FROM mka_consent_events ORDER BY contact_key, at DESC, id DESC) x WHERE kind = 'withdrawn'`) as Promise<Row[]>,
    ]);
    const live = await Promise.all(experiments.filter((e) => e.state === 'running').map(async (e) => ({ id: Number(e.id),
      a: ((await sql.query(`SELECT mka_leads($1,$2) AS n`, [e.arm_a, e.started_at])) as Row[])[0].n, b: ((await sql.query(`SELECT mka_leads($1,$2) AS n`, [e.arm_b, e.started_at])) as Row[])[0].n })));
    const cName = (id: unknown) => { const c = campaigns.find((x) => x.id === id); return c ? `#${c.number} ${c.name}` : String(id); };
    return {
      me, analyst, approver, consentRole, downloaded,
      audience: Number(audience[0].n), withdrawn: Number(withdrawals[0].n), reports,
      campaigns: campaigns.filter((c) => c.state === 'approved').map((c) => ({ id: String(c.id), label: `#${c.number} ${c.name}`, tag: `c${c.number}` })),
      experiments: experiments.map((e) => { const l = live.find((x) => x.id === Number(e.id)); return { id: Number(e.id), name: String(e.name), hypothesis: String(e.hypothesis), armA: cName(e.arm_a), armB: cName(e.arm_b),
        minPerArm: Number(e.min_per_arm), state: String(e.state), mine: e.created_by === me, leadsA: Number(l ? l.a : e.leads_a ?? 0), leadsB: Number(l ? l.b : e.leads_b ?? 0), decision: e.decision ? String(e.decision) : null, note: String(e.decision_note), startedAt: iso(e.started_at) }; }),
      exports: exports.map((x) => ({ id: Number(x.id), report: String(x.report), snapshot: x.snapshot, hash: String(x.snapshot_hash), purpose: String(x.purpose), state: String(x.state), mine: x.requested_by === me,
        decidedAt: iso(x.decided_at), note: String(x.decision_note), downloads: Number(x.downloads), expired: x.decided_at ? new Date(String(x.decided_at)).getTime() < Date.now() - 7 * 864e5 : false })),
    };
  },
});
