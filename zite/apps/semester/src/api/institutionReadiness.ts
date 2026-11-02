import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, tenantScope, audit } from '../lib/server';
import { tenantSources } from '../lib/sourcesServer';
import { sisBlock, reconcile } from '../lib/sources';
import { pg, ensureSchema } from '../lib/pg';

const Check = z.object({ key: z.string(), label: z.string(), state: z.enum(['ok', 'blocked', 'info']), detail: z.string() });

export default createEndpoint({
  description: 'Read-only institution readiness: source freshness, setup checks and registrar ledger reconciliation',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    generatedAt: z.string(),
    ready: z.boolean(),
    checks: z.array(Check),
    sources: z.array(z.object({ name: z.string(), connector: z.string(), state: z.string(), detail: z.string(), lastSyncedAt: z.string().nullable() })),
    recon: z.object({ checked: z.number(), ok: z.boolean(), ledgerAvailable: z.boolean(), mismatches: z.array(z.object({ sectionId: z.string(), label: z.string(), zite: z.number(), ledger: z.number() })) }),
  }),
  execute: async ({ context }) => {
    const a = await requireAction(context.user.id, 'readiness.read');
    const tenant = await tenantScope(a.institutionId);
    const sources = await tenantSources(a.institutionId);
    const secIds = [...tenant.sections];

    const [terms, enrolled] = await Promise.all([
      zite.sql({ query: `SELECT t."code", t."registrationOpens" FROM "AcademicTerms" t JOIN "AcademicTermsInstitutions" l ON l."academicTermsId" = t.id WHERE l."institutionsId" = $1`, params: [a.institutionId] }).catch(() => ({ rows: [] })),
      secIds.length ? zite.sql({ query: `SELECT s.id, s."label" AS label, s."capacity", COUNT(e.id) FILTER (WHERE e."status" = 'Enrolled')::int AS n
        FROM "Sections" s LEFT JOIN "EnrollmentsSections" l ON l."sectionsId" = s.id LEFT JOIN "Enrollments" e ON e.id = l."enrollmentsId"
        WHERE s.id = ANY($1) GROUP BY s.id`, params: [secIds] }) : Promise.resolve({ rows: [] }),
    ]);
    const secRows = enrolled.rows as { id: string; label: string | null; capacity: number | null; n: number }[];

    let ledger = new Map<string, number>(); let ledgerAvailable = true;
    try {
      await ensureSchema();
      const r = (await pg().query(`SELECT section_id, count(*)::int AS n FROM reg_seats WHERE tenant_id = $1 GROUP BY section_id`, [a.institutionId])) as { section_id: string; n: number }[];
      ledger = new Map(r.map((x) => [x.section_id, x.n]));
    } catch { ledgerAvailable = false; }
    // Only sections the ledger has decided on are comparable; others pre-date the ledger.
    const recon = reconcile(secRows.filter((s) => ledger.has(s.id)).map((s) => ({ sectionId: s.id, label: s.label ?? s.id, zite: s.n, ledger: ledger.get(s.id) ?? 0 })));

    const block = sisBlock(sources);
    const noCap = secRows.filter((s) => s.capacity == null).length;
    const checks: z.infer<typeof Check>[] = [
      block ? { key: 'sis', label: 'Official source is fresh', state: 'blocked', detail: block }
        : sources.some((s) => s.connector === 'SIS' && s.state === 'Fresh') ? { key: 'sis', label: 'Official source is fresh', state: 'ok', detail: 'SIS feed is current.' }
        : { key: 'sis', label: 'Official source is fresh', state: 'info', detail: 'No SIS connected. Semester holds requests only; record official changes in your SIS too.' },
      { key: 'members', label: 'People onboarded', state: tenant.members.size ? 'ok' : 'blocked', detail: `${tenant.members.size} people hold a membership.` },
      { key: 'sections', label: 'Sections published', state: secRows.length ? 'ok' : 'blocked', detail: `${secRows.length} sections${noCap ? `, ${noCap} without a capacity (treated as unlimited)` : ''}.` },
      { key: 'terms', label: 'Registration window set', state: terms.rows.some((t) => (t as Record<string, unknown>).registrationOpens) ? 'ok' : 'blocked', detail: terms.rows.length ? `${terms.rows.length} term(s) configured.` : 'No academic term with a registration window.' },
      !ledgerAvailable ? { key: 'ledger', label: 'Registrar ledger reconciles', state: 'blocked', detail: 'The registrar backend could not be reached.' }
        : recon.ok ? { key: 'ledger', label: 'Registrar ledger reconciles', state: 'ok', detail: `${recon.checked} section(s) match the ledger.` }
        : { key: 'ledger', label: 'Registrar ledger reconciles', state: 'blocked', detail: `${recon.mismatches.length} section(s) differ from the ledger. Run Reconcile on the Registrar desk, then re-check.` },
    ];
    await audit(a, 'Viewed readiness', `institution:${a.institutionId}`, 'read-only', 'Institution');
    return {
      generatedAt: new Date().toISOString(), ready: checks.every((c) => c.state !== 'blocked'), checks,
      sources: sources.map((s) => ({ name: s.name, connector: s.connector, state: s.state, detail: s.detail, lastSyncedAt: s.lastSyncedAt })),
      recon: { ...recon, ledgerAvailable },
    };
  },
});
