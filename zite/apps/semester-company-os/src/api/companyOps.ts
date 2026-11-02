import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Company OS is an internal app: only organization members reach it (platform-enforced SSO).
// Rule from the context brief: company staff do not get student-record access. This endpoint therefore
// returns counts, statuses and timestamps only, never names, notes, grades, tasks or case content of
// institution members.

const REQUEST_STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'] as const;
const RISK_STATUSES = ['Open', 'Mitigating', 'Accepted', 'Closed'] as const;
const bad = (m: string) => { throw new ZiteError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m }); };

export default createEndpoint({
  description: 'Company OS: tenant status, activation, safe diagnostics, inbound requests, risks and release evidence (no student content)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('overview') }),
    z.object({ action: z.literal('requests') }),
    z.object({ action: z.literal('updateRequest'), id: z.string(), status: z.enum(REQUEST_STATUSES), note: z.string().max(2000).optional() }),
    z.object({ action: z.literal('risks') }),
    z.object({ action: z.literal('updateRisk'), id: z.string(), status: z.enum(RISK_STATUSES), note: z.string().max(2000).optional() }),
    z.object({ action: z.literal('evidence') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const actor = context.user?.id ?? null;
    const companyAudit = (action: string, ref: string, details: string) =>
      zite.auditEvents.create({ record: { action, actor, institution: null, recordRef: ref, authority: 'Semester company', viaAssistant: false, details } as never });

    if (input.action === 'overview') {
      const [inst, mem, integ, feats, reqs, risks, audit7] = await Promise.all([
        zite.sql({ query: `SELECT "id","name","isSample" FROM "Institutions" ORDER BY "name"` }),
        // Counts only: memberships per institution and status, and role mix.
        zite.sql({ query: `SELECT l."institutionsId" AS inst, m."status" AS status, count(*)::int AS n FROM "Memberships" m JOIN "InstitutionsMemberships" l ON l."membershipsId" = m.id GROUP BY 1, 2` }),
        zite.sql({ query: `SELECT l."institutionsId" AS inst, i."connector" AS connector, i."enabled" AS enabled, i."authorizedByInstitution" AS authorized, i."syncStatus" AS sync, i."lastSyncedAt" AS last FROM "Integrations" i JOIN "InstitutionsIntegrations" l ON l."integrationsId" = i.id` }),
        zite.sql({ query: `SELECT "status", count(*)::int AS n FROM "FeatureStatus" GROUP BY 1` }),
        zite.sql({ query: `SELECT "status", count(*)::int AS n FROM "InboundRequests" GROUP BY 1` }),
        zite.sql({ query: `SELECT "status","impact", count(*)::int AS n FROM "CompanyRisks" GROUP BY 1, 2` }),
        zite.sql({ query: `SELECT l."institutionsId" AS inst, count(*)::int AS n, max(a."occurredAt") AS last FROM "AuditEvents" a JOIN "AuditEventsInstitutions" l ON l."auditEventsId" = a.id WHERE a."occurredAt" > now() - interval '7 days' GROUP BY 1` }),
      ]);
      const tenants = inst.rows.map((t) => {
        const id = String(t.id);
        const m = mem.rows.filter((r) => String(r.inst) === id);
        const n = (s: string) => m.filter((r) => r.status === s).reduce((x, r) => x + Number(r.n), 0);
        const ints = integ.rows.filter((r) => String(r.inst) === id);
        const a = audit7.rows.find((r) => String(r.inst) === id);
        const activation = t.isSample ? 'Sample (demo only)' : ints.some((i) => i.enabled && i.authorized) ? 'Connected' : n('Active') > 0 ? 'Active, not connected' : 'Not activated';
        return {
          id, name: String(t.name ?? ''), isSample: !!t.isSample, activation,
          members: { active: n('Active'), pending: n('Pending'), suspended: n('Suspended') },
          integrations: ints.map((i) => ({ connector: String(i.connector ?? ''), enabled: !!i.enabled, authorized: !!i.authorized, sync: String(i.sync ?? 'Never Run'), last: i.last ? String(i.last) : null })),
          activity7d: { auditEvents: Number(a?.n ?? 0), last: a?.last ? String(a.last) : null },
        };
      });
      const count = (rows: Record<string, unknown>[], key: string) => Object.fromEntries(rows.map((r) => [String(r[key] ?? 'Unset'), Number(r.n)]));
      return {
        tenants,
        features: count(feats.rows, 'status'),
        requests: count(reqs.rows, 'status'),
        risks: risks.rows.map((r) => ({ status: String(r.status ?? ''), impact: String(r.impact ?? ''), n: Number(r.n) })),
      };
    }

    if (input.action === 'requests') {
      const { records } = await zite.inboundRequests.findAll({ limit: 500 });
      return {
        items: records.map((r) => ({ id: r.id, name: r.name ?? '', email: r.email ?? '', institution: r.institution ?? '', role: r.role ?? '', kind: r.kind ?? '', message: r.message ?? '', status: r.status ?? 'New', note: r.ownerNote ?? '', receivedAt: r.receivedAt ?? null }))
          .sort((x, y) => String(y.receivedAt ?? '').localeCompare(String(x.receivedAt ?? ''))),
      };
    }
    if (input.action === 'updateRequest') {
      const r = await zite.inboundRequests.findOne({ id: input.id });
      if (!r) bad('That request no longer exists.');
      await companyAudit(`Inbound request ${input.status}`, `inbound:${r!.id}`, r!.kind ?? '');
      await zite.inboundRequests.update({ id: r!.id, record: { status: input.status, ...(input.note !== undefined ? { ownerNote: input.note } : {}) } as never });
      return { ok: true };
    }

    if (input.action === 'risks') {
      const { records } = await zite.companyRisks.findAll({ limit: 500 });
      const rank: Record<string, number> = { Critical: 0, High: 1, Medium: 2 };
      return {
        items: records.map((r) => ({ id: r.id, risk: r.risk ?? '', likelihood: r.likelihood ?? '', impact: r.impact ?? '', mitigation: r.mitigation ?? '', owner: r.owner ?? '', status: r.status ?? 'Open', source: r.source ?? '', note: r.updateNote ?? '' }))
          .sort((a, b) => (a.status === 'Closed' ? 1 : 0) - (b.status === 'Closed' ? 1 : 0) || (rank[a.impact] ?? 9) - (rank[b.impact] ?? 9)),
      };
    }
    if (input.action === 'updateRisk') {
      const r = await zite.companyRisks.findOne({ id: input.id });
      if (!r) bad('That risk no longer exists.');
      await companyAudit(`Risk ${input.status}`, `risk:${r!.id}`, r!.risk ?? '');
      await zite.companyRisks.update({ id: r!.id, record: { status: input.status, ...(input.note !== undefined ? { updateNote: input.note } : {}) } as never });
      return { ok: true };
    }

    const { records } = await zite.featureStatus.findAll({ limit: 500 });
    const order = ['production_operated', 'pilot_enabled', 'verified_in_test', 'implemented_unverified', 'specified', 'not_started'];
    return {
      items: records.map((f) => ({ id: f.id, feature: f.feature ?? '', status: f.status ?? 'not_started', evidence: f.evidence ?? '', tests: f.testCases ?? '', blocker: f.blocker ?? '', lastVerified: f.lastVerified ?? null, next: f.nextAction ?? '', deployed: !!f.deployed, authorized: !!f.institutionAuthorized }))
        .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)),
    };
  },
});
