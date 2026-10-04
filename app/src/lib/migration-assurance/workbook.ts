/**
 * The migration workbooks, rendered from the declarations the engine runs.
 *
 * One per domain: what is in the source, what the field mapping and scope
 * approvals are, what stays behind, how the data is cleansed and transformed,
 * which checks decide correctness and at what threshold, which workflows run
 * in parallel, and what the institution signs. Because they are generated from
 * `domains.ts`, the document an institution signs cannot say something the
 * validator does not check.
 *
 * `docs/migration/WORKBOOKS.md` is this output, held to it by a test. The CSV
 * templates are what an institution actually fills in; `institution-migration
 * init` writes them into a working directory.
 */
import { DEPENDS_ON, DOMAINS } from './domains.ts';
import { describeInvariant } from './engine.ts';
import { SLA_HOURS } from './exceptions.ts';
import { MIN_CLEAN, WORKFLOWS } from './parallel.ts';
import { POLICY } from './quality.ts';
import { approvalsNeeded, scopeFlags } from './scope.ts';
import type { DomainSpec } from './types.ts';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const row = (...c: string[]) => `| ${c.map(cell).join(' | ')} |`;
const pct = (n: number) => `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`;

export function renderWorkbook(d: DomainSpec): string {
  const p = POLICY[d.stakes];
  const flags = scopeFlags(d);
  const out: string[] = [];
  out.push(`## ${d.label}`, '');
  out.push(`- **Domain id:** \`${d.id}\``);
  out.push(`- **Stakes:** ${d.stakes} ${d.stakes === 'high' ? '(a wrong record is a harm to a person; no tolerance for major or critical defects)' : '(defects are tolerated within the thresholds below and go to the exception queue)'}`);
  out.push(`- **Answers "is this right":** ${d.owner}`);
  out.push(`- **Loads after:** ${DEPENDS_ON[d.id].length ? DEPENDS_ON[d.id].map((x) => `\`${x}\``).join(', ') : 'nothing (first)'}`);
  out.push(`- **Typical sources:** ${d.sources.join('; ')}`, '');

  out.push('### 1. Source inventory', '', 'One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.', '');
  out.push(row('Entity', 'What it is', 'Identified by', 'Fields', 'Highest class'), row('---', '---', '---', '---', '---'));
  for (const e of d.entities) out.push(row(`\`${e.name}\``, e.label, e.key.join(' + '), String(e.fields.length), e.fields.map((f) => f.class).sort().at(-1)!));
  out.push('');

  out.push('### 2. Field mapping and scope', '', 'Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.', '');
  out.push(row('Field', 'Class', 'Scope'), row('---', '---', '---'));
  for (const e of d.entities) {
    for (const f of e.fields) {
      const flag = flags.find((x) => x.entity === e.name && x.field === f.name);
      const scope = !flag ? 'in scope' : flag.reason === 'class_blocked' ? 'blocked by the platform floor' : `needs \`${flag.approval}\` (${flag.reason === 'never_ingest' ? 'never ingested by default' : 'never displayed by default'})`;
      out.push(row(`\`${e.name}.${f.name}\`${f.note ? ` — ${f.note}` : ''}`, f.class, scope));
    }
  }
  out.push('');
  const approvals = approvalsNeeded(d);
  out.push(approvals.length ? `Approvals this domain needs on file: ${approvals.map((a) => `\`${a}\``).join(', ')}.` : 'No named scope approval is needed for this domain.', '');

  out.push('### 3. Not migrated', '');
  if (d.excluded.length === 0) out.push('Nothing in this domain is excluded by policy.');
  else {
    out.push(row('What stays behind', 'Class', 'What happens instead'), row('---', '---', '---'));
    for (const x of d.excluded) out.push(row(x.name.replace(/_/g, ' '), x.class, x.handling));
  }
  out.push('');

  out.push('### 4. Cleansing rules', '', 'Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.', '');
  for (const c of d.cleansing) out.push(`- ${c}`);
  out.push('');

  out.push('### 5. Transformation rules', '');
  for (const t of d.transforms) out.push(`- ${t}`);
  out.push('');

  out.push('### 6. Validation', '', 'Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.', '');
  out.push(row('Check', 'Kind', 'If it fails', 'What it asks'), row('---', '---', '---', '---'));
  for (const s of d.invariants) out.push(row(`\`${s.id}\``, s.kind, s.severity, describeInvariant(s)));
  out.push('');

  out.push('### 7. Thresholds', '');
  out.push(`- Critical defects introduced by the migration: **0**, always. Not a setting.`);
  out.push(`- Major, as a fraction of the rows a check examined: **${pct(p.majorMaxRate)}**.`);
  out.push(`- Minor: **${pct(p.minorMaxRate)}**.`);
  out.push('- Row counts reconcile exactly: source − excluded − approved merges = target.');
  out.push('- Every check examined at least one row, or the institution attested in writing that its population is empty.');
  out.push('- Every check was proven, on this data, to detect an injected defect of its own kind.');
  out.push('- A school may set stricter thresholds. It cannot set looser ones.', '');

  const wf = WORKFLOWS.filter((w) => w.domain === d.id);
  out.push('### 8. Parallel run', '');
  out.push(`Ends on **${MIN_CLEAN[d.stakes]}** clean cycles in a row, at least one of which exercised the real event. Tolerance: ${d.stakes === 'high' ? 'exact' : '0.005 on numbers, exact otherwise'}.`, '');
  out.push(row('Workflow', 'Must include', 'Outcomes compared'), row('---', '---', '---'));
  for (const w of wf) out.push(row(`\`${w.id}\` — ${w.label}`, `\`${w.event}\``, w.outcomes.map((o) => `\`${o}\``).join(', ')));
  out.push('');

  out.push('### 9. Exceptions', '');
  out.push(`Decision due within ${SLA_HOURS.critical} hours (critical), ${SLA_HOURS.major} hours (major), ${SLA_HOURS.minor / 24} days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days${d.stakes === 'high' ? '; above minor, the Semester side also countersigns' : ''}.`, '');

  out.push('### 10. Acceptance criteria', '', 'The institution signs these. Each is backed by a check, a parallel-run workflow, or both.', '');
  for (const a of d.acceptance) out.push(`- [ ] ${a}`);
  out.push('', `Signed — ${d.owner} (data owner): ____________________  Date: ________`, '');
  return out.join('\n');
}

