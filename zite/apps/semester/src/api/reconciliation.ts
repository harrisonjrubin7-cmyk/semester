import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, audit, userNames, tenantScope, first } from '../lib/server';
import { pg, ensureSchema, dispatchOutbox } from '../lib/pg';
import { REC_MIGRATION } from '../lib/recMigration';
import { CONNECTORS, Connector } from '../lib/mappingRules';
import { SCOPE_CATALOG, WRITE_SCOPES, validateScopes, diffLedger, Mirror } from '../lib/reconRules';

let ready: Promise<void> | null = null;
const ensureRec = () => {
  if (!ready) { const sql = pg(); ready = (async () => { await ensureSchema(); for (const q of REC_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Integration Admin: least-privilege connector scopes and registrar reconciliation runs. Institution-scoped; connector capability only.
// A run retries the registrar outbox, then compares ledger seats with enrollment records and repairs only what the ledger proves.
export default createEndpoint({
  description: 'Connector scope grants and reconciliation runs that compare the registrar ledger with student enrollment records',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setScopes'), connector: z.enum(CONNECTORS), scopes: z.array(z.string().max(64)).max(20), reason: z.string().max(300) }),
    z.object({ action: z.literal('run'), repair: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    await ensureRec();
    const sql = pg();
    const T = a.institutionId;
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    let lastRun: unknown = null;

    if (input.action === 'setScopes') {
      fail(validateScopes(input.connector, input.scopes, input.reason));
      await sql.query(`INSERT INTO int_scope_grants (tenant_id, connector, scopes, reason, granted_by) VALUES ($1,$2,$3,$4,$5)`, [T, input.connector, input.scopes, input.reason.trim(), a.userId]);
      await audit(a, 'Connector scopes set', `connector:${input.connector}`, `${input.scopes.join(', ')}${input.reason ? ` · ${input.reason}` : ''}`, 'Integration admin');
    }

    if (input.action === 'run') {
      const out = await dispatchOutbox(T);
      const tenant = await tenantScope(T);
      const seats = ((await sql.query(`SELECT student_id, section_id FROM reg_seats WHERE tenant_id = $1`, [T])) as Row[])
        .map((s) => ({ student: String(s.student_id), section: String(s.section_id) })).filter((s) => tenant.sections.has(s.section));
      const sections = [...new Set(seats.map((s) => s.section))];
      const mirrors: Mirror[] = [];
      for (const section of sections) {
        const { records } = await zite.enrollments.findAll({ filters: { section }, limit: 2000 });
        for (const e of records) mirrors.push({ id: e.id, student: first(e.student) ?? '', section, status: e.status ?? '' });
      }
      const findings = diffLedger(seats, mirrors, new Set(sections));
      let repaired = 0;
      if (input.repair) {
        for (const f of findings) {
          if (f.kind !== 'missing_in_records') continue;
          if (f.enrollmentId) await zite.enrollments.update({ id: f.enrollmentId, record: { status: 'Enrolled', source: 'Official' } as never });
          else await zite.enrollments.create({ record: { label: 'Registrar ledger', student: f.student, section: f.section, status: 'Enrolled', source: 'Official' } as never });
          repaired++;
        }
      }
      const flagged = findings.filter((f) => f.kind === 'not_in_ledger').length;
      await sql.query(`INSERT INTO rec_runs (tenant_id, run_by, outbox_dispatched, outbox_failed, seats, findings, repaired, flagged) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
        [T, a.userId, out.dispatched, out.failed, seats.length, JSON.stringify(findings), repaired, flagged]);
      await audit(a, 'Reconciliation run', `institution:${T}`, `${seats.length} seats · ${findings.length} findings · ${repaired} repaired · ${flagged} flagged · outbox ${out.dispatched}/${out.failed}`, 'Integration admin');
      lastRun = { ...out, seats: seats.length, findings: findings.length, repaired, flagged };
    }

    const [grants, runs, pending] = await Promise.all([
      sql.query(`SELECT DISTINCT ON (connector) * FROM int_scope_grants WHERE tenant_id = $1 ORDER BY connector, id DESC`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM rec_runs WHERE tenant_id = $1 ORDER BY id DESC LIMIT 15`, [T]) as Promise<Row[]>,
      sql.query(`SELECT count(*)::int AS n, max(last_error) AS err FROM reg_outbox WHERE tenant_id = $1 AND status = 'pending'`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames([...grants.map((g) => String(g.granted_by)), ...runs.map((r) => String(r.run_by))]);
    const label = new Map<string, string>();
    const secIds = [...new Set(runs.flatMap((r) => (r.findings as { section: string }[]).map((f) => f.section)))].slice(0, 100);
    for (const id of secIds) { const s = await zite.sections.findOne({ id }); if (s) label.set(id, String((s as Row).name ?? (s as Row).label ?? id)); }
    const people = await userNames(runs.flatMap((r) => (r.findings as { student: string }[]).map((f) => f.student)));
    return {
      lastRun,
      outboxPending: Number(pending[0]?.n ?? 0), outboxError: (pending[0]?.err as string) ?? null,
      scopes: CONNECTORS.map((c: Connector) => {
        const g = grants.find((x) => x.connector === c);
        return { connector: c, allowed: SCOPE_CATALOG[c].allowed, required: SCOPE_CATALOG[c].required, writeScopes: SCOPE_CATALOG[c].allowed.filter((s) => WRITE_SCOPES.has(s)),
          granted: g ? (g.scopes as string[]) : null, reason: g ? String(g.reason) : '', by: g ? names[String(g.granted_by)] ?? 'Admin' : null, at: g ? iso(g.at) : null };
      }),
      runs: runs.map((r) => ({ id: Number(r.id), by: names[String(r.run_by)] ?? 'Admin', at: iso(r.at), seats: Number(r.seats), repaired: Number(r.repaired), flagged: Number(r.flagged),
        outboxDispatched: Number(r.outbox_dispatched), outboxFailed: Number(r.outbox_failed),
        findings: (r.findings as { kind: string; student: string; section: string }[]).map((f) => ({ kind: f.kind, student: people[f.student] ?? 'Student', section: label.get(f.section) ?? 'Section' })) })),
    };
  },
});
