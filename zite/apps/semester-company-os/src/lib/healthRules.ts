// Infrastructure health rules (Platform Admin). Pure: the endpoint measures, these functions judge. Every result says what was
// measured; things this app cannot measure are listed as "not measured" rather than shown as healthy.
import type { Guard } from './schemaScan';

export type Status = 'ok' | 'warn' | 'fail' | 'info';
export type Check = { key: string; label: string; status: Status; detail: string };

export const LATENCY_WARN_MS = 300;
export const LATENCY_FAIL_MS = 1500;
export const DEAD_RATIO_WARN = 0.5;
export const DEAD_MIN_ROWS = 10_000;
export const LONG_QUERY_WARN_S = 300;

export const NOT_MEASURED = [
  'Public uptime of the apps from outside (no external probe is connected).',
  'App build and publish status (only visible in the Zite editor).',
  'Database backups and point-in-time recovery (managed by the database provider; not visible here).',
  'Email, payments and other outbound delivery (disabled in this environment, so there is nothing to measure).',
];

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

export function latencyCheck(samplesMs: number[], error: string | null): Check {
  if (error || !samplesMs.length) return { key: 'db_latency', label: 'Database round trip', status: 'fail', detail: `Database did not answer: ${error ?? 'no samples'}` };
  const m = Math.round(median(samplesMs));
  const status: Status = m >= LATENCY_FAIL_MS ? 'fail' : m >= LATENCY_WARN_MS ? 'warn' : 'ok';
  return { key: 'db_latency', label: 'Database round trip', status, detail: `Median ${m} ms over ${samplesMs.length} queries (warn at ${LATENCY_WARN_MS} ms, fail at ${LATENCY_FAIL_MS} ms).` };
}

/** Guards declared in code whose table exists must exist in the database. A missing guard is an integrity failure. */
export function guardCheck(guards: Guard[], existingTables: Set<string>, existingTriggers: Set<string>): Check & { missing: string[] } {
  const live = guards.filter((g) => existingTables.has(g.table));
  const missing = live.filter((g) => !existingTriggers.has(`${g.table}.${g.trigger}`)).map((g) => `${g.table}.${g.trigger}`);
  const waiting = guards.length - live.length;
  return {
    key: 'guards', label: 'Append-only and integrity triggers', status: missing.length ? 'fail' : 'ok', missing,
    detail: missing.length
      ? `${missing.length} of ${live.length} declared triggers are missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}. Either that module's newest migration has not run yet (it runs when the republished app first uses the module) or the trigger was removed; until it exists, its protection is not in force.`
      : `All ${live.length} declared triggers on initialised tables are present.${waiting ? ` ${waiting} belong to modules not used yet.` : ''}`,
  };
}

/** Tables are created the first time a module is used, so an absent table means "not used yet", not broken. */
export function coverageCheck(tables: string[], existingTables: Set<string>): Check {
  const have = tables.filter((t) => existingTables.has(t)).length;
  return { key: 'coverage', label: 'Modules initialised', status: 'info', detail: `${have} of ${tables.length} declared tables exist. The rest are created when their module is first used.` };
}

export function deadTupleCheck(rows: { table: string; live: number; dead: number }[]): Check {
  const bad = rows.filter((r) => r.live + r.dead >= DEAD_MIN_ROWS && r.dead / Math.max(1, r.live + r.dead) >= DEAD_RATIO_WARN);
  return {
    key: 'dead_rows', label: 'Table bloat', status: bad.length ? 'warn' : 'ok',
    detail: bad.length ? `Mostly dead rows (vacuum pending): ${bad.map((r) => `${r.table} ${Math.round((100 * r.dead) / (r.live + r.dead))}%`).join(', ')}`
      : `No table with at least ${DEAD_MIN_ROWS.toLocaleString('en-US')} rows is ${DEAD_RATIO_WARN * 100}% or more dead rows.`,
  };
}

export function longQueryCheck(ages: number[], visible: boolean): Check {
  if (!visible) return { key: 'long_queries', label: 'Long-running queries', status: 'info', detail: 'This database role cannot see other sessions, so long-running queries are not measured.' };
  const long = ages.filter((a) => a >= LONG_QUERY_WARN_S);
  return { key: 'long_queries', label: 'Long-running queries', status: long.length ? 'warn' : 'ok',
    detail: long.length ? `${long.length} queries running over ${LONG_QUERY_WARN_S / 60} minutes (longest ${Math.round(Math.max(...long) / 60)} min).` : `None over ${LONG_QUERY_WARN_S / 60} minutes.` };
}

export function overall(checks: Check[]): Exclude<Status, 'info'> {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}
