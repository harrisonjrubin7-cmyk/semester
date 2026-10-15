import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, table } from '../ops/render';
import { PRIMITIVE_CLASS, WORKBOOKS } from './workbooks.ts';
import type { Workbook } from './workbooks.ts';
import { DATA_DOMAINS, EVIDENCE_CLASSES, SEVERITIES } from './types.ts';
import { DOMAIN_OWNER } from './signoff.ts';
import { executableSection } from './executable-docs.ts';

const root = join(import.meta.dirname, '../../../..');
const DIR = 'docs/migration/workbooks';
const HEADER = '<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->';

function page(w: Workbook): string {
  return [
    HEADER, '',
    `# Workbook: ${w.title}`, '',
    `**Done means:** ${w.done}`, '',
    `**Institution approver:** \`${w.owner}\` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).`, '',
    '## What to bring', '',
    ...table(['Entity', 'Natural key in the source', 'History', 'Sensitivity'], w.entities.map((e) => [cell(e.name), cell(e.naturalKey), e.history, e.sensitivity])), '',
    'Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.', '',
    '## Checks', '',
    'A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.', '',
    ...table(['Check', 'Proves', 'Severity', 'Primitive', 'Compares'], w.checks.map((c) => [`\`${c.id}\``, c.evidenceClass, c.severity, `\`${c.primitive}\``, cell(c.what)])), '',
    ...executableSection(w.domain),
    '## What a count will not show', '',
    ...w.traps.map((t) => `- ${t}`), '',
    '## Business outcomes to recompute, not copy', '',
    ...w.outcomes.map((o) => `- ${o}`), '',
    '## Calendar events the parallel run must include', '',
    ...w.parallelEvents.map((o) => `- \`${o}\``), '',
  ].join('\n');
}

function index(): string {
  return [
    HEADER, '',
    '# Migration workbooks', '',
    'One per kind of data. Each says what to bring, how to prove it arrived *correctly* (not merely that it arrived), and what to watch on the days that matter. The method is in [the migration pack](../README.md).', '',
    ...table(['Workbook', 'Approver', 'Entities', 'Checks', 'Done means'], WORKBOOKS.map((w) => [`[${w.title}](${w.domain}.md)`, `\`${w.owner}\``, String(w.entities.length), String(w.checks.length), cell(w.done)])), '',
    'The same checks as a spreadsheet: [`checks.csv`](checks.csv).', '',
  ].join('\n');
}

function csv(): string {
  const q = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const rows = WORKBOOKS.flatMap((w) => w.checks.map((c) => [w.domain, c.id, c.evidenceClass, c.severity, c.primitive, c.what].map(q).join(',')));
  return ['domain,check_id,evidence_class,severity,primitive,compares', ...rows, ''].join('\n');
}

describe('the migration workbooks', () => {
  it('cover every kind of data once', () => {
    expect(WORKBOOKS.map((w) => w.domain)).toEqual([...DATA_DOMAINS]);
  });

  it('cannot be proven by counts: every workbook has a check in every evidence class', () => {
    for (const w of WORKBOOKS) {
      for (const c of EVIDENCE_CLASSES) expect(w.checks.some((k) => k.evidenceClass === c), `${w.domain} has no ${c} check`).toBe(true);
    }
  });

  it('puts every count check at low severity: volumes alone never justify a stop or a go', () => {
    for (const w of WORKBOOKS) {
      expect(w.checks.filter((c) => c.evidenceClass === 'count').every((c) => c.severity === 'low'), w.domain).toBe(true);
    }
  });

  it('claims for each check only the class its primitive produces', () => {
    for (const w of WORKBOOKS) for (const c of w.checks) expect(PRIMITIVE_CLASS[c.primitive], c.id).toBe(c.evidenceClass);
  });

  it('has unique, domain-prefixed check ids and valid severities', () => {
    const ids = WORKBOOKS.flatMap((w) => w.checks.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of WORKBOOKS) for (const c of w.checks) {
      expect(c.id.startsWith(`${w.domain}.${c.evidenceClass}.`), c.id).toBe(true);
      expect(SEVERITIES).toContain(c.severity);
    }
  });

  it('agrees with the sign-off table about who owns each domain, and gives every domain traps, outcomes and events', () => {
    for (const w of WORKBOOKS) {
      expect(w.owner).toBe(DOMAIN_OWNER[w.domain]);
      expect(w.traps.length).toBeGreaterThan(2);
      expect(w.outcomes.length).toBeGreaterThan(1);
      expect(w.parallelEvents.length).toBeGreaterThan(1);
    }
  });

  it('require a recomputed outcome and a permission check at critical or high severity', () => {
    for (const w of WORKBOOKS) {
      expect(w.checks.some((c) => c.evidenceClass === 'permission' && (c.severity === 'critical' || c.severity === 'high')), w.domain).toBe(true);
      expect(w.checks.some((c) => c.evidenceClass === 'outcome' && c.severity !== 'low'), w.domain).toBe(true);
    }
  });

  it('render the pages under docs/migration/workbooks', () => {
    const outputs: [string, string][] = [
      [`${DIR}/README.md`, index()],
      [`${DIR}/checks.csv`, csv()],
      ...WORKBOOKS.map((w): [string, string] => [`${DIR}/${w.domain}.md`, page(w)]),
    ];
    if (process.env.MIGRATION_DOCS === 'write') {
      mkdirSync(join(root, DIR), { recursive: true });
      for (const [path, content] of outputs) writeFileSync(join(root, path), content);
    }
    for (const [path, content] of outputs) {
      expect(readFileSync(join(root, path), 'utf8'), `${path} is stale; run MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts from app/`).toBe(content);
    }
  });
});
