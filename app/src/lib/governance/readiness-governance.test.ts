import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Registration-readiness governance lives in docs/governance/readiness/ as data.
// The guard is structural: every link resolves, an accepted claim carries proof,
// and every control is exercised by at least one acceptance scenario.

const root = join(import.meta.dirname, '../../../..');
const load = <T>(name: string): T =>
  JSON.parse(readFileSync(join(root, 'docs/governance/readiness', name), 'utf8')) as T;

interface Evidence {
  id: string;
  control_id: string;
  evidence_type: string;
  status: string;
  storage_uri: string | null;
  content_hash: string | null;
  reviewed_by: string | null;
  review_date: string | null;
  expires_at: string | null;
  [field: string]: unknown;
}
interface Control {
  id: string;
  control_type: string;
  evidence: string[];
  owner: string;
  test_frequency: string;
  failure_response: string;
  [field: string]: unknown;
}
interface Scenario {
  id: string;
  controls: string[];
  status: string;
  [field: string]: unknown;
}

const registry = load<{
  required_fields: string[];
  statuses: string[];
  evidence_types: string[];
  invalidation_rules: { trigger: string; invalidates: string[] }[];
  evidence: Evidence[];
}>('evidence-registry.json');

const register = load<{ required_fields: string[]; control_types: string[]; controls: Control[] }>(
  'control-register.json',
);

const scenarios = load<{ required_fields: string[]; statuses: string[]; scenarios: Scenario[] }>(
  'acceptance-scenarios.json',
);

const controlById = new Map(register.controls.map((c) => [c.id, c]));
const evidenceById = new Map(registry.evidence.map((e) => [e.id, e]));

describe('evidence registry', () => {
  it('has evidence to check', () => {
    expect(registry.evidence.length).toBeGreaterThan(0);
  });

  it('gives every entry the required fields', () => {
    for (const e of registry.evidence) {
      expect(Object.keys(e), e.id).toEqual(expect.arrayContaining(registry.required_fields));
    }
  });

  it('uses unique ids in the EVD-<area>-<nnn> form', () => {
    const ids = registry.evidence.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^EVD-[A-Z]+(-[A-Z]+)*-\d{3}$/);
  });

  it('uses only the statuses and evidence types it defines', () => {
    for (const e of registry.evidence) {
      expect(registry.statuses, e.id).toContain(e.status);
      expect(registry.evidence_types, e.id).toContain(e.evidence_type);
    }
  });

  it('accepts evidence only with a reviewer, a review date, an expiry, and a hashed artifact that exists', () => {
    for (const e of registry.evidence.filter((x) => x.status === 'accepted')) {
      expect(e.reviewed_by, `${e.id} reviewed_by`).toBeTruthy();
      expect(e.review_date, `${e.id} review_date`).toBeTruthy();
      expect(e.expires_at, `${e.id} expires_at`).toBeTruthy();
      expect(e.content_hash, `${e.id} content_hash`).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(e.storage_uri, `${e.id} storage_uri`).toBeTruthy();
      expect(existsSync(join(root, e.storage_uri as string)), `${e.id} artifact on disk`).toBe(true);
    }
  });

  it('links each entry to a control that lists it back', () => {
    for (const e of registry.evidence) {
      const control = controlById.get(e.control_id);
      expect(control, `${e.id} -> ${e.control_id}`).toBeDefined();
      expect(control?.evidence, `${e.control_id} lists ${e.id}`).toContain(e.id);
    }
  });

  it('names only evidence types that exist in its vocabulary', () => {
    for (const rule of registry.invalidation_rules) {
      for (const type of rule.invalidates) {
        expect(registry.evidence_types, `${rule.trigger} -> ${type}`).toContain(type);
      }
    }
  });
});

describe('control register', () => {
  it('gives every control the required fields', () => {
    for (const c of register.controls) {
      expect(Object.keys(c), c.id).toEqual(expect.arrayContaining(register.required_fields));
    }
  });

  it('uses unique ids in the CTRL-<area>-<nnn> form', () => {
    const ids = register.controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^CTRL-[A-Z]+-\d{3}$/);
  });

  it('gives every control a type, an owner, a test frequency, and a failure response', () => {
    for (const c of register.controls) {
      expect(register.control_types, c.id).toContain(c.control_type);
      expect(c.owner.trim(), `${c.id} owner`).not.toBe('');
      expect(c.test_frequency.trim(), `${c.id} test_frequency`).not.toBe('');
      expect(c.failure_response.trim(), `${c.id} failure_response`).not.toBe('');
    }
  });

  it('backs every control with evidence that points back to it', () => {
    for (const c of register.controls) {
      expect(c.evidence.length, `${c.id} has evidence`).toBeGreaterThan(0);
      for (const id of c.evidence) {
        expect(evidenceById.get(id)?.control_id, `${c.id} -> ${id}`).toBe(c.id);
      }
    }
  });
});

describe('acceptance scenarios', () => {
  it('has scenarios to check', () => {
    expect(scenarios.scenarios.length).toBeGreaterThan(0);
  });

  it('gives every scenario the required fields, with given/when/then filled in', () => {
    for (const s of scenarios.scenarios) {
      expect(Object.keys(s), s.id).toEqual(expect.arrayContaining(scenarios.required_fields));
      for (const step of ['given', 'when', 'then'] as const) {
        expect(Array.isArray(s[step]) && s[step].length > 0, `${s.id} ${step}`).toBe(true);
      }
    }
  });

  it('uses unique ids in the AT-RDY-<nnn> form and a known status', () => {
    const ids = scenarios.scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of scenarios.scenarios) {
      expect(s.id).toMatch(/^AT-RDY-\d{3}$/);
      expect(scenarios.statuses, s.id).toContain(s.status);
    }
  });

  it('exercises only controls that exist', () => {
    for (const s of scenarios.scenarios) {
      expect(s.controls.length, `${s.id} controls`).toBeGreaterThan(0);
      for (const id of s.controls) expect(controlById.has(id), `${s.id} -> ${id}`).toBe(true);
    }
  });

  it('covers every control in the register with at least one scenario', () => {
    const covered = new Set(scenarios.scenarios.flatMap((s) => s.controls));
    for (const c of register.controls) expect(covered.has(c.id), `${c.id} covered`).toBe(true);
  });
});
