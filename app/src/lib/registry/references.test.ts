// Ratchet on passport references. Every identifier a passport names must resolve to
// another passport, or be listed below with the reason it does not. A new unresolved
// reference fails. A listed reference that now resolves also fails until its entry is
// removed. The list may shrink; it may not grow silently.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { danglingReferences, type PassportRecord } from './references';

const DIR = new URL('../../../../registry/passports/', import.meta.url);
const records: PassportRecord[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, value: JSON.parse(readFileSync(new URL(file, DIR), 'utf8')) }));

// Measured from registry/passports/*.json. The registry README records which of these
// are blocked on a record type that does not exist yet.
const OPEN: Record<string, string> = {
  'POL-READINESS-001': 'policy record not in this repository',
  'POL-DESIGN-SYSTEM-001': 'policy record not in this repository',
  'EVD-RLS-001': 'no evidence record type yet',
  'EVD-POLICY-001': 'no evidence record type yet',
  'EVD-A11Y-001': 'no evidence record type yet',
  'EVD-ROLLBACK-001': 'no evidence record type yet',
  'EVD-DESIGN-SYSTEM-CI-001': 'no evidence record type yet',
  'REL-READINESS-001': 'no release record type yet',
  'REL-DESIGN-SYSTEM-001': 'no release record type yet',
  'SLO-READINESS-001': 'no service-objective record type yet',
  'TST-RLS-003': 'no test-suite record type yet',
  'TST-WF-001': 'no test-suite record type yet',
  'TST-E2E-REG-001': 'no test-suite record type yet',
  'TST-A11Y-REG-001': 'no test-suite record type yet',
  'TST-DESIGN-SYSTEM-001': 'no test-suite record type yet',
};

describe('passport references', () => {
  it('leaves unresolved only the references listed as open, and no others', () => {
    const dangling = [...new Set(danglingReferences(records).map((site) => site.id))].sort();
    expect(dangling).toEqual(Object.keys(OPEN).sort());
  });
});

describe('reference resolution controls', () => {
  const record = (file: string, passport: unknown): PassportRecord => ({ file, value: { passport } });

  it('resolves a reference to a passport that declares it', () => {
    const dangling = danglingReferences([
      record('POL-A-001.json', { identity: { id: 'POL-A-001' } }),
      record('WF-A-001.json', { identity: { id: 'WF-A-001' }, control_plane: { policy_ids: ['POL-A-001'] } }),
    ]);
    expect(dangling).toEqual([]);
  });

  it('reports a reference that no passport declares, with the field it sits in', () => {
    const dangling = danglingReferences([
      record('WF-A-001.json', {
        identity: { id: 'WF-A-001' },
        control_plane: { policy_ids: ['POL-MISSING-001'], release_gate: 'REL-MISSING-001' },
      }),
    ]);
    expect(dangling).toEqual([
      { file: 'WF-A-001.json', field: 'control_plane.policy_ids', id: 'POL-MISSING-001' },
      { file: 'WF-A-001.json', field: 'control_plane.release_gate', id: 'REL-MISSING-001' },
    ]);
  });

  it('ignores free-text fields that are not references', () => {
    const dangling = danglingReferences([
      record('WF-A-001.json', { identity: { id: 'WF-A-001' }, dependencies: { upstream: ['POL-NOWHERE-001'] } }),
    ]);
    expect(dangling).toEqual([]);
  });
});
