// Research snapshots (Institutional Researcher). Pure. Builds a snapshot output from raw aggregate counts and cohort sizes, passing
// every table through the disclosure control in lib/analytics.ts. The database (rsd_snapshot) refuses an output that still shows
// a count under the minimum; this function is the first line, the database the second.
import { suppress, MIN_CELL, METRICS } from './analytics';

export const RESEARCH_CODE_VERSION = `analytics-${METRICS.map((m) => `${m.id}@${m.version}`).join(',')};min=${MIN_CELL}`;
export type SnapshotCell = { label: string; value: number | null; display: string; suppressed: boolean };
export type SnapshotTable = { key: string; label: string; cells: SnapshotCell[]; total: number | null; totalDisplay: string };

export function buildSnapshot(spec: { metrics: string[]; cohorts?: string[] }, raw: Record<string, { label: string; value: number }[]>, cohorts: { id: string; title: string; size: number }[]): { tables: SnapshotTable[] } {
  const tables: SnapshotTable[] = [];
  for (const id of spec.metrics) {
    const def = METRICS.find((m) => m.id === id);
    if (!def) continue;
    const s = suppress(raw[id] ?? []);
    tables.push({ key: id, label: def.label, cells: s.cells, total: s.total, totalDisplay: s.totalDisplay });
  }
  const chosen = cohorts.filter((c) => (spec.cohorts ?? []).includes(c.id));
  if (chosen.length) {
    // Each cohort size is its own one-cell table: a size under the minimum is shown only as "<10".
    for (const c of chosen) {
      const s = suppress([{ label: c.title, value: c.size }]);
      tables.push({ key: `cohort:${c.id}`, label: `Cohort: ${c.title}`, cells: s.cells, total: s.total, totalDisplay: s.totalDisplay });
    }
  }
  return { tables };
}

/** True when no visible number in the output is below the minimum (what rsd_snapshot also checks). */
export function safeToStore(out: { tables: SnapshotTable[] }, k = MIN_CELL): boolean {
  return out.tables.every((t) => (t.total === null || t.total === 0 || t.total >= k) && t.cells.every((c) => c.value === null || c.value === 0 || c.value >= k));
}
