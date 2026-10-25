// Institution analytics disclosure control (APP-014: "metric definitions + aggregate-only exports"). Pure, unit-tested.
// Rule: a count about people below MIN_CELL is never shown or exported as a number. When a breakdown has a known total and
// exactly one cell is suppressed, the next-smallest cell is suppressed too, so the hidden value cannot be recovered by
// subtraction (complementary suppression). Counts about things (requests, holds) follow the same rule because each one is a
// person's record. Totals are rounded down to the cell size only when every cell is suppressed.
export const MIN_CELL = 10;

export type Cell = { label: string; value: number };
export type ShownCell = { label: string; value: number | null; display: string; suppressed: boolean };

export function suppress(cells: Cell[], k = MIN_CELL): { cells: ShownCell[]; total: number | null; totalDisplay: string; suppressedCount: number } {
  const nonzero = cells.filter((c) => c.value > 0);
  const hide = new Set(nonzero.filter((c) => c.value < k).map((c) => c.label));
  if (hide.size === 1 && nonzero.length > 1) {
    const next = nonzero.filter((c) => !hide.has(c.label)).sort((a, b) => a.value - b.value)[0];
    if (next) hide.add(next.label);
  }
  const total = nonzero.reduce((s, c) => s + c.value, 0);
  const all = nonzero.length > 0 && hide.size === nonzero.length;
  const shown: ShownCell[] = nonzero.map((c) => hide.has(c.label)
    ? { label: c.label, value: null, display: c.value < k ? `<${k}` : 'suppressed', suppressed: true }
    : { label: c.label, value: c.value, display: String(c.value), suppressed: false });
  return {
    cells: shown,
    total: all ? null : total,
    totalDisplay: total === 0 ? '0' : all ? (total < k ? `<${k}` : `${Math.floor(total / k) * k}+`) : String(total),
    suppressedCount: hide.size,
  };
}

export type MetricDef = { id: string; label: string; counts: string; population: string; source: string; owner: string; version: string; caveat: string };
export const METRICS: MetricDef[] = [
  { id: 'members_by_role', label: 'Active members by role', counts: 'Active memberships, once per role held', population: 'Memberships in this institution with status Active', source: 'Semester memberships', owner: 'Institution administrator', version: '1', caveat: 'A person with two roles counts in both.' },
  { id: 'enrollments_by_status', label: 'Enrollments', counts: 'Enrollment records by status', population: 'Sections of courses offered by this institution', source: 'Semester enrollments (not the official SIS)', owner: 'Registrar', version: '1', caveat: 'Semester records, not the system of record.' },
  { id: 'registration_requests', label: 'Registration requests', counts: 'Registration requests by state', population: 'Requests filed in this institution', source: 'Semester registration requests', owner: 'Registrar', version: '1', caveat: 'Withdrawn requests are included.' },
  { id: 'rejection_reasons', label: 'Rejection reasons', counts: 'Rejected requests by result code', population: 'Requests in state Rejected', source: 'Semester registration requests', owner: 'Registrar', version: '1', caveat: 'One reason per request (the first failing rule).' },
  { id: 'holds_by_office', label: 'Active registration holds by office', counts: 'Active holds by originating office', population: 'Holds in this institution with status Active', source: 'Semester holds', owner: 'Each originating office', version: '1', caveat: 'A student may have several holds.' },
  { id: 'payment_plans', label: 'Payment plan requests', counts: 'Payment plan requests by status', population: 'Requests filed in this institution', source: 'Semester payment plan requests', owner: 'Bursar', version: '1', caveat: 'Requests, not approved plans.' },
];

/** Aggregate-only CSV. Suppressed cells are written as their display text, never the number. */
export function toCsv(rows: { metric: string; cells: ShownCell[]; totalDisplay: string }[], institution: string, generatedAt: string): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [`# ${institution} aggregate export, ${generatedAt}. Counts below ${MIN_CELL} are suppressed. No person-level data.`, 'metric,category,count'];
  for (const r of rows) {
    for (const c of r.cells) lines.push([r.metric, c.label, c.display].map(esc).join(','));
    lines.push([r.metric, 'Total', r.totalDisplay].map(esc).join(','));
  }
  return lines.join('\n');
}
