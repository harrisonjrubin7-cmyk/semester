import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from './rollout-capabilities';
import {
  SYSTEM_IDS,
  SYSTEM_PASSPORTS,
  SYSTEM_RELATIONSHIPS,
  type SystemPassport,
  validateSystemPassports,
} from './systempassports';

const root = join(import.meta.dirname, '../../..');
const docsDir = join(root, 'docs/passports');
const indexPath = join(docsDir, 'README.md');
const read = (path: string) => readFileSync(path, 'utf8');

const bullets = (values: readonly string[]): string => values.map((value) => `- ${value}`).join('\n');

function renderPassport(item: SystemPassport): string {
  const capabilityText = item.capabilityIds.length > 0 ? item.capabilityIds.map((id) => `\`${id}\``).join(', ') : 'None directly; this is a shared or future system boundary.';
  const dependencyText = item.dependencies.length > 0 ? item.dependencies.map((id) => `\`${id}\``).join(', ') : 'None.';
  return `# ${item.name} system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

${item.purpose}

## System relationship

${bullets(item.relationships.map((relationship) => `\`${relationship}\``))}

## System of record

Semester owns:

${bullets(item.semesterOwns)}

External authority remains:

${bullets(item.externalAuthorities)}

## Authority

${bullets(item.authority)}

## Records

${bullets(item.records.map((record) => `\`${record}\``))}

## Commands

${bullets(item.commands.map((command) => `\`${command}\``))}

## Events

${bullets(item.events.map((event) => `\`${event}\``))}

## Integrations

${bullets(item.integrations)}

## Workflows

${bullets(item.workflows)}

## Screens

${bullets(item.screens)}

## Source and freshness rules

${bullets(item.sourceRules)}

## Audit evidence

${bullets(item.auditEvidence)}

## Tests

${bullets(item.tests)}

## Operational contract

- Owner: ${item.operations.owner}
- Service level: ${item.operations.serviceLevel}
- Alerts:
${item.operations.alerts.map((alert) => `  - ${alert}`).join('\n')}
- Runbook: \`${item.operations.runbook}\`
- Rollback: ${item.operations.rollback}
- Feature flags: ${item.operations.featureFlags.map((flag) => `\`${flag}\``).join(', ')}

## Dependencies and capability coverage

- System dependencies: ${dependencyText}
- Capability rows: ${capabilityText}

## External activation gates

${bullets(item.externalGates)}
`;
}

function renderIndex(): string {
  const rows = SYSTEM_PASSPORTS.map((item) =>
    `| [${item.name}](./${item.id}.md) | ${item.relationships.join(', ')} | ${item.operations.owner} | ${item.capabilityIds.length} |`,
  );
  return `# Semester system passports

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

These twenty-five passports are the required design and governance boundary for
Semester's OS domains. They prevent a screen-first build from omitting system
authority, source of truth, workflows, events, evidence, ownership or rollback.

They are **planning contracts only**. A passport does not prove source code,
database migration, policy, test, deployment, provider connection, institution
approval or live operation. Capability and activation truth remain in the
rollout and governance registers.

The permitted relationship vocabulary is ${SYSTEM_RELATIONSHIPS.map((item) => `\`${item}\``).join(', ')}.

| System | Relationship | Operational owner | Capability rows |
| --- | --- | --- | ---: |
${rows.join('\n')}

## Required implementation order

1. Use the machine-readable passport before designing a vertical slice.
2. Confirm existing repository truth and reuse the current shared primitives.
3. Implement records, policy, commands, events and workflow with tenant isolation.
4. Render authority, freshness and the complete state matrix on each screen.
5. Add audit, operational, accessibility, security and rollback evidence.
6. Keep external reads and writes disabled until their named gates are approved and verified.
`;
}

describe('system passports', () => {
  it('has one complete, unique passport for each of the twenty-five systems', () => {
    expect(SYSTEM_PASSPORTS).toHaveLength(25);
    expect(SYSTEM_PASSPORTS.map((item) => item.id)).toEqual(SYSTEM_IDS);
    expect(validateSystemPassports()).toEqual([]);
  });

  it('reports a removed contract field (control for the completeness guard)', () => {
    const broken = SYSTEM_PASSPORTS.map((item, index) => index === 0 ? { ...item, records: [] } : item);
    expect(validateSystemPassports(broken)).toContain('identity: missing records');
  });

  it('maps only real capability rows and leaves no current capability unmapped', () => {
    const known = new Set(CAPABILITIES.map((item) => item.id));
    const mapped = new Set(SYSTEM_PASSPORTS.flatMap((item) => item.capabilityIds));
    for (const item of SYSTEM_PASSPORTS) {
      for (const id of item.capabilityIds) expect(known.has(id), `${item.id}: ${id}`).toBe(true);
    }
    expect([...known].filter((id) => !mapped.has(id))).toEqual([]);
  });

  it('keeps dependencies resolvable, acyclic at the direct edge, and operationally gated', () => {
    const ids = new Set(SYSTEM_IDS);
    for (const item of SYSTEM_PASSPORTS) {
      expect(item.dependencies).not.toContain(item.id);
      for (const dependency of item.dependencies) expect(ids.has(dependency), `${item.id}: ${dependency}`).toBe(true);
      expect(item.externalGates.length, item.id).toBeGreaterThan(0);
      expect(item.operations.featureFlags.every((flag) => flag.startsWith('system.')), item.id).toBe(true);
    }
  });

  it('renders an index and one passport document per system', () => {
    if (process.env.REGISTERS === 'write') {
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(indexPath, renderIndex());
      for (const item of SYSTEM_PASSPORTS) writeFileSync(join(docsDir, `${item.id}.md`), renderPassport(item));
    }

    expect(existsSync(indexPath), indexPath).toBe(true);
    expect(read(indexPath)).toBe(renderIndex());
    for (const item of SYSTEM_PASSPORTS) {
      const path = join(docsDir, `${item.id}.md`);
      expect(existsSync(path), path).toBe(true);
      expect(read(path), path).toBe(renderPassport(item));
    }
  });
});
