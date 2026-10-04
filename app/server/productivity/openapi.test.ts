import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as contract from './contract.ts';
import { COMMAND_TYPES, LIMITS } from './contract.ts';
import { ROUTES } from './http.ts';

/**
 * The published contract (`docs/api/productivity.v1.openapi.json`) is the
 * thing a mobile team, an integrator and a contract-test tool read. It is
 * held equal to the code here, so that it cannot describe an API that is no
 * longer the one served — and, in the other direction, so that a route, a
 * command or an error code cannot be added without the document saying so.
 */

const spec = JSON.parse(readFileSync(new URL('../../../docs/api/productivity.v1.openapi.json', import.meta.url), 'utf8')) as {
  paths: Record<string, Record<string, { operationId: string; parameters?: { $ref?: string; name?: string }[] }>>;
  components: { schemas: Record<string, any>; parameters: Record<string, any> };
  'x-error-codes': Record<string, { status: number; retryable: boolean }>;
};
const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');

describe('the OpenAPI document and the router agree', () => {
  it('lists exactly the routes there are, with the same methods', () => {
    const served = ROUTES.map((r) => `${r.method} ${r.template}`).sort();
    const documented = Object.entries(spec.paths).flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`)).sort();
    expect(documented).toEqual(served);
  });

  it('gives every operation an id', () => {
    const ids = Object.values(spec.paths).flatMap((ops) => Object.values(ops).map((o) => o.operationId));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names exactly the command types the validator accepts', () => {
    expect([...spec.components.schemas.CommandBase.properties.type.enum].sort()).toEqual([...COMMAND_TYPES].sort());
  });

  it('carries the limits the code enforces', () => {
    const s = spec.components.schemas;
    expect(s.CommandBatch.properties.commands.maxItems).toBe(LIMITS.batchMax);
    expect(spec.components.parameters.Limit.schema.maximum).toBe(LIMITS.pageMax);
    expect(spec.components.parameters.Limit.schema.default).toBe(LIMITS.pageDefault);
    expect(s.TaskFields.properties.title.maxLength).toBe(LIMITS.titleMax);
    expect(s.TaskFields.properties.notes.maxLength).toBe(LIMITS.notesMax);
    expect(s.EventFields.properties.location.maxLength).toBe(LIMITS.locationMax);
    expect(s.TaskFields.properties.courseId.maxLength).toBe(LIMITS.courseIdMax);
  });

  it('allows exactly the fields the validators allow', () => {
    const { TASK_FIELDS, EVENT_FIELDS } = contract;
    expect(Object.keys(spec.components.schemas.TaskFields.properties).sort()).toEqual([...TASK_FIELDS].sort());
    expect(Object.keys(spec.components.schemas.EventFields.properties).sort()).toEqual([...EVENT_FIELDS].sort());
    expect(Object.keys(spec.components.schemas.TaskChanges.properties).sort()).toEqual([...TASK_FIELDS].sort());
    expect(Object.keys(spec.components.schemas.EventChanges.properties).sort()).toEqual([...EVENT_FIELDS].sort());
  });

  it('refuses unknown properties wherever the validator does', () => {
    for (const name of ['CommandBatch', 'TaskFields', 'TaskChanges', 'EventFields', 'EventChanges']) {
      expect(spec.components.schemas[name].additionalProperties, name).toBe(false);
    }
  });
});

describe('every error code the code can emit is documented, with the status it is sent with', () => {
  const emitted = (): Map<string, number | null> => {
    const out = new Map<string, number | null>();
    const http = read('http.ts');
    const service = read('service.ts');
    for (const m of http.matchAll(/fail\((\d{3}), '([a-z_]+)'/g)) out.set(m[2]!, Number(m[1]));
    for (const m of service.matchAll(/new ApiError\((\d{3}), '([a-z_]+)'/g)) out.set(m[2]!, Number(m[1]));
    for (const m of service.matchAll(/this\.rejected\([^,]+, '([a-z_]+)'/g)) if (!out.has(m[1]!)) out.set(m[1]!, null);
    // Reasons the decision point gives: the productivity rules and the checks that precede every rule.
    const policy = read('../../../packages/institution/src/policy.ts');
    const rules = policy.slice(policy.indexOf('const PRODUCTIVITY'), policy.indexOf('const isClassification'));
    const common = policy.slice(policy.indexOf('export function decide'), policy.indexOf('export function applyObligations'));
    for (const m of [...rules.matchAll(/deny\('([a-z_]+)'/g), ...common.matchAll(/deny\('([a-z_]+)'/g)]) if (!out.has(m[1]!)) out.set(m[1]!, null);
    return out;
  };

  it('documents each one', () => {
    const codes = emitted();
    expect(codes.size).toBeGreaterThan(30);
    for (const code of codes.keys()) expect(Object.keys(spec['x-error-codes']), `${code} is emitted and not documented`).toContain(code);
  });

  it('documents each HTTP error with the status it is sent with, and only 429 and 503 as retryable', () => {
    for (const [code, status] of emitted()) if (status !== null) expect(spec['x-error-codes'][code]!.status, code).toBe(status);
    for (const [code, v] of Object.entries(spec['x-error-codes'])) expect(v.retryable, code).toBe(v.status === 429 || v.status === 503);
  });

  it('documents nothing that cannot happen', () => {
    const codes = emitted();
    for (const code of Object.keys(spec['x-error-codes'])) {
      // `unavailable` also reaches a client as the code of a failed command; `internal` is the 500 fallback.
      expect(codes.has(code), `${code} is documented and never emitted`).toBe(true);
    }
  });
});

