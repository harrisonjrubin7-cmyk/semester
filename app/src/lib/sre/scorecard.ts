/**
 * The reliability scorecard: how much of what the catalog lists is actually
 * operable, computed from the registers rather than asserted.
 *
 * A scorecard that can only go up when somebody does the work is the point.
 * Each dimension below is a fact the other registers either support or do not;
 * nothing is a number somebody typed. Today most cells are false, and the
 * scorecard says so, class by class — that is its job. The first run of it is
 * the baseline, and the only direction anything is allowed to move is up.
 *
 * Dimensions and when each applies:
 *
 *   owner      always            — the role has a primary
 *   backup     always            — the role has a trained second person
 *   runbook    always            — the named runbook is in the index
 *   alert      C0, C1, C2        — at least one alert is `wired` or better
 *   measured   journey-bearing   — the journey has an accepted SLI event stream
 *   drilled    C0, C1            — an experiment against it has been executed
 *
 * `delivery_tested` is deliberately not a scorecard dimension of its own: it
 * is the *top* of the alert ladder, reported separately, because it is the one
 * thing that distinguishes "a check runs" from "a person would have been woken".
 */

import { ALERTS } from './alerts';
import { COMPONENTS, ROLE_HOLDERS, CRITICALITY_ORDER, type Component, type Criticality } from './catalog';
import { EXPERIMENTS } from './chaos';
import { runbook } from './runbooks';

export type Dimension = 'owner' | 'backup' | 'runbook' | 'alert' | 'measured' | 'drilled';
export const DIMENSIONS: readonly Dimension[] = ['owner', 'backup', 'runbook', 'alert', 'measured', 'drilled'];

/**
 * Journeys with an accepted privacy-reviewed event stream that supplies
 * eligible and bad counts. Empty on purpose; adding an id here is a claim, and
 * the SLO draft says what it takes to make it (SLO-SLI-DRAFT.md, "Missing
 * test/proof").
 */
export const MEASURED_JOURNEYS: readonly string[] = [];

export type Cell = boolean | 'n/a';

export interface Row {
  component: string;
  criticality: Criticality;
  cells: Record<Dimension, Cell>;
}

function cells(c: Component): Record<Dimension, Cell> {
  const holder = ROLE_HOLDERS.find((h) => h.role === c.role);
  const hasAlert = ALERTS.some((a) => a.component === c.id && (a.state === 'wired' || a.state === 'delivery_tested'));
  return {
    owner: !!holder?.primary,
    backup: !!holder?.backup,
    runbook: !!runbook(c.runbook),
    alert: c.criticality === 'C3' ? 'n/a' : hasAlert,
    measured: c.journeys.length === 0 ? 'n/a' : c.journeys.every((j) => MEASURED_JOURNEYS.includes(j)),
    drilled: c.criticality === 'C2' || c.criticality === 'C3' ? 'n/a' : EXPERIMENTS.some((e) => e.component === c.id && e.status === 'executed'),
  };
}

export const scorecard = (components: readonly Component[] = COMPONENTS): Row[] =>
  components.map((c) => ({ component: c.id, criticality: c.criticality, cells: cells(c) }));

export interface ClassSummary {
  criticality: Criticality;
  components: number;
  /** Per dimension: satisfied of applicable. */
  dimensions: Record<Dimension, { satisfied: number; applicable: number }>;
}

export function summarise(rows: readonly Row[] = scorecard()): ClassSummary[] {
  return CRITICALITY_ORDER.map((criticality) => {
    const mine = rows.filter((r) => r.criticality === criticality);
    const dimensions = {} as ClassSummary['dimensions'];
    for (const d of DIMENSIONS) {
      const applicable = mine.filter((r) => r.cells[d] !== 'n/a');
      dimensions[d] = { satisfied: applicable.filter((r) => r.cells[d] === true).length, applicable: applicable.length };
    }
    return { criticality, components: mine.length, dimensions };
  });
}

/** Every unsatisfied applicable cell, most critical class first. The to-do list, in order. */
export function gaps(rows: readonly Row[] = scorecard()): Array<{ component: string; criticality: Criticality; dimension: Dimension }> {
  const out: Array<{ component: string; criticality: Criticality; dimension: Dimension }> = [];
  for (const cls of CRITICALITY_ORDER) {
    for (const r of rows.filter((x) => x.criticality === cls)) {
      for (const d of DIMENSIONS) if (r.cells[d] === false) out.push({ component: r.component, criticality: cls, dimension: d });
    }
  }
  return out;
}

/** How far up the alert ladder the register is: counts per state. */
export function alertLadder(): Record<'defined' | 'manual' | 'wired' | 'delivery_tested', number> {
  const out = { defined: 0, manual: 0, wired: 0, delivery_tested: 0 };
  for (const a of ALERTS) out[a.state]++;
  return out;
}

/** Roles that fail the "one person, no backup" test, by name. */
export const singlePointsOfFailure = (): string[] => ROLE_HOLDERS.filter((h) => !h.backup).map((h) => h.role);
