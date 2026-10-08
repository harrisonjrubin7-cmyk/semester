export interface Row { priority: 'P0' | 'P1' | 'P2'; status: string; gate: string }
/** Launch-ready only when every P0 is Done; reports what blocks real student data. */
export function readiness(rows: Row[]) {
  const p0 = rows.filter((r) => r.priority === 'P0'); const open = p0.filter((r) => r.status !== 'Done');
  return { ready: open.length === 0, p0Total: p0.length, p0Open: open.length, pct: p0.length ? Math.round(((p0.length - open.length) / p0.length) * 100) : 100, blockers: open.filter((r) => /pilot|student|contract/i.test(r.gate)) };
}
