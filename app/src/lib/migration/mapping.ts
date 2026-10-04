/**
 * Mapping and cleansing: one declared rule per field, and a lineage line for
 * every value that moved.
 *
 * Beside the Migration Center's `preview` (`center.ts`), not instead of it:
 * that previews one flat file against field maps with nine transforms. This
 * adds what a multi-system migration needs on top — code tables with no
 * default, declared drops, an explicit reading order for slash dates, minor
 * units for money, and lineage per field.
 *
 * The failure this prevents is silent: a field the mapping never mentions
 * disappears, an unknown code becomes a default, a `03/04/2025` is read as
 * March by a team that meant April. So:
 *
 * - A source field that is neither mapped nor *declared dropped, with a
 *   reason* is an issue (`unmapped_source_field`), on every row.
 * - A code that is not in the code table is an issue, never a default.
 * - A slash date is only read when the spec says which order it is in.
 * - Money becomes integer minor units, or an issue; there is no rounding.
 *
 * Pure and deterministic: the same row and spec give the same output and
 * lineage, so a transform can be re-run during rehearsal and compared.
 */

export type Cleanse = 'trim' | 'collapse_space' | 'upper' | 'lower' | 'nfc' | 'null_tokens' | 'date_iso' | 'minor_units';

export interface FieldRule {
  source: string;
  target: string;
  required?: boolean;
  cleanse?: readonly Cleanse[];
  /** If present the cleansed value must be a key; the target is its value. No default. */
  codeTable?: Readonly<Record<string, string>>;
}

export interface MappingSpec {
  /** Bump when any rule changes; lineage carries it. */
  version: string;
  rules: readonly FieldRule[];
  /** Fields we looked at and chose not to bring, each with a reason. */
  drops: readonly { field: string; reason: string }[];
  /** How to read `a/b/yyyy`. Without it a slash date is an issue. */
  slashDates?: 'month_first' | 'day_first';
  /** Strings that mean "no value" in this source. */
  nullTokens?: readonly string[];
}

export type MappingIssueCode = 'unmapped_source_field' | 'missing_required' | 'unknown_code' | 'bad_date' | 'bad_amount';

export interface MappingIssue {
  code: MappingIssueCode;
  field: string;
}

export interface LineageLine {
  target: string;
  source: string;
  steps: readonly string[];
  mappingVersion: string;
}

export interface Transformed {
  target: Record<string, string | number | null>;
  lineage: LineageLine[];
  issues: MappingIssue[];
}

const DEFAULT_NULLS = ['', 'N/A', 'NA', 'NULL', 'NONE', '-', '.'];

function toIsoDate(v: string, slash: MappingSpec['slashDates']): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const sl = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (sl && slash) [y, m, d] = slash === 'month_first' ? [+sl[3], +sl[1], +sl[2]] : [+sl[3], +sl[2], +sl[1]];
  else return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toMinorUnits(v: string): number | null {
  const m = /^(-?)\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(v.trim());
  if (!m) return null;
  const whole = Number(m[2].replace(/,/g, ''));
  const cents = Number((m[3] ?? '').padEnd(2, '0') || '0');
  const n = whole * 100 + cents;
  return m[1] ? -n : n;
}

export function applyMapping(row: Readonly<Record<string, unknown>>, spec: MappingSpec): Transformed {
  const issues: MappingIssue[] = [];
  const lineage: LineageLine[] = [];
  const target: Record<string, string | number | null> = {};
  const nulls = new Set((spec.nullTokens ?? DEFAULT_NULLS).map((s) => s.toUpperCase()));
  const known = new Set([...spec.rules.map((r) => r.source), ...spec.drops.map((d) => d.field)]);

  for (const field of Object.keys(row)) if (!known.has(field)) issues.push({ code: 'unmapped_source_field', field });

  for (const rule of spec.rules) {
    const raw = row[rule.source];
    const steps: string[] = [];
    let value: string | number | null = raw === undefined || raw === null ? null : String(raw);
    let failed = false;

    for (const c of rule.cleanse ?? []) {
      if (value === null || typeof value === 'number') break;
      switch (c) {
        case 'trim': value = value.trim(); break;
        case 'collapse_space': value = value.replace(/\s+/g, ' '); break;
        case 'upper': value = value.toUpperCase(); break;
        case 'lower': value = value.toLowerCase(); break;
        case 'nfc': value = value.normalize('NFC'); break;
        case 'null_tokens': if (nulls.has(value.trim().toUpperCase())) value = null; break;
        case 'date_iso': {
          const d = toIsoDate(value.trim(), spec.slashDates);
          if (d === null) { issues.push({ code: 'bad_date', field: rule.source }); failed = true; } else value = d;
          break;
        }
        case 'minor_units': {
          const n = toMinorUnits(value);
          if (n === null) { issues.push({ code: 'bad_amount', field: rule.source }); failed = true; } else value = n;
          break;
        }
      }
      steps.push(c);
      if (failed) break;
    }
    if (failed) continue;

    if (value !== null && rule.codeTable) {
      const mapped = rule.codeTable[String(value)];
      if (mapped === undefined) { issues.push({ code: 'unknown_code', field: rule.source }); continue; }
      value = mapped;
      steps.push('code_table');
    }
    if ((value === null || value === '') && rule.required) { issues.push({ code: 'missing_required', field: rule.source }); continue; }

    target[rule.target] = value === '' ? null : value;
    lineage.push({ target: rule.target, source: rule.source, steps, mappingVersion: spec.version });
  }
  return { target, lineage, issues };
}
