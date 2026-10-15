/**
 * Reporting: aggregates that cannot be turned back into individuals.
 *
 * A report is a *definition* (what is counted, grouped by what, who owns it,
 * how sensitive) run over rows *the caller's tenant owns*. Three rules make it
 * safe to hand to an administrator, a department chair and a parent-facing
 * summary alike:
 *
 * 1. **Tenant first.** `runReport` drops every row whose tenant is not the
 *    scope's before it groups anything, and says how many it dropped (it
 *    should be zero; a non-zero count is a bug upstream worth an alert).
 * 2. **Small-cell suppression.** A cell with fewer than `minCell` people
 *    (default 10 — the n ≥ 10 floor from #762 and the cohort analytics)
 *    is suppressed, because "one first-year, on leave, in Aerospace" is a name.
 * 3. **Complementary suppression.** Hiding one cell is useless if the total
 *    and the other cells let a reader subtract it back. When exactly one
 *    cell in a group is suppressed, the next-smallest is suppressed too.
 *
 * Counts are of *distinct people*, not rows, so one student with ten
 * submissions is one. Row-level export is a different action with its own
 * capability and is not a report.
 */

export interface ReportDefinition {
  id: string;
  owner: string;
  description: string;
  /** The row field that identifies a person, for distinct counts. */
  personKey: string;
  /** Fields to group by. At most two: three-way cross-tabs are how small cells are made. */
  dimensions: readonly string[];
  minCell?: number;
}

export interface ReportRow {
  tenantId: string;
  [field: string]: string | number | boolean | null;
}

export interface ReportCell {
  key: Record<string, string>;
  count: number | null;
  suppressed: boolean;
}

export interface ReportResult {
  reportId: string;
  cells: ReportCell[];
  /** Rows dropped because they belonged to another tenant. Expect 0. */
  foreignRowsDropped: number;
  minCell: number;
}

export const DEFAULT_MIN_CELL = 10;
export const MAX_DIMENSIONS = 2;

export function reportProblems(def: ReportDefinition): string[] {
  const out: string[] = [];
  if (def.dimensions.length > MAX_DIMENSIONS) out.push(`${def.id}: more than ${MAX_DIMENSIONS} dimensions`);
  if (!def.owner.trim()) out.push(`${def.id}: no owner`);
  if ((def.minCell ?? DEFAULT_MIN_CELL) < DEFAULT_MIN_CELL) out.push(`${def.id}: minCell below ${DEFAULT_MIN_CELL}`);
  return out;
}

export function runReport(def: ReportDefinition, rows: readonly ReportRow[], scope: { tenantId: string }): ReportResult {
  const problems = reportProblems(def);
  if (problems.length > 0) throw new Error(problems.join('; '));
  const minCell = def.minCell ?? DEFAULT_MIN_CELL;

  let foreign = 0;
  const groups = new Map<string, { key: Record<string, string>; people: Set<string> }>();
  for (const row of rows) {
    if (row.tenantId !== scope.tenantId) {
      foreign++;
      continue;
    }
    const person = row[def.personKey];
    if (person === null || person === undefined) continue;
    const key = Object.fromEntries(def.dimensions.map((d) => [d, String(row[d] ?? 'unknown')]));
    const id = JSON.stringify(def.dimensions.map((d) => key[d]));
    const g = groups.get(id) ?? { key, people: new Set<string>() };
    g.people.add(String(person));
    groups.set(id, g);
  }

  const cells: ReportCell[] = [...groups.values()]
    .map((g) => ({ key: g.key, count: g.people.size, suppressed: g.people.size < minCell }))
    .sort((a, b) => JSON.stringify(a.key) < JSON.stringify(b.key) ? -1 : 1);

  // Complementary suppression, within each value of the first dimension.
  const byFirst = new Map<string, ReportCell[]>();
  for (const c of cells) {
    const first = def.dimensions.length > 1 ? c.key[def.dimensions[0]] : '';
    byFirst.set(first, [...(byFirst.get(first) ?? []), c]);
  }
  for (const group of byFirst.values()) {
    const hidden = group.filter((c) => c.suppressed);
    const shown = group.filter((c) => !c.suppressed);
    if (hidden.length === 1 && shown.length > 0) {
      const next = shown.reduce((a, b) => (b.count! < a.count! ? b : a));
      next.suppressed = true;
    }
  }

  return {
    reportId: def.id,
    cells: cells.map((c) => (c.suppressed ? { key: c.key, count: null, suppressed: true } : c)),
    foreignRowsDropped: foreign,
    minCell,
  };
}
