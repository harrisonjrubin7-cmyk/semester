/**
 * The files an institution fills in, pre-populated with what is already known.
 *
 * Generated from the same declaration the engine runs, so the inventory an
 * institution completes names exactly the entities that will be checked, and
 * the mapping sheet shows, field by field, which ones need a scope approval or
 * are refused outright by the platform floor.
 */
import type { DomainSpec } from './engine-types.ts';
import { scopeFlags } from './scope.ts';

const csv = (rows: readonly (readonly string[])[]) => `${rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')}\n`;

export function templates(d: DomainSpec): Record<string, string> {
  const flags = scopeFlags(d);
  return {
    'inventory.csv': csv([
      ['entity', 'what_it_is', 'identified_by', 'source_system', 'source_table_or_file', 'source_owner', 'row_count', 'extraction_method', 'extract_frozen_at', 'notes'],
      ...d.entities.map((e) => [e.name, e.label, e.key.join('+'), '', '', '', '', '', '', '']),
    ]),
    'mapping.csv': csv([
      ['entity', 'field', 'class', 'scope', 'source_column', 'transform', 'lookup_table', 'approved_by', 'notes'],
      ...d.entities.flatMap((e) =>
        e.fields.map((f) => {
          const flag = flags.find((x) => x.entity === e.name && x.field === f.name);
          return [e.name, f.name, f.class, !flag ? 'in_scope' : flag.reason === 'class_blocked' ? 'BLOCKED' : `needs:${flag.approval}`, '', '', '', '', ''];
        }),
      ),
    ]),
    'cleansing.csv': csv([['rule', 'rows_changed', 'expected_max', 'sample_reviewed_by', 'approved_by'], ...d.cleansing.map((c) => [c, '', '', '', ''])]),
    'excluded.csv': csv([['what', 'class', 'handling', 'confirmed_by'], ...d.excluded.map((x) => [x.name, x.class, x.handling, ''])]),
  };
}