export function renderAll(): string {
  const out: string[] = [
    '# Migration workbooks',
    '',
    '> Generated from `app/src/lib/migration-assurance/domains.ts` by `renderAll()`. Do not edit by hand: `MIGRATION_DOCS=write npx vitest run src/lib/migration-assurance/workbook.test.ts` regenerates it, and the test fails when this file and the declarations disagree. The method these workbooks serve is in [METHODOLOGY.md](METHODOLOGY.md).',
    '',
    '| Domain | Stakes | Owner | Entities | Checks | Scope approvals |',
    '| --- | --- | --- | --- | --- | --- |',
    ...DOMAINS.map((d) => row(`[${d.label}](#${d.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`, d.stakes, d.owner, String(d.entities.length), String(d.invariants.length), String(approvalsNeeded(d).length))),
    '',
    ...DOMAINS.map(renderWorkbook),
  ];
  return `${out.join('\n')}\n`;
}

const csv = (rows: readonly (readonly string[])[]) => `${rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')}\n`;

/** The files an institution fills in, pre-populated with what is already known. */
export function templates(d: DomainSpec): Record<string, string> {
  return {
    'inventory.csv': csv([
      ['entity', 'what_it_is', 'identified_by', 'source_system', 'source_table_or_file', 'source_owner', 'row_count', 'extraction_method', 'extract_frozen_at', 'notes'],
      ...d.entities.map((e) => [e.name, e.label, e.key.join('+'), '', '', '', '', '', '', '']),
    ]),
    'mapping.csv': csv([
      ['entity', 'field', 'class', 'scope', 'source_column', 'transform', 'lookup_table', 'approved_by', 'notes'],
      ...d.entities.flatMap((e) => e.fields.map((f) => {
        const flag = scopeFlags(d).find((x) => x.entity === e.name && x.field === f.name);
        return [e.name, f.name, f.class, !flag ? 'in_scope' : flag.reason === 'class_blocked' ? 'BLOCKED' : `needs:${flag.approval}`, '', '', '', '', ''];
      })),
    ]),
    'cleansing.csv': csv([['rule', 'rows_changed', 'expected_max', 'sample_reviewed_by', 'approved_by'], ...d.cleansing.map((c) => [c, '', '', '', ''])]),
    'excluded.csv': csv([['what', 'class', 'handling', 'confirmed_by'], ...d.excluded.map((x) => [x.name, x.class, x.handling, ''])]),
  };
}
