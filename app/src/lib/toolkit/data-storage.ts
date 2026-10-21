import { obj, textValue } from '../device-library';
import type { Tier } from './classification';

export type ColumnType = 'number' | 'category' | 'text' | 'date';

export interface Column {
  name: string;
  type: ColumnType;
  unit: string;
  valid: string;
  source: string;
  missingRule: string;
  /** Suggested types are only suggestions until the student confirms them. */
  confirmed: boolean;
}

export type TransformKind = 'drop-missing' | 'drop-duplicates' | 'recode' | 'exclude-column' | 'trim';

export interface Transform {
  id: string;
  kind: TransformKind;
  column: string;
  from: string;
  to: string;
  /** Why — required, because a cleaning log without reasons cannot be defended. */
  note: string;
}

export interface Interpretation {
  shows: string;
  method: string;
  uncertainty: string;
  conclude: string;
  cannotConclude: string;
}

export interface DataProject {
  id: string;
  name: string;
  tier: Tier;
  /** The CSV as imported. Never modified. */
  raw: string;
  imported: string;
  dictionary: Column[];
  transforms: Transform[];
  randomized: boolean;
  interpretation: Interpretation;
}

/*
 * Storage budget. Datasets live in localStorage, which one origin shares with
 * every other part of Semester — sign-in, threads, the other device
 * libraries. A toolkit that filled it would break those, and the failure
 * would land on whichever unrelated write came next. So the toolkit keeps
 * well inside the quota: one dataset's raw text at most `MAX_RAW`, and the
 * whole data library at most `DATA_BUDGET` characters once serialized
 * (JSON escaping can nearly double a CSV full of quotes and newlines, which
 * is why the budget is more than twice the per-file cap). Larger files
 * belong in Analyse data, which reads them without keeping a copy.
 */
export const MAX_RAW = 400_000;
export const DATA_BUDGET = 1_000_000;

const TIERS_OK = new Set(['T0', 'T1', 'T2', 'T3']);

export function readDataProjects(value: unknown): DataProject[] {
  if (!Array.isArray(value)) throw new Error('Data projects are not a list.');
  return value.map((p) => {
    if (!obj(p) || !textValue(p.id, 80) || !textValue(p.raw, MAX_RAW) || !TIERS_OK.has(p.tier as string))
      throw new Error('A data project is malformed.');
    const str = (v: unknown, max = 20_000) => (textValue(v, max) ? v : '');
    const interp = obj(p.interpretation) ? p.interpretation : {};
    return {
      id: p.id,
      name: str(p.name, 300) || 'Untitled dataset',
      tier: p.tier as Tier,
      raw: p.raw,
      imported: str(p.imported, 40),
      dictionary: Array.isArray(p.dictionary)
        ? p.dictionary.filter(obj).map((c) => ({
            name: str(c.name, 300),
            type: (['number', 'category', 'text', 'date'].includes(c.type as string) ? c.type : 'text') as ColumnType,
            unit: str(c.unit, 200),
            valid: str(c.valid, 2000),
            source: str(c.source, 2000),
            missingRule: str(c.missingRule, 2000),
            confirmed: c.confirmed === true,
          }))
        : [],
      transforms: Array.isArray(p.transforms)
        ? p.transforms.filter(obj).map((t) => ({
            id: str(t.id, 80),
            kind: (['drop-missing', 'drop-duplicates', 'recode', 'exclude-column', 'trim'].includes(t.kind as string) ? t.kind : 'trim') as TransformKind,
            column: str(t.column, 300),
            from: str(t.from, 2000),
            to: str(t.to, 2000),
            note: str(t.note, 5000),
          }))
        : [],
      randomized: p.randomized === true,
      interpretation: {
        shows: str(interp.shows),
        method: str(interp.method),
        uncertainty: str(interp.uncertainty),
        conclude: str(interp.conclude),
        cannotConclude: str(interp.cannotConclude),
      },
    };
  });
}
