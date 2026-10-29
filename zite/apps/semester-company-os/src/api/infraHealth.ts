import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { rolesOf } from '../lib/coRoles';
import { GUARD_MANIFEST } from '../lib/guardManifest';
import { latencyCheck, guardCheck, coverageCheck, deadTupleCheck, longQueryCheck, overall, NOT_MEASURED, Check } from '../lib/healthRules';

// Platform Admin "infrastructure health" (pl-001, 29 Oct). Measures the database this app runs on: round trip, declared
// integrity triggers, module coverage, bloat and long queries. Results of each run are kept append-only. Reads only catalog
// and statistics views: never a row of student, customer or company data.
export const PL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS pl_health_runs (id bigserial PRIMARY KEY, actor_id text NOT NULL, overall text NOT NULL CHECK (overall IN ('ok', 'warn', 'fail')),
     checks jsonb NOT NULL CHECK (jsonb_typeof(checks) = 'array'), db_bytes bigint, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION pl_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS pl_health_runs_append_only ON pl_health_runs`,
  `CREATE TRIGGER pl_health_runs_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON pl_health_runs FOR EACH STATEMENT EXECUTE FUNCTION pl_refuse_change()`,
];

let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of PL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
type Row = Record<string, unknown>;

export async function measure() {
  const sql = pg();
  const samples: number[] = []; let err: string | null = null;
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    try { await sql.query('SELECT 1'); samples.push(performance.now() - t); } catch (e) { err = String((e as Error).message).slice(0, 200); break; }
  }
  const checks: Check[] = [latencyCheck(samples, err)];
  if (err) return { checks, dbBytes: null as number | null };
  const [tabs, trigs, stats, acts, size] = await Promise.all([
    sql.query(`SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')`) as Promise<Row[]>,
    sql.query(`SELECT c.relname AS t, g.tgname AS g FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND NOT g.tgisinternal AND g.tgenabled <> 'D'`) as Promise<Row[]>,
    sql.query(`SELECT relname AS t, n_live_tup AS live, n_dead_tup AS dead FROM pg_stat_user_tables`) as Promise<Row[]>,
    sql.query(`SELECT state, query = '<insufficient privilege>' AS hidden, extract(epoch FROM now() - query_start) AS age FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()`) as Promise<Row[]>,
    sql.query(`SELECT pg_database_size(current_database()) AS b`) as Promise<Row[]>,
  ]);
  const tables = new Set(tabs.map((r) => String(r.t)));
  const triggers = new Set(trigs.map((r) => `${r.t}.${r.g}`));
  // Disabled triggers (tgenabled = 'D') are excluded above, so a guard switched off counts as missing.
  checks.push(guardCheck(GUARD_MANIFEST.guards, tables, triggers));
  checks.push(coverageCheck(GUARD_MANIFEST.tables, tables));
  checks.push(deadTupleCheck(stats.map((r) => ({ table: String(r.t), live: Number(r.live), dead: Number(r.dead) }))));
  // Other sessions' details are hidden from roles without pg_read_all_stats; then nothing can be said about long queries.
  const hidden = acts.some((r) => r.hidden === true || r.state == null);
  checks.push(longQueryCheck(acts.filter((r) => r.state === 'active').map((r) => Number(r.age)), !hidden));
  const dbBytes = Number(size[0].b);
  checks.push({ key: 'db_size', label: 'Database size', status: 'info', detail: `${(dbBytes / 1024 / 1024).toFixed(1)} MB. No limit is set here; the provider's plan limit is not visible to this app.` });
  return { checks, dbBytes };
}

export default createEndpoint({
  description: 'Platform admin infrastructure health: measure the database (latency, integrity triggers, coverage, bloat, long queries) and keep each run',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['get', 'run']) }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (!(await rolesOf(me)).includes('platform_admin')) { const m = 'Infrastructure health needs the Platform admin role.'; throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); }
    await ensure();
    const sql = pg();
    if (input.action === 'run') {
      const { checks, dbBytes } = await measure();
      await sql.query(`INSERT INTO pl_health_runs (actor_id, overall, checks, db_bytes) VALUES ($1, $2, $3::jsonb, $4)`, [me, overall(checks), JSON.stringify(checks), dbBytes]);
    }
    const [runs, { records: users }] = await Promise.all([
      sql.query(`SELECT id, actor_id, overall, checks, db_bytes, at FROM pl_health_runs ORDER BY id DESC LIMIT 20`) as Promise<Row[]>,
      zite.auth.findAllUsers({ limit: 200 }),
    ]);
    const name = (id: unknown) => { const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    return {
      notMeasured: NOT_MEASURED,
      runs: runs.map((r) => ({ id: Number(r.id), by: name(r.actor_id), overall: String(r.overall), checks: r.checks as Check[], dbBytes: r.db_bytes == null ? null : Number(r.db_bytes), at: new Date(String(r.at)).toISOString() })),
    };
  },
});
