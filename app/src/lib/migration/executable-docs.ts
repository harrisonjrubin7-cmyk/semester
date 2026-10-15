/**
 * The part of each workbook page that comes from the executable declaration.
 *
 * `workbooks.ts` says what each kind of data needs checked. `domain-specs.ts`
 * is what the engine actually runs. Rendering the second into the first's page
 * keeps one document per domain, and makes the gap between them visible: which
 * evidence classes the engine covers on its own, and which still need results
 * from outside the two extracts.
 */
import { executableCoverage, SEVERITY_OF } from './adapter.ts';
import { specOf } from './domain-specs.ts';
import { describeInvariant } from './engine.ts';
import { approvalsNeeded, scopeFlags } from './scope.ts';
import { EVIDENCE_CLASSES, type DataDomain } from './types.ts';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const row = (...c: string[]) => `| ${c.map(cell).join(' | ')} |`;

export function executableSection(domain: DataDomain): string[] {
  const spec = specOf(domain);
  if (!spec) return [];
  const covered = executableCoverage(spec);
  const external = EVIDENCE_CLASSES.filter((c) => !covered.includes(c));
  const flags = scopeFlags(spec);
  const approvals = approvalsNeeded(spec);
  const out: string[] = [
    '## What the engine runs', '',
    `\`institution-migration validate\` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **${spec.stakes}**${spec.stakes === 'high' ? ' (no major defect tolerated; minor at 0.5%)' : ''}.`, '',
    row('Check', 'Kind', 'If it fails', 'What it asks'), row('---', '---', '---', '---'),
    ...spec.invariants.map((s) => row(`\`${s.id}\``, s.kind, SEVERITY_OF[s.gravity], describeInvariant(s))), '',
    `**Evidence classes the engine covers on its own:** ${covered.map((c) => `\`${c}\``).join(', ')}.`,
    external.length
      ? `**Still needs results from outside the two extracts:** ${external.map((c) => `\`${c}\``).join(', ')}, supplied as \`external-checks.json\` (see the workbook checks above for what to run). The gate refuses the domain until they arrive.`
      : '**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.',
    '',
    '## What stays behind', '',
  ];
  if (spec.excluded.length === 0) out.push('Nothing in this domain is excluded by policy.', '');
  else out.push(row('What', 'Class', 'What happens instead'), row('---', '---', '---'), ...spec.excluded.map((x) => row(x.name.replace(/_/g, ' '), x.class, x.handling)), '');
  out.push('## Scope approvals', '');
  if (!flags.length) out.push('No field here is refused or needs a named approval.', '');
  else {
    out.push('Fields the platform never ingests by default need a named approval from the records owner and the privacy lead before the mapping can be approved; fields in a class the platform floor refuses cannot be approved at all.', '');
    out.push(row('Field', 'Class', 'Why', 'Needs'), row('---', '---', '---', '---'), ...flags.map((f) => row(`\`${f.entity}.${f.field}\``, f.class, f.reason.replace('_', ' '), f.approval ? `\`${f.approval}\`` : 'nothing can; stays at source')), '');
    if (approvals.length) out.push(`Approvals to have on file: ${approvals.map((a) => `\`${a}\``).join(', ')}.`, '');
  }
  return out;
}
